from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileUpsertRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=80)
    bio: str | None = Field(default=None, max_length=1000)
    location_label: str | None = Field(default=None, max_length=120)
    gender: str | None = Field(default=None, max_length=80)
    age_label: str | None = Field(default=None, max_length=40)
    interests: list[str] = Field(default_factory=list, max_length=10)
    discoverable: bool = True
    show_online_status: bool = True
    show_location: bool = True
    register_profile_views: bool = True


class ProfileAvatarRequest(BaseModel):
    media_id: UUID | None = None


class ProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    display_name: str
    slug: str
    bio: str | None
    location_label: str | None
    gender: str | None
    age_label: str | None
    interests: list[str]
    discoverable: bool
    show_online_status: bool
    show_location: bool
    register_profile_views: bool
    avatar_media_id: UUID | None = None
    avatar_url: str | None = None
    is_favorite: bool = False
    is_liked: bool = False
    is_match: bool = False
    is_blocked: bool = False
    last_active_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProfileVisitResponse(BaseModel):
    id: UUID
    visited_at: datetime
    profile: ProfileResponse | None = None


class ProfileVisitSummaryResponse(BaseModel):
    count: int
    visits: list[ProfileVisitResponse]
