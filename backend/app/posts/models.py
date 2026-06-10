from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.core.enums import AccessRequestStatus, PostStatus


class MediaPost(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    title: str = Field(max_length=160)
    description: str | None = Field(default=None, max_length=1500)
    is_private: bool = False
    status: PostStatus = Field(default=PostStatus.PUBLISHED, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    removed_at: datetime | None = None


class MediaAsset(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    post_id: UUID = Field(foreign_key="mediapost.id", index=True)
    storage_key: str
    preview_key: str | None = None
    mime_type: str = Field(max_length=120)
    file_size: int
    checksum: str | None = Field(default=None, index=True)
    is_hidden: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ConsentConfirmation(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    post_id: UUID = Field(foreign_key="mediapost.id", index=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    confirms_age: bool
    confirms_rights: bool
    confirms_no_minors: bool
    confirms_permission: bool
    ip_address: str | None = Field(default=None, max_length=64)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PostAccessRequest(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("post_id", "requester_user_id", name="uq_postaccessrequest_pair"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    post_id: UUID = Field(foreign_key="mediapost.id", index=True)
    requester_user_id: UUID = Field(foreign_key="user.id", index=True)
    status: AccessRequestStatus = Field(default=AccessRequestStatus.PENDING, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    decided_at: datetime | None = None
