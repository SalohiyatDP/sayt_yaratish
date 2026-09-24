# Tasvirlar katalogi

## ⚠️ Rasmiy logotip hali joylashtirilmagan

Bu katalogdagi `favicon.svg` va `icon-maskable.svg` fayllari — **Direksiyaning rasmiy
logotipi emas**. Ular rasmiy logotip berilmaguncha ishlatiladigan neytral geometrik
belgilardir. Sayt qurilganda konsolda shu haqda ogohlantirish chiqadi.

### Rasmiy logotipni qanday joylashtirish kerak

1. Rasmiy logotip faylini shu katalogga `logo.svg` nomi bilan saqlang
   (SVG tavsiya etiladi; PNG bo'lsa `logo.png`, kamida 256×256 px, shaffof fon).
2. Generator uni avtomatik topadi. Boshqa nom yoki joy kerak bo'lsa,
   `content/site.json` faylida ko'rsating:

   ```json
   "media": {
     "logo": "/assets/img/logo.svg",
     "logoDark": "/assets/img/logo-dark.svg"
   }
   ```

3. `favicon.svg` va `icon-maskable.svg` fayllarini ham rasmiy logotip asosida
   tayyorlangan variantlar bilan almashtiring.
4. Saytni qayta quring: `npm run build`.

**Diqqat:** logotipning shakli, proporsiyalari, ranglari va yozuvlari o'zgartirilmasligi
kerak. Sayt logotipni cho'zmaydi — u `52×52 px` maydonda o'z nisbatini saqlab ko'rsatiladi.

## Bosh sahifadagi katta tasvir (hero)

Bosh ekranda fotosurat ishlatish uchun `content/site.json` faylida to'ldiring:

```json
"media": {
  "heroImage": {
    "src": "/assets/uploads/hero-namangan.jpg",
    "alt": {
      "uz-cyrl": "Наманган вилоятидаги ... (тасвир мазмунини ёзинг)",
      "uz": "Namangan viloyatidagi ...",
      "ru": "...",
      "en": "..."
    },
    "credit": "Foto muallifi / manba"
  }
}
```

**Faqat Namangan viloyatining haqiqiy fotosuratlaridan foydalaning.** Boshqa hududlarning
tasvirlarini Namangan deb ko'rsatish man etiladi. Fotosurat berilmasa, bosh ekranda
fotosurat o'rniga abstrakt geometrik bezak ishlatiladi — u hech qanday joyni tasvirlamaydi.

## Yuklangan fayllar

Boshqaruv paneli orqali yuklanadigan fotosuratlar, chizmalar va PDF hujjatlar
`assets/uploads/` katalogiga tushadi. Bu katalog `.gitignore` da — og'ir media fayllar
repozitoriyaga tushmaydi. Serverda uni zaxiralashni yo'lga qo'ying.
