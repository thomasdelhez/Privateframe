from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session, desc, select

from app.auth.models import User
from app.core.enums import PostStatus, UserRole
from app.posts.models import ConsentConfirmation, MediaAsset, MediaPost
from app.posts.schemas import MediaItemResponse, PostCreateRequest, PostResponse


def _can_view_full(user: User) -> bool:
    return user.role in [UserRole.PREMIUM, UserRole.MODERATOR, UserRole.ADMIN]


def _media_response(asset: MediaAsset, can_view_full: bool) -> MediaItemResponse:
    return MediaItemResponse(
        id=asset.id,
        post_id=asset.post_id,
        url=f"/api/v1/posts/assets/{asset.id}" if can_view_full else None,
        preview_url=f"/api/v1/posts/assets/{asset.id}/preview",
        locked=not can_view_full,
        mime_type=asset.mime_type,
        file_size=asset.file_size,
    )


def to_post_response(post: MediaPost, viewer: User, session: Session) -> PostResponse:
    assets = list(session.exec(select(MediaAsset).where(MediaAsset.post_id == post.id)).all())
    can_view_full = _can_view_full(viewer)
    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        title=post.title,
        description=post.description,
        status=post.status,
        created_at=post.created_at,
        assets=[_media_response(asset, can_view_full) for asset in assets],
    )


def create_post(user: User, payload: PostCreateRequest, session: Session, ip_address: str | None) -> MediaPost:
    if not all([payload.rule_age, payload.rule_rights, payload.rule_safe, payload.rule_permission]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alle bevestigingen zijn verplicht")

    post = MediaPost(user_id=user.id, title=payload.title, description=payload.description)
    session.add(post)
    session.commit()
    session.refresh(post)

    confirmation = ConsentConfirmation(
        post_id=post.id,
        user_id=user.id,
        confirms_age=payload.rule_age,
        confirms_rights=payload.rule_rights,
        confirms_no_minors=payload.rule_safe,
        confirms_permission=payload.rule_permission,
        ip_address=ip_address,
    )
    session.add(confirmation)
    session.commit()
    return post


def list_posts(session: Session) -> list[MediaPost]:
    return list(
        session.exec(
            select(MediaPost).where(MediaPost.status == PostStatus.PUBLISHED).order_by(desc(MediaPost.created_at)).limit(100)
        ).all()
    )


def get_post(post_id: UUID, session: Session) -> MediaPost:
    post = session.get(MediaPost, post_id)
    if not post or post.status != PostStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post niet gevonden")
    return post


def add_demo_asset(post_id: UUID, user: User, session: Session) -> MediaAsset:
    post = session.get(MediaPost, post_id)
    if not post or post.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post niet gevonden")
    asset = MediaAsset(
        post_id=post.id,
        storage_key="demo/full-placeholder.jpg",
        preview_key="demo/preview-placeholder.jpg",
        mime_type="image/jpeg",
        file_size=0,
    )
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset
