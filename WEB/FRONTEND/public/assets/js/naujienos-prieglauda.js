(function () {
  const API_NEWS_URL = "/api/news";
  const DEFAULT_NEWS_IMAGE = "/assets/img/news-default.png";

  let allNews = [];
  let editingNewsId = null;

  function getToken() {
    return localStorage.getItem("access_token");
  }

  function authHeaders() {
    const token = getToken();

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toISOString().slice(0, 10);
  }

  function normalizeImageUrl(value) {
    return value || DEFAULT_NEWS_IMAGE;
  }

  function renderNewsList(newsList) {
    const container = getEl("newsListContent");

    if (!container) return;

    if (!Array.isArray(newsList) || newsList.length === 0) {
      container.innerHTML = `
        <div class="news-list-post">
          <div class="news-list-post-text">
            <h2 class="news-list-h2">Naujienų nėra</h2>
            <p>Kol kas jūsų prieglauda neturi sukurtų naujienų.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = newsList
      .map((news, index) => {
        const title = escapeHtml(news.title);
        const webUrl = escapeHtml(news.web_url || "#");
        const imageUrl = escapeHtml(normalizeImageUrl(news.image_url));
        const date = escapeHtml(formatDate(news.created_at));

        return `
          ${index > 0 ? "<hr>" : ""}

          <div class="news-list-post" data-news-id="${news.id}">
            <img src="${imageUrl}" alt="Naujienos paveikslėlis">

            <div class="news-list-post-text">
              <h2 class="news-list-h2">
                <a href="${webUrl}" target="_blank" rel="noopener noreferrer">
                  ${title}
                </a>
              </h2>

              <span class="news-list-date">${date}</span>

              <div class="news-actions">
                <button class="edit-btn" data-action="edit" data-id="${news.id}">
                  Redaguoti
                </button>

                <button class="delete-btn" data-action="delete" data-id="${news.id}">
                  Ištrinti
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function createModalIfMissing() {
    if (getEl("newsModal")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-shelter-news" id="newsModal" style="display: none;">
        <div class="modal-content-shelter-news">
          <span class="close-btn-shelter-news" id="closeNewsModalBtn">&times;</span>

          <h2 id="newsModalTitle">Sukurti naujieną</h2>

          <form id="newsForm">
            <input
              type="text"
              id="newsTitle"
              placeholder="Naujienos pavadinimas"
              required
            >

            <input
              type="url"
              id="newsWebUrl"
              placeholder="Straipsnio nuoroda"
              required
            >

            <input
              type="url"
              id="newsImageUrl"
              placeholder="Paveikslėlio URL"
            >

            <label>
              <input id="newsIsPublished" type="checkbox" checked>
              Publikuota
            </label>

            <p id="newsFormMessage"></p>

            <button
              type="submit"
              class="submit-news-shelter-news"
              id="saveNewsBtn"
            >
              Išsaugoti
            </button>
          </form>
        </div>
      </div>
    `);
  }

  function openModal(news = null) {
    createModalIfMissing();

    editingNewsId = news?.id ?? null;

    getEl("newsModalTitle").textContent = editingNewsId
      ? "Redaguoti naujieną"
      : "Sukurti naujieną";

    getEl("newsTitle").value = news?.title ?? "";
    getEl("newsWebUrl").value = news?.web_url ?? "";
    getEl("newsImageUrl").value = news?.image_url ?? "";
    getEl("newsIsPublished").checked = news?.is_published ?? true;
    getEl("newsFormMessage").textContent = "";

    getEl("newsModal").style.display = "block";
  }

  function closeModal() {
    const modal = getEl("newsModal");

    if (modal) {
      modal.style.display = "none";
    }

    editingNewsId = null;
  }

  async function loadNews() {
    const container = getEl("newsListContent");

    if (!container) return;

    container.innerHTML = `
      <div class="news-list-post">
        <div class="news-list-post-text">
          <p>Kraunamos naujienos...</p>
        </div>
      </div>
    `;

    try {
      const response = await fetch(
        `${API_NEWS_URL}?page=1&page_size=50&sort_by=created_at&sort_order=desc`,
        {
          headers: authHeaders()
        }
      );

      if (!response.ok) {
        const text = await response.text();

        container.innerHTML = `
          <div class="news-list-post">
            <div class="news-list-post-text">
              <h2 class="news-list-h2">Nepavyko įkelti naujienų</h2>
              <p>Patikrinkite, ar esate prisijungę kaip prieglauda.</p>
            </div>
          </div>
        `;

        console.error("News load failed:", response.status, text);
        return;
      }

      const data = await response.json();

      allNews = Array.isArray(data)
        ? data
        : data.items || data.news || data.results || [];

      renderNewsList(allNews);
    } catch (error) {
      container.innerHTML = `
        <div class="news-list-post">
          <div class="news-list-post-text">
            <h2 class="news-list-h2">Klaida kraunant naujienas</h2>
            <p>Patikrinkite backend arba naršyklės Console.</p>
          </div>
        </div>
      `;

      console.error("News load error:", error);
    }
  }

  async function saveNews(event) {
    event.preventDefault();

    const message = getEl("newsFormMessage");

    if (message) {
      message.textContent = "Saugoma...";
    }

    const payload = {
      title: getEl("newsTitle").value.trim(),
      web_url: getEl("newsWebUrl").value.trim(),
      image_url: getEl("newsImageUrl").value.trim() || null,
      is_published: getEl("newsIsPublished").checked
    };

    const url = editingNewsId
      ? `${API_NEWS_URL}/${editingNewsId}`
      : API_NEWS_URL;

    const method = editingNewsId ? "PATCH" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();

        if (message) {
          message.textContent = text || "Nepavyko išsaugoti naujienos.";
        }

        console.error("News save failed:", response.status, text);
        return;
      }

      closeModal();
      await loadNews();
    } catch (error) {
      if (message) {
        message.textContent = "Įvyko klaida saugant naujieną.";
      }

      console.error("News save error:", error);
    }
  }

  async function deleteNews(newsId) {
    const confirmed = confirm("Ar tikrai norite ištrinti šią naujieną?");

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_NEWS_URL}/${newsId}`, {
        method: "DELETE",
        headers: authHeaders()
      });

      if (!response.ok) {
        const text = await response.text();

        alert("Nepavyko ištrinti naujienos.");
        console.error("News delete failed:", response.status, text);
        return;
      }

      await loadNews();
    } catch (error) {
      alert("Įvyko klaida trinant naujieną.");
      console.error("News delete error:", error);
    }
  }

  function bindEvents() {
    const openModalBtn = getEl("openModalBtn");

    if (openModalBtn) {
      openModalBtn.addEventListener("click", () => openModal());
    }

    document.addEventListener("click", (event) => {
      const target = event.target;

      if (!target) return;

      if (target.id === "closeNewsModalBtn") {
        closeModal();
        return;
      }

      const modal = getEl("newsModal");

      if (modal && target === modal) {
        closeModal();
        return;
      }

      const action = target.dataset?.action;
      const newsId = Number(target.dataset?.id);

      if (!action || !newsId) return;

      const news = allNews.find((item) => Number(item.id) === newsId);

      if (action === "edit" && news) {
        openModal(news);
        return;
      }

      if (action === "delete") {
        deleteNews(newsId);
      }
    });

    document.addEventListener("submit", (event) => {
      if (event.target?.id === "newsForm") {
        saveNews(event);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    createModalIfMissing();
    bindEvents();
    loadNews();
  });
})();