import re
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlmodel import Session, desc, select

from app.auth.models import User
from app.core.enums import UserRole
from app.profiles.models import Profile, ProfileView
from app.profiles.schemas import (
    ProfileResponse,
    ProfileUpsertRequest,
    ProfileVisitResponse,
    ProfileVisitSummaryResponse,
)


def make_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "profiel"


def to_profile_response(profile: Profile) -> ProfileResponse:
    return ProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        display_name=profile.display_name,
        slug=profile.slug,
        bio=profile.bio,
        location_label=profile.location_label,
        gender=profile.gender,
        age_label=profile.age_label,
        last_active_at=profile.last_active_at,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def upsert_profile(user: User, payload: ProfileUpsertRequest, session: Session) -> Profile:
    profile = session.exec(select(Profile).where(Profile.user_id == user.id)).first()
    base_slug = make_slug(payload.display_name)
    slug = base_slug
    suffix = 2

    while True:
        existing = session.exec(select(Profile).where(Profile.slug == slug)).first()
        if not existing or (profile and existing.id == profile.id):
            break
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    if profile:
        profile.display_name = payload.display_name
        profile.bio = payload.bio
        profile.location_label = payload.location_label
        profile.gender = payload.gender
        profile.age_label = payload.age_label
        profile.slug = slug
        profile.last_active_at = datetime.now(UTC)
        profile.updated_at = datetime.now(UTC)
    else:
        profile = Profile(
            user_id=user.id,
            display_name=payload.display_name,
            slug=slug,
            bio=payload.bio,
            location_label=payload.location_label,
            gender=payload.gender,
            age_label=payload.age_label,
            last_active_at=datetime.now(UTC),
        )

    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def get_my_profile(user: User, session: Session) -> Profile:
    profile = session.exec(select(Profile).where(Profile.user_id == user.id)).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profiel bestaat nog niet")
    return profile


def list_profiles(
    session: Session,
    *,
    viewer_user_id: UUID | None = None,
    query: str | None = None,
    location: str | None = None,
    limit: int = 50,
) -> list[Profile]:
    statement = select(Profile)

    if viewer_user_id:
        statement = statement.where(Profile.user_id != viewer_user_id)

    if query:
        needle = f"%{query.lower()}%"
        statement = statement.where(
            or_(
                Profile.display_name.ilike(needle),
                Profile.slug.ilike(needle),
                Profile.bio.ilike(needle),
                Profile.location_label.ilike(needle),
                Profile.gender.ilike(needle),
                Profile.age_label.ilike(needle),
            )
        )

    if location:
        statement = statement.where(Profile.location_label.ilike(f"%{location.lower()}%"))

    statement = statement.order_by(desc(Profile.last_active_at), desc(Profile.created_at)).limit(limit)
    return list(session.exec(statement).all())


def get_profile_by_slug(slug: str, session: Session) -> Profile:
    profile = session.exec(select(Profile).where(Profile.slug == slug)).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profiel niet gevonden")
    return profile


def register_profile_view(viewer: User, viewed_user_id: UUID, session: Session) -> None:
    if viewer.id == viewed_user_id:
        return

    since = datetime.now(UTC) - timedelta(hours=24)
    existing = session.exec(
        select(ProfileView).where(
            ProfileView.viewer_user_id == viewer.id,
            ProfileView.viewed_user_id == viewed_user_id,
            ProfileView.viewed_at >= since,
        )
    ).first()
    if existing:
        return

    profile_view = ProfileView(viewer_user_id=viewer.id, viewed_user_id=viewed_user_id)
    session.add(profile_view)
    session.commit()


def get_profile_visits(user: User, session: Session) -> ProfileVisitSummaryResponse:
    visits = list(
        session.exec(
            select(ProfileView)
            .where(ProfileView.viewed_user_id == user.id)
            .order_by(desc(ProfileView.viewed_at))
            .limit(50)
        ).all()
    )

    show_profiles = user.role in [UserRole.PREMIUM, UserRole.MODERATOR, UserRole.ADMIN]
    response_items: list[ProfileVisitResponse] = []
    for visit in visits:
        viewer_profile = None
        if show_profiles:
            profile = session.exec(select(Profile).where(Profile.user_id == visit.viewer_user_id)).first()
            viewer_profile = to_profile_response(profile) if profile else None
        response_items.append(ProfileVisitResponse(id=visit.id, visited_at=visit.viewed_at, profile=viewer_profile))

    return ProfileVisitSummaryResponse(count=len(visits), visits=response_items)
