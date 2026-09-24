/**
 * Murojaatlarni Telegram bot orqali yetkazish.
 * Tashqi paketlarga bog'liq emas — Node.js ning o'z `fetch` funksiyasidan foydalanadi.
 *
 * Sozlamalar quyidagi tartibda o'qiladi (yuqoridagi pastdagini bekor qiladi):
 *   1. Muhit o'zgaruvchilari: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_THREAD_ID
 *   2. `.env` fayli (server ishga tushganda process.env ga yuklanadi)
 *   3. server/data/telegram.json (boshqaruv paneli orqali saqlanadi)
 *
 * Bot tokeni MAXFIY: `.env` va `server/data/telegram.json` fayllari
 * `.gitignore` ro'yxatida — repozitoriyaga tushmaydi.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'telegram.json');

const DEFAULT_API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT = 12_000;
const MAX_ATTEMPTS = 3;
const MAX_MESSAGE_LENGTH = 4096;

/* ─────────────────────────── Sozlamalar ─────────────────────────── */

function readFileConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    console.error(`[telegram] telegram.json o'qilmadi: ${error.message}`);
    return {};
  }
}

/** Amaldagi sozlamalarni qaytaradi. */
export function getConfig() {
  const file = readFileConfig();
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || file.botToken || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || file.chatId || '').trim();
  const threadId = String(process.env.TELEGRAM_THREAD_ID || file.threadId || '').trim();
  const apiBase = String(process.env.TELEGRAM_API_BASE || file.apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
  const disabled = process.env.TELEGRAM_DISABLED === '1' || file.disabled === true;

  return {
    botToken,
    chatId,
    threadId,
    apiBase,
    disabled,
    enabled: Boolean(botToken && chatId) && !disabled,
    source: {
      botToken: process.env.TELEGRAM_BOT_TOKEN ? 'env' : file.botToken ? 'file' : null,
      chatId: process.env.TELEGRAM_CHAT_ID ? 'env' : file.chatId ? 'file' : null,
    },
  };
}

/** Sozlamalarni faylga saqlaydi (boshqaruv paneli uchun). */
export async function saveConfig({ botToken, chatId, threadId, disabled }) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const current = readFileConfig();
  const next = { ...current };

  if (botToken !== undefined) next.botToken = String(botToken || '').trim();
  if (chatId !== undefined) next.chatId = String(chatId || '').trim();
  if (threadId !== undefined) next.threadId = String(threadId || '').trim();
  if (disabled !== undefined) next.disabled = Boolean(disabled);
  next.updatedAt = new Date().toISOString();

  await fsp.writeFile(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return getConfig();
}

/** Tokenni jurnalga yozish uchun yashiradi: 1234567:AAE… → 1234567:…mQ4 */
export function maskToken(token) {
  const value = String(token || '');
  if (value === '') return '';
  const colon = value.indexOf(':');
  if (colon === -1) return `${value.slice(0, 3)}…`;
  return `${value.slice(0, colon + 1)}…${value.slice(-3)}`;
}

/* ─────────────────────────── Telegram API ─────────────────────────── */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Telegram Bot API metodini chaqiradi.
 * @returns {Promise<{ ok: boolean, result?: any, error?: string, status?: number, retryAfter?: number }>}
 */
export async function callApi(method, payload, config = getConfig()) {
  if (!config.botToken) return { ok: false, error: 'bot_token_yoq' };

  const url = `${config.apiBase}/bot${config.botToken}/${method}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (response.ok && data?.ok) return { ok: true, result: data.result, status: response.status };

    return {
      ok: false,
      status: response.status,
      error: data?.description || `HTTP ${response.status}`,
      retryAfter: data?.parameters?.retry_after ?? null,
    };
  } catch (error) {
    const reason = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'so\'rov vaqti tugadi'
      : error?.message || 'tarmoq xatoligi';
    return { ok: false, error: reason, network: true };
  }
}

/** Bot haqidagi ma'lumot (token to'g'riligini tekshirish uchun). */
export async function getMe(config = getConfig()) {
  return callApi('getMe', {}, config);
}

/**
 * Xabar yuboradi. Vaqtinchalik xatoliklarda bir necha marta qayta uriniladi.
 * @returns {Promise<{ delivered: boolean, attempts: number, messageId?: number, error?: string }>}
 */
export async function sendMessage(text, options = {}) {
  const config = options.config || getConfig();

  if (config.disabled) return { delivered: false, attempts: 0, error: 'telegram_ochirilgan', skipped: true };
  if (!config.enabled) {
    return {
      delivered: false,
      attempts: 0,
      error: !config.botToken ? 'bot_token_yoq' : 'chat_id_yoq',
      skipped: true,
    };
  }

  const payload = {
    chat_id: config.chatId,
    text: truncate(text, MAX_MESSAGE_LENGTH),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    disable_notification: Boolean(options.silent),
  };
  if (config.threadId) payload.message_thread_id = Number(config.threadId);
  if (options.replyMarkup) payload.reply_markup = options.replyMarkup;

  let lastError = 'nomalum xatolik';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await callApi('sendMessage', payload, config);
    if (result.ok) {
      return { delivered: true, attempts: attempt, messageId: result.result?.message_id ?? null };
    }

    lastError = result.error || 'nomalum xatolik';

    // Qaytarib bo'lmaydigan xatoliklar: token xato, chat topilmadi, bot bloklangan
    const permanent = result.status === 400 || result.status === 401 || result.status === 403;
    if (permanent) return { delivered: false, attempts: attempt, error: lastError, permanent: true };

    if (attempt < MAX_ATTEMPTS) {
      const waitMs = result.retryAfter ? result.retryAfter * 1000 : attempt * 1500;
      await sleep(Math.min(waitMs, 15_000));
    }
  }

  return { delivered: false, attempts: MAX_ATTEMPTS, error: lastError };
}

/* ─────────────────────────── Xabar matni ─────────────────────────── */

/** Telegram HTML rejimi uchun maxsus belgilarni himoyalaydi. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(text, max) {
  const value = String(text ?? '');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 20)}\n… (qisqartirildi)`;
}

const LOCALE_NAMES = {
  'uz-cyrl': "o'zbek (kirill)",
  uz: "o'zbek (lotin)",
  ru: 'rus',
  en: 'ingliz',
};

/** Murojaat yozuvidan Telegram uchun xabar matnini yasaydi. */
export function formatContactMessage(record) {
  const line = (icon, label, value) =>
    value ? `${icon} <b>${escapeHtml(label)}:</b> ${escapeHtml(value)}` : null;

  const received = String(record.receivedAt || '').replace('T', ' ').slice(0, 16);

  const head = [
    '📨 <b>Saytdan yangi murojaat</b>',
    `<code>${escapeHtml(record.id || '')}</code>`,
  ].join('  ');

  const details = [
    line('👤', 'Ism-familiya', record.name),
    line('🏢', 'Tashkilot', record.organization),
    line('📞', 'Telefon', record.phone),
    line('✉️', 'Pochta', record.email),
    line('📍', 'Qiziqtirgan hudud', record.area),
    line('🌐', 'Sayt tili', LOCALE_NAMES[record.locale] || record.locale),
  ].filter(Boolean);

  const parts = [head, '', ...details];

  if (record.message) {
    parts.push('', '💬 <b>Xabar:</b>', `<blockquote>${escapeHtml(record.message)}</blockquote>`);
  }
  if (received) parts.push('', `🕒 ${escapeHtml(received)} (UTC)`);
  if (record.page) parts.push(`🔗 ${escapeHtml(record.page)}`);

  return parts.join('\n');
}

/** Xabar ostidagi tugmalar (telefon va pochta uchun tezkor havolalar). */
export function buildReplyMarkup(record, adminUrl) {
  const row = [];
  if (record.email) row.push({ text: '✉️ Javob yozish', url: `mailto:${record.email}` });
  if (record.page && /^https?:\/\//i.test(record.page)) {
    row.push({ text: '🔗 Sahifa', url: record.page });
  }
  const rows = row.length > 0 ? [row] : [];
  if (adminUrl && /^https?:\/\//i.test(adminUrl)) {
    rows.push([{ text: '🗂 Boshqaruv paneli', url: adminUrl }]);
  }
  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

/**
 * Murojaat haqida botga xabar beradi.
 * @returns {Promise<object>} yetkazilish holati — murojaat yozuviga saqlanadi
 */
export async function notifyContact(record, { adminUrl } = {}) {
  const config = getConfig();
  const result = await sendMessage(formatContactMessage(record), {
    config,
    replyMarkup: buildReplyMarkup(record, adminUrl),
  });

  return {
    delivered: result.delivered,
    attempts: result.attempts,
    messageId: result.messageId ?? null,
    error: result.error ?? null,
    permanent: Boolean(result.permanent),
    skipped: Boolean(result.skipped),
    chatId: config.chatId || null,
    at: new Date().toISOString(),
  };
}

/** Sinov xabari. */
export async function sendTestMessage(note = '') {
  const text = [
    '✅ <b>Sinov xabari</b>',
    '',
    'Direksiya veb-saytining murojaat shakli shu chatga ulandi.',
    'Endi saytdan yuborilgan murojaatlar shu yerga keladi.',
    note ? `\n${escapeHtml(note)}` : '',
    `\n🕒 ${new Date().toISOString().replace('T', ' ').slice(0, 16)} (UTC)`,
  ]
    .filter(Boolean)
    .join('\n');
  return sendMessage(text, { silent: false });
}

/** Sozlamalarni tekshiradi: token to'g'rimi, chat mavjudmi. */
export async function diagnose() {
  const config = getConfig();
  const report = {
    enabled: config.enabled,
    disabled: config.disabled,
    hasToken: Boolean(config.botToken),
    hasChatId: Boolean(config.chatId),
    tokenMasked: maskToken(config.botToken),
    chatId: config.chatId || null,
    threadId: config.threadId || null,
    apiBase: config.apiBase,
    source: config.source,
    bot: null,
    chat: null,
    errors: [],
  };

  if (!config.botToken) {
    report.errors.push('Bot tokeni kiritilmagan.');
    return report;
  }

  const me = await getMe(config);
  if (me.ok) {
    report.bot = { id: me.result.id, username: me.result.username, name: me.result.first_name };
  } else {
    report.errors.push(`Bot tokeni tekshirilmadi: ${me.error}`);
    return report;
  }

  if (!config.chatId) {
    report.errors.push('chat_id kiritilmagan.');
    return report;
  }

  const chat = await callApi('getChat', { chat_id: config.chatId }, config);
  if (chat.ok) {
    report.chat = {
      id: chat.result.id,
      type: chat.result.type,
      title: chat.result.title || chat.result.username || chat.result.first_name || null,
    };
  } else {
    report.errors.push(`Chat tekshirilmadi: ${chat.error}`);
  }

  return report;
}
