// -------------------------------------
// Pagrindinio puslapio katalogu logika
// -------------------------------------

// Prieglaudu ir gyvunu duomenys
let shelters = [];
let allShelters = [];
let animals = [];
let totalAnimalCount = 0;
let currentUser = null;

// Prieglaudu karuseles busena
let shelterStartIndex = 0;
const visibleShelterCount = 4;


// Gyvunu katalogo busena
let currentAnimalPage = 1;
const animalsPerPage = 8;

// Default logotipai prieglaudoms
const shelterLogos = [
  "/assets/img/logo1.png",
  "/assets/img/logo2.png",
  "/assets/img/logo3.png",
  "/assets/img/logo4.jpg",
  "/assets/img/logo5.jpg"
];

// Uzklausos pagalbininke
/*async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Klaida gaunant duomenis: ${response.status}`);
  }

  return response.json();
}*/

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

  // Jei tokenas blogas, bandom dar karta be jo
  if (response.status === 401 && token) {
    response = await makeRequest(false);
  }

  if (!response.ok) {
    throw new Error(`Klaida gaunant duomenis: ${response.status}`);
  }

  return response.json();
}



// Grazina default prieglaudos logotipa pagal jos id
function getShelterLogo(shelter) {
  const safeId = Number(shelter.id || 0);
  return shelterLogos[safeId % shelterLogos.length];
}

// Grazina default gyvuno nuotrauka pagal rusį
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

  const safeId = Number(animal.id || 0);

  if (animal.species === "cat") {
    return catImages[safeId % catImages.length];
  }

  if (animal.species === "dog") {
    return dogImages[safeId % dogImages.length];
  }

  return "/assets/img/prieglauda.png";
}

// Uzkrauna visas verified prieglaudas
async function loadShelters() {
  const fetchedShelters = await fetchJson("/api/shelter");

  allShelters = fetchedShelters;
  shelters = fetchedShelters.filter((shelter) => shelter.is_verified);

  renderShelterCarousel();
  fillAnimalShelterFilter();
}

// Uzkrauna visus gyvunus
//async function loadAnimals() {
//  animals = await fetchJson("/api/animal?sort_order=desc");
//  renderAnimals();
//}

async function loadAnimals(page = 1) {
  const shelterValue = document.getElementById("animalShelterFilter")?.value || "";
  const speciesValue = document.getElementById("animalSpeciesFilter")?.value || "";
  const genderValue = document.getElementById("animalGenderFilter")?.value || "";
  const statusValue = document.getElementById("animalStatusFilter")?.value || "";
  const sortOrder = document.getElementById("animalSortOrder")?.value || "desc";

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(animalsPerPage),
    sort_by: "created_at",
    sort_order: sortOrder
  });

  if (shelterValue) params.append("shelter_id", shelterValue);
  if (speciesValue) params.append("species", speciesValue);
  if (genderValue) params.append("sex", genderValue); // 🔥 FIX
  if (statusValue) params.append("status", statusValue);

  const data = await fetchJson(`/api/animal?${params.toString()}`);

  animals = data.items;              // 🔥 FIX
  totalAnimalCount = data.total;     // 🔥 FIX
  currentAnimalPage = page;

  renderAnimals();
}

// Sugeneruoja 4 matomas prieglaudu korteles
function renderShelterCarousel() {
  const container = document.getElementById("shelterCardsContainer");

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

// Uzpildo prieglaudos filtro pasirinkimus gyvunu kataloge
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

// Grazina perfiltruota gyvunu sarasa
function getFilteredAnimals() {
  const shelterValue = document.getElementById("animalShelterFilter")?.value || "";
  const speciesValue = document.getElementById("animalSpeciesFilter")?.value || "";
  const genderValue = document.getElementById("animalGenderFilter")?.value || "";
  const statusValue = document.getElementById("animalStatusFilter")?.value || "";
  const sortOrder = document.getElementById("animalSortOrder")?.value || "desc";

  let filteredAnimals = [...animals];

  if (shelterValue) {
    filteredAnimals = filteredAnimals.filter(
      (animal) => String(animal.shelter_id) === String(shelterValue)
    );
  }

  if (speciesValue) {
    filteredAnimals = filteredAnimals.filter(
      (animal) => String(animal.species) === String(speciesValue)
    );
  }

  if (genderValue) {
    filteredAnimals = filteredAnimals.filter(
      (animal) => String(animal.gender) === String(genderValue)
    );
  }

  if (statusValue) {
    filteredAnimals = filteredAnimals.filter(
      (animal) => String(animal.status) === String(statusValue)
    );
  }

  filteredAnimals.sort((a, b) => {
    const aId = Number(a.id || 0);
    const bId = Number(b.id || 0);

    return sortOrder === "asc" ? aId - bId : bId - aId;
  });

  return filteredAnimals;
}

// Sugeneruoja puslapiavimo mygtukus
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
        loadAnimals(page);
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

  // Į pradžią
  container.appendChild(
    createButton("««", 1, currentAnimalPage === 1)
  );

  // Atgal per vieną
  container.appendChild(
    createButton("«", currentAnimalPage - 1, currentAnimalPage === 1)
  );

  // Pirmas puslapis, jei nepatenka į langą
  if (startPage > 1) {
    container.appendChild(
      createButton("1", 1, false, currentAnimalPage === 1)
    );
  }

  // Daugtaškis po pradžios
  if (startPage > 2) {
    container.appendChild(createDots());
  }

  // Matomi puslapiai aplink aktyvų
  for (let page = startPage; page <= endPage; page += 1) {
    container.appendChild(
      createButton(String(page), page, false, page === currentAnimalPage)
    );
  }

  // Daugtaškis prieš galą
  if (endPage < totalPages - 1) {
    container.appendChild(createDots());
  }

  // Paskutinis puslapis, jei nepatenka į langą
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

  // Pirmyn per vieną
  container.appendChild(
    createButton("»", currentAnimalPage + 1, currentAnimalPage === totalPages)
  );

  // Į galą
  container.appendChild(
    createButton("»»", totalPages, currentAnimalPage === totalPages)
  );
}


function renderAnimals() {
  const container = document.getElementById("animalCardsContainer");

  if (!container) return;

  container.innerHTML = "";

  if (!animals || !animals.length) {
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
              <span class="favorite-btn ${animal.is_favorite ? "active" : ""}" data-id="${animal.id}">
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

// Isvercia gyvuno rusį i lietuviu kalba
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

// Isvercia gyvuno statusa i suprantama forma
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

// Prijungia ivykius prie karuseles ir filtro
function bindMainPageEvents() {
  const prevBtn = document.getElementById("shelterPrevBtn");
  const nextBtn = document.getElementById("shelterNextBtn");
  const shelterFilter = document.getElementById("animalShelterFilter");
  const speciesFilter = document.getElementById("animalSpeciesFilter");
  const genderFilter = document.getElementById("animalGenderFilter");
  const statusFilter = document.getElementById("animalStatusFilter");
  const sortOrderFilter = document.getElementById("animalSortOrder");
  const modalCloseBtn = document.getElementById("animalModalCloseBtn");
  const modalBackdrop = document.getElementById("animalModalBackdrop");

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

  /*[shelterFilter, speciesFilter, genderFilter, statusFilter, sortOrderFilter].forEach((filter) => {
    filter?.addEventListener("change", () => {
      currentAnimalPage = 1;
      renderAnimals();
    });
  });*/

  [shelterFilter, speciesFilter, genderFilter, statusFilter, sortOrderFilter].forEach((filter) => {
    filter?.addEventListener("change", () => {
      loadAnimals(1); // 🔥 vietoj renderAnimals
    });
  });

  modalCloseBtn?.addEventListener("click", closeAnimalModal);

  modalBackdrop?.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) {
      closeAnimalModal();
    }
  });
}

// Inicializuoja pagrindinio puslapio katalogus
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

// Atidaro pasirinkto gyvuno popup langa
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

// Uzdaro gyvuno popup langa
function closeAnimalModal() {
  document.getElementById("animalModalBackdrop").hidden = true;
  document.body.style.overflow = "";
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

document.addEventListener("DOMContentLoaded", initMainPage);