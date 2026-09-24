# Namangan turistik-rekreatsion hududlarini rivojlantirish direksiyasi — rasmiy veb-sayt

Namangan viloyati hokimligi huzuridagi «Namangan turistik-rekreatsion hududlarini
rivojlantirish direksiyasi» davlat muassasasining rasmiy veb-sayti.

Sayt ikki vazifani bajaradi:

1. **Ishonchli axborot manbasi** — Direksiya faoliyati, ish bosqichlari va me'yoriy asoslari.
2. **Tadbirkorlar va investorlar uchun ish quroli** — hududlar va lotlar katalogi, master-rejalar,
   hujjatlar va rasmiy E-auksion platformasiga o'tish.

---

## 1. Asosiy xususiyatlari

| Imkoniyat | Izoh |
|---|---|
| **To'rt til** | O'zbek (lotin), o'zbek (kirill — asosiy), rus, ingliz. Har bir til uchun alohida statik sahifalar, `hreflang` va `sitemap.xml`. |
| **Hududlar va lotlar katalogi** | Tuman, hudud turi, maydon, turizm yo'nalishi va lot holati bo'yicha saralash. Uch xil ko'rinish: kartochkalar, xarita, jadval. |
| **Ulashiladigan havolalar** | Saralash natijasi sahifa manzilida saqlanadi — havolani hamkorga yuborish mumkin. |
| **Interaktiv xarita** | Tashqi kutubxonalarsiz yozilgan modul: OpenStreetMap plitkalari, markerlar, kadastr chegarasi konturi, klaviatura bilan boshqarish. Plitkalar yuklanmasa — ochiq xatolik holati va koordinatalarning matnli ro'yxati. |
| **Lot passporti** | Maydon, koordinatalar, holat, 5 bosqichli tayyorlik ko'rsatkichi, mavjud holat fotosuratlari, loyiha konsepsiyasi, infratuzilma, talablar, cheklovlar, hujjatlar va E-auksion tugmasi. |
| **Master-rejalar** | Funksional zonalar, obyektlar eksplikatsiyasi, loyiha yechimlari, chizmalarni kattalashtirib ko'rish va PDF yuklab olish. Konsepsiya / ishlab chiqilayotgan reja / tasdiqlangan reja holatlari aniq ajratilgan. |
| **Investor savati** | Lotlarni taqqoslash jadvali (faqat brauzer xotirasida saqlanadi, serverga yuborilmaydi), chop etish uchun tayyor. |
| **Tezkor qidiruv** | `Ctrl+K` (yoki `/`) — hududlar, master-rejalar, yangiliklar va sahifalar bo'yicha. |
| **Murojaat shakli** | Serverga ulangan bo'lsa ishlaydi va ro'yxatga olish raqamini qaytaradi; ulanmagan bo'lsa bu holat **ochiq yoziladi** va shakl faolsiz qoladi. |
| **Boshqaruv paneli** | Himoyalangan `/admin/` — lotlar, master-rejalar, yangiliklar, sayt sozlamalari, fayl yuklash, murojaatlar va saytni qayta qurish. |
| **Qulaylik (a11y)** | Klaviatura bilan to'liq boshqarish, ko'rinadigan fokus, WCAG 2.1 AA kontrast, `prefers-reduced-motion`, semantik belgilar, ARIA. |
| **Tezkorlik** | Statik HTML. Tashqi shrift, tahlil skripti yoki JS framework yo'q. CSS ≈ 73 KB, JS ≈ 65 KB (barcha modullar birga). |
| **Oflayn ishlash** | PWA manifest va service worker — ko'rilgan sahifalar uланish yo'qolganda ham ochiladi. |
| **Bog'liqliklar** | **Yo'q.** `npm install` talab qilinmaydi. Faqat Node.js 20.11+ kerak. |

---

## 2. Tezkor boshlash

Faqat **Node.js 20.11+** o'rnatilgan bo'lishi kerak: <https://nodejs.org> → LTS versiyasi.

```bash
# 1. Saytni qurish (faqat tasdiqlangan kontent bilan)
npm run build

# 2. Natijani tekshirish (havolalar, tillar, qulaylik)
npm run check

# 3. Serverni ishga tushirish (statik sayt + boshqaruv paneli)
npm start
#    → http://localhost:8080/
#    → http://localhost:8080/admin/
```

Boshqaruv paneliga kirish uchun avval foydalanuvchi yarating:

```bash
npm run admin:password -- direksiya 'Kuchli-Parol-Kamida-12-Belgi' admin
```

### 🪟 Windows foydalanuvchilari uchun

Agar PowerShell'da quyidagi xatolik chiqsa:

```
npm : Невозможно загрузить файл C:\Program Files\nodejs\npm.ps1,
так как выполнение сценариев отключено в этой системе.
```

Bu loyihaning xatoligi emas — Windows sukut bo'yicha PowerShell skriptlarini
taqiqlaydi. Uchta yechim bor:

**1) `windows\` katalogidagi tayyor fayllarni ikki marta bosish (eng oson):**

| Fayl | Vazifasi |
|---|---|
| `windows\qurish.cmd` | Saytni qurish |
| `windows\tekshirish.cmd` | Natijani tekshirish |
| `windows\ishga-tushirish.cmd` | Serverni ishga tushirish |
| `windows\parol-yaratish.cmd` | Panel foydalanuvchisini yaratish |
| `windows\telegram-sozlash.cmd` | Telegram botni ulash |

**2) `npm` o'rniga `npm.cmd` deb yozish:**

```powershell
npm.cmd run build
```

**3) Cheklovni bir marta yumshatish (administrator huquqi kerak emas):**

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Batafsil: [`windows/README.md`](windows/README.md)

### Imkoniyatlarni ko'rish uchun demo rejimi

```bash
npm run build:demo
```

Demo rejimida `content/demo/` katalogidagi **namunaviy** yozuvlar qo'shiladi.
Ular saytda har doim «DEMO» nishoni va yuqoridagi ogohlantirish banneri bilan
ko'rsatiladi. **Ishlab turgan saytni demo rejimida qurish man etiladi.**

---

## 3. Loyiha tuzilishi

```
.
├── content/               ← KONTENT (ma'lumotlarning yagona manbasi)
│   ├── site.json          muassasa nomi, rekvizitlar, E-auksion, statistika, sozlamalar
│   ├── taxonomies.json    tumanlar, hudud turlari, lot holatlari, ish bosqichlari
│   ├── lots.json          hududlar va lotlar
│   ├── masterplans.json   master-rejalar
│   ├── news.json          yangiliklar
│   ├── pages.json         sahifa matnlari (bosh sahifa, "Direksiya haqida", FAQ …)
│   ├── demo/              namunaviy kontent (faqat demo rejimida)
│   └── inbox/             kelgan murojaatlar (repozitoriyaga tushmaydi)
│
├── i18n/                  interfeys matnlari: uz.json, uz-cyrl.json, ru.json, en.json
│
├── src/                   STATIK SAYT GENERATORI
│   ├── build.mjs          asosiy skript
│   ├── check.mjs          sifat tekshiruvi
│   ├── lib/               util, i18n, content, icons, ui, layout
│   └── templates/         sahifa shablonlari
│
├── assets/                BRAUZER FAYLLARI
│   ├── css/main.css       dizayn tizimi
│   ├── js/                app, catalog, map, lot, viewer, news, contact + core/
│   ├── img/               favicon, ikonkalar (logotip shu yerga qo'yiladi)
│   └── uploads/           panel orqali yuklangan fayllar (repozitoriyaga tushmaydi)
│
├── admin/                 BOSHQARUV PANELI (brauzer ilovasi)
├── server/                SERVER (Node.js, bog'liqliksiz)
│   ├── server.mjs         statik sayt + /api/contact + /api/admin/*
│   ├── tools/             hash-password.mjs
│   └── data/              seans kaliti, foydalanuvchilar, zaxira nusxalar (maxfiy)
│
├── docs/                  qo'shimcha yo'riqnomalar
└── dist/                  QURILGAN SAYT (avtomatik yaratiladi, repozitoriyada saqlanmaydi)
```

---

## 4. Kontentni to'ldirish

Barcha matnlar **to'rt tilda** obyekt sifatida saqlanadi:

```json
"name": {
  "uz-cyrl": "Ҳудуд номи",
  "uz": "Hudud nomi",
  "ru": "Название территории",
  "en": "Area name"
}
```

Biror tilda matn bo'lmasa, sayt zaxira tartibda (kirill → lotin → rus → ingliz) to'ldiradi.
Hech qanday matn bo'lmasa — «Ma'lumot hozircha joylashtirilmagan» holati chiqadi.

Eng qulay yo'l — **boshqaruv panelidan** foydalanish. Fayllarni qo'lda tahrirlash ham mumkin:
har bir faylda `_template` (namuna tuzilma) va `_fieldGuide` (maydonlar izohi) mavjud.

### Ma'lumot ishonchliligi bo'yicha qat'iy qoidalar

Sayt ataylab shunday qurilgan:

- **Aukcion ma'lumotlari** (sana, boshlang'ich narx, huquq turi) `auction.verified: true`
  belgilanmaguncha saytda **umuman ko'rsatilmaydi**.
- **E-auksion tugmasi** faqat `auction.lotUrl` da aynan shu lotning havolasi bo'lsa faollashadi.
  Platformaning umumiy manzili lot havolasi sifatida qabul qilinmaydi — generator buni
  aniqlab, havolani olib tashlaydi va ogohlantiradi.
- **Huquq turi** har bir lotning rasmiy hujjatidagi ibora bilan yoziladi.
  Umumiy «yer sotiladi» iborasi saytda hech qanday joyda ishlatilmaydi.
- **Statistik ko'rsatkichlar** `statistics.verified: true` va manba ko'rsatilmaguncha
  bosh sahifada chiqmaydi.
- **`kind: "render"`** deb belgilangan tasvirlar avtomatik «Loyiha konsepsiyasi» yozuvi va
  ogohlantirish bilan chiqadi — hech qachon qurib bitkazilgan obyekt sifatida taqdim etilmaydi.
- **Fotosurat bo'lmasa** — «Fotosurat hozircha joylashtirilmagan» holati ko'rinadi;
  o'rniga boshqa hududning tasviri qo'yilmaydi.
- **Murojaat shakli** server xabarni diskka yozganini tasdiqlamaguncha
  «yuborildi» degan xabar **ko'rsatilmaydi**.

`npm run build` har safar shu shartlar buzilgan joylarni ro'yxat qilib ko'rsatadi.

---

## 5. Logotip

Rasmiy logotip fayli hali joylashtirilmagan — sayt vaqtincha neytral geometrik belgidan
foydalanadi va qurishda bu haqda ogohlantiradi.

Logotipni qo'shish:

1. Faylni `assets/img/logo.svg` (yoki `logo.png`) sifatida saqlang.
2. Kerak bo'lsa `content/site.json → media.logo` da yo'lni ko'rsating.
3. `assets/img/favicon.svg` va `icon-maskable.svg` fayllarini ham almashtiring.
4. `npm run build`.

Logotipning shakli, proporsiyalari, ranglari va yozuvlari o'zgartirilmaydi — sayt uni
`52×52 px` maydonda o'z nisbatini saqlab ko'rsatadi. Batafsil: [`assets/img/README.md`](assets/img/README.md).

---

## 6. Murojaat shakli va Telegram bot

Dastlab shakl **ataylab o'chirilgan**: qabul qilish tizimi ulanmagani ochiq yozilgan.

### Shaklni yoqish

1. `content/site.json → features.contactFormEndpoint` ga `"/api/contact"` yozing
   (yoki boshqaruv panelidagi «Sayt sozlamalari» bo'limidan).
2. `npm run build`
3. Serverni ishga tushiring: `npm start`

Kelgan murojaatlar `content/inbox/` katalogiga JSON fayl sifatida yoziladi va boshqaruv
panelidagi «Murojaatlar» bo'limida ko'rinadi. Bu katalog `.gitignore` da — shaxsiy
ma'lumotlar repozitoriyaga tushmaydi.

### Telegram botga ulash

Murojaatlar Telegram guruhiga darhol yetib borishi uchun:

```bash
# 1. Botni @BotFather da yaratib, tokenni oling, so'ngra:
npm run telegram:setup -- 1234567890:AAEhBOweik6ad9r_QXzR1_ABC…

# Yordamchi chatlar ro'yxatini ko'rsatadi. Keraklisini tanlab:
npm run telegram:setup -- "" -1001234567890
```

Yoki boshqaruv panelidagi **«Telegram»** bo'limidan — tokenni kiritib,
«chat_id ni aniqlash» tugmasini bosasiz.

```
Shakl → server (diskka saqlaydi) → foydalanuvchiga javob → fonda Telegramga yuborish
```

Murojaat **avval diskka saqlanadi**, keyin botga yuboriladi. Shu sababli bot ishlamasa
yoki internet uzilsa ham murojaat yo'qolmaydi — u «Murojaatlar» bo'limida ko'rinadi va
u yerdan bir bosishda qayta yuborish mumkin. Vaqtinchalik xatoliklarda 3 martagacha
avtomatik qayta uriniladi.

Batafsil yo'riqnoma: [`docs/TELEGRAM.md`](docs/TELEGRAM.md)

> ⚠️ Telegramga shaxsiy ma'lumotlar (ism, telefon, pochta) yuboriladi — chatga
> faqat vakolatli xodimlar kirishi ta'minlanishi kerak. Bot tokeni parol bilan
> teng: `.env` va `server/data/telegram.json` fayllari repozitoriyaga tushmaydi.

---

## 7. Buyruqlar

| Buyruq | Vazifasi |
|---|---|
| `npm run build` | Saytni qurish (faqat tasdiqlangan kontent) |
| `npm run build:demo` | Namunaviy ma'lumotlar bilan qurish |
| `npm run check` | Havolalar, tillar, sarlavhalar va qulaylikni tekshirish |
| `npm start` | Server: statik sayt + boshqaruv paneli (8080-port) |
| `npm run dev` | Xuddi shu, lekin cookie `Secure` bayrog'isiz (mahalliy sinov) |
| `npm run serve` | Faqat statik sayt, boshqaruv paneli o'chirilgan |
| `npm run admin:password -- <nom> <parol> [rol]` | Panel foydalanuvchisini yaratish/yangilash |
| `npm run telegram:setup -- <token> [chat_id]` | Telegram botni ulash |
| `npm run telegram:check` | Telegram sozlamalarini tekshirish (xabar yubormasdan) |
| `npm run telegram:test` | Telegramga sinov xabarini yuborish |
| `npm run clean` | `dist/` ni o'chirish |

Rollar: `admin` (hammasi), `editor` (kontent va qurish), `viewer` (faqat ko'rish).

Windows'da `npm` ishlamasa — `windows\` katalogidagi `.cmd` fayllardan foydalaning
(2-bo'limga qaraysiz).

---

## 8. Joylashtirish (deploy)

### A. Faqat statik sayt

`dist/` katalogini har qanday statik hostingga joylang: nginx, Apache, GitHub Pages,
Netlify, Cloudflare Pages, S3 + CloudFront.

```bash
npm run build && npm run check
# dist/ ni serverga ko'chirasiz
```

Talablar:

- `404.html` ni 404 sahifasi sifatida sozlang.
- Statik sayt rejimida murojaat shakli ishlamaydi —
  `features.contactFormEndpoint` ni `null` qoldiring yoki tashqi xizmat manzilini ko'rsating.
- `content/site.json → seo.canonicalOrigin` ga saytning to'liq manzilini yozing
  (`sitemap.xml` va `canonical` havolalar uchun).

### B. Server bilan (murojaatlar va boshqaruv paneli bilan)

`server/server.mjs` ni `systemd` xizmati sifatida ishga tushirib, oldiga HTTPS teskari
proksi (nginx) qo'yish tavsiya etiladi.

Namunaviy `systemd` birligi va nginx sozlamasi: [`docs/DEPLOY.md`](docs/DEPLOY.md).

Xavfsizlik bo'yicha majburiy shartlar:

- Boshqaruv paneli **faqat HTTPS** orqali ochiq bo'lsin (aks holda seans cookie'si himoyasiz).
- `/admin/` va `/api/admin/` ni IP bo'yicha yoki VPN orqali cheklash tavsiya etiladi.
- `server/data/` va `content/inbox/` kataloglarini zaxiralang va boshqalarga ochmang.

---

## 9. Tillarni boshqarish

- Interfeys matnlari: `i18n/<til>.json` (tekis kalitlar, masalan `lot.auction.open`).
- Kontent matnlari: `content/*.json` ichidagi to'rt tilli obyektlar.
- Sahifa manzillari barcha tillarda bir xil: `/uz-cyrl/areas/`, `/ru/areas/`, `/en/areas/` …
- Saytning ildiz manzili (`/`) foydalanuvchining brauzer tiliga qarab yo'naltiradi;
  JavaScript o'chirilgan bo'lsa til tanlash sahifasi ko'rinadi.

Yangi til qo'shish: `i18n/` ga fayl qo'shib, `src/lib/i18n.mjs → LOCALE_ORDER` ro'yxatini
to'ldiring va kontent fayllariga shu til kalitini qo'shing.

---

## 10. Qo'shimcha hujjatlar

- [`docs/KONTENT.md`](docs/KONTENT.md) — maydonlar bo'yicha to'liq ma'lumotnoma
- [`docs/BOSHQARUV-PANELI.md`](docs/BOSHQARUV-PANELI.md) — xodimlar uchun yo'riqnoma
- [`docs/TELEGRAM.md`](docs/TELEGRAM.md) — murojaat shaklini Telegram botga ulash
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — serverga joylashtirish
- [`docs/ARXITEKTURA.md`](docs/ARXITEKTURA.md) — texnik qarorlar va tuzilma
- [`windows/README.md`](windows/README.md) — Windows uchun yordamchi skriptlar va
  PowerShell cheklovini hal qilish

---

## 11. Huquqiy asos

Direksiya O'zbekiston Respublikasi Prezidentining **PQ-220** qarori asosida tashkil etilgan.
Hujjat matni: <https://lex.uz/docs/8263817>

Aukcion savdolari va to'lovlar Direksiya saytida emas, **E-auksion** elektron savdo
platformasida amalga oshiriladi.
