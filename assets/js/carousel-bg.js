/**
 * carousel-bg.js
 * ==============
 * Carrossel de fundo com crossfade — APENAS NA TELA DE LOGIN.
 *
 * ARQUITETURA
 * -----------
 * O carrossel é injetado como primeiro filho do #tela-login.
 * Como o #tela-login tem position:relative e min-height:100vh
 * (definido no style.css), o carrossel absolute preenche
 * exatamente a viewport enquanto o login está visível.
 * O #main-app não é afetado em nada — mantém seu visual original.
 *
 * FORMATO DE VÍDEO
 * ----------------
 * Use sempre .mp4 (H.264). O Cloudinary converte qualquer upload
 * automaticamente — basta trocar a extensão na URL.
 */

// ================================================================
//  ▶ CONFIGURE SUAS MÍDIAS AQUI
// ================================================================
const CAROUSEL_MEDIA = [
  {
    type: 'image',
    url:  'https://res.cloudinary.com/dnq9s0g7v/image/upload/v1776900361/michael-afonso-rR95ZJbFE14-unsplash_cxilmw.jpg',
  },
  // Adicione mais itens abaixo:
  // {
  //   type: 'image',
  //   url:  'https://res.cloudinary.com/dnq9s0g7v/image/upload/v.../outra-foto.jpg',
  // },
  // {
  //   type: 'video',
  //   url:  'https://res.cloudinary.com/dnq9s0g7v/video/upload/v.../video.mp4',
  // },
];

// Tempo (ms) que cada slide fica visível antes do dissolve.
// O dissolve dura 1.8s (CSS), então use no mínimo 4000.
const SLIDE_DURATION_MS = 7000;

// Mostrar bolinhas indicadoras?
const SHOW_DOTS = true;

// ================================================================
//  ▶ LÓGICA
// ================================================================

function buildCarousel() {
  // O carrossel só faz sentido dentro do #tela-login
  const telaLogin = document.getElementById('tela-login');
  if (!telaLogin) return;

  // Proteção contra dupla inicialização
  if (document.getElementById('bg-carousel')) return;

  if (!CAROUSEL_MEDIA || CAROUSEL_MEDIA.length === 0) return;

  // ── Container do carrossel ────────────────────────────────────
  const carousel = document.createElement('div');
  carousel.id = 'bg-carousel';

  // ── Um slide para cada mídia ──────────────────────────────────
  const slides = CAROUSEL_MEDIA.map((item, index) => {
    const slide = document.createElement('div');
    slide.className = 'bgc-slide';
    if (index === 0) slide.classList.add('active'); // primeiro começa visível

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src         = item.url;
      video.muted       = true;       // obrigatório para autoplay funcionar
      video.autoplay    = true;
      video.loop        = true;
      video.playsInline = true;       // sem fullscreen automático no iOS
      video.setAttribute('aria-hidden', 'true');
      video.setAttribute('tabindex', '-1');
      slide.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      if (index > 0) img.loading = 'lazy'; // não atrasa o carregamento inicial
      slide.appendChild(img);
    }

    carousel.appendChild(slide);
    return slide;
  });

  // ── Overlay escuro (definido e estilizado no CSS) ─────────────
  const overlay = document.createElement('div');
  overlay.id = 'bg-carousel-overlay';

  // ── Pontinhos indicadores (opcionais) ─────────────────────────
  let dotsContainer = null;
  let dotEls = [];

  if (SHOW_DOTS && CAROUSEL_MEDIA.length > 1) {
    dotsContainer = document.createElement('div');
    dotsContainer.id = 'bg-carousel-dots';

    dotEls = CAROUSEL_MEDIA.map((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'bgc-dot';
      if (index === 0) dot.classList.add('active');
      dotsContainer.appendChild(dot);
      return dot;
    });
  }

  // ── Injetar dentro do #tela-login, antes de tudo ─────────────
  // insertBefore(novo, referência) coloca o novo ANTES da referência.
  // Assim o carrossel fica atrás do .login-card que já existe no HTML.
  telaLogin.insertBefore(overlay, telaLogin.firstChild);
  telaLogin.insertBefore(carousel, telaLogin.firstChild);
  if (dotsContainer) telaLogin.appendChild(dotsContainer);

  // ── Rotação entre slides ──────────────────────────────────────
  if (CAROUSEL_MEDIA.length <= 1) return; // só 1 mídia: sem timer necessário

  let currentIndex = 0;

  function goToSlide(nextIndex) {
    slides[currentIndex].classList.remove('active');
    if (dotEls.length) dotEls[currentIndex].classList.remove('active');

    currentIndex = nextIndex;

    slides[currentIndex].classList.add('active');
    if (dotEls.length) dotEls[currentIndex].classList.add('active');

    // Força o play em vídeos que o browser pode ter pausado
    const videoEl = slides[currentIndex].querySelector('video');
    if (videoEl) videoEl.play().catch(() => {});
  }

  setInterval(() => {
    goToSlide((currentIndex + 1) % CAROUSEL_MEDIA.length);
  }, SLIDE_DURATION_MS);
}

// ================================================================
//  ▶ PONTO DE ENTRADA EXPORTADO
// ================================================================

/**
 * Chame esta função uma única vez no início do main.js.
 * Módulos ES já executam após o DOM estar pronto, mas
 * adicionamos a verificação por segurança.
 */
export function initBackgroundCarousel() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildCarousel);
  } else {
    buildCarousel();
  }
}
