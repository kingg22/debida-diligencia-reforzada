"""Tests del endpoint POST /api/v1/clientes/ — Persona Jurídica (Ley 254/2021).

Cubre:
- Happy path JURIDICA con beneficiarios sumando 100%.
- JURIDICA sin beneficiarios → 422.
- JURIDICA con suma != 100 → 422 con mensaje que indica cuánto falta/sobra.
- JURIDICA en borrador con suma != 100 también falla (no sólo al enviar a revisión).
- NATURAL sin beneficiarios → 200 (regresión: la regla sólo aplica a JURIDICA).
- JURIDICA sin rol ANALISTA_DDR → 403.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import (
    BeneficiarioFinalCreate,
    ClientType,
    ExpedienteKYCCreate,
    PersonaJuridicaCreate,
    PersonaNaturalCreate,
    User,
    UserRole,
)
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email

CLientes_PATH = f"{settings.API_V1_STR}/clientes/"
TEST_PASSWORD = "TestPass1A!"


def _make_user(db: Session, role: UserRole) -> User:
    email = random_email()
    user = User(
        email=email,
        hashed_password=get_password_hash(TEST_PASSWORD),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_analista_headers(client: TestClient, db: Session) -> tuple[dict[str, str], User]:
    user = _make_user(db, UserRole.ANALISTA_DDR)
    headers = user_authentication_headers(
        client=client, email=user.email, password=TEST_PASSWORD
    )
    return headers, user


def _make_auditor_headers(client: TestClient, db: Session) -> dict[str, str]:
    user = _make_user(db, UserRole.AUDITOR)
    return user_authentication_headers(
        client=client, email=user.email, password=TEST_PASSWORD
    )


def _pj_payload(
    *,
    enviar_a_revision: bool = True,
    beneficiarios: list[dict] | None = None,
) -> dict:
    """Construye un payload JSON para JURIDICA.

    Acepta ``beneficiarios`` como lista de dicts (no instancias) para poder
    construir payloads inválidos y probar el validator — el constructor de
    ``ExpedienteKYCCreate`` también corre el @model_validator.
    """
    pj = {
        "razon_social": "Acme S.A.",
        "ruc": "1234567-1-234567",
        "tipo_sociedad": "SOCIEDAD_ANONIMA",
        "fecha_constitucion": "2010-01-01",
        "pais_constitucion": "Panamá",
        "numero_registro_mercantil": "RM-12345",
        "nombre_representante": "María Pérez",
        "cedula_representante": "8-123-4567",
        "cargo_representante": "REPRESENTANTE_LEGAL",
        "telefono_empresa": "200-0000",
        "email_empresa": "contacto@acme.com",
        "direccion_fiscal": "Av. Principal 123",
        "ciudad": "Ciudad de Panamá",
        "pais": "Panamá",
        "actividad_economica": "Servicios financieros",
        "ingreso_anual_aproximado": 1_000_000,
        "cantidad_empleados": 25,
        "tiene_accionistas_anonimos": False,
        "opera_en_paises_alto_riesgo": False,
    }
    if beneficiarios is None:
        beneficiarios = [
            {
                "nombre": "Carlos",
                "apellido": "Gómez",
                "cedula": "3-456-789",
                "nacionalidad": "Panamá",
                "pais": "Panamá",
                "fecha_nacimiento": "1980-01-01",
                "porcentaje_participacion": 60,
                "es_pep": False,
            },
            {
                "nombre": "Ana",
                "apellido": "Ruiz",
                "cedula": "4-567-890",
                "nacionalidad": "Panamá",
                "pais": "Panamá",
                "fecha_nacimiento": "1985-05-10",
                "porcentaje_participacion": 40,
                "es_pep": False,
            },
        ]
    return {
        "tipo_cliente": "JURIDICA",
        "persona_juridica": pj,
        "beneficiarios_final": beneficiarios,
        "enviar_a_revision": enviar_a_revision,
    }


def _natural_payload(enviar_a_revision: bool = True) -> dict:
    return {
        "tipo_cliente": "NATURAL",
        "persona_natural": {
            "tipo_documento": "CEDULA",
            "numero_documento": "1-123-456",
            "fecha_expiracion_doc": "2030-12-31",
            "nacionalidad": "Panameña",
            "pais_nacimiento": "Panamá",
            "nombre": "Juan",
            "apellido": "Pérez",
            "fecha_nacimiento": "1990-01-01",
            "genero": "M",
            "estado_civil": "SOLTERO",
            "telefono": "6000-1234",
            "email": "juan@test.com",
            "direccion": "Calle 1",
            "ciudad": "Panamá",
            "pais": "Panamá",
            "ocupacion": "Ingeniero",
            "empleador": "Tech Corp",
            "ingreso_mensual_aproximado": 5000,
            "fuente_ingresos": "Salario",
            "es_pep": False,
            "es_pep_familiar": False,
            "tiene_antecedentes": False,
        },
        "beneficiarios_final": [],
        "enviar_a_revision": enviar_a_revision,
    }


class TestCrearClienteJuridica:
    def test_crear_juridica_happy_path(
        self, client: TestClient, db: Session
    ) -> None:
        headers, _ = _make_analista_headers(client, db)
        r = client.post(CLientes_PATH, headers=headers, json=_pj_payload())
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tipo_cliente"] == "JURIDICA"
        assert body["status"] == "PENDIENTE"  # enviar_a_revision=True → CRUD pasa a PENDIENTE
        assert len(body["beneficiarios_final"]) == 2
        assert body["persona_juridica"]["ruc"] == "1234567-1-234567"

    def test_crear_juridica_sin_beneficiarios_falla(
        self, client: TestClient, db: Session
    ) -> None:
        headers, _ = _make_analista_headers(client, db)
        r = client.post(
            CLientes_PATH,
            headers=headers,
            json=_pj_payload(beneficiarios=[]),
        )
        assert r.status_code == 422, r.text
        detail = r.json()["detail"]
        assert any(
            "al menos un beneficiario final" in str(e).lower()
            for e in (detail if isinstance(detail, list) else [detail])
        ), detail

    def test_crear_juridica_suma_no_100_indica_delta(
        self, client: TestClient, db: Session
    ) -> None:
        headers, _ = _make_analista_headers(client, db)
        bf_unico = {
            "nombre": "Carlos",
            "apellido": "Gómez",
            "cedula": "3-456-789",
            "nacionalidad": "Panamá",
            "pais": "Panamá",
            "fecha_nacimiento": "1980-01-01",
            "porcentaje_participacion": 60,
            "es_pep": False,
        }
        r = client.post(
            CLientes_PATH,
            headers=headers,
            json=_pj_payload(beneficiarios=[bf_unico]),
        )
        assert r.status_code == 422, r.text
        detail = r.json()["detail"]
        flat = " ".join(
            str(e) for e in (detail if isinstance(detail, list) else [detail])
        ).lower()
        assert "deben sumar 100" in flat
        assert "60" in flat
        assert "falta 40" in flat

    def test_crear_juridica_en_borrador_tambien_falla(
        self, client: TestClient, db: Session
    ) -> None:
        """El validator corre siempre, no sólo cuando enviar_a_revision=True."""
        headers, _ = _make_analista_headers(client, db)
        bf_unico = {
            "nombre": "Carlos",
            "apellido": "Gómez",
            "cedula": "3-456-789",
            "nacionalidad": "Panamá",
            "pais": "Panamá",
            "fecha_nacimiento": "1980-01-01",
            "porcentaje_participacion": 70,
            "es_pep": False,
        }
        r = client.post(
            CLientes_PATH,
            headers=headers,
            json=_pj_payload(enviar_a_revision=False, beneficiarios=[bf_unico]),
        )
        assert r.status_code == 422, r.text
        assert "70" in r.text and "falta" in r.text.lower()

    def test_crear_natural_no_requiere_beneficiarios(
        self, client: TestClient, db: Session
    ) -> None:
        """Regresión: la regla de 100% sólo aplica a JURIDICA."""
        headers, _ = _make_analista_headers(client, db)
        r = client.post(
            CLientes_PATH, headers=headers, json=_natural_payload()
        )
        assert r.status_code == 200, r.text
        assert r.json()["tipo_cliente"] == "NATURAL"

    def test_crear_juridica_sin_permiso_falla_403(
        self, client: TestClient, db: Session
    ) -> None:
        headers = _make_auditor_headers(client, db)
        r = client.post(CLientes_PATH, headers=headers, json=_pj_payload())
        assert r.status_code == 403, r.text
