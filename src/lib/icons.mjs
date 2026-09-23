/**
 * Ichki SVG ikonka to'plami.
 * Barcha ikonkalar 24x24 koordinata tizimida, stroke asosida chizilgan.
 * Sahifaga bir marta sprite sifatida joylashtiriladi, keyin <use> orqali ishlatiladi.
 */
import { raw, esc } from './util.mjs';

const PATHS = {
  mountain: '<path d="m3 19 6.5-11 4 6.5 2.5-4L21 19H3Z"/><path d="m9.5 8 2.2 3.6"/>',
  river: '<path d="M3 7c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/><path d="M3 12c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/><path d="M3 17c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/>',
  water: '<path d="M12 3c3.5 4.2 6 7.3 6 10.2A6 6 0 0 1 6 13.2C6 10.3 8.5 7.2 12 3Z"/>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17"/><path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 11.5 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>',
  external: '<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  arrowRight: '<path d="M4 12h15"/><path d="m13.5 6.5 5.5 5.5-5.5 5.5"/>',
  arrowLeft: '<path d="M20 12H5"/><path d="M10.5 6.5 5 12l5.5 5.5"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  filter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10M15 9.5v10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.8" r="1"/>',
  alert: '<path d="M12 4 3 19h18L12 4Z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r="1"/>',
  file: '<path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5L14 3.5Z"/><path d="M13.5 3.8V8h4.2"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5L16 13l4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 5.5L20 7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 2"/>',
  share: '<circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><path d="m9 10.8 5.5-3.2M9 13.2l5.5 3.2"/>',
  print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 16h10v4H7z"/>',
  copy: '<rect x="9" y="4" width="11" height="13" rx="2"/><path d="M15 20H6a2 2 0 0 1-2-2V8"/>',
  star: '<path d="m12 4.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 10.2l5.4-.8L12 4.5Z"/>',
  bookmark: '<path d="M7 4h10v16l-5-3.5L7 20V4Z"/>',
  scale: '<path d="M12 4v16"/><path d="M6 8h12"/><path d="m6 8-3 6h6L6 8Z"/><path d="m18 8-3 6h6l-3-6Z"/>',
  building: '<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10.5 20v-3.5h3V20"/>',
  route: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5v4A3.5 3.5 0 0 0 9.5 16h5"/>',
  tree: '<path d="M12 4l4 5h-2.5l3 4H7.5l3-4H8l4-5Z"/><path d="M12 13v7"/>',
  parking: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16V8h2.8a2.6 2.6 0 0 1 0 5.2H10"/>',
  bolt: '<path d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M9 3.5V7M15 3.5V7"/>',
  tag: '<path d="M11 4h6a3 3 0 0 1 3 3v6l-8.5 8.5a2 2 0 0 1-2.8 0L4 15.3a2 2 0 0 1 0-2.8L11 4Z"/><circle cx="16" cy="8" r="1.4"/>',
  gavel: '<path d="m4 20h9"/><path d="m7 15 7-7"/><path d="m12.5 4.5 6 6-2.5 2.5-6-6 2.5-2.5Z"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M11 8.5v5M8.5 11h5"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8.5 11h5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-4 2 2-5 4-2Z"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V4.5h6V7"/><path d="M7 7l1 13h8l1-13"/>',
  offline: '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 13a10 10 0 0 1 3-2"/><path d="M19 13a10 10 0 0 0-8-2.8"/><circle cx="12" cy="20" r="1"/>',
};

export const ICON_NAMES = Object.keys(PATHS);

/** Sahifaga bir marta joylashtiriladigan SVG sprite. */
export function iconSprite() {
  const symbols = ICON_NAMES.map(
    (name) => `<symbol id="ic-${name}" viewBox="0 0 24 24">${PATHS[name]}</symbol>`,
  ).join('');
  return raw(
    `<svg class="svg-sprite" aria-hidden="true" focusable="false" width="0" height="0" ` +
      `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ` +
      `stroke-linejoin="round"><defs>${symbols}</defs></svg>`,
  );
}

/**
 * Ikonkani chiqaradi.
 * @param {string} name ICON_NAMES dagi nom
 * @param {{ label?: string, size?: number, className?: string }} options
 *   label berilsa ikonka ma'noli (role="img"), aks holda bezak sifatida yashiriladi.
 */
export function icon(name, options = {}) {
  if (!PATHS[name]) return raw('');
  const { label, size = 20, className = '' } = options;
  const classes = ['icon', className].filter(Boolean).join(' ');
  const a11y = label
    ? `role="img" aria-label="${esc(label)}"`
    : 'aria-hidden="true" focusable="false"';
  return raw(
    `<svg class="${esc(classes)}" width="${Number(size)}" height="${Number(size)}" ${a11y}>` +
      `<use href="#ic-${esc(name)}"/></svg>`,
  );
}

/** Hudud turi uchun mos ikonka nomi. */
export const areaTypeIcon = (areaTypeId) =>
  ({ mountain: 'mountain', river: 'river', reservoir: 'water' })[areaTypeId] || 'pin';
