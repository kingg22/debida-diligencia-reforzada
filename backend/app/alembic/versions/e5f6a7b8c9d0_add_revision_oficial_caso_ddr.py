"""Agrega columnas de revisión del Oficial al caso DDR

Soporta el paso EN_REVISION_OFICIAL del flujo de cuatro ojos:
- validado_por_id: Oficial que validó el trabajo del analista
- observaciones_oficial: observaciones al devolver el caso al analista

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-05
"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "caso_ddr",
        sa.Column("validado_por_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "caso_ddr",
        sa.Column(
            "observaciones_oficial",
            sqlmodel.sql.sqltypes.AutoString(length=1000),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_caso_ddr_validado_por_id_user",
        "caso_ddr",
        "user",
        ["validado_por_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint(
        "fk_caso_ddr_validado_por_id_user", "caso_ddr", type_="foreignkey"
    )
    op.drop_column("caso_ddr", "observaciones_oficial")
    op.drop_column("caso_ddr", "validado_por_id")
