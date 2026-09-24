/**
 * Boshqaruv panelining asosiy skripti: kirish, bo'limlar va saqlash.
 */
import { qs, qsa, el, api, toast, pick, slugify, clone, todayIso, formatBytes, formatDateTime, confirmAction, emptyI18n } from './lib.js';
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
    } else {
      showLogin(!data.configured);
    }
  } catch (error) {
    showLogin(false, 'Server bilan aloqa yo\'q. Server ishlab turganini tekshiring.');
  }
}

function showLogin(needsSetup, message) {
  qs('#app-shell').hidden = true;
  qs('#login-screen').hidden = false;
  qs('#login-setup').hidden = !needsSetup;
  const errorBox = qs('#login-error');
  if (message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  } else {
    errorBox.hidden = true;
  }
  qs('#login-username').focus();
}

function showApp() {
  qs('#login-screen').hidden = true;
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
      no_users: 'Serverda foydalanuvchi yaratilmagan.',
    };
    errorBox.textContent = messages[error.data?.error] || `Kirish amalga oshmadi: ${error.message}`;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Kirish';
  }
});

qs('#logout').addEventListener('click', async () => {
  if (state.dirty && !confirmAction('Saqlanmagan o\'zgarishlar bor. Chiqishni davom ettirasizmi?')) return;
  await api.logout().catch(() => undefined);
  state.user = null;
  state.dirty = false;
  showLogin(false);
});

window.addEventListener('admin:unauthorized', () => {
  if (state.user) {
    state.user = null;
    showLogin(false, 'Seans tugadi. Qaytadan kiring.');
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
    await api.putContent(name, data);
    state.dirty = false;
    toast(`${name}.json saqlandi. O'zgarishlar saytda ko'rinishi uchun "Saytni qurish" bo'limidan qayta quring.`, 'success', 6000);
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
      inbox: renderInboxView,
      telegram: renderTelegramView,
      files: renderFilesView,
      build: renderBuildView,
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
    published: false,
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
        checkboxField(record, { path: 'published', label: 'Saytda nashr etish', hint: 'Belgilanmasa, lot faqat shu panelda ko\'rinadi.' }),
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
    published: false,
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
          onInput: (value) => {
            if (!record.slug) record.slug = slugify(pick(value));
          },
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
        checkboxField(record, { path: 'published', label: 'Saytda nashr etish' }),
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
    published: false,
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
          onInput: (value) => {
            if (!record.slug) record.slug = slugify(pick(value));
          },
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
      group('Nashr', [checkboxField(record, { path: 'published', label: 'Saytda nashr etish' })]),
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

function slugControl(record) {
  const input = el('input', {
    type: 'text',
    value: record.slug || '',
    dataset: { slugInput: 'true' },
    onInput: (event) => {
      event.target.dataset.touched = 'true';
      record.slug = slugify(event.target.value);
    },
    onBlur: (event) => {
      event.target.value = record.slug || '';
    },
  });
  return el('label', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: 'Manzil (slug) *' }),
    input,
    el('span', { class: 'a-field__hint', text: 'Sahifa manzilida ishlatiladi. Nashrdan keyin o\'zgartirish havolalarni buzadi.' }),
  ]);
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
          item.published === false ? el('span', { class: 'a-tag a-tag--warning', text: 'nashr etilmagan', style: 'margin-left:.4rem' }) : null,
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

  const editor = el('form', { class: 'editor', onSubmit: (event) => { event.preventDefault(); save(); } }, [...fields, actions]);
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

async function renderPagesView() {
  const pages = await loadContent('pages');
  const area = el('textarea', { class: 'a-input json-editor', spellcheck: 'false', value: JSON.stringify(pages, null, 2) });
  const status = el('p', { class: 'a-field__hint' });
  let parsed = pages;

  area.addEventListener('input', () => {
    state.dirty = true;
    try {
      parsed = JSON.parse(area.value);
      status.textContent = 'JSON to\'g\'ri.';
      status.style.color = 'var(--a-success)';
    } catch (error) {
      parsed = null;
      status.textContent = `JSON xato: ${error.message}`;
      status.style.color = 'var(--a-danger)';
    }
  });

  setMain(
    el('div', { class: 'page-bar' }, [el('h1', { text: 'Sahifa matnlari' })]),
    el('div', { class: 'a-alert a-alert--info' }, [
      el('strong', { text: 'Bosh sahifa, "Direksiya haqida", "Investorlarga" va boshqa bo\'limlarning matnlari' }),
      el('p', { text: 'Bu bo\'lim matnlarni to\'g\'ridan-to\'g\'ri JSON ko\'rinishida tahrirlaydi. Har bir matn to\'rt tilda: "uz-cyrl", "uz", "ru", "en". Tuzilmani (kalitlarni) o\'zgartirmang — faqat matnlarni yozing.' }),
      el('p', { class: 'a-small', text: 'Har bir saqlashdan oldin serverda avtomatik zaxira nusxa olinadi (oxirgi 20 ta versiya).' }),
    ]),
    el('div', { class: 'group' }, [area, status]),
    el('div', { class: 'sticky-actions' }, [
      el('button', {
        type: 'button',
        class: 'a-btn a-btn--primary',
        text: 'Saqlash',
        onClick: async () => {
          if (!parsed) {
            toast('JSON xato — saqlanmadi. Avval xatolikni tuzating.', 'error');
            return;
          }
          state.cache.pages = parsed;
          await saveContent('pages');
        },
      }),
      el('span', { class: 'sticky-actions__spacer' }),
      el('span', { class: 'a-small a-muted', text: 'pages.json' }),
    ]),
  );
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
  return el('p', { class: 'a-small', style: 'color:var(--a-danger)' }, [
    `📨 Telegramga yuborilmadi: ${tg.error || 'nomalum xatolik'}${tg.permanent ? ' (sozlamalarni tekshiring)' : ''}`,
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
        el('span', { class: 'a-tag', text: `Jami: ${items.length}` }),
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

/* ─────────────────────────── Saytni qurish ─────────────────────────── */

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
    el('div', { class: 'page-bar' }, [el('h1', { text: 'Saytni qurish' })]),
    el('div', { class: 'a-alert a-alert--info' }, [
      el('p', { text: 'Kontentni tahrirlagandan keyin o\'zgarishlar ommaviy saytda ko\'rinishi uchun saytni qayta qurish kerak. Qurish bir necha soniya davom etadi.' }),
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
      el('h2', { class: 'group__title', text: 'Qurish' }),
      el('div', { style: 'display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem' }, [
        el('button', { type: 'button', class: 'a-btn a-btn--primary', text: 'Saytni qurish', onClick: () => run(false) }),
        el('button', { type: 'button', class: 'a-btn', text: 'DEMO rejimida qurish', onClick: () => run(true) }),
      ]),
      logBox,
    ]),
  );
}

function row(label, value) {
  return el('tr', {}, [el('th', { text: label, scope: 'row' }), el('td', { text: value })]);
}

/* ─────────────────────────── Telegram ─────────────────────────── */

async function renderTelegramView() {
  const data = await api.telegram();
  const r = data.report || {};
  const isAdmin = state.user?.role === 'admin';

  const statusBox = (() => {
    if (r.enabled && r.bot && r.chat && (r.errors || []).length === 0) {
      return el('div', { class: 'a-alert a-alert--success' }, [
        el('strong', { text: 'Telegram ulangan' }),
        el('p', { text: `Murojaatlar @${r.bot.username} boti orqali "${r.chat.title || r.chat.id}" chatiga yuboriladi.` }),
      ]);
    }
    if (r.disabled) {
      return el('div', { class: 'a-alert a-alert--warning' }, [
        el('strong', { text: 'Telegramga yuborish vaqtincha o\'chirilgan' }),
        el('p', { text: 'Murojaatlar qabul qilinadi va «Murojaatlar» bo\'limida saqlanadi, lekin botga yuborilmaydi.' }),
      ]);
    }
    return el('div', { class: 'a-alert a-alert--warning' }, [
      el('strong', { text: 'Telegram hali sozlanmagan' }),
      el('p', { text: 'Quyida bot tokeni va chat identifikatorini kiriting. Murojaatlar shu paytgacha ham qabul qilinadi va «Murojaatlar» bo\'limida saqlanadi.' }),
      (r.errors || []).length ? el('ul', {}, r.errors.map((e) => el('li', { text: e }))) : null,
    ]);
  })();

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
        toast(`Yuborilmadi: ${error.data?.result?.error || error.data?.error || error.message}`, 'error', 8000);
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
