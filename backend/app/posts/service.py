import hashlib
import mimetypes
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session, desc, select

from app.auth.models import User
from app.core.config import get_settings
from app.core.enums import PostStatus, UserRole
from app.posts.models import ConsentConfirmation, MediaAsset, MediaPost
from app.posts.schemas import MediaItemResponse, PostCreateRequest, PostResponse

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024


def _can_view_full(user: User, owner_user_id: UUID) -> bool:
    return user.id == owner_user_id or user.role in [UserRole.PREMIUM, UserRole.MODERATOR, UserRole.ADMIN]


def _media_root() -> Path:
    root = Path(get_settings().media_storage_path).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _resolve_media_path(storage_key: str) -> Path:
    return (_media_root() / storage_key).resolve()


def _ensure_inside_media_root(path: Path) -> Path:
    root = _media_root()
    if root not in path.parents and path != root:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ongeldige mediaopslag")
    return path


def _public_asset_url(asset_id: UUID, suffix: str = "") -> str:
    suffix_value = f"/{suffix}" if suffix else ""
    return f"/api/v1/posts/assets/{asset_id}{suffix_value}"


def _media_response(asset: MediaAsset, can_view_full: bool) -> MediaItemResponse:
    return MediaItemResponse(
        id=asset.id,
        post_id=asset.post_id,
        url=_public_asset_url(asset.id) if can_view_full else None,
        preview_url=_public_asset_url(asset.id, "preview"),
        locked=not can_view_full,
        mime_type=asset.mime_type,
        file_size=asset.file_size,
    )


def to_post_response(post: MediaPost, viewer: User, session: Session) -> PostResponse:
    assets = list(session.exec(select(MediaAsset).where(MediaAsset.post_id == post.id)).all())
    can_view_full = _can_view_full(viewer, post.user_id)
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
            select(MediaPost)
            .where(MediaPost.status == PostStatus.PUBLISHED)
            .order_by(desc(MediaPost.created_at))
            .limit(100)
        ).all()
    )


def list_posts_for_user(user_id: UUID, session: Session, limit: int = 100) -> list[MediaPost]:
    return list(
        session.exec(
            select(MediaPost)
            .where(MediaPost.status == PostStatus.PUBLISHED, MediaPost.user_id == user_id)
            .order_by(desc(MediaPost.created_at))
            .limit(limit)
        ).all()
    )


def get_post(post_id: UUID, session: Session) -> MediaPost:
    post = session.get(MediaPost, post_id)
    if not post or post.status != PostStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post niet gevonden")
    return post


def get_owned_post(post_id: UUID, user: User, session: Session) -> MediaPost:
    post = session.get(MediaPost, post_id)
    if not post or post.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post niet gevonden")
    return post


def save_uploaded_asset(
    *,
    post_id: UUID,
    user: User,
    session: Session,
    filename: str | None,
    content_type: str | None,
    content: bytes,
) -> MediaAsset:
    post = get_owned_post(post_id, user, session)

    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload is leeg")
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bestand is groter dan 10 MB")
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alleen JPG, PNG, WebP en GIF zijn toegestaan",
        )

    asset = MediaAsset(
        post_id=post.id,
        storage_key="pending",
        preview_key="pending",
        mime_type=content_type,
        file_size=len(content),
        checksum=hashlib.sha256(content).hexdigest(),
    )
    session.add(asset)
    session.commit()
    session.refresh(asset)

    suffix = ALLOWED_IMAGE_TYPES[content_type]
    storage_key = f"posts/{post.id}/{asset.id}{suffix}"
    preview_key = storage_key
    media_path = _ensure_inside_media_root(_resolve_media_path(storage_key))
    media_path.parent.mkdir(parents=True, exist_ok=True)
    media_path.write_bytes(content)

    asset.storage_key = storage_key
    asset.preview_key = preview_key
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


def get_asset(asset_id: UUID, session: Session) -> MediaAsset:
    asset = session.get(MediaAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media niet gevonden")
    return asset


def get_asset_file_path(asset: MediaAsset, *, preview: bool = False) -> Path:
    storage_key = asset.preview_key if preview and asset.preview_key else asset.storage_key
    path = _ensure_inside_media_root(_resolve_media_path(storage_key))
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mediabestand ontbreekt")
    return path


def assert_can_view_asset(asset: MediaAsset, user: User, session: Session, *, preview: bool = False) -> MediaPost:
    post = get_post(asset.post_id, session)
    if preview:
        return post
    if not _can_view_full(user, post.user_id):
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Premium vereist")
    return post


def guess_download_name(asset: MediaAsset) -> str:
    suffix = Path(asset.storage_key).suffix
    if not suffix:
        suffix = mimetypes.guess_extension(asset.mime_type or "") or ""
    return f"privateframe-{asset.id}{suffix}"
