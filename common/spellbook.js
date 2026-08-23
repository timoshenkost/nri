/* spellbook.js — движок книги заклинаний, общий для всех листов.
   Страница отдаёт данные (initialSpells), персонаж — ячейки и способности
   (CHARACTER.slots, CHARACTER.features). Всё поведение здесь.

   Поля заклинания, которые движок понимает:
     name, levelNum, school, time, range, components, duration,
     description, roleplay
     prepared        — подготовлено
     locked          — «всегда подготовлено», убрать нельзя
     isFree          — один бесплатный каст до длительного отдыха
     isConcentration — метка К
     isRitual        — метка Р
     mark            — произвольный значок перед названием (например 🌙)
     markTitle       — подсказка к значку
*/

const Spellbook = (() => {
  const STORAGE_KEY = 'spellbook_data';

  const slotDefs = CHARACTER.slots || {};
  const featureDefs = CHARACTER.features || {};

  /* Заклинание собирается из двух половин: механика из общей библиотеки
     (common/spells.js) и принадлежность персонажу из его выборки. Имя —
     ключ связи, поэтому опечатку важно заметить сразу, а не гадать, куда
     пропало заклинание. */
  const libraryByName = new Map(spellLibrary.map(s => [s.name, s]));
  const personal = new Map(characterSpells.map(s => [s.name, s]));

  const missing = [...personal.keys()].filter(name => !libraryByName.has(name));
  if (missing.length) {
    console.warn('Нет в библиотеке заклинаний:', missing);
  }

  /* Книга собирается из двух источников:
       1) весь список класса персонажа — подтягивается сам, ничего
          перечислять не надо;
       2) то, что записано лично: подготовленность, отыгрыш, бесплатные
          касты, а также заклинания не из класса — от черт или вида.
     Личная запись всегда сильнее, поэтому prepared и roleplay побеждают
     значения из библиотеки. */
  const ownClasses = CHARACTER.spellClasses || [];

  /* fixedCantrips — заговоры выбраны при создании персонажа и не меняются.
     Тогда список класса их не подтягивает: иначе в общем списке висели бы
     заговоры, которые персонаж не знает и выучить не может. */
  const fixedCantrips = !!CHARACTER.fixedCantrips;

  const fromClass = spellLibrary
    .filter(s => (s.classes || []).some(c => ownClasses.includes(c)))
    .filter(s => !(fixedCantrips && s.levelNum === 0))
    .map(s => s.name);

  const names = new Set(
    [...fromClass, ...personal.keys()].filter(name => libraryByName.has(name))
  );

  /* Персонаж может быть ограничен по кругу: у Артефактора половина уровня,
     и высокие круги из списка класса только мешают искать. Отсекаем их,
     но о личных записях, попавших под нож, предупреждаем — молча терять
     выписанное вручную нельзя. */
  const maxLevel = Number.isFinite(CHARACTER.maxSpellLevel)
    ? CHARACTER.maxSpellLevel
    : Infinity;

  const cutPersonal = [];
  const spells = [...names]
    .map(name => ({ ...libraryByName.get(name), ...(personal.get(name) || {}) }))
    .filter(spell => {
      if (spell.levelNum <= maxLevel) return true;
      if (personal.has(spell.name)) cutPersonal.push(spell.name);
      return false;
    });

  if (cutPersonal.length) {
    console.warn(`Скрыты как выше ${maxLevel} круга:`, cutPersonal);
  }

  let slots = Resources.merge(slotDefs, null);
  let features = Resources.merge(featureDefs, null);

  let preparedList, availableList, applyFilter = () => {};

  /* --- Загрузка --------------------------------------------------- */

  (function loadSaved() {
    const saved = Store.get(STORAGE_KEY, null);
    if (!saved) return;

    if (Array.isArray(saved.spells)) {
      saved.spells.forEach(savedSpell => {
        const original = spells.find(s => s.name === savedSpell.name);
        if (!original) return;

        /* Для locked-заклинаний подготовленность — свойство персонажа, а не
           состояние игрока: она всегда берётся из spells.js. Иначе старое
           сохранение перебило бы правку файла, а кнопки «+» у такого
           заклинания нет, и починить это из интерфейса было бы нельзя. */
        if (!original.locked) original.prepared = !!savedSpell.prepared;
        original.freeUsed = !!savedSpell.freeUsed;
      });
    }

    slots = Resources.merge(slotDefs, saved.spellSlots);
    features = Resources.merge(featureDefs, saved.features);
  })();

  function save() {
    Store.set(STORAGE_KEY, { spells, spellSlots: slots, features });
  }

  /* --- Действия ---------------------------------------------------- */

  function castSpell(index) {
    const spell = spells[index];
    if (!spell) return;

    if (spell.isFree && !spell.freeUsed) {
      spell.freeUsed = true;
      showNotice(`Использовано бесплатно: ${spell.name}`);
      render();
      return;
    }

    const lvl = spell.levelNum;
    if (slots[lvl] && slots[lvl].current > 0) {
      slots[lvl].current--;
      showNotice(`Сотворено: ${spell.name}`);
      render();
    } else {
      showNotice(`Нет ячеек ${lvl} круга!`);
    }
  }

  /* Восстановление своих ресурсов. Вызывается по команде от оболочки,
     чтобы отдых на любой вкладке отработал одинаково. */
  function applyLongRest() {
    Resources.restoreAll(slots, slotDefs);
    Resources.restoreAll(features, featureDefs);
    spells.forEach(s => { if (s.isFree) s.freeUsed = false; });
    render();
  }

  /* Кнопка отдыха только сообщает оболочке — та вернёт хиты и разошлёт
     команду всем вкладкам, включая эту. Вне iframe оболочки нет, поэтому
     отрабатываем сами. */
  function requestLongRest() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'long-rest' }, '*');
    } else {
      applyLongRest();
    }
  }

  function togglePrepared(index) {
    const spell = spells[index];
    if (!spell || spell.locked) return;
    if (fixedCantrips && spell.levelNum === 0) return;
    spell.prepared = !spell.prepared;
    render();
  }

  /* --- Отрисовка --------------------------------------------------- */

  function spellCardHTML(spell, index) {
    const isFreeReady = spell.isFree && !spell.freeUsed;
    const hasSlot = slots[spell.levelNum] && slots[spell.levelNum].current > 0;
    const castable = isFreeReady || hasSlot;

    const castBtn = (spell.levelNum > 0 && spell.prepared)
      ? `<button class="btn-base btn-accent cast-btn ${isFreeReady ? 'is-free' : ''}" type="button"
                 data-cast="${index}" ${castable ? '' : 'disabled'}>
           ${isFreeReady ? 'Бесплатно' : 'Сотворить'}
         </button>`
      : '';

    // Заперто явно — или это заговор у персонажа с фиксированным набором.
    const unchangeable = spell.locked || (fixedCantrips && spell.levelNum === 0);

    const moveBtn = unchangeable
      ? ''
      : `<button class="btn-base move-btn" type="button" data-toggle="${index}"
                 aria-label="${spell.prepared ? 'Убрать из подготовленных' : 'Подготовить'}">
           ${spell.prepared ? '−' : '+'}
         </button>`;

    /* Значки слева от названия — то, что важно заметить с одного взгляда.
       isMoon — исторический флаг Круга Луны из книги друида; поддержан
       наравне с общим mark, чтобы не переписывать данные. */
    const markIcon = spell.mark || (spell.isMoon ? '🌙' : '');
    const markHint = spell.markTitle || (spell.isMoon ? 'Круг Луны' : '');
    const mark = markIcon
      ? `<span class="spell-mark" title="${esc(markHint)}">${esc(markIcon)}</span>`
      : '';

    /* Бесплатный каст: полная звезда — есть, пустая — потрачен до отдыха. */
    const freeMark = spell.isFree
      ? `<span class="spell-free ${spell.freeUsed ? 'is-used' : ''}"
               title="${spell.freeUsed ? 'Бесплатный каст потрачен' : 'Бесплатный каст до длительного отдыха'}"
         >${spell.freeUsed ? '☆' : '★'}</span>`
      : '';

    /* Концентрация и ритуал — справочная мелочь, поэтому приглушены. */
    const badges = [
      spell.isConcentration ? '<span class="badge badge-concentration" title="Требуется концентрация">К</span>' : '',
      spell.isRitual ? '<span class="badge badge-ritual" title="Можно наложить как ритуал">Р</span>' : ''
    ].join('');

    /* Классы в карточке не показываем — за столом они не нужны, а место
       занимают. В строку поиска они попадают: набрать «друид» и увидеть,
       что вообще доступно классу, по-прежнему можно. */
    const classes = (spell.classes || []).join(', ');

    const haystack = [
      spell.name, spell.school, spell.description, spell.roleplay,
      spell.components, spell.duration, spell.range, spell.time, classes
    ].join(' ').toLowerCase();

    return `
      <details data-key="${esc(spell.name)}" data-search="${esc(haystack)}">
        <summary>
          <span class="spell-title">${freeMark}${mark}<span class="spell-name">${esc(spell.name)}</span>${badges}</span>
          <span class="action-group">${castBtn}${moveBtn}</span>
        </summary>
        <div class="block">
          <div class="spell-meta">
            <div><span class="label">Школа</span>${esc(spell.school)}</div>
            <div><span class="label">Время</span>${esc(spell.time)}</div>
            <div><span class="label">Дистанция</span>${esc(spell.range)}</div>
            <div><span class="label">Компоненты</span>${esc(spell.components)}</div>
            <div><span class="label">Длительность</span>${esc(spell.duration)}</div>
          </div>
          <p style="white-space: pre-line;">${esc(spell.description)}</p>
          ${spell.roleplay ? `<p class="spell-roleplay">${esc(spell.roleplay)}</p>` : ''}
        </div>
      </details>
    `;
  }

  function renderSection(container, items) {
    if (items.length === 0) { container.innerHTML = ''; return; }

    // Копия перед сортировкой; группируем по кругам.
    const sorted = [...items].sort((a, b) =>
      a.spell.levelNum - b.spell.levelNum || a.spell.name.localeCompare(b.spell.name));

    const groups = [];
    sorted.forEach(item => {
      const level = item.spell.levelNum;
      if (!groups.length || groups[groups.length - 1].level !== level) {
        groups.push({ level, items: [] });
      }
      groups[groups.length - 1].items.push(item);
    });

    container.innerHTML = groups.map(group => `
      <div class="group">
        <div class="section-header level-header">${group.level === 0 ? 'Заговоры' : `${group.level} Круг`}</div>
        ${group.items.map(item => spellCardHTML(item.spell, item.index)).join('')}
      </div>
    `).join('');
  }

  function renderResources() {
    document.getElementById('slots-grid').innerHTML =
      Resources.rowHTML(slots, slotDefs, 'data-slot');

    const block = document.getElementById('features-block');
    const hasFeatures = Object.keys(features).length > 0;
    block.hidden = !hasFeatures;
    if (hasFeatures) {
      document.getElementById('features-grid').innerHTML =
        Resources.rowHTML(features, featureDefs, 'data-feature');
    }
  }

  function render() {
    save();
    rerender([preparedList, availableList], () => {
      const indexed = spells.map((spell, index) => ({ spell, index }));
      renderSection(preparedList, indexed.filter(x => x.spell.prepared));
      renderSection(availableList, indexed.filter(x => !x.spell.prepared));
      renderResources();
    });
    applyFilter();
  }

  /* --- События ----------------------------------------------------- */

  function bind() {
    document.addEventListener('click', e => {
      const slotBtn = e.target.closest('[data-slot]');
      if (slotBtn) {
        if (Resources.change(slots, slotBtn.dataset.slot, Number(slotBtn.dataset.delta))) render();
        return;
      }

      const featureBtn = e.target.closest('[data-feature]');
      if (featureBtn) {
        const key = featureBtn.dataset.feature;
        const delta = Number(featureBtn.dataset.delta);
        if (Resources.change(features, key, delta)) {
          if (delta < 0) showNotice(`${featureDefs[key].name}: осталось ${features[key].current}`);
          render();
        } else if (delta < 0) {
          showNotice(`${featureDefs[key].name}: применений не осталось`);
        }
        return;
      }

      const castBtn = e.target.closest('[data-cast]');
      if (castBtn) {
        e.preventDefault();
        e.stopPropagation();
        castSpell(Number(castBtn.dataset.cast));
        return;
      }

      const toggleBtn = e.target.closest('[data-toggle]');
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        togglePrepared(Number(toggleBtn.dataset.toggle));
      }
    });

    document.getElementById('rest-btn').addEventListener('click', () => {
      Modal.confirm({
        title: 'Длительный отдых?',
        text: 'Ячейки, способности и хиты восстановятся. Временные хиты пропадут.',
        confirmText: 'Отдохнуть',
        onConfirm: () => {
          requestLongRest();
          showNotice('Силы восстановлены!');
        }
      });
    });

    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'long-rest-apply') applyLongRest();
    });
  }

  /* --- Запуск ------------------------------------------------------ */

  function init() {
    preparedList = document.getElementById('prepared-list');
    availableList = document.getElementById('available-list');
    bind();
    render();
    applyFilter = initSearch(document.getElementById('search'), document.querySelector('main'));
  }

  return { init };
})();
