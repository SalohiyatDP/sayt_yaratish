/**
 * Boshqaruv panelining asosiy skripti: kirish, bo'limlar va saqlash.
 */
import { qs, qsa, el, api, toast, pick, slugify, clone, todayIso, formatBytes, formatDateTime, confirmAction, emptyI18n, escapeHtml } from './lib.js';
import {
  getPath, setPath, textField, numberField, dateField, checkboxField, selectField,
  multiSelectField, i18nField, i18nListField, coordinatesField, jsonField,
  mediaListField, documentListField, sheetListField, zoneListField, explicationField,
  createDropZone,
} from './fields.js';

const state = {
  user: null,
  view: 'lots',
  taxonomies: null,
  cache: {},
  editing: null,
  dirty: false,
};

/* ─────────────────────────── Kirish ─────────────────────────── */

async function checkSession() {
  try {
    const data = await api.session();
    if (data.authenticated) {
      state.user = data.user;
      showApp();
    } else if (!data.configured) {
      // Hech qanday foydalanuvchi yo'q — birinchi administratorni yaratish ekrani
      showSetup(data);
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin('Server bilan aloqa yo\'q. Server ishlab turganini tekshiring.');
  }
}

function showLogin(message) {
  qs('#setup-screen').hidden = true;
  qs('#app-shell').hidden = true;
  qs('#login-screen').hidden = false;
  const errorBox = qs('#login-error');
  if (message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  } else {
    errorBox.hidden = true;
  }
  qs('#login-username').focus();
}

function showSetup(info = {}) {
  qs('#login-screen').hidden = true;
  qs('#app-shell').hidden = true;
  qs('#setup-screen').hidden = false;
  if (info.setupKeyFile) qs('#setup-key-file').textContent = info.setupKeyFile;
  qs('#setup-key-missing').hidden = info.setupKeyReady !== false;
  // preventScroll — shakl baland bo'lgani uchun oddiy focus() sahifani
  // pastga surib yuboradi va foydalanuvchi tushuntirishni ko'rmay qoladi
  qs('#setup-key').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function showApp() {
  qs('#login-screen').hidden = true;
  qs('#setup-screen').hidden = true;
  qs('#app-shell').hidden = false;
  qs('#current-user').textContent = `${state.user.name || state.user.username} · ${state.user.role}`;
  render();
  refreshCounts();
}

qs('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = qs('#login-submit');
  const errorBox = qs('#login-error');
  button.disabled = true;
  button.textContent = 'Tekshirilmoqda…';
  try {
    const result = await api.login(qs('#login-username').value.trim(), qs('#login-password').value);
    state.user = result.user;
    qs('#login-password').value = '';
    showApp();
  } catch (error) {
    const messages = {
      invalid_credentials: 'Foydalanuvchi nomi yoki parol xato.',
      too_many_attempts: 'Urinishlar soni oshib ketdi. 15 daqiqadan keyin qayta urinib ko\'ring.',
      no_users: 'Serverda foydalanuvchi yaratilmagan — sozlash oynasiga o\'tilmoqda…',
    };
    errorBox.textContent = messages[error.data?.error] || `Kirish amalga oshmadi: ${error.message}`;
    errorBox.hidden = false;
    // Foydalanuvchi yo'q bo'lsa birinchi administratorni yaratish ekraniga o'tamiz
    if (error.data?.error === 'no_users') {
      const info = await api.setupState().catch(() => ({}));
      setTimeout(() => showSetup({ setupKeyReady: info.keyReady, setupKeyFile: info.keyFile }), 1200);
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Kirish';
  }
});

qs('#setup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = qs('#setup-submit');
  const errorBox = qs('#setup-error');
  const password = qs('#setup-password').value;
  const repeat = qs('#setup-password2').value;
  const username = qs('#setup-username').value.trim().toLowerCase();

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  // Brauzerda oldindan tekshirish — serverga keraksiz urinish yuborilmaydi
  if (password !== repeat) return showError('Parollar bir-biriga mos kelmadi.');
  if (password.length < 12) return showError('Parol kamida 12 belgidan iborat bo\'lishi kerak.');
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return showError('Foydalanuvchi nomi 3–40 belgi: lotin harflari, raqam, nuqta, chiziqcha.');
  }
  if (password.toLowerCase().includes(username)) {
    return showError('Parol foydalanuvchi nomini o\'z ichiga olmasligi kerak.');
  }

  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = 'Yaratilmoqda…';
  try {
    const result = await api.setup({
      key: qs('#setup-key').value.trim(),
      username,
      name: qs('#setup-name').value.trim(),
      password,
    });
    state.user = result.user;
    qs('#setup-password').value = '';
    qs('#setup-password2').value = '';
    qs('#setup-key').value = '';
    toast('Administrator yaratildi. Panelga kirdingiz.', 'success');
    showApp();
  } catch (error) {
    const messages = {
      invalid_key: 'Kalit xato. Fayldagi qiymatni to\'liq nusxalab qo\'ying.',
      key_missing: 'Serverda kalit fayli yo\'q. Node.js ilovasini qayta ishga tushiring.',
      already_configured: 'Foydalanuvchi allaqachon mavjud. Kirish oynasiga o\'tildi.',
      too_many_attempts: 'Urinishlar soni oshib ketdi. 30 daqiqadan keyin qayta urinib ko\'ring.',
      username_format: 'Foydalanuvchi nomi talabga mos emas.',
      password_short: 'Parol kamida 12 belgidan iborat bo\'lishi kerak.',
      password_weak: 'Parol foydalanuvchi nomini o\'z ichiga olmasligi kerak.',
      csrf: 'So\'rov rad etildi. Sahifani yangilab, qaytadan urinib ko\'ring.',
    };
    const code = error.data?.error;
    showError(messages[code] || `Yaratish amalga oshmadi: ${error.message}`);
    if (code === 'already_configured') setTimeout(() => showLogin(), 1500);
  } finally {
    button.disabled = false;
    button.textContent = 'Administratorni yaratish';
  }
});

qs('#logout').addEventListener('click', async () => {
  if (state.dirty && !confirmAction('Saqlanmagan o\'zgarishlar bor. Chiqishni davom ettirasizmi?')) return;
  await api.logout().catch(() => undefined);
  state.user = null;
  state.dirty = false;
  showLogin();
});

window.addEventListener('admin:unauthorized', () => {
  if (state.user) {
    state.user = null;
    showLogin('Seans tugadi. Qaytadan kiring.');
  }
});

window.addEventListener('beforeunload', (event) => {
  if (state.dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});

/* ─────────────────────────── Navigatsiya ─────────────────────────── */

for (const link of qsa('.sidebar__link')) {
  link.addEventListener('click', () => {
    if (state.dirty && !confirmAction('Saqlanmagan o\'zgarishlar bor. Bo\'limni almashtirasizmi?')) return;
    state.dirty = false;
    state.editing = null;
    state.view = link.dataset.view;
    for (const other of qsa('.sidebar__link')) other.classList.toggle('is-active', other === link);
    render();
  });
}

/* ─────────────────────────── Ma'lumot yuklash ─────────────────────────── */

async function loadContent(name, force = false) {
  if (!force && state.cache[name]) return state.cache[name];
  const result = await api.getContent(name);
  state.cache[name] = result.data;
  return result.data;
}

async function saveContent(name) {
  const data = state.cache[name];
  if (!data) return false;
  try {
    // Server saqlaydi va darhol saytni qayta quradi — xodim hech narsa bosmaydi
    const result = await api.putContent(name, data);
    state.dirty = false;
    if (result.rebuilt === false) {
      toast(
        'Saqlandi, lekin saytni qurishda xatolik bo\'ldi. «Sayt holati va zaxira» bo\'limiga kirib xabarni ko\'ring.',
        'error',
        9000,
      );
    } else {
      toast('Saqlandi va saytga chiqarildi', 'success', 4000);
    }
    refreshCounts();
    return true;
  } catch (error) {
    toast(`Saqlanmadi: ${error.data?.error || error.message}`, 'error', 7000);
    return false;
  }
}

async function ensureTaxonomies() {
  if (state.taxonomies) return state.taxonomies;
  state.taxonomies = await loadContent('taxonomies');
  return state.taxonomies;
}

const options = (list) => (list || []).map((item) => ({ value: item.id, label: pick(item.name) }));

async function refreshCounts() {
  try {
    const [lots, masterplans, news] = await Promise.all([loadContent('lots'), loadContent('masterplans'), loadContent('news')]);
    setCount('lots', (lots.items || []).length);
    setCount('masterplans', (masterplans.items || []).length);
    setCount('news', (news.items || []).length);
    const inbox = await api.inbox().catch(() => null);
    if (inbox) {
      const list = inbox.items || [];
      setCount('inbox', list.filter((item) => item.status === 'new').length);
      // Telegramga yetkazilmagan murojaatlar soni
      setCount('telegram', list.filter((item) => item.telegram && !item.telegram.delivered && !item.telegram.skipped).length);
    }
  } catch (error) {
    /* e'tiborsiz */
  }
}

function setCount(key, value) {
  const node = qs(`[data-count="${key}"]`);
  if (node) node.textContent = value > 0 ? String(value) : '';
}

/* ─────────────────────────── Chizish ─────────────────────────── */

const main = () => qs('#main-view');

function setMain(...nodes) {
  const host = main();
  host.innerHTML = '';
  host.append(...nodes.filter(Boolean));
  host.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

async function render() {
  setMain(el('p', { class: 'a-loading', text: 'Yuklanmoqda…' }));
  try {
    const views = {
      lots: () => renderCollection('lots', LOTS_VIEW),
      masterplans: () => renderCollection('masterplans', MASTERPLANS_VIEW),
      news: () => renderCollection('news', NEWS_VIEW),
      site: renderSiteView,
      pages: renderPagesView,
      taxonomies: renderTaxonomiesView,
      inbox: renderInboxView,
      telegram: renderTelegramView,
      files: renderFilesView,
      build: renderBuildView,
      users: renderUsersView,
      account: renderAccountView,
    };
    await (views[state.view] || views.lots)();
  } catch (error) {
    setMain(el('div', { class: 'a-alert a-alert--error' }, [el('strong', { text: 'Xatolik' }), el('p', { text: error.message })]));
  }
}

/* ─────────────────────────── Kolleksiya ko'rinishlari ─────────────────────────── */

const LOTS_VIEW = {
  title: 'Hududlar va lotlar',
  singular: 'lot',
  idPrefix: 'lot',
  titleOf: (item) => pick(item.name) || item.id,
  metaOf: (item, tax) => [
    pick((tax.districts || []).find((d) => d.id === item.district)?.name),
    pick((tax.areaTypes || []).find((d) => d.id === item.areaType)?.name),
    item.areaHa != null ? `${item.areaHa} ga` : null,
    pick((tax.lotStatuses || []).find((d) => d.id === item.status)?.name),
    item.lotNumber ? `№ ${item.lotNumber}` : null,
  ],
  blank: () => ({
    id: '',
    slug: '',
    lotNumber: null,
    name: emptyI18n(),
    district: null,
    areaType: null,
    location: emptyI18n(),
    coordinates: null,
    boundary: null,
    cadastreNumber: '',
    areaHa: null,
    areaSotix: null,
    tourismDirections: [],
    status: 'study',
    shortDescription: emptyI18n(),
    description: emptyI18n(),
    media: [],
    masterplanId: null,
    plannedObjects: [],
    services: [],
    access: emptyI18n(),
    infrastructure: [],
    requirements: [],
    restrictions: [],
    auction: {
      status: 'not-announced',
      announcementDate: '',
      startDate: '',
      startPrice: null,
      currency: 'UZS',
      rightType: null,
      rightTypeText: emptyI18n(),
      lotUrl: null,
      verified: false,
    },
    documents: [],
    updatedAt: todayIso(),
    published: true,
    demo: false,
  }),
  form: async (record) => {
    const tax = await ensureTaxonomies();
    const masterplans = await loadContent('masterplans');
    return [
      group('Asosiy ma\'lumotlar', [
        i18nField(record, {
          path: 'name',
          label: 'Hudud / lot nomi *',
          onInput: (value) => {
            if (!record.slug) record.slug = slugify(pick(value));
            const slugInput = qs('[data-slug-input]');
            if (slugInput && !slugInput.dataset.touched) slugInput.value = record.slug;
          },
        }),
        el('div', { class: 'a-row' }, [
          slugControl(record),
          textField(record, { path: 'lotNumber', label: 'Lot raqami', hint: 'Rasmiy hujjatdagi raqam' }),
        ]),
        el('div', { class: 'a-row' }, [
          selectField(record, { path: 'district', label: 'Tuman *' }, options(tax.districts)),
          selectField(record, { path: 'areaType', label: 'Hudud turi *' }, options(tax.areaTypes)),
          selectField(record, { path: 'status', label: 'Joriy holat *' }, options(tax.lotStatuses)),
        ]),
        el('div', { class: 'a-row' }, [
          numberField(record, { path: 'areaHa', label: 'Maydon, gektar', step: '0.01', min: '0' }),
          numberField(record, { path: 'areaSotix', label: 'Maydon, sotix', step: '0.01', min: '0' }),
          textField(record, { path: 'cadastreNumber', label: 'Kadastr raqami' }),
        ]),
        multiSelectField(record, { path: 'tourismDirections', label: 'Turizm yo\'nalishlari' }, options(tax.tourismDirections)),
      ]),

      group('Joylashuv va xarita', [
        i18nField(record, { path: 'location', label: 'Joylashuv tavsifi', multiline: true }),
        coordinatesField(record, { path: 'coordinates', label: 'Koordinatalar' }),
        jsonField(record, {
          path: 'boundary',
          label: 'Kadastr chegarasi konturi',
          rows: 6,
          placeholder: '[[41.0762, 71.8105], [41.0765, 71.8168], [41.0722, 71.8172]]',
          hint: 'Nuqtalar [kenglik, uzunlik] juftliklari ko\'rinishida. Berilgan konturni o\'zgartirmang va soddalashtirmang. Kamida 3 nuqta kerak.',
        }),
      ]),

      group('Tavsif', [
        i18nField(record, { path: 'shortDescription', label: 'Qisqa tavsif (kartochkada ko\'rinadi)', multiline: true, rows: 3 }),
        i18nField(record, { path: 'description', label: 'To\'liq tavsif', multiline: true, rows: 8, hint: 'Oddiy matn yoki cheklangan HTML: <p> <strong> <em> <ul> <li> <a href>' }),
      ]),

      group('Tasvirlar', [mediaListField(record, { path: 'media', label: 'Fotosuratlar va vizualizatsiyalar', folder: 'lots' })]),

      group('Rejalashtirilgan obyektlar va infratuzilma', [
        i18nListField(record, { path: 'plannedObjects', label: 'Rejalashtirilgan turizm obyektlari' }),
        i18nListField(record, { path: 'services', label: 'Xizmat turlari' }),
        i18nField(record, { path: 'access', label: 'Kirish yo\'li', multiline: true, rows: 3 }),
        i18nListField(record, { path: 'infrastructure', label: 'Mavjud muhandislik infratuzilmasi' }),
      ]),

      group('Talablar va cheklovlar', [
        i18nListField(record, { path: 'requirements', label: 'Hujjatlardagi talablar' }),
        i18nListField(record, { path: 'restrictions', label: 'Cheklovlar' }),
      ]),

      group('Master-reja va hujjatlar', [
        selectField(
          record,
          { path: 'masterplanId', label: 'Bog\'liq master-reja' },
          (masterplans.items || []).map((plan) => ({ value: plan.id, label: pick(plan.title) || plan.id })),
        ),
        documentListField(record, { path: 'documents', label: 'Yuklab olinadigan hujjatlar', folder: 'lots' }),
      ]),

      auctionGroup(record, tax),

      group('Nashr', [
        dateField(record, { path: 'updatedAt', label: 'Ma\'lumot yangilangan sana' }),
      ]),
    ];
  },
};

function auctionGroup(record, tax) {
  if (!record.auction) record.auction = LOTS_VIEW.blank().auction;
  const warning = el('div', { class: 'a-alert a-alert--warning' }, [
    el('strong', { text: 'Aukcion ma\'lumotlari' }),
    el('p', {
      text: '«Ma\'lumotlar rasmiy tasdiqlangan» katagi belgilanmaguncha sana, boshlang\'ich narx va huquq turi saytda KO\'RSATILMAYDI. Havolaga faqat aynan shu lotning E-auksion sahifasi yozilishi kerak — platformaning umumiy manzili qabul qilinmaydi.',
    }),
  ]);
  return group('Aukcion', [
    warning,
    el('div', { class: 'a-row' }, [
      dateField(record, { path: 'auction.announcementDate', label: 'E\'lon sanasi' }),
      dateField(record, { path: 'auction.startDate', label: 'Aukcion sanasi' }),
    ]),
    el('div', { class: 'a-row' }, [
      numberField(record, { path: 'auction.startPrice', label: 'Boshlang\'ich narx', step: '1', min: '0' }),
      textField(record, { path: 'auction.currency', label: 'Valyuta', placeholder: 'UZS' }),
      selectField(record, { path: 'auction.rightType', label: 'Huquq turi' }, options(tax.rightTypes?.items)),
    ]),
    i18nField(record, {
      path: 'auction.rightTypeText',
      label: 'Huquq turi — hujjatdagi aniq ibora',
      multiline: true,
      rows: 2,
      hint: 'Rasmiy hujjatdan ko\'chirib yozing. Umumiy «yer sotiladi» iborasidan foydalanish man etiladi.',
    }),
    textField(record, {
      path: 'auction.lotUrl',
      label: 'E-auksion\'dagi lot havolasi',
      inputType: 'url',
      placeholder: 'https://e-auksion.uz/...',
      hint: 'Bo\'sh qoldirilsa, saytdagi tugma faolsiz bo\'ladi va sababi ochiq yoziladi.',
    }),
    checkboxField(record, {
      path: 'auction.verified',
      label: 'Aukcion ma\'lumotlari rasmiy tasdiqlangan',
      hint: 'Faqat rasmiy e\'lon bilan solishtirib tekshirilgandan keyin belgilang.',
    }),
  ]);
}

const MASTERPLANS_VIEW = {
  title: 'Master-rejalar',
  singular: 'master-reja',
  idPrefix: 'mp',
  titleOf: (item) => pick(item.title) || item.id,
  metaOf: (item, tax) => [
    pick((tax.districts || []).find((d) => d.id === item.district)?.name),
    pick((tax.masterplanStatuses || []).find((d) => d.id === item.status)?.name),
    item.totalAreaHa != null ? `${item.totalAreaHa} ga` : null,
    item.zones?.length ? `${item.zones.length} zona` : null,
  ],
  blank: () => ({
    id: '',
    slug: '',
    title: emptyI18n(),
    district: null,
    areaType: null,
    lotIds: [],
    status: 'concept',
    approvedBy: emptyI18n(),
    approvalDocument: '',
    approvalDate: '',
    summary: emptyI18n(),
    totalAreaHa: null,
    zones: [],
    explication: [],
    solutions: { pedestrian: emptyI18n(), transport: emptyI18n(), parking: emptyI18n(), landscaping: emptyI18n(), engineering: emptyI18n() },
    sheets: [],
    documents: [],
    updatedAt: todayIso(),
    published: true,
    demo: false,
  }),
  form: async (record) => {
    const tax = await ensureTaxonomies();
    const lots = await loadContent('lots');
    return [
      group('Asosiy ma\'lumotlar', [
        i18nField(record, {
          path: 'title',
          label: 'Master-reja nomi *',
          onInput: (value) => syncSlug(record, value),
        }),
        el('div', { class: 'a-row' }, [
          slugControl(record),
          selectField(record, { path: 'district', label: 'Tuman' }, options(tax.districts)),
          selectField(record, { path: 'areaType', label: 'Hudud turi' }, options(tax.areaTypes)),
        ]),
        el('div', { class: 'a-alert a-alert--info' }, [
          el('strong', { text: 'Hujjat holatini to\'g\'ri tanlang' }),
          el('p', { text: 'Sayt tanlangan holatga qarab ogohlantirish matnini o\'zi qo\'yadi: konsepsiya, ishlab chiqilayotgan reja yoki tasdiqlangan master-reja.' }),
        ]),
        el('div', { class: 'a-row' }, [
          selectField(record, { path: 'status', label: 'Hujjat holati *' }, options(tax.masterplanStatuses)),
          numberField(record, { path: 'totalAreaHa', label: 'Umumiy maydon, ga', step: '0.01' }),
        ]),
        i18nField(record, { path: 'summary', label: 'Umumiy tavsif', multiline: true, rows: 5 }),
      ]),

      group('Tasdiqlash', [
        i18nField(record, { path: 'approvedBy', label: 'Tasdiqlagan organ', multiline: false }),
        el('div', { class: 'a-row' }, [
          textField(record, { path: 'approvalDocument', label: 'Tasdiqlash hujjati' }),
          dateField(record, { path: 'approvalDate', label: 'Tasdiqlangan sana' }),
        ]),
      ]),

      group('Zonalar va eksplikatsiya', [
        zoneListField(record, { path: 'zones', label: 'Funksional zonalar' }),
        explicationField(record, { path: 'explication', label: 'Obyektlar eksplikatsiyasi' }),
      ]),

      group('Loyiha yechimlari', [
        i18nField(record, { path: 'solutions.pedestrian', label: 'Piyodalar yo\'laklari', multiline: true, rows: 2 }),
        i18nField(record, { path: 'solutions.transport', label: 'Transport kirishi', multiline: true, rows: 2 }),
        i18nField(record, { path: 'solutions.parking', label: 'Avtoturargoh', multiline: true, rows: 2 }),
        i18nField(record, { path: 'solutions.landscaping', label: 'Ko\'kalamzorlashtirish', multiline: true, rows: 2 }),
        i18nField(record, { path: 'solutions.engineering', label: 'Muhandislik ta\'minoti', multiline: true, rows: 2 }),
      ]),

      group('Chizmalar va hujjatlar', [
        sheetListField(record, { path: 'sheets', label: 'Chizmalar va tasvirlar' }),
        documentListField(record, { path: 'documents', label: 'Yuklab olinadigan hujjatlar (PDF)', folder: 'masterplans' }),
      ]),

      group('Bog\'liq lotlar', [
        multiSelectField(
          record,
          { path: 'lotIds', label: 'Rejaga kiruvchi lotlar' },
          (lots.items || []).map((lot) => ({ value: lot.id, label: pick(lot.name) || lot.id })),
        ),
      ]),

      group('Nashr', [
        dateField(record, { path: 'updatedAt', label: 'Yangilangan sana' }),
      ]),
    ];
  },
};

const NEWS_VIEW = {
  title: 'Yangiliklar',
  singular: 'yangilik',
  idPrefix: 'news',
  titleOf: (item) => pick(item.title) || item.id,
  metaOf: (item, tax, file) => [
    item.date,
    pick((file.categories || []).find((c) => c.id === item.category)?.name),
  ],
  blank: () => ({
    id: '',
    slug: '',
    category: 'official',
    date: todayIso(),
    title: emptyI18n(),
    lead: emptyI18n(),
    body: emptyI18n(),
    cover: null,
    gallery: [],
    relatedLotIds: [],
    relatedMasterplanIds: [],
    sourceUrl: '',
    published: true,
    demo: false,
  }),
  form: async (record) => {
    const file = await loadContent('news');
    const lots = await loadContent('lots');
    const masterplans = await loadContent('masterplans');
    if (!Array.isArray(record.gallery)) record.gallery = [];

    return [
      el('div', { class: 'a-alert a-alert--warning' }, [
        el('strong', { text: 'Faqat haqiqiy voqealar' }),
        el('p', { text: 'Bo\'lib o\'tmagan tadbir, uchrashuv yoki sanani kiritish man etiladi. Sana noma\'lum bo\'lsa, yangilikni nashr etmang.' }),
      ]),
      group('Asosiy ma\'lumotlar', [
        i18nField(record, {
          path: 'title',
          label: 'Sarlavha *',
          onInput: (value) => syncSlug(record, value),
        }),
        el('div', { class: 'a-row' }, [
          slugControl(record),
          dateField(record, { path: 'date', label: 'Sana *' }),
          selectField(record, { path: 'category', label: 'Rukn' }, options(file.categories)),
        ]),
        i18nField(record, { path: 'lead', label: 'Qisqa mazmun (lead)', multiline: true, rows: 3 }),
        i18nField(record, { path: 'body', label: 'Matn', multiline: true, rows: 12, hint: 'Cheklangan HTML: <p> <strong> <em> <ul> <ol> <li> <a href> <h3> <blockquote>' }),
        textField(record, { path: 'sourceUrl', label: 'Rasmiy manba havolasi', inputType: 'url' }),
      ]),
      group('Tasvirlar', [
        coverField(record),
        mediaListField(record, { path: 'gallery', label: 'Galereya', folder: 'news' }),
      ]),
      group('Bog\'liq materiallar', [
        multiSelectField(record, { path: 'relatedLotIds', label: 'Lotlar' }, (lots.items || []).map((lot) => ({ value: lot.id, label: pick(lot.name) || lot.id }))),
        multiSelectField(record, { path: 'relatedMasterplanIds', label: 'Master-rejalar' }, (masterplans.items || []).map((plan) => ({ value: plan.id, label: pick(plan.title) || plan.id }))),
      ]),
    ];
  },
};

function coverField(record) {
  const host = el('div', { class: 'a-field' });
  const draw = () => {
    host.innerHTML = '';
    host.append(el('span', { class: 'a-field__label', text: 'Muqova tasviri' }));
    if (record.cover?.src) {
      host.append(
        el('div', { class: 'media-tile', style: 'max-width:260px' }, [
          el('img', { src: record.cover.src, alt: '' }),
          el('div', { class: 'media-tile__body' }, [
            (() => {
              const select = el('select', { class: 'a-input', onChange: (e) => { record.cover.kind = e.target.value; } });
              for (const kind of [{ value: 'photo', label: 'Haqiqiy fotosurat' }, { value: 'render', label: 'Loyiha konsepsiyasi' }]) {
                select.append(el('option', { value: kind.value, text: kind.label, selected: (record.cover.kind || 'photo') === kind.value }));
              }
              return select;
            })(),
            i18nField(record.cover, { path: 'alt', label: 'Matnli tavsif (alt)', multiline: false }),
            i18nField(record.cover, { path: 'caption', label: 'Izoh', multiline: false }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: 'O\'chirish', onClick: () => { record.cover = null; draw(); } }),
          ]),
        ]),
      );
    } else {
      host.append(el('p', { class: 'a-muted a-small', text: 'Muqova tanlanmagan.' }));
      host.append(
        createDropZone({
          folder: 'news',
          accept: 'image/*',
          multiple: false,
          onUploaded: (result) => {
            record.cover = { src: result.src, kind: 'photo', alt: emptyI18n(), caption: emptyI18n() };
            draw();
          },
        }),
      );
    }
  };
  draw();
  return host;
}

/* ── Manzil (slug) ────────────────────────────────────────────────────────
 * Slug nomdan avtomatik yasaladi va nom yozilgan sari yangilanib turadi.
 * Xodim maydonni o'zi tahrirlasa, avtomatik to'ldirish o'sha zahoti to'xtaydi.
 * Mavjud (saqlangan) yozuvda slug avtomatik o'zgarmaydi — tashqi havolalar
 * buzilmasligi kerak.
 */

// Ochiq tahrirlovchidagi slug maydoni. Har yangi tahrirlovchida tozalanadi.
let slugInputRef = null;

function slugControl(record) {
  const isNew = Boolean(state.editing?.isNew);
  const input = el('input', {
    type: 'text',
    value: record.slug || '',
    dataset: { slugInput: 'true' },
    onInput: (event) => {
      // Qo'lda tahrirlangandan keyin nomga bog'lanish uzilib qoladi
      event.target.dataset.touched = 'true';
      record.slug = slugify(event.target.value);
      hint.textContent = HINT_MANUAL;
    },
    onBlur: (event) => {
      event.target.value = record.slug || '';
    },
  });
  slugInputRef = input;

  const HINT_AUTO = 'Nomdan avtomatik to\'ldiriladi. Xohlasangiz o\'zingiz ham yozishingiz mumkin.';
  const HINT_MANUAL = 'Qo\'lda kiritildi — endi nomga qarab o\'zgarmaydi.';
  const HINT_SAVED = 'Sahifa manzilida ishlatiladi. O\'zgartirish tashqi havolalarni buzadi — zarur bo\'lmasa tegmang.';
  const hint = el('span', { class: 'a-field__hint', text: isNew ? HINT_AUTO : HINT_SAVED });

  // Saqlangan yozuvda nomdan qayta yasash faqat xodim so'raganda bo'ladi
  const regenerate = isNew
    ? null
    : el('button', {
        type: 'button',
        class: 'a-btn a-btn--sm',
        text: 'Nomdan qayta yasash',
        style: 'margin-top:0.35rem;align-self:start',
        onClick: () => {
          const source = pick(record.title ?? record.name);
          if (!source) {
            toast('Avval nomni to\'ldiring.', 'error');
            return;
          }
          if (!confirmAction('Manzil o\'zgarsa, bu sahifaga oldin berilgan havolalar ishlamay qoladi. Davom etasizmi?')) return;
          record.slug = slugify(source);
          input.value = record.slug;
          state.dirty = true;
        },
      });

  return el('label', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: 'Manzil (slug)' }),
    input,
    hint,
    regenerate,
  ]);
}

/**
 * Nom o'zgarganda slugni yangilaydi.
 * Nom maydonining har bosilishida chaqiriladi.
 */
function syncSlug(record, nameValue) {
  if (!state.editing?.isNew) return;
  if (!slugInputRef || slugInputRef.dataset.touched === 'true') return;
  record.slug = slugify(pick(nameValue));
  slugInputRef.value = record.slug;
}

/**
 * Nashr holati — tahrirlovchining eng yuqorisida turadi.
 * Ilgari bu oddiy katak shakl oxirida edi va e'tibordan chetda qolardi:
 * yozuv kiritilardi, lekin saytda ko'rinmasdi.
 */
function publishBar(record) {
  const host = el('div', {});
  const draw = () => {
    const live = record.published !== false;
    host.innerHTML = '';
    host.append(
      el('div', { class: `publish-bar publish-bar--${live ? 'live' : 'draft'}` }, [
        el('div', { class: 'publish-bar__text' }, [
          el('strong', { text: live ? 'Saytda ko\'rinadi' : 'Qoralama — saytda ko\'rinmaydi' }),
          el('span', {
            class: 'a-small',
            text: live
              ? 'Saqlaganingizdan so\'ng ommaviy saytda darhol chiqadi.'
              : 'Faqat shu panelda turadi. Saytga chiqarish uchun holatni o\'zgartiring.',
          }),
        ]),
        el('button', {
          type: 'button',
          class: `a-btn a-btn--sm${live ? '' : ' a-btn--primary'}`,
          text: live ? 'Qoralamaga olish' : 'Saytga chiqarish',
          onClick: () => {
            record.published = !live;
            state.dirty = true;
            draw();
          },
        }),
      ]),
    );
  };
  draw();
  return host;
}

function group(title, children, note) {
  return el('section', { class: 'group' }, [
    el('h2', { class: 'group__title', text: title }),
    note ? el('p', { class: 'group__note', text: note }) : null,
    ...children,
  ]);
}

/* ─────────────────────────── Ro'yxat va tahrirlash ─────────────────────────── */

async function renderCollection(name, view) {
  const file = await loadContent(name);
  const tax = await ensureTaxonomies();
  if (!Array.isArray(file.items)) file.items = [];

  if (state.editing && state.editing.name === name) {
    return renderEditor(name, view, file, tax);
  }

  const list = el('div', { class: 'rec-list' });
  if (file.items.length === 0) {
    list.append(
      el('div', { class: 'empty-box' }, [
        el('p', { text: `Hozircha ${view.singular} qo'shilmagan.` }),
        el('p', { class: 'a-small', text: 'Saytda "Ma\'lumot hozircha joylashtirilmagan" holati ko\'rinadi.' }),
      ]),
    );
  }

  file.items.forEach((item, index) => {
    const meta = (view.metaOf(item, tax, file) || []).filter(Boolean);
    list.append(
      el('article', { class: `rec${item.published === false ? ' rec--unpublished' : ''}` }, [
        el('p', { class: 'rec__title' }, [
          view.titleOf(item),
          item.demo ? el('span', { class: 'a-tag a-tag--demo', text: 'DEMO', style: 'margin-left:.4rem' }) : null,
          item.published === false ? el('span', { class: 'a-tag a-tag--warning', text: 'qoralama — saytda yo\'q', style: 'margin-left:.4rem' }) : null,
        ]),
        el('p', { class: 'rec__meta' }, meta.map((value) => el('span', { class: 'a-tag', text: value }))),
        el('div', { class: 'rec__actions' }, [
          el('button', {
            type: 'button',
            class: 'a-btn a-btn--sm',
            text: 'Tahrirlash',
            onClick: () => {
              state.editing = { name, index, record: clone(item), isNew: false };
              render();
            },
          }),
          // Qoralamani bir bosishda saytga chiqarish
          item.published === false
            ? el('button', {
                type: 'button',
                class: 'a-btn a-btn--sm a-btn--primary',
                text: 'Saytga chiqarish',
                onClick: async () => {
                  file.items[index] = { ...item, published: true };
                  await saveContent(name);
                  render();
                },
              })
            : null,
          el('button', {
            type: 'button',
            class: 'a-btn a-btn--sm',
            text: 'Nusxalash',
            onClick: () => {
              const copy = clone(item);
              copy.id = '';
              copy.slug = '';
              copy.published = false;
              state.editing = { name, index: -1, record: copy, isNew: true };
              render();
            },
          }),
          el('button', {
            type: 'button',
            class: 'a-btn a-btn--sm a-btn--danger',
            text: 'O\'chirish',
            onClick: async () => {
              if (!confirmAction(`"${view.titleOf(item)}" o'chirilsinmi? Bu amalni qaytarib bo'lmaydi (zaxira nusxa serverda saqlanadi).`)) return;
              file.items.splice(index, 1);
              await saveContent(name);
              render();
            },
          }),
        ]),
      ]),
    );
  });

  setMain(
    el('div', { class: 'page-bar' }, [
      el('h1', { text: view.title }),
      el('div', { class: 'page-bar__actions' }, [
        el('button', {
          type: 'button',
          class: 'a-btn a-btn--primary',
          text: `+ Yangi ${view.singular}`,
          onClick: () => {
            state.editing = { name, index: -1, record: view.blank(), isNew: true };
            render();
          },
        }),
      ]),
    ]),
    list,
  );
}

async function renderEditor(name, view, file, tax) {
  const { record, index, isNew } = state.editing;
  slugInputRef = null;
  const fields = await view.form(record);

  const save = async () => {
    if (!pick(record[name === 'masterplans' ? 'title' : 'name'] ?? record.title ?? record.name)) {
      toast('Nom kamida bitta tilda to\'ldirilishi kerak.', 'error');
      return;
    }
    if (!record.slug) {
      record.slug = slugify(pick(record.title ?? record.name) || `${view.idPrefix}-${Date.now()}`);
    }
    if (!record.id) {
      const used = new Set((file.items || []).map((item) => item.id));
      let counter = file.items.length + 1;
      let candidate = `${view.idPrefix}-${String(counter).padStart(4, '0')}`;
      while (used.has(candidate)) {
        counter += 1;
        candidate = `${view.idPrefix}-${String(counter).padStart(4, '0')}`;
      }
      record.id = candidate;
    }
    const duplicate = (file.items || []).some((item, i) => item.slug === record.slug && i !== index);
    if (duplicate) {
      toast(`"${record.slug}" manzili band. Boshqa slug kiriting.`, 'error', 6000);
      return;
    }

    if (isNew) file.items.push(record);
    else file.items[index] = record;

    const ok = await saveContent(name);
    if (ok) {
      state.editing = null;
      render();
    }
  };

  const actions = el('div', { class: 'sticky-actions' }, [
    el('button', { type: 'button', class: 'a-btn a-btn--primary', text: 'Saqlash', onClick: save }),
    el('button', {
      type: 'button',
      class: 'a-btn',
      text: 'Bekor qilish',
      onClick: () => {
        if (state.dirty && !confirmAction('O\'zgarishlar saqlanmaydi. Davom etasizmi?')) return;
        state.dirty = false;
        state.editing = null;
        render();
      },
    }),
    el('span', { class: 'sticky-actions__spacer' }),
    el('span', { class: 'a-small a-muted', text: record.id ? `ID: ${record.id}` : 'ID saqlashda beriladi' }),
  ]);

  const editor = el('form', { class: 'editor', onSubmit: (event) => { event.preventDefault(); save(); } }, [
    publishBar(record),
    ...fields,
    actions,
  ]);
  editor.addEventListener('input', () => {
    state.dirty = true;
  });
  editor.addEventListener('change', () => {
    state.dirty = true;
  });

  setMain(
    el('div', { class: 'page-bar' }, [
      el('h1', { text: `${isNew ? 'Yangi' : 'Tahrirlash'}: ${view.singular}` }),
    ]),
    editor,
  );
}

/* ─────────────────────────── Sayt sozlamalari ─────────────────────────── */

async function renderSiteView() {
  const site = await loadContent('site');
  site.institution ??= {};
  site.contacts ??= {};
  site.eauction ??= {};
  site.features ??= {};
  site.seo ??= {};
  site.media ??= {};
  site.statistics ??= { verified: false, items: [] };

  const form = el('form', { class: 'editor', onSubmit: (e) => e.preventDefault() }, [
    group('Muassasa', [
      i18nField(site, { path: 'institution.name', label: 'To\'liq rasmiy nomi', multiline: true, rows: 3 }),
      i18nField(site, { path: 'institution.shortName', label: 'Qisqa nomi (sarlavhada ko\'rinadi)', multiline: false }),
      i18nField(site, { path: 'institution.abbr', label: 'Juda qisqa nomi (ilova ikonkasi uchun)', multiline: false }),
      i18nField(site, { path: 'mission', label: 'Muassasaning vazifasi', multiline: true, rows: 4 }),
      i18nField(site, { path: 'slogan', label: 'Shior', multiline: false }),
    ]),

    group('Bog\'lanish rekvizitlari', [
      el('div', { class: 'a-alert a-alert--info' }, [
        el('p', { text: 'Faqat tasdiqlangan rasmiy rekvizitlarni kiriting. Bo\'sh qoldirilgan maydonlar saytda ko\'rsatilmaydi.' }),
      ]),
      i18nField(site, { path: 'contacts.address', label: 'Manzil', multiline: true, rows: 2 }),
      stringListField(site, 'contacts.phones', 'Telefon raqamlari', '+998 XX XXX-XX-XX'),
      stringListField(site, 'contacts.emails', 'Elektron pochta', 'info@example.uz'),
      i18nField(site, { path: 'contacts.workingHours', label: 'Ish vaqti', multiline: false }),
      i18nField(site, { path: 'contacts.receptionHours', label: 'Qabul vaqtlari', multiline: false }),
      coordinatesField(site, { path: 'contacts.coordinates', label: 'Bino koordinatalari' }),
      socialListField(site),
    ]),

    group('E-auksion', [
      textField(site, { path: 'eauction.platformName', label: 'Platforma nomi' }),
      textField(site, { path: 'eauction.platformUrl', label: 'Platformaning umumiy manzili', inputType: 'url', hint: 'Bu manzil hech qachon muayyan lot havolasi sifatida ishlatilmaydi.' }),
      i18nField(site, { path: 'eauction.notice', label: 'Aukcion haqida rasmiy izoh', multiline: true, rows: 4 }),
    ]),

    group('Statistik ko\'rsatkichlar', [
      el('div', { class: 'a-alert a-alert--warning' }, [
        el('strong', { text: 'Diqqat' }),
        el('p', { text: 'Ko\'rsatkichlar bosh sahifada FAQAT "tasdiqlangan" katagi belgilangan va manba ko\'rsatilgan bo\'lsa chiqadi. Taxminiy raqam kiritish man etiladi.' }),
      ]),
      checkboxField(site, { path: 'statistics.verified', label: 'Ko\'rsatkichlar rasmiy tasdiqlangan' }),
      textField(site, { path: 'statistics.source', label: 'Manba (hujjat nomi)' }),
      dateField(site, { path: 'statistics.asOfDate', label: 'Holat sanasi' }),
      statsField(site),
    ]),

    group('Rahbariyat', [
      el('p', { class: 'group__note', text: '«Direksiya haqida» sahifasida ko\'rinadi. Faqat kadrlar bo\'limi tasdiqlagan ma\'lumotlarni kiriting. Ro\'yxat bo\'sh bo\'lsa, saytda bo\'lim o\'rniga «Ma\'lumot hozircha joylashtirilmagan» chiqadi.' }),
      leadershipField(site),
    ]),

    group('Tuzilma', [
      el('p', { class: 'group__note', text: 'Muassasa bo\'limlari. Tasdiqlangan shtat jadvali asosida to\'ldiriladi.' }),
      structureField(site),
    ]),

    group('Me\'yoriy hujjatlar', [
      el('p', { class: 'group__note', text: 'Havola (tashqi manzil, masalan lex.uz) yoki yuklangan fayl ko\'rsatish mumkin.' }),
      siteDocumentsField(site),
    ]),

    group('Bosh sahifa tasviri', [
      el('div', { class: 'a-alert a-alert--warning' }, [
        el('p', { text: 'FAQAT Namangan viloyatining haqiqiy fotosuratidan foydalaning. Boshqa hududlarning tasvirini Namangan deb ko\'rsatish man etiladi. Tasvir qo\'yilmasa, bosh ekranda abstrakt geometrik bezak ishlatiladi — u hech qanday joyni tasvirlamaydi.' }),
      ]),
      heroImageField(site),
    ]),

    group('Texnik sozlamalar', [
      textField(site, {
        path: 'features.contactFormEndpoint',
        label: 'Murojaatlarni qabul qilish manzili',
        placeholder: '/api/contact',
        hint: 'Bo\'sh bo\'lsa, murojaat shakli faolsiz qoladi va saytda "qabul qilish tizimi ulanmagan" deb ochiq yoziladi. Shu server ishlatilsa: /api/contact',
      }),
      textField(site, { path: 'features.contactFormFallbackEmail', label: 'Zaxira elektron pochta', inputType: 'email' }),
      textField(site, { path: 'seo.canonicalOrigin', label: 'Saytning to\'liq manzili', placeholder: 'https://example.uz', hint: 'sitemap.xml va canonical havolalar uchun.' }),
      textField(site, { path: 'features.mapTileUrl', label: 'Xarita plitkalari manzili' }),
      textField(site, { path: 'features.mapTileAttribution', label: 'Xarita manbasi (attribution)' }),
      textField(site, { path: 'media.logo', label: 'Logotip fayli', placeholder: '/assets/img/logo.svg' }),
      logoUpload(site),
    ]),

    el('div', { class: 'sticky-actions' }, [
      el('button', { type: 'button', class: 'a-btn a-btn--primary', text: 'Saqlash', onClick: () => saveContent('site') }),
      el('span', { class: 'sticky-actions__spacer' }),
      el('span', { class: 'a-small a-muted', text: 'site.json' }),
    ]),
  ]);

  form.addEventListener('input', () => { state.dirty = true; });
  form.addEventListener('change', () => { state.dirty = true; });

  setMain(el('div', { class: 'page-bar' }, [el('h1', { text: 'Sayt sozlamalari' })]), form);
}

/** Rahbariyat ro'yxati. */
function leadershipField(site) {
  let items = getPath(site, 'leadership.items');
  if (!Array.isArray(items)) {
    items = [];
    setPath(site, 'leadership.items', items);
  }
  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Kiritilmagan.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            i18nField(item, { path: 'name', label: 'Ism-familiya, sharifi', multiline: false }),
            i18nField(item, { path: 'role', label: 'Lavozimi', multiline: false }),
            el('div', { class: 'a-row' }, [
              el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Telefon' }), el('input', { type: 'text', value: item.phone || '', onInput: (e) => { item.phone = e.target.value; } })]),
              el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Elektron pochta' }), el('input', { type: 'email', value: item.email || '', onInput: (e) => { item.email = e.target.value; } })]),
            ]),
            i18nField(item, { path: 'receptionHours', label: 'Qabul vaqtlari', multiline: false }),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↓', onClick: () => { if (index < items.length - 1) { [items[index + 1], items[index]] = [items[index], items[index + 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };

  draw();
  return el('div', { class: 'a-field' }, [
    list,
    el('button', {
      type: 'button',
      class: 'a-btn a-btn--sm',
      text: '+ Rahbar qo\'shish',
      onClick: () => { items.push({ name: emptyI18n(), role: emptyI18n(), phone: '', email: '', receptionHours: emptyI18n() }); draw(); },
    }),
  ]);
}

/** Tuzilma ro'yxati. */
function structureField(site) {
  let items = getPath(site, 'structure.items');
  if (!Array.isArray(items)) {
    items = [];
    setPath(site, 'structure.items', items);
  }
  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Kiritilmagan.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            i18nField(item, { path: 'name', label: 'Bo\'lim nomi', multiline: false }),
            i18nField(item, { path: 'description', label: 'Vazifasi (ixtiyoriy)', multiline: true, rows: 2 }),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↓', onClick: () => { if (index < items.length - 1) { [items[index + 1], items[index]] = [items[index], items[index + 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };

  draw();
  return el('div', { class: 'a-field' }, [
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Bo\'lim qo\'shish', onClick: () => { items.push({ name: emptyI18n(), description: emptyI18n() }); draw(); } }),
  ]);
}

/** Me'yoriy hujjatlar ro'yxati (havola yoki yuklangan fayl). */
function siteDocumentsField(site) {
  let items = getPath(site, 'documents.items');
  if (!Array.isArray(items)) {
    items = [];
    setPath(site, 'documents.items', items);
  }
  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Hujjat qo\'shilmagan.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            i18nField(item, { path: 'title', label: 'Hujjat nomi', multiline: false }),
            el('div', { class: 'a-row' }, [
              el('label', { class: 'a-field' }, [
                el('span', { class: 'a-field__label', text: 'Tashqi havola' }),
                el('input', { type: 'url', value: item.url || '', placeholder: 'https://lex.uz/docs/...', onInput: (e) => { item.url = e.target.value; } }),
              ]),
              el('label', { class: 'a-field' }, [
                el('span', { class: 'a-field__label', text: 'Sana' }),
                el('input', { type: 'date', value: String(item.date || '').slice(0, 10), onInput: (e) => { item.date = e.target.value; } }),
              ]),
            ]),
            item.src
              ? el('p', { class: 'a-small', html: `Yuklangan fayl: <code>${escapeHtml(item.src)}</code>` })
              : createDropZone({
                  folder: 'documents',
                  accept: '.pdf,.zip',
                  multiple: false,
                  onUploaded: (result) => { item.src = result.src; draw(); },
                }),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };

  draw();
  return el('div', { class: 'a-field' }, [
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Hujjat qo\'shish', onClick: () => { items.push({ title: emptyI18n(), url: '', date: '' }); draw(); } }),
  ]);
}

/** Bosh sahifadagi katta tasvir. */
function heroImageField(site) {
  const host = el('div', { class: 'a-field' });

  const draw = () => {
    host.innerHTML = '';
    const hero = getPath(site, 'media.heroImage');
    if (hero && hero.src) {
      host.append(
        el('div', { class: 'media-tile', style: 'max-width:340px' }, [
          el('img', { src: hero.src, alt: '' }),
          el('div', { class: 'media-tile__body' }, [
            i18nField(hero, { path: 'alt', label: 'Matnli tavsif (alt) — tasvirda nima ko\'rinadi', multiline: true, rows: 2 }),
            el('label', { class: 'a-field' }, [
              el('span', { class: 'a-field__label', text: 'Muallif / manba' }),
              el('input', { type: 'text', class: 'a-input', value: hero.credit || '', onInput: (e) => { hero.credit = e.target.value; } }),
            ]),
            el('button', {
              type: 'button',
              class: 'a-btn a-btn--sm a-btn--danger',
              text: 'Olib tashlash',
              onClick: () => { setPath(site, 'media.heroImage', null); draw(); },
            }),
          ]),
        ]),
      );
    } else {
      host.append(el('p', { class: 'a-muted a-small', text: 'Tasvir qo\'yilmagan — abstrakt bezak ishlatiladi.' }));
      host.append(
        createDropZone({
          folder: 'brand',
          accept: 'image/*',
          multiple: false,
          onUploaded: (result) => {
            setPath(site, 'media.heroImage', { src: result.src, alt: emptyI18n(), credit: '' });
            draw();
          },
        }),
      );
    }
  };

  draw();
  return host;
}

function logoUpload(site) {
  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: 'Logotipni yuklash' }),
    el('span', { class: 'a-field__hint', text: 'SVG tavsiya etiladi. Logotipning shakli, proporsiyalari va ranglari o\'zgartirilmaydi.' }),
    createDropZone({
      folder: 'brand',
      accept: '.svg,.png',
      multiple: false,
      onUploaded: (result) => {
        setPath(site, 'media.logo', result.src);
        toast(`Logotip yuklandi: ${result.src}. Saqlab, saytni qayta quring.`, 'success', 6000);
        render();
      },
    }),
  ]);
}

function stringListField(record, path, label, placeholder) {
  let items = getPath(record, path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, path, items);
  }
  const list = el('div', { class: 'list-editor' });
  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Kiritilmagan.' }));
    items.forEach((value, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            el('input', { class: 'a-input', type: 'text', value: value ?? '', placeholder, onInput: (e) => { items[index] = e.target.value; } }),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };
  draw();
  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: label }),
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Qo\'shish', onClick: () => { items.push(''); draw(); } }),
  ]);
}

function socialListField(site) {
  let items = getPath(site, 'contacts.social');
  if (!Array.isArray(items)) {
    items = [];
    setPath(site, 'contacts.social', items);
  }
  const list = el('div', { class: 'list-editor' });
  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Havola qo\'shilmagan.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body a-row' }, [
            el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Nomi' }), el('input', { type: 'text', value: item.name || '', placeholder: 'Telegram', onInput: (e) => { item.name = e.target.value; } })]),
            el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Havola' }), el('input', { type: 'url', value: item.url || '', placeholder: 'https://t.me/...', onInput: (e) => { item.url = e.target.value; } })]),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };
  draw();
  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: 'Ijtimoiy tarmoqlar' }),
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Havola qo\'shish', onClick: () => { items.push({ name: '', url: '' }); draw(); } }),
  ]);
}

function statsField(site) {
  let items = getPath(site, 'statistics.items');
  if (!Array.isArray(items)) {
    items = [];
    setPath(site, 'statistics.items', items);
  }
  const list = el('div', { class: 'list-editor' });
  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Ko\'rsatkich yo\'q — bosh sahifada statistika bloki umuman ko\'rsatilmaydi.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            el('div', { class: 'a-row' }, [
              numberField(item, { path: 'value', label: 'Qiymat', step: 'any' }),
            ]),
            i18nField(item, { path: 'label', label: 'Izoh', multiline: false }),
            i18nField(item, { path: 'unit', label: 'O\'lchov birligi', multiline: false }),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };
  draw();
  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: 'Ko\'rsatkichlar' }),
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Ko\'rsatkich', onClick: () => { items.push({ value: null, label: emptyI18n(), unit: emptyI18n() }); draw(); } }),
  ]);
}

/* ─────────────────────────── Sahifa matnlari ─────────────────────────── */

/** Sahifa matnlari — har bir bo'lim uchun tushunarli maydonlar. */
const PAGE_TABS = [
  {
    id: 'home',
    label: 'Bosh sahifa',
    build: (pages) => {
      const home = (pages.home ??= {});
      home.hero ??= {};
      home.workflowIntro ??= {};
      home.investorTeaser ??= {};
      return [
        group('Birinchi ekran', [
          i18nField(home, { path: 'hero.title', label: 'Katta sarlavha', multiline: true, rows: 2 }),
          i18nField(home, { path: 'hero.lead', label: 'Qisqa izoh', multiline: true, rows: 4 }),
        ]),
        group('Ish bosqichlari bloki', [
          i18nField(home, { path: 'workflowIntro.title', label: 'Sarlavha', multiline: false }),
          i18nField(home, { path: 'workflowIntro.lead', label: 'Izoh', multiline: true, rows: 3 }),
        ]),
        group('Tanlangan hududlar', [
          i18nField(home, { path: 'featuredTitle', label: 'Bo\'lim sarlavhasi', multiline: false }),
        ]),
        group('Investorlar uchun qisqa blok', [
          i18nField(home, { path: 'investorTeaser.title', label: 'Sarlavha', multiline: false }),
          i18nField(home, { path: 'investorTeaser.lead', label: 'Izoh', multiline: true, rows: 3 }),
        ]),
      ];
    },
  },
  {
    id: 'about',
    label: 'Direksiya haqida',
    build: (pages) => {
      const about = (pages.about ??= {});
      return [
        group('Sarlavha', [
          i18nField(about, { path: 'title', label: 'Sahifa sarlavhasi', multiline: false }),
          i18nField(about, { path: 'lead', label: 'Kirish matni', multiline: true, rows: 3 }),
        ]),
        group('Maqsad', [
          i18nField(about, { path: 'purposeTitle', label: 'Bo\'lim sarlavhasi', multiline: false }),
          i18nField(about, { path: 'purpose', label: 'Matn', multiline: true, rows: 6 }),
        ]),
        group('Faoliyat yo\'nalishlari', [
          i18nField(about, { path: 'activitiesTitle', label: 'Bo\'lim sarlavhasi', multiline: false }),
          titleTextListField(about, { path: 'activities', label: 'Yo\'nalishlar', itemLabel: 'yo\'nalish' }),
        ]),
        group('Yondashuv', [
          i18nField(about, { path: 'approachTitle', label: 'Bo\'lim sarlavhasi', multiline: false }),
          titleTextListField(about, { path: 'approach', label: 'Tamoyillar', itemLabel: 'tamoyil' }),
        ]),
      ];
    },
  },
  {
    id: 'investors',
    label: 'Investorlarga',
    build: (pages) => {
      const inv = (pages.investors ??= {});
      return [
        group('Sarlavha', [
          i18nField(inv, { path: 'title', label: 'Sahifa sarlavhasi', multiline: false }),
          i18nField(inv, { path: 'lead', label: 'Kirish matni', multiline: true, rows: 3 }),
        ]),
        group('Qadamlar', [
          el('p', { class: 'group__note', text: '«Bo\'limga havola» maydoni ixtiyoriy: areas, masterplans yoki contact yozsangiz, qadam ostida shu bo\'limga o\'tish havolasi chiqadi.' }),
          stepListField(inv, { path: 'steps', label: 'Yo\'riqnoma qadamlari' }),
        ]),
        group('Ogohlantirish', [
          el('div', { class: 'a-alert a-alert--warning' }, [
            el('p', { text: 'Bu matn saytda alohida ajratib ko\'rsatiladi. Soliq imtiyozlari, ijara muddatlari yoki kafolatlangan daromad haqida tasdiqlanmagan va\'da yozish man etiladi.' }),
          ]),
          i18nField(inv, { path: 'disclaimerTitle', label: 'Sarlavha', multiline: false }),
          i18nField(inv, { path: 'disclaimer', label: 'Matn', multiline: true, rows: 6 }),
        ]),
        group('Ko\'p so\'raladigan savollar', [
          i18nField(inv, { path: 'faqTitle', label: 'Bo\'lim sarlavhasi', multiline: false }),
          faqListField(inv, { path: 'faq', label: 'Savol-javoblar' }),
        ]),
      ];
    },
  },
  {
    id: 'sections',
    label: 'Boshqa bo\'limlar',
    build: (pages) => {
      pages.areas ??= {};
      pages.masterplans ??= {};
      pages.news ??= {};
      pages.contact ??= {};
      return [
        group('Hududlar va lotlar', [
          i18nField(pages.areas, { path: 'title', label: 'Sarlavha', multiline: false }),
          i18nField(pages.areas, { path: 'lead', label: 'Izoh', multiline: true, rows: 3 }),
        ]),
        group('Master-rejalar', [
          i18nField(pages.masterplans, { path: 'title', label: 'Sarlavha', multiline: false }),
          i18nField(pages.masterplans, { path: 'lead', label: 'Izoh', multiline: true, rows: 3 }),
        ]),
        group('Yangiliklar', [
          i18nField(pages.news, { path: 'title', label: 'Sarlavha', multiline: false }),
          i18nField(pages.news, { path: 'lead', label: 'Izoh', multiline: true, rows: 3 }),
        ]),
        group('Bog\'lanish', [
          i18nField(pages.contact, { path: 'title', label: 'Sarlavha', multiline: false }),
          i18nField(pages.contact, { path: 'lead', label: 'Izoh', multiline: true, rows: 3 }),
          i18nField(pages.contact, { path: 'privacyNotice', label: 'Maxfiylik eslatmasi (shakl ostida chiqadi)', multiline: true, rows: 4 }),
        ]),
      ];
    },
  },
  {
    id: 'accessibility',
    label: 'Qulaylik',
    build: (pages) => {
      const acc = (pages.accessibility ??= {});
      return [
        group('Qulaylik sahifasi', [
          i18nField(acc, { path: 'title', label: 'Sarlavha', multiline: false }),
          i18nField(acc, { path: 'lead', label: 'Kirish matni', multiline: true, rows: 3 }),
          i18nListField(acc, { path: 'items', label: 'Qo\'llanilgan yechimlar ro\'yxati' }),
        ]),
      ];
    },
  },
];

async function renderPagesView() {
  const pages = await loadContent('pages');
  let activeTab = state.pagesTab || 'home';

  const tabBar = el('div', { class: 'tab-bar' });
  const body = el('div', {});

  const draw = () => {
    tabBar.innerHTML = '';
    for (const tab of PAGE_TABS) {
      tabBar.append(
        el('button', {
          type: 'button',
          class: `tab-bar__btn${tab.id === activeTab ? ' is-active' : ''}`,
          text: tab.label,
          onClick: () => {
            activeTab = tab.id;
            state.pagesTab = tab.id;
            draw();
          },
        }),
      );
    }
    const tab = PAGE_TABS.find((t) => t.id === activeTab) || PAGE_TABS[0];
    body.innerHTML = '';
    body.append(...tab.build(pages));
  };

  draw();

  const form = el('form', { class: 'editor', onSubmit: (e) => e.preventDefault() }, [
    body,
    el('div', { class: 'sticky-actions' }, [
      el('button', { type: 'button', class: 'a-btn a-btn--primary', text: 'Saqlash', onClick: () => saveContent('pages') }),
      el('span', { class: 'sticky-actions__spacer' }),
      el('span', { class: 'a-small a-muted', text: 'pages.json — barcha bo\'limlar birga saqlanadi' }),
    ]),
  ]);
  form.addEventListener('input', () => { state.dirty = true; });
  form.addEventListener('change', () => { state.dirty = true; });

  setMain(
    el('div', { class: 'page-bar' }, [el('h1', { text: 'Sahifa matnlari' })]),
    el('div', { class: 'a-alert a-alert--info' }, [
      el('p', { text: 'Har bir matn to\'rt tilda kiritiladi. Til tugmalari (ЎЗ / UZ / РУ / EN) yonidagi yashil nuqta — shu tilda matn borligini bildiradi.' }),
      el('p', { class: 'a-small', text: 'Har saqlashdan oldin serverda avtomatik zaxira nusxa olinadi. Kerak bo\'lsa «Sayt holati va zaxira» bo\'limidan tiklash mumkin.' }),
    ]),
    tabBar,
    form,
  );
}

/** [{ title, text }] ko'rinishidagi ro'yxat (faoliyat yo'nalishlari, tamoyillar). */
function titleTextListField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }
  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Ro\'yxat bo\'sh.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            el('p', { class: 'a-small a-muted', text: `${index + 1}-${field.itemLabel || 'yozuv'}` }),
            i18nField(item, { path: 'title', label: 'Sarlavha', multiline: false }),
            i18nField(item, { path: 'text', label: 'Matn', multiline: true, rows: 3 }),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', title: 'Yuqoriga', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↓', title: 'Pastga', onClick: () => { if (index < items.length - 1) { [items[index + 1], items[index]] = [items[index], items[index + 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };

  draw();
  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: field.label }),
    list,
    el('button', {
      type: 'button',
      class: 'a-btn a-btn--sm',
      text: `+ ${field.itemLabel || 'Yozuv'} qo'shish`,
      onClick: () => { items.push({ title: emptyI18n(), text: emptyI18n() }); draw(); },
    }),
  ]);
}

/** Investor yo'riqnomasi qadamlari — title, text va ixtiyoriy havola. */
function stepListField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }
  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Qadam qo\'shilmagan.' }));
    items.forEach((item, index) => {
      const linkSelect = el('select', { class: 'a-input', onChange: (e) => { item.linkTo = e.target.value || undefined; } });
      for (const option of [
        { value: '', label: '— havola yo\'q —' },
        { value: 'areas', label: 'Hududlar va lotlar' },
        { value: 'masterplans', label: 'Master-rejalar' },
        { value: 'investors', label: 'Investorlarga' },
        { value: 'news', label: 'Yangiliklar' },
        { value: 'contact', label: 'Bog\'lanish' },
        { value: 'about', label: 'Direksiya haqida' },
      ]) {
        linkSelect.append(el('option', { value: option.value, text: option.label, selected: (item.linkTo || '') === option.value }));
      }

      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            el('p', { class: 'a-small a-muted', text: `${index + 1}-qadam` }),
            i18nField(item, { path: 'title', label: 'Qadam sarlavhasi', multiline: false }),
            i18nField(item, { path: 'text', label: 'Tushuntirish', multiline: true, rows: 4 }),
            el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Bo\'limga havola' }), linkSelect]),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↓', onClick: () => { if (index < items.length - 1) { [items[index + 1], items[index]] = [items[index], items[index + 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };

  draw();
  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: field.label }),
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Qadam qo\'shish', onClick: () => { items.push({ title: emptyI18n(), text: emptyI18n() }); draw(); } }),
  ]);
}

/** Savol-javoblar ro'yxati. */
function faqListField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }
  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Savol qo\'shilmagan.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            el('p', { class: 'a-small a-muted', text: `${index + 1}-savol` }),
            i18nField(item, { path: 'q', label: 'Savol', multiline: true, rows: 2 }),
            i18nField(item, { path: 'a', label: 'Javob', multiline: true, rows: 5 }),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↓', onClick: () => { if (index < items.length - 1) { [items[index + 1], items[index]] = [items[index], items[index + 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };

  draw();
  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: field.label }),
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Savol qo\'shish', onClick: () => { items.push({ q: emptyI18n(), a: emptyI18n() }); draw(); } }),
  ]);
}

/* ─────────────────────────── Murojaatlar ─────────────────────────── */

const STATUS_LABELS = {
  new: 'Yangi',
  'in-progress': 'Ko\'rib chiqilmoqda',
  answered: 'Javob berilgan',
  archived: 'Arxivlangan',
};

/** Murojaat yozuvi ostidagi Telegram yetkazilish holati. */
function telegramStatusLine(item) {
  const tg = item.telegram;
  if (!tg) {
    return el('p', { class: 'a-small a-muted', text: '📨 Telegram: yuborilmagan (bot sozlanmagan bo\'lishi mumkin)' });
  }
  if (tg.delivered) {
    return el('p', { class: 'a-small', style: 'color:var(--a-success)' }, [
      `📨 Telegramga yuborildi${tg.attempts > 1 ? ` (${tg.attempts}-urinishda)` : ''} · ${formatDateTime(tg.at)}`,
    ]);
  }
  if (tg.skipped) {
    return el('p', { class: 'a-small a-muted', text: `📨 Telegram: o'tkazib yuborildi — ${tg.error}` });
  }
  // Xatolik sababi va yechimi server tomonidan tushunarli tilga o'girilgan
  return el('div', { class: 'a-small', style: 'color:var(--a-danger)' }, [
    el('p', { text: `📨 Telegramga yuborilmadi — ${tg.explained?.reason || tg.error || 'nomalum xatolik'}` }),
    tg.explained?.fix ? el('p', { text: tg.explained.fix }) : null,
    tg.rounds ? el('p', { text: `Qayta urinishlar: ${tg.rounds} ta${tg.permanent ? ' · sozlama tuzatilmaguncha to\'xtatildi' : ''}` }) : null,
  ]);
}

async function renderInboxView() {
  const data = await api.inbox();
  const items = data.items || [];

  const host = el('div', {});
  if (items.length === 0) {
    host.append(
      el('div', { class: 'empty-box' }, [
        el('p', { text: 'Murojaatlar yo\'q.' }),
        el('p', { class: 'a-small', text: 'Murojaat shakli ishlashi uchun "Sayt sozlamalari" bo\'limida "Murojaatlarni qabul qilish manzili" maydoniga /api/contact yozilgan va sayt qayta qurilgan bo\'lishi kerak.' }),
      ]),
    );
  }

  for (const item of items) {
    const statusSelect = el('select', { class: 'a-input', style: 'max-width:200px' });
    for (const [value, label] of Object.entries(STATUS_LABELS)) {
      statusSelect.append(el('option', { value, text: label, selected: item.status === value }));
    }
    const noteInput = el('textarea', { class: 'a-input', rows: 2, value: item.note || '', placeholder: 'Ichki izoh (saytda ko\'rinmaydi)' });

    host.append(
      el('article', { class: 'inbox-item' }, [
        el('div', { class: 'inbox-item__head' }, [
          el('strong', { text: item.name || '—' }),
          el('span', { class: `a-tag ${item.status === 'new' ? 'a-tag--warning' : item.status === 'answered' ? 'a-tag--success' : ''}`, text: STATUS_LABELS[item.status] || item.status }),
          el('span', { class: 'inbox-item__id', text: item.id }),
          el('span', { class: 'a-small a-muted', text: formatDateTime(item.receivedAt) }),
        ]),
        el('div', { class: 'inbox-item__grid' }, [
          item.organization ? el('span', { text: `Tashkilot: ${item.organization}` }) : null,
          item.phone ? el('span', { html: `Telefon: <a href="tel:${item.phone.replace(/[^\d+]/g, '')}">${item.phone}</a>` }) : null,
          item.email ? el('span', { html: `Pochta: <a href="mailto:${item.email}">${item.email}</a>` }) : null,
          item.area ? el('span', { text: `Hudud: ${item.area}` }) : null,
          el('span', { text: `Til: ${item.locale || '—'}` }),
        ]),
        el('p', { class: 'inbox-item__msg', text: item.message || '' }),
        telegramStatusLine(item),
        el('div', { class: 'inbox-item__tools' }, [
          statusSelect,
          el('button', {
            type: 'button',
            class: 'a-btn a-btn--sm',
            text: 'Holatni saqlash',
            onClick: async () => {
              try {
                await api.updateInbox(item.id, { status: statusSelect.value, note: noteInput.value });
                toast('Saqlandi', 'success');
                refreshCounts();
              } catch (error) {
                toast(`Saqlanmadi: ${error.message}`, 'error');
              }
            },
          }),
          item.telegram?.delivered
            ? null
            : el('button', {
                type: 'button',
                class: 'a-btn a-btn--sm',
                text: 'Telegramga yuborish',
                onClick: async (event) => {
                  const button = event.currentTarget;
                  button.disabled = true;
                  button.textContent = 'Yuborilmoqda…';
                  try {
                    await api.resendInbox(item.id);
                    toast('Telegramga yuborildi', 'success');
                    render();
                    refreshCounts();
                  } catch (error) {
                    toast(`Yuborilmadi: ${error.data?.telegram?.error || error.message}`, 'error', 8000);
                    button.disabled = false;
                    button.textContent = 'Telegramga yuborish';
                  }
                },
              }),
          state.user?.role === 'admin'
            ? el('button', {
                type: 'button',
                class: 'a-btn a-btn--sm a-btn--danger',
                text: 'O\'chirish',
                onClick: async () => {
                  if (!confirmAction(`${item.id} murojaati butunlay o'chirilsinmi?`)) return;
                  await api.deleteInbox(item.id).catch((error) => toast(error.message, 'error'));
                  render();
                  refreshCounts();
                },
              })
            : null,
        ]),
        noteInput,
      ]),
    );
  }

  setMain(
    el('div', { class: 'page-bar' }, [
      el('h1', { text: 'Murojaatlar' }),
      el('div', { class: 'page-bar__actions' }, [
        el('span', {
          class: 'a-tag',
          text: data.total > items.length
            ? `Eng yangi ${items.length} ta (jami ${data.total})`
            : `Jami: ${items.length}`,
        }),
        el('button', { type: 'button', class: 'a-btn a-btn--sm', text: 'Yangilash', onClick: render }),
      ]),
    ]),
    el('div', { class: 'a-alert a-alert--warning' }, [
      el('p', { text: 'Bu bo\'limda shaxsiy ma\'lumotlar saqlanadi. Ularni faqat murojaatni ko\'rib chiqish uchun ishlatish va uchinchi shaxslarga bermaslik talab etiladi.' }),
    ]),
    host,
  );
}

/* ─────────────────────────── Fayllar ─────────────────────────── */

async function renderFilesView() {
  const data = await api.uploads();
  const items = data.items || [];

  const table = el('table', { class: 'a-table' }, [
    el('thead', {}, [el('tr', {}, [el('th', { text: 'Fayl' }), el('th', { text: 'Hajmi' }), el('th', { text: 'Sana' }), el('th', { text: '' })])]),
    el(
      'tbody',
      {},
      items.length === 0
        ? [el('tr', {}, [el('td', { colspan: '4', class: 'a-muted', text: 'Fayl yuklanmagan.' })])]
        : items.map((item) =>
            el('tr', {}, [
              el('td', {}, [el('a', { href: item.src, target: '_blank', rel: 'noopener', text: item.src })]),
              el('td', { text: formatBytes(item.sizeBytes) }),
              el('td', { text: formatDateTime(item.modifiedAt) }),
              el('td', {}, [
                el('button', {
                  type: 'button',
                  class: 'a-btn a-btn--sm',
                  text: 'Manzilni nusxalash',
                  onClick: () => {
                    navigator.clipboard?.writeText(item.src);
                    toast('Nusxalandi', 'success');
                  },
                }),
              ]),
            ]),
          ),
    ),
  ]);

  setMain(
    el('div', { class: 'page-bar' }, [el('h1', { text: 'Fayllar' }), el('span', { class: 'a-tag', text: `${items.length} ta` })]),
    el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Yangi fayl yuklash' }),
      el('p', { class: 'group__note', text: 'Ruxsat etilgan turlar: JPG, PNG, WEBP, AVIF, SVG, PDF, ZIP. Eng katta hajm: 25 MB.' }),
      createDropZone({ folder: 'general', onUploaded: () => render() }),
    ]),
    el('div', { class: 'a-table-wrap' }, [table]),
  );
}

/* ─────────────────────────── Sayt holati va zaxira ─────────────────────────── */

async function renderBuildView() {
  const info = await api.buildInfo().catch(() => ({ info: null }));
  const logBox = el('pre', { class: 'a-log', text: 'Qurish jurnali shu yerda ko\'rinadi.' });

  const run = async (demo) => {
    if (demo && !confirmAction('DEMO rejimida qurishda saytga namunaviy ma\'lumotlar qo\'shiladi. Ishlab turgan saytda bu rejimni ishlatmang. Davom etasizmi?')) return;
    logBox.textContent = 'Qurilmoqda…';
    try {
      const result = await api.build(demo);
      logBox.textContent = result.output || 'Tugadi.';
      toast(demo ? 'Sayt DEMO rejimida qurildi' : 'Sayt qurildi', 'success');
    } catch (error) {
      logBox.textContent = error.data?.output || error.message;
      toast('Qurishda xatolik', 'error');
    }
  };

  const details = info.info
    ? el('div', { class: 'a-table-wrap' }, [
        el('table', { class: 'a-table' }, [
          el('tbody', {}, [
            row('Oxirgi qurilish', `${info.info.isoDate} (${info.info.isoDateTime})`),
            row('Rejim', info.info.demo ? 'DEMO — namunaviy ma\'lumotlar qo\'shilgan' : 'Faqat tasdiqlangan kontent'),
            row('Sahifalar', String(info.info.pages)),
            row('Lotlar', String(info.info.lots)),
            row('Master-rejalar', String(info.info.masterplans)),
            row('Yangiliklar', String(info.info.news)),
          ]),
        ]),
      ])
    : el('p', { class: 'a-muted', text: 'Sayt hali qurilmagan.' });

  const warnings = (info.info?.warnings || []).length
    ? el('div', { class: 'a-alert a-alert--warning' }, [
        el('strong', { text: `Oxirgi qurishdagi ogohlantirishlar (${info.info.warnings.length})` }),
        el('ul', {}, info.info.warnings.map((message) => el('li', { text: message }))),
      ])
    : null;

  setMain(
    el('div', { class: 'page-bar' }, [el('h1', { text: 'Sayt holati va zaxira' })]),
    el('div', { class: 'a-alert a-alert--success' }, [
      el('strong', { text: 'Qurish avtomatik bajariladi' }),
      el('p', { text: 'Har bir saqlashdan keyin sayt o\'zi qayta quriladi — bu bo\'limga kirish shart emas. Quyidagi tugmalar faqat zarur hollarda (masalan, fayl qo\'lda o\'zgartirilganda yoki xatolikdan keyin) kerak bo\'ladi.' }),
    ]),
    info.info?.demo
      ? el('div', { class: 'a-alert a-alert--warning' }, [
          el('strong', { text: 'Sayt hozir DEMO rejimida' }),
          el('p', { text: 'Ommaviy foydalanishga topshirishdan oldin oddiy rejimda qayta quring.' }),
        ])
      : null,
    warnings,
    el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Oxirgi qurilish' }),
      details,
    ]),
    el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Qo\'lda qurish' }),
      el('div', { style: 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem' }, [
        el('button', { type: 'button', class: 'a-btn a-btn--primary', text: 'Saytni qurish', onClick: () => run(false) }),
        el('button', { type: 'button', class: 'a-btn', text: 'DEMO rejimida qurish', onClick: () => run(true) }),
      ]),
      logBox,
    ]),
    await backupsGroup(),
  );
}

/** Kontentning avtomatik zaxira nusxalari — tiklash imkoniyati bilan. */
async function backupsGroup() {
  const CONTENT_LABELS = {
    lots: 'Hududlar va lotlar',
    masterplans: 'Master-rejalar',
    news: 'Yangiliklar',
    site: 'Sayt sozlamalari',
    pages: 'Sahifa matnlari',
    taxonomies: 'Ma\'lumotnomalar',
  };

  let items = [];
  try {
    const data = await api.backups();
    items = data.items || [];
  } catch (error) {
    return el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Zaxira nusxalar' }),
      el('p', { class: 'a-muted', text: `Ro'yxatni olish imkoni bo'lmadi: ${error.message}` }),
    ]);
  }

  const table = el('table', { class: 'a-table' }, [
    el('thead', {}, [
      el('tr', {}, [el('th', { text: 'Nima' }), el('th', { text: 'Sana' }), el('th', { text: 'Hajmi' }), el('th', { text: '' })]),
    ]),
    el(
      'tbody',
      {},
      items.length === 0
        ? [el('tr', {}, [el('td', { colspan: '4', class: 'a-muted', text: 'Hozircha zaxira nusxa yo\'q. Kontentni birinchi marta saqlaganingizda paydo bo\'ladi.' })])]
        : items.slice(0, 30).map((item) =>
            el('tr', {}, [
              el('th', { scope: 'row', text: CONTENT_LABELS[item.content] || item.content || '—' }),
              el('td', { text: formatDateTime(item.savedAt) }),
              el('td', { text: formatBytes(item.sizeBytes) }),
              el('td', {}, [
                el('button', {
                  type: 'button',
                  class: 'a-btn a-btn--sm',
                  text: 'Tiklash',
                  onClick: async () => {
                    if (!confirmAction(
                      `«${CONTENT_LABELS[item.content] || item.content}» bo'limi ${formatDateTime(item.savedAt)} holatiga qaytarilsinmi?\n\n` +
                      'Joriy holat ham avtomatik zaxiraga olinadi, shuning uchun bu amalni ortga qaytarish mumkin.\n\n' +
                      'Tiklangandan keyin saytni qayta qurish kerak.',
                    )) return;
                    try {
                      await api.restoreBackup(item.file);
                      state.cache = {};
                      state.taxonomies = null;
                      toast('Tiklandi. Endi saytni qayta quring.', 'success', 7000);
                      render();
                    } catch (error) {
                      toast(`Tiklanmadi: ${error.data?.error || error.message}`, 'error', 7000);
                    }
                  },
                }),
              ]),
            ]),
          ),
    ),
  ]);

  return el('div', { class: 'group' }, [
    el('h2', { class: 'group__title', text: 'Zaxira nusxalar' }),
    el('p', { class: 'group__note', text: 'Kontentni har saqlaganingizda avvalgi holat avtomatik zaxiraga olinadi (har bo\'lim uchun oxirgi 20 versiya). Xato o\'zgartirish kiritilsa, shu yerdan qaytarish mumkin.' }),
    el('div', { class: 'a-table-wrap' }, [table]),
  ]);
}

function row(label, value) {
  return el('tr', {}, [el('th', { text: label, scope: 'row' }), el('td', { text: value })]);
}

/* ─────────────────────────── Ma'lumotnomalar ─────────────────────────── */

const TAXONOMY_GROUPS = [
  { path: 'districts', label: 'Tumanlar', note: 'Lot va master-rejalarda tanlanadi.', extra: ['type'] },
  { path: 'areaTypes', label: 'Hudud turlari', note: 'Tog\'li hudud, daryo bo\'yi, suv ombori atrofi.' },
  { path: 'tourismDirections', label: 'Turizm yo\'nalishlari', note: 'Lotlarda bir nechtasini belgilash mumkin.' },
  { path: 'lotStatuses', label: 'Lot holatlari', note: 'Saytdagi holat nishonlari. Bu ro\'yxatni o\'zgartirish saytning ishlash mantig\'iga ta\'sir qiladi — ehtiyot bo\'ling.', locked: true },
  { path: 'masterplanStatuses', label: 'Master-reja holatlari', note: 'Konsepsiya / ishlab chiqilayotgan / tasdiqlangan. Ogohlantirish matnlari ham shu yerda.', locked: true, disclaimer: true },
  { path: 'rightTypes.items', label: 'Huquq turlari', note: 'Aukcion bo\'limida tanlanadi. Har bir lotda aniq ibora alohida yoziladi.' },
  { path: 'workflowStages', label: 'Ish bosqichlari', note: 'Bosh sahifadagi 5 bosqich. Tartib raqami va tavsifi bilan.', locked: true, description: true },
];

async function renderTaxonomiesView() {
  const tax = await loadContent('taxonomies');
  state.taxonomies = tax;

  const groups = TAXONOMY_GROUPS.map((cfg) => {
    let items = getPath(tax, cfg.path);
    if (!Array.isArray(items)) {
      items = [];
      setPath(tax, cfg.path, items);
    }

    const list = el('div', { class: 'list-editor' });

    const draw = () => {
      list.innerHTML = '';
      if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Ro\'yxat bo\'sh.' }));
      items.forEach((item, index) => {
        const isNew = Boolean(item.__new);
        list.append(
          el('div', { class: 'list-item' }, [
            el('div', { class: 'list-item__body' }, [
              el('div', { class: 'a-row' }, [
                el('label', { class: 'a-field' }, [
                  el('span', { class: 'a-field__label', text: 'Identifikator (id)' }),
                  el('input', {
                    type: 'text',
                    value: item.id || '',
                    readonly: !isNew,
                    onInput: (e) => { if (isNew) item.id = slugify(e.target.value); },
                    onBlur: (e) => { if (isNew) e.target.value = item.id || ''; },
                  }),
                  el('span', {
                    class: 'a-field__hint',
                    text: isNew ? 'Faqat lotin harflari va chiziqcha.' : 'O\'zgartirilmaydi — lotlarda ishlatilmoqda.',
                  }),
                ]),
                item.step != null || item.number != null
                  ? numberField(item, { path: item.number != null ? 'number' : 'step', label: 'Tartib raqami', step: '1' })
                  : null,
              ]),
              i18nField(item, { path: 'name', label: 'Nomi', multiline: false }),
              cfg.description ? i18nField(item, { path: 'description', label: 'Tavsifi', multiline: true, rows: 4 }) : null,
              cfg.disclaimer ? i18nField(item, { path: 'disclaimer', label: 'Saytda chiqadigan ogohlantirish', multiline: true, rows: 3 }) : null,
            ]),
            el('div', { class: 'list-item__tools' }, [
              el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
              el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↓', onClick: () => { if (index < items.length - 1) { [items[index + 1], items[index]] = [items[index], items[index + 1]]; draw(); } } }),
              cfg.locked && !isNew
                ? el('span', { class: 'a-tag', text: 'tizimli', title: 'Bu yozuv saytning ishlash mantig\'ida ishlatiladi — o\'chirish tavsiya etilmaydi.' })
                : el('button', {
                    type: 'button',
                    class: 'a-btn a-btn--sm a-btn--danger',
                    text: '✕',
                    onClick: () => {
                      if (!confirmAction(`"${pick(item.name) || item.id}" o'chirilsinmi?\n\nDIQQAT: bu qiymat allaqachon biror lotda ishlatilgan bo'lsa, saytda "Ko'rsatilmagan" deb chiqadi.`)) return;
                      items.splice(index, 1);
                      draw();
                    },
                  }),
            ]),
          ]),
        );
      });
    };

    draw();

    return el('section', { class: 'group' }, [
      el('h2', { class: 'group__title', text: cfg.label }),
      cfg.note ? el('p', { class: 'group__note', text: cfg.note }) : null,
      list,
      el('button', {
        type: 'button',
        class: 'a-btn a-btn--sm',
        text: '+ Qo\'shish',
        onClick: () => {
          items.push({ id: '', name: emptyI18n(), __new: true });
          draw();
        },
      }),
    ]);
  });

  const form = el('form', { class: 'editor', onSubmit: (e) => e.preventDefault() }, [
    ...groups,
    el('div', { class: 'sticky-actions' }, [
      el('button', {
        type: 'button',
        class: 'a-btn a-btn--primary',
        text: 'Saqlash',
        onClick: async () => {
          // Avval tekshiramiz — muvaffaqiyatsiz bo'lsa yozuvlarga tegmaymiz,
          // aks holda yangi qator "__new" belgisini yo'qotib, id maydoni
          // qulflanib qoladi va foydalanuvchi xatoni tuzata olmaydi.
          const problems = [];
          for (const cfg of TAXONOMY_GROUPS) {
            const items = getPath(tax, cfg.path) || [];
            const seen = new Set();
            for (const item of items) {
              if (!item.id) problems.push(`${cfg.label}: identifikator to'ldirilmagan`);
              else if (seen.has(item.id)) problems.push(`${cfg.label}: "${item.id}" takrorlanmoqda`);
              else seen.add(item.id);
            }
          }
          if (problems.length > 0) {
            toast(problems.join('; '), 'error', 9000);
            return;
          }

          // Tekshiruv o'tdi — endi texnik belgilarni tozalaymiz
          for (const cfg of TAXONOMY_GROUPS) {
            for (const item of getPath(tax, cfg.path) || []) delete item.__new;
          }
          await saveContent('taxonomies');
          state.taxonomies = null;
          render();
        },
      }),
      el('span', { class: 'sticky-actions__spacer' }),
      el('span', { class: 'a-small a-muted', text: 'taxonomies.json' }),
    ]),
  ]);
  form.addEventListener('input', () => { state.dirty = true; });
  form.addEventListener('change', () => { state.dirty = true; });

  setMain(
    el('div', { class: 'page-bar' }, [el('h1', { text: 'Ma\'lumotnomalar' })]),
    el('div', { class: 'a-alert a-alert--warning' }, [
      el('strong', { text: 'Ehtiyotkorlik bilan tahrirlang' }),
      el('p', { text: 'Bu ro\'yxatlar lotlar, master-rejalar va saytdagi filtrlarda ishlatiladi. Identifikator (id) mavjud yozuvlarda o\'zgartirilmaydi, chunki lotlar unga bog\'langan. Nomlarni to\'rt tilda erkin tahrirlash mumkin.' }),
      el('p', { class: 'a-small', text: '«tizimli» deb belgilangan yozuvlar saytning ishlash mantig\'ida ishlatiladi — ularni o\'chirmaslik tavsiya etiladi.' }),
    ]),
    form,
  );
}

/* ─────────────────────────── Foydalanuvchilar ─────────────────────────── */

const ROLE_LABELS = {
  admin: 'Administrator — hammasi, foydalanuvchilar va o\'chirish ham',
  editor: 'Muharrir — kontent va saytni qurish',
  viewer: 'Kuzatuvchi — faqat ko\'rish',
};

async function renderUsersView() {
  if (state.user?.role !== 'admin') {
    setMain(
      el('div', { class: 'page-bar' }, [el('h1', { text: 'Foydalanuvchilar' })]),
      el('div', { class: 'a-alert a-alert--warning' }, [
        el('strong', { text: 'Ruxsat yo\'q' }),
        el('p', { text: 'Foydalanuvchilarni faqat administrator roliga ega xodim boshqaradi. O\'z parolingizni «Mening parolim» bo\'limida o\'zgartirishingiz mumkin.' }),
      ]),
    );
    return;
  }

  const data = await api.users();
  const users = data.users || [];

  const rows = users.map((user) => {
    const roleSelect = el('select', { class: 'a-input', style: 'max-width:260px' });
    for (const [value, label] of Object.entries(ROLE_LABELS)) {
      roleSelect.append(el('option', { value, text: label.split(' — ')[0], selected: user.role === value }));
    }

    return el('tr', {}, [
      el('th', { scope: 'row' }, [
        user.username,
        user.username === data.me ? el('span', { class: 'a-tag', text: 'siz', style: 'margin-left:.4rem' }) : null,
      ]),
      el('td', { text: user.name || '—' }),
      el('td', {}, [roleSelect]),
      el('td', { text: formatDateTime(user.updatedAt) }),
      el('td', {}, [
        el('div', { style: 'display:flex;gap:.3rem;flex-wrap:wrap' }, [
          el('button', {
            type: 'button',
            class: 'a-btn a-btn--sm',
            text: 'Rolni saqlash',
            onClick: async () => {
              try {
                await api.saveUser({ username: user.username, role: roleSelect.value, name: user.name });
                toast('Rol yangilandi', 'success');
                render();
              } catch (error) {
                toast(userError(error), 'error', 7000);
              }
            },
          }),
          el('button', {
            type: 'button',
            class: 'a-btn a-btn--sm',
            text: 'Parolni tiklash',
            onClick: async () => {
              // eslint-disable-next-line no-alert
              const next = window.prompt(`«${user.username}» uchun yangi parol (kamida 12 belgi):`);
              if (!next) return;
              try {
                await api.saveUser({ username: user.username, password: next, role: user.role, name: user.name });
                toast('Parol yangilandi. Foydalanuvchiga xavfsiz yo\'l bilan yetkazing.', 'success', 7000);
              } catch (error) {
                toast(userError(error), 'error', 7000);
              }
            },
          }),
          user.username === data.me
            ? null
            : el('button', {
                type: 'button',
                class: 'a-btn a-btn--sm a-btn--danger',
                text: 'O\'chirish',
                onClick: async () => {
                  if (!confirmAction(`«${user.username}» foydalanuvchisi o'chirilsinmi?`)) return;
                  try {
                    await api.deleteUser(user.username);
                    toast('O\'chirildi', 'success');
                    render();
                  } catch (error) {
                    toast(userError(error), 'error', 7000);
                  }
                },
              }),
        ]),
      ]),
    ]);
  });

  // Yangi foydalanuvchi shakli
  const newName = el('input', { type: 'text', class: 'a-input', placeholder: 'muharrir' });
  const newFull = el('input', { type: 'text', class: 'a-input', placeholder: 'Ism-familiya (ixtiyoriy)' });
  const newPass = el('input', { type: 'text', class: 'a-input', placeholder: 'Kamida 12 belgi' });
  const newRole = el('select', { class: 'a-input' });
  for (const [value, label] of Object.entries(ROLE_LABELS)) {
    newRole.append(el('option', { value, text: label, selected: value === 'editor' }));
  }

  setMain(
    el('div', { class: 'page-bar' }, [
      el('h1', { text: 'Foydalanuvchilar' }),
      el('span', { class: 'a-tag', text: `${users.length} ta` }),
    ]),
    el('div', { class: 'a-table-wrap' }, [
      el('table', { class: 'a-table' }, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', { text: 'Foydalanuvchi' }),
            el('th', { text: 'Ism' }),
            el('th', { text: 'Rol' }),
            el('th', { text: 'Yangilangan' }),
            el('th', { text: '' }),
          ]),
        ]),
        el('tbody', {}, rows),
      ]),
    ]),
    el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Yangi foydalanuvchi' }),
      el('div', { class: 'a-row' }, [
        el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Foydalanuvchi nomi' }), newName, el('span', { class: 'a-field__hint', text: 'Lotin harflari, raqam, nuqta, chiziqcha. 3–40 belgi.' })]),
        el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Ism-familiya' }), newFull]),
      ]),
      el('div', { class: 'a-row' }, [
        el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Parol' }), newPass, el('span', { class: 'a-field__hint', text: 'Kamida 12 belgi. Parolni xavfsiz yo\'l bilan yetkazing.' })]),
        el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Rol' }), newRole]),
      ]),
      el('button', {
        type: 'button',
        class: 'a-btn a-btn--primary',
        text: 'Yaratish',
        onClick: async () => {
          try {
            await api.saveUser({
              username: newName.value.trim(),
              name: newFull.value.trim(),
              password: newPass.value,
              role: newRole.value,
            });
            toast('Foydalanuvchi yaratildi', 'success');
            render();
          } catch (error) {
            toast(userError(error), 'error', 8000);
          }
        },
      }),
    ]),
    el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Rollar nima qila oladi' }),
      el('ul', {}, Object.values(ROLE_LABELS).map((label) => el('li', { text: label }))),
      el('p', { class: 'a-small a-muted', text: 'Parollar serverda scrypt algoritmi bilan xeshlanadi — hech qayerda ochiq saqlanmaydi va panelda ko\'rsatilmaydi.' }),
    ]),
  );
}

function userError(error) {
  const messages = {
    password_short: 'Parol kamida 12 belgidan iborat bo\'lishi kerak.',
    username_format: 'Foydalanuvchi nomi faqat lotin harflari, raqam, nuqta va chiziqchadan iborat bo\'lsin (3–40 belgi).',
    last_admin: 'Bu tizimdagi yagona administrator — rolini o\'zgartirish yoki o\'chirish mumkin emas.',
    cannot_delete_self: 'O\'zingizni o\'chira olmaysiz.',
    admin_only: 'Bu amalni faqat administrator bajaradi.',
    wrong_password: 'Joriy parol xato kiritildi.',
    not_found: 'Foydalanuvchi topilmadi.',
  };
  return messages[error.data?.error] || `Xatolik: ${error.message}`;
}

/* ─────────────────────────── Mening parolim ─────────────────────────── */

async function renderAccountView() {
  const current = el('input', { type: 'password', class: 'a-input', autocomplete: 'current-password' });
  const next = el('input', { type: 'password', class: 'a-input', autocomplete: 'new-password' });
  const repeat = el('input', { type: 'password', class: 'a-input', autocomplete: 'new-password' });

  setMain(
    el('div', { class: 'page-bar' }, [el('h1', { text: 'Mening parolim' })]),
    el('div', { class: 'group', style: 'max-width:520px' }, [
      el('p', { class: 'group__note', text: `Foydalanuvchi: ${state.user?.name || state.user?.username} (${state.user?.role})` }),
      el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Joriy parol' }), current]),
      el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Yangi parol' }), next, el('span', { class: 'a-field__hint', text: 'Kamida 12 belgi.' })]),
      el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Yangi parolni takrorlang' }), repeat]),
      el('button', {
        type: 'button',
        class: 'a-btn a-btn--primary',
        text: 'Parolni o\'zgartirish',
        onClick: async () => {
          if (next.value !== repeat.value) {
            toast('Yangi parollar bir xil emas.', 'error');
            return;
          }
          if (next.value.length < 12) {
            toast('Parol kamida 12 belgidan iborat bo\'lishi kerak.', 'error');
            return;
          }
          try {
            await api.changePassword(current.value, next.value);
            current.value = '';
            next.value = '';
            repeat.value = '';
            toast('Parol o\'zgartirildi.', 'success');
          } catch (error) {
            toast(userError(error), 'error', 7000);
          }
        },
      }),
    ]),
    el('div', { class: 'a-alert a-alert--info' }, [
      el('p', { text: 'Parolni unutgan bo\'lsangiz, administrator uni «Foydalanuvchilar» bo\'limidan tiklab beradi. Administrator paroli yo\'qolsa, serverda buyruq orqali tiklanadi: node server/tools/hash-password.mjs <nom> <parol> admin' }),
    ]),
  );
}

/* ─────────────────────────── Telegram ─────────────────────────── */

async function renderTelegramView() {
  const data = await api.telegram();
  const r = data.report || {};
  const isAdmin = state.user?.role === 'admin';

  const problems = r.problems || [];

  // Tashxis: nima ishlamayotgani va uni qanday tuzatish — aniq matn bilan
  const statusBox = (() => {
    if (r.canSend) {
      return el('div', { class: 'a-alert a-alert--success' }, [
        el('strong', { text: 'Telegram ulangan va ishlayapti' }),
        el('p', { text: `Murojaatlar @${r.bot.username} boti orqali «${r.chat.title || r.chat.id}» chatiga yuboriladi.` }),
      ]);
    }
    if (r.disabled) {
      return el('div', { class: 'a-alert a-alert--warning' }, [
        el('strong', { text: 'Telegramga yuborish vaqtincha o\'chirilgan' }),
        el('p', { text: 'Murojaatlar qabul qilinadi va «Murojaatlar» bo\'limida saqlanadi, lekin botga yuborilmaydi.' }),
      ]);
    }
    return el('div', { class: 'a-alert a-alert--error' }, [
      el('strong', { text: 'Telegramga yuborish ishlamayapti' }),
      ...problems.map((p) =>
        el('div', { style: 'margin-top:0.6rem' }, [
          el('p', {}, [el('strong', { text: p.reason })]),
          el('p', { text: p.fix }),
          p.raw ? el('p', { class: 'a-small' }, [el('code', { text: `Telegram javobi: ${p.raw}` })]) : null,
        ]),
      ),
      problems.length === 0
        ? el('p', { text: 'Bot tokeni yoki chat_id kiritilmagan. Quyidagi sozlamalarni to\'ldiring.' })
        : null,
      el('p', { class: 'a-small', text: 'Murojaatlar yo\'qolmaydi: ular avval serverga saqlanadi va «Murojaatlar» bo\'limida turadi. Sozlama tuzatilgach, tizim ularni o\'zi qayta yuboradi.' }),
    ]);
  })();

  // Haqiqiy yetkazilish tarixi — sinov xabaridan ishonchliroq ko'rsatkich
  const d = data.delivery || {};
  const deliveryBox = d.total
    ? el('div', { class: `a-alert a-alert--${d.pending || d.failed ? 'warning' : 'success'}` }, [
        el('strong', { text: 'Murojaatlarning yetkazilishi' }),
        el('p', {
          text: `Jami ${d.total} ta · yetkazilgan ${d.delivered} ta · navbatda ${d.pending} ta · yetkazilmagan ${d.failed} ta`,
        }),
        d.lastError
          ? el('div', { style: 'margin-top:0.5rem' }, [
              el('p', {}, [el('strong', { text: `Oxirgi xatolik (${d.lastError.id}): ` }), d.lastError.reason]),
              el('p', { text: d.lastError.fix }),
            ])
          : null,
        d.pending
          ? el('button', {
              type: 'button',
              class: 'a-btn a-btn--sm',
              text: `Yetkazilmaganlarni hoziroq qayta yuborish (${d.pending})`,
              onClick: async (event) => {
                const button = event.currentTarget;
                button.disabled = true;
                button.textContent = 'Yuborilmoqda…';
                try {
                  const result = await api.telegramRetry();
                  toast(`${result.checked} ta tekshirildi, ${result.sent} tasi yuborildi`, result.sent ? 'success' : 'warning', 7000);
                  render();
                } catch (error) {
                  toast(`Xatolik: ${error.message}`, 'error');
                  button.disabled = false;
                }
              },
            })
          : null,
      ])
    : null;

  const endpointWarning = data.contactEndpoint
    ? null
    : el('div', { class: 'a-alert a-alert--error' }, [
        el('strong', { text: 'Murojaat shakli saytda hali faolsiz' }),
        el('p', { text: 'Telegram sozlangan bo\'lsa ham, shakl ishlashi uchun «Sayt sozlamalari» bo\'limidagi «Murojaatlarni qabul qilish manzili» maydoniga /api/contact yozilishi va sayt qayta qurilishi kerak.' }),
        el('button', {
          type: 'button',
          class: 'a-btn a-btn--sm',
          text: 'Sayt sozlamalariga o\'tish',
          onClick: () => {
            state.view = 'site';
            for (const link of qsa('.sidebar__link')) link.classList.toggle('is-active', link.dataset.view === 'site');
            render();
          },
        }),
      ]);

  // Sozlamalar shakli
  const tokenInput = el('input', {
    type: 'password',
    class: 'a-input',
    placeholder: r.hasToken ? `Saqlangan: ${r.tokenMasked}` : '1234567890:AAEhBOweik6ad9r_QXzR1_ABC…',
    autocomplete: 'off',
  });
  const chatInput = el('input', {
    type: 'text',
    class: 'a-input',
    value: r.chatId || '',
    placeholder: '-1001234567890  yoki  @kanal_nomi',
    autocomplete: 'off',
  });
  const threadInput = el('input', {
    type: 'text',
    class: 'a-input',
    value: r.threadId || '',
    placeholder: 'ixtiyoriy — forum guruhidagi mavzu raqami',
    autocomplete: 'off',
  });

  const chatsBox = el('div', { class: 'a-small a-muted', style: 'margin-top:0.5rem' });

  const saveButton = el('button', {
    type: 'button',
    class: 'a-btn a-btn--primary',
    text: 'Saqlash va tekshirish',
    onClick: async () => {
      const payload = {};
      if (tokenInput.value.trim() !== '') payload.botToken = tokenInput.value.trim();
      payload.chatId = chatInput.value.trim();
      payload.threadId = threadInput.value.trim();
      saveButton.disabled = true;
      try {
        await api.telegramSave(payload);
        tokenInput.value = '';
        toast('Sozlamalar saqlandi', 'success');
        render();
      } catch (error) {
        const messages = {
          token_format: 'Bot tokeni noto\'g\'ri ko\'rinishda. @BotFather bergan tokenni to\'liq nusxalang.',
          chat_id_format: 'chat_id noto\'g\'ri. Masalan: 123456789, -1001234567890 yoki @kanal_nomi',
          thread_id_format: 'Mavzu raqami faqat sondan iborat bo\'lishi kerak.',
          admin_only: 'Bu amalni faqat admin roli bajaradi.',
        };
        toast(messages[error.data?.error] || `Saqlanmadi: ${error.message}`, 'error', 7000);
      } finally {
        saveButton.disabled = false;
      }
    },
  });

  const findChatsButton = el('button', {
    type: 'button',
    class: 'a-btn',
    text: 'chat_id ni aniqlash',
    onClick: async () => {
      chatsBox.textContent = 'Tekshirilmoqda…';
      try {
        const result = await api.telegramChats();
        if (!result.chats || result.chats.length === 0) {
          chatsBox.innerHTML = 'Hech qanday chat topilmadi. Botga (yoki bot qo\'shilgan guruhga) biror xabar yuboring va qaytadan bosing.';
          return;
        }
        chatsBox.innerHTML = '';
        chatsBox.append(el('p', { text: 'Topilgan chatlar — keraklisini bosing:' }));
        for (const chat of result.chats) {
          const kind = { private: 'shaxsiy chat', group: 'guruh', supergroup: 'guruh', channel: 'kanal' }[chat.type] || chat.type;
          chatsBox.append(
            el('button', {
              type: 'button',
              class: 'a-btn a-btn--sm',
              style: 'margin:0.15rem 0.3rem 0.15rem 0',
              text: `${chat.id} · ${kind} · ${chat.title || '—'}`,
              onClick: () => {
                chatInput.value = chat.id;
                toast('chat_id qo\'yildi — «Saqlash va tekshirish» ni bosing', 'info');
              },
            }),
          );
        }
      } catch (error) {
        chatsBox.textContent = `Aniqlanmadi: ${error.data?.error || error.message}`;
      }
    },
  });

  const testButton = el('button', {
    type: 'button',
    class: 'a-btn',
    text: 'Sinov xabarini yuborish',
    onClick: async () => {
      testButton.disabled = true;
      testButton.textContent = 'Yuborilmoqda…';
      try {
        await api.telegramTest();
        toast('Sinov xabari yuborildi — Telegramni tekshiring', 'success', 6000);
      } catch (error) {
        const explained = error.data?.explained;
        toast(
          explained
            ? `${explained.reason} ${explained.fix}`
            : `Yuborilmadi: ${error.data?.result?.error || error.data?.error || error.message}`,
          'error',
          14000,
        );
        render();
      } finally {
        testButton.disabled = false;
        testButton.textContent = 'Sinov xabarini yuborish';
      }
    },
  });

  const disableToggle = el('label', { class: 'a-check' }, [
    el('input', {
      type: 'checkbox',
      checked: Boolean(r.disabled),
      onChange: async (event) => {
        try {
          await api.telegramSave({ disabled: event.target.checked });
          toast(event.target.checked ? 'Yuborish o\'chirildi' : 'Yuborish yoqildi', 'success');
          render();
        } catch (error) {
          toast(`O'zgartirilmadi: ${error.message}`, 'error');
        }
      },
    }),
    el('span', {}, [
      'Telegramga yuborishni vaqtincha to\'xtatish',
      el('span', { class: 'a-field__hint', text: 'Murojaatlar qabul qilinishda va qutida saqlanishda davom etadi.' }),
    ]),
  ]);

  const details = el('div', { class: 'a-table-wrap' }, [
    el('table', { class: 'a-table' }, [
      el('tbody', {}, [
        row(
          'Tarmoq',
          r.network
            ? r.network.reachable
              ? `api.telegram.org ochiq (${r.network.ms} ms)`
              : `YOPIQ — ${r.network.error}. Hosting tashqi ulanishga ruxsat bermayapti.`
            : '— tekshirilmagan',
        ),
        row('Bot', r.bot ? `@${r.bot.username} (${r.bot.name})` : '— tekshirilmagan'),
        row('Bot tokeni', r.hasToken ? `${r.tokenMasked}  (manba: ${r.source?.botToken === 'env' ? '.env / muhit' : 'panel'})` : '— kiritilmagan'),
        row('Chat', r.chat ? `${r.chat.title || '—'} · ${r.chat.type} · ${r.chat.id}` : r.chatId ? `${r.chatId} (tekshirilmagan)` : '— kiritilmagan'),
        row('Forum mavzusi', r.threadId || '—'),
        row('API manzili', r.apiBase || '—'),
        row('.env fayli', data.envFileLoaded ? 'yuklangan' : 'topilmadi (majburiy emas)'),
        row('Murojaat shakli', data.contactEndpoint ? `faol → ${data.contactEndpoint}` : 'faolsiz'),
      ]),
    ]),
  ]);

  setMain(
    el('div', { class: 'page-bar' }, [
      el('h1', { text: 'Telegram' }),
      el('div', { class: 'page-bar__actions' }, [testButton, el('button', { type: 'button', class: 'a-btn a-btn--sm', text: 'Yangilash', onClick: render })]),
    ]),
    statusBox,
    endpointWarning,
    deliveryBox,
    el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Joriy holat' }),
      details,
    ]),
    el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Sozlamalar' }),
      el('p', { class: 'group__note', text: isAdmin ? 'Bot tokeni server/data/telegram.json faylida saqlanadi va repozitoriyaga tushmaydi. Bu sahifa faqat HTTPS orqali ochilishi kerak.' : 'Sozlamalarni faqat admin roliga ega xodim o\'zgartiradi.' }),
      el('div', { class: 'a-alert a-alert--info' }, [
        el('strong', { text: 'Bot qanday yaratiladi' }),
        el('ol', {}, [
          el('li', { text: 'Telegramda @BotFather ni oching va /newbot buyrug\'ini yuboring.' }),
          el('li', { text: 'Bot nomini va foydalanuvchi nomini kiriting (oxiri "bot" bilan tugashi shart).' }),
          el('li', { text: 'BotFather bergan tokenni quyidagi maydonga qo\'ying.' }),
          el('li', { text: 'Murojaatlar keladigan guruhni yaratib, botni unga qo\'shing va guruhda biror xabar yozing.' }),
          el('li', { text: '«chat_id ni aniqlash» tugmasini bosib, guruhni tanlang.' }),
        ]),
      ]),
      isAdmin
        ? el('div', {}, [
            el('label', { class: 'a-field' }, [
              el('span', { class: 'a-field__label', text: 'Bot tokeni' }),
              tokenInput,
              el('span', { class: 'a-field__hint', text: r.hasToken ? 'Bo\'sh qoldirsangiz, saqlangan token o\'zgarmaydi.' : '@BotFather dan olingan token.' }),
            ]),
            el('label', { class: 'a-field' }, [
              el('span', { class: 'a-field__label', text: 'chat_id — murojaatlar keladigan chat' }),
              chatInput,
            ]),
            el('div', { style: 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem' }, [findChatsButton]),
            chatsBox,
            el('label', { class: 'a-field' }, [
              el('span', { class: 'a-field__label', text: 'Forum mavzusi (ixtiyoriy)' }),
              threadInput,
            ]),
            disableToggle,
            el('div', { style: 'display:flex;gap:0.5rem;flex-wrap:wrap' }, [saveButton]),
          ])
        : el('p', { class: 'a-muted', text: 'Sizning rolingiz sozlamalarni o\'zgartirishga ruxsat bermaydi.' }),
    ]),
    el('div', { class: 'group' }, [
      el('h2', { class: 'group__title', text: 'Muhim eslatmalar' }),
      el('ul', {}, [
        el('li', { text: 'Murojaatlar avval serverga saqlanadi, keyin botga yuboriladi. Bot ishlamasa ham murojaat yo\'qolmaydi — «Murojaatlar» bo\'limida ko\'rinadi va u yerdan qayta yuborish mumkin.' }),
        el('li', { text: 'Telegramga shaxsiy ma\'lumotlar (ism, telefon, pochta) yuboriladi. Chatga faqat vakolatli xodimlar kirishi ta\'minlanishi kerak.' }),
        el('li', { text: 'Bot tokeni oshkor bo\'lsa, @BotFather → /revoke orqali darhol bekor qilib, yangisini oling.' }),
        el('li', { text: 'Sozlamalarni buyruq satridan ham kiritish mumkin: node server/tools/telegram-setup.mjs' }),
      ]),
    ]),
  );
}

/* ─────────────────────────── Ishga tushirish ─────────────────────────── */

checkSession();
