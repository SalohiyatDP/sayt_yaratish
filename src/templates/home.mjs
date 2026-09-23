/** Bosh sahifa. */
import { html, raw, when, formatNumber, formatDate, truncate } from '../lib/util.mjs';
import { icon } from '../lib/icons.mjs';
import { sectionHead, workflowStages, lotCard, newsCard, emptyState, callout, mediaFigure } from '../lib/ui.mjs';
import { featuredLots, auctionLots } from '../lib/content.mjs';

export function homePage(ctx) {
  const { t, content, pages } = ctx;
  const home = pages.home || {};
  const featured = featuredLots(content, 6);
  const onAuction = auctionLots(content);
  const latestNews = content.news.slice(0, 3);
  const stats = content.site.statistics || {};
  const showStats = stats.verified === true && Array.isArray(stats.items) && stats.items.length > 0;
  const hero = content.site.media?.heroImage;
  const investorSteps = (pages.investors?.steps || []).slice(0, 5);

  const body = html`
    <section class="hero${hero ? ' hero--photo' : ' hero--pattern'}">
      ${when(
        hero,
        html`<div class="hero__media">
          <img src="${hero?.src}" alt="${ctx.pick(hero?.alt)}" decoding="async" fetchpriority="high">
          ${when(hero?.credit, html`<p class="hero__credit">${hero?.credit}</p>`)}
        </div>`,
      )}
      ${when(!hero, html`<div class="hero__pattern" aria-hidden="true"></div>`)}
      <div class="container hero__inner">
        <p class="hero__eyebrow">${ctx.pick(content.site.institution?.name)}</p>
        <h1 class="hero__title">${ctx.pick(home.hero?.title)}</h1>
        <p class="hero__lead">${ctx.pick(home.hero?.lead)}</p>
        <div class="hero__actions">
          <a class="btn btn--primary btn--lg" href="${ctx.url('areas')}">
            ${t('home.cta.areas')}${icon('arrowRight', { size: 18 })}
          </a>
          <a class="btn btn--outline btn--lg" href="${ctx.url('areas')}?status=auction">
            ${icon('gavel', { size: 18 })}${t('home.cta.auctionLots')}
            ${when(onAuction.length > 0, html`<span class="btn__count">${onAuction.length}</span>`)}
          </a>
        </div>
        <p class="hero__slogan">${ctx.pick(content.site.slogan)}</p>
      </div>
    </section>

    ${when(
      showStats,
      html`<section class="section section--tight">
        <div class="container">
          <h2 class="sr-only">${t('home.statsTitle')}</h2>
          <ul class="stats">
            ${(stats.items || []).map(
              (item) => html`<li class="stats__item">
                <span class="stats__value">${formatNumber(item.value, ctx.locale)}${when(item.unit, html`<span class="stats__unit">${ctx.pick(item.unit)}</span>`)}</span>
                <span class="stats__label">${ctx.pick(item.label)}</span>
              </li>`,
            )}
          </ul>
          <p class="stats__source">
            ${when(stats.source, html`<span>${t('home.statsSource')}: ${stats.source}</span>`)}
            ${when(stats.asOfDate, html`<span>${t('home.statsAsOf')}: ${formatDate(stats.asOfDate, ctx.locale)}</span>`)}
          </p>
        </div>
      </section>`,
    )}

    <section class="section" aria-labelledby="workflow-title">
      <div class="container">
        ${sectionHead(ctx, {
          id: 'workflow-title',
          title: ctx.pick(home.workflowIntro?.title),
          lead: ctx.pick(home.workflowIntro?.lead),
        })}
        ${workflowStages(ctx)}
      </div>
    </section>

    <section class="section section--alt" aria-labelledby="featured-title">
      <div class="container">
        ${sectionHead(ctx, {
          id: 'featured-title',
          title: ctx.pick(home.featuredTitle),
          action: featured.length
            ? html`<a class="link-arrow" href="${ctx.url('areas')}">${t('common.viewAll')}${icon('arrowRight', { size: 15 })}</a>`
            : null,
        })}
        ${featured.length > 0
          ? html`<div class="card-grid">${featured.map((lot) => lotCard(ctx, lot))}</div>`
          : emptyState(ctx, {
              title: t('catalog.empty.title'),
              text: t('home.featuredEmpty'),
              iconName: 'mountain',
            })}
      </div>
    </section>

    <section class="section" aria-labelledby="investor-teaser-title">
      <div class="container">
        ${sectionHead(ctx, {
          id: 'investor-teaser-title',
          title: ctx.pick(home.investorTeaser?.title),
          lead: ctx.pick(home.investorTeaser?.lead),
          action: html`<a class="btn btn--outline btn--sm" href="${ctx.url('investors')}">${t('home.investorStepsCta')}${icon('arrowRight', { size: 15 })}</a>`,
        })}
        <ol class="steps steps--compact">
          ${investorSteps.map(
            (step, index) => html`<li class="steps__item">
              <span class="steps__number" aria-hidden="true">${index + 1}</span>
              <div class="steps__body">
                <h3 class="steps__title">${ctx.pick(step.title)}</h3>
                <p class="steps__text">${truncate(ctx.pick(step.text), 150)}</p>
              </div>
            </li>`,
          )}
        </ol>
        ${when(
          ctx.pick(content.site.eauction?.notice),
          callout(ctx, { tone: 'info', text: ctx.pick(content.site.eauction?.notice) }),
        )}
      </div>
    </section>

    ${when(
      latestNews.length > 0,
      html`<section class="section section--alt" aria-labelledby="latest-news-title">
        <div class="container">
          ${sectionHead(ctx, {
            id: 'latest-news-title',
            title: t('news.latest'),
            action: html`<a class="link-arrow" href="${ctx.url('news')}">${t('news.all')}${icon('arrowRight', { size: 15 })}</a>`,
          })}
          <div class="card-grid card-grid--3">${latestNews.map((item) => newsCard(ctx, item))}</div>
        </div>
      </section>`,
    )}
  `;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'GovernmentOrganization',
      name: ctx.pick(content.site.institution?.name),
      alternateName: ctx.pick(content.site.institution?.shortName),
      description: ctx.pick(content.site.mission),
      areaServed: { '@type': 'AdministrativeArea', name: 'Namangan Region, Uzbekistan' },
      ...(content.site.contacts?.emails?.length ? { email: content.site.contacts.emails[0] } : {}),
      ...(content.site.contacts?.phones?.length ? { telephone: content.site.contacts.phones[0] } : {}),
    },
  ];

  return {
    section: 'home',
    title: ctx.pick(home.hero?.title),
    description: ctx.pick(home.hero?.lead),
    bodyClass: 'page--home',
    body,
    jsonLd,
  };
}
