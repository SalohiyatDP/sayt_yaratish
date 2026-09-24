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
 */
import './server/server.mjs';
