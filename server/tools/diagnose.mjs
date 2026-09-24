#!/usr/bin/env node
/**
 * Hostingdagi muammolarni aniqlash vositasi.
 *
 * «Nega server ishga tushmayapti?» degan savolga bitta buyruq bilan javob
 * beradi: Node versiyasi, port, sayt qurilgani, yozish huquqlari, foydalanuvchilar,
 * Telegram va murojaat shakli holati.
 *
 * Ishlatilishi:
 *     node server/tools/diagnose.mjs
 *
 * Muammo topilsa 1 kodi bilan tugaydi.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from '../lib/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ENV_RESULT = loadEnvFile(path.join(ROOT, '.env'));

const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const DIM = '\u001b[2m';
const B = '\u001b[1m';
const R = '\u001b[0m';

let problems = 0;
let warnings = 0;

const ok = (label, detail = '') => console.log(`   ${GREEN}✓${R} ${label}${detail ? ` ${DIM}— ${detail}${R}` : ''}`);
const bad = (label, detail = '') => {
  problems += 1;
  console.log(`   ${RED}✗${R} ${B}${label}${R}${detail ? `\n     ${detail}` : ''}`);
};
const warn = (label, detail = '') => {
  warnings += 1;
  console.log(`   ${YELLOW}!${R} ${label}${detail ? `\n     ${DIM}${detail}${R}` : ''}`);
};
const section = (title) => {
  console.log('');
  console.log(`  ${B}${title}${R}`);
};

/* ─────────────────────────── Portni aniqlash ─────────────────────────── */

function resolveListenTarget() {
  const CANDIDATES = ['PORT', 'SOCKET', 'NODE_PORT', 'APP_PORT', 'SERVER_PORT', 'HTTP_PORT'];
  for (const name of CANDIDATES) {
    const raw = process.env[name];
    if (raw == null || String(raw).trim() === '') continue;
    const value = String(raw).trim();
    if (value.startsWith('/') || value.startsWith('./') || value.endsWith('.sock')) {
      return { kind: 'socket', socketPath: value, source: name };
    }
    const port = Number(value);
    if (Number.isInteger(port) && port > 0 && port < 65536) {
      return { kind: 'port', port, host: process.env.HOST || '0.0.0.0', source: name };
    }
  }
  return { kind: 'port', port: 8080, host: process.env.HOST || '0.0.0.0', source: null };
}

/** Portni band qilib ko'radi — bo'sh bo'lsa true. */
function checkPortFree(port, host) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', (error) => resolve({ free: false, code: error.code }));
    tester.once('listening', () => tester.close(() => resolve({ free: true })));
    tester.listen(port, host);
  });
}

/**
 * nginx sozlamalaridan veb-server kutayotgan manzilni topadi.
 *
 * Bu eng ko'p uchraydigan xatolikni aniqlaydi: ilova bir soketda tinglaydi,
 * nginx esa boshqasini qidiradi — natijada «502 Bad Gateway» chiqadi.
 *
 * nginx sozlamalari odatda root uchun ochiq bo'ladi; o'qish imkoni bo'lmasa
 * funksiya jimgina null qaytaradi.
 */
function findNginxUpstream() {
  const roots = ['/etc/nginx', '/usr/local/nginx/conf', '/usr/local/etc/nginx'];
  const found = [];
  let scanned = 0;
  let denied = false;

  const walk = (dir, depth = 0) => {
    if (depth > 4 || scanned > 800) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') denied = true;
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (/\.(conf|vhost)$/.test(entry.name) || !entry.name.includes('.')) {
        scanned += 1;
        let text;
        try {
          text = fs.readFileSync(full, 'utf8');
        } catch (error) {
          if (error.code === 'EACCES' || error.code === 'EPERM') denied = true;
          continue;
        }
        for (const match of text.matchAll(/proxy_pass\s+https?:\/\/(unix:([^;:\s]+)|127\.0\.0\.1:(\d+)|localhost:(\d+))/g)) {
          found.push({
            file: full,
            socketPath: match[2] || null,
            port: match[3] || match[4] || null,
          });
        }
      }
    }
  };

  for (const root of roots) {
    if (fs.existsSync(root)) walk(root);
  }

  return { found, denied };
}

/** Unix soketini bog'lab ko'radi — muvaffaqiyatli bo'lsa darhol bo'shatadi. */
function checkSocketFree(socketPath) {
  return new Promise((resolve) => {
    // Mavjud soketga ulanib ko'ramiz: ulansa — eski jarayon tirik
    const probe = net.connect(socketPath);
    probe.once('connect', () => {
      probe.destroy();
      resolve({ free: false, code: 'EADDRINUSE', message: 'Soketda tirik jarayon javob bermoqda.' });
    });
    probe.once('error', (connectError) => {
      probe.destroy();
      // Ulanish bo'lmadi — endi o'zimiz bog'lab ko'ramiz
      const testPath = `${socketPath}.tekshiruv-${process.pid}`;
      const tester = net.createServer();
      tester.once('error', (error) => resolve({ free: false, code: error.code, message: error.message }));
      tester.once('listening', () =>
        tester.close(() => {
          try {
            if (fs.existsSync(testPath)) fs.unlinkSync(testPath);
          } catch (error) {
            /* e'tiborsiz */
          }
          resolve({ free: true, staleSocket: connectError.code === 'ECONNREFUSED' });
        }),
      );
      tester.listen(testPath);
    });
  });
}

/** Portni kim band qilganini aniqlashga urinadi (tizim buyruqlari mavjud bo'lsa). */
function whoUsesPort(port) {
  for (const [cmd, args] of [
    ['ss', ['-ltnp']],
    ['netstat', ['-ltnp']],
  ]) {
    try {
      const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const line = out.split('\n').find((l) => new RegExp(`[:.]${port}\\s`).test(l));
      if (line) return line.trim().replace(/\s+/g, ' ');
    } catch (error) {
      /* buyruq yo'q — keyingisini sinaymiz */
    }
  }
  return null;
}

/** Loyihaning boshqa ishlayotgan jarayonlarini topadi. */
function findOwnProcesses() {
  try {
    const out = execFileSync('ps', ['-eo', 'pid,etime,args'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out
      .split('\n')
      .filter((line) => /server\/server\.mjs|server\\server\.mjs|app\.js/.test(line))
      .filter((line) => !line.includes('diagnose.mjs'))
      .map((line) => line.trim().replace(/\s+/g, ' '));
  } catch (error) {
    return [];
  }
}

async function canWrite(dir) {
  const target = path.join(ROOT, dir);
  try {
    await fsp.mkdir(target, { recursive: true });
    const probe = path.join(target, `.yozish-sinovi-${process.pid}`);
    await fsp.writeFile(probe, 'x');
    await fsp.unlink(probe);
    return true;
  } catch (error) {
    return false;
  }
}

/* ─────────────────────────── Tekshiruvlar ─────────────────────────── */

async function main() {
  console.log('');
  console.log(`  ${B}Direksiya sayti — hosting tashxisi${R}`);
  console.log(`  ${DIM}${'─'.repeat(58)}${R}`);
  console.log(`  ${DIM}Katalog: ${ROOT}${R}`);
  console.log(`  ${DIM}Vaqt:    ${new Date().toISOString()}${R}`);

  /* ── 1. Muhit ── */
  section('1. Muhit');

  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > 20 || (major === 20 && minor >= 11)) {
    ok(`Node.js ${process.version}`);
  } else {
    bad(`Node.js ${process.version} — juda eski`, 'Kamida 20.11 versiyasi kerak. Hosting panelida Node versiyasini o\'zgartiring.');
  }

  ok(`Tizim: ${os.type()} ${os.release()} (${os.arch()})`);
  const freeMb = Math.round(os.freemem() / 1024 / 1024);
  if (freeMb < 96) warn(`Bo'sh xotira kam: ${freeMb} MB`, 'Qurish sekin ketishi mumkin.');
  else ok(`Bo'sh xotira: ${freeMb} MB`);

  if (ENV_RESULT.loaded) ok(`.env fayli yuklandi`, `${ENV_RESULT.keys.length} ta o'zgaruvchi`);
  else warn('.env fayli topilmadi', 'Majburiy emas — sozlamalar panel orqali berilgan bo\'lishi mumkin.');

  /* ── 2. Tinglash manzili ── */
  section('2. Port va tinglash manzili');

  const listen = resolveListenTarget();

  if (listen.source) {
    ok(`Port manbasi: ${listen.source}`, listen.kind === 'socket' ? listen.socketPath : String(listen.port));
  } else {
    warn(
      `Hech qanday port o'zgaruvchisi berilmagan — odatiy ${listen.port} ishlatiladi`,
      'Hosting paneli portni bermayapti. Panelda PORT o\'zgaruvchisini qo\'shib,\n     hosting ajratgan portni yozish kerak (ISPmanager\'da odatda 10000+).',
    );
  }

  if (listen.kind === 'socket') {
    ok('Rejim: Unix soketi', listen.socketPath);

    const dir = path.dirname(listen.socketPath);
    const dirExists = fs.existsSync(dir);

    if (dirExists) {
      ok(`Soket katalogi mavjud: ${dir}`);
    } else {
      warn(
        `Soket katalogi hali yo'q: ${dir}`,
        'Server ishga tushganda uni o\'zi yaratadi. Agar yaratolmasa, xatolik\n     xabarida aniq aytiladi — katalogni qo\'lda yaratish kerak bo\'ladi.',
      );
    }

    if (fs.existsSync(listen.socketPath)) {
      warn(
        `Eski soket fayli mavjud: ${listen.socketPath}`,
        'Server ishga tushganda uni o\'zi tozalaydi. Agar eski jarayon hali\n     ishlayotgan bo\'lsa, avval uni to\'xtatish kerak: pkill -f "server/server.mjs"',
      );
    }

    // Soketni haqiqatan bog'lab ko'ramiz — faqat katalog mavjud bo'lsa
    if (dirExists) {
      const bindResult = await checkSocketFree(listen.socketPath);
      if (bindResult.free) {
        ok('Soketni bog\'lash mumkin — server ishga tushadi');
      } else {
        bad(
          `Soketni bog'lash imkoni bo'lmadi (${bindResult.code})`,
          bindResult.code === 'EADDRINUSE'
            ? `Eski jarayon ishlayapti yoki soket fayli qolgan.\n     To'xtatish: pkill -f "server/server.mjs"\n     So'ngra: rm -f ${listen.socketPath}`
            : bindResult.code === 'EACCES'
              ? `Katalogga yozish huquqi yo'q: ${dir}\n     Katalog egasi sayt foydalanuvchisi bo'lishi kerak.`
              : bindResult.message || '',
        );
      }
    }

    const mode = String(process.env.SOCKET_MODE || '660');
    ok(`Soket huquqi: ${mode}`, process.env.SOCKET_MODE ? 'SOCKET_MODE orqali' : 'odatiy qiymat');
    console.log(`     ${DIM}nginx «502 Permission denied» bersa: SOCKET_MODE=666 qilib ko'ring.${R}`);
  } else {
    const result = await checkPortFree(listen.port, listen.host);
    if (result.free) {
      ok(`${listen.host}:${listen.port} — bo'sh, tinglash mumkin`);
    } else if (result.code === 'EADDRINUSE') {
      const who = whoUsesPort(listen.port);
      bad(
        `${listen.host}:${listen.port} — BAND. Server ishga tushmaydi.`,
        (who ? `Portni band qilgan: ${who}\n     ` : '') +
          `Aniqlash:  ss -ltnp | grep :${listen.port}\n` +
          `     To'xtatish: pkill -f "server/server.mjs"\n` +
          `     Yoki panelda boshqa PORT ko'rsating.`,
      );
    } else if (result.code === 'EACCES') {
      bad(`${listen.host}:${listen.port} — ruxsat yo'q`, '1024 dan katta port ishlatish kerak.');
    } else {
      bad(`${listen.host}:${listen.port} — tekshirilmadi (${result.code})`);
    }
  }

  const running = findOwnProcesses();
  if (running.length > 0) {
    warn(`Loyihaning ${running.length} ta jarayoni allaqachon ishlayapti`, running.join('\n     '));
    console.log(`     ${DIM}Agar bu eski jarayon bo'lsa: pkill -f "server/server.mjs"${R}`);
  } else {
    ok('Loyihaning boshqa ishlayotgan jarayoni topilmadi');
  }

  /* ── 2b. nginx bilan solishtirish ── */
  section('2b. Veb-server (nginx) kutayotgan manzil');

  const nginx = findNginxUpstream();

  if (nginx.found.length === 0) {
    if (nginx.denied) {
      warn(
        'nginx sozlamalarini o\'qish imkoni bo\'lmadi (ruxsat yo\'q)',
        'Bu normal holat — sozlamalar odatda faqat administrator uchun ochiq.\n     Qo\'lda tekshirish: grep -r "proxy_pass" /etc/nginx/ | grep -E "unix:|127.0.0.1"',
      );
    } else {
      warn('nginx sozlamalarida proxy_pass topilmadi', 'Sayt boshqa veb-server orqali ishlayotgan bo\'lishi mumkin.');
    }
  } else {
    // Bizga tegishli bo'lishi ehtimoli yuqori yozuvlarni ajratamiz
    const ours = nginx.found.filter(
      (item) =>
        (item.socketPath && item.socketPath.includes(path.basename(path.dirname(listen.socketPath || '')))) ||
        (item.socketPath && listen.socketPath && path.dirname(item.socketPath) === path.dirname(listen.socketPath)) ||
        (item.port && listen.port && String(item.port) === String(listen.port)),
    );
    const candidates = ours.length > 0 ? ours : nginx.found.slice(0, 6);

    for (const item of candidates) {
      const target = item.socketPath ? `unix:${item.socketPath}` : `127.0.0.1:${item.port}`;
      console.log(`   ${DIM}${target}${R}  ${DIM}← ${item.file}${R}`);
    }

    // Mos kelishini tekshiramiz
    const expectedSockets = nginx.found.filter((i) => i.socketPath).map((i) => i.socketPath);
    const expectedPorts = nginx.found.filter((i) => i.port).map((i) => String(i.port));

    if (listen.kind === 'socket') {
      if (expectedSockets.includes(listen.socketPath)) {
        ok('Ilova va nginx bir xil soketni ishlatadi');
      } else if (expectedSockets.length > 0) {
        // Xuddi shu katalogdagi boshqa soket — eng ehtimolli xato
        const sameDir = expectedSockets.filter((s) => path.dirname(s) === path.dirname(listen.socketPath));
        const hint = sameDir.length > 0 ? sameDir : expectedSockets;
        bad(
          'ILOVA VA nginx BOSHQA-BOSHQA SOKETNI ISHLATADI — «502 Bad Gateway» sababi shu',
          `Ilova tinglaydi:  ${listen.socketPath}\n` +
            `     nginx qidiradi:   ${hint.join('\n                       ')}\n\n` +
            `     YECHIM: panelda PORT o'zgaruvchisining qiymatini nginx kutayotgan\n` +
            `     yo'lga o'zgartiring:\n\n` +
            `        PORT = ${hint[0]}\n`,
        );
      }
    } else if (expectedSockets.length > 0) {
      bad(
        'nginx Unix soketini kutadi, ilova esa TCP portda tinglaydi',
        `nginx qidiradi: ${expectedSockets[0]}\n` +
          `     YECHIM: panelda PORT qiymatiga shu yo'lni yozing.`,
      );
    } else if (expectedPorts.length > 0 && !expectedPorts.includes(String(listen.port))) {
      bad(
        'Ilova va nginx boshqa-boshqa portni ishlatadi',
        `Ilova: ${listen.port}\n     nginx: ${expectedPorts.join(', ')}\n     YECHIM: PORT qiymatini nginx kutayotgan portga o'zgartiring.`,
      );
    } else if (expectedPorts.includes(String(listen.port))) {
      ok('Ilova va nginx bir xil portni ishlatadi');
    }
  }

  /* ── 3. Sayt qurilgani ── */
  section('3. Sayt fayllari');

  const distIndex = path.join(ROOT, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    ok('dist/index.html mavjud');
    try {
      const info = JSON.parse(await fsp.readFile(path.join(ROOT, 'dist', 'build-info.json'), 'utf8'));
      ok(`Qurilgan sana: ${info.isoDate}`, `${info.pages} sahifa, ${info.lots} lot`);
      if (info.demo) {
        bad('Sayt DEMO rejimida qurilgan!', 'Namunaviy ma\'lumotlar ko\'rinib turadi. Bajaring: node src/build.mjs');
      } else {
        ok('Ishlab chiqarish rejimi (demo emas)');
      }
      if (Array.isArray(info.warnings) && info.warnings.length > 0) {
        warn(`Qurishda ${info.warnings.length} ta ogohlantirish bor`, info.warnings.join('\n     '));
      }
    } catch (error) {
      warn('build-info.json o\'qilmadi');
    }
  } else {
    bad('dist/ katalogi yo\'q — sayt qurilmagan', 'Bajaring: node src/build.mjs');
  }

  for (const file of ['src/build.mjs', 'server/server.mjs', 'content/site.json', 'admin/index.html']) {
    if (fs.existsSync(path.join(ROOT, file))) ok(`${file} joyida`);
    else bad(`${file} topilmadi`, 'Fayllar to\'liq yuklanmagan. To\'plamni qaytadan yuklang.');
  }

  /* ── 4. Yozish huquqlari ── */
  section('4. Yozish huquqlari');

  for (const dir of ['dist', 'content', 'content/inbox', 'assets/uploads', 'server/data']) {
    if (await canWrite(dir)) ok(`${dir}/ — yozish mumkin`);
    else bad(`${dir}/ — yozish mumkin emas`, 'Boshqaruv panelidan saqlash ishlamaydi. Hostingda huquqlarni to\'g\'rilang (chmod 755).');
  }

  /* ── 5. Sozlamalar ── */
  section('5. Sozlamalar');

  try {
    const site = JSON.parse(await fsp.readFile(path.join(ROOT, 'content', 'site.json'), 'utf8'));
    const origin = site?.seo?.canonicalOrigin || '';
    if (origin) ok(`Sayt manzili: ${origin}`);
    else warn('seo.canonicalOrigin bo\'sh', 'sitemap.xml va canonical havolalar to\'liq manzilsiz qoladi.');

    const endpoint = site?.features?.contactFormEndpoint;
    if (endpoint) ok(`Murojaat shakli faol: ${endpoint}`);
    else warn('Murojaat shakli faolsiz', 'Yoqish: content/site.json → features.contactFormEndpoint = "/api/contact"');

    const logo = site?.media?.logo || '';
    if (logo || fs.existsSync(path.join(ROOT, 'assets/img/logo.svg'))) ok('Logotip joylashtirilgan');
    else warn('Rasmiy logotip yo\'q', 'assets/img/logo.svg sifatida saqlang.');
  } catch (error) {
    bad('content/site.json o\'qilmadi', error.message);
  }

  const usersFile = path.join(ROOT, 'server', 'data', 'admin-users.json');
  const setupKeyFile = path.join(ROOT, 'server', 'data', 'setup-key.txt');
  const setupHint = 'Yoki /admin/ sahifasidagi «Birinchi administrator» shaklidan foydalaning';
  const cliHint = 'Yaratish: node server/tools/hash-password.mjs <nom> <parol> admin';
  let userCount = 0;

  if (fs.existsSync(usersFile)) {
    try {
      const data = JSON.parse(await fsp.readFile(usersFile, 'utf8'));
      userCount = Array.isArray(data.users) ? data.users.length : 0;
      if (userCount > 0) ok(`Boshqaruv paneli foydalanuvchilari: ${userCount} ta`);
      else bad('Foydalanuvchi ro\'yxati bo\'sh', `${cliHint}. ${setupHint}`);
    } catch (error) {
      bad('admin-users.json buzilgan');
    }
  } else {
    warn('Boshqaruv paneli foydalanuvchisi yaratilmagan', `${cliHint}. ${setupHint}`);
  }

  // Bir martalik sozlash kaliti — faqat foydalanuvchi yo'q paytda bo'lishi kerak
  if (fs.existsSync(setupKeyFile)) {
    if (userCount > 0) {
      warn(
        'Bir martalik sozlash kaliti hali o\'chirilmagan',
        `Foydalanuvchi bor ekan, kalit keraksiz — o'chiring: rm ${setupKeyFile}`,
      );
    } else {
      const key = (await fsp.readFile(setupKeyFile, 'utf8').catch(() => ''))
        .split(/\r?\n/).map((line) => line.trim())
        .find((line) => line !== '' && !line.startsWith('#')) || '(o\'qilmadi)';
      ok(`Sozlash kaliti tayyor: ${key}`, '/admin/ sahifasida shu kalitni kiriting');
    }
  } else if (userCount === 0) {
    warn(
      'Sozlash kaliti yo\'q',
      'Serverni qayta ishga tushirsangiz kalit avtomatik yaratiladi',
    );
  }

  /* ── 6. Telegram ── */
  section('6. Telegram');

  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  let fileToken = '';
  let fileChat = '';
  try {
    const cfg = JSON.parse(await fsp.readFile(path.join(ROOT, 'server', 'data', 'telegram.json'), 'utf8'));
    fileToken = String(cfg.botToken || '').trim();
    fileChat = String(cfg.chatId || '').trim();
  } catch (error) {
    /* fayl yo'q */
  }

  const finalToken = token || fileToken;
  const finalChat = chatId || fileChat;

  if (finalToken && finalChat) {
    ok('Token va chat_id kiritilgan', `manba: ${token ? 'muhit o\'zgaruvchisi' : 'telegram.json'}`);
    console.log(`     ${DIM}Ulanishni tekshirish: node server/tools/telegram-setup.mjs --check${R}`);
  } else if (!finalToken) {
    warn('Telegram sozlanmagan (token yo\'q)', 'Murojaatlar qabul qilinadi va qutida saqlanadi, lekin botga yuborilmaydi.');
  } else {
    warn('Token bor, lekin chat_id yo\'q', 'Sozlash: node server/tools/telegram-setup.mjs');
  }

  /* ── Yakun ── */
  console.log('');
  console.log(`  ${DIM}${'─'.repeat(58)}${R}`);
  if (problems === 0 && warnings === 0) {
    console.log(`  ${GREEN}${B}Hammasi joyida.${R} Server ishga tushishga tayyor.`);
  } else if (problems === 0) {
    console.log(`  ${GREEN}Jiddiy muammo yo'q${R} — ${warnings} ta eslatma bor (yuqoriga qaraysiz).`);
    console.log('  Server ishga tushishi kerak.');
  } else {
    console.log(`  ${RED}${B}${problems} ta muammo topildi${R}${warnings ? ` va ${warnings} ta eslatma` : ''}.`);
    console.log('  Yuqoridagi ✗ belgili qatorlarni tuzatib, qaytadan tekshiring.');
  }
  console.log('');

  process.exit(problems > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('');
  console.error(`  ${RED}Tashxis vositasida xatolik:${R} ${error.stack || error.message}`);
  console.error('');
  process.exit(1);
});
