"""Tests para /api/v1/auditoria (bitácora)."""
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import Auditoria, User, UserRole
from tests.utils.utils import random_email, random_lower_string


def _make_user(db: Session, role: UserRole) -> User:
    email = random_email()
    user = User(
        email=email,
        hashed_password=get_password_hash(random_lower_string()),
        full_name="Test User",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _login_as(client: TestClient, email: str, password: str) -> dict[str, str]:
    """Login con la nueva ruta y devuelve headers con bearer token."""
    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_auditor_accede_bitacora(client: TestClient, db: Session) -> None:
    """El rol AUDITOR puede leer /auditoria/."""
    email = random_email()
    password = random_lower_string()
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Ana",
        role=UserRole.AUDITOR,
        is_active=True,
    )
    db.add(user)
    db.commit()

    # Crear al menos un registro de auditoría
    db.add(
        Auditoria(
            usuario_id=user.id,
            modulo="AUTH",
            accion="LOGIN_EXITOSO",
        )
    )
    db.commit()

    headers = _login_as(client, email, password)
    r = client.get(f"{settings.API_V1_STR}/auditoria/", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "data" in body
    assert "count" in body
    assert body["count"] >= 1


def test_oficial_no_accede_bitacora(
    client: TestClient, db: Session
) -> None:
    """El rol OFICIAL_CUMPLIMIENTO NO puede leer /auditoria/."""
    email = random_email()
    password = random_lower_string()
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Rosa",
        role=UserRole.OFICIAL_CUMPLIMIENTO,
        is_active=True,
    )
    db.add(user)
    db.commit()

    headers = _login_as(client, email, password)
    r = client.get(f"{settings.API_V1_STR}/auditoria/", headers=headers)
    assert r.status_code == 403


def test_auditoria_filtro_por_modulo(
    client: TestClient, db: Session
) -> None:
    """El endpoint soporta filtro por módulo."""
    email = random_email()
    password = random_lower_string()
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Ana",
        role=UserRole.AUDITOR,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.add(
        Auditoria(usuario_id=user.id, modulo="AUTH", accion="LOGIN_EXITOSO")
    )
    db.add(
        Auditoria(usuario_id=user.id, modulo="USUARIOS", accion="CREAR_USUARIO")
    )
    db.commit()

    headers = _login_as(client, email, password)
    r = client.get(
        f"{settings.API_V1_STR}/auditoria/?modulo=USUARIOS",
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    for item in body["data"]:
        assert item["modulo"] == "USUARIOS"


def test_crear_usuario_registra_auditoria(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """POST /usuarios/ deja un registro en la bitácora."""
    with (
        patch("app.utils.send_email", return_value=None),
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
    ):
        email = random_email()
        password = random_lower_string()
        r = client.post(
            f"{settings.API_V1_STR}/usuarios/",
            headers=superuser_token_headers,
            json={"email": email, "password": password},
        )
        assert r.status_code == 200

    audit = db.exec(
        select(Auditoria)
        .where(Auditoria.accion == "CREAR_USUARIO")
        .order_by(Auditoria.creado_en.desc())
    ).first()
    assert audit is not None
    assert audit.modulo == "USUARIOS"
    assert audit.entidad_tipo == "usuario"
