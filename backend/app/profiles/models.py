from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


class Profile(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id", unique=True, index=True)
    display_name: str = Field(max_length=80)
    slug: str = Field(unique=True, index=True, max_length=100)
    bio: str | None = Field(default=None, max_length=1000)
    location_label: str | None = Field(default=None, max_length=120)
    gender: str | None = Field(default=None, max_length=80)
    age_label: str | None = Field(default=None, max_length=40)
    interests: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    discoverable: bool = True
    show_online_status: bool = True
    show_location: bool = True
    register_profile_views: bool = True
    avatar_media_id: UUID | None = None
    banner_media_id: UUID | None = None
    last_active_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ProfileView(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    viewer_user_id: UUID = Field(foreign_key="user.id", index=True)
    viewed_user_id: UUID = Field(foreign_key="user.id", index=True)
    viewed_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)


class ProfileFavorite(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "target_user_id", name="uq_profilefavorite_pair"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    target_user_id: UUID = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)


class ProfileLike(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "target_user_id", name="uq_profilelike_pair"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    target_user_id: UUID = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)


class UserBlock(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("blocker_user_id", "blocked_user_id", name="uq_userblock_pair"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    blocker_user_id: UUID = Field(foreign_key="user.id", index=True)
    blocked_user_id: UUID = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
