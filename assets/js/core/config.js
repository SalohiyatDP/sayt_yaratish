/**
 * Sahifaga joylashtirilgan sozlamalarni o'qish va tarjima yordamchisi.
 * Sozlamalar <script type="application/json" id="app-config"> ichida keladi.
 */

function readConfig() {
  const node = document.getElementById('app-config');
  if (!node) return {};
  try {
    return JSON.parse(node.textContent || '{}');
  } catch (error) {
    console.warn('app-config o\'qilmadi:', error);
    return {};
  }
}

export const config = readConfig();
export const locale = config.locale || document.documentElement.dataset.locale || 'uz-cyrl';
const strings = config.strings || {};

/** Tarjima: t('catalog.results', { n: 5 }) */
export function t(key, params) {
  let value = strings[key];
  if (value == null) value = key;
  if (!params) return value;
  return String(value).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Sonni joylashuvga mos formatlash. */
export function formatNumber(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : 'uz-UZ').format(Number(value));
  } catch (error) {
    return String(value);
  }
}

/** localStorage bilan xavfsiz ishlash (maxfiylik rejimida xatolik bermaydi). */
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      /* e'tiborsiz */
    }
  },
};

export const STORAGE_KEYS = {
  theme: 'direksiya.theme',
  locale: 'direksiya.locale',
  compare: 'direksiya.compare',
  view: 'direksiya.catalogView',
};

/** JSON faylni yuklash (xatolikda null qaytaradi). */
export async function fetchJson(url) {
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Ma'lumot yuklanmadi: ${url}`, error);
    return null;
  }
}

/** Qisqa yordamchilar. */
export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Matndagi HTML belgilarini xavfsizlashtirish. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Funksiya chaqiruvlarini cheklaydi. */
export function debounce(fn, delay = 160) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Modal oynalar uchun fokus qulfi. */
export function trapFocus(container, onEscape) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function handler(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (typeof onEscape === 'function') onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(container.querySelectorAll(selector)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}
