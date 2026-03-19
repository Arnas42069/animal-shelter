from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_

from src.database import get_db
from src.models import AppUser
from src.schemas import RegisterRequest, LoginRequest, TokenResponse
from src.auth import hash_password, verify_password, create_token, get_current_user
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
    )

    db.add(user)
    db.commit()

    return {"message": "User registered successfully"}


@app.post("/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):

    user = db.query(AppUser).filter(AppUser.email == data.email).first()

    fake_hash = "$2b$12$abcdefghijklmnopqrstuv" 

    hashed = user.password_hash if user else fake_hash

    if not verify_password(data.password, hashed):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Account inactive")

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