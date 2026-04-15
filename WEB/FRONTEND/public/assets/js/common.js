// -------------------------------------
// Bendros funkcijos visam projektui
// Naudojimas:
// const { fetchJson, getAnimalImage, translateSpecies, ... } = window.AppCommon;
// -------------------------------------

(function () {
  const shelterLogos = [
    "/assets/img/logo1.png",
    "/assets/img/logo2.png",
    "/assets/img/logo3.png",
    "/assets/img/logo4.jpg",
    "/assets/img/logo5.jpg"
  ];

  const fallbackAnimalImage = "/assets/img/animal_image_unavalible.jpg";

  function getEl(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      ""
    );
  }

  function setMessage(el, text, type = "", baseClass = "message") {
    if (!el) return;
    el.textContent = text || "";
    el.className = `${baseClass} ${type}`.trim();
  }

  function clearMessage(el, baseClass = "message") {
    setMessage(el, "", "", baseClass);
  }

  function normalizeWebsiteUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  }

  function normalizeImageUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (url.startsWith("/")) {
      return url;
    }
    return `/${url}`;
  }

  function resolveAnimalImageUrl(animal, fallback = fallbackAnimalImage) {
    if (!animal) {
      return fallback;
    }

    if (animal.primary_image_url) {
      return normalizeImageUrl(animal.primary_image_url);
    }

    if (animal.primary_image?.url) {
      return normalizeImageUrl(animal.primary_image.url);
    }

    if (Array.isArray(animal.images) && animal.images.length > 0) {
      const primaryImage = animal.images.find(
        (img) => img?.is_primary && img?.url
      );

      if (primaryImage?.url) {
        return normalizeImageUrl(primaryImage.url);
      }

      const firstImage = animal.images.find((img) => img?.url);

      if (firstImage?.url) {
        return normalizeImageUrl(firstImage.url);
      }
    }

    return fallback;
  }

  function getAnimalImage(animal, fallback = fallbackAnimalImage) {
    return resolveAnimalImageUrl(animal, fallback);
  }

  function getShelterLogo(shelter) {
    const safeId = Number(shelter?.id || 0);
    return shelterLogos[safeId % shelterLogos.length];
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

  function translateSex(sex) {
    return translateGender(sex);
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

  function buildAddress(data = {}) {
    const parts = [data.city, data.address].filter(Boolean);
    return parts.join(", ");
  }

  function getRequestedId(paramName = "id") {
    const rawId = new URLSearchParams(window.location.search).get(paramName);

    if (!rawId) {
      return null;
    }

    const id = Number(rawId);
    return Number.isNaN(id) ? null : id;
  }

  async function fetchJson(url, options = {}) {
    const token = getToken();

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

    if (response.status === 401 && token) {
      response = await makeRequest(false);
    }

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const error =
        new Error(result?.detail || `Klaida gaunant duomenis: ${response.status}`);
      error.status = response.status;
      error.result = result;
      throw error;
    }

    return result;
  }

  async function apiRequest(url, options = {}) {
    const token = getToken();

    const headers = {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const response = await fetch(url, {
      ...options,
      headers
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

  async function authFetchCurrentUser() {
    const token = getToken();

    if (!token) {
      return null;
    }

    try {
      return await fetchJson("/api/auth/me");
    } catch (error) {
      return null;
    }
  }

  async function loadCurrentUser() {
    return authFetchCurrentUser();
  }

  async function getShelters() {
    return fetchJson("/api/shelter");
  }

  async function getShelterById(id) {
    const shelters = await getShelters();
    return shelters.find((shelter) => Number(shelter.id) === Number(id)) || null;
  }

  function fillSelectOptions(select, items, config = {}) {
    if (!select) return;

    const {
      defaultValue = "",
      defaultLabel = "Pasirinkite",
      valueKey = "id",
      labelKey = "name",
      keepCurrentValue = true
    } = config;

    const currentValue = keepCurrentValue ? select.value : String(defaultValue);

    select.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = String(defaultValue);
    defaultOption.textContent = defaultLabel;
    select.appendChild(defaultOption);

    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item?.[valueKey] ?? "");
      option.textContent = String(item?.[labelKey] ?? "");
      select.appendChild(option);
    });

    const hasCurrent = [...select.options].some(
      (option) => option.value === String(currentValue)
    );

    select.value = hasCurrent ? String(currentValue) : String(defaultValue);
  }

  function fillShelterFilter(select, shelters, defaultLabel = "Visos prieglaudos") {
    fillSelectOptions(select, shelters, {
      defaultValue: "",
      defaultLabel,
      valueKey: "id",
      labelKey: "name",
      keepCurrentValue: true
    });
  }

  function fillBreedFilter(select, animals, defaultLabel = "Visos veislės") {
    if (!select) return;

    const breeds = [...new Set(animals.map((animal) => animal?.breed).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "lt"));

    const currentValue = select.value;

    select.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultLabel;
    select.appendChild(defaultOption);

    breeds.forEach((breed) => {
      const option = document.createElement("option");
      option.value = breed;
      option.textContent = breed;
      select.appendChild(option);
    });

    if ([...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
  }

  function readAnimalFilters(config = {}) {
    return {
      shelter_id: getEl(config.shelterId || "animalShelterFilter")?.value || "",
      species: getEl(config.speciesId || "animalSpeciesFilter")?.value || "",
      sex:
        getEl(config.sexId || config.genderId || "animalGenderFilter")?.value || "",
      status: getEl(config.statusId || "animalStatusFilter")?.value || "",
      sort_order: getEl(config.sortOrderId || "animalSortOrder")?.value || "desc"
    };
  }

  function buildAnimalListQuery(params = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== "") {
        searchParams.set(key, String(value));
      }
    });

    return searchParams.toString();
  }

  function getAnimalSortParams(selectValue) {
    const value = selectValue || "created_at_desc";

    if (value === "name_asc") return { sort_by: "name", sort_order: "asc" };
    if (value === "name_desc") return { sort_by: "name", sort_order: "desc" };
    if (value === "breed_asc") return { sort_by: "breed", sort_order: "asc" };
    if (value === "breed_desc") return { sort_by: "breed", sort_order: "desc" };
    if (value === "birth_date_asc") return { sort_by: "birth_date", sort_order: "asc" };
    if (value === "birth_date_desc") return { sort_by: "birth_date", sort_order: "desc" };

    return { sort_by: "created_at", sort_order: "desc" };
  }

  function renderPagination(container, options = {}) {
    if (!container) return;

    const {
      currentPage = 1,
      totalPages = 1,
      onPageChange
    } = options;

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

      if (!disabled && page !== null && typeof onPageChange === "function") {
        btn.addEventListener("click", () => onPageChange(page));
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
        createButton(
          String(totalPages),
          totalPages,
          false,
          currentPage === totalPages
        )
      );
    }

    container.appendChild(
      createButton("»", currentPage + 1, currentPage === totalPages)
    );
    container.appendChild(
      createButton("»»", totalPages, currentPage === totalPages)
    );
  }

  function openModal(backdropElOrId, lockScroll = true) {
    const backdrop =
      typeof backdropElOrId === "string" ? getEl(backdropElOrId) : backdropElOrId;

    if (!backdrop) return;

    backdrop.hidden = false;

    if (lockScroll) {
      document.body.style.overflow = "hidden";
    }
  }

  function closeModal(backdropElOrId, unlockScroll = true) {
    const backdrop =
      typeof backdropElOrId === "string" ? getEl(backdropElOrId) : backdropElOrId;

    if (!backdrop) return;

    backdrop.hidden = true;

    if (unlockScroll) {
      document.body.style.overflow = "";
    }
  }

  function bindBackdropClose(backdropElOrId, onClose) {
    const backdrop =
      typeof backdropElOrId === "string" ? getEl(backdropElOrId) : backdropElOrId;

    if (!backdrop) return;

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && typeof onClose === "function") {
        onClose();
      }
    });
  }

  function createObjectPreview(file, imgElOrId) {
    const imgEl = typeof imgElOrId === "string" ? getEl(imgElOrId) : imgElOrId;

    if (!file || !imgEl) {
      return null;
    }

    const previewUrl = URL.createObjectURL(file);
    imgEl.src = previewUrl;
    return previewUrl;
  }

  function attachChangeListeners(elements, handler) {
    elements.forEach((el) => {
      el?.addEventListener("change", handler);
    });
  }

  function attachClickListeners(elements, handler) {
    elements.forEach((el) => {
      el?.addEventListener("click", handler);
    });
  }

  window.AppCommon = {
    shelterLogos,
    fallbackAnimalImage,

    getEl,
    getToken,

    setMessage,
    clearMessage,

    normalizeWebsiteUrl,
    normalizeImageUrl,
    resolveAnimalImageUrl,
    getAnimalImage,
    getShelterLogo,

    translateSpecies,
    translateGender,
    translateSex,
    translateStatus,

    buildAddress,
    getRequestedId,

    fetchJson,
    apiRequest,
    authFetchCurrentUser,
    loadCurrentUser,

    getShelters,
    getShelterById,

    fillSelectOptions,
    fillShelterFilter,
    fillBreedFilter,

    readAnimalFilters,
    buildAnimalListQuery,
    getAnimalSortParams,

    renderPagination,

    openModal,
    closeModal,
    bindBackdropClose,

    createObjectPreview,
    attachChangeListeners,
    attachClickListeners
  };
})();