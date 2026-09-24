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

Saytda ikki daraja bor va ular panelda **alohida bo'limlarda** kiritiladi:

```
Hudud  (umumiy maydon — masalan, «Chodak daryo bo'yi rekreatsion hududi»)
  ├── Lot 1/1   (aniq uchastka, o'z kadastr raqami va aukcioni bilan)
  ├── Lot 1/2
  └── Lot 1/3
```

**Muhim qoida:** tuman, hudud turi, turizm yo'nalishlari, umumiy infratuzilma va
kirish yo'li **faqat hududda** kiritiladi. Lotlar ularni o'zi meros qilib oladi —
har bir lotda qaytarib yozish shart emas. Shu tarzda bir xil ma'lumot ikki joyda
saqlanmaydi va qarama-qarshilik yuzaga kelmaydi.

Shuning uchun **tartib shunday**: avval hudud, keyin uning ichiga lotlar.

---

### 4.1. Yangi hudud qo'shish

1. **«Hududlar»** → «+ Yangi hudud».
2. **Nom** — kamida bitta tilda to'ldiring. Tillar orasida `ЎЗ / UZ / РУ / EN`
   tugmalari bilan almashiladi; to'ldirilgan til yonida yashil nuqta paydo bo'ladi.
3. **Manzil (slug)** nomni yozgan sari o'zi to'ldirilib boradi — unga tegish
   shart emas. Kirill harflari lotinchaga o'giriladi
   («Чодак ҳудуди» → `chodak-hududi`).

   Xohlasangiz o'zingiz ham yozishingiz mumkin; shundan keyin maydon nomga
   qarab o'zgarmaydi. **Saqlangan** yozuvda slug avtomatik o'zgarmaydi — bu
   tashqi havolalarni buzardi. Kerak bo'lsa «Nomdan qayta yasash» tugmasi bor.
4. **Tuman** va **hudud turi** — ro'yxatdan tanlanadi.
5. **Umumiy maydoni** (gektar) — rasmiy hujjatdagi qiymat.
6. **Turizm yo'nalishlari** — bir nechtasini belgilash mumkin. Ro'yxatda kerakli
   yo'nalish bo'lmasa, yonidagi **«Ma'lumotnomalarda tahrirlash»** tugmasini
   bosasiz — panel sizni kerakli ro'yxatga olib boradi (4.4-bandga qarang).
7. **Koordinatalar va chegara** — quyidagi 4.3-bandga qarang.
8. **Umumiy infratuzilma** va **kirish yo'li** — hudud bo'yicha. Lotlar shu
   ma'lumotni meros qilib oladi.
9. **Master-reja** — hudud uchun master-reja tayyor bo'lsa, shu yerda bog'lanadi.
10. «Saqlash» — sayt o'zi qayta quriladi.

---

### 4.2. Yangi lot qo'shish

1. **«Lotlar»** → «+ Yangi lot».
2. Eng tepada **«Hudud»** tanlovi turadi — bu majburiy. Hudud tanlanganda
   ustidagi yashil panelda uning tumani, turi va yo'nalishlari ko'rinadi, ya'ni
   lot nimani meros olganini darhol ko'rasiz.

   > Hudud tanlanmasa, lot saytda tumansiz va yo'nalishlarsiz chiqadi. Qurishda
   > bu haqda ogohlantirish beriladi.

3. **Nom**, **lot raqami** (hujjatdagi raqam) va **holat**.
4. **Maydon** (gektar yoki sotix) va **kadastr raqami**.
5. **Koordinatalar va chegara** — lotning o'z chegarasi (4.3-band).
6. **Tasvirlar** — fayllarni maydonga tortib tashlang yoki bosib tanlang.
   Har bir tasvir uchun turini to'g'ri belgilang:
   - **Haqiqiy fotosurat** — hududning suratga olish vaqtidagi holati;
   - **Loyiha konsepsiyasi** — vizualizatsiya (saytda shu yozuv va ogohlantirish bilan chiqadi);
   - **Chizma / sxema**.
7. **Aukcion** bo'limi — quyida alohida tushuntirilgan.
8. «Saqlash».

Hudud sahifasida uning barcha lotlari kartochkalar ko'rinishida chiqadi; lot
sahifasida esa qaysi hududga tegishli ekani va hududga havola bo'ladi.

---

### 4.3. Koordinatalarni KMZ fayl orqali yuklash

Geodeziya xizmati chegarani odatda **KMZ** faylida beradi. Koordinatalarni qo'lda
ko'chirib yozish shart emas:

1. Hudud yoki lot tahrirlash oynasida **«Koordinata faylini yuklang»** maydoniga
   faylni tortib tashlang (yoki bosib tanlang).
2. Tizim faylni o'qiydi va **markaziy nuqta** hamda **chegara konturini** o'zi
   to'ldiradi. Nechta nuqta olingani darhol yoziladi.
3. Kerak bo'lsa, quyidagi maydonlarda qiymatlarni ko'rib chiqishingiz mumkin.

| Format | Izoh |
|---|---|
| **KMZ** | Google Earth arxivi (ichida KML). Eng ko'p ishlatiladigan format. |
| **KML** | XML ko'rinishidagi variant. |
| **GeoJSON** | Ba'zi GIS tizimlari shu formatda beradi. |

Nimalar olinadi:

- `Polygon` (ko'pburchak) → chegara konturi, markaziy nuqta esa hisoblab chiqiladi;
- `Point` (nuqta) → faqat markaziy nuqta;
- `LineString` (chiziq) → chegara sifatida ishlatiladi (bu haqda izoh chiqadi).

Faylda bir nechta obyekt bo'lsa, **birinchisi** olinadi va bu haqda xabar
beriladi. Fayl serverda saqlanmaydi — faqat koordinatalar olinadi.

> Koordinata kiritilmasa, hudud yoki lot xaritada ko'rsatilmaydi. Bu xato emas,
> lekin qurishda eslatma chiqadi.

Chegara nuqtalarini qo'lda o'zgartirish yoki soddalashtirish man etiladi.

---

### 4.4. Aukcion bo'limi

Bu bo'lim ataylab qattiq nazorat ostida:

- **«Aukcion ma'lumotlari rasmiy tasdiqlangan»** katagi belgilanmaguncha sana,
  boshlang'ich narx va huquq turi saytda **ko'rsatilmaydi**.
- **E-auksion havolasi** — aynan shu lotning sahifasi bo'lishi kerak. Platformaning
  umumiy manzilini yozsangiz, qurishda ogohlantirish chiqadi va havola olib tashlanadi.
- Havola bo'lmasa, saytdagi tugma faolsiz bo'lib, sababi ochiq yoziladi.
- **Huquq turi** rasmiy hujjatdagi ibora bilan yoziladi. Umumiy «yer sotiladi» iborasi
  ishlatilmaydi.

---

### 4.5. Nusxalash

O'xshash lotlar uchun «Nusxalash» tugmasidan foydalaning — barcha maydonlar
ko'chiriladi, `id` va `slug` bo'sh qoladi, nashr holati qoralamaga o'tadi.
Bir hududda bir nechta o'xshash lot bo'lganda qulay.

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

### Sayt holati va zaxira nusxalar

Bu bo'limning eng pastida ikkita texnik blok bor. Kundalik ishda ularga kirish
shart emas.

**Sayt holati** — oxirgi qurilish sanasi, sahifalar/hududlar/lotlar soni va
**to'ldirilishi kerak bo'lgan joylar** ro'yxati (masalan, koordinatasi yo'q
hudud yoki logotip). Shu ro'yxatga vaqti-vaqti bilan qarab turish foydali.

Yonida **«Saytni qayta qurish»** tugmasi bor — fayl serverda qo'lda
o'zgartirilgan bo'lsa yoki avtomatik qurish xato bergan bo'lsa ishlatiladi.
**«DEMO rejimida qurish»** faqat o'qitish uchun; ishlab turgan saytda
ishlatilmaydi (sayt demo rejimida bo'lsa, ogohlantirish chiqadi).

**Zaxira nusxalar** — kontentni har saqlaganingizda avvalgi holat avtomatik
zaxiraga olinadi (har bo'lim uchun oxirgi 20 versiya). Xato o'zgartirish
kiritilgan bo'lsa, **«Tiklash»** tugmasi bilan qaytarasiz. Tiklashda joriy holat
ham zaxiraga olinadi — ya'ni bu amalni ham ortga qaytarish mumkin.

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

- Yuklangan barcha fayllar ro'yxati: manzili, holati, hajmi va sanasi.
- **«Holati»** ustuni faylning qayerda ishlatilayotganini ko'rsatadi (masalan,
  «Hududlar», «Yangiliklar»). Hech qayerda ishlatilmasa — «ishlatilmagan».
- **«Manzilni nusxalash»** — matn ichida havola qilish uchun.
- **«O'chirish»** — faylni butunlay o'chiradi.

  Fayl biror joyda ishlatilayotgan bo'lsa, tizim ogohlantiradi va qaysi
  bo'limlarda ishlatilganini aytadi. Rozilik bergandan keyingina o'chiriladi —
  o'sha joylarda rasm ko'rinmay qoladi.

  Sarlavha yonida nechta fayl ishlatilmagani ko'rsatiladi — joy tozalash uchun
  qulay.

- Ruxsat etilgan turlar: JPG, PNG, WEBP, AVIF, SVG, PDF, ZIP, KMZ, KML, GeoJSON.
  Eng katta hajm: 25 MB.
- Fayl nomiga noyob qo'shimcha qo'shiladi — bir xil nomli fayllar bir-birini
  almashtirib yubormaydi.

> O'chirilgan faylni qaytarib bo'lmaydi. Zaxira nusxalar faqat **kontent**
> uchun olinadi, yuklangan fayllar uchun emas.

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
- **Bot tokeni** va **xabar oluvchilar** ro'yxatini faqat `admin` roli kiritadi.
- **Xabar oluvchilar** — har bir murojaat ro'yxatdagi **barcha** chatlarga
  yuboriladi. Bir nechta xodim va guruh qo'shish mumkin (20 tagacha):

  | Maydon | Nima yoziladi |
  |---|---|
  | `chat_id` | Shaxsiy chat uchun son (`123456789`), guruh uchun manfiy son (`-1001234567890`), kanal uchun `@kanal_nomi` |
  | Kim (izoh) | Erkin matn — «direktor», «mas'ul xodim», «umumiy guruh». Faqat panelda ko'rinadi |
  | Forum mavzusi | Forum guruhidagi mavzu raqami (ixtiyoriy) |
  | Vaqtincha yubormaslik | Xodim ta'tilda bo'lsa — o'chirmasdan to'xtatib qo'yish |

  Har bir oluvchi yonida holati ko'rinadi: `✓` ishlaydi, `✕` muammo bor (sababi
  yoziladi), `⏸` vaqtincha o'chirilgan.

  **Biriga yetmasa, qolganlariga xabar boradi.** Murojaatlar ro'yxatida kim
  olgani va kim olmagani alohida ko'rsatiladi.
- **«chat_id larni aniqlash»** tugmasi bot ko'rgan chatlar ro'yxatini chiqaradi —
  keraklisini bossangiz, ro'yxatga qo'shiladi.

  Xodim xabar olishi uchun avval botni ochib **«Start»** tugmasini bosishi kerak —
  aks holda Telegram botga yozishga ruxsat bermaydi.
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

## 14. Tez-tez uchraydigan savollar

**O'zgarishlar saytda ko'rinmayapti.**
Yozuv **qoralama** holatida qolmaganini tekshiring — tahrirlash oynasining
tepasidagi holat «Saytda ko'rinadi» bo'lishi kerak. Ro'yxatda qoralamalar
«qoralama — saytda yo'q» belgisi bilan turadi.

Yangilik uchun yana bitta shart bor: **sana kiritilgan bo'lishi kerak**.
Sanasi yo'q yangilik ro'yxatda oxirida qoladi.

Agar holat to'g'ri bo'lsa ham ko'rinmasa, «Sayt sozlamalari» bo'limining
pastidagi «Saytni qayta qurish» tugmasini bosing va jurnalda xatolik yo'qligini
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
«Sayt sozlamalari» bo'limining pastidagi **«Zaxira nusxalar»** jadvalidan avvalgi holatni
tiklang. Har saqlashdan oldin avtomatik zaxira olinadi (oxirgi 20 versiya).

**Ma'lumotnomada id maydoni faol emas.**
Bu ataylab: mavjud identifikatorni o'zgartirish unga bog'langan lotlarni
buzadi. Nomni erkin o'zgartirishingiz mumkin.

**Parolni unutdim.**
Administrator «Foydalanuvchilar» bo'limidan tiklab beradi. Administratorning
o'zi unutgan bo'lsa, serverda buyruq orqali tiklanadi.
