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
let animalSearchQuery = "";
let animalSearchTimeout = null;

const {
  getEl,
  fetchJson,
  loadCurrentUser: loadCurrentUserCommon,
  getAnimalImage,
  translateSpecies,
  translateGender,
  translateStatus,
  formatAnimalAge,
  formatAnimalAgeDetailed,
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

  const localFavorites =
    JSON.parse(localStorage.getItem("favoriteAnimals")) || [];

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
      ...items.filter((animal) => {
        return (
          animal.is_favorite === true ||
          localFavorites.includes(Number(animal.id))
        );
      })
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

  if (animalSearchQuery) {
  const query = animalSearchQuery.toLowerCase();

  result = result.filter((animal) => {
    const name = String(animal.name || "").toLowerCase();
    const breed = String(animal.breed || "").toLowerCase();

    return name.includes(query) || breed.includes(query);
  });
}

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
    const age = formatAnimalAge(animal.birth_date);

    const card = document.createElement("div");
    card.className = "card-animal";

    card.innerHTML = `
      <h3 class="animal-title">
        <span class="animal-title-main">
          <span class="favorite-btn active" data-id="${animal.id}" title="Pašalinti iš mėgstamų">
            ❤️
          </span>
          <span>${animal.name || "Be vardo"}</span>
          ${age ? `<span class="animal-age">${age}</span>` : ""}
        </span>
      </h3>

      <img src="${getAnimalImage(animal)}" alt="Gyvūnas" />

      <p><strong>Prieglauda:</strong> ${shelterName}</p>
      <p><strong>Lytis:</strong> ${translateGender(animal.sex)}</p>
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
  localStorage.setItem("selectedFosterAnimal", JSON.stringify(animal));

  const shelterName =
    allShelters.find((shelter) => Number(shelter.id) === Number(animal.shelter_id))?.name || "-";

  getEl("animalModalImage").src = getAnimalImage(animal);
  getEl("animalModalName").textContent = animal.name || "Be vardo";
  const modalAge = getEl("animalModalAge");
  if (modalAge) {
    const age = formatAnimalAge(animal.birth_date);
    modalAge.textContent = age || "";
    modalAge.hidden = !age;
  }
  getEl("animalModalShelter").textContent = shelterName;
  getEl("animalModalSpecies").textContent = translateSpecies(animal.species);
  getEl("animalModalBreed").textContent = animal.breed || "-";
  getEl("animalModalGender").textContent = translateGender(animal.sex);
  getEl("animalModalStatus").textContent = translateStatus(animal.status);
  getEl("animalModalColor").textContent = animal.color || "-";
  getEl("animalModalBirthDate").textContent =
    formatAnimalAgeDetailed(animal.birth_date) || "-";
  getEl("animalModalDescription").textContent = animal.description || "-";

  const modalFavoriteBtn = getEl("animalModalFavorite");

  if (modalFavoriteBtn) {
    modalFavoriteBtn.dataset.id = animal.id;
    modalFavoriteBtn.className = "favorite-btn animal-modal-favorite active";
    modalFavoriteBtn.textContent = "❤️";
    modalFavoriteBtn.onclick = async (event) => {
      event.stopPropagation();
      await removeAnimalFavorite(animal.id);
      closeAnimalModal();
    };
  }

  const fosterBtn = getEl("fosterLinkBtn");

  if (fosterBtn) {
    const canUseFoster =
      currentUser &&
      currentUser.role === "volunteer";

    fosterBtn.style.display = canUseFoster
      ? "inline-flex"
      : "none";

    fosterBtn.onclick = (event) => {
      event.preventDefault();

      if (!canUseFoster) {
        return;
      }

      window.location.href = "/pages/laikina-globa-forma.html";
    };
  }

  openModal("animalModalBackdrop");
}

function closeAnimalModal() {
  closeModal("animalModalBackdrop");
}

async function removeAnimalFavorite(animalId) {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  // 1. Pašalinam iš localStorage
  let localFavorites =
    JSON.parse(localStorage.getItem("favoriteAnimals")) || [];

  localFavorites = localFavorites.filter(
    (id) => Number(id) !== Number(animalId)
  );

  localStorage.setItem(
    "favoriteAnimals",
    JSON.stringify(localFavorites)
  );

  // 2. Jei yra token -> bandome šalinti backend
  if (token) {
    try {
      await fetch(`/api/animal/favorite/${animalId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error(error);
    }
  }

  // 3. Pašalinam iš masyvų
  favoriteAnimals = favoriteAnimals.filter(
    (animal) => Number(animal.id) !== Number(animalId)
  );

  filteredFavoriteAnimals = filteredFavoriteAnimals.filter(
    (animal) => Number(animal.id) !== Number(animalId)
  );

  // 4. Renderinam iš naujo
  const totalPages = Math.max(
    1,
    Math.ceil(filteredFavoriteAnimals.length / animalsPerPage)
  );

  if (currentAnimalPage > totalPages) {
    currentAnimalPage = totalPages;
  }

  renderAnimals();
}

function bindPageEvents() {
  const shelterFilter = getEl("animalShelterFilter");
  const speciesFilter = getEl("animalSpeciesFilter");
  const genderFilter = getEl("animalGenderFilter");
  const statusFilter = getEl("animalStatusFilter");
  const sortOrderFilter = getEl("animalSortOrder");
  const searchInput = getEl("animalSearchInput");
  const modalCloseBtn = getEl("animalModalCloseBtn");
  const modalBackdrop = getEl("animalModalBackdrop");

  [shelterFilter, speciesFilter, genderFilter, statusFilter, sortOrderFilter].forEach((filter) => {
    filter?.addEventListener("change", () => {
      currentAnimalPage = 1;
      applyFiltersAndRender();
    });
  });

  searchInput?.addEventListener("input", () => {
    clearTimeout(animalSearchTimeout);

    animalSearchTimeout = setTimeout(() => {
      animalSearchQuery = searchInput.value.trim();
      currentAnimalPage = 1;
      applyFiltersAndRender();
    }, 250);
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
