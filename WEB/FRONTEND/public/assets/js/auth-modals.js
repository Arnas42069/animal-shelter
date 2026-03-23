/* Sugeneruoja login ir registracijos modalus */
function renderAuthModals() {
  const root = document.getElementById("auth-modals-root");

  if (!root) {
    return;
  }
//Popuppu HTML kodas
  root.innerHTML = `
    <div id="loginModal" class="auth-modal-overlay">
      <div class="auth-modal-box">
        <button type="button" class="auth-modal-close" data-close-modal="loginModal">&times;</button>
        <h2>PRISIJUNGIMAS</h2>

        <form id="loginForm">
          <input type="email" id="login_email" placeholder="el. paštas" required />
          <input type="password" id="login_password" placeholder="slaptažodis" required />

          <button type="submit" class="auth-btn auth-submit-btn">Prisijungti</button>
        </form>

        <p id="loginMessage" class="auth-message"></p>

        <div class="auth-switch-row">
          <span>Neturite paskyros?</span>
          <button type="button" class="auth-link-btn" id="switchToRegister">Registruotis</button>
        </div>
      </div>
    </div>

    <div id="registerModal" class="auth-modal-overlay">
      <div class="auth-modal-box">
        <button type="button" class="auth-modal-close" data-close-modal="registerModal">&times;</button>
        <h2>REGISTRACIJA</h2>

        <div class="auth-type-switch">
          <button type="button" class="auth-btn" id="volunteerBtn">Savanoris</button>
          <button type="button" class="auth-btn" id="shelterBtn">Prieglauda</button>
        </div>

        <form id="volunteerForm">
          <input type="text" id="v_name" placeholder="vardas" required />
          <input type="text" id="v_surname" placeholder="pavardė" required />
          <input type="text" id="v_username" placeholder="slapyvardis" required />
          <input type="email" id="v_email" placeholder="el. paštas" required />
          <input type="password" id="v_password" placeholder="slaptažodis" required />

          <button type="submit" class="auth-btn auth-submit-btn">Registruotis</button>
        </form>

        <form id="shelterForm" style="display: none;">
          <input type="text" id="s_name" placeholder="prieglaudos pavadinimas" required />
          <input type="text" id="s_phone" placeholder="telefonas" required />
          <input type="text" id="s_address" placeholder="adresas" required />
          <input type="text" id="s_city" placeholder="miestas" required />
          <input type="email" id="s_email" placeholder="el. paštas" required />
          <input type="password" id="s_password" placeholder="slaptažodis" required />

          <button type="submit" class="auth-btn auth-submit-btn">Registruotis</button>
        </form>

        <p id="registerMessage" class="auth-message"></p>

        <div class="auth-switch-row">
          <span>Jau turite paskyrą?</span>
          <button type="button" class="auth-link-btn" id="switchToLogin">Prisijungti</button>
        </div>
      </div>
    </div>
  `;

  bindAuthModalEvents();
}

/* Atidaro pasirinkta modala */
function openAuthModal(modalId) {
  const modal = document.getElementById(modalId);

  if (!modal) {
    return;
  }

  modal.classList.add("active");
}

/* Uzdaro pasirinkta modala */
function closeAuthModal(modalId) {
  const modal = document.getElementById(modalId);

  if (!modal) {
    return;
  }

  modal.classList.remove("active");
}

/* Uzdaro visus auth modalus */
function closeAllAuthModals() {
  document.querySelectorAll(".auth-modal-overlay").forEach((modal) => {
    modal.classList.remove("active");
  });
}

/* Parodo savanorio registracijos forma */
function showVolunteerForm() {
  document.getElementById("volunteerForm").style.display = "block";
  document.getElementById("shelterForm").style.display = "none";
  document.getElementById("registerMessage").textContent = "";
}

/* Parodo prieglaudos registracijos forma */
function showShelterForm() {
  document.getElementById("volunteerForm").style.display = "none";
  document.getElementById("shelterForm").style.display = "block";
  document.getElementById("registerMessage").textContent = "";
}

/* Surisa modalu mygtukus ir submit logika */
function bindAuthModalEvents() {
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      closeAuthModal(button.dataset.closeModal);
    });
  });

  document.querySelectorAll(".auth-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });

  document.getElementById("switchToRegister").addEventListener("click", () => {
    closeAuthModal("loginModal");
    openAuthModal("registerModal");
  });

  document.getElementById("switchToLogin").addEventListener("click", () => {
    closeAuthModal("registerModal");
    openAuthModal("loginModal");
  });

  document.getElementById("volunteerBtn").addEventListener("click", showVolunteerForm);
  document.getElementById("shelterBtn").addEventListener("click", showShelterForm);

  showVolunteerForm();

  bindLoginSubmit();
  bindVolunteerRegisterSubmit();
  bindShelterRegisterSubmit();
}

/* Login formos submit */
function bindLoginSubmit() {
  const loginForm = document.getElementById("loginForm");
  const messageEl = document.getElementById("loginMessage");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    messageEl.textContent = "";
    messageEl.style.color = "";

    const data = {
      email: document.getElementById("login_email").value.trim(),
      password: document.getElementById("login_password").value
    };

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        messageEl.textContent = result?.detail || `Prisijungti nepavyko (${response.status}).`;
        messageEl.style.color = "red";
        return;
      }

      authStoreToken(result.access_token);

      messageEl.textContent = "Prisijungimas sėkmingas.";
      messageEl.style.color = "green";

      setTimeout(() => {
        closeAllAuthModals();
        window.dispatchEvent(new CustomEvent("auth-changed"));
        window.location.reload();
      }, 500);
    } catch (error) {
      messageEl.textContent = "Nepavyko prisijungti prie serverio.";
      messageEl.style.color = "red";
      console.error(error);
    }
  });
}

/* Volunteer registracijos submit */
function bindVolunteerRegisterSubmit() {
  const volunteerForm = document.getElementById("volunteerForm");
  const messageEl = document.getElementById("registerMessage");

  volunteerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    messageEl.textContent = "";
    messageEl.style.color = "";

    const data = {
      name: document.getElementById("v_name").value.trim(),
      surname: document.getElementById("v_surname").value.trim(),
      username: document.getElementById("v_username").value.trim(),
      email: document.getElementById("v_email").value.trim(),
      password: document.getElementById("v_password").value
    };

    try {
      const response = await fetch("/api/auth/register/volunteer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        if (Array.isArray(result?.detail)) {
          messageEl.textContent = result.detail.map((err) => err.msg).join(", ");
        } else {
          messageEl.textContent = result?.detail || `Registracija nepavyko (${response.status}).`;
        }

        messageEl.style.color = "red";
        return;
      }

      messageEl.textContent = "Registracija sėkminga. Dabar galite prisijungti.";
      messageEl.style.color = "green";

      setTimeout(() => {
        closeAuthModal("registerModal");
        openAuthModal("loginModal");
      }, 700);
    } catch (error) {
      messageEl.textContent = "Nepavyko prisijungti prie serverio.";
      messageEl.style.color = "red";
      console.error(error);
    }
  });
}

/* Shelter registracijos submit */
function bindShelterRegisterSubmit() {
  const shelterForm = document.getElementById("shelterForm");
  const messageEl = document.getElementById("registerMessage");

  shelterForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    messageEl.textContent = "";
    messageEl.style.color = "";

    const data = {
      name: document.getElementById("s_name").value.trim(),
      phone: document.getElementById("s_phone").value.trim(),
      address: document.getElementById("s_address").value.trim(),
      city: document.getElementById("s_city").value.trim(),
      email: document.getElementById("s_email").value.trim(),
      password: document.getElementById("s_password").value
    };

    try {
      const response = await fetch("/api/auth/register/shelter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        if (Array.isArray(result?.detail)) {
          messageEl.textContent = result.detail.map((err) => err.msg).join(", ");
        } else {
          messageEl.textContent = result?.detail || `Registracija nepavyko (${response.status}).`;
        }

        messageEl.style.color = "red";
        return;
      }

      messageEl.textContent = "Prieglauda užregistruota. Dabar galite prisijungti.";
      messageEl.style.color = "green";

      setTimeout(() => {
        closeAuthModal("registerModal");
        openAuthModal("loginModal");
      }, 700);
    } catch (error) {
      messageEl.textContent = "Nepavyko prisijungti prie serverio.";
      messageEl.style.color = "red";
      console.error(error);
    }
  });
}

/* Paleidzia modalu generavima po puslapio uzkrovimo */
document.addEventListener("DOMContentLoaded", () => {
  renderAuthModals();
});