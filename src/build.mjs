#!/usr/bin/env node
/**
 * Statik sayt generatori.
 *
 * Ishlatilishi:
 *   node src/build.mjs            — faqat tasdiqlangan kontent bilan quradi
 *   node src/build.mjs --demo     — "demo: true" deb belgilangan namuna yozuvlarni ham qo'shadi
 *   node src/build.mjs --out DIR  — natijani boshqa katalogga yozadi
 *
 * Hech qanday npm paketi talab qilinmaydi.
 */
import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContent } from './lib/content.mjs';
import { loadLocales, createTranslator, pickText, urlFor, alternateUrls, SECTIONS, MAIN_NAV } from './lib/i18n.mjs';
import { renderPage } from './lib/layout.mjs';
import { stripTags, truncate, isoDate } from './lib/util.mjs';

import { homePage } from './templates/home.mjs';
import { aboutPage } from './templates/about.mjs';
import { areasPage } from './templates/areas.mjs';
import { areaPage } from './templates/area.mjs';
import { lotPage } from './templates/lot.mjs';
import { masterplansPage, masterplanPage } from './templates/masterplans.mjs';
import { investorsPage } from './templates/investors.mjs';
import { newsListPage, newsItemPage } from './templates/news.mjs';
import { contactPage } from './templates/contact.mjs';
import { accessibilityPage, notFoundPage, offlinePage } from './templates/simple.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
};

const OPTIONS = {
  demo: flag('demo'),
  outDir: path.resolve(ROOT, option('out', 'dist')),
  quiet: flag('quiet'),
};

const warnings = [];
const seenWarnings = new Set();
const log = (...args) => {
  if (!OPTIONS.quiet) console.log(...args);
};
const warn = (message) => {
  if (seenWarnings.has(message)) return;
  seenWarnings.add(message);
  warnings.push(message);
};

/* ─────────────────────────── Asosiy jarayon ─────────────────────────── */

function build() {
  const started = Date.now();
  const contentDir = path.join(ROOT, 'content');
  const content = loadContent(contentDir, { demo: OPTIONS.demo });
  const { dictionaries, codes, defaultLocale } = loadLocales(path.join(ROOT, 'i18n'));

  validateContent(content);

  const now = new Date();
  const buildInfo = {
    isoDate: now.toISOString().slice(0, 10),
    isoDateTime: now.toISOString(),
    year: now.getUTCFullYear(),
    demo: OPTIONS.demo,
  };

  // dist/ ni tozalash
  rmSync(OPTIONS.outDir, { recursive: true, force: true });
  mkdirSync(OPTIONS.outDir, { recursive: true });

  const written = [];
  const sitemapEntries = [];

  for (const locale of codes) {
    const ctx = createContext({ locale, dictionaries, codes, defaultLocale, content, buildInfo });
    const pages = collectPages(ctx, content);

    for (const page of pages) {
      const targetPath = page.path || urlFor(locale, page.section || 'home', page.slug);
      const html = renderPage(ctx, { ...page, path: targetPath, alternates: page.alternates ?? alternateUrls(codes, page.section || 'home', page.slug) });
      const file = path.join(OPTIONS.outDir, targetPath.replace(/^\//, ''), 'index.html');
      writeFile(file, html);
      written.push(targetPath);
      if (!page.noindex) {
        sitemapEntries.push({
          loc: targetPath,
          alternates: alternateUrls(codes, page.section || 'home', page.slug),
          lastmod: page.lastmod || buildInfo.isoDate,
          priority: page.priority ?? (page.section === 'home' && !page.slug ? '1.0' : '0.7'),
        });
      }
    }

    // Brauzer uchun ma'lumot fayllari
    writeFile(
      path.join(OPTIONS.outDir, 'data', `lots-${locale}.json`),
      JSON.stringify(buildCatalogData(ctx, content)),
    );
    writeFile(
      path.join(OPTIONS.outDir, 'data', `search-${locale}.json`),
      JSON.stringify(buildSearchIndex(ctx, content)),
    );

    // 404 va offline sahifalari (har bir til uchun)
    const notFound = notFoundPage(ctx);
    writeFile(
      path.join(OPTIONS.outDir, locale, '404.html'),
      renderPage(ctx, { ...notFound, path: urlFor(locale, 'home'), alternates: alternateUrls(codes, 'home') }),
    );
    const offline = offlinePage(ctx);
    writeFile(
      path.join(OPTIONS.outDir, locale, 'offline', 'index.html'),
      renderPage(ctx, { ...offline, path: `${urlFor(locale, 'home')}offline/`, alternates: [] }),
    );
  }

  copyStaticAssets();
  writeRootRedirect(codes, defaultLocale, dictionaries, content);
  writeRootNotFound(codes, defaultLocale);
  writeSitemap(sitemapEntries, content);
  writeRobots(content);
  writeManifest(content, defaultLocale, dictionaries);
  writeServiceWorker(codes, defaultLocale);
  writeBuildInfo(buildInfo, written.length, content);

  const seconds = ((Date.now() - started) / 1000).toFixed(2);
  log(`\n  Sayt qurildi: ${OPTIONS.outDir}`);
  log(`  Sahifalar: ${written.length} ta (${codes.length} til)`);
  log(`  Hududlar: ${content.areas.length} · Lotlar: ${content.lots.length} · Master-rejalar: ${content.masterplans.length} · Yangiliklar: ${content.news.length}`);
  log(`  Rejim: ${OPTIONS.demo ? 'DEMO (namuna ma\'lumotlar qo\'shildi)' : 'faqat tasdiqlangan kontent'}`);
  log(`  Vaqt: ${seconds}s`);

  if (warnings.length > 0) {
    log(`\n  Diqqat (${warnings.length}):`);
    for (const message of warnings) log(`   • ${message}`);
  }
  log('');
}

/* ─────────────────────────── Kontekst ─────────────────────────── */

function createContext({ locale, dictionaries, codes, defaultLocale, content, buildInfo }) {
  const t = createTranslator(dictionaries, locale, defaultLocale);
  const logoSrc = resolveLogo(content.site);
  return {
    locale,
    codes,
    defaultLocale,
    dictionaries,
    t,
    content,
    site: content.site,
    pages: content.pages,
    buildInfo,
    branding: { logoSrc },
    pick: (value) => pickText(value, locale),
    url: (section, slug = null) => urlFor(locale, section, slug),
  };
}

function resolveLogo(site) {
  const configured = String(site.media?.logo || '').trim();
  if (configured) {
    const local = path.join(ROOT, configured.replace(/^\//, ''));
    if (configured.startsWith('http') || existsSync(local)) return configured;
    warn(`Logotip fayli topilmadi: ${configured} — vaqtinchalik belgi ishlatiladi.`);
    return null;
  }
  // Odatiy joylashuvni tekshirish
  for (const candidate of ['assets/img/logo.svg', 'assets/img/logo.png']) {
    if (existsSync(path.join(ROOT, candidate))) return `/${candidate}`;
  }
  warn(
    "Rasmiy logotip fayli joylashtirilmagan. Uni assets/img/logo.svg sifatida saqlang yoki content/site.json -> media.logo maydonida ko'rsating.",
  );
  return null;
}

/* ─────────────────────────── Sahifalar ro'yxati ─────────────────────────── */

function collectPages(ctx, content) {
  const pages = [
    { ...homePage(ctx), priority: '1.0' },
    aboutPage(ctx),
    { ...areasPage(ctx), priority: '0.9' },
    masterplansPage(ctx),
    { ...investorsPage(ctx), priority: '0.9' },
    newsListPage(ctx),
    contactPage(ctx),
    accessibilityPage(ctx),
  ];

  // Hudud sahifalari — lotlardan yuqori darajada turadi
  for (const area of content.areas) {
    pages.push({ ...areaPage(ctx, area), lastmod: isoDate(area.updatedAt) || undefined, priority: '0.85' });
  }
  for (const lot of content.lots) {
    pages.push({ ...lotPage(ctx, lot), lastmod: isoDate(lot.updatedAt) || undefined, priority: '0.8' });
  }
  for (const plan of content.masterplans) {
    pages.push({ ...masterplanPage(ctx, plan), lastmod: isoDate(plan.updatedAt) || undefined });
  }
  for (const item of content.news) {
    pages.push({ ...newsItemPage(ctx, item), lastmod: isoDate(item.date) || undefined, priority: '0.5' });
  }
  return pages;
}

/* ─────────────────────────── Brauzer uchun ma'lumotlar ─────────────────────────── */

function buildCatalogData(ctx, content) {
  const taxonomy = (list) =>
    (list || []).map((item) => ({ id: item.id, name: ctx.pick(item.name), tone: item.tone, step: item.step }));

  return {
    locale: ctx.locale,
    generatedAt: ctx.buildInfo.isoDateTime,
    demo: content.demo,
    taxonomies: {
      districts: taxonomy(content.taxonomies.districts),
      areaTypes: taxonomy(content.taxonomies.areaTypes),
      lotStatuses: taxonomy(content.taxonomies.lotStatuses),
      tourismDirections: taxonomy(content.taxonomies.tourismDirections),
    },
    lots: content.lots.map((lot) => ({
      id: lot.id,
      slug: lot.slug,
      url: ctx.url('lots', lot.slug),
      name: ctx.pick(lot.name),
      lotNumber: lot.lotNumber || null,
      district: lot.district || null,
      districtName: ctx.pick(content.lookup.districts.get(String(lot.district))?.name),
      areaType: lot.areaType || null,
      areaTypeName: ctx.pick(content.lookup.areaTypes.get(String(lot.areaType))?.name),
      status: lot.status,
      statusName: ctx.pick(content.lookup.lotStatuses.get(String(lot.status))?.name),
      statusTone: content.lookup.lotStatuses.get(String(lot.status))?.tone || 'neutral',
      tourismDirections: lot.tourismDirections,
      areaHa: lot.areaHa,
      areaSotix: lot.areaSotix,
      coordinates: lot.coordinates,
      boundary: lot.boundary,
      shortDescription: ctx.pick(lot.shortDescription),
      cover: lot.photos[0]?.src || lot.renders[0]?.src || null,
      coverKind: lot.photos[0] ? 'photo' : lot.renders[0] ? 'render' : null,
      auction: {
        verified: lot.auction.verified,
        startPrice: lot.auction.startPrice,
        currency: lot.auction.currency,
        startDate: lot.auction.startDate,
        lotUrl: lot.auction.lotUrl,
      },
      updatedAt: isoDate(lot.updatedAt),
      demo: lot.demo,
    })),
  };
}

function buildSearchIndex(ctx, content) {
  const entries = [];

  for (const lot of content.lots) {
    entries.push({
      type: 'lots',
      title: ctx.pick(lot.name),
      url: ctx.url('lots', lot.slug),
      meta: [ctx.pick(content.lookup.districts.get(String(lot.district))?.name), ctx.pick(content.lookup.lotStatuses.get(String(lot.status))?.name)]
        .filter(Boolean)
        .join(' · '),
      text: truncate(stripTags([ctx.pick(lot.shortDescription), ctx.pick(lot.location), lot.lotNumber].filter(Boolean).join(' ')), 140),
      demo: lot.demo,
    });
  }
  for (const plan of content.masterplans) {
    entries.push({
      type: 'masterplans',
      title: ctx.pick(plan.title),
      url: ctx.url('masterplans', plan.slug),
      meta: ctx.pick(content.lookup.masterplanStatuses.get(String(plan.status))?.name),
      text: truncate(stripTags(ctx.pick(plan.summary)), 140),
      demo: plan.demo,
    });
  }
  for (const item of content.news) {
    entries.push({
      type: 'news',
      title: ctx.pick(item.title),
      url: ctx.url('news', item.slug),
      meta: item.date,
      text: truncate(stripTags(ctx.pick(item.lead) || ctx.pick(item.body)), 140),
      demo: item.demo,
    });
  }
  for (const section of [...MAIN_NAV, 'accessibility']) {
    const pageContent = content.pages[section === 'about' ? 'about' : section] || {};
    entries.push({
      type: 'pages',
      title: ctx.t(`nav.${section}`),
      url: ctx.url(section),
      meta: '',
      text: truncate(stripTags(ctx.pick(pageContent.lead)), 140),
      demo: false,
    });
  }

  return { locale: ctx.locale, generatedAt: ctx.buildInfo.isoDateTime, entries };
}

/* ─────────────────────────── Statik fayllar ─────────────────────────── */

function copyStaticAssets() {
  const source = path.join(ROOT, 'assets');
  if (!existsSync(source)) return;
  cpSync(source, path.join(OPTIONS.outDir, 'assets'), { recursive: true });
}

function writeRootRedirect(codes, defaultLocale, dictionaries, content) {
  const name = pickText(content.site.institution?.name, defaultLocale);
  const mission = pickText(content.site.mission, defaultLocale);
  const links = codes
    .map((code) => {
      const meta = dictionaries[code]?._meta || {};
      return `<li><a class="root-lang" href="/${code}/" lang="${escapeHtml(meta.htmlLang || code)}" hreflang="${escapeHtml(meta.htmlLang || code)}">
        <span class="root-lang__code">${escapeHtml(meta.shortLabel || code)}</span>
        <span class="root-lang__name">${escapeHtml(meta.nativeName || code)}</span>
      </a></li>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="${defaultLocale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)}</title>
<meta name="description" content="${escapeHtml(mission)}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="/${defaultLocale}/">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/main.css">
<meta http-equiv="refresh" content="1; url=/${defaultLocale}/">
${codes
  .map((code) => {
    const meta = dictionaries[code]?._meta || {};
    return `<link rel="alternate" hreflang="${escapeHtml(meta.htmlLang || code)}" href="/${code}/">`;
  })
  .join('\n')}
<link rel="alternate" hreflang="x-default" href="/${defaultLocale}/">
<style>
.root-gate { display: grid; place-items: center; min-height: 100vh; padding: 2rem 1rem; text-align: center; }
.root-gate__inner { max-width: 44rem; }
.root-gate__name { font-size: var(--fs-lg); font-weight: 650; margin-bottom: var(--space-5); color: var(--text-soft); }
.root-langs { display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); list-style: none; margin: var(--space-6) 0 0; padding: 0; }
.root-langs li { margin: 0; }
.root-lang { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); text-decoration: none; color: var(--text); font-weight: 600; }
.root-lang:hover { border-color: var(--primary); background: var(--primary-soft); }
.root-lang__code { flex: none; min-width: 2.6rem; padding: 0.15rem 0.35rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: var(--fs-xs); font-weight: 700; }
</style>
<script>
/* Brauzer tiliga mos bo'limga yo'naltirish */
(function(){
  var supported = ${JSON.stringify(codes)};
  var fallback = ${JSON.stringify(defaultLocale)};
  var target = fallback;
  try {
    var saved = localStorage.getItem('direksiya.locale');
    if (saved && supported.indexOf(saved) !== -1) { target = saved; }
    else {
      var langs = navigator.languages || [navigator.language || ''];
      for (var i = 0; i < langs.length; i++) {
        var l = String(langs[i]).toLowerCase();
        if (l.indexOf('ru') === 0) { target = 'ru'; break; }
        if (l.indexOf('en') === 0) { target = 'en'; break; }
        if (l.indexOf('uz') === 0) { target = l.indexOf('cyrl') !== -1 ? 'uz-cyrl' : 'uz'; break; }
      }
    }
  } catch (e) {}
  location.replace('/' + target + '/');
})();
</script>
</head>
<body class="page">
<main class="root-gate" id="main">
  <div class="root-gate__inner">
    <img src="/assets/img/favicon.svg" alt="" width="64" height="64" style="margin:0 auto var(--space-5)">
    <h1>Tilni tanlang · Тилни танланг · Выберите язык · Choose a language</h1>
    <p class="root-gate__name">${escapeHtml(name)}</p>
    <ul class="root-langs">
${links}
    </ul>
    <p class="muted small" style="margin-top:var(--space-6)">
      Bir soniyadan keyin avtomatik yo'naltirilasiz ·
      Вы будете перенаправлены автоматически ·
      You will be redirected automatically
    </p>
  </div>
</main>
</body>
</html>
`;
  writeFile(path.join(OPTIONS.outDir, 'index.html'), html);
}

function writeRootNotFound(codes, defaultLocale) {
  // Ko'pgina statik hostinglar (GitHub Pages, Netlify) ildizdagi 404.html faylini ishlatadi.
  const source = path.join(OPTIONS.outDir, defaultLocale, '404.html');
  if (existsSync(source)) {
    writeFile(path.join(OPTIONS.outDir, '404.html'), readFileSync(source, 'utf8'));
  }
}

function writeSitemap(entries, content) {
  const origin = String(content.site.seo?.canonicalOrigin || '').replace(/\/$/, '');
  const abs = (loc) => escapeHtml(origin ? `${origin}${loc}` : loc);
  const body = entries
    .map(
      (entry) => `  <url>
    <loc>${abs(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <priority>${entry.priority}</priority>
${entry.alternates.map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt.locale}" href="${abs(alt.url)}"/>`).join('\n')}
  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
  writeFile(path.join(OPTIONS.outDir, 'sitemap.xml'), xml);
  if (!origin) {
    warn(
      "content/site.json -> seo.canonicalOrigin bo'sh. Sayt manzilini kiritsangiz, sitemap.xml va canonical havolalar to'liq URL bilan yoziladi.",
    );
  }
}

function writeRobots(content) {
  const origin = String(content.site.seo?.canonicalOrigin || '').replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    origin ? `Sitemap: ${origin}/sitemap.xml` : 'Sitemap: /sitemap.xml',
    '',
  ];
  writeFile(path.join(OPTIONS.outDir, 'robots.txt'), lines.join('\n'));
}

function writeManifest(content, defaultLocale, dictionaries) {
  const name = pickText(content.site.institution?.name, defaultLocale);
  const shortName = pickText(content.site.institution?.abbr, defaultLocale) || 'Direksiya';
  const manifest = {
    name,
    short_name: shortName,
    description: pickText(content.site.mission, defaultLocale),
    lang: dictionaries[defaultLocale]?._meta?.htmlLang || defaultLocale,
    dir: 'ltr',
    start_url: `/${defaultLocale}/`,
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b2e4f',
    icons: [
      { src: '/assets/img/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/assets/img/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
  writeFile(path.join(OPTIONS.outDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
}

function writeServiceWorker(codes, defaultLocale) {
  const precache = [
    '/assets/css/main.css',
    '/assets/js/app.js',
    '/assets/img/favicon.svg',
    ...codes.map((code) => `/${code}/`),
    ...codes.map((code) => `/${code}/offline/`),
  ];
  const sw = `/* Direksiya sayti — oflayn qo'llab-quvvatlash uchun xizmat ishchisi (service worker). */
const VERSION = 'direksiya-v${Date.now()}';
const PRECACHE = ${JSON.stringify(precache)};
const OFFLINE_BY_LOCALE = ${JSON.stringify(Object.fromEntries(codes.map((c) => [c, `/${c}/offline/`])))};
const DEFAULT_OFFLINE = '/${defaultLocale}/offline/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function offlineFor(url) {
  const match = /^\\/([a-z-]+)\\//.exec(new URL(url).pathname);
  return (match && OFFLINE_BY_LOCALE[match[1]]) || DEFAULT_OFFLINE;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(offlineFor(request.url)))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
`;
  writeFile(path.join(OPTIONS.outDir, 'sw.js'), sw);
}

function writeBuildInfo(buildInfo, pageCount, content) {
  const info = {
    ...buildInfo,
    pages: pageCount,
    areas: content.areas.length,
    lots: content.lots.length,
    masterplans: content.masterplans.length,
    news: content.news.length,
    warnings,
  };
  writeFile(path.join(OPTIONS.outDir, 'build-info.json'), JSON.stringify(info, null, 2));
}

/* ─────────────────────────── Tekshirishlar ─────────────────────────── */

function validateContent(content) {
  const slugs = new Map();
  const check = (collection, label) => {
    for (const item of collection) {
      const key = `${label}:${item.slug}`;
      if (slugs.has(key)) warn(`Takrorlangan slug: ${label} — "${item.slug}". Faqat birinchisi ishlatiladi.`);
      slugs.set(key, true);
    }
  };
  check(content.areas, 'hudud');
  check(content.lots, 'lot');
  check(content.masterplans, 'master-reja');
  check(content.news, 'yangilik');

  // Hududlar — umumiy ma'lumot shu yerda saqlanadi, lotlar undan meros oladi
  for (const area of content.areas) {
    if (!content.lookup.districts.has(String(area.district))) {
      warn(`"${area.slug}" hududida noma'lum tuman: "${area.district}".`);
    }
    if (!content.lookup.areaTypes.has(String(area.areaType))) {
      warn(`"${area.slug}" hududida noma'lum hudud turi: "${area.areaType}".`);
    }
    if (area.coordinates == null) {
      warn(`"${area.slug}" hududida koordinatalar yo'q — xaritada ko'rsatilmaydi. KMZ fayl yuklash tavsiya etiladi.`);
    }
    if (area.masterplanId && !content.masterplans.some((plan) => plan.id === area.masterplanId)) {
      warn(`"${area.slug}" hududida ko'rsatilgan master-reja topilmadi: "${area.masterplanId}".`);
    }
    if (area.lots.length === 0) {
      warn(`"${area.slug}" hududida birorta lot yo'q — saytda bo'sh hudud sahifasi chiqadi.`);
    }
    for (const media of area.media) checkLocalFile(media.src, `"${area.slug}" hududi media fayli`);
    for (const doc of area.documents) checkLocalFile(doc.src, `"${area.slug}" hududi hujjati`);
  }

  // Hududi ko'rsatilmagan lotlar: tuman, hudud turi va yo'nalishlar meros
  // qilinmaydi, shuning uchun saytda to'liq ko'rinmaydi
  for (const lot of content.orphanLots) {
    warn(
      `"${lot.slug}" loti qaysi hududga tegishli ekani ko'rsatilmagan (areaId bo'sh yoki noto'g'ri). `
        + 'Tuman, hudud turi va turizm yo\'nalishlari hududdan olinadi — ular bu lotda ko\'rinmaydi.',
    );
  }

  const platformUrl = String(content.site.eauction?.platformUrl || '').replace(/\/$/, '');
  for (const lot of content.lots) {
    if (!content.lookup.lotStatuses.has(String(lot.status))) {
      warn(`"${lot.slug}" lotida noma'lum holat: "${lot.status}".`);
    }
    if (lot.auction.lotUrl && platformUrl && lot.auction.lotUrl.replace(/\/$/, '') === platformUrl) {
      warn(
        `"${lot.slug}" lotining auction.lotUrl maydonida platformaning umumiy manzili turibdi. Bu maydonga faqat AYNAN shu lotning sahifasi yozilishi kerak — havola olib tashlandi.`,
      );
      lot.auction.lotUrl = null;
    }
    if (lot.status === 'auction' && !lot.auction.lotUrl) {
      warn(`"${lot.slug}" loti "Auksionda" holatida, lekin E-auksion havolasi kiritilmagan.`);
    }
    if (lot.coordinates == null) {
      warn(`"${lot.slug}" lotida koordinatalar yo'q — xaritada ko'rsatilmaydi.`);
    }
    if (lot.photos.length === 0) {
      warn(`"${lot.slug}" lotida hududning haqiqiy fotosurati yo'q.`);
    }
    for (const media of lot.media) {
      checkLocalFile(media.src, `"${lot.slug}" loti media fayli`);
    }
    for (const doc of lot.documents) {
      checkLocalFile(doc.src, `"${lot.slug}" loti hujjati`);
    }
  }

  for (const plan of content.masterplans) {
    if (!content.lookup.masterplanStatuses.has(String(plan.status))) {
      warn(`"${plan.slug}" master-rejasida noma'lum holat: "${plan.status}".`);
    }
    for (const sheet of plan.sheets) checkLocalFile(sheet.src, `"${plan.slug}" master-reja chizmasi`);
    for (const doc of plan.documents) checkLocalFile(doc.src, `"${plan.slug}" master-reja hujjati`);
  }

  if (content.site.statistics?.items?.length > 0 && content.site.statistics.verified !== true) {
    warn(
      "content/site.json -> statistics.verified = false. Statistik ko'rsatkichlar tasdiqlanmagani uchun bosh sahifada ko'rsatilmaydi.",
    );
  }
  if (!content.site.features?.contactFormEndpoint) {
    warn(
      "Murojaatlarni qabul qilish tizimi ulanmagan (features.contactFormEndpoint = null). Bog'lanish sahifasida bu holat ochiq yozilgan, shakl esa faolsiz.",
    );
  }
}

function checkLocalFile(src, label) {
  if (typeof src !== 'string' || src === '' || /^https?:\/\//i.test(src)) return;
  const local = path.join(ROOT, src.replace(/^\//, ''));
  if (!existsSync(local)) warn(`${label} topilmadi: ${src}`);
}

/* ─────────────────────────── Yordamchilar ─────────────────────────── */

function writeFile(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents, 'utf8');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

try {
  build();
} catch (error) {
  console.error('\n  Qurish jarayonida xatolik:\n');
  console.error(error);
  process.exit(1);
}
