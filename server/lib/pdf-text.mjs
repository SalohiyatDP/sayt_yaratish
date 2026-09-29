/**
 * PDF fayldan matn ajratib olish — tashqi paketlarsiz.
 *
 * PDF ichida matn oqimlari (streams) FlateDecode (zlib) bilan siqilgan bo'ladi.
 * Biz ularni ochib, `(matn) Tj` va `[...] TJ` operatorlaridagi matnni yig'amiz.
 *
 * Cheklovlar (ochiq aytilgan):
 *   • FAQAT matnli (raqamli) PDF lar bilan ishlaydi. Skanerlangan (rasm) PDF da
 *     matn yo'q — OCR kerak bo'ladi, u bu yerda yo'q.
 *   • Murakkab shrift kodlashlari (CID, maxsus ToUnicode) to'liq qo'llab-
 *     quvvatlanmaydi — natija taxminiy bo'lishi mumkin.
 *
 * Maqsad — matnni AI ga uzatish uchun "yetarlicha yaxshi" ajratib olish.
 * AI matndagi kichik nuqsonlarga chidamli.
 */
import zlib from 'node:zlib';

/** PDF stringidagi \( \) \\ va sakkizlik \ddd kodlarini ochadi. */
function decodePdfString(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '\\') {
      const next = raw[i + 1];
      const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      if (map[next] !== undefined) {
        out += map[next];
        i += 1;
      } else if (/[0-7]/.test(next)) {
        // Sakkizlik kod: \ddd
        const oct = raw.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0] || '';
        out += String.fromCharCode(parseInt(oct, 8));
        i += oct.length;
      } else {
        // \ oldidagi qator uzilishi — e'tiborsiz
        i += 1;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Bitta kontent oqimidan matnni yig'adi.
 * `(...) Tj`, `(...) '`, `(...) "` va `[(a) -10 (b)] TJ` shakllarini qo'llaydi.
 */
function extractFromContent(content) {
  const parts = [];

  // [ ... ] TJ — massiv ichidagi qavsli qismlar
  const tjArray = /\[((?:[^\][]|\\.)*)\]\s*TJ/g;
  let m;
  while ((m = tjArray.exec(content)) !== null) {
    const inner = m[1];
    let s = '';
    const str = /\(((?:[^()\\]|\\.)*)\)/g;
    let sm;
    while ((sm = str.exec(inner)) !== null) s += decodePdfString(sm[1]);
    if (s.trim()) parts.push(s);
  }

  // (text) Tj  yoki  (text) '  yoki  (text) "
  const tjSingle = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g;
  while ((m = tjSingle.exec(content)) !== null) {
    const s = decodePdfString(m[1]);
    if (s.trim()) parts.push(s);
  }

  // Matn joylashuvi operatorlari (Td, TD, T*) — qator uzilishi sifatida
  return parts.join(' ');
}

/**
 * PDF baytlaridan matnni ajratadi.
 * @param {Buffer} buffer PDF fayl
 * @returns {{ text: string, pages: number }}
 */
export function extractPdfText(buffer) {
  if (!buffer || buffer.length < 5 || buffer.toString('latin1', 0, 5) !== '%PDF-') {
    throw new Error('Bu PDF fayl emas (imzo topilmadi).');
  }

  const chunks = [];
  // `stream ... endstream` bloklarini topamiz
  const marker = Buffer.from('stream');
  let searchFrom = 0;

  while (true) {
    const start = buffer.indexOf(marker, searchFrom);
    if (start === -1) break;
    // `stream` dan keyin CRLF yoki LF keladi
    let dataStart = start + marker.length;
    if (buffer[dataStart] === 0x0d) dataStart += 1;
    if (buffer[dataStart] === 0x0a) dataStart += 1;

    const end = buffer.indexOf(Buffer.from('endstream'), dataStart);
    if (end === -1) break;
    searchFrom = end + 9;

    let raw = buffer.subarray(dataStart, end);
    // Oxiridagi qator uzilishlarni kesamiz
    while (raw.length && (raw[raw.length - 1] === 0x0a || raw[raw.length - 1] === 0x0d)) {
      raw = raw.subarray(0, raw.length - 1);
    }

    let content = null;
    // Ko'p oqimlar FlateDecode (zlib) bilan siqilgan — ochib ko'ramiz
    try {
      content = zlib.inflateSync(raw).toString('latin1');
    } catch (error) {
      // Siqilmagan bo'lishi mumkin
      const asText = raw.toString('latin1');
      if (/\bTj\b|\bTJ\b/.test(asText)) content = asText;
    }
    if (!content) continue;

    const text = extractFromContent(content);
    if (text.trim()) chunks.push(text);
  }

  const pages = (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length || 1;
  // Ko'p bo'shliqlarni bittaga keltiramiz
  const text = chunks.join('\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return { text, pages };
}
