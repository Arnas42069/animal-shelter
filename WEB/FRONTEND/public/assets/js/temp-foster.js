document.addEventListener("DOMContentLoaded", () => {

    const raw = localStorage.getItem("selectedFosterAnimal");

    console.log("RAW STORAGE:", raw);

    if (!raw) {
        console.warn("No animal found in localStorage");
        return;
    }

    let animal;

    try {
        animal = JSON.parse(raw);
    } catch (e) {
        console.error("Invalid JSON in localStorage", e);
        return;
    }

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value ?? "-";
    };

    const setImg = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.src = value ?? "";
    };

    setImg("selectedAnimalImage",animal.image);
    set("selectedAnimalName", animal.name);
    set("selectedAnimalShelter", animal.shelter);
    set("selectedAnimalSpecies", animal.species);
    set("selectedAnimalBreed", animal.breed);
    set("selectedAnimalGender", animal.gender);
    set("selectedAnimalStatus", animal.status);
    set("selectedAnimalColor", animal.color);
    set("selectedAnimalBirthDate", animal.birthDate || animal.birth_date);
    set("selectedAnimalCode", animal.code);
});