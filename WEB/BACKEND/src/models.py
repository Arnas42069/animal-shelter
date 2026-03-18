from sqlalchemy import Column, BigInteger, Text, Boolean, TIMESTAMP, func, Identity, text
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from src.database import Base


class AppUser(Base):
    __tablename__ = "app_user"

    id = Column(BigInteger, Identity(always=True), primary_key=True)

    username = Column(Text, unique=True, nullable=False)
    email = Column(Text, unique=True, nullable=True)

    password_hash = Column(Text, nullable=False)

    role = Column(Text, nullable=False, default="user", server_default=text("'user'"))

    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    last_login_at = Column(TIMESTAMP(timezone=True), nullable=True)