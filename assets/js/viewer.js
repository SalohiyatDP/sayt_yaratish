/**
 * Master-reja chizmalarini kattalashtirib ko'rish oynasi.
 * Sichqoncha bilan tortish, g'ildirak bilan masshtab, klaviatura bilan boshqarish.
 */
import { qs, qsa, trapFocus } from './core/config.js';

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

function initViewer() {
  const viewer = qs('[data-viewer]');
  if (!viewer) return;

  const stage = qs('[data-viewer-stage]', viewer);
  const image = qs('[data-viewer-image]', viewer);
  const titleNode = qs('[data-viewer-title]', viewer);
  const panel = qs('.viewer__panel', viewer);

  const view = { scale: 1, x: 0, y: 0 };
  let releaseFocus = null;
  let lastFocused = null;

  function applyTransform() {
    image.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  }

  function reset() {
    const stageRect = stage.getBoundingClientRect();
    const naturalWidth = image.naturalWidth || stageRect.width;
    const naturalHeight = image.naturalHeight || stageRect.height;
    const fit = Math.min(stageRect.width / naturalWidth, stageRect.height / naturalHeight, 1);
    view.scale = Number.isFinite(fit) && fit > 0 ? fit : 1;
    view.x = (stageRect.width - naturalWidth * view.scale) / 2;
    view.y = (stageRect.height - naturalHeight * view.scale) / 2;
    applyTransform();
  }

  function zoomAt(factor, clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const px = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
    if (nextScale === view.scale) return;
    const ratio = nextScale / view.scale;
    view.x = px - (px - view.x) * ratio;
    view.y = py - (py - view.y) * ratio;
    view.scale = nextScale;
    applyTransform();
  }

  function open(src, title) {
    lastFocused = document.activeElement;
    viewer.hidden = false;
    document.body.style.overflow = 'hidden';
    titleNode.textContent = title || '';
    image.alt = title || '';
    image.src = src;
    if (image.complete) reset();
    else image.addEventListener('load', reset, { once: true });
    releaseFocus = trapFocus(panel, close);
    qs('[data-viewer-close]', viewer)?.focus();
  }

  function close() {
    viewer.hidden = true;
    document.body.style.overflow = '';
    image.src = '';
    if (releaseFocus) releaseFocus();
    releaseFocus = null;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-viewer-open]');
    if (!button) return;
    event.preventDefault();
    open(button.dataset.src, button.dataset.title);
  });

  for (const button of qsa('[data-viewer-close]', viewer)) button.addEventListener('click', close);
  qs('[data-viewer-zoom-in]', viewer)?.addEventListener('click', () => zoomAt(1.4));
  qs('[data-viewer-zoom-out]', viewer)?.addEventListener('click', () => zoomAt(1 / 1.4));
  qs('[data-viewer-reset]', viewer)?.addEventListener('click', reset);

  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
    },
    { passive: false },
  );

  let dragging = false;
  let last = null;
  stage.addEventListener('pointerdown', (event) => {
    dragging = true;
    last = { x: event.clientX, y: event.clientY };
    stage.classList.add('is-grabbing');
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    view.x += event.clientX - last.x;
    view.y += event.clientY - last.y;
    last = { x: event.clientX, y: event.clientY };
    applyTransform();
  });
  const stop = () => {
    dragging = false;
    stage.classList.remove('is-grabbing');
  };
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  stage.addEventListener('pointerleave', stop);

  viewer.addEventListener('keydown', (event) => {
    const step = 60;
    const actions = {
      '+': () => zoomAt(1.3),
      '=': () => zoomAt(1.3),
      '-': () => zoomAt(1 / 1.3),
      '0': reset,
      ArrowUp: () => { view.y += step; applyTransform(); },
      ArrowDown: () => { view.y -= step; applyTransform(); },
      ArrowLeft: () => { view.x += step; applyTransform(); },
      ArrowRight: () => { view.x -= step; applyTransform(); },
    };
    const handler = actions[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  });

  window.addEventListener('resize', () => {
    if (!viewer.hidden) reset();
  });
}

initViewer();
