/** "Direksiya haqida" sahifasi. */
import { html, when, formatDate } from '../lib/util.mjs';
import { icon } from '../lib/icons.mjs';
import { sectionHead, workflowStages, emptyState, defList, documentList, prose, callout } from '../lib/ui.mjs';

export function aboutPage(ctx) {
  const { t, content, pages } = ctx;
  const about = pages.about || {};
  const site = content.site;
  const leadership = site.leadership?.items || [];
  const structure = site.structure?.items || [];
  const documents = site.documents?.items || [];
  const legal = site.institution?.legalBasis || [];

  const body = html`
    <section class="page-head">
      <div class="container">
        <h1 class="page-head__title">${ctx.pick(about.title)}</h1>
        <p class="page-head__lead">${ctx.pick(about.lead)}</p>
      </div>
    </section>

    <section class="section" aria-labelledby="about-identity">
      <div class="container narrow">
        <h2 class="sr-only" id="about-identity">${ctx.pick(about.title)}</h2>
        ${defList(ctx, [
          {
            label: t('footer.aboutTitle'),
            value: ctx.pick(site.institution?.name),
            wide: true,
          },
          {
            label: t('site.legalBasis'),
            value: legal.length
              ? html`<ul class="bare-list">
                  ${legal.map(
                    (item) => html`<li>
                      <a href="${item.url}" target="_blank" rel="noopener noreferrer">
                        ${item.code} — ${ctx.pick(item.title)}${icon('external', { size: 13 })}
                      </a>
                      ${when(ctx.pick(item.note), html`<p class="muted small">${ctx.pick(item.note)}</p>`)}
                    </li>`,
                  )}
                </ul>`
              : '',
            wide: true,
          },
        ], { columns: 1 })}
      </div>
    </section>

    <section class="section section--alt" aria-labelledby="about-purpose">
      <div class="container narrow">
        ${sectionHead(ctx, { id: 'about-purpose', title: ctx.pick(about.purposeTitle) })}
        ${prose(ctx, about.purpose)}
        ${when(ctx.pick(site.slogan), html`<p class="pull-quote">${ctx.pick(site.slogan)}</p>`)}
      </div>
    </section>

    <section class="section" aria-labelledby="about-activities">
      <div class="container">
        ${sectionHead(ctx, { id: 'about-activities', title: ctx.pick(about.activitiesTitle) })}
        <ul class="feature-grid">
          ${(about.activities || []).map(
            (item, index) => html`<li class="feature-card">
              <span class="feature-card__icon" aria-hidden="true">${icon(['compass', 'target', 'layers', 'file', 'gavel', 'building'][index] || 'info', { size: 22 })}</span>
              <h3 class="feature-card__title">${ctx.pick(item.title)}</h3>
              <p class="feature-card__text">${ctx.pick(item.text)}</p>
            </li>`,
          )}
        </ul>
      </div>
    </section>

    <section class="section section--alt" aria-labelledby="about-workflow">
      <div class="container">
        ${sectionHead(ctx, { id: 'about-workflow', title: ctx.pick(pages.home?.workflowIntro?.title) })}
        ${workflowStages(ctx)}
      </div>
    </section>

    <section class="section" aria-labelledby="about-approach">
      <div class="container">
        ${sectionHead(ctx, { id: 'about-approach', title: ctx.pick(about.approachTitle) })}
        <ul class="principle-list">
          ${(about.approach || []).map(
            (item) => html`<li class="principle">
              <h3 class="principle__title">${icon('check', { size: 17 })}${ctx.pick(item.title)}</h3>
              <p class="principle__text">${ctx.pick(item.text)}</p>
            </li>`,
          )}
        </ul>
      </div>
    </section>

    <section class="section section--alt" aria-labelledby="about-leadership">
      <div class="container">
        ${sectionHead(ctx, { id: 'about-leadership', title: t('footer.aboutTitle') + ' — ' + ctx.pick({ 'uz-cyrl': 'раҳбарият ва тузилма', uz: 'rahbariyat va tuzilma', ru: 'руководство и структура', en: 'leadership and structure' }) })}
        <div class="two-col">
          <div>
            <h3 class="minor-title">${ctx.pick({ 'uz-cyrl': 'Раҳбарият', uz: 'Rahbariyat', ru: 'Руководство', en: 'Leadership' })}</h3>
            ${leadership.length > 0
              ? html`<ul class="person-list">
                  ${leadership.map(
                    (person) => html`<li class="person">
                      <p class="person__name">${ctx.pick(person.name)}</p>
                      <p class="person__role">${ctx.pick(person.role)}</p>
                      ${when(person.phone || person.email, html`<p class="person__contact">
                        ${when(person.phone, html`<span>${icon('phone', { size: 14 })}${person.phone}</span>`)}
                        ${when(person.email, html`<span>${icon('mail', { size: 14 })}<a href="mailto:${person.email}">${person.email}</a></span>`)}
                      </p>`)}
                      ${when(person.receptionHours, html`<p class="person__hours">${icon('clock', { size: 14 })}${ctx.pick(person.receptionHours)}</p>`)}
                    </li>`,
                  )}
                </ul>`
              : emptyState(ctx, { text: t('empty.sectionHint'), iconName: 'building' })}
          </div>
          <div>
            <h3 class="minor-title">${ctx.pick({ 'uz-cyrl': 'Тузилма', uz: 'Tuzilma', ru: 'Структура', en: 'Structure' })}</h3>
            ${structure.length > 0
              ? html`<ul class="tree-list">
                  ${structure.map(
                    (unit) => html`<li>
                      <span class="tree-list__name">${ctx.pick(unit.name)}</span>
                      ${when(ctx.pick(unit.description), html`<span class="tree-list__desc">${ctx.pick(unit.description)}</span>`)}
                    </li>`,
                  )}
                </ul>`
              : emptyState(ctx, { text: t('empty.sectionHint'), iconName: 'layers' })}
          </div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="about-documents">
      <div class="container narrow">
        ${sectionHead(ctx, { id: 'about-documents', title: ctx.pick({ 'uz-cyrl': 'Меъёрий ҳужжатлар', uz: "Me'yoriy hujjatlar", ru: 'Нормативные документы', en: 'Regulatory documents' }) })}
        ${documents.length > 0
          ? html`<ul class="doc-list">
              ${documents.map(
                (doc) => html`<li class="doc-list__item">
                  <a class="doc-list__link" href="${doc.url || doc.src}"${doc.url ? ' target="_blank" rel="noopener noreferrer"' : ' download'}>
                    <span class="doc-list__icon">${icon('file', { size: 20 })}</span>
                    <span class="doc-list__text">
                      <span class="doc-list__title">${ctx.pick(doc.title)}</span>
                      ${when(doc.date, html`<span class="doc-list__meta">${formatDate(doc.date, ctx.locale)}</span>`)}
                    </span>
                    <span class="doc-list__action">${icon(doc.url ? 'external' : 'download', { size: 18 })}</span>
                  </a>
                </li>`,
              )}
            </ul>`
          : emptyState(ctx, { text: t('empty.sectionHint'), iconName: 'file' })}
      </div>
    </section>
  `;

  return {
    section: 'about',
    title: ctx.pick(about.title),
    description: ctx.pick(about.lead),
    body,
  };
}
