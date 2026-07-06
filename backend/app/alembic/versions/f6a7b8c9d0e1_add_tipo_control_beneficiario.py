"""Agrega tipo_control al beneficiario final (Ley 254/2021)

El formulario ya recopilaba cómo ejerce el control el beneficiario
(directa/indirecta) pero el dato se descartaba al no existir la columna.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-05
"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "beneficiariofinal",
        sa.Column(
            "tipo_control",
            sqlmodel.sql.sqltypes.AutoString(length=20),
            nullable=False,
            server_default="DIRECTA",
        ),
    )


def downgrade():
    op.drop_column("beneficiariofinal", "tipo_control")
