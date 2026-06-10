"""Add privacy, matching and private album access.

Revision ID: c8d7e6f5a4b3
Revises: b79a1d7f35c2
Create Date: 2026-06-10 13:20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "c8d7e6f5a4b3"
down_revision: str | None = "b79a1d7f35c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("profile", sa.Column("interests", sa.JSON(), nullable=True))
    op.add_column("profile", sa.Column("discoverable", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("profile", sa.Column("show_online_status", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("profile", sa.Column("show_location", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("profile", sa.Column("register_profile_views", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.execute(sa.text("UPDATE profile SET interests = '[]' WHERE interests IS NULL"))
    with op.batch_alter_table("profile") as batch:
        batch.alter_column("interests", existing_type=sa.JSON(), nullable=False)

    op.add_column("mediapost", sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("mediaasset", sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_table(
        "profilefavorite",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("target_user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["target_user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "target_user_id", name="uq_profilefavorite_pair"),
    )
    op.create_index("ix_profilefavorite_created_at", "profilefavorite", ["created_at"])
    op.create_index("ix_profilefavorite_target_user_id", "profilefavorite", ["target_user_id"])
    op.create_index("ix_profilefavorite_user_id", "profilefavorite", ["user_id"])

    op.create_table(
        "profilelike",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("target_user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["target_user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "target_user_id", name="uq_profilelike_pair"),
    )
    op.create_index("ix_profilelike_created_at", "profilelike", ["created_at"])
    op.create_index("ix_profilelike_target_user_id", "profilelike", ["target_user_id"])
    op.create_index("ix_profilelike_user_id", "profilelike", ["user_id"])

    op.create_table(
        "userblock",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("blocker_user_id", sa.Uuid(), nullable=False),
        sa.Column("blocked_user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["blocked_user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["blocker_user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("blocker_user_id", "blocked_user_id", name="uq_userblock_pair"),
    )
    op.create_index("ix_userblock_blocked_user_id", "userblock", ["blocked_user_id"])
    op.create_index("ix_userblock_blocker_user_id", "userblock", ["blocker_user_id"])
    op.create_index("ix_userblock_created_at", "userblock", ["created_at"])

    op.create_table(
        "postaccessrequest",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("requester_user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "APPROVED", "DENIED", name="accessrequeststatus"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["mediapost.id"]),
        sa.ForeignKeyConstraint(["requester_user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "requester_user_id", name="uq_postaccessrequest_pair"),
    )
    op.create_index("ix_postaccessrequest_created_at", "postaccessrequest", ["created_at"])
    op.create_index("ix_postaccessrequest_post_id", "postaccessrequest", ["post_id"])
    op.create_index("ix_postaccessrequest_requester_user_id", "postaccessrequest", ["requester_user_id"])
    op.create_index("ix_postaccessrequest_status", "postaccessrequest", ["status"])


def downgrade() -> None:
    op.drop_table("postaccessrequest")
    op.drop_table("userblock")
    op.drop_table("profilelike")
    op.drop_table("profilefavorite")
    op.drop_column("mediapost", "is_private")
    op.drop_column("mediaasset", "is_hidden")
    with op.batch_alter_table("profile") as batch:
        batch.drop_column("register_profile_views")
        batch.drop_column("show_location")
        batch.drop_column("show_online_status")
        batch.drop_column("discoverable")
        batch.drop_column("interests")
