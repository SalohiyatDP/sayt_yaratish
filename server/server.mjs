#!/usr/bin/env node
/**
 * Direksiya sayti uchun server.
 * Faqat Node.js ning o'z modullaridan foydalanadi — hech qanday npm paketi kerak emas.
 *
 * Vazifalari:
 *   1. dist/ katalogidagi statik saytni tarqatish
 *   2. /api/contact — murojaatlarni qabul qilish va saqlash
 *   3. /admin/ — vakolatli xodimlar uchun himoyalangan boshqaruv paneli
 *   4. /api/admin/* — kontentni tahrirlash, fayl yuklash, saytni qayta qurish
 *
 * Ishga tushirish:
 *   node server/server.mjs                 # 0.0.0.0:8080
 *   PORT=3000 node server/server.mjs
 *   node server/server.mjs --public-only   # boshqaruv panelisiz, faqat statik sayt
 */
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from './lib/env.mjs';
import * as telegram from './notify/telegram.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// `.env` faylini process.env ga yuklash (mavjud qiymatlar ustidan yozilmaydi)
const ENV_RESULT = loadEnvFile(path.join(ROOT, '.env'));
const DIST = path.join(ROOT, 'dist');
const ADMIN_DIR = path.join(ROOT, 'admin');
const CONTENT_DIR = path.join(ROOT, 'content');
const INBOX_DIR = path.join(CONTENT_DIR, 'inbox');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const argv = process.argv.slice(2);
const PUBLIC_ONLY = argv.includes('--public-only');
const DEV = argv.includes('--dev');

/**
 * Tinglash manzilini aniqlaydi.
 *
 * Turli hosting panellari portni turli nomlar bilan uzatadi (ba'zilari esa
 * TCP port o'rniga Unix soketi yo'lini beradi). Shu sababli bir necha keng
 * tarqalgan nomni tekshiramiz va qaysi biri ishlatilganini jurnalga yozamiz —
 * bu hostingda sozlashni ancha osonlashtiradi.
 */
export function resolveListenTarget() {
  // Buyruq satridagi --port va --host eng yuqori ustunlikka ega
  const cliValue = (name) => {
    const index = argv.indexOf(`--${name}`);
    if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith('--')) return argv[index + 1];
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    return inline ? inline.slice(name.length + 3) : null;
  };

  const cliHost = cliValue('host');
  const cliSocket = cliValue('socket');
  if (cliSocket) {
    return { kind: 'socket', socketPath: cliSocket, source: '--socket bayrog\'i' };
  }

  const cliPort = cliValue('port');
  if (cliPort) {
    // --port ga soket yo'li berilgan bo'lsa ham qabul qilamiz
    if (cliPort.startsWith('/') || cliPort.startsWith('./') || cliPort.endsWith('.sock')) {
      return { kind: 'socket', socketPath: cliPort, source: '--port bayrog\'i (soket yo\'li)' };
    }
    const port = Number(cliPort);
    if (Number.isInteger(port) && port > 0 && port < 65536) {
      return { kind: 'port', port, host: cliHost || process.env.HOST || '0.0.0.0', source: '--port bayrog\'i' };
    }
  }

  const CANDIDATES = ['PORT', 'SOCKET', 'NODE_PORT', 'APP_PORT', 'SERVER_PORT', 'HTTP_PORT'];

  for (const name of CANDIDATES) {
    const raw = process.env[name];
    if (raw == null || String(raw).trim() === '') continue;
    const value = String(raw).trim();

    // Unix soketi: yo'l ko'rinishidagi qiymat
    if (value.startsWith('/') || value.startsWith('./') || value.endsWith('.sock')) {
      return { kind: 'socket', socketPath: value, source: name };
    }

    const port = Number(value);
    if (Number.isInteger(port) && port > 0 && port < 65536) {
      return { kind: 'port', port, host: cliHost || process.env.HOST || '0.0.0.0', source: name };
    }

    console.warn(`  DIQQAT: ${name} o'zgaruvchisidagi "${value}" qiymati port yoki soket yo'li emas — e'tiborsiz qoldirildi.`);
  }

  return { kind: 'port', port: 8080, host: cliHost || process.env.HOST || '0.0.0.0', source: 'odatiy qiymat (hech qanday o\'zgaruvchi berilmagan)' };
}

const LISTEN = resolveListenTarget();
const PORT = LISTEN.port ?? null;
const HOST = LISTEN.host ?? null;

const EDITABLE_FILES = new Set(['site', 'taxonomies', 'pages', 'lots', 'masterplans', 'news']);
const MAX_JSON_BODY = 8 * 1024 * 1024; // 8 MB
const MAX_UPLOAD = 25 * 1024 * 1024; // 25 MB
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 soat

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
};

const ALLOWED_UPLOAD_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg', '.pdf', '.zip']);

/* ─────────────────────────── Sozlash ─────────────────────────── */

for (const dir of [DATA_DIR, BACKUP_DIR, INBOX_DIR, UPLOAD_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const SESSION_SECRET = loadOrCreateSecret();

function loadOrCreateSecret() {
  const file = path.join(DATA_DIR, 'session-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const secret = crypto.randomBytes(48);
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const USERS_FILE = path.join(DATA_DIR, 'admin-users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return Array.isArray(data.users) ? data.users : [];
  } catch (error) {
    console.error('admin-users.json o\'qilmadi:', error.message);
    return [];
  }
}

/** Foydalanuvchilar ro'yxatini saqlaydi (fayl faqat egasi uchun o'qiladi). */
async function saveUsers(users) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(USERS_FILE, `${JSON.stringify({ users }, null, 2)}\n`, { mode: 0o600 });
}

const SCRYPT = { N: 16384, r: 8, p: 3, keylen: 64 };

/** Yangi foydalanuvchi yozuvini yasaydi (parol scrypt bilan xeshlanadi). */
function buildUser({ username, password, role, name }) {
  const salt = crypto.randomBytes(16);
  return {
    username: String(username).toLowerCase(),
    name: name || username,
    role,
    salt: salt.toString('base64'),
    hash: crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }).toString('base64'),
    N: SCRYPT.N,
    p: SCRYPT.p,
    updatedAt: new Date().toISOString(),
  };
}

/** Maxfiy maydonlarsiz ko'rinish — brauzerga faqat shu yuboriladi. */
const publicUser = (user) => ({
  username: user.username,
  name: user.name || user.username,
  role: user.role || 'editor',
  updatedAt: user.updatedAt || null,
});

/* ─────────────────────────── Yordamchilar ─────────────────────────── */

function send(res, status, body, headers = {}) {
  const baseHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...headers,
  };
  res.writeHead(status, baseHeaders);
  res.end(body);
}

function sendJson(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
}

async function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req, limit = MAX_JSON_BODY) {
  const buffer = await readBody(req, limit);
  if (buffer.length === 0) return {};
  return JSON.parse(buffer.toString('utf8'));
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

const b64url = (buffer) => Buffer.from(buffer).toString('base64url');

function signSession(payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verifySession(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function hashPassword(password, salt, iterations = 3, memory = 16384) {
  return crypto.scryptSync(password, salt, 64, { N: memory, r: 8, p: iterations }).toString('base64');
}

function verifyPassword(password, user) {
  try {
    const computed = hashPassword(password, Buffer.from(user.salt, 'base64'), user.p ?? 3, user.N ?? 16384);
    const a = Buffer.from(computed);
    const b = Buffer.from(user.hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (error) {
    return false;
  }
}

/** Oddiy urinishlarni cheklash (xotirada). */
const attempts = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, reset: now + windowMs };
  if (entry.reset < now) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  attempts.set(key, entry);
  return entry.count <= max;
}

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

function sanitizeText(value, maxLength = 2000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function safeFileName(name) {
  const base = path.basename(String(name || '')).replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-');
  return base.replace(/^[-.]+/, '').slice(0, 120) || 'fayl';
}

function logLine(...parts) {
  console.log(`[${new Date().toISOString()}]`, ...parts);
}

/* ─────────────────────────── Statik fayllar ─────────────────────────── */

async function serveStatic(req, res, baseDir, urlPath, { cacheable = true } = {}) {
  let relative = decodeURIComponent(urlPath.split('?')[0]);
  if (relative.includes('\0')) return false;

  let target = path.join(baseDir, relative);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(baseDir))) return false; // katalogdan chiqishga yo'l qo'yilmaydi

  let stat = await fsp.stat(resolved).catch(() => null);
  if (stat && stat.isDirectory()) {
    const indexFile = path.join(resolved, 'index.html');
    stat = await fsp.stat(indexFile).catch(() => null);
    if (!stat) return false;
    target = indexFile;
  } else if (!stat) {
    return false;
  } else {
    target = resolved;
  }

  const ext = path.extname(target).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;

  if (req.headers['if-none-match'] === etag) {
    send(res, 304, '');
    return true;
  }

  const immutable = cacheable && /\/assets\/(uploads|img|css|js)\//.test(relative);
  const headers = {
    'Content-Type': type,
    'Content-Length': String(stat.size),
    ETag: etag,
    'Last-Modified': new Date(stat.mtimeMs).toUTCString(),
    'Cache-Control': ext === '.html' || !cacheable ? 'no-cache' : immutable ? 'public, max-age=3600' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };
  if (ext === '.svg') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'";

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(target).pipe(res);
  return true;
}

/* ─────────────────────────── Salomatlik tekshiruvi ─────────────────────────── */

/**
 * GET /api/health — serverning ishlash holati.
 *
 * Monitoring xizmatlari, hosting salomatlik tekshiruvlari va yuklamani
 * taqsimlovchilar (load balancer) uchun. Maxfiy ma'lumot qaytarmaydi:
 * bot tokeni, chat_id, foydalanuvchi nomlari va murojaat mazmuni chiqmaydi.
 *
 * 200 — hammasi joyida; 503 — sayt qurilmagan (dist/ yo'q).
 */
function handleHealth(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const siteBuilt = fs.existsSync(path.join(DIST, 'index.html'));

  let build = null;
  try {
    const info = JSON.parse(fs.readFileSync(path.join(DIST, 'build-info.json'), 'utf8'));
    build = {
      date: info.isoDate ?? null,
      dateTime: info.isoDateTime ?? null,
      demo: Boolean(info.demo),
      pages: info.pages ?? null,
      lots: info.lots ?? null,
      masterplans: info.masterplans ?? null,
      news: info.news ?? null,
      warnings: Array.isArray(info.warnings) ? info.warnings.length : 0,
    };
  } catch (error) {
    build = null;
  }

  let contactForm = null;
  try {
    const site = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'site.json'), 'utf8'));
    contactForm = site?.features?.contactFormEndpoint ? 'enabled' : 'disabled';
  } catch (error) {
    contactForm = null;
  }

  const tg = telegram.getConfig();

  const body = {
    ok: siteBuilt,
    status: siteBuilt ? 'ok' : 'site_not_built',
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    checkedAt: new Date().toISOString(),
    site: { built: siteBuilt, build },
    features: {
      adminPanel: !PUBLIC_ONLY,
      contactForm,
      // Faqat sozlanganligi ko'rsatiladi — token va chat_id oshkor qilinmaydi.
      telegram: tg.disabled ? 'disabled' : tg.enabled ? 'configured' : 'not_configured',
    },
  };

  return sendJson(res, siteBuilt ? 200 : 503, body);
}

/* ─────────────────────────── Murojaat shakli ─────────────────────────── */

async function handleContact(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  const ip = clientIp(req);
  if (!rateLimit(`contact:${ip}`, 5, 10 * 60 * 1000)) {
    return sendJson(res, 429, { ok: false, error: 'too_many_requests' });
  }

  let payload;
  try {
    payload = await readJsonBody(req, 256 * 1024);
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: 'invalid_body' });
  }

  const record = {
    name: sanitizeText(payload.name, 200),
    organization: sanitizeText(payload.organization, 200),
    phone: sanitizeText(payload.phone, 50),
    email: sanitizeText(payload.email, 200),
    area: sanitizeText(payload.area, 200),
    message: sanitizeText(payload.message, 5000),
    consent: payload.consent === true,
    locale: sanitizeText(payload.locale, 20),
    page: sanitizeText(payload.page, 500),
  };

  const errors = [];
  if (!record.name) errors.push('name');
  if (!record.message) errors.push('message');
  if (!record.phone && !record.email) errors.push('contact');
  if (record.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(record.email)) errors.push('email');
  if (!record.consent) errors.push('consent');
  if (errors.length > 0) return sendJson(res, 422, { ok: false, error: 'validation', fields: errors });

  // Ro'yxatga olish raqami: YIL-OY-KUN-XXXX
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  const id = `${datePart}-${randomPart}`;

  const stored = {
    id,
    receivedAt: now.toISOString(),
    status: 'new',
    ip: crypto.createHash('sha256').update(ip + SESSION_SECRET.toString('hex')).digest('hex').slice(0, 16),
    userAgent: sanitizeText(req.headers['user-agent'], 300),
    ...record,
  };

  try {
    // Xabar diskka yozilmasa, foydalanuvchiga muvaffaqiyat haqida xabar berilmaydi.
    await fsp.writeFile(path.join(INBOX_DIR, `${id}.json`), JSON.stringify(stored, null, 2), { mode: 0o600 });
    await fsp.appendFile(
      path.join(INBOX_DIR, 'index.log'),
      `${stored.receivedAt}\t${id}\t${record.name}\t${record.email || record.phone}\n`,
    );
  } catch (error) {
    logLine('MUROJAAT SAQLANMADI:', error.message);
    return sendJson(res, 500, { ok: false, error: 'not_saved' });
  }

  logLine(`Yangi murojaat qabul qilindi: ${id}`);

  // Murojaat diskka yozilgani uchun foydalanuvchiga darhol javob beramiz.
  // Telegramga yuborish esa fonda davom etadi — bot ishlamasa ham murojaat yo'qolmaydi.
  sendJson(res, 201, { ok: true, id });

  deliverToTelegram(stored).catch((error) => logLine('Telegram: kutilmagan xatolik —', error.message));
  return undefined;
}

/**
 * Murojaatni Telegram botga yuboradi va natijani murojaat yozuviga qo'shadi.
 * Bu funksiya foydalanuvchiga javob berilgandan keyin ishlaydi.
 */
async function deliverToTelegram(record) {
  const config = telegram.getConfig();
  if (!config.enabled) {
    const reason = config.disabled
      ? 'yuborish vaqtincha o\'chirilgan'
      : !config.botToken
        ? 'bot tokeni kiritilmagan'
        : 'chat_id kiritilmagan';
    // Sababni yozuvga ham qo'shamiz — boshqaruv panelida ko'rinadi.
    await patchInboxRecord(record.id, {
      telegram: { delivered: false, skipped: true, attempts: 0, error: reason, at: new Date().toISOString() },
    });
    logLine(`Telegram: ${reason} — ${record.id} faqat murojaatlar qutisida saqlandi.`);
    return;
  }

  const status = await telegram.notifyContact(record, { adminUrl: adminPanelUrl() });
  await patchInboxRecord(record.id, { telegram: status });

  if (status.delivered) {
    logLine(`Telegram: ${record.id} yuborildi (chat ${status.chatId}, urinish ${status.attempts}).`);
  } else {
    logLine(`Telegram: ${record.id} YUBORILMADI — ${status.error}${status.permanent ? ' (qaytarib bo\'lmaydigan xatolik)' : ''}`);
  }
}

/** Murojaat yozuvining bir qismini yangilaydi. */
async function patchInboxRecord(id, patch) {
  const file = path.join(INBOX_DIR, `${safeFileName(id)}.json`);
  try {
    const current = JSON.parse(await fsp.readFile(file, 'utf8'));
    await fsp.writeFile(file, JSON.stringify({ ...current, ...patch }, null, 2), { mode: 0o600 });
    return true;
  } catch (error) {
    logLine(`Murojaat yozuvi yangilanmadi (${id}): ${error.message}`);
    return false;
  }
}

/** Telegram xabaridagi tugma uchun boshqaruv paneli manzili. */
function adminPanelUrl() {
  const configured = String(process.env.SITE_ORIGIN || '').replace(/\/$/, '');
  if (configured) return `${configured}/admin/`;
  try {
    const site = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'site.json'), 'utf8'));
    const origin = String(site?.seo?.canonicalOrigin || '').replace(/\/$/, '');
    return origin ? `${origin}/admin/` : null;
  } catch (error) {
    return null;
  }
}

/* ─────────────────────────── Boshqaruv paneli API ─────────────────────────── */

function requireAdmin(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySession(cookies.direksiya_session);
  if (!session) {
    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  // Oddiy CSRF himoyasi: brauzerdan kelgan so'rovda maxsus sarlavha bo'lishi shart
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'direksiya-admin') {
    sendJson(res, 403, { ok: false, error: 'csrf' });
    return null;
  }
  return session;
}

async function handleAdminApi(req, res, url) {
  const route = url.pathname.replace(/^\/api\/admin\/?/, '');

  /* ── Kirish ── */
  if (route === 'login' && req.method === 'POST') {
    const ip = clientIp(req);
    if (!rateLimit(`login:${ip}`, 8, 15 * 60 * 1000)) {
      return sendJson(res, 429, { ok: false, error: 'too_many_attempts' });
    }
    const users = loadUsers();
    if (users.length === 0) {
      return sendJson(res, 503, { ok: false, error: 'no_users' });
    }
    let payload;
    try {
      payload = await readJsonBody(req, 8 * 1024);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: 'invalid_body' });
    }
    const username = sanitizeText(payload.username, 80).toLowerCase();
    const password = String(payload.password || '');
    const user = users.find((candidate) => String(candidate.username).toLowerCase() === username);

    // Vaqt bo'yicha tahlilni qiyinlashtirish uchun foydalanuvchi topilmasa ham hisoblash bajariladi
    const ok = user ? verifyPassword(password, user) : verifyPassword(password, {
      salt: crypto.randomBytes(16).toString('base64'),
      hash: 'x',
    });

    if (!user || !ok) {
      logLine(`Kirish muvaffaqiyatsiz: ${username} (${ip})`);
      return sendJson(res, 401, { ok: false, error: 'invalid_credentials' });
    }

    const token = signSession({
      sub: user.username,
      role: user.role || 'editor',
      name: user.name || user.username,
      exp: Date.now() + SESSION_TTL,
    });
    logLine(`Kirish: ${user.username} (${ip})`);
    return sendJson(res, 200, { ok: true, user: { username: user.username, name: user.name, role: user.role } }, {
      'Set-Cookie': `direksiya_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}${DEV ? '' : '; Secure'}`,
    });
  }

  if (route === 'logout' && req.method === 'POST') {
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': 'direksiya_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0',
    });
  }

  if (route === 'session' && req.method === 'GET') {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySession(cookies.direksiya_session);
    const users = loadUsers();
    return sendJson(res, 200, {
      ok: true,
      authenticated: Boolean(session),
      configured: users.length > 0,
      user: session ? { username: session.sub, name: session.name, role: session.role } : null,
    });
  }

  /* ── Quyidagilar uchun kirish talab qilinadi ── */
  const session = requireAdmin(req, res);
  if (!session) return undefined;

  // Kontent fayllari
  const contentMatch = /^content\/([a-z]+)$/.exec(route);
  if (contentMatch) {
    const name = contentMatch[1];
    if (!EDITABLE_FILES.has(name)) return sendJson(res, 404, { ok: false, error: 'unknown_file' });
    const file = path.join(CONTENT_DIR, `${name}.json`);

    if (req.method === 'GET') {
      const text = await fsp.readFile(file, 'utf8').catch(() => '{}');
      return sendJson(res, 200, { ok: true, name, data: JSON.parse(text) });
    }

    if (req.method === 'PUT') {
      if (session.role === 'viewer') return sendJson(res, 403, { ok: false, error: 'read_only' });
      let payload;
      try {
        payload = await readJsonBody(req);
      } catch (error) {
        return sendJson(res, 400, { ok: false, error: 'invalid_json' });
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return sendJson(res, 400, { ok: false, error: 'invalid_shape' });
      }
      // Zaxira nusxa
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const current = await fsp.readFile(file, 'utf8').catch(() => null);
      if (current != null) {
        await fsp.writeFile(path.join(BACKUP_DIR, `${name}-${stamp}.json`), current);
        await pruneBackups(name);
      }
      await fsp.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      logLine(`Kontent saqlandi: ${name}.json (${session.sub})`);
      return sendJson(res, 200, { ok: true, name, savedAt: new Date().toISOString() });
    }
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  // Murojaatlar qutisi
  if (route === 'inbox' && req.method === 'GET') {
    const files = (await fsp.readdir(INBOX_DIR).catch(() => [])).filter((f) => f.endsWith('.json'));
    const items = [];
    for (const file of files) {
      try {
        const data = JSON.parse(await fsp.readFile(path.join(INBOX_DIR, file), 'utf8'));
        items.push(data);
      } catch (error) {
        /* buzilgan fayl — o'tkazib yuboriladi */
      }
    }
    items.sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
    return sendJson(res, 200, { ok: true, items, count: items.length });
  }

  const inboxMatch = /^inbox\/([\w-]+)$/.exec(route);
  if (inboxMatch) {
    const file = path.join(INBOX_DIR, `${safeFileName(inboxMatch[1])}.json`);
    if (req.method === 'PATCH') {
      const payload = await readJsonBody(req, 16 * 1024).catch(() => ({}));
      const existing = JSON.parse(await fsp.readFile(file, 'utf8').catch(() => 'null'));
      if (!existing) return sendJson(res, 404, { ok: false, error: 'not_found' });
      existing.status = ['new', 'in-progress', 'answered', 'archived'].includes(payload.status)
        ? payload.status
        : existing.status;
      existing.note = sanitizeText(payload.note, 2000);
      existing.updatedBy = session.sub;
      existing.updatedAt = new Date().toISOString();
      await fsp.writeFile(file, JSON.stringify(existing, null, 2));
      return sendJson(res, 200, { ok: true, item: existing });
    }
    if (req.method === 'DELETE') {
      if (session.role !== 'admin') return sendJson(res, 403, { ok: false, error: 'admin_only' });
      await fsp.unlink(file).catch(() => undefined);
      logLine(`Murojaat o'chirildi: ${inboxMatch[1]} (${session.sub})`);
      return sendJson(res, 200, { ok: true });
    }
  }

  // Murojaatni Telegramga qayta yuborish
  const resendMatch = /^inbox\/([\w-]+)\/resend$/.exec(route);
  if (resendMatch && req.method === 'POST') {
    if (session.role === 'viewer') return sendJson(res, 403, { ok: false, error: 'read_only' });
    const file = path.join(INBOX_DIR, `${safeFileName(resendMatch[1])}.json`);
    const record = JSON.parse(await fsp.readFile(file, 'utf8').catch(() => 'null'));
    if (!record) return sendJson(res, 404, { ok: false, error: 'not_found' });

    const status = await telegram.notifyContact(record, { adminUrl: adminPanelUrl() });
    await patchInboxRecord(record.id, { telegram: status });
    logLine(`Telegram: ${record.id} qayta yuborildi (${session.sub}) — ${status.delivered ? 'muvaffaqiyatli' : status.error}`);
    return sendJson(res, status.delivered ? 200 : 502, { ok: status.delivered, telegram: status });
  }

  /* ── Foydalanuvchilar ── */

  if (route === 'users' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, users: loadUsers().map(publicUser), me: session.sub });
  }

  if (route === 'users' && req.method === 'POST') {
    if (session.role !== 'admin') return sendJson(res, 403, { ok: false, error: 'admin_only' });
    let payload;
    try {
      payload = await readJsonBody(req, 8 * 1024);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: 'invalid_body' });
    }

    const username = sanitizeText(payload.username, 80).toLowerCase();
    const password = String(payload.password || '');
    const role = ['admin', 'editor', 'viewer'].includes(payload.role) ? payload.role : 'editor';
    const name = sanitizeText(payload.name, 120) || username;

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return sendJson(res, 422, { ok: false, error: 'username_format' });
    }

    const users = loadUsers();
    const index = users.findIndex((user) => String(user.username).toLowerCase() === username);

    // Mavjud foydalanuvchida parol bo'sh qoldirilsa — faqat rol va ism yangilanadi
    if (index === -1 || password !== '') {
      if (password.length < 12) return sendJson(res, 422, { ok: false, error: 'password_short' });
    }

    // Oxirgi adminni boshqa rolga o'tkazib qo'yishdan saqlanamiz
    if (index !== -1 && users[index].role === 'admin' && role !== 'admin') {
      const admins = users.filter((user) => user.role === 'admin').length;
      if (admins <= 1) return sendJson(res, 409, { ok: false, error: 'last_admin' });
    }

    if (index === -1) {
      users.push(buildUser({ username, password, role, name }));
    } else if (password !== '') {
      users[index] = { ...users[index], ...buildUser({ username, password, role, name }) };
    } else {
      users[index] = { ...users[index], role, name, updatedAt: new Date().toISOString() };
    }

    await saveUsers(users);
    logLine(`Foydalanuvchi ${index === -1 ? 'yaratildi' : 'yangilandi'}: ${username} (${role}) — ${session.sub}`);
    return sendJson(res, 200, { ok: true, users: users.map(publicUser) });
  }

  const userMatch = /^users\/([\w.-]+)$/.exec(route);
  if (userMatch && req.method === 'DELETE') {
    if (session.role !== 'admin') return sendJson(res, 403, { ok: false, error: 'admin_only' });
    const target = decodeURIComponent(userMatch[1]).toLowerCase();

    if (target === String(session.sub).toLowerCase()) {
      return sendJson(res, 409, { ok: false, error: 'cannot_delete_self' });
    }

    const users = loadUsers();
    const remaining = users.filter((user) => String(user.username).toLowerCase() !== target);
    if (remaining.length === users.length) return sendJson(res, 404, { ok: false, error: 'not_found' });
    if (remaining.filter((user) => user.role === 'admin').length === 0) {
      return sendJson(res, 409, { ok: false, error: 'last_admin' });
    }

    await saveUsers(remaining);
    logLine(`Foydalanuvchi o'chirildi: ${target} (${session.sub})`);
    return sendJson(res, 200, { ok: true, users: remaining.map(publicUser) });
  }

  // O'z parolini o'zgartirish — har qanday rol uchun
  if (route === 'password' && req.method === 'POST') {
    let payload;
    try {
      payload = await readJsonBody(req, 8 * 1024);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: 'invalid_body' });
    }
    const current = String(payload.currentPassword || '');
    const next = String(payload.newPassword || '');
    if (next.length < 12) return sendJson(res, 422, { ok: false, error: 'password_short' });

    const users = loadUsers();
    const index = users.findIndex((user) => String(user.username).toLowerCase() === String(session.sub).toLowerCase());
    if (index === -1) return sendJson(res, 404, { ok: false, error: 'not_found' });
    if (!verifyPassword(current, users[index])) {
      return sendJson(res, 401, { ok: false, error: 'wrong_password' });
    }

    users[index] = {
      ...users[index],
      ...buildUser({ username: users[index].username, password: next, role: users[index].role, name: users[index].name }),
    };
    await saveUsers(users);
    logLine(`Parol o'zgartirildi: ${session.sub}`);
    return sendJson(res, 200, { ok: true });
  }

  /* ── Zaxira nusxalar ── */

  if (route === 'backups' && req.method === 'GET') {
    const files = (await fsp.readdir(BACKUP_DIR).catch(() => [])).filter((file) => file.endsWith('.json'));
    const items = [];
    for (const file of files) {
      const stat = await fsp.stat(path.join(BACKUP_DIR, file)).catch(() => null);
      const match = /^([a-z]+)-(.+)\.json$/.exec(file);
      items.push({
        file,
        content: match ? match[1] : null,
        savedAt: stat?.mtime ?? null,
        sizeBytes: stat?.size ?? null,
      });
    }
    items.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    return sendJson(res, 200, { ok: true, items });
  }

  if (route === 'backups/restore' && req.method === 'POST') {
    if (session.role === 'viewer') return sendJson(res, 403, { ok: false, error: 'read_only' });
    let payload;
    try {
      payload = await readJsonBody(req, 8 * 1024);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: 'invalid_body' });
    }
    const file = safeFileName(payload.file || '');
    const match = /^([a-z]+)-.+\.json$/.exec(file);
    if (!match || !EDITABLE_FILES.has(match[1])) {
      return sendJson(res, 422, { ok: false, error: 'invalid_file' });
    }
    const source = path.join(BACKUP_DIR, file);
    if (!fs.existsSync(source)) return sendJson(res, 404, { ok: false, error: 'not_found' });

    const name = match[1];
    const target = path.join(CONTENT_DIR, `${name}.json`);

    // Tiklashdan oldin joriy holatni ham zaxiraga olamiz
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const current = await fsp.readFile(target, 'utf8').catch(() => null);
    if (current != null) await fsp.writeFile(path.join(BACKUP_DIR, `${name}-${stamp}.json`), current);

    const restored = await fsp.readFile(source, 'utf8');
    try {
      JSON.parse(restored);
    } catch (error) {
      return sendJson(res, 422, { ok: false, error: 'invalid_json' });
    }
    await fsp.writeFile(target, restored, 'utf8');
    logLine(`Zaxiradan tiklandi: ${file} → ${name}.json (${session.sub})`);
    return sendJson(res, 200, { ok: true, name });
  }

  /* ── Telegram sozlamalari ── */

  if (route === 'telegram' && req.method === 'GET') {
    const report = await telegram.diagnose();
    let contactEndpoint = null;
    try {
      const site = JSON.parse(await fsp.readFile(path.join(CONTENT_DIR, 'site.json'), 'utf8'));
      contactEndpoint = site?.features?.contactFormEndpoint ?? null;
    } catch (error) {
      contactEndpoint = null;
    }
    return sendJson(res, 200, { ok: true, report, contactEndpoint, envFileLoaded: ENV_RESULT.loaded });
  }

  if (route === 'telegram/config' && req.method === 'POST') {
    if (session.role !== 'admin') return sendJson(res, 403, { ok: false, error: 'admin_only' });
    let payload;
    try {
      payload = await readJsonBody(req, 16 * 1024);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: 'invalid_body' });
    }

    const patch = {};
    if (typeof payload.botToken === 'string') {
      const token = payload.botToken.trim();
      if (token !== '' && !/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token)) {
        return sendJson(res, 422, { ok: false, error: 'token_format' });
      }
      patch.botToken = token;
    }
    if (typeof payload.chatId === 'string') {
      const chatId = payload.chatId.trim();
      if (chatId !== '' && !/^(-?\d{1,20}|@[A-Za-z][\w]{4,31})$/.test(chatId)) {
        return sendJson(res, 422, { ok: false, error: 'chat_id_format' });
      }
      patch.chatId = chatId;
    }
    if (typeof payload.threadId === 'string') {
      const threadId = payload.threadId.trim();
      if (threadId !== '' && !/^\d{1,20}$/.test(threadId)) {
        return sendJson(res, 422, { ok: false, error: 'thread_id_format' });
      }
      patch.threadId = threadId;
    }
    if (typeof payload.disabled === 'boolean') patch.disabled = payload.disabled;

    await telegram.saveConfig(patch);
    logLine(`Telegram sozlamalari yangilandi (${session.sub})`);
    const report = await telegram.diagnose();
    return sendJson(res, 200, { ok: true, report });
  }

  if (route === 'telegram/test' && req.method === 'POST') {
    if (session.role === 'viewer') return sendJson(res, 403, { ok: false, error: 'read_only' });
    const result = await telegram.sendTestMessage(`Yuborgan xodim: ${session.sub}`);
    logLine(`Telegram sinov xabari (${session.sub}) — ${result.delivered ? 'yuborildi' : result.error}`);
    return sendJson(res, result.delivered ? 200 : 502, { ok: result.delivered, result });
  }

  if (route === 'telegram/chats' && req.method === 'GET') {
    // getUpdates orqali oxirgi xabar yuborilgan chatlarni aniqlash — chat_id ni topish uchun
    const config = telegram.getConfig();
    if (!config.botToken) return sendJson(res, 400, { ok: false, error: 'bot_token_yoq' });
    const updates = await telegram.callApi('getUpdates', { limit: 50, allowed_updates: ['message', 'channel_post'] }, config);
    if (!updates.ok) return sendJson(res, 502, { ok: false, error: updates.error });

    const chats = new Map();
    for (const update of updates.result || []) {
      const chat = update.message?.chat || update.channel_post?.chat;
      if (chat && !chats.has(chat.id)) {
        chats.set(chat.id, {
          id: String(chat.id),
          type: chat.type,
          title: chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || null,
        });
      }
    }
    return sendJson(res, 200, { ok: true, chats: [...chats.values()] });
  }

  // Fayl yuklash: POST /api/admin/upload?name=fayl.jpg&folder=photos
  if (route === 'upload' && req.method === 'POST') {
    if (session.role === 'viewer') return sendJson(res, 403, { ok: false, error: 'read_only' });
    const name = safeFileName(url.searchParams.get('name') || '');
    const ext = path.extname(name).toLowerCase();
    if (!ALLOWED_UPLOAD_EXT.has(ext)) {
      return sendJson(res, 415, { ok: false, error: 'unsupported_type', allowed: [...ALLOWED_UPLOAD_EXT] });
    }
    const folder = safeFileName(url.searchParams.get('folder') || 'general').toLowerCase();
    const targetDir = path.join(UPLOAD_DIR, folder);
    await fsp.mkdir(targetDir, { recursive: true });

    let buffer;
    try {
      buffer = await readBody(req, MAX_UPLOAD);
    } catch (error) {
      return sendJson(res, 413, { ok: false, error: 'too_large', maxBytes: MAX_UPLOAD });
    }
    if (buffer.length === 0) return sendJson(res, 400, { ok: false, error: 'empty' });

    const stamp = Date.now().toString(36);
    const finalName = `${path.basename(name, ext)}-${stamp}${ext}`;
    await fsp.writeFile(path.join(targetDir, finalName), buffer);
    const publicPath = `/assets/uploads/${folder}/${finalName}`;
    // dist/ ga ham nusxalash — saytni qayta qurmasdan darhol ko'rinadi
    const distTarget = path.join(DIST, 'assets', 'uploads', folder);
    await fsp.mkdir(distTarget, { recursive: true }).catch(() => undefined);
    await fsp.writeFile(path.join(distTarget, finalName), buffer).catch(() => undefined);

    logLine(`Fayl yuklandi: ${publicPath} (${session.sub}, ${buffer.length} bayt)`);
    return sendJson(res, 201, { ok: true, src: publicPath, sizeBytes: buffer.length });
  }

  // Yuklangan fayllar ro'yxati
  if (route === 'uploads' && req.method === 'GET') {
    const items = [];
    const walk = async (dir, prefix) => {
      for (const entry of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full, `${prefix}/${entry.name}`);
        else {
          const stat = await fsp.stat(full).catch(() => null);
          items.push({ src: `${prefix}/${entry.name}`, sizeBytes: stat?.size ?? null, modifiedAt: stat?.mtime ?? null });
        }
      }
    };
    await walk(UPLOAD_DIR, '/assets/uploads');
    items.sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
    return sendJson(res, 200, { ok: true, items });
  }

  // Saytni qayta qurish
  if (route === 'build' && req.method === 'POST') {
    if (session.role === 'viewer') return sendJson(res, 403, { ok: false, error: 'read_only' });
    const payload = await readJsonBody(req, 4 * 1024).catch(() => ({}));
    const result = await runBuild(Boolean(payload.demo));
    logLine(`Sayt qayta qurildi (${session.sub}), natija: ${result.code === 0 ? 'muvaffaqiyatli' : 'xatolik'}`);
    return sendJson(res, result.code === 0 ? 200 : 500, { ok: result.code === 0, output: result.output });
  }

  if (route === 'build-info' && req.method === 'GET') {
    const text = await fsp.readFile(path.join(DIST, 'build-info.json'), 'utf8').catch(() => null);
    return sendJson(res, 200, { ok: true, info: text ? JSON.parse(text) : null });
  }

  return sendJson(res, 404, { ok: false, error: 'not_found' });
}

async function pruneBackups(name, keep = 20) {
  const files = (await fsp.readdir(BACKUP_DIR).catch(() => []))
    .filter((file) => file.startsWith(`${name}-`))
    .sort()
    .reverse();
  for (const file of files.slice(keep)) {
    await fsp.unlink(path.join(BACKUP_DIR, file)).catch(() => undefined);
  }
}

function runBuild(demo) {
  return new Promise((resolve) => {
    const args = [path.join(ROOT, 'src', 'build.mjs')];
    if (demo) args.push('--demo');
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    const child = spawn(process.execPath, args, { cwd: ROOT, env });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, output: output.slice(-8000) }));
    child.on('error', (error) => resolve({ code: 1, output: error.message }));
  });
}

/* ─────────────────────────── So'rovlarni yo'naltirish ─────────────────────────── */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return send(res, 405, 'Method Not Allowed');
    }

    // Salomatlik tekshiruvi (hosting, monitoring va yuklamani taqsimlovchi uchun)
    if (url.pathname === '/api/health') return handleHealth(req, res);

    // Murojaat shakli
    if (url.pathname === '/api/contact') return await handleContact(req, res);

    // Boshqaruv paneli API
    if (url.pathname.startsWith('/api/admin')) {
      if (PUBLIC_ONLY) return sendJson(res, 404, { ok: false, error: 'admin_disabled' });
      return await handleAdminApi(req, res, url);
    }

    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { ok: false, error: 'not_found' });

    // Boshqaruv paneli sahifalari
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      if (PUBLIC_ONLY) return send(res, 404, 'Not Found');
      const relative = url.pathname.replace(/^\/admin\/?/, '') || 'index.html';
      const served = await serveStatic(req, res, ADMIN_DIR, `/${relative}`, { cacheable: false });
      if (served) return undefined;
      return await serveStatic(req, res, ADMIN_DIR, '/index.html', { cacheable: false }).then((ok) =>
        ok ? undefined : send(res, 404, 'Not Found'),
      );
    }

    // Yuklangan fayllar (dist/ ga hali nusxalanmagan bo'lsa ham ishlaydi)
    if (url.pathname.startsWith('/assets/uploads/')) {
      const relative = url.pathname.replace('/assets/uploads', '');
      if (await serveStatic(req, res, UPLOAD_DIR, relative)) return undefined;
    }

    // Statik sayt
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await serveStatic(req, res, DIST, url.pathname)) return undefined;

      // Slash qo'shib qayta urinish (/uz/areas → /uz/areas/)
      if (!url.pathname.endsWith('/')) {
        if (await serveStatic(req, res, DIST, `${url.pathname}/`)) return undefined;
      }

      // 404 sahifasi
      const notFound = path.join(DIST, '404.html');
      if (fs.existsSync(notFound)) {
        const body = await fsp.readFile(notFound);
        return send(res, 404, body, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      }
      return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    return send(res, 404, 'Not Found');
  } catch (error) {
    if (error?.statusCode === 413) return sendJson(res, 413, { ok: false, error: 'too_large' });
    logLine('Server xatoligi:', error.stack || error.message);
    if (!res.headersSent) return sendJson(res, 500, { ok: false, error: 'server_error' });
    return res.end();
  }
});

/**
 * Unix soketini tinglashga tayyorlaydi:
 *   • ota katalog mavjud bo'lmasa — yaratadi
 *   • eski jarayondan qolgan soket faylini o'chiradi
 *     (aks holda EADDRINUSE xatoligi chiqadi)
 */
function prepareSocket(socketPath) {
  const dir = path.dirname(socketPath);

  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  Soket katalogi yaratildi: ${dir}`);
    } catch (error) {
      console.error('');
      console.error(`  XATOLIK: soket katalogini yaratish imkoni bo'lmadi: ${dir}`);
      console.error(`  ${error.message}`);
      console.error('  Katalogni qo\'lda yaratib, huquqlarni to\'g\'rilang.');
      console.error('');
      process.exit(1);
    }
  }

  try {
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
      console.log(`  Eski soket fayli tozalandi: ${socketPath}`);
    }
  } catch (error) {
    console.error(`  DIQQAT: eski soket faylini o'chirish imkoni bo'lmadi — ${error.message}`);
  }
}

/**
 * Soket fayliga kirish huquqini belgilaydi.
 *
 * Veb-server (nginx) soketga ulanishi uchun huquq yetarli bo'lishi kerak.
 * Odatiy qiymat 0660 — egasi va guruh. Agar nginx boshqa foydalanuvchi ostida
 * ishlasa va guruhga kirmasa, «502 Bad Gateway / Permission denied» chiqadi.
 * Bunday holatda SOCKET_MODE=666 qilib qo'yish mumkin.
 */
function applySocketMode(socketPath) {
  const raw = String(process.env.SOCKET_MODE || '660').replace(/^0o?/, '');
  const mode = Number.parseInt(raw, 8);
  const safeMode = Number.isInteger(mode) && mode > 0 && mode <= 0o777 ? mode : 0o660;
  try {
    fs.chmodSync(socketPath, safeMode);
    return safeMode.toString(8).padStart(3, '0');
  } catch (error) {
    console.error(`  DIQQAT: soket huquqini o'zgartirish imkoni bo'lmadi — ${error.message}`);
    return null;
  }
}

if (LISTEN.kind === 'socket') prepareSocket(LISTEN.socketPath);

const onListening = () => {
  const users = loadUsers();
  console.log('');
  console.log('  Direksiya sayti serveri ishga tushdi');

  if (LISTEN.kind === 'socket') {
    const mode = applySocketMode(LISTEN.socketPath);
    console.log(`  Tinglanmoqda:      Unix soketi ${LISTEN.socketPath}`);
    if (mode) console.log(`  Soket huquqi:      ${mode}${process.env.SOCKET_MODE ? ' (SOCKET_MODE)' : ''}`);
  } else {
    console.log(`  Manzil:            http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  }
  console.log(`  Port manbasi:      ${LISTEN.source}`);
  console.log(`  Jarayon raqami:    ${process.pid}`);

  if (!fs.existsSync(DIST)) {
    console.log('  DIQQAT: dist/ katalogi topilmadi — sayt qurilmagan.');
    console.log('          Bajaring: node src/build.mjs');
  }
  if (PUBLIC_ONLY) {
    console.log('  Boshqaruv paneli:  o\'chirilgan (--public-only)');
  } else {
    console.log(`  Boshqaruv paneli:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/admin/`);
    if (users.length === 0) {
      console.log('  DIQQAT: boshqaruv paneli foydalanuvchisi yaratilmagan.');
      console.log('          Yaratish uchun: npm run admin:password -- <foydalanuvchi> <parol>');
    } else {
      console.log(`  Foydalanuvchilar:  ${users.length} ta`);
    }
  }
  if (ENV_RESULT.loaded) {
    console.log(`  .env fayli:        yuklandi (${ENV_RESULT.keys.length} ta o'zgaruvchi)`);
  }

  const tg = telegram.getConfig();
  if (tg.enabled) {
    console.log(`  Telegram:          ulangan → chat ${tg.chatId}${tg.threadId ? `, mavzu ${tg.threadId}` : ''}`);
  } else if (tg.disabled) {
    console.log('  Telegram:          vaqtincha o\'chirilgan');
  } else if (!tg.botToken) {
    console.log('  Telegram:          sozlanmagan (bot tokeni yo\'q)');
    console.log('                     Sozlash: node server/tools/telegram-setup.mjs <token>');
  } else {
    console.log('  Telegram:          bot tokeni bor, lekin chat_id kiritilmagan');
    console.log('                     Sozlash: node server/tools/telegram-setup.mjs');
  }

  if (DEV) console.log('  Rejim:             DEV (cookie Secure bayrog\'isiz — faqat mahalliy sinov uchun)');
  console.log('');
};

server.on('error', (error) => {
  console.error('');
  console.error('  ════════════════════════════════════════════════════════════');

  if (error.code === 'ENOENT' && LISTEN.kind === 'socket') {
    console.error(`  SERVER ISHGA TUSHMADI: soket yo'li mavjud emas.`);
    console.error('');
    console.error(`  Yo'l: ${LISTEN.socketPath}`);
    console.error(`  Katalog: ${path.dirname(LISTEN.socketPath)}`);
    console.error('');
    console.error('  Katalogni yaratib, huquqlarni to\'g\'rilang, so\'ngra qayta ishga tushiring.');
  } else if (error.code === 'EADDRINUSE' && LISTEN.kind === 'socket') {
    console.error(`  SERVER ISHGA TUSHMADI: soket fayli band.`);
    console.error('');
    console.error(`  Yo'l: ${LISTEN.socketPath}`);
    console.error('');
    console.error('  Eski jarayon hali ishlayotgan bo\'lishi mumkin:');
    console.error('     ps aux | grep "server/server.mjs"');
    console.error('     pkill -f "server/server.mjs"');
    console.error('  So\'ngra soket faylini o\'chiring:');
    console.error(`     rm -f ${LISTEN.socketPath}`);
  } else if (error.code === 'EADDRINUSE') {
    const where = `${HOST}:${PORT}`;
    console.error(`  SERVER ISHGA TUSHMADI: ${where} allaqachon band.`);
    console.error('');
    console.error(`  Manba: ${LISTEN.source}`);
    console.error('');
    if (LISTEN.source.startsWith('odatiy')) {
      console.error('  SABABI EHTIMOL SHU: hosting paneli portni bermagan, shuning uchun');
      console.error(`  server odatiy ${PORT}-portni tanladi va u boshqa jarayon tomonidan band.`);
      console.error('');
      console.error('  YECHIM: panelning «Переменная окружения» bo\'limida PORT o\'zgaruvchisini');
      console.error('  qo\'shib, hosting shu sayt uchun ajratgan portni yozing.');
      console.error('  ISPmanager\'da bu port odatda 10000 dan boshlanadi.');
    } else {
      console.error('  YECHIM: shu portni ishlatayotgan eski jarayonni to\'xtating.');
    }
    console.error('');
    console.error('  Portni kim band qilganini aniqlash:');
    console.error(`     ss -ltnp | grep :${PORT}          (yoki: lsof -i :${PORT})`);
    console.error('  Loyihaning eski jarayonlarini ko\'rish va to\'xtatish:');
    console.error('     ps aux | grep "server/server.mjs"');
    console.error('     pkill -f "server/server.mjs"');
    console.error('');
    console.error('  To\'liq tekshiruv uchun:  node server/tools/diagnose.mjs');
  } else if (error.code === 'EACCES') {
    const what = LISTEN.kind === 'socket' ? LISTEN.socketPath : `${PORT}-port`;
    console.error(`  SERVER ISHGA TUSHMADI: ${what} uchun ruxsat yo'q.`);
    console.error('');
    if (LISTEN.kind === 'port' && PORT < 1024) {
      console.error('  1024 dan kichik portlar administrator huquqini talab qiladi.');
      console.error('  1024 dan katta port ishlatib (masalan 8080), oldiga nginx qo\'ying.');
    } else {
      console.error(`  Soket katalogiga yozish huquqi yo'q: ${path.dirname(LISTEN.socketPath)}`);
      console.error('  Katalog egasi sayt foydalanuvchisi bo\'lishi kerak.');
    }
  } else {
    console.error(`  SERVER XATOLIGI: ${error.message}`);
    console.error(`  Kod: ${error.code || 'nomalum'}`);
  }

  console.error('  ════════════════════════════════════════════════════════════');
  console.error('');
  process.exit(1);
});

if (LISTEN.kind === 'socket') {
  server.listen(LISTEN.socketPath, onListening);
} else {
  server.listen(PORT, HOST, onListening);
}

/** To'xtatishda soket faylini tozalaydi. */
function shutdown(signal) {
  console.log(`\n  Server to'xtatilmoqda (${signal})…`);
  server.close(() => {
    if (LISTEN.kind === 'socket') {
      try {
        fs.unlinkSync(LISTEN.socketPath);
      } catch (error) {
        /* e'tiborsiz */
      }
    }
    process.exit(0);
  });
  // Ulanishlar yopilmasa, 10 soniyadan keyin majburan chiqamiz
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
