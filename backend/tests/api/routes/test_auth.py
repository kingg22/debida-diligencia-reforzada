"""Tests para /api/v1/auth/login, /auth/logout y todo el flujo de lockout."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import get_password_hash
from app.crud import create_user
from app.models import Auditoria, User, UserCreate, UserRole
from tests.utils.utils import random_email, random_lower_string


def test_login_exitoso_retorna_token_rol_nombre(
    client: TestClient, db: Session
) -> None:
    """Login con credenciales válidas devuelve {access_token, rol, nombre}."""
    email = random_email()
    password = random_lower_string()
    user = UserCreate(
        email=email,
        password=password,
        full_name="Juan Pérez",
        role=UserRole.ANALISTA_DDR,
    )
    create_user(session=db, user_create=user)

    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["rol"] == "ANALISTA_DDR"
    assert body["nombre"] == "Juan Pérez"


def test_login_credenciales_incorrectas_retorna_401(
    client: TestClient, db: Session
) -> None:
    """Login con password incorrecta retorna 401 e incrementa intentos."""
    email = random_email()
    password = random_lower_string()
    create_user(
        session=db,
        user_create=UserCreate(email=email, password=password, role=UserRole.AUDITOR),
    )

    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": "WRONG"},
    )
    assert r.status_code == 401
    user = db.exec(select(User).where(User.email == email)).first()
    assert user is not None
    assert user.intentos_fallidos == 1


def test_login_correo_inexistente_retorna_401(client: TestClient) -> None:
    """Login con correo no registrado retorna 401."""
    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": "noexiste@sgddr.pa", "password": "cualquiera"},
    )
    assert r.status_code == 401


def test_login_quinto_intento_bloquea_cuenta(
    client: TestClient, db: Session
) -> None:
    """El 5to intento fallido bloquea la cuenta por 30 minutos."""
    email = random_email()
    password = random_lower_string()
    create_user(
        session=db,
        user_create=UserCreate(email=email, password=password, role=UserRole.AUDITOR),
    )

    for _ in range(4):
        r = client.post(
            f"{settings.API_V1_STR}/auth/login",
            json={"correo": email, "password": "WRONG"},
        )
        assert r.status_code == 401

    # Quinto intento → debe bloquear
    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": "WRONG"},
    )
    assert r.status_code == 403
    assert "bloqueada" in r.json()["detail"].lower()

    user = db.exec(select(User).where(User.email == email)).first()
    assert user is not None
    assert user.intentos_fallidos == 5
    assert user.bloqueado_hasta is not None
    assert user.bloqueado_hasta > datetime.now(timezone.utc)

    # Verificar auditoría
    audit = db.exec(
        select(Auditoria)
        .where(Auditoria.usuario_id == user.id, Auditoria.accion == "CUENTA_BLOQUEADA")
    ).first()
    assert audit is not None


def test_cuenta_bloqueada_retorna_403(client: TestClient, db: Session) -> None:
    """Si la cuenta está bloqueada, login con password correcta retorna 403."""
    email = random_email()
    password = random_lower_string()
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role=UserRole.AUDITOR,
        bloqueado_hasta=datetime.now(timezone.utc) + timedelta(minutes=10),
        is_active=True,
    )
    db.add(user)
    db.commit()

    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 403
    assert "bloqueada" in r.json()["detail"].lower()


def test_login_resetea_intentos_exitosos(client: TestClient, db: Session) -> None:
    """Tras un login exitoso, intentos_fallidos vuelve a 0."""
    email = random_email()
    password = random_lower_string()
    create_user(
        session=db,
        user_create=UserCreate(email=email, password=password, role=UserRole.AUDITOR),
    )
    user = db.exec(select(User).where(User.email == email)).first()
    assert user is not None
    user.intentos_fallidos = 3
    db.add(user)
    db.commit()

    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 200
    db.refresh(user)
    assert user.intentos_fallidos == 0
    assert user.bloqueado_hasta is None


def test_logout_registra_en_auditoria(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    """POST /auth/logout registra una entrada de auditoría."""
    r = client.post(
        f"{settings.API_V1_STR}/auth/logout",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200

    # Verificar auditoría
    audit = db.exec(
        select(Auditoria)
        .where(Auditoria.accion == "LOGOUT")
        .order_by(Auditoria.creado_en.desc())
    ).first()
    assert audit is not None
    assert audit.modulo == "AUTH"


def test_login_usuario_inactivo_retorna_403(client: TestClient, db: Session) -> None:
    """Un usuario con is_active=False no puede iniciar sesión."""
    email = random_email()
    password = random_lower_string()
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role=UserRole.AUDITOR,
        is_active=False,
    )
    db.add(user)
    db.commit()

    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 403
