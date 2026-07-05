# AGENTS.md - Guía para agentes de desarrollo

## Proyecto
Sistema de Debida Diligencia Reforzada (DDR) para cumplimiento normativo panameño.
- **Stack:** FastAPI + SQLModel + PostgreSQL + Alembic
- **Frontend:** React + Vite (separado en `/frontend`)

## Comandos esenciales

### Desarrollo
```bash
# Levantar todo (Docker)
docker compose watch

# URLs locales
# Backend:  http://localhost:8000
# Frontend: http://localhost:5173
# Swagger:  http://localhost:8000/docs
# Adminer:  http://localhost:8080
```

### Dentro del contenedor backend
```bash
docker compose exec backend bash
```

### Lint y formato
```bash
cd backend
ruff check app          # Lint
ruff format app         # Formatear
ruff check app --fix    # Auto-fix
```

### Typecheck
```bash
cd backend
mypy app
ty check app
```

### Tests
```bash
cd backend
coverage run -m pytest tests/
coverage report
```

## Arquitectura del backend

### Estructura
```
backend/app/
├── main.py              # Entry point FastAPI
├── models.py            # Modelos SQLModel (tablas + schemas Pydantic)
├── crud.py              # Operaciones CRUD con BD
├── kyc_risk.py          # Motor de cálculo de riesgo KYC
├── utils.py             # Utilidades generales
├── core/
│   ├── config.py        # Settings (pydantic-settings)
│   ├── db.py            # Engine y session de SQLAlchemy
│   └── security.py      # JWT, hashing de passwords
├── api/
│   ├── main.py          # Router principal (api_router)
│   ├── deps.py          # Dependencias (SessionDep, CurrentUser, require_roles)
│   └── routes/          # Endpoints por dominio
│       ├── login.py
│       ├── users.py
│       ├── items.py
│       ├── utils.py
│       └── clientes.py  # Endpoints KYC
└── alembic/             # Migraciones
    ├── env.py
    └── versions/
```

### Convenciones de modelos (models.py)
- Modelos DB usan `table=True` y heredan de `SQLModel`
- Schemas de respuesta: `ModelNamePublic` (ej: `UserPublic`)
- Schemas de lista: `ModelNamesPublic` con `data: list` + `count: int`
- UUIDs como PKs con `default_factory=uuid.uuid4`
- Fechas con `sa_type=DateTime(timezone=True)` y helper `get_datetime_utc()`
- Enums como `str, Enum` guardados como VARCHAR en BD

### Convenciones de endpoints
- Router tags definen el grupo en Swagger
- Usar `SessionDep` para inyectar sesión
- Usar `CurrentUser` para usuario autenticado
- `require_roles()` para control de acceso por rol
- El superusuario (ADMIN) siempre pasa el check de roles

### Modelos KYC existentes
- `ExpedienteKYC` - Expediente principal del cliente
- `PersonaNatural` - Datos de persona física
- `PersonaJuridica` - Datos de empresa
- `BeneficiarioFinal` - Beneficiarios de empresa (deben sumar 100%)
- `DocumentoKYC` - Documentos subidos

### Migraciones Alembic
```bash
cd backend
alembic revision --autogenerate -m "descripción"
alembic upgrade head
```

## Dependencias Dev 3
Algunas funcionalidades dependen de tablas que crea Dev 3:
- `PepSimulado` y `ListaRestrictivaSimulada` → Consultar en `kyc_verificaciones.py`
- `registrar_auditoria()` → Helper de auditoría

Mientras tanto, usar stubs o prints para no bloquear el desarrollo.

## Estilo de código
- Python 3.10+
- Ruff para lint y formato
- Sin comentarios a menos que se soliciten
- Código simple, funcional, fácil de mantener
- No sobreingeniarizar

## Flujo DDR — cuatro ojos (actualizado)
El flujo de casos DDR aplica segregación de funciones. Ver detalle en
`docs/FLUJO_DDR.md`. Reglas duras que el backend valida:
- El caso DDR nace **sin analista** (`crud.create_expediente`).
- El Oficial no puede asignar al analista que registró el expediente (409).
- Solo el analista asignado puede enviar el caso a revisión.
- El envío va a `EN_REVISION_OFICIAL`; el Oficial `POST /validar` (escala) o
  `POST /devolver` (regresa a `EN_REVISION` con `observaciones_oficial`).
- Gerente aprueba casos ALTO; Comité aprueba MUY_ALTO.

## Reglas de trabajo para agentes (IMPORTANTES)
- **Commits en español, sin `Co-Authored-By` ni menciones de IA/herramientas.**
- El frontend en Docker es un **build estático de Nginx**: cada cambio requiere
  `docker compose build frontend && docker compose up -d frontend`. No hay HMR.
- **NUNCA correr el suite completo de tests contra la BD viva del contenedor**:
  los tests de users borran la tabla `user` (incluidos los usuarios demo).
  Correr solo los módulos afectados, o restaurar con:
  `docker compose exec backend python -c "from app.core.db import engine, init_db; from sqlmodel import Session; init_db(Session(engine))"`
- Los tests no están en la imagen backend; copiarlos antes de correr:
  `docker cp backend/tests debida-diligencia-reforzada-backend-1:/app/backend/`

## Usuarios demo (contraseñas en `backend/app/core/db.py`)
| Correo | Rol |
|---|---|
| admin@sgddr.pa | ADMIN |
| rosa@sgddr.pa | OFICIAL_CUMPLIMIENTO |
| carlos@sgddr.pa | ANALISTA_DDR |
| maria@sgddr.pa | ANALISTA_DDR |
| luis@sgddr.pa | GERENTE_CUMPLIMIENTO |
| comite@sgddr.pa | COMITE_CUMPLIMIENTO |
| ana@sgddr.pa | AUDITOR |
