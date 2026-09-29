/**
 * `.env` faylini o'qish — hech qanday paketga bog'liq emas.
 *
 * Node.js 20.6+ da `node --env-file=.env` imkoniyati bor, lekin bu modul
 * server odatiy tarzda ishga tushirilganda ham ishlashi uchun yozilgan.
 *
 * Qoidalar:
 *   • `KEY=value` ko'rinishidagi qatorlar o'qiladi
 *   • `#` bilan boshlangan qatorlar va bo'sh qatorlar o'tkazib yuboriladi
 *   • qiymatni qo'shtirnoq yoki apostrof bilan o'rash mumkin
 *   • qo'shtirnoq ichida `\n` yangi qatorga aylanadi
 *   • `export KEY=value` ko'rinishi ham qabul qilinadi
 *   • MUHIM: muhitda (process.env) allaqachon mavjud qiymatlar ustidan yozilmaydi
 */
import { readFileSync, existsSync } from 'node:fs';

/** Matnni kalit-qiymat juftliklariga ajratadi. */
export function parseEnv(source) {
  const result = {};
  for (const rawLine of String(source).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf('=');
    if (separator === -1) continue;

    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = withoutExport.slice(separator + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2)) {
      value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      // Qo'shtirnoqsiz qiymatda satr oxiridagi izohni olib tashlash
      const comment = value.indexOf(' #');
      if (comment !== -1) value = value.slice(0, comment).trim();
    }

    result[key] = value;
  }
  return result;
}

/**
 * `.env` faylini o'qib process.env ga qo'shadi.
 * @returns {{ loaded: boolean, file: string, keys: string[] }}
 */
export function loadEnvFile(file) {
  if (!existsSync(file)) return { loaded: false, file, keys: [] };
  let values;
  try {
    values = parseEnv(readFileSync(file, 'utf8'));
  } catch (error) {
    return { loaded: false, file, keys: [], error: error.message };
  }
  const applied = [];
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied.push(key);
    }
  }
  return { loaded: true, file, keys: applied };
}
