/**
 * Tahrirlash maydonlarini chizadigan funksiyalar.
 * Har bir funksiya DOM elementini qaytaradi va qiymatni to'g'ridan-to'g'ri
 * `record` obyektiga yozadi (yo'l orqali).
 */
import { el, qs, LOCALES, emptyI18n, pick, api, toast, formatBytes, clone } from './lib.js';

/* ── Yo'l bo'yicha o'qish/yozish ─────────────────────────────────────────── */

export function getPath(object, path) {
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), object);
}

export function setPath(object, path, value) {
  const keys = String(path).split('.');
  let node = object;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (node[keys[i]] == null || typeof node[keys[i]] !== 'object') node[keys[i]] = {};
    node = node[keys[i]];
  }
  node[keys[keys.length - 1]] = value;
}

/* ── Oddiy maydonlar ────────────────────────────────────────────────────── */

function wrap(label, control, hint) {
  return el('label', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: label }),
    control,
    hint ? el('span', { class: 'a-field__hint', text: hint }) : null,
  ]);
}

export function textField(record, field) {
  const input = el('input', {
    type: field.inputType || 'text',
    value: getPath(record, field.path) ?? '',
    placeholder: field.placeholder || '',
    onInput: (event) => setPath(record, field.path, event.target.value),
  });
  if (field.onInput) input.addEventListener('input', (event) => field.onInput(event.target.value, record));
  return wrap(field.label, input, field.hint);
}

export function numberField(record, field) {
  const current = getPath(record, field.path);
  const input = el('input', {
    type: 'number',
    step: field.step || 'any',
    min: field.min,
    value: current == null ? '' : String(current),
    placeholder: field.placeholder || '',
    onInput: (event) => {
      const raw = event.target.value.trim();
      setPath(record, field.path, raw === '' ? null : Number(raw));
    },
  });
  return wrap(field.label, input, field.hint);
}

export function dateField(record, field) {
  const input = el('input', {
    type: 'date',
    value: String(getPath(record, field.path) || '').slice(0, 10),
    onInput: (event) => setPath(record, field.path, event.target.value),
  });
  return wrap(field.label, input, field.hint);
}

export function checkboxField(record, field) {
  const input = el('input', {
    type: 'checkbox',
    checked: Boolean(getPath(record, field.path)),
    onChange: (event) => setPath(record, field.path, event.target.checked),
  });
  return el('label', { class: 'a-check' }, [
    input,
    el('span', {}, [field.label, field.hint ? el('span', { class: 'a-field__hint', text: field.hint }) : null]),
  ]);
}

export function selectField(record, field, options) {
  const current = getPath(record, field.path);
  const select = el('select', {
    onChange: (event) => setPath(record, field.path, event.target.value || null),
  });
  select.append(el('option', { value: '', text: field.emptyLabel || '— tanlanmagan —' }));
  for (const option of options) {
    select.append(el('option', { value: option.value, text: option.label, selected: String(current) === String(option.value) }));
  }
  return wrap(field.label, select, field.hint);
}

export function multiSelectField(record, field, options) {
  const current = new Set(Array.isArray(getPath(record, field.path)) ? getPath(record, field.path) : []);
  const box = el('div', { class: 'list-editor' });
  for (const option of options) {
    const input = el('input', {
      type: 'checkbox',
      checked: current.has(option.value),
      onChange: (event) => {
        if (event.target.checked) current.add(option.value);
        else current.delete(option.value);
        setPath(record, field.path, [...current]);
      },
    });
    box.append(el('label', { class: 'a-check' }, [input, el('span', { text: option.label })]));
  }
  return el('div', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: field.label }), box]);
}

/* ── Ko'p tilli maydon ──────────────────────────────────────────────────── */

export function i18nField(record, field) {
  let value = getPath(record, field.path);
  if (value == null || typeof value !== 'object') {
    value = emptyI18n();
    if (typeof getPath(record, field.path) === 'string') value['uz-cyrl'] = getPath(record, field.path);
    setPath(record, field.path, value);
  }

  const tabs = [];
  const panels = [];
  const container = el('div', { class: 'i18n' });
  const head = el('div', { class: 'i18n__head' }, [el('span', { class: 'i18n__label', text: field.label })]);

  const activate = (index) => {
    tabs.forEach((tab, i) => tab.classList.toggle('is-active', i === index));
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
    });
  };

  LOCALES.forEach((locale, index) => {
    const filled = String(value[locale.code] || '').trim() !== '';
    const tab = el('button', {
      type: 'button',
      class: `i18n__tab${index === 0 ? ' is-active' : ''}${filled ? ' is-filled' : ''}`,
      title: locale.title,
      text: locale.label,
      onClick: () => activate(index),
    });
    tabs.push(tab);
    head.append(tab);

    const control = field.multiline
      ? el('textarea', {
          class: 'a-input',
          rows: field.rows || 4,
          value: value[locale.code] || '',
          placeholder: field.placeholder || '',
        })
      : el('input', { class: 'a-input', type: 'text', value: value[locale.code] || '', placeholder: field.placeholder || '' });

    control.addEventListener('input', (event) => {
      value[locale.code] = event.target.value;
      tab.classList.toggle('is-filled', event.target.value.trim() !== '');
      if (field.onInput) field.onInput(value, record);
    });

    const panel = el('div', { class: 'i18n__panel', hidden: index !== 0 }, [control]);
    panels.push(panel);
    container.append(panel);
  });

  container.prepend(head);
  if (field.hint) container.append(el('p', { class: 'a-field__hint', style: 'padding:0 0.6rem 0.5rem', text: field.hint }));
  return container;
}

/* ── Ko'p tilli qiymatlar ro'yxati ─────────────────────────────────────── */

export function i18nListField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }

  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) {
      list.append(el('p', { class: 'a-muted a-small', text: "Ro'yxat bo'sh." }));
    }
    items.forEach((item, index) => {
      if (item == null || typeof item !== 'object') {
        items[index] = { 'uz-cyrl': String(item ?? ''), uz: '', ru: '', en: '' };
      }
      const row = el('div', { class: 'list-item' }, [
        el('div', { class: 'list-item__body' }, [
          i18nField(items, { path: String(index), label: `${index + 1}.`, multiline: field.multiline !== false, rows: 2 }),
        ]),
        el('div', { class: 'list-item__tools' }, [
          el('button', {
            type: 'button',
            class: 'a-btn a-btn--sm',
            text: '↑',
            title: 'Yuqoriga',
            onClick: () => {
              if (index === 0) return;
              [items[index - 1], items[index]] = [items[index], items[index - 1]];
              draw();
            },
          }),
          el('button', {
            type: 'button',
            class: 'a-btn a-btn--sm a-btn--danger',
            text: '✕',
            title: "O'chirish",
            onClick: () => {
              items.splice(index, 1);
              draw();
            },
          }),
        ]),
      ]);
      list.append(row);
    });
  };

  draw();

  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: field.label }),
    field.hint ? el('span', { class: 'a-field__hint', text: field.hint }) : null,
    list,
    el('button', {
      type: 'button',
      class: 'a-btn a-btn--sm',
      text: '+ Qator qo\'shish',
      onClick: () => {
        items.push(emptyI18n());
        draw();
      },
    }),
  ]);
}

/* ── Koordinatalar ─────────────────────────────────────────────────────── */

export function coordinatesField(record, field) {
  const current = getPath(record, field.path);
  const state = { lat: current?.lat ?? '', lng: current?.lng ?? '' };

  const update = () => {
    const lat = String(state.lat).trim();
    const lng = String(state.lng).trim();
    if (lat === '' || lng === '') {
      setPath(record, field.path, null);
      return;
    }
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      setPath(record, field.path, null);
      return;
    }
    setPath(record, field.path, { lat: latNum, lng: lngNum });
  };

  const latInput = el('input', {
    type: 'text',
    inputmode: 'decimal',
    value: state.lat,
    placeholder: '41.000000',
    onInput: (event) => {
      state.lat = event.target.value;
      update();
    },
  });
  const lngInput = el('input', {
    type: 'text',
    inputmode: 'decimal',
    value: state.lng,
    placeholder: '71.000000',
    onInput: (event) => {
      state.lng = event.target.value;
      update();
    },
  });

  const paste = el('input', {
    type: 'text',
    placeholder: '41.074200, 71.813500 — nusxalab qo\'ying',
    onInput: (event) => {
      const match = /(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/.exec(event.target.value);
      if (!match) return;
      state.lat = match[1].replace(',', '.');
      state.lng = match[2].replace(',', '.');
      latInput.value = state.lat;
      lngInput.value = state.lng;
      update();
    },
  });

  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: field.label }),
    el('span', {
      class: 'a-field__hint',
      text: 'Faqat haqiqiy geodezik koordinatalarni kiriting. Taxminiy nuqta qo\'yish man etiladi. Bo\'sh qoldirilsa, hudud xaritada ko\'rsatilmaydi.',
    }),
    el('div', { class: 'a-row' }, [
      el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Kenglik (lat)' }), latInput]),
      el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Uzunlik (lng)' }), lngInput]),
    ]),
    el('label', { class: 'a-field' }, [
      el('span', { class: 'a-field__label', text: 'Yoki juftlikni birga joylashtiring' }),
      paste,
    ]),
  ]);
}

/* ── JSON maydon (chegara konturi kabi murakkab qiymatlar uchun) ───────── */

export function jsonField(record, field) {
  const current = getPath(record, field.path);
  const area = el('textarea', {
    class: 'a-input',
    rows: field.rows || 6,
    spellcheck: 'false',
    value: current == null ? '' : JSON.stringify(current, null, 2),
    placeholder: field.placeholder || '',
  });
  const status = el('p', { class: 'a-field__hint' });

  area.addEventListener('input', () => {
    const raw = area.value.trim();
    if (raw === '') {
      setPath(record, field.path, null);
      status.textContent = 'Bo\'sh — qiymat saqlanmaydi.';
      status.style.color = '';
      return;
    }
    try {
      setPath(record, field.path, JSON.parse(raw));
      status.textContent = 'JSON to\'g\'ri.';
      status.style.color = 'var(--a-success)';
    } catch (error) {
      status.textContent = `JSON xato: ${error.message}`;
      status.style.color = 'var(--a-danger)';
    }
  });

  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: field.label }),
    field.hint ? el('span', { class: 'a-field__hint', text: field.hint }) : null,
    area,
    status,
  ]);
}

/* ── Fayl yuklash ──────────────────────────────────────────────────────── */

export function createDropZone({ folder, accept, multiple = true, onUploaded }) {
  const input = el('input', { type: 'file', accept: accept || '', multiple, hidden: true });
  const zone = el('div', {
    class: 'drop-zone',
    tabindex: '0',
    role: 'button',
    text: 'Fayl tanlash uchun bosing yoki shu yerga tortib tashlang',
  });

  const handle = async (files) => {
    for (const file of Array.from(files)) {
      zone.textContent = `Yuklanmoqda: ${file.name}…`;
      try {
        const result = await api.upload(file, folder);
        onUploaded(result, file);
        toast(`Yuklandi: ${file.name} (${formatBytes(result.sizeBytes)})`, 'success');
      } catch (error) {
        toast(`Yuklanmadi: ${file.name} — ${error.data?.error || error.message}`, 'error', 7000);
      }
    }
    zone.textContent = 'Fayl tanlash uchun bosing yoki shu yerga tortib tashlang';
    input.value = '';
  };

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-over');
    if (event.dataTransfer?.files?.length) handle(event.dataTransfer.files);
  });
  input.addEventListener('change', () => {
    if (input.files?.length) handle(input.files);
  });

  return el('div', {}, [zone, input]);
}

/* ── Media ro'yxati ────────────────────────────────────────────────────── */

const MEDIA_KINDS = [
  { value: 'photo', label: 'Haqiqiy fotosurat' },
  { value: 'render', label: 'Loyiha konsepsiyasi (vizualizatsiya)' },
  { value: 'scheme', label: 'Chizma / sxema' },
];

export function mediaListField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }

  const grid = el('div', { class: 'media-grid' });

  const draw = () => {
    grid.innerHTML = '';
    if (items.length === 0) {
      grid.append(el('p', { class: 'a-muted a-small', text: 'Tasvir joylashtirilmagan. Saytda "Fotosurat hozircha joylashtirilmagan" holati ko\'rinadi.' }));
    }
    items.forEach((item, index) => {
      if (!item.kind) item.kind = 'photo';
      const kindSelect = el('select', {
        class: 'a-input',
        onChange: (event) => {
          item.kind = event.target.value;
          draw();
        },
      });
      for (const kind of MEDIA_KINDS) {
        kindSelect.append(el('option', { value: kind.value, text: kind.label, selected: item.kind === kind.value }));
      }

      const tile = el('div', { class: 'media-tile' }, [
        el('img', { src: item.src, alt: '', loading: 'lazy' }),
        el('div', { class: 'media-tile__body' }, [
          el('span', {
            class: `media-tile__kind${item.kind === 'render' ? ' media-tile__kind--render' : ''}`,
            text: MEDIA_KINDS.find((k) => k.value === item.kind)?.label || item.kind,
          }),
          kindSelect,
          i18nField(item, { path: 'caption', label: 'Izoh', multiline: true, rows: 2 }),
          i18nField(item, { path: 'alt', label: 'Matnli tavsif (alt)', multiline: false }),
          el('div', { class: 'a-row' }, [
            el('label', { class: 'a-field' }, [
              el('span', { class: 'a-field__label', text: 'Sana' }),
              el('input', { type: 'date', value: String(item.date || '').slice(0, 10), onInput: (e) => { item.date = e.target.value; } }),
            ]),
            el('label', { class: 'a-field' }, [
              el('span', { class: 'a-field__label', text: 'Muallif' }),
              el('input', { type: 'text', value: item.author || '', onInput: (e) => { item.author = e.target.value; } }),
            ]),
          ]),
          el('div', { style: 'display:flex;gap:0.3rem;flex-wrap:wrap' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: 'O\'chirish', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      ]);
      grid.append(tile);
    });
  };

  draw();

  const dropZone = createDropZone({
    folder: field.folder || 'media',
    accept: 'image/*',
    onUploaded: (result) => {
      items.push({ kind: 'photo', src: result.src, caption: emptyI18n(), alt: emptyI18n(), date: '', author: '' });
      draw();
    },
  });

  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: field.label }),
    el('span', {
      class: 'a-field__hint',
      text: 'Har bir tasvir turini to\'g\'ri belgilang. "Loyiha konsepsiyasi" deb belgilangan tasvirlar saytda shu yozuv bilan chiqadi va qurib bitkazilgan obyekt sifatida ko\'rsatilmaydi.',
    }),
    grid,
    dropZone,
  ]);
}

/* ── Hujjatlar ro'yxati ────────────────────────────────────────────────── */

export function documentListField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }

  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) {
      list.append(el('p', { class: 'a-muted a-small', text: 'Hujjat yuklanmagan. Saytda "Yuklab olish uchun fayl hozircha joylashtirilmagan" yoziladi.' }));
    }
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            i18nField(item, { path: 'title', label: 'Hujjat nomi', multiline: false }),
            el('p', { class: 'a-small', html: `<code>${item.src || ''}</code> ${item.sizeBytes ? `· ${formatBytes(item.sizeBytes)}` : ''}` }),
          ]),
          el('div', { class: 'list-item__tools' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: '✕', onClick: () => { items.splice(index, 1); draw(); } }),
          ]),
        ]),
      );
    });
  };

  draw();

  const dropZone = createDropZone({
    folder: field.folder || 'documents',
    accept: '.pdf,.zip',
    onUploaded: (result, file) => {
      items.push({
        title: { 'uz-cyrl': file.name, uz: file.name, ru: file.name, en: file.name },
        src: result.src,
        sizeBytes: result.sizeBytes,
        format: (file.name.split('.').pop() || '').toUpperCase(),
      });
      draw();
    },
  });

  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: field.label }),
    list,
    dropZone,
  ]);
}

/* ── Chizmalar ro'yxati (master-reja varaqlari) ───────────────────────── */

export function sheetListField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }

  const grid = el('div', { class: 'media-grid' });

  const draw = () => {
    grid.innerHTML = '';
    if (items.length === 0) grid.append(el('p', { class: 'a-muted a-small', text: 'Chizma yuklanmagan.' }));
    items.forEach((item, index) => {
      if (!item.kind) item.kind = 'scheme';
      const kindSelect = el('select', { class: 'a-input', onChange: (e) => { item.kind = e.target.value; draw(); } });
      for (const kind of [{ value: 'scheme', label: 'Chizma / sxema' }, { value: 'render', label: 'Loyiha konsepsiyasi' }]) {
        kindSelect.append(el('option', { value: kind.value, text: kind.label, selected: item.kind === kind.value }));
      }
      grid.append(
        el('div', { class: 'media-tile' }, [
          el('img', { src: item.src, alt: '', loading: 'lazy' }),
          el('div', { class: 'media-tile__body' }, [
            kindSelect,
            i18nField(item, { path: 'title', label: 'Varaq nomi', multiline: false }),
            el('div', { style: 'display:flex;gap:0.3rem' }, [
              el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '↑', onClick: () => { if (index > 0) { [items[index - 1], items[index]] = [items[index], items[index - 1]]; draw(); } } }),
              el('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--danger', text: 'O\'chirish', onClick: () => { items.splice(index, 1); draw(); } }),
            ]),
          ]),
        ]),
      );
    });
  };

  draw();

  const dropZone = createDropZone({
    folder: field.folder || 'masterplans',
    accept: 'image/*',
    onUploaded: (result, file) => {
      items.push({ kind: 'scheme', src: result.src, title: { 'uz-cyrl': file.name, uz: file.name, ru: file.name, en: file.name }, zoomable: true });
      draw();
    },
  });

  return el('div', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: field.label }), grid, dropZone]);
}

/* ── Zonalar va eksplikatsiya (master-reja) ───────────────────────────── */

export function zoneListField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }
  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Zona qo\'shilmagan.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            i18nField(item, { path: 'name', label: 'Zona nomi', multiline: false }),
            i18nField(item, { path: 'purpose', label: 'Vazifasi', multiline: true, rows: 2 }),
            el('div', { class: 'a-row' }, [
              numberField(item, { path: 'areaHa', label: 'Maydon, ga', step: '0.01' }),
              el('label', { class: 'a-field' }, [
                el('span', { class: 'a-field__label', text: 'Rang' }),
                el('input', { type: 'color', value: item.color || '#0d7d8f', onInput: (e) => { item.color = e.target.value; } }),
              ]),
            ]),
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
    el('span', { class: 'a-field__label', text: field.label }),
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Zona qo\'shish', onClick: () => { items.push({ name: emptyI18n(), purpose: emptyI18n(), areaHa: null, color: '#0d7d8f' }); draw(); } }),
  ]);
}

export function explicationField(record, field) {
  let items = getPath(record, field.path);
  if (!Array.isArray(items)) {
    items = [];
    setPath(record, field.path, items);
  }
  const list = el('div', { class: 'list-editor' });

  const draw = () => {
    list.innerHTML = '';
    if (items.length === 0) list.append(el('p', { class: 'a-muted a-small', text: 'Eksplikatsiya qatorlari yo\'q.' }));
    items.forEach((item, index) => {
      list.append(
        el('div', { class: 'list-item' }, [
          el('div', { class: 'list-item__body' }, [
            el('div', { class: 'a-row' }, [
              el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: '№' }), el('input', { type: 'text', value: item.no || String(index + 1), onInput: (e) => { item.no = e.target.value; } })]),
              numberField(item, { path: 'areaM2', label: 'Maydon, m²', step: '0.1' }),
              el('label', { class: 'a-field' }, [el('span', { class: 'a-field__label', text: 'Sig\'imi' }), el('input', { type: 'text', value: item.capacity || '', onInput: (e) => { item.capacity = e.target.value; } })]),
            ]),
            i18nField(item, { path: 'name', label: 'Obyekt nomi', multiline: false }),
            i18nField(item, { path: 'note', label: 'Izoh', multiline: false }),
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
    el('span', { class: 'a-field__label', text: field.label }),
    list,
    el('button', { type: 'button', class: 'a-btn a-btn--sm', text: '+ Qator qo\'shish', onClick: () => { items.push({ no: String(items.length + 1), name: emptyI18n(), areaM2: null, capacity: '', note: emptyI18n() }); draw(); } }),
  ]);
}


/**
 * Koordinata faylini (KMZ / KML / GeoJSON) yuklab, nuqta va chegarani
 * avtomatik to'ldiradi.
 *
 * Geodeziya xizmati chegarani odatda KMZ ko'rinishida beradi — xodim
 * koordinatalarni qo'lda ko'chirib yozmasligi kerak.
 *
 * @param {object} record tahrirlanayotgan yozuv
 * @param {{ coordinatesPath: string, boundaryPath: string, onApplied?: function }} options
 */
export function geoFileField(record, options) {
  const { coordinatesPath = 'coordinates', boundaryPath = 'boundary', onApplied } = options || {};

  const status = el('div', { class: 'a-small', style: 'margin-top:0.5rem' });
  const input = el('input', {
    type: 'file',
    accept: '.kmz,.kml,.geojson,.json',
    style: 'display:none',
  });

  const setStatus = (kind, lines) => {
    status.innerHTML = '';
    status.style.color = kind === 'error' ? 'var(--a-danger)' : kind === 'ok' ? 'var(--a-success)' : 'inherit';
    for (const line of [].concat(lines)) {
      if (line) status.append(el('p', { text: line, style: 'margin:0.15rem 0' }));
    }
  };

  const load = async (file) => {
    if (!file) return;
    setStatus('info', `${file.name} o'qilmoqda…`);
    try {
      const result = await api.parseGeoFile(file);

      const applied = [];
      if (result.coordinates) {
        setPath(record, coordinatesPath, result.coordinates);
        applied.push(`markaziy nuqta: ${result.coordinates.lat}, ${result.coordinates.lng}`);
      }
      if (result.boundary && boundaryPath) {
        setPath(record, boundaryPath, result.boundary);
        applied.push(`chegara: ${result.boundary.length} nuqta`);
      }
      if (applied.length === 0) {
        setStatus('error', 'Faylda nuqta ham, chegara ham topilmadi.');
        return;
      }

      setStatus('ok', [
        `✓ ${result.format.toUpperCase()} fayldan olindi — ${applied.join(', ')}`,
        result.name ? `Fayldagi nomi: ${result.name}` : null,
        ...(result.notes || []),
      ]);
      toast('Koordinatalar fayldan olindi', 'success');
      onApplied?.(result);
    } catch (error) {
      const messages = {
        no_geometry: 'Faylda nuqta yoki chegara topilmadi.',
        parse_failed: error.data?.message || 'Fayl o\'qilmadi.',
        too_large: 'Fayl juda katta (12 MB dan oshmasligi kerak).',
        empty: 'Fayl bo\'sh.',
      };
      setStatus('error', messages[error.data?.error] || `O'qilmadi: ${error.data?.message || error.message}`);
    } finally {
      input.value = '';
    }
  };

  input.addEventListener('change', () => load(input.files?.[0]));

  const zone = el('div', {
    class: 'drop-zone',
    onClick: () => input.click(),
    onDragOver: (event) => {
      event.preventDefault();
      zone.classList.add('is-over');
    },
    onDragLeave: () => zone.classList.remove('is-over'),
    onDrop: (event) => {
      event.preventDefault();
      zone.classList.remove('is-over');
      load(event.dataTransfer?.files?.[0]);
    },
  }, [
    el('strong', { text: 'Koordinata faylini yuklang' }),
    el('span', { class: 'a-small', text: 'KMZ, KML yoki GeoJSON — bosing yoki faylni bu yerga tashlang' }),
  ]);

  return el('div', { class: 'a-field' }, [
    el('span', { class: 'a-field__label', text: 'Fayldan olish (tavsiya etiladi)' }),
    el('span', {
      class: 'a-field__hint',
      text: 'Geodeziya xizmati bergan KMZ faylni yuklasangiz, markaziy nuqta va chegara o\'zi to\'ldiriladi. Fayl saqlanmaydi — faqat koordinatalar olinadi.',
    }),
    zone,
    input,
    status,
  ]);
}
