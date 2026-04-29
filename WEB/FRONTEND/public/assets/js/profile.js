(function () {
  // Dabartinio prisijungusio vartotojo duomenys
  let currentUser = null;

  // Ar siuo metu ijungtas redagavimo rezimas
  let isEditing = false;
const { showNotification } = window.AppCommon;
  // Patogesne funkcija elemento paemimui pagal id
  function getEl(id) {
    return document.getElementById(id);
  }

  // Parodo zinute vartotojui
  function setMessage(el, text, type = "") {
    if (!el) return;

    el.textContent = text || "";
    el.className = `profile-message ${type}`.trim();
  }

  // Bendras request i backend su token
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

  // Uzpildo vartotojo laukus
  function fillProfileForm(user) {
    getEl("editName").value = user.name || "";
    getEl("editSurname").value = user.surname || "";
    getEl("editEmail").value = user.email || "";
  }

  // Parodo arba paslepia slaptazodi
  function togglePasswordVisibility(show) {
    const inputType = show ? "text" : "password";

    const newPassword = getEl("newPassword");
    const repeatPassword = getEl("repeatPassword");

    if (newPassword) newPassword.type = inputType;
    if (repeatPassword) repeatPassword.type = inputType;
  }

  // Ijungia arba isjungia inline redagavimo rezima
  function setInlineEditMode(show) {
    isEditing = show;

    const inputs = [
      getEl("editName"),
      getEl("editSurname"),
      getEl("editEmail")
    ];

    const toggleEditBtn = getEl("toggleEditBtn");
    const saveProfileBtn = getEl("saveProfileBtn");

    inputs.forEach((input) => {
      if (!input) return;

      input.readOnly = !show;

      if (show) {
        input.classList.add("editing");
      } else {
        input.classList.remove("editing");
      }
    });

    if (toggleEditBtn) {
      toggleEditBtn.textContent = show ? "Atšaukti" : "Redaguoti";
    }

    if (saveProfileBtn) {
      saveProfileBtn.hidden = !show;
    }
  }

  // Uzkrauna app user duomenis
  async function loadProfile() {
    const messageEl = getEl("profileMessage");
    setMessage(messageEl, "");

    try {
      currentUser = await apiRequest("/api/appuser/me", {
        method: "GET"
      });

      fillProfileForm(currentUser);
    } catch (error) {
      console.error(error);

      if (error.status === 401 || error.status === 403) {
        authLogout();
        return;
      }

      setMessage(
        messageEl,
        error.message || "Nepavyko užkrauti profilio duomenų",
        "error"
      );
    }
  }

  // Issaugo user duomenu pakeitimus
  async function handleProfileSave(event) {
    event.preventDefault();

    if (!isEditing) return;

    const messageEl = getEl("profileMessage");
    setMessage(messageEl, "");

    const payload = {
      name: getEl("editName").value.trim(),
      surname: getEl("editSurname").value.trim(),
      email: getEl("editEmail").value.trim()
    };

    if (!payload.name || !payload.surname || !payload.email) {
      setMessage(
        messageEl,
        "Užpildykite vardą, pavardę ir el. paštą",
        "error"
      );
      return;
    }

    try {
      currentUser = await apiRequest("/api/appuser/me", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      fillProfileForm(currentUser);
      setInlineEditMode(false);

      showNotification("Profilio informacija atnaujinta", "success");

      window.dispatchEvent(new CustomEvent("auth-changed"));
    } catch (error) {
      console.error(error);
      setMessage(
        messageEl,
        error.message || "Nepavyko atnaujinti profilio",
        "error"
      );
    }
  }

  // Keicia slaptazodi
  async function handlePasswordSave(event) {
    event.preventDefault();

    const messageEl = getEl("profileMessage");
    setMessage(messageEl, "");

    const password = getEl("newPassword").value;
    const repeatPassword = getEl("repeatPassword").value;

    if (!password || !repeatPassword) {
      setMessage(
        messageEl,
        "Įveskite naują slaptažodį du kartus",
        "error"
      );
      return;
    }

    if (password !== repeatPassword) {
      setMessage(messageEl, "Slaptažodžiai nesutampa", "error");
      return;
    }

    try {
      await apiRequest("/api/appuser/me", {
        method: "PATCH",
        body: JSON.stringify({ password: password })
      });

      getEl("newPassword").value = "";
      getEl("repeatPassword").value = "";
      getEl("showPasswords").checked = false;
      togglePasswordVisibility(false);

      getEl("passwordSection").hidden = true;

      setMessage(messageEl, "Slaptažodis pakeistas", "success");
    } catch (error) {
      console.error(error);
      setMessage(
        messageEl,
        error.message || "Nepavyko pakeisti slaptažodžio",
        "error"
      );
    }
  }

  // Istrina vartotojo paskyra
  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Ar tikrai norite ištrinti paskyrą? Šio veiksmo atšaukti negalėsite."
    );

    if (!confirmed) return;

    try {
      await apiRequest("/api/appuser/me", {
        method: "DELETE"
      });

      authLogout();
    } catch (error) {
      console.error(error);
      setMessage(
        getEl("profileMessage"),
        error.message || "Nepavyko ištrinti paskyros",
        "error"
      );
    }
  }

  // Pagrindine puslapio logika
  async function initVolunteerProfilePage() {
    const profileRoot = getEl("volunteerProfilePage");
    if (!profileRoot) return;

    const authUser = await authFetchCurrentUser();

    if (!authUser) {
      window.location.href = "/index.html";
      return;
    }

    // Svarbus pakeitimas
    // I sita puslapi dabar leidziam ir volunteer ir shelter rolei
    // nes shelter naudotojas cia keicia prisijungimo duomenis
    if (authUser.role !== "volunteer" && authUser.role !== "shelter") {
      window.location.href = "/index.html";
      return;
    }

    getEl("toggleEditBtn")?.addEventListener("click", () => {
      if (!isEditing) {
        fillProfileForm(currentUser);
        setInlineEditMode(true);
        return;
      }

      fillProfileForm(currentUser);
      setInlineEditMode(false);
    });

    getEl("profileInlineForm")?.addEventListener("submit", handleProfileSave);
    getEl("passwordForm")?.addEventListener("submit", handlePasswordSave);

    getEl("togglePasswordBtn")?.addEventListener("click", () => {
      const passwordSection = getEl("passwordSection");
      if (!passwordSection) return;

      passwordSection.hidden = !passwordSection.hidden;
    });

    getEl("showPasswords")?.addEventListener("change", (event) => {
      togglePasswordVisibility(event.target.checked);
    });

    getEl("deleteAccountBtn")?.addEventListener("click", handleDeleteAccount);

    await loadProfile();
    setInlineEditMode(false);

    const shouldOpenEdit =
      new URLSearchParams(window.location.search).get("edit") === "1";

    if (shouldOpenEdit) {
      setInlineEditMode(true);
    }
  }

  document.addEventListener("DOMContentLoaded", initVolunteerProfilePage);
})();