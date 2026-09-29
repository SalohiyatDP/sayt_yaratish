/**
 * Galereya (lightbox): tasvirni to'liq ekranda ko'rish.
 *
 * Tasvir turi faqat vizualizatsiya va chizmalarda ko'rsatiladi: foydalanuvchi
 * loyiha konsepsiyasini haqiqiy holat deb o'ylab qolmasligi kerak.
 * Fotosuratda esa yozuv keraksiz — rasm o'zi ko'rinib turadi.
 */
import { qs, qsa, t, trapFocus } from './config.js';

let items = [];
let index = 0;
let releaseFocus = null;
let lastFocused = null;

function show(box) {
  const item = items[index];
  if (!item) return;
  const image = qs('[data-lightbox-image]', box);
  image.src = item.src;
  image.alt = item.alt || item.caption || '';
  // Tur belgisi ko'rsatilmaydi
  const kindNode = qs('[data-lightbox-kind]', box);
  if (kindNode) {
    kindNode.textContent = '';
    kindNode.hidden = true;
  }
  qs('[data-lightbox-caption]', box).textContent = item.caption || '';
  qs('[data-lightbox-counter]', box).textContent = t('media.gallery.counter', { i: index + 1, n: items.length });
  const singleImage = items.length < 2;
  qs('[data-lightbox-prev]', box).hidden = singleImage;
  qs('[data-lightbox-next]', box).hidden = singleImage;
}

export function initGallery() {
  const box = qs('[data-lightbox]');
  if (!box) return;

  const open = (groupItems, startIndex) => {
    items = groupItems;
    index = startIndex;
    lastFocused = document.activeElement;
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    releaseFocus = trapFocus(box, close);
    show(box);
    qs('[data-lightbox-close]', box)?.focus();
  };

  const close = () => {
    box.hidden = true;
    document.body.style.overflow = '';
    qs('[data-lightbox-image]', box).src = '';
    if (releaseFocus) releaseFocus();
    releaseFocus = null;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  };

  const move = (delta) => {
    if (items.length < 2) return;
    index = (index + delta + items.length) % items.length;
    show(box);
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-gallery-open]');
    if (!button) return;
    event.preventDefault();
    const group = button.closest('[data-gallery]');
    if (!group) return;
    const buttons = qsa('[data-gallery-open]', group);
    const groupItems = buttons.map((node) => ({
      src: node.dataset.src,
      kind: node.dataset.kind,
      caption: node.dataset.caption,
      alt: node.getAttribute('aria-label'),
    }));
    open(groupItems, buttons.indexOf(button));
  });

  for (const button of qsa('[data-lightbox-close]', box)) button.addEventListener('click', close);
  qs('[data-lightbox-prev]', box)?.addEventListener('click', () => move(-1));
  qs('[data-lightbox-next]', box)?.addEventListener('click', () => move(1));

  box.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  });

  // Sensorli ekranda surish
  let startX = null;
  box.addEventListener('touchstart', (event) => {
    startX = event.touches[0]?.clientX ?? null;
  }, { passive: true });
  box.addEventListener('touchend', (event) => {
    if (startX == null) return;
    const delta = (event.changedTouches[0]?.clientX ?? startX) - startX;
    if (Math.abs(delta) > 50) move(delta < 0 ? 1 : -1);
    startX = null;
  }, { passive: true });

  initGalleryNav();
}

/**
 * Galereya lentasidagi yon yo'naltirgichlar (o'q tugmalar).
 * Scrollbar yashirilgani uchun lenta shu tugmalar orqali suriladi.
 * Tugmalar faqat surish kerak bo'lganda (rasmlar ko'rinishga sig'masa) chiqadi.
 */
function initGalleryNav() {
  for (const strip of qsa('.gallery__strip')) {
    const track = qs('[data-gallery-track]', strip);
    const prev = qs('[data-gallery-scroll="-1"]', strip);
    const next = qs('[data-gallery-scroll="1"]', strip);
    if (!track || !prev || !next) continue;

    const update = () => {
      // Lenta to'liq sig'sa — tugmalar kerak emas
      const overflow = track.scrollWidth - track.clientWidth > 4;
      const atStart = track.scrollLeft <= 2;
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
      prev.hidden = !overflow || atStart;
      next.hidden = !overflow || atEnd;
    };

    const scrollByStep = (dir) => {
      // Bir bosishda ko'rinadigan kenglikning ~80% ga suramiz
      track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
    };

    prev.addEventListener('click', () => scrollByStep(-1));
    next.addEventListener('click', () => scrollByStep(1));
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
}
