from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlmodel import select

from app.auth.dependencies import CurrentSessionDep, CurrentUserDep, SessionDep, VerifiedUserDep
from app.auth.models import UserSession
from app.auth.schemas import (
    AgeConfirmationResponse,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
    ResendVerificationRequest,
    SessionResponse,
    TokenRequest,
    UserResponse,
)
from app.auth.service import (
    authenticate_user,
    confirm_age_for_user,
    create_user_session,
    register_user,
    resend_verification,
    reset_password,
    revoke_user_session,
    send_password_reset,
    to_user_response,
    verify_email,
)
from app.core.rate_limit import enforce_auth_rate_limit

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, session: SessionDep) -> UserResponse:
    enforce_auth_rate_limit(request, "register")
    user = register_user(payload, session)
    return to_user_response(user)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, session: SessionDep) -> LoginResponse:
    enforce_auth_rate_limit(request, "login")
    user = authenticate_user(payload.email, payload.password, session)
    user_session = create_user_session(user, session)
    return LoginResponse(access_value=user_session.value, user=to_user_response(user))


@router.post("/logout", response_model=MessageResponse)
def logout(user_session: CurrentSessionDep, session: SessionDep) -> MessageResponse:
    revoke_user_session(user_session, session)
    return MessageResponse(message="Uitgelogd")


@router.get("/sessions", response_model=list[SessionResponse])
def list_sessions(
    user: CurrentUserDep,
    current_session: CurrentSessionDep,
    session: SessionDep,
) -> list[SessionResponse]:
    items = session.exec(
        select(UserSession)
        .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .order_by(UserSession.created_at.desc())
    ).all()
    return [
        SessionResponse(
            id=item.id,
            created_at=item.created_at,
            expires_at=item.expires_at,
            current=item.id == current_session.id,
        )
        for item in items
    ]


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
def revoke_session(
    session_id: UUID,
    user: CurrentUserDep,
    current_session: CurrentSessionDep,
    session: SessionDep,
) -> MessageResponse:
    item = session.get(UserSession, session_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessie niet gevonden")
    revoke_user_session(item, session)
    message = "Huidige sessie ingetrokken" if item.id == current_session.id else "Sessie ingetrokken"
    return MessageResponse(message=message)


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUserDep) -> UserResponse:
    return to_user_response(user)


@router.post("/email/verify", response_model=UserResponse)
def confirm_email(payload: TokenRequest, request: Request, session: SessionDep) -> UserResponse:
    enforce_auth_rate_limit(request, "verify_email")
    return to_user_response(verify_email(payload.token, session))


@router.post("/email/resend", response_model=MessageResponse)
def resend_email(payload: ResendVerificationRequest, request: Request, session: SessionDep) -> MessageResponse:
    enforce_auth_rate_limit(request, "resend_email")
    resend_verification(payload.email, session)
    return MessageResponse(message="Als het account bestaat, is een nieuwe verificatielink verstuurd.")


@router.post("/password/forgot", response_model=MessageResponse)
def forgot_password(payload: PasswordResetRequest, request: Request, session: SessionDep) -> MessageResponse:
    enforce_auth_rate_limit(request, "forgot_password")
    send_password_reset(payload.email, session)
    return MessageResponse(message="Als het account bestaat, is een resetlink verstuurd.")


@router.post("/password/reset", response_model=MessageResponse)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    request: Request,
    session: SessionDep,
) -> MessageResponse:
    enforce_auth_rate_limit(request, "reset_password")
    reset_password(payload.token, payload.password, session)
    return MessageResponse(message="Wachtwoord gewijzigd. Log opnieuw in.")


@router.post("/age/confirm", response_model=AgeConfirmationResponse)
def confirm_age(request: Request, user: VerifiedUserDep, session: SessionDep) -> AgeConfirmationResponse:
    confirm_age_for_user(user, session, request.client.host if request.client else None)
    return AgeConfirmationResponse(age_confirmed=True)
