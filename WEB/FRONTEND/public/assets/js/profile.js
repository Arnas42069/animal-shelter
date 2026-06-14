(function () {
  // Dabartinio prisijungusio vartotojo duomenys
  let currentUser = null;

  // Ar siuo metu ijungtas redagavimo rezimas
  let isEditing = false;

  // Savanorio registraciju sarasas profilio istorijai
  let volunteerVisits = [];

  // Patogesne funkcija elemento paemimui pagal id
  function getEl(id) {
    return document.getElementById(id);
  }

  // Parodo zinute vartotojui
  function setMessage(el, text, type = "") {
    if (!el) return;

    if (
      text &&
      ["success", "error", "warning"].includes(type) &&
      window.AppCommon &&
      typeof window.AppCommon.showNotification === "function"
    ) {
      window.AppCommon.showNotification(text, type);
      el.textContent = "";
      el.className = "profile-message";
      return;
    }

    el.textContent = text || "";
    el.className = `profile-message ${type}`.trim();
  }

  // Saugus notification wrapperis
  // Jei window.AppCommon neegzistuoja, rodome zinute paciame profilio puslapyje
  function showProfileNotification(text, type = "") {
    if (
      window.AppCommon &&
      typeof window.AppCommon.showNotification === "function"
    ) {
      window.AppCommon.showNotification(text, type);
      return;
    }

    setMessage(getEl("profileMessage"), text, type);
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
  function fillProfileForm(user = {}) {
    getEl("editName").value = user.name || "";
    getEl("editSurname").value = user.surname || "";
    getEl("editEmail").value = user.email || "";

    const fullName = [user.name, user.surname].filter(Boolean).join(" ");
    const title = getEl("profileFullName");
    const emailText = getEl("profileEmailText");

    if (title) title.textContent = fullName || "Mano profilis";
    if (emailText) emailText.textContent = user.email || "-";
  }

  // Parodo arba paslepia slaptazodi
  function togglePasswordVisibility(show) {
    const inputType = show ? "text" : "password";

    const newPassword = getEl("newPassword");
    const repeatPassword = getEl("repeatPassword");

    if (newPassword) newPassword.type = inputType;
    if (repeatPassword) repeatPassword.type = inputType;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("lt-LT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDuration(startValue, endValue) {
    const start = new Date(startValue);
    const end = new Date(endValue);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "-";
    }

    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const totalMinutes = Math.round(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours && minutes) return `${hours} val. ${minutes} min.`;
    if (hours) return `${hours} val.`;
    return `${minutes} min.`;
  }

  function formatHours(value) {
    const number = Number(value || 0);
    return `${number.toFixed(number % 1 === 0 ? 0 : 2)} val.`;
  }

  function getVisitStatusText(status) {
    const statuses = {
      pending: "Laukia",
      scheduled: "Patvirtinta",
      completed: "Užbaigta",
      cancelled: "Atšaukta"
    };

    return statuses[status] || status || "-";
  }

  function getHistoryControls() {
    return {
      search: getEl("volunteerHistorySearch")?.value.trim().toLowerCase() || "",
      sort: getEl("volunteerHistorySort")?.value || "date-desc"
    };
  }

  function getVisibleVolunteerVisits() {
    const controls = getHistoryControls();

    return volunteerVisits
      .filter((visit) => {
        if (!controls.search) return true;

        return (visit.shelter?.name || "")
          .toLowerCase()
          .includes(controls.search);
      })
      .sort((a, b) => {
        const first = new Date(a.start_at).getTime() || 0;
        const second = new Date(b.start_at).getTime() || 0;

        return controls.sort === "date-asc" ? first - second : second - first;
      });
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
    const profileEditFields = getEl("profileEditFields");
    const profileIdentityView = document.querySelector(".profile-identity-view");

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

    if (profileEditFields) {
      profileEditFields.hidden = !show;
    }

    if (profileIdentityView) {
      profileIdentityView.hidden = show;
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

  function renderVolunteerHistory() {
    const list = getEl("volunteerHistoryList");
    if (!list) return;

    const visits = getVisibleVolunteerVisits();

    if (!visits.length) {
      list.innerHTML = `
        <div class="history-empty">
          Pagal pasirinktus filtrus savanorystės įrašų nėra.
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div class="history-table-head" aria-hidden="true">
        <span>Data</span>
        <span>Prieglauda</span>
        <span>Būsena</span>
        <span>Soc. valandos</span>
      </div>

      ${visits.map((visit) => `
        <article class="history-item">
          <strong>${escapeHtml(formatDateTime(visit.start_at))}</strong>
          <strong>${escapeHtml(visit.shelter?.name || "-")}</strong>
          <span class="history-status ${escapeHtml(visit.status)}">
            ${escapeHtml(getVisitStatusText(visit.status))}
          </span>
          <strong>${escapeHtml(formatHours(visit.social_hrs))}</strong>
        </article>
      `).join("")}
    `;
  }

  async function loadVolunteerHistory(authUser) {
    const section = getEl("volunteerHistorySection");
    if (!section) return;

    if (authUser.role !== "volunteer") {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    try {
      const [hoursResult, visitsResult] = await Promise.all([
        apiRequest("/api/visit/me/social-hours", { method: "GET" }),
        apiRequest("/api/visit/me", { method: "GET" })
      ]);

      volunteerVisits = Array.isArray(visitsResult)
        ? visitsResult.filter((visit) => visit.status !== "cancelled")
        : [];

      const completedVisitsCount = volunteerVisits.filter(
        (visit) => visit.status === "completed"
      ).length;

      getEl("totalSocialHours").textContent = formatHours(hoursResult?.total_social_hours);
      getEl("completedVisitsCount").textContent =
        `${volunteerVisits.length} ${volunteerVisits.length === 1 ? "registracija" : "registracijų"} · ${completedVisitsCount} užbaigta`;

      renderVolunteerHistory();
    } catch (error) {
      console.error("Nepavyko užkrauti savanorystės istorijos:", error);
      volunteerVisits = [];
      renderVolunteerHistory();
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

      showProfileNotification("Profilio informacija atnaujinta", "success");

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

      closePasswordModal();

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

  function openPasswordModal() {
    const passwordSection = getEl("passwordSection");
    if (!passwordSection) return;

    passwordSection.hidden = false;
    getEl("newPassword")?.focus();
  }

  function closePasswordModal() {
    const passwordSection = getEl("passwordSection");
    if (!passwordSection) return;

    passwordSection.hidden = true;
    getEl("passwordForm")?.reset();
    togglePasswordVisibility(false);
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

    // I sita puslapi dabar leidziam ir volunteer ir shelter rolei
    // nes shelter naudotojas cia keicia prisijungimo duomenis
    if (authUser.role !== "volunteer" && authUser.role !== "shelter") {
      window.location.href = "/index.html";
      return;
    }

    getEl("toggleEditBtn")?.addEventListener("click", () => {
      if (!isEditing) {
        fillProfileForm(currentUser || {});
        setInlineEditMode(true);
        return;
      }

      fillProfileForm(currentUser || {});
      setInlineEditMode(false);
    });

    getEl("profileInlineForm")?.addEventListener("submit", handleProfileSave);
    getEl("passwordForm")?.addEventListener("submit", handlePasswordSave);

    getEl("togglePasswordBtn")?.addEventListener("click", openPasswordModal);
    getEl("closePasswordBtn")?.addEventListener("click", closePasswordModal);
    getEl("passwordSection")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        closePasswordModal();
      }
    });

    getEl("showPasswords")?.addEventListener("change", (event) => {
      togglePasswordVisibility(event.target.checked);
    });

    getEl("deleteAccountBtn")?.addEventListener("click", handleDeleteAccount);
    getEl("volunteerHistorySearch")?.addEventListener("input", renderVolunteerHistory);
    getEl("volunteerHistorySort")?.addEventListener("change", renderVolunteerHistory);

    await loadProfile();
    await loadVolunteerHistory(authUser);
    setInlineEditMode(false);

    const shouldOpenEdit =
      new URLSearchParams(window.location.search).get("edit") === "1";

    if (shouldOpenEdit) {
      setInlineEditMode(true);
    }
  }

  document.addEventListener("DOMContentLoaded", initVolunteerProfilePage);
})();
