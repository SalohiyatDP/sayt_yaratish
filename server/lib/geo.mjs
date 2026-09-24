/**
 * KMZ / KML / GeoJSON fayllardan koordinata va chegara chiqarish.
 *
 * Nima uchun o'zimiz yozdik: loyihada tashqi paketlar yo'q (uzoq muddatli
 * barqarorlik uchun). KMZ — ichida `doc.kml` turadigan oddiy ZIP arxiv,
 * uni Node.js ning o'z `zlib` moduli bilan ochish mumkin.
 *
 * Qo'llanadigan formatlar:
 *   .kmz      — ZIP ichidagi .kml fayl
 *   .kml      — XML
 *   .geojson  — JSON (Point, Polygon, LineString, Feature, FeatureCollection)
 */
import zlib from 'node:zlib';

const MAX_POINTS = 2000;

/* ─────────────────────────── ZIP (KMZ) ─────────────────────────── */

/**
 * ZIP arxivdagi fayllar ro'yxatini qaytaradi.
 * Markaziy katalog (central directory) bo'yicha o'qiladi — bu ZIP ni
 * to'g'ri o'qishning standart usuli.
 */
function readZipEntries(buffer) {
  // End of Central Directory yozuvini oxiridan qidiramiz
  const SIGNATURE = 0x06054b50;
  let eocd = -1;
  const from = Math.max(0, buffer.length - 66_000);
  for (let i = buffer.length - 22; i >= from; i -= 1) {
    if (buffer.readUInt32LE(i) === SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('ZIP arxiv tuzilmasi topilmadi (fayl buzilgan bo\'lishi mumkin).');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];

  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** ZIP dagi bitta faylni ochadi. */
function readZipFile(buffer, entry) {
  if (buffer.readUInt32LE(entry.localOffset) !== 0x04034b50) {
    throw new Error('ZIP ichidagi fayl sarlavhasi buzilgan.');
  }
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return data; // siqilmagan
  if (entry.method === 8) return zlib.inflateRawSync(data); // deflate
  throw new Error(`ZIP siqish usuli qo'llanmaydi (${entry.method}). Faylni qaytadan saqlab ko'ring.`);
}

/** KMZ (ZIP) ichidan KML matnini oladi. */
function kmlFromKmz(buffer) {
  const entries = readZipEntries(buffer);
  const kml = entries.find((entry) => /\.kml$/i.test(entry.name) && !entry.name.startsWith('__MACOSX'));
  if (!kml) {
    throw new Error(`KMZ ichida .kml fayl yo'q. Topilgan fayllar: ${entries.map((e) => e.name).join(', ') || 'yo\'q'}`);
  }
  return readZipFile(buffer, kml).toString('utf8');
}

/* ─────────────────────────── KML ─────────────────────────── */

/**
 * KML `coordinates` matnini nuqtalarga ajratadi.
 * KML tartibi: `lon,lat[,alt]` — bizning tartib `[lat, lng]`.
 */
function parseCoordinateList(text) {
  const points = [];
  for (const chunk of String(text).trim().split(/\s+/)) {
    if (chunk === '') continue;
    const [lon, lat] = chunk.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    points.push([round(lat), round(lon)]);
    if (points.length >= MAX_POINTS) break;
  }
  return points;
}

const round = (value) => Math.round(value * 1e6) / 1e6;

/** XML tegining ichidagi matnni oladi (birinchi topilgani). */
const innerText = (xml, tag) => {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return match ? match[1] : null;
};

function parseKml(xml) {
  const result = { name: null, coordinates: null, boundary: null, notes: [] };

  const placemarkName = innerText(xml, 'Placemark')
    ? innerText(innerText(xml, 'Placemark'), 'name')
    : innerText(xml, 'name');
  if (placemarkName) result.name = stripCdata(placemarkName).trim().slice(0, 200) || null;

  // 1. Chegara: Polygon → outerBoundaryIs → LinearRing
  const polygon = innerText(xml, 'Polygon');
  if (polygon) {
    const outer = innerText(polygon, 'outerBoundaryIs') || polygon;
    const ring = innerText(outer, 'LinearRing') || outer;
    const coords = innerText(ring, 'coordinates');
    if (coords) {
      const points = parseCoordinateList(coords);
      if (points.length >= 3) result.boundary = closeRing(points);
    }
  }

  // 2. Chegara bo'lmasa — LineString ham chegara sifatida ishlatiladi
  if (!result.boundary) {
    const line = innerText(xml, 'LineString');
    const coords = line ? innerText(line, 'coordinates') : null;
    if (coords) {
      const points = parseCoordinateList(coords);
      if (points.length >= 3) {
        result.boundary = closeRing(points);
        result.notes.push('Chegara LineString (chiziq) elementidan olindi.');
      }
    }
  }

  // 3. Nuqta
  const point = innerText(xml, 'Point');
  const pointCoords = point ? innerText(point, 'coordinates') : null;
  if (pointCoords) {
    const points = parseCoordinateList(pointCoords);
    if (points.length > 0) result.coordinates = { lat: points[0][0], lng: points[0][1] };
  }

  // 4. Nuqta ko'rsatilmagan bo'lsa, chegaraning markazini hisoblaymiz
  if (!result.coordinates && result.boundary) {
    result.coordinates = centroid(result.boundary);
    result.notes.push('Markaziy nuqta chegara bo\'yicha hisoblandi.');
  }

  const placemarks = (xml.match(/<Placemark[\s>]/gi) || []).length;
  if (placemarks > 1) {
    result.notes.push(`Faylda ${placemarks} ta obyekt bor — birinchisi olindi.`);
  }

  return result;
}

const stripCdata = (value) => String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

/** Ko'pburchak yopiq bo'lishi kerak: oxirgi nuqta birinchisiga teng emas. */
function closeRing(points) {
  const out = [...points];
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 3 && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}

/** Ko'pburchakning o'rtasi. */
export function centroid(points) {
  let lat = 0;
  let lng = 0;
  for (const [a, b] of points) {
    lat += a;
    lng += b;
  }
  return { lat: round(lat / points.length), lng: round(lng / points.length) };
}

/* ─────────────────────────── GeoJSON ─────────────────────────── */

function parseGeoJson(text) {
  const data = JSON.parse(text);
  const result = { name: null, coordinates: null, boundary: null, notes: [] };

  const features = data.type === 'FeatureCollection'
    ? data.features || []
    : data.type === 'Feature'
      ? [data]
      : [{ geometry: data, properties: {} }];

  if (features.length > 1) result.notes.push(`Faylda ${features.length} ta obyekt bor — birinchisi olindi.`);
  const feature = features[0];
  if (!feature?.geometry) throw new Error('GeoJSON ichida geometriya topilmadi.');

  const name = feature.properties?.name || feature.properties?.Name;
  if (typeof name === 'string') result.name = name.trim().slice(0, 200) || null;

  const { type, coordinates } = feature.geometry;
  // GeoJSON tartibi ham [lon, lat]
  const toPoints = (list) =>
    list
      .map(([lon, lat]) => (Number.isFinite(lat) && Number.isFinite(lon) ? [round(lat), round(lon)] : null))
      .filter(Boolean)
      .slice(0, MAX_POINTS);

  if (type === 'Point') {
    const [lon, lat] = coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lon)) result.coordinates = { lat: round(lat), lng: round(lon) };
  } else if (type === 'Polygon') {
    const points = toPoints(coordinates[0] || []);
    if (points.length >= 3) result.boundary = closeRing(points);
  } else if (type === 'MultiPolygon') {
    const points = toPoints(coordinates[0]?.[0] || []);
    if (points.length >= 3) result.boundary = closeRing(points);
    result.notes.push('MultiPolygon: birinchi ko\'pburchak olindi.');
  } else if (type === 'LineString') {
    const points = toPoints(coordinates);
    if (points.length >= 3) {
      result.boundary = closeRing(points);
      result.notes.push('Chegara LineString (chiziq) elementidan olindi.');
    }
  } else {
    throw new Error(`GeoJSON turi qo'llanmaydi: ${type}`);
  }

  if (!result.coordinates && result.boundary) {
    result.coordinates = centroid(result.boundary);
    result.notes.push('Markaziy nuqta chegara bo\'yicha hisoblandi.');
  }
  return result;
}

/* ─────────────────────────── Umumiy kirish nuqtasi ─────────────────────────── */

/**
 * Fayl mazmunidan koordinata va chegarani chiqaradi.
 * @param {Buffer} buffer fayl mazmuni
 * @param {string} fileName fayl nomi (turini aniqlash uchun)
 * @returns {{ name: string|null, coordinates: object|null, boundary: array|null, notes: string[], format: string }}
 */
export function parseGeoFile(buffer, fileName = '') {
  const ext = String(fileName).toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  // KMZ ni kengaytmasiga emas, ZIP imzosiga qarab ham aniqlaymiz
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (ext === '.kmz' || isZip) {
    const result = parseKml(kmlFromKmz(buffer));
    return { ...result, format: 'kmz' };
  }

  const text = buffer.toString('utf8');
  if (ext === '.geojson' || ext === '.json' || /^\s*[{[]/.test(text)) {
    return { ...parseGeoJson(text), format: 'geojson' };
  }
  if (/<kml[\s>]/i.test(text) || ext === '.kml') {
    return { ...parseKml(text), format: 'kml' };
  }

  throw new Error('Fayl turi aniqlanmadi. KMZ, KML yoki GeoJSON fayl yuklang.');
}
