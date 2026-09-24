# Saytni hostingga joylashtirish

## 0. Hostingga qo'yiladigan talab

Saytning ikki qismi bor va ular bir xil hostingda ishlaydi:

| Qism | Nima kerak |
|---|---|
| Sayt sahifalari (katalog, xarita, master-rejalar, 4 til) | statik fayllar |
| Murojaat shakli, Telegram, boshqaruv paneli, murojaatlar arxivi | **Node.js 20.11+** |

Shuning uchun hostingda **Node.js ishga tushirish imkoniyati bo'lishi shart**.
Bu talab bajarilsa hammasi ishlaydi: xodim kontentni brauzerdan tahrirlaydi,
murojaatlar serverda arxivlanadi va Telegramga yuboriladi, yetkazilmagan
murojaat esa avtomatik qayta yuboriladi.

Amalda ikki xil o'rnatish uchraydi:

- **A-1. VPS** — o'z serveringiz, `systemd` bilan boshqariladi.
- **A-2. Hosting paneli** (ISPmanager, cPanel, Plesk) — panel Node.js ilovasini
  o'zi ishga tushiradi. `namresort.uz` shu usulda ishlaydi.

> Node.js bo'lmagan oddiy statik hostingda sayt sahifalari ochiladi, lekin
> murojaat shakli va boshqaruv paneli ishlamaydi. Bunday holatda shakl saytda
> «qabul qilish tizimi ulanmagan» deb ochiq yoziladi va soxta muvaffaqiyat
> xabari ko'rsatilmaydi. Davlat muassasasi sayti uchun bu variant tavsiya
> etilmaydi.

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

Yoki `/admin/` sahifasini ochib, «Birinchi administrator» shaklini to'ldirasiz —
kalit `server/data/setup-key.txt` faylida va ishga tushish jurnalida bo'ladi.

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

        # Panel fayllarini nginx keshlamasligi kerak: yangilash chiqqanda
        # xodim eski koddan foydalanib qolmasin. Node.js allaqachon
        # `no-store` yuboradi — quyidagilar nginx o'z keshini qo'shmasligi uchun.
        expires off;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        add_header Cache-Control "no-store, must-revalidate" always;
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

### A-2. Hosting paneli orqali (ISPmanager, cPanel, Plesk)

Panellar Node.js ilovani o'zi ishga tushiradi va oldiga nginx proksisini
avtomatik sozlaydi. Sizdan faqat ishga tushirish buyrug'i va muhit
o'zgaruvchilari so'raladi.

#### Unix soketi (ISPmanager'da ko'p uchraydi)

ISPmanager odatda TCP port emas, **Unix soketi** yo'lini beradi. Ko'rinishi:

```
/var/www/<foydalanuvchi>/data/nodejs/<raqam>.sock
```

Masalan: `/var/www/s0277/data/nodejs/21.sock`

Shu yo'lni `PORT` o'zgaruvchisiga yozish **yetarli** — server qiymat yo'l
ko'rinishida ekanini o'zi aniqlab, soketda tinglaydi:

| Имя | Значение |
|---|---|
| `PORT` | `/var/www/s0277/data/nodejs/21.sock` |

Aniqroq bo'lishi uchun `SOCKET` nomini ishlatish ham mumkin — natija bir xil.

Soket rejimida `HOST` o'zgaruvchisi **kerak emas** (u e'tiborga olinmaydi).

Server soket bilan ishlashda quyidagilarni o'zi bajaradi:

- ota katalog mavjud bo'lmasa — **yaratadi**;
- eski jarayondan qolgan soket faylini **o'chiradi** (aks holda `EADDRINUSE`);
- soket fayliga `0660` huquqini qo'yadi;
- to'xtaganda (`SIGTERM`/`SIGINT`) soket faylini **tozalaydi**.

Ishga tushganda jurnalda shunday yoziladi:

```
  Tinglanmoqda:      Unix soketi /var/www/s0277/data/nodejs/21.sock
  Soket huquqi:      660
  Port manbasi:      PORT
  Jarayon raqami:    12345
```

##### Soketni nginx sozlamasidan tasdiqlash

Panel qaysi yo'lni kutayotganini tekshirish:

```bash
grep -r "unix:" /etc/nginx/ | grep nodejs
```

Natijada `proxy_pass http://unix:/var/www/s0277/data/nodejs/21.sock;` kabi
qator chiqadi — `PORT` qiymati **aynan shu yo'l** bo'lishi kerak.

##### `502 Bad Gateway` va soket huquqi

nginx soketga ulanolmasa (`Permission denied`), huquqni bo'shatib ko'ring —
panelda yana bitta o'zgaruvchi qo'shasiz:

| Имя | Значение |
|---|---|
| `SOCKET_MODE` | `666` |

Odatiy qiymat `660` (egasi va guruh). nginx boshqa foydalanuvchi ostida ishlab,
sayt foydalanuvchisining guruhiga kirmasa, `666` kerak bo'ladi.

#### TCP port ishlatilganda

Ba'zi panellar soket emas, port beradi. Server quyidagi o'zgaruvchilarni
navbatma-navbat tekshiradi:

Server shu farqlarni o'zi hisobga oladi va quyidagi o'zgaruvchilarni
navbatma-navbat tekshiradi:

```
PORT  →  SOCKET  →  NODE_PORT  →  APP_PORT  →  SERVER_PORT  →  HTTP_PORT
```

- Qiymat son bo'lsa — shu TCP portda tinglaydi.
- Qiymat yo'l bo'lsa (`/`, `./` bilan boshlansa yoki `.sock` bilan tugasa) —
  Unix soketida tinglaydi.
- Hech biri berilmasa — `8080` portida tinglaydi.

Ishga tushgandan keyin jurnalda qaysi manba ishlatilgani ko'rinadi:

```
  Direksiya sayti serveri ishga tushdi
  Manzil:            http://0.0.0.0:10000/
  Port manbasi:      PORT
```

Agar «Port manbasi: odatiy qiymat» deb yozilgan bo'lsa, panel portni
uzatmagan — bu holda panelda ko'rsatilgan portni `PORT` o'zgaruvchisiga
**qo'lda yozib qo'yish** kerak.

> ISPmanager bo'sh TCP portni o'zi tanlaydi; qidiruv `NodeJsBackendBind`
> qiymatidan boshlanadi (odatiy holda `127.0.0.1:10000`) —
> [ispmanager hujjatlari](https://www.ispmanager.com/docs/ispmanager/creating-a-new-nodejs-project).
> Ya'ni port odatda `10000` va undan yuqori bo'ladi. Panelda ko'rsatilgan
> aniq qiymatni tekshirib oling.
> *(Manba mazmuni litsenziya talablariga muvofiq qisqartirib berildi.)*

#### ISPmanager — «Параметры запуска Node.js»

**1. Fayllarni yuklash**

To'plamni (`direksiya-sayt-server-*.tar.gz`) sayt katalogiga yuklab, panelning
fayl menejeri orqali oching. Odatda yo'l:
`/var/www/<foydalanuvchi>/data/www/<domen>/`

**2. Команда запуска** — «Указать команду вручную» ni tanlab, yozing:

```
node server/server.mjs
```

**3. Выполнять дополнительную команду перед запуском**

Bu katagi belgilangan bo'lsa, «Указать команду вручную» ni tanlab yozing:

```
node src/build.mjs
```

Bu buyruq har ishga tushishda saytni kontentdan qayta yig'adi (0,1 soniya).
Foydasi: birinchi ishga tushirishda `dist/` avtomatik paydo bo'ladi va kontent
o'zgarganda sayt yangilanadi.

> `npm install` **kerak emas** — loyihada hech qanday bog'liqlik yo'q.
> Ro'yxatdan `npm install` tanlansa, u bo'sh ishlaydi yoki xato berishi mumkin.
> Agar qo'lda buyruq kiritish imkoni bo'lmasa, bu katakni **belgilamang** va
> saytni bir marta terminal orqali quring.

**4. Переменная окружения** — quyidagilarni qo'shing:

| Имя | Значение | Izoh |
|---|---|---|
| `PORT` | `/var/www/<foydalanuvchi>/data/nodejs/<raqam>.sock` | ISPmanager bergan soket yo'li |
| `NODE_ENV` | `production` | Ishlab chiqarish rejimi |
| `SITE_ORIGIN` | `https://<domen>` | Telegram xabaridagi panel tugmasi uchun |
| `TELEGRAM_BOT_TOKEN` | `1234567890:AA…` | @BotFather bergan token |
| `TELEGRAM_CHAT_ID` | `-1001234567890` | Murojaatlar keladigan chat |

Soket yo'lini panelda yoki nginx sozlamasida ko'rish mumkin
(`grep -r "unix:" /etc/nginx/ | grep nodejs`).

Panel TCP port bergan bo'lsa, `PORT` ga shu raqamni yozib, `HOST` ni
`127.0.0.1` qilib qo'yasiz.

Jurnalda «Port manbasi: odatiy qiymat» deb chiqsa — demak panel hech narsa
bermagan va `PORT` ni qo'lda kiritish kerak.

**5. Saqlash va perezapustit** tugmasini bosing.

**6. Birinchi administratorni yaratish — terminal shart emas**

`https://<domen>/admin/` sahifasini ochsangiz «Birinchi administrator» shakli
chiqadi. U bir martalik kalit so'raydi. Kalitni ikki joydan olasiz:

- **Fayl menejeri:** `server/data/setup-key.txt`
- **Jurnal:** ISPmanager → Node.js ilovasi → jurnal (log); kalit ishga
  tushishda ramka ichida chiqadi

Administrator yaratilgach kalit fayli avtomatik o'chiriladi.

> Terminal («Shell» bo'limi yoki SSH) bor bo'lsa, xohishga ko'ra:
> ```bash
> cd /var/www/<foydalanuvchi>/data/www/<domen>
> node server/tools/hash-password.mjs direksiya '<kuchli-parol>' admin
> node src/build.mjs
> ```

**7. Tekshirish**

```
https://<domen>/api/health
```

`"status": "ok"` qaytishi kerak.

#### Sayt ildizi (document root) masalasi

Panel nginx ni ikki xil sozlashi mumkin:

| Holat | Nima qilish kerak |
|---|---|
| Barcha so'rovlar Node.js ga uzatiladi | Hech narsa — shunday ishlaydi (tavsiya etiladi) |
| nginx statik fayllarni o'zi beradi | Sayt ildizini `dist` ostkatalogiga o'zgartiring, `/api/` va `/admin/` esa Node.js ga uzatilsin |

Agar sayt ochilganda **404** yoki panelning standart sahifasi chiqsa —
sababi shu: nginx `index.html` ni ilova ildizidan qidirmoqda, bizda esa u
`dist/` ichida. Yechim: ildizni `dist` ga o'zgartirish yoki barcha so'rovlarni
Node.js ga uzatish.

#### cPanel «Setup Node.js App»

1. Fayllarni **`public_html` dan tashqarida**, alohida katalogga yuklang
   (masalan `direksiya_app/`).

2. cPanel → **Setup Node.js App** → **Create Application**:

   | Maydon | Qiymati |
   |---|---|
   | Node.js version | 20 yoki undan yuqori |
   | Application mode | Production |
   | Application root | `direksiya_app` |
   | Application URL | sayt domeni |
   | Application startup file | `app.js` |

3. **«Run NPM Install» tugmasini bosish shart emas.**

4. **Environment variables** bo'limiga yuqoridagi jadvaldagi o'zgaruvchilarni
   qo'shing.

5. Terminal orqali bir marta parol yaratib, saytni quring (6-band bilan bir xil).

6. **Restart** → `https://<domen>/api/health`.

#### Muammolarni aniqlash: `EADDRINUSE` va boshqalar

Server ishga tushmasa yoki sayt `502` bersa, **birinchi navbatda** tashxis
vositasini ishga tushiring — u sababni topib, yechimni ko'rsatadi:

```bash
node server/tools/diagnose.mjs
```

Windows'da: `windows\tashxis.cmd` faylini ikki marta bosing.

Vosita quyidagilarni tekshiradi: Node versiyasi, tinglash manzili (port yoki
soket) bo'sh-bandligi, **nginx kutayotgan manzil bilan mos kelishi**, sayt
qurilgani, yozish huquqlari, panel foydalanuvchilari, Telegram sozlamalari va
loyihaning boshqa ishlayotgan jarayonlari.

##### Eng ko'p uchraydigan xato: manzil mos kelmasligi

Ilova bir soketda tinglaydi, nginx esa boshqasini qidiradi. Natijada
`502 Bad Gateway` va jurnalda:

```
connect() to unix:/var/www/s0277/data/nodejs/26.sock failed
(2: No such file or directory) while connecting to upstream
```

Tashxis vositasi buni o'zi aniqlaydi va kerakli qiymatni aytadi:

```
2b. Veb-server (nginx) kutayotgan manzil
 unix:/var/www/s0277/data/nodejs/26.sock  ← /etc/nginx/vhosts/s0277/namresort.uz.conf
 ✗ ILOVA VA nginx BOSHQA-BOSHQA SOKETNI ISHLATADI — «502 Bad Gateway» sababi shu
   Ilova tinglaydi:  /var/www/s0277/data/nodejs/21.sock
   nginx qidiradi:   /var/www/s0277/data/nodejs/26.sock

   YECHIM: panelda PORT o'zgaruvchisining qiymatini nginx kutayotgan
   yo'lga o'zgartiring:

      PORT = /var/www/s0277/data/nodejs/26.sock
```

nginx sozlamalari faqat administrator uchun ochiq bo'lsa, vosita buni aytadi —
u holda qo'lda tekshiring:

```bash
grep -r "proxy_pass" /etc/nginx/ | grep -E "unix:|127.0.0.1"
```

> ⚠️ Soket raqami (`26.sock`) **ilova qayta yaratilganda o'zgarishi mumkin**.
> Panelda ilovani o'chirib qaytadan qo'shsangiz, `PORT` qiymatini ham
> yangilashni unutmang.

##### `EADDRINUSE: address already in use 0.0.0.0:8080`

Bu xatolikning **ikki sababi** bo'ladi:

**1. Panel portni bermagan.** Server odatiy `8080` portni tanlaydi, u esa band
bo'lib chiqadi. Jurnalda shunday yoziladi:

```
Port manbasi: odatiy qiymat (hech qanday o'zgaruvchi berilmagan)
```

*Yechim:* panelning «Переменная окружения» bo'limida `PORT` o'zgaruvchisini
qo'shib, hosting shu sayt uchun ajratgan portni yozing. ISPmanager'da bu port
odatda `10000` dan boshlanadi. Aniq qiymatni panelda yoki domen uchun yozilgan
nginx sozlamasida ko'rish mumkin:

```bash
grep -r "proxy_pass" /etc/nginx/ | grep 127.0.0.1
```

**2. Eski jarayon to'xtamagan.** Panel ilovani qayta ishga tushirganda oldingi
jarayon portni hali bo'shatmagan bo'lishi mumkin.

*Yechim:*

```bash
# Portni kim band qilgan?
ss -ltnp | grep :8080          # yoki: lsof -i :8080

# Loyihaning jarayonlarini ko'rish
ps aux | grep "server/server.mjs"

# Hammasini to'xtatish
pkill -f "server/server.mjs"
```

So'ngra panelda ilovani qaytadan ishga tushiring.

> Server ataylab **avtomatik boshqa portga o'tmaydi**: nginx aniq bir portga
> uzatadi, shuning uchun portni jimgina o'zgartirish saytni butunlay ishlamay
> qolishiga olib keladi. Xatolik ochiq ko'rsatiladi.

##### Portni qo'lda sinab ko'rish

```bash
node server/server.mjs --port 10000
```

Bu bayroq muhit o'zgaruvchilaridan ustun turadi — hostingda tez tekshirish uchun qulay.

##### `EACCES: permission denied`

1024 dan kichik port (80, 443) administrator huquqini talab qiladi. 1024 dan
katta port ishlatib, oldiga nginx qo'yish kerak.

##### Soket rejimidagi `EADDRINUSE`

Soket fayli eski jarayondan qolgan. Server uni o'zi tozalashga harakat qiladi,
lekin eski jarayon hali tirik bo'lsa tozalab bo'lmaydi:

```bash
ps aux | grep "server/server.mjs"
pkill -f "server/server.mjs"
rm -f /var/www/<foydalanuvchi>/data/nodejs/<raqam>.sock
```

So'ngra panelda ilovani qayta ishga tushiring.

##### Sayt ochiladi, lekin `502 Bad Gateway`

nginx Node.js ga ulanolmayapti. Uch sababi bo'ladi:

1. **Ilova ishlamayapti** — jurnalni ko'ring, `node server/tools/diagnose.mjs`
   ishga tushiring.
2. **Manzil mos kelmayapti** — jurnaldagi «Tinglanmoqda» / «Manzil» qatorini
   nginx `proxy_pass` qiymati bilan solishtiring, ikkalasi bir xil bo'lishi kerak:

   ```bash
   grep -r "proxy_pass" /etc/nginx/ | grep -E "unix:|127.0.0.1"
   ```

3. **Soket huquqi yetarli emas** (`Permission denied`) — `SOCKET_MODE=666`
   o'zgaruvchisini qo'shib ko'ring.

##### Boshqaruv panelidan saqlash ishlamaydi

Yozish huquqi yo'q. Tashxis vositasi qaysi katalogda muammo borligini
ko'rsatadi. Kerakli kataloglar: `content/`, `content/inbox/`,
`assets/uploads/`, `server/data/`, `dist/`.

#### Panel hostinglaridagi cheklovlar

- Ba'zi umumiy (shared) hostinglar jarayonni faol bo'lmaganda to'xtatadi —
  birinchi so'rov sekin bo'lishi mumkin.
- Fayl yozish huquqi cheklangan bo'lsa, boshqaruv panelidan saqlash ishlamaydi.
  Quyidagi kataloglarga yozish huquqi kerak:
  `content/`, `content/inbox/`, `assets/uploads/`, `server/data/`, `dist/`.
- Xotira cheklovi past bo'lsa (128 MB dan kam), qurish sekin ketishi mumkin.

Bu cheklovlar to'sqinlik qilsa, VPS (A-1) afzal.

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

Server jurnali: `journalctl -u direksiya -n 200` (VPS) yoki hosting panelidagi
Node.js ilovasi jurnali.

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

**Murojaatlar**
- [ ] Sinov murojaati yuborilib, Telegramga yetib borgani tekshirilgan
- [ ] Murojaat boshqaruv panelida ko'rinadi (A variant)
- [ ] Murojaatlar keladigan Telegram guruhi **yopiq**, faqat vakolatli xodimlar bor

**Xavfsizlik**
- [ ] Boshqaruv paneli faqat HTTPS orqali ochiladi
- [ ] `/admin/` va `/api/admin/` IP bo'yicha yoki VPN orqali cheklangan
- [ ] Panel paroli kuchli (12+ belgi) va faqat kerakli xodimlarda
- [ ] `server/data/setup-key.txt` yo'q (administrator yaratilgach avtomatik o'chadi)
- [ ] `.env` fayli `chmod 600`, `server/data/` `chmod 700`
- [ ] `--dev` bayrog'i **ishlatilmayapti**
- [ ] Bot tokeni repozitoriyaga yoki chatlarga tushmagan

**Ish jarayoni**
- [ ] Kunlik zaxira ishlaydi va tiklash bir marta sinab ko'rilgan
- [ ] Monitoring ulangan
- [ ] Xodimlar `docs/BOSHQARUV-PANELI.md` bilan tanishtirilgan
- [ ] Mas'ul xodim va uning o'rnini bosuvchi belgilangan
