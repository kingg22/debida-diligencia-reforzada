from fastapi import APIRouter

from app.api.routes import (
    auditoria,
    auth,
    casos_ddr,
    clientes,
    dashboard,
    items,
    login,
    parametros,
    private,
    users,
    utils,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(clientes.router)
api_router.include_router(casos_ddr.router)
api_router.include_router(auditoria.router)
api_router.include_router(dashboard.router)
api_router.include_router(parametros.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
