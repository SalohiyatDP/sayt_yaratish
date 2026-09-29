/**
 * AI yordamchisi — ko'p tilli matnni tarjima qilish va PDF/matndan
 * maydonlarni ajratib olish. Ikki provayderni qo'llab-quvvatlaydi:
 *   • OpenAI  (ChatGPT)  — api.openai.com
 *   • Gemini  (Google)   — generativelanguage.googleapis.com
 *
 * TAMOYILLAR:
 *   1. AI IXTIYORIY. Kalit kiritilmasa, sayt hozirgidek to'liq ishlaydi va
 *      paneldagi AI tugmalari ko'rinmaydi.
 *   2. AI hech qachon avtomatik SAQLAMAYDI. U faqat maydonlarni TAKLIF qiladi;
 *      xodim ko'rib, tasdiqlaydi. Bu — soxta/xato ma'lumot kirib qolmasligi
 *      uchun (loyihaning asosiy qoidasi).
 *   3. API kaliti MAXFIY: `.env` yoki server/data/ai.json da saqlanadi,
 *      ikkalasi ham .gitignore da — repozitoriyaga tushmaydi.
 *
 * Tashqi paketlarga bog'liq emas — Node.js ning o'z `fetch` funksiyasidan
 * foydalanadi.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proxyFetch } from './proxy-fetch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'ai.json');

const REQUEST_TIMEOUT = 60_000; // AI javoblari sekinroq bo'lishi mumkin

/* ─────────────────────────── Provayderlar ─────────────────────────── */

export const PROVIDERS = {
  openai: {
    label: 'OpenAI (ChatGPT)',
    // Odatiy — arzon va tez model. Aniq ro'yxat provayderdan olinadi (listModels).
    defaultModel: 'gpt-5-mini',
    // Zaxira ro'yxat: model ro'yxatini API dan olib bo'lmasa ko'rsatiladi.
    fallbackModels: ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini', 'gpt-4o-mini'],
    apiBase: 'https://api.openai.com',
    keyHint: 'sk-… ko\'rinishida. platform.openai.com → API keys',
  },
  gemini: {
    label: 'Google Gemini',
    // `-latest` psevdonimi har doim eng yangi barqaror modelга ishora qiladi
    // va eskirmaydi/yopilmaydi. Odatiy sifatida `flash-lite` tanlanadi — u
    // bepul rejada eng yuqori daqiqalik limitga ega (RPM ~15, kunlik ~1000),
    // shuning uchun 429 (rate limit) xatosi kamroq uchraydi. Foydalanuvchi
    // xohlasa panelда kuchliroq `flash`/`pro` ni tanlashi mumkin.
    defaultModel: 'gemini-flash-lite-latest',
    fallbackModels: ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-pro-latest'],
    apiBase: 'https://generativelanguage.googleapis.com',
    keyHint: 'aistudio.google.com → Get API key',
  },
};

/* ─────────────────────────── Sozlamalar ─────────────────────────── */

function readFileConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    console.error(`[ai] ai.json o'qilmadi: ${error.message}`);
    return {};
  }
}

/** Amaldagi sozlamalar. Kalit env > .env > ai.json tartibida o'qiladi. */
export function getConfig() {
  const file = readFileConfig();
  const provider = ['openai', 'gemini'].includes(file.provider) ? file.provider : 'gemini';
  const preset = PROVIDERS[provider];

  // Kalit provayderga qarab alohida muhit o'zgaruvchisidan ham olinadi
  const envKey = provider === 'openai'
    ? String(process.env.OPENAI_API_KEY || '').trim()
    : String(process.env.GEMINI_API_KEY || '').trim();
  const apiKey = envKey || String(file.apiKey || '').trim();

  const model = String(file.model || '').trim() || preset.defaultModel;
  const apiBase = String(file.apiBase || preset.apiBase).replace(/\/$/, '');
  const disabled = process.env.AI_DISABLED === '1' || file.disabled === true;

  // Proksi: hosting IP manzili AI provayder tomonidan bloklansa (masalan
  // Google Gemini «User location is not supported»), so'rovlarni ruxsat
  // berilgan hudud orqali yo'naltirish uchun. Env > ai.json tartibida.
  // Ko'rinishi: http://user:pass@host:port yoki socks5://host:port
  const proxy = String(
    process.env.AI_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || file.proxy || '',
  ).trim();

  return {
    provider,
    apiKey,
    model,
    apiBase,
    disabled,
    proxy,
    enabled: Boolean(apiKey) && !disabled,
    keySource: envKey ? 'env' : file.apiKey ? 'file' : null,
    proxySource: (process.env.AI_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy) ? 'env' : file.proxy ? 'file' : null,
  };
}

/** Sozlamalarni saqlaydi (kalit faqat egasi o'qiy oladigan faylda). */
export async function saveConfig({ provider, apiKey, model, disabled, proxy }) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const next = { ...readFileConfig() };
  const providerChanged = provider !== undefined && ['openai', 'gemini'].includes(provider) && provider !== next.provider;

  if (provider !== undefined && ['openai', 'gemini'].includes(provider)) next.provider = provider;
  // Bo'sh kalit yuborilsa — saqlangani o'zgarmaydi (yulduzchali placeholder holati)
  if (typeof apiKey === 'string' && apiKey.trim() !== '') next.apiKey = apiKey.trim();
  if (typeof model === 'string' && model.trim() !== '') next.model = model.trim();
  if (disabled !== undefined) next.disabled = Boolean(disabled);
  // Proksi: bo'sh satr yuborilsa — proksi o'chiriladi (to'g'ridan-to'g'ri ulanish)
  if (typeof proxy === 'string') {
    const trimmed = proxy.trim();
    if (trimmed === '') delete next.proxy;
    else next.proxy = trimmed;
  }

  // Provayder o'zgarsa, model aniq berilmagan bo'lsa — yangi provayderning
  // odatiy modeliga o'tkazamiz. Aks holda bir provayderning modeli boshqasiga
  // o'tib qolib, "model mavjud emas" xatosiga sabab bo'ladi.
  if (providerChanged && !(typeof model === 'string' && model.trim() !== '')) {
    next.model = PROVIDERS[next.provider].defaultModel;
  }
  next.updatedAt = new Date().toISOString();

  await fsp.writeFile(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return getConfig();
}

/**
 * Provayderdan mavjud modellar ro'yxatini oladi — ro'yxat hech qachon
 * eskirmaydi. Kalit bo'lmasa yoki so'rov muvaffaqiyatsiz bo'lsa, zaxira
 * ro'yxat (fallbackModels) qaytariladi.
 * @returns {Promise<{ models: string[], source: 'api'|'fallback' }>}
 */
export async function listModels(config = getConfig()) {
  const preset = PROVIDERS[config.provider];
  const fallback = { models: preset.fallbackModels, source: 'fallback' };
  if (!config.apiKey) return fallback;

  try {
    if (config.provider === 'openai') {
      const response = await apiFetch(`${config.apiBase}/v1/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        timeout: 15_000,
      }, config);
      if (!response.ok) return fallback;
      const data = await response.json();
      // Faqat chat/matn modellari: gpt-… (audio, image, embedding, tts, whisper emas)
      const models = sortModels(
        (data?.data || [])
          .map((m) => m.id)
          .filter((id) => /^(gpt|o\d|chatgpt)/i.test(id) && !/audio|realtime|image|tts|whisper|embedding|moderation|transcribe|search|codex|dall/i.test(id)),
      );
      return models.length ? { models, source: 'api' } : fallback;
    }

    // Gemini. Kalitni URL emas, `x-goog-api-key` sarlavhasi orqali yuboramiz.
    // Yangi "auth" kalitlar (AQ. bilan boshlanadi, 2026-yildan AI Studio faqat
    // shularni beradi) URL dagi `?key=` ni qo'llamaydi va 401
    // ACCESS_TOKEN_TYPE_UNSUPPORTED qaytaradi. Sarlavha usuli eski (AIza) va
    // yangi (AQ.) kalitlarning ikkalasi uchun ham ishlaydi.
    const url = `${config.apiBase}/v1beta/models?pageSize=1000`;
    const response = await apiFetch(url, {
      headers: { 'x-goog-api-key': config.apiKey },
      timeout: 15_000,
    }, config);
    if (!response.ok) return fallback;
    const data = await response.json();
    const models = sortModels(
      (data?.models || [])
        // generateContent ni qo'llaydigan gemini modellari (embedding/imagen/tts emas)
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name))
        .map((m) => String(m.name).replace(/^models\//, ''))
        .filter((id) => !/embedding|aqa|vision|image|tts|thinking|exp-|-exp/i.test(id)),
    );
    return models.length ? { models, source: 'api' } : fallback;
  } catch (error) {
    return fallback;
  }
}

/**
 * Model ro'yxatini foydalilik bo'yicha saralaydi:
 *   1. `-latest` psevdonimlari (eskirmaydi, yopilmaydi) — eng yuqorida;
 *   2. yangi avlod raqami kattaroq modellar;
 *   3. `preview`/`lite` variantlari pastroqda.
 */
function sortModels(list) {
  const version = (id) => {
    const m = id.match(/(\d+)(?:[.-](\d+))?/);
    return m ? Number(m[1]) * 100 + Number(m[2] || 0) : 0;
  };
  const score = (id) => {
    let s = version(id);
    if (/-latest$/.test(id)) s += 100000; // psevdonimlar doim tepada
    // Gemini 2.x endi yangi loyihalar uchun yopilgan — pastga tushiramiz
    if (/^gemini-2\./.test(id)) s -= 20000;
    if (/preview|-exp|experimental/.test(id)) s -= 5000;
    if (/lite/.test(id)) s -= 50;
    if (/pro/.test(id)) s += 5; // pro flash dan sal yuqori (bir xil versiyada)
    return s;
  };
  return [...new Set(list)].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

/**
 * Provayder API ga so'rov: proksi sozlangan bo'lsa proksi tunneli orqali
 * (zero-dep, SOCKS5/HTTP CONNECT), aks holda native `fetch` orqali.
 * Har ikkala yo'l ham bir xil (ok/status/json/text) obyekt qaytaradi.
 */
async function apiFetch(url, { headers = {}, method = 'GET', body, timeout = 15_000 } = {}, config) {
  if (config && config.proxy) {
    return proxyFetch(url, { method, headers, body, timeout }, config.proxy);
  }
  return fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeout) });
}

/** Kalitni jurnalga yozish uchun yashiradi: sk-abc…xyz */
export function maskKey(key) {
  const value = String(key || '');
  if (value.length < 8) return value ? '…' : '';
  return `${value.slice(0, 4)}…${value.slice(-3)}`;
}

/** Proksi manzilidagi parolni yashiradi: http://user:***@host:port */
export function maskProxy(url) {
  return String(url || '').replace(/(:\/\/[^:@/]+:)[^@/]+@/, '$1***@');
}

/**
 * Proksi faol ishlaydimi? Endi proksi so'rovlari o'rnatilgan `proxyFetch`
 * moduli orqali (zero-dep SOCKS5/HTTP CONNECT tunnel) yuboriladi — bu Node
 * ning `--use-env-proxy` bayrog'iga bog'liq EMAS va ilova qayta ishga
 * tushishini talab QILMAYDI. Shuning uchun proksi sozlangan bo'lsa, u darhol
 * faol hisoblanadi. Manzil to'g'ri formatда ekanini ham tekshiramiz.
 */
export function isProxyActive(proxy) {
  const value = String(proxy ?? getConfig().proxy ?? '').trim();
  if (!value) return false;
  return /^(https?|socks[45]?):\/\/[^\s]+$/i.test(value);
}

/* ─────────────────────────── Provayderga so'rov ─────────────────────────── */

/**
 * AI ga so'rov yuboradi va matn javobini qaytaradi.
 * Ikkala provayderning API farqi shu funksiya ichida yashiringan.
 * @returns {Promise<{ ok: boolean, text?: string, error?: string, network?: boolean }>}
 */
async function chat(opts, config = getConfig()) {
  if (!config.apiKey) return { ok: false, error: 'kalit_yoq' };

  const first = await chatOnce(opts, config);
  if (first.ok) return first;

  // Model yopilgan/mavjud emas bo'lsa — `-latest` psevdonimiga o'tib qayta
  // urinamiz. Psevdonim har doim eng yangi barqaror modelga ishora qiladi va
  // yopilmaydi, shuning uchun xodim eski model tanlagan bo'lsa ham ishlaydi.
  const modelGone = /no longer available|not found|does not exist|not supported|unknown model|invalid model|update your code to use/i.test(first.error || '');
  if (modelGone) {
    const fresh = config.provider === 'gemini' ? 'gemini-flash-lite-latest' : 'gpt-5-mini';
    if (config.model !== fresh) {
      const retry = await chatOnce(opts, { ...config, model: fresh });
      if (retry.ok) {
        // Ishlagan modelni eslab qolamiz — keyingi safar to'g'ridan-to'g'ri ishlaydi
        saveConfig({ model: fresh }).catch(() => undefined);
        return retry;
      }
    }
  }
  return first;
}

/** Bitta so'rov — provayder API sini chaqiradi (qayta urinishsiz). */
async function chatOnce({ system, user, jsonMode = false }, config) {
  try {
    if (config.provider === 'openai') {
      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];
      // Yangi modellar (gpt-5, o-seriya) `temperature` ni qabul qilmaydi va
      // ba'zi provayderlar `response_format` ni qo'llamaydi. Shuning uchun
      // qo'shimcha parametrlarni asta-sekin olib tashlab qayta urinamiz.
      const attempts = [
        { temperature: 0.2, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) },
        { ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) }, // temperature siz
        {}, // hech qanday qo'shimchasiz
      ];

      let lastErr = null;
      for (const extra of attempts) {
        const response = await apiFetch(`${config.apiBase}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ model: config.model, messages, ...extra }),
          timeout: REQUEST_TIMEOUT,
        }, config);
        const data = await response.json().catch(() => null);
        if (response.ok) {
          const text = data?.choices?.[0]?.message?.content;
          if (!text) return { ok: false, error: 'bo\'sh_javob' };
          return { ok: true, text };
        }
        lastErr = { status: response.status, error: data?.error?.message || `HTTP ${response.status}` };
        // Faqat parametr rad etilgan bo'lsa keyingi urinishga o'tamiz;
        // boshqa xatolik (kalit, limit) — darhol qaytaramiz.
        const param = /temperature|response_format|unsupported parameter|unsupported value/i.test(lastErr.error);
        if (!param) return { ok: false, ...lastErr };
      }
      return { ok: false, ...lastErr };
    }

    // Gemini. Kalit `x-goog-api-key` sarlavhasida — yangi AQ. kalitlar URL dagi
    // `?key=` ni qo'llamaydi (401 ACCESS_TOKEN_TYPE_UNSUPPORTED). Sarlavha usuli
    // eski (AIza) va yangi (AQ.) kalitlarning ikkalasi uchun ham ishlaydi.
    const url = `${config.apiBase}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
    const response = await apiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.2,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      timeout: REQUEST_TIMEOUT,
    }, config);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, status: response.status, error: data?.error?.message || `HTTP ${response.status}` };
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (!text) {
      const blocked = data?.promptFeedback?.blockReason;
      return { ok: false, error: blocked ? `so'rov rad etildi: ${blocked}` : 'bo\'sh_javob' };
    }
    return { ok: true, text };
  } catch (error) {
    const reason = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'so\'rov vaqti tugadi'
      : error?.cause?.code || error?.message || 'tarmoq xatoligi';
    return { ok: false, error: String(reason), network: true };
  }
}

/** AI javobidan JSON obyektni ajratib oladi (```json … ``` bloklarga chidamli). */
function parseJson(text) {
  let raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  // Birinchi { dan oxirgi } gacha
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) raw = raw.slice(start, end + 1);
  return JSON.parse(raw);
}

/* ─────────────────────────── Tarjima ─────────────────────────── */

const LOCALE_NAMES = {
  'uz-cyrl': "o'zbek tili (kirill alifbosi)",
  uz: "o'zbek tili (lotin alifbosi)",
  ru: 'rus tili',
  en: 'ingliz tili',
};

/**
 * Bitta til matnini qolgan tillarga tarjima qiladi.
 * @param {string} sourceLocale manba til kodi (uz-cyrl, uz, ru, en)
 * @param {string} sourceText manba matn
 * @param {string[]} targetLocales to'ldirilishi kerak bo'lgan tillar
 * @param {object} [options] { context?: string } — maydon nomi kabi qo'shimcha
 * @returns {Promise<{ ok, translations?: object, error?: string }>}
 */
export async function translate(sourceLocale, sourceText, targetLocales, options = {}) {
  const config = getConfig();
  if (!config.enabled) return { ok: false, error: config.disabled ? 'ochirilgan' : 'kalit_yoq' };

  const text = String(sourceText || '').trim();
  if (text === '') return { ok: false, error: 'bosh_matn' };

  const targets = targetLocales.filter((code) => LOCALE_NAMES[code] && code !== sourceLocale);
  if (targets.length === 0) return { ok: true, translations: {} };

  const system = [
    'Sen davlat muassasasi veb-sayti uchun professional tarjimonsan.',
    'Berilgan matnni ko\'rsatilgan tillarga tarjima qil.',
    'Qoidalar:',
    '- Rasmiy, betaraf uslubda tarjima qil.',
    '- HTML teglar bo\'lsa (masalan <p>, <strong>), ularni o\'zgartirmasdan saqla.',
    '- Atoqli otlar, tashkilot nomlari va raqamlarni to\'g\'ri ko\'chir.',
    '- o\'zbek lotin va kirill o\'rtasida faqat alifboni o\'zgartir, so\'zlarni tarjima qilma.',
    '- Hech narsa qo\'shma yoki tushuntirma. Faqat tarjimani ber.',
    'Javobni QAT\'IY JSON obyekt sifatida qaytar: kalit — til kodi, qiymat — tarjima.',
    `Til kodlari: ${targets.join(', ')}.`,
  ].join('\n');

  const user = [
    options.context ? `Maydon: ${options.context}` : '',
    `Manba til: ${LOCALE_NAMES[sourceLocale]}`,
    `Kerakli tillar: ${targets.map((c) => `${c} (${LOCALE_NAMES[c]})`).join(', ')}`,
    '',
    'Matn:',
    text,
  ].filter(Boolean).join('\n');

  const result = await chat({ system, user, jsonMode: true }, config);
  if (!result.ok) return result;

  try {
    const parsed = parseJson(result.text);
    const translations = {};
    for (const code of targets) {
      if (typeof parsed[code] === 'string' && parsed[code].trim() !== '') translations[code] = parsed[code].trim();
    }
    if (Object.keys(translations).length === 0) return { ok: false, error: 'tarjima_topilmadi' };
    return { ok: true, translations };
  } catch (error) {
    return { ok: false, error: 'javob_json_emas' };
  }
}

/* ─────────────────────────── Matndan maydon ajratish ─────────────────────────── */

/**
 * Uzun matndan (masalan master-reja PDF matni) so'ralgan maydonlarni ajratadi.
 * @param {string} sourceText tahlil qilinadigan matn
 * @param {Array<{ key, label, type?, multiline? }>} fields kutilayotgan maydonlar
 * @param {object} [options] { locale?: string, kind?: string }
 * @returns {Promise<{ ok, fields?: object, notes?: string, error?: string }>}
 */
export async function extractFields(sourceText, fields, options = {}) {
  const config = getConfig();
  if (!config.enabled) return { ok: false, error: config.disabled ? 'ochirilgan' : 'kalit_yoq' };

  const text = String(sourceText || '').trim();
  if (text.length < 20) return { ok: false, error: 'matn_qisqa' };

  // Juda uzun matnni cheklaymiz — token chegarasi va narx uchun
  const clipped = text.slice(0, 24_000);
  const locale = options.locale || 'uz-cyrl';

  const fieldList = fields
    .map((f) => `- "${f.key}": ${f.label}${f.type ? ` (${f.type})` : ''}`)
    .join('\n');

  const system = [
    'Sen hujjatlardan ma\'lumot ajratuvchi yordamchisan.',
    `Berilgan hujjat matnidan quyidagi maydonlarni ${LOCALE_NAMES[locale] || locale}da to\'ldir.`,
    'Qoidalar:',
    '- FAQAT matnda haqiqatan bor ma\'lumotni yoz. Hujjatda yo\'q narsani O\'YLAB TOPMA.',
    '- Ma\'lumot topilmasa, o\'sha kalitni bo\'sh satr ("") qoldir.',
    '- Sana, raqam, maydon o\'lchamini aynan hujjatdagidek yoz.',
    '- Tavsif maydonlari uchun matndan qisqa, aniq xulosa tuz.',
    'Kutilayotgan maydonlar:',
    fieldList,
    '',
    'Javobni QAT\'IY JSON obyekt sifatida qaytar. Kalitlar — yuqoridagi maydon kalitlari.',
    'Qo\'shimcha "_notes" kalitida qisqacha izoh berishing mumkin (nima topildi, nima topilmadi).',
  ].join('\n');

  const user = `Hujjat matni:\n\n${clipped}`;

  const result = await chat({ system, user, jsonMode: true }, config);
  if (!result.ok) return result;

  try {
    const parsed = parseJson(result.text);
    const out = {};
    for (const field of fields) {
      const value = parsed[field.key];
      if (typeof value === 'string' && value.trim() !== '') out[field.key] = value.trim();
    }
    return { ok: true, fields: out, notes: typeof parsed._notes === 'string' ? parsed._notes : '' };
  } catch (error) {
    return { ok: false, error: 'javob_json_emas' };
  }
}

/* ─────────────────────────── Xatolikni tushuntirish ─────────────────────────── */

const ERROR_GUIDE = [
  { match: /kalit_yoq/, reason: 'AI kaliti kiritilmagan.', fix: 'Panelning «AI yordamchisi» bo\'limida API kalitini kiriting.' },
  { match: /^ochirilgan$/, reason: 'AI yordamchisi vaqtincha o\'chirilgan.', fix: '«AI yordamchisi» bo\'limida uni yoqing.' },
  { match: /^bosh_matn$/, reason: 'Manba matn bo\'sh.', fix: 'Avval kamida bitta tilda matn kiriting.' },
  { match: /^matn_qisqa$/, reason: 'Hujjat matni juda qisqa yoki o\'qilmadi.', fix: 'PDF matnli (skanerlanmagan) ekaniga ishonch hosil qiling.' },
  { match: /ACCESS_TOKEN_TYPE_UNSUPPORTED|access token type|oauth 2 access token/i, reason: 'Kalit noto\'g\'ri usulda yuborilyapti (eski dastur versiyasi).', fix: 'Yangi Gemini «AQ.» kaliti sarlavha orqali yuborilishi kerak. Kodning eng oxirgi versiyasini yuklab, Node ilovasini qayta ishga tushiring.' },
  { match: /location is not supported|FAILED_PRECONDITION|user location/i, reason: 'Gemini API hosting joylashgan hududda ishlamaydi (geografik cheklov).', fix: 'Bu kod xatosi emas — Google Gemini serveringiz joylashgan mamlakatni qo\'llab-quvvatlamaydi. Yechim: (1) OpenAI (ChatGPT) provayderiga o\'ting — u O\'zbekistonda ham ishlaydi; yoki (2) hosting so\'rovlarini qo\'llab-quvvatlanadigan hudud (masalan AQSH/Yevropa) orqali yo\'naltiring (proksi/VPN). Sayt AI\'siz to\'liq ishlaydi.' },
  { match: /incorrect api key|invalid.*api key|api key not valid|api_key_invalid|unauthorized|401/i, reason: 'API kaliti qabul qilinmadi.', fix: 'Kalit to\'g\'ri va amaldagi ekanini tekshiring. Gemini uchun aistudio.google.com dan yangi kalit oling.' },
  { match: /insufficient_quota|exceeded your current quota|billing|insufficient balance|no credit/i, reason: 'Hisobingizda kredit/balans tugagan.', fix: 'OpenAI: platform.openai.com → Billing bo\'limida hisobga mablag\' qo\'shing. Gemini: aistudio.google.com da limitlarni tekshiring.' },
  { match: /RESOURCE_EXHAUSTED|429|rate limit|rate_limit|too many requests|quota/i, reason: 'So\'rovlar soni daqiqalik limitdan oshdi (bepul limit juda kam).', fix: 'Bir daqiqa kutib, qayta urinib ko\'ring. Ketma-ket bosmang. Gemini bepul rejasida daqiqasiga bir necha so\'rovga ruxsat beriladi — kamroq foydalanuvchi model (masalan gemini-flash-latest o\'rniga gemini-flash-lite-latest) yoki to\'lovli reja limitni oshiradi.' },
  { match: /model.*not found|does not exist|not supported|unknown model|no such model|invalid model/i, reason: 'Tanlangan model mavjud emas yoki hisobingizga ochilmagan.', fix: 'AI sozlamalarida boshqa modelni tanlang. Ro\'yxat provayderdan olinadi — hisobingizga ruxsat berilgan modellar ko\'rinadi.' },
  { match: /temperature|response_format|max_tokens|max_completion_tokens|unsupported parameter|unsupported value/i, reason: 'Model ba\'zi so\'rov parametrlarini qabul qilmadi.', fix: 'Boshqa modelni tanlab ko\'ring. Bu odatda juda yangi yoki maxsus modellarda uchraydi.' },
  { match: /must be verified|organization must be verified|verify organization/i, reason: 'Bu model uchun tashkilotni tasdiqlash talab qilinadi.', fix: 'Oddiyroq modelni tanlang (masalan gpt-4o-mini yoki gemini-2.5-flash).' },
  { match: /so'rov vaqti tugadi|timeout/i, reason: 'AI serveriga ulanish vaqti tugadi.', fix: 'Hosting tashqi tarmoqqa chiqa oladimi tekshiring (api.openai.com / generativelanguage.googleapis.com).' },
  { match: /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|fetch failed|tarmoq xatoligi|getaddrinfo/i, reason: 'AI serveriga ulanib bo\'lmadi.', fix: 'Hosting tashqi tarmoqni to\'sib qo\'ygan bo\'lishi mumkin. Hosting xizmatidan chiqishni oching.' },
  { match: /so'rov rad etildi|blockReason|safety/i, reason: 'AI so\'rovni xavfsizlik sababli rad etdi.', fix: 'Matnni qayta ko\'rib chiqing yoki qismlarga bo\'lib urinib ko\'ring.' },
  { match: /javob_json_emas|tarjima_topilmadi|bo'sh_javob/i, reason: 'AI javobini o\'qib bo\'lmadi.', fix: 'Qaytadan urinib ko\'ring. Takrorlansa, boshqa modelni tanlang.' },
];

export function explainError(error) {
  const raw = String(error ?? '').trim();
  if (raw === '') return { raw: '', reason: '', fix: '' };
  for (const entry of ERROR_GUIDE) {
    if (entry.match.test(raw)) return { raw, reason: entry.reason, fix: entry.fix };
  }
  // Lug'atda topilmasa — xatolikning O'ZINI ko'rsatamiz (foydasiz umumiy matn emas).
  // Provayderdan kelgan matn odatda sababni aytadi.
  return {
    raw,
    reason: 'AI quyidagi xatolikni qaytardi:',
    fix: `«${raw}». Agar tushunarsiz bo'lsa, boshqa modelni tanlab ko'ring yoki kalitni tekshiring.`,
  };
}

/* ─────────────────────────── Tashxis ─────────────────────────── */

/** Sozlama holati va ulanish tekshiruvi. */
export async function diagnose({ probe = false } = {}) {
  const config = getConfig();
  const report = {
    provider: config.provider,
    providerLabel: PROVIDERS[config.provider].label,
    model: config.model,
    hasKey: Boolean(config.apiKey),
    keyMasked: maskKey(config.apiKey),
    keySource: config.keySource,
    disabled: config.disabled,
    enabled: config.enabled,
    proxy: config.proxy ? maskProxy(config.proxy) : '',
    proxyActive: isProxyActive(config.proxy),
    canUse: false,
    problem: null,
  };

  if (!config.apiKey) {
    report.problem = explainError('kalit_yoq');
    return report;
  }
  if (config.disabled) {
    report.problem = explainError('ochirilgan');
    return report;
  }

  // Faqat so'ralganda haqiqiy so'rov yuboramiz (sinov tugmasi bosilganda)
  if (probe) {
    const result = await chat(
      { system: 'Faqat "OK" deb javob ber.', user: 'Aloqa sinovi.' },
      config,
    );
    if (result.ok) report.canUse = true;
    else report.problem = explainError(result.error);
  } else {
    report.canUse = true; // kalit bor, o'chirilmagan — ehtimol ishlaydi
  }

  return report;
}
