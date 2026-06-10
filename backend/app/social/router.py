from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlmodel import select

from app.auth.dependencies import AgeConfirmedUserDep, SessionDep
from app.core.rate_limit import enforce_user_rate_limit
from app.profiles.models import Profile, ProfileFavorite, ProfileLike, UserBlock
from app.profiles.schemas import ProfileResponse
from app.profiles.service import to_profile_response
from app.social.service import block_between, blocked_user_ids

router = APIRouter(prefix="/social", tags=["Social"])


def _target_profile(target_user_id: UUID, session: SessionDep) -> Profile:
    profile = session.exec(select(Profile).where(Profile.user_id == target_user_id)).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profiel niet gevonden")
    return profile


def _toggle(model, user_id: UUID, target_user_id: UUID, session: SessionDep) -> bool:
    item = session.exec(
        select(model).where(model.user_id == user_id, model.target_user_id == target_user_id)
    ).first()
    if item:
        session.delete(item)
        enabled = False
    else:
        session.add(model(user_id=user_id, target_user_id=target_user_id))
        enabled = True
    session.commit()
    return enabled


@router.post("/favorites/{target_user_id}")
def toggle_favorite(
    target_user_id: UUID,
    request: Request,
    user: AgeConfirmedUserDep,
    session: SessionDep,
) -> dict:
    enforce_user_rate_limit(request, "favorite", str(user.id), attempts=100, window_seconds=3600)
    _target_profile(target_user_id, session)
    if target_user_id == user.id or block_between(session, user.id, target_user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Actie niet beschikbaar")
    return {"enabled": _toggle(ProfileFavorite, user.id, target_user_id, session)}


@router.post("/likes/{target_user_id}")
def toggle_like(
    target_user_id: UUID,
    request: Request,
    user: AgeConfirmedUserDep,
    session: SessionDep,
) -> dict:
    enforce_user_rate_limit(request, "like", str(user.id), attempts=100, window_seconds=3600)
    _target_profile(target_user_id, session)
    if target_user_id == user.id or block_between(session, user.id, target_user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Actie niet beschikbaar")
    enabled = _toggle(ProfileLike, user.id, target_user_id, session)
    reciprocal = session.exec(
        select(ProfileLike).where(
            ProfileLike.user_id == target_user_id,
            ProfileLike.target_user_id == user.id,
        )
    ).first()
    return {"enabled": enabled, "matched": enabled and reciprocal is not None}


@router.get("/matches", response_model=list[ProfileResponse])
def list_matches(user: AgeConfirmedUserDep, session: SessionDep) -> list[ProfileResponse]:
    outgoing = session.exec(select(ProfileLike).where(ProfileLike.user_id == user.id)).all()
    targets = {item.target_user_id for item in outgoing}
    incoming = session.exec(
        select(ProfileLike).where(ProfileLike.target_user_id == user.id)
    ).all()
    matched_ids = {item.user_id for item in incoming if item.user_id in targets}
    blocked = blocked_user_ids(session, user.id)
    profiles = session.exec(select(Profile).where(Profile.user_id.in_(matched_ids - blocked))).all()
    return [to_profile_response(profile, user, session) for profile in profiles]


@router.get("/favorites", response_model=list[ProfileResponse])
def list_favorites(user: AgeConfirmedUserDep, session: SessionDep) -> list[ProfileResponse]:
    favorites = session.exec(select(ProfileFavorite).where(ProfileFavorite.user_id == user.id)).all()
    target_ids = {item.target_user_id for item in favorites} - blocked_user_ids(session, user.id)
    profiles = session.exec(select(Profile).where(Profile.user_id.in_(target_ids))).all()
    return [to_profile_response(profile, user, session) for profile in profiles]


@router.post("/blocks/{target_user_id}")
def block_user(target_user_id: UUID, user: AgeConfirmedUserDep, session: SessionDep) -> dict:
    _target_profile(target_user_id, session)
    if target_user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Je kunt jezelf niet blokkeren")
    existing = block_between(session, user.id, target_user_id)
    if not existing:
        session.add(UserBlock(blocker_user_id=user.id, blocked_user_id=target_user_id))
    for model in [ProfileFavorite, ProfileLike]:
        items = session.exec(
            select(model).where(
                ((model.user_id == user.id) & (model.target_user_id == target_user_id))
                | ((model.user_id == target_user_id) & (model.target_user_id == user.id))
            )
        ).all()
        for item in items:
            session.delete(item)
    session.commit()
    return {"blocked": True}


@router.delete("/blocks/{target_user_id}")
def unblock_user(target_user_id: UUID, user: AgeConfirmedUserDep, session: SessionDep) -> dict:
    item = session.exec(
        select(UserBlock).where(
            UserBlock.blocker_user_id == user.id,
            UserBlock.blocked_user_id == target_user_id,
        )
    ).first()
    if item:
        session.delete(item)
        session.commit()
    return {"blocked": False}


@router.get("/blocks", response_model=list[ProfileResponse])
def list_blocks(user: AgeConfirmedUserDep, session: SessionDep) -> list[ProfileResponse]:
    items = session.exec(select(UserBlock).where(UserBlock.blocker_user_id == user.id)).all()
    profiles = session.exec(select(Profile).where(Profile.user_id.in_({item.blocked_user_id for item in items}))).all()
    return [to_profile_response(profile, user, session) for profile in profiles]
