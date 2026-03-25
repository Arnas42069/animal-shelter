function renderAuthModals() {
  const root = document.getElementById("auth-modals-root");

  if (!root) {
    return;
  }

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

        <form id="volunteerForm">
          <input type="text" id="v_name" placeholder="vardas" required />
          <input type="text" id="v_surname" placeholder="pavardė" required />
          <input type="text" id="v_username" placeholder="slapyvardis" required />
          <input type="email" id="v_email" placeholder="el. paštas" required />
          <input type="password" id="v_password" placeholder="slaptažodis" required />

          <button type="submit" class="auth-btn auth-submit-btn">Registruotis</button>
        </form>

        <p id="registerMessage" class="auth-message"></p>

        <div class="auth-switch-row">
          <span>Jau turite paskyrą?</span>
          <button type="button" class="auth-link-btn" id="switchToLogin">Prisijungti</button>
        </div>
      </div>
    </div>

    <div id="shelterRegistrationModal" class="auth-modal-overlay">
      <div class="auth-modal-box">
        <button type="button" class="auth-modal-close" data-close-modal="shelterRegistrationModal">&times;</button>
        <h2>PRIEGLAUDOS REGISTRACIJA</h2>

        <form id="shelterForm">
          <input type="text" id="s_name" placeholder="prieglaudos pavadinimas" required />
          <input type="text" id="s_phone" placeholder="telefonas" required />
          <input type="text" id="s_address" placeholder="adresas" required />
          <input type="text" id="s_city" placeholder="miestas" required />

          <button type="submit" class="auth-btn auth-submit-btn">Registruoti prieglaudą</button>
        </form>

        <p id="shelterRegisterMessage" class="auth-message"></p>
      </div>
    </div>
  `;

  bindAuthModalEvents();
}

function openAuthModal(modalId) {
  const modal = document.getElementById(modalId);

  if (!modal) {
    return;
  }

  modal.classList.add("active");
}

function closeAuthModal(modalId) {
  const modal = document.getElementById(modalId);

  if (!modal) {
    return;
  }

  modal.classList.remove("active");
}

function closeAllAuthModals() {
  document.querySelectorAll(".auth-modal-overlay").forEach((modal) => {
    modal.classList.remove("active");
  });
}

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

  const switchToRegister = document.getElementById("switchToRegister");
  const switchToLogin = document.getElementById("switchToLogin");

  if (switchToRegister) {
    switchToRegister.addEventListener("click", () => {
      closeAuthModal("loginModal");
      openAuthModal("registerModal");
    });
  }

  if (switchToLogin) {
    switchToLogin.addEventListener("click", () => {
      closeAuthModal("registerModal");
      openAuthModal("loginModal");
    });
  }

  bindLoginSubmit();
  bindVolunteerRegisterSubmit();
  bindShelterRegisterSubmit();
}

function bindLoginSubmit() {
  const loginForm = document.getElementById("loginForm");
  const messageEl = document.getElementById("loginMessage");

  if (!loginForm || !messageEl) {
    return;
  }

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

function bindVolunteerRegisterSubmit() {
  const volunteerForm = document.getElementById("volunteerForm");
  const messageEl = document.getElementById("registerMessage");

  if (!volunteerForm || !messageEl) {
    return;
  }

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
      const response = await fetch("/api/auth/register", {
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

function bindShelterRegisterSubmit() {
  const shelterForm = document.getElementById("shelterForm");
  const messageEl = document.getElementById("shelterRegisterMessage");

  if (!shelterForm || !messageEl) {
    return;
  }

  shelterForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    messageEl.textContent = "";
    messageEl.style.color = "";

    const token = authGetToken();

    if (!token) {
      messageEl.textContent = "Pirmiausia turite prisijungti.";
      messageEl.style.color = "red";
      return;
    }

    const data = {
      name: document.getElementById("s_name").value.trim(),
      phone: document.getElementById("s_phone").value.trim(),
      address: document.getElementById("s_address").value.trim(),
      city: document.getElementById("s_city").value.trim()
    };

    try {
      const response = await fetch("/api/shelter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        if (Array.isArray(result?.detail)) {
          messageEl.textContent = result.detail.map((err) => err.msg).join(", ");
        } else {
          messageEl.textContent = result?.detail || `Prieglaudos registracija nepavyko (${response.status}).`;
        }

        messageEl.style.color = "red";
        return;
      }

      messageEl.textContent = "Prieglauda sėkmingai užregistruota.";
      messageEl.style.color = "green";

      setTimeout(() => {
        closeAuthModal("shelterRegistrationModal");
        window.dispatchEvent(new CustomEvent("auth-changed"));
        window.location.reload();
      }, 700);
    } catch (error) {
      messageEl.textContent = "Nepavyko prisijungti prie serverio.";
      messageEl.style.color = "red";
      console.error(error);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderAuthModals();
});