/**
 * Yengil interaktiv xarita moduli — tashqi kutubxonalarga bog'liq emas.
 *
 * Imkoniyatlari:
 *   • OpenStreetMap (yoki boshqa) raster plitkalari
 *   • sichqoncha/sensor bilan surish, g'ildirak va tugmalar bilan masshtab
 *   • klaviatura bilan boshqarish (yo'naltiruvchi tugmalar, + va −)
 *   • markerlar va ular uchun ma'lumot oynasi
 *   • kadastr chegarasi konturi (SVG) — berilgan nuqtalar o'zgartirilmaydi
 *   • plitkalar yuklanmasa — ochiq xatolik holati
 *
 * Koordinatalar Web Mercator (EPSG:3857) proyeksiyasida hisoblanadi.
 */
import { t, escapeHtml } from './core/config.js';

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;

/* ── Proyeksiya ─────────────────────────────────────────────────────────── */

const scaleFor = (zoom) => TILE_SIZE * 2 ** zoom;

function lngToX(lng, scale) {
  return ((Number(lng) + 180) / 360) * scale;
}

function latToY(lat, scale) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
}

function xToLng(x, scale) {
  return (x / scale) * 360 - 180;
}

function yToLat(y, scale) {
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/* ── Xarita ─────────────────────────────────────────────────────────────── */

export function createMap(element, options = {}) {
  const tileUrl = options.tileUrl || '';
  const attribution = options.attribution || '';
  if (!tileUrl) {
    setStatus(element, t('map.error'), true);
    return null;
  }

  const state = {
    zoom: Number(options.zoom) || 12,
    lat: Number(options.center?.lat ?? 41.0),
    lng: Number(options.center?.lng ?? 71.6),
    markers: [],
    boundaries: [],
    activeId: null,
  };

  element.classList.add('map--live');
  element.innerHTML = '';

  const tilesLayer = el('div', 'map__tiles');
  const svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgLayer.setAttribute('class', 'map__svg');
  svgLayer.setAttribute('aria-hidden', 'true');
  const markersLayer = el('div', 'map__markers');
  const controls = el('div', 'map__controls');
  const statusNode = el('p', 'map__status');
  statusNode.hidden = true;

  controls.append(
    controlButton('ic-plus', t('map.zoomIn'), () => zoomBy(1)),
    controlButton('ic-minus', t('map.zoomOut'), () => zoomBy(-1)),
    controlButton('ic-target', t('map.reset'), () => fitAll()),
  );

  const attributionNode = el('p', 'map__attribution');
  attributionNode.innerHTML = `<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${escapeHtml(attribution)}</a>`;

  element.append(tilesLayer, svgLayer, markersLayer, controls, attributionNode, statusNode);

  const tileCache = new Map();
  let popup = null;
  let frame = null;
  let tileErrors = 0;
  let tileAttempts = 0;

  /* ── Chizish ── */

  function size() {
    return { width: element.clientWidth, height: element.clientHeight };
  }

  function origin() {
    const { width, height } = size();
    const scale = scaleFor(state.zoom);
    return {
      scale,
      x: lngToX(state.lng, scale) - width / 2,
      y: latToY(state.lat, scale) - height / 2,
    };
  }

  function render() {
    const { width, height } = size();
    if (width === 0 || height === 0) return;
    const { scale, x: originX, y: originY } = origin();
    const tileCount = 2 ** state.zoom;

    const minTx = Math.floor(originX / TILE_SIZE);
    const maxTx = Math.floor((originX + width) / TILE_SIZE);
    const minTy = Math.max(0, Math.floor(originY / TILE_SIZE));
    const maxTy = Math.min(tileCount - 1, Math.floor((originY + height) / TILE_SIZE));

    const needed = new Set();
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      for (let ty = minTy; ty <= maxTy; ty += 1) {
        const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
        const key = `${state.zoom}/${wrappedX}/${ty}/${tx}`;
        needed.add(key);
        let img = tileCache.get(key);
        if (!img) {
          img = document.createElement('img');
          img.className = 'map__tile';
          img.alt = '';
          img.setAttribute('aria-hidden', 'true');
          img.loading = 'eager';
          img.decoding = 'async';
          img.draggable = false;
          tileAttempts += 1;
          img.addEventListener('error', () => {
            tileErrors += 1;
            img.style.visibility = 'hidden';
            checkTileHealth();
          });
          img.src = tileUrl
            .replace('{z}', String(state.zoom))
            .replace('{x}', String(wrappedX))
            .replace('{y}', String(ty))
            .replace('{s}', 'a');
          tilesLayer.appendChild(img);
          tileCache.set(key, img);
        }
        img.style.transform = `translate3d(${Math.round(tx * TILE_SIZE - originX)}px, ${Math.round(ty * TILE_SIZE - originY)}px, 0)`;
      }
    }

    for (const [key, img] of tileCache) {
      if (!needed.has(key)) {
        img.remove();
        tileCache.delete(key);
      }
    }

    renderBoundaries(scale, originX, originY, width, height);
    renderMarkers(scale, originX, originY);
    positionPopup(scale, originX, originY);
  }

  function checkTileHealth() {
    if (tileAttempts >= 4 && tileErrors / tileAttempts > 0.6) {
      setStatus(element, `${t('map.error')} — ${t('map.errorHint')}`, true);
    }
  }

  function renderBoundaries(scale, originX, originY, width, height) {
    svgLayer.innerHTML = '';
    svgLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    for (const boundary of state.boundaries) {
      const points = boundary.points
        .map(([lat, lng]) => `${(lngToX(lng, scale) - originX).toFixed(1)},${(latToY(lat, scale) - originY).toFixed(1)}`)
        .join(' ');
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('class', 'map__boundary');
      polygon.setAttribute('points', points);
      svgLayer.appendChild(polygon);
    }
  }

  function renderMarkers(scale, originX, originY) {
    for (const marker of state.markers) {
      if (!marker.node) {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'map__marker';
        if (marker.tone === 'success') node.classList.add('map__marker--auction');
        node.innerHTML = `<span>${escapeHtml(marker.label || '')}</span>`;
        node.setAttribute('aria-label', marker.title || '');
        node.addEventListener('click', (event) => {
          event.stopPropagation();
          openPopup(marker);
        });
        markersLayer.appendChild(node);
        marker.node = node;
      }
      const left = lngToX(marker.lng, scale) - originX;
      const top = latToY(marker.lat, scale) - originY;
      marker.node.style.transform = `translate(${left}px, ${top}px) translate(-50%, -100%) rotate(45deg)`;
      marker.node.classList.toggle('map__marker--active', marker.id === state.activeId);
    }
  }

  /* ── Ma'lumot oynasi ── */

  function openPopup(marker) {
    closePopup();
    state.activeId = marker.id;
    popup = el('div', 'map__popup');
    popup.innerHTML = `
      <button type="button" class="icon-btn icon-btn--xs map__popup-close" aria-label="${escapeHtml(t('common.close'))}">
        <svg class="icon" width="14" height="14" aria-hidden="true"><use href="#ic-close"/></svg>
      </button>
      <span class="map__popup-title">${escapeHtml(marker.title || '')}</span>
      ${marker.meta ? `<span class="map__popup-meta">${escapeHtml(marker.meta)}</span>` : ''}
      ${marker.url ? `<a class="link-arrow small" href="${escapeHtml(marker.url)}">${escapeHtml(t('common.details'))}
        <svg class="icon" width="14" height="14" aria-hidden="true"><use href="#ic-arrowRight"/></svg></a>` : ''}
    `;
    popup.dataset.markerId = marker.id;
    popup.querySelector('.map__popup-close').addEventListener('click', (event) => {
      event.stopPropagation();
      closePopup();
      draw();
    });
    element.appendChild(popup);
    draw();
  }

  function closePopup() {
    if (popup) popup.remove();
    popup = null;
    state.activeId = null;
  }

  function positionPopup(scale, originX, originY) {
    if (!popup) return;
    const marker = state.markers.find((item) => item.id === popup.dataset.markerId);
    if (!marker) return;
    popup.style.left = `${lngToX(marker.lng, scale) - originX}px`;
    popup.style.top = `${latToY(marker.lat, scale) - originY}px`;
  }

  /* ── Harakatlar ── */

  function draw() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      render();
    });
  }

  function panByPixels(dx, dy) {
    const { scale } = origin();
    const { width, height } = size();
    const cx = lngToX(state.lng, scale) + dx;
    const cy = latToY(state.lat, scale) + dy;
    state.lng = xToLng(cx, scale);
    state.lat = yToLat(Math.max(0, Math.min(scale, cy)), scale);
    draw();
  }

  function zoomBy(delta, anchor) {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom + delta));
    if (nextZoom === state.zoom) return;

    if (anchor) {
      // Masshtabni sichqoncha ko'rsatgichi ostidagi nuqta atrofida o'zgartirish
      const { scale, x: originX, y: originY } = origin();
      const anchorLng = xToLng(originX + anchor.x, scale);
      const anchorLat = yToLat(originY + anchor.y, scale);
      state.zoom = nextZoom;
      const next = origin();
      const targetX = lngToX(anchorLng, next.scale) - anchor.x;
      const targetY = latToY(anchorLat, next.scale) - anchor.y;
      const { width, height } = size();
      state.lng = xToLng(targetX + width / 2, next.scale);
      state.lat = yToLat(targetY + height / 2, next.scale);
    } else {
      state.zoom = nextZoom;
    }
    tileCache.forEach((img) => img.remove());
    tileCache.clear();
    draw();
  }

  function setView(lat, lng, zoom) {
    state.lat = Number(lat);
    state.lng = Number(lng);
    if (zoom != null) state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom)));
    tileCache.forEach((img) => img.remove());
    tileCache.clear();
    draw();
  }

  function fitBounds(points, padding = 48) {
    const list = points.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (list.length === 0) return;
    if (list.length === 1) {
      setView(list[0].lat, list[0].lng, Math.max(state.zoom, 13));
      return;
    }
    const { width, height } = size();
    if (width === 0 || height === 0) return;

    const minLat = Math.min(...list.map((p) => p.lat));
    const maxLat = Math.max(...list.map((p) => p.lat));
    const minLng = Math.min(...list.map((p) => p.lng));
    const maxLng = Math.max(...list.map((p) => p.lng));

    let zoom = MAX_ZOOM;
    for (; zoom > MIN_ZOOM; zoom -= 1) {
      const scale = scaleFor(zoom);
      const dx = Math.abs(lngToX(maxLng, scale) - lngToX(minLng, scale));
      const dy = Math.abs(latToY(minLat, scale) - latToY(maxLat, scale));
      if (dx <= width - padding * 2 && dy <= height - padding * 2) break;
    }
    setView((minLat + maxLat) / 2, (minLng + maxLng) / 2, zoom);
  }

  function fitAll() {
    const points = [
      ...state.markers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...state.boundaries.flatMap((b) => b.points.map(([lat, lng]) => ({ lat, lng }))),
    ];
    if (points.length > 0) fitBounds(points);
  }

  /* ── Hodisalar ── */

  let dragging = false;
  let lastPoint = null;
  let pointerId = null;

  element.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.map__marker, .map__controls, .map__popup, .map__attribution')) return;
    dragging = true;
    pointerId = event.pointerId;
    lastPoint = { x: event.clientX, y: event.clientY };
    element.setPointerCapture?.(event.pointerId);
    element.style.cursor = 'grabbing';
  });

  element.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastPoint.x;
    const dy = event.clientY - lastPoint.y;
    lastPoint = { x: event.clientX, y: event.clientY };
    panByPixels(-dx, -dy);
  });

  const endDrag = (event) => {
    if (event && pointerId != null && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    element.style.cursor = '';
  };
  element.addEventListener('pointerup', endDrag);
  element.addEventListener('pointercancel', endDrag);
  element.addEventListener('pointerleave', endDrag);

  element.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && Math.abs(event.deltaY) < 4) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 1 : -1, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    },
    { passive: false },
  );

  element.addEventListener('keydown', (event) => {
    const step = 80;
    const keys = {
      ArrowUp: () => panByPixels(0, -step),
      ArrowDown: () => panByPixels(0, step),
      ArrowLeft: () => panByPixels(-step, 0),
      ArrowRight: () => panByPixels(step, 0),
      '+': () => zoomBy(1),
      '=': () => zoomBy(1),
      '-': () => zoomBy(-1),
      _: () => zoomBy(-1),
      Escape: () => {
        closePopup();
        draw();
      },
    };
    const handler = keys[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  });

  element.addEventListener('click', (event) => {
    if (!event.target.closest('.map__marker, .map__popup')) {
      closePopup();
      draw();
    }
  });

  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
  observer?.observe(element);

  /* ── Ommaviy interfeys ── */

  const api = {
    setMarkers(markers) {
      for (const marker of state.markers) marker.node?.remove();
      state.markers = (markers || [])
        .filter((m) => m && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lng)))
        .map((m, i) => ({ ...m, id: m.id || `m${i}`, lat: Number(m.lat), lng: Number(m.lng), node: null }));
      closePopup();
      draw();
      return api;
    },
    setBoundaries(boundaries) {
      state.boundaries = (boundaries || []).filter((b) => Array.isArray(b?.points) && b.points.length >= 3);
      draw();
      return api;
    },
    setView,
    fitBounds,
    fitAll,
    focusMarker(id) {
      const marker = state.markers.find((m) => m.id === id);
      if (!marker) return api;
      setView(marker.lat, marker.lng, Math.max(state.zoom, 14));
      openPopup(marker);
      return api;
    },
    resize() {
      draw();
      return api;
    },
    get state() {
      return { zoom: state.zoom, lat: state.lat, lng: state.lng };
    },
    destroy() {
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      element.innerHTML = '';
    },
  };

  draw();
  return api;
}

/* ── Yordamchilar ─────────────────────────────────────────────────────── */

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function controlButton(iconId, label, onClick) {
  const button = el('button', 'map__control');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg class="icon" width="18" height="18" aria-hidden="true"><use href="#${iconId}"/></svg>`;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function setStatus(element, message, isError = false) {
  let node = element.querySelector('.map__status');
  if (!node) {
    node = el('p', 'map__status');
    element.appendChild(node);
  }
  node.hidden = false;
  node.textContent = message;
  element.classList.toggle('is-error', isError);
}
