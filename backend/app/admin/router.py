from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlmodel import desc, select

from app.audit.models import AuditLog
from app.auth.dependencies import AdminUserDep, SessionDep
from app.auth.models import User
from app.chat.models import Conversation, Message
from app.core.enums import PostStatus, UserStatus
from app.posts.models import MediaPost
from app.posts.service import to_post_response
from app.profiles.models import Profile
from app.profiles.service import to_profile_response
from app.reports.models import Report

router = APIRouter(prefix="/admin", tags=["Admin"])


def _profile_for_user(user_id: UUID, session: SessionDep) -> Profile | None:
    return session.exec(select(Profile).where(Profile.user_id == user_id)).first()


def _serialize_user(user: User, session: SessionDep) -> dict:
    profile = _profile_for_user(user.id, session)
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "status": user.status,
        "subscription_status": user.subscription_status,
        "created_at": user.created_at,
        "profile_slug": profile.slug if profile else None,
        "display_name": profile.display_name if profile else None,
    }


def _serialize_admin_post(post: MediaPost, session: SessionDep, admin: User) -> dict:
    profile = _profile_for_user(post.user_id, session)
    post_response = to_post_response(post, admin, session)
    return {
        "id": post.id,
        "user_id": post.user_id,
        "title": post.title,
        "description": post.description,
        "status": post.status,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "removed_at": post.removed_at,
        "profile_slug": profile.slug if profile else None,
        "display_name": profile.display_name if profile else None,
        "assets": [asset.model_dump(mode="json") for asset in post_response.assets],
    }


def _serialize_audit_entity(log: AuditLog, session: SessionDep) -> tuple[str | None, str | None]:
    if log.entity_type == "user":
        try:
            user = session.get(User, UUID(log.entity_id))
        except ValueError:
            user = None
        if user:
            profile = _profile_for_user(user.id, session)
            label = profile.display_name or user.email
            route = f"/discover/{profile.slug}" if profile else None
            return label, route
        return None, None

    if log.entity_type == "post":
        try:
            post = session.get(MediaPost, UUID(log.entity_id))
        except ValueError:
            post = None
        if post:
            profile = _profile_for_user(post.user_id, session)
            label = post.title
            route = f"/discover/{profile.slug}" if profile else None
            return label, route
        return None, None

    return None, None


@router.get("/users")
def list_users(_: AdminUserDep, session: SessionDep) -> list[dict]:
    users = session.exec(select(User).order_by(desc(User.created_at)).limit(100)).all()
    return [_serialize_user(user, session) for user in users]


@router.post("/users/{user_id}/restrict")
def restrict_user(user_id: UUID, admin: AdminUserDep, session: SessionDep) -> dict:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")
    user.status = UserStatus.RESTRICTED
    session.add(user)
    session.add(AuditLog(actor_user_id=admin.id, action="restrict", entity_type="user", entity_id=str(user.id)))
    session.commit()
    return {"id": user.id, "status": user.status}


@router.post("/users/{user_id}/ban")
def ban_user(user_id: UUID, admin: AdminUserDep, session: SessionDep) -> dict:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")
    user.status = UserStatus.BANNED
    session.add(user)
    session.add(AuditLog(actor_user_id=admin.id, action="ban", entity_type="user", entity_id=str(user.id)))
    session.commit()
    return {"id": user.id, "status": user.status}


@router.get("/posts")
def list_admin_posts(admin: AdminUserDep, session: SessionDep) -> list[dict]:
    posts = session.exec(select(MediaPost).order_by(desc(MediaPost.created_at)).limit(100)).all()
    return [_serialize_admin_post(post, session, admin) for post in posts]


@router.get("/posts/{post_id}")
def read_admin_post(post_id: UUID, admin: AdminUserDep, session: SessionDep) -> dict:
    post = session.get(MediaPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post niet gevonden")
    return _serialize_admin_post(post, session, admin)


@router.post("/posts/{post_id}/hide")
def hide_post(post_id: UUID, admin: AdminUserDep, session: SessionDep) -> dict:
    post = session.get(MediaPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post niet gevonden")
    post.status = PostStatus.HIDDEN
    post.updated_at = datetime.now(UTC)
    session.add(post)
    session.add(AuditLog(actor_user_id=admin.id, action="hide", entity_type="post", entity_id=str(post.id)))
    session.commit()
    return {"id": post.id, "status": post.status}


@router.post("/posts/{post_id}/remove")
def remove_post(post_id: UUID, admin: AdminUserDep, session: SessionDep) -> dict:
    post = session.get(MediaPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post niet gevonden")
    post.status = PostStatus.REMOVED
    post.removed_at = datetime.now(UTC)
    post.updated_at = datetime.now(UTC)
    session.add(post)
    session.add(AuditLog(actor_user_id=admin.id, action="remove", entity_type="post", entity_id=str(post.id)))
    session.commit()
    return {"id": post.id, "status": post.status}


@router.get("/audit")
def list_audit(_: AdminUserDep, session: SessionDep) -> list[dict]:
    logs = session.exec(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(100)).all()
    payload: list[dict] = []
    for log in logs:
        actor = session.get(User, log.actor_user_id)
        entity_label, entity_route = _serialize_audit_entity(log, session)
        payload.append(
            {
                "id": log.id,
                "actor_user_id": log.actor_user_id,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "reason": log.reason,
                "created_at": log.created_at,
                "actor": _serialize_user(actor, session) if actor else None,
                "entity_label": entity_label,
                "entity_route": entity_route,
            }
        )
    return payload


@router.get("/reports/{report_id}/context")
def read_report_context(report_id: UUID, admin: AdminUserDep, session: SessionDep) -> dict:
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Melding niet gevonden")

    reporter = session.get(User, report.reporter_user_id)
    response: dict = {
        "report": {
            "id": report.id,
            "reporter_user_id": report.reporter_user_id,
            "target_type": report.target_type,
            "target_id": report.target_id,
            "reason": report.reason,
            "description": report.description,
            "status": report.status,
            "created_at": report.created_at,
            "resolved_at": report.resolved_at,
        },
        "reporter": _serialize_user(reporter, session) if reporter else None,
    }

    if report.target_type.value == "profile":
        profile = _profile_for_user(report.target_id, session)
        response["profile"] = to_profile_response(profile).model_dump(mode="json") if profile else None

    if report.target_type.value == "post":
        post = session.get(MediaPost, report.target_id)
        response["post"] = _serialize_admin_post(post, session, admin) if post else None

    if report.target_type.value in {"conversation", "message"}:
        message_target = session.get(Message, report.target_id) if report.target_type.value == "message" else None
        conversation_id = message_target.conversation_id if message_target else report.target_id
        conversation = session.get(Conversation, conversation_id)
        if conversation:
            messages = session.exec(
                select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
            ).all()
            response["conversation"] = {
                "id": conversation.id,
                "status": conversation.status,
                "user_a_id": conversation.user_a_id,
                "user_b_id": conversation.user_b_id,
                "created_at": conversation.created_at,
                "updated_at": conversation.updated_at,
                "participants": [
                    _serialize_user(user, session)
                    for user in [session.get(User, conversation.user_a_id), session.get(User, conversation.user_b_id)]
                    if user
                ],
            }
            response["reported_message_id"] = message_target.id if message_target else None
            response["message_count"] = len(messages)
            response["messages"] = [
                {
                    "id": item.id,
                    "conversation_id": item.conversation_id,
                    "sender_id": item.sender_id,
                    "body": item.body,
                    "status": item.status,
                    "created_at": item.created_at,
                    "read_at": item.read_at,
                }
                for item in messages
            ]

    return response
