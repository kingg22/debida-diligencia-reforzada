import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlmodel import Session, col, func, select

from app.core.security import get_password_hash, verify_password
from app.kyc_risk import calcular_riesgo
from app.models import (
    BeneficiarioFinal,
    CasoDDR,
    ClientType,
    EstadoCasoDDR,
    ExpedienteKYC,
    ExpedienteKYCCreate,
    Item,
    ItemCreate,
    KYCStatus,
    ParametroRiesgo,
    PersonaJuridica,
    PersonaNatural,
    RiskLevel,
    User,
    UserCreate,
    UserUpdate,
)


def get_pesos_riesgo(session: Session) -> dict[str, int]:
    """Devuelve el mapa factor→peso desde la BD; usa defaults si la tabla está vacía."""
    from app.kyc_risk import _PESOS_DEFAULT
    rows = session.exec(select(ParametroRiesgo).where(ParametroRiesgo.activo == True)).all()  # noqa: E712
    if not rows:
        return {}
    return {r.factor: r.peso for r in rows if r.factor in _PESOS_DEFAULT}

_RE_CEDULA_PA = re.compile(r"^\d{1,2}-\d{1,4}-\d{1,4}$")


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


# Dummy hash to use for timing attack prevention when user is not found
# This is an Argon2 hash of a random password, used to ensure constant-time comparison
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        # Prevent timing attacks by running password verification even when user doesn't exist
        # This ensures the response time is similar whether or not the email exists
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_password_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        return None
    if updated_password_hash:
        db_user.hashed_password = updated_password_hash
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


# ─────────────────────────────────────────────────────────────────────────────
# KYC — Expedientes de clientes
# ─────────────────────────────────────────────────────────────────────────────


def generar_codigo_expediente(*, session: Session) -> str:
    """Genera un código secuencial por año: KYC-2026-0001."""
    year = datetime.now(timezone.utc).year
    prefijo = f"KYC-{year}-"
    count = session.exec(
        select(func.count())
        .select_from(ExpedienteKYC)
        .where(col(ExpedienteKYC.codigo).startswith(prefijo))
    ).one()
    return f"{prefijo}{count + 1:04d}"


def create_expediente(
    *,
    session: Session,
    expediente_in: ExpedienteKYCCreate,
    analista_id: uuid.UUID,
) -> ExpedienteKYC:
    if (
        expediente_in.tipo_cliente == ClientType.NATURAL
        and expediente_in.persona_natural is not None
    ):
        pn = expediente_in.persona_natural
        if pn.tipo_documento.upper() in ("CEDULA", "CÉDULA", "CEDULA PANAMEÑA"):
            if not _RE_CEDULA_PA.match(pn.numero_documento):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Formato de cédula panameña inválido (ej: 1-123-456)",
                )
        if pn.fecha_nacimiento:
            try:
                fn = datetime.strptime(pn.fecha_nacimiento, "%Y-%m-%d")
                edad = (datetime.now(timezone.utc).date() - fn.date()).days // 365
                if edad < 18:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="El cliente debe ser mayor de 18 años",
                    )
            except ValueError:
                pass

    expediente = ExpedienteKYC(
        codigo=generar_codigo_expediente(session=session),
        tipo_cliente=expediente_in.tipo_cliente.value,
        analista_id=analista_id,
        status=KYCStatus.BORRADOR.value,
    )

    if (
        expediente_in.tipo_cliente == ClientType.NATURAL
        and expediente_in.persona_natural is not None
    ):
        expediente.persona_natural = PersonaNatural(
            **expediente_in.persona_natural.model_dump(),
            expediente_id=expediente.id,
        )

    if (
        expediente_in.tipo_cliente == ClientType.JURIDICA
        and expediente_in.persona_juridica is not None
    ):
        expediente.persona_juridica = PersonaJuridica(
            **expediente_in.persona_juridica.model_dump(),
            expediente_id=expediente.id,
        )
        expediente.beneficiarios_final = [
            BeneficiarioFinal(**bf.model_dump(), expediente_id=expediente.id)
            for bf in expediente_in.beneficiarios_final
        ]

    pesos = get_pesos_riesgo(session)
    resultado = calcular_riesgo(expediente, pesos)
    expediente.nivel_riesgo = resultado.nivel.value
    expediente.puntaje_riesgo = resultado.puntaje

    if expediente_in.enviar_a_revision:
        if resultado.nivel in (RiskLevel.ALTO, RiskLevel.MUY_ALTO):
            expediente.status = KYCStatus.DDR_INICIADO.value
        else:
            expediente.status = KYCStatus.PENDIENTE.value

    session.add(expediente)
    session.commit()
    session.refresh(expediente)

    if resultado.nivel in (RiskLevel.ALTO, RiskLevel.MUY_ALTO):
        # Segregación de funciones (cuatro ojos): el caso se crea SIN analista.
        # El Oficial de Cumplimiento debe asignar uno distinto al que registró
        # el expediente (validado en el endpoint de asignación).
        caso = CasoDDR(
            expediente_id=expediente.id,
            nivel_riesgo=resultado.nivel.value,
            status=EstadoCasoDDR.ABIERTO.value,
        )
        session.add(caso)
        session.commit()

    return expediente


def get_expediente(
    *, session: Session, expediente_id: uuid.UUID
) -> ExpedienteKYC | None:
    return session.get(ExpedienteKYC, expediente_id)


def recalcular_riesgo_expediente(
    *, session: Session, expediente: ExpedienteKYC
) -> ExpedienteKYC:
    pesos = get_pesos_riesgo(session)
    resultado = calcular_riesgo(expediente, pesos)
    expediente.nivel_riesgo = resultado.nivel.value
    expediente.puntaje_riesgo = resultado.puntaje
    expediente.updated_at = datetime.now(timezone.utc)
    session.add(expediente)
    session.commit()
    session.refresh(expediente)
    return expediente
