"""Add account security fields.

Revision ID: b79a1d7f35c2
Revises: efe6fdc87b1e
Create Date: 2026-06-09 22:40:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "b79a1d7f35c2"
down_revision: str | None = "efe6fdc87b1e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user", sa.Column("email_verified_at", sa.DateTime(), nullable=True))
    op.execute(sa.text('UPDATE "user" SET email_verified_at = updated_at'))

    op.add_column("usersession", sa.Column("expires_at", sa.DateTime(), nullable=True))
    op.add_column("usersession", sa.Column("revoked_at", sa.DateTime(), nullable=True))
    op.execute(sa.text("UPDATE usersession SET expires_at = created_at"))
    with op.batch_alter_table("usersession") as batch:
        batch.alter_column("expires_at", existing_type=sa.DateTime(), nullable=False)
        batch.create_index("ix_usersession_expires_at", ["expires_at"], unique=False)
        batch.create_index("ix_usersession_revoked_at", ["revoked_at"], unique=False)

    op.create_table(
        "accounttoken",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sqlmodel.sql.sqltypes.AutoString(length=40), nullable=False),
        sa.Column("token_hash", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accounttoken_expires_at", "accounttoken", ["expires_at"], unique=False)
    op.create_index("ix_accounttoken_purpose", "accounttoken", ["purpose"], unique=False)
    op.create_index("ix_accounttoken_token_hash", "accounttoken", ["token_hash"], unique=True)
    op.create_index("ix_accounttoken_used_at", "accounttoken", ["used_at"], unique=False)
    op.create_index("ix_accounttoken_user_id", "accounttoken", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_accounttoken_user_id", table_name="accounttoken")
    op.drop_index("ix_accounttoken_used_at", table_name="accounttoken")
    op.drop_index("ix_accounttoken_token_hash", table_name="accounttoken")
    op.drop_index("ix_accounttoken_purpose", table_name="accounttoken")
    op.drop_index("ix_accounttoken_expires_at", table_name="accounttoken")
    op.drop_table("accounttoken")

    with op.batch_alter_table("usersession") as batch:
        batch.drop_index("ix_usersession_revoked_at")
        batch.drop_index("ix_usersession_expires_at")
        batch.drop_column("revoked_at")
        batch.drop_column("expires_at")

    op.drop_column("user", "email_verified_at")
