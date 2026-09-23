#!/usr/bin/env node
/**
 * Qurilgan saytni tekshirish: ichki havolalar, fayllar, til versiyalari,
 * sarlavhalar va asosiy qulaylik (accessibility) shartlari.
 *
 * Ishlatilishi:
 *   node src/check.mjs              # dist/ ni tekshiradi
 *   node src/check.mjs --dir other
 *
 * Xatolik topilsa 1 kodi bilan tugaydi — CI da ishlatish uchun qulay.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const index = argv.indexOf('--dir');
const DIST = path.resolve(ROOT, index !== -1 && argv[index + 1] ? argv[index + 1] : 'dist');

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

if (!existsSync(DIST)) {
  console.error(`\n  ${DIST} topilmadi. Avval "npm run build" buyrug'ini bajaring.\n`);
  process.exit(1);
}

/* ── Fayllarni yig'ish ── */

function walk(dir, list = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else list.push(full);
  }
  return list;
}

const files = walk(DIST);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const relative = (file) => `/${path.relative(DIST, file).split(path.sep).join('/')}`;

/* ── Majburiy fayllar ── */

for (const required of ['index.html', 'sitemap.xml', 'robots.txt', 'manifest.webmanifest', 'sw.js', '404.html', 'assets/css/main.css', 'assets/js/app.js']) {
  if (!existsSync(path.join(DIST, required))) fail(`Majburiy fayl yo'q: /${required}`);
}

/* ── Har bir HTML sahifani tekshirish ── */

const pathExists = (urlPath) => {
  const clean = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  if (clean === '' || clean === '/') return existsSync(path.join(DIST, 'index.html'));
  const target = path.join(DIST, clean.replace(/^\//, ''));
  if (existsSync(target)) {
    return statSync(target).isDirectory() ? existsSync(path.join(target, 'index.html')) : true;
  }
  return existsSync(path.join(target, 'index.html')) || existsSync(`${target}.html`);
};

let totalLinks = 0;
const localeCodes = new Set();

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const page = relative(file);

  // Sarlavha va til
  if (!/<title>[^<]{3,}<\/title>/.test(html)) fail(`${page}: <title> yo'q yoki juda qisqa.`);
  const langMatch = /<html[^>]*\blang="([^"]+)"/.exec(html);
  if (!langMatch) fail(`${page}: <html lang> atributi yo'q.`);
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) {
    warn(`${page}: meta description qisqa yoki yo'q.`);
  }
  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  if (h1Count === 0) fail(`${page}: <h1> sarlavha yo'q.`);
  if (h1Count > 1) warn(`${page}: ${h1Count} ta <h1> bor — sahifada bittasi bo'lishi tavsiya etiladi.`);

  const localeMatch = /^\/([a-z]{2}(?:-[a-z]+)?)\//.exec(page);
  if (localeMatch) localeCodes.add(localeMatch[1]);

  // Qulaylik: skip-link, viewport
  if (!/class="skip-link"/.test(html)) warn(`${page}: asosiy mazmunga o'tish havolasi yo'q.`);
  if (!/name="viewport"/.test(html)) fail(`${page}: viewport meta tegi yo'q.`);

  // alt atributi
  for (const img of html.match(/<img\b[^>]*>/g) || []) {
    if (!/\salt=/.test(img)) fail(`${page}: alt atributi yo'q rasm: ${img.slice(0, 90)}`);
  }

  // Ichki havolalar
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?][^"]*)"/g)) {
    const url = match[1];
    if (url.startsWith('//')) continue;
    totalLinks += 1;
    if (!pathExists(url)) fail(`${page}: ishlamaydigan havola → ${url}`);
  }

  // target="_blank" uchun rel
  for (const anchor of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) {
    if (!/rel="[^"]*noopener/.test(anchor)) {
      warn(`${page}: target="_blank" havolasida rel="noopener" yo'q.`);
    }
  }

  // Tasodifiy qolib ketgan shablon belgilari
  if (/\$\{/.test(html)) fail(`${page}: shablon ifodasi (\${...}) matn ichida qolib ketgan.`);
  if (/\bundefined\b/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) {
    warn(`${page}: matnda "undefined" so'zi uchraydi — ma'lumot yetishmasligi bo'lishi mumkin.`);
  }
}

/* ── Til versiyalari to'liqmi ── */

const expectedLocales = ['uz', 'uz-cyrl', 'ru', 'en'];
for (const code of expectedLocales) {
  if (!localeCodes.has(code)) fail(`"${code}" tilidagi sahifalar qurilmagan.`);
}

// Har bir tilda bir xil sahifalar to'plami bo'lishi kerak
const pagesByLocale = new Map();
for (const file of htmlFiles) {
  const page = relative(file);
  const match = /^\/([a-z]{2}(?:-[a-z]+)?)\/(.*)$/.exec(page);
  if (!match) continue;
  const [, code, rest] = match;
  if (!pagesByLocale.has(code)) pagesByLocale.set(code, new Set());
  pagesByLocale.get(code).add(rest);
}
const reference = pagesByLocale.get('uz-cyrl');
if (reference) {
  for (const [code, pages] of pagesByLocale) {
    if (code === 'uz-cyrl') continue;
    for (const page of reference) {
      if (!pages.has(page)) fail(`"${code}" tilida sahifa yo'q: ${page}`);
    }
  }
}

/* ── hreflang ── */

for (const file of htmlFiles.filter((f) => !f.endsWith('404.html'))) {
  const html = readFileSync(file, 'utf8');
  if (!/rel="alternate" hreflang=/.test(html) && !/noindex/.test(html)) {
    warn(`${relative(file)}: hreflang havolalari yo'q.`);
  }
}

/* ── sitemap ── */

const sitemapPath = path.join(DIST, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) fail('sitemap.xml bo\'sh.');
  for (const loc of locs) {
    const urlPath = loc.startsWith('http') ? new URL(loc).pathname : loc;
    if (!pathExists(urlPath)) fail(`sitemap.xml da mavjud bo'lmagan sahifa: ${loc}`);
  }
}

/* ── Natija ── */

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const totalSize = files.reduce((sum, file) => sum + statSync(file).size, 0);
const cssSize = existsSync(path.join(DIST, 'assets/css/main.css')) ? statSync(path.join(DIST, 'assets/css/main.css')).size : 0;
const jsSize = files
  .filter((file) => file.includes(`${path.sep}assets${path.sep}js${path.sep}`))
  .reduce((sum, file) => sum + statSync(file).size, 0);

console.log('');
console.log(`  Tekshirildi: ${DIST}`);
console.log(`  Sahifalar: ${htmlFiles.length} · Ichki havolalar: ${totalLinks} · Tillar: ${[...localeCodes].sort().join(', ')}`);
console.log(`  Hajmi: jami ${kb(totalSize)} (CSS ${kb(cssSize)}, JS ${kb(jsSize)})`);

if (warnings.length > 0) {
  console.log(`\n  Ogohlantirishlar (${warnings.length}):`);
  for (const message of warnings.slice(0, 30)) console.log(`   • ${message}`);
  if (warnings.length > 30) console.log(`   … va yana ${warnings.length - 30} ta`);
}

if (errors.length > 0) {
  console.log(`\n  XATOLIKLAR (${errors.length}):`);
  for (const message of errors.slice(0, 40)) console.log(`   ✗ ${message}`);
  if (errors.length > 40) console.log(`   … va yana ${errors.length - 40} ta`);
  console.log('');
  process.exit(1);
}

console.log('\n  Xatolik topilmadi.\n');
