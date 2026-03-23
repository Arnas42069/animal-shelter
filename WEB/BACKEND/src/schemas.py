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