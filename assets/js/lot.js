/**
 * Lot sahifasi va bog'lanish sahifasidagi yakka xaritalarni ishga tushirish.
 */
import { qsa, config } from './core/config.js';
import { createMap } from './map.js';

function initSingleMaps() {
  for (const host of qsa('[data-map][data-map-source="single"]')) {
    const lat = Number(host.dataset.lat);
    const lng = Number(host.dataset.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const map = createMap(host, {
      tileUrl: config.mapTileUrl,
      attribution: config.mapAttribution,
      center: { lat, lng },
      zoom: 14,
    });
    if (!map) continue;

    map.setMarkers([{ id: 'lot', lat, lng, title: host.dataset.title || '', label: '' }]);

    if (host.dataset.boundary) {
      try {
        const points = JSON.parse(host.dataset.boundary);
        if (Array.isArray(points) && points.length >= 3) {
          map.setBoundaries([{ points }]);
          map.fitBounds(points.map(([pLat, pLng]) => ({ lat: pLat, lng: pLng })), 40);
        }
      } catch (error) {
        console.warn('Chegara konturi o\'qilmadi', error);
      }
    }
  }
}

initSingleMaps();
