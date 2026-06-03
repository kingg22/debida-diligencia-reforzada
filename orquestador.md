You are implementing GitHub Issue #4: "Implementar backend con login, registro de usuarios y autenticación" for PanamaCompliance SGDDR (FastAPI + PostgreSQL + React/TypeScript).

## CONTEXT

- Backend: FastAPI, Python 3.10+, SQLModel, Alembic, PyJWT, pwdlib (Argon2/Bcrypt), pydantic-settings
- Frontend: React 19, TypeScript, TanStack Router/Query, React Hook Form, Zod, Axios, Biome
- Infra: Docker Compose, Traefik, PostgreSQL 18
- Package managers: uv (backend), bun (frontend)
- Current state: Frontend uses mock data (mock-data.ts). Backend structure exists but auth endpoints need real implementation.

## BACKEND TASKS

### Task B1 — core/security.py
Create `backend/app/core/security.py` with:
- `create_access_token(subject: str, expires_delta: timedelta | None) -> str` using PyJWT HS256
- `verify_password(plain: str, hashed: str) -> bool` using pwdlib PasswordHash
- `get_password_hash(password: str) -> str` using pwdlib PasswordHash (Argon2 primary, Bcrypt fallback)
- DUMMY_HASH constant for timing-attack protection

### Task B2 — core/config.py
Create `backend/app/core/config.py` with pydantic-settings `Settings` class:
- API_V1_STR = "/api/v1"
- SECRET_KEY (random default, validates not "changethis" in production)
- ACCESS_TOKEN_EXPIRE_MINUTES = 11520
- FRONTEND_HOST = "http://localhost:5173"
- ENVIRONMENT: Literal["local", "staging", "production"] = "local"
- POSTGRES_SERVER, POSTGRES_PORT=5432, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
- BACKEND_CORS_ORIGINS: list[AnyUrl] — includes FRONTEND_HOST automatically
- SMTP_HOST, SMTP_PORT=587, SMTP_USER, SMTP_PASSWORD, EMAILS_FROM_EMAIL, EMAILS_FROM_NAME
- FIRST_SUPERUSER (EmailStr), FIRST_SUPERUSER_PASSWORD
- SENTRY_DSN: str | None = None
- `settings = Settings()` singleton at module bottom

### Task B3 — core/db.py
Create `backend/app/core/db.py`:
- SQLModel engine from settings.SQLALCHEMY_DATABASE_URI
- `get_session()` dependency yielding Session
- `init_db(session)` that creates first superuser if not exists

### Task B4 — models.py
Create `backend/app/models.py`:
- UserBase (SQLModel): email: EmailStr, is_active=True, is_superuser=False, full_name: str | None
- User(UserBase, table=True): id UUID pk default uuid4, hashed_password: str, created_at datetime default utcnow
- UserCreate(UserBase): password: str (min 8, has upper+lower+digit)
- UserUpdate(SQLModel): email, full_name, password — all optional
- UserPublic(UserBase): id UUID
- ItemBase, Item(table=True), ItemCreate, ItemUpdate, ItemPublic — same pattern
- Token: access_token str, token_type="bearer"
- TokenPayload: sub: str | None = None
- Message: message str

### Task B5 — crud.py
Create `backend/app/crud.py`:
- `get_user_by_email(session, email) -> User | None`
- `create_user(session, user_create: UserCreate) -> User`
- `update_user(session, db_user, user_in: UserUpdate) -> User`
- `authenticate(session, email, password) -> User | None` — uses DUMMY_HASH if user not found (timing protection)
- Item CRUD: get, get_multi by owner, create, update, delete

### Task B6 — api/deps.py
Create `backend/app/api/deps.py`:
- `SessionDep = Annotated[Session, Depends(get_session)]`
- `get_current_user(session, token: str = Depends(OAuth2PasswordBearer))` — decodes JWT, returns User, raises 401 if invalid
- `CurrentUser = Annotated[User, Depends(get_current_user)]`
- `get_current_active_superuser` — checks is_superuser, raises 403 if not

### Task B7 — api/routes/login.py
Create `backend/app/api/routes/login.py`:
- POST `/access-token` — OAuth2PasswordRequestForm, calls authenticate(), returns Token
- POST `/password-recovery/{email}` — sends recovery email (stub OK if SMTP not configured)
- POST `/reset-password` — validates token, updates password

### Task B8 — api/routes/users.py
Create `backend/app/api/routes/users.py`:
- GET `/` — list users, superuser only, supports skip/limit
- POST `/` — create user, superuser only
- GET `/me` — current user
- PATCH `/me` — update own profile
- DELETE `/me` — delete own account
- PATCH `/me/password` — change password (verify current password first)
- GET `/{user_id}` — get user by id
- PATCH `/{user_id}` — update user, superuser only
- DELETE `/{user_id}` — delete user, superuser only
- POST `/signup` — public registration (no auth required)

### Task B9 — api/routes/items.py
Create `backend/app/api/routes/items.py`:
- Full CRUD for items, all routes require CurrentUser
- GET `/` — list own items (skip/limit)
- POST `/` — create item
- GET `/{id}` — get item (must be owner)
- PUT `/{id}` — update item (must be owner)
- DELETE `/{id}` — delete item (must be owner)

### Task B10 — api/routes/utils.py
Create `backend/app/api/routes/utils.py`:
- GET `/health-check/` — returns {"status": "ok"}

### Task B11 — api/main.py
Create `backend/app/api/main.py`:
- APIRouter including login, users, items, utils with prefixes and tags

### Task B12 — main.py
Create `backend/app/main.py`:
- FastAPI app with lifespan
- CORS middleware from settings.BACKEND_CORS_ORIGINS
- Include api_router at settings.API_V1_STR
- Sentry init if settings.SENTRY_DSN

### Task B13 — Alembic migration
Create initial migration in `backend/app/alembic/versions/` that creates user and item tables.

### Task B14 — initial_data.py + backend_pre_start.py
- `initial_data.py`: calls init_db(session)
- `backend_pre_start.py`: waits for DB to be ready (retry loop), then runs migrations via alembic

## FRONTEND TASKS

### Task F1 — Replace mock auth with real API calls in useAuth.ts
File: `frontend/src/hooks/useAuth.ts`
- loginMutation: POST to `{VITE_API_URL}/api/v1/login/access-token` with FormData (username, password)
- signUpMutation: POST to `{VITE_API_URL}/api/v1/users/signup`
- On login success: store `access_token` in localStorage, fetch `/api/v1/users/me`, store user data
- logout: clear localStorage keys (access_token, pc_user, pc_session_expires)
- Keep the same hook interface: `{ user, loginMutation, signUpMutation, logout }`

### Task F2 — Axios client config
File: `frontend/src/client/axios.ts` (create if not exists):
- Axios instance with baseURL from `import.meta.env.VITE_API_URL`
- Request interceptor: attach `Authorization: Bearer {token}` from localStorage if exists
- Response interceptor: on 401, clear localStorage and redirect to /login

### Task F3 — Remove mock data dependency from auth routes
Files: `frontend/src/routes/login.tsx`, `frontend/src/routes/signup.tsx`
- Remove any import from `lib/mock-data.ts`
- Use `useAuth()` hook mutations directly
- Show proper error messages from API response (detail field)
- Keep existing UI/form structure

### Task F4 — Update OpenAPI client generation
File: `frontend/package.json` — ensure `generate-client` script points to `http://localhost:8000/api/v1/openapi.json`

## EXECUTION ORDER

1. B1 → B2 → B3 (core layer, no dependencies between them)
2. B4 (models, depends on nothing)
3. B5 (crud, depends on B3+B4)
4. B6 (deps, depends on B3+B4+security)
5. B7 → B8 → B9 → B10 (routes, depend on B5+B6)
6. B11 → B12 (wire everything)
7. B13 → B14 (DB setup)
8. F2 → F1 → F3 → F4 (frontend, after backend is wired)

## CONSTRAINTS

- Do NOT use SQLAlchemy directly — use SQLModel throughout
- Do NOT add new dependencies not already in pyproject.toml
- Keep all responses concise — no docstrings on every function, only where non-obvious
- Passwords must validate: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit (use Pydantic validator)
- All UUIDs as primary keys, all datetimes as UTC
- Biome linting must pass on frontend files (no unused imports, consistent quotes)
- Do not touch Docker/Traefik config files
- Do not modify `.env.example`
- After all files are created, run: `cd backend && uv run alembic upgrade head` then `uv run python app/initial_data.py`

## DONE CRITERIA

- `GET /api/v1/utils/health-check/` returns 200
- `POST /api/v1/login/access-token` with valid credentials returns JWT token
- `GET /api/v1/users/me` with Bearer token returns user data
- `POST /api/v1/users/signup` creates a new user
- Frontend login form calls real API (no mock), stores token, redirects to /
- Frontend logout clears token and redirects to /login