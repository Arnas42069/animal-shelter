(function () {

    let users = [];

    const API = "/api/admin/users";

    function getEl(id) {
        return document.getElementById(id);
    }

    function notify(text, type = "success") {
        if (window.AppCommon?.showNotification) {
            window.AppCommon.showNotification(text, type);
            return;
        }

        console[type === "error" ? "error" : "log"](text);
    }

    async function apiRequest(url, options = {}) {
    const token = authGetToken();

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
    });

    const text = await response.text(); // 👈 SVARBIAUSIAS FIX

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("NOT JSON RESPONSE:", text);
        data = null;
    }

    if (!response.ok) {
        throw new Error(data?.detail || text || "Request failed");
    }

    return data;
}

    // ------------------------
    // LOAD USERS
    // ------------------------
    async function loadUsers() {
        try {
            users = await apiRequest(API, { method: "GET" });
            render(users);
        } catch (error) {
            console.error(error);

            if (error.status === 401 || error.status === 403) {
                notify("Neturi admin teisių arba neprisijungęs", "error");
                return;
            }

            notify("Nepavyko gauti duomenų", "error");
        }
    }

    // ------------------------
    // RENDER TABLE
    // ------------------------
    function render(data) {

        if (!Array.isArray(data)) {
            console.error("Backend returned:", data);
            return;
        }

        const tbody = getEl("usersTableBody");

        tbody.innerHTML = data.map(u => `
            <tr data-id="${u.id}">
                <td>${u.id}</td>
                <td>${u.name || ""} ${u.surname || ""}</td>
                <td>${u.username}</td>
                <td>${u.email}</td>

                <td>
                    <select class="role-select search-box">
                        <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
                        <option value="shelter" ${u.role === "shelter" ? "selected" : ""}>shelter</option>
                        <option value="volunteer" ${u.role === "volunteer" ? "selected" : ""}>volunteer</option>
                    </select>
                </td>

                <td>${u.is_active ? "Aktyvus" : "Neaktyvus"}</td>

                <td>
                    <button class="save-role-btn">Saugoti</button>
                    <button class="toggle-active-btn">
                        ${u.is_active ? "Deaktyvuoti" : "Aktyvuoti"}
                    </button>
                </td>
            </tr>
        `).join("");
    }

    // ------------------------
    // EVENTS
    // ------------------------
    function initEvents() {

        const table = getEl("usersTableBody");

        table?.addEventListener("click", async (e) => {

            const row = e.target.closest("tr");
            if (!row) return;

            const id = row.dataset.id;

            // ROLE UPDATE
            if (e.target.classList.contains("save-role-btn")) {

                const role = row.querySelector(".role-select").value;

                try {
                    await apiRequest(`/api/admin/users/${id}/role`, {
                        method: "PATCH",
                        body: JSON.stringify({ role: role })
                    });

                    notify("Rolė pakeista", "success");
                    loadUsers();

                } catch (err) {
                    notify("Klaida keičiant rolę", "error");
                }
            }

            // ACTIVE TOGGLE
            if (e.target.classList.contains("toggle-active-btn")) {

                const current = row.children[5].textContent.includes("aktyvus");

                try {
                    await apiRequest(`/api/admin/users/${id}/active`, {
                        method: "PATCH",
                        body: JSON.stringify({
                            is_active: !current
                        })
                    });

                    notify("Statusas pakeistas", "success");
                    loadUsers();

                } catch (err) {
                    notify("Klaida keičiant statusą", "error");
                }
            }
        });

    // ------------------------
    // FILTER LOGIC (SEARCH + ROLE)
    // ------------------------
    function applyFilters() {

        const searchVal = getEl("userSearch")?.value.toLowerCase() || "";
        const roleVal = getEl("roleFilter")?.value || "all";

        const filtered = users.filter(u => {

            const matchesSearch =
                (u.name || "").toLowerCase().includes(searchVal) ||
                (u.surname || "").toLowerCase().includes(searchVal);

            const matchesRole =
                roleVal === "all" || u.role === roleVal;

            return matchesSearch && matchesRole;
        });

        render(filtered);
    }

    // ------------------------
    // EVENTS FOR FILTERS
    // ------------------------
    getEl("userSearch")?.addEventListener("input", applyFilters);
    getEl("roleFilter")?.addEventListener("change", applyFilters);
}
    // ------------------------
    // INIT PAGE
    // ------------------------
    async function initAdminUsersPage() {

        const root = getEl("usersTableBody");
        if (!root) return;

        const authUser = await authFetchCurrentUser();

        if (!authUser || authUser.role !== "admin") {
            window.location.href = "/index.html";
            return;
        }

        initEvents();
        await loadUsers();
    }

    document.addEventListener("DOMContentLoaded", initAdminUsersPage);

})();
