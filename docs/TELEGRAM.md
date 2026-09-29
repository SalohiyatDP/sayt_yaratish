# Murojaat shaklini Telegram botga ulash

Saytdagi «Bog'lanish» bo'limidan yuborilgan murojaatlar Telegram guruhiga
(yoki shaxsiy chatga, kanalga) darhol yetib boradi.

## Qanday ishlaydi

```
Foydalanuvchi shaklni to'ldiradi
        │
        ▼
POST /api/contact  ──►  1) Server ma'lumotni tekshiradi
                        2) content/inbox/<raqam>.json faylga YOZADI
                        3) Foydalanuvchiga «qabul qilindi + raqam» javobini beradi
                        4) Fonda Telegram botga xabar yuboradi
                        5) Yetkazilish holatini murojaat yozuviga qo'shadi
```

**Muhim:** murojaat avval diskka saqlanadi, keyin botga yuboriladi. Shu sababli
bot ishlamasa, internet uzilsa yoki token eskirsa ham **murojaat yo'qolmaydi** —
u boshqaruv panelidagi «Murojaatlar» bo'limida ko'rinadi va u yerdan bir bosishda
qayta yuborish mumkin.

---

## 1-qadam. Bot yaratish

1. Telegramda **@BotFather** ni oching.
2. `/newbot` buyrug'ini yuboring.
3. Bot nomini kiriting, masalan: `Direksiya murojaatlari`
4. Bot foydalanuvchi nomini kiriting — oxiri `bot` bilan tugashi shart,
   masalan: `namangan_direksiya_bot`
5. BotFather tokenni yuboradi. Ko'rinishi:

   ```
   1234567890:AAEhBOweik6ad9r_QXzR1_ABCdefGhIJklm
   ```

> ⚠️ Token — **parol bilan teng**. Uni xat, messenjer yoki skrinshot orqali
> yubormang. Oshkor bo'lsa, @BotFather → `/revoke` orqali darhol bekor qilib,
> yangisini oling.

## 2-qadam. Murojaatlar keladigan joyni tayyorlash

Uch variant bor — biror birini tanlaysiz.

| Variant | Qanday qilinadi | Qulayligi |
|---|---|---|
| **Guruh** (tavsiya etiladi) | Guruh yaratib, botni a'zo qilib qo'shasiz | Bir necha xodim ko'radi, mas'ul tayinlash oson |
| **Shaxsiy chat** | Botni ochib `/start` yuborasiz | Faqat bitta xodim ko'radi |
| **Kanal** | Botni kanalga **administrator** qilib qo'shasiz | Faqat o'qish uchun, izoh yozilmaydi |

Guruh tanlangan bo'lsa, botni qo'shgandan keyin guruhga **biror xabar yozing** —
keyingi qadamda chat identifikatorini aniqlash uchun shu kerak bo'ladi.

> Guruhda bot xabarlarni ko'rmasa: @BotFather → `/setprivacy` → **Disable**,
> yoki botni guruh administratori qilib tayinlang.

## 3-qadam. Sozlash

Ikki yo'l bor — istalganini tanlang.

### A) Boshqaruv paneli orqali (oson)

1. `/admin/` ga kiring → chap menyuda **«Telegram»**.
2. **Bot tokeni** maydoniga tokenni qo'ying.
3. **«chat_id larni aniqlash»** tugmasini bosing — bot ko'rgan chatlar ro'yxati
   chiqadi. Keraklisini bossangiz, **xabar oluvchilar** ro'yxatiga qo'shiladi.

   **Bir nechta oluvchi.** Murojaat ro'yxatdagi barcha chatlarga yuboriladi:
   rahbar, mas'ul xodim, umumiy guruh — 20 tagacha. Har biri uchun izoh
   («direktor», «mas'ul xodim») yozib qo'yish mumkin, bu faqat panelda ko'rinadi.

   Xodim ta'tilga chiqsa, uni ro'yxatdan o'chirmasdan **«Vaqtincha yubormaslik»**
   bilan to'xtatib qo'yasiz.

   Biriga xabar yetmasa, qolganlariga boradi. Murojaatlar ro'yxatida kim olgani
   va kim olmagani alohida ko'rsatiladi.
4. **«Saqlash va tekshirish»** tugmasini bosing.
5. **«Sinov xabarini yuborish»** tugmasi bilan tekshirib ko'ring.

> Bu amallarni faqat `admin` roliga ega xodim bajaradi.
> Sahifa **HTTPS** orqali ochilishi shart — aks holda token himoyasiz uzatiladi.

### B) Buyruq satri orqali

Windows'da `windows\telegram-sozlash.cmd` faylini ishga tushirish kifoya.
Boshqa tizimlarda:

```bash
# 1) Tokenni tekshirish va chat_id ni aniqlash
node server/tools/telegram-setup.mjs 1234567890:AAEhBOweik6ad9r_QXzR1_ABCdefGhIJklm

# Yordamchi topilgan chatlarni ko'rsatadi:
#   chat_id: -1001234567890   guruh   Direksiya — murojaatlar

# 2) xabar oluvchini saqlash va sinov xabarini yuborish
#    bir nechtasini vergul bilan berish mumkin: "111,-1002222,@kanal"
node server/tools/telegram-setup.mjs "" -1001234567890
```

Sozlamalar `server/data/telegram.json` faylida saqlanadi (`.gitignore` da).

### C) `.env` fayli orqali (serverga joylashtirishda qulay)

`.env.example` faylini `.env` deb nusxalab, to'ldiring:

```dotenv
TELEGRAM_BOT_TOKEN=1234567890:AAEhBOweik6ad9r_QXzR1_ABCdefGhIJklm
TELEGRAM_CHAT_ID=-1001234567890
```

Muhit o'zgaruvchilari `server/data/telegram.json` dan **ustun** turadi.

## 4-qadam. Saytdagi shaklni yoqish

Telegram sozlangan bo'lsa ham, shakl saytda faolsiz turadi — uni alohida yoqish kerak.

1. Boshqaruv panelida **«Sayt sozlamalari»** → *Murojaatlarni qabul qilish manzili*
   maydoniga `/api/contact` yozing va saqlang.

   Yoki `content/site.json` faylida:

   ```json
   "features": { "contactFormEndpoint": "/api/contact" }
   ```

2. **«Saytni qurish»** bo'limidan saytni qayta quring (yoki `node src/build.mjs`).
3. Saytdagi shakl orqali sinov murojaati yuboring.

---

## Telegramga keladigan xabar ko'rinishi

```
📨 Saytdan yangi murojaat  20260924-6DF7DE

👤 Ism-familiya: Alisher Karimov
🏢 Tashkilot: Namangan Tour MChJ
📞 Telefon: +998 90 123-45-67
✉️ Pochta: alisher@example.uz
📍 Qiziqtirgan hudud: Chortoq tumani, 1-lot
🌐 Sayt tili: o'zbek (kirill)

💬 Xabar:
│ Assalomu alaykum! Master-reja hujjatlarini olmoqchiman.

🕒 2026-09-24 04:38 (UTC)
🔗 https://sayt-manzili.uz/uz-cyrl/contact/

[✉️ Javob yozish]  [🔗 Sahifa]
[🗂 Boshqaruv paneli]
```

«Boshqaruv paneli» tugmasi `content/site.json → seo.canonicalOrigin` yoki
`SITE_ORIGIN` o'zgaruvchisi to'ldirilgan bo'lsa chiqadi.

---

## Sozlamalar ma'lumotnomasi

| O'zgaruvchi | Majburiy | Izoh |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ha | @BotFather bergan token |
| `TELEGRAM_CHAT_ID` | ha | `123456789`, `-1001234567890` yoki `@kanal_nomi` |
| `TELEGRAM_THREAD_ID` | yo'q | Forum ko'rinishidagi guruhda aniq mavzuga yuborish |
| `TELEGRAM_DISABLED` | yo'q | `1` — yuborishni vaqtincha to'xtatish |
| `TELEGRAM_API_BASE` | yo'q | Sinov (mock) serveri uchun; odatda o'zgartirilmaydi |
| `SITE_ORIGIN` | yo'q | Xabardagi «Boshqaruv paneli» tugmasi uchun |

## Ishonchlilik

- **Darhol qayta urinish:** vaqtinchalik xatolikda 3 martagacha qayta uriniladi
  (tarmoq uzilishi, Telegram tomonidagi cheklov). Telegram `retry_after`
  qiymatini bersa, shuncha kutiladi.
- **Fondagi navbat:** server har **5 daqiqada** yetkazilmagan murojaatlarni
  qaytadan yuborishga harakat qiladi. Telegram bir necha soat ishlamay qolsa
  ham, tiklangach murojaatlar o'zi yetib boradi — xodim hech narsa qilmaydi.
  Navbat bir hafta davomida, ko'pi bilan 20 marta urinadi.
- **Sozlama tuzatilganda:** bot tokeni yoki `chat_id` keyinroq kiritilsa,
  o'sha paytgacha kelgan murojaatlar ham navbat orqali yuboriladi.
- **Qaytarib bo'lmaydigan xatolik** (400/401/403 — token xato, bot bloklangan,
  chat topilmadi) aniqlansa, qayta urinilmaydi va sabab yozib qo'yiladi.
- Har bir murojaat yozuvida yetkazilish holati saqlanadi:

  ```json
  "telegram": {
    "delivered": true,
    "attempts": 1,
    "messageId": 777,
    "error": null,
    "chatId": "-1001234567890",
    "at": "2026-09-24T04:38:53.884Z"
  }
  ```

- Boshqaruv panelida har bir murojaat ostida holat ko'rinadi, yetkazilmaganlar
  uchun **«Telegramga yuborish»** tugmasi chiqadi. Chap menyudagi «Telegram»
  yonidagi raqam — yetkazilmagan murojaatlar soni.

### Panel tashxis qo'yadi

«Telegram» bo'limi ingliz tilidagi xatolik matnini emas, **sabab va yechimni**
o'zbekcha ko'rsatadi. Tekshiruv uch bosqichda ketadi:

| Bosqich | Nimani tekshiradi | Xato bo'lsa |
|---|---|---|
| **Tarmoq** | hostingdan `api.telegram.org` ga chiqish bormi | «YOPIQ» deb yoziladi — hosting xizmatidan 443-portni ochishni so'rash kerak |
| **Bot tokeni** | token haqiqiymi (`getMe`) | tokenni qayta olish yo'li ko'rsatiladi |
| **Chat** | chat mavjudmi va bot unda bormi (`getChat`) | `chat_id` va botning guruhga a'zoligi tekshiriladi |

Shu yerda **«Murojaatlarning yetkazilishi»** jadvali ham bor: jami, yetkazilgan,
navbatda va yetkazilmagan murojaatlar soni hamda oxirgi xatolikning sababi.
Bu sinov xabaridan ishonchliroq ko'rsatkich — haqiqiy murojaatlar holatini
ko'rsatadi.

## Maxfiylik

Telegramga **shaxsiy ma'lumotlar** yuboriladi: ism, telefon, elektron pochta,
xabar matni. Shu sababli:

- chatga faqat vakolatli xodimlar kirishi ta'minlanishi kerak;
- guruh **yopiq** (havola orqali kirish cheklangan) bo'lishi lozim;
- xodim ishdan bo'shaganda uni guruhdan chiqarishni unutmang;
- murojaat matnlarini uchinchi shaxslarga uzatish man etiladi.

Saytdagi murojaat shakli ostida foydalanuvchiga maxfiylik haqida eslatma
ko'rsatiladi (`content/pages.json → contact.privacyNotice`). Telegramga
uzatilishini ham shu matnga qo'shishni tavsiya etamiz.

---

## Muammolarni hal qilish

**«Telegram: sozlanmagan» deb yozilmoqda**
Token yoki birorta xabar oluvchi kiritilmagan. `node server/tools/telegram-setup.mjs --check`
bilan tekshiring.

**`Unauthorized` (401)**
Token xato yoki bekor qilingan. @BotFather → `/token` orqali yangisini oling.

**`chat not found` (400)**
`chat_id` xato yozilgan yoki bot guruhdan chiqarilgan. Botni qaytadan qo'shib,
guruhga xabar yozing va `chat_id` ni qaytadan aniqlang.

**`bot was blocked by the user` (403)**
Shaxsiy chatda foydalanuvchi botni bloklagan. Botni blokdan chiqaring yoki
guruhga o'tkazing.

**`fetch failed` / `so'rov vaqti tugadi`**
Serverdan `api.telegram.org` ga chiqish yo'q — bu umumiy (shared) hostinglarda
ko'p uchraydi. Panelning «Telegram» bo'limidagi **«Tarmoq»** qatori buni aniq
aytadi. Hosting qo'llab-quvvatlash xizmatiga murojaat qilib, `api.telegram.org`
(443-port) ga chiqishni ochishni so'rang. Proksi ishlatilsa, `HTTPS_PROXY`
o'zgaruvchisini sozlash kerak bo'ladi.

Murojaatlar bu vaqtda ham yo'qolmaydi: ular serverda saqlanadi va tarmoq
ochilgach navbat orqali o'zi yuboriladi.

**Sinov xabari keladi, lekin saytdan yuborilgani kelmaydi**
Murojaat shakli saytda faolsiz. «Sayt sozlamalari» → `/api/contact` yozib,
saytni qayta quring (4-qadam).

**Guruhda bot xabarlarni ko'rmaydi**
@BotFather → `/setprivacy` → **Disable**, yoki botni administrator qiling.
Bu faqat `chat_id` ni aniqlash uchun kerak; xabar yuborish uchun shart emas.
