# Kontent ma'lumotnomasi

Barcha ma'lumotlar `content/` katalogidagi JSON fayllarda saqlanadi. Ularni boshqaruv
paneli orqali yoki matn muharririda tahrirlash mumkin. Har bir faylda `_note`,
`_template` va `_fieldGuide` maydonlari bor — ular saytda ko'rsatilmaydi.

## Ko'p tilli qiymat

```json
{ "uz-cyrl": "…", "uz": "…", "ru": "…", "en": "…" }
```

Tanlangan tilda matn bo'lmasa: kirill → lotin → rus → ingliz tartibida zaxiraga o'tadi.
Hech biri bo'lmasa — «Ma'lumot hozircha joylashtirilmagan».

---

## 1. `lots.json` — hududlar va lotlar

| Maydon | Turi | Izoh |
|---|---|---|
| `id` | matn | Yozuvning ichki identifikatori. Panel avtomatik beradi. O'zgartirmang. |
| `slug` | matn | Sahifa manzili: `/uz-cyrl/areas/<slug>/`. Nashrdan keyin o'zgartirish havolalarni buzadi. |
| `lotNumber` | matn | Rasmiy hujjatdagi lot raqami. |
| `name` | ko'p tilli | Hudud yoki lot nomi. **Majburiy.** |
| `district` | id | `taxonomies.json → districts`. |
| `areaType` | id | `mountain` (tog'li hudud), `river` (daryo bo'yi), `reservoir` (suv ombori atrofi). |
| `location` | ko'p tilli | Joylashuvning matnli tavsifi. |
| `coordinates` | `{lat, lng}` | **Faqat haqiqiy geodezik koordinatalar.** Bo'sh bo'lsa hudud xaritada ko'rsatilmaydi. |
| `boundary` | `[[lat,lng], …]` | Kadastr chegarasi konturi, kamida 3 nuqta. Berilgan konturni o'zgartirmang, soddalashtirmang. |
| `cadastreNumber` | matn | Kadastr raqami. |
| `areaHa` / `areaSotix` | son | Maydon gektarda / sotixda. |
| `tourismDirections` | id massivi | `taxonomies.json → tourismDirections`. |
| `status` | id | `study`, `masterplan`, `auction-prep`, `auction`, `auction-closed`. |
| `shortDescription` | ko'p tilli | Kartochkada ko'rinadi (≈160 belgi). |
| `description` | ko'p tilli | To'liq tavsif. Cheklangan HTML ruxsat etiladi. |
| `media` | massiv | Tasvirlar — pastda batafsil. |
| `masterplanId` | id | Bog'liq master-reja. |
| `plannedObjects`, `services`, `infrastructure`, `requirements`, `restrictions` | ko'p tilli massiv | Ro'yxatlar. |
| `access` | ko'p tilli | Kirish yo'li. |
| `auction` | obyekt | Aukcion — pastda batafsil. |
| `documents` | massiv | Yuklab olinadigan fayllar. |
| `updatedAt` | `YYYY-MM-DD` | Ma'lumot yangilangan sana. |
| `published` | mantiqiy | `false` — qoralama, faqat panelda ko'rinadi. Panelda yaratilgan yozuvda sukut bo'yicha `true`. |
| `demo` | mantiqiy | `true` — namunaviy yozuv, «DEMO» nishoni bilan chiqadi. |

### `media` elementi

```json
{
  "kind": "photo",
  "src": "/assets/uploads/lots/hudud-1-abc123.jpg",
  "caption": { "uz-cyrl": "…", "uz": "…", "ru": "…", "en": "…" },
  "alt":     { "uz-cyrl": "…", "uz": "…", "ru": "…", "en": "…" },
  "date": "2026-05-14",
  "author": "Foto muallifi"
}
```

`kind` qiymatlari:

| Qiymat | Saytda qanday chiqadi |
|---|---|
| `photo` | «Haqiqiy fotosurat» — hududning mavjud holati bo'limida. |
| `render` | «Loyiha konsepsiyasi» — alohida bo'limda, ogohlantirish bilan. Qurib bitkazilgan obyekt sifatida taqdim etilmaydi. |
| `scheme` | «Chizma» — konsepsiya bo'limida. |

`alt` — tasvirni ko'rmaydigan foydalanuvchilar uchun matnli tavsif; to'ldirilishi tavsiya etiladi.

### `auction` obyekti

```json
{
  "status": "announced",
  "announcementDate": "2026-08-01",
  "startDate": "2026-09-15",
  "startPrice": 480000000,
  "currency": "UZS",
  "rightType": "lease-right",
  "rightTypeText": { "uz-cyrl": "Ижара ҳуқуқи", "uz": "Ijara huquqi", "ru": "Право аренды", "en": "Lease right" },
  "lotUrl": "https://e-auksion.uz/…",
  "verified": true
}
```

**Muhim qoidalar:**

- `verified: false` bo'lsa sana, narx va huquq turi saytda **umuman ko'rsatilmaydi** —
  o'rniga «Aukcion ma'lumotlari hali rasmiy tasdiqlanmagan» yoziladi.
- `lotUrl` ga **aynan shu lotning** E-auksion sahifasi yoziladi. Bo'sh bo'lsa tugma faolsiz
  bo'lib, sababi ochiq tushuntiriladi. Platformaning umumiy manzilini yozsangiz, generator
  buni aniqlab havolani olib tashlaydi va ogohlantiradi.
- `rightTypeText` — rasmiy hujjatdagi **aniq ibora**. Umumiy «yer sotiladi» iborasidan
  foydalanish man etiladi.

---

## 2. `masterplans.json`

| Maydon | Izoh |
|---|---|
| `status` | `concept` (loyiha konsepsiyasi), `in-development` (ishlab chiqilayotgan reja), `approved` (tasdiqlangan mastеr-reja). Sayt shu holatga qarab ogohlantirish matnini o'zi qo'yadi. |
| `zones` | `[{ name, purpose, areaHa, color }]` — funksional zonalar. |
| `explication` | `[{ no, name, areaM2, capacity, note }]` — obyektlar eksplikatsiyasi. |
| `solutions` | `pedestrian`, `transport`, `parking`, `landscaping`, `engineering` — loyiha yechimlari. |
| `sheets` | `[{ src, title, kind }]` — chizmalar; saytda kattalashtirib ko'rish mumkin. |
| `documents` | `[{ title, src, sizeBytes, format }]` — PDF va boshqa fayllar. |
| `lotIds` | Rejaga kiruvchi lotlar. |
| `approvedBy`, `approvalDocument`, `approvalDate` | Tasdiqlash ma'lumotlari. |

---

## 3. `news.json`

| Maydon | Izoh |
|---|---|
| `category` | `study`, `masterplan`, `meeting`, `auction`, `official`. |
| `date` | `YYYY-MM-DD`. **Sana noma'lum bo'lsa, yangilikni nashr etmang.** |
| `title`, `lead`, `body` | Sarlavha, qisqa mazmun, matn. |
| `body` | Cheklangan HTML: `<p> <br> <strong> <em> <ul> <ol> <li> <a href> <h3> <h4> <blockquote> <table>`. Boshqa teglar tozalanadi. |
| `cover` | `{ src, kind, alt, caption }`. |
| `gallery` | `media` bilan bir xil tuzilma. |
| `relatedLotIds`, `relatedMasterplanIds` | Bog'liq materiallar. |
| `sourceUrl` | Rasmiy manba havolasi. |

> Bo'lib o'tmagan tadbir, uchrashuv yoki sanani kiritish qat'iyan man etiladi.

---

## 4. `site.json`

Asosiy bo'limlar:

- `institution` — to'liq nomi, qisqa nomi, juda qisqa nomi, huquqiy asos (PQ-220).
- `mission`, `slogan` — vazifasi va shiori.
- `contacts` — manzil, telefonlar, pochta, ish vaqti, qabul vaqtlari, koordinatalar,
  ijtimoiy tarmoqlar. **Bo'sh qoldirilgan maydonlar saytda ko'rsatilmaydi.**
- `eauction` — platforma nomi, umumiy manzili va rasmiy izoh.
- `statistics` — `verified: true` va `source` bo'lmaguncha bosh sahifada chiqmaydi.
- `leadership`, `structure`, `documents` — rahbariyat, tuzilma, me'yoriy hujjatlar.
- `media` — `logo`, `logoDark`, `heroImage`, `ogImage`.
- `features`:
  - `contactFormEndpoint` — `null` bo'lsa murojaat shakli faolsiz va bu holat ochiq yoziladi.
    Shu server ishlatilsa: `"/api/contact"`.
  - `contactFormFallbackEmail` — zaxira pochta.
  - `mapTileUrl`, `mapTileAttribution` — xarita plitkalari manbasi.
  - `analyticsSnippet` — tahlil tizimi kodi (ixtiyoriy).
- `seo.canonicalOrigin` — saytning to'liq manzili, masalan `https://example.uz`.

---

## 5. `taxonomies.json`

Ma'lumotnoma ro'yxatlar: tumanlar, hudud turlari, lot holatlari, ish bosqichlari,
turizm yo'nalishlari, huquq turlari, master-reja holatlari.

Yangi qiymat qo'shsangiz `id` ni lotin harflarida yozing va nomini to'rt tilda to'ldiring.
`id` larni **o'zgartirmang** — ular lotlar va master-rejalarda ishlatiladi.

---

## 6. `pages.json`

Bosh sahifa, «Direksiya haqida», «Investorlarga» (5 qadam va ko'p so'raladigan savollar),
«Hududlar va lotlar», «Master-rejalar», «Yangiliklar», «Bog'lanish» va «Qulaylik»
bo'limlarining matnlari.

Tuzilmani (kalitlarni) o'zgartirmang — faqat matnlarni tahrirlang. Boshqaruv panelida bu
fayl JSON ko'rinishida tahrirlanadi; saqlashdan oldin JSON to'g'riligi tekshiriladi va
serverda avtomatik zaxira nusxa olinadi.

---

## 7. Tekshirish

```bash
npm run build     # kontentdagi muammolar ro'yxati chiqadi
npm run check     # havolalar, tillar, sarlavhalar, alt atributlari
```

Qurish quyidagi hollarda ogohlantiradi:

- takrorlangan `slug`;
- noma'lum tuman / hudud turi / holat;
- `auction.lotUrl` da platformaning umumiy manzili;
- «Auksionda» holatidagi lotda E-auksion havolasi yo'q;
- koordinatalar yoki haqiqiy fotosurat yo'q;
- ko'rsatilgan media/hujjat fayli diskda topilmadi;
- statistika tasdiqlanmagan;
- murojaat shakli ulanmagan;
- logotip yoki sayt manzili ko'rsatilmagan.
