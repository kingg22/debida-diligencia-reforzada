"""add two_factor_auth table for TOTP 2FA

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-18 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "two_factor_auth",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encrypted_secret", sa.String(length=512), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("backup_codes_hashed", sa.Text(), nullable=True),
        sa.Column(
            "backup_codes_remaining",
            sa.Integer(),
            nullable=False,
            server_default="10",
        ),
        sa.Column(
            "last_used_counter", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_two_factor_auth_user_id"),
    )
    # El UniqueConstraint ya crea un índice único (uq_…), suficiente
    # para los lookups por user_id. No añadimos un índice no-único
    # separado para no duplicar el storage.


def downgrade():
    op.drop_table("two_factor_auth")
