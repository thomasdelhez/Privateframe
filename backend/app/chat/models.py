from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel

from app.core.enums import ConversationStatus, MessageStatus


class Conversation(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_a_id: UUID = Field(foreign_key="user.id", index=True)
    user_b_id: UUID = Field(foreign_key="user.id", index=True)
    status: ConversationStatus = Field(default=ConversationStatus.ACTIVE, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Message(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    conversation_id: UUID = Field(foreign_key="conversation.id", index=True)
    sender_id: UUID = Field(foreign_key="user.id", index=True)
    body: str = Field(max_length=2000)
    status: MessageStatus = Field(default=MessageStatus.SENT)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    read_at: datetime | None = None
    deleted_at: datetime | None = None
