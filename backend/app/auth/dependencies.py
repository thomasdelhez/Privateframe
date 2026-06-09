from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlmodel import Session, select

from app.auth.models import User, UserSession
from app.core.database import get_session
from app.core.enums import UserRole, UserStatus

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_session(
    session: SessionDep,
    authorization: Annotated[str | None, Header()] = None,
) -> UserSession:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd")

    key = authorization.removeprefix("Bearer ").strip()
    user_session = get_valid_user_session_by_value(session, key)
    return user_session


CurrentSessionDep = Annotated[UserSession, Depends(get_current_session)]


def get_current_user(user_session: CurrentSessionDep, session: SessionDep) -> User:
    return get_active_user_by_id(session, user_session.user_id)


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_email_verified(user: CurrentUserDep) -> User:
    if user.email_verified_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="E-mailverificatie vereist")
    return user


VerifiedUserDep = Annotated[User, Depends(require_email_verified)]


def require_age_confirmed(user: VerifiedUserDep) -> User:
    if user.age_confirmed_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Leeftijdsbevestiging vereist")
    return user


AgeConfirmedUserDep = Annotated[User, Depends(require_age_confirmed)]


def require_premium(user: AgeConfirmedUserDep) -> User:
    if user.role not in [UserRole.PREMIUM, UserRole.MODERATOR, UserRole.ADMIN]:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Premium vereist")
    return user


PremiumUserDep = Annotated[User, Depends(require_premium)]


def require_admin(user: CurrentUserDep) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Adminrechten vereist")
    return user


AdminUserDep = Annotated[User, Depends(require_admin)]


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def get_valid_user_session_by_value(session: Session, key: str) -> UserSession:
    user_session = session.exec(select(UserSession).where(UserSession.value == key)).first()
    if not user_session or user_session.revoked_at is not None or _as_utc(user_session.expires_at) <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessie is ongeldig of verlopen")
    return user_session


def get_active_user_by_id(session: Session, user_id) -> User:
    user = session.get(User, user_id)
    if not user or user.status == UserStatus.BANNED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Geen toegang")
    return user


def get_active_user_by_session_value(session: Session, key: str) -> User:
    user_session = get_valid_user_session_by_value(session, key)
    return get_active_user_by_id(session, user_session.user_id)
