from typing import Optional
from datetime import date, datetime, timedelta, timezone
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import uuid


from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, asc, desc
from src.email_service import build_pending_visit_email, send_email

from src.database import get_db
from src.models import (
    AppUser, 
    Shelter,
    Animal,
    AnimalImage,
    AnimalFavorite,
    AnimalFoster,
    Visit,
    News,
    Event,
)
from src.schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,

    ShelterRegisterRequest,
    ShelterResponse,
    ShelterUpdateRequest,
    ShelterActiveUpdateRequest,

    AnimalCreateRequest,
    AnimalResponse,
    AnimalListResponse,
    AnimalUpdateRequest,

    AnimalImageCreate,
    AnimalImageResponse,
    AnimalImageUpdate,

    AnimalFavoriteCreate,
    AnimalFavoriteResponse,
    AnimalFavoriteSimpleResponse,

    AnimalFosterBase,
    AnimalFosterCreate,
    AnimalFosterResponse,
    AnimalFosterUpdate,

    VisitCreateRequest,
    VisitResponse,
    VisitMeResponse,
    ShelterVisitResponse,
    VisitStatusUpdateRequest,
    VisitUpdateRequest,

    NewsBase,
    NewsCreate,
    NewsUpdate,
    NewsResponse,

    EventBase,
    EventCreate,
    EventUpdate,
    EventResponse,

    AdminUserRoleUpdateRequest,
    AdminShelterVerificationRequest,
    AdminUserActiveUpdateRequest,
)
from src.auth import (
    hash_password, 
    verify_password, 
    create_token, 
    get_current_user,
    get_current_user_optional,
)

from src.validators import validate_password



app = FastAPI()

# --------------------------------------------
# ----------------UPLOADS----------------------
# --------------------------------------------

# Laikinas uploads katalogas konteineryje
# Naudojam /tmp, nes ten turim rasymo teises
UPLOADS_DIR = Path("/tmp/uploads")

# Gyvunu nuotrauku katalogas
ANIMAL_UPLOADS_DIR = UPLOADS_DIR / "animals"

# Sukuriam katalogus jei ju dar nera
ANIMAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Static failu atidavimas per /uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"ok": True}


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


# -------------------------------------------------
# -------------------APPUSER-----------------------
# -------------------------------------------------

# CREATE
@app.post("/auth/register")
def register_volunteer(data: RegisterRequest, db: Session = Depends(get_db)):
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


# READ
@app.get("/appuser", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    """
    Gauti visų vartotojų sąrašą.

    Parametrai:
    - Nėra

    Grąžina:
    - Sąrašą visų vartotojų

    Klaidos:
    - Nėra (jei nėra vartotojų – grąžinamas tuščias sąrašas)

    Pavyzdys:
    - GET /users
    """

    users = db.query(AppUser).all()
    return users


@app.get("/appuser/me", response_model=UserResponse)
def get_me(
    user: AppUser = Depends(get_current_user)
):
    """
    Gauti prisijungusio vartotojo informaciją pagal tokeną.

    Parametrai:
    - Authorization: Bearer <access_token>

    Grąžina:
    - Prisijungusio vartotojo objektą

    Klaidos:
    - 401 jei tokenas neteisingas arba pasibaigęs

    Pavyzdys:
    - GET /appuser/me
    """

    return user


# UPDATE
@app.patch("/appuser/me", response_model=UserResponse)
def update_me(
    data: UserUpdateRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atnaujinti prisijungusio vartotojo duomenis.

    Parametrai:
    - data: atnaujinami vartotojo laukai (nebūtina pateikti visų)
    - user: prisijungęs vartotojas

    Grąžina:
    - Atnaujintą vartotojo objektą

    Klaidos:
    - 400 jei naujas username jau naudojamas
    - 400 jei naujas el. paštas jau naudojamas

    Pavyzdys:
    - PATCH /appuser/me
    """

    update_data = data.model_dump(exclude_unset=True)

    # -----------------------------
    # VALIDATION METHODS
    # -----------------------------
    def validate_unique_username(username: str):
        existing = db.query(AppUser).filter(
            AppUser.username == username,
            AppUser.id != user.id
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Toks vartotojo vardas jau naudojamas"
            )

    def validate_unique_email(email: str):
        existing = db.query(AppUser).filter(
            AppUser.email == email,
            AppUser.id != user.id
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Toks el. paštas jau naudojamas"
            )

    # -----------------------------
    # VALIDATIONS CALL
    # -----------------------------
    if "username" in update_data:
        validate_unique_username(update_data["username"])

    if "email" in update_data and update_data["email"] is not None:
        validate_unique_email(update_data["email"])

    # jei leisim keisti slaptažodį
    if "password" in update_data:
        validate_password(update_data["password"])
        update_data["password_hash"] = hash_password(update_data.pop("password"))

    # -----------------------------
    # UPDATE
    # -----------------------------
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


# DELETE
@app.delete("/appuser/me")
def delete_me(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ištrinti prisijungusio vartotojo paskyrą pagal tokeną.

    Parametrai:
    - Authorization: Bearer <access_token>

    Grąžina:
    - Sėkmės pranešimą

    Klaidos:
    - 404 jei vartotojas nerastas

    Pavyzdys:
    - DELETE /appuser/me
    """

    existing_user = db.query(AppUser).filter(AppUser.id == user.id).first()

    if not existing_user:
        raise HTTPException(status_code=404, detail="Vartotojas nerastas")

    db.delete(existing_user)
    db.commit()

    return {"message": "Vartotojas sėkmingai ištrintas"}


# -------------------------------------------------
# -------------------SHELTER-----------------------
# -------------------------------------------------

# CREATE
@app.post("/shelter")
def register_shelter(
    data: ShelterRegisterRequest,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user)
):
    """
    Užregistruoti naują prieglaudą prisijungusiam vartotojui.

    Parametrai:
    - data: prieglaudos registracijos duomenys
    - current_user: prisijungęs vartotojas, kuris registruoja prieglaudą

    Grąžina:
    - Pranešimą apie sėkmingą registraciją
    - Atnaujintą vartotojo rolę

    Klaidos:
    - 403 jei vartotojas nėra volunteer rolės
    - 400 jei vartotojas jau turi užregistruotą prieglaudą

    Pavyzdys:
    - POST /auth/register/shelter
    """
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
        "message": "Prieglauda užregistruota ir pateikta administratoriaus patvirtinimui",
        "role": current_user.role
    }


# READ
@app.get("/shelter", response_model=list[ShelterResponse])
def get_shelters(
    city: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Gauti visų prieglaudų sąrašą su galimybe filtruoti pagal miestą.

    Parametrai:
    - city: (nebūtinas) filtruoti prieglaudas pagal miestą

    Grąžina:
    - Prieglaudų sąrašą

    Klaidos:
    - Nėra (grąžinamas tuščias sąrašas jei nieko nerasta)

    Pavyzdys:
    - /shelter
    - /shelter?city=Kaunas
    """
    query = db.query(Shelter)

    if city:
        query = query.filter(Shelter.city == city)

    return query.all()


@app.get("/shelter/by-name/{name}", response_model=ShelterResponse)
def get_shelter_by_name(
    name: str, 
    db: Session = Depends(get_db)
):
    """
    Gauti vieną prieglaudą pagal pavadinimą.

    Parametrai:
    - name: prieglaudos pavadinimas

    Grąžina:
    - Vieną prieglaudos objektą

    Klaidos:
    - 404 jei prieglauda su tokiu pavadinimu nerasta

    Pavyzdys:
    - /shelter/by-name/Leses
    """
    shelter = db.query(Shelter).filter(Shelter.name == name).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    return shelter


@app.get("/shelter/me", response_model=ShelterResponse)
def get_my_shelter(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gauti prisijungusio vartotojo prieglaudą.

    Parametrai:
    - user: prisijungęs vartotojas

    Grąžina:
    - Vieną prieglaudos objektą, kuris priklauso prisijungusiam vartotojui

    Klaidos:
    - 404 jei vartotojas neturi susietos prieglaudos

    Pavyzdys:
    - /shelter/me
    """
    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    return shelter


# UPDATE
@app.patch("/shelter/me", response_model=ShelterResponse)
def update_my_shelter(
    data: ShelterUpdateRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atnaujinti prisijungusio vartotojo prieglaudos duomenis.

    Parametrai:
    - data: atnaujinami prieglaudos laukai (nebūtina pateikti visų)
    - user: prisijungęs vartotojas

    Grąžina:
    - Atnaujintą prieglaudos objektą

    Klaidos:
    - 404 jei vartotojas neturi susietos prieglaudos
    - 400 jei naujas prieglaudos pavadinimas jau naudojamas
    - 400 jei naujas el. paštas jau naudojamas

    Pavyzdys:
    - PATCH /shelter/me
    """
    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    update_data = data.model_dump(exclude_unset=True)

    # -----------------------------
    # VALIDATION METHODS
    # -----------------------------
    def validate_unique_name(name: str):
        existing = db.query(Shelter).filter(
            Shelter.name == name,
            Shelter.id != shelter.id
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Toks prieglaudos pavadinimas jau naudojamas"
            )

    def validate_unique_email(email: str):
        existing = db.query(Shelter).filter(
            Shelter.email == email,
            Shelter.id != shelter.id
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Toks el. paštas jau naudojamas"
            )

    # -----------------------------
    # VALIDATIONS CALL
    # -----------------------------
    if "name" in update_data:
        validate_unique_name(update_data["name"])

    if "email" in update_data and update_data["email"] is not None:
        validate_unique_email(update_data["email"])

    # -----------------------------
    # UPDATE
    # -----------------------------
    for field, value in update_data.items():
        setattr(shelter, field, value)

    db.commit()
    db.refresh(shelter)

    return shelter


# DELETE
@app.delete("/shelter/me")
def delete_my_shelter(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ištrinti prisijungusio vartotojo prieglaudą.

    Parametrai:
    - user: prisijungęs vartotojas

    Grąžina:
    - Pranešimą apie sėkmingą prieglaudos ištrynimą

    Klaidos:
    - 404 jei vartotojas neturi susietos prieglaudos

    Pavyzdys:
    - DELETE /shelter/me
    """ 
    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    db.delete(shelter)
    db.commit()

    return {"message": "Prieglauda ištrinta sėkmingai"}


@app.patch("/shelter/me/active", response_model=ShelterResponse)
def update_my_shelter_active_status(
    data: ShelterActiveUpdateRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Leisti prieglaudai įjungti/išjungti savo aktyvumą.
    """

    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    if not shelter.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Negalite aktyvuoti nepatvirtintos prieglaudos"
        )

    shelter.is_active = data.is_active

    db.commit()
    db.refresh(shelter)

    return shelter

# -------------------------------------------------
# -------------------ANIMAL------------------------
# -------------------------------------------------

# CREATE
@app.post("/animal", response_model=AnimalResponse)
def create_animal(
    data: AnimalCreateRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=400, detail="Vartotojas neturi prieglaudos")

    # -----------------------------
    # VALIDATION METHODS
    # -----------------------------
    def validate_unique_code(code: Optional[str]):
        if not code:
            return

        existing = db.query(Animal).filter(
            Animal.code == code
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Toks gyvūno kodas jau naudojamas"
            )

    # -----------------------------
    # VALIDATIONS CALL
    # -----------------------------
    validate_unique_code(data.code)

    # -----------------------------
    # CREATE
    # -----------------------------
    animal = Animal(
        shelter_id=shelter.id,
        **data.model_dump()
    )

    db.add(animal)
    db.commit()
    db.refresh(animal)


    return animal

# CREATE / UPDATE GYVUNO NUOTRAUKA
@app.post("/animal/{animal_id}/image")
def upload_my_animal_image(
    animal_id: int,
    image: UploadFile = File(...),
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ikelia arba pakeicia pagrindine gyvuno nuotrauka.

    Prieiga:
    - Tik autentifikuoti shelter vartotojai
    - Tik savo prieglaudos gyvunams

    Elgsena:
    - Jei sena pagrindine nuotrauka yra, ji pasalinama
    - Irasomas naujas irasas i animal_image
    - Grazinamas naujos nuotraukos url
    """

    # Randam prisijungusio vartotojo prieglauda
    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    # Randam gyvuna ir tikrinam ar jis priklauso tai prieglaudai
    animal = db.query(Animal).filter(
        Animal.id == animal_id,
        Animal.shelter_id == shelter.id
    ).first()

    if not animal:
        raise HTTPException(
            status_code=404,
            detail="Gyvūnas nerastas arba nepriklauso jūsų prieglaudai"
        )

    # Leidziami failu formatai
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}

    # Tikrinam failo pletini
    file_extension = Path(image.filename or "").suffix.lower()

    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Leidžiami tik JPG, JPEG, PNG ir WEBP failai"
        )

    # Tikrinam ar tai paveiksliukas
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Įkeltas failas nėra paveikslėlis"
        )

    # Pasalinam sena pagrindine nuotrauka jei ji yra
    old_images = db.query(AnimalImage).filter(
        AnimalImage.animal_id == animal.id,
        AnimalImage.is_primary == True
    ).all()

    for old_image in old_images:
        # Is /uploads/animals/xxx.jpg padarom kelia iki failo diske
        relative_path = old_image.url.replace("/uploads/", "")
        old_file_path = UPLOADS_DIR / relative_path

        if old_file_path.exists():
            old_file_path.unlink()

        db.delete(old_image)

    # Sukuriam nauja unikalu failo pavadinima
    unique_filename = f"{animal.id}_{uuid.uuid4().hex}{file_extension}"
    saved_file_path = ANIMAL_UPLOADS_DIR / unique_filename

    # Issaugom faila diske
    with saved_file_path.open("wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    # Public url, kuri gales naudoti frontend
    public_url = f"/uploads/animals/{unique_filename}"

    # Sukuriam irasa DB
    animal_image = AnimalImage(
        animal_id=animal.id,
        url=public_url,
        is_primary=True
    )

    db.add(animal_image)
    db.commit()

    return {
        "message": "Gyvūno nuotrauka sėkmingai įkelta",
        "url": public_url
    }


# READ
@app.get("/animal", response_model=AnimalListResponse)
def get_animals(
    shelter_id: Optional[int] = None,
    status: Optional[str] = None,
    species: Optional[str] = None,
    breed: Optional[str] = None,
    search: Optional[str] = None,
    sex: Optional[str] = None,
    birth_date_from: Optional[date] = None,
    birth_date_to: Optional[date] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "asc",
    page: int = 1,
    page_size: int = 12,
    user: Optional[AppUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Gauti gyvūnų sąrašą su pasirinktiniais filtrais.
    """

    if page < 1:
        page = 1

    if page_size < 1:
        page_size = 12

    if page_size > 100:
        page_size = 100

    query = db.query(Animal)

    if shelter_id:
        query = query.filter(Animal.shelter_id == shelter_id)

    if status:
        query = query.filter(Animal.status == status)

    if species:
        query = query.filter(Animal.species == species)

    if breed:
        query = query.filter(Animal.breed == breed)

    if search:
        search_value = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Animal.name.ilike(search_value),
                Animal.breed.ilike(search_value)
            )
        )

    if sex:
        query = query.filter(Animal.sex == sex)

    if birth_date_from:
        query = query.filter(Animal.birth_date >= birth_date_from)

    if birth_date_to:
        query = query.filter(Animal.birth_date <= birth_date_to)

    if sort_by == "name":
        if sort_order == "desc":
            query = query.order_by(Animal.name.desc())
        else:
            query = query.order_by(Animal.name.asc())

    elif sort_by == "breed":
        if sort_order == "desc":
            query = query.order_by(Animal.breed.desc())
        else:
            query = query.order_by(Animal.breed.asc())

    elif sort_by == "birth_date":
        if sort_order == "desc":
            query = query.order_by(Animal.birth_date.desc())
        else:
            query = query.order_by(Animal.birth_date.asc())

    else:
        query = query.order_by(Animal.created_at.desc())

    total = query.count()

    offset = (page - 1) * page_size
    animals = query.offset(offset).limit(page_size).all()

    if user and animals:
        animal_ids = [animal.id for animal in animals]

        favorite_rows = db.query(AnimalFavorite.animal_id).filter(
            AnimalFavorite.user_id == user.id,
            AnimalFavorite.animal_id.in_(animal_ids)
        ).all()

        favorite_animal_ids = {animal_id for (animal_id,) in favorite_rows}

        for animal in animals:
            animal.is_favorite = animal.id in favorite_animal_ids
    else:
        for animal in animals:
            animal.is_favorite = False

    attach_primary_image_urls(db, animals)

    return {
        "items": animals,
        "total": total,
        "page": page,
        "page_size": page_size,
    }

# READ MANO PRIEGLAUDOS GYVUNUS
@app.get("/animal/me", response_model=list[AnimalResponse])
def get_my_animals(
    species: Optional[str] = None,
    breed: Optional[str] = None,
    sex: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc",
    page: int = 1,
    page_size: int = 6,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gauti prisijungusios prieglaudos gyvūnų sąrašą.
    """

    if page < 1:
        page = 1

    if page_size < 1:
        page_size = 6

    if page_size > 50:
        page_size = 50

    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    query = db.query(Animal).filter(Animal.shelter_id == shelter.id)

    if status:
        query = query.filter(Animal.status == status)

    if species:
        query = query.filter(Animal.species == species)

    if breed:
        query = query.filter(Animal.breed == breed)

    if sex:
        query = query.filter(Animal.sex == sex)

    order_fn = desc if sort_order == "desc" else asc

    if sort_by == "name":
        query = query.order_by(order_fn(Animal.name))
    elif sort_by == "breed":
        query = query.order_by(order_fn(Animal.breed))
    elif sort_by == "birth_date":
        query = query.order_by(order_fn(Animal.birth_date))
    else:
        query = query.order_by(desc(Animal.created_at))

    offset = (page - 1) * page_size
    animals = query.offset(offset).limit(page_size).all()

    if animals:
        animal_ids = [animal.id for animal in animals]

        favorite_rows = db.query(AnimalFavorite.animal_id).filter(
            AnimalFavorite.user_id == user.id,
            AnimalFavorite.animal_id.in_(animal_ids)
        ).all()

        favorite_animal_ids = {animal_id for (animal_id,) in favorite_rows}

        for animal in animals:
            animal.is_favorite = animal.id in favorite_animal_ids
    else:
        for animal in animals:
            animal.is_favorite = False

    attach_primary_image_urls(db, animals)

    return animals


@app.get("/animal/{animal_id}", response_model=AnimalResponse)
def get_animal_by_id(
    animal_id: int,
    user: Optional[AppUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    animal = db.query(Animal).filter(Animal.id == animal_id).first()

    if not animal:
        raise HTTPException(status_code=404, detail="Gyvūnas nerastas")

    if user:
        favorite = db.query(AnimalFavorite).filter(
            AnimalFavorite.user_id == user.id,
            AnimalFavorite.animal_id == animal.id
        ).first()

        animal.is_favorite = favorite is not None
    else:
        animal.is_favorite = False

    attach_primary_image_urls(db, animal)

    return animal


@app.get("/animal/by-code/{code}", response_model=AnimalResponse)
def get_animal_by_code(
    code: str,
    user: Optional[AppUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Gauti vieną gyvūną pagal unikalų kodą.

    Parametrai:
    - code: unikalus gyvūno identifikatorius (pvz. QR ar vidinis kodas)

    Grąžina:
    - Vieną gyvūno objektą

    Klaidos:
    - 404 jei gyvūnas su tokiu kodu nerastas

    Pavyzdys:
    - /animal/by-code/ABC123
    """
    animal = db.query(Animal).filter(Animal.code == code).first()

    if not animal:
        raise HTTPException(status_code=404, detail="Gyvūnas nerastas")

    # Pridedam pagrindines nuotraukos url

    # ANIMAL FAVORITE
    if user:
        favorite = db.query(AnimalFavorite).filter(
            AnimalFavorite.user_id == user.id,
            AnimalFavorite.animal_id == animal.id
        ).first()

        animal.is_favorite = favorite is not None
    else:
        animal.is_favorite = False

    return animal


# UPDATE
@app.patch("/animal/by-code/{code}", response_model=AnimalResponse)
def update_my_animal(
    code: str,
    data: AnimalUpdateRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atnaujina gyvūno duomenis pagal unikalų kodą.

    Prieiga:
    - Tik autentifikuoti vartotojai
    - Tik savo prieglaudos gyvūnai

    Elgsena:
    - Naudojamas partial update (PATCH)
    - Tikrinamas kodo (code) unikalumas
    - Neleidžiama keisti kitų prieglaudų gyvūnų
    """
    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    animal = db.query(Animal).filter(
        Animal.code == code,
        Animal.shelter_id == shelter.id
    ).first()

    if not animal:
        raise HTTPException(
            status_code=404,
            detail="Gyvūnas nerastas arba nepriklauso jūsų prieglaudai"
        )

    update_data = data.model_dump(exclude_unset=True)

    # -----------------------------
    # VALIDATION METHODS
    # -----------------------------
    def validate_unique_code(new_code: str):
        existing = db.query(Animal).filter(
            Animal.code == new_code,
            Animal.id != animal.id
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Toks gyvūno kodas jau naudojamas"
            )

    # -----------------------------
    # VALIDATIONS CALL
    # -----------------------------
    if "code" in update_data and update_data["code"] is not None:
        validate_unique_code(update_data["code"])

    # -----------------------------
    # UPDATE
    # -----------------------------
    for field, value in update_data.items():
        setattr(animal, field, value)

    db.commit()
    db.refresh(animal)



    return animal


# DELETE
@app.delete("/animal/by-code/{code}")
def delete_my_animal(
    code: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ištrina prisijungusio vartotojo prieglaudai priklausantį gyvūną pagal unikalų kodą.
    Leidžiama trinti tik savo prieglaudos gyvūnus.
    """

    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    animal = db.query(Animal).filter(
        Animal.code == code,
        Animal.shelter_id == shelter.id
    ).first()

    if not animal:
        raise HTTPException(
            status_code=404,
            detail="Gyvūnas nerastas arba nepriklauso jūsų prieglaudai"
        )

    db.delete(animal)
    db.commit()

    return {"message": "Gyvūnas sėkmingai ištrintas"}


# -------------------------------------------------
# -------------------ANIMAL IMAGE------------------
# -------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
ANIMAL_IMAGE_ROOT = BASE_DIR / "assets" / "img" / "Animal"


def attach_primary_image_urls(db: Session, animals: list[Animal]) -> None:
    """
    Prideda kiekvienam gyvūnui lauką primary_image_url iš animal_image lentelės.
    """
    if not animals:
        return

    animal_ids = [animal.id for animal in animals]

    image_rows = db.query(AnimalImage).filter(
        AnimalImage.animal_id.in_(animal_ids)
    ).order_by(
        AnimalImage.animal_id.asc(),
        AnimalImage.is_primary.desc(),
        AnimalImage.created_at.asc(),
        AnimalImage.id.asc()
    ).all()

    image_map = {}

    for image in image_rows:
        if image.animal_id not in image_map:
            image_map[image.animal_id] = image.url

    for animal in animals:
        animal.primary_image_url = image_map.get(animal.id)


def get_user_shelter(db: Session, user_id: int) -> Optional[Shelter]:
    return db.query(Shelter).filter(Shelter.created_by == user_id).first()


def ensure_animal_belongs_to_user_shelter(
    animal: Animal,
    user: AppUser,
    db: Session
):
    shelter = get_user_shelter(db, user.id)

    if not shelter:
        raise HTTPException(
            status_code=403,
            detail="Vartotojas neturi prieglaudos"
        )

    if animal.shelter_id != shelter.id:
        raise HTTPException(
            status_code=403,
            detail="Neturite teisės valdyti šio gyvūno nuotraukų"
        )


def set_primary_image(
    db: Session,
    animal_id: int,
    new_primary_image_id: int
):
    db.query(AnimalImage).filter(
        AnimalImage.animal_id == animal_id
    ).update(
        {AnimalImage.is_primary: False},
        synchronize_session=False
    )

    db.query(AnimalImage).filter(
        AnimalImage.id == new_primary_image_id
    ).update(
        {AnimalImage.is_primary: True},
        synchronize_session=False
    )


def ensure_animal_has_primary_image(
    db: Session,
    animal_id: int
):
    primary_exists = db.query(AnimalImage).filter(
        AnimalImage.animal_id == animal_id,
        AnimalImage.is_primary == True
    ).first()

    if primary_exists:
        return

    first_image = db.query(AnimalImage).filter(
        AnimalImage.animal_id == animal_id
    ).order_by(AnimalImage.created_at.asc(), AnimalImage.id.asc()).first()

    if first_image:
        first_image.is_primary = True
        db.commit()


def ensure_animal_image_directory(animal_code: str) -> Path:
    """
    Užtikrina, kad egzistuotų gyvūno nuotraukų katalogas:
    /assets/img/Animal/{animal_code}/
    """
    animal_dir = ANIMAL_IMAGE_ROOT / animal_code
    animal_dir.mkdir(parents=True, exist_ok=True)
    return animal_dir


def get_next_animal_image_filename(animal_dir: Path) -> tuple[str, bool]:
    """
    Grąžina sekantį failo pavadinimą.

    Taisyklės:
    - jei nėra primary.png -> grąžina primary.png ir is_primary=True
    - jei yra -> grąžina 2.png, 3.png, 4.png... ir is_primary=False
    """
    primary_path = animal_dir / "primary.png"

    if not primary_path.exists():
        return "primary.png", True

    existing_numbers = []

    for file_path in animal_dir.glob("*.png"):
        stem = file_path.stem.lower()

        if stem == "primary":
            continue

        if stem.isdigit():
            existing_numbers.append(int(stem))

    next_number = 2
    while next_number in existing_numbers:
        next_number += 1

    return f"{next_number}.png", False


def save_upload_file_as_png(upload_file: UploadFile, destination: Path) -> None:
    """
    Išsaugo įkeltą failą į nurodytą vietą.
    Šitas variantas failą tik pervadina į .png.
    Jis nekonvertuoja realaus formato.

    Jei nori tikro konvertavimo į PNG, reikės Pillow.
    """
    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)


# CREATE
@app.post("/animal/image", response_model=AnimalImageResponse)
def create_animal_image(
    data: AnimalImageCreate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sukurti naują gyvūno nuotrauką.

    Parametrai:
    - data: gyvūno nuotraukos duomenys (`animal_id`, `url`, `is_primary`)

    Grąžina:
    - Sukurtą gyvūno nuotrauką

    Klaidos:
    - 404 jei gyvūnas nerastas
    - 403 jei vartotojas neturi teisės valdyti šio gyvūno

    Pavyzdys:
    - POST /animal/image
    """

    animal = db.query(Animal).filter(Animal.id == data.animal_id).first()

    if not animal:
        raise HTTPException(status_code=404, detail="Gyvūnas nerastas")

    ensure_animal_belongs_to_user_shelter(animal, user, db)

    existing_count = db.query(AnimalImage).filter(
        AnimalImage.animal_id == data.animal_id
    ).count()

    final_is_primary = data.is_primary

    if existing_count == 0:
        final_is_primary = True

    new_image = AnimalImage(
        animal_id=data.animal_id,
        url=data.url,
        is_primary=final_is_primary
    )

    db.add(new_image)
    db.commit()
    db.refresh(new_image)

    if final_is_primary:
        set_primary_image(db, data.animal_id, new_image.id)
        db.commit()
        db.refresh(new_image)

    ensure_animal_has_primary_image(db, data.animal_id)
    db.refresh(new_image)

    return new_image


# READ
@app.get("/animal/image", response_model=list[AnimalImageResponse])
def get_animal_images(
    animal_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Gauti gyvūnų nuotraukų sąrašą.

    Parametrai:
    - animal_id: (nebūtinas) filtruoti pagal gyvūno ID

    Grąžina:
    - Gyvūnų nuotraukų sąrašą

    Klaidos:
    - Nėra

    Pavyzdys:
    - /animal/image
    - /animal/image?animal_id=1
    """

    query = db.query(AnimalImage)

    if animal_id is not None:
        query = query.filter(AnimalImage.animal_id == animal_id)

    images = query.order_by(
        AnimalImage.is_primary.desc(),
        AnimalImage.created_at.asc(),
        AnimalImage.id.asc()
    ).all()

    return images


@app.get("/animal/image/{image_id}", response_model=AnimalImageResponse)
def get_animal_image(
    image_id: int,
    db: Session = Depends(get_db)
):
    """
    Gauti vieną gyvūno nuotrauką pagal ID.

    Parametrai:
    - image_id: nuotraukos ID

    Grąžina:
    - Vieną gyvūno nuotrauką

    Klaidos:
    - 404 jei nuotrauka nerasta

    Pavyzdys:
    - /animal/image/5
    """

    image = db.query(AnimalImage).filter(AnimalImage.id == image_id).first()

    if not image:
        raise HTTPException(status_code=404, detail="Nuotrauka nerasta")

    return image


# UPDATE
@app.patch("/animal/image/{image_id}", response_model=AnimalImageResponse)
def update_animal_image(
    image_id: int,
    data: AnimalImageUpdate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atnaujinti gyvūno nuotrauką.

    Parametrai:
    - image_id: nuotraukos ID
    - data: atnaujinami laukai (`url`, `is_primary`)

    Grąžina:
    - Atnaujintą gyvūno nuotrauką

    Klaidos:
    - 404 jei nuotrauka nerasta
    - 403 jei vartotojas neturi teisės valdyti šios nuotraukos

    Pavyzdys:
    - PATCH /animal/image/5
    """

    image = db.query(AnimalImage).filter(AnimalImage.id == image_id).first()

    if not image:
        raise HTTPException(status_code=404, detail="Nuotrauka nerasta")

    animal = db.query(Animal).filter(Animal.id == image.animal_id).first()

    if not animal:
        raise HTTPException(status_code=404, detail="Gyvūnas nerastas")

    ensure_animal_belongs_to_user_shelter(animal, user, db)

    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(image, key, value)

    db.commit()
    db.refresh(image)

    if data.is_primary is True:
        set_primary_image(db, image.animal_id, image.id)
        db.commit()
        db.refresh(image)

    ensure_animal_has_primary_image(db, image.animal_id)
    db.refresh(image)

    return image


# DELETE
@app.delete("/animal/image/{image_id}")
def delete_animal_image(
    image_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ištrinti gyvūno nuotrauką.

    Parametrai:
    - image_id: nuotraukos ID

    Grąžina:
    - Sėkmės žinutę

    Klaidos:
    - 404 jei nuotrauka nerasta
    - 403 jei vartotojas neturi teisės ištrinti šios nuotraukos

    Pavyzdys:
    - DELETE /animal/image/5
    """

    image = db.query(AnimalImage).filter(AnimalImage.id == image_id).first()

    if not image:
        raise HTTPException(status_code=404, detail="Nuotrauka nerasta")

    animal = db.query(Animal).filter(Animal.id == image.animal_id).first()

    if not animal:
        raise HTTPException(status_code=404, detail="Gyvūnas nerastas")

    ensure_animal_belongs_to_user_shelter(animal, user, db)

    animal_id = image.animal_id
    was_primary = image.is_primary

    db.delete(image)
    db.commit()

    if was_primary:
        ensure_animal_has_primary_image(db, animal_id)

    return {"message": "Nuotrauka sėkmingai ištrinta"}


# -------------------------------------------------
# -------------------ANIMAL FAVORITE---------------
# -------------------------------------------------

# CREATE
@app.post("/animal/favorite", response_model=AnimalFavoriteResponse)
def create_animal_favorite(
    data: AnimalFavoriteCreate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pažymėti gyvūną kaip patikusį.

    Parametrai:
    - data: objektas su `animal_id`
    - user: prisijungęs vartotojas

    Grąžina:
    - Sukurtą favorite įrašą

    Klaidos:
    - 404 jei gyvūnas nerastas
    - 400 jei gyvūnas jau pažymėtas kaip patikęs

    Pavyzdys:
    - POST /animal/favorite
    """

    animal = db.query(Animal).filter(Animal.id == data.animal_id).first()

    if not animal:
        raise HTTPException(status_code=404, detail="Gyvūnas nerastas")

    existing_favorite = db.query(AnimalFavorite).filter(
        AnimalFavorite.user_id == user.id,
        AnimalFavorite.animal_id == data.animal_id
    ).first()

    if existing_favorite:
        raise HTTPException(status_code=400, detail="Gyvūnas jau pažymėtas kaip patikęs")

    favorite = AnimalFavorite(
        user_id=user.id,
        animal_id=data.animal_id
    )

    db.add(favorite)
    db.commit()
    db.refresh(favorite)

    return favorite


# READ
@app.get("/animal/favorite", response_model=list[AnimalFavoriteResponse])
def get_my_animal_favorites(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gauti prisijungusio vartotojo patikusių gyvūnų sąrašą.

    Parametrai:
    - user: prisijungęs vartotojas

    Grąžina:
    - Patikusių gyvūnų įrašų sąrašą

    Pavyzdys:
    - GET /animal/favorite
    """

    favorites = db.query(AnimalFavorite).filter(
        AnimalFavorite.user_id == user.id
    ).order_by(AnimalFavorite.created_at.desc()).all()

    return favorites


@app.get("/animal/favorite/list", response_model=list[AnimalResponse])
def get_my_favorite_animals(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gauti prisijungusio vartotojo patikusių gyvūnų sąrašą.

    Parametrai:
    - user: prisijungęs vartotojas

    Grąžina:
    - Patikusių gyvūnų objektų sąrašą

    Pavyzdys:
    - GET /animal/favorite/list
    """

    animals = db.query(Animal).join(
        AnimalFavorite, AnimalFavorite.animal_id == Animal.id
    ).filter(
        AnimalFavorite.user_id == user.id
    ).order_by(
        AnimalFavorite.created_at.desc()
    ).all()

    return animals


# DELETE
@app.delete("/animal/favorite/{animal_id}")
def delete_animal_favorite(
    animal_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pašalinti gyvūną iš prisijungusio vartotojo patikusių sąrašo.

    Parametrai:
    - animal_id: gyvūno identifikatorius
    - user: prisijungęs vartotojas

    Grąžina:
    - Sėkmės žinutę

    Klaidos:
    - 404 jei favorite įrašas nerastas

    Pavyzdys:
    - DELETE /animal/favorite/5
    """

    favorite = db.query(AnimalFavorite).filter(
        AnimalFavorite.user_id == user.id,
        AnimalFavorite.animal_id == animal_id
    ).first()

    if not favorite:
        raise HTTPException(
            status_code=404,
            detail="Patikęs gyvūnas nerastas"
        )

    db.delete(favorite)
    db.commit()

    return {"message": "Gyvūnas pašalintas iš patikusių"}



# -------------------------------------------------
# ----------------ANIMAL FOSTER--------------------
# -------------------------------------------------

# CREATE
@app.post("/animal/foster", response_model=AnimalFosterResponse)
def create_animal_foster(
    data: AnimalFosterCreate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    animal = db.query(Animal).filter(
        Animal.id == data.animal_id
    ).first()

    if not animal:
        raise HTTPException(status_code=404, detail="Gyvūnas nerastas")

    if animal.status not in {"available", "reserved"}:
        raise HTTPException(
            status_code=400,
            detail="Šiam gyvūnui trumpalaikės globos prašymo pateikti negalima"
        )

    existing_request = db.query(AnimalFoster).filter(
        AnimalFoster.animal_id == data.animal_id,
        AnimalFoster.user_id == user.id,
        AnimalFoster.status.in_(["pending", "approved", "active"])
    ).first()

    if existing_request:
        raise HTTPException(
            status_code=400,
            detail="Jūs jau turite aktyvų šio gyvūno globos prašymą"
        )

    foster = AnimalFoster(
        user_id=user.id,
        **data.model_dump()
    )

    db.add(foster)
    db.commit()
    db.refresh(foster)

    return foster


# READ ALL
@app.get("/animal/foster", response_model=list[AnimalFosterResponse])
def get_animal_fosters(
    status: Optional[str] = None,
    animal_id: Optional[int] = None,
    user_id: Optional[int] = None,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(AnimalFoster)

    if user.role == "volunteer":
        query = query.filter(AnimalFoster.user_id == user.id)

    elif user.role == "shelter":
        shelter = db.query(Shelter).filter(
            Shelter.created_by == user.id
        ).first()

        if not shelter:
            raise HTTPException(status_code=404, detail="Prieglauda nerasta")

        query = query.join(Animal).filter(
            Animal.shelter_id == shelter.id
        )

    elif user.role != "admin":
        raise HTTPException(status_code=403, detail="Neturite teisės matyti globos prašymų")

    if status:
        query = query.filter(AnimalFoster.status == status)

    if animal_id:
        query = query.filter(AnimalFoster.animal_id == animal_id)

    if user_id and user.role == "admin":
        query = query.filter(AnimalFoster.user_id == user_id)

    return query.order_by(AnimalFoster.created_at.desc()).all()


# READ ONE
@app.get("/animal/foster/{foster_id}", response_model=AnimalFosterResponse)
def get_animal_foster(
    foster_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    foster = db.query(AnimalFoster).filter(
        AnimalFoster.id == foster_id
    ).first()

    if not foster:
        raise HTTPException(status_code=404, detail="Globos prašymas nerastas")

    if user.role == "volunteer" and foster.user_id != user.id:
        raise HTTPException(status_code=403, detail="Neturite teisės matyti šio prašymo")

    if user.role == "shelter":
        shelter = db.query(Shelter).filter(
            Shelter.created_by == user.id
        ).first()

        if not shelter or foster.animal.shelter_id != shelter.id:
            raise HTTPException(status_code=403, detail="Neturite teisės matyti šio prašymo")

    return foster


# UPDATE
@app.patch("/animal/foster/{foster_id}", response_model=AnimalFosterResponse)
def update_animal_foster(
    foster_id: int,
    data: AnimalFosterUpdate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    foster = db.query(AnimalFoster).filter(
        AnimalFoster.id == foster_id
    ).first()

    if not foster:
        raise HTTPException(status_code=404, detail="Globos prašymas nerastas")

    update_data = data.model_dump(exclude_unset=True)

    if user.role == "volunteer":
        if foster.user_id != user.id:
            raise HTTPException(status_code=403, detail="Neturite teisės keisti šio prašymo")

        if foster.status != "pending":
            raise HTTPException(
                status_code=400,
                detail="Galima keisti tik laukiantį prašymą"
            )

        allowed_fields = {"start_date", "end_date", "phone", "note"}
        update_data = {
            key: value
            for key, value in update_data.items()
            if key in allowed_fields
        }

    elif user.role == "shelter":
        shelter = db.query(Shelter).filter(
            Shelter.created_by == user.id
        ).first()

        if not shelter or foster.animal.shelter_id != shelter.id:
            raise HTTPException(status_code=403, detail="Neturite teisės keisti šio prašymo")

        allowed_statuses = {
            "approved",
            "rejected",
            "active",
            "completed",
            "cancelled"
        }

        if "status" in update_data:
            if update_data["status"] not in allowed_statuses:
                raise HTTPException(status_code=400, detail="Neleistinas globos statusas")

            if update_data["status"] == "approved":
                update_data["approved_by"] = user.id
                update_data["approved_at"] = datetime.now(timezone.utc)

            if update_data["status"] == "active":
                foster.animal.status = "foster"

            if update_data["status"] in {"completed", "cancelled", "rejected"}:
                foster.animal.status = "available"

    elif user.role != "admin":
        raise HTTPException(status_code=403, detail="Neturite teisės keisti šio prašymo")

    for field, value in update_data.items():
        setattr(foster, field, value)

    db.commit()
    db.refresh(foster)

    return foster


# DELETE
@app.delete("/animal/foster/{foster_id}")
def delete_animal_foster(
    foster_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    foster = db.query(AnimalFoster).filter(
        AnimalFoster.id == foster_id
    ).first()

    if not foster:
        raise HTTPException(status_code=404, detail="Globos prašymas nerastas")

    if user.role == "volunteer":
        if foster.user_id != user.id:
            raise HTTPException(status_code=403, detail="Neturite teisės trinti šio prašymo")

        if foster.status != "pending":
            raise HTTPException(
                status_code=400,
                detail="Galima trinti tik laukiantį prašymą"
            )

    elif user.role == "shelter":
        shelter = db.query(Shelter).filter(
            Shelter.created_by == user.id
        ).first()

        if not shelter or foster.animal.shelter_id != shelter.id:
            raise HTTPException(status_code=403, detail="Neturite teisės trinti šio prašymo")

    elif user.role != "admin":
        raise HTTPException(status_code=403, detail="Neturite teisės trinti šio prašymo")

    db.delete(foster)
    db.commit()

    return {"message": "Globos prašymas sėkmingai ištrintas"}




# -------------------------------------------------
# -------------------VISIT-------------------------
# -------------------------------------------------

@app.post("/visit", response_model=VisitResponse)
def register_visit(
    data: VisitCreateRequest,
    background_tasks: BackgroundTasks,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Savanorio registracija vizitui į prieglaudą.

    Prieiga:
    - Tik prisijungęs vartotojas
    - Tik volunteer rolė

    Elgsena:
    - Patikrina ar prieglauda egzistuoja
    - Patikrina ar laiko intervalas teisingas
    - Patikrina ar vartotojas neturi persidengiančio vizito
    - Sukuria naują visit įrašą
    """

    if user.role != "volunteer":
        raise HTTPException(
            status_code=403,
            detail="Tik volunteer vartotojas gali registruotis vizitui"
        )

    shelter = db.query(Shelter).filter(Shelter.id == data.shelter_id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    if not shelter.is_active:
        raise HTTPException(
            status_code=400,
            detail="Registracija negalima, nes prieglauda neaktyvi"
        )

    end_at = data.start_at + timedelta(hours=data.duration_hours)

    # Tikrinam ar tas pats vartotojas neturi persidengiancio aktyvaus vizito
    overlapping_visit = db.query(Visit).filter(
        Visit.user_id == user.id,
        Visit.status.in_(["pending", "scheduled"]),
        and_(
            Visit.start_at < end_at,
            Visit.end_at > data.start_at
        )
    ).first()

    if overlapping_visit:
        raise HTTPException(
            status_code=400,
            detail="Jūs jau turite kitą vizitą, kuris persidengia su pasirinktu laiku"
        )

    visit = Visit(
        shelter_id=data.shelter_id,
        user_id=user.id,
        start_at=data.start_at,
        end_at=end_at,
        is_under_16=data.is_under_16,
        is_group=data.is_group,
        group_size=data.group_size,
        social_hrs=0,
        note=data.note
    )

    db.add(visit)
    db.commit()
    db.refresh(visit)

    if shelter.email:
        subject, body = build_pending_visit_email(
            shelter_name=shelter.name,
            volunteer_name=f"{user.name} {user.surname}",
            volunteer_email=user.email,
            start_at=visit.start_at,
            end_at=visit.end_at,
            note=visit.note
        )

        background_tasks.add_task(
            send_email,
            shelter.email,
            subject,
            body
        )

    return visit


@app.patch("/visit/{visit_id}", response_model=VisitResponse)
def update_my_visit(
    visit_id: int,
    data: VisitUpdateRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Leisti savanoriui redaguoti savo vizitą tik tada,
    kai vizito statusas yra pending.
    """

    if user.role != "volunteer":
        raise HTTPException(
            status_code=403,
            detail="Tik volunteer vartotojas gali redaguoti savo vizitą"
        )

    visit = db.query(Visit).filter(
        Visit.id == visit_id,
        Visit.user_id == user.id
    ).first()

    if not visit:
        raise HTTPException(status_code=404, detail="Vizitas nerastas")

    if visit.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Redaguoti galima tik pending būsenos vizitą"
        )

    update_data = data.model_dump(exclude_unset=True)

    new_start_at = update_data.get("start_at", visit.start_at)

    if "duration_hours" in update_data:
        new_end_at = new_start_at + timedelta(hours=update_data["duration_hours"])
        update_data["end_at"] = new_end_at
        del update_data["duration_hours"]
    else:
        new_end_at = visit.end_at

    overlapping_visit = db.query(Visit).filter(
        Visit.id != visit.id,
        Visit.user_id == user.id,
        Visit.status.in_(["pending", "scheduled"]),
        and_(
            Visit.start_at < new_end_at,
            Visit.end_at > new_start_at
        )
    ).first()

    if overlapping_visit:
        raise HTTPException(
            status_code=400,
            detail="Jūs jau turite kitą vizitą, kuris persidengia su pasirinktu laiku"
        )

    if "is_group" in update_data and update_data["is_group"] is False:
        update_data["group_size"] = None

    for field, value in update_data.items():
        setattr(visit, field, value)

    db.commit()
    db.refresh(visit)

    return visit


@app.patch("/visit/{visit_id}/cancel", response_model=VisitResponse)
def cancel_my_visit(
    visit_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Leisti savanoriui atšaukti savo vizitą,
    jeigu statusas yra pending arba scheduled.
    """

    if user.role != "volunteer":
        raise HTTPException(
            status_code=403,
            detail="Tik volunteer vartotojas gali atšaukti savo vizitą"
        )

    visit = db.query(Visit).filter(
        Visit.id == visit_id,
        Visit.user_id == user.id
    ).first()

    if not visit:
        raise HTTPException(status_code=404, detail="Vizitas nerastas")

    if visit.status not in ["pending", "scheduled"]:
        raise HTTPException(
            status_code=400,
            detail="Atšaukti galima tik pending arba scheduled būsenos vizitą"
        )

    visit.status = "cancelled"

    db.commit()
    db.refresh(visit)

    return visit


@app.get("/visit/me/social-hours")
def get_my_social_hours(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Grąžina prisijungusio savanorio socialinių valandų sumą
    tik iš completed statuso vizitų.
    """

    if user.role != "volunteer":
        raise HTTPException(
            status_code=403,
            detail="Tik volunteer vartotojas gali matyti savo socialines valandas"
        )

    visits = db.query(Visit).filter(
        Visit.user_id == user.id,
        Visit.status == "completed"
    ).all()

    total_social_hours = sum(float(visit.social_hrs) for visit in visits)

    return {
        "user_id": user.id,
        "completed_visits_count": len(visits),
        "total_social_hours": total_social_hours
    }


@app.get("/visit/me", response_model=list[VisitMeResponse])
def get_my_visits(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gauti prisijungusio savanorio registracijas į prieglaudas.
    """

    visits = db.query(Visit).filter(
        Visit.user_id == user.id
    ).order_by(Visit.start_at.desc()).all()

    result = []

    for visit in visits:
        shelter = db.query(Shelter).filter(Shelter.id == visit.shelter_id).first()

        result.append({
            "id": visit.id,
            "shelter_id": visit.shelter_id,
            "user_id": visit.user_id,
            "start_at": visit.start_at,
            "end_at": visit.end_at,
            "status": visit.status,
            "is_under_16": visit.is_under_16,
            "social_hrs": float(visit.social_hrs),
            "note": visit.note,
            "shelter": {
                "id": shelter.id,
                "name": shelter.name,
                "city": shelter.city,
                "address": shelter.address
            } if shelter else None
        })

    return result


@app.get("/visit/shelter", response_model=list[ShelterVisitResponse])
def get_shelter_visits(
    status: Optional[str] = None,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    query = db.query(Visit).filter(Visit.shelter_id == shelter.id)

    if status:
        query = query.filter(Visit.status == status)

    visits = query.order_by(Visit.start_at.asc()).all()

    result = []

    for visit in visits:
        volunteer = db.query(AppUser).filter(AppUser.id == visit.user_id).first()

        result.append({
            "id": visit.id,
            "shelter_id": visit.shelter_id,
            "user_id": visit.user_id,
            "start_at": visit.start_at,
            "end_at": visit.end_at,
            "status": visit.status,
            "is_under_16": visit.is_under_16,
            "social_hrs": float(visit.social_hrs),
            "note": visit.note,
            "volunteer": {
                "id": volunteer.id,
                "name": volunteer.name,
                "surname": volunteer.surname,
                "username": volunteer.username,
                "email": volunteer.email
            } if volunteer else None
        })

    return result


@app.patch("/visit/{visit_id}/status", response_model=VisitResponse)
def update_visit_status(
    visit_id: int,
    data: VisitStatusUpdateRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "shelter":
        raise HTTPException(
            status_code=403,
            detail="Tik shelter vartotojas gali keisti vizito statusą"
        )

    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    visit = db.query(Visit).filter(
        Visit.id == visit_id,
        Visit.shelter_id == shelter.id
    ).first()

    if not visit:
        raise HTTPException(
            status_code=404,
            detail="Vizitas nerastas arba nepriklauso jūsų prieglaudai"
        )

    visit.status = data.status

    db.commit()
    db.refresh(visit)

    return visit

# -------------------------------------------------
# -------------------NEWS--------------------------
# -------------------------------------------------

# CREATE
@app.post("/news", response_model=NewsResponse)
def create_news(
    data: NewsCreate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shelter_id = data.shelter_id

    if user.role == "admin":
        if shelter_id is not None:
            shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()
            if not shelter:
                raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    elif user.role == "shelter":
        my_shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

        if not my_shelter:
            raise HTTPException(status_code=404, detail="Jūsų prieglauda nerasta")

        if shelter_id is None:
            shelter_id = my_shelter.id
        elif shelter_id != my_shelter.id:
            raise HTTPException(
                status_code=403,
                detail="Galite kurti naujienas tik savo prieglaudai"
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="Neturite teisės kurti naujienų"
        )

    news = News(
        shelter_id=shelter_id,
        user_id=user.id,
        title=data.title,
        web_url=data.web_url,
        image_url=data.image_url,
        is_published=data.is_published
    )

    db.add(news)
    db.commit()
    db.refresh(news)

    return news

# READ
@app.get("/news", response_model=list[NewsResponse])
def get_news(
    shelter_id: Optional[int] = None,
    is_published: Optional[bool] = True,
    sort_by: Optional[str] = "created_at",
    sort_order: Optional[str] = "desc",
    page: int = 1,
    page_size: int = 10,
    user: Optional[AppUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Gauti naujienų sąrašą.

    Filtravimas:
    - shelter_id: konkrečios prieglaudos naujienos
    - is_published: rodyti tik publikuotas (default: TRUE)

    Rikiavimas:
    - sort_by: created_at, title
    - sort_order: asc | desc

    Puslapiavimas:
    - page: puslapio numeris
    - page_size: įrašų kiekis puslapyje

    Grąžina:
    - Naujienų sąrašą

    Klaidos:
    - Nėra (grąžinamas tuščias sąrašas jei nieko nerasta)

    Pavyzdys:
    - /news
    - /news?shelter_id=1
    - /news?page=2&page_size=5
    """

    query = db.query(News)

    # 🔹 Filtras pagal prieglaudą
    if shelter_id is not None:
        query = query.filter(News.shelter_id == shelter_id)

    # 🔹 Publish logika
    if user and user.role in ["admin", "shelter"]:
        # admin ir savo prieglauda gali matyti ir nepublikuotas
        if user.role == "shelter":
            my_shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

            if my_shelter:
                query = query.filter(
                    (News.is_published == True) |
                    (News.shelter_id == my_shelter.id)
                )
            else:
                query = query.filter(News.is_published == True)
        else:
            # admin mato viską
            if is_published is not None:
                query = query.filter(News.is_published == is_published)
    else:
        # neprisijungęs arba paprastas vartotojas
        query = query.filter(News.is_published == True)

    # 🔹 Sorting
    sort_fields = {
        "created_at": News.created_at,
        "title": News.title
    }

    sort_column = sort_fields.get(sort_by, News.created_at)

    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # 🔹 Pagination
    offset = (page - 1) * page_size
    news_list = query.offset(offset).limit(page_size).all()

    return news_list


@app.get("/news/{news_id}", response_model=NewsResponse)
def get_news_by_id(
    news_id: int,
    user: Optional[AppUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Gauti vieną naujieną pagal ID.

    Parametrai:
    - news_id: naujienos ID

    Grąžina:
    - Vieną naujienos objektą

    Klaidos:
    - 404 jei naujiena nerasta
    - 403 jei bandoma pasiekti nepublikuotą naujieną

    Pavyzdys:
    - /news/1
    """

    news = db.query(News).filter(News.id == news_id).first()

    if not news:
        raise HTTPException(status_code=404, detail="Naujiena nerasta")

    # 🔹 Publish access kontrolė
    if not news.is_published:
        if not user:
            raise HTTPException(status_code=403, detail="Naujiena nepublikuota")

        if user.role == "admin":
            return news

        if user.role == "shelter":
            my_shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

            if not my_shelter or news.shelter_id != my_shelter.id:
                raise HTTPException(status_code=403, detail="Neturite prieigos prie šios naujienos")

        else:
            raise HTTPException(status_code=403, detail="Naujiena nepublikuota")

    return news


# UPDATE
@app.patch("/news/{news_id}", response_model=NewsResponse)
def update_news(
    news_id: int,
    data: NewsUpdate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atnaujinti naujieną pagal ID.

    Parametrai:
    - news_id: naujienos ID
    - data: atnaujinami naujienos duomenys
    - user: prisijungęs vartotojas

    Grąžina:
    - Atnaujintą naujienos objektą

    Klaidos:
    - 404 jei naujiena nerasta
    - 403 jei vartotojas neturi teisės redaguoti šios naujienos
    - 404 jei nurodyta nauja prieglauda nerasta
    - 403 jei prieglaudos vartotojas bando priskirti naujieną kitai prieglaudai
    """

    news = db.query(News).filter(News.id == news_id).first()

    if not news:
        raise HTTPException(status_code=404, detail="Naujiena nerasta")

    # ADMIN gali redaguoti viską
    if user.role == "admin":

        if data.shelter_id is not None:
            shelter = (
                db.query(Shelter)
                .filter(Shelter.id == data.shelter_id)
                .first()
            )

            if not shelter:
                raise HTTPException(
                    status_code=404,
                    detail="Prieglauda nerasta"
                )

    # SHELTER gali redaguoti tik savo prieglaudos naujienas
    elif user.role == "shelter":

        my_shelter = (
            db.query(Shelter)
            .filter(Shelter.created_by == user.id)
            .first()
        )

        if not my_shelter:
            raise HTTPException(
                status_code=404,
                detail="Jūsų prieglauda nerasta"
            )

        if news.shelter_id != my_shelter.id:
            raise HTTPException(
                status_code=403,
                detail="Galite redaguoti tik savo prieglaudos naujienas"
            )

        # shelter vartotojas negali perkelti naujienos kitai prieglaudai
        if (
            data.shelter_id is not None
            and data.shelter_id != my_shelter.id
        ):
            raise HTTPException(
                status_code=403,
                detail="Negalite priskirti naujienos kitai prieglaudai"
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="Neturite teisės redaguoti naujienų"
        )

    # Tik pateikti laukai
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(news, field, value)

    db.commit()
    db.refresh(news)

    return news

# DELETE
@app.delete("/news/{news_id}")
def delete_news(
    news_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ištrinti naujieną pagal ID.

    Parametrai:
    - news_id: naujienos ID
    - user: prisijungęs vartotojas

    Grąžina:
    - Sėkmės žinutę apie ištrintą naujieną

    Klaidos:
    - 404 jei naujiena nerasta
    - 403 jei vartotojas neturi teisės ištrinti šios naujienos

    Pavyzdys:
    - DELETE /news/1
    """
    news = db.query(News).filter(News.id == news_id).first()

    if not news:
        raise HTTPException(status_code=404, detail="Naujiena nerasta")

    # ADMIN gali trinti bet kurią naujieną
    if user.role == "admin":
        pass

    # SHELTER gali trinti tik savo prieglaudos naujienas
    elif user.role == "shelter":
        my_shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

        if not my_shelter:
            raise HTTPException(status_code=404, detail="Jūsų prieglauda nerasta")

        if news.shelter_id != my_shelter.id:
            raise HTTPException(
                status_code=403,
                detail="Galite ištrinti tik savo prieglaudos naujienas"
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="Neturite teisės trinti naujienų"
        )

    db.delete(news)
    db.commit()

    return {"message": "Naujiena sėkmingai ištrinta"}


# -------------------------------------------------
# -------------------EVENTS------------------------
# -------------------------------------------------

# CREATE
@app.post("/event", response_model=EventResponse)
def create_event(
    data: EventCreate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sukurti naują renginį.

    Parametrai:
    - data: renginio duomenys
    - user: prisijungęs vartotojas

    Grąžina:
    - Sukurtą renginio įrašą

    Klaidos:
    - 404 jei nurodyta prieglauda nerasta
    - 400 jei `ends_at` yra ankstesnė už `starts_at`

    Pavyzdys:
    - POST /event
    """

    if data.ends_at is not None and data.ends_at < data.starts_at:
        raise HTTPException(
            status_code=400,
            detail="Renginio pabaiga negali būti ankstesnė už pradžią"
        )

    if data.shelter_id is not None:
        shelter = db.query(Shelter).filter(Shelter.id == data.shelter_id).first()

        if not shelter:
            raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    event = Event(
        shelter_id=data.shelter_id,
        user_id=user.id,
        title=data.title,
        summary=data.summary,
        description=data.description,
        location=data.location,
        city=data.city,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        image_url=data.image_url,
        is_published=data.is_published
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event

# READ
@app.get("/event", response_model=list[EventResponse])
def get_events(
    shelter_id: Optional[int] = None,
    city: Optional[str] = None,
    is_published: Optional[bool] = True,

    starts_from: Optional[datetime] = None,
    starts_to: Optional[datetime] = None,

    sort_by: Optional[str] = "starts_at",
    sort_order: Optional[str] = "asc",

    page: int = 1,
    page_size: int = 10,

    user: Optional[AppUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Gauti renginių sąrašą su filtrais.

    Filtravimas:
    - shelter_id: pagal prieglaudą
    - city: pagal miestą
    - is_published: tik publikuoti (default TRUE)
    - starts_from / starts_to: pagal datą

    Rikiavimas:
    - starts_at, created_at

    Puslapiavimas:
    - page, page_size

    Pavyzdys:
    - /event
    - /event?city=Kaunas
    """

    query = db.query(Event)

    # Filtrai
    if shelter_id is not None:
        query = query.filter(Event.shelter_id == shelter_id)

    if city is not None:
        query = query.filter(Event.city.ilike(f"%{city}%"))

    if is_published is not None:
        query = query.filter(Event.is_published == is_published)

    if starts_from is not None:
        query = query.filter(Event.starts_at >= starts_from)

    if starts_to is not None:
        query = query.filter(Event.starts_at <= starts_to)

    # Sorting
    sort_column = getattr(Event, sort_by, Event.starts_at)

    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    # Puslapiavimas
    offset = (page - 1) * page_size
    events = query.offset(offset).limit(page_size).all()

    return events


@app.get("/event/{event_id}", response_model=EventResponse)
def get_event_by_id(
    event_id: int,
    db: Session = Depends(get_db)
):
    """
    Gauti konkretų renginį pagal ID.

    Parametrai:
    - event_id: renginio ID

    Klaidos:
    - 404 jei nerastas
    """

    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Renginys nerastas")

    return event


# UPDATE
@app.patch("/event/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    data: EventUpdate,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atnaujinti renginį pagal ID.

    Parametrai:
    - event_id: renginio ID
    - data: atnaujinami renginio duomenys
    - user: prisijungęs vartotojas

    Grąžina:
    - Atnaujintą renginio įrašą

    Klaidos:
    - 404 jei renginys nerastas
    - 403 jei vartotojas neturi teisės redaguoti šio renginio
    - 404 jei nurodyta nauja prieglauda nerasta
    - 400 jei `ends_at` yra ankstesnė už `starts_at`

    Pavyzdys:
    - PATCH /event/1
    """

    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Renginys nerastas")

    user_shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    is_admin = user.role == "admin"
    is_owner = event.user_id == user.id
    is_same_shelter = (
        user_shelter is not None and
        event.shelter_id is not None and
        event.shelter_id == user_shelter.id
    )

    if not is_admin and not is_owner and not is_same_shelter:
        raise HTTPException(
            status_code=403,
            detail="Neturite teisės redaguoti šio renginio"
        )

    update_data = data.model_dump(exclude_unset=True)

    # Jei keičiam shelter_id, patikrinam ar tokia prieglauda egzistuoja
    if "shelter_id" in update_data and update_data["shelter_id"] is not None:
        shelter = db.query(Shelter).filter(Shelter.id == update_data["shelter_id"]).first()

        if not shelter:
            raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    # Tikrinam datas
    new_starts_at = update_data.get("starts_at", event.starts_at)
    new_ends_at = update_data.get("ends_at", event.ends_at)

    if new_ends_at is not None and new_ends_at < new_starts_at:
        raise HTTPException(
            status_code=400,
            detail="Renginio pabaiga negali būti ankstesnė už pradžią"
        )

    for field, value in update_data.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    return event


# DELETE
@app.delete("/event/{event_id}")
def delete_event(
    event_id: int,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ištrinti renginį pagal ID.

    Parametrai:
    - event_id: renginio ID
    - user: prisijungęs vartotojas

    Grąžina:
    - Sėkmės žinutę

    Klaidos:
    - 404 jei renginys nerastas
    - 403 jei vartotojas neturi teisės trinti šio renginio

    Pavyzdys:
    - DELETE /event/1
    """

    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Renginys nerastas")

    user_shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    is_admin = user.role == "admin"
    is_owner = event.user_id == user.id
    is_same_shelter = (
        user_shelter is not None and
        event.shelter_id is not None and
        event.shelter_id == user_shelter.id
    )

    if not is_admin and not is_owner and not is_same_shelter:
        raise HTTPException(
            status_code=403,
            detail="Neturite teisės ištrinti šio renginio"
        )

    db.delete(event)
    db.commit()

    return {"message": "Renginys sėkmingai ištrintas"}


# -------------------------------------------------
# -------------------ADMIN-------------------------
# -------------------------------------------------

def ensure_admin(user: AppUser):
    """
    Patikrina ar prisijungęs vartotojas turi administratoriaus rolę.

    Klaidos:
    - 403 jei vartotojas nėra administratorius
    """
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Tik administratorius gali atlikti šį veiksmą"
        )


@app.get("/admin/users", response_model=list[UserResponse])
def admin_get_users(

    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    admin: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gauti visų sistemos vartotojų sąrašą administratoriui.

    Parametrai:
    - role: (nebūtinas) filtruoti vartotojus pagal rolę: admin, shelter, volunteer
    - is_active: (nebūtinas) filtruoti pagal paskyros aktyvumą
    - search: (nebūtinas) ieškoti pagal vardą, pavardę, vartotojo vardą arba el. paštą
    - admin: prisijungęs administratorius

    Grąžina:
    - Vartotojų sąrašą

    Klaidos:
    - 403 jei vartotojas nėra administratorius
    - 400 jei nurodyta neteisinga rolė

    Pavyzdys:
    - GET /admin/users
    - GET /admin/users?role=volunteer
    - GET /admin/users?search=jonas
    """
    ensure_admin(admin)

    query = db.query(AppUser)

    if role is not None:
        if role not in ["admin", "shelter", "volunteer"]:
            raise HTTPException(
                status_code=400,
                detail="Neteisinga vartotojo rolė"
            )
        query = query.filter(AppUser.role == role)

    if is_active is not None:
        query = query.filter(AppUser.is_active == is_active)

    if search:
        query = query.filter(
            or_(
                AppUser.name.ilike(f"%{search}%"),
                AppUser.surname.ilike(f"%{search}%"),
                AppUser.username.ilike(f"%{search}%"),
                AppUser.email.ilike(f"%{search}%")
            )
        )

    return query.order_by(AppUser.created_at.desc()).all()


@app.patch("/admin/users/{user_id}/role", response_model=UserResponse)
def admin_change_user_role(
    user_id: int,
    data: AdminUserRoleUpdateRequest,
    admin: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pakeisti pasirinkto vartotojo rolę.

    Parametrai:
    - user_id: vartotojo ID, kurio rolė keičiama
    - data: nauja vartotojo rolė
    - admin: prisijungęs administratorius

    Grąžina:
    - Atnaujintą vartotojo objektą

    Klaidos:
    - 403 jei vartotojas nėra administratorius
    - 404 jei vartotojas nerastas
    - 400 jei administratorius bando pakeisti savo rolę
    - 400 jei bandoma pašalinti paskutinio administratoriaus rolę
    - 400 jei vartotojui suteikiama shelter rolė, bet jis neturi prieglaudos
    - 400 jei vartotojo prieglauda dar nėra patvirtinta

    Pavyzdys:
    - PATCH /admin/users/5/role
    """
    ensure_admin(admin)

    user = db.query(AppUser).filter(AppUser.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Vartotojas nerastas")

    new_role = data.role.value

    if user.id == admin.id and new_role != "admin":
        raise HTTPException(
            status_code=400,
            detail="Negalite pakeisti savo administratoriaus rolės"
        )

    if user.role == "admin" and new_role != "admin":
        admin_count = db.query(AppUser).filter(AppUser.role == "admin").count()

        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Negalima pašalinti paskutinio administratoriaus rolės"
            )

    if new_role == "shelter":
        shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

        if not shelter:
            raise HTTPException(
                status_code=400,
                detail="Vartotojas neturi užregistruotos prieglaudos"
            )

        if not shelter.is_verified:
            raise HTTPException(
                status_code=400,
                detail="Vartotojo prieglauda dar nėra patvirtinta"
            )

    user.role = new_role

    db.commit()
    db.refresh(user)

    return user


@app.patch("/admin/users/{user_id}/active", response_model=UserResponse)
def admin_update_user_active_status(
    user_id: int,
    data: AdminUserActiveUpdateRequest,
    admin: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deaktyvuoti pasirinkto vartotojo paskyrą.
    is_active = true -> is_active = false

    Parametrai:
    - user_id: vartotojo ID
    - admin: prisijungęs administratorius

    Grąžina:
    - Sėkmės pranešimą

    Klaidos:
    - 403 jei vartotojas nėra administratorius
    - 404 jei vartotojas nerastas
    - 400 jei administratorius bando deaktyvuoti savo paskyrą
    - 400 jei bandoma deaktyvuoti paskutinį administratorių

    Pavyzdys:
    - PATCH /admin/users/5
    """
    ensure_admin(admin)

    user = db.query(AppUser).filter(AppUser.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="Vartotojas nerastas")

    if user.id == admin.id and data.is_active is False:
        raise HTTPException(
            status_code=400,
            detail="Negalite deaktyvuoti savo paskyros"
        )

    if user.role == "admin" and data.is_active is False:
        active_admin_count = db.query(AppUser).filter(
            AppUser.role == "admin",
            AppUser.is_active == True
        ).count()

        if active_admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Negalima deaktyvuoti paskutinio aktyvaus administratoriaus"
            )

    user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    return user


@app.get("/admin/shelters/pending", response_model=list[ShelterResponse])
def admin_get_pending_shelters(
    admin: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gauti administratoriaus patvirtinimo laukiančių prieglaudų sąrašą.

    Parametrai:
    - admin: prisijungęs administratorius

    Grąžina:
    - Nepatvirtintų prieglaudų sąrašą

    Klaidos:
    - 403 jei vartotojas nėra administratorius

    Pavyzdys:
    - GET /admin/shelters/pending
    """
    ensure_admin(admin)

    shelters = db.query(Shelter).filter(
        Shelter.is_verified == False
    ).order_by(Shelter.created_at.desc()).all()

    return shelters


@app.patch("/admin/shelters/{shelter_id}/verification", response_model=ShelterResponse)
def admin_verify_or_reject_shelter(
    shelter_id: int,
    data: AdminShelterVerificationRequest,
    admin: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Patvirtinti arba atmesti prieglaudos registraciją. 

    Parametrai:
    - shelter_id: prieglaudos ID, kuri patvirtinama arba atmetama
    - data: patvirtinimo duomenys (`is_verified`)
    - admin: prisijungęs administratorius

    Grąžina:
    - Atnaujintą prieglaudos objektą

    Klaidos:
    - 403 jei vartotojas nėra administratorius
    - 404 jei prieglauda nerasta

    Pavyzdys:
    - PATCH /admin/shelters/3/verification

    Body:
    {
        "is_verified": true
    }
    """
    ensure_admin(admin)

    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    owner = db.query(AppUser).filter(AppUser.id == shelter.created_by).first()

    if data.is_verified:
        shelter.is_verified = True

        if owner:
            owner.role = "shelter"
            owner.is_active = True

    else:
        shelter.is_verified = False

        if owner and owner.role == "shelter":
            owner.role = "volunteer"

    db.commit()
    db.refresh(shelter)

    return shelter