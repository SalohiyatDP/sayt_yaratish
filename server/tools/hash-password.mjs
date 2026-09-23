#!/usr/bin/env node
/**
 * Boshqaruv paneli foydalanuvchisini yaratish yoki parolini yangilash.
 *
 * Ishlatilishi:
 *   npm run admin:password -- <foydalanuvchi> <parol> [rol]
 *   node server/tools/hash-password.mjs admin 'Juda-Kuchli-Parol-2026' admin
 *
 * Rollar:
 *   admin  — hamma narsa, murojaatlarni o'chirish ham mumkin
 *   editor — kontentni tahrirlash va saytni qayta qurish (odatiy)
 *   viewer — faqat ko'rish
 *
 * Parol server/data/admin-users.json faylida scrypt algoritmi bilan
 * xeshlangan holda saqlanadi. Bu fayl .gitignore ro'yxatida.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'admin-users.json');

const SCRYPT = { N: 16384, r: 8, p: 3, keylen: 64 };

const [username, password, role = 'editor'] = process.argv.slice(2);

if (!username || !password) {
  console.error(`
  Foydalanuvchi yaratish uchun nom va parol ko'rsatilishi kerak.

    npm run admin:password -- <foydalanuvchi> <parol> [admin|editor|viewer]

  Masalan:
    npm run admin:password -- direksiya 'Kuchli-Parol-2026!' admin
`);
  process.exit(1);
}

if (password.length < 12) {
  console.error('  Xatolik: parol kamida 12 belgidan iborat bo\'lishi kerak.');
  process.exit(1);
}
if (!['admin', 'editor', 'viewer'].includes(role)) {
  console.error('  Xatolik: rol admin, editor yoki viewer bo\'lishi kerak.');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

let store = { users: [] };
if (fs.existsSync(USERS_FILE)) {
  try {
    store = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!Array.isArray(store.users)) store.users = [];
  } catch (error) {
    console.error('  admin-users.json buzilgan, yangi fayl yaratiladi.');
    store = { users: [] };
  }
}

const salt = crypto.randomBytes(16);
const hash = crypto
  .scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  .toString('base64');

const entry = {
  username: username.toLowerCase(),
  name: username,
  role,
  salt: salt.toString('base64'),
  hash,
  N: SCRYPT.N,
  p: SCRYPT.p,
  updatedAt: new Date().toISOString(),
};

const index = store.users.findIndex((user) => String(user.username).toLowerCase() === entry.username);
if (index === -1) store.users.push(entry);
else store.users[index] = { ...store.users[index], ...entry };

fs.writeFileSync(USERS_FILE, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });

console.log(`
  Foydalanuvchi ${index === -1 ? 'yaratildi' : 'yangilandi'}: ${entry.username} (rol: ${role})
  Fayl: ${USERS_FILE}

  Diqqat:
   • Bu fayl maxfiy — repozitoriyaga tushmaydi (.gitignore).
   • Parolni xat yoki xabar orqali yubormang.
   • Boshqaruv panelini faqat HTTPS orqali ochiq qiling.
`);
