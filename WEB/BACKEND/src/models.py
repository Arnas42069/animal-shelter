from typing import Optional

from sqlalchemy import (
    Column,
    BigInteger,
    Text,
    Boolean,
    TIMESTAMP,
    DateTime,
    Date,
    Numeric,
    ForeignKey,
    Identity,
    UniqueConstraint,
    Index,
    func,
    text,
)

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

    favorite_animals = relationship(
        "AnimalFavorite",
        back_populates="user",
        cascade="all, delete-orphan"
    )


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

    is_verified = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    created_by = Column(BigInteger, ForeignKey("app_user.id"), nullable=True, unique=True)

    created_at = Column(
        TIMESTAMP(timezone=True), 
        nullable=False, 
        server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    user = relationship("AppUser")


class Animal(Base):
    __tablename__ = "animal"

    id = Column(BigInteger, primary_key=True, index=True)

    shelter_id = Column(
        BigInteger,
        ForeignKey("shelter.id", ondelete="RESTRICT"),
        nullable=False
    )

    name = Column(Text, nullable=True)
    code = Column(Text, unique=True, nullable=True)

    species = Column(Text, nullable=False)  # dog, cat, other
    breed = Column(Text, nullable=True)

    sex = Column(Text, nullable=False, default="unknown")  # male, female, unknown
    birth_date = Column(Date, nullable=True)
    color = Column(Text, nullable=True)

    description = Column(Text, nullable=True)

    status = Column(Text, nullable=False, default="available")

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    shelter = relationship("Shelter", backref="animals")

    # Susietos gyvuno nuotraukos
    images = relationship(
        "AnimalImage",
        back_populates="animal",
        cascade="all, delete-orphan"
    )

    favorited_by = relationship(
        "AnimalFavorite",
        back_populates="animal",
        cascade="all, delete-orphan"
    )


class AnimalImage(Base):
    __tablename__ = "animal_image"

    id = Column(BigInteger, primary_key=True, index=True)

    animal_id = Column(
        BigInteger,
        ForeignKey("animal.id", ondelete="CASCADE"),
        nullable=False,
    )

    url = Column(Text, nullable=False)

    is_primary = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # relationship (jei reikia)
    animal = relationship("Animal", back_populates="images")


class AnimalFavorite(Base):
    __tablename__ = "animal_favorite"

    id = Column(BigInteger, Identity(always=True), primary_key=True)
    user_id = Column(
        BigInteger,
        ForeignKey("app_user.id", ondelete="CASCADE"),
        nullable=False
    )
    animal_id = Column(
        BigInteger,
        ForeignKey("animal.id", ondelete="CASCADE"),
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "animal_id", name="uq_animal_favorite_user_animal"),
        Index("idx_animal_favorite_user_id", "user_id"),
        Index("idx_animal_favorite_animal_id", "animal_id"),
    )

    user = relationship("AppUser", back_populates="favorite_animals")
    animal = relationship("Animal", back_populates="favorited_by")


class Visit(Base):
    __tablename__ = "visit"

    id = Column(BigInteger, Identity(always=True), primary_key=True)

    shelter_id = Column(
        BigInteger,
        ForeignKey("shelter.id", ondelete="RESTRICT"),
        nullable=False
    )

    user_id = Column(
        BigInteger,
        ForeignKey("app_user.id", ondelete="RESTRICT"),
        nullable=False
    )

    start_at = Column(TIMESTAMP(timezone=True), nullable=False)
    end_at = Column(TIMESTAMP(timezone=True), nullable=False)

    status = Column(
        Text,
        nullable=False,
        default="pending",
        server_default=text("'pending'")
    )

    is_under_16 = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false")
    )

    social_hrs = Column(
        Numeric(5, 2),
        nullable=False,
        default=0,
        server_default=text("0")
    )

    note = Column(Text, nullable=True)

    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    shelter = relationship("Shelter")
    user = relationship("AppUser")