/**
 * "Hududlar va lotlar" katalogi: saralash, tartiblash, ko'rinishlar va xarita.
 * Saralash holati sahifa manzilida saqlanadi — havolani ulashish mumkin.
 */
import { qs, qsa, t, config, storage, STORAGE_KEYS, fetchJson, debounce } from './core/config.js';
import { createMap } from './map.js';

const FILTER_FIELDS = ['q', 'area', 'district', 'areaType', 'tourism', 'status', 'areaMin', 'areaMax', 'sort'];
const VIEWS = ['cards', 'map', 'table'];

const STAGE_WEIGHT = { auction: 0, 'auction-prep': 1, masterplan: 2, study: 3, 'auction-closed': 4 };

let map = null;
let catalogData = null;

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[\u2019\u02bb\u02bc']/g, "'").trim();
}

function readFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const values = {};
  for (const field of FILTER_FIELDS) {
    const value = params.get(field);
    if (value != null && value !== '') values[field] = value;
  }
  return values;
}

function applyFiltersToForm(form, values) {
  for (const field of FILTER_FIELDS) {
    const input = form.elements.namedItem(field);
    if (input && values[field] != null) input.value = values[field];
  }
}

function collectFilters(form) {
  const values = {};
  for (const field of FILTER_FIELDS) {
    const input = form.elements.namedItem(field);
    if (!input) continue;
    const value = String(input.value || '').trim();
    if (value !== '' && !(field === 'sort' && value === 'updated')) values[field] = value;
  }
  return values;
}

function matches(node, filters) {
  const data = node.dataset;
  // `area` — lot qaysi hududga tegishli (areaId). `areaHa` esa maydon o'lchami.
  if (filters.area && data.area !== filters.area) return false;
  if (filters.district && data.district !== filters.district) return false;
  if (filters.areaType && data.areaType !== filters.areaType) return false;
  if (filters.status && data.status !== filters.status) return false;
  if (filters.tourism) {
    const list = String(data.tourism || '').split(/\s+/).filter(Boolean);
    if (!list.includes(filters.tourism)) return false;
  }
  if (filters.areaMin != null && filters.areaMin !== '') {
    const min = Number(filters.areaMin);
    const area = data.areaHa == null || data.areaHa === '' ? null : Number(data.areaHa);
    if (!Number.isNaN(min) && (area == null || area < min)) return false;
  }
  if (filters.areaMax != null && filters.areaMax !== '') {
    const max = Number(filters.areaMax);
    const area = data.areaHa == null || data.areaHa === '' ? null : Number(data.areaHa);
    if (!Number.isNaN(max) && (area == null || area > max)) return false;
  }
  if (filters.q) {
    const needle = normalize(filters.q);
    if (!normalize(data.searchText || data.name).includes(needle)) return false;
  }
  return true;
}

function sortNodes(nodes, sort) {
  const compare = {
    areaDesc: (a, b) => numberOf(b, 'areaHa') - numberOf(a, 'areaHa'),
    areaAsc: (a, b) => numberOf(a, 'areaHa') - numberOf(b, 'areaHa'),
    nameAsc: (a, b) => String(a.dataset.name).localeCompare(String(b.dataset.name)),
    stage: (a, b) => (STAGE_WEIGHT[a.dataset.status] ?? 9) - (STAGE_WEIGHT[b.dataset.status] ?? 9),
    updated: (a, b) => String(b.dataset.updated || '').localeCompare(String(a.dataset.updated || '')),
  }[sort || 'updated'];
  return [...nodes].sort(compare || (() => 0));
}

function numberOf(node, key) {
  const value = node.dataset[key];
  if (value == null || value === '') return -1;
  const num = Number(value);
  return Number.isFinite(num) ? num : -1;
}

function updateUrl(filters, view) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) params.set(key, value);
  if (view && view !== 'cards') params.set('view', view);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState(null, '', url);
}

async function ensureCatalogData() {
  if (catalogData) return catalogData;
  const data = await fetchJson(config.catalogData || '');
  catalogData = data && Array.isArray(data.lots) ? data : { lots: [] };
  return catalogData;
}

async function syncMap(visibleIds) {
  const host = qs('[data-map][data-map-source="catalog"]');
  if (!host) return;

  if (!map) {
    const data = await ensureCatalogData();
    map = createMap(host, {
      tileUrl: config.mapTileUrl,
      attribution: config.mapAttribution,
      center: { lat: 41.0, lng: 71.6 },
      zoom: 9,
    });
    if (!map) return;
    host._lots = data.lots;
  }

  const lots = (host._lots || []).filter((lot) => lot.coordinates && visibleIds.has(lot.id));
  map.setMarkers(
    lots.map((lot) => ({
      id: lot.id,
      lat: lot.coordinates.lat,
      lng: lot.coordinates.lng,
      title: lot.name,
      meta: [lot.districtName, lot.statusName, lot.areaHa != null ? `${lot.areaHa} ${t('unit.ha')}` : '']
        .filter(Boolean)
        .join(' · '),
      url: lot.url,
      tone: lot.status === 'auction' ? 'success' : 'default',
      label: '',
    })),
  );
  map.setBoundaries(lots.filter((lot) => lot.boundary).map((lot) => ({ points: lot.boundary })));
  map.fitAll();
  map.resize();
}

function setView(view, { persist = true } = {}) {
  const target = VIEWS.includes(view) ? view : 'cards';
  for (const button of qsa('[data-view]')) {
    const active = button.dataset.view === target;
    button.classList.toggle('view-switch__btn--active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const panel of qsa('[data-view-panel]')) {
    panel.hidden = panel.dataset.viewPanel !== target;
  }
  if (persist) storage.set(STORAGE_KEYS.view, target);
  return target;
}

export function initCatalog() {
  const root = qs('[data-catalog]');
  if (!root) return;

  const form = qs('[data-filters]', root);
  const grid = qs('[data-lot-grid]', root);
  const tableBody = qs('[data-lot-table]', root);
  const countNode = qs('[data-result-count]', root);
  const noResults = qs('[data-no-results]', root);
  const filterBadge = qs('[data-filters-count]', root);
  const panel = qs('[data-filters-panel]', root);
  if (!form || !grid) return;

  const cells = qsa('.card-grid__cell', grid);
  const rows = tableBody ? qsa('tr', tableBody) : [];

  let currentView = 'cards';

  function apply({ updateHistory = true } = {}) {
    const filters = collectFilters(form);
    const visibleIds = new Set();
    let visible = 0;

    for (const cell of cells) {
      const ok = matches(cell, filters);
      cell.hidden = !ok;
      if (ok) {
        visible += 1;
        visibleIds.add(cell.dataset.lot);
      }
    }
    for (const row of rows) {
      row.hidden = !matches(row, filters);
    }

    for (const node of sortNodes(cells, filters.sort)) grid.appendChild(node);
    if (tableBody) for (const node of sortNodes(rows, filters.sort)) tableBody.appendChild(node);

    if (countNode) countNode.textContent = t('catalog.results', { n: visible });
    if (noResults) noResults.hidden = visible !== 0;

    const activeCount = Object.keys(filters).filter((key) => key !== 'sort' && key !== 'q').length;
    if (filterBadge) {
      filterBadge.hidden = activeCount === 0;
      filterBadge.textContent = String(activeCount);
    }
    if (panel && activeCount > 0) panel.open = true;

    if (updateHistory) updateUrl(filters, currentView);
    if (currentView === 'map') syncMap(visibleIds);
    root._visibleIds = visibleIds;
  }

  // Dastlabki holat: URL → shakl
  const urlFilters = readFiltersFromUrl();
  applyFiltersToForm(form, urlFilters);

  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view') || storage.get(STORAGE_KEYS.view, 'cards');
  currentView = setView(requestedView, { persist: false });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    apply();
  });
  form.addEventListener('change', () => apply());
  form.addEventListener(
    'input',
    debounce((event) => {
      if (event.target.type === 'search' || event.target.type === 'number') apply();
    }, 180),
  );
  form.addEventListener('reset', () => {
    setTimeout(() => {
      for (const field of FILTER_FIELDS) {
        const input = form.elements.namedItem(field);
        if (input && field !== 'sort') input.value = '';
      }
      apply();
    }, 0);
  });

  for (const button of qsa('[data-view]', root)) {
    button.addEventListener('click', () => {
      currentView = setView(button.dataset.view);
      updateUrl(collectFilters(form), currentView);
      if (currentView === 'map') syncMap(root._visibleIds || new Set());
    });
  }

  apply({ updateHistory: false });
  if (currentView === 'map') syncMap(root._visibleIds || new Set());
}

initCatalog();
