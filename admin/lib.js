/** Boshqaruv paneli uchun yordamchi funksiyalar va API mijozi. */

export const LOCALES = [
  { code: 'uz-cyrl', label: 'ЎЗ', title: "O'zbekcha (kirill)" },
  { code: 'uz', label: 'UZ', title: "O'zbekcha (lotin)" },
  { code: 'ru', label: 'РУ', title: 'Ruscha' },
  { code: 'en', label: 'EN', title: 'Inglizcha' },
];

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    // `<textarea>` `value` atributini tan olmaydi — qiymat matn mazmuni bo'lib
    // turadi. Shu sababli xususiyat orqali yozamiz, aks holda maydon bo'sh
    // ko'rinadi va xodim saqlangan matnni ko'rmaydi.
    else if (key === 'value' && (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT')) {
      node.value = String(value);
      if (node.tagName === 'TEXTAREA') node.textContent = String(value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ko'p tilli qiymatdan ko'rsatish uchun matn oladi. */
export function pick(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  for (const code of ['uz-cyrl', 'uz', 'ru', 'en']) {
    if (typeof value[code] === 'string' && value[code].trim() !== '') return value[code];
  }
  return '';
}

/** Bo'sh ko'p tilli obyekt. */
export const emptyI18n = () => ({ 'uz-cyrl': '', uz: '', ru: '', en: '' });

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h', 'ʻ': '', 'ʼ': '', '‘': '', '’': '',
};

export function slugify(input) {
  let out = '';
  for (const ch of String(input ?? '').toLowerCase().trim()) {
    if (Object.prototype.hasOwnProperty.call(TRANSLIT, ch)) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += '-';
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = Number(bytes);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : Math.round(size * 10) / 10} ${units[unit]}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Chuqur nusxa. */
export const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

/* ─────────────────────────── Bildirishnomalar ─────────────────────────── */

export function toast(message, kind = 'info', timeout = 4000) {
  const stack = qs('#toasts');
  if (!stack) return;
  const node = el('div', { class: `toast toast--${kind}`, role: 'status', text: message });
  stack.append(node);
  setTimeout(() => node.remove(), timeout);
}

/* ─────────────────────────── API ─────────────────────────── */

const HEADERS = { 'X-Requested-With': 'direksiya-admin' };

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) },
  });
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('admin:unauthorized'));
  }
  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  session: () => request('/api/admin/session'),
  setupState: () => request('/api/admin/setup'),
  setup: (payload) =>
    request('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  login: (username, password) =>
    request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/api/admin/logout', { method: 'POST' }),

  getContent: (name) => request(`/api/admin/content/${name}`),
  putContent: (name, data) =>
    request(`/api/admin/content/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  inbox: () => request('/api/admin/inbox'),
  updateInbox: (id, payload) =>
    request(`/api/admin/inbox/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteInbox: (id) => request(`/api/admin/inbox/${id}`, { method: 'DELETE' }),
  resendInbox: (id) => request(`/api/admin/inbox/${id}/resend`, { method: 'POST' }),

  users: () => request('/api/admin/users'),
  saveUser: (payload) =>
    request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteUser: (username) => request(`/api/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  changePassword: (currentPassword, newPassword) =>
    request('/api/admin/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  backups: () => request('/api/admin/backups'),
  restoreBackup: (file) =>
    request('/api/admin/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file }),
    }),

  telegram: () => request('/api/admin/telegram'),
  telegramChats: () => request('/api/admin/telegram/chats'),
  telegramSave: (payload) =>
    request('/api/admin/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  telegramTest: () => request('/api/admin/telegram/test', { method: 'POST' }),
  telegramRetry: () => request('/api/admin/telegram/retry', { method: 'POST' }),

  // AI yordamchisi
  ai: () => request('/api/admin/ai'),
  aiModels: () => request('/api/admin/ai/models'),
  aiSave: (payload) =>
    request('/api/admin/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  aiTest: () => request('/api/admin/ai/test', { method: 'POST' }),
  aiTranslate: (payload) =>
    request('/api/admin/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  aiExtract: (payload) =>
    request('/api/admin/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // Koordinata faylini o'qish — fayl serverda saqlanmaydi
  parseGeoFile: (file) =>
    request(`/api/admin/geo?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    }),

  uploads: () => request('/api/admin/uploads'),
  deleteUpload: (src, force = false) =>
    request(`/api/admin/uploads/${src.replace(/^\/assets\/uploads\//, '')}${force ? '?force=1' : ''}`, {
      method: 'DELETE',
    }),
  upload: (file, folder) =>
    request(`/api/admin/upload?name=${encodeURIComponent(file.name)}&folder=${encodeURIComponent(folder || 'general')}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    }),

  build: (demo = false) =>
    request('/api/admin/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo }),
    }),
  buildInfo: () => request('/api/admin/build-info'),
};

/* ─────────────────────────── Tasdiqlash oynasi ─────────────────────────── */

export function confirmAction(message) {
  // eslint-disable-next-line no-alert
  return window.confirm(message);
}

/* ─────────────────────────── AI holati (umumiy) ───────────────────────────
 * app.js AI yoqilgan/o'chirilganini shu yerga yozadi, fields.js esa o'qiydi.
 * Modullararo oddiy umumiy holat — «AI bilan to'ldirish» tugmasi shunga qarab
 * ko'rinadi.
 */
const aiState = { enabled: false };
export const setAiEnabled = (value) => { aiState.enabled = Boolean(value); };
export const isAiEnabled = () => aiState.enabled;

/* ── Kiril ↔ lotin o'zbek alifbosi ──────────────────────────────────────────
 * o'zbek tilining ikki alifbosi orasida o'girish — bu tarjima emas, faqat
 * harflarni almashtirish. Shuning uchun AIsiz, darhol bajariladi (tekin va tez).
 */

const CYRL_TO_LAT = [
  ['ў', "o'"], ['Ў', "O'"], ['қ', 'q'], ['Қ', 'Q'], ['ғ', "g'"], ['Ғ', "G'"], ['ҳ', 'h'], ['Ҳ', 'H'],
  ['ё', 'yo'], ['Ё', 'Yo'], ['ю', 'yu'], ['Ю', 'Yu'], ['я', 'ya'], ['Я', 'Ya'], ['ч', 'ch'], ['Ч', 'Ch'],
  ['ш', 'sh'], ['Ш', 'Sh'], ['ъ', "'"], ['Ъ', "'"], ['ь', ''], ['Ь', ''],
  ['а', 'a'], ['А', 'A'], ['б', 'b'], ['Б', 'B'], ['в', 'v'], ['В', 'V'], ['г', 'g'], ['Г', 'G'],
  ['д', 'd'], ['Д', 'D'], ['е', 'e'], ['Е', 'E'], ['ж', 'j'], ['Ж', 'J'], ['з', 'z'], ['З', 'Z'],
  ['и', 'i'], ['И', 'I'], ['й', 'y'], ['Й', 'Y'], ['к', 'k'], ['К', 'K'], ['л', 'l'], ['Л', 'L'],
  ['м', 'm'], ['М', 'M'], ['н', 'n'], ['Н', 'N'], ['о', 'o'], ['О', 'O'], ['п', 'p'], ['П', 'P'],
  ['р', 'r'], ['Р', 'R'], ['с', 's'], ['С', 'S'], ['т', 't'], ['Т', 'T'], ['у', 'u'], ['У', 'U'],
  ['ф', 'f'], ['Ф', 'F'], ['х', 'x'], ['Х', 'X'], ['ц', 'ts'], ['Ц', 'Ts'], ['э', 'e'], ['Э', 'E'],
];

// Lotin → kiril: uzunroq birikmalar avval kelishi kerak (sh, ch, yo, o', g')
const LAT_TO_CYRL = [
  ["o'", 'ў'], ["O'", 'Ў'], ["g'", 'ғ'], ["G'", 'Ғ'], ['sh', 'ш'], ['Sh', 'Ш'], ['SH', 'Ш'],
  ['ch', 'ч'], ['Ch', 'Ч'], ['CH', 'Ч'], ['yo', 'ё'], ['Yo', 'Ё'], ['YO', 'Ё'],
  ['yu', 'ю'], ['Yu', 'Ю'], ['YU', 'Ю'], ['ya', 'я'], ['Ya', 'Я'], ['YA', 'Я'],
  ['ts', 'ц'], ['Ts', 'Ц'],
  ['a', 'а'], ['A', 'А'], ['b', 'б'], ['B', 'Б'], ['v', 'в'], ['V', 'В'], ['g', 'г'], ['G', 'Г'],
  ['d', 'д'], ['D', 'Д'], ['e', 'е'], ['E', 'Е'], ['j', 'ж'], ['J', 'Ж'], ['z', 'з'], ['Z', 'З'],
  ['i', 'и'], ['I', 'И'], ['y', 'й'], ['Y', 'Й'], ['k', 'к'], ['K', 'К'], ['l', 'л'], ['L', 'Л'],
  ['m', 'м'], ['M', 'М'], ['n', 'н'], ['N', 'Н'], ['o', 'о'], ['O', 'О'], ['p', 'п'], ['P', 'П'],
  ['q', 'қ'], ['Q', 'Қ'], ['r', 'р'], ['R', 'Р'], ['s', 'с'], ['S', 'С'], ['t', 'т'], ['T', 'Т'],
  ['u', 'у'], ['U', 'У'], ['f', 'ф'], ['F', 'Ф'], ['x', 'х'], ['X', 'Х'], ['h', 'ҳ'], ['H', 'Ҳ'],
];

/** o'zbek matnini kirildan lotinga o'giradi (HTML teglarga tegmaydi). */
export function cyrlToLat(text) {
  return replaceOutsideTags(String(text || ''), (chunk) => {
    let out = chunk;
    for (const [from, to] of CYRL_TO_LAT) out = out.split(from).join(to);
    return out;
  });
}

/** o'zbek matnini lotindan kirilga o'giradi. */
export function latToCyrl(text) {
  return replaceOutsideTags(String(text || ''), (chunk) => {
    let out = '';
    let i = 0;
    while (i < chunk.length) {
      let matched = false;
      for (const [from, to] of LAT_TO_CYRL) {
        if (chunk.startsWith(from, i)) {
          out += to;
          i += from.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        out += chunk[i];
        i += 1;
      }
    }
    return out;
  });
}

/** HTML teglar ichidagi matnga tegmasdan, faqat oddiy matnni almashtiradi. */
function replaceOutsideTags(text, fn) {
  return text.replace(/(<[^>]*>)|([^<]+)/g, (whole, tag, plain) => (tag ? tag : fn(plain)));
}
