/** Master-rejalar ro'yxati va bitta master-reja sahifasi. */
import { html, raw, when, formatNumber, formatDate } from '../lib/util.mjs';
import { icon, areaTypeIcon } from '../lib/icons.mjs';
import {
  sectionHead, emptyState, masterplanStatusBadge, demoBadge, callout, defList,
  documentList, prose, mediaFigure, mediaPlaceholder, breadcrumbs, shareRow,
} from '../lib/ui.mjs';
import { findLotsForMasterplan } from '../lib/content.mjs';

/* ─────────────────────────── Ro'yxat ─────────────────────────── */

export function masterplansPage(ctx) {
  const { t, content, pages } = ctx;
  const page = pages.masterplans || {};
  const plans = content.masterplans;

  // Hududlar (tumanlar) kesimida guruhlash
  const groups = new Map();
  for (const plan of plans) {
    const key = plan.district || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(plan);
  }

  const body = html`
    <section class="page-head page-head--compact">
      <div class="container">
        <h1 class="page-head__title">${ctx.pick(page.title)}</h1>
        <p class="page-head__lead">${ctx.pick(page.lead)}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        ${plans.length === 0
          ? emptyState(ctx, {
              title: t('masterplan.empty.title'),
              text: t('masterplan.empty.text'),
              iconName: 'layers',
            })
          : html`
              ${statusLegend(ctx)}
              ${[...groups.entries()].map(([districtId, items]) => {
                const district = content.lookup.districts.get(String(districtId));
                return html`
                  <div class="mp-group">
                    <h2 class="mp-group__title">
                      ${icon('pin', { size: 18 })}${ctx.pick(district?.name) || t('empty.notSpecified')}
                      <span class="mp-group__count">${items.length}</span>
                    </h2>
                    <div class="card-grid card-grid--2">
                      ${items.map((plan) => masterplanCard(ctx, plan))}
                    </div>
                  </div>
                `;
              })}
            `}
      </div>
    </section>
  `;

  return {
    section: 'masterplans',
    title: ctx.pick(page.title),
    description: ctx.pick(page.lead),
    body,
  };
}

function statusLegend(ctx) {
  const statuses = ctx.content.taxonomies.masterplanStatuses || [];
  if (statuses.length === 0) return raw('');
  return html`
    <ul class="legend" aria-label="${ctx.t('masterplan.status')}">
      ${statuses.map(
        (status) => html`<li class="legend__item">
          ${masterplanStatusBadge(ctx, status.id)}
          <span class="legend__text">${ctx.pick(status.disclaimer)}</span>
        </li>`,
      )}
    </ul>
  `;
}

function masterplanCard(ctx, plan) {
  const { t } = ctx;
  const href = ctx.url('masterplans', plan.slug);
  const cover = plan.sheets[0] || null;
  return html`
    <article class="mp-card">
      <a class="mp-card__media" href="${href}" tabindex="-1" aria-hidden="true">
        ${cover
          ? mediaFigure(ctx, cover, { className: 'media--cover' })
          : mediaPlaceholder(ctx, { iconName: 'layers', text: t('media.empty') })}
      </a>
      <div class="mp-card__body">
        <div class="mp-card__top">
          ${masterplanStatusBadge(ctx, plan.status)}
          ${demoBadge(ctx, plan.demo)}
        </div>
        <h3 class="mp-card__title"><a href="${href}">${ctx.pick(plan.title)}</a></h3>
        ${when(ctx.pick(plan.summary), html`<p class="mp-card__text">${ctx.pick(plan.summary)}</p>`)}
        <ul class="mp-card__facts">
          ${when(
            plan.totalAreaHa != null,
            html`<li>${icon('layers', { size: 15 })}${formatNumber(plan.totalAreaHa, ctx.locale)} ${t('unit.ha')}</li>`,
          )}
          ${when(plan.zones.length > 0, html`<li>${icon('grid', { size: 15 })}${t('masterplan.zones')}: ${plan.zones.length}</li>`)}
          ${when(plan.documents.length > 0, html`<li>${icon('file', { size: 15 })}${plan.documents.length}</li>`)}
        </ul>
        <a class="link-arrow" href="${href}">${t('common.details')}${icon('arrowRight', { size: 15 })}</a>
      </div>
    </article>
  `;
}

/* ─────────────────────────── Bitta master-reja ─────────────────────────── */

export function masterplanPage(ctx, plan) {
  const { t, content } = ctx;
  const status = content.lookup.masterplanStatuses.get(String(plan.status));
  const district = content.lookup.districts.get(String(plan.district));
  const areaType = content.lookup.areaTypes.get(String(plan.areaType));
  const lots = findLotsForMasterplan(content, plan);
  const title = ctx.pick(plan.title);
  const solutionRows = [
    ['pedestrian', 'route'],
    ['transport', 'route'],
    ['parking', 'parking'],
    ['landscaping', 'tree'],
    ['engineering', 'bolt'],
  ]
    .map(([key, iconName]) => ({ key, iconName, text: ctx.pick(plan.solutions?.[key]) }))
    .filter((row) => row.text !== '');

  const trail = breadcrumbs(ctx, [
    { label: t('nav.home'), href: ctx.url('home') },
    { label: t('nav.masterplans'), href: ctx.url('masterplans') },
    { label: title },
  ]);

  const body = html`
    <article class="mp">
      <header class="mp__head">
        <div class="container">
          <div class="mp__head-top">
            ${masterplanStatusBadge(ctx, plan.status)}
            ${demoBadge(ctx, plan.demo)}
          </div>
          <h1 class="mp__title">${title}</h1>
          <ul class="lot__facts">
            ${when(district, html`<li>${icon('pin', { size: 16 })}${ctx.pick(district?.name)}</li>`)}
            ${when(areaType, html`<li>${icon(areaTypeIcon(plan.areaType), { size: 16 })}${ctx.pick(areaType?.name)}</li>`)}
            ${when(
              plan.totalAreaHa != null,
              html`<li>${icon('layers', { size: 16 })}${formatNumber(plan.totalAreaHa, ctx.locale)} ${t('unit.ha')}</li>`,
            )}
          </ul>
          ${shareRow(ctx, { title, printable: true })}
        </div>
      </header>

      <div class="container">
        ${when(status?.disclaimer, callout(ctx, { tone: status?.tone === 'approved' ? 'success' : 'warning', title: ctx.pick(status?.name), text: ctx.pick(status?.disclaimer) }))}
      </div>

      <div class="container mp__layout">
        <div class="mp__main">
          ${when(
            ctx.pick(plan.summary),
            html`<section class="lot__block"><h2 class="block-title">${t('masterplan.summary')}</h2>${prose(ctx, plan.summary)}</section>`,
          )}

          ${when(
            plan.sheets.length > 0,
            html`<section class="lot__block" aria-labelledby="mp-sheets">
              <h2 class="block-title" id="mp-sheets">${t('masterplan.sheets')}</h2>
              <p class="block-hint">${icon('info', { size: 15 })}${t('masterplan.sheetsHint')}</p>
              <div class="sheet-list" data-viewer-group>
                ${plan.sheets.map(
                  (sheet, index) => html`<figure class="sheet">
                    <button
                      type="button"
                      class="sheet__button"
                      data-viewer-open="${index}"
                      data-src="${sheet.src}"
                      data-title="${ctx.pick(sheet.title)}"
                      data-kind="${sheet.kind || 'scheme'}"
                      aria-label="${t('masterplan.viewer.open')}: ${ctx.pick(sheet.title)}"
                    >
                      <img src="${sheet.src}" alt="${ctx.pick(sheet.title)}" loading="lazy" decoding="async">
                      <span class="sheet__zoom">${icon('zoomIn', { size: 18 })}</span>
                    </button>
                    <figcaption class="sheet__caption">
                      <span class="media__kind${sheet.kind === 'render' ? ' media__kind--render' : ''}">
                        ${sheet.kind === 'render' ? t('media.render') : t('media.scheme')}
                      </span>
                      ${ctx.pick(sheet.title)}
                    </figcaption>
                  </figure>`,
                )}
              </div>
            </section>`,
          )}

          ${when(
            plan.zones.length > 0,
            html`<section class="lot__block" aria-labelledby="mp-zones">
              <h2 class="block-title" id="mp-zones">${t('masterplan.zones')}</h2>
              <ul class="zone-list">
                ${plan.zones.map(
                  (zone) => html`<li class="zone"${zone.color ? raw(` style="--zone-color:${String(zone.color).replace(/[^#\w(),.% -]/g, '')}"`) : raw('')}>
                    <span class="zone__swatch" aria-hidden="true"></span>
                    <div class="zone__body">
                      <p class="zone__name">${ctx.pick(zone.name)}</p>
                      ${when(ctx.pick(zone.purpose), html`<p class="zone__purpose">${ctx.pick(zone.purpose)}</p>`)}
                    </div>
                    ${when(zone.areaHa != null, html`<span class="zone__area">${formatNumber(zone.areaHa, ctx.locale)} ${t('unit.ha')}</span>`)}
                  </li>`,
                )}
              </ul>
            </section>`,
          )}

          ${when(
            plan.explication.length > 0,
            html`<section class="lot__block" aria-labelledby="mp-expl">
              <h2 class="block-title" id="mp-expl">${t('masterplan.explication')}</h2>
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col">${t('masterplan.explication.no')}</th>
                      <th scope="col">${t('masterplan.explication.name')}</th>
                      <th scope="col">${t('masterplan.explication.area')}</th>
                      <th scope="col">${t('masterplan.explication.capacity')}</th>
                      <th scope="col">${t('masterplan.explication.note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${plan.explication.map(
                      (row, index) => html`<tr>
                        <td>${row.no || index + 1}</td>
                        <th scope="row">${ctx.pick(row.name)}</th>
                        <td>${row.areaM2 != null ? formatNumber(row.areaM2, ctx.locale) : '—'}</td>
                        <td>${row.capacity || '—'}</td>
                        <td>${ctx.pick(row.note) || '—'}</td>
                      </tr>`,
                    )}
                  </tbody>
                </table>
              </div>
            </section>`,
          )}

          ${when(
            solutionRows.length > 0,
            html`<section class="lot__block" aria-labelledby="mp-solutions">
              <h2 class="block-title" id="mp-solutions">${t('masterplan.solutions')}</h2>
              <ul class="solution-list">
                ${solutionRows.map(
                  (row) => html`<li class="solution">
                    <span class="solution__icon">${icon(row.iconName, { size: 18 })}</span>
                    <div>
                      <h3 class="minor-title">${t(`masterplan.solutions.${row.key}`)}</h3>
                      <p>${row.text}</p>
                    </div>
                  </li>`,
                )}
              </ul>
            </section>`,
          )}
        </div>

        <aside class="mp__side">
          <section class="lot__card">
            <h2 class="block-title">${t('masterplan.status')}</h2>
            ${defList(
              ctx,
              [
                { label: t('masterplan.status'), value: ctx.pick(status?.name) },
                { label: t('masterplan.approvedBy'), value: ctx.pick(plan.approvedBy) },
                { label: t('masterplan.approvalDocument'), value: plan.approvalDocument || '' },
                { label: t('masterplan.approvalDate'), value: plan.approvalDate ? formatDate(plan.approvalDate, ctx.locale) : '' },
                { label: t('masterplan.totalArea'), value: plan.totalAreaHa != null ? `${formatNumber(plan.totalAreaHa, ctx.locale)} ${t('unit.ha')}` : '' },
              ],
              { columns: 1 },
            )}
          </section>

          <section class="lot__card">
            <h2 class="block-title">${t('masterplan.download')}</h2>
            ${documentList(ctx, plan.documents)}
          </section>

          ${when(
            lots.length > 0,
            html`<section class="lot__card">
              <h2 class="block-title">${t('masterplan.relatedLots')}</h2>
              <ul class="bare-list bare-list--links">
                ${lots.map(
                  (lot) => html`<li><a href="${ctx.url('areas', lot.slug)}">${ctx.pick(lot.name)}${icon('chevronRight', { size: 14 })}</a></li>`,
                )}
              </ul>
            </section>`,
          )}
        </aside>
      </div>

      <div class="container lot__back">
        <a class="link-arrow link-arrow--back" href="${ctx.url('masterplans')}">${icon('arrowLeft', { size: 15 })}${t('nav.masterplans')}</a>
      </div>
    </article>

    <div class="viewer" data-viewer hidden>
      <div class="viewer__backdrop" data-viewer-close></div>
      <div class="viewer__panel" role="dialog" aria-modal="true" aria-label="${t('masterplan.viewer.open')}">
        <div class="viewer__toolbar">
          <p class="viewer__title" data-viewer-title></p>
          <div class="viewer__controls">
            <button type="button" class="icon-btn" data-viewer-zoom-out aria-label="${t('masterplan.viewer.zoomOut')}">${icon('zoomOut', { size: 18 })}</button>
            <button type="button" class="icon-btn" data-viewer-reset aria-label="${t('masterplan.viewer.reset')}">${icon('target', { size: 18 })}</button>
            <button type="button" class="icon-btn" data-viewer-zoom-in aria-label="${t('masterplan.viewer.zoomIn')}">${icon('zoomIn', { size: 18 })}</button>
            <button type="button" class="icon-btn" data-viewer-close aria-label="${t('common.close')}">${icon('close', { size: 18 })}</button>
          </div>
        </div>
        <div class="viewer__stage" data-viewer-stage>
          <img class="viewer__image" data-viewer-image alt="">
        </div>
        <p class="viewer__hint">${t('masterplan.viewer.hint')}</p>
      </div>
    </div>
  `;

  return {
    section: 'masterplans',
    slug: plan.slug,
    title,
    description: ctx.pick(plan.summary),
    bodyClass: 'page--masterplan',
    breadcrumbs: trail,
    body,
    ogImage: plan.sheets[0]?.src || null,
    scripts: ['/assets/js/viewer.js'],
  };
}
