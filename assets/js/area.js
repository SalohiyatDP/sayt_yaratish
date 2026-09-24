/**
 * Hudud sahifasidagi xarita: hududning umumiy chegarasi va ichidagi lotlar.
 */
import { qsa, config } from './core/config.js';
import { createMap } from './map.js';

const readJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Xarita ma\'lumoti o\'qilmadi', error);
    return fallback;
  }
};

function initAreaMaps() {
  for (const host of qsa('[data-map][data-map-source="area"]')) {
    const lat = Number(host.dataset.lat);
    const lng = Number(host.dataset.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const map = createMap(host, {
      tileUrl: config.mapTileUrl,
      attribution: config.mapAttribution,
      center: { lat, lng },
      zoom: 13,
    });
    if (!map) continue;

    const areaBoundary = readJson(host.dataset.boundary, null);
    const lots = readJson(host.dataset.lots, []);

    // Chegaralar: avval hudud (yo'g'on kontur), so'ng har bir lot
    const boundaries = [];
    if (Array.isArray(areaBoundary) && areaBoundary.length >= 3) {
      boundaries.push({ points: areaBoundary, kind: 'area' });
    }
    for (const lot of lots) {
      if (Array.isArray(lot.boundary) && lot.boundary.length >= 3) {
        boundaries.push({ points: lot.boundary, kind: 'lot', id: lot.id });
      }
    }
    if (boundaries.length > 0) map.setBoundaries(boundaries);

    // Lot belgilari — bosilsa lot sahifasi ochiladi
    map.setMarkers(
      lots.map((lot, index) => ({
        id: lot.id,
        lat: lot.lat,
        lng: lot.lng,
        title: lot.number ? `${lot.name} (${lot.number})` : lot.name,
        label: String(index + 1),
        url: lot.url,
      })),
    );

    // Ko'rinishni butun hududga moslash
    const fitPoints = [];
    if (Array.isArray(areaBoundary)) {
      for (const [pLat, pLng] of areaBoundary) fitPoints.push({ lat: pLat, lng: pLng });
    }
    for (const lot of lots) fitPoints.push({ lat: lot.lat, lng: lot.lng });
    if (fitPoints.length > 1) map.fitBounds(fitPoints, 40);
  }
}

initAreaMaps();
