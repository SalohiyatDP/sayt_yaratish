/** Yangiliklarni rukn bo'yicha saralash. */
import { qs, qsa } from './core/config.js';

function initNewsFilter() {
  const tabs = qs('[data-news-filter]');
  const grid = qs('[data-news-grid]');
  if (!tabs || !grid) return;
  const empty = qs('[data-news-empty]');
  const cells = qsa('.card-grid__cell', grid);

  function apply(category) {
    let visible = 0;
    for (const cell of cells) {
      const ok = !category || cell.dataset.category === category;
      cell.hidden = !ok;
      if (ok) visible += 1;
    }
    if (empty) empty.hidden = visible !== 0;

    for (const button of qsa('[data-category]', tabs)) {
      const active = (button.dataset.category || '') === category;
      button.classList.toggle('tab-filter__btn--active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    const params = new URLSearchParams(window.location.search);
    if (category) params.set('category', category);
    else params.delete('category');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }

  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    apply(button.dataset.category || '');
  });

  const initial = new URLSearchParams(window.location.search).get('category') || '';
  if (initial) apply(initial);
}

initNewsFilter();
