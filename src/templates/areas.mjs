/** "Hududlar va lotlar" katalogi — saytning asosiy amaliy bo'limi. */
import { html, raw, when, attr, cx, formatNumber, isoDate } from '../lib/util.mjs';
import { icon, areaTypeIcon } from '../lib/icons.mjs';
import { lotCard, emptyState, statusBadge, demoBadge } from '../lib/ui.mjs';

export function areasPage(ctx) {
  const { t, content, pages } = ctx;
  const page = pages.areas || {};
  const lots = content.lots;
  const tax = content.taxonomies;

  const withCoords = lots.filter((lot) => lot.coordinates);
  const withoutCoords = lots.length - withCoords.length;

  const body = html`
    <section class="page-head page-head--compact">
      <div class="container">
        <h1 class="page-head__title">${ctx.pick(page.title)}</h1>
        <p class="page-head__lead">${ctx.pick(page.lead)}</p>
      </div>
    </section>

    ${lots.length === 0
      ? html`<section class="section"><div class="container">
          ${emptyState(ctx, {
            title: t('catalog.empty.title'),
            text: t('catalog.empty.text'),
            iconName: 'mountain',
            action: html`<a class="btn btn--outline btn--sm" href="${ctx.url('about')}">${t('nav.about')}${icon('arrowRight', { size: 15 })}</a>`,
          })}
        </div></section>`
      : html`
        <section class="catalog" data-catalog aria-labelledby="catalog-heading">
          <h2 class="sr-only" id="catalog-heading">${ctx.pick(page.title)}</h2>
          <div class="container">
            <form class="filters" data-filters role="search" aria-label="${t('catalog.filters')}">
              <div class="filters__search">
                <label class="sr-only" for="f-q">${t('catalog.searchPlaceholder')}</label>
                ${icon('search', { size: 18 })}
                <input type="search" id="f-q" name="q" placeholder="${t('catalog.searchPlaceholder')}" autocomplete="off">
              </div>

              <details class="filters__panel" data-filters-panel>
                <summary class="filters__summary">
                  ${icon('filter', { size: 17 })}
                  <span>${t('catalog.filters')}</span>
                  <span class="filters__badge" data-filters-count hidden></span>
                </summary>
                <div class="filters__grid">
                  ${selectField(ctx, {
                    id: 'f-district',
                    name: 'district',
                    label: t('catalog.filters.district'),
                    options: (tax.districts || []).map((d) => ({ value: d.id, label: ctx.pick(d.name) })),
                  })}
                  ${selectField(ctx, {
                    id: 'f-areaType',
                    name: 'areaType',
                    label: t('catalog.filters.areaType'),
                    options: (tax.areaTypes || []).map((d) => ({ value: d.id, label: ctx.pick(d.name) })),
                  })}
                  ${selectField(ctx, {
                    id: 'f-tourism',
                    name: 'tourism',
                    label: t('catalog.filters.tourism'),
                    options: (tax.tourismDirections || []).map((d) => ({ value: d.id, label: ctx.pick(d.name) })),
                  })}
                  ${selectField(ctx, {
                    id: 'f-status',
                    name: 'status',
                    label: t('catalog.filters.status'),
                    options: (tax.lotStatuses || []).map((d) => ({ value: d.id, label: ctx.pick(d.name) })),
                  })}
                  <div class="field field--range">
                    <span class="field__label">${t('catalog.filters.area')}</span>
                    <div class="field__range">
                      <label class="sr-only" for="f-areaMin">${t('catalog.filters.areaFrom')}</label>
                      <input type="number" id="f-areaMin" name="areaMin" min="0" step="0.1" inputmode="decimal" placeholder="${t('catalog.filters.areaFrom')}">
                      <span aria-hidden="true">—</span>
                      <label class="sr-only" for="f-areaMax">${t('catalog.filters.areaTo')}</label>
                      <input type="number" id="f-areaMax" name="areaMax" min="0" step="0.1" inputmode="decimal" placeholder="${t('catalog.filters.areaTo')}">
                    </div>
                  </div>
                  ${selectField(ctx, {
                    id: 'f-sort',
                    name: 'sort',
                    label: t('catalog.sort'),
                    includeAll: false,
                    options: [
                      { value: 'updated', label: t('catalog.sort.updated') },
                      { value: 'stage', label: t('catalog.sort.stage') },
                      { value: 'areaDesc', label: t('catalog.sort.areaDesc') },
                      { value: 'areaAsc', label: t('catalog.sort.areaAsc') },
                      { value: 'nameAsc', label: t('catalog.sort.nameAsc') },
                    ],
                  })}
                </div>
                <div class="filters__actions">
                  <button type="reset" class="btn btn--ghost btn--sm" data-filters-reset>${icon('close', { size: 15 })}${t('catalog.filters.reset')}</button>
                  <button type="button" class="btn btn--ghost btn--sm js-copy-link" data-copied-label="${t('common.copied')}">
                    ${icon('share', { size: 15 })}${t('catalog.shareFilters')}
                  </button>
                  <noscript><button type="submit" class="btn btn--primary btn--sm">${t('catalog.filters')}</button></noscript>
                </div>
              </details>
            </form>

            <div class="catalog__toolbar">
              <p class="catalog__count" data-result-count role="status">${t('catalog.results', { n: lots.length })}</p>
              <div class="view-switch" role="group" aria-label="${t('catalog.viewLabel')}">
                <button type="button" class="view-switch__btn view-switch__btn--active" data-view="cards" aria-pressed="true">
                  ${icon('grid', { size: 16 })}<span>${t('catalog.view.cards')}</span>
                </button>
                <button type="button" class="view-switch__btn" data-view="map" aria-pressed="false">
                  ${icon('pin', { size: 16 })}<span>${t('catalog.view.map')}</span>
                </button>
                <button type="button" class="view-switch__btn" data-view="table" aria-pressed="false">
                  ${icon('table', { size: 16 })}<span>${t('catalog.view.table')}</span>
                </button>
              </div>
            </div>

            <div class="catalog__views">
              <div class="catalog__view" data-view-panel="cards">
                <div class="card-grid" data-lot-grid>
                  ${lots.map((lot) => html`<div class="card-grid__cell" ${lotDataAttrs(ctx, lot)}>${lotCard(ctx, lot)}</div>`)}
                </div>
                <p class="catalog__empty" data-no-results hidden>
                  <strong>${t('catalog.resultsNone')}</strong><br>${t('catalog.resultsNoneHint')}
                </p>
              </div>

              <div class="catalog__view" data-view-panel="map" hidden>
                <div class="map-shell">
                  <div class="map" data-map data-map-source="catalog" tabindex="0" role="application" aria-label="${t('map.title')}">
                    <p class="map__status">${t('map.loading')}</p>
                  </div>
                  <p class="map__hint">${icon('info', { size: 14 })}${t('map.keyboardHint')}</p>
                </div>
                <details class="map-fallback">
                  <summary>${t('map.pointsList')}</summary>
                  <ul class="coord-list">
                    ${withCoords.map(
                      (lot) => html`<li>
                        <a href="${ctx.url('areas', lot.slug)}">${ctx.pick(lot.name)}</a>
                        <code>${lot.coordinates.lat.toFixed(5)}, ${lot.coordinates.lng.toFixed(5)}</code>
                      </li>`,
                    )}
                    ${when(withCoords.length === 0, html`<li class="muted">${t('empty.noData')}</li>`)}
                  </ul>
                  ${when(
                    withoutCoords > 0,
                    html`<p class="muted small">${t('catalog.noCoordinatesCount', { n: withoutCoords })}</p>`,
                  )}
                </details>
              </div>

              <div class="catalog__view" data-view-panel="table" hidden>
                <div class="table-wrap">
                  <table class="data-table">
                    <caption class="sr-only">${t('catalog.tableCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">${t('lot.passport')}</th>
                        <th scope="col">${t('lot.district')}</th>
                        <th scope="col">${t('lot.areaType')}</th>
                        <th scope="col">${t('lot.area')}</th>
                        <th scope="col">${t('lot.status')}</th>
                      </tr>
                    </thead>
                    <tbody data-lot-table>
                      ${lots.map((lot) => {
                        const district = content.lookup.districts.get(String(lot.district));
                        const areaType = content.lookup.areaTypes.get(String(lot.areaType));
                        return html`<tr ${lotDataAttrs(ctx, lot)}>
                          <th scope="row">
                            <a href="${ctx.url('areas', lot.slug)}">${ctx.pick(lot.name)}</a>
                            ${demoBadge(ctx, lot.demo)}
                            ${when(lot.lotNumber, html`<span class="muted small"> № ${lot.lotNumber}</span>`)}
                          </th>
                          <td>${ctx.pick(district?.name) || '—'}</td>
                          <td>${ctx.pick(areaType?.name) || '—'}</td>
                          <td>${lot.areaHa != null ? `${formatNumber(lot.areaHa, ctx.locale)} ${t('unit.ha')}` : '—'}</td>
                          <td>${statusBadge(ctx, lot.status, { size: 'sm' })}</td>
                        </tr>`;
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      `}
  `;

  return {
    section: 'areas',
    title: ctx.pick(page.title),
    description: ctx.pick(page.lead),
    bodyClass: 'page--catalog',
    body,
    scripts: ['/assets/js/catalog.js'],
  };
}

function lotDataAttrs(ctx, lot) {
  return raw(
    [
      `data-lot="${lot.id}"`,
      `data-slug="${lot.slug}"`,
      `data-district="${lot.district || ''}"`,
      `data-area-type="${lot.areaType || ''}"`,
      `data-status="${lot.status || ''}"`,
      `data-tourism="${(lot.tourismDirections || []).join(' ')}"`,
      lot.areaHa != null ? `data-area-ha="${lot.areaHa}"` : '',
      `data-updated="${isoDate(lot.updatedAt)}"`,
      `data-name="${escapeAttr(ctx.pick(lot.name).toLowerCase())}"`,
      `data-search-text="${escapeAttr([ctx.pick(lot.name), ctx.pick(lot.location), ctx.pick(lot.shortDescription), lot.lotNumber].filter(Boolean).join(' ').toLowerCase())}"`,
      lot.coordinates ? `data-lat="${lot.coordinates.lat}" data-lng="${lot.coordinates.lng}"` : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function escapeAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function selectField(ctx, { id, name, label, options, includeAll = true }) {
  return html`
    <div class="field">
      <label class="field__label" for="${id}">${label}</label>
      <div class="field__control">
        <select id="${id}" name="${name}">
          ${when(includeAll, html`<option value="">${ctx.t('common.all')}</option>`)}
          ${options.map((option) => html`<option value="${option.value}">${option.label}</option>`)}
        </select>
        ${icon('chevronDown', { size: 16, className: 'field__chevron' })}
      </div>
    </div>
  `;
}
