from fastapi import APIRouter, Request

from app.auth.dependencies import CurrentUserDep, SessionDep
from app.auth.schemas import AgeConfirmationResponse, LoginRequest, LoginResponse, RegisterRequest, UserResponse
from app.auth.service import authenticate_user, confirm_age_for_user, create_user_session, register_user, to_user_response

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse)
def register(payload: RegisterRequest, session: SessionDep) -> UserResponse:
    user = register_user(payload, session)
    return to_user_response(user)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, session: SessionDep) -> LoginResponse:
    user = authenticate_user(payload.email, payload.password, session)
    user_session = create_user_session(user, session)
    return LoginResponse(access_value=user_session.value, user=to_user_response(user))


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUserDep) -> UserResponse:
    return to_user_response(user)


@router.post("/age/confirm", response_model=AgeConfirmationResponse)
def confirm_age(request: Request, user: CurrentUserDep, session: SessionDep) -> AgeConfirmationResponse:
    confirm_age_for_user(user, session, request.client.host if request.client else None)
    return AgeConfirmationResponse(age_confirmed=True)
