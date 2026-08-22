/* Описание персонажа Стиви.
   Здесь всё, что отличает лист от общего движка: ресурсы, максимум хитов
   и — главное — СПИСОК ВКЛАДОК. Оболочка строит навигацию только из него,
   поэтому страницы другого персонажа сюда попасть не могут. */

const CHARACTER = {
  id: 'stivi',
  name: 'Стиви',
  maxHP: 59,

  // Ячейки заклинаний по кругам.
  slots: {
    1: { name: '1 круг', max: 4 },
    2: { name: '2 круг', max: 3 },
  },

  // Способности с ограниченным числом применений до длительного отдыха.
  features: {
    genius: { name: 'Проблески гениальности', short: 'Проблески', max: 4 },
  },

  // Ключи, которые есть только у этого листа — попадут в экспорт.
  extraSaveKeys: ['schemes', 'daily_creation_state'],

  tabs: [
    { id: 'spells-tab',  file: 'spells_book.html', icon: '⚙',  title: 'Заклинания' },
    { id: 'tools-tab',   file: 'tools.html',       icon: '🛠', title: 'Инструменты' },
    { id: 'schemes-tab', file: 'schemes.html',     icon: '📜', title: 'Схемы' },
    { id: 'stuff-tab',   file: 'stuff.html',       icon: '🎒', title: 'Снаряжение' },
  ],
};
