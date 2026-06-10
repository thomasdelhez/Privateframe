import re
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import String, cast, or_
from sqlmodel import Session, desc, select

from app.auth.models import User
from app.core.enums import PostStatus, UserRole
from app.profiles.models import Profile, ProfileView
from app.profiles.schemas import (
    ProfileResponse,
    ProfileUpsertRequest,
    ProfileVisitResponse,
    ProfileVisitSummaryResponse,
)
from app.social.service import blocked_user_ids, relationship_flags


def make_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "profiel"


def to_profile_response(
    profile: Profile,
    viewer: User | None = None,
    session: Session | None = None,
) -> ProfileResponse:
    flags = (
        relationship_flags(session, viewer.id, profile.user_id)
        if viewer and session and viewer.id != profile.user_id
        else {}
    )
    hide_location = viewer is not None and viewer.id != profile.user_id and not profile.show_location
    hide_online = viewer is not None and viewer.id != profile.user_id and not profile.show_online_status
    return ProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        display_name=profile.display_name,
        slug=profile.slug,
        bio=profile.bio,
        location_label=None if hide_location else profile.location_label,
        gender=profile.gender,
        age_label=profile.age_label,
        interests=profile.interests,
        discoverable=profile.discoverable,
        show_online_status=profile.show_online_status,
        show_location=profile.show_location,
        register_profile_views=profile.register_profile_views,
        avatar_media_id=profile.avatar_media_id,
        avatar_url=(
            f"/api/v1/profiles/avatar/{profile.user_id}?v={int(profile.updated_at.timestamp())}"
            if profile.avatar_media_id
            else None
        ),
        last_active_at=None if hide_online else profile.last_active_at,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
        **flags,
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
        profile.interests = _clean_interests(payload.interests)
        profile.discoverable = payload.discoverable
        profile.show_online_status = payload.show_online_status
        profile.show_location = payload.show_location
        profile.register_profile_views = payload.register_profile_views
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
            interests=_clean_interests(payload.interests),
            discoverable=payload.discoverable,
            show_online_status=payload.show_online_status,
            show_location=payload.show_location,
            register_profile_views=payload.register_profile_views,
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


def set_profile_avatar(user: User, media_id: UUID | None, session: Session) -> Profile:
    profile = get_my_profile(user, session)
    if media_id is not None:
        from app.posts.models import MediaAsset, MediaPost

        asset = session.get(MediaAsset, media_id)
        post = session.get(MediaPost, asset.post_id) if asset else None
        if not asset or not post or post.user_id != user.id or post.status != PostStatus.PUBLISHED or asset.is_hidden:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto niet gevonden")

    profile.avatar_media_id = media_id
    profile.updated_at = datetime.now(UTC)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def get_profile_avatar(user_id: UUID, session: Session):
    from app.posts.models import MediaAsset, MediaPost
    from app.posts.service import get_asset_file_path

    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    if not profile or not profile.avatar_media_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profielfoto niet gevonden")

    asset = session.get(MediaAsset, profile.avatar_media_id)
    post = session.get(MediaPost, asset.post_id) if asset else None
    if not asset or not post or post.user_id != user_id or post.status != PostStatus.PUBLISHED or asset.is_hidden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profielfoto niet gevonden")
    return asset, get_asset_file_path(asset, preview=False)


def touch_profile_activity(user: User, session: Session) -> None:
    profile = session.exec(select(Profile).where(Profile.user_id == user.id)).first()
    if not profile:
        return

    now = datetime.now(UTC)
    last_active_at = profile.last_active_at
    if last_active_at and last_active_at.tzinfo is None:
        last_active_at = last_active_at.replace(tzinfo=UTC)
    if last_active_at and now - last_active_at < timedelta(minutes=1):
        return

    profile.last_active_at = now
    session.add(profile)
    session.commit()


def list_profiles(
    session: Session,
    *,
    viewer_user_id: UUID | None = None,
    query: str | None = None,
    location: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    gender: str | None = None,
    online_only: bool = False,
    with_photos: bool = False,
    favorites_only: bool = False,
    matches_only: bool = False,
    limit: int = 50,
) -> list[Profile]:
    statement = select(Profile).where(Profile.discoverable.is_(True))

    if viewer_user_id:
        statement = statement.where(Profile.user_id != viewer_user_id)
        blocked = blocked_user_ids(session, viewer_user_id)
        if blocked:
            statement = statement.where(Profile.user_id.notin_(blocked))

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
                cast(Profile.interests, String).ilike(needle),
            )
        )

    if location:
        statement = statement.where(Profile.location_label.ilike(f"%{location.lower()}%"))
    if gender:
        statement = statement.where(Profile.gender.ilike(f"%{gender.lower()}%"))
    if online_only:
        statement = statement.where(
            Profile.show_online_status.is_(True),
            Profile.last_active_at >= datetime.now(UTC) - timedelta(minutes=5),
        )

    profiles = list(session.exec(statement.order_by(desc(Profile.last_active_at), desc(Profile.created_at))).all())
    if age_min is not None or age_max is not None:
        profiles = [profile for profile in profiles if _age_matches(profile.age_label, age_min, age_max)]
    if viewer_user_id and (favorites_only or matches_only):
        profiles = [
            profile
            for profile in profiles
            if (not favorites_only or relationship_flags(session, viewer_user_id, profile.user_id)["is_favorite"])
            and (not matches_only or relationship_flags(session, viewer_user_id, profile.user_id)["is_match"])
        ]
    if with_photos:
        from app.posts.models import MediaAsset, MediaPost

        profiles = [
            profile
            for profile in profiles
            if session.exec(
                select(MediaAsset)
                .join(MediaPost, MediaPost.id == MediaAsset.post_id)
                .where(MediaPost.user_id == profile.user_id)
            ).first()
        ]

    return profiles[:limit]


def get_profile_by_slug(slug: str, session: Session, viewer_user_id: UUID | None = None) -> Profile:
    profile = session.exec(select(Profile).where(Profile.slug == slug)).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profiel niet gevonden")
    if viewer_user_id and viewer_user_id != profile.user_id:
        if not profile.discoverable or profile.user_id in blocked_user_ids(session, viewer_user_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profiel niet gevonden")
    return profile


def register_profile_view(viewer: User, viewed_user_id: UUID, session: Session) -> None:
    if viewer.id == viewed_user_id:
        return
    viewed_profile = session.exec(select(Profile).where(Profile.user_id == viewed_user_id)).first()
    if not viewed_profile or not viewed_profile.register_profile_views:
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
            viewer_profile = to_profile_response(profile, user, session) if profile else None
        response_items.append(ProfileVisitResponse(id=visit.id, visited_at=visit.viewed_at, profile=viewer_profile))

    return ProfileVisitSummaryResponse(count=len(visits), visits=response_items)


def _clean_interests(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in values:
        item = value.strip().lower()[:30]
        if item and item not in cleaned:
            cleaned.append(item)
    return cleaned[:10]


def _age_matches(value: str | None, minimum: int | None, maximum: int | None) -> bool:
    if not value:
        return False
    match = re.search(r"\d{2}", value)
    if not match:
        return False
    age = int(match.group())
    return (minimum is None or age >= minimum) and (maximum is None or age <= maximum)
