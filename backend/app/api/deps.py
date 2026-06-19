from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import REQUIRES_2FA_ROLES, TokenPayload, TwoFactorAuth, User, UserRole

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user: User | None = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


def require_roles(*roles: UserRole):
    """Devuelve una dependencia FastAPI que valida que el usuario actual
    tenga alguno de los roles indicados (o sea superusuario)."""

    def _check(current_user: CurrentUser) -> User:
        if current_user.is_superuser:
            return current_user
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para realizar esta acción",
            )
        return current_user

    return _check


def require_2fa_if_required_by_role(
    response: Response, session: SessionDep, current_user: CurrentUser
) -> User:
    """Guard para routers críticos: si el rol del usuario está en
    ``REQUIRES_2FA_ROLES`` y no tiene 2FA habilitado, bloquea con 403 y
    header ``X-2FA-Setup-Required: true`` para que el frontend redirija al
    wizard de configuración.

    Se aplica como ``Depends(require_2fa_if_required_by_role)`` en los
    endpoints sensibles (clientes, casos_ddr, users). NO se aplica en
    ``/dashboard``, ``/auditoria`` ni ``/users/me`` (deben ser accesibles
    para mostrar el banner de "configure 2FA").

    El superusuario (``is_superuser=True``) está exento para no quedar
    fuera del sistema si se rompe la fila de 2FA.
    """
    if current_user.is_superuser:
        return current_user
    user_role = (
        current_user.role
        if isinstance(current_user.role, UserRole)
        else UserRole(current_user.role)
    )
    if user_role not in REQUIRES_2FA_ROLES:
        return current_user
    twofa = session.exec(
        select(TwoFactorAuth).where(TwoFactorAuth.user_id == current_user.id)
    ).first()
    if twofa and twofa.is_enabled:
        return current_user
    response.headers["X-2FA-Setup-Required"] = "true"
    raise HTTPException(
        status_code=403,
        detail="Su cuenta requiere 2FA. Configure la autenticación de dos factores antes de continuar.",
    )
