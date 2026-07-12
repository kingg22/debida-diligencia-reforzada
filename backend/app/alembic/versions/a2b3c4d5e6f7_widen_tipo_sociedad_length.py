"""Amplía tipo_sociedad a 40 caracteres

El option "SOCIEDAD_RESPONSABILIDAD_LIMITADA" del formulario KYC (33
caracteres) supera el límite de 30 del campo, por lo que el backend
rechazaba el expediente con 422 al crear una Persona Jurídica S.R.L.

Revision ID: a2b3c4d5e6f7
Revises: f6a7b8c9d0e1
Create Date: 2026-07-12
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a2b3c4d5e6f7"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "personajuridica",
        "tipo_sociedad",
        existing_type=sa.String(length=30),
        type_=sa.String(length=40),
        existing_nullable=False,
    )


def downgrade():
    op.alter_column(
        "personajuridica",
        "tipo_sociedad",
        existing_type=sa.String(length=40),
        type_=sa.String(length=30),
        existing_nullable=False,
    )
