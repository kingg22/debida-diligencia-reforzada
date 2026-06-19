"""Tests para /api/v1/auth/2fa/* — setup, verify, status, disable, regenerate."""

from __future__ import annotations

import json
import uuid

import pyotp
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.crypto import encrypt_secret
from app.crud import create_user
from app.models import (
    Auditoria,
    TwoFactorAuth,
    User,
    UserCreate,
    UserRole,
)
from tests.utils.utils import random_email, random_lower_string


# ── Helpers ────────────────────────────────────────────────────────────────


def _make_user(
    db: Session, role: UserRole = UserRole.ANALISTA_DDR
) -> tuple[str, str, User]:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(
        email=email, password=password, full_name="Test 2FA", role=role
    )
    user = create_user(session=db, user_create=user_in)
    return email, password, user


def _set_known_password(db: Session, user: User, password: str) -> None:
    """Re-hashea ``user.hashed_password`` con ``password`` para que los
    tests de ``/2fa/disable`` y ``/2fa/regenerate`` puedan usarla."""
    from app.core.security import get_password_hash

    user.hashed_password = get_password_hash(password)
    db.add(user)
    db.commit()


def _enable_twofa(
    db: Session, user: User, *, backup_codes: int = 5
) -> str:
    """Crea fila TwoFactorAuth habilitada para ``user`` y devuelve el secret
    en claro (para que el test pueda generar códigos TOTP)."""
    secret = pyotp.random_base32()
    twofa = TwoFactorAuth(
        user_id=user.id,
        encrypted_secret=encrypt_secret(secret),
        is_enabled=True,
        confirmed_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        backup_codes_hashed=None,
        backup_codes_remaining=backup_codes,
        last_used_counter=0,
    )
    db.add(twofa)
    db.commit()
    return secret


# ── Login: 3 ramas ─────────────────────────────────────────────────────────


def test_login_sin_2fa_retorna_access_token_directo(
    client: TestClient, db: Session
) -> None:
    """ANALISTA (rol no requiere 2FA) → ``access_token`` directo, requires_2fa=False."""
    email, password, _ = _make_user(db, role=UserRole.ANALISTA_DDR)
    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["requires_2fa"] is False
    assert body["temp_token"] is None
    assert body["rol"] == "ANALISTA_DDR"


def test_login_rol_requiere_2fa_sin_configurar_retorna_setup(
    client: TestClient, db: Session
) -> None:
    """ADMIN sin 2FA → ``requires_2fa='setup'`` + ``temp_token``."""
    email, password, _ = _make_user(db, role=UserRole.ADMIN)
    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] is None
    assert body["requires_2fa"] == "setup"
    assert body["temp_token"]
    assert body["rol"] == "ADMIN"


def test_login_con_2fa_activo_retorna_verify(
    client: TestClient, db: Session
) -> None:
    """ANALISTA con 2FA habilitado → ``requires_2fa='verify'`` + ``temp_token``."""
    email, password, user = _make_user(db, role=UserRole.ANALISTA_DDR)
    _enable_twofa(db, user)

    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] is None
    assert body["requires_2fa"] == "verify"
    assert body["temp_token"]


# ── Setup wizard ───────────────────────────────────────────────────────────


def test_setup_start_genera_secret_y_qr(
    client: TestClient, db: Session
) -> None:
    email, password, _ = _make_user(db, role=UserRole.ADMIN)
    login_r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    temp_token = login_r.json()["temp_token"]

    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/setup/start",
        json={"temp_token": temp_token, "code": "000000"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["secret_base32"]
    assert body["otpauth_url"].startswith("otpauth://totp/")
    assert body["qr_png_base64"]  # base64 válido


def test_setup_confirm_con_codigo_valido_activa_2fa_y_emite_token(
    client: TestClient, db: Session
) -> None:
    email, password, user = _make_user(db, role=UserRole.ADMIN)
    login_r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    temp_token = login_r.json()["temp_token"]

    start = client.post(
        f"{settings.API_V1_STR}/auth/2fa/setup/start",
        json={"temp_token": temp_token, "code": "000000"},
    )
    secret = start.json()["secret_base32"]

    code = pyotp.TOTP(secret).now()
    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/setup/confirm",
        json={"temp_token": temp_token, "code": code},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert len(body["backup_codes"]) == settings.TWO_FA_BACKUP_CODES_COUNT
    assert body["rol"] == "ADMIN"

    # Estado persistido
    twofa = db.exec(
        select(TwoFactorAuth).where(TwoFactorAuth.user_id == user.id)
    ).first()
    assert twofa is not None
    assert twofa.is_enabled is True
    assert twofa.confirmed_at is not None
    assert twofa.last_used_counter > 0


def test_setup_confirm_con_codigo_invalido_retorna_400(
    client: TestClient, db: Session
) -> None:
    email, password, _ = _make_user(db, role=UserRole.ADMIN)
    login_r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    temp_token = login_r.json()["temp_token"]

    client.post(
        f"{settings.API_V1_STR}/auth/2fa/setup/start",
        json={"temp_token": temp_token, "code": "000000"},
    )

    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/setup/confirm",
        json={"temp_token": temp_token, "code": "000000"},  # código TOTP inválido
    )
    assert r.status_code == 400


# ── Verify flow ────────────────────────────────────────────────────────────


def test_verify_con_totp_valido_emite_access_token(
    client: TestClient, db: Session
) -> None:
    email, password, user = _make_user(db, role=UserRole.ANALISTA_DDR)
    secret = _enable_twofa(db, user)

    login_r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    temp_token = login_r.json()["temp_token"]

    code = pyotp.TOTP(secret).now()
    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/verify",
        json={"temp_token": temp_token, "code": code},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["rol"] == "ANALISTA_DDR"


def test_verify_anti_replay_rechaza_codigo_reusado(
    client: TestClient, db: Session
) -> None:
    email, password, user = _make_user(db, role=UserRole.ANALISTA_DDR)
    secret = _enable_twofa(db, user)

    login1 = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    temp_token_1 = login1.json()["temp_token"]
    code = pyotp.TOTP(secret).now()
    r1 = client.post(
        f"{settings.API_V1_STR}/auth/2fa/verify",
        json={"temp_token": temp_token_1, "code": code},
    )
    assert r1.status_code == 200

    # Re-login con la misma ventana (puede que el TOTP siga siendo el mismo
    # counter si pasaron <30 s)
    login2 = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    temp_token_2 = login2.json()["temp_token"]
    r2 = client.post(
        f"{settings.API_V1_STR}/auth/2fa/verify",
        json={"temp_token": temp_token_2, "code": code},
    )
    # El contador interno avanza, así que el mismo código se rechaza.
    assert r2.status_code == 401


def test_verify_con_backup_code_valido_decrementa_remaining(
    client: TestClient, db: Session
) -> None:
    email, password, user = _make_user(db, role=UserRole.ANALISTA_DDR)
    # Habilitar 2FA y simular backup codes
    secret = _enable_twofa(db, user, backup_codes=3)
    # Generar backup codes reales para el test
    from app.core.totp import generate_backup_codes, hash_backup_codes

    codes = generate_backup_codes(3)
    hashes = hash_backup_codes(codes)
    twofa = db.exec(
        select(TwoFactorAuth).where(TwoFactorAuth.user_id == user.id)
    ).first()
    twofa.backup_codes_hashed = json.dumps(hashes)
    twofa.backup_codes_remaining = len(codes)
    db.add(twofa)
    db.commit()

    login_r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    temp_token = login_r.json()["temp_token"]

    # El primer código tiene 10 chars alfanuméricos. Lo pasamos tal cual.
    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/verify",
        json={"temp_token": temp_token, "code": codes[0]},
    )
    assert r.status_code == 200
    db.refresh(twofa)
    assert twofa.backup_codes_remaining == 2


def test_verify_temp_token_invalido_retorna_401(
    client: TestClient, db: Session
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/verify",
        json={"temp_token": "esto-no-es-un-jwt", "code": "123456"},
    )
    assert r.status_code == 401


# ── Status, disable, regenerate ────────────────────────────────────────────


def test_status_devuelve_estado_actual(
    client: TestClient, db: Session
) -> None:
    from fastapi.testclient import TestClient
    from tests.utils.user import authentication_token_from_email

    email, password, user = _make_user(db, role=UserRole.ADMIN)
    _enable_twofa(db, user)

    headers = authentication_token_from_email(
        client=client, email=email, db=db
    )
    r = client.get(
        f"{settings.API_V1_STR}/auth/2fa/status", headers=headers
    )
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["required_by_role"] is True  # ADMIN
    assert body["backup_codes_remaining"] >= 0


def test_disable_con_password_incorrecta_retorna_401(
    client: TestClient, db: Session
) -> None:
    from tests.utils.user import authentication_token_from_email

    email, password, user = _make_user(db, role=UserRole.ANALISTA_DDR)
    _enable_twofa(db, user)
    headers = authentication_token_from_email(
        client=client, email=email, db=db
    )
    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/disable",
        json={"password": "WRONG-PASSWORD"},
        headers=headers,
    )
    assert r.status_code == 401


def test_disable_para_rol_que_requiere_2fa_retorna_400(
    client: TestClient, db: Session
) -> None:
    from tests.utils.user import authentication_token_from_email

    email, password, user = _make_user(db, role=UserRole.ADMIN)
    _enable_twofa(db, user)
    headers = authentication_token_from_email(
        client=client, email=email, db=db
    )
    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/disable",
        json={"password": "cualquiera-12345678"},
        headers=headers,
    )
    # ADMIN no puede desactivar 2FA → 400
    assert r.status_code == 400
    assert "requiere 2fa" in r.json()["detail"].lower()


def test_disable_exitoso_para_rol_opcional(
    client: TestClient, db: Session
) -> None:
    """Un ANALISTA con 2FA puede desactivarla con su password."""
    from tests.utils.user import authentication_token_from_email

    email, password, user = _make_user(db, role=UserRole.ANALISTA_DDR)
    _enable_twofa(db, user)
    # Fijar password conocida tras el reset que hace la fixture
    headers = authentication_token_from_email(
        client=client, email=email, db=db
    )
    # Re-leer la password real desde la BD (la fixture la cambió)
    db_user = db.exec(select(User).where(User.email == email)).first()
    assert db_user is not None
    # La fixture sólo actualiza el User, no expone la password; usamos
    # una password fija que aplicamos manualmente:
    from app.core.security import get_password_hash

    known_pwd = "KnownPassword123!"
    db_user.hashed_password = get_password_hash(known_pwd)
    db.add(db_user)
    db.commit()

    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/disable",
        json={"password": known_pwd},
        headers=headers,
    )
    assert r.status_code == 200
    assert "desactivado" in r.json()["message"].lower()
    db.refresh(db_user)
    twofa = db.exec(
        select(TwoFactorAuth).where(TwoFactorAuth.user_id == db_user.id)
    ).first()
    assert twofa is not None
    assert twofa.is_enabled is False


def test_regenerate_backup_codes_emite_nuevos(
    client: TestClient, db: Session
) -> None:
    from tests.utils.user import authentication_token_from_email

    email, password, user = _make_user(db, role=UserRole.ANALISTA_DDR)
    _enable_twofa(db, user)
    headers = authentication_token_from_email(
        client=client, email=email, db=db
    )

    from app.core.security import get_password_hash

    known_pwd = "KnownPassword123!"
    db_user = db.exec(select(User).where(User.email == email)).first()
    assert db_user is not None
    db_user.hashed_password = get_password_hash(known_pwd)
    db.add(db_user)
    db.commit()

    r = client.post(
        f"{settings.API_V1_STR}/auth/2fa/backup-codes/regenerate",
        json={"password": known_pwd},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["backup_codes"]) == settings.TWO_FA_BACKUP_CODES_COUNT
    # Todos únicos
    assert len(set(body["backup_codes"])) == settings.TWO_FA_BACKUP_CODES_COUNT


# ── Guard require_2fa_if_required_by_role ─────────────────────────────────


def test_endpoint_protegido_bloquea_admin_sin_2fa_con_header(
    client: TestClient, db: Session
) -> None:
    """Un ADMIN sin 2FA habilitado no puede acceder a /clientes/."""
    from tests.utils.user import authentication_token_from_email

    email, password, user = _make_user(db, role=UserRole.ADMIN)
    headers = authentication_token_from_email(
        client=client, email=email, db=db
    )
    r = client.get(f"{settings.API_V1_STR}/clientes/", headers=headers)
    assert r.status_code == 403
    assert r.headers.get("X-2FA-Setup-Required") == "true"


def test_endpoint_protegido_permite_admin_con_2fa(
    client: TestClient, db: Session
) -> None:
    """Un ADMIN con 2FA habilitado puede acceder a /clientes/."""
    from tests.utils.user import authentication_token_from_email

    email, password, user = _make_user(db, role=UserRole.ADMIN)
    _enable_twofa(db, user)
    headers = authentication_token_from_email(
        client=client, email=email, db=db
    )
    r = client.get(f"{settings.API_V1_STR}/clientes/", headers=headers)
    # El guard pasa; el endpoint puede devolver 200 o cualquier status que
    # no sea 403 con X-2FA-Setup-Required.
    assert r.status_code != 403 or r.headers.get("X-2FA-Setup-Required") != "true"
