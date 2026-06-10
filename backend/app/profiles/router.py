from typing import Annotated

from fastapi import APIRouter, Query

from app.auth.dependencies import AgeConfirmedUserDep, SessionDep, VerifiedUserDep
from app.profiles.schemas import ProfileResponse, ProfileUpsertRequest, ProfileVisitSummaryResponse
from app.profiles.service import (
    get_my_profile,
    get_profile_by_slug,
    get_profile_visits,
    list_profiles,
    register_profile_view,
    to_profile_response,
    touch_profile_activity,
    upsert_profile,
)

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get("", response_model=list[ProfileResponse])
def discover_profiles(
    user: AgeConfirmedUserDep,
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=80)] = None,
    location: Annotated[str | None, Query(max_length=120)] = None,
    age_min: Annotated[int | None, Query(ge=18, le=99)] = None,
    age_max: Annotated[int | None, Query(ge=18, le=99)] = None,
    gender: Annotated[str | None, Query(max_length=80)] = None,
    online_only: bool = False,
    with_photos: bool = False,
    favorites_only: bool = False,
    matches_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[ProfileResponse]:
    touch_profile_activity(user, session)
    return [
        to_profile_response(profile, user, session)
        for profile in list_profiles(
            session,
            viewer_user_id=user.id,
            query=q.strip() or None if q else None,
            location=location.strip() or None if location else None,
            age_min=age_min,
            age_max=age_max,
            gender=gender.strip() or None if gender else None,
            online_only=online_only,
            with_photos=with_photos,
            favorites_only=favorites_only,
            matches_only=matches_only,
            limit=limit,
        )
    ]


@router.get("/me", response_model=ProfileResponse)
def read_my_profile(user: VerifiedUserDep, session: SessionDep) -> ProfileResponse:
    return to_profile_response(get_my_profile(user, session), user, session)


@router.put("/me", response_model=ProfileResponse)
def save_my_profile(payload: ProfileUpsertRequest, user: VerifiedUserDep, session: SessionDep) -> ProfileResponse:
    return to_profile_response(upsert_profile(user, payload, session), user, session)


@router.get("/me/activity", response_model=ProfileVisitSummaryResponse)
def read_profile_activity(user: VerifiedUserDep, session: SessionDep) -> ProfileVisitSummaryResponse:
    return get_profile_visits(user, session)


@router.get("/{slug}", response_model=ProfileResponse)
def read_profile(slug: str, user: AgeConfirmedUserDep, session: SessionDep) -> ProfileResponse:
    profile = get_profile_by_slug(slug, session, user.id)
    register_profile_view(user, profile.user_id, session)
    return to_profile_response(profile, user, session)
