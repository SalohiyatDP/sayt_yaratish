#!/usr/bin/env node
/**
 * Telegram botni bosqichma-bosqich sozlash.
 *
 * Ishlatilishi:
 *
 *   1-qadam — tokenni tekshirish va chat_id ni aniqlash:
 *       node server/tools/telegram-setup.mjs <bot-tokeni>
 *
 *   2-qadam — chat_id ni saqlash va sinov xabarini yuborish:
 *       node server/tools/telegram-setup.mjs <bot-tokeni> <chat-id>
 *
 *   Holatni tekshirish (saqlangan sozlamalar bilan):
 *       node server/tools/telegram-setup.mjs --check
 *
 *   Sinov xabarini qayta yuborish:
 *       node server/tools/telegram-setup.mjs --test
 *
 * Sozlamalar server/data/telegram.json faylida saqlanadi (repozitoriyaga tushmaydi).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from '../lib/env.mjs';
import * as telegram from '../notify/telegram.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
loadEnvFile(path.join(ROOT, '.env'));

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const positional = argv.filter((arg) => !arg.startsWith('--'));

const B = '\u001b[1m';
const DIM = '\u001b[2m';
const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const R = '\u001b[0m';

const say = (...parts) => console.log('  ', ...parts);
const blank = () => console.log('');

function header(text) {
  blank();
  console.log(`  ${B}${text}${R}`);
  console.log(`  ${DIM}${'─'.repeat(Math.max(text.length, 40))}${R}`);
  blank();
}

async function main() {
  header('Telegram botni sozlash');

  if (flag('help') || flag('h')) return printHelp();

  const [tokenArg, chatArg] = positional;

  // Token berilgan bo'lsa — darhol saqlaymiz (keyingi qadamlar shu token bilan ishlaydi)
  if (tokenArg) {
    if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(tokenArg)) {
      say(`${RED}Token noto'g'ri ko'rinishda.${R}`);
      blank();
      say('Kutilgan ko\'rinish:  1234567890:AAEhBOweik6ad9r_QXzR1_ABCdefGhIJklm');
      say('Tokenni @BotFather dan olasiz: /newbot (yangi bot) yoki /token (mavjud bot).');
      blank();
      process.exit(1);
    }
    await telegram.saveConfig({ botToken: tokenArg });
    say(`${GREEN}✓${R} Bot tokeni saqlandi: ${telegram.maskToken(tokenArg)}`);
  }

  if (chatArg) {
    // Bir nechta chat_id vergul yoki bo'shliq bilan berilishi mumkin
    const ids = chatArg.split(/[,;\s]+/).filter(Boolean);
    for (const id of ids) {
      if (!telegram.isChatId(id)) {
        say(`${RED}chat_id noto'g'ri ko'rinishda: ${id}${R}`);
        say('Kutilgan: 123456789, -1001234567890 yoki @kanal_nomi');
        blank();
        process.exit(1);
      }
    }
    // Mavjud ro'yxatga qo'shiladi (takrorlanganlar o'zi tashlab ketiladi)
    const existing = telegram.getConfig().recipients;
    await telegram.saveConfig({
      recipients: [...existing, ...ids.map((chatId) => ({ chatId, label: '' }))],
    });
    const total = telegram.getConfig().recipients.length;
    say(`${GREEN}✓${R} Xabar oluvchilar saqlandi: ${ids.join(', ')}  (jami ${total} ta)`);
  }

  const config = telegram.getConfig();

  /* ── Bot tokeni yo'q ── */
  if (!config.botToken) {
    say(`${YELLOW}Bot tokeni hali kiritilmagan.${R}`);
    blank();
    say(`${B}Bot qanday yaratiladi:${R}`);
    say('  1. Telegramda @BotFather ni oching');
    say('  2. /newbot buyrug\'ini yuboring');
    say('  3. Bot nomini kiriting, masalan:  Direksiya murojaatlari');
    say('  4. Bot foydalanuvchi nomini kiriting, oxiri "bot" bilan tugashi shart');
    say('  5. BotFather yuborgan tokenni nusxalang');
    blank();
    say(`${B}So'ngra shu buyruqni bajaring:${R}`);
    say(`  ${DIM}node server/tools/telegram-setup.mjs <bot-tokeni>${R}`);
    blank();
    process.exit(1);
  }

  /* ── Tokenni tekshirish ── */
  say(`${DIM}Bot tokeni tekshirilmoqda…${R}`);
  const me = await telegram.getMe(config);
  if (!me.ok) {
    say(`${RED}✗ Token tekshirilmadi: ${me.error}${R}`);
    blank();
    if (me.network) {
      say('Tarmoq xatoligi. Serverda internetga chiqish bor-yo\'qligini tekshiring.');
      say('Agar proksi ishlatilsa, HTTPS_PROXY o\'zgaruvchisini sozlash kerak bo\'ladi.');
    } else {
      say('Token eskirgan yoki xato bo\'lishi mumkin. @BotFather → /token orqali yangisini oling.');
    }
    blank();
    process.exit(1);
  }
  say(`${GREEN}✓${R} Bot topildi: ${B}@${me.result.username}${R} (${me.result.first_name})`);

  /* ── oluvchi yo'q: aniqlashga yordam beramiz ── */
  if (config.recipients.length === 0) {
    blank();
    say(`${YELLOW}Xabar oluvchi hali kiritilmagan — murojaatlar qaysi chatga kelishi belgilanmagan.${R}`);
    blank();
    say(`${B}chat_id ni qanday aniqlash kerak:${R}`);
    say(`  ${B}A) Shaxsiy chat${R} — Telegramda @${me.result.username} botini oching va /start yuboring.`);
    say(`  ${B}B) Guruh${R} — botni guruhga a'zo qilib qo'shing va guruhga biror xabar yozing.`);
    say('       Guruhda bot xabarlarni ko\'rishi uchun uni administrator qilish yoki');
    say('       @BotFather → /setprivacy → Disable qilish kerak bo\'ladi.');
    say(`  ${B}C) Kanal${R} — botni kanalga administrator qilib qo'shing, chat_id o'rniga @kanal_nomi yozasiz.`);
    blank();
    say(`${DIM}Oxirgi xabarlar tekshirilmoqda…${R}`);

    const updates = await telegram.callApi('getUpdates', { limit: 50 }, config);
    if (!updates.ok) {
      say(`${RED}✗ Xabarlarni o'qish imkoni bo'lmadi: ${updates.error}${R}`);
      blank();
      process.exit(1);
    }

    const chats = new Map();
    for (const update of updates.result || []) {
      const chat = update.message?.chat || update.channel_post?.chat || update.my_chat_member?.chat;
      if (chat && !chats.has(chat.id)) {
        chats.set(chat.id, {
          id: chat.id,
          type: chat.type,
          title: chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || '—',
        });
      }
    }

    blank();
    if (chats.size === 0) {
      say(`${YELLOW}Hech qanday chat topilmadi.${R}`);
      say('Botga (yoki bot qo\'shilgan guruhga) biror xabar yuboring va buyruqni qaytadan bajaring.');
      blank();
      process.exit(1);
    }

    say(`${B}Topilgan chatlar:${R}`);
    blank();
    for (const chat of chats.values()) {
      const kind = { private: 'shaxsiy chat', group: 'guruh', supergroup: 'guruh', channel: 'kanal' }[chat.type] || chat.type;
      say(`  chat_id: ${B}${chat.id}${R}   ${DIM}${kind}${R}   ${chat.title}`);
    }
    blank();
    say(`${B}Keraklisini tanlab, shu buyruqni bajaring:${R}`);
    say(`  ${DIM}node server/tools/telegram-setup.mjs "" <chat_id>${R}`);
    say(`  ${DIM}bir nechta oluvchi: node server/tools/telegram-setup.mjs "" "111,-100222,@kanal"${R}`);
    blank();
    process.exit(1);
  }

  /* ── Har bir oluvchini tekshirish ── */
  say(`${DIM}Xabar oluvchilar tekshirilmoqda (${config.recipients.length} ta)…${R}`);
  let working = 0;
  for (const entry of config.recipients) {
    const suffix = entry.label ? ` — ${entry.label}` : '';
    if (entry.disabled) {
      say(`  ${YELLOW}⏸${R} ${entry.chatId}${suffix}  (vaqtincha o'chirilgan)`);
      continue;
    }
    const chat = await telegram.callApi('getChat', { chat_id: entry.chatId }, config);
    if (chat.ok) {
      const title = chat.result.title || chat.result.username || chat.result.first_name || '—';
      say(`  ${GREEN}✓${R} ${entry.chatId}${suffix}  → ${B}${title}${R} (${chat.result.type})`);
      working += 1;
    } else {
      const explained = telegram.explainError(chat.error);
      say(`  ${RED}✗${R} ${entry.chatId}${suffix}  → ${explained.reason}`);
      say(`     ${DIM}${explained.fix}${R}`);
    }
  }
  if (working === 0) {
    blank();
    say(`${RED}Birorta ham ishlaydigan oluvchi yo'q.${R}`);
    blank();
    process.exit(1);
  }

  /* ── Sinov xabari ── */
  if (flag('check')) {
    blank();
    say(`${GREEN}Sozlamalar to'g'ri.${R} Sinov xabari yuborilmadi (--check rejimi).`);
    printNextSteps();
    return;
  }

  blank();
  say(`${DIM}Sinov xabari yuborilmoqda…${R}`);
  const test = await telegram.sendTestMessage('Sozlash yordamchisi orqali yuborildi.');
  if (test.delivered) {
    say(`${GREEN}✓ Sinov xabari yuborildi.${R} Telegramni tekshirib ko'ring.`);
  } else {
    say(`${RED}✗ Sinov xabari yuborilmadi: ${test.error}${R}`);
    blank();
    process.exit(1);
  }

  printNextSteps();
}

function printNextSteps() {
  header('Keyingi qadamlar');
  say('1. Murojaat shaklini yoqish — content/site.json faylida:');
  say(`   ${DIM}"features": { "contactFormEndpoint": "/api/contact" }${R}`);
  say('   (yoki boshqaruv panelidagi «Sayt sozlamalari» bo\'limidan)');
  blank();
  say('2. Saytni qayta qurish:');
  say(`   ${DIM}node src/build.mjs${R}`);
  blank();
  say('3. Serverni qayta ishga tushirish va saytdagi shakl orqali sinov murojaati yuborish.');
  blank();
  say(`${DIM}Sozlamalar fayli: server/data/telegram.json (maxfiy, repozitoriyaga tushmaydi)${R}`);
  blank();
}

function printHelp() {
  say('node server/tools/telegram-setup.mjs <bot-tokeni>            — tokenni tekshirish va chat_id ni aniqlash');
  say('node server/tools/telegram-setup.mjs <bot-tokeni> <chat-id>  — saqlash va sinov xabari');
  say('node server/tools/telegram-setup.mjs "" <chat-id>            — xabar oluvchi qo\'shish');
  say('node server/tools/telegram-setup.mjs "" "111,-100222"       — bir nechta oluvchi qo\'shish');
  say('node server/tools/telegram-setup.mjs --check                 — sozlamalarni tekshirish (xabar yubormasdan)');
  say('node server/tools/telegram-setup.mjs --test                  — sinov xabarini yuborish');
  blank();
}

main().catch((error) => {
  blank();
  console.error(`  ${RED}Kutilmagan xatolik:${R} ${error.message}`);
  blank();
  process.exit(1);
});
