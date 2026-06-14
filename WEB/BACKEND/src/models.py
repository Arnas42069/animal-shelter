from typing import Optional
from datetime import datetime

from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
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
    CheckConstraint,
)

from sqlalchemy.orm import (
    relationship,
    Mapped,
    mapped_column
)

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

    fosters = relationship(
        "AnimalFoster",
        foreign_keys="AnimalFoster.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    news = relationship(
        "News",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    events = relationship(
        "Event",
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

    news   = relationship("News", back_populates="shelter")
    events = relationship("Event", back_populates="shelter")

    news = relationship(
        "News",
        back_populates="shelter",
        cascade="all, delete-orphan"
    )

    events = relationship(
        "Event",
        back_populates="shelter",
        cascade="all, delete-orphan"
    )


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

    fosters = relationship(
        "AnimalFoster",
        back_populates="animal",
        cascade="all, delete-orphan",
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


class AnimalFoster(Base):
    __tablename__ = "animal_foster"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    animal_id = Column(
        BigInteger,
        ForeignKey("animal.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id = Column(
        BigInteger,
        ForeignKey("app_user.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(Text, nullable=False)
    surname = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    phone = Column(Text, nullable=True)

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)

    status = Column(Text, nullable=False, default="pending")

    note = Column(Text, nullable=True)
    admin_note = Column(Text, nullable=True)

    approved_by = Column(
        BigInteger,
        ForeignKey("app_user.id"),
        nullable=True,
    )

    approved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    animal = relationship("Animal", back_populates="fosters")

    user = relationship(
        "AppUser",
        foreign_keys=[user_id],
        back_populates="fosters",
    )

    approver = relationship(
        "AppUser",
        foreign_keys=[approved_by],
    )


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

    approved_at = Column(TIMESTAMP(timezone=True), nullable=True)

    is_under_16 = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false")
    )

    wants_social_hours = Column(
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

    is_group = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false")
    )

    group_size = Column(Integer, nullable=True)

    shelter = relationship("Shelter")
    user = relationship("AppUser")


class News(Base):
    __tablename__ = "news"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    shelter_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("shelter.id", ondelete="CASCADE"),
        nullable=True
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("app_user.id"),
        nullable=False
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)

    web_url: Mapped[str] = mapped_column(Text, nullable=False)

    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_published: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    shelter = relationship("Shelter", back_populates="news")
    user = relationship("AppUser", back_populates="news")


class Event(Base):
    __tablename__ = "event"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    shelter_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("shelter.id", ondelete="CASCADE"),
        nullable=True
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("app_user.id"),
        nullable=False
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(Text, nullable=True)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("ends_at IS NULL OR ends_at >= starts_at", name="chk_event_ends_at"),
    )

    shelter = relationship("Shelter", back_populates="events")
    user = relationship("AppUser", back_populates="events")
