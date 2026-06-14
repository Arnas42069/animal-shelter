(function () {
  let visits = [];
  let fosters = [];
  let animalsById = new Map();
  let activeVisitFilter = "active";
  let activeFosterFilter = "pending";
  let visitSearchQuery = "";
  let visitSortOrder = "date_desc";

  const {
    getEl,
    apiRequest,
    authFetchCurrentUser,
    setMessage
  } = window.AppCommon;

  const visitStatusLabels = {
    pending: "Laukia",
    scheduled: "Patvirtinta",
    cancelled: "Atšaukta",
    completed: "Užbaigta",
    no_show: "Neatvyko"
  };

  const fosterStatusLabels = {
    pending: "Laukia",
    approved: "Patvirtinta",
    active: "Aktyvi",
    rejected: "Atmesta",
    completed: "Užbaigta",
    cancelled: "Atšaukta"
  };

  function formatError(error, fallback = "Nepavyko atlikti veiksmo") {
    const detail = error?.result?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => item?.msg || item?.message || JSON.stringify(item))
        .join("; ");
    }

    if (detail && typeof detail === "object") {
      return detail.msg || detail.message || fallback;
    }

    if (typeof error?.message === "string" && error.message !== "[object Object]") {
      return error.message;
    }

    return fallback;
  }

  function showMessage(text, type = "") {
    setMessage(getEl("volunteersAdminMessage"), text, type, "volunteers-admin-message");
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

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("lt-LT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getVisitName(visit) {
    const volunteer = visit.volunteer || {};
    const fullName = [volunteer.name, volunteer.surname].filter(Boolean).join(" ");
    return fullName || volunteer.username || "Savanoris";
  }

  function getVisitStatusGroup(visit) {
    if (visit.status === "pending") return "pending";
    if (visit.status === "scheduled") return "active";
    return "archive";
  }

  function getFosterStatusGroup(foster) {
    if (foster.status === "pending") return "pending";
    if (foster.status === "approved" || foster.status === "active") return "active";
    return "archive";
  }

  function updateSummary() {
    const activeVisits = visits.filter((visit) => visit.status === "scheduled").length;
    const activeFosters = fosters.filter((foster) =>
      foster.status === "approved" || foster.status === "active"
    ).length;

    getEl("pendingVisitsCount").textContent = String(
      visits.filter((visit) => visit.status === "pending").length
    );
    getEl("activeVisitsCount").textContent = String(
      activeVisits + activeFosters
    );
    getEl("pendingFostersCount").textContent = String(
      fosters.filter((foster) => foster.status === "pending").length
    );
  }

  function setActiveTab(selector, activeValue, attribute) {
    document.querySelectorAll(selector).forEach((button) => {
      button.classList.toggle("active", button.dataset[attribute] === activeValue);
    });
  }

  function renderMeta(items) {
    return `
      <dl class="management-meta">
        ${items.map(([label, value]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || "-")}</dd>
          </div>
        `).join("")}
      </dl>
    `;
  }

  function renderVisitActions(visit) {
    if (visit.status === "pending") {
      return `
        <button type="button" class="admin-action-btn compact" data-visit-action="approve" data-id="${visit.id}">
          Patvirtinti
        </button>
        <button type="button" class="admin-action-btn compact danger" data-visit-action="cancel" data-id="${visit.id}">
          Atšaukti
        </button>
      `;
    }

    if (visit.status === "scheduled") {
      if (visit.wants_social_hours === false) {
        return `
          <button type="button" class="admin-action-btn secondary" data-visit-action="complete" data-id="${visit.id}">
            Užbaigti
          </button>
        `;
      }

      return `
        <div class="visit-action-stack">
          <div class="visit-action-line">
            <div class="social-hours-row">
              <input type="number" min="0.25" max="24" step="0.25" value="1" aria-label="Socialinės valandos" data-social-input="${visit.id}" />
              <button type="button" class="admin-action-btn" data-visit-action="add-hours" data-id="${visit.id}">
                +
              </button>
            </div>
            <button type="button" class="admin-action-btn secondary" data-visit-action="complete" data-id="${visit.id}">
              Užbaigti
            </button>
          </div>
          <div class="visit-social-hours-total">
            <span>Socialinės valandos</span>
            <strong>${escapeHtml(`${Number(visit.social_hrs || 0)} val.`)}</strong>
          </div>
        </div>
      `;
    }

    return `
      <button type="button" class="admin-action-btn danger" data-visit-action="delete" data-id="${visit.id}">
        Ištrinti iš archyvo
      </button>
    `;
  }

  function getFilteredVisits() {
    const query = visitSearchQuery.trim().toLowerCase();

    return visits
      .filter((visit) => getVisitStatusGroup(visit) === activeVisitFilter)
      .filter((visit) => {
        if (!query) return true;

        const volunteer = visit.volunteer || {};
        const searchable = [
          volunteer.name,
          volunteer.surname,
          volunteer.username,
          volunteer.email
        ].filter(Boolean).join(" ").toLowerCase();

        return searchable.includes(query);
      })
      .sort((a, b) => {
        if (visitSortOrder === "name_asc" || visitSortOrder === "name_desc") {
          const result = getVisitName(a).localeCompare(getVisitName(b), "lt", {
            sensitivity: "base"
          });

          return visitSortOrder === "name_desc" ? -result : result;
        }

        const dateA = new Date(a.start_at).getTime() || 0;
        const dateB = new Date(b.start_at).getTime() || 0;

        return visitSortOrder === "date_asc"
          ? dateA - dateB
          : dateB - dateA;
      });
  }

  function renderVisits() {
    const list = getEl("visitsList");
    if (!list) return;

    const filtered = getFilteredVisits();

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">Pagal pasirinktus filtrus savanorių nėra.</div>`;
      return;
    }

    list.innerHTML = filtered.map((visit) => {
      const isGroup = Boolean(visit.is_group);
      const groupText = isGroup
        ? `Grupė (${visit.group_size || 2} žmonės)`
        : "";
      return `
        <article class="management-card">
          <div class="management-card-main">
            <details class="visit-details">
              <summary class="visit-summary-row">
                <span class="visit-summary-name">
                  ${escapeHtml(getVisitName(visit))}
                  <span class="status-pill ${escapeHtml(visit.status)}">${escapeHtml(visitStatusLabels[visit.status] || visit.status)}</span>
                </span>
                <span class="visit-summary-date">${escapeHtml(formatDateTime(visit.start_at))}</span>
                <span class="visit-summary-group">${escapeHtml(groupText)}</span>
              </summary>

              <div class="visit-details-body">
                <dl class="visit-detail-grid">
                  <div>
                    <dt>El. paštas</dt>
                    <dd>${escapeHtml(visit.volunteer?.email || "-")}</dd>
                  </div>
                  <div>
                    <dt>Pabaiga</dt>
                    <dd>${escapeHtml(formatDateTime(visit.end_at))}</dd>
                  </div>
                  <div>
                    <dt>Jaunesnis nei 16</dt>
                    <dd>${escapeHtml(visit.is_under_16 ? "Taip" : "Ne")}</dd>
                  </div>
                  <div aria-hidden="true"></div>
                </dl>
                ${visit.note ? `<p class="management-note">${escapeHtml(visit.note)}</p>` : ""}
              </div>
            </details>
          </div>

          <div class="management-card-actions">
            ${renderVisitActions(visit)}
          </div>
        </article>
      `;
    }).join("");
  }

  function getFosterName(foster) {
    return [foster.name, foster.surname].filter(Boolean).join(" ") || "Globėjas";
  }

  function getAnimalTitle(animalId) {
    const animal = animalsById.get(Number(animalId));
    if (!animal) return `Gyvūnas #${animalId}`;

    const name = animal.name || "Be vardo";
    const code = animal.code ? ` (${animal.code})` : "";
    return `${name}${code}`;
  }

  function renderFosterActions(foster) {
    if (foster.status === "pending") {
      return `
        <button type="button" class="admin-action-btn" data-foster-action="approve" data-id="${foster.id}">
          Patvirtinti
        </button>
        <button type="button" class="admin-action-btn danger" data-foster-action="reject" data-id="${foster.id}">
          Atšaukti
        </button>
      `;
    }

    if (foster.status === "approved") {
      return `
        <button type="button" class="admin-action-btn" data-foster-action="activate" data-id="${foster.id}">
          Pradėti globą
        </button>
        <button type="button" class="admin-action-btn danger" data-foster-action="cancel" data-id="${foster.id}">
          Atšaukti
        </button>
        <button type="button" class="admin-action-btn secondary" data-foster-action="delete" data-id="${foster.id}">
          Ištrinti
        </button>
      `;
    }

    if (foster.status === "active") {
      return `
        <button type="button" class="admin-action-btn" data-foster-action="complete" data-id="${foster.id}">
          Užbaigti
        </button>
        <button type="button" class="admin-action-btn danger" data-foster-action="cancel" data-id="${foster.id}">
          Atšaukti
        </button>
        <button type="button" class="admin-action-btn secondary" data-foster-action="delete" data-id="${foster.id}">
          Ištrinti
        </button>
      `;
    }

    return `
      <button type="button" class="admin-action-btn danger" data-foster-action="delete" data-id="${foster.id}">
        Ištrinti
      </button>
    `;
  }

  function renderFosters() {
    const list = getEl("fostersList");
    if (!list) return;

    const filtered = fosters.filter((foster) => getFosterStatusGroup(foster) === activeFosterFilter);

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">Šioje globos skiltyje prašymų nėra.</div>`;
      return;
    }

    list.innerHTML = filtered.map((foster) => `
      <article class="management-card">
        <div class="management-card-main">
          <div class="management-card-title">
            <h3>${escapeHtml(getFosterName(foster))}</h3>
            <span class="status-pill ${escapeHtml(foster.status)}">${escapeHtml(fosterStatusLabels[foster.status] || foster.status)}</span>
          </div>

          ${renderMeta([
            ["Gyvūnas", getAnimalTitle(foster.animal_id)],
            ["El. paštas", foster.email],
            ["Telefonas", foster.phone],
            ["Nuo", formatDate(foster.start_date)],
            ["Iki", formatDate(foster.end_date)],
            ["Prašymo ID", foster.id]
          ])}

          ${foster.note ? `<p class="management-note">${escapeHtml(foster.note)}</p>` : ""}
          ${foster.admin_note ? `<p class="management-note">${escapeHtml(foster.admin_note)}</p>` : ""}
        </div>

        <div class="management-card-actions">
          ${renderFosterActions(foster)}
        </div>
      </article>
    `).join("");
  }

  function renderAll() {
    updateSummary();
    setActiveTab("[data-visit-filter]", activeVisitFilter, "visitFilter");
    setActiveTab("[data-foster-filter]", activeFosterFilter, "fosterFilter");
    renderVisits();
    renderFosters();
  }

  async function updateVisitStatus(id, status, successMessage) {
    await apiRequest(`/api/visit/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });

    showMessage(successMessage, "success");
    await loadData();
  }

  async function addSocialHours(id) {
    const input = document.querySelector(`[data-social-input="${id}"]`);
    const hours = Number(input?.value || 0);

    if (!hours || hours <= 0) {
      showMessage("Įveskite socialinių valandų skaičių", "error");
      return;
    }

    await apiRequest(`/api/visit/${id}/social-hours/add`, {
      method: "PATCH",
      body: JSON.stringify({ hours })
    });

    showMessage("Socialinės valandos pridėtos", "success");
    await loadData();
  }

  async function deleteVisit(id) {
    if (!window.confirm("Ar tikrai norite pašalinti šią savanorystės registraciją?")) {
      return;
    }

    await apiRequest(`/api/visit/${id}`, {
      method: "DELETE"
    });

    showMessage("Savanorystės registracija pašalinta", "success");
    await loadData();
  }

  async function updateFosterStatus(id, status, successMessage) {
    await apiRequest(`/api/foster/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });

    showMessage(successMessage, "success");
    await loadData();
  }

  async function deleteFoster(id) {
    if (!window.confirm("Ar tikrai norite ištrinti šį globos prašymą?")) {
      return;
    }

    await apiRequest(`/api/foster/${id}`, {
      method: "DELETE"
    });

    showMessage("Globos prašymas ištrintas", "success");
    await loadData();
  }

  async function handleVisitAction(event) {
    const button = event.target.closest("[data-visit-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.visitAction;

    try {
      button.disabled = true;

      if (action === "approve") {
        await updateVisitStatus(id, "scheduled", "Savanorystės registracija patvirtinta");
      } else if (action === "cancel") {
        await updateVisitStatus(id, "cancelled", "Savanorystės registracija atšaukta");
      } else if (action === "complete") {
        await updateVisitStatus(id, "completed", "Savanorystė užbaigta");
      } else if (action === "add-hours") {
        await addSocialHours(id);
      } else if (action === "delete") {
        await deleteVisit(id);
      }
    } catch (error) {
      console.error("Nepavyko atlikti savanorystės veiksmo:", error);
      showMessage(formatError(error), "error");
    } finally {
      button.disabled = false;
    }
  }

  async function handleFosterAction(event) {
    const button = event.target.closest("[data-foster-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.fosterAction;

    try {
      button.disabled = true;

      if (action === "approve") {
        await updateFosterStatus(id, "approved", "Globos prašymas patvirtintas");
      } else if (action === "activate") {
        await updateFosterStatus(id, "active", "Globa pažymėta kaip aktyvi");
      } else if (action === "reject") {
        await updateFosterStatus(id, "rejected", "Globos prašymas atmestas");
      } else if (action === "cancel") {
        await updateFosterStatus(id, "cancelled", "Globos prašymas atšauktas");
      } else if (action === "complete") {
        await updateFosterStatus(id, "completed", "Globa užbaigta");
      } else if (action === "delete") {
        await deleteFoster(id);
      }
    } catch (error) {
      console.error("Nepavyko atlikti globos veiksmo:", error);
      showMessage(formatError(error), "error");
    } finally {
      button.disabled = false;
    }
  }

  async function loadData() {
    const [visitsResult, fostersResult] = await Promise.all([
      apiRequest("/api/visit/shelter", { method: "GET" }),
      apiRequest("/api/foster", { method: "GET" })
    ]);

    visits = Array.isArray(visitsResult) ? visitsResult : [];
    fosters = Array.isArray(fostersResult) ? fostersResult : [];

    try {
      const animalsResult = await apiRequest("/api/animal/me?page_size=50", {
        method: "GET"
      });
      const animals = Array.isArray(animalsResult) ? animalsResult : [];
      animalsById = new Map(animals.map((animal) => [Number(animal.id), animal]));
    } catch (error) {
      console.warn("Nepavyko užkrauti gyvūnų pavadinimų globos prašymams:", error);
      animalsById = new Map();
    }

    renderAll();
  }

  function bindEvents() {
    document.querySelectorAll("[data-visit-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeVisitFilter = button.dataset.visitFilter;
        renderAll();
      });
    });

    document.querySelectorAll("[data-foster-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFosterFilter = button.dataset.fosterFilter;
        renderAll();
      });
    });

    getEl("visitsList")?.addEventListener("click", handleVisitAction);
    getEl("fostersList")?.addEventListener("click", handleFosterAction);

    getEl("visitSearchInput")?.addEventListener("input", (event) => {
      visitSearchQuery = event.target.value || "";
      renderVisits();
    });

    getEl("visitSortSelect")?.addEventListener("change", (event) => {
      visitSortOrder = event.target.value || "date_desc";
      renderVisits();
    });
  }

  async function init() {
    const root = getEl("shelterVolunteersPage");
    if (!root) return;

    const user = await authFetchCurrentUser();

    if (!user || user.role !== "shelter") {
      window.location.href = "/index.html";
      return;
    }

    bindEvents();

    try {
      await loadData();
    } catch (error) {
      console.error("Nepavyko užkrauti prieglaudos savanorių:", error);
      showMessage(formatError(error, "Nepavyko užkrauti duomenų"), "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
