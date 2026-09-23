# Boshqaruv paneli — xodimlar uchun yo'riqnoma

Boshqaruv paneli — Direksiya xodimlari uchun yopiq bo'lim. Unda hududlar, lotlar,
master-rejalar, yangiliklar, fayllar va murojaatlar bilan ishlanadi.

**Manzili:** `https://<sayt-manzili>/admin/`

---

## 1. Kirish

1. Foydalanuvchi nomi va parolni kiriting.
2. Seans **8 soatdan** keyin avtomatik tugaydi.
3. Parolni 8 marta xato kiritsangiz, 15 daqiqaga bloklanadi.

Foydalanuvchi serverda yaratiladi (tizim administratori bajaradi):

```bash
npm run admin:password -- <foydalanuvchi> <parol> [admin|editor|viewer]
```

| Rol | Imkoniyatlari |
|---|---|
| `admin` | Hammasi, shu jumladan murojaatlarni butunlay o'chirish. |
| `editor` | Kontentni tahrirlash, fayl yuklash, saytni qayta qurish. |
| `viewer` | Faqat ko'rish. |

> Parol kamida 12 belgidan iborat bo'lishi kerak va xat yoki messenjer orqali yuborilmaydi.

---

## 2. Ish tartibi

```
Tahrirlash  →  Saqlash  →  «Saytni qurish»  →  Ommaviy saytda ko'rinadi
```

**Muhim:** «Saqlash» ma'lumotni faylga yozadi, lekin ommaviy sayt **darhol
o'zgarmaydi**. O'zgarishlarni ko'rsatish uchun «Saytni qurish» bo'limiga o'tib
«Saytni qurish» tugmasini bosing (bir necha soniya).

Har bir saqlashdan oldin server avtomatik zaxira nusxa oladi (oxirgi 20 versiya,
`server/data/backups/`).

---

## 3. Hududlar va lotlar

### Yangi lot qo'shish

1. «Hududlar va lotlar» → «+ Yangi lot».
2. **Nom** — kamida bitta tilda to'ldiring. Tillar orasida `ЎЗ / UZ / РУ / EN` tugmalari
   bilan almashiladi; to'ldirilgan til yonida yashil nuqta paydo bo'ladi.
3. **Manzil (slug)** nomdan avtomatik yasaladi. Nashrdan keyin uni o'zgartirish
   tashqi havolalarni buzadi — zarur bo'lmasa tegmang.
4. Tuman, hudud turi va holatni tanlang.
5. Maydonni gektarda kiriting.
6. **Koordinatalar** — faqat haqiqiy geodezik qiymatlar. `41.074200, 71.813500`
   ko'rinishidagi juftlikni pastdagi maydonga nusxalab qo'yish ham mumkin.
   Koordinata kiritilmasa, hudud xaritada ko'rsatilmaydi (bu normal holat).
7. **Chegara konturi** — kadastr hujjatidan olingan nuqtalar:
   `[[41.0762, 71.8105], [41.0765, 71.8168], [41.0722, 71.8172]]`.
   Nuqtalarni o'zgartirish yoki soddalashtirish man etiladi.
8. **Tasvirlar** — fayllarni maydonga tortib tashlang yoki bosib tanlang.
   Har bir tasvir uchun turini to'g'ri belgilang:
   - **Haqiqiy fotosurat** — hududning suratga olish vaqtidagi holati;
   - **Loyiha konsepsiyasi** — vizualizatsiya (saytda shu yozuv va ogohlantirish bilan chiqadi);
   - **Chizma / sxema**.
9. Nihoyat «Saytda nashr etish» katagini belgilang va «Saqlash» ni bosing.

### Aukcion bo'limi

Bu bo'lim ataylab qattiq nazorat ostida:

- **«Aukcion ma'lumotlari rasmiy tasdiqlangan»** katagi belgilanmaguncha sana,
  boshlang'ich narx va huquq turi saytda **ko'rsatilmaydi**.
- **E-auksion havolasi** — aynan shu lotning sahifasi bo'lishi kerak. Platformaning
  umumiy manzilini yozsangiz, qurishda ogohlantirish chiqadi va havola olib tashlanadi.
- Havola bo'lmasa, saytdagi tugma faolsiz bo'lib, sababi ochiq yoziladi.
- **Huquq turi** rasmiy hujjatdagi ibora bilan yoziladi. Umumiy «yer sotiladi» iborasi
  ishlatilmaydi.

### Nashr etmasdan saqlash

«Saytda nashr etish» katagi belgilanmagan yozuv faqat panelda ko'rinadi. Bu lotni
bosqichma-bosqich to'ldirish uchun qulay.

### Nusxalash

O'xshash lotlar uchun «Nusxalash» tugmasidan foydalaning — barcha maydonlar ko'chiriladi,
`id` va `slug` bo'sh qoladi, nashr holati o'chiriladi.

---

## 4. Master-rejalar

- **Hujjat holatini** to'g'ri tanlang: sayt shu asosda ogohlantirish matnini o'zi qo'yadi
  («Loyiha konsepsiyasi» / «Ishlab chiqilayotgan reja» / «Tasdiqlangan master-reja»).
- **Funksional zonalar** — nomi, vazifasi, maydoni va rangi. Rang saytdagi belgida va
  zonalar ro'yxatida ishlatiladi.
- **Eksplikatsiya** — obyektlar jadvali: raqami, nomi, maydoni (m²), sig'imi, izohi.
- **Chizmalar** — saytda kattalashtirib ko'rish mumkin (tortib surish, masshtab).
- **Hujjatlar** — PDF fayllar yuklab olish uchun.
- **Bog'liq lotlar** — reja qaysi lotlarni qamrab oladi.

---

## 5. Yangiliklar

- Faqat **haqiqatda bo'lib o'tgan** ishlar va rasmiy e'lonlar kiritiladi.
- Sana majburiy. Sana noma'lum bo'lsa yangilikni nashr etmang.
- Matnda cheklangan HTML ishlatiladi: `<p> <strong> <em> <ul> <ol> <li> <a href> <h3>`.
  Boshqa teglar saqlashda tozalanadi.
- Muqova tasviri turini to'g'ri belgilang (fotosurat yoki konsepsiya).

---

## 6. Sayt sozlamalari

- **Muassasa** — to'liq va qisqa nomlar, vazifa, shior.
- **Bog'lanish rekvizitlari** — manzil, telefonlar, pochta, ish va qabul vaqtlari,
  bino koordinatalari, ijtimoiy tarmoqlar. Bo'sh maydonlar saytda ko'rsatilmaydi.
- **E-auksion** — platforma nomi, umumiy manzili va rasmiy izoh.
- **Statistik ko'rsatkichlar** — «rasmiy tasdiqlangan» katagi belgilanmaguncha va manba
  ko'rsatilmaguncha bosh sahifada **chiqmaydi**. Taxminiy raqam kiritish man etiladi.
- **Texnik sozlamalar**:
  - *Murojaatlarni qabul qilish manzili* — bu serverda `/api/contact`.
    Bo'sh bo'lsa shakl faolsiz bo'lib, sababi saytda ochiq yoziladi.
  - *Saytning to'liq manzili* — `sitemap.xml` va `canonical` havolalar uchun.
  - *Logotip* — faylni shu yerdan yuklash mumkin.

---

## 7. Sahifa matnlari

Bosh sahifa, «Direksiya haqida», «Investorlarga» va boshqa bo'limlarning matnlari
JSON ko'rinishida tahrirlanadi.

- Har bir matn to'rt tilda: `"uz-cyrl"`, `"uz"`, `"ru"`, `"en"`.
- **Kalitlarni (chap tomondagi nomlarni) o'zgartirmang** — faqat qo'shtirnoq ichidagi
  matnlarni yozing.
- Maydon tagida JSON to'g'riligi ko'rsatiladi. Xato bo'lsa saqlash amalga oshmaydi.

---

## 8. Murojaatlar

- Kelgan murojaatlar ro'yxati, holati va ichki izoh.
- Holatlar: *Yangi*, *Ko'rib chiqilmoqda*, *Javob berilgan*, *Arxivlangan*.
- Ichki izoh faqat panelda ko'rinadi, saytda e'lon qilinmaydi.
- **Shaxsiy ma'lumotlar** faqat murojaatni ko'rib chiqish uchun ishlatiladi va uchinchi
  shaxslarga berilmaydi.
- Murojaatni butunlay o'chirish faqat `admin` roliga ruxsat etilgan.

Murojaatlar ko'rinmasa: «Sayt sozlamalari» da qabul qilish manzili to'ldirilgani va
sayt qayta qurilganini tekshiring.

---

## 9. Fayllar

- Ruxsat etilgan turlar: JPG, PNG, WEBP, AVIF, SVG, PDF, ZIP.
- Eng katta hajm: 25 MB.
- Fotosuratlarni yuklashdan oldin siqishni tavsiya etamiz (eng kengi 2000 px,
  sifat ≈ 80%) — sayt tezroq yuklanadi.
- Fayl manzilini nusxalab, boshqa joylarda ishlatish mumkin.

---

## 10. Saytni qurish

- «Saytni qurish» — odatiy rejim, faqat tasdiqlangan kontent bilan.
- «DEMO rejimida qurish» — namunaviy ma'lumotlar qo'shiladi (sinov uchun).
  **Ishlab turgan saytda ishlatilmaydi.** Agar sayt demo rejimida qurilgan bo'lsa,
  bo'limda qizil ogohlantirish ko'rinadi.
- Qurish jurnali va ogohlantirishlar ro'yxati shu yerda ko'rsatiladi. Ogohlantirishlarga
  e'tibor bering — ular yetishmayotgan ma'lumotni ko'rsatadi.

---

## 11. Tez-tez uchraydigan savollar

**O'zgarishlar saytda ko'rinmayapti.**
«Saytni qurish» bo'limidan qayta qurdingizmi? Qurmasdan o'zgarish ommaviy saytga chiqmaydi.

**«Seans tugadi» deb yozilmoqda.**
8 soat o'tgan. Qaytadan kiring; saqlanmagan o'zgarishlar yo'qoladi, shuning uchun
uzoq ishlaganda oraliq saqlab turing.

**Xaritada hudud ko'rinmayapti.**
Koordinatalar kiritilmagan yoki xato. Kenglik 41 atrofida, uzunlik 71 atrofida bo'lishi kerak.

**Fotosurat yuklanmayapti.**
Fayl turi yoki hajmini tekshiring (25 MB gacha). SVG dan tashqari boshqa vektor
formatlari qabul qilinmaydi.

**Xato saqlab qo'ydim.**
Serverda zaxira nusxalar bor: `server/data/backups/`. Tizim administratoriga murojaat qiling.
