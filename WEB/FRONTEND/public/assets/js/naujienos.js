(function () {
  const API_NEWS_URL = "/api/news";
  const DEFAULT_NEWS_IMAGE = "/assets/img/news-default.png";

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toISOString().slice(0, 10);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeImageUrl(imageUrl) {
    if (!imageUrl) {
      return DEFAULT_NEWS_IMAGE;
    }

    return imageUrl;
  }

  function renderEmpty(container) {
    container.innerHTML = `
      <div class="news-list-post">
        <div class="news-list-post-text">
          <h2 class="news-list-h2">Naujienų nėra</h2>
          <p>Šiuo metu nėra paskelbtų naujienų.</p>
        </div>
      </div>
    `;
  }

  function renderError(container) {
    container.innerHTML = `
      <div class="news-list-post">
        <div class="news-list-post-text">
          <h2 class="news-list-h2">Nepavyko įkelti naujienų</h2>
          <p>Bandykite atnaujinti puslapį vėliau.</p>
        </div>
      </div>
    `;
  }

  function renderNewsList(container, newsList) {
    if (!Array.isArray(newsList) || newsList.length === 0) {
      renderEmpty(container);
      return;
    }

    container.innerHTML = newsList
      .map((news, index) => {
        const title = escapeHtml(news.title);
        const summary = escapeHtml(news.summary || "");
        const webUrl = escapeHtml(news.web_url || "#");
        const imageUrl = escapeHtml(normalizeImageUrl(news.image_url));
        const date = escapeHtml(formatDate(news.created_at));

        return `
          ${index > 0 ? "<hr>" : ""}

          <div class="news-list-post">
            <img src="${imageUrl}" alt="Naujienos paveikslėlis">

            <div class="news-list-post-text">
              <h2 class="news-list-h2">
                <a href="${webUrl}" target="_blank" rel="noopener noreferrer">
                  ${title}
                </a>
              </h2>

              ${summary ? `<p>${summary}</p>` : ""}

              <span class="news-list-date">${date}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function loadNews() {
    const container = document.getElementById("newsListContent");

    if (!container) {
      return;
    }

    try {
      container.innerHTML = `
        <div class="news-list-post">
          <div class="news-list-post-text">
            <p>Kraunamos naujienos...</p>
          </div>
        </div>
      `;

    const response = await fetch(
      `${API_NEWS_URL}?page=1&page_size=50&sort_by=created_at&sort_order=desc`
    );

      if (!response.ok) {
        throw new Error("Nepavyko gauti naujienų");
      }

      const newsList = await response.json();

      renderNewsList(container, newsList);
    } catch (error) {
      console.error("News load error:", error);
      renderError(container);
    }
  }

  document.addEventListener("DOMContentLoaded", loadNews);
})();