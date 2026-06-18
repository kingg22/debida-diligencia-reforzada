import io
import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import (
    CasoDDR,
    ClientType,
    EstadoCasoDDR,
    ExpedienteKYCCreate,
    PersonaNaturalCreate,
    User,
    UserRole,
)
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email

TEST_PASSWORD = "TestPass1A!"


def _create_user_with_role(db: Session, role: UserRole) -> User:
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


def _create_analista(db: Session) -> User:
    return _create_user_with_role(db, UserRole.ANALISTA_DDR)


def _create_oficial(db: Session) -> User:
    return _create_user_with_role(db, UserRole.OFICIAL_CUMPLIMIENTO)


def _create_gerente(db: Session) -> User:
    return _create_user_with_role(db, UserRole.GERENTE_CUMPLIMIENTO)


def _make_expediente_data() -> ExpedienteKYCCreate:
    return ExpedienteKYCCreate(
        tipo_cliente=ClientType.NATURAL,
        persona_natural=PersonaNaturalCreate(
            tipo_documento="CEDULA",
            numero_documento="1-123-456",
            fecha_expiracion_doc="2030-12-31",
            nacionalidad="Panameña",
            pais_nacimiento="Panamá",
            nombre="Juan",
            apellido="Pérez",
            fecha_nacimiento="1990-01-01",
            genero="M",
            estado_civil="SOLTERO",
            telefono="6000-1234",
            email="juan@test.com",
            direccion="Calle 1",
            ciudad="Panamá",
            pais="Panamá",
            ocupacion="Ingeniero",
            empleador="Tech Corp",
            ingreso_mensual_aproximado=5000,
            fuente_ingresos="Salario",
            es_pep=False,
            es_pep_familiar=False,
            tiene_antecedentes=False,
        ),
        enviar_a_revision=False,
    )


def _make_pep_expediente_data() -> ExpedienteKYCCreate:
    return ExpedienteKYCCreate(
        tipo_cliente=ClientType.NATURAL,
        persona_natural=PersonaNaturalCreate(
            tipo_documento="CEDULA",
            numero_documento="1-123-456",
            fecha_expiracion_doc="2030-12-31",
            nacionalidad="Panameña",
            pais_nacimiento="Panamá",
            nombre="Juan",
            apellido="Pérez",
            fecha_nacimiento="1990-01-01",
            genero="M",
            estado_civil="SOLTERO",
            telefono="6000-1234",
            email="juan@test.com",
            direccion="Calle 1",
            ciudad="Panamá",
            pais="Panamá",
            ocupacion="Ingeniero",
            empleador="Tech Corp",
            ingreso_mensual_aproximado=5000,
            fuente_ingresos="Salario",
            es_pep=True,
            es_pep_familiar=True,
            tiene_antecedentes=True,
        ),
        enviar_a_revision=False,
    )


class TestCasosDDRGet:
    def test_list_vacia(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        r = client.get(f"{settings.API_V1_STR}/casos-ddr/", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 0
        assert data["data"] == []

    def test_list_con_datos(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        r = client.get(f"{settings.API_V1_STR}/casos-ddr/", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 1

    def test_get_by_id(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        r = client.get(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}", headers=headers
        )
        assert r.status_code == 200
        assert r.json()["id"] == str(caso.id)

    def test_get_no_existe_404(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        fake_id = uuid.uuid4()
        r = client.get(
            f"{settings.API_V1_STR}/casos-ddr/{fake_id}", headers=headers
        )
        assert r.status_code == 404


class TestAsignarAnalista:
    def test_asignar_ok(self, client: TestClient, db: Session):
        oficial = _create_oficial(db)
        analista1 = _create_analista(db)
        analista2 = _create_analista(db)

        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista1.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        headers = user_authentication_headers(
            client=client, email=oficial.email, password=TEST_PASSWORD
        )
        r = client.patch(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}/asignar",
            headers=headers,
            json={"analista_id": str(analista2.id)},
        )
        assert r.status_code == 200
        assert r.json()["analista_id"] == str(analista2.id)

    def test_asignar_usuario_no_analista_falla(self, client: TestClient, db: Session):
        oficial = _create_oficial(db)
        analista = _create_analista(db)
        otro = _create_user_with_role(db, UserRole.AUDITOR)

        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        headers = user_authentication_headers(
            client=client, email=oficial.email, password=TEST_PASSWORD
        )
        r = client.patch(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}/asignar",
            headers=headers,
            json={"analista_id": str(otro.id)},
        )
        assert r.status_code == 400


class TestEnviarAprobacion:
    def test_enviar_ok(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        from app.models import CuestionarioEBR

        cuestionario = CuestionarioEBR(
            caso_ddr_id=caso.id,
            origen_fondos="Actividad empresarial",
            proposito_relacion="Inversión",
            patrimonio_estimado="500000",
            pais_origen_patrimonio="Panamá",
            tiene_estructura_societaria=False,
            familiar_pep=False,
            completado=True,
            completado_por=analista.id,
        )
        db.add(cuestionario)
        caso.status = EstadoCasoDDR.EN_REVISION.value
        db.add(caso)
        db.commit()
        db.refresh(caso)

        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        r = client.post(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}/enviar-aprobacion",
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == EstadoCasoDDR.EN_APROBACION.value

    def test_enviar_cuestionario_incompleto_falla(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        caso.status = EstadoCasoDDR.EN_REVISION.value
        db.add(caso)
        db.commit()

        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        r = client.post(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}/enviar-aprobacion",
            headers=headers,
        )
        assert r.status_code == 400


class TestCuestionarioEBR:
    def test_get_cuestionario(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        from app.models import CuestionarioEBR

        cuestionario = CuestionarioEBR(
            caso_ddr_id=caso.id,
            origen_fondos="Test",
            completado=False,
        )
        db.add(cuestionario)
        db.commit()

        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        r = client.get(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}/cuestionario",
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["origen_fondos"] == "Test"

    def test_update_cuestionario(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        from app.models import CuestionarioEBR

        cuestionario = CuestionarioEBR(
            caso_ddr_id=caso.id,
            completado=False,
        )
        db.add(cuestionario)
        db.commit()

        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        r = client.patch(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}/cuestionario",
            headers=headers,
            json={"origen_fondos": "Negocios legales"},
        )
        assert r.status_code == 200
        assert r.json()["origen_fondos"] == "Negocios legales"


class TestDocumentosDDR:
    def test_upload_documento(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        file_content = b"fake pdf content for testing"
        r = client.post(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}/documentos",
            headers=headers,
            files={"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")},
            data={"tipo": "OTRO"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["hash_sha256"] is not None
        assert len(data["hash_sha256"]) == 64

    def test_list_documentos(self, client: TestClient, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None

        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        r = client.get(
            f"{settings.API_V1_STR}/casos-ddr/{caso.id}/documentos",
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["count"] == 0


class TestAutoCrearCasoDDR:
    def test_caso_creado_riesgo_alto(self, db: Session):
        analista = _create_analista(db)
        expediente = crud.create_expediente(
            session=db,
            expediente_in=_make_pep_expediente_data(),
            analista_id=analista.id,
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is not None
        assert caso.nivel_riesgo in ("ALTO", "MUY_ALTO")

    def test_no_caso_riesgo_bajo(self, db: Session):
        analista = _create_analista(db)
        data = ExpedienteKYCCreate(
            tipo_cliente=ClientType.NATURAL,
            persona_natural=PersonaNaturalCreate(
                tipo_documento="CEDULA",
                numero_documento="1-123-456",
                fecha_expiracion_doc="2030-12-31",
                nacionalidad="Panameña",
                pais_nacimiento="Panamá",
                nombre="Juan",
                apellido="Pérez",
                fecha_nacimiento="1990-01-01",
                genero="M",
                estado_civil="SOLTERO",
                telefono="6000-1234",
                email="juan@test.com",
                direccion="Calle 1",
                ciudad="Panamá",
                pais="Panamá",
                ocupacion="Ingeniero",
                empleador="Tech Corp",
                ingreso_mensual_aproximado=3000,
                fuente_ingresos="Salario",
                es_pep=False,
                es_pep_familiar=False,
                tiene_antecedentes=False,
            ),
            enviar_a_revision=False,
        )

        expediente = crud.create_expediente(
            session=db, expediente_in=data, analista_id=analista.id
        )
        caso = db.exec(
            select(CasoDDR).where(CasoDDR.expediente_id == expediente.id)
        ).first()
        assert caso is None


# ── Resumen de cliente embebido en GET /casos-ddr y /casos-ddr/{id} ───────
#
# El backend embebe un ``ClienteResumen`` en cada caso DDR para que la UI
# pueda mostrar el nombre/identificación del cliente sin un round-trip
# extra a /clientes/{id} (que tiene AccesoKYC y no es accesible para
# GERENTE, COMITE, AUDITOR).
#
# Estos tests verifican que el resumen se popula para roles con DDR y
# que los campos clave (nombres, apellidos, identificación) están
# presentes y coinciden con los datos del expediente.


def _expediente_juridica() -> ExpedienteKYCCreate:
    """Expediente jurídica con 2 beneficiarios que suman 100% (Ley 254/2021)."""
    from app.models import (
        BeneficiarioFinalCreate,
        PersonaJuridicaCreate,
    )

    return ExpedienteKYCCreate(
        tipo_cliente=ClientType.JURIDICA,
        persona_juridica=PersonaJuridicaCreate(
            razon_social="Acme S.A.",
            ruc="1234567-1-234567",
            tipo_sociedad="SOCIEDAD_ANONIMA",
            fecha_constitucion="2010-01-01",
            pais_constitucion="Panamá",
            numero_registro_mercantil="RM-12345",
            nombre_representante="Carlos Mendoza",
            cedula_representante="8-999-0001",
            cargo_representante="REPRESENTANTE_LEGAL",
            telefono_empresa="200-0000",
            email_empresa="acme@test.com",
            direccion_fiscal="Av. Test 100",
            ciudad="Panamá",
            pais="Panamá",
            actividad_economica="Servicios",
            ingreso_anual_aproximado=1_000_000,
            cantidad_empleados=10,
            tiene_accionistas_anonimos=False,
            opera_en_paises_alto_riesgo=False,
        ),
        beneficiarios_final=[
            BeneficiarioFinalCreate(
                nombre="Carlos",
                apellido="Gómez",
                cedula="3-456-789",
                nacionalidad="Panamá",
                pais="Panamá",
                fecha_nacimiento="1980-01-01",
                porcentaje_participacion=60,
                es_pep=False,
            ),
            BeneficiarioFinalCreate(
                nombre="Ana",
                apellido="Ruiz",
                cedula="4-567-890",
                nacionalidad="Panamá",
                pais="Panamá",
                fecha_nacimiento="1985-05-10",
                porcentaje_participacion=40,
                es_pep=False,
            ),
        ],
        enviar_a_revision=False,
    )


class TestClienteSummaryEmbebido:
    def test_get_caso_incluye_cliente_natural(
        self, client: TestClient, db: Session
    ) -> None:
        """GET /casos-ddr/{id} debe incluir el resumen del cliente con
        nombres, apellidos y número de identificación para una persona
        natural. Sin este campo la UI muestra el UUID del expediente."""
        analista = _create_analista(db)
        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        exp = crud.create_expediente(
            session=db,
            expediente_in=_make_expediente_data(),
            analista_id=analista.id,
        )
        # Disparar la creación del caso DDR (lo hace el endpoint al
        # consultar la API de evaluación de riesgo del expediente).
        # Aquí creamos un caso DDR directamente en BD para simplificar.
        caso_id = uuid.uuid4()
        from app.models import EstadoCasoDDR

        caso = CasoDDR(
            id=caso_id,
            expediente_id=exp.id,
            nivel_riesgo="ALTO",
            status=EstadoCasoDDR.ABIERTO.value,
            analista_id=analista.id,
        )
        db.add(caso)
        db.commit()
        db.refresh(caso)

        r = client.get(f"{settings.API_V1_STR}/casos-ddr/{caso_id}", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "cliente" in body and body["cliente"] is not None
        cli = body["cliente"]
        assert cli["id"] == str(exp.id)
        assert cli["tipo_cliente"] == "NATURAL"
        assert cli["nombres"] == "Juan"
        assert cli["apellidos"] == "Pérez"
        assert "CEDULA" in cli["tipo_identificacion"]
        assert "1-123-456" in cli["numero_identificacion"]
        assert cli["estado"] == exp.status

    def test_get_caso_incluye_cliente_juridica_con_ruc(
        self, client: TestClient, db: Session
    ) -> None:
        """Para JURIDICA, nombres = razón social y la identificación
        incluye el prefijo RUC."""
        analista = _create_analista(db)
        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        exp = crud.create_expediente(
            session=db,
            expediente_in=_expediente_juridica(),
            analista_id=analista.id,
        )
        caso_id = uuid.uuid4()
        from app.models import EstadoCasoDDR

        caso = CasoDDR(
            id=caso_id,
            expediente_id=exp.id,
            nivel_riesgo="MEDIO",
            status=EstadoCasoDDR.ABIERTO.value,
            analista_id=analista.id,
        )
        db.add(caso)
        db.commit()
        db.refresh(caso)

        r = client.get(f"{settings.API_V1_STR}/casos-ddr/{caso_id}", headers=headers)
        assert r.status_code == 200, r.text
        cli = r.json()["cliente"]
        assert cli is not None
        assert cli["tipo_cliente"] == "JURIDICA"
        assert cli["nombres"] == "Acme S.A."
        assert cli["apellidos"] == ""
        assert "RUC" in cli["numero_identificacion"]
        assert "1234567-1-234567" in cli["numero_identificacion"]

    def test_get_casos_lista_incluye_cliente_para_cada_caso(
        self, client: TestClient, db: Session
    ) -> None:
        """El listado también debe incluir el resumen del cliente en cada
        caso, para que la tabla pueda mostrar el nombre sin joins extra
        en el cliente."""
        analista = _create_analista(db)
        headers = user_authentication_headers(
            client=client, email=analista.email, password=TEST_PASSWORD
        )
        from app.models import EstadoCasoDDR

        exp1 = crud.create_expediente(
            session=db,
            expediente_in=_make_expediente_data(),
            analista_id=analista.id,
        )
        caso1 = CasoDDR(
            id=uuid.uuid4(),
            expediente_id=exp1.id,
            nivel_riesgo="ALTO",
            status=EstadoCasoDDR.ABIERTO.value,
            analista_id=analista.id,
        )
        db.add(caso1)
        db.commit()

        r = client.get(f"{settings.API_V1_STR}/casos-ddr/", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert len(data) >= 1
        # Encontrar el caso que acabamos de crear.
        mine = next((c for c in data if c["id"] == str(caso1.id)), None)
        assert mine is not None, f"Caso {caso1.id} no apareció en el listado"
        assert mine["cliente"] is not None
        assert mine["cliente"]["nombres"] == "Juan"

    def test_gerente_puede_ver_caso_y_cliente_sin_acceso_kyc(
        self, client: TestClient, db: Session
    ) -> None:
        """Sanity check: un GERENTE_CUMPLIMIENTO (que NO tiene AccesoKYC
        al endpoint /clientes/{id}) puede ver el cliente embebido en el
        caso DDR. Esto era la raíz del bug original: la UI mostraba el
        UUID del expediente porque el fetch a /clientes/{id} devolvía
        403 para estos roles."""
        analista = _create_analista(db)
        exp = crud.create_expediente(
            session=db,
            expediente_in=_make_expediente_data(),
            analista_id=analista.id,
        )
        from app.models import EstadoCasoDDR

        caso = CasoDDR(
            id=uuid.uuid4(),
            expediente_id=exp.id,
            nivel_riesgo="ALTO",  # para que un GERENTE lo vea
            status=EstadoCasoDDR.EN_APROBACION.value,
            analista_id=analista.id,
        )
        db.add(caso)
        db.commit()
        db.refresh(caso)

        gerente = _create_gerente(db)
        headers = user_authentication_headers(
            client=client, email=gerente.email, password=TEST_PASSWORD
        )
        r = client.get(f"{settings.API_V1_STR}/casos-ddr/{caso.id}", headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["cliente"] is not None
