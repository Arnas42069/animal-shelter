from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from src.database import get_db
from src.models import AppUser, Shelter
from src.schemas import (
    RegisterRequest,
    VolunteerRegisterRequest,
    ShelterRegisterRequest,
    LoginRequest,
    TokenResponse,
    ProfileResponse,
    ProfileUpdateRequest,
    ShelterProfileResponse,
    ShelterProfileUpdateRequest
)
from src.auth import hash_password, verify_password, create_token, get_current_user, get_current_shelter
from src.validators import validate_password


app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(AppUser).filter(
        or_(
            AppUser.email == data.email,
            AppUser.username == data.username
        )
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email or username already exists")

    validate_password(data.password)

    user = AppUser(
        name=data.name,
        surname=data.surname,
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        role="volunteer"
    )

    db.add(user)
    db.commit()

    return {"message": "User registered successfully"}


@app.post("/auth/register/volunteer")
def register_volunteer(data: VolunteerRegisterRequest, db: Session = Depends(get_db)):
    existing_email = db.query(AppUser).filter(
        AppUser.email == data.email
    ).first()

    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

    existing_username = db.query(AppUser).filter(
        AppUser.username == data.username
    ).first()

    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")

    validate_password(data.password)

    user = AppUser(
        name=data.name,
        surname=data.surname,
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        role="volunteer"
    )

    db.add(user)
    db.commit()

    return {"message": "Volunteer registered successfully"}


@app.post("/auth/register/shelter")
def register_shelter(
    data: ShelterRegisterRequest,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    if current_user.role != "volunteer":
        raise HTTPException(
            status_code=403,
            detail="Tik volunteer vartotojas gali registruoti prieglaudą"
        )

    existing_shelter = db.query(Shelter).filter(
        Shelter.created_by == current_user.id
    ).first()

    if existing_shelter:
        raise HTTPException(
            status_code=400,
            detail="Šis vartotojas jau turi užregistruotą prieglaudą"
        )

    shelter = Shelter(
        name=data.name,
        description=data.description,
        email=current_user.email,
        phone=data.phone,
        website=data.website,
        address=data.address,
        city=data.city,
        postal_code=data.postal_code,
        country=data.country or "Lithuania",
        is_verified=True,
        is_active=True,
        created_by=current_user.id
    )

    db.add(shelter)

    current_user.role = "shelter"

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Shelter registered successfully",
        "role": current_user.role
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AppUser).filter(AppUser.email == data.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account inactive")

    token = create_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@app.get("/auth/me")
def me(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "has_shelter": shelter is not None,
        "is_verified": shelter.is_verified if shelter else False,
        "shelter_id": shelter.id if shelter else None
    }


####helperiai
def ensure_unique_email(db: Session, email: str, current_user_id: int):
    existing_email = db.query(AppUser).filter(
        AppUser.email == email,
        AppUser.id != current_user_id
    ).first()

    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")


def ensure_unique_username(db: Session, username: str, current_user_id: int):
    existing_username = db.query(AppUser).filter(
        AppUser.username == username,
        AppUser.id != current_user_id
    ).first()

    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")


def build_shelter_profile_response(user: AppUser, shelter: Shelter):
    return {
        "shelter_id": shelter.id,
        "account_id": user.id,
        "account_name": user.name,
        "account_surname": user.surname,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "account_is_active": user.is_active,
        "shelter_name": shelter.name,
        "description": shelter.description,
        "phone": shelter.phone,
        "website": shelter.website,
        "address": shelter.address,
        "city": shelter.city,
        "postal_code": shelter.postal_code,
        "country": shelter.country,
        "shelter_is_verified": shelter.is_verified,
        "shelter_is_active": shelter.is_active,
    }
####


@app.get("/profile", response_model=ProfileResponse)
def get_profile(
    current_user: AppUser = Depends(get_current_user),
):
    return current_user


@app.put("/profile", response_model=ProfileResponse)
def update_profile(
    data: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    if data.email is not None:
        ensure_unique_email(db, data.email, current_user.id)

    if data.username is not None:
        ensure_unique_username(db, data.username, current_user.id)

    if data.name is not None:
        current_user.name = data.name

    if data.surname is not None:
        current_user.surname = data.surname

    if data.username is not None:
        current_user.username = data.username

    if data.email is not None:
        current_user.email = data.email

    db.commit()
    db.refresh(current_user)

    return current_user


@app.get("/shelter/profile", response_model=ShelterProfileResponse)
def get_shelter_profile(
    current_user: AppUser = Depends(get_current_shelter),
    db: Session = Depends(get_db),
):
    shelter = db.query(Shelter).filter(
        Shelter.created_by == current_user.id
    ).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter profile not found")

    return build_shelter_profile_response(current_user, shelter)


@app.put("/shelter/profile", response_model=ShelterProfileResponse)
def update_shelter_profile(
    data: ShelterProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_shelter),
):
    shelter = db.query(Shelter).filter(
        Shelter.created_by == current_user.id
    ).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Shelter profile not found")

    if data.email is not None:
        ensure_unique_email(db, data.email, current_user.id)

    if data.username is not None:
        ensure_unique_username(db, data.username, current_user.id)

    if data.account_name is not None:
        current_user.name = data.account_name

    if data.account_surname is not None:
        current_user.surname = data.account_surname

    if data.username is not None:
        current_user.username = data.username

    if data.email is not None:
        current_user.email = data.email

    if data.shelter_name is not None:
        shelter.name = data.shelter_name

    if data.description is not None:
        shelter.description = data.description

    if data.phone is not None:
        shelter.phone = data.phone

    if data.website is not None:
        shelter.website = data.website

    if data.address is not None:
        shelter.address = data.address

    if data.city is not None:
        shelter.city = data.city

    if data.postal_code is not None:
        shelter.postal_code = data.postal_code

    if data.country is not None:
        shelter.country = data.country

    db.commit()
    db.refresh(current_user)
    db.refresh(shelter)

    return build_shelter_profile_response(current_user, shelter)