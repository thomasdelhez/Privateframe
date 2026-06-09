from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, HTTPException, status
from sqlmodel import and_, func, or_, select

from app.auth.dependencies import PremiumUserDep, SessionDep
from app.chat.models import Conversation, Message
from app.core.enums import ConversationStatus, MessageStatus

router = APIRouter(prefix="/chat", tags=["Chat"])


def _serialize_message(item: Message) -> dict:
    return {
        "id": item.id,
        "conversation_id": item.conversation_id,
        "sender_id": item.sender_id,
        "body": item.body,
        "status": item.status,
        "created_at": item.created_at,
        "read_at": item.read_at,
    }


def _serialize_conversation(item: Conversation, unread_count: int = 0, last_message: Message | None = None) -> dict:
    return {
        "id": item.id,
        "user_a_id": item.user_a_id,
        "user_b_id": item.user_b_id,
        "status": item.status,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "unread_count": unread_count,
        "last_message": _serialize_message(last_message) if last_message else None,
    }


@router.get("")
def list_conversations(user: PremiumUserDep, session: SessionDep) -> list[dict]:
    conversations = session.exec(
        select(Conversation).where(or_(Conversation.user_a_id == user.id, Conversation.user_b_id == user.id))
    ).all()

    response: list[dict] = []
    for item in conversations:
        unread_count = session.exec(
            select(func.count())
            .select_from(Message)
            .where(
                and_(
                    Message.conversation_id == item.id,
                    Message.sender_id != user.id,
                    Message.read_at.is_(None),
                )
            )
        ).one()
        last_message = session.exec(
            select(Message)
            .where(Message.conversation_id == item.id)
            .order_by(Message.created_at.desc())
        ).first()
        response.append(_serialize_conversation(item, unread_count=int(unread_count or 0), last_message=last_message))
    return response


@router.post("")
def create_conversation(
    user: PremiumUserDep,
    session: SessionDep,
    other_user_id: Annotated[UUID, Body(embed=True)],
) -> dict:
    if other_user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Je kunt geen gesprek met jezelf starten")

    existing = session.exec(
        select(Conversation).where(
            or_(
                (Conversation.user_a_id == user.id) & (Conversation.user_b_id == other_user_id),
                (Conversation.user_a_id == other_user_id) & (Conversation.user_b_id == user.id),
            )
        )
    ).first()
    if existing:
        return _serialize_conversation(existing)

    conversation = Conversation(user_a_id=user.id, user_b_id=other_user_id)
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return _serialize_conversation(conversation)


@router.get("/{conversation_id}/messages")
def list_messages(conversation_id: UUID, user: PremiumUserDep, session: SessionDep) -> list[dict]:
    conversation = session.get(Conversation, conversation_id)
    if not conversation or user.id not in [conversation.user_a_id, conversation.user_b_id]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gesprek niet gevonden")
    messages = session.exec(
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
    ).all()
    return [_serialize_message(item) for item in messages]


@router.post("/{conversation_id}/messages")
def send_message(
    conversation_id: UUID,
    user: PremiumUserDep,
    session: SessionDep,
    body: Annotated[str, Body(embed=True)],
) -> dict:
    conversation = session.get(Conversation, conversation_id)
    if not conversation or user.id not in [conversation.user_a_id, conversation.user_b_id]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gesprek niet gevonden")
    if conversation.status != ConversationStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gesprek is niet actief")
    if not body.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bericht is verplicht")
    message = Message(conversation_id=conversation.id, sender_id=user.id, body=body.strip()[:2000])
    conversation.updated_at = datetime.now(UTC)
    session.add(message)
    session.add(conversation)
    session.commit()
    session.refresh(message)
    return _serialize_message(message)


@router.post("/{conversation_id}/read")
def mark_conversation_read(conversation_id: UUID, user: PremiumUserDep, session: SessionDep) -> dict:
    conversation = session.get(Conversation, conversation_id)
    if not conversation or user.id not in [conversation.user_a_id, conversation.user_b_id]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gesprek niet gevonden")

    now = datetime.now(UTC)
    unread_messages = session.exec(
        select(Message).where(
            and_(
                Message.conversation_id == conversation.id,
                Message.sender_id != user.id,
                Message.read_at.is_(None),
            )
        )
    ).all()
    for message in unread_messages:
        message.read_at = now
        message.status = MessageStatus.READ
        session.add(message)

    session.commit()
    return {"conversation_id": str(conversation.id), "read_count": len(unread_messages)}


@router.post("/{conversation_id}/block")
def block_conversation(conversation_id: UUID, user: PremiumUserDep, session: SessionDep) -> dict:
    conversation = session.get(Conversation, conversation_id)
    if not conversation or user.id not in [conversation.user_a_id, conversation.user_b_id]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gesprek niet gevonden")
    conversation.status = ConversationStatus.BLOCKED
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return _serialize_conversation(conversation)
