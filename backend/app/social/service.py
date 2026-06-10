from uuid import UUID

from sqlmodel import Session, or_, select

from app.profiles.models import ProfileFavorite, ProfileLike, UserBlock


def block_between(session: Session, first_user_id: UUID, second_user_id: UUID) -> UserBlock | None:
    return session.exec(
        select(UserBlock).where(
            or_(
                (UserBlock.blocker_user_id == first_user_id) & (UserBlock.blocked_user_id == second_user_id),
                (UserBlock.blocker_user_id == second_user_id) & (UserBlock.blocked_user_id == first_user_id),
            )
        )
    ).first()


def blocked_user_ids(session: Session, user_id: UUID) -> set[UUID]:
    blocks = session.exec(
        select(UserBlock).where(or_(UserBlock.blocker_user_id == user_id, UserBlock.blocked_user_id == user_id))
    ).all()
    return {
        item.blocked_user_id if item.blocker_user_id == user_id else item.blocker_user_id
        for item in blocks
    }


def relationship_flags(session: Session, viewer_user_id: UUID, target_user_id: UUID) -> dict[str, bool]:
    favorite = session.exec(
        select(ProfileFavorite).where(
            ProfileFavorite.user_id == viewer_user_id,
            ProfileFavorite.target_user_id == target_user_id,
        )
    ).first()
    liked = session.exec(
        select(ProfileLike).where(
            ProfileLike.user_id == viewer_user_id,
            ProfileLike.target_user_id == target_user_id,
        )
    ).first()
    liked_back = session.exec(
        select(ProfileLike).where(
            ProfileLike.user_id == target_user_id,
            ProfileLike.target_user_id == viewer_user_id,
        )
    ).first()
    return {
        "is_favorite": favorite is not None,
        "is_liked": liked is not None,
        "is_match": liked is not None and liked_back is not None,
        "is_blocked": block_between(session, viewer_user_id, target_user_id) is not None,
    }
