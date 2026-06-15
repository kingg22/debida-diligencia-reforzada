import uuid
from typing import Optional

from sqlmodel import Session

from app.models import Auditoria


def registrar_auditoria(
    *,
    session: Session,
    usuario_id: Optional[uuid.UUID],
    modulo: str,
    accion: str,
    entidad_tipo: Optional[str] = None,
    entidad_id: Optional[uuid.UUID] = None,
    descripcion: Optional[str] = None,
    ip_origen: Optional[str] = None,
) -> None:
    """Inserta un registro de auditoría (append-only).

    Pensado para ser invocado después de la mutación, compartiendo la misma
    sesión: hace `commit` aquí para que el registro quede persistido aun si
    la operación principal aún no hace commit. Si la operación principal
    falla y hace rollback, este registro también se revierte.
    """
    registro = Auditoria(
        usuario_id=usuario_id,
        modulo=modulo,
        accion=accion,
        entidad_tipo=entidad_tipo,
        entidad_id=entidad_id,
        descripcion=descripcion,
        ip_origen=ip_origen,
    )
    session.add(registro)
    session.commit()
