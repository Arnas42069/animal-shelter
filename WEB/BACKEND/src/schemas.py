from pydantic import BaseModel, EmailStr, Field
from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    volunteer = "volunteer"
    shelter = "shelter"
    user = "user"


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    surname: str = Field(min_length=2, max_length=50)
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str


class VolunteerRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    surname: str = Field(min_length=2, max_length=50)
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str


class ShelterRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=5, max_length=20)
    address: str = Field(min_length=3, max_length=200)
    city: str = Field(min_length=2, max_length=100)

    description: str | None = None
    website: str | None = None
    postal_code: str | None = None
    country: str | None = "Lithuania"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileResponse(BaseModel):
    id: int
    name: str
    surname: str
    username: str
    email: EmailStr
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=50)
    surname: str | None = Field(default=None, min_length=2, max_length=50)
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None


class ShelterProfileResponse(BaseModel):
    shelter_id: int

    account_id: int
    account_name: str
    account_surname: str
    username: str
    email: EmailStr
    role: str
    account_is_active: bool

    shelter_name: str
    description: str | None = None
    phone: str | None = None
    website: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    country: str | None = None

    shelter_is_verified: bool
    shelter_is_active: bool


class ShelterProfileUpdateRequest(BaseModel):
    account_name: str | None = Field(default=None, min_length=2, max_length=50)
    account_surname: str | None = Field(default=None, min_length=2, max_length=50)
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None

    shelter_name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None
    phone: str | None = Field(default=None, min_length=5, max_length=20)
    website: str | None = None
    address: str | None = Field(default=None, min_length=3, max_length=200)
    city: str | None = Field(default=None, min_length=2, max_length=100)
    postal_code: str | None = None
    country: str | None = Field(default=None, min_length=2, max_length=100)