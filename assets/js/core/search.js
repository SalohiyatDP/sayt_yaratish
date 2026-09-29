/**
 * Sayt bo'ylab tezkor qidiruv (Ctrl+K).
 * Ma'lumot /data/search-<locale>.json faylidan bir marta yuklanadi.
 */
import { qs, qsa, t, config, fetchJson, escapeHtml, debounce, trapFocus } from './config.js';

const GROUP_ORDER = ['lots', 'masterplans', 'news', 'pages'];

let entries = null;
let loading = null;
let activeIndex = -1;
let releaseFocus = null;
let lastFocused = null;

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u2019\u02bb\u02bc']/g, "'")
    .trim();
}

async function ensureIndex() {
  if (entries) return entries;
  if (!loading) {
    loading = fetchJson(config.searchIndex || '').then((data) => {
      entries = Array.isArray(data?.entries) ? data.entries : [];
      return entries;
    });
  }
  return loading;
}

function score(entry, query) {
  const title = normalize(entry.title);
  const text = normalize(`${entry.title} ${entry.meta} ${entry.text}`);
  if (!text.includes(query)) return 0;
  if (title.startsWith(query)) return 100;
  if (title.includes(query)) return 70;
  return 40;
}

function highlight(value, query) {
  const source = String(value ?? '');
  if (!query) return escapeHtml(source);
  const index = normalize(source).indexOf(query);
  if (index === -1) return escapeHtml(source);
  return (
    escapeHtml(source.slice(0, index)) +
    '<mark>' +
    escapeHtml(source.slice(index, index + query.length)) +
    '</mark>' +
    escapeHtml(source.slice(index + query.length))
  );
}

function render(container, query) {
  if (!entries || entries.length === 0) {
    container.innerHTML = `<p class="search-empty">${escapeHtml(t('search.emptyIndex'))}</p>`;
    return;
  }
  if (!query) {
    container.innerHTML = `<p class="search-empty">${escapeHtml(t('search.placeholder'))}</p>`;
    return;
  }

  const hits = entries
    .map((entry) => ({ entry, weight: score(entry, query) }))
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 24);

  if (hits.length === 0) {
    container.innerHTML =
      `<p class="search-empty"><strong>${escapeHtml(t('search.noResults'))}</strong><br>${escapeHtml(t('search.noResultsHint'))}</p>`;
    return;
  }

  const grouped = new Map();
  for (const hit of hits) {
    const key = hit.entry.type || 'pages';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(hit.entry);
  }

  let html = '';
  for (const group of GROUP_ORDER) {
    const items = grouped.get(group);
    if (!items || items.length === 0) continue;
    html += `<div class="search-group"><p class="search-group__title">${escapeHtml(t(`search.group.${group}`))}</p>`;
    for (const entry of items) {
      const meta = [entry.meta, entry.demo ? t('demo.badge') : ''].filter(Boolean).join(' · ');
      html += `<a class="search-hit" href="${escapeHtml(entry.url)}">
        <span class="search-hit__title">${highlight(entry.title, query)}</span>
        ${meta ? `<span class="search-hit__meta">${escapeHtml(meta)}</span>` : ''}
        ${entry.text ? `<span class="search-hit__text">${highlight(entry.text, query)}</span>` : ''}
      </a>`;
    }
    html += '</div>';
  }
  container.innerHTML = html;
  activeIndex = -1;
}

function setActive(container, delta) {
  const hits = qsa('.search-hit', container);
  if (hits.length === 0) return;
  activeIndex = (activeIndex + delta + hits.length) % hits.length;
  hits.forEach((hit, index) => hit.classList.toggle('is-active', index === activeIndex));
  hits[activeIndex].scrollIntoView({ block: 'nearest' });
}

export function initSearch() {
  const overlay = qs('[data-search-overlay]');
  if (!overlay) return;
  const input = qs('[data-search-input]', overlay);
  const results = qs('[data-search-results]', overlay);
  const panel = qs('.search-panel', overlay);

  const open = async () => {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    releaseFocus = trapFocus(panel, close);
    input.value = '';
    results.innerHTML = `<p class="search-empty">${escapeHtml(t('common.loading'))}</p>`;
    input.focus();
    await ensureIndex();
    render(results, '');
  };

  const close = () => {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (releaseFocus) releaseFocus();
    releaseFocus = null;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  };

  for (const button of qsa('.js-search-open')) button.addEventListener('click', open);
  for (const button of qsa('[data-search-close]', overlay)) button.addEventListener('click', close);

  const onInput = debounce(() => render(results, normalize(input.value)), 120);
  input.addEventListener('input', onInput);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(results, 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(results, -1);
    } else if (event.key === 'Enter') {
      const active = qs('.search-hit.is-active', results) || qs('.search-hit', results);
      if (active) {
        event.preventDefault();
        window.location.href = active.getAttribute('href');
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    const isCommandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    const isSlash = event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (isCommandK || isSlash) {
      event.preventDefault();
      if (overlay.hidden) open();
      else close();
    }
  });
}
