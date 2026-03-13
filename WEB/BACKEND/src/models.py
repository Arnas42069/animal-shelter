from sqlalchemy import Column, Text, Boolean, BigInteger
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP
from database import Base


class AppUser(Base):
    __tablename__ = "app_user"

    id = Column(BigInteger, primary_key=True)

    username = Column(Text, unique=True, nullable=False)
    email = Column(Text, unique=True)

    password_hash = Column(Text, nullable=False)

    role = Column(Text, nullable=False)

    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    last_login_at = Column(TIMESTAMP(timezone=True))