// -------------------------------------
// Mėgstamų gyvūnų puslapio logika
// -------------------------------------

let shelters = [];
let allShelters = [];
let favoriteAnimals = [];
let filteredFavoriteAnimals = [];
let currentUser = null;

let currentAnimalPage = 1;
const animalsPerPage = 8;

// Default logotipai prieglaudoms / gyvūnų nuotraukoms
const shelterLogos = [
  "/assets/img/logo1.png",
  "/assets/img/logo2.png",
  "/assets/img/logo3.png",
  "/assets/img/logo4.jpg",
  "/assets/img/logo5.jpg"
];

async function fetchJson(url, options = {}) {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  const makeRequest = async (withAuth) => {
    const headers = {
      ...(options.headers || {})
    };

    if (withAuth && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers
    });
  };

  let response = await makeRequest(true);

  // Jei token blogas, bandom dar kartą be jo
  if (response.status === 401 && token) {
    response = await makeRequest(false);
  }

  if (!response.ok) {
    throw new Error(`Klaida gaunant duomenis: ${response.status}`);
  }

  return response.json();
}

function getShelterLogo(shelter) {
  const safeId = Number(shelter?.id || 0);
  return shelterLogos[safeId % shelterLogos.length];
}

function getAnimalImage(animal) {
  const dogImages = [
    "/assets/img/dog2.jpg",
    "/assets/img/dog3.jpg",
    "/assets/img/dog4.jpg",
    "/assets/img/dog5.jpg"
  ];

  const catImages = [
    "/assets/img/cat2.jpg",
    "/assets/img/cat3.png",
    "/assets/img/cat4.jpg",
    "/assets/img/cat5.jpg"
  ];

  const safeId = Number(animal?.id || 0);

  if (animal?.species === "cat") {
    return catImages[safeId % catImages.length];
  }

  if (animal?.species === "dog") {
    return dogImages[safeId % dogImages.length];
  }

  return "/assets/img/prieglauda.png";
}

function translateSpecies(species) {
  if (species === "dog") return "Šuo";
  if (species === "cat") return "Katė";
  return "Kita";
}

function translateGender(sex) {
  if (sex === "male") return "Patinas";
  if (sex === "female") return "Patelė";
  return "-";
}

function translateStatus(status) {
  const map = {
    available: "Available",
    reserved: "Reserved",
    adopted: "Adopted",
    foster: "Foster",
    medical_hold: "Medical hold",
    lost: "Lost"
  };

  return map[status] || status || "-";
}

async function loadCurrentUser() {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  if (!token) {
    currentUser = null;
    return;
  }

  try {
    currentUser = await fetchJson("/api/auth/me");
  } catch (error) {
    currentUser = null;
  }
}

async function loadShelters() {
  const fetchedShelters = await fetchJson("/api/shelter");

  allShelters = fetchedShelters;
  shelters = fetchedShelters.filter((shelter) => shelter.is_verified);

  fillAnimalShelterFilter();
}

function fillAnimalShelterFilter() {
  const select = document.getElementById("animalShelterFilter");

  if (!select) {
    return;
  }

  select.innerHTML = `<option value="">Visos prieglaudos</option>`;

  allShelters.forEach((shelter) => {
    const option = document.createElement("option");
    option.value = shelter.id;
    option.textContent = shelter.name;
    select.appendChild(option);
  });
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
  const shelterValue = document.getElementById("animalShelterFilter")?.value || "";
  const speciesValue = document.getElementById("animalSpeciesFilter")?.value || "";
  const genderValue = document.getElementById("animalGenderFilter")?.value || "";
  const statusValue = document.getElementById("animalStatusFilter")?.value || "";
  const sortOrder = document.getElementById("animalSortOrder")?.value || "desc";

  let result = [...favoriteAnimals];

  if (shelterValue) {
    result = result.filter(
      (animal) => String(animal.shelter_id) === String(shelterValue)
    );
  }

  if (speciesValue) {
    result = result.filter(
      (animal) => String(animal.species) === String(speciesValue)
    );
  }

  if (genderValue) {
    result = result.filter(
      (animal) => String(animal.sex) === String(genderValue)
    );
  }

  if (statusValue) {
    result = result.filter(
      (animal) => String(animal.status) === String(statusValue)
    );
  }

  result.sort((a, b) => {
    const aId = Number(a.id || 0);
    const bId = Number(b.id || 0);
    return sortOrder === "asc" ? aId - bId : bId - aId;
  });

  return result;
}

function renderAnimalsPagination(totalPages) {
  const container = document.getElementById("animalsPagination");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (totalPages <= 1) {
    return;
  }

  const createButton = (text, page, disabled = false, isActive = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
    btn.disabled = disabled;

    if (isActive) {
      btn.classList.add("active");
    }

    if (!disabled && page !== null) {
      btn.addEventListener("click", () => {
        currentAnimalPage = page;
        renderAnimals();
      });
    }

    return btn;
  };

  const createDots = () => {
    const span = document.createElement("span");
    span.className = "pagination-dots";
    span.textContent = "...";
    return span;
  };

  const startPage = Math.max(1, currentAnimalPage - 3);
  const endPage = Math.min(totalPages, currentAnimalPage + 3);

  container.appendChild(
    createButton("««", 1, currentAnimalPage === 1)
  );

  container.appendChild(
    createButton("«", currentAnimalPage - 1, currentAnimalPage === 1)
  );

  if (startPage > 1) {
    container.appendChild(
      createButton("1", 1, false, currentAnimalPage === 1)
    );
  }

  if (startPage > 2) {
    container.appendChild(createDots());
  }

  for (let page = startPage; page <= endPage; page += 1) {
    container.appendChild(
      createButton(String(page), page, false, page === currentAnimalPage)
    );
  }

  if (endPage < totalPages - 1) {
    container.appendChild(createDots());
  }

  if (endPage < totalPages) {
    container.appendChild(
      createButton(
        String(totalPages),
        totalPages,
        false,
        currentAnimalPage === totalPages
      )
    );
  }

  container.appendChild(
    createButton("»", currentAnimalPage + 1, currentAnimalPage === totalPages)
  );

  container.appendChild(
    createButton("»»", totalPages, currentAnimalPage === totalPages)
  );
}

function renderAnimals() {
  const container = document.getElementById("animalCardsContainer");

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

  document.getElementById("animalModalImage").src = getAnimalImage(animal);
  document.getElementById("animalModalName").textContent = animal.name || "Be vardo";
  document.getElementById("animalModalShelter").textContent = shelterName;
  document.getElementById("animalModalSpecies").textContent = translateSpecies(animal.species);
  document.getElementById("animalModalBreed").textContent = animal.breed || "-";
  document.getElementById("animalModalGender").textContent = translateGender(animal.sex);
  document.getElementById("animalModalStatus").textContent = translateStatus(animal.status);
  document.getElementById("animalModalColor").textContent = animal.color || "-";
  document.getElementById("animalModalBirthDate").textContent = animal.birth_date || "-";
  document.getElementById("animalModalCode").textContent = animal.code || "-";
  document.getElementById("animalModalDescription").textContent = animal.description || "-";

  document.getElementById("animalModalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAnimalModal() {
  const backdrop = document.getElementById("animalModalBackdrop");

  if (backdrop) {
    backdrop.hidden = true;
  }

  document.body.style.overflow = "";
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
  const shelterFilter = document.getElementById("animalShelterFilter");
  const speciesFilter = document.getElementById("animalSpeciesFilter");
  const genderFilter = document.getElementById("animalGenderFilter");
  const statusFilter = document.getElementById("animalStatusFilter");
  const sortOrderFilter = document.getElementById("animalSortOrder");
  const modalCloseBtn = document.getElementById("animalModalCloseBtn");
  const modalBackdrop = document.getElementById("animalModalBackdrop");

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

    const container = document.getElementById("animalCardsContainer");
    if (container) {
      container.innerHTML = "<p>Nepavyko užkrauti mėgstamų gyvūnų.</p>";
    }
  }
}

document.addEventListener("DOMContentLoaded", initFavoriteAnimalsPage);