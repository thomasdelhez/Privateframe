from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlmodel import Session, select

from app.auth.models import User, UserSession
from app.core.database import get_session
from app.core.enums import UserRole, UserStatus

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(
    session: SessionDep,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd")

    key = authorization.removeprefix("Bearer ").strip()
    user_session = session.exec(select(UserSession).where(UserSession.value == key)).first()
    if not user_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessie is ongeldig")

    user = session.get(User, user_session.user_id)
    if not user or user.status == UserStatus.BANNED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Geen toegang")

    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_age_confirmed(user: CurrentUserDep) -> User:
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
