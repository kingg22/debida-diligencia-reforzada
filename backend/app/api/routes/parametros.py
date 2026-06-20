from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from app.api.deps import SessionDep, require_roles
from app.auditoria import registrar_auditoria
from app.models import ParametroRiesgo, ParametroRiesgoPublic, ParametroRiesgoUpdate, UserRole

router = APIRouter(prefix="/parametros", tags=["parametros"])

SoloAdmin = Depends(require_roles(UserRole.ADMIN))


@router.get("/riesgo", response_model=list[ParametroRiesgoPublic], dependencies=[SoloAdmin])
def listar_parametros(session: SessionDep) -> Any:
    return session.exec(select(ParametroRiesgo).order_by(ParametroRiesgo.factor)).all()


@router.patch("/riesgo/{id}", response_model=ParametroRiesgoPublic, dependencies=[SoloAdmin])
def actualizar_parametro(
    session: SessionDep,
    id: str,
    body: ParametroRiesgoUpdate,
) -> Any:
    import uuid as _uuid
    try:
        uid = _uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=422, detail="ID inválido")

    param = session.get(ParametroRiesgo, uid)
    if not param:
        raise HTTPException(status_code=404, detail="Parámetro no encontrado")

    param.peso = body.peso
    if body.activo is not None:
        param.activo = body.activo
    session.add(param)
    session.commit()
    session.refresh(param)
    return param
