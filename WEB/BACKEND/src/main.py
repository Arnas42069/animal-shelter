from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_

from src.database import get_db
from src.models import AppUser, Shelter
from src.schemas import (
    RegisterRequest,
    VolunteerRegisterRequest,
    ShelterRegisterRequest,
    LoginRequest,
    TokenResponse
)
from src.auth import hash_password, verify_password, create_token, get_current_user
from src.validators import validate_password


app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True}

# Galimai nereikes jeigu nebreakins nieko
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
    )

    db.add(user)
    db.commit()

    return {"message": "User registered successfully"}


#Iskirta i dvi roles
@app.post("/auth/register/volunteer")
def register_volunteer(data: VolunteerRegisterRequest, db: Session = Depends(get_db)):
    
    # Tikrinam email
    existing_email = db.query(AppUser).filter(
        AppUser.email == data.email
    ).first()

    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")


    # Tikrinam username
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
def register_shelter(data: ShelterRegisterRequest, db: Session = Depends(get_db)):

    
    # Tikrinam email
    existing_email = db.query(AppUser).filter(
        AppUser.email == data.email
    ).first()

    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

    validate_password(data.password)

    user = AppUser(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role="shelter"
    )

    db.add(user)
    db.flush()

    shelter = Shelter(
        name=data.name,
        postal_code=data.postal_code,
        address=data.address,
        city=data.city,
        phone=data.phone,
        email=data.email,
        is_verified=True,
        created_by=user.id
    )

    db.add(shelter)
    db.commit()

    

    return {"message": "Shelter registered successfully, waiting for verification"}



@app.post("/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):

    user = db.query(AppUser).filter(AppUser.email == data.email).first()

    fake_hash = "$2b$12$abcdefghijklmnopqrstuv" 

    hashed = user.password_hash if user else fake_hash

    if not verify_password(data.password, hashed):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Account inactive")

    if user.role == "shelter":
        shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

        if not shelter:
            raise HTTPException(status_code=403, detail="Prieglaudos duomenys nerasti")

        if not shelter.is_verified:
            raise HTTPException(
                status_code=403,
                detail="Prieglauda dar nebuvo patvirtinta administratoriaus"
            )



    token = create_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@app.get("/auth/me")
def me(user: AppUser = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }