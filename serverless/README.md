# Faqat statik hosting uchun murojaat shakli

Bu katalog **faqat bitta holat** uchun kerak: sayt Node.js serveri bo'lmagan
oddiy statik hostingda (yoki GitHub Pages / Netlify / Cloudflare Pages da)
joylashtirilgan, lekin murojaat shakli ishlashi va xabarlar Telegram botga
kelishi kerak.

## Nima uchun kerak

Bot tokenini brauzerdagi JavaScript ichiga yozish **mutlaqo mumkin emas** —
uni har qanday tashrifchi ko'rib, bot nomidan xabar yuborishi mumkin bo'ladi.
Shu sababli token serverda turishi shart.

Yechim: kichik «serverless» funksiya. Sayt statik qoladi, faqat murojaat shakli
shu funksiyaga murojaat qiladi, funksiya esa tokenni o'zida saqlab Telegramga
uzatadi.

```
Brauzer (statik sayt) ──► Cloudflare Worker ──► Telegram Bot API
                           (token shu yerda)
```

## Cheklovlar — muhim

| Imkoniyat | To'liq server | Serverless funksiya |
|---|---|---|
| Murojaat Telegramga boradi | ✅ | ✅ |
| Murojaat diskda saqlanadi | ✅ | ❌ (faqat Telegram) |
| Boshqaruv panelidagi «Murojaatlar» | ✅ | ❌ |
| Yetkazilmaganini qayta yuborish | ✅ | ❌ |
| Boshqaruv paneli (kontent tahriri) | ✅ | ❌ |

**Ya'ni:** agar Telegram xabari yetib bormasa, murojaat butunlay yo'qoladi —
zaxira nusxasi qolmaydi. Shuning uchun asosiy tavsiya — to'liq serverdan
foydalanish. Bu variant faqat imkoniyat bo'lmagan holat uchun.

Kontentni tahrirlash esa har holda mahalliy kompyuterda qilinadi va sayt
qaytadan yuklanadi.

## O'rnatish (Cloudflare Workers — bepul reja yetarli)

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create Worker**.
2. Nom bering, masalan `direksiya-murojaat`.
3. `worker.js` faylining mazmunini tahrirlovchiga nusxalab qo'yib, **Deploy**.
4. Worker sozlamalari → **Settings → Variables and Secrets** → quyidagilarni
   **Secret** turida qo'shing:

   | Nom | Qiymati |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | @BotFather bergan token |
   | `TELEGRAM_CHAT_ID` | `-1001234567890` |
   | `ALLOWED_ORIGIN` | `https://sayt-manzili.uz` |

   `ALLOWED_ORIGIN` — faqat shu manzildan kelgan so'rovlar qabul qilinadi
   (boshqa saytlar sizning botingizdan foydalanmasligi uchun).

5. Worker manzilini nusxalang, masalan:
   `https://direksiya-murojaat.hisob.workers.dev`

6. Loyihada `content/site.json` faylini to'ldiring:

   ```json
   "features": {
     "contactFormEndpoint": "https://direksiya-murojaat.hisob.workers.dev"
   }
   ```

7. Saytni qayta qurib, hostingga yuklang:

   ```bash
   node src/build.mjs
   node scripts/bundle.mjs --static
   ```

## Tekshirish

Saytdagi shakl orqali sinov murojaati yuboring. Xabar Telegramga kelishi va
sahifada ro'yxatga olish raqami ko'rsatilishi kerak.

Worker jurnalini Cloudflare panelida **Logs → Real-time logs** bo'limida
ko'rish mumkin.

## Boshqa platformalar

`worker.js` dagi mantiq juda oddiy, shu sababli uni boshqa xizmatlarga ham
osongina ko'chirish mumkin:

- **Netlify Functions** — `netlify/functions/contact.js`, `exports.handler`
- **Vercel** — `api/contact.js`, `export default function handler(req, res)`
- **Yandex Cloud Functions / AWS Lambda** — mos ishlov beruvchi (handler) yozasiz

Har qanday holatda **token faqat server tomonida** saqlanishi kerak.
