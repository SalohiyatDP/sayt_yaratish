/** "Bog'lanish" sahifasi: rekvizitlar va murojaat shakli. */
import { html, raw, when, attr } from '../lib/util.mjs';
import { icon } from '../lib/icons.mjs';
import { sectionHead, callout, emptyState, defList } from '../lib/ui.mjs';

export function contactPage(ctx) {
  const { t, content, pages } = ctx;
  const page = pages.contact || {};
  const contacts = content.site.contacts || {};
  const endpoint = content.site.features?.contactFormEndpoint || null;
  const fallbackEmail = content.site.features?.contactFormFallbackEmail || (contacts.emails || [])[0] || '';

  const phones = Array.isArray(contacts.phones) ? contacts.phones : [];
  const emails = Array.isArray(contacts.emails) ? contacts.emails : [];
  const social = Array.isArray(contacts.social) ? contacts.social : [];
  const address = ctx.pick(contacts.address);
  const hasAnyContact = Boolean(address) || phones.length > 0 || emails.length > 0;

  const body = html`
    <section class="page-head page-head--compact">
      <div class="container">
        <h1 class="page-head__title">${ctx.pick(page.title)}</h1>
        <p class="page-head__lead">${ctx.pick(page.lead)}</p>
      </div>
    </section>

    <section class="section">
      <div class="container contact__layout">
        <div class="contact__info">
          <h2 class="block-title">${t('footer.contactTitle')}</h2>
          ${hasAnyContact
            ? defList(
                ctx,
                [
                  { label: t('contact.address'), value: address, wide: true },
                  {
                    label: t('contact.phone'),
                    value: phones.length
                      ? html`<ul class="bare-list">${phones.map((p) => html`<li><a href="tel:${String(p).replace(/[^\d+]/g, '')}">${p}</a></li>`)}</ul>`
                      : '',
                  },
                  {
                    label: t('contact.email'),
                    value: emails.length
                      ? html`<ul class="bare-list">${emails.map((e) => html`<li><a href="mailto:${e}">${e}</a></li>`)}</ul>`
                      : '',
                  },
                  { label: t('contact.workingHours'), value: ctx.pick(contacts.workingHours) },
                  { label: t('contact.receptionHours'), value: ctx.pick(contacts.receptionHours) },
                ],
                { columns: 1 },
              )
            : emptyState(ctx, {
                title: t('empty.noData'),
                text: t('empty.sectionHint'),
                iconName: 'building',
              })}

          ${when(
            social.length > 0,
            html`<div class="contact__social">
              <h3 class="minor-title">${t('contact.social')}</h3>
              <ul class="social-list">
                ${social.map(
                  (link) => html`<li>
                    <a class="btn btn--ghost btn--sm" href="${link.url}" target="_blank" rel="noopener noreferrer">
                      ${link.name || link.platform}${icon('external', { size: 14 })}
                    </a>
                  </li>`,
                )}
              </ul>
            </div>`,
          )}

          <div class="contact__map">
            <h3 class="minor-title">${t('contact.onMap')}</h3>
            ${contacts.coordinates && contacts.coordinates.lat != null
              ? html`<div
                  class="map map--compact"
                  data-map
                  data-map-source="single"
                  data-lat="${contacts.coordinates.lat}"
                  data-lng="${contacts.coordinates.lng}"
                  data-title="${ctx.pick(content.site.institution?.shortName)}"
                  tabindex="0"
                  role="application"
                  aria-label="${t('map.title')}"
                ><p class="map__status">${t('map.loading')}</p></div>`
              : html`<p class="muted">${ctx.pick(contacts.mapEmbedNote) || t('empty.noData')}</p>`}
          </div>
        </div>

        <div class="contact__form-wrap">
          <h2 class="block-title" id="contact-form-title">${t('contact.form.title')}</h2>
          ${endpoint
            ? contactForm(ctx, { endpoint })
            : html`
                ${callout(ctx, {
                  tone: 'warning',
                  title: t('contact.form.disabledTitle'),
                  text: t('contact.form.disabledText'),
                })}
                ${when(
                  fallbackEmail,
                  html`<a class="btn btn--primary" href="mailto:${fallbackEmail}">
                    ${icon('mail', { size: 17 })}${t('contact.form.fallbackEmail')}
                  </a>`,
                )}
                ${contactForm(ctx, { endpoint: null })}
              `}
          <p class="contact__privacy">${icon('info', { size: 15 })}${ctx.pick(page.privacyNotice)}</p>
        </div>
      </div>
    </section>
  `;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'GovernmentOrganization',
      name: ctx.pick(content.site.institution?.name),
      ...(address ? { address: { '@type': 'PostalAddress', streetAddress: address, addressRegion: 'Namangan' } } : {}),
      ...(phones.length ? { telephone: phones[0] } : {}),
      ...(emails.length ? { email: emails[0] } : {}),
    },
  ];

  return {
    section: 'contact',
    title: ctx.pick(page.title),
    description: ctx.pick(page.lead),
    bodyClass: 'page--contact',
    body,
    jsonLd,
    scripts: ['/assets/js/contact.js'],
  };
}

function contactForm(ctx, { endpoint }) {
  const { t, content } = ctx;
  const disabled = !endpoint;
  const lotOptions = content.lots.map((lot) => ({ value: ctx.pick(lot.name), label: ctx.pick(lot.name) }));

  return html`
    <form
      class="form${disabled ? ' form--disabled' : ''}"
      data-contact-form
      ${attr('data-endpoint', endpoint || null)}
      ${attr('data-enabled', disabled ? 'false' : 'true')}
      method="post"
      novalidate
      aria-labelledby="contact-form-title"
    >
      <div class="form__alert" data-form-alert role="alert" hidden></div>
      <fieldset class="form__fields"${disabled ? raw(' disabled') : raw('')}>
        ${disabled ? html`<legend class="sr-only">${t('contact.form.disabledTitle')}</legend>` : html`<legend class="sr-only">${t('contact.form.title')}</legend>`}

        ${textField(ctx, { id: 'c-name', name: 'name', label: t('contact.form.name'), required: true, autocomplete: 'name' })}
        ${textField(ctx, { id: 'c-org', name: 'organization', label: t('contact.form.org'), autocomplete: 'organization' })}
        <div class="form__row">
          ${textField(ctx, { id: 'c-phone', name: 'phone', label: t('contact.form.phone'), type: 'tel', required: true, autocomplete: 'tel', inputmode: 'tel', placeholder: t('contact.form.phonePlaceholder') })}
          ${textField(ctx, { id: 'c-email', name: 'email', label: t('contact.form.email'), type: 'email', autocomplete: 'email' })}
        </div>
        <p class="form__hint">${t('contact.form.phoneHint')}</p>

        <div class="field">
          <label class="field__label" for="c-area">${t('contact.form.area')}</label>
          <input
            class="field__input"
            type="text"
            id="c-area"
            name="area"
            list="c-area-list"
            placeholder="${t('contact.form.areaPlaceholder')}"
            autocomplete="off"
          >
          ${when(
            lotOptions.length > 0,
            html`<datalist id="c-area-list">${lotOptions.map((o) => html`<option value="${o.value}"></option>`)}</datalist>`,
          )}
        </div>

        <div class="field">
          <label class="field__label" for="c-message">${t('contact.form.message')} <span class="req" aria-hidden="true">*</span></label>
          <textarea class="field__input" id="c-message" name="message" rows="6" required aria-required="true"></textarea>
          <p class="field__error" data-error-for="message" hidden></p>
        </div>

        <div class="field field--check">
          <label class="check">
            <input type="checkbox" name="consent" id="c-consent" required aria-required="true">
            <span>${t('contact.form.consent')} <span class="req" aria-hidden="true">*</span></span>
          </label>
          <p class="field__error" data-error-for="consent" hidden></p>
        </div>

        <input type="hidden" name="locale" value="${ctx.locale}">
        <input type="hidden" name="page" value="">
        <div class="form__actions">
          <button type="submit" class="btn btn--primary btn--lg"${disabled ? raw(' disabled') : raw('')} data-submit-label="${t('contact.form.submit')}" data-sending-label="${t('contact.form.sending')}">
            ${icon('mail', { size: 17 })}<span>${t('contact.form.submit')}</span>
          </button>
        </div>
      </fieldset>
      ${when(disabled, html`<p class="form__disabled-note">${icon('alert', { size: 15 })}${t('contact.form.disabledTitle')}</p>`)}
    </form>
  `;
}

function textField(ctx, { id, name, label, type = 'text', required = false, autocomplete, inputmode, placeholder }) {
  return html`
    <div class="field">
      <label class="field__label" for="${id}">
        ${label}${when(required, html` <span class="req" aria-hidden="true">*</span>`)}
        ${when(!required, html` <span class="field__optional">${ctx.t('common.optional')}</span>`)}
      </label>
      <input
        class="field__input"
        type="${type}"
        id="${id}"
        name="${name}"
        ${attr('autocomplete', autocomplete)}
        ${attr('inputmode', inputmode)}
        ${attr('placeholder', placeholder)}
        ${required ? raw('required aria-required="true"') : raw('')}
      >
      <p class="field__error" data-error-for="${name}" hidden></p>
    </div>
  `;
}
