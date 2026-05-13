from pydantic import (
    BaseModel, 
    EmailStr, 
    Field, 
    model_validator, 
    field_validator, 
    ConfigDict,
)

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

class ShelterActiveUpdateRequest(BaseModel):
    is_active: bool
    
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
# -------------------ANIMAL IMAGE------------------
# -------------------------------------------------
class AnimalImageCreate(BaseModel):
    animal_id: int
    url: str  # gali dėti HttpUrl jei tik external URL
    is_primary: Optional[bool] = False


class AnimalImageResponse(BaseModel):
    id: int
    animal_id: int
    url: str
    is_primary: bool
    created_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2


class AnimalImageUpdate(BaseModel):
    url: Optional[str] = None
    is_primary: Optional[bool] = None

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
# -------------------ANIMAL FOSTER-----------------
# -------------------------------------------------
class AnimalFosterBase(BaseModel):

    animal_id: int

    name: str
    surname: str

    email: EmailStr
    phone: Optional[str] = None

    start_date: date
    end_date: Optional[date] = None

    note: Optional[str] = None


class AnimalFosterCreate(AnimalFosterBase):
    pass


class AnimalFosterUpdate(BaseModel):

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    phone: Optional[str] = None

    note: Optional[str] = None
    admin_note: Optional[str] = None

    status: Optional[str] = None


class AnimalFosterResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: int

    animal_id: int
    user_id: int

    name: str
    surname: str

    email: EmailStr
    phone: Optional[str] = None

    start_date: date
    end_date: Optional[date] = None

    status: str

    note: Optional[str] = None
    admin_note: Optional[str] = None

    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime


# -------------------------------------------------
# -------------------VISIT-------------------------
# -------------------------------------------------

class VisitCreateRequest(BaseModel):
    shelter_id: int
    start_at: datetime
    duration_hours: int = Field(ge=1, le=12)
    is_under_16: bool = False
    is_group: bool = False
    group_size: Optional[int] = Field(default=None, ge=2)
    social_hrs: float = Field(default=0, ge=0)
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_visit_data(self):
        if self.is_group and self.group_size is None:
            raise ValueError("Grupės dydis yra privalomas")

        if not self.is_group:
            self.group_size = None

        return self


class VisitResponse(BaseModel):
    id: int
    shelter_id: int
    user_id: int
    start_at: datetime
    end_at: datetime
    status: str
    is_under_16: bool
    is_group: bool
    group_size: Optional[int] = None
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
    is_group: bool
    group_size: Optional[int] = None
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
    is_group: bool
    group_size: Optional[int] = None
    social_hrs: float
    note: Optional[str] = None
    volunteer: VisitVolunteerInfo

    class Config:
        from_attributes = True


class VisitStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(pending|scheduled|cancelled|completed|no_show)$")


class VisitUpdateRequest(BaseModel):
    start_at: Optional[datetime] = None
    duration_hours: Optional[int] = Field(default=None, ge=1, le=12)
    is_under_16: Optional[bool] = None
    is_group: Optional[bool] = None
    group_size: Optional[int] = Field(default=None, ge=2)
    social_hrs: Optional[float] = Field(default=None, ge=0)
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_visit_data(self):
        if self.is_group is False:
            self.group_size = None

        if self.is_group is True and self.group_size is None:
            raise ValueError("Grupės dydis yra privalomas")

        return self

# -------------------------------------------------
# -------------------NEWS--------------------------
# -------------------------------------------------
class NewsBase(BaseModel):
    shelter_id: Optional[int] = None
    title: str
    description: str
    image_url: Optional[str] = None
    is_published: bool = True


class NewsCreate(NewsBase):
    pass


class NewsUpdate(BaseModel):
    shelter_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_published: Optional[bool] = None


class NewsResponse(BaseModel):
    id: int
    shelter_id: Optional[int]
    user_id: int
    title: str
    description: str
    image_url: Optional[str]
    is_published: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------
# -------------------EVENTS------------------------
# -------------------------------------------------
class EventBase(BaseModel):
    shelter_id: Optional[int] = None
    title: str
    summary: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    image_url: Optional[str] = None
    is_published: bool = True

    @field_validator("ends_at")
    @classmethod
    def validate_ends_at(cls, value, info):
        starts_at = info.data.get("starts_at")
        if value is not None and starts_at is not None and value < starts_at:
            raise ValueError("Event pabaiga negali būti ankstesnė už pradžią")
        return value


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    shelter_id: Optional[int] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    image_url: Optional[str] = None
    is_published: Optional[bool] = None

    @field_validator("ends_at")
    @classmethod
    def validate_ends_at(cls, value, info):
        starts_at = info.data.get("starts_at")
        if value is not None and starts_at is not None and value < starts_at:
            raise ValueError("Event pabaiga negali būti ankstesnė už pradžią")
        return value


class EventResponse(EventBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# -------------------------------------------------
# -------------------ADMIN-------------------------
# -------------------------------------------------

class AdminUserRoleUpdateRequest(BaseModel):
    role: UserRole


class AdminShelterVerificationRequest(BaseModel):
    is_verified: bool


class AdminUserActiveUpdateRequest(BaseModel):
    is_active: bool