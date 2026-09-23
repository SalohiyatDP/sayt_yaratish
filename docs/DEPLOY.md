# Serverga joylashtirish

Saytni ikki xil joylashtirish mumkin.

| Variant | Murojaat shakli | Boshqaruv paneli | Talab |
|---|---|---|---|
| **A. Faqat statik** | ishlamaydi | yo'q | har qanday statik hosting |
| **B. Server bilan** | ishlaydi | bor | Node.js 20.11+ va HTTPS |

---

## A. Faqat statik sayt

```bash
node src/build.mjs          # yoki: npm run build
node src/check.mjs          # tekshirish
# dist/ katalogini hostingga ko'chiring
```

Oldindan `content/site.json` da to'ldiring:

```json
"seo": { "canonicalOrigin": "https://sayt-manzili.uz" }
```

### nginx namunasi

```nginx
server {
    listen 443 ssl http2;
    server_name sayt-manzili.uz;

    ssl_certificate     /etc/letsencrypt/live/sayt-manzili.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sayt-manzili.uz/privkey.pem;

    root /var/www/direksiya/dist;
    index index.html;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml application/xml;
    gzip_min_length 1024;

    # Katalog manzillarini index.html ga bog'lash
    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }

    location /assets/ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    location = /sw.js {
        add_header Cache-Control "no-cache";
    }

    error_page 404 /404.html;
}

server {
    listen 80;
    server_name sayt-manzili.uz;
    return 301 https://$host$request_uri;
}
```

### GitHub Pages

`dist/` katalogini `gh-pages` tarmog'iga joylang. `.nojekyll` faylini qo'shishni unutmang:

```bash
npm run build
touch dist/.nojekyll
```

Pages ildizdagi `404.html` faylini avtomatik ishlatadi.

---

## B. Server bilan

### 1. Fayllarni joylash

```bash
sudo mkdir -p /var/www/direksiya
sudo chown -R direksiya:direksiya /var/www/direksiya
# repozitoriyani /var/www/direksiya ga ko'chiring
cd /var/www/direksiya
node src/build.mjs
```

### 2. Boshqaruv paneli foydalanuvchisi

```bash
node server/tools/hash-password.mjs direksiya '<kuchli-parol>' admin
```

Parol `server/data/admin-users.json` faylida `scrypt` bilan xeshlanadi.
Bu fayl va `server/data/session-secret` — **maxfiy**, repozitoriyaga tushmaydi.

### 3. Murojaat shaklini yoqish

`content/site.json`:

```json
"features": { "contactFormEndpoint": "/api/contact" }
```

So'ngra qayta quring: `node src/build.mjs`.

### 4. systemd xizmati

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
Environment=PORT=8080
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node server/server.mjs
Restart=on-failure
RestartSec=5

# Xavfsizlik cheklovlari
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/direksiya/dist /var/www/direksiya/content /var/www/direksiya/assets/uploads /var/www/direksiya/server/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now direksiya
sudo systemctl status direksiya
```

### 5. nginx teskari proksi

```nginx
server {
    listen 443 ssl http2;
    server_name sayt-manzili.uz;

    ssl_certificate     /etc/letsencrypt/live/sayt-manzili.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sayt-manzili.uz/privkey.pem;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 30m;   # fayl yuklash uchun

    # Boshqaruv panelini cheklash (tavsiya etiladi)
    location /admin/ {
        allow 10.0.0.0/8;       # ← Direksiya ichki tarmog'i
        deny all;
        proxy_pass http://127.0.0.1:8080;
        include proxy_params;
    }
    location /api/admin/ {
        allow 10.0.0.0/8;
        deny all;
        proxy_pass http://127.0.0.1:8080;
        include proxy_params;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> `--dev` bayrog'ini **ishlab turgan serverda ishlatmang**: u seans cookie'sidan
> `Secure` bayrog'ini olib tashlaydi.

---

## 6. Zaxiralash

Quyidagilar muntazam zaxiralanishi kerak:

| Yo'l | Nima uchun |
|---|---|
| `content/` | Barcha kontent — saytning asosiy qiymati. |
| `content/inbox/` | Kelgan murojaatlar (shaxsiy ma'lumotlar — himoyalangan saqlanadi). |
| `assets/uploads/` | Fotosuratlar, chizmalar, PDF hujjatlar. |
| `server/data/` | Foydalanuvchilar, seans kaliti, kontent zaxiralari. |

`dist/` ni zaxiralash shart emas — u har doim qayta qurilishi mumkin.

Namunaviy kunlik zaxira:

```bash
#!/bin/bash
set -euo pipefail
DEST=/var/backups/direksiya
STAMP=$(date +%F)
mkdir -p "$DEST"
tar czf "$DEST/direksiya-$STAMP.tar.gz" \
  -C /var/www/direksiya content assets/uploads server/data
find "$DEST" -name 'direksiya-*.tar.gz' -mtime +30 -delete
```

---

## 7. Yangilanishdan keyingi tekshiruv ro'yxati

- [ ] `node src/build.mjs` ogohlantirishlari ko'rib chiqildi
- [ ] `node src/check.mjs` xatolik bermaydi
- [ ] Sayt to'rt tilda ochiladi: `/uz/`, `/uz-cyrl/`, `/ru/`, `/en/`
- [ ] Katalogdagi saralash va xarita ishlaydi
- [ ] Aukciondagi lotlarda E-auksion havolasi to'g'ri lotga olib boradi
- [ ] Murojaat shakli haqiqatan xabarni saqlaydi (sinov murojaati yuborib tekshiring)
- [ ] Boshqaruv paneli HTTPS orqali ochiladi va cheklangan
- [ ] Sayt demo rejimida **qurilmagan** (bosh sahifada sariq banner yo'q)
- [ ] Logotip rasmiy fayl bilan almashtirilgan
- [ ] Zaxira nusxa olish jadvali ishlaydi
