function renderFooter() {
  const footerRoot = document.getElementById("site-footer");

  if (!footerRoot) {
    return;
  }

  footerRoot.innerHTML = `
    <div class="site-footer-inner">
      <div class="site-footer-top">
        <div class="site-footer-left">
          <img src="/assets/svg/paw.svg" alt="Pėdutė" class="footer-paw" />

          <div>
            <h3 class="footer-title">KONTAKTAI</h3>
            <div class="footer-subtitle">Susisiekite su mumis</div>
            <div class="footer-contact-line">+370 600 00000</div>
            <div class="footer-contact-line">info@nekliudom.lt</div>
            <div class="footer-contact-line">Kaunas, Lietuva</div>
          </div>
        </div>

        <div class="site-footer-right">
          <img src="/assets/svg/paw.svg" alt="Pėdutė" class="footer-paw" />

          <div>
            <h3 class="footer-title">INFORMACIJA</h3>
            <div class="footer-info-line">Gyvūnų gerovės platforma, jungianti prieglaudas, savanorius ir gyvūnų mylėtojus.</div>
            <div class="footer-info-line">Čia galite rasti informaciją apie savanorystę, paramą ir prieglaudų naujienas.</div>
          </div>
        </div>
      </div>

      <div class="site-footer-bottom">
        ©2026 Nekliudom
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", renderFooter);