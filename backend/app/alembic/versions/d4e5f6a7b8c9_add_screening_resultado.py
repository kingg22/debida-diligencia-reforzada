"""add screening_resultado table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-20 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "screening_resultado",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("expediente_id", sa.Uuid(), nullable=False),
        sa.Column("lista", sa.String(length=20), nullable=False),
        sa.Column("nombre_entrada", sa.String(length=200), nullable=False),
        sa.Column("similitud", sa.Integer(), nullable=False),
        sa.Column("es_falso_positivo", sa.Boolean(), nullable=False),
        sa.Column("revisado_por_id", sa.Uuid(), nullable=True),
        sa.Column("revisado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["expediente_id"], ["expedientekyc.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["revisado_por_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_screening_resultado_expediente_id", "screening_resultado", ["expediente_id"])


def downgrade() -> None:
    op.drop_index("ix_screening_resultado_expediente_id", table_name="screening_resultado")
    op.drop_table("screening_resultado")
