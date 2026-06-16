"""add SGDDR schema: auditoria, PEP, lista restrictiva

Revision ID: a1b2c3d4e5f6
Revises: 69feb88c7960
Create Date: 2026-06-14 12:00:00.000000

"""
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "69feb88c7960"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1) User: lockout fields ─────────────────────────────────────────
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

    # ── 2) PEP simulado ──────────────────────────────────────────────────
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

    # ── 3) Lista restrictiva simulada ───────────────────────────────────
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


def downgrade():
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
