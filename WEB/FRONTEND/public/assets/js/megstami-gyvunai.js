// -------------------------------------
// Mėgstamų gyvūnų puslapio logika
// Naudoja bendras funkcijas iš common.js
// -------------------------------------

let shelters = [];
let allShelters = [];
let favoriteAnimals = [];
let filteredFavoriteAnimals = [];
let currentUser = null;

let currentAnimalPage = 1;
const animalsPerPage = 8;

const {
  getEl,
  fetchJson,
  loadCurrentUser: loadCurrentUserCommon,
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

async function loadCurrentUser() {
  currentUser = await loadCurrentUserCommon();
}

async function loadShelters() {
  const fetchedShelters = await fetchJson("/api/shelter");

  allShelters = fetchedShelters;
  shelters = fetchedShelters.filter((shelter) => shelter.is_verified);

  fillAnimalShelterFilter();
}

function fillAnimalShelterFilter() {
  const select = getEl("animalShelterFilter");
  fillShelterFilter(select, allShelters, "Visos prieglaudos");
}

// Užkrauna visus gyvūnus ir palieka tik pamėgtus
async function loadFavoriteAnimals() {
  favoriteAnimals = [];

  const pageSize = 100;
  let page = 1;
  let total = 0;

  do {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      sort_order: "desc"
    });

    const data = await fetchJson(`/api/animal?${params.toString()}`);

    const items = Array.isArray(data?.items) ? data.items : [];
    total = Number(data?.total || 0);

    favoriteAnimals.push(
      ...items.filter((animal) => animal.is_favorite === true)
    );

    page += 1;
  } while ((page - 1) * pageSize < total);

  applyFiltersAndRender();
}

function getFilteredFavoriteAnimals() {
  const filters = readAnimalFilters({
    shelterId: "animalShelterFilter",
    speciesId: "animalSpeciesFilter",
    genderId: "animalGenderFilter",
    statusId: "animalStatusFilter",
    sortOrderId: "animalSortOrder"
  });

  let result = [...favoriteAnimals];

  if (filters.shelter_id) {
    result = result.filter(
      (animal) => String(animal.shelter_id) === String(filters.shelter_id)
    );
  }

  if (filters.species) {
    result = result.filter(
      (animal) => String(animal.species) === String(filters.species)
    );
  }

  if (filters.sex) {
    result = result.filter(
      (animal) => String(animal.sex) === String(filters.sex)
    );
  }

  if (filters.status) {
    result = result.filter(
      (animal) => String(animal.status) === String(filters.status)
    );
  }

  result.sort((a, b) => {
    const aId = Number(a.id || 0);
    const bId = Number(b.id || 0);
    return filters.sort_order === "asc" ? aId - bId : bId - aId;
  });

  return result;
}

function renderAnimalsPagination(totalPages) {
  const container = getEl("animalsPagination");

  renderPagination(container, {
    currentPage: currentAnimalPage,
    totalPages,
    onPageChange: (page) => {
      currentAnimalPage = page;
      renderAnimals();
    }
  });
}

function renderAnimals() {
  const container = getEl("animalCardsContainer");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!currentUser) {
    container.innerHTML = `
      <p>Norint matyti mėgstamus gyvūnus, reikia prisijungti.</p>
    `;
    renderAnimalsPagination(0);
    return;
  }

  if (currentUser.role !== "volunteer") {
    container.innerHTML = `
      <p>Mėgstamų gyvūnų sąrašas skirtas tik savanoriams.</p>
    `;
    renderAnimalsPagination(0);
    return;
  }

  if (!filteredFavoriteAnimals.length) {
    container.innerHTML = `
      <p>Neturite pamėgtų gyvūnų.</p>
    `;
    renderAnimalsPagination(0);
    return;
  }

  const totalPages = Math.ceil(filteredFavoriteAnimals.length / animalsPerPage);

  if (currentAnimalPage > totalPages) {
    currentAnimalPage = totalPages;
  }

  const startIndex = (currentAnimalPage - 1) * animalsPerPage;
  const endIndex = startIndex + animalsPerPage;
  const pageItems = filteredFavoriteAnimals.slice(startIndex, endIndex);

  pageItems.forEach((animal) => {
    const shelterName =
      allShelters.find((shelter) => Number(shelter.id) === Number(animal.shelter_id))?.name || "-";

    const card = document.createElement("div");
    card.className = "card-animal";

    card.innerHTML = `
      <h3 class="animal-title">
        <span class="favorite-btn active" data-id="${animal.id}" title="Pašalinti iš mėgstamų">
          ❤️
        </span>
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

    favoriteBtn?.addEventListener("click", async (event) => {
      event.stopPropagation();
      await removeAnimalFavorite(animal.id);
    });

    container.appendChild(card);
  });

  renderAnimalsPagination(totalPages);
}

function applyFiltersAndRender() {
  filteredFavoriteAnimals = getFilteredFavoriteAnimals();
  renderAnimals();
}

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

function closeAnimalModal() {
  closeModal("animalModalBackdrop");
}

async function removeAnimalFavorite(animalId) {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  if (!token || currentUser?.role !== "volunteer") {
    return;
  }

  try {
    const response = await fetch(`/api/animal/favorite/${animalId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Nepavyko pašalinti favorite būsenos: ${response.status}`);
    }

    favoriteAnimals = favoriteAnimals.filter(
      (animal) => Number(animal.id) !== Number(animalId)
    );

    filteredFavoriteAnimals = filteredFavoriteAnimals.filter(
      (animal) => Number(animal.id) !== Number(animalId)
    );

    const totalPages = Math.max(
      1,
      Math.ceil(filteredFavoriteAnimals.length / animalsPerPage)
    );

    if (currentAnimalPage > totalPages) {
      currentAnimalPage = totalPages;
    }

    renderAnimals();
  } catch (error) {
    console.error("Klaida šalinant gyvūną iš mėgstamų:", error);
  }
}

function bindPageEvents() {
  const shelterFilter = getEl("animalShelterFilter");
  const speciesFilter = getEl("animalSpeciesFilter");
  const genderFilter = getEl("animalGenderFilter");
  const statusFilter = getEl("animalStatusFilter");
  const sortOrderFilter = getEl("animalSortOrder");
  const modalCloseBtn = getEl("animalModalCloseBtn");
  const modalBackdrop = getEl("animalModalBackdrop");

  [shelterFilter, speciesFilter, genderFilter, statusFilter, sortOrderFilter].forEach((filter) => {
    filter?.addEventListener("change", () => {
      currentAnimalPage = 1;
      applyFiltersAndRender();
    });
  });

  modalCloseBtn?.addEventListener("click", closeAnimalModal);

  modalBackdrop?.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) {
      closeAnimalModal();
    }
  });
}

async function initFavoriteAnimalsPage() {
  try {
    bindPageEvents();
    await loadCurrentUser();
    await loadShelters();
    await loadFavoriteAnimals();
  } catch (error) {
    console.error("Nepavyko užkrauti mėgstamų gyvūnų puslapio:", error);

    const container = getEl("animalCardsContainer");
    if (container) {
      container.innerHTML = "<p>Nepavyko užkrauti mėgstamų gyvūnų.</p>";
    }
  }
}

document.addEventListener("DOMContentLoaded", initFavoriteAnimalsPage);