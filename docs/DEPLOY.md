# Saytni hostingga joylashtirish

## 0. Avval hostingni tanlash

Bu saytda ikki xil qism bor:

| Qism | Nima kerak |
|---|---|
| **Sayt sahifalari** (barcha bo'limlar, katalog, xarita, master-rejalar) | Oddiy statik hosting yetarli |
| **Murojaat shakli + Telegram + boshqaruv paneli** | **Node.js 20.11+** ishlaydigan hosting |

Shuning uchun birinchi savol: **hostingda Node.js bormi?**

```
Node.js bor (VPS, cPanel Node.js App, Docker)
   └──►  A variant: TO'LIQ  ← tavsiya etiladi
         Hammasi ishlaydi: shakl, Telegram, panel, murojaatlar arxivi

Faqat statik hosting (HTML yuklash, Node.js yo'q)
   ├──►  B variant: STATIK + serverless funksiya
   │     Shakl Telegramga boradi, lekin murojaatlar hech qayerda saqlanmaydi,
   │     boshqaruv paneli ham ishlamaydi
   └──►  C variant: FAQAT STATIK
         Shakl faolsiz, sayt "qabul qilish tizimi ulanmagan" deb ochiq yozadi
```

### Variantlarni taqqoslash

| | A. To'liq | B. Statik + funksiya | C. Faqat statik |
|---|---|---|---|
| Sayt sahifalari, 4 til, xarita | ✅ | ✅ | ✅ |
| Murojaat Telegramga boradi | ✅ | ✅ | ❌ |
| Murojaat serverda saqlanadi | ✅ | ❌ | ❌ |
| Yetkazilmaganini qayta yuborish | ✅ | ❌ | ❌ |
| Boshqaruv paneli (kontent tahriri) | ✅ | ❌ | ❌ |
| Fayl yuklash (fotosurat, PDF) | ✅ | ❌ | ❌ |
| Kontentni kim o'zgartiradi | Xodim brauzerdan | Dasturchi, qayta yuklash | Dasturchi, qayta yuklash |
| Hosting narxi | O'rtacha | Past | Past |

> **Tavsiya:** davlat muassasasi sayti uchun **A variant**. Sababi: murojaatlar
> yo'qolmaydi (diskda arxiv qoladi), xodimlar kontentni o'zlari yangilaydi va
> Telegram ishlamay qolsa murojaat qayta yuboriladi.

### Davlat sayti uchun qo'shimcha talablar

`.uz` domenidagi davlat muassasasi sayti uchun ma'lumotlar O'zbekiston hududidagi
serverda joylashtirilishi talab qilinishi mumkin (odatda UZINFOCOM ma'lumot
markazi yoki mahalliy hosting provayderlari). Domen va hosting masalasini
vakolatli organ bilan aniqlashtirish zarur — bu texnik emas, tashkiliy masala.

Sayt har qanday holatda ishlaydi: u oddiy Node.js va statik fayllardan boshqa
hech narsani talab qilmaydi.

---

## 1. Joylashtirishdan oldin

Qaysi variant bo'lsa ham, avval quyidagilarni bajaring.

### 1.1. Sayt manzilini kiriting

`content/site.json` faylida (yoki boshqaruv panelidagi «Sayt sozlamalari» da):

```json
"seo": {
  "canonicalOrigin": "https://sayt-manzili.uz"
}
```

Bo'sh qoldirilsa `sitemap.xml` va `canonical` havolalar to'liq manzilsiz qoladi —
qidiruv tizimlari uchun muhim.

### 1.2. Rasmiy logotipni joylashtiring

Faylni `assets/img/logo.svg` sifatida saqlang. Batafsil: `assets/img/README.md`.

### 1.3. Qurib, tekshirib ko'ring

```bash
node src/build.mjs     # ogohlantirishlar ro'yxatini o'qing
node src/check.mjs     # xatolik bo'lmasligi kerak
```

### 1.4. Joylashtirish to'plamini yasang

```bash
node scripts/bundle.mjs             # A variant uchun (to'liq)
node scripts/bundle.mjs --static    # B va C variantlar uchun
```

Skript saytni qayta quradi, tekshiradi, **maxfiy fayllar tushmaganini nazorat
qiladi** va `release/` katalogida tayyor to'plam hamda `.tar.gz` arxiv yasaydi.
To'plam ichida `YUKLASH-YORIQNOMASI.txt` fayli bo'ladi.

To'plamga **kirmaydi** (ataylab): `.env`, bot tokeni, panel foydalanuvchilari,
kelgan murojaatlar, yuklangan fayllar.

> ⚠️ Sayt allaqachon ishlab turgan bo'lsa, yangilashdan oldin eski serverdan
> `content/`, `content/inbox/`, `assets/uploads/` va `server/data/` kataloglarini
> zaxiraga oling — aks holda murojaatlar, fotosuratlar va foydalanuvchilar yo'qoladi.

---

## A variant. To'liq joylashtirish

### A-1. VPS (o'z serveringiz) — systemd bilan

**1. Node.js o'rnatish**

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version      # v22.x bo'lishi kerak
```

**2. Fayllarni joylash**

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin direksiya
sudo mkdir -p /var/www/direksiya
sudo chown -R direksiya:direksiya /var/www/direksiya

# To'plamni ko'chirib, ochish
sudo -u direksiya tar xzf direksiya-sayt-server-*.tar.gz -C /var/www/direksiya --strip-components=1
```

**3. Maxfiy sozlamalar**

```bash
cd /var/www/direksiya
sudo -u direksiya cp .env.example .env
sudo -u direksiya nano .env
sudo chmod 600 .env
```

Kamida:

```dotenv
PORT=8080
HOST=127.0.0.1
SITE_ORIGIN=https://sayt-manzili.uz
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

**4. Boshqaruv paneli foydalanuvchisi**

```bash
sudo -u direksiya node server/tools/hash-password.mjs direksiya '<kuchli-parol>' admin
```

**5. Murojaat shaklini yoqish**

`content/site.json` → `"features": { "contactFormEndpoint": "/api/contact" }`

```bash
sudo -u direksiya node src/build.mjs
sudo -u direksiya node src/check.mjs
```

**6. systemd xizmati**

`/etc/systemd/system/direksiya.service`:

```ini
[Unit]
Description=Direksiya sayti
After=network.target

[Service]
Type=simple
User=direksiya
Group=direksiya
WorkingDirectory=/var/www/direksiya
Environment=NODE_ENV=production
EnvironmentFile=/var/www/direksiya/.env
ExecStart=/usr/bin/node server/server.mjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Xavfsizlik cheklovlari
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
ReadWritePaths=/var/www/direksiya/dist /var/www/direksiya/content /var/www/direksiya/assets/uploads /var/www/direksiya/server/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now direksiya
sudo systemctl status direksiya
journalctl -u direksiya -f          # jurnalni kuzatish
```

**7. nginx va HTTPS**

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/direksiya`:

```nginx
server {
    listen 80;
    server_name sayt-manzili.uz www.sayt-manzili.uz;
    return 301 https://sayt-manzili.uz$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name sayt-manzili.uz;

    ssl_certificate     /etc/letsencrypt/live/sayt-manzili.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sayt-manzili.uz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 30m;     # fayl yuklash uchun

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/css text/plain application/javascript application/json
               image/svg+xml application/xml application/manifest+json;

    # ── Boshqaruv panelini cheklash (KUCHLI TAVSIYA) ──
    location /admin/ {
        allow 10.0.0.0/8;          # ← Direksiya ichki tarmog'i
        allow 192.168.0.0/16;
        deny all;
        proxy_pass http://127.0.0.1:8080;
        include proxy_params;
    }
    location /api/admin/ {
        allow 10.0.0.0/8;
        allow 192.168.0.0/16;
        deny all;
        proxy_pass http://127.0.0.1:8080;
        include proxy_params;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/direksiya /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d sayt-manzili.uz -d www.sayt-manzili.uz
```

**8. Tekshirish**

```bash
curl -s https://sayt-manzili.uz/api/health | head -20
```

`"status": "ok"` qaytishi kerak.

---

### A-2. cPanel «Setup Node.js App»

Ko'pgina O'zbekiston hostinglarida shu imkoniyat bor.

1. Fayllarni **`public_html` dan tashqarida**, alohida katalogga yuklang,
   masalan `direksiya_app/` (File Manager yoki FTP orqali, arxivni yuklab
   «Extract» qilish qulay).

2. cPanel → **Setup Node.js App** → **Create Application**:

   | Maydon | Qiymati |
   |---|---|
   | Node.js version | 20 yoki undan yuqori |
   | Application mode | Production |
   | Application root | `direksiya_app` |
   | Application URL | sayt domeni |
   | Application startup file | `app.js` |

3. **«Run NPM Install» tugmasini bosish shart emas** — loyihada bog'liqliklar yo'q.

4. Shu sahifada **Environment variables** bo'limiga qo'shing:

   ```
   NODE_ENV=production
   SITE_ORIGIN=https://sayt-manzili.uz
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   ```

   `PORT` ni qo'shmang — cPanel uni o'zi beradi.

5. Terminal (yoki cPanel Terminal) orqali bir marta:

   ```bash
   cd ~/direksiya_app
   node server/tools/hash-password.mjs direksiya '<parol>' admin
   node src/build.mjs
   ```

6. **Restart** tugmasini bosib, `https://sayt-manzili.uz/api/health` ni tekshiring.

**Cheklovlar:** ba'zi umumiy (shared) hostinglar jarayonni faol bo'lmaganda
to'xtatadi — bunda sayt sekin ochilishi mumkin. Shuningdek fayl yozish huquqi
cheklangan bo'lsa, boshqaruv panelidan saqlash ishlamaydi. Bunday holatda VPS
yoki B varianti afzal.

---

### A-3. Docker (VPS yoki Docker qo'llab-quvvatlaydigan hosting)

```bash
cp .env.example .env && nano .env
docker compose build
docker compose up -d
docker compose logs -f
```

Foydalanuvchi yaratish:

```bash
docker compose exec sayt node server/tools/hash-password.mjs direksiya '<parol>' admin
```

`docker-compose.yml` sukut bo'yicha faqat `127.0.0.1:8080` da tinglaydi —
oldiga nginx teskari proksi qo'yish kerak (A-1 ning 7-bandi).

Kontent, yuklangan fayllar va sozlamalar `volumes` orqali host mashinada
saqlanadi, shuning uchun konteynerni yangilash ma'lumotga ta'sir qilmaydi.

---

## B variant. Statik hosting + serverless funksiya

Sayt oddiy hostingda turadi, murojaat shakli esa kichik funksiya orqali
Telegramga yuboriladi. Bot tokeni brauzerga chiqmaydi.

1. `serverless/README.md` bo'yicha Cloudflare Worker yarating (bepul reja yetarli).
2. Worker manzilini `content/site.json` ga yozing:

   ```json
   "features": { "contactFormEndpoint": "https://direksiya-murojaat.hisob.workers.dev" }
   ```

3. To'plam yasab, statik hostingga yuklang:

   ```bash
   node scripts/bundle.mjs --static
   ```

**Muhim cheklov:** murojaatlar hech qayerda saqlanmaydi. Telegram xabari yetib
bormasa, murojaat yo'qoladi (foydalanuvchiga xatolik ko'rsatiladi, soxta
muvaffaqiyat xabari chiqmaydi). Boshqaruv paneli ham ishlamaydi.

---

## C variant. Faqat statik hosting

```bash
node scripts/bundle.mjs --static
```

`release/direksiya-sayt-statik-<sana>/` katalogidagi **barcha fayllarni**
hostingning veb-katalogiga yuklang (`public_html/`, `www/` yoki `htdocs/`).
Katalogning o'zini emas — ichidagi fayllarni, ya'ni `index.html` hosting
ildizida turishi kerak.

Sozlash:

- 404 sahifasi sifatida `/404.html` ni ko'rsating.
- HTTPS sertifikatini yoqing (cPanel → SSL/TLS → Let's Encrypt).
- Apache hostinglarda `.htaccess` kerak bo'lishi mumkin:

  ```apache
  ErrorDocument 404 /404.html
  Options -Indexes
  AddDefaultCharset UTF-8

  <IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
  </IfModule>

  <IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 7 days"
    ExpiresByType application/javascript "access plus 7 days"
    ExpiresByType image/svg+xml "access plus 30 days"
  </IfModule>
  ```

Murojaat shakli saytda **faolsiz** bo'ladi va bu holat foydalanuvchiga ochiq
yoziladi. Aloqa uchun telefon va elektron pochtani `content/site.json` ga
kiritib qo'yish zarur.

### GitHub Pages (ko'rib chiqish uchun)

Repozitoriyada tayyor ish oqimi bor: **Actions → «Statik ko'rinishni GitHub
Pages ga joylash» → Run workflow**. Avval Settings → Pages → Source: «GitHub
Actions» qilib qo'yiladi.

Bu **rasmiy sayt uchun emas** — faqat dizayn va kontentni ko'rsatish uchun.

---

## 2. Kontentni yangilash

| Variant | Qanday |
|---|---|
| A (to'liq) | Boshqaruv paneli → tahrirlash → «Saytni qurish» |
| B, C (statik) | Mahalliy kompyuterda tahrirlab, `node scripts/bundle.mjs --static`, so'ng hostingga qayta yuklash |

A variantda kontent serverda turadi, shuning uchun dasturchi ishtiroki
kerak bo'lmaydi.

---

## 3. Zaxiralash

| Yo'l | Nima uchun |
|---|---|
| `content/` | Butun kontent — saytning asosiy qiymati |
| `content/inbox/` | Kelgan murojaatlar (shaxsiy ma'lumotlar — himoyalab saqlanadi) |
| `assets/uploads/` | Fotosuratlar, chizmalar, PDF hujjatlar |
| `server/data/` | Foydalanuvchilar, Telegram sozlamalari, kontent zaxiralari |

`dist/` ni zaxiralash shart emas — har doim qayta qurilishi mumkin.

Kunlik zaxira namunasi (`/etc/cron.daily/direksiya-backup`):

```bash
#!/bin/bash
set -euo pipefail
SRC=/var/www/direksiya
DEST=/var/backups/direksiya
STAMP=$(date +%F)
mkdir -p "$DEST"
tar czf "$DEST/direksiya-$STAMP.tar.gz" \
  -C "$SRC" content assets/uploads server/data
chmod 600 "$DEST/direksiya-$STAMP.tar.gz"
find "$DEST" -name 'direksiya-*.tar.gz' -mtime +30 -delete
```

```bash
sudo chmod +x /etc/cron.daily/direksiya-backup
```

Zaxira nusxalarni **boshqa fizik joyda** ham saqlash tavsiya etiladi.

---

## 4. Monitoring

`/api/health` manzili maxfiy ma'lumot qaytarmaydi va monitoring xizmatlariga
mos:

```bash
curl -s https://sayt-manzili.uz/api/health
```

```json
{
  "ok": true,
  "status": "ok",
  "uptimeSeconds": 3600,
  "site": { "built": true, "build": { "date": "2026-09-24", "demo": false, "pages": 32 } },
  "features": { "adminPanel": true, "contactForm": "enabled", "telegram": "configured" }
}
```

Nimalarni kuzatish tavsiya etiladi:

- `status` qiymati `ok` emasligi → sayt qurilmagan;
- `features.telegram` qiymati `not_configured` bo'lib qolishi;
- `site.build.demo` qiymati `true` bo'lishi → **darhol e'tibor bering**,
  ishlab turgan saytda namunaviy ma'lumot ko'rinib turgan bo'ladi;
- javob vaqti va HTTP holati (oddiy uptime xizmatlari: UptimeRobot, Better Stack).

Server jurnali: `journalctl -u direksiya -n 200` yoki `docker compose logs`.

---

## 5. Yangilash tartibi

```bash
# 1. Zaxira
sudo /etc/cron.daily/direksiya-backup

# 2. Yangi to'plamni yoyish (content/, inbox/, uploads/, server/data/ ga tegmaydi)
cd /tmp && tar xzf direksiya-sayt-server-<sana>.tar.gz
sudo rsync -a --delete \
  --exclude 'content/' --exclude 'assets/uploads/' --exclude 'server/data/' --exclude '.env' \
  direksiya-sayt-server-<sana>/ /var/www/direksiya/

# 3. Qurish va tekshirish
cd /var/www/direksiya
sudo -u direksiya node src/build.mjs
sudo -u direksiya node src/check.mjs

# 4. Qayta ishga tushirish
sudo systemctl restart direksiya
curl -s https://sayt-manzili.uz/api/health
```

---

## 6. Topshirishdan oldin tekshiruv ro'yxati

**Kontent va brend**
- [ ] Rasmiy logotip joylashtirilgan (`assets/img/logo.svg`)
- [ ] `content/site.json` da muassasa nomi, manzil, telefon, pochta to'ldirilgan
- [ ] Rus va ingliz tilidagi nomlar nizom bilan solishtirib tasdiqlangan
- [ ] `seo.canonicalOrigin` da haqiqiy sayt manzili turgan
- [ ] Statistik ko'rsatkichlar yo'q yoki `verified: true` va manbasi bilan
- [ ] Sayt **demo rejimida qurilmagan** (bosh sahifada sariq banner yo'q)

**Texnik**
- [ ] `node src/build.mjs` ogohlantirishlari ko'rib chiqilgan
- [ ] `node src/check.mjs` xatolik bermaydi
- [ ] Sayt to'rt tilda ochiladi: `/uz/`, `/uz-cyrl/`, `/ru/`, `/en/`
- [ ] HTTPS ishlaydi, HTTP dan yo'naltirish bor
- [ ] 404 sahifasi to'g'ri ishlaydi
- [ ] `/api/health` `status: ok` qaytaradi
- [ ] `/sitemap.xml` va `/robots.txt` ochiladi

**Murojaatlar (A yoki B variant)**
- [ ] Sinov murojaati yuborilib, Telegramga yetib borgani tekshirilgan
- [ ] Murojaat boshqaruv panelida ko'rinadi (A variant)
- [ ] Murojaatlar keladigan Telegram guruhi **yopiq**, faqat vakolatli xodimlar bor

**Xavfsizlik**
- [ ] Boshqaruv paneli faqat HTTPS orqali ochiladi
- [ ] `/admin/` va `/api/admin/` IP bo'yicha yoki VPN orqali cheklangan
- [ ] Panel paroli kuchli (12+ belgi) va faqat kerakli xodimlarda
- [ ] `.env` fayli `chmod 600`, `server/data/` `chmod 700`
- [ ] `--dev` bayrog'i **ishlatilmayapti**
- [ ] Bot tokeni repozitoriyaga yoki chatlarga tushmagan

**Ish jarayoni**
- [ ] Kunlik zaxira ishlaydi va tiklash bir marta sinab ko'rilgan
- [ ] Monitoring ulangan
- [ ] Xodimlar `docs/BOSHQARUV-PANELI.md` bilan tanishtirilgan
- [ ] Mas'ul xodim va uning o'rnini bosuvchi belgilangan
