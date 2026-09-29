/**
 * Umumiy yordamchi funksiyalar.
 * Hech qanday tashqi paketga bog'liq emas.
 */

/** HTML sifatida "xavfsiz" deb belgilangan matn o'rami. */
export class Html {
  constructor(value) {
    this.value = value == null ? '' : String(value);
  }
  toString() {
    return this.value;
  }
}

/** Matnni escape qilmasdan, tayyor HTML sifatida belgilaydi. Faqat ishonchli manbalar uchun. */
export const raw = (value) => new Html(value);

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Matnni HTML uchun xavfsiz holatga keltiradi. */
export function esc(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

function stringify(value) {
  if (value == null || value === false || value === true) return '';
  if (value instanceof Html) return value.value;
  if (Array.isArray(value)) return value.map(stringify).join('');
  return esc(value);
}

/**
 * Xavfsiz HTML shablon teg funksiyasi.
 * Interpolyatsiya qilingan qiymatlar avtomatik escape qilinadi;
 * html`` yoki raw() natijalari o'z holida qo'shiladi.
 */
export function html(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i += 1) {
    out += strings[i];
    if (i < values.length) out += stringify(values[i]);
  }
  return new Html(out);
}

/** Shartli HTML: shart rost bo'lsa qiymatni qaytaradi, aks holda bo'shliq. */
export const when = (condition, value) => (condition ? value : raw(''));

/** Atributni faqat qiymat mavjud bo'lsa chiqaradi. */
export function attr(name, value) {
  if (value == null || value === false || value === '') return raw('');
  if (value === true) return raw(` ${name}`);
  return raw(` ${name}="${esc(value)}"`);
}

/** CSS sinf nomlarini birlashtiradi. */
export function cx(...parts) {
  return parts
    .flat()
    .filter((p) => typeof p === 'string' && p.trim() !== '')
    .join(' ');
}

const TRANSLIT_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
  'ʻ': '', 'ʼ': '', '‘': '', '’': '',
};

/** Matndan URL uchun xavfsiz slug yasaydi (kirill va lotin harflarini qo'llab-quvvatlaydi). */
export function slugify(input) {
  const text = String(input ?? '').toLowerCase().trim();
  let out = '';
  for (const ch of text) {
    if (Object.prototype.hasOwnProperty.call(TRANSLIT_MAP, ch)) {
      out += TRANSLIT_MAP[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else {
      out += '-';
    }
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'sahifa';
}

/** Qiymat bo'sh (null, '', [], {} yoki faqat bo'shliq) ekanini aniqlaydi. */
export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    return Object.keys(value).filter((k) => !k.startsWith('_')).every((k) => isEmpty(value[k]));
  }
  return false;
}

/** Sonni bo'shliq bilan ajratib formatlaydi: 1234567 -> "1 234 567". */
export function formatNumber(value, locale = 'uz') {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  const [intPart, fracPart] = String(num).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const decimalSep = locale === 'en' ? '.' : ',';
  return fracPart ? `${grouped}${decimalSep}${fracPart}` : grouped;
}

const MONTHS = {
  'uz-cyrl': ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** YYYY-MM-DD sanani tanlangan tilda o'qiladigan ko'rinishga keltiradi. */
export function formatDate(value, locale = 'uz-cyrl') {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  const [, y, m, d] = match;
  const monthIndex = Number(m) - 1;
  const months = MONTHS[locale] || MONTHS['uz-cyrl'];
  const monthName = months[monthIndex] ?? m;
  const day = Number(d);
  if (locale === 'en') return `${monthName} ${day}, ${y}`;
  if (locale === 'ru') return `${day} ${monthName} ${y} г.`;
  return `${y}-yil ${day}-${monthName}`;
}

/** Sanani <time datetime=""> uchun ISO ko'rinishida qaytaradi. */
export function isoDate(value) {
  if (!value) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : '';
}

/** Fayl hajmini o'qiladigan ko'rinishga keltiradi. */
export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes)) || Number(bytes) <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = Number(bytes);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = size >= 10 || unit === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/** Matnni belgilangan uzunlikda qisqartiradi. */
export function truncate(text, max = 180) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).replace(/[\s,.;:—-]+$/, '')}…`;
}

/** HTML teglarini olib tashlab, faqat matn qoldiradi. */
export function stripTags(input) {
  return String(input ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
  'a', 'h3', 'h4', 'h5', 'blockquote', 'figure', 'figcaption', 'small', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
]);
const ALLOWED_ATTRS = {
  a: new Set(['href', 'title', 'target', 'rel']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  td: new Set(['colspan', 'rowspan']),
};
const VOID_TAGS = new Set(['br', 'hr']);
const DROP_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript']);

function safeUrl(value) {
  const url = String(value ?? '').trim();
  if (url === '') return null;
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return url;
  return null;
}

/**
 * Boshqaruv panelidan kiritilgan HTML matnni ruxsat berilgan teglar
 * ro'yxati bo'yicha tozalaydi. Ruxsatsiz teglar olib tashlanadi,
 * script/style/iframe kabi teglarning ichidagi mazmun ham o'chiriladi.
 */
export function sanitizeHtml(input) {
  const source = String(input ?? '');
  let out = '';
  let index = 0;
  let skipUntil = null;
  const openStack = [];

  while (index < source.length) {
    const lt = source.indexOf('<', index);
    if (lt === -1) {
      if (!skipUntil) out += esc(source.slice(index));
      break;
    }
    if (!skipUntil) out += esc(source.slice(index, lt));

    const gt = source.indexOf('>', lt);
    if (gt === -1) break;
    const tagBody = source.slice(lt + 1, gt);
    index = gt + 1;

    if (tagBody.startsWith('!')) continue; // izohlar va doctype

    const isClosing = tagBody.startsWith('/');
    const nameMatch = /^\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tagBody);
    if (!nameMatch) continue;
    const tag = nameMatch[1].toLowerCase();

    if (skipUntil) {
      if (isClosing && tag === skipUntil) skipUntil = null;
      continue;
    }
    if (DROP_CONTENT_TAGS.has(tag)) {
      if (!isClosing) skipUntil = tag;
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (isClosing) {
      const pos = openStack.lastIndexOf(tag);
      if (pos !== -1) {
        openStack.splice(pos, 1);
        out += `</${tag}>`;
      }
      continue;
    }

    const allowed = ALLOWED_ATTRS[tag];
    let attrs = '';
    if (allowed) {
      const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
      let m;
      const seen = new Set();
      while ((m = attrRe.exec(tagBody)) !== null) {
        const key = m[1].toLowerCase();
        if (!allowed.has(key) || seen.has(key)) continue;
        seen.add(key);
        let value = m[3] ?? m[4] ?? m[5] ?? '';
        if (key === 'href') {
          const url = safeUrl(value);
          if (!url) continue;
          value = url;
        }
        attrs += ` ${key}="${esc(value)}"`;
      }
      if (tag === 'a' && /target\s*=/.test(attrs) && !/rel\s*=/.test(attrs)) {
        attrs += ' rel="noopener noreferrer"';
      }
    }

    const selfClosing = VOID_TAGS.has(tag) || /\/\s*$/.test(tagBody);
    if (selfClosing) {
      out += `<${tag}${attrs}>`;
    } else {
      openStack.push(tag);
      out += `<${tag}${attrs}>`;
    }
  }

  while (openStack.length) out += `</${openStack.pop()}>`;
  return out;
}

/** Oddiy matnni paragraflarga ajratib HTML qiladi; HTML berilsa tozalaydi. */
export function richText(input) {
  const source = String(input ?? '').trim();
  if (source === '') return raw('');
  if (/<[a-zA-Z][^>]*>/.test(source)) return raw(sanitizeHtml(source));
  const paragraphs = source
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return raw(paragraphs);
}

/** Massivni berilgan hajmdagi bo'laklarga ajratadi. */
export function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** Massivdan takrorlanmas qiymatlarni qaytaradi. */
export const uniq = (items) => [...new Set(items)];

/** Ob'ektdan "_" bilan boshlanadigan texnik maydonlarni olib tashlaydi. */
export function withoutMeta(object) {
  if (!object || typeof object !== 'object') return object;
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    if (!key.startsWith('_') && key !== '$schema') out[key] = value;
  }
  return out;
}

/** URL yo'lini normallashtiradi: bitta slash, oxirida slash. */
export function joinPath(...parts) {
  const joined = parts
    .filter((p) => p != null && p !== '')
    .join('/')
    .replace(/\/{2,}/g, '/');
  return joined.startsWith('/') ? joined : `/${joined}`;
}
