import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlmodel import SQLModel, col, func, select

from app.api.deps import CurrentUser, SessionDep, require_roles
from app.models import (
    CasoDDR,
    CasosDDRPublic,
    CasoDDRPublic,
    DocumentoEstado,
    DocumentoKYC,
    DocumentoKYCPublic,
    DocumentoTipo,
    CuestionarioEBRPublic,
    EstadoCasoDDR,
    User,
    UserRole,
)

router = APIRouter(prefix="/casos-ddr", tags=["casos-ddr"])

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
    caso = session.get(CasoDDR, caso_id)
    if not caso:
        raise HTTPException(status_code=404, detail="Caso DDR no encontrado")
    return caso


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
        data=[CasoDDRPublic.model_validate(c) for c in casos],
        count=count,
    )


@router.get("/{id}", response_model=CasoDDRPublic, dependencies=[AccesoDDR])
def read_caso_ddr(session: SessionDep, id: uuid.UUID) -> Any:
    return _get_caso_o_404(session, id)


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

    caso.analista_id = body.analista_id
    if caso.status == EstadoCasoDDR.ABIERTO.value:
        caso.status = EstadoCasoDDR.EN_REVISION.value
    caso.updated_at = datetime.now(timezone.utc)
    session.add(caso)
    session.commit()
    session.refresh(caso)
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
    caso = _get_caso_o_404(session, id)

    if caso.status != EstadoCasoDDR.EN_REVISION.value:
        raise HTTPException(
            status_code=409,
            detail="El caso debe estar en EN_REVISION para enviar a aprobación",
        )

    # Verificar cuestionario EBR completo
    if not caso.cuestionario or not caso.cuestionario.completado:
        raise HTTPException(
            status_code=400,
            detail="El cuestionario EBR debe estar completado antes de enviar a aprobación",
        )

    caso.status = EstadoCasoDDR.EN_APROBACION.value
    caso.updated_at = datetime.now(timezone.utc)
    session.add(caso)
    session.commit()
    session.refresh(caso)
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

    cuestionario = caso.cuestionario
    if not cuestionario:
        raise HTTPException(
            status_code=404, detail="Cuestionario no encontrado"
        )

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
    dependencies=[AccesoDDR],
)
def upload_documento_ddr(
    *,
    session: SessionDep,
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
