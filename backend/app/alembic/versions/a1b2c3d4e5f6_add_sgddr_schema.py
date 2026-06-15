"""add SGDDR schema: user lockout, role, auditoria, PEP, lista restrictiva, KYC, DDR

Revision ID: a1b2c3d4e5f6
Revises: fe56fa70289e
Create Date: 2026-06-14 12:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "fe56fa70289e"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1) User: role + lockout fields ──────────────────────────────────
    op.add_column(
        "user",
        sa.Column(
            "role",
            sa.String(length=50),
            nullable=False,
            server_default="OFICIAL_CUMPLIMIENTO",
        ),
    )
    op.add_column(
        "user",
        sa.Column("intentos_fallidos", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "user",
        sa.Column("bloqueado_hasta", sa.DateTime(timezone=True), nullable=True),
    )

    # ── 2) Auditoria ────────────────────────────────────────────────────
    op.create_table(
        "auditoria",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("modulo", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("accion", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("entidad_tipo", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
        sa.Column("entidad_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("descripcion", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("ip_origen", sqlmodel.sql.sqltypes.AutoString(length=45), nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["user.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auditoria_modulo", "auditoria", ["modulo"])
    op.create_index("ix_auditoria_accion", "auditoria", ["accion"])
    op.create_index("ix_auditoria_entidad_id", "auditoria", ["entidad_id"])

    # ── 3) PEP simulado ──────────────────────────────────────────────────
    op.create_table(
        "pep_simulado",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre_completo", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column("numero_documento", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("tipo_documento", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("pais", sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
        sa.Column("cargo", sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
        sa.Column("institucion", sqlmodel.sql.sqltypes.AutoString(length=150), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pep_simulado_numero_documento", "pep_simulado", ["numero_documento"])

    # ── 4) Lista restrictiva simulada ───────────────────────────────────
    op.create_table(
        "lista_restrictiva_simulada",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fuente", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("nombre_completo", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column("alias", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True),
        sa.Column("numero_documento", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
        sa.Column("pais", sqlmodel.sql.sqltypes.AutoString(length=60), nullable=True),
        sa.Column("motivo", sqlmodel.sql.sqltypes.AutoString(length=200), nullable=True),
        sa.Column(
            "fecha_inclusion",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lista_restrictiva_simulada_fuente", "lista_restrictiva_simulada", ["fuente"])
    op.create_index(
        "ix_lista_restrictiva_simulada_numero_documento",
        "lista_restrictiva_simulada",
        ["numero_documento"],
    )

    # ── 5) Expediente KYC ───────────────────────────────────────────────
    op.create_table(
        "expediente_kyc",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombres", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("apellidos", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("tipo_identificacion", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("numero_identificacion", sqlmodel.sql.sqltypes.AutoString(length=30), nullable=False),
        sa.Column("estado", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default="PENDIENTE"),
        sa.Column("nivel_riesgo", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default="BAJO"),
        sa.Column("puntaje_riesgo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ddr_requerida", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("es_pep", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("oficial_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["oficial_id"], ["user.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_expediente_kyc_numero_identificacion",
        "expediente_kyc",
        ["numero_identificacion"],
    )
    op.create_index("ix_expediente_kyc_estado", "expediente_kyc", ["estado"])
    op.create_index("ix_expediente_kyc_nivel_riesgo", "expediente_kyc", ["nivel_riesgo"])

    # ── 6) Caso DDR ─────────────────────────────────────────────────────
    op.create_table(
        "caso_ddr",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expediente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("analista_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("estado", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default="ABIERTO"),
        sa.Column("nivel_riesgo", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default="BAJO"),
        sa.Column("aprobado_por_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("fecha_apertura", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("fecha_cierre", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observaciones_rechazo", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["analista_id"], ["user.id"], ),
        sa.ForeignKeyConstraint(["aprobado_por_id"], ["user.id"], ),
        sa.ForeignKeyConstraint(["expediente_id"], ["expediente_kyc.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_caso_ddr_expediente_id", "caso_ddr", ["expediente_id"])
    op.create_index("ix_caso_ddr_analista_id", "caso_ddr", ["analista_id"])
    op.create_index("ix_caso_ddr_estado", "caso_ddr", ["estado"])
    op.create_index("ix_caso_ddr_nivel_riesgo", "caso_ddr", ["nivel_riesgo"])


def downgrade():
    op.drop_index("ix_caso_ddr_nivel_riesgo", table_name="caso_ddr")
    op.drop_index("ix_caso_ddr_estado", table_name="caso_ddr")
    op.drop_index("ix_caso_ddr_analista_id", table_name="caso_ddr")
    op.drop_index("ix_caso_ddr_expediente_id", table_name="caso_ddr")
    op.drop_table("caso_ddr")

    op.drop_index("ix_expediente_kyc_nivel_riesgo", table_name="expediente_kyc")
    op.drop_index("ix_expediente_kyc_estado", table_name="expediente_kyc")
    op.drop_index("ix_expediente_kyc_numero_identificacion", table_name="expediente_kyc")
    op.drop_table("expediente_kyc")

    op.drop_index(
        "ix_lista_restrictiva_simulada_numero_documento",
        table_name="lista_restrictiva_simulada",
    )
    op.drop_index("ix_lista_restrictiva_simulada_fuente", table_name="lista_restrictiva_simulada")
    op.drop_table("lista_restrictiva_simulada")

    op.drop_index("ix_pep_simulado_numero_documento", table_name="pep_simulado")
    op.drop_table("pep_simulado")

    op.drop_index("ix_auditoria_entidad_id", table_name="auditoria")
    op.drop_index("ix_auditoria_accion", table_name="auditoria")
    op.drop_index("ix_auditoria_modulo", table_name="auditoria")
    op.drop_table("auditoria")

    op.drop_column("user", "bloqueado_hasta")
    op.drop_column("user", "intentos_fallidos")
    op.drop_column("user", "role")
