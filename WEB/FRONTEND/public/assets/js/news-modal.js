document.addEventListener("DOMContentLoaded", () => {

    const modalHTML = `
        <div class="modal-shelter-news" id="newsModal">
            <div class="modal-content-shelter-news">
                <span class="close-btn-shelter-news">&times;</span>

                <h2>Sukurti / Redaguoti naujieną</h2>

                <input type="text" id="newsTitle" placeholder="Naujienos pavadinimas">
                <textarea id="newsDesc" placeholder="Naujienos aprašymas"></textarea>

                <input type="file" accept="image/*" id="newsImage">

                <input type="url" id="newsLink" placeholder="Redirect nuoroda">

                <button class="submit-news-shelter-news">Išsaugoti</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // ELEMENTAI
    const modal = document.getElementById("newsModal");
    const createBtn = document.getElementById("openModalBtn");
    const closeBtn = document.querySelector(".close-btn-shelter-news");
    const editButtons = document.querySelectorAll(".edit-btn");
    const imageInput = document.getElementById("newsImage");

    let editingPost = null;
    let selectedFile = null;

    
    imageInput.addEventListener("change", (e) => {
        selectedFile = e.target.files[0] || null;
    });

    
    createBtn.addEventListener("click", () => {
        openModal();
        clearModal();
    });

   
    editButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const post = e.target.closest(".news-list-post");

            const title = post.querySelector("h2 a").textContent;
            const desc = post.querySelector("p").textContent;
            const link = post.querySelector("h2 a").getAttribute("href");

            document.getElementById("newsTitle").value = title;
            document.getElementById("newsDesc").value = desc;
            document.getElementById("newsLink").value = link;

            editingPost = post;

            openModal();
        });
    });

   
    closeBtn.addEventListener("click", closeModal);

    window.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

   
    function openModal() {
        modal.style.display = "block";
    }

    function closeModal() {
        modal.style.display = "none";
    }

    function clearModal() {
        document.getElementById("newsTitle").value = "";
        document.getElementById("newsDesc").value = "";
        document.getElementById("newsLink").value = "";
        imageInput.value = "";

        selectedFile = null;
        editingPost = null;
    }

});