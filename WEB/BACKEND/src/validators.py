import re
from fastapi import HTTPException


def validate_password(password: str):

    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    if not re.search(r"[A-Z]", password):
        raise HTTPException(400, "Password must contain an uppercase letter")

    if not re.search(r"[a-z]", password):
        raise HTTPException(400, "Password must contain a lowercase letter")

    if not re.search(r"\d", password):
        raise HTTPException(400, "Password must contain a digit")