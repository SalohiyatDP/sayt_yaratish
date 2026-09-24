/**
 * Hudud sahifasi.
 *
 * Hudud — umumiy turistik-rekreatsion maydon. Lotlar shu hudud ichida
 * joylashadi va har biri alohida sahifada ochiladi. Shu sababli bu sahifada
 * hudud haqidagi umumiy ma'lumot (tuman, turi, chegara, infratuzilma,
 * master-reja) va ichidagi lotlar ro'yxati beriladi.
 */
import { html, raw, when, formatNumber, formatDate } from '../lib/util.mjs';
import { icon, areaTypeIcon } from '../lib/icons.mjs';
import {
  demoBadge, defList, gallery, mediaPlaceholder, bulletList, documentList,
  chips, prose, shareRow, breadcrumbs, lotCard, emptyState, masterplanStatusBadge,
} from '../lib/ui.mjs';

export function areaPage(ctx, area) {
  const { t, content } = ctx;
  const district = content.lookup.districts.get(String(area.district));
  const areaType = content.lookup.areaTypes.get(String(area.areaType));
  const masterplan = area.masterplanId ? content.masterplans.find((plan) => plan.id === area.masterplanId) : null;
  const name = ctx.pick(area.name) || area.id;
  const lots = area.lots || [];

  const trail = breadcrumbs(ctx, [
    { label: t('nav.home'), href: ctx.url('home') },
    { label: t('nav.areas'), href: ctx.url('areas') },
    { label: name },
  ]);

  const body = html`
    <article class="lot" data-area-detail data-area-id="${area.id}">
      <header class="lot__head">
        <div class="container">
          <div class="lot__head-top">
            <span class="chip chip--soft">${t('area.badge')}</span>
            ${demoBadge(ctx, area.demo)}
          </div>
          <h1 class="lot__title">${name}</h1>
          <ul class="lot__facts">
            ${when(district, html`<li>${icon('pin', { size: 16 })}${ctx.pick(district?.name)}</li>`)}
            ${when(areaType, html`<li>${icon(areaTypeIcon(area.areaType), { size: 16 })}${ctx.pick(areaType?.name)}</li>`)}
            ${when(
              area.totalAreaHa != null,
              html`<li>${icon('layers', { size: 16 })}${formatNumber(area.totalAreaHa, ctx.locale)} ${t('unit.ha')}</li>`,
            )}
            <li>${icon('tag', { size: 16 })}${t('area.lotCount', { n: lots.length })}</li>
          </ul>
          ${shareRow(ctx, { title: name, printable: true })}
        </div>
      </header>

      <div class="container lot__layout">
        <div class="lot__main">
          ${photosBlock(ctx, area)}

          ${when(
            ctx.pick(area.description),
            html`<section class="lot__block" aria-labelledby="area-desc">
              <h2 class="block-title" id="area-desc">${t('area.description')}</h2>
              ${prose(ctx, area.description)}
            </section>`,
          )}

          <section class="lot__block" aria-labelledby="area-lots">
            <h2 class="block-title" id="area-lots">${t('area.lots.title')}</h2>
            ${lots.length === 0
              ? emptyState(ctx, {
                  title: t('area.lots.empty.title'),
                  text: t('area.lots.empty.text'),
                  iconName: 'tag',
                })
              : html`
                <p class="block-note">${t('area.lots.note')}</p>
                <div class="card-grid card-grid--tight">
                  ${lots.map((lot) => lotCard(ctx, lot, { compare: true, level: 3 }))}
                </div>`}
          </section>

          ${when(
            area.coordinates,
            html`<section class="lot__block" aria-labelledby="area-map">
              <h2 class="block-title" id="area-map">${t('area.map')}</h2>
              <div
                class="map map--compact"
                data-map
                data-map-source="area"
                data-lat="${area.coordinates?.lat}"
                data-lng="${area.coordinates?.lng}"
                data-title="${ctx.pick(area.name)}"
                ${area.boundary ? raw(`data-boundary='${JSON.stringify(area.boundary)}'`) : raw('')}
                ${raw(`data-lots='${JSON.stringify(mapLots(ctx, area))}'`)}
                tabindex="0"
                role="application"
                aria-label="${t('map.title')}"
              >
                <p class="map__status">${t('map.loading')}</p>
              </div>
              ${when(area.boundary, html`<p class="muted small">${icon('info', { size: 13 })}${t('map.boundaryNote')}</p>`)}
              ${when(area.boundarySource, html`<p class="muted small">${t('area.boundarySource')}: ${area.boundarySource}</p>`)}
            </section>`,
          )}

          ${when(
            area.infrastructure.length > 0,
            html`<section class="lot__block" aria-labelledby="area-infra">
              <h2 class="block-title" id="area-infra">${t('area.infrastructure')}</h2>
              ${bulletList(ctx, area.infrastructure.map((item) => ctx.pick(item)))}
            </section>`,
          )}

          ${when(
            ctx.pick(area.access),
            html`<section class="lot__block" aria-labelledby="area-access">
              <h2 class="block-title" id="area-access">${t('area.access')}</h2>
              ${prose(ctx, area.access)}
            </section>`,
          )}
        </div>

        <aside class="lot__side">
          <div class="side-card">
            <h2 class="side-card__title">${t('area.summary')}</h2>
            ${defList(ctx, [
              { label: t('lot.district'), value: ctx.pick(district?.name) },
              { label: t('lot.areaType'), value: ctx.pick(areaType?.name) },
              {
                label: t('area.totalArea'),
                value: area.totalAreaHa != null ? `${formatNumber(area.totalAreaHa, ctx.locale)} ${t('unit.ha')}` : '',
              },
              { label: t('area.lots.count'), value: String(lots.length) },
              { label: t('lot.location'), value: ctx.pick(area.location) },
              { label: t('lot.updatedAt'), value: formatDate(area.updatedAt, ctx.locale) },
            ])}
          </div>

          ${when(
            area.tourismDirections.length > 0,
            html`<div class="side-card">
              <h2 class="side-card__title">${t('lot.tourismDirections')}</h2>
              ${chips(ctx, area.tourismDirections, content.lookup.tourismDirections, { iconName: 'compass' })}
            </div>`,
          )}

          ${when(
            masterplan,
            html`<div class="side-card">
              <h2 class="side-card__title">${t('lot.masterplan')}</h2>
              <p class="side-card__text">${ctx.pick(masterplan?.title)}</p>
              ${masterplanStatusBadge(ctx, masterplan?.status)}
              <a class="btn btn--outline btn--sm btn--block" href="${ctx.url('masterplans', masterplan?.slug)}">
                ${t('lot.masterplan.open')}${icon('arrowRight', { size: 15 })}
              </a>
            </div>`,
          )}

          <div class="side-card">
            <h2 class="side-card__title">${t('lot.documents')}</h2>
            ${documentList(ctx, area.documents, { emptyText: t('lot.documents.empty') })}
          </div>

          <div class="side-card">
            <h2 class="side-card__title">${t('contact.form.title')}</h2>
            <p class="side-card__text">${t('area.contactNote')}</p>
            <a class="btn btn--primary btn--sm btn--block" href="${ctx.url('contact')}?area=${encodeURIComponent(name)}">
              ${icon('mail', { size: 15 })}${t('contact.form.submit')}
            </a>
          </div>
        </aside>
      </div>

      <div class="container">
        <a class="link-arrow link-arrow--back" href="${ctx.url('areas')}">
          ${icon('arrowLeft', { size: 15 })}${t('area.backToList')}
        </a>
      </div>
    </article>
  `;

  return {
    section: 'areas',
    slug: area.slug,
    title: name,
    description: ctx.pick(area.shortDescription) || ctx.pick(area.description).slice(0, 160),
    breadcrumbs: trail,
    bodyClass: 'page--lot',
    body,
    scripts: ['/assets/js/area.js'],
  };
}

/** Xaritada ko'rsatiladigan lotlar — koordinatasi borlari. */
function mapLots(ctx, area) {
  return (area.lots || [])
    .filter((lot) => lot.coordinates)
    .map((lot) => ({
      id: lot.id,
      name: ctx.pick(lot.name) || lot.id,
      url: ctx.url('lots', lot.slug),
      lat: lot.coordinates.lat,
      lng: lot.coordinates.lng,
      boundary: lot.boundary || null,
      number: lot.lotNumber || null,
    }));
}

function photosBlock(ctx, area) {
  const items = [...area.photos, ...area.renders, ...area.schemes];
  if (items.length === 0) {
    return html`<div class="lot__block">${mediaPlaceholder(ctx, { iconName: areaTypeIcon(area.areaType) })}</div>`;
  }
  return gallery(ctx, items, { id: 'area-gallery', title: ctx.t('media.gallery') });
}
