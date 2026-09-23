/**
 * Qayta ishlatiladigan UI bloklari.
 * Har bir funksiya birinchi argument sifatida `ctx` oladi:
 *   { locale, t, url, pick, content, site }
 */
import { html, raw, esc, cx, when, attr, formatNumber, formatDate, isoDate, formatBytes, truncate, richText } from './util.mjs';
import { icon, areaTypeIcon } from './icons.mjs';

/* ─────────────────────────── Sarlavhalar va matnlar ─────────────────────────── */

export function sectionHead(ctx, { title, lead, id, level = 2, align = 'start', action } = {}) {
  const Tag = `h${Math.min(Math.max(level, 2), 4)}`;
  return html`
    <div class="${cx('section-head', align === 'center' && 'section-head--center')}">
      <div class="section-head__text">
        <${raw(Tag)}${attr('id', id)} class="section-head__title">${title}</${raw(Tag)}>
        ${when(lead, html`<p class="section-head__lead">${lead}</p>`)}
      </div>
      ${when(action, html`<div class="section-head__action">${action}</div>`)}
    </div>
  `;
}

/** Ma'lumot yo'qligini bildiruvchi katta blok. */
export function emptyState(ctx, { title, text, iconName = 'info', action } = {}) {
  const { t } = ctx;
  return html`
    <div class="empty-state" role="status">
      <span class="empty-state__icon">${icon(iconName, { size: 28 })}</span>
      <p class="empty-state__title">${title || t('empty.noData')}</p>
      ${when(text, html`<p class="empty-state__text">${text}</p>`)}
      ${when(action, html`<div class="empty-state__action">${action}</div>`)}
    </div>
  `;
}

/** Bitta maydon uchun "ma'lumot yo'q" belgisi. */
export function noData(ctx, short = false) {
  const { t } = ctx;
  return html`<span class="no-data">${short ? t('empty.noDataShort') : t('empty.noData')}</span>`;
}

/** Eslatma / ogohlantirish bloki. */
export function callout(ctx, { tone = 'info', title, text, iconName, children } = {}) {
  const icons = { info: 'info', warning: 'alert', success: 'check', neutral: 'info' };
  return html`
    <div class="${cx('callout', `callout--${tone}`)}">
      <span class="callout__icon">${icon(iconName || icons[tone] || 'info', { size: 20 })}</span>
      <div class="callout__body">
        ${when(title, html`<p class="callout__title">${title}</p>`)}
        ${when(text, html`<p class="callout__text">${text}</p>`)}
        ${when(children, children)}
      </div>
    </div>
  `;
}

/* ─────────────────────────── Belgilar (badge) ─────────────────────────── */

export function statusBadge(ctx, statusId, { size = 'md' } = {}) {
  const status = ctx.content.lookup.lotStatuses.get(String(statusId));
  if (!status) return raw('');
  return html`<span class="${cx('badge', `badge--${status.tone || 'neutral'}`, size === 'sm' && 'badge--sm')}">
    <span class="badge__dot" aria-hidden="true"></span>${ctx.pick(status.name)}
  </span>`;
}

export function masterplanStatusBadge(ctx, statusId) {
  const status = ctx.content.lookup.masterplanStatuses.get(String(statusId));
  if (!status) return raw('');
  return html`<span class="${cx('badge', `badge--${status.tone || 'neutral'}`)}">${ctx.pick(status.name)}</span>`;
}

export function demoBadge(ctx, condition = true) {
  if (!condition) return raw('');
  return html`<span class="badge badge--demo" title="${ctx.t('demo.banner.title')}">${ctx.t('demo.badge')}</span>`;
}

export function demoBanner(ctx) {
  if (!ctx.content.demo) return raw('');
  const { t } = ctx;
  return html`
    <div class="demo-banner" role="note">
      <div class="container demo-banner__inner">
        <span class="demo-banner__badge">${t('demo.badge')}</span>
        <div>
          <p class="demo-banner__title">${t('demo.banner.title')}</p>
          <p class="demo-banner__text">${t('demo.banner.text')}</p>
        </div>
      </div>
    </div>
  `;
}

/** Taksonomiya identifikatorlari ro'yxatini "chip" ko'rinishida chiqaradi. */
export function chips(ctx, ids, lookupMap, { iconName } = {}) {
  const items = (ids || [])
    .map((id) => lookupMap.get(String(id)))
    .filter(Boolean)
    .map((item) => ctx.pick(item.name));
  if (items.length === 0) return raw('');
  return html`<ul class="chips">
    ${items.map((label) => html`<li class="chip">${when(iconName, icon(iconName, { size: 14 }))}${label}</li>`)}
  </ul>`;
}

/* ─────────────────────────── Ta'rif ro'yxati ─────────────────────────── */

/**
 * Nomi/qiymati ko'rinishidagi jadval.
 * rows: [{ label, value, hint, wide }] — value bo'sh bo'lsa "ma'lumot yo'q" chiqadi
 * (showEmpty=false bo'lsa qatorning o'zi chiqmaydi).
 */
export function defList(ctx, rows, { showEmpty = true, columns = 2 } = {}) {
  const visible = rows.filter((row) => row && (showEmpty || !isBlank(row.value)));
  if (visible.length === 0) return raw('');
  return html`
    <dl class="${cx('def-list', columns === 1 && 'def-list--single')}">
      ${visible.map(
        (row) => html`
          <div class="${cx('def-list__row', row.wide && 'def-list__row--wide')}">
            <dt class="def-list__label">
              ${row.label}
              ${when(row.hint, html`<span class="def-list__hint" title="${row.hint}">${icon('info', { size: 14, label: row.hint })}</span>`)}
            </dt>
            <dd class="def-list__value">${isBlank(row.value) ? noData(ctx, true) : row.value}</dd>
          </div>
        `,
      )}
    </dl>
  `;
}

function isBlank(value) {
  if (value == null || value === false) return true;
  const str = String(value).trim();
  return str === '';
}

/* ─────────────────────────── Media ─────────────────────────── */

/**
 * Bitta tasvir. kind='render' bo'lsa avtomatik "Loyiha konsepsiyasi" deb belgilanadi.
 */
export function mediaFigure(ctx, item, { className = '', lazy = true, sizes } = {}) {
  const { t } = ctx;
  if (!item || !item.src) return mediaPlaceholder(ctx, { className });
  const kindLabel = { photo: t('media.photo'), render: t('media.render'), scheme: t('media.scheme') }[item.kind || 'photo'];
  const caption = ctx.pick(item.caption);
  const alt = ctx.pick(item.alt) || caption || kindLabel;
  const meta = [item.author ? `${t('media.author')}: ${item.author}` : '', item.date ? `${t('media.date')}: ${formatDate(item.date, ctx.locale)}` : '']
    .filter(Boolean)
    .join(' · ');

  return html`
    <figure class="${cx('media', `media--${item.kind || 'photo'}`, className)}">
      <div class="media__frame">
        <img
          src="${item.src}"
          alt="${alt}"
          ${attr('width', item.width)}
          ${attr('height', item.height)}
          ${attr('sizes', sizes)}
          loading="${lazy ? 'lazy' : 'eager'}"
          decoding="async"
        >
        <span class="${cx('media__kind', item.kind === 'render' && 'media__kind--render')}">${kindLabel}</span>
      </div>
      ${when(
        caption || meta,
        html`<figcaption class="media__caption">
          ${when(caption, html`<span class="media__caption-text">${caption}</span>`)}
          ${when(meta, html`<span class="media__meta">${meta}</span>`)}
        </figcaption>`,
      )}
    </figure>
  `;
}

/** Tasvir mavjud bo'lmaganda ko'rsatiladigan ochiq holat. */
export function mediaPlaceholder(ctx, { className = '', text, iconName = 'mountain' } = {}) {
  const { t } = ctx;
  return html`
    <div class="${cx('media', 'media--placeholder', className)}" role="img" aria-label="${text || t('media.empty')}">
      <div class="media__frame media__frame--empty">
        <span class="media__empty-icon">${icon(iconName, { size: 32 })}</span>
        <p class="media__empty-text">${text || t('media.empty')}</p>
      </div>
    </div>
  `;
}

/** Galereya — lightbox JS moduli bilan bog'lanadi. */
export function gallery(ctx, items, { id, title } = {}) {
  const list = (items || []).filter((i) => i && i.src);
  if (list.length === 0) return raw('');
  return html`
    <div class="gallery" data-gallery${attr('id', id)}>
      ${when(title, html`<p class="gallery__title">${title}</p>`)}
      <ul class="gallery__grid">
        ${list.map(
          (item, index) => html`
            <li class="gallery__item">
              <button
                type="button"
                class="gallery__button"
                data-gallery-open="${index}"
                data-src="${item.src}"
                data-kind="${item.kind || 'photo'}"
                data-caption="${ctx.pick(item.caption)}"
                aria-label="${ctx.pick(item.alt) || ctx.pick(item.caption) || ctx.t('common.open')}"
              >
                ${mediaFigure(ctx, item, { className: 'media--thumb' })}
              </button>
            </li>
          `,
        )}
      </ul>
    </div>
  `;
}

/* ─────────────────────────── Lot kartochkasi ─────────────────────────── */

export function lotCard(ctx, lot, { compare = true, level = 3 } = {}) {
  const { t } = ctx;
  const Tag = `h${level}`;
  const district = ctx.content.lookup.districts.get(String(lot.district));
  const areaType = ctx.content.lookup.areaTypes.get(String(lot.areaType));
  const cover = lot.photos[0] || lot.renders[0] || lot.schemes[0] || null;
  const href = ctx.url('areas', lot.slug);
  const name = ctx.pick(lot.name) || lot.id;

  return html`
    <article class="lot-card" data-lot-id="${lot.id}">
      <a class="lot-card__media-link" href="${href}" tabindex="-1" aria-hidden="true">
        ${cover ? mediaFigure(ctx, cover, { className: 'media--cover' }) : mediaPlaceholder(ctx, { iconName: areaTypeIcon(lot.areaType) })}
      </a>
      <div class="lot-card__body">
        <div class="lot-card__top">
          ${statusBadge(ctx, lot.status, { size: 'sm' })}
          ${demoBadge(ctx, lot.demo)}
        </div>
        <${raw(Tag)} class="lot-card__title">
          <a href="${href}">${name}</a>
        </${raw(Tag)}>
        <ul class="lot-card__facts">
          ${when(district, html`<li>${icon('pin', { size: 15 })}${ctx.pick(district?.name)}</li>`)}
          ${when(areaType, html`<li>${icon(areaTypeIcon(lot.areaType), { size: 15 })}${ctx.pick(areaType?.name)}</li>`)}
          ${when(
            lot.areaHa != null,
            html`<li>${icon('layers', { size: 15 })}${formatNumber(lot.areaHa, ctx.locale)} ${t('unit.ha')}</li>`,
          )}
          ${when(lot.lotNumber, html`<li>${icon('tag', { size: 15 })}${t('lot.number')}: ${lot.lotNumber}</li>`)}
        </ul>
        ${when(
          ctx.pick(lot.shortDescription),
          html`<p class="lot-card__text">${truncate(ctx.pick(lot.shortDescription), 160)}</p>`,
        )}
        <div class="lot-card__actions">
          <a class="btn btn--primary btn--sm" href="${href}">
            ${t('common.details')}${icon('arrowRight', { size: 16 })}
          </a>
          ${when(
            compare,
            html`<button
              type="button"
              class="btn btn--ghost btn--sm js-compare-toggle"
              data-lot-id="${lot.id}"
              data-lot-name="${name}"
              data-lot-url="${href}"
              aria-pressed="false"
            >
              ${icon('scale', { size: 16 })}<span class="js-compare-label">${t('compare.add')}</span>
            </button>`,
          )}
        </div>
      </div>
    </article>
  `;
}

/* ─────────────────────────── Lotning tayyorlik bosqichi ─────────────────────────── */

const STATUS_TO_STAGE = {
  study: 1,
  masterplan: 3,
  'auction-prep': 4,
  auction: 5,
  'auction-closed': 5,
};

/** Lot uchun 5 bosqichli jarayon ko'rsatkichi. */
export function lotPipeline(ctx, lot) {
  const { t } = ctx;
  const stages = ctx.content.taxonomies.workflowStages || [];
  if (stages.length === 0) return raw('');
  const current = STATUS_TO_STAGE[lot.status] ?? 1;
  const closed = lot.status === 'auction-closed';

  return html`
    <ol class="pipeline" aria-label="${t('lot.pipeline')}">
      ${stages.map((stage) => {
        const state = stage.number < current || (closed && stage.number <= current)
          ? 'done'
          : stage.number === current
            ? 'current'
            : 'pending';
        const stateLabel = { done: t('lot.pipelineDone'), current: t('lot.pipelineCurrent'), pending: t('lot.pipelinePending') }[state];
        return html`
          <li class="${cx('pipeline__step', `pipeline__step--${state}`)}"${attr('aria-current', state === 'current' ? 'step' : null)}>
            <span class="pipeline__marker" aria-hidden="true">${state === 'done' ? icon('check', { size: 14 }) : stage.number}</span>
            <span class="pipeline__label">
              <span class="pipeline__name">${ctx.pick(stage.name)}</span>
              <span class="pipeline__state">${stateLabel}</span>
            </span>
          </li>
        `;
      })}
    </ol>
  `;
}

/** Bosh sahifadagi to'liq ish jarayoni bloki. */
export function workflowStages(ctx) {
  const stages = ctx.content.taxonomies.workflowStages || [];
  if (stages.length === 0) return raw('');
  const icons = ['compass', 'target', 'layers', 'file', 'gavel'];
  return html`
    <ol class="workflow" aria-label="${ctx.t('home.workflowAria')}">
      ${stages.map(
        (stage, index) => html`
          <li class="workflow__item">
            <span class="workflow__number" aria-hidden="true">${stage.number}</span>
            <span class="workflow__icon" aria-hidden="true">${icon(icons[index] || 'info', { size: 22 })}</span>
            <h3 class="workflow__title">${ctx.pick(stage.name)}</h3>
            <p class="workflow__text">${ctx.pick(stage.description)}</p>
          </li>
        `,
      )}
    </ol>
  `;
}

/* ─────────────────────────── Hujjatlar ─────────────────────────── */

export function documentList(ctx, documents, { emptyText } = {}) {
  const { t } = ctx;
  const list = (documents || []).filter((d) => d && d.src);
  if (list.length === 0) {
    return html`<p class="muted">${emptyText || t('lot.documentsEmpty')}</p>`;
  }
  return html`
    <ul class="doc-list">
      ${list.map((doc) => {
        const title = ctx.pick(doc.title) || doc.src.split('/').pop();
        const meta = [doc.format || guessFormat(doc.src), formatBytes(doc.sizeBytes)].filter(Boolean).join(' · ');
        return html`
          <li class="doc-list__item">
            <a class="doc-list__link" href="${doc.src}" download>
              <span class="doc-list__icon">${icon('file', { size: 20 })}</span>
              <span class="doc-list__text">
                <span class="doc-list__title">${title}</span>
                ${when(meta, html`<span class="doc-list__meta">${meta}</span>`)}
              </span>
              <span class="doc-list__action">${icon('download', { size: 18, label: t('common.download') })}</span>
            </a>
          </li>
        `;
      })}
    </ul>
  `;
}

function guessFormat(src) {
  const match = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(String(src));
  return match ? match[1].toUpperCase() : '';
}

/* ─────────────────────────── Ro'yxatlar ─────────────────────────── */

/** Ko'p tilli qiymatlar massivini belgilangan ro'yxat sifatida chiqaradi. */
export function bulletList(ctx, items, { iconName = 'check', className = '' } = {}) {
  const values = (items || []).map((item) => (typeof item === 'object' && item !== null && !Array.isArray(item) ? ctx.pick(item.text ?? item.name ?? item) : ctx.pick(item))).filter(Boolean);
  if (values.length === 0) return raw('');
  return html`
    <ul class="${cx('bullet-list', className)}">
      ${values.map((value) => html`<li>${icon(iconName, { size: 16 })}<span>${value}</span></li>`)}
    </ul>
  `;
}

/* ─────────────────────────── Navigatsiya zanjiri ─────────────────────────── */

export function breadcrumbs(ctx, trail) {
  const items = (trail || []).filter(Boolean);
  if (items.length === 0) return raw('');
  return html`
    <nav class="breadcrumbs" aria-label="${ctx.t('site.breadcrumb')}">
      <div class="container">
        <ol class="breadcrumbs__list">
          ${items.map((item, index) => {
            const isLast = index === items.length - 1;
            return html`<li class="breadcrumbs__item">
              ${isLast || !item.href
                ? html`<span aria-current="page">${item.label}</span>`
                : html`<a href="${item.href}">${item.label}</a>`}
              ${when(!isLast, html`<span class="breadcrumbs__sep" aria-hidden="true">${icon('chevronRight', { size: 14 })}</span>`)}
            </li>`;
          })}
        </ol>
      </div>
    </nav>
  `;
}

/* ─────────────────────────── Ulashish ─────────────────────────── */

export function shareRow(ctx, { title, printable = false } = {}) {
  const { t } = ctx;
  return html`
    <div class="share-row">
      <button type="button" class="btn btn--ghost btn--sm js-copy-link" data-copied-label="${t('common.copied')}">
        ${icon('copy', { size: 16 })}<span>${t('common.copyLink')}</span>
      </button>
      <button type="button" class="btn btn--ghost btn--sm js-share" data-share-title="${title || ''}" hidden>
        ${icon('share', { size: 16 })}<span>${t('common.share')}</span>
      </button>
      ${when(
        printable,
        html`<button type="button" class="btn btn--ghost btn--sm js-print">
          ${icon('print', { size: 16 })}<span>${t('common.print')}</span>
        </button>`,
      )}
    </div>
  `;
}

/* ─────────────────────────── Yangilik kartochkasi ─────────────────────────── */

export function newsCard(ctx, item, { level = 3 } = {}) {
  const Tag = `h${level}`;
  const category = ctx.content.newsCategories.find((c) => c.id === item.category);
  const href = ctx.url('news', item.slug);
  return html`
    <article class="news-card">
      <a class="news-card__media-link" href="${href}" tabindex="-1" aria-hidden="true">
        ${item.cover ? mediaFigure(ctx, item.cover, { className: 'media--cover' }) : mediaPlaceholder(ctx, { iconName: 'calendar', text: ctx.t('media.empty') })}
      </a>
      <div class="news-card__body">
        <div class="news-card__meta">
          ${when(category, html`<span class="chip chip--soft">${ctx.pick(category?.name)}</span>`)}
          ${when(item.date, html`<time datetime="${isoDate(item.date)}">${formatDate(item.date, ctx.locale)}</time>`)}
          ${demoBadge(ctx, item.demo)}
        </div>
        <${raw(Tag)} class="news-card__title"><a href="${href}">${ctx.pick(item.title)}</a></${raw(Tag)}>
        ${when(ctx.pick(item.lead), html`<p class="news-card__text">${truncate(ctx.pick(item.lead), 170)}</p>`)}
        <a class="link-arrow" href="${href}">${ctx.t('common.readMore')}${icon('arrowRight', { size: 15 })}</a>
      </div>
    </article>
  `;
}

/* ─────────────────────────── Matnli blok ─────────────────────────── */

export function prose(ctx, value, { className = '' } = {}) {
  const text = ctx.pick(value);
  if (!text) return raw('');
  return html`<div class="${cx('prose', className)}">${richText(text)}</div>`;
}
