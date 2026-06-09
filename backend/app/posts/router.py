from uuid import UUID

from fastapi import APIRouter, Request

from app.auth.dependencies import AgeConfirmedUserDep, SessionDep
from app.posts.schemas import PostCreateRequest, PostResponse, UploadResponse
from app.posts.service import add_demo_asset, create_post, get_post, list_posts, to_post_response

router = APIRouter(prefix="/posts", tags=["Posts"])


@router.get("", response_model=list[PostResponse])
def read_posts(user: AgeConfirmedUserDep, session: SessionDep) -> list[PostResponse]:
    return [to_post_response(post, user, session) for post in list_posts(session)]


@router.post("", response_model=PostResponse)
def create_new_post(payload: PostCreateRequest, request: Request, user: AgeConfirmedUserDep, session: SessionDep) -> PostResponse:
    post = create_post(user, payload, session, request.client.host if request.client else None)
    return to_post_response(post, user, session)


@router.get("/{post_id}", response_model=PostResponse)
def read_post(post_id: UUID, user: AgeConfirmedUserDep, session: SessionDep) -> PostResponse:
    return to_post_response(get_post(post_id, session), user, session)


@router.post("/{post_id}/placeholder", response_model=UploadResponse)
def add_placeholder(post_id: UUID, user: AgeConfirmedUserDep, session: SessionDep) -> UploadResponse:
    asset = add_demo_asset(post_id, user, session)
    return UploadResponse(asset=to_post_response(get_post(post_id, session), user, session).assets[-1])
