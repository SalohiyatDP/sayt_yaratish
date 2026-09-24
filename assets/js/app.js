/**
 * Saytning asosiy skripti — barcha sahifalarda yuklanadi.
 * Sahifaga xos modullar (katalog, xarita, ko'ruvchi) alohida yuklanadi.
 */
import { initTheme, initMobileNav, initLanguageMenu, initActions, initToTop, initFormMeta } from './core/ui.js';
import { initSearch } from './core/search.js';
import { initCompare } from './core/compare.js';
import { initGallery } from './core/gallery.js';

function boot() {
  initTheme();
  initMobileNav();
  initLanguageMenu();
  initActions();
  initToTop();
  initFormMeta();
  initSearch();
  initCompare();
  initGallery();
  registerServiceWorker();
  markExternalLinks();
}

/** Tashqi havolalarga xavfsizlik atributlarini qo'shish. */
function markExternalLinks() {
  for (const link of document.querySelectorAll('a[href^="http"]')) {
    try {
      const url = new URL(link.href);
      if (url.origin === window.location.origin) continue;
      if (!link.rel.includes('noopener')) link.rel = `${link.rel} noopener noreferrer`.trim();
      if (!link.target) link.target = '_blank';
    } catch (error) {
      /* e'tiborsiz */
    }
  }
}

/** Oflayn ishlash uchun xizmat ishchisini ro'yxatdan o'tkazish. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
