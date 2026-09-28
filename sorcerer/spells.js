/* Заклинания чародея — выборка из общей библиотеки common/spells.js.

   Механика (школа, дистанция, описание) лежит в библиотеке и здесь
   не дублируется. Набор фиксирован, поэтому prepared и locked проставлять
   не нужно — за них отвечает fixedSpells в character.js. */

/* Значки перед названием. Движок показывает один mark, поэтому для
   заклинания с двумя пометками значки и подсказки склеиваются. */
const PSIONIC = { mark: '🧠', markTitle: 'Псионическое заклинание' };
// Школа Прорицания: такое заклинание с ячейкой возвращает «Адепта прорицания».
const DIVINATION = { mark: '👁', markTitle: 'Школа Прорицания' };

const marks = (...list) => ({
  mark: list.map(m => m.mark).join(''),
  markTitle: list.map(m => m.markTitle).join(' · '),
});
const psionic = marks(PSIONIC);
const divination = marks(DIVINATION);

const characterSpells = [
  // Заговоры.
  { name: "Волшебная рука" },
  { name: "Дружба" },
  { name: "Луч холода" },
  { name: "Малая иллюзия" },
  { name: "Расщепление разума", ...psionic },
  { name: "Чародейский выброс" },

  // 1 круг.
  { name: "Диссонирующий шёпот", ...psionic },
  { name: "Руки Хадара", ...psionic },
  { name: "Доспехи мага" },
  { name: "Обнаружение добра и зла", ...divination },
  { name: "Обнаружение магии", ...divination },
  { name: "Щит" },

  // 2 круг.
  { name: "Обнаружение мыслей", ...marks(PSIONIC, DIVINATION) },
  { name: "Умиротворение", ...psionic },
  { name: "Воображаемая сила" },
  { name: "Отражения" },
  { name: "Пронзание разума", ...divination },
  { name: "Смена обличья" },
  { name: "Удержание личности" },

  // 3 круг.
  { name: "Голод Хадара", ...psionic },
  { name: "Послание", ...marks(PSIONIC, DIVINATION) },
  { name: "Контрзаклинание" },
  { name: "Мерцание" },
  { name: "Образ" },
  { name: "Подсматривание", ...divination },
];
