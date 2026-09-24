#!/usr/bin/env node
/**
 * Hostingga yuklash uchun tayyor to'plam yasaydi.
 *
 * Ishlatilishi:
 *   node scripts/bundle.mjs              — to'liq to'plam (sayt + server + panel)
 *   node scripts/bundle.mjs --static     — faqat statik sayt (dist/ mazmuni)
 *   node scripts/bundle.mjs --no-archive — arxiv yasamasdan, faqat release/ katalogi
 *
 * Natija:
 *   release/direksiya-sayt-<sana>/        yuklash uchun fayllar
 *   release/direksiya-sayt-<sana>.tar.gz  arxiv (tar mavjud bo'lsa)
 *
 * MUHIM: to'plamga maxfiy fayllar (.env, bot tokeni, foydalanuvchi parollari,
 * murojaatlar) va shaxsiy ma'lumotlar QO'SHILMAYDI.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const STATIC_ONLY = flag('static');
const NO_ARCHIVE = flag('no-archive');

const B = '\u001b[1m';
const DIM = '\u001b[2m';
const GREEN = '\u001b[32m';
const YELLOW = '\u001b[33m';
const RED = '\u001b[31m';
const R = '\u001b[0m';

const say = (...parts) => console.log('  ', ...parts);
const blank = () => console.log('');

/** To'plamga KIRITILMAYDIGAN fayllar — maxfiy yoki shaxsiy ma'lumotlar. */
const NEVER_COPY = new Set([
  '.env',
  '.env.local',
  'session-secret',
  'admin-users.json',
  'telegram.json',
  'setup-key.txt',
]);

function shouldSkip(name) {
  return NEVER_COPY.has(name) || name === '.git' || name === 'node_modules' || name === 'release';
}

/** Katalogni rekursiv nusxalaydi, maxfiy fayllarni chetlab o'tadi. */
async function copyDir(from, to, { skipDirs = [] } = {}) {
  await fsp.mkdir(to, { recursive: true });
  for (const entry of await fsp.readdir(from, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue;
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name)) continue;
      await copyDir(source, target, { skipDirs });
    } else {
      await fsp.copyFile(source, target);
    }
  }
}

async function dirSize(dir) {
  let total = 0;
  let files = 0;
  const walk = async (current) => {
    for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        total += (await fsp.stat(full)).size;
        files += 1;
      }
    }
  };
  await walk(dir);
  return { bytes: total, files };
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  blank();
  console.log(`  ${B}Hostingga yuklash uchun to'plam yasalmoqda${R}`);
  console.log(`  ${DIM}${'─'.repeat(46)}${R}`);
  blank();

  /* ── 1. Saytni qurish ── */
  say('1. Sayt qurilmoqda…');
  const build = spawnSync(process.execPath, [path.join(ROOT, 'src', 'build.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  if (build.status !== 0) {
    say(`${RED}Qurish amalga oshmadi:${R}`);
    console.log(build.stdout || '', build.stderr || '');
    process.exit(1);
  }
  const buildWarnings = (build.stdout.match(/^\s+• /gm) || []).length;
  say(`   ${GREEN}✓${R} qurildi${buildWarnings ? ` (${buildWarnings} ta ogohlantirish bilan)` : ''}`);

  /* ── 2. Tekshirish ── */
  say('2. Natija tekshirilmoqda…');
  const check = spawnSync(process.execPath, [path.join(ROOT, 'src', 'check.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  if (check.status !== 0) {
    say(`${RED}Tekshirishda xatolik topildi — to'plam yasalmadi:${R}`);
    console.log(check.stdout || '', check.stderr || '');
    process.exit(1);
  }
  say(`   ${GREEN}✓${R} xatolik yo'q`);

  /* ── 3. Namunaviy ma'lumot haqiqiy kontentga o'tib ketmaganini tekshirish ──
     Skript har doim ishlab chiqarish rejimida quradi (--demo ishlatilmaydi),
     shu sababli content/demo/ katalogi to'plamga tushmaydi. Lekin kimdir
     namunaviy yozuvni content/lots.json ga nusxalab, nashr etib qo'ygan
     bo'lishi mumkin — shuni aniqlaymiz. */
  const demoLeaks = [];
  for (const file of ['lots.json', 'masterplans.json', 'news.json']) {
    try {
      const data = JSON.parse(await fsp.readFile(path.join(ROOT, 'content', file), 'utf8'));
      for (const item of data.items || []) {
        if (item?.demo === true && item?.published !== false) {
          demoLeaks.push(`${file} → ${item.slug || item.id}`);
        }
      }
    } catch (error) {
      /* fayl yo'q yoki bo'sh — muammo emas */
    }
  }
  if (demoLeaks.length > 0) {
    blank();
    say(`${RED}TO'XTATILDI: haqiqiy kontentda nashr etilgan namunaviy (demo) yozuvlar bor:${R}`);
    for (const leak of demoLeaks) say(`   ✗ ${leak}`);
    blank();
    say('Namunaviy ma\'lumotni haqiqiy sayt sifatida joylashtirish man etiladi.');
    say('Bu yozuvlarni o\'chiring yoki "published": false qilib qo\'ying.');
    blank();
    process.exit(1);
  }
  say(`   ${GREEN}✓${R} namunaviy (demo) ma'lumot yo'q — sayt ishlab chiqarish rejimida qurildi`);

  /* ── 4. Katalogni tayyorlash ── */
  const stamp = new Date().toISOString().slice(0, 10);
  const kind = STATIC_ONLY ? 'statik' : 'server';
  const name = `direksiya-sayt-${kind}-${stamp}`;
  const releaseRoot = path.join(ROOT, 'release');
  const target = path.join(releaseRoot, name);

  await fsp.rm(target, { recursive: true, force: true });
  await fsp.mkdir(target, { recursive: true });

  say(`3. Fayllar ko'chirilmoqda → ${DIM}release/${name}/${R}`);

  if (STATIC_ONLY) {
    // Faqat statik sayt: dist/ mazmuni to'plam ildiziga tushadi
    await copyDir(path.join(ROOT, 'dist'), target);
    await fsp.writeFile(path.join(target, '.nojekyll'), '');
  } else {
    await copyDir(path.join(ROOT, 'dist'), path.join(target, 'dist'));
    await copyDir(path.join(ROOT, 'src'), path.join(target, 'src'));
    await copyDir(path.join(ROOT, 'server'), path.join(target, 'server'), { skipDirs: ['data', 'backups'] });
    await copyDir(path.join(ROOT, 'admin'), path.join(target, 'admin'));
    await copyDir(path.join(ROOT, 'i18n'), path.join(target, 'i18n'));
    await copyDir(path.join(ROOT, 'assets'), path.join(target, 'assets'), { skipDirs: ['uploads'] });
    await copyDir(path.join(ROOT, 'content'), path.join(target, 'content'), { skipDirs: ['inbox', 'demo'] });
    await copyDir(path.join(ROOT, 'windows'), path.join(target, 'windows'));
    await copyDir(path.join(ROOT, 'docs'), path.join(target, 'docs'));

    for (const file of ['package.json', 'app.js', '.env.example', 'Dockerfile', 'docker-compose.yml', '.dockerignore', 'README.md']) {
      const source = path.join(ROOT, file);
      if (fs.existsSync(source)) await fsp.copyFile(source, path.join(target, file));
    }

    // Bo'sh, lekin kerakli kataloglar
    for (const dir of ['content/inbox', 'assets/uploads', 'server/data']) {
      await fsp.mkdir(path.join(target, dir), { recursive: true });
      await fsp.writeFile(path.join(target, dir, '.gitkeep'), '');
    }
  }

  /* ── 5. Maxfiy fayl tushmaganini tekshirish ── */
  const leaked = [];
  const scan = async (dir) => {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await scan(full);
      else if (NEVER_COPY.has(entry.name)) leaked.push(path.relative(target, full));
    }
  };
  await scan(target);
  if (leaked.length > 0) {
    say(`${RED}XAVFSIZLIK: to'plamga maxfiy fayllar tushdi:${R}`);
    for (const file of leaked) say(`   ✗ ${file}`);
    process.exit(1);
  }
  say(`   ${GREEN}✓${R} maxfiy fayllar yo'q (token, parollar, murojaatlar kirmadi)`);

  /* ── 6. Yo'riqnoma ── */
  await fsp.writeFile(path.join(target, 'YUKLASH-YORIQNOMASI.txt'), instructions(STATIC_ONLY, stamp), 'utf8');

  const size = await dirSize(target);
  say(`   ${GREEN}✓${R} ${size.files} ta fayl, ${mb(size.bytes)}`);

  /* ── 7. Arxiv ── */
  let archive = null;
  if (!NO_ARCHIVE) {
    say('4. Arxiv yasalmoqda…');
    const tar = spawnSync('tar', ['-czf', `${name}.tar.gz`, name], { cwd: releaseRoot, encoding: 'utf8' });
    if (tar.status === 0) {
      archive = path.join(releaseRoot, `${name}.tar.gz`);
      say(`   ${GREEN}✓${R} ${path.relative(ROOT, archive)} (${mb(fs.statSync(archive).size)})`);
    } else {
      say(`   ${YELLOW}tar topilmadi — arxiv yasalmadi.${R}`);
      say(`   ${DIM}Windows'da: release/ katalogini o'ng tugma → «Send to» → «Compressed folder»${R}`);
    }
  }

  /* ── Yakun ── */
  blank();
  console.log(`  ${B}To'plam tayyor${R}`);
  console.log(`  ${DIM}${'─'.repeat(46)}${R}`);
  blank();
  say(`Katalog:  ${DIM}release/${name}/${R}`);
  if (archive) say(`Arxiv:    ${DIM}release/${name}.tar.gz${R}`);
  blank();
  say(`Yo'riqnoma to'plam ichida: ${DIM}YUKLASH-YORIQNOMASI.txt${R}`);
  say(`Batafsil: ${DIM}docs/DEPLOY.md${R}`);
  blank();
  if (buildWarnings > 0) {
    say(`${YELLOW}Eslatma:${R} qurishda ${buildWarnings} ta ogohlantirish bor edi (logotip, kontent va h.k.).`);
    say(`${DIM}Ularni ko'rish uchun: node src/build.mjs${R}`);
    blank();
  }
}

function instructions(staticOnly, stamp) {
  const common = `
================================================================================
  NAMANGAN TURISTIK-REKREATSION HUDUDLARINI RIVOJLANTIRISH DIREKSIYASI
  Rasmiy veb-sayt — hostingga yuklash yo'riqnomasi
  To'plam sanasi: ${stamp}
================================================================================
`;

  if (staticOnly) {
    return `${common}
TO'PLAM TURI: FAQAT STATIK SAYT

Bu to'plamda tayyor HTML fayllar bor. Har qanday oddiy hostingga yuklanadi.

CHEKLOV — MUHIM:
  Statik hostingda MUROJAAT SHAKLI va BOSHQARUV PANELI ISHLAMAYDI.
  Ular Node.js serverini talab qiladi. Sayt murojaat shaklini "qabul qilish
  tizimi ulanmagan" holatida ochiq ko'rsatadi (soxta muvaffaqiyat xabari
  chiqarmaydi).

  Agar murojaatlar Telegram botga kelishi kerak bo'lsa, "server" turidagi
  to'plamdan foydalaning yoki docs/DEPLOY.md dagi "serverless" variantni
  ko'rib chiqing.

YUKLASH TARTIBI:

  1. Bu katalogdagi BARCHA fayllarni hostingning veb-katalogiga yuklang.
     Odatda u quyidagilardan biri:
        public_html/        (cPanel)
        www/
        htdocs/

     DIQQAT: katalogning o'zini emas, ICHIDAGI fayllarni yuklang.
     Ya'ni hostingda index.html fayli ildizda turishi kerak.

  2. Hosting sozlamalarida 404 sahifasi sifatida /404.html ni ko'rsating.

  3. HTTPS sertifikatini yoqing (odatda cPanel -> SSL/TLS -> Let's Encrypt).

  4. Saytni tekshiring:
        https://sayt-manzili.uz/            -> til tanlash, keyin yo'naltirish
        https://sayt-manzili.uz/uz-cyrl/    -> o'zbek (kirill)
        https://sayt-manzili.uz/uz/         -> o'zbek (lotin)
        https://sayt-manzili.uz/ru/         -> rus
        https://sayt-manzili.uz/en/         -> ingliz

TAVSIYA: yuklashdan oldin loyihada content/site.json faylida
  "seo": { "canonicalOrigin": "https://sayt-manzili.uz" }
qiymatini to'ldirib, saytni qaytadan qurish kerak. Aks holda sitemap.xml
va canonical havolalar to'liq manzilsiz qoladi.
`;
  }

  return `${common}
TO'PLAM TURI: TO'LIQ (sayt + server + boshqaruv paneli + Telegram)

Node.js 20.11 yoki undan yuqori versiyasi talab qilinadi.

TO'PLAMDA NIMA BOR:
  dist/       tayyor statik sayt
  src/        sayt generatori (kontent o'zgarganda qayta qurish uchun)
  server/     server (murojaatlar, boshqaruv paneli, Telegram)
  admin/      boshqaruv paneli
  content/    kontent (lotlar, master-rejalar, yangiliklar, sozlamalar)
  i18n/       to'rt tildagi interfeys matnlari
  assets/     CSS, JS, tasvirlar
  windows/    Windows uchun yordamchi .cmd fayllar
  docs/       hujjatlar

TO'PLAMDA YO'Q (ataylab):
  .env                        maxfiy sozlamalar — serverda yaratasiz
  server/data/telegram.json   bot tokeni
  server/data/admin-users.json  panel foydalanuvchilari
  content/inbox/              kelgan murojaatlar (shaxsiy ma'lumotlar)
  assets/uploads/             yuklangan fayllar (alohida ko'chiriladi)

  Agar bu sayt AVVAL ishlagan bo'lsa, eski serverdan yuqoridagi
  kataloglarni alohida ko'chirib oling — aks holda murojaatlar,
  fotosuratlar va foydalanuvchilar yo'qoladi!

YUKLASH TARTIBI (VPS / o'z serveringiz):

  1. Fayllarni serverga ko'chiring, masalan /var/www/direksiya ga.

  2. Sozlamalar faylini yarating:
        cp .env.example .env
        nano .env
     Kamida PORT va HOST ni to'ldiring. Telegram uchun token va chat_id.

  3. Boshqaruv paneli foydalanuvchisini yarating:
        node server/tools/hash-password.mjs <foydalanuvchi> '<parol>' admin

  4. Saytni qurib, tekshiring:
        node src/build.mjs
        node src/check.mjs

  5. Serverni doimiy ishlashi uchun systemd xizmatini sozlang.
     Namuna fayl: docs/DEPLOY.md

  6. Oldiga nginx teskari proksi va HTTPS sertifikati qo'ying.
     Namuna sozlama: docs/DEPLOY.md

  7. Tekshiring:
        curl https://sayt-manzili.uz/api/health

YUKLASH TARTIBI (cPanel "Setup Node.js App"):

  1. Fayllarni ilova katalogiga yuklang (public_html emas, alohida katalog).
  2. cPanel -> Setup Node.js App -> Create Application:
        Node.js version:   20 yoki undan yuqori
        Application root:  fayllarni yuklagan katalog
        Application URL:   sayt domeni
        Startup file:      app.js
  3. "Run NPM Install" BOSISH SHART EMAS — loyihada bog'liqliklar yo'q.
  4. Environment variables bo'limida Telegram sozlamalarini kiriting.
  5. Ilovani ishga tushirib, /api/health manzilini tekshiring.

YUKLASH TARTIBI (Docker):

        cp .env.example .env    # to'ldiring
        docker compose up -d
        docker compose logs -f

XAVFSIZLIK — MAJBURIY:
  * Boshqaruv paneli (/admin/) FAQAT HTTPS orqali ochiq bo'lsin.
  * /admin/ va /api/admin/ ni IP bo'yicha yoki VPN orqali cheklash tavsiya etiladi.
  * .env va server/data/ kataloglarini boshqalarga ochmang (chmod 600 / 700).
  * content/inbox/ da shaxsiy ma'lumotlar saqlanadi — zaxiralang va himoyalang.

ZAXIRALASH (kunlik tavsiya etiladi):
  content/            butun kontent
  content/inbox/      murojaatlar
  assets/uploads/     fotosuratlar va hujjatlar
  server/data/        foydalanuvchilar, tokenlar, zaxira nusxalar

  dist/ ni zaxiralash shart emas — har doim qayta qurilishi mumkin.

TOPSHIRISHDAN OLDIN TEKSHIRUV RO'YXATI: docs/DEPLOY.md oxirida.
`;
}

main().catch((error) => {
  blank();
  console.error(`  ${RED}Xatolik:${R} ${error.message}`);
  blank();
  process.exit(1);
});
