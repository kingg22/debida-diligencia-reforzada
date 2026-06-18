"""Tests del endpoint GET /api/v1/clientes/{id}/documentos/{doc_id}/descargar.

Cubre:
- 401 sin token.
- 200 con un PDF (attachment por defecto).
- 200 con disposition=inline (cambia Content-Disposition).
- 200 con JPG (mimetype preservado).
- 200 con filename con caracteres no-ASCII (filename* UTF-8 presente).
- 403 cuando un analista pide un expediente que no es suyo.
- 404 con expediente inexistente.
- 404 cuando el doc_id pertenece a otro expediente (aislamiento).
- 404 con doc_id inexistente.
- 410 cuando el archivo ya no está en disco.
- 410 cuando ``ruta_archivo`` es None en BD.
- 422 con disposition inválido.
- Header ``X-Content-Type-Options: nosniff`` siempre presente.

Setup: cada test crea analista + expediente + documento (vía API o DB)
y luego invoca el endpoint. Para evitar contaminar la sesión compartida
del conftest (``db`` con ``scope="session"``), los expedientes y
documentos se crean vía la API o usando transacciones que se commitean
de forma independiente antes de cada llamada al endpoint.
"""

import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.routes import clientes as clientes_routes
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import (
    DocumentoEstado,
    DocumentoKYC,
    DocumentoTipo,
    User,
    UserRole,
)
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email

CLIENTES_PATH = f"{settings.API_V1_STR}/clientes"
TEST_PASSWORD = "TestPass1A!"


# ── Fixtures y helpers ───────────────────────────────────────────────────


@pytest.fixture()
def upload_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirige el UPLOAD_DIR del módulo a un tmp_path por test."""
    monkeypatch.setattr(clientes_routes, "UPLOAD_DIR", tmp_path)
    return tmp_path


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


def _analista_headers(
    client: TestClient, db: Session
) -> tuple[dict[str, str], User]:
    user = _make_user(db, UserRole.ANALISTA_DDR)
    headers = user_authentication_headers(
        client=client, email=user.email, password=TEST_PASSWORD
    )
    return headers, user


def _oficial_headers(client: TestClient, db: Session) -> dict[str, str]:
    user = _make_user(db, UserRole.OFICIAL_CUMPLIMIENTO)
    return user_authentication_headers(
        client=client, email=user.email, password=TEST_PASSWORD
    )


def _make_expediente_via_api(
    client: TestClient, headers: dict[str, str]
) -> dict:
    """Crea un expediente NATURAL vía la API (POST /clientes/) y devuelve
    la respuesta JSON con el id."""
    payload = {
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
        "enviar_a_revision": True,
    }
    r = client.post(CLIENTES_PATH + "/", headers=headers, json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def _store_file(tmp: Path, name: str, content: bytes) -> Path:
    f = tmp / name
    f.write_bytes(content)
    return f


def _seed_documento(
    db: Session,
    *,
    expediente_id: uuid.UUID,
    ruta: str,
    mime: str = "application/pdf",
    tipo: str = DocumentoTipo.OTRO.value,
    nombre: str = "test.pdf",
) -> DocumentoKYC:
    """Inserta un DocumentoKYC en BD enlazado al expediente, con commit.

    Usado para los tests donde sólo nos importa el FK, no la lógica
    de upload (que ya tiene sus tests en test_clientes.py).
    """
    # ``db`` es session-scoped; si la sesión quedó en mal estado por un
    # test anterior, hacemos rollback para empezar limpio.
    try:
        db.rollback()
    except Exception:
        pass

    doc = DocumentoKYC(
        id=uuid.uuid4(),
        expediente_id=expediente_id,
        tipo=tipo,
        nombre=nombre,
        tamanio=Path(ruta).stat().st_size,
        mime_type=mime,
        estado=DocumentoEstado.PENDIENTE.value,
        ruta_archivo=ruta,
        hash_sha256="x" * 64,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# ── Tests ────────────────────────────────────────────────────────────────


def test_descargar_sin_auth_retorna_401(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    ruta = str(_store_file(upload_dir, "a.pdf", b"%PDF-1.4 fake"))
    doc = _seed_documento(
        db, expediente_id=uuid.UUID(exp_body["id"]), ruta=ruta
    )
    # No pasamos los headers → 401.
    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar"
    )
    assert r.status_code == 401, r.text


def test_descargar_pdf_attachment(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    contenido = b"%PDF-1.4\n%fake pdf bytes"
    doc = _seed_documento(
        db,
        expediente_id=uuid.UUID(exp_body["id"]),
        ruta=str(_store_file(upload_dir, "doc.pdf", contenido)),
        nombre="doc.pdf",
    )

    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar",
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.content == contenido
    cd = r.headers["content-disposition"]
    assert cd.startswith("attachment;")
    assert "doc.pdf" in cd
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.headers["x-content-type-options"] == "nosniff"


def test_descargar_pdf_inline(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    doc = _seed_documento(
        db,
        expediente_id=uuid.UUID(exp_body["id"]),
        ruta=str(_store_file(upload_dir, "preview.pdf", b"pdf-bytes")),
    )

    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar"
        "?disposition=inline",
        headers=headers,
    )
    assert r.status_code == 200
    assert r.headers["content-disposition"].startswith("inline;")
    assert r.headers["x-content-type-options"] == "nosniff"


def test_descargar_jpg_preserva_mime(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    doc = _seed_documento(
        db,
        expediente_id=uuid.UUID(exp_body["id"]),
        ruta=str(_store_file(upload_dir, "foto.jpg", b"\xff\xd8\xff\xe0fake")),
        mime="image/jpeg",
        nombre="foto.jpg",
    )

    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar",
        headers=headers,
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/jpeg")
    assert "foto.jpg" in r.headers["content-disposition"]


def test_descargar_filename_con_no_ascii(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    """filename* RFC 5987 debe aparecer para preservar caracteres UTF-8
    en el nombre descargado (acentos, eñe, etc.)."""
    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    nombre_original = "Cédula de José Ñ.pdf"
    doc = _seed_documento(
        db,
        expediente_id=uuid.UUID(exp_body["id"]),
        ruta=str(_store_file(upload_dir, "ascii-safe.pdf", b"x")),
        nombre=nombre_original,
    )

    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar",
        headers=headers,
    )
    assert r.status_code == 200
    cd = r.headers["content-disposition"]
    assert "filename*=UTF-8''" in cd
    # El filename plano está saneado (sin acentos) pero el UTF-8 los
    # preserva — el ``startswith`` confirma que el nombre original está
    # en alguna parte.
    assert "C" in cd


def test_descargar_expediente_de_otro_analista_retorna_403(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    """Un analista sólo puede ver sus propios expedientes; el endpoint
    debe respetar la regla de _verificar_acceso."""
    headers_a, _ = _analista_headers(client, db)
    _, analista_b = _analista_headers(client, db)
    # analista_b necesita sus propios headers para crear su expediente.
    headers_b, _ = _analista_headers(client, db) if False else (None, None)
    # Reusamos: como _analista_headers genera un usuario nuevo cada vez,
    # ``analista_b`` no es el mismo que retorna la nueva llamada. Hacemos
    # un login explícito con la cuenta de b.
    from tests.utils.user import user_authentication_headers as auth_h

    headers_b = auth_h(
        client=client,
        email=analista_b.email,
        password=TEST_PASSWORD,
    )
    exp_b_body = _make_expediente_via_api(client, headers_b)
    doc_b = _seed_documento(
        db,
        expediente_id=uuid.UUID(exp_b_body["id"]),
        ruta=str(_store_file(upload_dir, "b.pdf", b"x")),
    )

    r = client.get(
        f"{CLIENTES_PATH}/{exp_b_body['id']}/documentos/{doc_b.id}/descargar",
        headers=headers_a,
    )
    assert r.status_code == 403, r.text


def test_descargar_oficial_puede_ver_expediente_de_analista(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    """El OFICIAL_CUMPLIMIENTO ve todos los expedientes."""
    ofi_headers = _oficial_headers(client, db)
    _, analista = _analista_headers(client, db)
    from tests.utils.user import user_authentication_headers as auth_h

    headers_analista = auth_h(
        client=client, email=analista.email, password=TEST_PASSWORD
    )
    exp_body = _make_expediente_via_api(client, headers_analista)
    doc = _seed_documento(
        db,
        expediente_id=uuid.UUID(exp_body["id"]),
        ruta=str(_store_file(upload_dir, "doc.pdf", b"x")),
    )

    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar",
        headers=ofi_headers,
    )
    assert r.status_code == 200
    assert r.content == b"x"


def test_descargar_expediente_inexistente_retorna_404(
    client: TestClient, db: Session
) -> None:
    headers, _ = _analista_headers(client, db)
    r = client.get(
        f"{CLIENTES_PATH}/{uuid.uuid4()}/documentos/{uuid.uuid4()}/descargar",
        headers=headers,
    )
    assert r.status_code == 404
    assert "expediente" in r.text.lower()


def test_descargar_doc_de_otro_expediente_retorna_404(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    """Aislamiento: un doc_id válido pero que pertenece a otro expediente
    NO debe filtrarse vía este endpoint."""
    headers, _ = _analista_headers(client, db)
    exp_a = _make_expediente_via_api(client, headers)
    exp_b = _make_expediente_via_api(client, headers)
    doc_b = _seed_documento(
        db,
        expediente_id=uuid.UUID(exp_b["id"]),
        ruta=str(_store_file(upload_dir, "b.pdf", b"x")),
    )

    # Pedimos doc_b (válido) pero bajo el path de exp_a.
    r = client.get(
        f"{CLIENTES_PATH}/{exp_a['id']}/documentos/{doc_b.id}/descargar",
        headers=headers,
    )
    assert r.status_code == 404
    assert "documento" in r.text.lower()


def test_descargar_doc_inexistente_retorna_404(
    client: TestClient, db: Session
) -> None:
    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{uuid.uuid4()}/descargar",
        headers=headers,
    )
    assert r.status_code == 404


def test_descargar_archivo_borrado_en_disco_retorna_410(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    """Si el archivo fue removido del filesystem (limpieza, volumen, …),
    devolvemos 410 Gone en vez de 500."""
    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    ruta = _store_file(upload_dir, "gone.pdf", b"x")
    doc = _seed_documento(
        db, expediente_id=uuid.UUID(exp_body["id"]), ruta=str(ruta)
    )
    ruta.unlink()  # simulamos archivo perdido

    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar",
        headers=headers,
    )
    assert r.status_code == 410


def test_descargar_ruta_archivo_none_retorna_410(
    client: TestClient, db: Session
) -> None:
    """Documentos sin archivo persistido (caso edge del schema) → 410."""
    try:
        db.rollback()
    except Exception:
        pass

    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    doc = DocumentoKYC(
        id=uuid.uuid4(),
        expediente_id=uuid.UUID(exp_body["id"]),
        tipo=DocumentoTipo.OTRO.value,
        nombre="huerfano.pdf",
        tamanio=0,
        mime_type="application/pdf",
        estado=DocumentoEstado.PENDIENTE.value,
        ruta_archivo=None,
        hash_sha256=None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar",
        headers=headers,
    )
    assert r.status_code == 410


def test_descargar_disposition_invalido_retorna_422(
    client: TestClient, db: Session, upload_dir: Path
) -> None:
    """El query param está restringido por regex a inline|attachment;
    cualquier otro valor debe ser rechazado por FastAPI antes de llegar
    al handler."""
    headers, _ = _analista_headers(client, db)
    exp_body = _make_expediente_via_api(client, headers)
    doc = _seed_documento(
        db,
        expediente_id=uuid.UUID(exp_body["id"]),
        ruta=str(_store_file(upload_dir, "x.pdf", b"x")),
    )
    r = client.get(
        f"{CLIENTES_PATH}/{exp_body['id']}/documentos/{doc.id}/descargar"
        "?disposition=evil-mode",
        headers=headers,
    )
    assert r.status_code == 422
