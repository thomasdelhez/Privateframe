from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel

from app.core.enums import ReportReason, ReportStatus, ReportTargetType


class Report(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    reporter_user_id: UUID = Field(foreign_key="user.id", index=True)
    target_type: ReportTargetType = Field(index=True)
    target_id: UUID = Field(index=True)
    reason: ReportReason = Field(index=True)
    description: str | None = Field(default=None, max_length=2000)
    status: ReportStatus = Field(default=ReportStatus.OPEN, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    resolved_at: datetime | None = None
    resolved_by: UUID | None = Field(default=None, foreign_key="user.id")
