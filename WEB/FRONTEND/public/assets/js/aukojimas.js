// -------------------------------------
// Paramos puslapio logika
// -------------------------------------

// Prieglaudu duomenys
let supportShelters = [];
let filteredSupportShelters = [];

function showSupportNotification(text, type = "error") {
  if (window.AppCommon?.showNotification) {
    window.AppCommon.showNotification(text, type);
  }
}

// Default logotipai
const supportShelterLogos = [
  "/assets/img/logo1.png",
  "/assets/img/logo2.png",
  "/assets/img/logo3.png",
  "/assets/img/logo4.jpg",
  "/assets/img/logo5.jpg"
];

// Uzklausos pagalbininke
async function fetchSupportJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Klaida gaunant duomenis: ${response.status}`);
  }

  return response.json();
}

// Default logo pagal id
function getSupportShelterLogo(shelter) {
  const safeId = Number(shelter.id || 0);
  return supportShelterLogos[safeId % supportShelterLogos.length];
}

// Paprastas maisymas
function shuffleArray(list) {
  const cloned = [...list];

  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }

  return cloned;
}

// Atidaro popup
function openSupportShelterModal(shelter) {
  const modal = document.getElementById("supportShelterModal");
  const title = document.getElementById("supportShelterModalTitle");
  const profileLink = document.getElementById("supportShelterProfileLink");
  const donateLink = document.getElementById("supportShelterDonateLink");

  if (!modal || !title || !profileLink || !donateLink) {
    return;
  }

  title.textContent = shelter.name || "Pasirinkite veiksmą";
  profileLink.href = `/pages/prieglauda.html?id=${shelter.id}`;
  donateLink.href = "https://kggn.lt/parama/";

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

// Uzdaro popup
function closeSupportShelterModal() {
  const modal = document.getElementById("supportShelterModal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

// Atvaizduoja prieglaudas
function renderSupportShelters() {
  const grid = document.getElementById("supportSheltersGrid");
  const msg = document.getElementById("supportSheltersMessage");

  if (!grid || !msg) {
    return;
  }

  grid.innerHTML = "";
  msg.textContent = "";

  if (!filteredSupportShelters.length) {
    msg.textContent = "Pagal įvestą pavadinimą prieglaudų nerasta.";
    return;
  }

  filteredSupportShelters.forEach((shelter) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "support-shelter-card";

    card.innerHTML = `
      <img
        src="${getSupportShelterLogo(shelter)}"
        alt="Prieglaudos logotipas"
        class="support-shelter-image"
      />
      <h3>${shelter.name || "Prieglauda"}</h3>
      <div class="support-shelter-meta">
        <div><strong>Miestas:</strong> ${shelter.city || "-"}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      openSupportShelterModal(shelter);
    });

    grid.appendChild(card);
  });
}

// Filtravimas pagal pavadinima
function filterSupportShelters() {
  const searchValue =
    document.getElementById("shelterSupportSearch")?.value.trim().toLowerCase() || "";

  filteredSupportShelters = supportShelters.filter((shelter) =>
    (shelter.name || "").toLowerCase().includes(searchValue)
  );

  renderSupportShelters();
}

// Uzkrauna prieglaudas
async function loadSupportShelters() {
  const msg = document.getElementById("supportSheltersMessage");

  try {
    const shelters = await fetchSupportJson("/api/shelter");

    supportShelters = shuffleArray(shelters);
    filteredSupportShelters = [...supportShelters];

    renderSupportShelters();
  } catch (error) {
    console.error(error);

    if (msg) msg.textContent = "";

    showSupportNotification("Nepavyko užkrauti prieglaudų sąrašo.", "error");
  }
}

// Pagrindine logika
function initDonationPage() {
  const searchInput = document.getElementById("shelterSupportSearch");
  const modalClose = document.getElementById("supportShelterModalClose");
  const modalBackdrop = document.getElementById("supportShelterModalBackdrop");

  if (!searchInput) {
    return;
  }

  searchInput.addEventListener("input", filterSupportShelters);

  if (modalClose) {
    modalClose.addEventListener("click", closeSupportShelterModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeSupportShelterModal);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSupportShelterModal();
    }
  });

  loadSupportShelters();
}

document.addEventListener("DOMContentLoaded", initDonationPage);
