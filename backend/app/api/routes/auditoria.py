import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlmodel import col, func, select

from app.api.deps import SessionDep, require_roles
from app.models import (
    Auditoria,
    AuditoriaPublic,
    AuditoriasPublic,
    User,
    UserRole,
)

router = APIRouter(prefix="/auditoria", tags=["auditoria"])

SoloAuditor = Depends(require_roles(UserRole.AUDITOR))


@router.get("/", response_model=AuditoriasPublic, dependencies=[SoloAuditor])
def read_auditoria(
    session: SessionDep,
    skip: int = 0,
    limit: int = Query(default=20, le=100),
    desde: datetime | None = None,
    hasta: datetime | None = None,
    usuario_id: uuid.UUID | None = None,
    modulo: str | None = None,
) -> Any:
    filters = []
    if desde:
        filters.append(Auditoria.creado_en >= desde)
    if hasta:
        filters.append(Auditoria.creado_en <= hasta)
    if usuario_id:
        filters.append(Auditoria.usuario_id == usuario_id)
    if modulo:
        filters.append(Auditoria.modulo == modulo)

    count = session.exec(
        select(func.count()).select_from(Auditoria).where(*filters)
    ).one()

    registros = session.exec(
        select(Auditoria)
        .where(*filters)
        .order_by(col(Auditoria.creado_en).desc())
        .offset(skip)
        .limit(limit)
    ).all()

    # Enriquecer con nombre del usuario
    items: list[AuditoriaPublic] = []
    for r in registros:
        nombre = None
        if r.usuario_id:
            u = session.get(User, r.usuario_id)
            if u:
                nombre = u.full_name or u.email
        items.append(AuditoriaPublic(**r.model_dump(), usuario_nombre=nombre))

    return AuditoriasPublic(data=items, count=count)
