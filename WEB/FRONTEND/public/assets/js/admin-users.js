document.addEventListener("DOMContentLoaded", () => {

    function notify(message, type = "success") {
        const containerId = "appNotifications";

        let container = document.getElementById(containerId);

        if (!container) {
            container = document.createElement("div");
            container.id = containerId;

            Object.assign(container.style, {
                position: "fixed",
                bottom: "20px",
                right: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                zIndex: "99999",
                maxWidth: "340px"
            });

            document.body.appendChild(container);
        }

        const el = document.createElement("div");
        el.textContent = message;

        const colors = {
            success: "#444",
            error: "#444",
            info: "#444",
            warning: "##444"
        };

        Object.assign(el.style, {
            minWidth: "150px",
            padding: "12px 22px",
            borderRadius: "999px",
            background: colors[type] || "#444",
            border: "2px solid #fff",
            color: "#fff",
            fontFamily: '"Source Sans 3", sans-serif',
            fontWeight: "700",
            fontSize: "18px",
            textAlign: "center",
            display: "inline-block",
            cursor: "default",
            boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
            opacity: "0",
            transform: "translateY(10px) scale(0.98)",
            transition: "transform 0.18s ease, opacity 0.25s ease"
        });

        container.appendChild(el);

        requestAnimationFrame(() => {
            el.style.opacity = "1";
            el.style.transform = "translateY(0) scale(1)";
        });

        setTimeout(() => {
            el.style.opacity = "0";
            el.style.transform = "translateY(10px) scale(0.98)";
            setTimeout(() => el.remove(), 250);
        }, 3000);
    }

    // DELETE USER
    document.querySelectorAll(".delete-user-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {

            if (!confirm("Ar tikrai nori ištrinti vartotoją?")) return;
            if (!confirm("Paskutinis patvirtinimas! Ištrinti?")) return;

            e.target.closest("tr").remove();

            notify("Vartotojas ištrintas", "success");
        });
    });

    // ROLE CHANGE
    document.querySelectorAll(".save-role-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {

            const row = e.target.closest("tr");
            const newRole = row.querySelector(".role-select").value;

            if (!confirm(`Ar tikrai pakeisti rolę į "${newRole}"?`)) return;

            notify(`Rolė pakeista į ${newRole}`, "info");
        });
    });

    // SHELTER APPROVAL
    document.querySelectorAll(".approve-shelter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.target.closest("tr").remove();
            notify("Prieglauda patvirtinta", "success");
        });
    });

    document.querySelectorAll(".reject-shelter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.target.closest("tr").remove();
            notify("Prieglauda atmesta", "error");
        });
    });

    // SEARCH
    document.getElementById("userSearch")?.addEventListener("input", (e) => {
        const value = e.target.value.toLowerCase();

        document.querySelectorAll("#usersTable tbody tr").forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(value)
                ? ""
                : "none";
        });
    });

});