import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import EmailStr, model_validator
from sqlalchemy import DateTime, String
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


# ── User ─────────────────────────────────────────────────────────────────────


class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    role: UserRole = Field(
        default=UserRole.ANALISTA_DDR,
        sa_type=String(length=50),  # type: ignore
    )


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = Field(default=UserRole.OFICIAL_CUMPLIMIENTO)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


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


class UserPublic(UserBase):
    id: uuid.UUID
    role: UserRole
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# ── Item ─────────────────────────────────────────────────────────────────────


class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore[assignment]


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


class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# ── Generic ──────────────────────────────────────────────────────────────────


class Message(SQLModel):
    message: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


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


# ── 2FA (TOTP) ──────────────────────────────────────────────────────────────


# Roles del sistema para los que el 2FA es **obligatorio** desde el primer
# login. El resto de roles puede activarlo voluntariamente desde Settings.
REQUIRES_2FA_ROLES: frozenset[UserRole] = frozenset()


class TwoFactorAuth(SQLModel, table=True):
    """Estado 2FA (TOTP) de un usuario.

    Relación 1-a-1 con ``User``. El ``encrypted_secret`` guarda el secret
    TOTP cifrado con Fernet (``app.core.crypto``). Los ``backup_codes_hashed``
    son hashes Argon2 (vía ``pwdlib``) de códigos de un solo uso.
    """

    __tablename__ = "two_factor_auth"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, unique=True, ondelete="CASCADE"
    )
    encrypted_secret: str = Field(max_length=512)
    is_enabled: bool = Field(default=False)
    # JSON serializado (lista de strings Argon2). ``text`` porque el
    # tamaño es variable y no queremos VARCHAR(2k) artificial.
    backup_codes_hashed: str | None = Field(default=None, sa_type=String)  # type: ignore[arg-type]
    backup_codes_remaining: int = Field(default=10)
    last_used_counter: int = Field(default=0)
    confirmed_at: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)  # type: ignore
    )
    disabled_at: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)  # type: ignore
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


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


# ── KYC — Enums ─────────────────────────────────────────────────────────────


class ClientType(str, Enum):
    NATURAL = "NATURAL"
    JURIDICA = "JURIDICA"


class RiskLevel(str, Enum):
    BAJO = "BAJO"
    MEDIO = "MEDIO"
    ALTO = "ALTO"
    MUY_ALTO = "MUY_ALTO"


class KYCStatus(str, Enum):
    BORRADOR = "BORRADOR"
    PENDIENTE = "PENDIENTE"
    EN_REVISION = "EN_REVISION"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"
    DDR_INICIADO = "DDR_INICIADO"


class DocumentoTipo(str, Enum):
    CEDULA_FRONTAL = "CEDULA_FRONTAL"
    CEDULA_POSTERIOR = "CEDULA_POSTERIOR"
    PASAPORTE = "PASAPORTE"
    RUC = "RUC"
    REGISTRO_MERCANTIL = "REGISTRO_MERCANTIL"
    ESTADOS_FINANCIEROS = "ESTADOS_FINANCIEROS"
    DECLARACION_RENTA = "DECLARACION_RENTA"
    ESCRITURA_CONSTITUCION = "ESCRITURA_CONSTITUCION"
    PODER_REPRESENTANTE = "PODER_REPRESENTANTE"
    # Soporte de la fase DDR (Ley 23/2015 Art. 27-28)
    DECLARACION_FONDOS = "DECLARACION_FONDOS"
    REFERENCIA_BANCARIA = "REFERENCIA_BANCARIA"
    COMPROBANTE_DOMICILIO = "COMPROBANTE_DOMICILIO"
    OTRO = "OTRO"


class DocumentoEstado(str, Enum):
    PENDIENTE = "PENDIENTE"
    VALIDADO = "VALIDADO"
    RECHAZADO = "RECHAZADO"


class EstadoCasoDDR(str, Enum):
    """Flujo DDR con segregación de funciones (cuatro ojos):

    ABIERTO → el Oficial asigna un analista (distinto al que registró)
    EN_REVISION → el analista investiga (EBR + documentos)
    EN_REVISION_OFICIAL → el Oficial valida el trabajo del analista
    EN_APROBACION → Gerente (ALTO) o Comité (MUY_ALTO) decide
    APROBADO / RECHAZADO → cierre
    """

    ABIERTO = "ABIERTO"
    EN_REVISION = "EN_REVISION"
    EN_REVISION_OFICIAL = "EN_REVISION_OFICIAL"
    EN_APROBACION = "EN_APROBACION"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"


EstadoCaso = EstadoCasoDDR


# ── KYC — Persona Natural ───────────────────────────────────────────────────


class PersonaNaturalBase(SQLModel):
    tipo_documento: str = Field(max_length=30)
    numero_documento: str = Field(max_length=50)
    fecha_expiracion_doc: str = Field(max_length=20)
    nacionalidad: str = Field(max_length=80)
    pais_nacimiento: str = Field(max_length=80)
    nombre: str = Field(max_length=100)
    apellido: str = Field(max_length=100)
    fecha_nacimiento: str = Field(max_length=20)
    genero: str = Field(max_length=20)
    estado_civil: str = Field(max_length=20)
    telefono: str = Field(max_length=30)
    email: str = Field(max_length=255)
    direccion: str = Field(max_length=255)
    ciudad: str = Field(max_length=100)
    pais: str = Field(max_length=80)
    ocupacion: str = Field(max_length=120)
    empleador: str = Field(max_length=120)
    ingreso_mensual_aproximado: float = 0
    fuente_ingresos: str = Field(max_length=60)
    es_pep: bool = False
    es_pep_familiar: bool = False
    tiene_antecedentes: bool = False


class PersonaNatural(PersonaNaturalBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    expediente_id: uuid.UUID = Field(
        foreign_key="expedientekyc.id", nullable=False, ondelete="CASCADE"
    )
    expediente: "ExpedienteKYC" = Relationship(back_populates="persona_natural")


class PersonaNaturalCreate(PersonaNaturalBase):
    pass


class PersonaNaturalPublic(PersonaNaturalBase):
    id: uuid.UUID


# ── KYC — Persona Jurídica ─────────────────────────────────────────────────


class PersonaJuridicaBase(SQLModel):
    razon_social: str = Field(max_length=200)
    ruc: str = Field(max_length=50)
    tipo_sociedad: str = Field(max_length=30)
    fecha_constitucion: str = Field(max_length=20)
    pais_constitucion: str = Field(max_length=80)
    numero_registro_mercantil: str = Field(max_length=80)
    nombre_representante: str = Field(max_length=150)
    cedula_representante: str = Field(max_length=50)
    cargo_representante: str = Field(max_length=80)
    telefono_empresa: str = Field(max_length=30)
    email_empresa: str = Field(max_length=255)
    direccion_fiscal: str = Field(max_length=255)
    ciudad: str = Field(max_length=100)
    pais: str = Field(max_length=80)
    actividad_economica: str = Field(max_length=200)
    ingreso_anual_aproximado: float = 0
    cantidad_empleados: int = 0
    tiene_accionistas_anonimos: bool = False
    opera_en_paises_alto_riesgo: bool = False


class PersonaJuridica(PersonaJuridicaBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    expediente_id: uuid.UUID = Field(
        foreign_key="expedientekyc.id", nullable=False, ondelete="CASCADE"
    )
    expediente: "ExpedienteKYC" = Relationship(back_populates="persona_juridica")


class PersonaJuridicaCreate(PersonaJuridicaBase):
    pass


class PersonaJuridicaPublic(PersonaJuridicaBase):
    id: uuid.UUID


# ── KYC — Beneficiario Final ───────────────────────────────────────────────


class BeneficiarioFinalBase(SQLModel):
    nombre: str = Field(max_length=100)
    apellido: str = Field(max_length=100)
    cedula: str = Field(max_length=50)
    nacionalidad: str = Field(max_length=80)
    pais: str = Field(max_length=80)
    fecha_nacimiento: str = Field(max_length=20)
    porcentaje_participacion: float = Field(default=0, ge=0, le=100)
    # Ley 254/2021: cómo ejerce el control (DIRECTA | INDIRECTA | OTRO)
    tipo_control: str = Field(default="DIRECTA", max_length=20)
    es_pep: bool = False


class BeneficiarioFinal(BeneficiarioFinalBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    expediente_id: uuid.UUID = Field(
        foreign_key="expedientekyc.id", nullable=False, ondelete="CASCADE"
    )
    expediente: "ExpedienteKYC" = Relationship(back_populates="beneficiarios_final")


class BeneficiarioFinalCreate(BeneficiarioFinalBase):
    pass


class BeneficiarioFinalPublic(BeneficiarioFinalBase):
    id: uuid.UUID


# ── DDR — Caso DDR y Cuestionario EBR ──────────────────────────────────────


class CuestionarioEBR(SQLModel, table=True):
    __tablename__ = "cuestionario_ebr"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    caso_ddr_id: uuid.UUID = Field(
        foreign_key="caso_ddr.id", unique=True, ondelete="CASCADE"
    )
    origen_fondos: str | None = Field(default=None, max_length=2000)
    proposito_relacion: str | None = Field(default=None, max_length=2000)
    patrimonio_estimado: str | None = Field(default=None, max_length=20)
    pais_origen_patrimonio: str | None = Field(default=None, max_length=60)
    tiene_estructura_societaria: bool | None = Field(default=None)
    familiar_pep: bool | None = Field(default=None)
    completado: bool = Field(default=False)
    completado_por: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    completado_en: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)  # type: ignore
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class CuestionarioEBRPublic(SQLModel):
    id: uuid.UUID
    caso_ddr_id: uuid.UUID
    origen_fondos: str | None = None
    proposito_relacion: str | None = None
    patrimonio_estimado: str | None = None
    pais_origen_patrimonio: str | None = None
    tiene_estructura_societaria: bool | None = None
    familiar_pep: bool | None = None
    completado: bool = False
    completado_por: uuid.UUID | None = None
    completado_en: datetime | None = None


class CasoDDR(SQLModel, table=True):
    __tablename__ = "caso_ddr"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    expediente_id: uuid.UUID = Field(
        foreign_key="expedientekyc.id", unique=True, ondelete="CASCADE"
    )
    nivel_riesgo: str = Field(max_length=20)
    status: str = Field(default=EstadoCasoDDR.ABIERTO.value, max_length=20)
    analista_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    aprobado_por_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    # Revisión del Oficial de Cumplimiento (paso previo a la aprobación):
    # quién validó el trabajo del analista y sus observaciones al devolverlo.
    validado_por_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    observaciones_oficial: str | None = Field(default=None, max_length=1000)
    observaciones_rechazo: str | None = Field(default=None, max_length=1000)
    fecha_apertura: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    fecha_cierre: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)  # type: ignore
    )
    updated_at: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)  # type: ignore
    )

    cuestionario: CuestionarioEBR | None = Relationship()


class CasoDDRPublic(SQLModel):
    id: uuid.UUID
    expediente_id: uuid.UUID
    nivel_riesgo: str
    status: str
    analista_id: uuid.UUID | None = None
    aprobado_por_id: uuid.UUID | None = None
    validado_por_id: uuid.UUID | None = None
    observaciones_oficial: str | None = None
    observaciones_rechazo: str | None = None
    fecha_apertura: datetime | None = None
    fecha_cierre: datetime | None = None
    updated_at: datetime | None = None
    # Resumen del cliente asociado al expediente. Se popula en los
    # endpoints GET para que la UI pueda mostrar nombre/identificación
    # sin un round-trip adicional a /clientes/{id} (que tiene AccesoKYC
    # y no es accesible para todos los roles con AccesoDDR).
    cliente: "ClienteResumen | None" = None


class ClienteResumen(SQLModel):
    """Proyección mínima de un expediente KYC para embeber en otras
    respuestas (casos DDR, dashboard, etc.) y evitar un round-trip extra.
    Mantener sincronizado con la vista ``Cliente`` del frontend."""

    id: uuid.UUID
    codigo: str
    tipo_cliente: str
    nombres: str
    apellidos: str
    tipo_identificacion: str
    numero_identificacion: str
    nivel_riesgo: str | None = None
    estado: str
    es_pep: bool = False


class CasosDDRPublic(SQLModel):
    data: list[CasoDDRPublic]
    count: int


# ── KYC — Documento ────────────────────────────────────────────────────────


class DocumentoKYC(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    expediente_id: uuid.UUID = Field(
        foreign_key="expedientekyc.id", nullable=False, ondelete="CASCADE"
    )
    caso_ddr_id: uuid.UUID | None = Field(default=None, foreign_key="caso_ddr.id")
    tipo: str = Field(max_length=40)
    nombre: str = Field(max_length=255)
    tamanio: int = 0
    mime_type: str = Field(max_length=80)
    estado: str = Field(default=DocumentoEstado.PENDIENTE.value, max_length=20)
    ruta_archivo: str | None = Field(default=None, max_length=500)
    hash_sha256: str | None = Field(default=None, max_length=64)
    fecha_carga: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    expediente: "ExpedienteKYC" = Relationship(back_populates="documentos")


class DocumentoKYCPublic(SQLModel):
    id: uuid.UUID
    expediente_id: uuid.UUID
    caso_ddr_id: uuid.UUID | None = None
    tipo: DocumentoTipo
    nombre: str
    tamanio: int
    mime_type: str
    estado: DocumentoEstado
    hash_sha256: str | None = None
    fecha_carga: datetime | None = None


# ── KYC — Expediente ───────────────────────────────────────────────────────


class ExpedienteKYC(SQLModel, table=True):
    __tablename__ = "expedientekyc"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    codigo: str = Field(unique=True, index=True, max_length=20)
    tipo_cliente: str = Field(max_length=20)
    status: str = Field(default=KYCStatus.BORRADOR.value, max_length=20)
    nivel_riesgo: str | None = Field(default=None, max_length=20)
    puntaje_riesgo: int | None = Field(default=None)
    nivel_riesgo_override: str | None = Field(default=None, max_length=20)
    justificacion_override: str | None = Field(default=None, max_length=500)
    comentario_rechazo: str | None = Field(default=None, max_length=1000)
    analista_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    updated_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )

    persona_natural: PersonaNatural | None = Relationship(
        back_populates="expediente",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
    persona_juridica: PersonaJuridica | None = Relationship(
        back_populates="expediente",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
    beneficiarios_final: list[BeneficiarioFinal] = Relationship(
        back_populates="expediente", cascade_delete=True
    )
    documentos: list[DocumentoKYC] = Relationship(
        back_populates="expediente", cascade_delete=True
    )
    caso_ddr: CasoDDR | None = Relationship()


class ExpedienteKYCCreate(SQLModel):
    tipo_cliente: ClientType
    persona_natural: PersonaNaturalCreate | None = None
    persona_juridica: PersonaJuridicaCreate | None = None
    beneficiarios_final: list[BeneficiarioFinalCreate] = Field(default_factory=list)
    enviar_a_revision: bool = False

    @model_validator(mode="after")
    def _juridica_beneficiarios_suman_100(self) -> "ExpedienteKYCCreate":
        """Ley 254/2021: una Persona Jurídica debe declarar beneficiarios finales
        cuya participación sume exactamente 100%. La validación corre siempre
        (no sólo al enviar a revisión) para no permitir borradores inválidos."""
        if self.tipo_cliente != ClientType.JURIDICA:
            return self
        if not self.beneficiarios_final:
            raise ValueError(
                "Una Persona Jurídica requiere al menos un beneficiario final "
                "(Ley 254/2021)."
            )
        total = sum(bf.porcentaje_participacion for bf in self.beneficiarios_final)
        if round(total) != 100:
            delta = round(100 - total)
            signo = "Falta" if delta > 0 else "Sobra"
            raise ValueError(
                "Los porcentajes de beneficiarios finales deben sumar 100%. "
                f"Actualmente: {round(total)}%. {signo} {abs(delta)}%."
            )
        return self


class ExpedienteKYCUpdate(SQLModel):
    status: KYCStatus | None = None
    comentario_rechazo: str | None = Field(default=None, max_length=1000)


class ExpedienteKYCPublic(SQLModel):
    id: uuid.UUID
    codigo: str
    tipo_cliente: ClientType
    status: KYCStatus
    nivel_riesgo: RiskLevel | None = None
    puntaje_riesgo: int | None = None
    nivel_riesgo_override: RiskLevel | None = None
    justificacion_override: str | None = None
    comentario_rechazo: str | None = None
    analista_id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None
    persona_natural: PersonaNaturalPublic | None = None
    persona_juridica: PersonaJuridicaPublic | None = None
    beneficiarios_final: list[BeneficiarioFinalPublic] = Field(default_factory=list)
    documentos: list[DocumentoKYCPublic] = Field(default_factory=list)


class ExpedientesKYCPublic(SQLModel):
    data: list[ExpedienteKYCPublic]
    count: int


# ── Riesgo (schemas, no tablas) ─────────────────────────────────────────────


class FactorRiesgo(SQLModel):
    factor: str
    peso: int
    valor: int
    contribucion: int


class RiesgoResult(SQLModel):
    nivel: RiskLevel
    puntaje: int
    factores: list[FactorRiesgo] = Field(default_factory=list)


class ListaCoincidencia(SQLModel):
    lista: str
    nombre: str
    similitud: int


class ListasResult(SQLModel):
    ofac: bool = False
    onu: bool = False
    ue: bool = False
    coincidencias: list[ListaCoincidencia] = Field(default_factory=list)


# ── Screening persistido ─────────────────────────────────────────────────────


class ScreeningResultado(SQLModel, table=True):
    __tablename__ = "screening_resultado"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    expediente_id: uuid.UUID = Field(foreign_key="expedientekyc.id", index=True)
    lista: str = Field(max_length=20)
    nombre_entrada: str = Field(max_length=200)
    similitud: int
    es_falso_positivo: bool = Field(default=False)
    revisado_por_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    revisado_en: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))  # type: ignore
    creado_en: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class ScreeningResultadoPublic(SQLModel):
    id: uuid.UUID
    expediente_id: uuid.UUID
    lista: str
    nombre_entrada: str
    similitud: int
    es_falso_positivo: bool
    revisado_por_id: uuid.UUID | None
    revisado_en: datetime | None
    creado_en: datetime


class RiesgoOverrideInput(SQLModel):
    nivel_riesgo_override: RiskLevel
    justificacion_override: str = Field(min_length=10, max_length=500)


# ── Parámetros de riesgo (tabla configurable) ───────────────────────────────


class ParametroRiesgo(SQLModel, table=True):
    __tablename__ = "parametro_riesgo"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    factor: str = Field(unique=True, index=True, max_length=100)
    descripcion: str = Field(max_length=300)
    peso: int = Field(default=0, ge=0, le=100)
    activo: bool = Field(default=True)


class ParametroRiesgoPublic(SQLModel):
    id: uuid.UUID
    factor: str
    descripcion: str
    peso: int
    activo: bool


class ParametroRiesgoUpdate(SQLModel):
    peso: int = Field(ge=0, le=100)
    activo: bool | None = None
