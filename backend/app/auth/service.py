import hashlib
import logging
import secrets
import smtplib
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.auth.models import AccountToken, User, UserSession
from app.auth.schemas import RegisterRequest, UserResponse
from app.core.config import get_settings
from app.core.email import send_email
from app.core.enums import UserStatus
from app.core.passwords import make_hash, matches

logger = logging.getLogger("privateframe.auth")

VERIFY_EMAIL = "verify_email"
RESET_PASSWORD = "reset_password"


def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        subscription_status=user.subscription_status,
        status=user.status,
        email_verified=user.email_verified_at is not None,
        age_confirmed=user.age_confirmed_at is not None,
    )


def register_user(payload: RegisterRequest, session: Session) -> User:
    existing = session.exec(select(User).where(User.email == payload.email.lower())).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mailadres is al geregistreerd")

    settings = get_settings()
    now = datetime.now(UTC)
    user = User(
        email=payload.email.lower(),
        password_hash=make_hash(payload.password),
        email_verified_at=now if settings.auto_verify_new_users else None,
        updated_at=now,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    if not settings.auto_verify_new_users:
        send_verification_email(user, session)
    return user


def authenticate_user(email: str, password: str, session: Session) -> User:
    user = session.exec(select(User).where(User.email == email.lower())).first()
    if not user or not matches(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ongeldige login")
    if user.status == UserStatus.BANNED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is geblokkeerd")
    return user


def create_user_session(user: User, session: Session) -> UserSession:
    settings = get_settings()
    user_session = UserSession(
        user_id=user.id,
        value=f"pf_{uuid4().hex}_{uuid4().hex}",
        expires_at=datetime.now(UTC) + timedelta(days=settings.session_expire_days),
    )
    session.add(user_session)
    session.commit()
    session.refresh(user_session)
    return user_session


def revoke_user_session(user_session: UserSession, session: Session) -> None:
    if user_session.revoked_at is None:
        user_session.revoked_at = datetime.now(UTC)
        session.add(user_session)
        session.commit()


def revoke_all_user_sessions(user_id: UUID, session: Session) -> None:
    now = datetime.now(UTC)
    sessions = session.exec(
        select(UserSession).where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
    ).all()
    for item in sessions:
        item.revoked_at = now
        session.add(item)


def confirm_age_for_user(user: User, session: Session, ip_address: str | None) -> User:
    user.age_confirmed_at = datetime.now(UTC)
    user.age_confirmation_ip = ip_address
    user.updated_at = datetime.now(UTC)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def send_verification_email(user: User, session: Session) -> None:
    if user.email_verified_at is not None:
        return
    settings = get_settings()
    token = _issue_token(user, VERIFY_EMAIL, timedelta(hours=settings.email_verification_expire_hours), session)
    query = urlencode({"token": token})
    url = f"{settings.frontend_url.rstrip('/')}/verify-email?{query}"
    _deliver_email(
        recipient=user.email,
        subject="Bevestig je PrivateFrame-account",
        body=f"Bevestig je e-mailadres via deze link:\n\n{url}\n\nDeze link verloopt automatisch.",
    )


def verify_email(token_value: str, session: Session) -> User:
    token = _get_valid_token(token_value, VERIFY_EMAIL, session)
    user = session.get(User, token.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verificatielink is ongeldig")

    now = datetime.now(UTC)
    user.email_verified_at = user.email_verified_at or now
    user.updated_at = now
    token.used_at = now
    session.add(user)
    session.add(token)
    session.commit()
    session.refresh(user)
    return user


def resend_verification(email: str, session: Session) -> None:
    user = session.exec(select(User).where(User.email == email.lower())).first()
    if user and user.email_verified_at is None and user.status != UserStatus.BANNED:
        send_verification_email(user, session)


def send_password_reset(email: str, session: Session) -> None:
    user = session.exec(select(User).where(User.email == email.lower())).first()
    if not user or user.status == UserStatus.BANNED:
        return

    settings = get_settings()
    token = _issue_token(user, RESET_PASSWORD, timedelta(minutes=settings.password_reset_expire_minutes), session)
    query = urlencode({"token": token})
    url = f"{settings.frontend_url.rstrip('/')}/reset-password?{query}"
    _deliver_email(
        recipient=user.email,
        subject="Reset je PrivateFrame-wachtwoord",
        body=f"Kies een nieuw wachtwoord via deze link:\n\n{url}\n\nDeze link verloopt automatisch.",
    )


def reset_password(token_value: str, password: str, session: Session) -> None:
    token = _get_valid_token(token_value, RESET_PASSWORD, session)
    user = session.get(User, token.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resetlink is ongeldig")

    now = datetime.now(UTC)
    user.password_hash = make_hash(password)
    user.updated_at = now
    token.used_at = now
    session.add(user)
    session.add(token)
    revoke_all_user_sessions(user.id, session)
    session.commit()


def _issue_token(user: User, purpose: str, lifetime: timedelta, session: Session) -> str:
    now = datetime.now(UTC)
    existing_tokens = session.exec(
        select(AccountToken).where(
            AccountToken.user_id == user.id,
            AccountToken.purpose == purpose,
            AccountToken.used_at.is_(None),
        )
    ).all()
    for existing in existing_tokens:
        existing.used_at = now
        session.add(existing)

    raw_value = secrets.token_urlsafe(32)
    item = AccountToken(
        user_id=user.id,
        purpose=purpose,
        token_hash=_token_hash(raw_value),
        expires_at=now + lifetime,
    )
    session.add(item)
    session.commit()
    return raw_value


def _get_valid_token(raw_value: str, purpose: str, session: Session) -> AccountToken:
    item = session.exec(
        select(AccountToken).where(
            AccountToken.token_hash == _token_hash(raw_value),
            AccountToken.purpose == purpose,
            AccountToken.used_at.is_(None),
        )
    ).first()
    if not item or _as_utc(item.expires_at) <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Link is ongeldig of verlopen")
    return item


def _token_hash(raw_value: str) -> str:
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _deliver_email(*, recipient: str, subject: str, body: str) -> None:
    try:
        send_email(recipient=recipient, subject=subject, body=body)
    except (OSError, RuntimeError, smtplib.SMTPException):
        logger.exception("E-mail versturen naar %s is mislukt", recipient)
