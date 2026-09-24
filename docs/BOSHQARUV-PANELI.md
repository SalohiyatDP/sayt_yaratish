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
- **Rahbariyat** — ism-familiya, lavozim, telefon, pochta, qabul vaqtlari.
  «Direksiya haqida» sahifasida ko'rinadi. Faqat kadrlar bo'limi tasdiqlagan
  ma'lumotlarni kiriting.
- **Tuzilma** — muassasa bo'limlari va ularning vazifasi.
- **Me'yoriy hujjatlar** — tashqi havola (masalan `lex.uz`) yoki yuklangan PDF.
- **Bosh sahifa tasviri** — katta fotosurat. **Faqat Namangan viloyatining
  haqiqiy fotosuratidan foydalaning.** Tasvir qo'yilmasa, bosh ekranda abstrakt
  geometrik bezak ishlatiladi — u hech qanday joyni tasvirlamaydi.
- **Texnik sozlamalar**:
  - *Murojaatlarni qabul qilish manzili* — bu serverda `/api/contact`.
    Bo'sh bo'lsa shakl faolsiz bo'lib, sababi saytda ochiq yoziladi.
  - *Saytning to'liq manzili* — `sitemap.xml` va `canonical` havolalar uchun.
  - *Logotip* — faylni shu yerdan yuklash mumkin.

Bo'sh qoldirilgan ro'yxatlar (rahbariyat, tuzilma, hujjatlar) saytda umuman
ko'rsatilmaydi — o'rniga «Ma'lumot hozircha joylashtirilmagan» chiqadi.

---

## 7. Sahifa matnlari

Bosh sahifa, «Direksiya haqida», «Investorlarga» va boshqa bo'limlarning
matnlari. Yuqorida beshta yorliq bor:

| Yorliq | Nima tahrirlanadi |
|---|---|
| **Bosh sahifa** | Katta sarlavha, qisqa izoh, bo'lim sarlavhalari |
| **Direksiya haqida** | Kirish matni, maqsad, faoliyat yo'nalishlari, yondashuv tamoyillari |
| **Investorlarga** | 5 qadamli yo'riqnoma, ogohlantirish, ko'p so'raladigan savollar |
| **Boshqa bo'limlar** | Hududlar, master-rejalar, yangiliklar va bog'lanish sahifalari sarlavhalari |
| **Qulaylik** | Qulaylik sahifasi va yechimlar ro'yxati |

Barcha yorliqlar **birga saqlanadi** — «Saqlash» tugmasi bir marta bosilsa
kifoya.

Ro'yxatlarda (faoliyat yo'nalishlari, qadamlar, savollar) `↑` va `↓` tugmalari
bilan tartibni o'zgartirish, `✕` bilan o'chirish mumkin.

**Investor qadamlaridagi «Bo'limga havola»** maydoni ixtiyoriy: biror bo'lim
tanlansa, qadam ostida shu bo'limga o'tish havolasi chiqadi.

> «Ogohlantirish» matnida soliq imtiyozlari, ijara muddatlari yoki kafolatlangan
> daromad haqida tasdiqlanmagan va'da yozish man etiladi.

---

## 7a. Ma'lumotnomalar

Tumanlar, hudud turlari, turizm yo'nalishlari, lot holatlari, master-reja
holatlari, huquq turlari va ish bosqichlari ro'yxatlari. Bular lotlarda,
master-rejalarda va saytdagi filtrlarda tanlanadi.

**Muhim qoidalar:**

- **Identifikator (id)** mavjud yozuvlarda **o'zgartirilmaydi** — lotlar unga
  bog'langan. Maydon kulrang va faol emas.
- Yangi yozuv qo'shganda id ni o'zingiz kiritasiz: faqat lotin harflari,
  raqam va chiziqcha.
- **Nomlarni** to'rt tilda erkin tahrirlash mumkin — bu xavfsiz amal.
- **«tizimli»** deb belgilangan yozuvlar saytning ishlash mantig'ida
  ishlatiladi (masalan lot holatlari) — ularni o'chirmaslik tavsiya etiladi.
- Yozuvni o'chirishdan oldin u biror lotda ishlatilmayotganiga ishonch hosil
  qiling. Ishlatilgan bo'lsa, saytda «Ko'rsatilmagan» deb chiqadi.

Saqlashda ikki xato tekshiriladi: **id to'ldirilmagan** va **id takrorlangan**.
Xato bo'lsa saqlanmaydi va nimani tuzatish kerakligi aytiladi.

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

## 9a. Telegram

Murojaatlar Telegram guruhiga kelishi uchun shu bo'limda sozlanadi.

- **Joriy holat** jadvalida bot, chat, murojaat shaklining holati ko'rinadi.
- **Bot tokeni** va **chat_id** ni faqat `admin` roli kiritadi.
- **«chat_id ni aniqlash»** tugmasi bot ko'rgan chatlar ro'yxatini chiqaradi —
  keraklisini bosasiz, qiymat o'zi qo'yiladi.
- **«Sinov xabarini yuborish»** bilan ulanishni tekshirasiz.
- **«Telegramga yuborishni vaqtincha to'xtatish»** — murojaatlar qabul
  qilinishda va qutida saqlanishda davom etadi, lekin botga yuborilmaydi.

To'liq yo'riqnoma (bot yaratish, guruh tanlash): [`docs/TELEGRAM.md`](TELEGRAM.md)

> Telegramga shaxsiy ma'lumotlar (ism, telefon, pochta) yuboriladi. Guruh
> **yopiq** bo'lishi va unda faqat vakolatli xodimlar bo'lishi kerak.

---

## 9b. Foydalanuvchilar

Faqat `admin` roli uchun.

- Jadvalda barcha foydalanuvchilar, rollari va oxirgi o'zgartirish sanasi.
- **«Rolni saqlash»** — rolni o'zgartirish.
- **«Parolni tiklash»** — foydalanuvchi parolini unutganda. Yangi parolni
  xavfsiz yo'l bilan (og'zaki yoki xavfsiz kanal orqali) yetkazing.
- **«O'chirish»** — o'zingizni va yagona administratorni o'chirish mumkin emas.
- Pastda yangi foydalanuvchi yaratish shakli. Parol kamida 12 belgi.

| Rol | Imkoniyatlari |
|---|---|
| `admin` | Hammasi: kontent, foydalanuvchilar, Telegram, murojaatlarni o'chirish |
| `editor` | Kontentni tahrirlash, fayl yuklash, saytni qurish |
| `viewer` | Faqat ko'rish |

Parollar serverda `scrypt` algoritmi bilan xeshlanadi — hech qayerda ochiq
saqlanmaydi va panelda ko'rsatilmaydi.

**Mening parolim** bo'limida har qanday rol o'z parolini o'zgartira oladi
(joriy parolni kiritish talab qilinadi).

Administrator paroli butunlay yo'qolsa, serverda buyruq orqali tiklanadi:

```bash
node server/tools/hash-password.mjs <nom> '<yangi-parol>' admin
```

---

## 10. Saytni qurish

- «Saytni qurish» — odatiy rejim, faqat tasdiqlangan kontent bilan.
- «DEMO rejimida qurish» — namunaviy ma'lumotlar qo'shiladi (sinov uchun).
  **Ishlab turgan saytda ishlatilmaydi.** Agar sayt demo rejimida qurilgan bo'lsa,
  bo'limda qizil ogohlantirish ko'rinadi.
- Qurish jurnali va ogohlantirishlar ro'yxati shu yerda ko'rsatiladi. Ogohlantirishlarga
  e'tibor bering — ular yetishmayotgan ma'lumotni ko'rsatadi.

### Zaxira nusxalar

Shu bo'limning pastida **«Zaxira nusxalar»** jadvali bor.

Kontentni har saqlaganingizda avvalgi holat avtomatik zaxiraga olinadi (har
bo'lim uchun oxirgi 20 versiya). Xato o'zgartirish kiritilgan bo'lsa,
**«Tiklash»** tugmasi bilan qaytarish mumkin.

Tiklashda joriy holat ham zaxiraga olinadi — ya'ni bu amalni ham ortga
qaytarish mumkin. Tiklangandan keyin **saytni qayta qurish** kerak.

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
«Saytni qurish» bo'limidagi **«Zaxira nusxalar»** jadvalidan avvalgi holatni
tiklang. Har saqlashdan oldin avtomatik zaxira olinadi (oxirgi 20 versiya).

**Ma'lumotnomada id maydoni faol emas.**
Bu ataylab: mavjud identifikatorni o'zgartirish unga bog'langan lotlarni
buzadi. Nomni erkin o'zgartirishingiz mumkin.

**Parolni unutdim.**
Administrator «Foydalanuvchilar» bo'limidan tiklab beradi. Administratorning
o'zi unutgan bo'lsa, serverda buyruq orqali tiklanadi.
