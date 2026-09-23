/**
 * Sahifa qobig'i: <head>, sarlavha (header), menyu, futer va umumiy skriptlar.
 */
import { html, raw, esc, cx, when, attr, formatDate } from './util.mjs';
import { icon, iconSprite } from './icons.mjs';
import { MAIN_NAV, SECTION_NAV_KEY, urlFor } from './i18n.mjs';
import { demoBanner } from './ui.mjs';

/* ─────────────────────────── Logotip ─────────────────────────── */

function logoMark(ctx) {
  const { branding } = ctx;
  if (branding.logoSrc) {
    return html`<img class="logo__mark" src="${branding.logoSrc}" alt="" width="52" height="52" decoding="async">`;
  }
  // Rasmiy logotip fayli hali joylashtirilmagan — vaqtinchalik neytral belgi.
  return html`<span class="logo__mark logo__mark--fallback" aria-hidden="true">${icon('mountain', { size: 26 })}</span>`;
}

function logo(ctx, { compact = false } = {}) {
  const name = ctx.pick(ctx.site.institution?.shortName) || ctx.pick(ctx.site.institution?.name);
  const full = ctx.pick(ctx.site.institution?.name);
  return html`
    <a class="${cx('logo', compact && 'logo--compact')}" href="${ctx.url('home')}" aria-label="${full}">
      ${logoMark(ctx)}
      <span class="logo__text">
        <span class="logo__title">${name}</span>
        <span class="logo__sub">${ctx.t('site.official')}</span>
      </span>
    </a>
  `;
}

/* ─────────────────────────── Til almashtirgich ─────────────────────────── */

function languageSwitcher(ctx, { alternates }) {
  const { t } = ctx;
  const current = ctx.dictionaries[ctx.locale]?._meta;
  return html`
    <div class="lang" data-lang-switcher>
      <button
        type="button"
        class="lang__button"
        aria-expanded="false"
        aria-controls="lang-menu"
        aria-label="${t('site.langSwitch')}"
      >
        ${icon('globe', { size: 18 })}
        <span class="lang__current">${current?.shortLabel || ctx.locale}</span>
        ${icon('chevronDown', { size: 14 })}
      </button>
      <ul class="lang__menu" id="lang-menu" role="list" hidden>
        ${ctx.codes.map((code) => {
          const meta = ctx.dictionaries[code]?._meta || {};
          const target = alternates.find((a) => a.locale === code);
          const isCurrent = code === ctx.locale;
          return html`
            <li>
              <a
                class="${cx('lang__item', isCurrent && 'lang__item--active')}"
                href="${target ? target.url : urlFor(code, 'home')}"
                lang="${meta.htmlLang || code}"
                hreflang="${meta.htmlLang || code}"
                ${attr('aria-current', isCurrent ? 'true' : null)}
              >
                <span class="lang__code">${meta.shortLabel || code}</span>
                <span class="lang__name">${meta.nativeName || code}</span>
                ${when(isCurrent, icon('check', { size: 15 }))}
              </a>
            </li>
          `;
        })}
      </ul>
    </div>
  `;
}

/* ─────────────────────────── Sarlavha ─────────────────────────── */

function header(ctx, { section, alternates }) {
  const { t } = ctx;
  return html`
    <header class="site-header" data-header>
      <div class="site-header__bar">
        <div class="container site-header__inner">
          ${logo(ctx)}
          <div class="site-header__tools">
            <button type="button" class="icon-btn js-search-open" aria-label="${t('search.open')}" title="${t('search.open')}">
              ${icon('search', { size: 19 })}
            </button>
            <button
              type="button"
              class="icon-btn js-theme-toggle"
              aria-label="${t('site.themeLabel')}"
              title="${t('site.themeLabel')}"
              data-label-light="${t('site.theme.light')}"
              data-label-dark="${t('site.theme.dark')}"
              data-label-auto="${t('site.theme.auto')}"
            >
              <span class="js-theme-icon">${icon('sun', { size: 19 })}</span>
            </button>
            ${languageSwitcher(ctx, { alternates })}
            <button
              type="button"
              class="icon-btn icon-btn--menu js-menu-toggle"
              aria-label="${t('site.openMenu')}"
              aria-expanded="false"
              aria-controls="mobile-nav"
            >
              ${icon('menu', { size: 22 })}
            </button>
          </div>
        </div>
      </div>
      <nav class="main-nav" id="main-nav" aria-label="${t('site.menu')}">
        <div class="container">
          <ul class="main-nav__list">
            ${MAIN_NAV.map((item) => {
              const isActive = item === section;
              return html`
                <li class="main-nav__item">
                  <a
                    class="${cx('main-nav__link', isActive && 'main-nav__link--active')}"
                    href="${ctx.url(item)}"
                    ${attr('aria-current', isActive ? 'page' : null)}
                  >${t(SECTION_NAV_KEY[item])}</a>
                </li>
              `;
            })}
          </ul>
        </div>
      </nav>
      <div class="mobile-nav" id="mobile-nav" hidden>
        <div class="container">
          <ul class="mobile-nav__list">
            ${[...MAIN_NAV, 'accessibility'].map((item) => {
              const isActive = item === section;
              return html`<li>
                <a
                  class="${cx('mobile-nav__link', isActive && 'mobile-nav__link--active')}"
                  href="${ctx.url(item)}"
                  ${attr('aria-current', isActive ? 'page' : null)}
                >${t(SECTION_NAV_KEY[item])}${icon('chevronRight', { size: 16 })}</a>
              </li>`;
            })}
          </ul>
        </div>
      </div>
    </header>
  `;
}

/* ─────────────────────────── Futer ─────────────────────────── */

function footer(ctx) {
  const { t, site } = ctx;
  const contacts = site.contacts || {};
  const phones = Array.isArray(contacts.phones) ? contacts.phones : [];
  const emails = Array.isArray(contacts.emails) ? contacts.emails : [];
  const social = Array.isArray(contacts.social) ? contacts.social : [];
  const address = ctx.pick(contacts.address);
  const legal = Array.isArray(site.institution?.legalBasis) ? site.institution.legalBasis : [];
  const eauctionUrl = site.eauction?.platformUrl;

  return html`
    <footer class="site-footer">
      <div class="container site-footer__grid">
        <div class="site-footer__col site-footer__col--wide">
          <h2 class="site-footer__title">${t('footer.aboutTitle')}</h2>
          <p class="site-footer__name">${ctx.pick(site.institution?.name)}</p>
          ${when(ctx.pick(site.slogan), html`<p class="site-footer__slogan">${ctx.pick(site.slogan)}</p>`)}
          ${when(
            legal.length > 0,
            html`<p class="site-footer__legal">
              ${t('site.legalBasis')}:
              ${legal.map(
                (item) => html`<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.code}${icon('external', { size: 13 })}</a>`,
              )}
            </p>`,
          )}
        </div>

        <div class="site-footer__col">
          <h2 class="site-footer__title">${t('footer.sectionsTitle')}</h2>
          <ul class="site-footer__list">
            ${[...MAIN_NAV, 'accessibility'].map(
              (item) => html`<li><a href="${ctx.url(item)}">${t(SECTION_NAV_KEY[item])}</a></li>`,
            )}
          </ul>
        </div>

        <div class="site-footer__col">
          <h2 class="site-footer__title">${t('footer.contactTitle')}</h2>
          <ul class="site-footer__list site-footer__list--contact">
            ${when(address, html`<li>${icon('pin', { size: 16 })}<span>${address}</span></li>`)}
            ${phones.map(
              (phone) => html`<li>${icon('phone', { size: 16 })}<a href="tel:${String(phone).replace(/[^\d+]/g, '')}">${phone}</a></li>`,
            )}
            ${emails.map((email) => html`<li>${icon('mail', { size: 16 })}<a href="mailto:${email}">${email}</a></li>`)}
            ${when(
              !address && phones.length === 0 && emails.length === 0,
              html`<li class="muted">${t('empty.noData')}</li>`,
            )}
          </ul>
          ${when(
            social.length > 0,
            html`<ul class="site-footer__social" aria-label="${t('contact.social')}">
              ${social.map(
                (link) => html`<li><a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.name || link.platform}${icon('external', { size: 13 })}</a></li>`,
              )}
            </ul>`,
          )}
        </div>

        <div class="site-footer__col">
          <h2 class="site-footer__title">${t('footer.legalTitle')}</h2>
          <p class="site-footer__note">${t('footer.disclaimer')}</p>
          ${when(
            eauctionUrl,
            html`<a class="btn btn--outline btn--sm" href="${eauctionUrl}" target="_blank" rel="noopener noreferrer">
              ${t('footer.eauction')}${icon('external', { size: 15 })}
            </a>`,
          )}
        </div>
      </div>
      <div class="site-footer__bottom">
        <div class="container site-footer__bottom-inner">
          <p>${t('footer.copyright', { year: ctx.buildInfo.year, name: ctx.pick(site.institution?.shortName) })}</p>
          <p class="site-footer__build">
            ${t('footer.lastBuild')}:
            <time datetime="${ctx.buildInfo.isoDate}">${formatDate(ctx.buildInfo.isoDate, ctx.locale)}</time>
          </p>
        </div>
      </div>
      <a class="to-top js-to-top" href="#top" aria-label="${t('site.backToTop')}" title="${t('site.backToTop')}">
        ${icon('arrowRight', { size: 18, className: 'icon--up' })}
      </a>
    </footer>
  `;
}

/* ─────────────────────────── Qidirish oynasi ─────────────────────────── */

function searchDialog(ctx) {
  const { t } = ctx;
  return html`
    <div class="search-overlay" data-search-overlay hidden>
      <div class="search-overlay__backdrop" data-search-close></div>
      <div class="search-panel" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <h2 class="sr-only" id="search-title">${t('search.title')}</h2>
        <div class="search-panel__field">
          ${icon('search', { size: 20 })}
          <input
            type="search"
            class="search-panel__input"
            placeholder="${t('search.placeholder')}"
            aria-label="${t('search.title')}"
            autocomplete="off"
            spellcheck="false"
            data-search-input
          >
          <button type="button" class="icon-btn" data-search-close aria-label="${t('common.close')}">
            ${icon('close', { size: 18 })}
          </button>
        </div>
        <div class="search-panel__results" data-search-results aria-live="polite"></div>
        <p class="search-panel__hint">${t('search.hint')}</p>
      </div>
    </div>
  `;
}

/* ─────────────────────────── Taqqoslash paneli ─────────────────────────── */

function compareDrawer(ctx) {
  const { t } = ctx;
  return html`
    <div class="compare-bar" data-compare-bar hidden>
      <div class="container compare-bar__inner">
        <p class="compare-bar__title">
          ${icon('scale', { size: 18 })}
          <span>${t('compare.title')}</span>
          <span class="compare-bar__count" data-compare-count>0</span>
        </p>
        <ul class="compare-bar__list" data-compare-list></ul>
        <div class="compare-bar__actions">
          <button type="button" class="btn btn--primary btn--sm" data-compare-open>${t('compare.open')}</button>
          <button type="button" class="btn btn--ghost btn--sm" data-compare-clear>${t('compare.clear')}</button>
        </div>
      </div>
    </div>
    <div class="compare-modal" data-compare-modal hidden>
      <div class="compare-modal__backdrop" data-compare-close></div>
      <div class="compare-modal__panel" role="dialog" aria-modal="true" aria-labelledby="compare-title">
        <div class="compare-modal__head">
          <h2 id="compare-title">${t('compare.title')}</h2>
          <div class="compare-modal__head-actions">
            <button type="button" class="btn btn--ghost btn--sm js-print">${icon('print', { size: 16 })}<span>${t('common.print')}</span></button>
            <button type="button" class="icon-btn" data-compare-close aria-label="${t('common.close')}">${icon('close', { size: 18 })}</button>
          </div>
        </div>
        <div class="compare-modal__body" data-compare-table></div>
        <p class="compare-modal__hint">${t('compare.hint')}</p>
      </div>
    </div>
  `;
}

/* ─────────────────────────── Galereya (lightbox) ─────────────────────────── */

function lightbox(ctx) {
  const { t } = ctx;
  return html`
    <div class="lightbox" data-lightbox hidden>
      <div class="lightbox__backdrop" data-lightbox-close></div>
      <figure class="lightbox__figure" role="dialog" aria-modal="true" aria-label="${t('media.gallery.counter', { i: 1, n: 1 })}">
        <img class="lightbox__image" alt="" data-lightbox-image>
        <figcaption class="lightbox__caption">
          <span data-lightbox-kind class="lightbox__kind"></span>
          <span data-lightbox-caption></span>
          <span data-lightbox-counter class="lightbox__counter"></span>
        </figcaption>
      </figure>
      <button type="button" class="lightbox__nav lightbox__nav--prev" data-lightbox-prev aria-label="${t('media.gallery.prev')}">
        ${icon('arrowLeft', { size: 24 })}
      </button>
      <button type="button" class="lightbox__nav lightbox__nav--next" data-lightbox-next aria-label="${t('media.gallery.next')}">
        ${icon('arrowRight', { size: 24 })}
      </button>
      <button type="button" class="lightbox__close" data-lightbox-close aria-label="${t('media.gallery.close')}">
        ${icon('close', { size: 22 })}
      </button>
    </div>
  `;
}

/* ─────────────────────────── Asosiy qobiq ─────────────────────────── */

/**
 * To'liq HTML sahifani yasaydi.
 * @param {object} ctx
 * @param {object} page
 *   { title, description, section, slug, body, bodyClass, alternates, breadcrumbs,
 *     jsonLd, scripts, ogImage, noindex }
 */
export function renderPage(ctx, page) {
  const { t } = ctx;
  const meta = ctx.dictionaries[ctx.locale]?._meta || {};
  const siteName = ctx.pick(ctx.site.institution?.shortName) || ctx.pick(ctx.site.institution?.name);
  const fullTitle = page.title ? `${page.title} — ${siteName}` : siteName;
  const origin = String(ctx.site.seo?.canonicalOrigin || '').replace(/\/$/, '');
  const canonicalPath = page.path || ctx.url(page.section || 'home', page.slug);
  const canonical = origin ? `${origin}${canonicalPath}` : canonicalPath;
  const alternates = page.alternates || [];
  const description = page.description || ctx.pick(ctx.site.mission);
  const scripts = page.scripts || [];

  return `<!doctype html>
<html lang="${esc(meta.htmlLang || ctx.locale)}" dir="${esc(meta.dir || 'ltr')}" data-locale="${esc(ctx.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="generator" content="direksiya-static-builder">
${page.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow">'}
<link rel="canonical" href="${esc(canonical)}">
${alternates
  .map((alt) => {
    const altMeta = ctx.dictionaries[alt.locale]?._meta || {};
    const href = origin ? `${origin}${alt.url}` : alt.url;
    return `<link rel="alternate" hreflang="${esc(altMeta.htmlLang || alt.locale)}" href="${esc(href)}">`;
  })
  .join('\n')}
${alternates.length ? `<link rel="alternate" hreflang="x-default" href="${esc(origin ? `${origin}${urlFor(ctx.defaultLocale, page.section || 'home', page.slug)}` : urlFor(ctx.defaultLocale, page.section || 'home', page.slug))}">` : ''}
<meta property="og:type" content="${page.section === 'news' && page.slug ? 'article' : 'website'}">
<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:title" content="${esc(page.title || siteName)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${esc(ogLocale(meta.htmlLang || ctx.locale))}">
${page.ogImage ? `<meta property="og:image" content="${esc(origin ? origin + page.ogImage : page.ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0b2e4f" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#061a2e" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="mask-icon" href="/assets/img/favicon.svg" color="#0b2e4f">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/css/main.css" as="style">
<link rel="stylesheet" href="/assets/css/main.css">
<script>
/* Mavzuni sahifa chizilishidan oldin qo'llash (yonib-o'chishning oldini oladi) */
(function(){try{var m=localStorage.getItem('direksiya.theme')||'auto';var d=m==='dark'||(m==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=m;document.documentElement.classList.toggle('is-dark',d);}catch(e){}})();
</script>
${page.head || ''}
</head>
<body class="${esc(cx('page', page.bodyClass, ctx.content.demo && 'page--demo'))}" id="top">
<a class="skip-link" href="#main">${esc(t('site.skipToContent'))}</a>
${iconSprite()}
${demoBanner(ctx)}
${header(ctx, { section: page.section, alternates })}
${page.breadcrumbs ? page.breadcrumbs : ''}
<main class="site-main" id="main">
${page.body}
</main>
${footer(ctx)}
${searchDialog(ctx)}
${compareDrawer(ctx)}
${lightbox(ctx)}
<script type="application/json" id="app-config">${JSON.stringify({
    locale: ctx.locale,
    defaultLocale: ctx.defaultLocale,
    searchIndex: `/data/search-${ctx.locale}.json`,
    catalogData: `/data/lots-${ctx.locale}.json`,
    mapTileUrl: ctx.site.features?.mapTileUrl || '',
    mapAttribution: ctx.site.features?.mapTileAttribution || '',
    contactEndpoint: ctx.site.features?.contactFormEndpoint || null,
    compareLimit: 4,
    strings: pickClientStrings(ctx),
  }).replace(/</g, '\\u003c')}</script>
<script src="/assets/js/app.js" type="module"></script>
${scripts.map((src) => `<script src="${esc(src)}" type="module"></script>`).join('\n')}
${(ctx.site.features?.analyticsSnippet || '').trim()}
${(page.jsonLd || [])
  .map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`)
  .join('\n')}
</body>
</html>
`;
}

/** BCP-47 kodini Open Graph formatiga keltiradi: uz-Cyrl-UZ -> uz_UZ, en -> en_US. */
function ogLocale(tag) {
  const parts = String(tag).split('-');
  const language = parts[0].toLowerCase();
  const region = parts.find((part) => /^[A-Za-z]{2}$/.test(part) && part === part.toUpperCase());
  const defaults = { en: 'US', ru: 'RU', uz: 'UZ' };
  return `${language}_${region || defaults[language] || language.toUpperCase()}`;
}

/** Brauzer tomonida kerak bo'ladigan matnlar. */
function pickClientStrings(ctx) {
  const keys = [
    'common.close', 'common.copied', 'common.copyLink', 'common.loading', 'common.error',
    'common.details', 'common.retry', 'common.download', 'common.share', 'common.print',
    'search.noResults', 'search.noResultsHint', 'search.resultsCount', 'search.emptyIndex',
    'search.group.lots', 'search.group.masterplans', 'search.group.news', 'search.group.pages',
    'empty.noData', 'empty.noDataShort',
    'catalog.results', 'catalog.resultsNone', 'catalog.resultsNoneHint', 'catalog.filters.active',
    'catalog.onMapCount', 'catalog.noCoordinatesCount', 'catalog.shareFilters',
    'compare.add', 'compare.added', 'compare.remove', 'compare.clear', 'compare.count',
    'compare.empty', 'compare.limit', 'compare.field', 'compare.title',
    'lot.number', 'lot.district', 'lot.areaType', 'lot.area', 'lot.status', 'lot.coordinates',
    'lot.auction.startPrice', 'lot.auction.rightType', 'lot.auction.date',
    'map.loading', 'map.error', 'map.errorHint', 'map.zoomIn', 'map.zoomOut', 'map.reset',
    'map.noCoordinates', 'map.keyboardHint', 'map.pointsList',
    'media.photo', 'media.render', 'media.scheme', 'media.gallery.counter',
    'masterplan.viewer.zoomIn', 'masterplan.viewer.zoomOut', 'masterplan.viewer.reset',
    'contact.form.sending', 'contact.form.submit', 'contact.form.success', 'contact.form.successHint',
    'contact.form.error', 'contact.form.errorHint', 'contact.form.disabledTitle', 'contact.form.disabledText',
    'contact.form.validation.required', 'contact.form.validation.contact', 'contact.form.validation.email',
    'contact.form.validation.phone', 'contact.form.validation.consent', 'contact.form.validation.summary',
    'site.openMenu', 'site.closeMenu', 'site.theme.light', 'site.theme.dark', 'site.theme.auto',
    'offline.title', 'offline.text',
    'unit.ha', 'unit.sotix', 'unit.uzs',
  ];
  const out = {};
  for (const key of keys) out[key] = ctx.t(key);
  return out;
}
