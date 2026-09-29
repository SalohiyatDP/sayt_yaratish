/**
 * Lot sahifasi va bog'lanish sahifasidagi yakka xaritalarni ishga tushirish.
 */
import { qsa, config } from './core/config.js';
import { createMap } from './map.js';
import { toPolygonList } from './core/geo.js';

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
        const polygons = toPolygonList(JSON.parse(host.dataset.boundary));
        if (polygons.length > 0) {
          map.setBoundaries(polygons.map((points) => ({ points })));
          const all = polygons.flat().map(([pLat, pLng]) => ({ lat: pLat, lng: pLng }));
          map.fitBounds(all, 40);
        }
      } catch (error) {
        console.warn('Chegara konturi o\'qilmadi', error);
      }
    }
  }
}

initSingleMaps();
