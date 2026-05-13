document.addEventListener("DOMContentLoaded", () => {
    const raw = localStorage.getItem("selectedFosterAnimal");

    if (!raw) {
        setMessage("Gyvūnas nepasirinktas", "error");
        return;
    }

    let animal;

    try {
        animal = JSON.parse(raw);
    } catch (e) {
        console.error("Invalid JSON in localStorage", e);
        setMessage("Nepavyko nuskaityti gyvūno duomenų", "error");
        return;
    }

    renderAnimal(animal);

    const form = document.getElementById("fosterForm");

    if (form) {
        form.addEventListener("submit", (event) => {
            submitFosterForm(event, animal);
        });
    }
});

function getEl(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const el = getEl(id);
    if (el) el.textContent = value || "-";
}

function setMessage(text, type = "") {
    const el = getEl("fosterFormMessage");
    if (!el) return;

    el.textContent = text || "";
    el.className = type;
}

function renderAnimal(animal) {
    const img = getEl("selectedAnimalImage");

    if (img) {
        img.src = animal.primary_image_url || animal.image || "/assets/img/animal_image_unavalible.jpg";
    }

    setText("selectedAnimalName", animal.name || "Be vardo");
    setText("selectedAnimalShelter", animal.shelter || animal.shelter_name);
    setText("selectedAnimalSpecies", animal.species);
    setText("selectedAnimalBreed", animal.breed);
    setText("selectedAnimalGender", animal.sex || animal.gender);
    setText("selectedAnimalStatus", animal.status);
    setText("selectedAnimalColor", animal.color);
    setText("selectedAnimalBirthDate", animal.birth_date || animal.birthDate);
    setText("selectedAnimalCode", animal.code);
}

async function submitFosterForm(event, animal) {
    event.preventDefault();

    const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("token");

    if (!token) {
        setMessage("Norint pateikti paraišką, reikia prisijungti", "error");
        return;
    }

    const payload = {
        animal_id: Number(animal.id),
        name: getEl("fosterName").value.trim(),
        surname: getEl("fosterSurname").value.trim(),
        phone: getEl("fosterPhone").value.trim() || null,
        email: getEl("fosterEmail").value.trim(),
        start_date: getEl("fosterStartDate").value,
        end_date: getEl("fosterEndDate").value || null,
        note: getEl("fosterNote").value.trim() || null
    };

    const submitBtn = getEl("fosterSubmitBtn");

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Siunčiama...";
    }

    try {
        const response = await fetch("/api/animal/foster", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            setMessage(result.detail || "Nepavyko pateikti paraiškos", "error");
            return;
        }

        setMessage("Paraiška sėkmingai pateikta", "success");
        getEl("fosterForm").reset();

    } catch (error) {
        console.error("Klaida siunčiant paraišką:", error);
        setMessage("Įvyko klaida siunčiant paraišką", "error");

    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Pateikti paraišką";
        }
    }
}