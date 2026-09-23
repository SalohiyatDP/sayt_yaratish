/**
 * Ko'p tilliligni boshqarish: lug'atlar, matn tanlash va manzillar.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { joinPath } from './util.mjs';

/** Tillar tartibi — saytdagi til almashtirgichda shu tartibda chiqadi. */
export const LOCALE_ORDER = ['uz', 'uz-cyrl', 'ru', 'en'];

/** Sayt bo'limlari va ularning URL segmentlari (barcha tillarda bir xil). */
export const SECTIONS = {
  home: '',
  about: 'about',
  areas: 'areas',
  masterplans: 'masterplans',
  investors: 'investors',
  news: 'news',
  contact: 'contact',
  accessibility: 'accessibility',
};

/** Bo'lim uchun navigatsiya kaliti. */
export const SECTION_NAV_KEY = {
  home: 'nav.home',
  about: 'nav.about',
  areas: 'nav.areas',
  masterplans: 'nav.masterplans',
  investors: 'nav.investors',
  news: 'nav.news',
  contact: 'nav.contact',
  accessibility: 'nav.accessibility',
};

/** Asosiy menyuda ko'rinadigan bo'limlar (foydalanuvchi talabiga muvofiq tartibda). */
export const MAIN_NAV = ['about', 'areas', 'masterplans', 'investors', 'news', 'contact'];

/** i18n/ katalogidan barcha lug'atlarni yuklaydi. */
export function loadLocales(i18nDir) {
  const files = readdirSync(i18nDir).filter((f) => f.endsWith('.json'));
  const dictionaries = {};
  for (const file of files) {
    const code = path.basename(file, '.json');
    dictionaries[code] = JSON.parse(readFileSync(path.join(i18nDir, file), 'utf8'));
  }
  const codes = LOCALE_ORDER.filter((code) => dictionaries[code]);
  const missing = Object.keys(dictionaries).filter((c) => !codes.includes(c));
  codes.push(...missing);

  const defaultLocale = codes.find((c) => dictionaries[c]?._meta?.isDefault) || codes[0];
  return { dictionaries, codes, defaultLocale };
}

/**
 * Berilgan til uchun tarjima funksiyasini yasaydi.
 * Kalit topilmasa, asosiy tildan, so'ngra kalitning o'zidan foydalanadi.
 */
export function createTranslator(dictionaries, locale, defaultLocale) {
  const primary = dictionaries[locale] || {};
  const fallback = dictionaries[defaultLocale] || {};
  return function t(key, params) {
    let value = primary[key];
    if (value == null) value = fallback[key];
    if (value == null) return key;
    if (!params) return value;
    return String(value).replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
    );
  };
}

/**
 * Ko'p tilli qiymatdan ({uz-cyrl, uz, ru, en}) kerakli tildagi matnni oladi.
 * Tanlangan tilda matn bo'lmasa, quyidagi tartibda zaxiraga o'tadi:
 * so'ralgan til → o'zbek kirill → o'zbek lotin → rus → ingliz → birinchi bo'sh bo'lmagan qiymat.
 */
export function pickText(value, locale, { fallback = true } = {}) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return String(value);

  const direct = value[locale];
  if (typeof direct === 'string' && direct.trim() !== '') return direct.trim();
  if (!fallback) return '';

  const chain = [locale, 'uz-cyrl', 'uz', 'ru', 'en'];
  for (const code of chain) {
    const candidate = value[code];
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim();
  }
  for (const [key, candidate] of Object.entries(value)) {
    if (key.startsWith('_')) continue;
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim();
  }
  return '';
}

/** Tanlangan tildagi matn mavjudligini (zaxirasiz) tekshiradi. */
export const hasText = (value, locale) => pickText(value, locale) !== '';

/** Bo'lim va slug bo'yicha sayt ichidagi manzilni yasaydi. */
export function urlFor(locale, section = 'home', slug = null) {
  const segment = SECTIONS[section] ?? section;
  const parts = [locale];
  if (segment) parts.push(segment);
  if (slug) parts.push(slug);
  return `${joinPath(...parts)}/`;
}

/** Statik fayl (CSS, JS, rasm) manzili — tilga bog'liq emas. */
export const assetUrl = (relative) => joinPath(relative);

/** Bir sahifaning boshqa tillardagi manzillarini qaytaradi (hreflang uchun). */
export function alternateUrls(codes, section, slug) {
  return codes.map((code) => ({ locale: code, url: urlFor(code, section, slug) }));
}
