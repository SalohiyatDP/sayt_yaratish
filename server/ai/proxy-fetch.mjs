/**
 * Proksi orqali HTTPS so'rov — zero-dep.
 *
 * Node ning native `fetch`i proksini faqat HTTP/HTTPS proksi uchun (va faqat
 * `--use-env-proxy` bayrog'i bilan) qo'llaydi; SOCKS5 ni umuman qo'llamaydi.
 * `undici` esa ochiq import qilinmaydi. Shuning uchun bu modul `node:net`,
 * `node:tls` va `node:http`/`node:https` yordamida proksi tunneli ochib,
 * ustidan HTTPS/HTTP so'rov yuboradi. Tashqi paketga bog'liq emas.
 *
 * Qo'llab-quvvatlanadigan proksi turlari:
 *   • socks5://[user:pass@]host:port  — SOCKS5 (RFC 1928 + 1929 auth)
 *   • socks://…                       — socks5 sifatida qabul qilinadi
 *   • http://[user:pass@]host:port    — HTTP CONNECT tunnel
 *   • https://…                       — proksigacha TLS, so'ng CONNECT
 *
 * Faqat AI provayder so'rovlari uchun ishlatiladi (kichik hajm, JSON).
 */
import net from 'node:net';
import tls from 'node:tls';
import { URL } from 'node:url';

const CONNECT_TIMEOUT = 20_000;

/** SOCKS5 CONNECT javob kodini (RFC 1928) o'zbekcha izohga aylantiradi. */
function socksReplyText(code) {
  const map = {
    1: 'proksi ichki xatosi',
    2: 'proksi bu ulanishга ruxsat bermadi (obuna/limit tugagan yoki maqsad manzil taqiqlangan bo\'lishi mumkin)',
    3: 'tarmoqqa yetib bo\'lmadi',
    4: 'xost topilmadi',
    5: 'ulanish rad etildi',
    6: 'TTL tugadi',
    7: 'buyruq qo\'llab-quvvatlanmaydi',
    8: 'manzil turi qo\'llab-quvvatlanmaydi',
  };
  return `${map[code] || 'noma\'lum xato'} (SOCKS5 kod ${code})`;
}

/** socks5://user:pass@host:port → { type, host, port, user, pass } */
function parseProxy(proxyUrl) {
  const u = new URL(proxyUrl);
  const scheme = u.protocol.replace(':', '').toLowerCase();
  const type = scheme.startsWith('socks') ? 'socks5' : 'http';
  return {
    type,
    tls: scheme === 'https',
    host: u.hostname,
    port: Number(u.port) || (type === 'socks5' ? 1080 : 8080),
    user: decodeURIComponent(u.username || ''),
    pass: decodeURIComponent(u.password || ''),
  };
}

/** SOCKS5 tunnel: proksiga ulanib, maqsad host:port ga yo'l ochadi. */
function socks5Connect(proxy, destHost, destPort) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxy.port, proxy.host);
    let stage = 'greeting';
    const fail = (msg) => { socket.destroy(); reject(new Error(msg)); };
    const timer = setTimeout(() => fail('socks5: ulanish vaqti tugadi'), CONNECT_TIMEOUT);

    socket.once('error', (e) => { clearTimeout(timer); reject(e); });

    socket.on('connect', () => {
      // Salom: VER=5, methods = [no-auth(0), user/pass(2)]
      const methods = proxy.user ? [0x00, 0x02] : [0x00];
      socket.write(Buffer.from([0x05, methods.length, ...methods]));
    });

    socket.on('data', (data) => {
      if (stage === 'greeting') {
        if (data[0] !== 0x05) return fail('socks5: noto\'g\'ri javob');
        const method = data[1];
        if (method === 0x02) {
          // user/pass auth (RFC 1929)
          const uBuf = Buffer.from(proxy.user, 'utf8');
          const pBuf = Buffer.from(proxy.pass, 'utf8');
          socket.write(Buffer.concat([
            Buffer.from([0x01, uBuf.length]), uBuf,
            Buffer.from([pBuf.length]), pBuf,
          ]));
          stage = 'auth';
        } else if (method === 0x00) {
          sendConnect();
        } else {
          return fail('socks5: qo\'llab-quvvatlanmaydigan autentifikatsiya usuli');
        }
      } else if (stage === 'auth') {
        if (data[1] !== 0x00) return fail('socks5: login/parol xato');
        sendConnect();
      } else if (stage === 'connect') {
        if (data[1] !== 0x00) return fail(`socks5: ${socksReplyText(data[1])}`);
        clearTimeout(timer);
        socket.removeAllListeners('data');
        resolve(socket);
      }
    });

    function sendConnect() {
      stage = 'connect';
      const hostBuf = Buffer.from(destHost, 'utf8');
      // CMD=CONNECT(1), ATYP=domain(3)
      socket.write(Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
        hostBuf,
        Buffer.from([(destPort >> 8) & 0xff, destPort & 0xff]),
      ]));
    }
  });
}

/** HTTP CONNECT tunnel orqali maqsad host:port ga yo'l ochadi. */
function httpConnect(proxy, destHost, destPort) {
  return new Promise((resolve, reject) => {
    const base = proxy.tls
      ? tls.connect(proxy.port, proxy.host, { servername: proxy.host })
      : net.connect(proxy.port, proxy.host);
    const timer = setTimeout(() => { base.destroy(); reject(new Error('http proksi: ulanish vaqti tugadi')); }, CONNECT_TIMEOUT);
    base.once('error', (e) => { clearTimeout(timer); reject(e); });
    base.once(proxy.tls ? 'secureConnect' : 'connect', () => {
      let head = `CONNECT ${destHost}:${destPort} HTTP/1.1\r\nHost: ${destHost}:${destPort}\r\n`;
      if (proxy.user) {
        const cred = Buffer.from(`${proxy.user}:${proxy.pass}`).toString('base64');
        head += `Proxy-Authorization: Basic ${cred}\r\n`;
      }
      head += '\r\n';
      base.write(head);
    });
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      const status = buf.slice(0, idx).toString('utf8');
      base.removeListener('data', onData);
      clearTimeout(timer);
      if (/^HTTP\/1\.[01] 200/.test(status)) resolve(base);
      else { base.destroy(); reject(new Error(`http proksi CONNECT rad etdi: ${status.split('\r\n')[0]}`)); }
    };
    base.on('data', onData);
  });
}

/**
 * Proksi tunneli ustidan bitta HTTPS/HTTP so'rov yuboradi.
 * Native `fetch` javobiga o'xshash minimal obyekt qaytaradi.
 * @returns {Promise<{ ok, status, json(), text() }>}
 */
export async function proxyFetch(url, options, proxyUrl) {
  const proxy = parseProxy(proxyUrl);
  const target = new URL(url);
  const isHttps = target.protocol === 'https:';
  const destPort = Number(target.port) || (isHttps ? 443 : 80);

  const tunnel = proxy.type === 'socks5'
    ? await socks5Connect(proxy, target.hostname, destPort)
    : await httpConnect(proxy, target.hostname, destPort);

  // Tunnel ustidan (kerak bo'lsa) TLS o'rnatamiz
  const stream = isHttps
    ? tls.connect({ socket: tunnel, servername: target.hostname })
    : tunnel;

  const mod = isHttps ? await import('node:https') : await import('node:http');

  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    const body = options.body ? Buffer.from(options.body) : null;
    if (body) headers['Content-Length'] = String(body.length);
    headers['Host'] = target.host;
    headers['Connection'] = 'close';

    const req = mod.request(
      {
        method: options.method || 'GET',
        path: target.pathname + target.search,
        headers,
        createConnection: () => stream,
        timeout: options.timeout || 60_000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            async json() { return JSON.parse(raw); },
            async text() { return raw; },
          });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('so\'rov vaqti tugadi')); });
    if (body) req.write(body);
    req.end();
  });
}
