/** Yangiliklar ro'yxati va bitta yangilik sahifasi. */
import { html, raw, when, formatDate, isoDate, truncate } from '../lib/util.mjs';
import { icon } from '../lib/icons.mjs';
import { emptyState, newsCard, demoBadge, gallery, prose, breadcrumbs, shareRow } from '../lib/ui.mjs';

export function newsListPage(ctx) {
  const { t, content, pages } = ctx;
  const page = pages.news || {};
  const items = content.news;
  const usedCategories = content.newsCategories.filter((cat) => items.some((item) => item.category === cat.id));

  const body = html`
    <section class="page-head page-head--compact">
      <div class="container">
        <h1 class="page-head__title">${ctx.pick(page.title)}</h1>
        <p class="page-head__lead">${ctx.pick(page.lead)}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        ${items.length === 0
          ? emptyState(ctx, { title: t('news.empty.title'), text: t('news.empty.text'), iconName: 'calendar' })
          : html`
              ${when(
                usedCategories.length > 1,
                html`<div class="tab-filter" data-news-filter role="group" aria-label="${t('news.category')}">
                  <button type="button" class="tab-filter__btn tab-filter__btn--active" data-category="" aria-pressed="true">${t('common.all')}</button>
                  ${usedCategories.map(
                    (cat) => html`<button type="button" class="tab-filter__btn" data-category="${cat.id}" aria-pressed="false">${ctx.pick(cat.name)}</button>`,
                  )}
                </div>`,
              )}
              <div class="card-grid card-grid--3" data-news-grid>
                ${items.map(
                  (item) => html`<div class="card-grid__cell" data-category="${item.category}">${newsCard(ctx, item)}</div>`,
                )}
              </div>
              <p class="catalog__empty" data-news-empty hidden>${t('catalog.resultsNone')}</p>
            `}
      </div>
    </section>
  `;

  return {
    section: 'news',
    title: ctx.pick(page.title),
    description: ctx.pick(page.lead),
    body,
    scripts: items.length ? ['/assets/js/news.js'] : [],
  };
}

export function newsItemPage(ctx, item) {
  const { t, content } = ctx;
  const category = content.newsCategories.find((c) => c.id === item.category);
  const title = ctx.pick(item.title);
  const relatedLots = content.lots.filter((lot) => item.relatedLotIds.includes(lot.id));
  const relatedPlans = content.masterplans.filter((plan) => item.relatedMasterplanIds.includes(plan.id));

  const trail = breadcrumbs(ctx, [
    { label: t('nav.home'), href: ctx.url('home') },
    { label: t('nav.news'), href: ctx.url('news') },
    { label: truncate(title, 60) },
  ]);

  const body = html`
    <article class="article">
      <header class="article__head">
        <div class="container narrow">
          <div class="article__meta">
            ${when(category, html`<span class="chip chip--soft">${ctx.pick(category?.name)}</span>`)}
            ${when(item.date, html`<time datetime="${isoDate(item.date)}">${formatDate(item.date, ctx.locale)}</time>`)}
            ${demoBadge(ctx, item.demo)}
          </div>
          <h1 class="article__title">${title}</h1>
          ${when(ctx.pick(item.lead), html`<p class="article__lead">${ctx.pick(item.lead)}</p>`)}
          ${shareRow(ctx, { title })}
        </div>
      </header>

      ${when(
        item.cover,
        html`<div class="container narrow article__cover">
          <figure class="media media--${item.cover?.kind || 'photo'}">
            <div class="media__frame">
              <img src="${item.cover?.src}" alt="${ctx.pick(item.cover?.alt) || title}" decoding="async">
              <span class="media__kind${item.cover?.kind === 'render' ? ' media__kind--render' : ''}">
                ${item.cover?.kind === 'render' ? t('media.render') : t('media.photo')}
              </span>
            </div>
            ${when(ctx.pick(item.cover?.caption), html`<figcaption class="media__caption">${ctx.pick(item.cover?.caption)}</figcaption>`)}
          </figure>
        </div>`,
      )}

      <div class="container narrow article__body">
        ${prose(ctx, item.body)}
        ${when(item.gallery.length > 0, gallery(ctx, item.gallery, { id: `news-${item.id}` }))}
        ${when(
          item.sourceUrl,
          html`<p class="article__source">
            ${t('news.source')}:
            <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">${item.sourceUrl}${icon('external', { size: 13 })}</a>
          </p>`,
        )}

        ${when(
          relatedLots.length + relatedPlans.length > 0,
          html`<section class="article__related">
            <h2 class="minor-title">${t('news.related')}</h2>
            <ul class="bare-list bare-list--links">
              ${relatedLots.map(
                (lot) => html`<li><a href="${ctx.url('lots', lot.slug)}">${icon('pin', { size: 14 })}${ctx.pick(lot.name)}</a></li>`,
              )}
              ${relatedPlans.map(
                (plan) => html`<li><a href="${ctx.url('masterplans', plan.slug)}">${icon('layers', { size: 14 })}${ctx.pick(plan.title)}</a></li>`,
              )}
            </ul>
          </section>`,
        )}
      </div>

      <div class="container narrow lot__back">
        <a class="link-arrow link-arrow--back" href="${ctx.url('news')}">${icon('arrowLeft', { size: 15 })}${t('news.all')}</a>
      </div>
    </article>
  `;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: title,
      datePublished: isoDate(item.date) || undefined,
      description: ctx.pick(item.lead) || undefined,
      publisher: {
        '@type': 'GovernmentOrganization',
        name: ctx.pick(content.site.institution?.name),
      },
    },
  ];

  return {
    section: 'news',
    slug: item.slug,
    title,
    description: ctx.pick(item.lead),
    bodyClass: 'page--article',
    breadcrumbs: trail,
    body,
    jsonLd,
    ogImage: item.cover?.src || null,
  };
}
