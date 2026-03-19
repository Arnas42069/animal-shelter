const form = document.getElementById("registerForm");
const messageEl = document.getElementById("message");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  messageEl.textContent = "";
  messageEl.style.color = "";

  const data = {
    name: document.getElementById("name").value.trim(),
    surname: document.getElementById("surname").value.trim(),
    username: document.getElementById("username").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
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

    if (response.ok) {
      messageEl.textContent = "Registracija sėkminga.";
      messageEl.style.color = "green";

      setTimeout(() => {
        window.location.href = "/pages/prisijungimas.html";
      }, 1000);
    } else {
      messageEl.textContent = (result && result.detail)
        ? result.detail
        : "Registracija nepavyko.";
      messageEl.style.color = "red";
    }
  } catch (error) {
    messageEl.textContent = "Nepavyko prisijungti prie serverio.";
    messageEl.style.color = "red";
    console.error(error);
  }
});