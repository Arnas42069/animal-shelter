const loginForm = document.getElementById("loginForm");
const messageEl = document.getElementById("message");

/* Siuncia prisijungimo duomenis i backend */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  messageEl.textContent = "";
  messageEl.style.color = "";

  const data = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
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
      messageEl.textContent = result?.detail || "Prisijungti nepavyko.";
      messageEl.style.color = "red";
      return;
    }

    /* Issaugomas gautas access token */
    authStoreToken(result.access_token);

    /* Patikrinamas prisijunges vartotojas */
    const currentUser = await authFetchCurrentUser();

    if (!currentUser) {
      messageEl.textContent = "Nepavyko gauti vartotojo duomenų.";
      messageEl.style.color = "red";
      return;
    }

    messageEl.textContent = "Prisijungimas sėkmingas.";
    messageEl.style.color = "green";

    setTimeout(() => {
      window.location.href = "/index.html";
    }, 800);

  } catch (error) {
    messageEl.textContent = "Nepavyko prisijungti prie serverio.";
    messageEl.style.color = "red";
    console.error(error);
  }
});