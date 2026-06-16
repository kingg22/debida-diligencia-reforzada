"""Tests para /api/v1/dashboard/."""
import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import (
    CasoDDR,
    EstadoCaso,
    ExpedienteKYC,
    KYCStatus,
    RiskLevel,
    User,
    UserRole,
)
from tests.utils.utils import random_email, random_lower_string


def _login_as(client: TestClient, email: str, password: str) -> dict[str, str]:
    r = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"correo": email, "password": password},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make_user(db: Session, role: UserRole, password: str) -> User:
    email = random_email()
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Test",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_dashboard_oficial_retorna_kpis_oficial(
    client: TestClient, db: Session
) -> None:
    """OFICIAL_CUMPLIMIENTO recibe los 4 KPIs que le corresponden."""
    password = random_lower_string()
    user = _make_user(db, UserRole.OFICIAL_CUMPLIMIENTO, password)
    # Crear un expediente hoy
    db.add(
        ExpedienteKYC(
            nombres="A",
            apellidos="B",
            tipo_identificacion="CEDULA",
            numero_identificacion="8-000-0001",
            estado=KYCStatus.PENDIENTE,
            nivel_riesgo=RiskLevel.BAJO,
        )
    )
    db.commit()

    headers = _login_as(client, user.email, password)
    r = client.get(f"{settings.API_V1_STR}/dashboard/", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "clientes_registrados_hoy" in body
    assert "clientes_pendientes_revision" in body
    assert "casos_ddr_abiertos" in body
    assert "casos_ddr_en_revision" in body


def test_dashboard_analista_retorna_kpis_analista(
    client: TestClient, db: Session
) -> None:
    """ANALISTA_DDR recibe los KPIs de analista."""
    password = random_lower_string()
    user = _make_user(db, UserRole.ANALISTA_DDR, password)

    headers = _login_as(client, user.email, password)
    r = client.get(f"{settings.API_V1_STR}/dashboard/", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "mis_casos_abiertos" in body
    assert "mis_casos_en_revision" in body
    assert "casos_sin_asignar" in body


def test_dashboard_gerente_retorna_kpis_aprobacion(
    client: TestClient, db: Session
) -> None:
    """GERENTE_CUMPLIMIENTO recibe KPIs de aprobación ALTO."""
    password = random_lower_string()
    user = _make_user(db, UserRole.GERENTE_CUMPLIMIENTO, password)

    headers = _login_as(client, user.email, password)
    r = client.get(f"{settings.API_V1_STR}/dashboard/", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "casos_pendientes_aprobacion_alto" in body
    assert "dias_promedio_espera" in body


def test_dashboard_comite_retorna_kpis_muy_alto(
    client: TestClient, db: Session
) -> None:
    """COMITE_CUMPLIMIENTO recibe KPIs de aprobación MUY_ALTO."""
    password = random_lower_string()
    user = _make_user(db, UserRole.COMITE_CUMPLIMIENTO, password)

    headers = _login_as(client, user.email, password)
    r = client.get(f"{settings.API_V1_STR}/dashboard/", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "casos_pendientes_aprobacion_muy_alto" in body
    assert "dias_promedio_espera" in body


def test_dashboard_admin_retorna_kpis_admin(
    client: TestClient, db: Session
) -> None:
    """ADMIN recibe KPIs administrativos."""
    password = random_lower_string()
    user = _make_user(db, UserRole.ADMIN, password)
    user.is_superuser = True
    db.add(user)
    db.commit()

    headers = _login_as(client, user.email, password)
    r = client.get(f"{settings.API_V1_STR}/dashboard/", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "total_usuarios" in body
    assert "usuarios_activos" in body
    assert "total_clientes" in body
    assert "total_casos_ddr" in body


def test_dashboard_auditor_retorna_totales(
    client: TestClient, db: Session
) -> None:
    """AUDITOR recibe totales de clientes y casos DDR."""
    password = random_lower_string()
    user = _make_user(db, UserRole.AUDITOR, password)

    headers = _login_as(client, user.email, password)
    r = client.get(f"{settings.API_V1_STR}/dashboard/", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "total_clientes" in body
    assert "total_casos_ddr" in body


def test_dashboard_requiere_auth(client: TestClient) -> None:
    """Sin token, /dashboard/ retorna 401/403."""
    r = client.get(f"{settings.API_V1_STR}/dashboard/")
    assert r.status_code in (401, 403)
