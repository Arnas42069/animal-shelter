from sqlalchemy import Column, BigInteger, Text, Boolean, TIMESTAMP, func, Identity, text, ForeignKey
from sqlalchemy.orm import relationship

from src.database import Base


class AppUser(Base):
    __tablename__ = "app_user"

    id = Column(BigInteger, Identity(always=True), primary_key=True)

    name = Column(Text, nullable=False)
    surname = Column(Text, nullable=False)

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


class Shelter(Base):
    __tablename__ = "shelter"

    id = Column(BigInteger, Identity(always=True), primary_key=True)

    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)

    email = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    website = Column(Text, nullable=True)

    address = Column(Text, nullable=True)
    city = Column(Text, nullable=True)
    postal_code = Column(Text, nullable=True)
    country = Column(Text, nullable=True, default="Lithuania", server_default=text("'Lithuania'"))

    is_verified = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    created_by = Column(BigInteger, ForeignKey("app_user.id"), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    user = relationship("AppUser")