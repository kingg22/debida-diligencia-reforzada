"""Auth y 2FA (TOTP) — endpoints ``/api/v1/auth/*``.

Login con tres ramas:
    1. Password OK y 2FA no aplica → ``{access_token, requires_2fa: false}``
    2. Password OK y 2FA activo → ``{temp_token, requires_2fa: "verify"}``
    3. Password OK y rol requiere 2FA sin configurar → ``{temp_token, requires_2fa: "setup"}``

El ``temp_token`` es un JWT firmado con ``SECRET_KEY`` con claim
``purpose="2fa_verify" | "2fa_setup"`` y ``exp`` corto. Sólo puede canjearse
por el endpoint correspondiente.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from fastapi import APIRouter, HTTPException, Request
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel, Field
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.auditoria import registrar_auditoria
from app.core import security
from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.security import verify_password
from app.core.totp import (
    TotpVerifyResult,
    generate_backup_codes,
    generate_secret,
    hash_backup_codes,
    provisioning_uri,
    qr_png_b64,
    verify_backup_code,
    verify_totp,
)
from app.models import (
    REQUIRES_2FA_ROLES,
    Message,
    Token,
    TwoFactorAuth,
    User,
    UserRole,
)

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_INTENTOS = 5
LOCKOUT_MINUTOS = 30

# ── 2FA temp-token helpers ─────────────────────────────────────────────────

_TEMP_TOKEN_ALG = "HS256"
TwofaPurpose = Literal["2fa_verify", "2fa_setup"]


def _create_temp_token(user_id: str, purpose: TwofaPurpose) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.TWO_FA_TEMP_TOKEN_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "purpose": purpose,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_TEMP_TOKEN_ALG)


def _decode_temp_token(token: str, expected_purpose: TwofaPurpose) -> str:
    """Devuelve el ``sub`` (user_id) si el token es válido y su ``purpose``
    coincide. Lanza ``HTTPException(401)`` en cualquier otro caso."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[_TEMP_TOKEN_ALG]
        )
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=401,
            detail="Token temporal inválido o expirado. Inicie sesión de nuevo.",
        ) from exc
    if payload.get("purpose") != expected_purpose:
        raise HTTPException(
            status_code=401,
            detail=f"Token no válido para esta operación (purpose={payload.get('purpose')!r}).",
        )
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token temporal malformado.")
    return sub


# ── Rate limit en memoria para /2fa/verify ─────────────────────────────────

# Map: user_id (str) -> lista de timestamps de intentos en la ventana.
_2FA_ATTEMPTS: dict[str, list[float]] = {}


def _check_rate_limit(user_id: str) -> None:
    """Lanza 429 si el user_id ha superado el rate limit configurado."""
    window = settings.TWO_FA_VERIFY_RATE_WINDOW_SECONDS
    limit = settings.TWO_FA_VERIFY_RATE_LIMIT
    now = time.time()
    attempts = [t for t in _2FA_ATTEMPTS.get(user_id, []) if t > now - window]
    if len(attempts) >= limit:
        retry_after = int(attempts[0] + window - now) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos. Reintente en {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )
    attempts.append(now)
    _2FA_ATTEMPTS[user_id] = attempts


def _reset_rate_limit(user_id: str) -> None:
    _2FA_ATTEMPTS.pop(user_id, None)


# ── Schemas ────────────────────────────────────────────────────────────────


class LoginInput(BaseModel):
    correo: str
    password: str


class LoginResponse(BaseModel):
    """Respuesta unificada de ``/auth/login``.

    Ramas:
    * ``requires_2fa=False`` → ``access_token`` presente, ``temp_token=None``.
    * ``requires_2fa="verify"`` → ``temp_token`` para llamar a ``/2fa/verify``.
    * ``requires_2fa="setup"`` → ``temp_token`` para ``/2fa/setup/{start,confirm}``.
    """

    access_token: str | None = None
    token_type: str = "bearer"
    requires_2fa: bool | str = False
    temp_token: str | None = None
    rol: str | None = None
    nombre: str | None = None


class TwoFactorVerifyInput(BaseModel):
    temp_token: str
    code: str = Field(min_length=6, max_length=11)


class TwoFactorVerifyResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str


class TwoFactorSetupStartResponse(BaseModel):
    secret_base32: str
    otpauth_url: str
    qr_png_base64: str


class TwoFactorSetupConfirmInput(BaseModel):
    temp_token: str
    code: str = Field(min_length=6, max_length=6)


class TwoFactorSetupConfirmResponse(BaseModel):
    """Tras confirmar el setup, el usuario queda autenticado.

    El frontend no necesita llamar a ``/2fa/verify``: ya demostró posesión
    del secret TOTP al verificar el código de confirmación.
    """

    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str
    backup_codes: list[str]


class TwoFactorStatus(BaseModel):
    enabled: bool
    required_by_role: bool
    backup_codes_remaining: int
    confirmed_at: datetime | None = None
    disabled_at: datetime | None = None


class TwoFactorDisableInput(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class TwoFactorRegenerateInput(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class TwoFactorRegenerateResponse(BaseModel):
    backup_codes: list[str]


# ── Helpers internos ───────────────────────────────────────────────────────


def _get_twofa_for_user(session: SessionDep, user_id) -> TwoFactorAuth | None:
    return session.exec(
        select(TwoFactorAuth).where(TwoFactorAuth.user_id == user_id)
    ).first()


def _requires_2fa_for_role(role: UserRole) -> bool:
    return role in REQUIRES_2FA_ROLES


# ── POST /auth/login ───────────────────────────────────────────────────────


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

    # Login password OK
    user.intentos_fallidos = 0
    user.bloqueado_hasta = None
    if updated_hash:
        user.hashed_password = updated_hash
    session.add(user)
    session.commit()

    # Determinar rama 2FA
    user_role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    twofa = _get_twofa_for_user(session, user.id)
    twofa_enabled = twofa is not None and twofa.is_enabled
    role_requires_2fa = _requires_2fa_for_role(user_role)

    # Rama 1: 2FA no aplica
    if not twofa_enabled and not role_requires_2fa:
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
            requires_2fa=False,
            rol=user_role.value,
            nombre=user.full_name or user.email,
        )

    # Rama 2: 2FA activo → requiere verify
    if twofa_enabled:
        temp_token = _create_temp_token(str(user.id), "2fa_verify")
        registrar_auditoria(
            session=session,
            usuario_id=user.id,
            modulo="AUTH",
            accion="LOGIN_EXITOSO_PENDIENTE_2FA",
            descripcion="Login requiere verificación 2FA",
            ip_origen=request.client.host if request.client else None,
        )
        return LoginResponse(
            requires_2fa="verify",
            temp_token=temp_token,
            rol=user_role.value,
            nombre=user.full_name or user.email,
        )

    # Rama 3: rol lo requiere y no configurado → setup
    temp_token = _create_temp_token(str(user.id), "2fa_setup")
    registrar_auditoria(
        session=session,
        usuario_id=user.id,
        modulo="AUTH",
        accion="LOGIN_REQUIERE_2FA_SETUP",
        descripcion=f"Rol {user_role.value} requiere configurar 2FA",
        ip_origen=request.client.host if request.client else None,
    )
    return LoginResponse(
        requires_2fa="setup",
        temp_token=temp_token,
        rol=user_role.value,
        nombre=user.full_name or user.email,
    )


# ── POST /auth/logout ──────────────────────────────────────────────────────


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


# ── POST /auth/extend-session ──────────────────────────────────────────────


@router.post("/extend-session", response_model=Token)
def extend_session(
    current_user: CurrentUser, request: Request, session: SessionDep
) -> Token:
    """Reemite el access token del usuario actual con una nueva expiración."""
    token = security.create_access_token(
        current_user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="AUTH",
        accion="SESION_EXTENDIDA",
        ip_origen=request.client.host if request.client else None,
    )
    return Token(access_token=token)


# ── 2FA: setup (sin sesión, usa temp_token) ────────────────────────────────


@router.post(
    "/2fa/setup/start", response_model=TwoFactorSetupStartResponse
)
def twofa_setup_start(
    body: TwoFactorVerifyInput,  # sólo se usa temp_token
    request: Request,
    session: SessionDep,
) -> Any:
    user_id = _decode_temp_token(body.temp_token, "2fa_setup")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    # Idempotente: si ya hay una fila (incluso disabled) la reutilizamos
    # para que un setup a medias pueda continuarse; si está habilitado
    # pedimos que primero lo desactive.
    twofa = _get_twofa_for_user(session, user.id)
    if twofa and twofa.is_enabled:
        raise HTTPException(
            status_code=400,
            detail="2FA ya está activo. Desactívelo desde Settings para reconfigurar.",
        )

    secret = generate_secret()
    encrypted = encrypt_secret(secret)
    now = datetime.now(timezone.utc)

    if twofa:
        twofa.encrypted_secret = encrypted
        twofa.is_enabled = False
        twofa.backup_codes_hashed = None
        twofa.backup_codes_remaining = settings.TWO_FA_BACKUP_CODES_COUNT
        twofa.last_used_counter = 0
        twofa.disabled_at = None
        twofa.updated_at = now
    else:
        twofa = TwoFactorAuth(
            user_id=user.id,
            encrypted_secret=encrypted,
            is_enabled=False,
            backup_codes_remaining=settings.TWO_FA_BACKUP_CODES_COUNT,
            last_used_counter=0,
        )
        session.add(twofa)
    session.commit()

    registrar_auditoria(
        session=session,
        usuario_id=user.id,
        modulo="AUTH",
        accion="2FA_SETUP_START",
        ip_origen=request.client.host if request.client else None,
    )

    uri = provisioning_uri(user.email, secret)
    return TwoFactorSetupStartResponse(
        secret_base32=secret,
        otpauth_url=uri,
        qr_png_base64=qr_png_b64(uri),
    )


@router.post(
    "/2fa/setup/confirm", response_model=TwoFactorSetupConfirmResponse
)
def twofa_setup_confirm(
    body: TwoFactorSetupConfirmInput,
    request: Request,
    session: SessionDep,
) -> Any:
    user_id = _decode_temp_token(body.temp_token, "2fa_setup")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    twofa = _get_twofa_for_user(session, user.id)
    if not twofa:
        raise HTTPException(
            status_code=400,
            detail="Inicie el setup primero con /auth/2fa/setup/start.",
        )
    if twofa.is_enabled:
        raise HTTPException(
            status_code=400,
            detail="2FA ya está activo. Use /auth/2fa/verify para iniciar sesión.",
        )

    # Verificar el código TOTP contra el secret (sin anti-replay porque
    # aún no está confirmado).
    secret = decrypt_secret(twofa.encrypted_secret)
    result: TotpVerifyResult = verify_totp(
        secret, body.code, last_counter=0, window=settings.TWO_FA_WINDOW
    )
    if not result.valid:
        registrar_auditoria(
            session=session,
            usuario_id=user.id,
            modulo="AUTH",
            accion="2FA_SETUP_FALLIDO",
            descripcion="Código TOTP inválido en setup_confirm",
            ip_origen=request.client.host if request.client else None,
        )
        raise HTTPException(
            status_code=400, detail="Código TOTP inválido. Verifique la hora del dispositivo."
        )

    # Generar backup codes
    codes = generate_backup_codes()
    hashes = hash_backup_codes(codes)
    now = datetime.now(timezone.utc)

    twofa.is_enabled = True
    twofa.confirmed_at = now
    twofa.disabled_at = None
    twofa.backup_codes_hashed = json.dumps(hashes)
    twofa.backup_codes_remaining = len(codes)
    twofa.last_used_counter = result.counter or 0
    twofa.updated_at = now
    session.add(twofa)
    session.commit()

    registrar_auditoria(
        session=session,
        usuario_id=user.id,
        modulo="AUTH",
        accion="2FA_ACTIVADA",
        descripcion=f"{len(codes)} backup codes emitidos",
        ip_origen=request.client.host if request.client else None,
    )

    # El usuario demostró posesión del secret TOTP al verificar el código.
    # Emitimos el JWT final directamente para que la UI no necesite un
    # paso extra.
    token = security.create_access_token(
        user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    user_role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return TwoFactorSetupConfirmResponse(
        access_token=token,
        rol=user_role.value,
        nombre=user.full_name or user.email,
        backup_codes=codes,
    )


# ── 2FA: verify (post-password, con 2FA ya activo) ────────────────────────


@router.post("/2fa/verify", response_model=TwoFactorVerifyResponse)
def twofa_verify(
    body: TwoFactorVerifyInput,
    request: Request,
    session: SessionDep,
) -> Any:
    # Acepta purpose="2fa_verify" (login normal) o "2fa_setup" (enrolamiento
    # recién completado). El motivo: en el flujo setup el usuario ya pasó
    # por /setup/confirm, por lo que tiene derecho a entrar sin un segundo
    # código.
    user_id = _decode_temp_token(body.temp_token, "2fa_verify")
    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    _check_rate_limit(str(user.id))

    twofa = _get_twofa_for_user(session, user.id)
    if not twofa or not twofa.is_enabled:
        raise HTTPException(
            status_code=400,
            detail="2FA no está activo para este usuario.",
        )

    # Detectar si es TOTP (6 dígitos) o backup code (10 chars + '-')
    raw = body.code.replace("-", "").replace(" ", "").upper()
    if len(raw) == 6 and raw.isdigit():
        secret = decrypt_secret(twofa.encrypted_secret)
        result = verify_totp(
            secret, raw, last_counter=twofa.last_used_counter
        )
        if not result.valid:
            # Puede ser un código legítimo pero dentro de la ventana que
            # ya usamos. Distinguimos para auditoría.
            full_window = verify_totp(
                secret, raw, last_counter=0
            )
            accion = (
                "2FA_REPLAY_RECHAZADO"
                if full_window.valid
                else "2FA_VERIFY_FALLIDO"
            )
            registrar_auditoria(
                session=session,
                usuario_id=user.id,
                modulo="AUTH",
                accion=accion,
                ip_origen=request.client.host if request.client else None,
            )
            detail = (
                "Código TOTP ya utilizado o fuera de la ventana."
                if full_window.valid
                else "Código TOTP inválido."
            )
            raise HTTPException(status_code=401, detail=detail)
        # OK
        twofa.last_used_counter = result.counter or twofa.last_used_counter
        twofa.updated_at = datetime.now(timezone.utc)
    else:
        # Backup code
        if not twofa.backup_codes_hashed or twofa.backup_codes_remaining <= 0:
            raise HTTPException(
                status_code=401,
                detail="No quedan códigos de respaldo disponibles.",
            )
        try:
            hashes = json.loads(twofa.backup_codes_hashed)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="Estado 2FA corrupto. Contacte al administrador.",
            ) from exc

        if not verify_backup_code(body.code, hashes):
            registrar_auditoria(
                session=session,
                usuario_id=user.id,
                modulo="AUTH",
                accion="2FA_VERIFY_FALLIDO",
                descripcion="Backup code inválido",
                ip_origen=request.client.host if request.client else None,
            )
            raise HTTPException(status_code=401, detail="Código de respaldo inválido.")

        # Backup code OK: lo descartamos de la lista (one-shot).
        remaining_hashes = []
        matched_hash = None
        # Necesitamos el hash exacto que matcheó para removerlo. Pero
        # ``verify_backup_code`` no lo devuelve, así que repetimos la
        # verificación sobre cada hash:
        from pwdlib import PasswordHash
        from pwdlib.hashers.argon2 import Argon2Hasher

        ph = PasswordHash((Argon2Hasher(),))
        for h in hashes:
            if h == matched_hash:
                continue
            try:
                if ph.verify(raw, h):
                    matched_hash = h
                    continue
            except (ValueError, TypeError):
                # Si el hash no se puede verificar, lo conservamos tal cual
                # (seguro: no se va a usar pero no se pierde el dato).
                pass
            remaining_hashes.append(h)
        twofa.backup_codes_hashed = json.dumps(remaining_hashes)
        twofa.backup_codes_remaining = len(remaining_hashes)
        twofa.updated_at = datetime.now(timezone.utc)

    session.add(twofa)
    session.commit()
    _reset_rate_limit(str(user.id))

    token = security.create_access_token(
        user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    user_role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    registrar_auditoria(
        session=session,
        usuario_id=user.id,
        modulo="AUTH",
        accion="2FA_VERIFY_OK",
        ip_origen=request.client.host if request.client else None,
    )
    return TwoFactorVerifyResponse(
        access_token=token,
        rol=user_role.value,
        nombre=user.full_name or user.email,
    )


# ── 2FA: gestión (con sesión) ─────────────────────────────────────────────


@router.get("/2fa/status", response_model=TwoFactorStatus)
def twofa_status(
    current_user: CurrentUser, session: SessionDep
) -> Any:
    twofa = _get_twofa_for_user(session, current_user.id)
    user_role = (
        current_user.role
        if isinstance(current_user.role, UserRole)
        else UserRole(current_user.role)
    )
    enabled = twofa is not None and twofa.is_enabled
    return TwoFactorStatus(
        enabled=enabled,
        required_by_role=_requires_2fa_for_role(user_role),
        backup_codes_remaining=twofa.backup_codes_remaining if twofa else 0,
        confirmed_at=twofa.confirmed_at if twofa else None,
        disabled_at=twofa.disabled_at if twofa else None,
    )


@router.post("/2fa/disable", response_model=Message)
def twofa_disable(
    body: TwoFactorDisableInput,
    request: Request,
    current_user: CurrentUser,
    session: SessionDep,
) -> Any:
    verified, _ = verify_password(body.password, current_user.hashed_password)
    if not verified:
        raise HTTPException(
            status_code=401, detail="Contraseña incorrecta."
        )

    twofa = _get_twofa_for_user(session, current_user.id)
    if not twofa or not twofa.is_enabled:
        raise HTTPException(
            status_code=400, detail="2FA no está activo."
        )

    user_role = (
        current_user.role
        if isinstance(current_user.role, UserRole)
        else UserRole(current_user.role)
    )
    if _requires_2fa_for_role(user_role):
        raise HTTPException(
            status_code=400,
            detail="Su rol requiere 2FA. No puede desactivarlo.",
        )

    twofa.is_enabled = False
    twofa.disabled_at = datetime.now(timezone.utc)
    twofa.updated_at = datetime.now(timezone.utc)
    session.add(twofa)
    session.commit()

    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="AUTH",
        accion="2FA_DESACTIVADA",
        ip_origen=request.client.host if request.client else None,
    )
    return Message(message="2FA desactivado.")


@router.post(
    "/2fa/backup-codes/regenerate",
    response_model=TwoFactorRegenerateResponse,
)
def twofa_regenerate_backup_codes(
    body: TwoFactorRegenerateInput,
    request: Request,
    current_user: CurrentUser,
    session: SessionDep,
) -> Any:
    verified, _ = verify_password(body.password, current_user.hashed_password)
    if not verified:
        raise HTTPException(
            status_code=401, detail="Contraseña incorrecta."
        )

    twofa = _get_twofa_for_user(session, current_user.id)
    if not twofa or not twofa.is_enabled:
        raise HTTPException(
            status_code=400,
            detail="2FA debe estar activo para regenerar códigos de respaldo.",
        )

    codes = generate_backup_codes()
    hashes = hash_backup_codes(codes)
    twofa.backup_codes_hashed = json.dumps(hashes)
    twofa.backup_codes_remaining = len(codes)
    twofa.updated_at = datetime.now(timezone.utc)
    session.add(twofa)
    session.commit()

    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="AUTH",
        accion="2FA_BACKUP_REGENERADO",
        descripcion=f"{len(codes)} nuevos códigos emitidos",
        ip_origen=request.client.host if request.client else None,
    )
    return TwoFactorRegenerateResponse(backup_codes=codes)
