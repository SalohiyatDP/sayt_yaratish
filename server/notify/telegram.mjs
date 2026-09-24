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

/* ─────────────────── Xatolikni tushunarli tilga o'girish ───────────────────
 * Telegram API ingliz tilida qisqa xatolik qaytaradi («chat not found»).
 * Xodim uchun bu hech narsa demaydi — shuning uchun har bir tipik xatolikka
 * sabab va aniq yechim biriktiriladi.
 */

const ERROR_GUIDE = [
  {
    match: /unauthorized|invalid token|bot token is invalid/i,
    reason: 'Bot tokeni qabul qilinmadi.',
    fix: 'Token to\'liq va xatosiz kiritilganini tekshiring. Kerak bo\'lsa @BotFather → /mybots → API Token orqali yangisini oling.',
  },
  {
    match: /chat not found/i,
    reason: 'Ko\'rsatilgan chat topilmadi.',
    fix: 'Ikki narsani tekshiring: (1) chat_id to\'g\'ri — guruh uchun u manfiy son bo\'ladi, masalan -1001234567890; (2) bot shu guruhga a\'zo qilingan. Botni guruhga qo\'shib, guruhda bitta xabar yozing, so\'ng «chat_id ni aniqlash» tugmasini bosing.',
  },
  {
    match: /bot was kicked|bot is not a member/i,
    reason: 'Bot guruhdan chiqarilgan.',
    fix: 'Botni guruhga qaytadan qo\'shing.',
  },
  {
    match: /bot was blocked by the user/i,
    reason: 'Foydalanuvchi botni bloklagan.',
    fix: 'Telegramda botni ochib «Start» (ishga tushirish) tugmasini bosing yoki blokdan chiqaring.',
  },
  {
    match: /bot can't initiate conversation|need to start a conversation/i,
    reason: 'Bot suhbatni o\'zi boshlay olmaydi.',
    fix: 'Telegramda botni ochib «Start» tugmasini bosing — shundan keyin bot sizga yozishi mumkin bo\'ladi.',
  },
  {
    match: /not enough rights|CHAT_WRITE_FORBIDDEN|have no rights to send/i,
    reason: 'Botning guruhga yozish huquqi yo\'q.',
    fix: 'Guruh sozlamalarida botga xabar yuborish huquqini bering (yoki botni administrator qiling).',
  },
  {
    match: /message thread not found|TOPIC_CLOSED|thread not found/i,
    reason: 'Forum mavzusi (thread) topilmadi yoki yopilgan.',
    fix: 'Forum mavzusi maydonini bo\'shatib ko\'ring — xabar guruhning umumiy oqimiga tushadi.',
  },
  {
    match: /group chat was upgraded to a supergroup/i,
    reason: 'Guruh superguruhga aylantirilgan, eski chat_id ishlamaydi.',
    fix: '«chat_id ni aniqlash» tugmasi orqali yangi chat_id ni oling va saqlang.',
  },
  {
    match: /too many requests|retry after/i,
    reason: 'Telegram so\'rovlar sonini cheklab qo\'ydi.',
    fix: 'Bir necha daqiqa kutib turing — tizim o\'zi qayta uriniб ko\'radi.',
  },
  {
    match: /so'rov vaqti tugadi|timeout/i,
    reason: 'Telegram serveriga ulanish vaqti tugadi.',
    fix: 'Odatda bu hosting tashqi tarmoqqa chiqishga ruxsat bermaganini bildiradi. Quyidagi «Tarmoq» qatoriga qarang.',
  },
  {
    match: /ENOTFOUND|EAI_AGAIN|getaddrinfo/i,
    reason: 'api.telegram.org domeni aniqlanmadi (DNS ishlamadi).',
    fix: 'Hostingda tashqi tarmoq yoki DNS yopiq. Hosting qo\'llab-quvvatlash xizmatiga murojaat qilib, api.telegram.org ga chiqishni oching.',
  },
  {
    match: /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|socket hang up|fetch failed|tarmoq xatoligi/i,
    reason: 'Telegram serveriga ulanib bo\'lmadi.',
    fix: 'Hosting tashqi ulanishlarni to\'sib qo\'ygan bo\'lishi mumkin. Hosting xizmatidan api.telegram.org (443-port) ga chiqishni so\'rang.',
  },
  {
    match: /certificate|self signed|SSL/i,
    reason: 'HTTPS sertifikati tekshirilmadi.',
    fix: 'Serverdagi ildiz sertifikatlari eskirgan bo\'lishi mumkin — hosting xizmatiga murojaat qiling.',
  },
  {
    match: /^bot_token_yoq$/,
    reason: 'Bot tokeni kiritilmagan.',
    fix: 'Quyidagi «Bot tokeni» maydoniga @BotFather bergan tokenni qo\'ying.',
  },
  {
    match: /^chat_id_yoq$/,
    reason: 'chat_id kiritilmagan.',
    fix: 'Botni guruhga qo\'shib, «chat_id ni aniqlash» tugmasini bosing.',
  },
  {
    match: /^telegram_ochirilgan$/,
    reason: 'Telegramga yuborish qo\'lda o\'chirib qo\'yilgan.',
    fix: 'Quyidagi «Yuborishni vaqtincha to\'xtatish» belgisini olib tashlang.',
  },
];

/**
 * Xatolik matnidan sabab va yechim chiqaradi.
 * @returns {{ raw: string, reason: string, fix: string }}
 */
export function explainError(error) {
  const raw = String(error ?? '').trim();
  if (raw === '') return { raw: '', reason: '', fix: '' };
  for (const entry of ERROR_GUIDE) {
    if (entry.match.test(raw)) return { raw, reason: entry.reason, fix: entry.fix };
  }
  return {
    raw,
    reason: 'Telegram xatolik qaytardi.',
    fix: 'Yuqoridagi xatolik matnini hosting yoki texnik mutaxassisga ko\'rsating.',
  };
}

/**
 * Tashqi tarmoq ochiqligini tekshiradi.
 * Telegram API ga token talab qilmaydigan so'rov yuboriladi: javob 404 bo'lsa
 * ham ulanish ishlagan bo'ladi — bizga faqat tarmoq muhim.
 */
export async function probeNetwork(config = getConfig()) {
  const started = Date.now();
  try {
    const response = await fetch(`${config.apiBase}/bot0:0/getMe`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
    return { reachable: true, status: response.status, ms: Date.now() - started };
  } catch (error) {
    const reason = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'so\'rov vaqti tugadi'
      : error?.cause?.code || error?.message || 'tarmoq xatoligi';
    return { reachable: false, error: String(reason), ms: Date.now() - started };
  }
}

/** Sozlamalarni tekshiradi: tarmoq ochiqmi, token to'g'rimi, chat mavjudmi. */
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
    network: null,
    bot: null,
    chat: null,
    canSend: false,
    problems: [],
  };

  const add = (error) => report.problems.push(explainError(error));

  // 1. Tarmoq — eng ko'p uchraydigan sabab shu
  report.network = await probeNetwork(config);
  if (!report.network.reachable) {
    add(report.network.error);
    return report;
  }

  // 2. Token
  if (!config.botToken) {
    add('bot_token_yoq');
    return report;
  }
  const me = await getMe(config);
  if (!me.ok) {
    add(me.error);
    return report;
  }
  report.bot = { id: me.result.id, username: me.result.username, name: me.result.first_name };

  // 3. Chat
  if (!config.chatId) {
    add('chat_id_yoq');
    return report;
  }
  const chat = await callApi('getChat', { chat_id: config.chatId }, config);
  if (!chat.ok) {
    add(chat.error);
    return report;
  }
  report.chat = {
    id: chat.result.id,
    type: chat.result.type,
    title: chat.result.title || chat.result.username || chat.result.first_name || null,
  };

  if (config.disabled) {
    add('telegram_ochirilgan');
    return report;
  }

  report.canSend = true;
  return report;
}
