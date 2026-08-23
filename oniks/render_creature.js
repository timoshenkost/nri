/* Отрисовка статблока существа. Используется и вкладкой «Существа», и
   вкладкой «Облики», поэтому наружу отдаётся только ТЕЛО карточки —
   обёртку <details> с нужным summary каждая страница строит сама. */

function renderStat(name, stat) {
  return `
    <div>
      <div class="stat-name">${esc(name)}</div>
      <div class="stat-value">${esc(stat.value)}</div>
      <div class="stat-mod">${esc(stat.mod)}</div>
      <div class="stat-save">${stat.save ? `спас ${esc(stat.save)}` : '&nbsp;'}</div>
    </div>
  `;
}

function renderCreatureBody(creature) {
  const line = (label, value) => value
    ? `<div><b>${label}:</b> ${esc(value)}</div>`
    : '';

  const block = (title, items) => (items && items.length)
    ? `<div class="section-title">${title}</div>` + items.map(i => `
        <div class="action"><b>${esc(i.name)}.</b> ${esc(i.desc)}</div>
      `).join('')
    : '';

  return `
    <div class="content">
      <div class="top-grid">
        <div><b>КЗ</b> ${esc(creature.ac)}</div>
        <div><b>Инициатива</b> ${esc(creature.initiative)}</div>
        <div><b>Хиты</b> ${esc(creature.hp)}</div>
        <div><b>Скорость</b> ${esc(creature.speed)}</div>
      </div>

      <div class="stats">
        ${renderStat('СИЛ', creature.stats.str)}
        ${renderStat('ЛОВ', creature.stats.dex)}
        ${renderStat('ТЕЛ', creature.stats.con)}
        ${renderStat('ИНТ', creature.stats.int)}
        ${renderStat('МДР', creature.stats.wis)}
        ${renderStat('ХАР', creature.stats.cha)}
      </div>

      <div class="info">
        ${line('Размер', creature.size)}
        ${line('Тип', creature.type)}
        ${line('Чувства', creature.senses)}
        ${line('Навыки', creature.skills)}
        ${line('Сопротивления', creature.resistances)}
        ${line('Иммунитеты', creature.immunities)}
        ${line('Языки', creature.languages)}
        ${line('Опасность', creature.cr)}
      </div>

      ${block('Особенности', creature.traits)}
      ${block('Действия', creature.actions)}
      ${block('Бонусные действия', creature.bonusActions)}
    </div>
  `;
}

/* Строка для поиска: имя плюс всё, что написано в блоках действий. */
function creatureHaystack(creature) {
  const names = list => (list || []).map(i => `${i.name} ${i.desc}`).join(' ');
  return [
    creature.name, creature.size, creature.type, creature.senses, creature.skills,
    creature.resistances, creature.immunities, creature.languages,
    names(creature.traits), names(creature.actions), names(creature.bonusActions)
  ].filter(Boolean).join(' ').toLowerCase();
}
