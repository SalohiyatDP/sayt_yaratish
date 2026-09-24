/**
 * Kontent qatlamini yuklash va normallashtirish.
 * Barcha ma'lumot content/*.json fayllaridan olinadi.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { slugify, withoutMeta, isEmpty } from './util.mjs';

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Kontent faylini o'qishda xatolik: ${file}\n${error.message}`);
  }
}

/**
 * content/ katalogidan barcha ma'lumotlarni yuklaydi.
 * @param {string} contentDir
 * @param {{ demo?: boolean }} options demo=true bo'lsa, demo deb belgilangan yozuvlar ham qo'shiladi.
 */
export function loadContent(contentDir, options = {}) {
  const demo = Boolean(options.demo);

  const site = withoutMeta(readJson(path.join(contentDir, 'site.json'), {}));
  const taxonomies = withoutMeta(readJson(path.join(contentDir, 'taxonomies.json'), {}));
  const pages = withoutMeta(readJson(path.join(contentDir, 'pages.json'), {}));
  const areasFile = readJson(path.join(contentDir, 'areas.json'), { items: [] });
  const lotsFile = readJson(path.join(contentDir, 'lots.json'), { items: [] });
  const masterplansFile = readJson(path.join(contentDir, 'masterplans.json'), { items: [] });
  const newsFile = readJson(path.join(contentDir, 'news.json'), { items: [] });

  // Demo rejimida content/demo/ katalogidagi namuna yozuvlar qo'shiladi.
  // Ular har doim demo: true bilan belgilanadi va saytda "DEMO" nishoni bilan chiqadi.
  const demoDir = path.join(contentDir, 'demo');
  const demoItems = (file) => {
    if (!demo) return [];
    const data = readJson(path.join(demoDir, file), { items: [] });
    return (Array.isArray(data.items) ? data.items : []).map((item) => ({ ...item, demo: true }));
  };

  const areas = normalizeCollection([...(areasFile.items || []), ...demoItems('areas.json')], demo, normalizeArea);
  const lots = normalizeCollection([...(lotsFile.items || []), ...demoItems('lots.json')], demo, normalizeLot);
  const masterplans = normalizeCollection(
    [...(masterplansFile.items || []), ...demoItems('masterplans.json')],
    demo,
    normalizeMasterplan,
  );
  const news = normalizeCollection([...(newsFile.items || []), ...demoItems('news.json')], demo, normalizeNews).sort(
    (a, b) => String(b.date || '').localeCompare(String(a.date || '')),
  );

  const lookup = buildLookups(taxonomies);
  lookup.areas = new Map(areas.map((area) => [area.id, area]));

  /* ── Hudud ↔ lot bog'lanishi ──
   * Lot hudud ichida joylashadi. Hudud haqidagi umumiy ma'lumot (tuman,
   * hudud turi, yo'nalishlar, infratuzilma) faqat bir joyda — hududda —
   * saqlanadi, lot esa uni meros qilib oladi. Shu tarzda bir xil ma'lumot
   * takrorlanmaydi va qarama-qarshilik yuzaga kelmaydi.
   */
  for (const area of areas) area.lots = [];
  for (const lot of lots) {
    const area = lookup.areas.get(lot.areaId) || null;
    lot.area = area;
    if (area) {
      area.lots.push(lot);
      // Meros qilinadigan maydonlar — lotda alohida kiritilmaydi
      lot.district = area.district;
      lot.areaType = area.areaType;
      lot.tourismDirections = area.tourismDirections;
      lot.masterplanId = lot.masterplanId ?? area.masterplanId;
      lot.location = isEmpty(lot.location) ? area.location : lot.location;
      lot.infrastructure = lot.infrastructure.length > 0 ? lot.infrastructure : area.infrastructure;
      lot.access = isEmpty(lot.access) ? area.access : lot.access;
    } else {
      lot.district = null;
      lot.areaType = null;
      lot.tourismDirections = [];
    }
  }

  // Hududda nechta lot borligi bo'yicha foydali ko'rsatkichlar
  for (const area of areas) {
    area.lotCount = area.lots.length;
    area.availableLotCount = area.lots.filter((lot) => lot.status === 'auction-announced' || lot.status === 'ready').length;
  }

  // Hududi ko'rsatilmagan lotlar — qurishda ogohlantirish beriladi
  const orphanLots = lots.filter((lot) => !lot.area);

  return {
    demo,
    site,
    taxonomies,
    pages,
    areas,
    lots,
    orphanLots,
    masterplans,
    news,
    newsCategories: Array.isArray(newsFile.categories) ? newsFile.categories : [],
    lookup,
    hasAnyContent: areas.length + lots.length + masterplans.length + news.length > 0,
  };
}

function normalizeCollection(items, includeDemo, normalizer) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object')
    .filter((item) => item.published !== false)
    .filter((item) => (item.demo ? includeDemo : true))
    .map((item, index) => normalizer(item, index))
    .filter((item) => item.slug);
}

/** Hudud — lotlarni o'z ichiga oladigan umumiy maydon. */
function normalizeArea(area, index) {
  const media = Array.isArray(area.media) ? area.media.filter((m) => m && m.src) : [];
  return {
    ...area,
    id: area.id || `area-${String(index + 1).padStart(4, '0')}`,
    slug: area.slug || slugify(pickAnyText(area.name) || area.id || `area-${index + 1}`),
    media,
    photos: media.filter((m) => m.kind === 'photo' || !m.kind),
    renders: media.filter((m) => m.kind === 'render'),
    schemes: media.filter((m) => m.kind === 'scheme'),
    tourismDirections: toArray(area.tourismDirections),
    infrastructure: toArray(area.infrastructure),
    documents: toArray(area.documents).filter((d) => d && d.src),
    coordinates: normalizeCoordinates(area.coordinates),
    boundary: normalizeBoundary(area.boundary),
    totalAreaHa: toNumber(area.totalAreaHa),
    masterplanId: area.masterplanId || null,
    demo: Boolean(area.demo),
  };
}

function normalizeLot(lot, index) {
  const media = Array.isArray(lot.media) ? lot.media.filter((m) => m && m.src) : [];
  return {
    ...lot,
    id: lot.id || `lot-${String(index + 1).padStart(4, '0')}`,
    slug: lot.slug || slugify(pickAnyText(lot.name) || lot.id || `lot-${index + 1}`),
    // Lot qaysi hududga tegishli — bog'lanish shu maydon orqali
    areaId: lot.areaId || null,
    media,
    photos: media.filter((m) => m.kind === 'photo' || !m.kind),
    renders: media.filter((m) => m.kind === 'render'),
    schemes: media.filter((m) => m.kind === 'scheme'),
    tourismDirections: toArray(lot.tourismDirections),
    plannedObjects: toArray(lot.plannedObjects),
    services: toArray(lot.services),
    infrastructure: toArray(lot.infrastructure),
    requirements: toArray(lot.requirements),
    restrictions: toArray(lot.restrictions),
    documents: toArray(lot.documents).filter((d) => d && d.src),
    auction: normalizeAuction(lot.auction),
    coordinates: normalizeCoordinates(lot.coordinates),
    boundary: normalizeBoundary(lot.boundary),
    areaHa: toNumber(lot.areaHa),
    areaSotix: toNumber(lot.areaSotix),
    demo: Boolean(lot.demo),
  };
}

function normalizeAuction(auction) {
  const source = auction && typeof auction === 'object' ? auction : {};
  const verified = source.verified === true;
  const lotUrl = typeof source.lotUrl === 'string' && /^https?:\/\//i.test(source.lotUrl.trim())
    ? source.lotUrl.trim()
    : null;
  return {
    status: source.status || 'not-announced',
    announcementDate: source.announcementDate || '',
    startDate: source.startDate || '',
    endDate: source.endDate || '',
    // Tasdiqlanmagan aukcion ma'lumotlari saytda ko'rsatilmaydi.
    startPrice: verified ? toNumber(source.startPrice) : null,
    currency: source.currency || 'UZS',
    rightType: verified ? source.rightType || null : null,
    rightTypeText: verified ? source.rightTypeText || null : null,
    lotUrl,
    verified,
  };
}

function normalizeMasterplan(plan, index) {
  return {
    ...plan,
    id: plan.id || `mp-${String(index + 1).padStart(4, '0')}`,
    slug: plan.slug || slugify(pickAnyText(plan.title) || plan.id || `mp-${index + 1}`),
    status: plan.status || 'concept',
    lotIds: toArray(plan.lotIds),
    zones: toArray(plan.zones),
    explication: toArray(plan.explication),
    sheets: toArray(plan.sheets).filter((s) => s && s.src),
    documents: toArray(plan.documents).filter((d) => d && d.src),
    totalAreaHa: toNumber(plan.totalAreaHa),
    solutions: plan.solutions && typeof plan.solutions === 'object' ? plan.solutions : {},
    demo: Boolean(plan.demo),
  };
}

function normalizeNews(item, index) {
  return {
    ...item,
    id: item.id || `news-${String(index + 1).padStart(4, '0')}`,
    slug: item.slug || slugify(pickAnyText(item.title) || item.id || `news-${index + 1}`),
    category: item.category || 'official',
    date: item.date || '',
    gallery: toArray(item.gallery).filter((g) => g && g.src),
    relatedLotIds: toArray(item.relatedLotIds),
    relatedMasterplanIds: toArray(item.relatedMasterplanIds),
    cover: item.cover && item.cover.src ? item.cover : null,
    demo: Boolean(item.demo),
  };
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter((v) => !isEmpty(v));
  if (isEmpty(value)) return [];
  return [value];
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCoordinates(value) {
  if (!value || typeof value !== 'object') return null;
  const lat = toNumber(value.lat);
  const lng = toNumber(value.lng);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function normalizeBoundary(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const points = value
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lat = toNumber(point[0]);
        const lng = toNumber(point[1]);
        return lat != null && lng != null ? [lat, lng] : null;
      }
      if (point && typeof point === 'object') {
        const lat = toNumber(point.lat);
        const lng = toNumber(point.lng);
        return lat != null && lng != null ? [lat, lng] : null;
      }
      return null;
    })
    .filter(Boolean);
  return points.length >= 3 ? points : null;
}

function pickAnyText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    for (const [key, candidate] of Object.entries(value)) {
      if (key.startsWith('_')) continue;
      if (typeof candidate === 'string' && candidate.trim() !== '') return candidate;
    }
  }
  return '';
}

/** Taksonomiyalar bo'yicha tez qidirish uchun indekslar. */
function buildLookups(taxonomies) {
  const index = (list, key = 'id') => {
    const map = new Map();
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && item[key] != null) map.set(String(item[key]), item);
      }
    }
    return map;
  };

  return {
    districts: index(taxonomies.districts),
    areaTypes: index(taxonomies.areaTypes),
    lotStatuses: index(taxonomies.lotStatuses),
    workflowStages: index(taxonomies.workflowStages),
    tourismDirections: index(taxonomies.tourismDirections),
    rightTypes: index(taxonomies.rightTypes?.items),
    masterplanStatuses: index(taxonomies.masterplanStatuses),
    mediaKinds: index(taxonomies.mediaKinds),
  };
}

/** Lot uchun mos master-rejani topadi. */
export function findMasterplanForLot(content, lot) {
  if (!lot) return null;
  if (lot.masterplanId) {
    const byId = content.masterplans.find((mp) => mp.id === lot.masterplanId);
    if (byId) return byId;
  }
  return content.masterplans.find((mp) => mp.lotIds.includes(lot.id)) || null;
}

/** Master-rejaga tegishli lotlarni qaytaradi. */
export function findLotsForMasterplan(content, plan) {
  if (!plan) return [];
  return content.lots.filter((lot) => plan.lotIds.includes(lot.id) || lot.masterplanId === plan.id);
}

/** Aukcionda turgan lotlar. */
export const auctionLots = (content) => content.lots.filter((lot) => lot.status === 'auction');

/** Bosh sahifadagi "Tanlangan hududlar" uchun lotlar tanlovi. */
export function featuredLots(content, limit = 6) {
  const priority = { auction: 0, 'auction-prep': 1, masterplan: 2, study: 3, 'auction-closed': 4 };
  return [...content.lots]
    .sort((a, b) => {
      const pa = priority[a.status] ?? 9;
      const pb = priority[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    })
    .slice(0, limit);
}
