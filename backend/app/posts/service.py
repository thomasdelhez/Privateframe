import hashlib
import io
import mimetypes
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from PIL import Image, ImageFilter, UnidentifiedImageError
from sqlmodel import Session, desc, select

from app.auth.models import User
from app.core.config import get_settings
from app.core.enums import AccessRequestStatus, PostStatus, UserRole
from app.posts.models import ConsentConfirmation, MediaAsset, MediaPost, PostAccessRequest
from app.posts.schemas import MediaItemResponse, PostCreateRequest, PostResponse
from app.social.service import block_between, blocked_user_ids

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024


def _can_view_full(user: User, post: MediaPost, session: Session) -> bool:
    if user.id == post.user_id or user.role in [UserRole.MODERATOR, UserRole.ADMIN]:
        return True
    if not post.is_private:
        return user.role in [UserRole.PREMIUM, UserRole.MODERATOR, UserRole.ADMIN]
    if block_between(session, user.id, post.user_id):
        return False
    request = session.exec(
        select(PostAccessRequest).where(
            PostAccessRequest.post_id == post.id,
            PostAccessRequest.requester_user_id == user.id,
            PostAccessRequest.status == AccessRequestStatus.APPROVED,
        )
    ).first()
    return request is not None


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
        hidden=asset.is_hidden,
    )


def to_post_response(post: MediaPost, viewer: User, session: Session) -> PostResponse:
    assets = list(session.exec(select(MediaAsset).where(MediaAsset.post_id == post.id)).all())
    if viewer.id != post.user_id and viewer.role not in [UserRole.MODERATOR, UserRole.ADMIN]:
        assets = [asset for asset in assets if not asset.is_hidden]
    can_view_full = _can_view_full(viewer, post, session)
    access_request = session.exec(
        select(PostAccessRequest).where(
            PostAccessRequest.post_id == post.id,
            PostAccessRequest.requester_user_id == viewer.id,
        )
    ).first()
    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        title=post.title,
        description=post.description,
        is_private=post.is_private,
        access_status=access_request.status if access_request else None,
        status=post.status,
        created_at=post.created_at,
        assets=[_media_response(asset, can_view_full) for asset in assets],
    )


def create_post(user: User, payload: PostCreateRequest, session: Session, ip_address: str | None) -> MediaPost:
    if not all([payload.rule_age, payload.rule_rights, payload.rule_safe, payload.rule_permission]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alle bevestigingen zijn verplicht")

    post = MediaPost(
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        is_private=payload.is_private,
    )
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


def list_posts(session: Session, viewer_user_id: UUID | None = None) -> list[MediaPost]:
    statement = select(MediaPost).where(MediaPost.status == PostStatus.PUBLISHED)
    if viewer_user_id:
        blocked = blocked_user_ids(session, viewer_user_id)
        if blocked:
            statement = statement.where(MediaPost.user_id.notin_(blocked))
    return list(
        session.exec(
            statement.order_by(desc(MediaPost.created_at)).limit(100)
        ).all()
    )


def list_posts_for_user(
    user_id: UUID,
    session: Session,
    limit: int = 100,
    viewer_user_id: UUID | None = None,
) -> list[MediaPost]:
    if viewer_user_id and user_id in blocked_user_ids(session, viewer_user_id):
        return []
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
    if not _has_valid_image_signature(content_type, content) or not _is_decodable_image(content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bestandsinhoud komt niet overeen met het afbeeldingsformaat",
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
    preview_key = f"posts/{post.id}/{asset.id}-preview{suffix}"
    media_path = _ensure_inside_media_root(_resolve_media_path(storage_key))
    media_path.parent.mkdir(parents=True, exist_ok=True)
    media_path.write_bytes(content)
    preview_path = _ensure_inside_media_root(_resolve_media_path(preview_key))
    _write_preview(content, preview_path, content_type)

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
    if not _can_view_full(user, post, session):
        if post.is_private:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Toegang tot dit privéalbum is niet goedgekeurd",
            )
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Premium vereist")
    return post


def guess_download_name(asset: MediaAsset) -> str:
    suffix = Path(asset.storage_key).suffix
    if not suffix:
        suffix = mimetypes.guess_extension(asset.mime_type or "") or ""
    return f"privateframe-{asset.id}{suffix}"


def _has_valid_image_signature(content_type: str, content: bytes) -> bool:
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "image/gif":
        return content.startswith((b"GIF87a", b"GIF89a"))
    if content_type == "image/webp":
        return len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    return False


def _is_decodable_image(content: bytes) -> bool:
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
        return True
    except (UnidentifiedImageError, OSError):
        return False


def _write_preview(content: bytes, path: Path, content_type: str) -> None:
    with Image.open(io.BytesIO(content)) as source:
        source.seek(0)
        image = source.convert("RGB")
        image.thumbnail((720, 900))
        image = image.filter(ImageFilter.GaussianBlur(radius=18))
        path.parent.mkdir(parents=True, exist_ok=True)
        output_format = {
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/webp": "WEBP",
            "image/gif": "GIF",
        }[content_type]
        image.save(path, format=output_format, quality=72, optimize=True)
