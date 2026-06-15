import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep, require_roles
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
    ListasResult,
    Message,
    RiesgoResult,
    RiskLevel,
    User,
    UserRole,
)

router = APIRouter(prefix="/clientes", tags=["clientes"])

# Almacenamiento local de documentos (efímero en el contenedor).
UPLOAD_DIR = Path("uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME = {"application/pdf", "image/jpeg", "image/png"}

# Roles que pueden registrar clientes y los que pueden revisar.
RegistraCliente = Depends(require_roles(UserRole.ANALISTA_DDR))
AccesoKYC = Depends(
    require_roles(UserRole.ANALISTA_DDR, UserRole.OFICIAL_CUMPLIMIENTO)
)


def _puede_ver_todos(user: User) -> bool:
    return user.is_superuser or user.role == UserRole.OFICIAL_CUMPLIMIENTO


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
        # Beneficiarios finales deben sumar 100% al enviar a revisión (Ley 254/2021).
        if expediente_in.enviar_a_revision:
            total = sum(
                bf.porcentaje_participacion
                for bf in expediente_in.beneficiarios_final
            )
            if round(total) != 100:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Los porcentajes de beneficiarios finales deben sumar "
                        f"100%. Actualmente: {round(total)}%"
                    ),
                )

    expediente = crud.create_expediente(
        session=session,
        expediente_in=expediente_in,
        analista_id=current_user.id,
    )
    return expediente


@router.get("/", response_model=ExpedientesKYCPublic, dependencies=[AccesoKYC])
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


@router.get("/{id}", response_model=ExpedienteKYCPublic, dependencies=[AccesoKYC])
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
    return Message(message="Documento eliminado")


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

    resultado = calcular_riesgo(expediente)
    crud.recalcular_riesgo_expediente(session=session, expediente=expediente)
    return resultado


@router.get(
    "/{id}/verificar-listas", response_model=ListasResult, dependencies=[AccesoKYC]
)
def verificar_listas(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Verificación contra listas restrictivas (OFAC, ONU, UE).
    Stub simulado — la administración de listas es de un sprint posterior.
    """
    expediente = _get_expediente_o_404(session, id)
    _verificar_acceso(expediente, current_user)
    # Sin coincidencias (simulado).
    return ListasResult(ofac=False, onu=False, ue=False, coincidencias=[])
