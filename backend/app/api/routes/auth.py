from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.auditoria import registrar_auditoria
from app.core import security
from app.core.config import settings
from app.core.security import verify_password
from app.models import Message, User

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_INTENTOS = 5
LOCKOUT_MINUTOS = 30


class LoginInput(BaseModel):
    correo: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str


@router.post("/login", response_model=LoginResponse)
def login(body: LoginInput, request: Request, session: SessionDep) -> Any:
    user: User | None = session.exec(select(User).where(User.email == body.correo)).first()

    if not user:
        registrar_auditoria(
            session=session,
            usuario_id=None,
            modulo="AUTH",
            accion="LOGIN_FALLIDO",
            descripcion=f"Correo no registrado: {body.correo}",
            ip_origen=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Verificar bloqueo
    if user.bloqueado_hasta and user.bloqueado_hasta > datetime.now(timezone.utc):
        registrar_auditoria(
            session=session,
            usuario_id=user.id,
            modulo="AUTH",
            accion="LOGIN_FALLIDO",
            descripcion="Intento de acceso con cuenta bloqueada",
            ip_origen=request.client.host if request.client else None,
        )
        raise HTTPException(
            status_code=403,
            detail="Cuenta bloqueada. Contacte al administrador.",
        )

    verified, updated_hash = verify_password(body.password, user.hashed_password)

    if not verified:
        user.intentos_fallidos += 1
        if user.intentos_fallidos >= MAX_INTENTOS:
            user.bloqueado_hasta = datetime.now(timezone.utc) + timedelta(
                minutes=LOCKOUT_MINUTOS
            )
            session.add(user)
            session.commit()
            registrar_auditoria(
                session=session,
                usuario_id=user.id,
                modulo="AUTH",
                accion="CUENTA_BLOQUEADA",
                descripcion=f"Cuenta bloqueada tras {MAX_INTENTOS} intentos fallidos",
                ip_origen=request.client.host if request.client else None,
            )
            raise HTTPException(
                status_code=403,
                detail="Cuenta bloqueada tras 5 intentos. Espere 30 minutos.",
            )

        session.add(user)
        session.commit()
        registrar_auditoria(
            session=session,
            usuario_id=user.id,
            modulo="AUTH",
            accion="LOGIN_FALLIDO",
            descripcion=f"Intento #{user.intentos_fallidos} fallido",
            ip_origen=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if not user.is_active:
        registrar_auditoria(
            session=session,
            usuario_id=user.id,
            modulo="AUTH",
            accion="LOGIN_FALLIDO",
            descripcion="Usuario inactivo",
            ip_origen=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    # Login exitoso
    user.intentos_fallidos = 0
    user.bloqueado_hasta = None
    if updated_hash:
        user.hashed_password = updated_hash
    session.add(user)
    session.commit()

    token = security.create_access_token(
        user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    registrar_auditoria(
        session=session,
        usuario_id=user.id,
        modulo="AUTH",
        accion="LOGIN_EXITOSO",
        ip_origen=request.client.host if request.client else None,
    )

    return LoginResponse(
        access_token=token,
        rol=user.role.value if hasattr(user.role, "value") else str(user.role),
        nombre=user.full_name or user.email,
    )


@router.post("/logout", response_model=Message)
def logout(
    current_user: CurrentUser, request: Request, session: SessionDep
) -> Message:
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="AUTH",
        accion="LOGOUT",
        ip_origen=request.client.host if request.client else None,
    )
    return Message(message="Sesión cerrada")
