import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import EmailStr
from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Roles del sistema (SGDDR) ──────────────────────────────────────────────
class UserRole(str, Enum):
    ADMIN = "ADMIN"
    OFICIAL_CUMPLIMIENTO = "OFICIAL_CUMPLIMIENTO"
    ANALISTA_DDR = "ANALISTA_DDR"
    GERENTE_CUMPLIMIENTO = "GERENTE_CUMPLIMIENTO"
    COMITE_CUMPLIMIENTO = "COMITE_CUMPLIMIENTO"
    AUDITOR = "AUDITOR"


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = Field(default=UserRole.OFICIAL_CUMPLIMIENTO)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore[assignment]
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = Field(default=None)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    role: UserRole = Field(default=UserRole.OFICIAL_CUMPLIMIENTO)
    intentos_fallidos: int = Field(default=0)
    bloqueado_hasta: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    role: UserRole
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore[assignment]


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# ── Auditoría (append-only) ────────────────────────────────────────────────
class ModuloAuditoria(str, Enum):
    AUTH = "AUTH"
    USUARIOS = "USUARIOS"
    KYC = "KYC"
    DDR = "DDR"
    SISTEMA = "SISTEMA"


class Auditoria(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    usuario_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    modulo: str = Field(max_length=20, index=True)
    accion: str = Field(max_length=100, index=True)
    entidad_tipo: str | None = Field(default=None, max_length=50)
    entidad_id: uuid.UUID | None = Field(default=None, index=True)
    descripcion: str | None = Field(default=None, max_length=500)
    ip_origen: str | None = Field(default=None, max_length=45)
    creado_en: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class AuditoriaPublic(SQLModel):
    id: uuid.UUID
    usuario_id: uuid.UUID | None
    usuario_nombre: str | None = None
    modulo: str
    accion: str
    entidad_tipo: str | None
    entidad_id: uuid.UUID | None
    descripcion: str | None
    ip_origen: str | None
    creado_en: datetime


class AuditoriasPublic(SQLModel):
    data: list[AuditoriaPublic]
    count: int


# ── Tablas de simulación (consultadas por Dev 2) ───────────────────────────
class PepSimulado(SQLModel, table=True):
    __tablename__ = "pep_simulado"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nombre_completo: str = Field(max_length=200)
    numero_documento: str = Field(max_length=20, index=True)
    tipo_documento: str = Field(max_length=20)
    pais: str = Field(max_length=60)
    cargo: str = Field(max_length=150)
    institucion: str = Field(max_length=150)
    activo: bool = Field(default=True)


class ListaRestrictivaSimulada(SQLModel, table=True):
    __tablename__ = "lista_restrictiva_simulada"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    fuente: str = Field(max_length=20, index=True)  # OFAC | ONU | UE | INTERNA
    nombre_completo: str = Field(max_length=200)
    alias: str | None = Field(default=None, max_length=200)
    numero_documento: str | None = Field(default=None, max_length=20, index=True)
    pais: str | None = Field(default=None, max_length=60)
    motivo: str | None = Field(default=None, max_length=200)
    fecha_inclusion: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    activo: bool = Field(default=True)


# ── KYC (modelos mínimos para dashboard y Dev 2) ───────────────────────────
class KYCStatus(str, Enum):
    PENDIENTE = "PENDIENTE"
    EN_REVISION = "EN_REVISION"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"


class RiskLevel(str, Enum):
    BAJO = "BAJO"
    MEDIO = "MEDIO"
    ALTO = "ALTO"
    MUY_ALTO = "MUY_ALTO"


class EstadoCaso(str, Enum):
    ABIERTO = "ABIERTO"
    EN_REVISION = "EN_REVISION"
    EN_APROBACION = "EN_APROBACION"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"


class ExpedienteKYC(SQLModel, table=True):
    __tablename__ = "expediente_kyc"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nombres: str = Field(max_length=120)
    apellidos: str = Field(max_length=120)
    tipo_identificacion: str = Field(max_length=20)
    numero_identificacion: str = Field(max_length=30, index=True)
    estado: KYCStatus = Field(default=KYCStatus.PENDIENTE, index=True)
    nivel_riesgo: RiskLevel = Field(default=RiskLevel.BAJO, index=True)
    puntaje_riesgo: int = Field(default=0)
    ddr_requerida: bool = Field(default=False)
    es_pep: bool = Field(default=False)
    oficial_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    creado_en: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class CasoDDR(SQLModel, table=True):
    __tablename__ = "caso_ddr"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    expediente_id: uuid.UUID = Field(foreign_key="expediente_kyc.id", index=True)
    analista_id: uuid.UUID | None = Field(default=None, foreign_key="user.id", index=True)
    estado: EstadoCaso = Field(default=EstadoCaso.ABIERTO, index=True)
    nivel_riesgo: RiskLevel = Field(default=RiskLevel.BAJO, index=True)
    aprobado_por_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    fecha_apertura: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    fecha_cierre: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    observaciones_rechazo: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
