from datetime import UTC, datetime

from fastapi import APIRouter

from app.auth.dependencies import SessionDep, VerifiedUserDep
from app.auth.service import to_user_response
from app.core.enums import SubscriptionStatus, UserRole

router = APIRouter(prefix="/plan", tags=["Plan"])


@router.get("/status")
def read_status(user: VerifiedUserDep) -> dict[str, str]:
    return {"status": user.subscription_status.value, "role": user.role.value}


@router.post("/enable")
def enable_full_access(user: VerifiedUserDep, session: SessionDep):
    user.role = UserRole.PREMIUM
    user.subscription_status = SubscriptionStatus.PREMIUM
    user.updated_at = datetime.now(UTC)
    session.add(user)
    session.commit()
    session.refresh(user)
    return to_user_response(user)


@router.post("/disable")
def disable_full_access(user: VerifiedUserDep, session: SessionDep):
    user.role = UserRole.FREE
    user.subscription_status = SubscriptionStatus.CANCELLED
    user.updated_at = datetime.now(UTC)
    session.add(user)
    session.commit()
    session.refresh(user)
    return to_user_response(user)
