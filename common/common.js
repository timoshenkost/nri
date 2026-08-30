/* common.js — утилиты, общие для всех листов персонажей.
   Подключается ПОСЛЕ character.js (нужен CHARACTER.id) и ДО скриптов страницы. */

/* ------------------------------------------------------------------ *
 * Хранилище.
 * Все ключи получают префикс персонажа: localStorage привязан к origin,
 * а не к пути, поэтому без префикса два листа на одном домене затирали
 * бы друг другу хиты, ячейки и книгу заклинаний.
 * ------------------------------------------------------------------ */
const Store = {
  _full(key) {
    return `${CHARACTER.id}:${key}`;
  },

  get(key, fallback) {
    let raw = null;
    try {
      raw = localStorage.getItem(this._full(key));
    } catch (e) {
      console.warn('localStorage недоступен, данные не сохранятся:', e);
      return fallback;
    }
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Повреждённые данные в "${key}", взяты значения по умолчанию:`, e);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(this._full(key), JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`Не удалось сохранить "${key}":`, e);
      return false;
    }
  },

  remove(key) {
    try { localStorage.removeItem(this._full(key)); } catch (e) { /* игнорируем */ }
  },

  /* Сырой доступ — только для экспорта/импорта, где нужен текст как есть. */
  raw(key) {
    try { return localStorage.getItem(this._full(key)); } catch (e) { return null; }
  },

  setRaw(key, value) {
    localStorage.setItem(this._full(key), value);
  }
};

/* Ключи, из которых состоит сохранение. Общие для всех листов плюс те,
   что персонаж объявил сам в character.js. */
const SAVE_KEYS = [
  'my_hp',
  'my_max_hp',
  'my_temp_hp',
  'money',
  'active_tab',
  'spellbook_data'
].concat(CHARACTER.extraSaveKeys || []);

/* ------------------------------------------------------------------ *
 * Разовый перенос данных из версии без префиксов.
 *
 * Тонкость: оба листа раньше писали в ОДНИ И ТЕ ЖЕ ключи (my_hp,
 * spellbook_data и т.д.), а localStorage привязан к origin, а не к пути.
 * На timoshenkost.github.io под этими ключами лежат данные Ониксы — и если
 * дать мигрировать всем подряд, Стиви утащит себе чужие хиты и книгу.
 *
 * Поэтому каждый персонаж объявляет в character.js, НА КАКОМ origin лежит
 * именно его старое сохранение (legacyOrigin). Перенос срабатывает только
 * там; в остальных местах лист стартует чистым, а данные переносятся
 * кнопкой 💾 — это надёжнее и не зависит от угадывания.
 * ------------------------------------------------------------------ */
function migrateLegacyKeys() {
  const FLAG = 'legacy_migrated';
  if (Store.get(FLAG, false)) return;

  // location.host для file:// — пустая строка, это и есть «локально с диска».
  if (CHARACTER.legacyOrigin === undefined) return;
  if (CHARACTER.legacyOrigin !== location.host) return;

  let moved = 0;
  try {
    SAVE_KEYS.forEach(key => {
      const legacy = localStorage.getItem(key);
      if (legacy === null) return;
      if (localStorage.getItem(Store._full(key)) !== null) return;
      Store.setRaw(key, legacy);
      moved++;
    });
  } catch (e) {
    console.warn('Перенос старых данных не удался:', e);
  }

  Store.set(FLAG, true);
  return moved;
}

/* ------------------------------------------------------------------ *
 * Экранирование: данные попадают в HTML через innerHTML, поэтому любой
 * апостроф или угловая скобка в названии не должны ломать разметку.
 * ------------------------------------------------------------------ */
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/* ------------------------------------------------------------------ *
 * Уведомления
 * ------------------------------------------------------------------ */
function showNotice(message) {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

/* ------------------------------------------------------------------ *
 * Модальные окна вместо системных confirm()/prompt().
 * ------------------------------------------------------------------ */
const Modal = {
  _overlay: null,

  _ensure() {
    if (this._overlay) return this._overlay;

    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-title"></div>
        <div class="modal-text"></div>
        <div class="modal-field"></div>
        <div class="modal-buttons"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) this.close();
    });

    this._overlay = overlay;
    return overlay;
  },

  /* actions — список кнопок действия [{label, className, onClick(value)}].
     Если не задан, рисуется одна кнопка confirmText с onConfirm. */
  _open({ title, text = '', field = null, confirmText = 'Да', cancelText = 'Отмена', onConfirm, actions = null }) {
    const overlay = this._ensure();
    overlay.querySelector('.modal-title').textContent = title;
    overlay.querySelector('.modal-text').textContent = text;

    const fieldSlot = overlay.querySelector('.modal-field');
    fieldSlot.innerHTML = '';
    if (field) fieldSlot.appendChild(field);

    const buttons = overlay.querySelector('.modal-buttons');
    buttons.innerHTML = '';

    const list = actions || [{ label: confirmText, className: 'btn-confirm', onClick: onConfirm }];
    list.forEach(action => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal-btn ' + (action.className || 'btn-confirm');
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        const value = field ? field.value : undefined;
        this.close();
        if (action.onClick) action.onClick(value);
      });
      buttons.appendChild(btn);
    });

    if (cancelText !== null) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'modal-btn btn-cancel';
      cancel.textContent = cancelText;
      cancel.addEventListener('click', () => this.close());
      buttons.appendChild(cancel);
    }

    overlay.classList.add('is-open');

    if (field) {
      field.focus();
      if (field.select) field.select();
    } else if (buttons.firstElementChild) {
      buttons.firstElementChild.focus();
    }
  },

  confirm(options) { this._open(options); },

  /* Enter срабатывает как первая кнопка действия. */
  prompt({ title, text = '', value = '', inputType = 'number', confirmText = 'Сохранить', onConfirm, actions = null }) {
    const input = document.createElement('input');
    input.type = inputType;
    input.className = 'modal-input';
    input.inputMode = inputType === 'number' ? 'numeric' : 'text';
    input.value = value;
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = this._overlay.querySelector('.modal-buttons .modal-btn');
      if (first) first.click();
    });
    this._open({ title, text, field: input, confirmText, onConfirm, actions });
  },

  close() {
    if (!this._overlay) return;
    this._overlay.classList.remove('is-open');
  }
};

/* ------------------------------------------------------------------ *
 * Перерисовка с сохранением состояния: какие карточки были раскрыты
 * (по data-key), где был скролл и что было в фокусе.
 * ------------------------------------------------------------------ */
function rerender(container, renderFn) {
  const roots = (Array.isArray(container) ? container : [container]).filter(Boolean);

  const openKeys = new Set();
  roots.forEach(root => {
    root.querySelectorAll('details[data-key]').forEach(d => {
      if (d.open) openKeys.add(d.dataset.key);
    });
  });

  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
  const active = document.activeElement;
  const activeId = active && active.id ? active.id : null;

  renderFn();

  roots.forEach(root => {
    root.querySelectorAll('details[data-key]').forEach(d => {
      if (openKeys.has(d.dataset.key)) d.open = true;
    });
  });

  if (activeId) {
    const restored = document.getElementById(activeId);
    if (restored && restored.focus) restored.focus({ preventScroll: true });
  }
  window.scrollTo(0, scrollTop);
}

/* ------------------------------------------------------------------ *
 * Поиск. Фильтрует details[data-search] и прячет опустевшие секции.
 * Возвращает функцию, которую надо звать после каждой перерисовки.
 * ------------------------------------------------------------------ */
function initSearch(input, root) {
  const apply = () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;

    root.querySelectorAll('details[data-search]').forEach(card => {
      const match = query === '' || card.dataset.search.includes(query);
      card.hidden = !match;
      if (match) visible++;
    });

    root.querySelectorAll('.group').forEach(group => {
      group.hidden = !group.querySelector('details:not([hidden])');
    });

    const empty = root.querySelector('.search-empty');
    if (empty) empty.hidden = visible > 0;
  };

  input.addEventListener('input', apply);
  return apply;
}

/* ------------------------------------------------------------------ *
 * Группировка по тегам: один предмет может попасть в несколько разделов,
 * но храниться в файле данных ровно один раз.
 * ------------------------------------------------------------------ */
function groupByTags(items, categoryOrder) {
  const groups = new Map((categoryOrder || []).map(name => [name, []]));
  items.forEach(item => {
    (item.tags || []).forEach(tag => {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag).push(item);
    });
  });
  return [...groups.entries()].filter(([, list]) => list.length > 0);
}

/* ------------------------------------------------------------------ *
 * Ресурсы «N применений до отдыха».
 * Одна реализация на ячейки заклинаний, слоты обликов, дневные изделия
 * и классовые способности — раньше это был четыре раза переписанный код.
 *
 * Максимум ВСЕГДА берётся из описания (defs), из сохранения читается
 * только остаток: правка character.js видна сразу, без чистки браузера.
 * ------------------------------------------------------------------ */
const Resources = {
  merge(defs, saved) {
    const merged = {};
    Object.keys(defs).forEach(key => {
      const max = Number(defs[key].max) || 0;
      const stored = saved && saved[key];
      const current = stored && Number.isFinite(Number(stored.current)) ? Number(stored.current) : max;
      merged[key] = { max, current: Math.max(0, Math.min(current, max)) };
    });
    return merged;
  },

  restoreAll(state, defs) {
    Object.keys(state).forEach(key => {
      if (!defs[key]) return;
      state[key].max = Number(defs[key].max) || 0;
      state[key].current = state[key].max;
    });
  },

  /* Возвращает true, если значение действительно изменилось. */
  change(state, key, delta) {
    const item = state[key];
    if (!item) return false;
    const next = Math.min(Math.max(0, item.current + delta), item.max);
    if (next === item.current) return false;
    item.current = next;
    return true;
  },

  rowHTML(state, defs, attr) {
    return Object.keys(state).map(key => {
      const item = state[key];
      const def = defs[key];
      const label = def.short || def.name || key;
      return `
        <div class="resource-item ${item.current === 0 ? 'is-empty' : ''}" title="${esc(def.name || label)}">
          <span class="resource-name">${esc(label)}</span>
          <div class="resource-controls">
            <button class="btn-base resource-btn" type="button"
                    ${attr}="${esc(key)}" data-delta="-1"
                    aria-label="Потратить: ${esc(def.name || label)}">−</button>
            <span class="resource-count">${item.current}/${item.max}</span>
            <button class="btn-base resource-btn" type="button"
                    ${attr}="${esc(key)}" data-delta="1"
                    aria-label="Вернуть: ${esc(def.name || label)}">+</button>
          </div>
        </div>
      `;
    }).join('');
  }
};

/* ------------------------------------------------------------------ *
 * Экспорт / импорт персонажа.
 * ------------------------------------------------------------------ */
const Backup = {
  collect() {
    const payload = {
      _format: 'character-save',
      _version: 2,
      character: CHARACTER.id,
      saved: new Date().toISOString(),
      data: {}
    };
    SAVE_KEYS.forEach(key => {
      const raw = Store.raw(key);
      if (raw !== null) payload.data[key] = raw;
    });
    return JSON.stringify(payload, null, 2);
  },

  download(json) {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${CHARACTER.id}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      console.warn('Скачивание недоступно:', e);
      return false;
    }
  },

  restore(json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return { ok: false, error: 'Это не похоже на JSON.' };
    }

    const payload = parsed && parsed.data;
    if (!payload || typeof payload !== 'object') {
      return { ok: false, error: 'В файле нет сохранения.' };
    }
    if (parsed.character && parsed.character !== CHARACTER.id) {
      return { ok: false, error: `Это сохранение другого персонажа (${parsed.character}).` };
    }

    let restored = 0;
    try {
      SAVE_KEYS.forEach(key => {
        if (typeof payload[key] === 'string') {
          Store.setRaw(key, payload[key]);
          restored++;
        }
      });
    } catch (e) {
      return { ok: false, error: 'Браузер не дал записать данные.' };
    }

    if (restored === 0) return { ok: false, error: 'Не нашлось ни одного знакомого раздела.' };
    return { ok: true, restored };
  }
};
