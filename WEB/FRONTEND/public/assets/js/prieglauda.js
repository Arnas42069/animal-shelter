(function () {
  // Dabartines prieglaudos duomenys
  let currentShelter = null;

  // Ar ijungtas prieglaudos redagavimo rezimas
  let isEditing = false;

  // Dabartinis gyvunu sarasas
  let animals = [];

  // Siuo metu popup atidarytas gyvunas
  let selectedAnimal = null;

  // Popup rezimas: view | edit | create
  let animalModalMode = "view";

  // Patogesnis elemento paemimas pagal id
  function getEl(id) {
    return document.getElementById(id);
  }

  // Zinutes parodymas
  function setMessage(el, text, type = "") {
    if (!el) return;

    el.textContent = text || "";
    el.className = `shelter-message ${type}`.trim();
  }

  // Bendras request su token
  async function apiRequest(url, options = {}) {
    const token = authGetToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(result?.detail || "Request failed");
      error.status = response.status;
      error.result = result;
      throw error;
    }

    return result;
  }

  // Pilnas adresas rodymui
  // Formatas Miestas, Adresas
  function buildAddress(data) {
    const parts = [data.city, data.address].filter(Boolean);
    return parts.join(", ");
  }

  // Svetaines url sutvarkymas
  function normalizeWebsiteUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
  }

  // Uzpildo shelter perziuros laukus
  function fillShelterView(data) {
    getEl("shelterNameView").textContent =
      data.name || "Prieglaudos pavadinimas";

    const fullAddress = buildAddress(data);
    getEl("shelterAddressView").textContent = fullAddress || "-";

    getEl("shelterDescriptionView").textContent =
      data.description || "Aprašymas dar neįrašytas.";

    getEl("shelterPhoneView").textContent = data.phone || "-";
    getEl("shelterEmailView").textContent = data.email || "-";

    const websiteRow = getEl("shelterWebsiteRow");
    const websiteLink = getEl("shelterWebsiteView");

    if (data.website) {
      websiteRow.hidden = false;
      websiteLink.textContent = data.website;
      websiteLink.href = normalizeWebsiteUrl(data.website);
    } else {
      websiteRow.hidden = true;
      websiteLink.textContent = "";
      websiteLink.href = "#";
    }
  }

  // Uzpildo shelter redagavimo laukus
  function fillShelterForm(data) {
    getEl("editShelterName").value = data.name || "";
    getEl("editShelterDescription").value = data.description || "";
    getEl("editShelterCity").value = data.city || "";
    getEl("editShelterContactAddress").value = data.address || "";
    getEl("editShelterPhone").value = data.phone || "";
    getEl("editShelterEmail").value = data.email || "";
    getEl("editShelterWebsite").value = data.website || "";
    getEl("editShelterPostalCode").value = data.postal_code || "";
    getEl("editShelterCountry").value = data.country || "";
  }

  // Ijungia arba isjungia shelter redagavimo rezima
  function setShelterEditMode(show) {
    isEditing = show;

    // Virsutinis blokas
    getEl("shelterHeaderView").hidden = show;
    getEl("shelterHeaderEdit").hidden = !show;

    // Aprasymas
    getEl("shelterDescriptionView").hidden = show;
    getEl("shelterDescriptionEditWrap").hidden = !show;

    // Kontaktai
    getEl("shelterContactsView").hidden = show;
    getEl("shelterContactsEdit").hidden = !show;

    const editBtn = getEl("toggleShelterEditBtn");
    const saveBtn = getEl("saveShelterBtn");

    if (editBtn) {
      editBtn.textContent = show ? "Atšaukti redagavimą" : "Redaguoti informaciją";
    }

    if (saveBtn) {
      saveBtn.hidden = !show;
    }
  }

  // Uzkrauna prisijungusios prieglaudos duomenis
  async function loadShelterProfile() {
    const msg = getEl("shelterMessage");
    setMessage(msg, "");

    try {
      currentShelter = await apiRequest("/api/shelter/me", {
        method: "GET"
      });

      fillShelterView(currentShelter);
      fillShelterForm(currentShelter);
    } catch (error) {
      console.error(error);

      if (error.status === 401 || error.status === 403) {
        authLogout();
        return;
      }

      setMessage(
        msg,
        error.message || "Nepavyko užkrauti prieglaudos duomenų",
        "error"
      );
    }
  }

  // Issaugo shelter duomenis
  async function saveShelterProfile() {
    const msg = getEl("shelterMessage");
    setMessage(msg, "");

    const payload = {
      name: getEl("editShelterName").value.trim(),
      description: getEl("editShelterDescription").value.trim(),
      city: getEl("editShelterCity").value.trim(),
      address: getEl("editShelterContactAddress").value.trim(),
      phone: getEl("editShelterPhone").value.trim(),
      email: getEl("editShelterEmail").value.trim(),
      website: getEl("editShelterWebsite").value.trim(),
      postal_code: getEl("editShelterPostalCode").value.trim(),
      country: getEl("editShelterCountry").value.trim()
    };

    if (!payload.name) {
      setMessage(msg, "Įrašykite prieglaudos pavadinimą", "error");
      return;
    }

    if (!payload.city || !payload.address) {
      setMessage(msg, "Įrašykite miestą ir adresą", "error");
      return;
    }

    try {
      currentShelter = await apiRequest("/api/shelter/me", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      fillShelterView(currentShelter);
      fillShelterForm(currentShelter);
      setShelterEditMode(false);

      setMessage(msg, "Prieglaudos informacija atnaujinta", "success");
    } catch (error) {
      console.error(error);
      setMessage(
        msg,
        error.message || "Nepavyko atnaujinti prieglaudos",
        "error"
      );
    }
  }

  // Grazina rusies pavadinima rodymui
  function mapSpeciesLabel(value) {
    if (value === "dog") return "Šuo";
    if (value === "cat") return "Katė";
    return "Kitas";
  }

  // Grazina lyties pavadinima rodymui
  function mapSexLabel(value) {
    if (value === "male") return "Patinas";
    if (value === "female") return "Patelė";
    return "Nežinoma";
  }

  // Grazina statuso pavadinima rodymui
  function mapStatusLabel(value) {
    const map = {
      available: "Available",
      reserved: "Reserved",
      adopted: "Adopted",
      foster: "Foster",
      medical_hold: "Medical hold",
      lost: "Lost"
    };

    return map[value] || value || "-";
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

    const id = Number(animal.id || 0);

    if (animal.species === "cat") {
      return catImages[id % catImages.length];
    }

    if (animal.species === "dog") {
      return dogImages[id % dogImages.length];
    }

    return "/assets/img/prieglauda.png";
  }

  // Perskaito rikiavimo select ir pavercia i backend parametrus
  function getSortParams() {
    const value = getEl("sortAnimals")?.value || "created_at_desc";

    if (value === "name_asc") return { sort_by: "name", sort_order: "asc" };
    if (value === "name_desc") return { sort_by: "name", sort_order: "desc" };
    if (value === "breed_asc") return { sort_by: "breed", sort_order: "asc" };
    if (value === "breed_desc") return { sort_by: "breed", sort_order: "desc" };
    if (value === "birth_date_asc") return { sort_by: "birth_date", sort_order: "asc" };
    if (value === "birth_date_desc") return { sort_by: "birth_date", sort_order: "desc" };

    return { sort_by: "", sort_order: "desc" };
  }

  // Surenka filtrus ir suformuoja query string
  function buildAnimalQuery() {
    const params = new URLSearchParams();

    const species = getEl("filterSpecies")?.value || "";
    const breed = getEl("filterBreed")?.value || "";
    const sex = getEl("filterSex")?.value || "";
    const status = getEl("filterStatus")?.value || "";

    if (species) params.set("species", species);
    if (breed) params.set("breed", breed);
    if (sex) params.set("sex", sex);
    if (status) params.set("status", status);

    const sort = getSortParams();

    if (sort.sort_by) params.set("sort_by", sort.sort_by);
    if (sort.sort_order) params.set("sort_order", sort.sort_order);

    return params.toString();
  }

  // Uzpildo breed filtro select pagal esamus gyvunus
  function fillBreedFilter(list) {
    const breedSelect = getEl("filterBreed");
    if (!breedSelect) return;

    const currentValue = breedSelect.value;

    const breeds = [...new Set(list.map((animal) => animal.breed).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "lt"));

    breedSelect.innerHTML = `<option value="">Visos veislės</option>`;

    breeds.forEach((breed) => {
      const option = document.createElement("option");
      option.value = breed;
      option.textContent = breed;
      breedSelect.appendChild(option);
    });

    if ([...breedSelect.options].some((option) => option.value === currentValue)) {
      breedSelect.value = currentValue;
    }
  }

  // Atvaizduoja gyvunu korteles shelter puslapyje
  function renderAnimals(list) {
    const grid = getEl("animalsGrid");
    if (!grid) return;

    if (!list.length) {
      grid.innerHTML = `<p>Gyvūnų nerasta.</p>`;
      return;
    }

    grid.innerHTML = list.map((animal) => `
      <div class="card-animal" data-code="${animal.code || ""}">
        <h3>${animal.name || "Be vardo"}</h3>

        <img src="${getAnimalImage(animal)}" alt="Gyvūnas" />

        <div class="card-animal-meta">
          <div><strong>Rūšis:</strong> ${mapSpeciesLabel(animal.species)}</div>
          <div><strong>Veislė:</strong> ${animal.breed || "-"}</div>
          <div><strong>Statusas:</strong> ${mapStatusLabel(animal.status)}</div>
        </div>
      </div>
    `).join("");

    // Ant kiekvienos korteles uzdedam paspaudima popup atidarymui
    grid.querySelectorAll(".card-animal").forEach((card) => {
      card.addEventListener("click", () => {
        const code = card.dataset.code;
        const animal = animals.find((item) => item.code === code);

        if (animal) {
          openAnimalModal(animal, "view");
        }
      });
    });
  }

  // Failo ikelimo requestas
// Naudojam FormData, todel Content-Type ranka nenustatom
async function uploadAnimalImage(animalId, file) {
  const token = authGetToken();

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`/api/animal/${animalId}/image`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(result?.detail || "Image upload failed");
    error.status = response.status;
    error.result = result;
    throw error;
  }

  return result;
}

// Gyvai parodo pasirinkta nauja nuotrauka popup virsuje
function bindAnimalImagePreview() {
  const imageInput = getEl("animalImageInput");

  if (!imageInput) return;

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];

    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    getEl("animalModalImage").src = previewUrl;
  });
}


  // Uzkrauna prisijungusios prieglaudos gyvunus
  async function loadAnimals() {
    const msg = getEl("animalsMessage");
    setMessage(msg, "");

    try {
      const query = buildAnimalQuery();

      animals = await apiRequest(`/api/animal/me${query ? `?${query}` : ""}`, {
        method: "GET"
      });

      fillBreedFilter(animals);
      renderAnimals(animals);
    } catch (error) {
      console.error(error);
      setMessage(msg, error.message || "Nepavyko užkrauti gyvūnų", "error");
    }
  }

  // Uzpildo popup perziuros laukus
  function fillAnimalView(animal) {
    getEl("animalModalTitle").textContent = animal.name || "Be vardo";

    getEl("animalModalSubtitle").textContent =
      `${mapSpeciesLabel(animal.species)}${animal.breed ? ` • ${animal.breed}` : ""}`;

    getEl("animalViewSpecies").textContent = mapSpeciesLabel(animal.species);
    getEl("animalViewBreed").textContent = animal.breed || "-";
    getEl("animalViewSex").textContent = mapSexLabel(animal.sex);
    getEl("animalViewStatus").textContent = mapStatusLabel(animal.status);
    getEl("animalViewBirthDate").textContent = animal.birth_date || "-";
    getEl("animalViewColor").textContent = animal.color || "-";
    getEl("animalViewCode").textContent = animal.code || "-";
    getEl("animalViewDescription").textContent =
      animal.description || "Aprašymo nėra.";

    getEl("animalModalImage").src = getAnimalImage(animal);
  }

  // Uzpildo popup forma redagavimui arba kurimui
  function fillAnimalForm(animal = {}) {
    getEl("animalNameInput").value = animal.name || "";
    getEl("animalCodeInput").value = animal.code || "";
    getEl("animalSpeciesInput").value = animal.species || "dog";
    getEl("animalBreedInput").value = animal.breed || "";
    getEl("animalSexInput").value = animal.sex || "unknown";
    getEl("animalStatusInput").value = animal.status || "available";
    getEl("animalBirthDateInput").value = animal.birth_date || "";
    getEl("animalColorInput").value = animal.color || "";
    getEl("animalDescriptionInput").value = animal.description || "";
  
    // Failo pasirinkimas neturi likti nuo ankstesnio atidarymo
    const imageInput = getEl("animalImageInput");
    if (imageInput) {
      imageInput.value = "";
    }
  }

    // Perjungia popup tarp perziuros, redagavimo ir kurimo rezimu
  function setAnimalModalMode(mode) {
    animalModalMode = mode;

    const isView = mode === "view";
    const isEdit = mode === "edit";
    const isCreate = mode === "create";

    getEl("animalViewMode").hidden = !isView;
    getEl("animalForm").hidden = !(isEdit || isCreate);

    getEl("animalEditBtn").hidden = !selectedAnimal || !isView;
    getEl("animalDeleteBtn").hidden = !selectedAnimal;
    getEl("animalSaveBtn").hidden = !(isEdit || isCreate);
    getEl("animalCancelBtn").hidden = !(isEdit || isCreate);

    if (isCreate) {
      getEl("animalModalTitle").textContent = "Naujas gyvūnas";
      getEl("animalModalSubtitle").textContent = "Įveskite informaciją";
      getEl("animalDeleteBtn").hidden = true;
      getEl("animalModalImage").src = "/assets/img/cat1.png";
    }
  }

  // Atidaro popup
  function openAnimalModal(animal = null, mode = "view") {
    selectedAnimal = animal;
    setMessage(getEl("animalModalMessage"), "");

    if (animal) {
      fillAnimalView(animal);
      fillAnimalForm(animal);
    } else {
      fillAnimalForm({});
    }

    setAnimalModalMode(mode);
    getEl("animalModalBackdrop").hidden = false;
  }

  // Uzdaro popup
  function closeAnimalModal() {
    getEl("animalModalBackdrop").hidden = true;
    selectedAnimal = null;
    setMessage(getEl("animalModalMessage"), "");
  }

  // Surenka popup formos duomenis i objekta
  function collectAnimalFormData() {
    return {
      name: getEl("animalNameInput").value.trim() || null,
      code: getEl("animalCodeInput").value.trim() || null,
      species: getEl("animalSpeciesInput").value,
      breed: getEl("animalBreedInput").value.trim() || null,
      sex: getEl("animalSexInput").value,
      status: getEl("animalStatusInput").value,
      birth_date: getEl("animalBirthDateInput").value || null,
      color: getEl("animalColorInput").value.trim() || null,
      description: getEl("animalDescriptionInput").value.trim() || null
    };
  }

  // Issaugo gyvuna
  // Jei create rezimas - kuria
  // Jei edit rezimas - atnaujina
  // Issaugo gyvuna
  // Jei create rezimas - kuria
  // Jei edit rezimas - atnaujina
  // Jei pasirinkta nuotrauka - po issaugojimo ikelia ja atskiru requestu
  async function saveAnimal() {
    const msg = getEl("animalModalMessage");
    setMessage(msg, "");

    const payload = collectAnimalFormData();

    // Pasirinktas nuotraukos failas
    const selectedImageFile = getEl("animalImageInput")?.files?.[0] || null;

    // Bent rusis turi buti pasirinkta
    if (!payload.species) {
      setMessage(msg, "Pasirinkite gyvūno rūšį", "error");
      return;
    }

    let savedAnimal = null;

    try {
      // Kurimas
      if (animalModalMode === "create") {
        savedAnimal = await apiRequest("/api/animal", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      // Redagavimas
      else if (animalModalMode === "edit" && selectedAnimal?.code) {
        savedAnimal = await apiRequest(
          `/api/animal/by-code/${encodeURIComponent(selectedAnimal.code)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );
      }

      // Jei pasirinkta nauja nuotrauka - ikeliam ja
      if (selectedImageFile && savedAnimal?.id) {
        await uploadAnimalImage(savedAnimal.id, selectedImageFile);
      }

      // Atnaujinam gyvunu sarasa
      await loadAnimals();

      // Uzdarom popup
      closeAnimalModal();
    } catch (error) {
      console.error(error);
      setMessage(msg, error.message || "Nepavyko išsaugoti gyvūno", "error");
    }
  }

  // Istrina pasirinkta gyvuna
  async function deleteAnimal() {
    if (!selectedAnimal?.code) return;

    const confirmed = window.confirm("Ar tikrai norite ištrinti šį gyvūną?");
    if (!confirmed) return;

    const msg = getEl("animalModalMessage");
    setMessage(msg, "");

    try {
      await apiRequest(`/api/animal/by-code/${encodeURIComponent(selectedAnimal.code)}`, {
        method: "DELETE"
      });

      // Po istrynimo atnaujinam kataloga ir uzdarom popup
      await loadAnimals();
      closeAnimalModal();
    } catch (error) {
      console.error(error);
      setMessage(msg, error.message || "Nepavyko ištrinti gyvūno", "error");
    }
  }

  // Sukabina visus gyvunu sekcijos eventus
  function bindAnimalEvents() {
    // Naujo gyvuno popup
    getEl("openCreateAnimalBtn")?.addEventListener("click", () => {
      openAnimalModal(null, "create");
    });

    // Popup uzdarymas per X
    getEl("closeAnimalModalBtn")?.addEventListener("click", closeAnimalModal);

    // Popup uzdarymas paspaudus ant fono
    getEl("animalModalBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "animalModalBackdrop") {
        closeAnimalModal();
      }
    });

    // Perjungimas i redagavima
    getEl("animalEditBtn")?.addEventListener("click", () => {
      if (!selectedAnimal) return;
      setAnimalModalMode("edit");
    });

    // Issaugojimas
    getEl("animalSaveBtn")?.addEventListener("click", saveAnimal);

    // Trinimas
    getEl("animalDeleteBtn")?.addEventListener("click", deleteAnimal);

    getEl("animalCancelBtn")?.addEventListener("click", () => {
      if (selectedAnimal) {
        fillAnimalView(selectedAnimal);
        fillAnimalForm(selectedAnimal);
        setAnimalModalMode("view");
        setMessage(getEl("animalModalMessage"), "");
        return;
      }

      closeAnimalModal();
    });

    // Filtru ir rikiavimo pakeitimu eventai
    ["filterSpecies", "filterBreed", "filterSex", "filterStatus", "sortAnimals"].forEach((id) => {
      getEl(id)?.addEventListener("change", loadAnimals);
    });

    // Nuotraukos preview popup'e
    bindAnimalImagePreview();    
  }

  // Pagrindine shelter puslapio logika
  async function initShelterPage() {
    const root = getEl("shelterProfilePage");
    if (!root) return;

    const authUser = await authFetchCurrentUser();

    if (!authUser) {
      window.location.href = "/index.html";
      return;
    }

    if (authUser.role !== "shelter") {
      window.location.href = "/index.html";
      return;
    }

    // Is karto nustatom needit rezima
    setShelterEditMode(false);

    // Uzkraunam shelter duomenis
    await loadShelterProfile();

    // Uzkraunam shelter gyvunus
    await loadAnimals();

    // Dar karta uztikrinam needit rezima po duomenu uzkrovimo
    setShelterEditMode(false);

    // Redagavimo mygtukas
    getEl("toggleShelterEditBtn")?.addEventListener("click", () => {
      if (!isEditing) {
        fillShelterForm(currentShelter || {});
        setShelterEditMode(true);
        return;
      }

      fillShelterForm(currentShelter || {});
      setShelterEditMode(false);
    });

    // Issaugojimo mygtukas
    getEl("saveShelterBtn")?.addEventListener("click", saveShelterProfile);

    // Jei ateita su edit parametru tada atidarom edit rezima
    const shouldOpenEdit =
      new URLSearchParams(window.location.search).get("edit") === "1";

    if (shouldOpenEdit) {
      setShelterEditMode(true);
    }

    // Sukabinam gyvunu eventus
    bindAnimalEvents();
  }

  document.addEventListener("DOMContentLoaded", initShelterPage);
})();