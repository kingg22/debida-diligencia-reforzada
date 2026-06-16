"""Add role to User

Revision ID: b7e1c9a2d4f8
Revises: fe56fa70289e
Create Date: 2026-06-08 21:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7e1c9a2d4f8'
down_revision = 'fe56fa70289e'
branch_labels = None
depends_on = None


def upgrade():
    # Add role column with a safe default so existing rows get a value.
    op.add_column(
        'user',
        sa.Column(
            'role',
            sa.String(length=50),
            nullable=False,
            server_default='ANALISTA_DDR',
        ),
    )
    # Backfill: existing superusers become ADMIN.
    op.execute(
        "UPDATE \"user\" SET role = 'ADMIN' WHERE is_superuser = true"
    )


def downgrade():
    op.drop_column('user', 'role')
