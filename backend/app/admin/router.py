from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlmodel import desc, select

from app.audit.models import AuditLog
from app.auth.dependencies import AdminUserDep, SessionDep
from app.auth.models import User
from app.core.enums import PostStatus, UserStatus
from app.posts.models import MediaPost

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users")
def list_users(_: AdminUserDep, session: SessionDep) -> list[dict]:
    users = session.exec(select(User).order_by(desc(User.created_at)).limit(100)).all()
    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "status": user.status,
            "subscription_status": user.subscription_status,
            "created_at": user.created_at,
        }
        for user in users
    ]


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
def list_admin_posts(_: AdminUserDep, session: SessionDep) -> list[dict]:
    posts = session.exec(select(MediaPost).order_by(desc(MediaPost.created_at)).limit(100)).all()
    return [
        {"id": post.id, "user_id": post.user_id, "title": post.title, "status": post.status, "created_at": post.created_at}
        for post in posts
    ]


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
    return [
        {
            "id": log.id,
            "actor_user_id": log.actor_user_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "reason": log.reason,
            "created_at": log.created_at,
        }
        for log in logs
    ]
