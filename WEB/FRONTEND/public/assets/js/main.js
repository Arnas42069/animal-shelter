// -------------------------------------
// Pagrindinio puslapio katalogų logika
// Naudoja bendras funkcijas iš common.js
// -------------------------------------

let shelters = [];
let allShelters = [];
let animals = [];
let totalAnimalCount = 0;
let currentUser = null;

// Prieglaudų karuselės būsena
let shelterStartIndex = 0;
const visibleShelterCount = 4;

// Gyvūnų katalogo būsena
let currentAnimalPage = 1;
const animalsPerPage = 8;

const {
  getEl,
  fetchJson,
  loadCurrentUser: loadCurrentUserCommon,
  getShelterLogo,
  getAnimalImage,
  translateSpecies,
  translateGender,
  translateStatus,
  fillShelterFilter,
  readAnimalFilters,
  renderPagination,
  openModal,
  closeModal
} = window.AppCommon;

// Užkrauna visas verified prieglaudas
async function loadShelters() {
  const fetchedShelters = await fetchJson("/api/shelter");

  allShelters = fetchedShelters;
  shelters = fetchedShelters.filter((shelter) => shelter.is_verified);

  renderShelterCarousel();
  fillAnimalShelterFilter();
}

// Užkrauna gyvūnus iš backend su filtrais ir puslapiavimu
async function loadAnimals(page = 1) {
  const filters = readAnimalFilters({
    shelterId: "animalShelterFilter",
    speciesId: "animalSpeciesFilter",
    genderId: "animalGenderFilter",
    statusId: "animalStatusFilter",
    sortOrderId: "animalSortOrder"
  });

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(animalsPerPage),
    sort_by: "created_at",
    sort_order: filters.sort_order || "desc"
  });

  if (filters.shelter_id) params.append("shelter_id", filters.shelter_id);
  if (filters.species) params.append("species", filters.species);
  if (filters.sex) params.append("sex", filters.sex);
  if (filters.status) params.append("status", filters.status);

  const data = await fetchJson(`/api/animal?${params.toString()}`);

  animals = Array.isArray(data?.items) ? data.items : [];
  totalAnimalCount = Number(data?.total || 0);
  currentAnimalPage = page;

  renderAnimals();
}

// Sugeneruoja matomas prieglaudų korteles
function renderShelterCarousel() {
  const container = getEl("shelterCardsContainer");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!shelters.length) {
    container.innerHTML = "<p>Prieglaudų nerasta.</p>";
    return;
  }

  const cardsToShow = Math.min(visibleShelterCount, shelters.length);

  for (let i = 0; i < cardsToShow; i += 1) {
    const shelterIndex = (shelterStartIndex + i) % shelters.length;
    const shelter = shelters[shelterIndex];

    const link = document.createElement("a");
    link.className = "card-shelter";
    link.href = `/pages/prieglauda.html?id=${shelter.id}`;

    link.innerHTML = `
      <h3>${shelter.name}</h3>
      <img src="${getShelterLogo(shelter)}" alt="Prieglaudos logotipas" />
    `;

    container.appendChild(link);
  }
}

// Užpildo prieglaudos filtro pasirinkimus
function fillAnimalShelterFilter() {
  const select = getEl("animalShelterFilter");
  fillShelterFilter(select, allShelters, "Visos prieglaudos");
}

// Sugeneruoja puslapiavimo mygtukus
function renderAnimalsPagination(totalPages) {
  const container = getEl("animalsPagination");

  renderPagination(container, {
    currentPage: currentAnimalPage,
    totalPages,
    onPageChange: (page) => {
      loadAnimals(page);
    }
  });
}

// Atvaizduoja gyvūnų korteles
function renderAnimals() {
  const container = getEl("animalCardsContainer");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!animals.length) {
    container.innerHTML = "<p>Gyvūnų nerasta.</p>";
    renderAnimalsPagination(0);
    return;
  }

  const canShowFavorite = currentUser?.role === "volunteer";

  animals.forEach((animal) => {
    const shelterName =
      allShelters.find((shelter) => Number(shelter.id) === Number(animal.shelter_id))?.name || "-";

    const card = document.createElement("div");
    card.className = "card-animal";

    card.innerHTML = `
      <h3 class="animal-title">
        ${
          canShowFavorite
            ? `
              <span class="favorite-btn ${animal.is_favorite ? "active" : ""}" data-id="${animal.id}" title="Mėgstamas">
                ${animal.is_favorite ? "❤️" : "🤍"}
              </span>
            `
            : ""
        }
        ${animal.name || "Be vardo"}
      </h3>

      <img src="${getAnimalImage(animal)}" alt="Gyvūnas" />

      <p><strong>Rūšis:</strong> ${translateSpecies(animal.species)}</p>
      <p><strong>Veislė:</strong> ${animal.breed || "-"}</p>
      <p><strong>Prieglauda:</strong> ${shelterName}</p>
      <p><strong>Statusas:</strong> ${translateStatus(animal.status)}</p>
    `;

    card.addEventListener("click", () => {
      openAnimalModal(animal);
    });

    const favoriteBtn = card.querySelector(".favorite-btn");

    if (favoriteBtn) {
      favoriteBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await toggleAnimalFavorite(animal.id, animal.is_favorite);
      });
    }

    container.appendChild(card);
  });

  const totalPages = Math.ceil(totalAnimalCount / animalsPerPage);
  renderAnimalsPagination(totalPages);
}

// Atidaro pasirinkto gyvūno popup langą
function openAnimalModal(animal) {
  const shelterName =
    allShelters.find((shelter) => Number(shelter.id) === Number(animal.shelter_id))?.name || "-";

  getEl("animalModalImage").src = getAnimalImage(animal);
  getEl("animalModalName").textContent = animal.name || "Be vardo";
  getEl("animalModalShelter").textContent = shelterName;
  getEl("animalModalSpecies").textContent = translateSpecies(animal.species);
  getEl("animalModalBreed").textContent = animal.breed || "-";
  getEl("animalModalGender").textContent = translateGender(animal.sex);
  getEl("animalModalStatus").textContent = translateStatus(animal.status);
  getEl("animalModalColor").textContent = animal.color || "-";
  getEl("animalModalBirthDate").textContent = animal.birth_date || "-";
  getEl("animalModalCode").textContent = animal.code || "-";
  getEl("animalModalDescription").textContent = animal.description || "-";

  openModal("animalModalBackdrop");
}

// Uždaro gyvūno popup langą
function closeAnimalModal() {
  closeModal("animalModalBackdrop");
}

// Užkrauna prisijungusį vartotoją
async function loadCurrentUser() {
  currentUser = await loadCurrentUserCommon();
}

// Pažymi arba nuima mėgstamą gyvūną
async function toggleAnimalFavorite(animalId, isFavorite) {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  if (!token || currentUser?.role !== "volunteer") {
    return;
  }

  try {
    let response;

    if (isFavorite) {
      response = await fetch(`/api/animal/favorite/${animalId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } else {
      response = await fetch("/api/animal/favorite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          animal_id: animalId
        })
      });
    }

    if (!response.ok) {
      throw new Error(`Nepavyko pakeisti favorite būsenos: ${response.status}`);
    }

    const animal = animals.find((item) => Number(item.id) === Number(animalId));

    if (animal) {
      animal.is_favorite = !isFavorite;
    }

    renderAnimals();
  } catch (error) {
    console.error("Klaida keičiant favorite būseną:", error);
  }
}

// Prijungia įvykius
function bindMainPageEvents() {
  const prevBtn = getEl("shelterPrevBtn");
  const nextBtn = getEl("shelterNextBtn");
  const shelterFilter = getEl("animalShelterFilter");
  const speciesFilter = getEl("animalSpeciesFilter");
  const genderFilter = getEl("animalGenderFilter");
  const statusFilter = getEl("animalStatusFilter");
  const sortOrderFilter = getEl("animalSortOrder");
  const modalCloseBtn = getEl("animalModalCloseBtn");
  const modalBackdrop = getEl("animalModalBackdrop");

  prevBtn?.addEventListener("click", () => {
    if (!shelters.length) {
      return;
    }

    shelterStartIndex = (shelterStartIndex - 1 + shelters.length) % shelters.length;
    renderShelterCarousel();
  });

  nextBtn?.addEventListener("click", () => {
    if (!shelters.length) {
      return;
    }

    shelterStartIndex = (shelterStartIndex + 1) % shelters.length;
    renderShelterCarousel();
  });

  [shelterFilter, speciesFilter, genderFilter, statusFilter, sortOrderFilter].forEach((filter) => {
    filter?.addEventListener("change", () => {
      loadAnimals(1);
    });
  });

  modalCloseBtn?.addEventListener("click", closeAnimalModal);

  modalBackdrop?.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) {
      closeAnimalModal();
    }
  });
}

// Inicializuoja pagrindinį puslapį
async function initMainPage() {
  try {
    bindMainPageEvents();
    await loadCurrentUser();
    await loadShelters();
    await loadAnimals();
  } catch (error) {
    console.error("Nepavyko užkrauti pagrindinio puslapio katalogų:", error);
  }
}

document.addEventListener("DOMContentLoaded", initMainPage);