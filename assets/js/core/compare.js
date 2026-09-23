/**
 * Investor uchun "taqqoslash savati".
 * Tanlangan lotlar faqat brauzer xotirasida (localStorage) saqlanadi,
 * serverga hech narsa yuborilmaydi.
 */
import {
  qs, qsa, t, config, storage, STORAGE_KEYS, fetchJson, escapeHtml, formatNumber, trapFocus,
} from './config.js';

const LIMIT = Number(config.compareLimit) || 4;

let selected = [];
let catalog = null;
let releaseFocus = null;

function load() {
  const saved = storage.get(STORAGE_KEYS.compare, []);
  selected = Array.isArray(saved) ? saved.filter((item) => item && item.id).slice(0, LIMIT) : [];
}

function persist() {
  storage.set(STORAGE_KEYS.compare, selected);
}

function isSelected(id) {
  return selected.some((item) => item.id === id);
}

function syncButtons() {
  for (const button of qsa('.js-compare-toggle')) {
    const active = isSelected(button.dataset.lotId);
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('btn--primary', active);
    button.classList.toggle('btn--ghost', !active);
    const label = button.querySelector('.js-compare-label');
    if (label) label.textContent = active ? t('compare.added') : t('compare.add');
  }
}

function syncBar() {
  const bar = qs('[data-compare-bar]');
  if (!bar) return;
  const count = qs('[data-compare-count]', bar);
  const list = qs('[data-compare-list]', bar);

  bar.hidden = selected.length === 0;
  document.body.classList.toggle('has-compare-bar', selected.length > 0);
  if (count) count.textContent = String(selected.length);
  if (list) {
    list.innerHTML = selected
      .map(
        (item) => `<li><span class="compare-chip">
          <a href="${escapeHtml(item.url || '#')}">${escapeHtml(item.name || item.id)}</a>
          <button type="button" class="icon-btn icon-btn--xs" data-compare-remove="${escapeHtml(item.id)}"
            aria-label="${escapeHtml(t('compare.remove'))}">
            <svg class="icon" width="14" height="14" aria-hidden="true"><use href="#ic-close"/></svg>
          </button>
        </span></li>`,
      )
      .join('');
  }
}

function toggle(id, name, url) {
  if (isSelected(id)) {
    selected = selected.filter((item) => item.id !== id);
  } else {
    if (selected.length >= LIMIT) {
      announce(t('compare.limit', { n: LIMIT }));
      return;
    }
    selected.push({ id, name, url });
  }
  persist();
  syncButtons();
  syncBar();
}

function announce(message) {
  let region = qs('#compare-live');
  if (!region) {
    region = document.createElement('p');
    region.id = 'compare-live';
    region.className = 'sr-only';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  region.textContent = message;
}

async function ensureCatalog() {
  if (catalog) return catalog;
  const data = await fetchJson(config.catalogData || '');
  catalog = data && Array.isArray(data.lots) ? data : { lots: [] };
  return catalog;
}

function cell(value) {
  return value == null || value === '' ? `<span class="no-data">${escapeHtml(t('empty.noDataShort'))}</span>` : escapeHtml(String(value));
}

async function renderTable() {
  const host = qs('[data-compare-table]');
  if (!host) return;
  if (selected.length === 0) {
    host.innerHTML = `<p class="search-empty">${escapeHtml(t('compare.empty'))}</p>`;
    return;
  }
  host.innerHTML = `<p class="search-empty">${escapeHtml(t('common.loading'))}</p>`;
  const data = await ensureCatalog();
  const lots = selected
    .map((item) => data.lots.find((lot) => lot.id === item.id) || { id: item.id, name: item.name, url: item.url })
    .filter(Boolean);

  const rows = [
    { label: t('lot.number'), get: (lot) => lot.lotNumber },
    { label: t('lot.district'), get: (lot) => lot.districtName },
    { label: t('lot.areaType'), get: (lot) => lot.areaTypeName },
    {
      label: t('lot.area'),
      get: (lot) => (lot.areaHa != null ? `${formatNumber(lot.areaHa)} ${t('unit.ha')}` : null),
    },
    { label: t('lot.status'), get: (lot) => lot.statusName },
    {
      label: t('lot.coordinates'),
      get: (lot) => (lot.coordinates ? `${lot.coordinates.lat.toFixed(5)}, ${lot.coordinates.lng.toFixed(5)}` : null),
    },
    {
      label: t('lot.auction.startPrice'),
      get: (lot) =>
        lot.auction && lot.auction.verified && lot.auction.startPrice != null
          ? `${formatNumber(lot.auction.startPrice)} ${lot.auction.currency === 'UZS' ? t('unit.uzs') : lot.auction.currency}`
          : null,
    },
    {
      label: t('lot.auction.date'),
      get: (lot) => (lot.auction && lot.auction.verified ? lot.auction.startDate : null),
    },
  ];

  host.innerHTML = `
    <div class="table-wrap">
      <table class="compare-table">
        <thead>
          <tr>
            <th scope="col">${escapeHtml(t('compare.field'))}</th>
            ${lots.map((lot) => `<th scope="col"><a href="${escapeHtml(lot.url || '#')}">${escapeHtml(lot.name || lot.id)}</a></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `<tr>
                <th scope="row">${escapeHtml(row.label)}</th>
                ${lots.map((lot) => `<td>${cell(row.get(lot))}</td>`).join('')}
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

export function initCompare() {
  load();

  document.addEventListener('click', (event) => {
    const toggleButton = event.target.closest('.js-compare-toggle');
    if (toggleButton) {
      event.preventDefault();
      toggle(toggleButton.dataset.lotId, toggleButton.dataset.lotName, toggleButton.dataset.lotUrl);
      return;
    }
    const removeButton = event.target.closest('[data-compare-remove]');
    if (removeButton) {
      event.preventDefault();
      selected = selected.filter((item) => item.id !== removeButton.dataset.compareRemove);
      persist();
      syncButtons();
      syncBar();
      if (!qs('[data-compare-modal]')?.hidden) renderTable();
    }
  });

  const clearButton = qs('[data-compare-clear]');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      selected = [];
      persist();
      syncButtons();
      syncBar();
    });
  }

  const modal = qs('[data-compare-modal]');
  const openButton = qs('[data-compare-open]');
  if (modal && openButton) {
    const panel = qs('.compare-modal__panel', modal);
    const close = () => {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (releaseFocus) releaseFocus();
      releaseFocus = null;
      openButton.focus();
    };
    openButton.addEventListener('click', async () => {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      releaseFocus = trapFocus(panel, close);
      await renderTable();
      qs('[data-compare-close]', modal)?.focus();
    });
    for (const button of qsa('[data-compare-close]', modal)) button.addEventListener('click', close);
  }

  syncButtons();
  syncBar();
}
