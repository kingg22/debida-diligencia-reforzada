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
