from pydantic import BaseModel, EmailStr, Field, model_validator, ConfigDict
from enum import Enum
from typing import Optional
from datetime import date, datetime

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

    # Pagrindines nuotraukos url
    primary_image_url: Optional[str] = None

    is_favorite: bool = False

    class Config:
        from_attributes = True


class AnimalListResponse(BaseModel):
    items: list[AnimalResponse]
    total: int
    page: int
    page_size: int


# Gyvuno atnaujinimo uzklausa
class AnimalUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    species: Optional[str] = Field(default=None, pattern="^(dog|cat|other)$")
    breed: Optional[str] = None
    sex: Optional[str] = Field(default=None, pattern="^(male|female|unknown)$")
    birth_date: Optional[date] = None
    color: Optional[str] = None
    description: Optional[str] = None

    status: Optional[str] = Field(
        default=None,
        pattern="^(available|reserved|adopted|foster|medical_hold|lost)$"
    )


# -------------------------------------------------
# -------------------ANIMAL FAVORITE---------------
# -------------------------------------------------
class AnimalFavoriteCreate(BaseModel):
    animal_id: int


class AnimalFavoriteResponse(BaseModel):
    id: int
    user_id: int
    animal_id: int
    created_at: datetime

    is_favorite: bool = False

    model_config = ConfigDict(from_attributes=True)


class AnimalFavoriteSimpleResponse(BaseModel):
    animal_id: int
    is_favorite: bool

# -------------------------------------------------
# -------------------VISIT-------------------------
# -------------------------------------------------

class VisitCreateRequest(BaseModel):
    shelter_id: int
    start_at: datetime
    end_at: datetime
    is_under_16: bool = False
    social_hrs: float = Field(default=0, ge=0)
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at turi būti vėliau negu start_at")
        return self


class VisitResponse(BaseModel):
    id: int
    shelter_id: int
    user_id: int
    start_at: datetime
    end_at: datetime
    status: str
    is_under_16: bool
    social_hrs: float
    note: Optional[str] = None

    class Config:
        from_attributes = True


class VisitVolunteerInfo(BaseModel):
    id: int
    name: str
    surname: str
    username: str
    email: Optional[str] = None

    class Config:
        from_attributes = True


class VisitShelterInfo(BaseModel):
    id: int
    name: str
    city: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True


class VisitMeResponse(BaseModel):
    id: int
    shelter_id: int
    user_id: int
    start_at: datetime
    end_at: datetime
    status: str
    is_under_16: bool
    social_hrs: float
    note: Optional[str] = None
    shelter: VisitShelterInfo

    class Config:
        from_attributes = True


class ShelterVisitResponse(BaseModel):
    id: int
    shelter_id: int
    user_id: int
    start_at: datetime
    end_at: datetime
    status: str
    is_under_16: bool
    social_hrs: float
    note: Optional[str] = None
    volunteer: VisitVolunteerInfo

    class Config:
        from_attributes = True


class VisitStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(pending|scheduled|cancelled|completed|no_show)$")