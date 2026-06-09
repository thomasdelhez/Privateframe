from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlmodel import Session, and_, func, or_, select

from app.auth.dependencies import PremiumUserDep, SessionDep, get_active_user_by_session_value
from app.chat.models import Conversation, Message
from app.chat.realtime import chat_realtime_hub
from app.core.enums import ConversationStatus, MessageStatus, UserRole

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


def _count_unread_for_user(session: Session, conversation_id: UUID, user_id: UUID) -> int:
    unread_count = session.exec(
        select(func.count())
        .select_from(Message)
        .where(
            and_(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.read_at.is_(None),
            )
        )
    ).one()
    return int(unread_count or 0)


def _count_total_unread(session: Session, user_id: UUID) -> int:
    total = session.exec(
        select(func.count())
        .select_from(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            and_(
                or_(Conversation.user_a_id == user_id, Conversation.user_b_id == user_id),
                Message.sender_id != user_id,
                Message.read_at.is_(None),
            )
        )
    ).one()
    return int(total or 0)


def _get_last_message(session: Session, conversation_id: UUID) -> Message | None:
    return session.exec(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.desc())
    ).first()


def _serialize_conversation_for_user(session: Session, item: Conversation, user_id: UUID) -> dict:
    return _serialize_conversation(
        item,
        unread_count=_count_unread_for_user(session, item.id, user_id),
        last_message=_get_last_message(session, item.id),
    )


async def _emit_unread_summary(session: Session, user_id: UUID) -> None:
    await chat_realtime_hub.send_to_user(
        user_id,
        {
            "type": "unread_summary",
            "unread_count": _count_total_unread(session, user_id),
        },
    )


async def _emit_conversation_update(session: Session, conversation: Conversation, user_id: UUID) -> None:
    await chat_realtime_hub.send_to_user(
        user_id,
        {
            "type": "conversation_updated",
            "conversation": _serialize_conversation_for_user(session, conversation, user_id),
        },
    )
    await _emit_unread_summary(session, user_id)


async def _broadcast_conversation_update(session: Session, conversation: Conversation) -> None:
    for user_id in [conversation.user_a_id, conversation.user_b_id]:
        await _emit_conversation_update(session, conversation, user_id)


@router.get("")
def list_conversations(user: PremiumUserDep, session: SessionDep) -> list[dict]:
    conversations = session.exec(
        select(Conversation).where(or_(Conversation.user_a_id == user.id, Conversation.user_b_id == user.id))
    ).all()

    response: list[dict] = []
    for item in conversations:
        response.append(_serialize_conversation_for_user(session, item, user.id))
    return response


@router.post("")
async def create_conversation(
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
        return _serialize_conversation_for_user(session, existing, user.id)

    conversation = Conversation(user_a_id=user.id, user_b_id=other_user_id)
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    await _broadcast_conversation_update(session, conversation)
    return _serialize_conversation_for_user(session, conversation, user.id)


@router.websocket("/ws")
async def chat_ws(
    websocket: WebSocket,
    token: Annotated[str, Query(min_length=1)],
    session: SessionDep,
) -> None:
    try:
        user = get_active_user_by_session_value(session, token)
    except HTTPException:
        await websocket.close(code=4401)
        return

    if user.email_verified_at is None or user.age_confirmed_at is None:
        await websocket.close(code=4403)
        return
    if user.role not in [UserRole.PREMIUM, UserRole.MODERATOR, UserRole.ADMIN]:
        await websocket.close(code=4402)
        return

    await chat_realtime_hub.connect(user.id, websocket)
    await _emit_unread_summary(session, user.id)

    try:
        while True:
            message = await websocket.receive_json()
            if isinstance(message, dict) and message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        chat_realtime_hub.disconnect(user.id, websocket)
    except Exception:
        chat_realtime_hub.disconnect(user.id, websocket)


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
async def send_message(
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
    payload = _serialize_message(message)
    for participant_id in [conversation.user_a_id, conversation.user_b_id]:
        await chat_realtime_hub.send_to_user(participant_id, {"type": "message_created", "message": payload})
    await _broadcast_conversation_update(session, conversation)
    return payload


@router.post("/{conversation_id}/read")
async def mark_conversation_read(conversation_id: UUID, user: PremiumUserDep, session: SessionDep) -> dict:
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
    await chat_realtime_hub.send_to_user(
        conversation.user_a_id,
        {
            "type": "messages_read",
            "conversation_id": str(conversation.id),
            "read_by": str(user.id),
            "read_at": now.isoformat(),
            "message_ids": [str(message.id) for message in unread_messages],
        },
    )
    await chat_realtime_hub.send_to_user(
        conversation.user_b_id,
        {
            "type": "messages_read",
            "conversation_id": str(conversation.id),
            "read_by": str(user.id),
            "read_at": now.isoformat(),
            "message_ids": [str(message.id) for message in unread_messages],
        },
    )
    await _broadcast_conversation_update(session, conversation)
    return {"conversation_id": str(conversation.id), "read_count": len(unread_messages)}


@router.post("/{conversation_id}/block")
async def block_conversation(conversation_id: UUID, user: PremiumUserDep, session: SessionDep) -> dict:
    conversation = session.get(Conversation, conversation_id)
    if not conversation or user.id not in [conversation.user_a_id, conversation.user_b_id]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gesprek niet gevonden")
    conversation.status = ConversationStatus.BLOCKED
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    await _broadcast_conversation_update(session, conversation)
    return _serialize_conversation_for_user(session, conversation, user.id)


@router.post("/{conversation_id}/unblock")
async def unblock_conversation(conversation_id: UUID, user: PremiumUserDep, session: SessionDep) -> dict:
    conversation = session.get(Conversation, conversation_id)
    if not conversation or user.id not in [conversation.user_a_id, conversation.user_b_id]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gesprek niet gevonden")
    conversation.status = ConversationStatus.ACTIVE
    conversation.updated_at = datetime.now(UTC)
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    await _broadcast_conversation_update(session, conversation)
    return _serialize_conversation_for_user(session, conversation, user.id)
