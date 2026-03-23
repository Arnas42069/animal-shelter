async function renderNavbar() {
  const navbarRoot = document.getElementById("site-navbar");

  if (!navbarRoot) {
    return;
  }

  const user = await authFetchCurrentUser();

  navbarRoot.innerHTML = buildNavbarMarkup(user);
  bindNavbarEvents(user);
  markActiveNavLink();
}

function buildNavbarMarkup(user) {
  const centerLinks = `
    <div class="nav-center">
      <div class="nav-links-group">
        <a href="/pages/savanoryste.html" class="nav-link">Savanorystė</a>
        <span class="nav-divider">|</span>
        <a href="/pages/aukojimas.html" class="nav-link">Parama</a>
        <span class="nav-divider">|</span>
        <a href="/pages/naujienos.html" class="nav-link">Naujienos</a>
      </div>
    </div>
  `;

  if (!user) {
    return `
      <nav class="site-navbar">
        <div class="nav-left">
          <a href="/index.html" class="nav-brand" title="Pradinis puslapis">
            <img src="/assets/svg/paw.svg" alt="Pėdutė" class="nav-brand-icon" />
            <span class="nav-brand-text">Nekliudom</span>
          </a>
        </div>

        ${centerLinks}

        <div class="nav-right">
          <button type="button" class="nav-auth-btn" id="openLoginBtn">Prisijungti</button>
          <button type="button" class="nav-auth-btn" id="openRegisterBtn">Registruotis</button>
          <a href="/pages/megstami-gyvunai.html" class="nav-svg-btn nav-heart-btn" title="Mylimi gyvūnai">
            <img src="/assets/svg/heart.svg" alt="Širdutė" class="nav-svg-icon" />
          </a>
        </div>
      </nav>
    `;
  }

  if (user.role === "admin") {
    return `
      <nav class="site-navbar">
        <div class="nav-left">
          <a href="/index.html" class="nav-brand" title="Pradinis puslapis">
            <img src="/assets/svg/paw.svg" alt="Pėdutė" class="nav-brand-icon" />
            <span class="nav-brand-text">Nekliudom</span>
          </a>
        </div>

        <div class="nav-center"></div>

        <div class="nav-right">
          ${buildProfileDropdown(user)}
          <a href="/pages/megstami-gyvunai.html" class="nav-svg-btn nav-heart-btn" title="Mylimi gyvūnai">
            <img src="/assets/svg/heart.svg" alt="Širdutė" class="nav-svg-icon" />
          </a>
        </div>
      </nav>
    `;
  }

  return `
    <nav class="site-navbar">
      <div class="nav-left">
        <a href="/index.html" class="nav-brand" title="Pradinis puslapis">
          <img src="/assets/svg/paw.svg" alt="Pėdutė" class="nav-brand-icon" />
          <span class="nav-brand-text">Nekliudom</span>
        </a>
      </div>

      ${centerLinks}

      <div class="nav-right">
        ${buildProfileDropdown(user)}
        <a href="/pages/megstami-gyvunai.html" class="nav-svg-btn nav-heart-btn" title="Mylimi gyvūnai">
          <img src="/assets/svg/heart.svg" alt="Širdutė" class="nav-svg-icon" />
        </a>
      </div>
    </nav>
  `;
}

function buildProfileDropdown(user) {
  const profilePage = user.role === "shelter"
    ? "/pages/prieglauda.html"
    : "/pages/profilis.html";

  const editProfilePage = user.role === "shelter"
    ? "/pages/prieglauda-edit.html"
    : "/pages/profilis-edit.html";

  let items = `
    <a href="${profilePage}" class="dropdown-item">Profilis</a>
    <a href="${editProfilePage}" class="dropdown-item">Redaguoti profilį</a>
  `;

  if (user.role === "volunteer" && !user.has_shelter) {
    items += `
      <button type="button" class="dropdown-item" id="openShelterRegistrationBtn">Prieglaudos registracija</button>
    `;
  }

  if (user.role === "shelter") {
    items += `
      <a href="/pages/savanoriai.html" class="dropdown-item">Savanoriai</a>
      <a href="/pages/naujienos.html" class="dropdown-item">Naujienos</a>
    `;
  }

  if (user.role === "admin") {
    items += `
      <a href="/pages/vartotojai.html" class="dropdown-item">Vartotojai</a>
    `;
  }

  items += `
    <button type="button" class="dropdown-item dropdown-logout" id="logoutBtn">Atsijungti</button>
  `;

  return `
    <div class="profile-dropdown">
      <button type="button" class="profile-trigger profile-svg-btn" id="profileTrigger" title="Profilis" aria-expanded="false">
        <img src="/assets/svg/profile-circle.svg" alt="Profilis" class="nav-svg-icon profile-trigger-icon" />
      </button>
      <div class="profile-menu" id="profileMenu">
        <div class="profile-menu-arrow"></div>
        ${items}
      </div>
    </div>
  `;
}

function bindNavbarEvents(user) {
  if (!user) {
    const loginBtn = document.getElementById("openLoginBtn");
    const registerBtn = document.getElementById("openRegisterBtn");

    if (loginBtn) {
      loginBtn.addEventListener("click", () => openAuthModal("loginModal"));
    }

    if (registerBtn) {
      registerBtn.addEventListener("click", () => openAuthModal("registerModal"));
    }

    return;
  }

  const profileTrigger = document.getElementById("profileTrigger");
  const profileMenu = document.getElementById("profileMenu");
  const logoutBtn = document.getElementById("logoutBtn");
  const openShelterRegistrationBtn = document.getElementById("openShelterRegistrationBtn");

  if (profileTrigger && profileMenu) {
    profileTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle("active");
      profileTrigger.setAttribute("aria-expanded", profileMenu.classList.contains("active") ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!profileMenu.contains(e.target) && !profileTrigger.contains(e.target)) {
        profileMenu.classList.remove("active");
        profileTrigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (openShelterRegistrationBtn) {
    openShelterRegistrationBtn.addEventListener("click", () => {
      profileMenu.classList.remove("active");
      profileTrigger.setAttribute("aria-expanded", "false");
      openAuthModal("shelterRegistrationModal");
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", authLogout);
  }
}

window.addEventListener("auth-changed", () => {
  renderNavbar();
});

document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();
});

function markActiveNavLink() {
  const currentPath = window.location.pathname;

  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");

    if (href && currentPath.endsWith(href.replace("/pages/", "/pages/"))) {
      link.classList.add("active");
    }
  });

  if (currentPath.endsWith("/index.html") || currentPath === "/") {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active");
    });
  }
}