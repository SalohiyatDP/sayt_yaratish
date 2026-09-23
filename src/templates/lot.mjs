/** Bitta lot uchun alohida sahifa — "lot passporti". */
import { html, raw, when, formatNumber, formatDate, isoDate } from '../lib/util.mjs';
import { icon, areaTypeIcon } from '../lib/icons.mjs';
import {
  sectionHead, statusBadge, demoBadge, defList, gallery, mediaPlaceholder,
  bulletList, documentList, callout, lotPipeline, chips, prose, shareRow, emptyState,
  masterplanStatusBadge, breadcrumbs,
} from '../lib/ui.mjs';
import { findMasterplanForLot } from '../lib/content.mjs';

export function lotPage(ctx, lot) {
  const { t, content } = ctx;
  const district = content.lookup.districts.get(String(lot.district));
  const areaType = content.lookup.areaTypes.get(String(lot.areaType));
  const masterplan = findMasterplanForLot(content, lot);
  const name = ctx.pick(lot.name) || lot.id;
  const related = content.lots.filter((other) => other.id !== lot.id && other.district === lot.district).slice(0, 3);
  const auction = lot.auction;

  const trail = breadcrumbs(ctx, [
    { label: t('nav.home'), href: ctx.url('home') },
    { label: t('nav.areas'), href: ctx.url('areas') },
    { label: name },
  ]);

  const body = html`
    <article class="lot" data-lot-detail data-lot-id="${lot.id}">
      <header class="lot__head">
        <div class="container">
          <div class="lot__head-top">
            ${statusBadge(ctx, lot.status)}
            ${demoBadge(ctx, lot.demo)}
            ${when(lot.lotNumber, html`<span class="chip chip--soft">${t('lot.number')}: ${lot.lotNumber}</span>`)}
          </div>
          <h1 class="lot__title">${name}</h1>
          <ul class="lot__facts">
            ${when(district, html`<li>${icon('pin', { size: 16 })}${ctx.pick(district?.name)}</li>`)}
            ${when(areaType, html`<li>${icon(areaTypeIcon(lot.areaType), { size: 16 })}${ctx.pick(areaType?.name)}</li>`)}
            ${when(
              lot.areaHa != null,
              html`<li>${icon('layers', { size: 16 })}${formatNumber(lot.areaHa, ctx.locale)} ${t('unit.ha')}</li>`,
            )}
          </ul>
          ${shareRow(ctx, { title: name, printable: true })}
        </div>
      </header>

      <section class="section section--tight" aria-labelledby="lot-pipeline">
        <div class="container">
          <h2 class="minor-title" id="lot-pipeline">${t('lot.pipeline')}</h2>
          ${lotPipeline(ctx, lot)}
        </div>
      </section>

      <div class="container lot__layout">
        <div class="lot__main">
          ${photosBlock(ctx, lot)}
          ${when(
            ctx.pick(lot.description),
            html`<section class="lot__block" aria-labelledby="lot-desc">
              <h2 class="block-title" id="lot-desc">${t('lot.description')}</h2>
              ${prose(ctx, lot.description)}
            </section>`,
          )}
          ${rendersBlock(ctx, lot)}
          ${masterplanBlock(ctx, lot, masterplan)}
          ${plannedBlock(ctx, lot)}
          ${infrastructureBlock(ctx, lot)}
          ${requirementsBlock(ctx, lot)}
        </div>

        <aside class="lot__side">
          <section class="lot__card" aria-labelledby="lot-params">
            <h2 class="block-title" id="lot-params">${t('lot.passport')}</h2>
            ${defList(
              ctx,
              [
                { label: t('lot.number'), value: lot.lotNumber || '' },
                { label: t('lot.district'), value: ctx.pick(district?.name) },
                { label: t('lot.areaType'), value: ctx.pick(areaType?.name) },
                { label: t('lot.location'), value: ctx.pick(lot.location), wide: true },
                { label: t('lot.cadastre'), value: lot.cadastreNumber || '' },
                {
                  label: t('lot.area'),
                  value: areaValue(ctx, lot),
                },
                {
                  label: t('lot.coordinates'),
                  value: lot.coordinates
                    ? html`<span class="coords">
                        <code>${lot.coordinates.lat.toFixed(6)}, ${lot.coordinates.lng.toFixed(6)}</code>
                        <button type="button" class="icon-btn icon-btn--xs js-copy-text"
                          data-copy-text="${lot.coordinates.lat.toFixed(6)}, ${lot.coordinates.lng.toFixed(6)}"
                          data-copied-label="${t('common.copied')}"
                          aria-label="${t('lot.copyCoordinates')}">${icon('copy', { size: 14 })}</button>
                      </span>`
                    : '',
                  wide: true,
                },
                { label: t('lot.status'), value: statusBadge(ctx, lot.status, { size: 'sm' }) },
                {
                  label: t('lot.updatedAt'),
                  value: lot.updatedAt ? html`<time datetime="${isoDate(lot.updatedAt)}">${formatDate(lot.updatedAt, ctx.locale)}</time>` : '',
                },
              ],
              { columns: 1 },
            )}
            ${when(
              lot.tourismDirections.length > 0,
              html`<div class="lot__card-extra">
                <h3 class="minor-title">${t('catalog.filters.tourism')}</h3>
                ${chips(ctx, lot.tourismDirections, content.lookup.tourismDirections)}
              </div>`,
            )}
          </section>

          ${mapBlock(ctx, lot)}
          ${auctionBlock(ctx, lot, auction)}

          <section class="lot__card" aria-labelledby="lot-docs">
            <h2 class="block-title" id="lot-docs">${t('lot.documents')}</h2>
            ${documentList(ctx, lot.documents)}
          </section>
        </aside>
      </div>

      ${when(
        related.length > 0,
        html`<section class="section section--alt" aria-labelledby="lot-related">
          <div class="container">
            ${sectionHead(ctx, { id: 'lot-related', title: t('lot.related') })}
            <div class="card-grid card-grid--3">
              ${related.map((other) => relatedCard(ctx, other))}
            </div>
          </div>
        </section>`,
      )}

      <div class="container lot__back">
        <a class="link-arrow link-arrow--back" href="${ctx.url('areas')}">${icon('arrowLeft', { size: 15 })}${t('lot.backToCatalog')}</a>
      </div>
    </article>
  `;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name,
      description: ctx.pick(lot.shortDescription) || ctx.pick(lot.description) || undefined,
      ...(lot.coordinates
        ? { geo: { '@type': 'GeoCoordinates', latitude: lot.coordinates.lat, longitude: lot.coordinates.lng } }
        : {}),
      ...(district ? { address: { '@type': 'PostalAddress', addressRegion: 'Namangan', addressLocality: ctx.pick(district.name) } } : {}),
    },
  ];

  return {
    section: 'areas',
    slug: lot.slug,
    title: name,
    description: ctx.pick(lot.shortDescription) || ctx.pick(lot.description),
    bodyClass: 'page--lot',
    breadcrumbs: trail,
    body,
    jsonLd,
    ogImage: lot.photos[0]?.src || lot.renders[0]?.src || null,
    scripts: ['/assets/js/lot.js'],
  };
}

function areaValue(ctx, lot) {
  const { t } = ctx;
  const parts = [];
  if (lot.areaHa != null) parts.push(`${formatNumber(lot.areaHa, ctx.locale)} ${t('unit.ha')}`);
  if (lot.areaSotix != null) parts.push(`${formatNumber(lot.areaSotix, ctx.locale)} ${t('unit.sotix')}`);
  return parts.join(' · ');
}

function photosBlock(ctx, lot) {
  const { t } = ctx;
  return html`
    <section class="lot__block" aria-labelledby="lot-photos">
      <h2 class="block-title" id="lot-photos">${t('lot.currentPhotos')}</h2>
      ${lot.photos.length > 0
        ? html`
            <p class="block-hint">${icon('info', { size: 15 })}${t('lot.currentPhotosHint')}</p>
            ${gallery(ctx, lot.photos, { id: `lot-${lot.id}-photos` })}
          `
        : html`<div class="placeholder-row">
            ${mediaPlaceholder(ctx, { iconName: areaTypeIcon(lot.areaType), text: t('media.empty') })}
            <p class="muted">${t('media.emptyHint')}</p>
          </div>`}
    </section>
  `;
}

function rendersBlock(ctx, lot) {
  const { t } = ctx;
  if (lot.renders.length === 0 && lot.schemes.length === 0) return raw('');
  return html`
    <section class="lot__block" aria-labelledby="lot-renders">
      <h2 class="block-title" id="lot-renders">${t('lot.visualisations')}</h2>
      ${callout(ctx, { tone: 'warning', text: t('lot.visualisationsHint') })}
      ${gallery(ctx, [...lot.renders, ...lot.schemes], { id: `lot-${lot.id}-renders` })}
    </section>
  `;
}

function masterplanBlock(ctx, lot, masterplan) {
  const { t } = ctx;
  if (!masterplan) return raw('');
  const status = ctx.content.lookup.masterplanStatuses.get(String(masterplan.status));
  return html`
    <section class="lot__block" aria-labelledby="lot-mp">
      <h2 class="block-title" id="lot-mp">${t('lot.masterplan')}</h2>
      <div class="mp-teaser">
        <div class="mp-teaser__head">
          <p class="mp-teaser__title">${ctx.pick(masterplan.title)}</p>
          ${masterplanStatusBadge(ctx, masterplan.status)}
        </div>
        ${when(status?.disclaimer, callout(ctx, { tone: status?.tone === 'approved' ? 'success' : 'warning', text: ctx.pick(status?.disclaimer) }))}
        ${when(ctx.pick(masterplan.summary), html`<p class="mp-teaser__text">${ctx.pick(masterplan.summary)}</p>`)}
        ${when(
          masterplan.zones.length > 0,
          html`<ul class="zone-chips">
            ${masterplan.zones.map(
              (zone) => html`<li class="zone-chip"${zone.color ? raw(` style="--zone-color:${String(zone.color).replace(/[^#\w(),.% -]/g, '')}"`) : raw('')}>
                <span class="zone-chip__dot" aria-hidden="true"></span>
                ${ctx.pick(zone.name)}
                ${when(zone.areaHa != null, html`<span class="zone-chip__area">${formatNumber(zone.areaHa, ctx.locale)} ${t('unit.ha')}</span>`)}
              </li>`,
            )}
          </ul>`,
        )}
        <a class="btn btn--outline btn--sm" href="${ctx.url('masterplans', masterplan.slug)}">
          ${t('lot.masterplanOpen')}${icon('arrowRight', { size: 15 })}
        </a>
      </div>
    </section>
  `;
}

function plannedBlock(ctx, lot) {
  const { t } = ctx;
  if (lot.plannedObjects.length === 0 && lot.services.length === 0) return raw('');
  return html`
    <section class="lot__block" aria-labelledby="lot-planned">
      <h2 class="block-title" id="lot-planned">${t('lot.plannedObjects')}</h2>
      ${when(lot.plannedObjects.length > 0, bulletList(ctx, lot.plannedObjects, { iconName: 'building' }))}
      ${when(
        lot.services.length > 0,
        html`<h3 class="minor-title">${t('lot.services')}</h3>${bulletList(ctx, lot.services, { iconName: 'star' })}`,
      )}
    </section>
  `;
}

function infrastructureBlock(ctx, lot) {
  const { t } = ctx;
  const hasAccess = ctx.pick(lot.access) !== '';
  if (!hasAccess && lot.infrastructure.length === 0) return raw('');
  return html`
    <section class="lot__block" aria-labelledby="lot-infra">
      <h2 class="block-title" id="lot-infra">${t('lot.infrastructure')}</h2>
      ${when(
        hasAccess,
        html`<div class="info-row">
          <span class="info-row__icon">${icon('route', { size: 18 })}</span>
          <div><h3 class="minor-title">${t('lot.access')}</h3><p>${ctx.pick(lot.access)}</p></div>
        </div>`,
      )}
      ${when(lot.infrastructure.length > 0, bulletList(ctx, lot.infrastructure, { iconName: 'bolt' }))}
    </section>
  `;
}

function requirementsBlock(ctx, lot) {
  const { t } = ctx;
  if (lot.requirements.length === 0 && lot.restrictions.length === 0) return raw('');
  return html`
    <section class="lot__block" aria-labelledby="lot-req">
      <h2 class="block-title" id="lot-req">${t('lot.requirements')}</h2>
      ${when(lot.requirements.length > 0, bulletList(ctx, lot.requirements, { iconName: 'file' }))}
      ${when(
        lot.restrictions.length > 0,
        html`<h3 class="minor-title">${t('lot.restrictions')}</h3>${bulletList(ctx, lot.restrictions, { iconName: 'alert', className: 'bullet-list--warning' })}`,
      )}
    </section>
  `;
}

function mapBlock(ctx, lot) {
  const { t } = ctx;
  return html`
    <section class="lot__card" aria-labelledby="lot-map">
      <h2 class="block-title" id="lot-map">${t('lot.onMap')}</h2>
      ${lot.coordinates
        ? html`
            <div
              class="map map--compact"
              data-map
              data-map-source="single"
              data-lat="${lot.coordinates.lat}"
              data-lng="${lot.coordinates.lng}"
              data-title="${ctx.pick(lot.name)}"
              ${lot.boundary ? raw(`data-boundary='${JSON.stringify(lot.boundary)}'`) : raw('')}
              tabindex="0"
              role="application"
              aria-label="${t('map.title')}"
            >
              <p class="map__status">${t('map.loading')}</p>
            </div>
            ${when(lot.boundary, html`<p class="muted small">${icon('info', { size: 13 })}${t('map.boundaryNote')}</p>`)}
            <a class="link-arrow small" href="https://www.openstreetmap.org/?mlat=${lot.coordinates.lat}&mlon=${lot.coordinates.lng}#map=15/${lot.coordinates.lat}/${lot.coordinates.lng}" target="_blank" rel="noopener noreferrer">
              ${t('map.openExternal')}${icon('external', { size: 13 })}
            </a>
          `
        : html`<p class="muted">${t('map.noCoordinates')}</p>`}
    </section>
  `;
}

function auctionBlock(ctx, lot, auction) {
  const { t, content } = ctx;
  const rightTypeLabel = auction.rightTypeText
    ? ctx.pick(auction.rightTypeText)
    : ctx.pick(content.lookup.rightTypes.get(String(auction.rightType))?.name);

  return html`
    <section class="lot__card lot__card--auction" aria-labelledby="lot-auction">
      <h2 class="block-title" id="lot-auction">${icon('gavel', { size: 18 })}${t('lot.auction')}</h2>
      ${auction.verified
        ? html`
            ${defList(
              ctx,
              [
                { label: t('lot.auction.announcement'), value: auction.announcementDate ? formatDate(auction.announcementDate, ctx.locale) : '' },
                { label: t('lot.auction.date'), value: auction.startDate ? formatDate(auction.startDate, ctx.locale) : '' },
                {
                  label: t('lot.auction.startPrice'),
                  value: auction.startPrice != null ? `${formatNumber(auction.startPrice, ctx.locale)} ${auction.currency === 'UZS' ? t('unit.uzs') : auction.currency}` : '',
                },
                { label: t('lot.auction.rightType'), value: rightTypeLabel, hint: t('lot.auction.rightTypeHint'), wide: true },
              ],
              { columns: 1 },
            )}
          `
        : callout(ctx, { tone: 'neutral', text: t('lot.auction.notVerified') })}

      ${auction.lotUrl
        ? html`<a class="btn btn--primary btn--block" href="${auction.lotUrl}" target="_blank" rel="noopener noreferrer">
            ${t('lot.auction.open')}${icon('external', { size: 16 })}
          </a>`
        : html`
            <div class="disabled-action">
              <button type="button" class="btn btn--primary btn--block" disabled aria-describedby="lot-auction-note">
                ${t('lot.auction.noLink')}
              </button>
              <p class="disabled-action__note" id="lot-auction-note">${t('lot.auction.noLinkHint')}</p>
            </div>
          `}
      ${when(
        content.site.eauction?.platformUrl,
        html`<p class="muted small">
          ${ctx.pick(content.site.eauction?.notice)}
          <a href="${content.site.eauction?.platformUrl}" target="_blank" rel="noopener noreferrer">${t('lot.auction.platformVisit')}${icon('external', { size: 12 })}</a>
        </p>`,
      )}
    </section>
  `;
}

function relatedCard(ctx, lot) {
  const { t } = ctx;
  return html`
    <a class="mini-card" href="${ctx.url('areas', lot.slug)}">
      <span class="mini-card__top">${statusBadge(ctx, lot.status, { size: 'sm' })}</span>
      <span class="mini-card__title">${ctx.pick(lot.name)}</span>
      ${when(
        lot.areaHa != null,
        html`<span class="mini-card__meta">${formatNumber(lot.areaHa, ctx.locale)} ${t('unit.ha')}</span>`,
      )}
      <span class="mini-card__arrow">${icon('arrowRight', { size: 16 })}</span>
    </a>
  `;
}
