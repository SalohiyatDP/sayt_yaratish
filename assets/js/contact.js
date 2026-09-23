/**
 * Murojaat shakli.
 *
 * MUHIM: muvaffaqiyat xabari FAQAT server murojaatni saqlaganini
 * tasdiqlagan (ok: true va ro'yxatga olish raqami qaytgan) holatda ko'rsatiladi.
 * Boshqa barcha hollarda xabar saqlanmagani ochiq aytiladi.
 */
import { qs, qsa, t, escapeHtml } from './core/config.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;

function setFieldError(form, name, message) {
  const node = qs(`[data-error-for="${name}"]`, form);
  const input = form.elements.namedItem(name);
  const field = input?.closest('.field');
  if (node) {
    node.textContent = message || '';
    node.hidden = !message;
  }
  if (field) field.classList.toggle('field--invalid', Boolean(message));
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function clearErrors(form) {
  for (const node of qsa('[data-error-for]', form)) {
    node.textContent = '';
    node.hidden = true;
  }
  for (const field of qsa('.field--invalid', form)) field.classList.remove('field--invalid');
  for (const input of qsa('[aria-invalid]', form)) input.removeAttribute('aria-invalid');
}

function validate(form) {
  clearErrors(form);
  const values = {
    name: String(form.elements.name?.value || '').trim(),
    organization: String(form.elements.organization?.value || '').trim(),
    phone: String(form.elements.phone?.value || '').trim(),
    email: String(form.elements.email?.value || '').trim(),
    area: String(form.elements.area?.value || '').trim(),
    message: String(form.elements.message?.value || '').trim(),
    consent: Boolean(form.elements.consent?.checked),
    locale: String(form.elements.locale?.value || ''),
    page: String(form.elements.page?.value || ''),
  };

  const errors = [];
  if (values.name === '') {
    setFieldError(form, 'name', t('contact.form.validation.required'));
    errors.push('name');
  }
  if (values.message === '') {
    setFieldError(form, 'message', t('contact.form.validation.required'));
    errors.push('message');
  }
  if (values.phone === '' && values.email === '') {
    setFieldError(form, 'email', t('contact.form.validation.contact'));
    errors.push('contact');
  } else {
    if (values.email !== '' && !EMAIL_RE.test(values.email)) {
      setFieldError(form, 'email', t('contact.form.validation.email'));
      errors.push('email');
    }
    if (values.phone !== '' && !PHONE_RE.test(values.phone)) {
      setFieldError(form, 'phone', t('contact.form.validation.phone'));
      errors.push('phone');
    }
  }
  if (!values.consent) {
    setFieldError(form, 'consent', t('contact.form.validation.consent'));
    errors.push('consent');
  }

  return { values, errors };
}

function showAlert(form, kind, title, text) {
  const alert = qs('[data-form-alert]', form);
  if (!alert) return;
  alert.className = `form__alert form__alert--${kind}`;
  alert.innerHTML = `<strong>${escapeHtml(title)}</strong>${text ? `<span>${escapeHtml(text)}</span>` : ''}`;
  alert.hidden = false;
  alert.focus?.();
  alert.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function initContactForm() {
  const form = qs('[data-contact-form]');
  if (!form) return;

  const enabled = form.dataset.enabled === 'true';
  const endpoint = form.dataset.endpoint || '';
  const submit = qs('button[type="submit"]', form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Qabul qilish tizimi ulanmagan bo'lsa — hech qanday muvaffaqiyat xabari chiqarilmaydi.
    if (!enabled || !endpoint) {
      showAlert(form, 'error', t('contact.form.disabledTitle'), t('contact.form.disabledText'));
      return;
    }

    const { values, errors } = validate(form);
    if (errors.length > 0) {
      showAlert(form, 'error', t('contact.form.validation.summary', { n: errors.length }), '');
      const firstInvalid = qs('.field--invalid input, .field--invalid textarea', form);
      firstInvalid?.focus();
      return;
    }

    const label = submit?.querySelector('span');
    const originalLabel = label?.textContent;
    if (submit) {
      submit.disabled = true;
      if (label) label.textContent = submit.dataset.sendingLabel || t('contact.form.sending');
    }

    let result = null;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(values),
      });
      if (response.ok) {
        const data = await response.json().catch(() => null);
        // Faqat server saqlaganini aniq tasdiqlasa — muvaffaqiyat.
        if (data && data.ok === true && data.id) result = data;
      }
    } catch (error) {
      result = null;
    }

    if (submit) {
      submit.disabled = false;
      if (label && originalLabel) label.textContent = originalLabel;
    }

    if (result) {
      showAlert(form, 'success', t('contact.form.success', { id: result.id }), t('contact.form.successHint'));
      form.reset();
    } else {
      showAlert(form, 'error', t('contact.form.error'), t('contact.form.errorHint'));
    }
  });

  // Maydonni to'g'rilaganda xatolik belgisini olib tashlash
  form.addEventListener('input', (event) => {
    const name = event.target?.name;
    if (name) setFieldError(form, name, '');
  });
}

initContactForm();
