from typing import Optional
from datetime import date

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from src.database import get_db
from src.models import (
    AppUser, 
    Shelter,
    Animal,
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


# READ
@app.get("/animal", response_model=list[AnimalResponse])
def get_animals(
    shelter_id: Optional[int] = None,
    status: Optional[str] = None,
    species: Optional[str] = None,
    birth_date_from: Optional[date] = None,
    birth_date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Gauti gyvūnų sąrašą su pasirinktiniais filtrais.

    Filtravimas:
    - shelter_id: grąžina tik konkrečios prieglaudos gyvūnus
    - status: pvz. available, adopted ir pan.
    - species: pvz. dog, cat
    - birth_date_from: gyvūnai gimę nuo šios datos (jaunesni)
    - birth_date_to: gyvūnai gimę iki šios datos (vyresni)

    Pavyzdžiai:
    - /animal?shelter_id=1
    - /animal?species=dog&status=available
    - /animal?birth_date_from=2022-01-01
    """
    query = db.query(Animal)

    if shelter_id:
        query = query.filter(Animal.shelter_id == shelter_id)

    if status:
        query = query.filter(Animal.status == status)

    if species:
        query = query.filter(Animal.species == species)

    if birth_date_from:
        query = query.filter(Animal.birth_date >= birth_date_from)

    if birth_date_to:
        query = query.filter(Animal.birth_date <= birth_date_to)

    return query.all()


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
