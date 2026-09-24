# ============================================================================
#  Direksiya sayti — Docker tasviri
#
#  Loyiha hech qanday npm paketiga bog'liq emas, shu sababli `npm install`
#  qadami yo'q. Tasvirni qurishda ham qo'shimcha paketlar o'rnatilmaydi
#  (apk add ishlatilmaydi) — bu qurishni tez va ishonchli qiladi.
#
#  Qurish:
#      docker build -t direksiya-sayt .
#
#  Ishga tushirish (docker compose afzal — docker-compose.yml ga qaraysiz):
#      docker run -d --name direksiya -p 127.0.0.1:8080:8080 \
#        -v "$PWD/content:/app/content" \
#        -v "$PWD/assets/uploads:/app/assets/uploads" \
#        -v "$PWD/server/data:/app/server/data" \
#        --env-file .env \
#        direksiya-sayt
#
#  Eslatma: konteyner ichida vaqt UTC bo'yicha yuritiladi (tzdata o'rnatilmagan).
#  Jurnal va Telegram xabarlaridagi vaqtlar UTC deb belgilanadi.
# ============================================================================

FROM node:22-alpine

WORKDIR /app

# Kodni ko'chirish (.dockerignore keraksiz va maxfiy fayllarni chetlab o'tadi)
COPY package.json app.js ./
COPY src ./src
COPY server ./server
COPY assets ./assets
COPY content ./content
COPY i18n ./i18n
COPY admin ./admin

# Saytni tasvir ichida qurib, tekshirib qo'yamiz — konteyner darhol ishga tayyor.
# Kontent volume orqali almashtirilsa, boshqaruv panelidan qayta qurish mumkin.
RUN node src/build.mjs --quiet \
    && node src/check.mjs \
    && mkdir -p content/inbox assets/uploads server/data \
    && chown -R node:node /app

USER node

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

EXPOSE 8080

# Salomatlik tekshiruvi Node.js orqali bajariladi — curl kerak emas.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server/server.mjs"]
