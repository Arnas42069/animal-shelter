document.addEventListener("DOMContentLoaded", () => {

    const toast = document.getElementById("admin-toast");

    // ======================
    // TOAST
    // ======================
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 2000);
    }

    // ======================
    // DELETE USER (double confirm)
    // ======================
    document.querySelectorAll(".delete-user-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {

            const confirm1 = confirm("Ar tikrai nori ištrinti vartotoją?");
            if (!confirm1) return;

            const confirm2 = confirm("Paskutinis patvirtinimas! Ištrinti?");
            if (!confirm2) return;

            const row = e.target.closest("tr");
            row.remove();

            showToast("Vartotojas ištrintas");
        });
    });

    // ======================
    // ROLE CHANGE (NEW LOGIC)
    // ======================
    document.querySelectorAll(".save-role-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {

            const row = e.target.closest("tr");
            const select = row.querySelector(".role-select");

            const newRole = select.value;

            const confirmChange = confirm(`Ar tikrai pakeisti rolę į "${newRole}"?`);
            if (!confirmChange) return;

            showToast(`Rolė pakeista į ${newRole}`);

            // TODO backend call:
            // fetch('/api/users/role', { method: 'POST', body: JSON.stringify(...) })
        });
    });

    // ======================
    // SHELTER APPROVAL
    // ======================
    document.querySelectorAll(".approve-shelter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const row = e.target.closest("tr");
            row.remove();
            showToast("Prieglauda patvirtinta");
        });
    });

    document.querySelectorAll(".reject-shelter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const row = e.target.closest("tr");
            row.remove();
            showToast("Prieglauda atmesta");
        });
    });

    // ======================
    // SEARCH
    // ======================
    document.getElementById("userSearch").addEventListener("input", (e) => {
        const value = e.target.value.toLowerCase();

        document.querySelectorAll("#usersTable tbody tr").forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(value) ? "" : "none";
        });
    });

});