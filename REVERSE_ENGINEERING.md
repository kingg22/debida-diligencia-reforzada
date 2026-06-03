# Reverse Engineering - PanamaCompliance SGDDR

## Sistema de Gestión de Debida Diligencia Reforzada

---

## 1. Información General

| Campo | Valor |
|-------|-------|
| **Nombre** | PanamaCompliance SGDDR |
| **Descripción** | Sistema de Gestión de Debida Diligencia Reforzada |
| **Regulación** | Ley 23/2015 y Ley 254/2021 |
| **Versión** | 1.0 |
| **Repositorio** | `/home/xhenno/dev/SIX/debida-diligencia-reforzada` |

---

## 2. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRAEFIK (Proxy)                          │
├─────────────────────┬─────────────────────┬─────────────────────┤
│  api.{DOMAIN}       │  dashboard.{DOMAIN} │  adminer.{DOMAIN}   │
│  (Backend:8000)     │  (Frontend:80)      │  (Adminer:8080)     │
└─────────────────────┴─────────────────────┴─────────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  FastAPI        │   │  React + Vite   │   │  Adminer        │
│  Python 3.10+   │   │  TypeScript     │   │  DB Manager     │
└─────────────────┘   └─────────────────┘   └─────────────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL 18  │
└─────────────────┘
```

---

## 3. Stack Tecnológico

### Backend

| Componente | Tecnología | Versión |
|------------|------------|---------|
| **Framework** | FastAPI | 0.114.2+ |
| **Lenguaje** | Python | 3.10+ |
| **ORM** | SQLModel | 0.0.21+ |
| **Base de Datos** | PostgreSQL | 18 |
| **Migraciones** | Alembic | 1.12.1+ |
| **Validación** | Pydantic | 2.0+ |
| **Autenticación** | JWT (PyJWT) | 2.8.0+ |
| **Passwords** | pwdlib (Argon2/Bcrypt) | 0.3.0+ |
| **HTTP Client** | httpx | 0.25.1+ |
| **Email** | emails | 0.6+ |
| **Templates** | Jinja2 | 3.1.4+ |
| **Monitoreo** | Sentry SDK | 2.0.0+ |
| **Configuración** | pydantic-settings | 2.2.1+ |

### Frontend

| Componente | Tecnología | Versión |
|------------|------------|---------|
| **Framework** | React | 19.1.1 |
| **Lenguaje** | TypeScript | 5.9.3 |
| **Bundler** | Vite | 7.3.0 |
| **Router** | TanStack Router | 1.163.3 |
| **State** | TanStack Query | 5.90.21 |
| **Tables** | TanStack Table | 8.21.3 |
| **UI Components** | Radix UI | - |
| **Estilos** | Tailwind CSS | 4.2.1 |
| **Forms** | React Hook Form | 7.68.0 |
| **Validation** | Zod | 4.3.6 |
| **HTTP Client** | Axios | 1.13.5 |
| **Icons** | Lucide React | 0.563.0 |
| **Linting** | Biome | 2.3.14 |
| **Testing** | Playwright | 1.58.2 |

### Infraestructura

| Componente | Tecnología |
|------------|------------|
| **Containerización** | Docker + Docker Compose |
| **Reverse Proxy** | Traefik |
| **Base de Datos** | PostgreSQL 18 |
| **SSL/TLS** | Let's Encrypt (via Traefik) |

---

## 4. Estructura del Proyecto

```
debida-diligencia-reforzada/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # Punto de entrada FastAPI
│   │   ├── models.py                  # Modelos de BD (SQLModel)
│   │   ├── crud.py                    # Operaciones CRUD
│   │   ├── utils.py                   # Utilidades
│   │   ├── initial_data.py            # Datos iniciales
│   │   ├── backend_pre_start.py       # Pre-start checks
│   │   ├── tests_pre_start.py         # Tests pre-start
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── main.py                # Router principal API
│   │   │   ├── deps.py                # Dependencias (sesión, usuario actual)
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── login.py           # Endpoints autenticación
│   │   │       ├── users.py           # CRUD usuarios
│   │   │       ├── items.py           # CRUD items
│   │   │       ├── utils.py           # Utilidades API
│   │   │       └── private.py         # Endpoints privados (local)
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py              # Configuración (Settings)
│   │   │   ├── db.py                  # Conexión BD
│   │   │   └── security.py            # JWT, hashing passwords
│   │   ├── alembic/                   # Migraciones BD
│   │   └── email-templates/           # Templates email
│   ├── tests/                         # Tests unitarios
│   ├── scripts/                       # Scripts auxiliares
│   ├── alembic.ini                    # Config Alembic
│   ├── pyproject.toml                 # Config Python/proyecto
│   ├── Dockerfile                     # Docker backend
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── main.tsx                   # Punto de entrada React
│   │   ├── index.css                  # Estilos globales
│   │   ├── utils.ts                   # Utilidades globales
│   │   ├── vite-env.d.ts             # Tipos Vite
│   │   ├── routeTree.gen.ts          # Árbol de rutas generado
│   │   ├── client/                    # Cliente API generado
│   │   ├── components/
│   │   │   ├── Admin/                 # Componentes admin
│   │   │   ├── auth/                  # Componentes autenticación
│   │   │   ├── Common/                # Componentes comunes
│   │   │   ├── Items/                 # Componentes items
│   │   │   ├── Pending/               # Componentes pendientes
│   │   │   ├── Sidebar/               # Sidebar navegación
│   │   │   ├── UserSettings/          # Configuración usuario
│   │   │   ├── ui/                    # Componentes UI base
│   │   │   └── theme-provider.tsx     # Provider temas
│   │   ├── hooks/
│   │   │   ├── useAuth.ts             # Hook autenticación
│   │   │   ├── useCopyToClipboard.ts  # Hook clipboard
│   │   │   ├── useCustomToast.ts      # Hook notificaciones
│   │   │   └── useMobile.ts           # Hook detección móvil
│   │   ├── lib/
│   │   │   ├── mock-data.ts           # Datos mock/demo
│   │   │   └── utils.ts              # Utilidades lib
│   │   └── routes/
│   │       ├── __root.tsx             # Ruta raíz
│   │       ├── _layout.tsx            # Layout principal
│   │       ├── _layout/               # Rutas con layout
│   │       ├── login.tsx              # Página login
│   │       ├── signup.tsx             # Página registro
│   │       ├── two-factor.tsx         # Verificación 2FA
│   │       ├── recover-password.tsx   # Recuperar contraseña
│   │       ├── reset-password.tsx     # Restablecer contraseña
│   │       └── account-locked.tsx     # Cuenta bloqueada
│   ├── tests/                         # Tests E2E (Playwright)
│   ├── public/                        # Archivos estáticos
│   ├── package.json                   # Dependencias Node
│   ├── tsconfig.json                  # Config TypeScript
│   ├── vite.config.ts                 # Config Vite
│   ├── biome.json                     # Config Biome (lint)
│   ├── index.html                     # HTML entry point
│   ├── nginx.conf                     # Config Nginx
│   └── Dockerfile                     # Docker frontend
├── scripts/
│   ├── test.sh                        # Script tests
│   ├── test-local.sh                  # Tests locales
│   ├── generate-client.sh             # Generar cliente API
│   └── add_latest_release_date.py     # Script releases
├── compose.yml                        # Docker Compose principal
├── compose.override.yml               # Override desarrollo
├── compose.traefik.yml                # Config Traefik
├── pyproject.toml                     # Config workspace Python
├── package.json                       # Config workspace Node
├── bun.lock                           # Lock dependencies
├── uv.lock                            # Lock Python
├── .env.example                       # Variables ejemplo
├── .pre-commit-config.yaml            # Pre-commit hooks
├── deployment.md                      # Docs deployment
├── development.md                     # Docs desarrollo
└── release-notes.md                   # Notas de release
```

---

## 5. Backend - Análisis Detallado

### 5.1 Modelos de Datos (`backend/app/models.py`)

#### Modelo User
```python
class User(UserBase, table=True):
    id: uuid.UUID                    # Primary key (UUID)
    email: EmailStr                  # Email único, indexado
    is_active: bool                  # Estado activo (default: True)
    is_superuser: bool               # Superusuario (default: False)
    full_name: str | None            # Nombre completo
    hashed_password: str             # Password hasheado
    created_at: datetime             # Fecha creación (UTC)
    items: list["Item"]              # Relación con items
```

#### Modelo Item
```python
class Item(ItemBase, table=True):
    id: uuid.UUID                    # Primary key (UUID)
    title: str                       # Título (1-255 chars)
    description: str | None          # Descripción (max 255 chars)
    created_at: datetime             # Fecha creación (UTC)
    owner_id: uuid.UUID              # FK a User
    owner: User | None               # Relación con usuario
```

#### Modelos de Autenticación
```python
class Token(SQLModel):
    access_token: str                # Token JWT
    token_type: str = "bearer"       # Tipo token

class TokenPayload(SQLModel):
    sub: str | None = None           # Subject (user ID)
```

### 5.2 Endpoints API

#### Login (`/api/v1/login`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/access-token` | Obtener token JWT |

#### Users (`/api/v1/users`)
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/` | Listar usuarios | Superuser |
| POST | `/` | Crear usuario | Superuser |
| GET | `/me` | Obtener usuario actual | Usuario |
| PATCH | `/me` | Actualizar propio usuario | Usuario |
| DELETE | `/me` | Eliminar propio usuario | Usuario |
| PATCH | `/me/password` | Cambiar contraseña | Usuario |
| GET | `/{user_id}` | Obtener usuario por ID | Usuario |
| PATCH | `/{user_id}` | Actualizar usuario | Superuser |
| DELETE | `/{user_id}` | Eliminar usuario | Superuser |
| POST | `/signup` | Registro público | Ninguno |

#### Items (`/api/v1/items`)
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/` | Listar items | Usuario |
| POST | `/` | Crear item | Usuario |
| GET | `/{id}` | Obtener item | Usuario |
| PUT | `/{id}` | Actualizar item | Usuario |
| DELETE | `/{id}` | Eliminar item | Usuario |

#### Utils (`/api/v1/utils`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health-check/` | Health check |

### 5.3 Seguridad

#### Autenticación JWT
- **Algoritmo**: HS256
- **Expiración**: 8 días (11520 minutos)
- **Secret Key**: Generada aleatoriamente o desde `.env`

#### Password Hashing
- **Algoritmos**: Argon2 (primario), Bcrypt (fallback)
- **Library**: `pwdlib` con `PasswordHash`
- **Auto-upgrade**: Actualiza hash si se detecta cambio de algoritmo

#### Protección contra Timing Attacks
```python
# En crud.py - authenticate()
if not db_user:
    # Ejecuta verificación aunque usuario no exista
    verify_password(password, DUMMY_HASH)
    return None
```

#### Configuración CORS
- Orígenes configurables via `BACKEND_CORS_ORIGINS`
- Frontend host incluido automáticamente
- Métodos y headers permitidos: `*`

### 5.4 Configuración (`backend/app/core/config.py`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `API_V1_STR` | `/api/v1` | Prefijo API |
| `SECRET_KEY` | Random | Clave JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 11520 (8 días) | Expiración token |
| `FRONTEND_HOST` | `http://localhost:5173` | URL frontend |
| `ENVIRONMENT` | `local` | Entorno |
| `POSTGRES_SERVER` | - | Host PostgreSQL |
| `POSTGRES_PORT` | 5432 | Puerto PostgreSQL |
| `POSTGRES_USER` | - | Usuario PostgreSQL |
| `POSTGRES_PASSWORD` | - | Password PostgreSQL |
| `POSTGRES_DB` | - | Base de datos |
| `SMTP_HOST` | - | Host SMTP |
| `SMTP_PORT` | 587 | Puerto SMTP |
| `FIRST_SUPERUSER` | - | Email superusuario inicial |
| `FIRST_SUPERUSER_PASSWORD` | - | Password superusuario inicial |
| `SENTRY_DSN` | None | DSN Sentry |

---

## 6. Frontend - Análisis Detallado

### 6.1 Sistema de Roles

| Role | Label | Descripción | Requiere 2FA |
|------|-------|-------------|--------------|
| `ADMIN` | Administrador | Gestión de usuarios y configuración del sistema | Sí |
| `OFICIAL_CUMPLIMIENTO` | Oficial de Cumplimiento | Aprobación de DDR nivel Alto | Sí |
| `ANALISTA_DDR` | Analista DDR | Carga de expedientes y evaluación KYC | No |
| `GERENTE_CUMPLIMIENTO` | Gerente de Cumplimiento | Aprobación de expedientes DDR nivel Muy Alto | No |
| `COMITE_CUMPLIMIENTO` | Comité de Cumplimiento | Aprobación multi-firma de expedientes DDR nivel Muy Alto | No |
| `AUDITOR` | Auditor | Acceso de solo lectura a bitácora y reportes | No |

### 6.2 Credenciales Demo

| Email | Password | Rol | 2FA |
|-------|----------|-----|-----|
| admin@panama.com | Admin1234! | ADMIN | Sí |
| oficial@panama.com | Oficial1! | OFICIAL_CUMPLIMIENTO | Sí |
| analista@panama.com | Analista1! | ANALISTA_DDR | No |
| gerente@panama.com | Gerente1! | GERENTE_CUMPLIMIENTO | No |
| auditor@panama.com | Auditor1! | AUDITOR | No |

### 6.3 Rutas de la Aplicación

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/login` | Login | Inicio de sesión |
| `/signup` | Signup | Registro de usuario |
| `/two-factor` | TwoFactor | Verificación 2FA |
| `/recover-password` | RecoverPassword | Recuperar contraseña |
| `/reset-password` | ResetPassword | Restablecer contraseña |
| `/account-locked` | AccountLocked | Cuenta bloqueada |
| `/_layout/*` | Layout | Rutas autenticadas con sidebar |

### 6.4 Componentes Principales

#### Sidebar (`components/Sidebar/`)
- `AppSidebar.tsx` - Sidebar principal
- `Main.tsx` - Navegación principal
- `User.tsx` - Info usuario

#### UI (`components/ui/`)
- Componentes Radix UI personalizados
- Botones, inputs, diálogos, tabs, etc.

#### Auth (`components/auth/`)
- Formularios de autenticación

#### Common (`components/Common/`)
- `ErrorComponent.tsx` - Manejo de errores
- `NotFound.tsx` - Página 404
- `Footer.tsx` - Pie de página

### 6.5 Autenticación Frontend

#### Flujo de Login
```
1. Usuario ingresa email/password
2. authenticateMock() valida credenciales demo
3. Si requiere 2FA → redirige a /two-factor
4. Si no requiere 2FA → completeLogin() guarda en localStorage
5. Redirige a /
```

#### Almacenamiento Local
| Key | Contenido |
|-----|-----------|
| `access_token` | Token JWT (mock: `mock_{timestamp}`) |
| `pc_user` | `{ role, name, email }` |
| `pc_session_expires` | Timestamp expiración sesión |
| `pre_auth` | Datos pre-autenticación (2FA) |

#### Hook `useAuth`
```typescript
const { user, loginMutation, signUpMutation, logout } = useAuth()
```

### 6.6 Configuración de Desarrollo

#### Scripts NPM
| Script | Comando | Descripción |
|--------|---------|-------------|
| `dev` | `vite` | Servidor desarrollo |
| `build` | `tsc && vite build` | Build producción |
| `lint` | `biome check` | Linting |
| `test` | `playwright test` | Tests E2E |
| `generate-client` | `openapi-ts` | Generar cliente API |

---

## 7. Infraestructura Docker

### 7.1 Servicios

#### PostgreSQL (`db`)
```yaml
image: postgres:18
ports: (interno)
volumes: app-db-data:/var/lib/postgresql/data/pgdata
```

#### Backend (`backend`)
```yaml
image: ${DOCKER_IMAGE_BACKEND}:${TAG-latest}
ports: 8000
healthcheck: curl http://localhost:8000/api/v1/utils/health-check/
depends_on: db, prestart
```

#### Frontend (`frontend`)
```yaml
image: ${DOCKER_IMAGE_FRONTEND}:${TAG-latest}
ports: 80 (via nginx)
build args: VITE_API_URL
```

#### Prestart (`prestart`)
```yaml
command: bash scripts/prestart.sh
depends_on: db
purpose: Migraciones BD + datos iniciales
```

#### Adminer (`adminer`)
```yaml
image: adminer
ports: 8080
purpose: Interfaz administración BD
```

### 7.2 Redes

- `traefik-public` - Red externa (Traefik)
- `default` - Red interna servicios

### 7.3 Volúmenes

- `app-db-data` - Datos persistentes PostgreSQL

---

## 8. Endpoints Docker/Traefik

| Servicio | Dominio | Puerto |
|----------|---------|--------|
| Backend API | `api.{DOMAIN}` | 8000 |
| Frontend | `dashboard.{DOMAIN}` | 80 |
| Adminer | `adminer.{DOMAIN}` | 8080 |

---

## 9. Variables de Entorno (`.env`)

```bash
# Dominio
DOMAIN=panama.example.com
STACK_NAME=sgddr

# Docker
DOCKER_IMAGE_BACKEND=backend
DOCKER_IMAGE_FRONTEND=frontend
TAG=latest

# Frontend
FRONTEND_HOST=https://dashboard.panama.example.com
VITE_API_URL=https://api.panama.example.com

# Backend
ENVIRONMENT=production
SECRET_KEY=your-secret-key-here
BACKEND_CORS_ORIGINS=https://dashboard.panama.example.com

# PostgreSQL
POSTGRES_SERVER=db
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_DB=app

# Superusuario inicial
FIRST_SUPERUSER=admin@panama.com
FIRST_SUPERUSER_PASSWORD=your-admin-password

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAILS_FROM_EMAIL=noreply@panama.example.com
EMAILS_FROM_NAME=PanamaCompliance

# Sentry (opcional)
SENTRY_DSN=https://your-sentry-dsn
```

---

## 10. Seguridad - Buenas Prácticas Implementadas

1. **Passwords hasheados** con Argon2/Bcrypt (no reversibles)
2. **JWT con expiración** (8 días)
3. **CORS configurado** explícitamente
4. **Protección contra timing attacks** en autenticación
5. **Rate limiting** implícito (5 intentos → cuenta bloqueada)
6. **Variables sensibles** en `.env` (no en código)
7. **Validación de secrets** en producción (no "changethis")
8. **HTTPS** via Traefik + Let's Encrypt
9. **Sentry** para monitoreo de errores
10. **Pre-commit hooks** para calidad de código

---

## 11. Scripts Útiles

```bash
# Desarrollo local
docker compose up -d                    # Levantar servicios
docker compose logs -f backend          # Ver logs backend
docker compose logs -f frontend         # Ver logs frontend

# Tests
cd frontend && bunx playwright test     # Tests E2E
cd backend && pytest                    # Tests unitarios

# Generar cliente API
cd frontend && npm run generate-client

# Migraciones BD
cd backend && alembic upgrade head

# Build producción
docker compose -f compose.yml build
```

---

## 12. Notas de Desarrollo

- El frontend usa **datos mock** para demo (`frontend/src/lib/mock-data.ts`)
- El backend tiene un endpoint `/private` solo disponible en entorno `local`
- Los tests E2E usan **Playwright**
- El cliente API se genera automáticamente desde OpenAPI spec
- Usar **bun** como package manager en frontend
- Usar **uv** como package manager en backend Python

---

## 13. Flujo de Autenticación Completo

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  POST /login       │                    │
       │───────────────────▶│                    │
       │                    │  SELECT user       │
       │                    │───────────────────▶│
       │                    │  ◀─────────────────│
       │                    │                    │
       │                    │  verify_password() │
       │                    │  (Argon2/Bcrypt)   │
       │                    │                    │
       │  { access_token }  │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │  GET /users/me     │                    │
       │  (Bearer token)    │                    │
       │───────────────────▶│                    │
       │                    │  decode JWT        │
       │                    │  SELECT user       │
       │                    │───────────────────▶│
       │                    │  ◀─────────────────│
       │  { user data }     │                    │
       │◀───────────────────│                    │
```

---

*Documento generado automáticamente via Reverse Engineering*
*Fecha: 2026-06-02*
