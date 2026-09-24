# Boshqaruv paneli — xodimlar uchun yo'riqnoma

Boshqaruv paneli — Direksiya xodimlari uchun yopiq bo'lim. Unda hududlar, lotlar,
master-rejalar, yangiliklar, fayllar va murojaatlar bilan ishlanadi.

**Manzili:** `https://<sayt-manzili>/admin/`

---

## 1. Birinchi administratorni yaratish

Yangi o'rnatilgan saytda hali hech qanday foydalanuvchi bo'lmaydi. `/admin/`
sahifasini ochsangiz **«Birinchi administrator»** shakli chiqadi.

Shakl bir martalik kalit bilan himoyalangan — sayt ochiq internetda turgani
uchun begona odam o'zini administrator qilib yozib olmasligi kerak. Kalitni
ikki joydan olish mumkin:

| Qayerdan | Qanday |
|---|---|
| **Fayl** | `server/data/setup-key.txt` — hosting fayl menejeri orqali oching |
| **Jurnal (log)** | Node.js ilovasi ishga tushganda kalit jurnalga chiroyli ramka ichida yoziladi |

Kalit `NRS-XXXX-XXXX-XXXX-XXXX` ko'rinishida bo'ladi. Katta-kichik harf va
chiziqchalar farqi yo'q — nusxalab qo'yish kifoya.

So'ng foydalanuvchi nomi (3–40 belgi, lotin harflari) va parolni (kamida
12 belgi) belgilaysiz. Tugallanganda:

- foydalanuvchi `admin` roli bilan yaratiladi,
- panelga darhol kirasiz,
- **kalit fayli avtomatik o'chiriladi** — shakl boshqa ochilmaydi.

Kalitni 6 marta xato kiritsangiz, 30 daqiqaga bloklanadi.

> **Buyruq satri bor bo'lsa** shu ishni terminaldan ham qilish mumkin:
> ```bash
> npm run admin:password -- <foydalanuvchi> <parol> admin
> ```
> Bu buyruq ham sozlash kalitini o'chiradi.

Keyingi xodimlarni panelning **«Foydalanuvchilar»** bo'limidan qo'shasiz —
kalit endi kerak emas.

---

## 2. Kirish

1. Foydalanuvchi nomi va parolni kiriting.
2. Seans **8 soatdan** keyin avtomatik tugaydi.
3. Parolni 8 marta xato kiritsangiz, 15 daqiqaga bloklanadi.

| Rol | Imkoniyatlari |
|---|---|
| `admin` | Hammasi, shu jumladan murojaatlarni butunlay o'chirish. |
| `editor` | Kontentni tahrirlash, fayl yuklash, saytni qayta qurish. |
| `viewer` | Faqat ko'rish. |

> Parol kamida 12 belgidan iborat bo'lishi kerak va xat yoki messenjer orqali yuborilmaydi.

---

## 3. Ish tartibi

```
Tahrirlash  →  Saqlash  →  Ommaviy saytda ko'rinadi
```

**Saqlaganingizdan keyin boshqa hech narsa bosish kerak emas** — server saytni
o'zi qayta quradi va o'zgarish darhol ommaviy saytga chiqadi. Tugaganda
«Saqlandi va saytga chiqarildi» degan xabar ko'rinadi.

### Nashr holati

Har bir lot, master-reja va yangilikda **nashr holati** bor. U tahrirlash
oynasining eng tepasida turadi:

| Holat | Ma'nosi |
|---|---|
| 🟢 **Saytda ko'rinadi** | Saqlaganingizdan keyin ommaviy saytda chiqadi |
| 🟡 **Qoralama** | Faqat panelda turadi, saytda ko'rinmaydi |

Yangi yozuv sukut bo'yicha **«Saytda ko'rinadi»** holatida bo'ladi. Tayyor
bo'lmagan materialni «Qoralamaga olish» tugmasi bilan yashirib qo'yish mumkin.

Ro'yxatda qoralamalar uzuq chiziqli ramka va «qoralama — saytda yo'q» belgisi
bilan ajralib turadi; yonidagi **«Saytga chiqarish»** tugmasi bir bosishda
nashr etadi.

Har bir saqlashdan oldin server avtomatik zaxira nusxa oladi (oxirgi 20 versiya,
`server/data/backups/`).

---

## 4. Hududlar va lotlar

### Yangi lot qo'shish

1. «Hududlar va lotlar» → «+ Yangi lot».
2. **Nom** — kamida bitta tilda to'ldiring. Tillar orasida `ЎЗ / UZ / РУ / EN` tugmalari
   bilan almashiladi; to'ldirilgan til yonida yashil nuqta paydo bo'ladi.
3. **Manzil (slug)** nomni yozgan sari o'zi to'ldirilib boradi — unga tegish
   shart emas. Kirill harflari lotinchaga o'giriladi
   («Чодак ҳудуди» → `chodak-hududi`).

   Xohlasangiz o'zingiz ham yozishingiz mumkin; shundan keyin maydon nomga
   qarab o'zgarmaydi.

   **Saqlangan** yozuvda slug avtomatik o'zgarmaydi — bu tashqi havolalarni
   buzardi. Haqiqatan kerak bo'lsa, maydon ostidagi «Nomdan qayta yasash»
   tugmasi bor (ogohlantirish bilan).
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

## 5. Master-rejalar

- **Hujjat holatini** to'g'ri tanlang: sayt shu asosda ogohlantirish matnini o'zi qo'yadi
  («Loyiha konsepsiyasi» / «Ishlab chiqilayotgan reja» / «Tasdiqlangan master-reja»).
- **Funksional zonalar** — nomi, vazifasi, maydoni va rangi. Rang saytdagi belgida va
  zonalar ro'yxatida ishlatiladi.
- **Eksplikatsiya** — obyektlar jadvali: raqami, nomi, maydoni (m²), sig'imi, izohi.
- **Chizmalar** — saytda kattalashtirib ko'rish mumkin (tortib surish, masshtab).
- **Hujjatlar** — PDF fayllar yuklab olish uchun.
- **Bog'liq lotlar** — reja qaysi lotlarni qamrab oladi.

---

## 6. Yangiliklar

- Faqat **haqiqatda bo'lib o'tgan** ishlar va rasmiy e'lonlar kiritiladi.
- Sana majburiy. Sana noma'lum bo'lsa yangilikni nashr etmang.
- Matnda cheklangan HTML ishlatiladi: `<p> <strong> <em> <ul> <ol> <li> <a href> <h3>`.
  Boshqa teglar saqlashda tozalanadi.
- Muqova tasviri turini to'g'ri belgilang (fotosurat yoki konsepsiya).

---

## 7. Sayt sozlamalari

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

## 8. Sahifa matnlari

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

## 9. Ma'lumotnomalar

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

## 10. Murojaatlar

Saytdagi shaklda **ism-familiya, telefon raqam, xabar matni va rozilik**
majburiy. Elektron pochta ixtiyoriy. Shuning uchun har bir murojaatda javob
berish uchun telefon raqam bo'ladi.

- Kelgan murojaatlar ro'yxati, holati va ichki izoh.
- Holatlar: *Yangi*, *Ko'rib chiqilmoqda*, *Javob berilgan*, *Arxivlangan*.
- Ichki izoh faqat panelda ko'rinadi, saytda e'lon qilinmaydi.
- **Shaxsiy ma'lumotlar** faqat murojaatni ko'rib chiqish uchun ishlatiladi va uchinchi
  shaxslarga berilmaydi.
- Murojaatni butunlay o'chirish faqat `admin` roliga ruxsat etilgan.

Har bir murojaat ostida Telegramga yetkazilish holati ko'rinadi. Yetkazilmagan
bo'lsa, sababi va yechimi o'zbek tilida yoziladi hamda **«Telegramga yuborish»**
tugmasi chiqadi.

Ro'yxatda eng yangi 300 ta murojaat ko'rsatiladi; jami soni sarlavha yonida
ko'rinadi.

Murojaatlar umuman ko'rinmasa: «Sayt sozlamalari» da qabul qilish manzili
(`/api/contact`) to'ldirilganini tekshiring.

---

## 11. Fayllar

- Ruxsat etilgan turlar: JPG, PNG, WEBP, AVIF, SVG, PDF, ZIP.
- Eng katta hajm: 25 MB.
- Fotosuratlarni yuklashdan oldin siqishni tavsiya etamiz (eng kengi 2000 px,
  sifat ≈ 80%) — sayt tezroq yuklanadi.
- Fayl manzilini nusxalab, boshqa joylarda ishlatish mumkin.

---

## 12. Telegram

Murojaatlar Telegram guruhiga kelishi uchun shu bo'limda sozlanadi.

- Bo'limning tepasida **tashxis** turadi: ishlamayotgan bo'lsa, sababi va uni
  qanday tuzatish o'zbek tilida yoziladi. Tekshiruv uch bosqichda ketadi —
  tarmoq (hostingdan Telegramga chiqish bormi), bot tokeni, chat.
- **«Murojaatlarning yetkazilishi»** jadvali: jami, yetkazilgan, navbatda va
  yetkazilmagan murojaatlar soni. Navbatda turganlar bo'lsa, ularni bir bosishda
  qayta yuborish tugmasi chiqadi.
- **Joriy holat** jadvalida tarmoq, bot, chat va murojaat shaklining holati.
- **Bot tokeni** va **chat_id** ni faqat `admin` roli kiritadi.
- **«chat_id ni aniqlash»** tugmasi bot ko'rgan chatlar ro'yxatini chiqaradi —
  keraklisini bosasiz, qiymat o'zi qo'yiladi.
- **«Sinov xabarini yuborish»** bilan ulanishni tekshirasiz.
- **«Telegramga yuborishni vaqtincha to'xtatish»** — murojaatlar qabul
  qilinishda va qutida saqlanishda davom etadi, lekin botga yuborilmaydi.

> **Murojaat yo'qolmaydi.** U avval serverga yoziladi, keyin Telegramga
> yuboriladi. Telegram ishlamasa, server har 5 daqiqada o'zi qayta urinadi —
> bir hafta davomida. Sozlama keyinroq to'g'rilansa, o'shanga qadar kelgan
> murojaatlar ham yuboriladi.

To'liq yo'riqnoma (bot yaratish, guruh tanlash): [`docs/TELEGRAM.md`](TELEGRAM.md)

> Telegramga shaxsiy ma'lumotlar (ism, telefon, pochta) yuboriladi. Guruh
> **yopiq** bo'lishi va unda faqat vakolatli xodimlar bo'lishi kerak.

---

## 13. Foydalanuvchilar

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

## 14. Sayt holati va zaxira

Bu bo'lim **odatda kerak bo'lmaydi** — sayt har saqlashdan keyin o'zi qayta
quriladi. Bo'limda quyidagilar bor:

- **Oxirgi qurilish** — sana, rejim, sahifalar va yozuvlar soni.
- **Ogohlantirishlar** — yetishmayotgan ma'lumotlar ro'yxati (masalan, logotip).
- **Qo'lda qurish** — fayl serverda qo'lda o'zgartirilgan bo'lsa yoki avtomatik
  qurish xato bergan bo'lsa ishlatiladi.
- **DEMO rejimida qurish** — namunaviy ma'lumotlar qo'shiladi (faqat o'qitish va
  sinov uchun). **Ishlab turgan saytda ishlatilmaydi.** Sayt demo rejimida
  qurilgan bo'lsa, bo'limda ogohlantirish ko'rinadi.

### Zaxira nusxalar

Bo'limning pastida **«Zaxira nusxalar»** jadvali bor.

Kontentni har saqlaganingizda avvalgi holat avtomatik zaxiraga olinadi (har
bo'lim uchun oxirgi 20 versiya). Xato o'zgartirish kiritilgan bo'lsa,
**«Tiklash»** tugmasi bilan qaytarish mumkin.

Tiklashda joriy holat ham zaxiraga olinadi — ya'ni bu amalni ham ortga
qaytarish mumkin.

---

## 15. Tez-tez uchraydigan savollar

**O'zgarishlar saytda ko'rinmayapti.**
Yozuv **qoralama** holatida qolmaganini tekshiring — tahrirlash oynasining
tepasidagi holat «Saytda ko'rinadi» bo'lishi kerak. Ro'yxatda qoralamalar
«qoralama — saytda yo'q» belgisi bilan turadi.

Yangilik uchun yana bitta shart bor: **sana kiritilgan bo'lishi kerak**.
Sanasi yo'q yangilik ro'yxatda oxirida qoladi.

Agar holat to'g'ri bo'lsa ham ko'rinmasa, «Sayt holati va zaxira» bo'limiga
kirib «Saytni qurish» tugmasini bosing va jurnalda xatolik yo'qligini
tekshiring.

**Yangilikni saqladim, lekin saytda yo'q.**
Saqlashdan keyin sayt o'zi qayta quriladi — «Saqlandi va saytga chiqarildi»
xabari chiqishi kerak. Chiqmasa, yozuv **qoralama** holatida qolgan bo'lishi
mumkin (tahrirlash oynasining tepasidagi holatga qarang).

**Panel yangilanmagan ko'rinadi (eski tugmalar, eski matnlar).**
Brauzer eski faylni keshdan olgan. `Ctrl+Shift+R` (macOS: `Cmd+Shift+R`) bilan
majburiy yangilang. Takrorlansa, hosting nginx sozlamalarida `/admin/` yo'li
keshlanmayotganini tekshirish kerak — [`docs/DEPLOY.md`](DEPLOY.md) da namuna bor.

**«Seans tugadi» deb yozilmoqda.**
8 soat o'tgan. Qaytadan kiring; saqlanmagan o'zgarishlar yo'qoladi, shuning uchun
uzoq ishlaganda oraliq saqlab turing.

**Xaritada hudud ko'rinmayapti.**
Koordinatalar kiritilmagan yoki xato. Kenglik 41 atrofida, uzunlik 71 atrofida bo'lishi kerak.

**Fotosurat yuklanmayapti.**
Fayl turi yoki hajmini tekshiring (25 MB gacha). SVG dan tashqari boshqa vektor
formatlari qabul qilinmaydi.

**Xato saqlab qo'ydim.**
«Sayt holati va zaxira» bo'limidagi **«Zaxira nusxalar»** jadvalidan avvalgi holatni
tiklang. Har saqlashdan oldin avtomatik zaxira olinadi (oxirgi 20 versiya).

**Ma'lumotnomada id maydoni faol emas.**
Bu ataylab: mavjud identifikatorni o'zgartirish unga bog'langan lotlarni
buzadi. Nomni erkin o'zgartirishingiz mumkin.

**Parolni unutdim.**
Administrator «Foydalanuvchilar» bo'limidan tiklab beradi. Administratorning
o'zi unutgan bo'lsa, serverda buyruq orqali tiklanadi.
