/** Oddiy sahifalar: qulaylik (accessibility) va 404. */
import { html, when } from '../lib/util.mjs';
import { icon } from '../lib/icons.mjs';
import { sectionHead } from '../lib/ui.mjs';

export function accessibilityPage(ctx) {
  const { pages, t } = ctx;
  const page = pages.accessibility || {};
  const contacts = ctx.content.site.contacts || {};
  const emails = Array.isArray(contacts.emails) ? contacts.emails : [];

  const body = html`
    <section class="page-head page-head--compact">
      <div class="container">
        <h1 class="page-head__title">${ctx.pick(page.title)}</h1>
        <p class="page-head__lead">${ctx.pick(page.lead)}</p>
      </div>
    </section>

    <section class="section">
      <div class="container narrow">
        <ul class="bullet-list bullet-list--spaced">
          ${(page.items || []).map((item) => html`<li>${icon('check', { size: 17 })}<span>${ctx.pick(item)}</span></li>`)}
        </ul>
        ${when(
          emails.length > 0,
          html`<p class="muted">
            ${ctx.pick({
              'uz-cyrl': 'Сайтдан фойдаланишда қийинчиликка дуч келсангиз, бизга хабар беринг:',
              uz: "Saytdan foydalanishda qiyinchilikka duch kelsangiz, bizga xabar bering:",
              ru: 'Если вы столкнулись с трудностями при использовании сайта, сообщите нам:',
              en: 'If you experience difficulties using this site, please let us know:',
            })}
            <a href="mailto:${emails[0]}">${emails[0]}</a>
          </p>`,
        )}
      </div>
    </section>
  `;

  return {
    section: 'accessibility',
    title: ctx.pick(page.title),
    description: ctx.pick(page.lead),
    body,
  };
}

export function notFoundPage(ctx) {
  const { t } = ctx;
  const body = html`
    <section class="section section--center">
      <div class="container narrow center">
        <p class="error-code" aria-hidden="true">404</p>
        <h1 class="page-head__title">${t('error404.title')}</h1>
        <p class="page-head__lead">${t('error404.text')}</p>
        <div class="cta-row cta-row--center">
          <a class="btn btn--primary" href="${ctx.url('home')}">${t('error404.cta')}${icon('arrowRight', { size: 17 })}</a>
          <a class="btn btn--outline" href="${ctx.url('areas')}">${t('nav.areas')}</a>
        </div>
      </div>
    </section>
  `;

  return {
    section: 'home',
    title: t('error404.title'),
    description: t('error404.text'),
    body,
    noindex: true,
  };
}

export function offlinePage(ctx) {
  const { t } = ctx;
  const body = html`
    <section class="section section--center">
      <div class="container narrow center">
        <span class="empty-state__icon">${icon('offline', { size: 32 })}</span>
        <h1 class="page-head__title">${t('offline.title')}</h1>
        <p class="page-head__lead">${t('offline.text')}</p>
        <div class="cta-row cta-row--center">
          <a class="btn btn--primary" href="${ctx.url('home')}">${t('nav.home')}</a>
        </div>
      </div>
    </section>
  `;
  return {
    section: 'home',
    title: t('offline.title'),
    description: t('offline.text'),
    body,
    noindex: true,
  };
}
