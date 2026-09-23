/**
 * Umumiy interfeys xatti-harakatlari: mavzu, menyu, til ro'yxati,
 * nusxalash/ulashish/chop etish tugmalari va "yuqoriga" tugmasi.
 */
import { qs, qsa, t, storage, STORAGE_KEYS, locale } from './config.js';

/* ── Mavzu (yorug' / to'q / tizimga mos) ───────────────────────────────── */

const THEME_ORDER = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: 'ic-sun', light: 'ic-sun', dark: 'ic-moon' };

function applyTheme(mode) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = mode === 'dark' || (mode === 'auto' && media.matches);
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle('is-dark', isDark);

  for (const button of qsa('.js-theme-toggle')) {
    const label = button.dataset[`label${mode.charAt(0).toUpperCase()}${mode.slice(1)}`] || mode;
    button.setAttribute('aria-label', `${t('site.themeLabel') || 'Theme'}: ${label}`);
    button.title = label;
    const iconHost = button.querySelector('.js-theme-icon svg use');
    if (iconHost) iconHost.setAttribute('href', `#${THEME_ICON[isDark ? 'dark' : 'light']}`);
  }
}

export function initTheme() {
  const saved = storage.get(STORAGE_KEYS.theme, 'auto');
  const mode = THEME_ORDER.includes(saved) ? saved : 'auto';
  applyTheme(mode);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((document.documentElement.dataset.theme || 'auto') === 'auto') applyTheme('auto');
  });

  for (const button of qsa('.js-theme-toggle')) {
    button.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'auto';
      const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
      storage.set(STORAGE_KEYS.theme, next);
      applyTheme(next);
    });
  }
}

/* ── Mobil menyu ───────────────────────────────────────────────────────── */

export function initMobileNav() {
  const toggle = qs('.js-menu-toggle');
  const panel = qs('#mobile-nav');
  if (!toggle || !panel) return;

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? t('site.closeMenu') : t('site.openMenu'));
    const use = toggle.querySelector('svg use');
    if (use) use.setAttribute('href', open ? '#ic-close' : '#ic-menu');
  };

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1100 && !panel.hidden) setOpen(false);
  });
}

/* ── Til ro'yxati ──────────────────────────────────────────────────────── */

export function initLanguageMenu() {
  const wrapper = qs('[data-lang-switcher]');
  if (!wrapper) return;
  const button = wrapper.querySelector('.lang__button');
  const menu = wrapper.querySelector('.lang__menu');
  if (!button || !menu) return;

  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(menu.hidden);
  });
  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  // Tanlangan tilni eslab qolish — ildiz sahifasidagi yo'naltirish uchun
  menu.addEventListener('click', (event) => {
    const link = event.target.closest('a[hreflang]');
    if (!link) return;
    const code = link.getAttribute('href').split('/').filter(Boolean)[0];
    if (code) storage.set(STORAGE_KEYS.locale, code);
  });
  storage.set(STORAGE_KEYS.locale, locale);
}

/* ── Nusxalash, ulashish, chop etish ──────────────────────────────────── */

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    /* pastdagi zaxira usulga o'tamiz */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch (error) {
    return false;
  }
}

function flashLabel(button, message) {
  const labelNode = button.querySelector('span') || button;
  const original = labelNode.textContent;
  labelNode.textContent = message;
  button.classList.add('is-done');
  setTimeout(() => {
    labelNode.textContent = original;
    button.classList.remove('is-done');
  }, 1800);
}

export function initActions() {
  for (const button of qsa('.js-copy-link')) {
    button.addEventListener('click', async () => {
      const ok = await copyToClipboard(window.location.href);
      flashLabel(button, ok ? button.dataset.copiedLabel || t('common.copied') : t('common.error'));
    });
  }

  for (const button of qsa('.js-copy-text')) {
    button.addEventListener('click', async () => {
      const ok = await copyToClipboard(button.dataset.copyText || '');
      button.setAttribute('aria-label', ok ? button.dataset.copiedLabel || t('common.copied') : t('common.error'));
      button.classList.add('is-done');
      setTimeout(() => button.classList.remove('is-done'), 1600);
    });
  }

  for (const button of qsa('.js-print')) {
    button.addEventListener('click', () => window.print());
  }

  if (navigator.share) {
    for (const button of qsa('.js-share')) {
      button.hidden = false;
      button.addEventListener('click', () => {
        navigator
          .share({ title: button.dataset.shareTitle || document.title, url: window.location.href })
          .catch(() => undefined);
      });
    }
  }
}

/* ── "Yuqoriga" tugmasi ───────────────────────────────────────────────── */

export function initToTop() {
  const button = qs('.js-to-top');
  if (!button) return;
  const update = () => button.classList.toggle('is-visible', window.scrollY > 600);
  update();
  window.addEventListener('scroll', update, { passive: true });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    const skip = qs('.skip-link');
    if (skip) skip.focus({ preventScroll: true });
  });
}

/* ── Sahifa manzilini shakllarga uzatish ─────────────────────────────── */

export function initFormMeta() {
  for (const input of qsa('form input[name="page"]')) {
    if (!input.value) input.value = window.location.href;
  }
}
