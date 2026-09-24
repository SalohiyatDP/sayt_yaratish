/**
 * Murojaat shakli uchun serverless funksiya (Cloudflare Worker).
 *
 * FAQAT statik hostingda ishlatiladi — sayt Node.js serveri bo'lmagan joyda
 * joylashtirilgan, lekin murojaatlar Telegram botga kelishi kerak bo'lganda.
 *
 * Bot tokeni brauzerga CHIQMAYDI — u faqat shu funksiya ichida, Cloudflare
 * «Secret» turidagi o'zgaruvchisida saqlanadi.
 *
 * Kerakli o'zgaruvchilar (Settings → Variables and Secrets):
 *   TELEGRAM_BOT_TOKEN   — @BotFather bergan token          (Secret)
 *   TELEGRAM_CHAT_ID     — masalan -1001234567890           (Secret)
 *   ALLOWED_ORIGIN       — https://sayt-manzili.uz           (Text)
 *   TELEGRAM_THREAD_ID   — ixtiyoriy, forum guruhidagi mavzu (Text)
 *
 * MUHIM CHEKLOV: bu variantda murojaat hech qayerda saqlanmaydi.
 * Telegramga yetib bormasa, xabar butunlay yo'qoladi va foydalanuvchiga
 * xatolik ko'rsatiladi (soxta muvaffaqiyat xabari chiqarilmaydi).
 * Batafsil: serverless/README.md
 */

const MAX_BODY = 64 * 1024; // 64 KB
const LIMITS = {
  name: 200,
  organization: 200,
  phone: 50,
  email: 200,
  area: 200,
  message: 5000,
  locale: 20,
  page: 500,
};

const LOCALE_NAMES = {
  'uz-cyrl': "o'zbek (kirill)",
  uz: "o'zbek (lotin)",
  ru: 'rus',
  en: 'ingliz',
};

export default {
  async fetch(request, env) {
    const allowedOrigin = (env.ALLOWED_ORIGIN || '').replace(/\/$/, '');
    const origin = request.headers.get('Origin') || '';

    // Brauzerning oldindan so'rovi (preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, allowedOrigin);
    }

    // Faqat o'z saytimizdan kelgan so'rovlar qabul qilinadi
    if (allowedOrigin && origin && origin.replace(/\/$/, '') !== allowedOrigin) {
      return json({ ok: false, error: 'forbidden_origin' }, 403, allowedOrigin);
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      // Sozlanmagan bo'lsa ham soxta muvaffaqiyat xabari qaytarilmaydi
      return json({ ok: false, error: 'not_configured' }, 503, allowedOrigin);
    }

    /* ── So'rov mazmunini o'qish ── */
    let payload;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ ok: false, error: 'too_large' }, 413, allowedOrigin);
      payload = JSON.parse(raw || '{}');
    } catch (error) {
      return json({ ok: false, error: 'invalid_body' }, 400, allowedOrigin);
    }

    const record = {};
    for (const [field, max] of Object.entries(LIMITS)) {
      record[field] = clean(payload[field], max);
    }
    record.consent = payload.consent === true;

    /* ── Tekshirish (sayt tomonidagi tekshiruv bilan bir xil) ── */
    const errors = [];
    if (!record.name) errors.push('name');
    if (!record.message) errors.push('message');
    if (!record.phone && !record.email) errors.push('contact');
    if (record.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(record.email)) errors.push('email');
    if (!record.consent) errors.push('consent');
    if (errors.length > 0) {
      return json({ ok: false, error: 'validation', fields: errors }, 422, allowedOrigin);
    }

    /* ── Ro'yxatga olish raqami ── */
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = [...crypto.getRandomValues(new Uint8Array(3))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const id = `${datePart}-${randomPart}`;

    /* ── Telegramga yuborish ── */
    const text = formatMessage({ ...record, id, receivedAt: now.toISOString() });
    const body = {
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    };
    if (env.TELEGRAM_THREAD_ID) body.message_thread_id = Number(env.TELEGRAM_THREAD_ID);

    const markup = replyMarkup(record);
    if (markup) body.reply_markup = markup;

    let delivered = false;
    let lastError = 'nomalum xatolik';

    // Vaqtinchalik xatoliklarda 2 marta qayta uriniladi
    for (let attempt = 1; attempt <= 2 && !delivered; attempt += 1) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.ok) {
          delivered = true;
        } else {
          lastError = data?.description || `HTTP ${response.status}`;
          // Qaytarib bo'lmaydigan xatolikda qayta urinmaymiz
          if ([400, 401, 403].includes(response.status)) break;
        }
      } catch (error) {
        lastError = error?.message || 'tarmoq xatoligi';
      }
    }

    if (!delivered) {
      console.error(`Murojaat ${id} yuborilmadi: ${lastError}`);
      // Xabar saqlanmagani uchun muvaffaqiyat deb aytmaymiz
      return json({ ok: false, error: 'not_delivered' }, 502, allowedOrigin);
    }

    console.log(`Murojaat ${id} yuborildi`);
    return json({ ok: true, id }, 201, allowedOrigin);
  },
};

/* ─────────────────────────── Yordamchilar ─────────────────────────── */

function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, allowedOrigin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(allowedOrigin),
    },
  });
}

/** Boshqaruv belgilarini olib tashlaydi va uzunligini cheklaydi. */
function clean(value, max) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMessage(record) {
  const line = (icon, label, value) =>
    value ? `${icon} <b>${label}:</b> ${escapeHtml(value)}` : null;

  const parts = [
    `📨 <b>Saytdan yangi murojaat</b>  <code>${escapeHtml(record.id)}</code>`,
    '',
    line('👤', 'Ism-familiya', record.name),
    line('🏢', 'Tashkilot', record.organization),
    line('📞', 'Telefon', record.phone),
    line('✉️', 'Pochta', record.email),
    line('📍', 'Qiziqtirgan hudud', record.area),
    line('🌐', 'Sayt tili', LOCALE_NAMES[record.locale] || record.locale),
  ].filter((part) => part !== null);

  if (record.message) {
    parts.push('', '💬 <b>Xabar:</b>', `<blockquote>${escapeHtml(record.message)}</blockquote>`);
  }
  parts.push('', `🕒 ${record.receivedAt.replace('T', ' ').slice(0, 16)} (UTC)`);
  if (record.page) parts.push(`🔗 ${escapeHtml(record.page)}`);

  const text = parts.join('\n');
  return text.length > 4096 ? `${text.slice(0, 4076)}\n… (qisqartirildi)` : text;
}

function replyMarkup(record) {
  const row = [];
  if (record.email) row.push({ text: '✉️ Javob yozish', url: `mailto:${record.email}` });
  if (/^https?:\/\//i.test(record.page || '')) row.push({ text: '🔗 Sahifa', url: record.page });
  return row.length > 0 ? { inline_keyboard: [row] } : undefined;
}
