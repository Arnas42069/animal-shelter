(function () {
  // Dabartines prieglaudos duomenys
  let currentShelter = null;

  // Ar ijungtas redagavimo rezimas
  let isEditing = false;

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

  // Uzpildo perziuros laukus
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

  // Uzpildo redagavimo laukus
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

  // Ijungia arba isjungia redagavimo rezima
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

    // Uzkraunam duomenis
    await loadShelterProfile();

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
  }

  document.addEventListener("DOMContentLoaded", initShelterPage);
})();