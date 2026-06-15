import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import CasoDDR, EstadoCaso, ExpedienteKYC, KYCStatus, RiskLevel, User, UserRole

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _count_expedientes_hoy(session) -> int:
    hoy_inicio = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    statement = select(func.count()).select_from(ExpedienteKYC).where(
        ExpedienteKYC.creado_en >= hoy_inicio
    )
    return session.exec(statement).one()


def _count_expedientes_por_estado(session, estado: KYCStatus) -> int:
    statement = select(func.count()).select_from(ExpedienteKYC).where(
        ExpedienteKYC.estado == estado
    )
    return session.exec(statement).one()


def _count_casos_por_estado(session, estado: EstadoCaso) -> int:
    statement = select(func.count()).select_from(CasoDDR).where(CasoDDR.estado == estado)
    return session.exec(statement).one()


def _count_casos_analista_estado(
    session, analista_id: uuid.UUID, estado: EstadoCaso
) -> int:
    statement = (
        select(func.count())
        .select_from(CasoDDR)
        .where(CasoDDR.analista_id == analista_id, CasoDDR.estado == estado)
    )
    return session.exec(statement).one()


def _count_casos_sin_asignar(session) -> int:
    statement = select(func.count()).select_from(CasoDDR).where(
        CasoDDR.analista_id.is_(None)  # type: ignore[union-attr]
    )
    return session.exec(statement).one()


def _count_casos_por_nivel_y_estado(
    session, nivel: RiskLevel, estado: EstadoCaso
) -> int:
    statement = (
        select(func.count())
        .select_from(CasoDDR)
        .where(CasoDDR.nivel_riesgo == nivel, CasoDDR.estado == estado)
    )
    return session.exec(statement).one()


def _dias_promedio_espera(session, nivel: RiskLevel) -> float:
    """Promedio en días entre fecha_apertura y ahora para casos en_aprobacion
    del nivel indicado."""
    ahora = datetime.now(timezone.utc)
    statement = select(CasoDDR.fecha_apertura).where(
        CasoDDR.estado == EstadoCaso.EN_APROBACION,
        CasoDDR.nivel_riesgo == nivel,
    )
    fechas = session.exec(statement).all()
    if not fechas:
        return 0.0
    total = sum((ahora - f).total_seconds() for f in fechas)
    return round(total / len(fechas) / 86400, 1)


@router.get("/")
def get_dashboard(session: SessionDep, current_user: CurrentUser) -> Any:
    rol = current_user.role
    is_admin = current_user.is_superuser

    if rol == UserRole.ADMIN or is_admin:
        return {
            "total_usuarios": session.exec(
                select(func.count()).select_from(User)
            ).one(),
            "usuarios_activos": session.exec(
                select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
            ).one(),
            "total_clientes": session.exec(
                select(func.count()).select_from(ExpedienteKYC)
            ).one(),
            "total_casos_ddr": session.exec(
                select(func.count()).select_from(CasoDDR)
            ).one(),
        }

    if rol == UserRole.OFICIAL_CUMPLIMIENTO:
        return {
            "clientes_registrados_hoy": _count_expedientes_hoy(session),
            "clientes_pendientes_revision": _count_expedientes_por_estado(
                session, KYCStatus.PENDIENTE
            ),
            "casos_ddr_abiertos": _count_casos_por_estado(session, EstadoCaso.ABIERTO),
            "casos_ddr_en_revision": _count_casos_por_estado(
                session, EstadoCaso.EN_REVISION
            ),
        }

    if rol == UserRole.ANALISTA_DDR:
        return {
            "mis_casos_abiertos": _count_casos_analista_estado(
                session, current_user.id, EstadoCaso.ABIERTO
            ),
            "mis_casos_en_revision": _count_casos_analista_estado(
                session, current_user.id, EstadoCaso.EN_REVISION
            ),
            "casos_sin_asignar": _count_casos_sin_asignar(session),
        }

    if rol == UserRole.GERENTE_CUMPLIMIENTO:
        return {
            "casos_pendientes_aprobacion_alto": _count_casos_por_nivel_y_estado(
                session, RiskLevel.ALTO, EstadoCaso.EN_APROBACION
            ),
            "dias_promedio_espera": _dias_promedio_espera(session, RiskLevel.ALTO),
        }

    if rol == UserRole.COMITE_CUMPLIMIENTO:
        return {
            "casos_pendientes_aprobacion_muy_alto": _count_casos_por_nivel_y_estado(
                session, RiskLevel.MUY_ALTO, EstadoCaso.EN_APROBACION
            ),
            "dias_promedio_espera": _dias_promedio_espera(session, RiskLevel.MUY_ALTO),
        }

    if rol == UserRole.AUDITOR:
        return {
            "total_clientes": session.exec(
                select(func.count()).select_from(ExpedienteKYC)
            ).one(),
            "total_casos_ddr": session.exec(
                select(func.count()).select_from(CasoDDR)
            ).one(),
        }

    return {}
