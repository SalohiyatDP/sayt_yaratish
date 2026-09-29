# AI yordamchisi

Boshqaruv paneliga ixtiyoriy AI yordamchisi ulanadi. U ikki ishni bajaradi:

1. **Tarjima** — ma'lumotni bitta tilda yozsangiz, qolgan tillarni o'zi to'ldiradi.
2. **PDF dan to'ldirish** — master-reja PDF ini yuklasangiz, undan maydonlarni
   ajratib, taklif qiladi.

> **AI ixtiyoriy.** Kalit kiritilmasa, sayt hozirgidek to'liq ishlaydi va AI
> tugmalari umuman ko'rinmaydi.

---

## Asosiy tamoyillar

- **AI hech qachon o'zi saqlamaydi.** U faqat maydonni *taklif* bilan to'ldiradi.
  Xodim ko'rib, tekshirib, odatdagidek «Saqlash» ni bosadi.
- **Xato bo'lishi mumkin.** Tarjimadagi so'z yoki PDF dan olingan raqam/sanani
  albatta tekshiring. Rasmiy ma'lumotda xato bo'lmasligi kerak.
- **Maxfiylik.** AI ga yuborilgan matn (tashkilot nomi, tavsif, hujjat matni)
  provayder serveriga chiqadi. Maxfiy hujjatlar uchun buni hisobga oling.

---

## 1-qadam. Kalit olish

Ikki provayderdan birini tanlaysiz:

| Provayder | Kalit qayerdan | Izoh |
|---|---|---|
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com) → «Get API key» | Bepul limit bor, arzon |
| **OpenAI (ChatGPT)** | [platform.openai.com](https://platform.openai.com) → «API keys» | Sifatli, pullik |

---

## 2-qadam. Panelda sozlash

Boshqaruv paneli → **«AI yordamchisi»** (faqat `admin` roli):

1. **Provayder** — Gemini yoki OpenAI.
2. **Model** — ro'yxat provayderning o'zidan olinadi (hisobingizga ochilgan
   modellar), shuning uchun har doim dolzarb bo'ladi. Odatiy model to'g'ri
   keladi; xohlasangiz boshqasini tanlaysiz. Kalit hali kiritilmagan bo'lsa,
   zaxira ro'yxat ko'rinadi va kalit saqlangach haqiqiy ro'yxat yuklanadi.
3. **API kaliti** — yuqorida olingan kalitni qo'ying.
4. **«Saqlash»**, so'ng **«Ulanishni tekshirish»** — ulanish ishlashini tasdiqlaydi.

Kalit `server/data/ai.json` faylida saqlanadi va repozitoriyaga tushmaydi.
Muhit o'zgaruvchisi orqali ham berish mumkin: `OPENAI_API_KEY` yoki
`GEMINI_API_KEY`.

**Vaqtincha o'chirish** — kalitni o'chirmasdan AI ni to'xtatib turish uchun
belgi bor. O'chirilganda tugmalar yashirinadi, sayt oddiy ishlaydi.

---

## 3-qadam. Tarjima (ma'lumot kiritishda)

Ko'p tilli maydon (nom, tavsif va h.k.) ostida **«✦ AI bilan to'ldirish»**
tugmasi paydo bo'ladi (AI yoqilgan bo'lsa):

1. Kamida bitta tilda matn yozing (kiril yoki lotin qulay).
2. Tugmani bosing.
3. Tizim:
   - **o'zbek kiril ↔ lotin** — AIsiz, darhol o'giradi (tarjima emas, alifbo
     almashtirish — tekin va tez);
   - **rus va ingliz** — AI orqali tarjima qiladi.
4. Natijani har bir til yorlig'ida ko'rib chiqing, kerak bo'lsa tuzating, so'ng
   «Saqlash».

Allaqachon to'ldirilgan tillar o'zgartirilmaydi — faqat bo'sh tillar to'ldiriladi.

---

## 4-qadam. PDF dan to'ldirish (master-reja)

Master-reja tahrirlash oynasining tepasida **«✦ PDF dan avtomatik to'ldirish»**
bloki bor:

1. Master-reja PDF ini yuklang yoki avval yuklangan hujjatdan tanlang.
2. **«✦ PDF dan to'ldirish»** ni bosing.
3. AI PDF matnini o'qib, quyidagi maydonlarni **taklif** qiladi: nom, umumiy
   tavsif, tasdiqlagan organ, tasdiqlash hujjati, sana, umumiy maydon.
4. Har bir taklifni ko'rib, **«Qo'llash»** bilan maydonga yozasiz. Yoki
   **«Hammasini qo'llash»**.
5. Maydonlarni tekshirib, «Saqlash».

> Faqat **matnli** PDF ishlaydi. Skanerlangan (rasm) PDF da matn yo'q — AI undan
> ma'lumot ololmaydi (bu haqda ogohlantirish chiqadi).

---

## Talablar va cheklovlar

- **Tashqi tarmoq.** Hosting `api.openai.com` yoki
  `generativelanguage.googleapis.com` ga chiqa olishi kerak. Chiqa olmasa,
  tugma xatolik sababini o'zbekcha ko'rsatadi.
- **To'lov.** OpenAI pullik; Gemini'da bepul limit bor. Har bir tarjima/ajratish
  provayder hisobingizdan oz miqdorda foydalanadi.
- **Huquqiy jihat.** `.uz` domenidagi davlat muassasasi uchun rasmiy hujjat
  matnini chet el AI serveriga yuborish cheklangan bo'lishi mumkin. Buni
  vakolatli organ bilan aniqlashtiring. Tarjima uchun ochiq matnlar (nom,
  tavsif) odatda muammosiz; maxfiy hujjatlar uchun ehtiyot bo'ling.

---

## Muammolarni hal qilish

Panelda xatolik chiqsa, sabab va yechim o'zbekcha yoziladi. Tipik holatlar:

| Xatolik | Sabab | Yechim |
|---|---|---|
| «API kaliti qabul qilinmadi» | Kalit xato yoki eskirgan | Yangi kalit oling |
| «Limit tugagan» | Hisobda mablag'/limit yo'q | Provayder hisobini tekshiring |
| «Model mavjud emas» | Noto'g'ri model | Boshqa modelni tanlang |
| «Ulanish vaqti tugadi» | Hosting tashqi tarmoqqa chiqmayapti | Hostingdan chiqishni oching |
| «PDF dan matn topilmadi» | Skanerlangan (rasm) PDF | Matnli PDF ishlating |
