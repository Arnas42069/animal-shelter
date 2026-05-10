// -------------------------------------
// Savanorystes puslapio logika
// -------------------------------------

(function () {
  const state = {
    currentUser: null,
    sheltersLoaded: false,
    shelters: []
  };

  const getEl = (id) => document.getElementById(id);

  const els = {};

  function cacheElements() {
    els.showFormBtn = getEl("showVolunteerFormBtn");
    els.form = getEl("volunteerVisitForm");
    els.message = getEl("volunteerPageMessage");
    els.toast = getEl("volunteerToast");
    els.shelterSearch = getEl("shelterSearch");
    els.shelterSelect = getEl("shelterSelect");
    els.shelterDropdown = getEl("shelterDropdown");

    els.visitDate = getEl("visitDate");
    els.visitStartTime = getEl("visitStartTime");
    els.visitHours = getEl("visitHours");

    els.socialHoursCheck = getEl("socialHoursCheck");
    els.groupCheck = getEl("groupCheck");
    els.groupSizeField = getEl("groupSizeField");
    els.groupSize = getEl("groupSize");

    els.under16Check = getEl("under16Check");
    els.under16Notice = getEl("under16Notice");

    els.visitNote = getEl("visitNote");

    els.volunteerName = getEl("volunteerName");
    els.volunteerSurname = getEl("volunteerSurname");
    els.volunteerEmail = getEl("volunteerEmail");

    els.submitBtn = getEl("submitVolunteerFormBtn");
  }

  function getToken() {
    return window.AppCommon?.getToken
      ? window.AppCommon.getToken()
      : localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  }

  function setMessage(text, type = "") {
    if (!els.message) return;

    els.message.textContent = text || "";
    els.message.className = `volunteer-message ${type}`.trim();
  }
  
  function showToast(text) {
    if (!els.toast) return;

    els.toast.textContent = text;
    els.toast.classList.add("show");

    setTimeout(() => {
      els.toast.classList.remove("show");
    }, 3000);
  }
  function toLocalDateTime(dateValue, timeValue) {
    return `${dateValue}T${timeValue}:00`;
  }

  function setMinVisitDate() {
    if (!els.visitDate) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");

    els.visitDate.min = `${yyyy}-${mm}-${dd}`;
  }

  async function requestJson(url, options = {}) {
    if (window.AppCommon?.apiRequest) {
      return window.AppCommon.apiRequest(url, options);
    }

    const token = getToken();

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
      throw new Error(result?.detail || "Įvyko klaida");
    }

    return result;
  }

  async function loadCurrentUser() {
    if (!getToken()) {
      state.currentUser = null;
      return null;
    }

    try {
      state.currentUser = await requestJson("/api/appuser/me", {
        method: "GET"
      });
    } catch (error) {
      state.currentUser = null;
    }

    return state.currentUser;
  }

  function fillUserFields(user) {
    if (!user) return;

    if (els.volunteerName) els.volunteerName.value = user.name || "";
    if (els.volunteerSurname) els.volunteerSurname.value = user.surname || "";
    if (els.volunteerEmail) els.volunteerEmail.value = user.email || "";
  }

  function renderShelterDropdown(items) {
    if (!els.shelterDropdown) return;

    els.shelterDropdown.innerHTML = "";

    if (!items.length) {
      els.shelterDropdown.hidden = true;
      return;
    }

    items.forEach((shelter) => {
      const option = document.createElement("div");
      option.className = "autocomplete-option";
      option.textContent = shelter.city
        ? `${shelter.name} (${shelter.city})`
        : shelter.name;

      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectShelter(shelter);
      });

      els.shelterDropdown.appendChild(option);
    });

    els.shelterDropdown.hidden = false;
  }

  function selectShelter(shelter) {
    if (!shelter) return;

    els.shelterSearch.value = shelter.city
      ? `${shelter.name} (${shelter.city})`
      : shelter.name;

    els.shelterSelect.value = String(shelter.id);
    els.shelterDropdown.hidden = true;
  }

  function filterShelters() {
    const query = (els.shelterSearch.value || "").trim().toLowerCase();

    els.shelterSelect.value = "";

    if (!query) {
      renderShelterDropdown(state.shelters);
      return;
    }

    const filtered = state.shelters.filter((shelter) => {
      const fullName = shelter.city
        ? `${shelter.name} ${shelter.city}`
        : shelter.name;

      return fullName.toLowerCase().includes(query);
    });

    renderShelterDropdown(filtered);
  }

  async function loadShelters() {
    if (state.sheltersLoaded) return;

    try {
      const shelters = await requestJson("/api/shelter", {
        method: "GET"
      });

      state.shelters = shelters.filter((shelter) => shelter.is_active !== false);
      state.sheltersLoaded = true;
    } catch (error) {
      setMessage("Nepavyko užkrauti prieglaudų sąrašo", "error");
      state.shelters = [];
    }
  }

  async function showRegistrationForm() {
    setMessage("");

    const user = state.currentUser || await loadCurrentUser();

    if (!user) {
      setMessage("Norėdami registruotis savanorystei pirmiausia prisijunkite", "warning");

      if (typeof openAuthModal === "function") {
        openAuthModal("loginModal");
      }

      return;
    }

    if (user.role !== "volunteer") {
      setMessage("Savanorystei gali registruotis tik savanorio paskyra", "error");
      return;
    }

    fillUserFields(user);
    await loadShelters();

    if (els.form) {
      els.form.hidden = false;
    }

    if (els.showFormBtn) {
      els.showFormBtn.hidden = true;
    }

    els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateForm() {
    if (!els.shelterSelect.value) {
      return "Pasirinkite prieglaudą iš sąrašo";
    }

    if (!els.visitDate.value || !els.visitStartTime.value) {
      return "Užpildykite datą ir atvykimo laiką";
    }

    const hours = Number(els.visitHours.value);

    if (!hours || hours < 1) {
      return "Nurodykite, kiek valandų galite skirti savanorystei";
    }

    if (hours > 12) {
      return "Savanorystės trukmė negali būti ilgesnė nei 12 valandų";
    }

    if (els.groupCheck.checked) {
      const groupSize = Number(els.groupSize.value);

      if (!groupSize || groupSize < 2) {
        return "Nurodykite preliminarų grupės žmonių skaičių";
      }
    }

    return "";
  }

  async function submitRegistration(event) {
    event.preventDefault();
    setMessage("");

    const errorMessage = validateForm();

    if (errorMessage) {
      setMessage(errorMessage, "error");
      return;
    }

    const isGroup = Boolean(els.groupCheck.checked);

    const payload = {
      shelter_id: Number(els.shelterSelect.value),
      start_at: toLocalDateTime(els.visitDate.value, els.visitStartTime.value),
      duration_hours: Number(els.visitHours.value),
      is_under_16: Boolean(els.under16Check.checked),
      is_group: isGroup,
      group_size: isGroup ? Number(els.groupSize.value) : null,
      social_hrs: 0,
      note: els.visitNote.value.trim() || null
    };

    try {
      if (els.submitBtn) els.submitBtn.disabled = true;

      await requestJson("/api/visit", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      showToast("Registracija pateikta sėkmingai. Prieglauda gaus pranešimą.");
      setMessage("");

      els.form.reset();
      els.form.hidden = true;

      if (els.showFormBtn) {
        els.showFormBtn.hidden = false;
      }

      if (els.shelterSearch) {
        els.shelterSearch.value = "";
      }

      if (els.shelterSelect) {
        els.shelterSelect.value = "";
      }

      fillUserFields(state.currentUser);
      setMinVisitDate();

      if (els.under16Notice) {
        els.under16Notice.hidden = true;
      }

      if (els.groupSizeField) {
        els.groupSizeField.hidden = true;
      }

      if (els.groupSize) {
        els.groupSize.required = false;
        els.groupSize.value = "";
      }

      if (els.shelterDropdown) {
        els.shelterDropdown.hidden = true;
      }
    } catch (error) {
      showToast(error.message || "Nepavyko pateikti registracijos");
    } finally {
      if (els.submitBtn) els.submitBtn.disabled = false;
    }
  }

  function bindEvents() {
    if (els.showFormBtn) {
      els.showFormBtn.addEventListener("click", showRegistrationForm);
    }

    if (els.form) {
      els.form.addEventListener("submit", submitRegistration);
    }

    if (els.under16Check && els.under16Notice) {
      els.under16Check.addEventListener("change", () => {
        els.under16Notice.hidden = !els.under16Check.checked;
      });
    }

    if (els.groupCheck && els.groupSizeField && els.groupSize) {
      els.groupCheck.addEventListener("change", () => {
        const isGroup = els.groupCheck.checked;

        els.groupSizeField.hidden = !isGroup;
        els.groupSize.required = isGroup;

        if (!isGroup) {
          els.groupSize.value = "";
        }
      });
    }

    if (els.shelterSearch) {
      els.shelterSearch.addEventListener("focus", () => {
        renderShelterDropdown(state.shelters);
      });

      els.shelterSearch.addEventListener("input", filterShelters);

      els.shelterSearch.addEventListener("blur", () => {
        setTimeout(() => {
          if (els.shelterDropdown) {
            els.shelterDropdown.hidden = true;
          }
        }, 150);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    cacheElements();
    setMinVisitDate();
    bindEvents();

    await loadCurrentUser();
  });
})();