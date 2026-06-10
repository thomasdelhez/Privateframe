from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import AccessRequestStatus, PostStatus


class PostCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=1500)
    is_private: bool = False
    rule_age: bool
    rule_rights: bool
    rule_safe: bool
    rule_permission: bool


class PostUpdateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=1500)


class MediaItemResponse(BaseModel):
    id: UUID
    post_id: UUID
    url: str | None
    preview_url: str | None
    locked: bool
    mime_type: str
    file_size: int
    hidden: bool = False


class PostResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: str | None
    is_private: bool
    access_status: AccessRequestStatus | None = None
    status: PostStatus
    created_at: datetime
    assets: list[MediaItemResponse]


class UploadResponse(BaseModel):
    asset: MediaItemResponse


class AssetUploadResponse(BaseModel):
    post: PostResponse
    asset: MediaItemResponse


class PostAccessRequestResponse(BaseModel):
    id: UUID
    post_id: UUID
    requester_user_id: UUID
    requester_display_name: str | None = None
    requester_slug: str | None = None
    post_title: str
    status: AccessRequestStatus
    created_at: datetime
    decided_at: datetime | None
