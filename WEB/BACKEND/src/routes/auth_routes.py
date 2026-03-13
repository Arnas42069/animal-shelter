from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models import AppUser
from schemas import RegisterRequest, LoginRequest, TokenResponse
from auth import hash_password, verify_password, create_token
from validators import validate_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):

    existing = db.query(AppUser).filter(
        or_(
            AppUser.email == data.email,
            AppUser.username == data.username
        )
    ).first()

    if existing:
        raise HTTPException(400, "Email or username already exists")

    validate_password(data.password)

    user = AppUser(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role
    )

    db.add(user)
    db.commit()

    return {"message": "User registered successfully"}

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):

    user = db.query(AppUser).filter(AppUser.email == data.email).first()

    if not user:
        raise HTTPException(401, "Invalid credentials")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    if not user.is_active:
        raise HTTPException(403, "Account inactive")

    token = create_token(user.id)

    return {
        "access_token": token
    }

@router.post("/logout")
def logout():
    return {"message": "Logged out"}