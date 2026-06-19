"""Cifrado simétrico de secretos 2FA en reposo.

Usa Fernet (AES-128-CBC + HMAC-SHA256) con una clave derivada de
``settings.fernet_key_resolved``. La clave nunca debe loggearse ni
persistirse junto con los datos cifrados.
"""

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

# Singleton lazy. Fernet requiere la clave como bytes URL-safe base64.
_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.fernet_key_resolved
        if not key:
            raise RuntimeError(
                "FERNET_KEY no configurada y el entorno no es 'local'. "
                "Defina FERNET_KEY en .env o el entorno."
            )
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt_secret(plain: str) -> str:
    """Cifra un string y devuelve el token Fernet en base64 (str)."""
    if not plain:
        raise ValueError("encrypt_secret: plain no puede estar vacío")
    return _get_fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(cipher: str) -> str:
    """Descifra un token Fernet. Lanza ``InvalidToken`` si la clave cambió
    o el token está corrupto/manipulado."""
    if not cipher:
        raise ValueError("decrypt_secret: cipher no puede estar vacío")
    try:
        return _get_fernet().decrypt(cipher.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise InvalidToken(
            "Token 2FA inválido o cifrado con otra clave. "
            "Si rotó FERNET_KEY debe re-enrolar a los usuarios."
        ) from exc