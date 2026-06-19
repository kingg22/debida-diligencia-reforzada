"""Helpers TOTP (RFC 6238) y backup codes para 2FA.

Wrappers delgados sobre ``pyotp`` para mantener el resto del código
libre de la dependencia directa y permitir añadir telemetría/caching
después sin tocar los routers.
"""

from __future__ import annotations

import base64
import io
import secrets
import string
from datetime import datetime, timezone

import pyotp
import qrcode
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import settings

# Hasher dedicado para backup codes. Usar Argon2 (más resistente a GPU
# que bcrypt para estos códigos de baja entropía).
_backup_hash = PasswordHash((Argon2Hasher(),))


# ── Secret / URI / QR ─────────────────────────────────────────────────────


def generate_secret() -> str:
    """Genera un secret TOTP en base32 (compatibilidad con todas las
    apps authenticator)."""
    return pyotp.random_base32(length=32)


def provisioning_uri(email: str, secret: str) -> str:
    """Devuelve el ``otpauth://`` URI que consume la app authenticator."""
    return pyotp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=settings.TWO_FA_ISSUER,
    )


def qr_png_b64(otpauth_uri: str) -> str:
    """Genera el QR en PNG y lo devuelve como base64 (sin prefijo
    ``data:``) listo para ``<img src="data:image/png;base64,...">``."""
    img = qrcode.make(otpauth_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ── Verificación TOTP ────────────────────────────────────────────────────


class TotpVerifyResult:
    __slots__ = ("valid", "counter")

    def __init__(self, valid: bool, counter: int | None = None) -> None:
        self.valid = valid
        self.counter = counter

    def __repr__(self) -> str:  # pragma: no cover
        return f"TotpVerifyResult(valid={self.valid}, counter={self.counter})"


def verify_totp(
    secret: str,
    code: str,
    last_counter: int = 0,
    window: int | None = None,
) -> TotpVerifyResult:
    """Verifica un código TOTP de 6 dígitos con anti-replay.

    ``last_counter`` es el último step aceptado para este usuario. Si el
    código corresponde a un step ``<= last_counter`` se rechaza (replay).
    Devuelve ``TotpVerifyResult(valid, counter)`` donde ``counter`` es el
    step aceptado (para actualizar ``last_used_counter``).
    """
    if not code or not code.isdigit() or len(code) != 6:
        return TotpVerifyResult(valid=False)
    if window is None:
        window = settings.TWO_FA_WINDOW

    totp = pyotp.TOTP(secret)
    # ``verify`` con ``for_time=datetime`` recorre internamente la ventana
    # (±1 step) y sólo devuelve ``True`` sin indicar qué counter fue
    # aceptado. Para nuestro anti-replay necesitamos saber el counter
    # exacto. Iteramos manualmente la ventana y usamos
    # ``generate_otp(counter)`` para generar el código esperado en cada
    # step, comparándolo con ``code``.
    now_step = totp.timecode(datetime.now(timezone.utc))
    for offset in range(-window, window + 1):
        candidate = now_step + offset
        if candidate <= last_counter:
            continue
        if totp.generate_otp(candidate) == code:
            return TotpVerifyResult(valid=True, counter=candidate)
    return TotpVerifyResult(valid=False)


# ── Backup codes ──────────────────────────────────────────────────────────


# 10 chars alfanuméricos sin ambiguos (sin 0/O, 1/I/L). Suficiente para
# uso único y fácil de transcribir.
_BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _format_backup_code(raw: str) -> str:
    """Formatea ``ABCDEFGHIJ`` como ``ABCDE-FGHIJ`` para legibilidad.
    El valor hasheado es la versión sin guiones."""
    return f"{raw[:5]}-{raw[5:]}"


def generate_backup_codes(n: int | None = None) -> list[str]:
    """Genera ``n`` backup codes formateados ``XXXXX-XXXXX``."""
    if n is None:
        n = settings.TWO_FA_BACKUP_CODES_COUNT
    codes: list[str] = []
    for _ in range(n):
        raw = "".join(secrets.choice(_BACKUP_ALPHABET) for _ in range(10))
        codes.append(_format_backup_code(raw))
    return codes


def hash_backup_codes(codes: list[str]) -> list[str]:
    """Hashea (Argon2) una lista de backup codes para almacenamiento."""
    return [_backup_hash.hash(c.replace("-", "")) for c in codes]


def verify_backup_code(code: str, hashed_codes: list[str]) -> bool:
    """Verifica un backup code contra la lista hasheada."""
    if not code or not hashed_codes:
        return False
    normalized = code.replace("-", "").upper().strip()
    if not normalized:
        return False
    for h in hashed_codes:
        try:
            if _backup_hash.verify(normalized, h):
                return True
        except (ValueError, TypeError):
            continue
    return False


# Sanity-check del alfabeto en import-time para detectar typos.
assert all(c in string.ascii_letters + string.digits for c in _BACKUP_ALPHABET)