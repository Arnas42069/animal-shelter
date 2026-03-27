from typing import Optional
from datetime import date
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import uuid

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_, asc, desc

from src.database import get_db
from src.models import (
    AppUser, 
    Shelter,
    Animal,
    AnimalImage,
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

    AnimalCreateRequest,
    AnimalResponse,
    AnimalUpdateRequest,
)
from src.auth import (
    hash_password, 
    verify_password, 
    create_token, 
    get_current_user,
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
        "message": "Shelter registered successfully",
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

# --------------------------------------------
# -------------ANIMAL IMAGE HELPERS-----------
# --------------------------------------------

def attach_primary_image_url(animal: Animal, db: Session):
    """
    Prideda gyvunui pagrindines nuotraukos url,
    kad frontend galetu ja gauti tiesiai is response.
    """
    image = db.query(AnimalImage).filter(
        AnimalImage.animal_id == animal.id,
        AnimalImage.is_primary == True
    ).order_by(AnimalImage.created_at.desc()).first()

    animal.primary_image_url = image.url if image else None
    return animal


def attach_primary_image_urls(animals: list[Animal], db: Session):
    """
    Prideda pagrindines nuotraukos url visam gyvunu sarasui.
    """
    for animal in animals:
        attach_primary_image_url(animal, db)

    return animals

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

    attach_primary_image_url(animal, db)

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
@app.get("/animal", response_model=list[AnimalResponse])
def get_animals(
    shelter_id: Optional[int] = None,
    status: Optional[str] = None,
    species: Optional[str] = None,
    breed: Optional[str] = None,
    sex: Optional[str] = None,
    birth_date_from: Optional[date] = None,
    birth_date_to: Optional[date] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "asc",
    page: int = 1,
    page_size: int = 12,
    db: Session = Depends(get_db)
):
    """
    Gauti gyvūnų sąrašą su pasirinktiniais filtrais.

    Filtravimas:
    - shelter_id: grąžina tik konkrečios prieglaudos gyvūnus
    - status: pvz. available, adopted ir pan.
    - species: pvz. dog, cat
    - breed: gyvūno veislė
    - sex: male, female, unknown
    - birth_date_from: gyvūnai gimę nuo šios datos
    - birth_date_to: gyvūnai gimę iki šios datos

    Rikiavimas:
    - sort_by=name
    - sort_by=breed
    - sort_by=birth_date
    - sort_order=asc arba desc

    Puslapiavimas:
    - page
    - page_size
    """

    # Apsauga nuo netinkamų puslapiavimo reikšmių
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

    # Filtravimas pagal veisle
    if breed:
        query = query.filter(Animal.breed == breed)

    # Filtravimas pagal lyti
    if sex:
        query = query.filter(Animal.sex == sex)

    if birth_date_from:
        query = query.filter(Animal.birth_date >= birth_date_from)

    if birth_date_to:
        query = query.filter(Animal.birth_date <= birth_date_to)

    # Rikiavimo logika
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
        # Jei nieko nenurodyta, rodom naujausius pirmiau
        query = query.order_by(Animal.created_at.desc())

    # Puslapiavimo skaičiavimas
    offset = (page - 1) * page_size

    animals = query.offset(offset).limit(page_size).all()

    # Pridedam pagrindines nuotraukos url kiekvienam gyvunui
    attach_primary_image_urls(animals, db)

    return animals


# READ MANO PRIEGLAUDOS GYVUNUS
@app.get("/animal/me", response_model=list[AnimalResponse])
def get_my_animals(
    # Filtras pagal rusį
    species: Optional[str] = None,

    # Filtras pagal veislę
    breed: Optional[str] = None,

    # Filtras pagal lytį
    sex: Optional[str] = None,

    # Filtras pagal statusą
    status: Optional[str] = None,

    # Rikiavimo laukas
    # Galimos reikšmės: name, breed, birth_date
    sort_by: Optional[str] = None,

    # Rikiavimo kryptis
    # Galimos reikšmės: asc, desc
    sort_order: Optional[str] = "desc",

    # Puslapiavimas
    page: int = 1,
    page_size: int = 6,

    # Prisijungęs vartotojas
    user: AppUser = Depends(get_current_user),

    # Duomenų bazės sesija
    db: Session = Depends(get_db)
):
    """
    Gauti prisijungusios prieglaudos gyvūnų sąrašą.

    Filtravimas:
    - species
    - breed
    - sex
    - status

    Rikiavimas:
    - sort_by=name
    - sort_by=breed
    - sort_by=birth_date
    - sort_order=asc arba desc

    Puslapiavimas:
    - page
    - page_size
    """

    # Apsauga nuo netinkamų page reikšmių
    if page < 1:
        page = 1

    # Apsauga nuo per didelio page_size
    if page_size < 1:
        page_size = 6

    if page_size > 50:
        page_size = 50

    # Randam prisijungusio vartotojo prieglaudą
    shelter = db.query(Shelter).filter(Shelter.created_by == user.id).first()

    if not shelter:
        raise HTTPException(status_code=404, detail="Prieglauda nerasta")

    # Imame tik tos prieglaudos gyvūnus
    query = db.query(Animal).filter(Animal.shelter_id == shelter.id)

    # Filtras pagal statusą
    if status:
        query = query.filter(Animal.status == status)

    # Filtras pagal rūšį
    if species:
        query = query.filter(Animal.species == species)

    # Filtras pagal veislę
    if breed:
        query = query.filter(Animal.breed == breed)

    # Filtras pagal lytį
    if sex:
        query = query.filter(Animal.sex == sex)

    # Nustatom rikiavimo kryptį
    order_fn = desc if sort_order == "desc" else asc

    # Rikiuojam pagal pasirinktą lauką
    if sort_by == "name":
        query = query.order_by(order_fn(Animal.name))
    elif sort_by == "breed":
        query = query.order_by(order_fn(Animal.breed))
    elif sort_by == "birth_date":
        query = query.order_by(order_fn(Animal.birth_date))
    else:
        # Jei nieko nenurodyta, rodom naujausius pirmiau
        query = query.order_by(desc(Animal.created_at))

    # Puslapiavimo skaičiavimas
    offset = (page - 1) * page_size

    # Grąžinam tik vieno puslapio gyvūnus
    animals = query.offset(offset).limit(page_size).all()

    # Pridedam pagrindines nuotraukos url kiekvienam gyvunui
    attach_primary_image_urls(animals, db)

    return animals

@app.get("/animal/by-code/{code}", response_model=AnimalResponse)
def get_animal_by_code(
    code: str,
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
    attach_primary_image_url(animal, db)

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

    # Pridedam pagrindines nuotraukos url
    attach_primary_image_url(animal, db)

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
