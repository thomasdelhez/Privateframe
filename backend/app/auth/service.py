from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.auth.models import User, UserSession
from app.auth.schemas import RegisterRequest, UserResponse
from app.core.enums import UserStatus
from app.core.passwords import make_hash, matches


def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        subscription_status=user.subscription_status,
        status=user.status,
        age_confirmed=user.age_confirmed_at is not None,
    )


def register_user(payload: RegisterRequest, session: Session) -> User:
    existing = session.exec(select(User).where(User.email == payload.email.lower())).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mailadres is al geregistreerd")

    user = User(email=payload.email.lower(), password_hash=make_hash(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def authenticate_user(email: str, password: str, session: Session) -> User:
    user = session.exec(select(User).where(User.email == email.lower())).first()
    if not user or not matches(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ongeldige login")
    if user.status == UserStatus.BANNED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is geblokkeerd")
    return user


def create_user_session(user: User, session: Session) -> UserSession:
    user_session = UserSession(user_id=user.id, value=f"pf_{uuid4().hex}_{uuid4().hex}")
    session.add(user_session)
    session.commit()
    session.refresh(user_session)
    return user_session


def confirm_age_for_user(user: User, session: Session, ip_address: str | None) -> User:
    user.age_confirmed_at = datetime.now(UTC)
    user.age_confirmation_ip = ip_address
    user.updated_at = datetime.now(UTC)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
