const volunteerForm = document.getElementById("volunteerForm");
const shelterForm = document.getElementById("shelterForm");

const volunteerBtn = document.getElementById("volunteerBtn");
const shelterBtn = document.getElementById("shelterBtn");

const messageEl = document.getElementById("message");


//  FORM SWITCH
volunteerBtn.addEventListener("click", () => {
  volunteerForm.style.display = "block";
  shelterForm.style.display = "none";
});

shelterBtn.addEventListener("click", () => {
  volunteerForm.style.display = "none";
  shelterForm.style.display = "block";
});


//  VOLUNTEER REGISTER
volunteerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  messageEl.textContent = "";

  const data = {
    name: document.getElementById("v_name").value.trim(),
    surname: document.getElementById("v_surname").value.trim(),
    username: document.getElementById("v_username").value.trim(),
    email: document.getElementById("v_email").value.trim(),
    password: document.getElementById("v_password").value
  };

  try {
    const res = await fetch("/api/auth/register/volunteer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json().catch(() => null);

    if (res.ok) {
      messageEl.textContent = "Registracija sėkminga.";
      messageEl.style.color = "green";

      setTimeout(() => {
        window.location.href = "/pages/prisijungimas.html";
      }, 1000);
    } else {
      messageEl.textContent = result?.detail || "Klaida.";
      messageEl.style.color = "red";
    }

  } catch (err) {
    messageEl.textContent = "Serverio klaida.";
    messageEl.style.color = "red";
  }
});


//  SHELTER REGISTER
shelterForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  messageEl.textContent = "";

  const data = {
    name: document.getElementById("s_name").value.trim(),
    phone: document.getElementById("s_phone").value.trim(),
    address: document.getElementById("s_address").value.trim(),
    city: document.getElementById("s_city").value.trim(),
    email: document.getElementById("s_email").value.trim(),
    password: document.getElementById("s_password").value
  };

  try {
    const res = await fetch("/api/auth/register/shelter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json().catch(() => null);

    if (res.ok) {
      messageEl.textContent = "Prieglauda užregistruota.";
      messageEl.style.color = "green";

      setTimeout(() => {
        window.location.href = "/pages/prisijungimas.html";
      }, 1000);
    } else {
      messageEl.textContent = result?.detail || "Klaida.";
      messageEl.style.color = "red";
    }

  } catch (err) {
    messageEl.textContent = "Serverio klaida.";
    messageEl.style.color = "red";
  }
});