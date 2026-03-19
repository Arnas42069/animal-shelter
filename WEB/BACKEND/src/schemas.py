from pydantic import BaseModel, EmailStr, Field
from enum import Enum


class UserRole(str, Enum):
    admin     = "admin"
    volunteer = "volunteer"
    shelter   = "shelter"
    user      = "user"


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    surname: str = Field(min_length=2, max_length=50)
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"