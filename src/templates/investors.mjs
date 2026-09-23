/** "Investorlarga" bo'limi: bosqichli yo'riqnoma va ko'p so'raladigan savollar. */
import { html, when } from '../lib/util.mjs';
import { icon } from '../lib/icons.mjs';
import { sectionHead, callout, prose } from '../lib/ui.mjs';
import { auctionLots } from '../lib/content.mjs';

export function investorsPage(ctx) {
  const { t, content, pages } = ctx;
  const page = pages.investors || {};
  const steps = page.steps || [];
  const faq = page.faq || [];
  const onAuction = auctionLots(content);

  const body = html`
    <section class="page-head page-head--compact">
      <div class="container">
        <h1 class="page-head__title">${ctx.pick(page.title)}</h1>
        <p class="page-head__lead">${ctx.pick(page.lead)}</p>
      </div>
    </section>

    <section class="section" aria-labelledby="inv-steps">
      <div class="container narrow">
        ${sectionHead(ctx, { id: 'inv-steps', title: t('investors.stepsTitle') })}
        <ol class="steps">
          ${steps.map(
            (step, index) => html`<li class="steps__item">
              <span class="steps__number" aria-hidden="true">${index + 1}</span>
              <div class="steps__body">
                <p class="steps__eyebrow">${t('investors.step', { n: index + 1 })}</p>
                <h3 class="steps__title">${ctx.pick(step.title)}</h3>
                <p class="steps__text">${ctx.pick(step.text)}</p>
                ${when(
                  step.linkTo,
                  html`<a class="link-arrow" href="${ctx.url(step.linkTo)}">${t('investors.goTo')}${icon('arrowRight', { size: 15 })}</a>`,
                )}
              </div>
            </li>`,
          )}
        </ol>

        <div class="cta-row">
          <a class="btn btn--primary" href="${ctx.url('areas')}">${t('home.cta.areas')}${icon('arrowRight', { size: 17 })}</a>
          <a class="btn btn--outline" href="${ctx.url('areas')}?status=auction">
            ${icon('gavel', { size: 17 })}${t('home.cta.auctionLots')}
            ${when(onAuction.length > 0, html`<span class="btn__count">${onAuction.length}</span>`)}
          </a>
        </div>
      </div>
    </section>

    <section class="section section--alt" aria-labelledby="inv-disclaimer">
      <div class="container narrow">
        <h2 class="sr-only" id="inv-disclaimer">${ctx.pick(page.disclaimerTitle)}</h2>
        ${callout(ctx, {
          tone: 'warning',
          title: ctx.pick(page.disclaimerTitle),
          text: ctx.pick(page.disclaimer),
        })}
        ${when(
          ctx.pick(content.site.eauction?.notice),
          callout(ctx, { tone: 'info', text: ctx.pick(content.site.eauction?.notice) }),
        )}
      </div>
    </section>

    <section class="section" aria-labelledby="inv-faq">
      <div class="container narrow">
        ${sectionHead(ctx, { id: 'inv-faq', title: ctx.pick(page.faqTitle) })}
        <div class="faq">
          ${faq.map(
            (item, index) => html`<details class="faq__item"${index === 0 ? ' open' : ''}>
              <summary class="faq__question">
                <span>${ctx.pick(item.q)}</span>
                ${icon('chevronDown', { size: 18, className: 'faq__chevron' })}
              </summary>
              <div class="faq__answer">${prose(ctx, item.a)}</div>
            </details>`,
          )}
        </div>
      </div>
    </section>

    <section class="section section--alt">
      <div class="container narrow center">
        <p class="lead">${ctx.pick(pages.contact?.lead)}</p>
        <a class="btn btn--primary" href="${ctx.url('contact')}">${t('contact.form.title')}${icon('arrowRight', { size: 17 })}</a>
      </div>
    </section>
  `;

  const jsonLd = faq.length
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((item) => ({
            '@type': 'Question',
            name: ctx.pick(item.q),
            acceptedAnswer: { '@type': 'Answer', text: ctx.pick(item.a) },
          })),
        },
      ]
    : [];

  return {
    section: 'investors',
    title: ctx.pick(page.title),
    description: ctx.pick(page.lead),
    body,
    jsonLd,
  };
}
