from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class AuditLog(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    actor_user_id: UUID | None = Field(default=None, foreign_key="user.id", index=True)
    action: str = Field(max_length=120, index=True)
    entity_type: str = Field(max_length=120, index=True)
    entity_id: str | None = Field(default=None, max_length=120, index=True)
    reason: str | None = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
