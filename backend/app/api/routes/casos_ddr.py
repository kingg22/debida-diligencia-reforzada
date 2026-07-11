import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import SQLModel, col, func, select

from app.api.deps import (
    CurrentUser,
    SessionDep,
    require_2fa_if_required_by_role,
    require_roles,
)
from app.auditoria import registrar_auditoria
from app.models import (
    CasoDDR,
    CasoDDRPublic,
    CasosDDRPublic,
    ClienteResumen,
    CuestionarioEBRPublic,
    DocumentoEstado,
    DocumentoKYC,
    DocumentoKYCPublic,
    DocumentoTipo,
    EstadoCasoDDR,
    ExpedienteKYC,
    ExpedienteKYCPublic,
    User,
    UserRole,
)

router = APIRouter(
    prefix="/casos-ddr",
    tags=["casos-ddr"],
    dependencies=[Depends(require_2fa_if_required_by_role)],
)

AccesoDDR = Depends(
    require_roles(
        UserRole.ANALISTA_DDR,
        UserRole.OFICIAL_CUMPLIMIENTO,
        UserRole.GERENTE_CUMPLIMIENTO,
        UserRole.COMITE_CUMPLIMIENTO,
        UserRole.AUDITOR,
    )
)


def _get_caso_o_404(session: SessionDep, caso_id: uuid.UUID) -> CasoDDR:
    caso: CasoDDR | None = session.get(CasoDDR, caso_id)
    if not caso:
        raise HTTPException(status_code=404, detail="Caso DDR no encontrado")
    return caso


def _build_cliente_resumen(expediente: ExpedienteKYC) -> ClienteResumen:
    """Proyecta un ExpedienteKYC al shape plano que consume el frontend.

    Espejo de la función ``expedienteACliente`` del frontend; si se
    modifica una, mantener la otra sincronizada.
    """
    pn = expediente.persona_natural
    pj = expediente.persona_juridica
    es_natural = expediente.tipo_cliente == "NATURAL"
    nombres = pn.nombre if es_natural and pn else (pj.razon_social if pj else "")
    apellidos = pn.apellido if es_natural and pn else ""
    tipo_doc = (
        pn.tipo_documento if es_natural and pn else ("RUC" if pj else "CEDULA")
    )
    num_doc = (
        pn.numero_documento if es_natural and pn else (pj.ruc if pj else "")
    )
    identificacion = (
        f"{tipo_doc} {num_doc}".strip() if es_natural else f"RUC {num_doc}".strip()
    )
    return ClienteResumen(
        id=expediente.id,
        codigo=expediente.codigo,
        tipo_cliente=expediente.tipo_cliente,
        nombres=nombres or "",
        apellidos=apellidos or "",
        tipo_identificacion=tipo_doc or "CEDULA",
        numero_identificacion=identificacion,
        nivel_riesgo=expediente.nivel_riesgo,
        estado=expediente.status,
        es_pep=bool(pn.es_pep) if pn else False,
    )


def _casos_to_public(
    session: SessionDep, casos: list[CasoDDR]
) -> list[CasoDDRPublic]:
    """Serializa casos DDR y embebe un resumen del cliente asociado.

    Carga todos los expedientes en una sola query para evitar N+1.
    """
    if not casos:
        return []
    exp_ids = {c.expediente_id for c in casos}
    expedientes = session.exec(
        select(ExpedienteKYC).where(col(ExpedienteKYC.id).in_(exp_ids))
    ).all()
    by_id = {e.id: e for e in expedientes}

    out: list[CasoDDRPublic] = []
    for c in casos:
        public = CasoDDRPublic.model_validate(c)
        exp = by_id.get(c.expediente_id)
        if exp is not None:
            public.cliente = _build_cliente_resumen(exp)
        out.append(public)
    return out


@router.get("/", response_model=CasosDDRPublic, dependencies=[AccesoDDR])
def read_casos_ddr(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    status: EstadoCasoDDR | None = None,
    nivel_riesgo: str | None = None,
) -> Any:
    filters: list[Any] = []

    # Filtro automático por rol
    if current_user.role == UserRole.ANALISTA_DDR:
        filters.append(CasoDDR.analista_id == current_user.id)
    elif current_user.role == UserRole.GERENTE_CUMPLIMIENTO:
        filters.append(CasoDDR.nivel_riesgo == "ALTO")
        filters.append(CasoDDR.status == EstadoCasoDDR.EN_APROBACION.value)
    elif current_user.role == UserRole.COMITE_CUMPLIMIENTO:
        filters.append(CasoDDR.nivel_riesgo == "MUY_ALTO")
        filters.append(CasoDDR.status == EstadoCasoDDR.EN_APROBACION.value)

    if status:
        filters.append(CasoDDR.status == status.value)
    if nivel_riesgo:
        filters.append(CasoDDR.nivel_riesgo == nivel_riesgo)

    count = session.exec(
        select(func.count()).select_from(CasoDDR).where(*filters)
    ).one()
    casos = session.exec(
        select(CasoDDR)
        .where(*filters)
        .order_by(col(CasoDDR.fecha_apertura).desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return CasosDDRPublic(
        data=_casos_to_public(session, casos),
        count=count,
    )


def _visibilidad_casos(current_user: CurrentUser) -> list[Any]:
    """Mismo alcance por rol que `read_casos_ddr`, pero sin restringir por
    estado: para las tarjetas KPI necesitamos el desglose por estado dentro
    de lo que el rol puede ver (sus propios casos, o su nivel de riesgo)."""
    if current_user.role == UserRole.ANALISTA_DDR:
        return [CasoDDR.analista_id == current_user.id]
    if current_user.role == UserRole.GERENTE_CUMPLIMIENTO:
        return [CasoDDR.nivel_riesgo == "ALTO"]
    if current_user.role == UserRole.COMITE_CUMPLIMIENTO:
        return [CasoDDR.nivel_riesgo == "MUY_ALTO"]
    return []


@router.get("/estadisticas", dependencies=[AccesoDDR])
def estadisticas_casos_ddr(session: SessionDep, current_user: CurrentUser) -> Any:
    """Conteos para las tarjetas KPI de la lista de casos DDR."""
    filters = _visibilidad_casos(current_user)

    def contar(*extra: Any) -> int:
        return session.exec(
            select(func.count()).select_from(CasoDDR).where(*filters, *extra)
        ).one()

    return {
        "total": contar(),
        "abiertos": contar(CasoDDR.status == EstadoCasoDDR.ABIERTO.value),
        "en_revision": contar(CasoDDR.status == EstadoCasoDDR.EN_REVISION.value),
        "en_revision_oficial": contar(
            CasoDDR.status == EstadoCasoDDR.EN_REVISION_OFICIAL.value
        ),
        "en_aprobacion": contar(CasoDDR.status == EstadoCasoDDR.EN_APROBACION.value),
        "aprobados": contar(CasoDDR.status == EstadoCasoDDR.APROBADO.value),
        "rechazados": contar(CasoDDR.status == EstadoCasoDDR.RECHAZADO.value),
    }


@router.get("/{id}", response_model=CasoDDRPublic, dependencies=[AccesoDDR])
def read_caso_ddr(session: SessionDep, id: uuid.UUID) -> Any:
    caso = _get_caso_o_404(session, id)
    public = CasoDDRPublic.model_validate(caso)
    exp = session.get(ExpedienteKYC, caso.expediente_id)
    if exp is not None:
        public.cliente = _build_cliente_resumen(exp)
    return public


@router.get(
    "/{id}/expediente",
    response_model=ExpedienteKYCPublic,
    dependencies=[AccesoDDR],
)
def read_expediente_del_caso(session: SessionDep, id: uuid.UUID) -> Any:
    """Expediente KYC completo del caso, para que quien revisa o decide
    (Oficial, Gerente, Comité, Auditor) tenga toda la información del
    cliente sin depender de los permisos del módulo KYC."""
    caso = _get_caso_o_404(session, id)
    expediente = session.get(ExpedienteKYC, caso.expediente_id)
    if expediente is None:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return expediente


class AsignarAnalistaInput(BaseModel):
    analista_id: uuid.UUID


AsignaRol = Depends(
    require_roles(UserRole.OFICIAL_CUMPLIMIENTO, UserRole.ADMIN)
)


@router.patch(
    "/{id}/asignar", response_model=CasoDDRPublic, dependencies=[AsignaRol]
)
def asignar_analista(
    id: uuid.UUID,
    body: AsignarAnalistaInput,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    caso = _get_caso_o_404(session, id)

    analista = session.get(User, body.analista_id)
    if not analista or analista.role != UserRole.ANALISTA_DDR:
        raise HTTPException(
            status_code=400,
            detail="El usuario referenciado debe ser ANALISTA_DDR",
        )

    # Segregación de funciones (cuatro ojos): el analista que investiga el
    # caso NO puede ser el mismo que registró el expediente KYC.
    expediente = session.get(ExpedienteKYC, caso.expediente_id)
    if expediente is not None and expediente.analista_id == body.analista_id:
        raise HTTPException(
            status_code=409,
            detail=(
                "Conflicto de interés: este analista registró el expediente "
                "y no puede investigar su propio caso. Asigne otro analista."
            ),
        )

    caso.analista_id = body.analista_id
    if caso.status == EstadoCasoDDR.ABIERTO.value:
        caso.status = EstadoCasoDDR.EN_REVISION.value
    caso.updated_at = datetime.now(timezone.utc)
    session.add(caso)
    session.commit()
    session.refresh(caso)
    registrar_auditoria(
        session=session,
        usuario_id=_current_user.id,
        modulo="DDR",
        accion="ASIGNAR_ANALISTA",
        entidad_tipo="CasoDDR",
        entidad_id=caso.id,
        descripcion=f"Analista {analista.full_name or analista.email} asignado al caso",
    )
    return caso


AnalistaRol = Depends(require_roles(UserRole.ANALISTA_DDR))


@router.post(
    "/{id}/enviar-aprobacion",
    response_model=CasoDDRPublic,
    dependencies=[AnalistaRol],
)
def enviar_aprobacion(
    id: uuid.UUID,
    session: SessionDep,
    _current_user: CurrentUser,
) -> Any:
    """El analista termina su investigación y envía el caso a revisión
    del Oficial de Cumplimiento (cuatro ojos: el analista investiga,
    el Oficial valida, el Gerente/Comité decide)."""
    caso = _get_caso_o_404(session, id)

    if caso.status != EstadoCasoDDR.EN_REVISION.value:
        raise HTTPException(
            status_code=409,
            detail="El caso debe estar en EN_REVISION para enviarse al Oficial",
        )

    # Solo el analista asignado al caso puede enviarlo
    if caso.analista_id != _current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Solo el analista asignado puede enviar este caso",
        )

    # Verificar cuestionario EBR completo
    if not caso.cuestionario or not caso.cuestionario.completado:
        raise HTTPException(
            status_code=400,
            detail="El cuestionario EBR debe estar completado antes de enviar",
        )

    caso.status = EstadoCasoDDR.EN_REVISION_OFICIAL.value
    # Limpia observaciones de una devolución previa: el caso vuelve limpio
    caso.observaciones_oficial = None
    caso.updated_at = datetime.now(timezone.utc)
    session.add(caso)
    session.commit()
    session.refresh(caso)
    registrar_auditoria(
        session=session,
        usuario_id=_current_user.id,
        modulo="DDR",
        accion="ENVIAR_REVISION_OFICIAL",
        entidad_tipo="CasoDDR",
        entidad_id=caso.id,
        descripcion=f"Caso DDR enviado a revisión del Oficial (nivel {caso.nivel_riesgo})",
    )
    return caso


# ── Revisión del Oficial de Cumplimiento (cuatro ojos) ─────────────────────


OficialRol = Depends(require_roles(UserRole.OFICIAL_CUMPLIMIENTO, UserRole.ADMIN))


class DevolucionInput(BaseModel):
    observaciones: str = Field(min_length=10, max_length=1000)


@router.post(
    "/{id}/validar",
    response_model=CasoDDRPublic,
    dependencies=[OficialRol],
)
def validar_caso(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """El Oficial valida el trabajo del analista y escala el caso a la
    instancia de aprobación (Gerente si ALTO, Comité si MUY_ALTO)."""
    caso = _get_caso_o_404(session, id)

    if caso.status != EstadoCasoDDR.EN_REVISION_OFICIAL.value:
        raise HTTPException(
            status_code=409,
            detail="El caso debe estar en revisión del Oficial para validarse",
        )

    caso.status = EstadoCasoDDR.EN_APROBACION.value
    caso.validado_por_id = current_user.id
    # Limpia observaciones de una devolución previa de la instancia de
    # aprobación: el caso escala limpio.
    caso.observaciones_oficial = None
    caso.updated_at = datetime.now(timezone.utc)
    session.add(caso)
    session.commit()
    session.refresh(caso)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="DDR",
        accion="VALIDAR_CASO",
        entidad_tipo="CasoDDR",
        entidad_id=caso.id,
        descripcion=f"Oficial validó el caso y lo escaló a aprobación (nivel {caso.nivel_riesgo})",
    )
    return caso


@router.post(
    "/{id}/devolver",
    response_model=CasoDDRPublic,
    dependencies=[OficialRol],
)
def devolver_caso(
    id: uuid.UUID,
    body: DevolucionInput,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """El Oficial devuelve el caso al analista con observaciones para que
    complete o corrija la investigación."""
    caso = _get_caso_o_404(session, id)

    if caso.status != EstadoCasoDDR.EN_REVISION_OFICIAL.value:
        raise HTTPException(
            status_code=409,
            detail="El caso debe estar en revisión del Oficial para devolverse",
        )

    caso.status = EstadoCasoDDR.EN_REVISION.value
    caso.observaciones_oficial = body.observaciones
    caso.updated_at = datetime.now(timezone.utc)
    session.add(caso)
    session.commit()
    session.refresh(caso)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="DDR",
        accion="DEVOLVER_CASO",
        entidad_tipo="CasoDDR",
        entidad_id=caso.id,
        descripcion=f"Oficial devolvió el caso al analista: {body.observaciones[:80]}",
    )
    return caso


@router.post(
    "/{id}/reabrir",
    response_model=CasoDDRPublic,
    dependencies=[OficialRol],
)
def reabrir_caso(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """El Oficial regresa un caso EN_REVISION a ABIERTO: retira al analista
    asignado para poder reasignarlo (p. ej. por conflicto o inactividad)."""
    caso = _get_caso_o_404(session, id)

    if caso.status != EstadoCasoDDR.EN_REVISION.value:
        raise HTTPException(
            status_code=409,
            detail="El caso debe estar en EN_REVISION para regresarse a asignación",
        )

    caso.status = EstadoCasoDDR.ABIERTO.value
    caso.analista_id = None
    caso.observaciones_oficial = None
    caso.updated_at = datetime.now(timezone.utc)
    session.add(caso)
    session.commit()
    session.refresh(caso)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="DDR",
        accion="REABRIR_CASO",
        entidad_tipo="CasoDDR",
        entidad_id=caso.id,
        descripcion="Oficial regresó el caso a asignación (se retiró al analista)",
    )
    return caso


# ── Aprobación / rechazo (cierre del flujo DDR) ──────────────────────────


class AprobacionInput(BaseModel):
    observaciones: str | None = None


class RechazoInput(BaseModel):
    observaciones: str = Field(min_length=20, max_length=1000)


def _check_aprobador(caso: CasoDDR, user: User) -> None:
    """Verifica que el usuario puede decidir sobre el caso según su rol y
    el nivel de riesgo:
    - Riesgo ALTO     → GERENTE_CUMPLIMIENTO (o ADMIN)
    - Riesgo MUY_ALTO → COMITE_CUMPLIMIENTO (o ADMIN)
    """
    if user.is_superuser or user.role == UserRole.ADMIN:
        return
    if caso.nivel_riesgo == "ALTO":
        if user.role != UserRole.GERENTE_CUMPLIMIENTO:
            raise HTTPException(
                status_code=403,
                detail="Solo el Gerente de Cumplimiento puede aprobar casos ALTO",
            )
    elif caso.nivel_riesgo == "MUY_ALTO":
        if user.role != UserRole.COMITE_CUMPLIMIENTO:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Solo el Comité de Cumplimiento puede aprobar "
                    "casos MUY_ALTO"
                ),
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="El nivel de riesgo del caso no es aprobable",
        )


@router.post("/{id}/devolver-oficial", response_model=CasoDDRPublic)
def devolver_a_oficial(
    id: uuid.UUID,
    body: DevolucionInput,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """La instancia de aprobación (Gerente si ALTO, Comité si MUY_ALTO)
    devuelve el caso al Oficial de Cumplimiento con observaciones en lugar
    de decidir, para que la validación se revise de nuevo."""
    caso = _get_caso_o_404(session, id)
    _check_aprobador(caso, current_user)

    if caso.status != EstadoCasoDDR.EN_APROBACION.value:
        raise HTTPException(
            status_code=409,
            detail="El caso debe estar en EN_APROBACION para devolverse al Oficial",
        )

    caso.status = EstadoCasoDDR.EN_REVISION_OFICIAL.value
    caso.observaciones_oficial = body.observaciones
    caso.updated_at = datetime.now(timezone.utc)
    session.add(caso)
    session.commit()
    session.refresh(caso)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="DDR",
        accion="DEVOLVER_A_OFICIAL",
        entidad_tipo="CasoDDR",
        entidad_id=caso.id,
        descripcion=f"Instancia de aprobación devolvió el caso al Oficial: {body.observaciones[:80]}",
    )
    return caso


@router.post("/{id}/aprobar", response_model=CasoDDRPublic)
def aprobar_caso(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    body: AprobacionInput | None = None,
) -> Any:
    caso = _get_caso_o_404(session, id)
    _check_aprobador(caso, current_user)

    if caso.status != EstadoCasoDDR.EN_APROBACION.value:
        raise HTTPException(
            status_code=409,
            detail="El caso debe estar en EN_APROBACION para aprobarse",
        )

    caso.status = EstadoCasoDDR.APROBADO.value
    caso.aprobado_por_id = current_user.id
    caso.fecha_cierre = datetime.now(timezone.utc)
    caso.updated_at = caso.fecha_cierre
    session.add(caso)
    session.commit()
    session.refresh(caso)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="DDR",
        accion="APROBAR_CASO",
        entidad_tipo="CasoDDR",
        entidad_id=caso.id,
        descripcion=f"Caso DDR aprobado (nivel {caso.nivel_riesgo})",
    )
    return caso


@router.post("/{id}/rechazar", response_model=CasoDDRPublic)
def rechazar_caso(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    body: RechazoInput,
) -> Any:
    caso = _get_caso_o_404(session, id)
    _check_aprobador(caso, current_user)

    if caso.status != EstadoCasoDDR.EN_APROBACION.value:
        raise HTTPException(
            status_code=409,
            detail="El caso debe estar en EN_APROBACION para rechazarse",
        )

    caso.status = EstadoCasoDDR.RECHAZADO.value
    caso.aprobado_por_id = current_user.id
    caso.observaciones_rechazo = body.observaciones
    caso.fecha_cierre = datetime.now(timezone.utc)
    caso.updated_at = caso.fecha_cierre
    session.add(caso)
    session.commit()
    session.refresh(caso)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="DDR",
        accion="RECHAZAR_CASO",
        entidad_tipo="CasoDDR",
        entidad_id=caso.id,
        descripcion=f"Caso DDR rechazado (nivel {caso.nivel_riesgo}): {body.observaciones[:80]}",
    )
    return caso


# ── Cuestionario EBR ────────────────────────────────────────────────────────


@router.get(
    "/{id}/cuestionario",
    response_model=CuestionarioEBRPublic,
    dependencies=[AccesoDDR],
)
def get_cuestionario(session: SessionDep, id: uuid.UUID) -> Any:
    caso = _get_caso_o_404(session, id)
    if not caso.cuestionario:
        raise HTTPException(
            status_code=404, detail="Cuestionario no encontrado para este caso"
        )
    return caso.cuestionario


class CuestionarioUpdate(BaseModel):
    origen_fondos: str | None = None
    proposito_relacion: str | None = None
    patrimonio_estimado: str | None = None
    pais_origen_patrimonio: str | None = None
    tiene_estructura_societaria: bool | None = None
    familiar_pep: bool | None = None


@router.patch(
    "/{id}/cuestionario",
    response_model=CuestionarioEBRPublic,
    dependencies=[Depends(require_roles(UserRole.ANALISTA_DDR))],
)
def update_cuestionario(
    id: uuid.UUID,
    body: CuestionarioUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    caso = _get_caso_o_404(session, id)
    if caso.status not in (
        EstadoCasoDDR.ABIERTO.value,
        EstadoCasoDDR.EN_REVISION.value,
    ):
        raise HTTPException(
            status_code=409,
            detail="No se puede editar el cuestionario en el estado actual",
        )

    # El cuestionario se crea al primer guardado (los casos DDR nacen sin él)
    cuestionario = caso.cuestionario
    if not cuestionario:
        from app.models import CuestionarioEBR

        cuestionario = CuestionarioEBR(caso_ddr_id=caso.id)
        session.add(cuestionario)

    datos = body.model_dump(exclude_unset=True)
    for campo, valor in datos.items():
        setattr(cuestionario, campo, valor)

    # Marcar como completado si todos los campos obligatorios están llenos
    campos_requeridos = [
        "origen_fondos",
        "proposito_relacion",
        "patrimonio_estimado",
        "pais_origen_patrimonio",
        "tiene_estructura_societaria",
        "familiar_pep",
    ]
    todos_llenos = all(
        getattr(cuestionario, c) is not None for c in campos_requeridos
    )
    if todos_llenos and not cuestionario.completado:
        cuestionario.completado = True
        cuestionario.completado_en = datetime.now(timezone.utc)
        cuestionario.completado_por = current_user.id

    session.add(cuestionario)
    session.commit()
    session.refresh(cuestionario)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="DDR",
        accion="ACTUALIZAR_CUESTIONARIO_EBR",
        entidad_tipo="CuestionarioEBR",
        entidad_id=cuestionario.id,
        descripcion="Cuestionario EBR actualizado"
        + (" (completado)" if cuestionario.completado else ""),
    )
    return cuestionario


# ── Documentos DDR ──────────────────────────────────────────────────────────

UPLOAD_DIR = Path("uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png"}


class DocumentosDDRPublic(SQLModel):
    data: list[DocumentoKYCPublic]
    count: int


@router.post(
    "/{id}/documentos",
    response_model=DocumentoKYCPublic,
    dependencies=[AnalistaRol],
)
def upload_documento_ddr(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    tipo: DocumentoTipo = Form(...),
    file: UploadFile = File(...),
) -> Any:
    caso = _get_caso_o_404(session, id)

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
        expediente_id=caso.expediente_id,
        caso_ddr_id=caso.id,
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
        modulo="DDR",
        accion="SUBIR_DOCUMENTO",
        entidad_tipo="DocumentoKYC",
        entidad_id=documento.id,
        descripcion=f"Documento {tipo.value} subido al caso DDR {id}",
    )
    return documento


@router.get(
    "/{id}/documentos",
    response_model=DocumentosDDRPublic,
    dependencies=[AccesoDDR],
)
def list_documentos_ddr(
    session: SessionDep,
    id: uuid.UUID,
    skip: int = 0,
    limit: int = Query(default=50, le=100),
) -> Any:
    caso = _get_caso_o_404(session, id)

    count = session.exec(
        select(func.count())
        .select_from(DocumentoKYC)
        .where(DocumentoKYC.caso_ddr_id == caso.id)
    ).one()
    docs = session.exec(
        select(DocumentoKYC)
        .where(DocumentoKYC.caso_ddr_id == caso.id)
        .order_by(col(DocumentoKYC.fecha_carga).desc())
        .offset(skip)
        .limit(limit)
    ).all()

    return DocumentosDDRPublic(
        data=[DocumentoKYCPublic.model_validate(d) for d in docs],
        count=count,
    )
