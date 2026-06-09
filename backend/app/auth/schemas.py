from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import SubscriptionStatus, UserRole, UserStatus


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_value: str
    user: "UserResponse"


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    role: UserRole
    subscription_status: SubscriptionStatus
    status: UserStatus
    age_confirmed: bool


class AgeConfirmationResponse(BaseModel):
    age_confirmed: bool
