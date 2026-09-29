/**
 * Hosting kirish nuqtasi.
 *
 * Ko'p hostinglar (cPanel «Setup Node.js App», Plesk, Passenger, ba'zi PaaS
 * xizmatlari) ilova ildizidagi `app.js` faylini qidiradi. Bu fayl shunchaki
 * haqiqiy serverni ishga tushiradi.
 *
 * Port hosting tomonidan `PORT` muhit o'zgaruvchisi orqali beriladi —
 * server uni avtomatik o'qiydi.
 *
 * Qo'lda ishga tushirish uchun bu fayl shart emas:
 *     node server/server.mjs
 *
 * ─── AI proksisi ──────────────────────────────────────────────────────────
 * Agar hosting IP manzili AI provayder tomonidan bloklangan bo'lsa (masalan
 * Google Gemini «User location is not supported»), so'rovlarni ruxsat berilgan
 * hudud orqali yo'naltirish uchun proksi ishlatiladi. Node ning native `fetch`i
 * proksini faqat `--use-env-proxy` bayrog'i bilan ishlatadi. Bu bayroqni ilova
 * ishga tushgandan keyin qo'shib bo'lmaydi, shuning uchun bu yerda — server
 * yuklanishidan OLDIN — proksi sozlangani tekshiriladi va kerak bo'lsa jarayon
 * o'sha bayroq bilan bir marta qayta ishga tushiriladi. Foydalanuvchi hech
 * qanday env sozlamasdan, faqat panelда proksini kiritishi kifoya.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function readAiProxy() {
  // Env ustuvor — allaqachon berilgan bo'lsa, ai.json ni o'qimaymiz
  const envProxy = String(
    process.env.AI_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || '',
  ).trim();
  if (envProxy) return envProxy;
  try {
    const raw = fs.readFileSync(path.join(here, 'server', 'data', 'ai.json'), 'utf8');
    const data = JSON.parse(raw);
    return typeof data.proxy === 'string' ? data.proxy.trim() : '';
  } catch {
    return '';
  }
}

const proxy = readAiProxy();
const proxyActive =
  process.env.NODE_USE_ENV_PROXY === '1' ||
  /--use-env-proxy/.test(String(process.env.NODE_OPTIONS || '')) ||
  (process.execArgv || []).some((a) => a.includes('use-env-proxy'));

// Proksi sozlangan, lekin jarayon uni ishlatadigan bayroqsiz ishga tushgan —
// o'zimizni to'g'ri bayroq va env bilan bir marta qayta ishga tushiramiz.
// `AI_PROXY_BOOTSTRAPPED` cheksiz siklni oldini oladi.
if (proxy && !proxyActive && process.env.AI_PROXY_BOOTSTRAPPED !== '1') {
  const env = {
    ...process.env,
    AI_PROXY_BOOTSTRAPPED: '1',
    HTTPS_PROXY: proxy,
    HTTP_PROXY: proxy,
    // Lokal manzillar (hosting sokети, 127.0.0.1) proksisiz qolsin
    NO_PROXY: [process.env.NO_PROXY, 'localhost,127.0.0.1,::1'].filter(Boolean).join(','),
  };
  const result = spawnSync(
    process.execPath,
    ['--use-env-proxy', path.join(here, 'server', 'server.mjs'), ...process.argv.slice(2)],
    { stdio: 'inherit', env },
  );
  process.exit(result.status ?? 0);
} else {
  // Proksi kerak emas yoki allaqachon faol — serverni odatdagidek yuklaymiz
  await import('./server/server.mjs');
}
