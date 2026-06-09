from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel

from app.core.enums import SubscriptionStatus, UserRole, UserStatus


class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    password_hash: str
    role: UserRole = Field(default=UserRole.FREE)
    subscription_status: SubscriptionStatus = Field(default=SubscriptionStatus.FREE)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    age_confirmed_at: datetime | None = None
    age_confirmation_ip: str | None = Field(default=None, max_length=64)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class UserSession(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    value: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
