from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import select

from app.auth.dependencies import AgeConfirmedUserDep, SessionDep
from app.core.enums import AccessRequestStatus
from app.core.rate_limit import enforce_user_rate_limit
from app.posts.models import MediaPost, PostAccessRequest
from app.posts.schemas import (
    AssetUploadResponse,
    PostAccessRequestResponse,
    PostCreateRequest,
    PostResponse,
    PostUpdateRequest,
)
from app.posts.service import (
    assert_can_view_asset,
    create_post,
    get_asset,
    get_asset_file_path,
    get_owned_post,
    get_post,
    guess_download_name,
    list_posts,
    list_posts_for_user,
    save_uploaded_asset,
    to_post_response,
    update_post,
)
from app.profiles.models import Profile

router = APIRouter(prefix="/posts", tags=["Posts"])


@router.get("", response_model=list[PostResponse])
def read_posts(
    user: AgeConfirmedUserDep,
    session: SessionDep,
    user_id: Annotated[UUID | None, Query()] = None,
) -> list[PostResponse]:
    posts = (
        list_posts_for_user(user_id, session, viewer_user_id=user.id)
        if user_id
        else list_posts(session, viewer_user_id=user.id)
    )
    return [to_post_response(post, user, session) for post in posts]


@router.post("", response_model=PostResponse)
def create_new_post(
    payload: PostCreateRequest,
    request: Request,
    user: AgeConfirmedUserDep,
    session: SessionDep,
) -> PostResponse:
    post = create_post(user, payload, session, request.client.host if request.client else None)
    return to_post_response(post, user, session)


@router.get("/{post_id}", response_model=PostResponse)
def read_post(post_id: UUID, user: AgeConfirmedUserDep, session: SessionDep) -> PostResponse:
    return to_post_response(get_post(post_id, session), user, session)


@router.put("/{post_id}", response_model=PostResponse)
def update_existing_post(
    post_id: UUID,
    payload: PostUpdateRequest,
    user: AgeConfirmedUserDep,
    session: SessionDep,
) -> PostResponse:
    return to_post_response(update_post(post_id, user, payload, session), user, session)


@router.post("/{post_id}/assets", response_model=AssetUploadResponse)
async def upload_asset(
    post_id: UUID,
    user: AgeConfirmedUserDep,
    session: SessionDep,
    file: Annotated[UploadFile, File(...)],
    request: Request,
) -> AssetUploadResponse:
    enforce_user_rate_limit(request, "upload", str(user.id), attempts=20, window_seconds=3600)
    save_uploaded_asset(
        post_id=post_id,
        user=user,
        session=session,
        filename=file.filename,
        content_type=file.content_type,
        content=await file.read(),
    )
    post = get_post(post_id, session)
    post_response = to_post_response(post, user, session)
    return AssetUploadResponse(
        asset=post_response.assets[-1],
        post=post_response,
    )


@router.get("/assets/{asset_id}")
def read_asset(asset_id: UUID, user: AgeConfirmedUserDep, session: SessionDep) -> FileResponse:
    asset = get_asset(asset_id, session)
    assert_can_view_asset(asset, user, session, preview=False)
    path = get_asset_file_path(asset, preview=False)
    return FileResponse(path, media_type=asset.mime_type, filename=guess_download_name(asset))


@router.get("/assets/{asset_id}/preview")
def read_asset_preview(asset_id: UUID, session: SessionDep) -> FileResponse:
    asset = get_asset(asset_id, session)
    get_post(asset.post_id, session)
    path = get_asset_file_path(asset, preview=True)
    return FileResponse(path, media_type=asset.mime_type, filename=guess_download_name(asset))


@router.post("/assets/{asset_id}/visibility", response_model=PostResponse)
def toggle_asset_visibility(asset_id: UUID, user: AgeConfirmedUserDep, session: SessionDep) -> PostResponse:
    asset = get_asset(asset_id, session)
    post = get_owned_post(asset.post_id, user, session)
    asset.is_hidden = not asset.is_hidden
    session.add(asset)
    session.commit()
    return to_post_response(post, user, session)


def _access_response(item: PostAccessRequest, session: SessionDep) -> PostAccessRequestResponse:
    post = session.get(MediaPost, item.post_id)
    profile = session.exec(select(Profile).where(Profile.user_id == item.requester_user_id)).first()
    return PostAccessRequestResponse(
        id=item.id,
        post_id=item.post_id,
        requester_user_id=item.requester_user_id,
        requester_display_name=profile.display_name if profile else None,
        requester_slug=profile.slug if profile else None,
        post_title=post.title if post else "Onbekend album",
        status=item.status,
        created_at=item.created_at,
        decided_at=item.decided_at,
    )


@router.post("/{post_id}/access", response_model=PostAccessRequestResponse)
def request_post_access(post_id: UUID, user: AgeConfirmedUserDep, session: SessionDep) -> PostAccessRequestResponse:
    post = get_post(post_id, session)
    if not post.is_private or post.user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Toegangsverzoek is niet nodig")
    item = session.exec(
        select(PostAccessRequest).where(
            PostAccessRequest.post_id == post.id,
            PostAccessRequest.requester_user_id == user.id,
        )
    ).first()
    if not item:
        item = PostAccessRequest(post_id=post.id, requester_user_id=user.id)
        session.add(item)
        session.commit()
        session.refresh(item)
    elif item.status == AccessRequestStatus.DENIED:
        item.status = AccessRequestStatus.PENDING
        item.decided_at = None
        session.add(item)
        session.commit()
        session.refresh(item)
    return _access_response(item, session)


@router.get("/access/incoming", response_model=list[PostAccessRequestResponse])
def incoming_access_requests(user: AgeConfirmedUserDep, session: SessionDep) -> list[PostAccessRequestResponse]:
    items = session.exec(
        select(PostAccessRequest)
        .join(MediaPost, MediaPost.id == PostAccessRequest.post_id)
        .where(MediaPost.user_id == user.id)
        .order_by(PostAccessRequest.created_at.desc())
    ).all()
    return [_access_response(item, session) for item in items]


@router.post("/access/{request_id}/{decision}", response_model=PostAccessRequestResponse)
def decide_access_request(
    request_id: UUID,
    decision: str,
    user: AgeConfirmedUserDep,
    session: SessionDep,
) -> PostAccessRequestResponse:
    item = session.get(PostAccessRequest, request_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verzoek niet gevonden")
    post = get_owned_post(item.post_id, user, session)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album niet gevonden")
    if decision not in {"approve", "deny"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ongeldige beslissing")
    item.status = AccessRequestStatus.APPROVED if decision == "approve" else AccessRequestStatus.DENIED
    item.decided_at = datetime.now(UTC)
    session.add(item)
    session.commit()
    session.refresh(item)
    return _access_response(item, session)
