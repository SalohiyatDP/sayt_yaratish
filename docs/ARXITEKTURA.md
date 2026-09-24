# Arxitektura va texnik qarorlar

## 1. Asosiy tanlov: bog'liqliksiz statik generator

Sayt **hech qanday npm paketiga bog'liq emas**. Faqat Node.js 20.11+ kerak.

**Nima uchun:**

- **Umri uzoq.** Davlat muassasasi sayti yillar davomida ishlaydi. Bog'liqliklar yo'q
  bo'lsa, xavfsizlik yangilanishlari, buzilgan versiyalar va "npm audit" muammolari ham yo'q.
- **Har qanday muhitda qurilaved.** Internetga kirish cheklangan ichki serverda ham
  `node src/build.mjs` ishlaydi.
- **Tezkorlik.** Natija — oddiy HTML. Sahifa ochilishi uchun JS framework yuklanishi
  kutilmaydi. Barcha CSS ≈ 73 KB, barcha JS ≈ 65 KB.
- **Barqarorlik.** Statik fayllarni har qanday platformaga joylash mumkin: nginx,
  GitHub Pages, S3, ichki server.

**Narxi:** xarita, galereya, taqqoslash va qidiruv kabi imkoniyatlar qo'lda yozildi.
Bu kod `assets/js/` da, izohlar bilan.

---

## 2. Ma'lumot oqimi

```
content/*.json  ──┐
i18n/*.json     ──┼──►  src/build.mjs  ──►  dist/
assets/         ──┘            │              ├── <til>/…/index.html
                               │              ├── data/lots-<til>.json
                               │              ├── data/search-<til>.json
                               │              ├── sitemap.xml, robots.txt
                               │              ├── manifest.webmanifest, sw.js
                               │              └── assets/…
                               │
                    validateContent()  ──►  ogohlantirishlar ro'yxati
```

- **Yagona manba** — `content/`. Sayt hech qanday ma'lumotni kod ichida saqlamaydi.
- **Brauzer uchun ma'lumot** — `dist/data/` ga alohida JSON sifatida chiqariladi
  (xarita, qidiruv va taqqoslash shulardan foydalanadi).
- **Server** (`server/server.mjs`) `content/` ni tahrirlaydi va `src/build.mjs` ni
  ishga tushiradi. Ommaviy sayt har doim statik fayllardan tarqatiladi.

---

## 3. Ko'p tillilik

- Tillar: `uz` (lotin), `uz-cyrl` (kirill — asosiy), `ru`, `en`.
- Har bir til uchun **alohida statik sahifalar** quriladi — SEO va tezkorlik uchun.
  Til almashtirish brauzerda qayta chizishni talab qilmaydi.
- URL segmentlari barcha tillarda bir xil: `/ru/areas/<slug>/`, `/en/areas/<slug>/`.
  Bu havolalarni barqaror qiladi va `hreflang` ni soddalashtiradi.
- `slug` lotda bitta — barcha tillarda bir xil. Shu sababli havola tilni almashtirganda
  ham amal qiladi.
- Interfeys matnlari `i18n/` da tekis kalitlar bilan; kontent matnlari to'rt tilli
  obyektlarda.
- Zaxira tartibi: so'ralgan til → kirill → lotin → rus → ingliz → birinchi bo'sh bo'lmagan.

---

## 4. Xavfsiz HTML yasash

`src/lib/util.mjs` da `html` tagli shablon funksiyasi:

```js
html`<p>${userValue}</p>`     // userValue avtomatik escape qilinadi
html`<div>${html`<b>x</b>`}</div>`  // ichki html`` natijasi qayta escape qilinmaydi
raw('<b>ishonchli</b>')       // ataylab escape qilinmaydi
```

Bu XSS xatolarining butun bir sinfini yo'q qiladi: qiymatni escape qilishni "esdan
chiqarish" mumkin emas — buning uchun ataylab `raw()` yozish kerak.

Boshqaruv panelidan kiritilgan HTML (`description`, `news.body`) `sanitizeHtml()` orqali
o'tadi: ruxsat etilgan teglar ro'yxati, `on*` atributlari olib tashlanadi,
`javascript:` havolalar bloklanadi, `<script>`/`<iframe>` mazmuni butunlay o'chiriladi.

---

## 5. Xarita moduli (`assets/js/map.js`)

Tashqi kutubxonasiz yozilgan slippy-map:

- **Proyeksiya:** Web Mercator (EPSG:3857), plitka o'lchami 256 px.
- **Plitkalar:** `{z}/{x}/{y}` shablonli har qanday raster manba (odatiy — OpenStreetMap).
  `<img>` elementlari `Map` ichida keshlanadi; ko'rinmaydiganlari o'chiriladi.
- **Surish:** Pointer Events (sichqoncha va sensor bir xil ishlaydi), `requestAnimationFrame`
  bilan silliq chizish.
- **Masshtab:** g'ildirak (ko'rsatgich ostidagi nuqta atrofida), tugmalar, `+`/`−` klavishlari.
- **Klaviatura:** yo'naltiruvchi tugmalar bilan surish, `Esc` bilan oynani yopish.
- **Chegara konturi:** SVG `<polygon>`, nuqtalar har chizishda qayta hisoblanadi.
  Berilgan koordinatalar **o'zgartirilmaydi va soddalashtirilmaydi**.
- **Xatolik holati:** plitkalarning 60% dan ko'pi yuklanmasa, yuqorida tasma paydo bo'ladi
  va koordinatalar matnli ro'yxatda taqdim etiladi. Xarita ishlamasa ham ma'lumot yo'qolmaydi.

Nima uchun Leaflet emas: bitta tashqi bog'liqlik + CDN ga ishonish. Bizga kerak bo'lgan
imkoniyatlar (plitkalar, markerlar, poligon, klaviatura) ≈ 400 qator kodga sig'di.

---

## 6. Brauzerdagi modullar

| Fayl | Vazifasi |
|---|---|
| `core/config.js` | `#app-config` dan sozlamalar, `t()`, `storage`, `fetchJson`, `trapFocus` |
| `core/ui.js` | mavzu, mobil menyu, til ro'yxati, nusxalash/ulashish/chop etish, «yuqoriga» |
| `core/search.js` | `Ctrl+K` qidiruv paneli (indeks bir marta yuklanadi) |
| `core/compare.js` | taqqoslash savati (`localStorage`, serverga yuborilmaydi) |
| `core/gallery.js` | lightbox — tasvir turi har doim ko'rsatiladi |
| `map.js` | xarita dvigateli |
| `catalog.js` | saralash, tartiblash, ko'rinishlar, URL bilan sinxronlash |
| `lot.js` | lot va bog'lanish sahifalaridagi yakka xaritalar |
| `viewer.js` | master-reja chizmalarini kattalashtirib ko'rish |
| `news.js` | yangiliklarni rukn bo'yicha saralash |
| `contact.js` | murojaat shakli — tekshirish va yuborish |

Barchasi ES modullari; `app.js` barcha sahifalarda, qolganlari faqat kerakli sahifada
yuklanadi. `type="module"` avtomatik `defer` bo'lgani uchun sahifa chizilishini
to'xtatmaydi.

**Progressive enhancement:** JavaScript o'chirilgan bo'lsa ham sayt o'qiladi —
barcha kartochkalar, jadvallar, matnlar va havolalar serverda chizilgan. Faqat
interaktiv qulayliklar (saralash, xarita, qidiruv) ishlamaydi.

---

## 7. Server (`server/server.mjs`)

Faqat Node.js modullari: `http`, `fs`, `path`, `crypto`, `child_process`.

**Xavfsizlik:**

| Chora | Amalga oshirilishi |
|---|---|
| Parollar | `scrypt` (N=16384, r=8, p=3), har bir foydalanuvchi uchun tasodifiy tuz |
| Seans | HMAC-SHA256 bilan imzolangan cookie, `HttpOnly`, `SameSite=Strict`, `Secure`, 8 soat |
| CSRF | `GET` dan boshqa barcha so'rovlarda `X-Requested-With: direksiya-admin` sarlavhasi majburiy |
| Urinishlarni cheklash | Kirish: 15 daqiqada 8 marta. Murojaat: 10 daqiqada 5 marta |
| Vaqt bo'yicha tahlil | Foydalanuvchi topilmasa ham parol hisoblanadi; `timingSafeEqual` |
| Katalogdan chiqish | Barcha yo'llar `path.resolve` bilan tekshiriladi |
| Fayl yuklash | Ruxsat etilgan kengaytmalar ro'yxati, 25 MB cheklov, nom tozalanadi |
| SVG | `Content-Security-Policy: default-src 'none'` bilan tarqatiladi |
| Rollar | `admin` / `editor` / `viewer` |
| Zaxira | Har bir saqlashdan oldin avtomatik (oxirgi 20 versiya) |
| IP | Murojaat yozuvida IP xeshlangan holda saqlanadi, ochiq emas |

Murojaat faylga **yozilgandan keyin** `201 { ok: true, id }` qaytariladi. Yozish
muvaffaqiyatsiz bo'lsa `500 { ok: false, error: "not_saved" }` — brauzer esa
foydalanuvchiga xabar saqlanmaganini ochiq aytadi.

---

## 8. Ma'lumot ishonchliligi kodda qanday ta'minlangan

Bu talab kodning bir necha qatlamiga singdirilgan:

1. **Normalizatsiya** (`src/lib/content.mjs`) — `auction.verified !== true` bo'lsa narx,
   sana va huquq turi ma'lumot obyektiga **umuman kirmaydi**. Shablon ularni
   chiqarishni "esdan chiqarishi" mumkin emas, chunki ular yo'q.
2. **Havola tekshiruvi** — `lotUrl` `https?://` bilan boshlanmasa `null` bo'ladi;
   platformaning umumiy manziliga teng bo'lsa, `validateContent()` uni olib tashlaydi
   va ogohlantiradi.
3. **Shablonlar** — `kind: "render"` tasvirlar alohida bo'limda, ogohlantirish bilan.
   Fotosurat yo'q bo'lsa `mediaPlaceholder()` ochiq holat chiqaradi.
4. **Demo ajratilishi** — namunaviy kontent alohida katalogda (`content/demo/`) va faqat
   `--demo` bayrog'i bilan qo'shiladi; har bir yozuvda «DEMO» nishoni, sahifa yuqorisida banner.
5. **Qurish ogohlantirishlari** — yetishmayotgan koordinata, fotosurat, havola, statistika
   manbasi va logotip har qurishda ro'yxat qilinadi va `dist/build-info.json` ga yoziladi
   (boshqaruv paneli ularni ko'rsatadi).

---

## 9. Qulaylik (accessibility)

- Semantik belgilar: `<header> <nav> <main> <article> <aside> <footer>`, to'g'ri sarlavha
  ierarxiyasi (har sahifada bitta `<h1>`).
- Asosiy mazmunga o'tish havolasi (`.skip-link`).
- Barcha interaktiv elementlar `<button>` yoki `<a>`; klaviatura bilan ishlaydi.
- Modal oynalarda fokus qulfi (`trapFocus`) va `Esc` bilan yopish; yopilganda fokus
  chaqirgan elementga qaytadi.
- `aria-pressed`, `aria-expanded`, `aria-current`, `aria-live`, `role="status"`.
- Ranglar kontrasti WCAG 2.1 AA; `prefers-contrast: more` uchun qo'shimcha qoidalar.
- `prefers-reduced-motion: reduce` — barcha animatsiyalar o'chiriladi.
- Har bir rasmda `alt`; bezak tasvirlari `aria-hidden`.
- `npm run check` `alt` atributi yo'q rasmlarni va `<h1>` yo'q sahifalarni xatolik
  sifatida qaytaradi.

---

## 10. Chop etish

`main.css` oxirida to'liq chop etish uslublari: navigatsiya, tugmalar, xarita boshqaruvi
va modal oynalar yashiriladi; lot passporti va taqqoslash jadvali bir ustunga tushadi;
tashqi havolalar yonida manzil chiqadi. Lot sahifasini `Ctrl+P` bilan hujjat sifatida
saqlash mumkin.

---

## 11. Kelgusi uchun mumkin bo'lgan yaxshilanishlar

Bular ataylab qilinmadi — talab va ma'lumot aniqlashtirilgandan keyin qo'shilishi mumkin:

- Rasmlarni avtomatik o'lchamlarga bo'lish (`srcset`) — hozir yuklashdan oldin qo'lda
  siqish tavsiya etiladi.
- E-auksion bilan avtomatik integratsiya (lot holatini API orqali sinxronlash).
- Murojaatlar bo'yicha elektron pochta xabarnomasi (SMTP sozlamalari kerak).
- Kadastr ma'lumotlarini GeoJSON sifatida import qilish.
- Interaktiv master-reja: zonalarni xaritada bosib ko'rish.
