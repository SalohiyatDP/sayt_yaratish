# Windows uchun yordamchi skriptlar

Bu katalogdagi `.cmd` fayllarni **ikki marta bosib** ishga tushirish mumkin.
Ular `npm` ni chetlab o'tib, to'g'ridan-to'g'ri `node` ni chaqiradi — shu sababli
PowerShell'ning skript cheklovlari (`PSSecurityException`) to'sqinlik qilmaydi.

| Fayl | Vazifasi |
|---|---|
| `qurish.cmd` | Saytni qurish (faqat tasdiqlangan kontent) |
| `qurish-demo.cmd` | Namunaviy ma'lumotlar bilan qurish (sinov uchun) |
| `tekshirish.cmd` | Havolalar, tillar, sarlavhalar va qulaylikni tekshirish |
| `ishga-tushirish.cmd` | Serverni ishga tushirish (sayt + boshqaruv paneli) |
| `parol-yaratish.cmd` | Panel foydalanuvchisini yaratish/parolini yangilash |
| `telegram-sozlash.cmd` | Telegram botni ulash va sinash |
| `tashxis.cmd` | Muammolarni aniqlash: nega server ishga tushmayapti? |

Faqat **Node.js 20.11 yoki undan yuqori** versiyasi o'rnatilgan bo'lishi kerak:
<https://nodejs.org> → «LTS» versiyasini yuklab olib o'rnatasiz.

---

## Server ishga tushmasa

Avval **`tashxis.cmd`** faylini ikki marta bosing — u sababni topib, yechimni
ko'rsatadi (Node versiyasi, port bo'sh-band, sayt qurilgani, yozish huquqlari,
foydalanuvchilar, Telegram holati).

Eng ko'p uchraydigan xatolik:

```
Error: listen EADDRINUSE: address already in use 0.0.0.0:8080
```

Ma'nosi: `8080`-port band. Ikki sababi bo'ladi — hosting paneli portni bermagan
(shuning uchun odatiy `8080` ishlatildi) yoki eski jarayon to'xtamagan.
To'liq yechim: `docs/DEPLOY.md` → «Muammolarni aniqlash» bo'limi.

Boshqa portni tez sinab ko'rish:

```cmd
node server\server.mjs --port 8090
```

---

## «npm : Невозможно загрузить файл … npm.ps1» xatoligi nima?

Bu loyihaning xatoligi emas. Windows'da PowerShell sukut bo'yicha skript
fayllarini (`.ps1`) ishga tushirishni taqiqlaydi, `npm` esa PowerShell'da
`npm.ps1` orqali chaqiriladi.

Uch xil yechim bor — istalganini tanlashingiz mumkin.

### 1-yechim: shu katalogdagi `.cmd` fayllardan foydalanish (eng oson)

Hech narsani sozlash kerak emas — yuqoridagi jadvaldagi faylni ikki marta bosasiz.

### 2-yechim: `npm.cmd` deb yozish

PowerShell'da `npm` o'rniga `npm.cmd` yozing:

```powershell
npm.cmd run build
npm.cmd run check
npm.cmd start
```

### 3-yechim: cheklovni bir marta yumshatish (tavsiya etiladi)

PowerShell'ni oching va quyidagini bajaring (administrator huquqi **kerak emas**):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Tasdiqlash so'ralganda `Y` deb javob berasiz. Shundan keyin oddiy `npm run build`
buyruqlari ishlaydi. `RemoteSigned` — Microsoft tavsiya qiladigan xavfsiz daraja:
kompyuteringizdagi skriptlarga ruxsat beradi, internetdan yuklangan imzolanmagan
skriptlarni esa to'sadi.

Holatni tekshirish:

```powershell
Get-ExecutionPolicy -List
```

### 4-yechim: `cmd.exe` dan foydalanish

PowerShell o'rniga oddiy buyruq satrini ishlatsangiz (`Win+R` → `cmd`),
`npm run build` hech qanday cheklovsiz ishlaydi.

---

## `node` ham topilmasa

```
'node' is not recognized as an internal or external command
```

Node.js o'rnatilmagan yoki `PATH` ga qo'shilmagan. Node.js ni o'rnatib,
so'ngra **buyruq satrini yopib qaytadan oching** (PATH yangilanishi uchun).

Tekshirish:

```cmd
node --version
```

`v20.11.0` yoki undan yuqori raqam chiqishi kerak.
