"""add riesgo override and parametros table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "expedientekyc",
        sa.Column("nivel_riesgo_override", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "expedientekyc",
        sa.Column("justificacion_override", sa.String(length=500), nullable=True),
    )

    op.create_table(
        "parametro_riesgo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("factor", sa.String(length=100), nullable=False),
        sa.Column("descripcion", sa.String(length=300), nullable=False),
        sa.Column("peso", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_parametro_riesgo_factor", "parametro_riesgo", ["factor"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_parametro_riesgo_factor", table_name="parametro_riesgo")
    op.drop_table("parametro_riesgo")
    op.drop_column("expedientekyc", "justificacion_override")
    op.drop_column("expedientekyc", "nivel_riesgo_override")
