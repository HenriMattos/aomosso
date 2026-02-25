/* ══════════════════════════════════════════════════════════
   AO MOSSO — Mobile UX Enhancements
   Adicione este script APÓS o script.js principal
   <script src="mobile.js"></script>
══════════════════════════════════════════════════════════ */

/* ── Bottom Navigation Mobile ────────────────────────── */
function injetarBottomNav() {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.id = 'bottom-nav';
  nav.innerHTML = `
    <button class="bottom-nav-item active" data-page="feed" onclick="irParaMobile('feed', this)">
      <i class="fas fa-home"></i>
      <span>Painel</span>
    </button>
    <button class="bottom-nav-item" data-page="financeiro" onclick="irParaMobile('financeiro', this)">
      <i class="fas fa-coins"></i>
      <span>Finanças</span>
      <span class="bnav-badge" id="bnav-fin" style="display:none"></span>
    </button>
    <button class="bottom-nav-item" data-page="membros" onclick="irParaMobile('membros', this)">
      <i class="fas fa-users"></i>
      <span>Irmãos</span>
    </button>
    <button class="bottom-nav-item" data-page="agenda" onclick="irParaMobile('agenda', this)">
      <i class="fas fa-calendar-days"></i>
      <span>Agenda</span>
      <span class="bnav-badge" id="bnav-agenda" style="display:none"></span>
    </button>
    <button class="bottom-nav-item" data-page="mural" onclick="irParaMobile('mural', this)">
      <i class="fas fa-thumbtack"></i>
      <span>Mural</span>
    </button>
  `;
  document.getElementById('screen-app')?.appendChild(nav);
}

window.irParaMobile = function(page, btn) {
  irPara(page);
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
};

/* Sincroniza bottom nav com navegação lateral */
const _irParaOriginal = window.irPara;
window.irPara = function(p) {
  _irParaOriginal(p);
  document.querySelectorAll('.bottom-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === p);
  });
};

/* Sincroniza badges do bottom nav com badges do sidebar */
const _observer = new MutationObserver(() => {
  const finBadge = document.getElementById('badge-fin')?.textContent;
  const agendaBadge = document.getElementById('badge-agenda')?.textContent;
  const bnavFin = document.getElementById('bnav-fin');
  const bnavAgenda = document.getElementById('bnav-agenda');
  if (bnavFin) {
    bnavFin.textContent = finBadge || '';
    bnavFin.style.display = finBadge ? 'flex' : 'none';
  }
  if (bnavAgenda) {
    bnavAgenda.textContent = agendaBadge || '';
    bnavAgenda.style.display = agendaBadge ? 'flex' : 'none';
  }
});

/* ── Swipe para fechar sidebar ────────────────────────── */
function initSwipeGestures() {
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sb-overlay');

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!isDragging) {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > dy && dx > 10) isDragging = true;
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!isDragging) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;

    // Swipe direita (da borda esquerda) → abre sidebar
    if (startX < 25 && diff > 60) {
      sidebar?.classList.add('open');
      overlay?.classList.add('open');
    }

    // Swipe esquerda quando sidebar aberta → fecha
    if (sidebar?.classList.contains('open') && diff < -60) {
      sidebar.classList.remove('open');
      overlay?.classList.remove('open');
    }
  }, { passive: true });
}

/* ── Pull to refresh visual (apenas visual, não recarrega a página) ── */
function initPullToRefresh() {
  const main = document.querySelector('.main');
  if (!main) return;

  let startY = 0;
  let pulling = false;
  let indicator;

  function criarIndicador() {
    indicator = document.createElement('div');
    indicator.style.cssText = `
      position:fixed; top:${getComputedStyle(document.documentElement).getPropertyValue('--topbar') || '54px'};
      left:50%; transform:translateX(-50%) translateY(-40px);
      background:var(--navy); color:var(--gold); border-radius:20px;
      padding:7px 14px; font-size:12px; font-weight:700; z-index:999;
      transition:transform 0.2s, opacity 0.2s; opacity:0; pointer-events:none;
      display:flex; align-items:center; gap:7px; box-shadow:var(--shadow-md);
    `;
    indicator.innerHTML = `<i class="fas fa-arrow-rotate-right"></i> Atualizar`;
    document.body.appendChild(indicator);
  }

  main.addEventListener('touchstart', e => {
    if (main.scrollTop === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  main.addEventListener('touchmove', e => {
    if (!pulling || !indicator) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 20) {
      const progress = Math.min(dy / 80, 1);
      indicator.style.opacity = progress;
      indicator.style.transform = `translateX(-50%) translateY(${-40 + progress * 50}px)`;
    }
  }, { passive: true });

  main.addEventListener('touchend', e => {
    if (!pulling || !indicator) return;
    pulling = false;
    indicator.style.opacity = '0';
    indicator.style.transform = 'translateX(-50%) translateY(-40px)';
  }, { passive: true });

  criarIndicador();
}

/* ── Fecha modais com swipe down ─────────────────────── */
function initModalSwipeClose() {
  document.querySelectorAll('.modal').forEach(modal => {
    let startY = 0;

    modal.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
    }, { passive: true });

    modal.addEventListener('touchend', e => {
      const endY = e.changedTouches[0].clientY;
      const diff = endY - startY;

      // Swipe para baixo de 80px fecha o modal
      if (diff > 80 && modal.scrollTop === 0) {
        const bg = modal.closest('.modal-bg');
        if (bg) bg.classList.remove('open');
      }
    }, { passive: true });
  });
}

/* ── Inicializar melhorias mobile ────────────────────── */
function initMobileEnhancements() {
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    injetarBottomNav();
    initSwipeGestures();
    initPullToRefresh();

    // Observa mudanças nos badges
    const badgeEl = document.getElementById('badge-fin');
    if (badgeEl) _observer.observe(badgeEl, { childList: true, characterData: true, subtree: true });
  }

  initModalSwipeClose();
}

/* Aguarda o app estar logado para injetar o nav */
const _entrarAppOriginal = window.entrarApp;
if (typeof _entrarAppOriginal === 'function') {
  window.entrarApp = function(data) {
    _entrarAppOriginal(data);
    // Aguarda render
    setTimeout(() => {
      initMobileEnhancements();
    }, 100);
  };
}

// Caso já esteja logado ao carregar (sessão restaurada)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (document.getElementById('screen-app')?.style.display !== 'none') {
      initMobileEnhancements();
    }
  }, 300);
});

/* ── Resize handler ──────────────────────────────────── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const bottomNav = document.getElementById('bottom-nav');
    const isMobile = window.innerWidth <= 768;
    if (bottomNav) bottomNav.style.display = isMobile ? 'flex' : 'none';
  }, 200);
});