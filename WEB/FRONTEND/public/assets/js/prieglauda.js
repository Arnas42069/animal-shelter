(function () {
  let currentShelter = null;
  let authUser = null;
  let canEditCurrentShelter = false;
  let isEditing = false;
  let animals = [];
  let selectedAnimal = null;
  let animalModalMode = "view";

  const {
    getEl,
    getToken,
    setMessage,
    clearMessage,
    apiRequest,
    authFetchCurrentUser,
    buildAddress,
    normalizeWebsiteUrl,
    getRequestedId,
    getShelterById,
    translateSpecies,
    translateSex,
    translateStatus,
    getAnimalImage,
    fillBreedFilter,
    openModal,
    closeModal,
    createObjectPreview,
    showNotification
  } = window.AppCommon;

  function setShelterMessage(text, type = "") {
    setMessage(getEl("shelterMessage"), text, type, "shelter-message");
  }

  function clearShelterMessage() {
    clearMessage(getEl("shelterMessage"), "shelter-message");
  }

  function setAnimalsMessage(text, type = "") {
    setMessage(getEl("animalsMessage"), text, type, "shelter-message");
  }

  function clearAnimalsMessage() {
    clearMessage(getEl("animalsMessage"), "shelter-message");
  }

  function setAnimalModalMessage(text, type = "") {
    setMessage(getEl("animalModalMessage"), text, type, "shelter-message");
  }

  function clearAnimalModalMessage() {
    clearMessage(getEl("animalModalMessage"), "shelter-message");
  }

  function applyShelterPermissions() {
    const editBtn = getEl("toggleShelterEditBtn");
    const saveBtn = getEl("saveShelterBtn");
    const createAnimalBtn = getEl("openCreateAnimalBtn");

    const canEdit =
      Boolean(authUser) &&
      authUser.role === "shelter" &&
      canEditCurrentShelter === true;

    if (editBtn) {
      editBtn.hidden = !canEdit;
    }

    if (saveBtn) {
      saveBtn.hidden = true;
    }

    if (createAnimalBtn) {
      createAnimalBtn.hidden = !canEdit;
    }
  }

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

  function setShelterEditMode(show) {
    isEditing = show;

    getEl("shelterHeaderView").hidden = show;
    getEl("shelterHeaderEdit").hidden = !show;

    getEl("shelterDescriptionView").hidden = show;
    getEl("shelterDescriptionEditWrap").hidden = !show;

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

  async function loadShelterProfile() {
    clearShelterMessage();

    const requestedShelterId = getRequestedId("id");

    try {
      if (authUser?.role === "shelter") {
        const myShelter = await apiRequest("/api/shelter/me", {
          method: "GET"
        });

        const isOwnShelter =
          !requestedShelterId || Number(myShelter.id) === Number(requestedShelterId);

        if (isOwnShelter) {
          currentShelter = myShelter;
          canEditCurrentShelter = true;
        } else {
          const otherShelter = await getShelterById(requestedShelterId);

          if (!otherShelter) {
            throw new Error("Prieglauda nerasta");
          }

          currentShelter = otherShelter;
          canEditCurrentShelter = false;
        }
      } else {
        if (!requestedShelterId) {
          throw new Error("Prieglaudos id nerastas");
        }

        const shelter = await getShelterById(requestedShelterId);

        if (!shelter) {
          throw new Error("Prieglauda nerasta");
        }

        currentShelter = shelter;
        canEditCurrentShelter = false;
      }

      fillShelterView(currentShelter);
      fillShelterForm(currentShelter);
      applyShelterPermissions();
    } catch (error) {
      console.error(error);

      if (error.status === 401 || error.status === 403) {
        setShelterMessage("Nepavyko užkrauti prieglaudos duomenų", "error");
        return;
      }

      setShelterMessage(
        error.message || "Nepavyko užkrauti prieglaudos duomenų",
        "error"
      );
    }
  }

  async function saveShelterProfile() {
    clearShelterMessage();

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
      setShelterMessage("Įrašykite prieglaudos pavadinimą", "error");
      return;
    }

    if (!payload.city || !payload.address) {
      setShelterMessage("Įrašykite miestą ir adresą", "error");
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

    showNotification("Profilio informacija atnaujinta", "success");
    } catch (error) {
      console.error(error);
      setShelterMessage(
        error.message || "Nepavyko atnaujinti prieglaudos",
        "error"
      );
    }
  }

  function getSortParams() {
    const sortOrder = getEl("animalSortOrder")?.value || "desc";

    return {
      sort_by: "created_at",
      sort_order: sortOrder
    };
  }

  function buildAnimalQuery() {
    const params = new URLSearchParams();

    const search = getEl("animalSearchInput")?.value.trim() || "";
    const species = getEl("animalSpeciesFilter")?.value || "";
    const sex = getEl("animalGenderFilter")?.value || "";
    const status = getEl("animalStatusFilter")?.value || "";

    if (search) params.set("search", search);
    if (species) params.set("species", species);
    if (sex) params.set("sex", sex);
    if (status) params.set("status", status);

    const sort = getSortParams();

    if (sort.sort_by) params.set("sort_by", sort.sort_by);
    if (sort.sort_order) params.set("sort_order", sort.sort_order);

    return params.toString();
  }

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
          <div><strong>Rūšis:</strong> ${translateSpecies(animal.species)}</div>
          <div><strong>Veislė:</strong> ${animal.breed || "-"}</div>
          <div><strong>Statusas:</strong> ${translateStatus(animal.status)}</div>
        </div>
      </div>
    `).join("");

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

  async function uploadAnimalImage(animalId, file) {
    const token = getToken();

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
      const error = new Error(result?.detail || "Nepavyko įkelti nuotraukos");
      error.status = response.status;
      error.result = result;
      throw error;
    }

    return result;
  }

  function setAnimalModalImageFromSelectedFile() {
    const imageInput = getEl("animalImageInput");
    const file = imageInput?.files?.[0];

    if (!file) {
      if (animalModalMode === "create") {
        getEl("animalModalImage").src = window.AppCommon.fallbackAnimalImage;
      } else if (selectedAnimal) {
        getEl("animalModalImage").src = getAnimalImage(selectedAnimal);
      }
      return;
    }

    createObjectPreview(file, "animalModalImage");
  }

  function bindAnimalImagePreview() {
    const imageInput = getEl("animalImageInput");
    if (!imageInput) return;

    imageInput.addEventListener("change", setAnimalModalImageFromSelectedFile);
  }

  async function loadAnimals(page = 1) {
    clearAnimalsMessage();

    try {
      if (!currentShelter?.id) {
        throw new Error("Prieglauda nerasta");
      }

      const query = buildAnimalQuery();
      const params = new URLSearchParams(query);

      params.set("shelter_id", currentShelter.id);
      params.set("page", String(page));
      params.set("page_size", "8");

      const result = await apiRequest(`/api/animal?${params.toString()}`, {
        method: "GET"
      });

      animals = Array.isArray(result?.items) ? result.items : [];
      const total = Number(result?.total || 0);
      const totalPages = Math.ceil(total / 8);

      renderAnimals(animals);
      renderAnimalsPagination(totalPages, page);
    } catch (error) {
      console.error(error);
      setAnimalsMessage(error.message || "Nepavyko užkrauti gyvūnų", "error");
    }
  }

  function renderAnimalsPagination(totalPages, currentPage) {
    const container = getEl("animalsPagination");
    if (!container) return;

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

      if (!disabled) {
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

    const startPage = Math.max(1, currentPage - 3);
    const endPage = Math.min(totalPages, currentPage + 3);

    container.appendChild(createButton("««", 1, currentPage === 1));
    container.appendChild(createButton("«", currentPage - 1, currentPage === 1));

    if (startPage > 1) {
      container.appendChild(createButton("1", 1, false, currentPage === 1));
    }

    if (startPage > 2) {
      container.appendChild(createDots());
    }

    for (let page = startPage; page <= endPage; page += 1) {
      container.appendChild(
        createButton(String(page), page, false, page === currentPage)
      );
    }

    if (endPage < totalPages - 1) {
      container.appendChild(createDots());
    }

    if (endPage < totalPages) {
      container.appendChild(
        createButton(String(totalPages), totalPages, false, currentPage === totalPages)
      );
    }

    container.appendChild(createButton("»", currentPage + 1, currentPage === totalPages));
    container.appendChild(createButton("»»", totalPages, currentPage === totalPages));
  }

  function fillAnimalView(animal) {
    getEl("animalModalTitle").textContent = animal.name || "Be vardo";

    getEl("animalModalSubtitle").textContent =
      `${translateSpecies(animal.species)}${animal.breed ? ` • ${animal.breed}` : ""}`;

    getEl("animalViewSpecies").textContent = translateSpecies(animal.species);
    getEl("animalViewBreed").textContent = animal.breed || "-";
    getEl("animalViewSex").textContent = translateSex(animal.sex);
    getEl("animalViewStatus").textContent = translateStatus(animal.status);
    getEl("animalViewBirthDate").textContent = animal.birth_date || "-";
    getEl("animalViewColor").textContent = animal.color || "-";
    getEl("animalViewCode").textContent = animal.code || "-";
    getEl("animalViewDescription").textContent =
      animal.description || "Aprašymo nėra.";

    getEl("animalModalImage").src = getAnimalImage(animal);
  }

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

    const imageInput = getEl("animalImageInput");
    if (imageInput) {
      imageInput.value = "";
    }
  }

  function setAnimalModalMode(mode) {
    animalModalMode = mode;

    const isView = mode === "view";
    const isEdit = mode === "edit";
    const isCreate = mode === "create";

    const canEdit =
      Boolean(authUser) &&
      authUser.role === "shelter" &&
      canEditCurrentShelter === true;

    getEl("animalViewMode").hidden = !isView;
    getEl("animalForm").hidden = !(isEdit || isCreate);

    getEl("animalEditBtn").hidden = !selectedAnimal || !isView || !canEdit;
    getEl("animalDeleteBtn").hidden = !selectedAnimal || !canEdit;
    getEl("animalSaveBtn").hidden = !(isEdit || isCreate) || !canEdit;
    getEl("animalCancelBtn").hidden = !(isEdit || isCreate);

    if (isCreate) {
      getEl("animalModalTitle").textContent = "Naujas gyvūnas";
      getEl("animalModalSubtitle").textContent = "Įveskite informaciją";
      getEl("animalDeleteBtn").hidden = true;
      getEl("animalModalImage").src = window.AppCommon.fallbackAnimalImage;
    }

    if (isEdit && selectedAnimal) {
      getEl("animalModalImage").src = getAnimalImage(selectedAnimal);
    }

    if (isView && selectedAnimal) {
      getEl("animalModalImage").src = getAnimalImage(selectedAnimal);
    }
  }

  function openAnimalModal(animal = null, mode = "view") {
    selectedAnimal = animal;
    clearAnimalModalMessage();

    if (animal) {
      fillAnimalView(animal);
      fillAnimalForm(animal);
    } else {
      fillAnimalForm({});
      getEl("animalModalImage").src = window.AppCommon.fallbackAnimalImage;
    }

    setAnimalModalMode(mode);
    openModal("animalModalBackdrop", false);
  }

  function closeAnimalModal() {
    closeModal("animalModalBackdrop", false);
    selectedAnimal = null;
    clearAnimalModalMessage();
  }

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

  async function saveAnimal() {
    clearAnimalModalMessage();

    const payload = collectAnimalFormData();
    const selectedImageFile = getEl("animalImageInput")?.files?.[0] || null;

    if (!payload.species) {
      setAnimalModalMessage("Pasirinkite gyvūno rūšį", "error");
      return;
    }

    let savedAnimal = null;

    try {
      if (animalModalMode === "create") {
        savedAnimal = await apiRequest("/api/animal", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        if (selectedImageFile && savedAnimal?.id) {
          try {
            await uploadAnimalImage(savedAnimal.id, selectedImageFile);
          } catch (imageError) {
            console.error(imageError);

            await loadAnimals();

            setAnimalModalMessage(
              "Gyvūnas sukurtas, bet nuotraukos įkelti nepavyko",
              "error"
            );
            return;
          }
        }
      } else if (animalModalMode === "edit" && selectedAnimal?.code) {
        savedAnimal = await apiRequest(
          `/api/animal/by-code/${encodeURIComponent(selectedAnimal.code)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );

        if (selectedImageFile && savedAnimal?.id) {
          try {
            await uploadAnimalImage(savedAnimal.id, selectedImageFile);
          } catch (imageError) {
            console.error(imageError);

            await loadAnimals();

            setAnimalModalMessage(
              "Gyvūno duomenys atnaujinti, bet nuotraukos įkelti nepavyko",
              "error"
            );
            return;
          }
        }
      }

      await loadShelterStats();
      await loadAnimals();

      closeAnimalModal();

    } catch (error) {
      console.error(error);
      setAnimalModalMessage(error.message || "Nepavyko išsaugoti gyvūno", "error");
    }
  }

  async function deleteAnimal() {
    if (!selectedAnimal?.code) return;

    const confirmed = window.confirm("Ar tikrai norite ištrinti šį gyvūną?");
    if (!confirmed) return;

    clearAnimalModalMessage();

    try {
      await apiRequest(`/api/animal/by-code/${encodeURIComponent(selectedAnimal.code)}`, {
        method: "DELETE"
      });

      await loadShelterStats();
      await loadAnimals();
      
      closeAnimalModal();
    } catch (error) {
      console.error(error);
      setAnimalModalMessage(error.message || "Nepavyko ištrinti gyvūno", "error");
    }
  }

  function bindAnimalEvents() {
    const backdrop = getEl("animalModalBackdrop");
    const closeBtn = getEl("closeAnimalModalBtn");
    const editBtn = getEl("animalEditBtn");
    const saveBtn = getEl("animalSaveBtn");
    const deleteBtn = getEl("animalDeleteBtn");
    const cancelBtn = getEl("animalCancelBtn");
    const createBtn = getEl("openCreateAnimalBtn");

    createBtn?.addEventListener("click", () => {
      const canEdit =
        Boolean(authUser) &&
        authUser.role === "shelter" &&
        canEditCurrentShelter === true;

      if (!canEdit) {
        return;
      }

      openAnimalModal(null, "create");
    });

    closeBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAnimalModal();
    });

    backdrop?.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeAnimalModal();
      }
    });

    editBtn?.addEventListener("click", () => {
      if (!selectedAnimal) return;
      setAnimalModalMode("edit");
    });

    saveBtn?.addEventListener("click", saveAnimal);
    deleteBtn?.addEventListener("click", deleteAnimal);

    cancelBtn?.addEventListener("click", () => {
      if (selectedAnimal) {
        fillAnimalView(selectedAnimal);
        fillAnimalForm(selectedAnimal);
        setAnimalModalMode("view");
        clearAnimalModalMessage();
        return;
      }

      closeAnimalModal();
    });

    ["animalSpeciesFilter", "animalGenderFilter", "animalStatusFilter", "animalSortOrder"].forEach((id) => {
      getEl(id)?.addEventListener("change", () => loadAnimals(1));
    });

    let animalSearchTimeout = null;
    getEl("animalSearchInput")?.addEventListener("input", () => {
      clearTimeout(animalSearchTimeout);
      animalSearchTimeout = setTimeout(() => loadAnimals(1), 250);
    });

    bindAnimalImagePreview();
  }

  async function initShelterPage() {
    const root = getEl("shelterProfilePage");
    if (!root) return;

    authUser = null;
    canEditCurrentShelter = false;
    setShelterEditMode(false);
    applyShelterPermissions();

    try {
      authUser = await authFetchCurrentUser();
    } catch (error) {
      authUser = null;
    }

    if (authUser && authUser.role !== "shelter" && authUser.role !== "volunteer") {
      window.location.href = "/index.html";
      return;
    }

    await loadShelterProfile();
    await loadShelterStats();
    await loadAnimals();

    setShelterEditMode(false);
    applyShelterPermissions();

    getEl("toggleShelterEditBtn")?.addEventListener("click", () => {
      const canEdit =
        Boolean(authUser) &&
        authUser.role === "shelter" &&
        canEditCurrentShelter === true;

      if (!canEdit) {
        return;
      }

      if (!isEditing) {
        fillShelterForm(currentShelter || {});
        setShelterEditMode(true);
        return;
      }

      fillShelterForm(currentShelter || {});
      setShelterEditMode(false);
    });

    getEl("saveShelterBtn")?.addEventListener("click", async () => {
      const canEdit =
        Boolean(authUser) &&
        authUser.role === "shelter" &&
        canEditCurrentShelter === true;

      if (!canEdit) {
        return;
      }

      await saveShelterProfile();
    });

    const shouldOpenEdit =
      new URLSearchParams(window.location.search).get("edit") === "1";

    if (shouldOpenEdit) {
      const canEdit =
        Boolean(authUser) &&
        authUser.role === "shelter" &&
        canEditCurrentShelter === true;

      if (canEdit) {
        setShelterEditMode(true);
      }
    }

    bindAnimalEvents();
  }

  async function loadShelterStats() {
    try {
      if (!currentShelter?.id) {
        return;
      }

      const [availableResult, adoptedResult] = await Promise.all([
        apiRequest(`/api/animal?shelter_id=${currentShelter.id}&status=available&page=1&page_size=1`, {
          method: "GET"
        }),
        apiRequest(`/api/animal?shelter_id=${currentShelter.id}&status=adopted&page=1&page_size=1`, {
          method: "GET"
        })
      ]);

      const availableCount = Number(availableResult?.total || 0);
      const adoptedCount = Number(adoptedResult?.total || 0);

      const availableEl = getEl("availableAnimalsCount");
      const adoptedEl = getEl("adoptedAnimalsCount");

      if (availableEl) {
        availableEl.textContent = String(availableCount);
      }

      if (adoptedEl) {
        adoptedEl.textContent = String(adoptedCount);
      }
    } catch (error) {
      console.error("Nepavyko užkrauti prieglaudos statistikos:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", initShelterPage);
})();