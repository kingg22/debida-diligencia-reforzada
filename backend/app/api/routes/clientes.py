import difflib
import hashlib
import urllib.parse
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import col, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    SessionDep,
    require_2fa_if_required_by_role,
    require_roles,
)
from app.auditoria import registrar_auditoria
from app.kyc_risk import calcular_riesgo
from app.models import (
    ClientType,
    DocumentoEstado,
    DocumentoKYC,
    DocumentoKYCPublic,
    DocumentoTipo,
    ExpedienteKYC,
    ExpedienteKYCCreate,
    ExpedienteKYCPublic,
    ExpedienteKYCUpdate,
    ExpedientesKYCPublic,
    KYCStatus,
    ListaCoincidencia,
    ListaRestrictivaSimulada,
    ListasResult,
    Message,
    RiesgoOverrideInput,
    RiesgoResult,
    RiskLevel,
    ScreeningResultado,
    ScreeningResultadoPublic,
    User,
    UserRole,
)

router = APIRouter(
    prefix="/clientes",
    tags=["clientes"],
    dependencies=[Depends(require_2fa_if_required_by_role)],
)

# Almacenamiento local de documentos (efímero en el contenedor).
UPLOAD_DIR = Path("uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png"}

# Roles que pueden registrar clientes y los que pueden revisar/mutar.
RegistraCliente = Depends(require_roles(UserRole.ANALISTA_DDR))
AccesoKYC = Depends(
    require_roles(UserRole.ANALISTA_DDR, UserRole.OFICIAL_CUMPLIMIENTO)
)
# Lectura: los roles que revisan o auditan también necesitan consultar
# expedientes (Gerente/Comité deciden casos DDR; el Auditor examina todo).
LecturaKYC = Depends(
    require_roles(
        UserRole.ANALISTA_DDR,
        UserRole.OFICIAL_CUMPLIMIENTO,
        UserRole.GERENTE_CUMPLIMIENTO,
        UserRole.COMITE_CUMPLIMIENTO,
        UserRole.AUDITOR,
    )
)

_ROLES_VEN_TODO = {
    UserRole.OFICIAL_CUMPLIMIENTO,
    UserRole.GERENTE_CUMPLIMIENTO,
    UserRole.COMITE_CUMPLIMIENTO,
    UserRole.AUDITOR,
}


def _puede_ver_todos(user: User) -> bool:
    return user.is_superuser or user.role in _ROLES_VEN_TODO


def _get_expediente_o_404(
    session: SessionDep, expediente_id: uuid.UUID
) -> ExpedienteKYC:
    expediente = crud.get_expediente(session=session, expediente_id=expediente_id)
    if not expediente:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return expediente


def _verificar_acceso(expediente: ExpedienteKYC, user: User) -> None:
    if not _puede_ver_todos(user) and expediente.analista_id != user.id:
        raise HTTPException(status_code=403, detail="No tiene acceso a este expediente")


@router.post("/", response_model=ExpedienteKYCPublic, dependencies=[RegistraCliente])
def create_cliente(
    *, session: SessionDep, current_user: CurrentUser, expediente_in: ExpedienteKYCCreate
) -> Any:
    """
    Registrar un nuevo cliente (expediente KYC).
    """
    if expediente_in.tipo_cliente == ClientType.NATURAL:
        if expediente_in.persona_natural is None:
            raise HTTPException(
                status_code=422,
                detail="Persona Natural requiere los datos de la persona",
            )
    else:
        if expediente_in.persona_juridica is None:
            raise HTTPException(
                status_code=422,
                detail="Persona Jurídica requiere los datos de la empresa",
            )
        # Validación de beneficiarios finales (Ley 254/2021) la hace
        # el @model_validator en ExpedienteKYCCreate (models.py).
        # FastAPI la convierte en 422 antes de llegar aquí.

    expediente = crud.create_expediente(
        session=session,
        expediente_in=expediente_in,
        analista_id=current_user.id,
    )
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="KYC",
        accion="CREAR_EXPEDIENTE",
        entidad_tipo="ExpedienteKYC",
        entidad_id=expediente.id,
        descripcion=f"Expediente KYC creado ({expediente.tipo_cliente}, código {expediente.codigo})",
    )
    return expediente


@router.get("/", response_model=ExpedientesKYCPublic, dependencies=[LecturaKYC])
def read_clientes(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    tipo: ClientType | None = None,
    status: KYCStatus | None = None,
    riesgo: RiskLevel | None = None,
    search: str | None = None,
) -> Any:
    """
    Listar expedientes KYC con filtros y paginación.
    El analista solo ve los suyos; oficial/admin ven todos.
    """
    filters: list[Any] = []
    if not _puede_ver_todos(current_user):
        filters.append(ExpedienteKYC.analista_id == current_user.id)
    if tipo is not None:
        filters.append(ExpedienteKYC.tipo_cliente == tipo.value)
    if status is not None:
        filters.append(ExpedienteKYC.status == status.value)
    if riesgo is not None:
        filters.append(ExpedienteKYC.nivel_riesgo == riesgo.value)
    if search:
        filters.append(col(ExpedienteKYC.codigo).ilike(f"%{search}%"))

    count = session.exec(
        select(func.count()).select_from(ExpedienteKYC).where(*filters)
    ).one()
    expedientes = session.exec(
        select(ExpedienteKYC)
        .where(*filters)
        .order_by(col(ExpedienteKYC.created_at).desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return ExpedientesKYCPublic(
        data=[ExpedienteKYCPublic.model_validate(e) for e in expedientes],
        count=count,
    )


@router.get("/{id}", response_model=ExpedienteKYCPublic, dependencies=[LecturaKYC])
def read_cliente(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Obtener el detalle de un expediente KYC.
    """
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)
    return expediente


@router.patch("/{id}", response_model=ExpedienteKYCPublic, dependencies=[AccesoKYC])
def update_cliente(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    update_in: ExpedienteKYCUpdate,
) -> Any:
    """
    Actualizar el estado de un expediente (enviar a revisión, aprobar, rechazar).
    """
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)

    nuevo_status = update_in.status
    if nuevo_status is not None:
        es_revisor = _puede_ver_todos(current_user)
        decisiones_revisor = {
            KYCStatus.EN_REVISION,
            KYCStatus.APROBADO,
            KYCStatus.RECHAZADO,
        }
        if nuevo_status in decisiones_revisor and not es_revisor:
            raise HTTPException(
                status_code=403,
                detail="Solo el oficial de cumplimiento puede revisar expedientes",
            )
        if nuevo_status == KYCStatus.RECHAZADO and not update_in.comentario_rechazo:
            raise HTTPException(
                status_code=400,
                detail="El rechazo requiere un comentario",
            )
        expediente.status = nuevo_status.value

    if update_in.comentario_rechazo is not None:
        expediente.comentario_rechazo = update_in.comentario_rechazo

    expediente.updated_at = datetime.now(timezone.utc)
    session.add(expediente)
    session.commit()
    session.refresh(expediente)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="KYC",
        accion="ACTUALIZAR_ESTADO_EXPEDIENTE",
        entidad_tipo="ExpedienteKYC",
        entidad_id=expediente.id,
        descripcion=f"Estado actualizado a {expediente.status}",
    )
    return expediente


@router.post(
    "/{id}/documentos",
    response_model=DocumentoKYCPublic,
    dependencies=[RegistraCliente],
)
def upload_documento(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    tipo: DocumentoTipo = Form(...),
    file: UploadFile = File(...),
) -> Any:
    """
    Subir un documento al expediente (PDF/JPG/PNG, máx. 10 MB).
    """
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)

    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no permitido (use PDF, JPG o PNG)",
        )

    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail="El archivo supera el límite de 10 MB"
        )

    hash_sha256 = hashlib.sha256(content).hexdigest()

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    doc_id = uuid.uuid4()
    extension = Path(file.filename or "").suffix
    destino = UPLOAD_DIR / f"{doc_id}{extension}"
    destino.write_bytes(content)

    documento = DocumentoKYC(
        id=doc_id,
        expediente_id=expediente.id,
        tipo=tipo.value,
        nombre=file.filename or f"documento{extension}",
        tamanio=len(content),
        mime_type=file.content_type or "application/octet-stream",
        estado=DocumentoEstado.PENDIENTE.value,
        ruta_archivo=str(destino),
        hash_sha256=hash_sha256,
    )
    session.add(documento)
    session.commit()
    session.refresh(documento)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="KYC",
        accion="SUBIR_DOCUMENTO",
        entidad_tipo="DocumentoKYC",
        entidad_id=documento.id,
        descripcion=f"Documento {tipo.value} subido al expediente {id}",
    )
    return documento


@router.delete("/{id}/documentos/{doc_id}", dependencies=[RegistraCliente])
def delete_documento(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    doc_id: uuid.UUID,
) -> Message:
    """
    Eliminar un documento del expediente.
    """
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)

    documento = session.get(DocumentoKYC, doc_id)
    if not documento or documento.expediente_id != expediente.id:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    if documento.ruta_archivo:
        archivo = Path(documento.ruta_archivo)
        if archivo.exists():
            archivo.unlink()

    session.delete(documento)
    session.commit()
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="KYC",
        accion="ELIMINAR_DOCUMENTO",
        entidad_tipo="DocumentoKYC",
        entidad_id=doc_id,
        descripcion=f"Documento eliminado del expediente {id}",
    )
    return Message(message="Documento eliminado")


@router.get(
    "/{id}/documentos/{doc_id}/descargar",
    dependencies=[LecturaKYC],
)
def descargar_documento(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    doc_id: uuid.UUID,
    disposition: str = Query(default="attachment", pattern="^(inline|attachment)$"),
) -> FileResponse:
    """Descargar (attachment) o previsualizar inline un documento del expediente.
    El archivo se reconstruye desde `ruta_archivo` en la fila del documento;
    nunca se conf\u00eda en nombres provistos por el cliente."""
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)

    documento = session.get(DocumentoKYC, doc_id)
    if not documento or documento.expediente_id != expediente.id:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if not documento.ruta_archivo:
        raise HTTPException(status_code=410, detail="El archivo ya no está disponible")

    archivo = Path(documento.ruta_archivo)
    if not archivo.is_file():
        raise HTTPException(status_code=410, detail="El archivo ya no está disponible")

    nombre = documento.nombre
    safe_name = nombre.encode("ascii", "ignore").decode("ascii") or "documento"
    headers = {
        "Content-Disposition": (
            f'{disposition}; filename="{safe_name}"; '
            f"filename*=UTF-8''{urllib.parse.quote(nombre)}"
        ),
        "X-Content-Type-Options": "nosniff",
    }
    return FileResponse(
        path=str(archivo),
        media_type=documento.mime_type or "application/octet-stream",
        headers=headers,
    )


@router.post(
    "/{id}/evaluar-riesgo", response_model=RiesgoResult, dependencies=[AccesoKYC]
)
def evaluar_riesgo(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Recalcular y persistir el nivel de riesgo del expediente.
    """
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)

    pesos = crud.get_pesos_riesgo(session)
    resultado = calcular_riesgo(expediente, pesos)
    crud.recalcular_riesgo_expediente(session=session, expediente=expediente)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="KYC",
        accion="EVALUAR_RIESGO",
        entidad_tipo="ExpedienteKYC",
        entidad_id=id,
        descripcion=f"Riesgo calculado: {resultado.nivel} (puntaje {resultado.puntaje})",
    )
    return resultado


_SIMILITUD_UMBRAL = 70  # porcentaje mínimo para considerar coincidencia


def _similitud(a: str, b: str) -> int:
    a_n = a.lower().strip()
    b_n = b.lower().strip()
    ratio = difflib.SequenceMatcher(None, a_n, b_n).ratio()
    return round(ratio * 100)


def _nombre_expediente(expediente: ExpedienteKYC) -> str:
    if expediente.tipo_cliente == "NATURAL" and expediente.persona_natural:
        pn = expediente.persona_natural
        return f"{pn.nombre} {pn.apellido}".strip()
    if expediente.persona_juridica:
        return expediente.persona_juridica.razon_social or ""
    return ""


def _doc_expediente(expediente: ExpedienteKYC) -> str | None:
    if expediente.tipo_cliente == "NATURAL" and expediente.persona_natural:
        return expediente.persona_natural.numero_documento
    if expediente.persona_juridica:
        return expediente.persona_juridica.ruc
    return None


@router.post(
    "/{id}/verificar-listas", response_model=ListasResult, dependencies=[AccesoKYC]
)
def verificar_listas(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """Screening contra listas restrictivas con similitud fuzzy (difflib)."""
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)

    nombre = _nombre_expediente(expediente)
    doc = _doc_expediente(expediente)

    entradas = session.exec(
        select(ListaRestrictivaSimulada).where(ListaRestrictivaSimulada.activo == True)
    ).all()

    coincidencias: list[ListaCoincidencia] = []
    for entrada in entradas:
        sim = _similitud(nombre, entrada.nombre_completo)
        if sim < _SIMILITUD_UMBRAL:
            # Coincidencia exacta por documento
            if doc and entrada.numero_documento and doc == entrada.numero_documento:
                sim = 100
            else:
                continue
        coincidencias.append(
            ListaCoincidencia(lista=entrada.fuente, nombre=entrada.nombre_completo, similitud=sim)
        )

    # Persistir resultados (reemplaza ejecución anterior)
    session.exec(  # type: ignore[call-overload]
        select(ScreeningResultado).where(ScreeningResultado.expediente_id == expediente.id)
    )
    viejos = session.exec(
        select(ScreeningResultado).where(ScreeningResultado.expediente_id == expediente.id)
    ).all()
    for v in viejos:
        session.delete(v)

    for c in coincidencias:
        session.add(ScreeningResultado(
            expediente_id=expediente.id,
            lista=c.lista,
            nombre_entrada=c.nombre,
            similitud=c.similitud,
        ))
    session.commit()

    fuentes = {c.lista for c in coincidencias}
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="KYC",
        accion="SCREENING_LISTAS",
        entidad_tipo="ExpedienteKYC",
        entidad_id=expediente.id,
        descripcion=f"Screening ejecutado. Coincidencias: {len(coincidencias)}",
    )
    return ListasResult(
        ofac="OFAC" in fuentes,
        onu="ONU" in fuentes,
        ue="UE" in fuentes,
        coincidencias=coincidencias,
    )


@router.get(
    "/{id}/screening", response_model=list[ScreeningResultadoPublic], dependencies=[LecturaKYC]
)
def listar_screening(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """Devuelve los resultados persistidos del último screening."""
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)
    return session.exec(
        select(ScreeningResultado)
        .where(ScreeningResultado.expediente_id == expediente.id)
        .order_by(ScreeningResultado.similitud.desc())  # type: ignore[attr-defined]
    ).all()


@router.patch(
    "/{id}/screening/{resultado_id}/falso-positivo",
    response_model=ScreeningResultadoPublic,
    dependencies=[Depends(require_roles(UserRole.OFICIAL_CUMPLIMIENTO))],
)
def marcar_falso_positivo(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID, resultado_id: uuid.UUID
) -> Any:
    """El Oficial de Cumplimiento descarta una coincidencia como falso positivo."""
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)
    resultado = session.get(ScreeningResultado, resultado_id)
    if not resultado or resultado.expediente_id != expediente.id:
        raise HTTPException(status_code=404, detail="Resultado no encontrado")
    resultado.es_falso_positivo = True
    resultado.revisado_por_id = current_user.id
    resultado.revisado_en = datetime.now(timezone.utc)
    session.add(resultado)
    session.commit()
    session.refresh(resultado)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="KYC",
        accion="FALSO_POSITIVO",
        entidad_tipo="ScreeningResultado",
        entidad_id=resultado.id,
        descripcion=f"Coincidencia '{resultado.nombre_entrada}' ({resultado.lista}) marcada como falso positivo",
    )
    return resultado


@router.get(
    "/{id}/factores-riesgo", response_model=RiesgoResult, dependencies=[LecturaKYC]
)
def factores_riesgo(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """Desglose de factores del cálculo de riesgo actual (solo lectura, no persiste)."""
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)
    pesos = crud.get_pesos_riesgo(session)
    return calcular_riesgo(expediente, pesos)


@router.patch(
    "/{id}/override-riesgo",
    response_model=ExpedienteKYCPublic,
    dependencies=[Depends(require_roles(UserRole.OFICIAL_CUMPLIMIENTO))],
)
def override_riesgo(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    body: RiesgoOverrideInput,
) -> Any:
    """El Oficial de Cumplimiento puede ajustar manualmente el nivel de riesgo con justificación."""
    expediente = _get_expediente_o_404(session, id)
    expediente.nivel_riesgo_override = body.nivel_riesgo_override.value
    expediente.justificacion_override = body.justificacion_override
    expediente.updated_at = datetime.now(timezone.utc)
    session.add(expediente)
    session.commit()
    session.refresh(expediente)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="KYC",
        accion="OVERRIDE_RIESGO",
        entidad_tipo="ExpedienteKYC",
        entidad_id=expediente.id,
        descripcion=f"Nivel de riesgo ajustado manualmente a {body.nivel_riesgo_override.value}",
    )
    return expediente
