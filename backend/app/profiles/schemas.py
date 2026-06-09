from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileUpsertRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=80)
    bio: str | None = Field(default=None, max_length=1000)
    location_label: str | None = Field(default=None, max_length=120)


class ProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    display_name: str
    slug: str
    bio: str | None
    location_label: str | None
    created_at: datetime


class ProfileVisitResponse(BaseModel):
    id: UUID
    visited_at: datetime
    profile: ProfileResponse | None = None


class ProfileVisitSummaryResponse(BaseModel):
    count: int
    visits: list[ProfileVisitResponse]
