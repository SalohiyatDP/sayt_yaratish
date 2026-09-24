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
    else if (value === true) node.setAttribute(key, '');
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
