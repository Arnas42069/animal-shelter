from pydantic import BaseModel, EmailStr, Field
from enum import Enum
from typing import Optional
from datetime import date

# -------------------------------------------------
# -------------------APP_USER----------------------
# -------------------------------------------------
class UserRole(str, Enum):
    admin = "admin"
    volunteer = "volunteer"
    shelter = "shelter"


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


class UserResponse(BaseModel):
    id: int

    name: str
    surname: str

    username: str
    email: Optional[str] = None

    role: str
    is_active: bool

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


# -------------------------------------------------
# -------------------SHELTER-----------------------
# -------------------------------------------------
class ShelterRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=5, max_length=20)
    address: str = Field(min_length=3, max_length=200)
    city: str = Field(min_length=2, max_length=100)

    description: str | None = None
    website: str | None = None
    postal_code: str | None = None
    country: str | None = "Lithuania"


class ShelterResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    is_verified: bool
    is_active: bool

    class Config:
        from_attributes = True


class ShelterUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


# -------------------------------------------------
# -------------------ANIMAL------------------------
# -------------------------------------------------
class AnimalCreateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None

    species: str = Field(..., pattern="^(dog|cat|other)$")
    breed: Optional[str] = None

    sex: Optional[str] = Field(default="unknown", pattern="^(male|female|unknown)$")
    birth_date: Optional[date] = None
    color: Optional[str] = None

    description: Optional[str] = None

    status: Optional[str] = Field(
        default="available",
        pattern="^(available|reserved|adopted|foster|medical_hold|lost)$"
    )


class AnimalResponse(BaseModel):
    id: int
    shelter_id: int
    name: Optional[str]
    code: Optional[str]
    species: str
    breed: Optional[str]
    sex: str
    birth_date: Optional[date]
    color: Optional[str]
    description: Optional[str]
    status: str

    class Config:
        from_attributes = True


class AnimalUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    sex: Optional[str] = None
    birth_date: Optional[date] = None
    color: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

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