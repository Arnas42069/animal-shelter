const AUTH_TOKEN_KEY = "access_token";

/* Issaugo prisijungimo token naršykleje */
function authStoreToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.dispatchEvent(new CustomEvent("auth-changed"));
}

/* Grazina issaugota token */
function authGetToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/* Pasalina token atsijungimo metu */
function authClearToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.dispatchEvent(new CustomEvent("auth-changed"));
}

/* Patikrina ar vartotojas prisijunges */
function authIsLoggedIn() {
  return Boolean(authGetToken());
}

/* Uzklausia backendo ir grazina prisijungusio vartotojo duomenis */
async function authFetchCurrentUser() {
  const token = authGetToken();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      authClearToken();
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

/* Atsijungia ir grazina i pagrindini puslapi */
function authLogout() {
  sessionStorage.setItem(
    "app_pending_notification",
    JSON.stringify({
      message: "Sėkmingai atsijungėte",
      type: "success"
    })
  );
  authClearToken();
  window.location.href = "/index.html";
}
