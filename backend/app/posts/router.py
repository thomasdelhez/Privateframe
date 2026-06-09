from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Query, Request, UploadFile
from fastapi.responses import FileResponse

from app.auth.dependencies import AgeConfirmedUserDep, SessionDep
from app.posts.schemas import AssetUploadResponse, PostCreateRequest, PostResponse
from app.posts.service import (
    assert_can_view_asset,
    create_post,
    get_asset,
    get_asset_file_path,
    get_post,
    guess_download_name,
    list_posts,
    list_posts_for_user,
    save_uploaded_asset,
    to_post_response,
)

router = APIRouter(prefix="/posts", tags=["Posts"])


@router.get("", response_model=list[PostResponse])
def read_posts(
    user: AgeConfirmedUserDep,
    session: SessionDep,
    user_id: Annotated[UUID | None, Query()] = None,
) -> list[PostResponse]:
    posts = list_posts_for_user(user_id, session) if user_id else list_posts(session)
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


@router.post("/{post_id}/assets", response_model=AssetUploadResponse)
async def upload_asset(
    post_id: UUID,
    user: AgeConfirmedUserDep,
    session: SessionDep,
    file: Annotated[UploadFile, File(...)],
) -> AssetUploadResponse:
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
