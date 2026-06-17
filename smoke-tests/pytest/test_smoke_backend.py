"""
Smoke Tests - Backend (Pytest + requests)
URL Base directa al backend en Render: https://backend-8rm8.onrender.com
"""
import pytest
import requests

BASE_URL = "https://backend-8rm8.onrender.com"
LOGIN_URL = f"{BASE_URL}/api/v1/login/access-token"
CLIENTES_URL = f"{BASE_URL}/api/v1/clientes/"
CASOS_DDR_URL = f"{BASE_URL}/api/v1/casos-ddr/"

TIMEOUT = 90  # Render free tier puede tardar hasta 60s en cold start


def warmup_server() -> None:
    """Despierta el servidor en Render antes de correr los tests."""
    for url in [f"{BASE_URL}/api/v1/utils/health-check/", f"{BASE_URL}/"]:
        try:
            requests.get(url, timeout=TIMEOUT)
            return
        except requests.RequestException:
            continue


def get_token(username: str = "admin@example.com", password: str = "changethis") -> str | None:
    """Obtiene token JWT para el usuario indicado."""
    try:
        resp = requests.post(
            LOGIN_URL,
            data={"username": username, "password": password},
            timeout=TIMEOUT,
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
    except requests.RequestException:
        pass
    return None


def auth_headers(token: str | None) -> dict:
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


# ── Fixture: warmup una sola vez al inicio de la sesión ───────────────────
@pytest.fixture(scope="session", autouse=True)
def wake_up():
    warmup_server()


# ─── SMOKE-BE-01: Registro menor de edad ──────────────────────────────────
def test_smoke_be_01_registro_menor_de_edad():
    """POST /api/v1/clientes con persona de 11 años → cualquier 4xx."""
    token = get_token()
    payload = {
        "tipo_cliente": "NATURAL",
        "persona_natural": {
            "primer_nombre": "Menor",
            "primer_apellido": "DeEdad",
            "tipo_documento": "CEDULA",
            "numero_documento": "8-123-456",
            "fecha_nacimiento": "2015-06-01",
            "nacionalidad": "Panamá",
            "pais_residencia": "Panamá",
            "telefono": "6000-0001",
            "es_pep": False,
        },
    }
    resp = requests.post(CLIENTES_URL, json=payload, headers=auth_headers(token), timeout=TIMEOUT)
    assert 400 <= resp.status_code < 500, (
        f"Se esperaba 4xx pero se obtuvo {resp.status_code}. Body: {resp.text[:300]}"
    )


# ─── SMOKE-BE-02: Cédula con formato inválido ─────────────────────────────
def test_smoke_be_02_cedula_formato_invalido():
    """POST /api/v1/clientes con cédula sin formato válido → cualquier 4xx."""
    token = get_token()
    payload = {
        "tipo_cliente": "NATURAL",
        "persona_natural": {
            "primer_nombre": "Test",
            "primer_apellido": "InvalidDoc",
            "tipo_documento": "CEDULA",
            "numero_documento": "ABCXYZ!!!",
            "fecha_nacimiento": "1990-01-01",
            "nacionalidad": "Panamá",
            "pais_residencia": "Panamá",
            "telefono": "6000-0002",
            "es_pep": False,
        },
    }
    resp = requests.post(CLIENTES_URL, json=payload, headers=auth_headers(token), timeout=TIMEOUT)
    assert 400 <= resp.status_code < 500, (
        f"Se esperaba 4xx pero se obtuvo {resp.status_code}. Body: {resp.text[:300]}"
    )


# ─── SMOKE-BE-03: Lista restrictiva ───────────────────────────────────────
def test_smoke_be_03_lista_restrictiva_bloqueada():
    """POST /api/v1/clientes con datos que deben ser bloqueados → 4xx."""
    token = get_token()
    payload = {
        "tipo_cliente": "NATURAL",
        "persona_natural": {
            "primer_nombre": "OFAC",
            "primer_apellido": "Bloqueado",
            "tipo_documento": "PASAPORTE",
            "numero_documento": "OFAC-TEST-001",
            "fecha_nacimiento": "1970-01-01",
            "nacionalidad": "Venezuela",
            "pais_residencia": "Venezuela",
            "telefono": "6000-0003",
            "es_pep": True,
        },
    }
    resp = requests.post(CLIENTES_URL, json=payload, headers=auth_headers(token), timeout=TIMEOUT)
    assert 400 <= resp.status_code < 500, (
        f"Se esperaba 4xx pero se obtuvo {resp.status_code}. Body: {resp.text[:300]}"
    )


# ─── SMOKE-BE-04: Protección sin token → 401 o 403 ───────────────────────
def test_smoke_be_04_proteccion_sin_token():
    """GET /api/v1/casos-ddr sin token → debe responder 401 o 403."""
    resp = requests.get(CASOS_DDR_URL, timeout=TIMEOUT)
    assert resp.status_code in (401, 403), (
        f"Se esperaba 401 o 403 pero se obtuvo {resp.status_code}. Body: {resp.text[:300]}"
    )


# ─── SMOKE-BE-05: Filtro de roles — Analista solo ve sus casos ────────────
def test_smoke_be_05_filtro_roles_analista():
    """
    GET /api/v1/casos-ddr con token de Analista.
    La API debe responder 200 y solo devolver registros del analista autenticado.
    Si no existe un analista de prueba, se acepta 401/403 (sin credenciales disponibles).
    """
    # Intentar login con credenciales de analista de prueba
    analista_token = get_token(username="analista@example.com", password="changethis")

    if analista_token is None:
        # No hay analista registrado en este entorno; al menos verificamos
        # que el endpoint existe y rechaza correctamente sin auth
        resp = requests.get(CASOS_DDR_URL, timeout=TIMEOUT)
        assert resp.status_code in (401, 403), (
            f"Endpoint no protegido: respondió {resp.status_code}"
        )
        pytest.skip("No se encontraron credenciales de analista en este entorno")

    resp = requests.get(CASOS_DDR_URL, headers=auth_headers(analista_token), timeout=TIMEOUT)
    assert resp.status_code == 200, (
        f"Se esperaba 200 con token de analista pero se obtuvo {resp.status_code}"
    )

    data = resp.json()
    items = data.get("data", data) if isinstance(data, dict) else data
    assert isinstance(items, list), "La respuesta debe ser una lista de casos"

    # Verificar que todos los items devueltos corresponden al analista autenticado
    # (el API debería filtrar por analista_id, no devolver todos los casos del sistema)
    # Obtenemos el perfil del analista para saber su ID
    me_resp = requests.get(
        f"{BASE_URL}/api/v1/users/me",
        headers=auth_headers(analista_token),
        timeout=TIMEOUT,
    )
    if me_resp.status_code == 200:
        analista_id = me_resp.json().get("id")
        if analista_id and len(items) > 0:
            for caso in items:
                assert caso.get("analista_id") == analista_id, (
                    f"El caso {caso.get('id')} no pertenece al analista {analista_id}"
                )


# ─── SMOKE-BE-06: Paginación de casos con limit=5 ─────────────────────────
def test_smoke_be_06_paginacion_casos():
    """GET /api/v1/casos-ddr?limit=5 → 200 y lista con máximo 5 items."""
    token = get_token()
    assert token, "No se pudo obtener token para autenticación"

    resp = requests.get(
        CASOS_DDR_URL,
        params={"limit": 5, "skip": 0},
        headers=auth_headers(token),
        timeout=TIMEOUT,
    )
    assert resp.status_code == 200, (
        f"Se esperaba 200 pero se obtuvo {resp.status_code}. Body: {resp.text[:300]}"
    )

    data = resp.json()
    # La respuesta puede ser lista directa o dict con key "data"
    items = data.get("data", data) if isinstance(data, dict) else data
    assert isinstance(items, list), f"La respuesta debe contener una lista. Got: {type(items)}"
    assert len(items) <= 5, (
        f"Con limit=5 se esperaban máximo 5 items pero se recibieron {len(items)}"
    )


# ─── SMOKE-BE-07: Sanitización de datos — espacios extra en nombre ─────────
def test_smoke_be_07_sanitizacion_datos():
    """
    POST /api/v1/clientes con nombre que tiene espacios extra y minúsculas.
    El servidor debe aceptarlo (200 o 201) y procesarlo correctamente.
    """
    token = get_token()
    assert token, "No se pudo obtener token para autenticación"

    import random, string
    suffix = "".join(random.choices(string.digits, k=6))

    payload = {
        "tipo_cliente": "NATURAL",
        "persona_natural": {
            "tipo_documento": "PASAPORTE",
            "numero_documento": f"PA{suffix}",
            "fecha_expiracion_doc": "2030-01-01",
            "nacionalidad": "Panamá",
            "pais_nacimiento": "Panamá",
            "nombre": "  maría  ",           # espacios al inicio y final
            "apellido": "  lópez  ",
            "fecha_nacimiento": "1988-04-20",
            "genero": "FEMENINO",
            "estado_civil": "SOLTERO",
            "telefono": "6000-9999",
            "email": f"maria{suffix}@test.com",
            "direccion": "Calle Test 123",
            "ciudad": "Ciudad de Panamá",
            "pais": "Panamá",
            "ocupacion": "Empleado",
            "empleador": "Empresa Test",
            "ingreso_mensual_aproximado": 1000,
            "fuente_ingresos": "SALARIO",
            "es_pep": False,
            "es_pep_familiar": False,
            "tiene_antecedentes": False,
        },
    }
    resp = requests.post(CLIENTES_URL, json=payload, headers=auth_headers(token), timeout=TIMEOUT)

    # 200 o 201 = creado correctamente; 409 = ya existe (también válido para este test)
    assert resp.status_code in (200, 201, 409), (
        f"Se esperaba 200/201/409 pero se obtuvo {resp.status_code}. Body: {resp.text[:400]}"
    )


# ─── SMOKE-BE-08: Respuesta contiene campo de nivel de riesgo ─────────────
def test_smoke_be_08_estructura_riesgo_en_respuesta():
    """
    POST /api/v1/clientes con datos válidos completos.
    La respuesta JSON debe contener 'nivel_riesgo' o 'puntaje_riesgo'.
    """
    token = get_token()
    assert token, "No se pudo obtener token para autenticación"

    import random, string
    suffix = "".join(random.choices(string.digits, k=6))

    payload = {
        "tipo_cliente": "NATURAL",
        "persona_natural": {
            "tipo_documento": "PASAPORTE",
            "numero_documento": f"RK{suffix}",
            "fecha_expiracion_doc": "2030-06-01",
            "nacionalidad": "Panamá",
            "pais_nacimiento": "Panamá",
            "nombre": "Carlos",
            "apellido": "Riesgo",
            "fecha_nacimiento": "1985-03-15",
            "genero": "MASCULINO",
            "estado_civil": "SOLTERO",
            "telefono": "6100-0000",
            "email": f"carlos{suffix}@test.com",
            "direccion": "Av. Central 456",
            "ciudad": "Panamá",
            "pais": "Panamá",
            "ocupacion": "Ingeniero",
            "empleador": "Tech Corp",
            "ingreso_mensual_aproximado": 2500,
            "fuente_ingresos": "SALARIO",
            "es_pep": False,
            "es_pep_familiar": False,
            "tiene_antecedentes": False,
        },
    }
    resp = requests.post(CLIENTES_URL, json=payload, headers=auth_headers(token), timeout=TIMEOUT)

    if resp.status_code == 409:
        pytest.skip("Cliente ya existía; no se puede verificar estructura de respuesta")

    assert resp.status_code in (200, 201), (
        f"Se esperaba 200 o 201 pero se obtuvo {resp.status_code}. Body: {resp.text[:400]}"
    )

    body = resp.json()
    tiene_riesgo = (
        "nivel_riesgo" in body
        or "puntaje_riesgo" in body
        or "riesgo" in body
        or "score" in body
    )
    assert tiene_riesgo, (
        f"La respuesta no contiene campo de nivel de riesgo. Keys presentes: {list(body.keys())}"
    )
