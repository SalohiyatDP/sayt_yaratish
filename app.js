/**
 * Hosting kirish nuqtasi.
 *
 * Ko'p hostinglar (cPanel «Setup Node.js App», Plesk, Passenger, ba'zi PaaS
 * xizmatlari) ilova ildizidagi `app.js` faylini qidiradi. Bu fayl shunchaki
 * haqiqiy serverni ishga tushiradi.
 *
 * Port hosting tomonidan `PORT` muhit o'zgaruvchisi orqali beriladi —
 * server uni avtomatik o'qiydi.
 *
 * Qo'lda ishga tushirish uchun bu fayl shart emas:
 *     node server/server.mjs
 *
 * AI proksisi: hosting IP manzili AI provayder tomonidan bloklansa (masalan
 * Gemini «User location is not supported»), panelда proksi kiritiladi. So'rovlar
 * o'rnatilgan proksi tunneli (server/ai/proxy-fetch.mjs) orqali yuboriladi —
 * bu Node bayrog'iga bog'liq emas, ilovani maxsus ishga tushirish shart emas.
 */
import './server/server.mjs';
