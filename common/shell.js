/* shell.js — оболочка листа: навигация по вкладкам, хиты, экспорт.
   Вкладки берутся ИСКЛЮЧИТЕЛЬНО из CHARACTER.tabs, поэтому страницы одного
   персонажа не могут появиться у другого: ни кнопки, ни iframe, ни загрузки
   файла. Подключается после character.js и common.js. */

(function buildShell() {
  const DEFAULT_HP = Number(CHARACTER.maxHP) || 1;

  /* --- Разметка --------------------------------------------------- */

  const nav = document.createElement('nav');
  nav.innerHTML = `
    ${CHARACTER.tabs.map(tab => `
      <button class="tab-btn" type="button" data-tab="${esc(tab.id)}"
              title="${esc(tab.title)}" aria-label="${esc(tab.title)}">
        ${esc(tab.icon)}${tab.label ? ` <span class="tab-label">${esc(tab.label)}</span>` : ''}
      </button>
    `).join('')}

    <div class="hp-container">
      <button class="hp-temp" id="hp-temp" type="button" hidden
              title="Временные хиты — тратятся первыми"
              aria-label="Временные хиты">0</button>
      <div class="hp-display-wrapper">
        <button id="hp-current" type="button" title="Ввести урон или лечение числом"
                aria-label="Ввести урон или лечение числом">0</button>
        <span class="hp-divider">/</span>
        <button id="hp-max" type="button" title="Изменить максимум ОЗ"
                aria-label="Изменить максимум хитов">0</button>
      </div>
      <button class="hp-btn heal-btn" id="hp-full" type="button"
              title="Восстановить всё" aria-label="Восстановить все хиты">❤</button>
    </div>

    <button class="data-btn" id="purse-btn" type="button"
            title="Кошелёк" aria-label="Монеты персонажа">💰</button>

    <button class="data-btn" id="backup-btn" type="button"
            title="Сохранение персонажа" aria-label="Экспорт и импорт данных">💾</button>
  `;

  const content = document.createElement('div');
  content.className = 'content-container';
  content.innerHTML = CHARACTER.tabs.map(tab => `
    <iframe id="${esc(tab.id)}" data-src="${esc(tab.file)}" title="${esc(tab.title)}"></iframe>
  `).join('');

  const backup = document.createElement('div');
  backup.id = 'backup-overlay';
  backup.className = 'modal-overlay';
  backup.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="Сохранение персонажа">
      <div class="modal-title">Сохранение · ${esc(CHARACTER.name)}</div>
      <div class="modal-text">Скачайте файл или скопируйте текст — так данные переживут чистку браузера.</div>
      <textarea id="backup-text" class="modal-input" spellcheck="false" aria-label="Данные сохранения"></textarea>
      <div class="modal-buttons">
        <button class="modal-btn btn-confirm" id="backup-download" type="button">Скачать</button>
        <label class="file-label" for="backup-file">Открыть файл…</label>
        <input type="file" id="backup-file" accept=".json,application/json" hidden>
      </div>
      <div class="modal-buttons">
        <button class="modal-btn btn-cancel" id="backup-restore" type="button">Загрузить из поля</button>
        <button class="modal-btn btn-cancel" id="backup-close" type="button">Закрыть</button>
      </div>
    </div>
  `;

  const purse = document.createElement('div');
  purse.id = 'purse-overlay';
  purse.className = 'modal-overlay';
  purse.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="Кошелёк">
      <div class="modal-title">Кошелёк · ${esc(CHARACTER.name)}</div>
      <div class="modal-text" id="purse-total"></div>
      <div class="coin-list" id="coin-list"></div>
      <div class="modal-buttons">
        <button class="modal-btn btn-cancel" id="purse-close" type="button">Закрыть</button>
      </div>
    </div>
  `;

  document.body.append(nav, content, backup, purse);

  /* --- Хиты -------------------------------------------------------- */

  function readNumber(key, fallback) {
    const value = Number(Store.get(key, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  let maxHP = Math.max(1, readNumber('my_max_hp', DEFAULT_HP));
  let currentHP = Math.max(0, Math.min(readNumber('my_hp', maxHP), maxHP));
  /* Временные хиты — отдельный запас: не ограничен максимумом, тратится
     первым, не восстанавливается лечением и пропадает после отдыха. */
  let tempHP = Math.max(0, readNumber('my_temp_hp', 0));

  const hpCurrentEl = document.getElementById('hp-current');
  const hpMaxEl = document.getElementById('hp-max');
  const hpTempEl = document.getElementById('hp-temp');

  function hpLabel() {
    return tempHP > 0 ? `${currentHP} (+${tempHP}) / ${maxHP}` : `${currentHP} / ${maxHP}`;
  }

  function updateHPUI() {
    hpCurrentEl.textContent = currentHP;
    hpMaxEl.textContent = maxHP;
    hpTempEl.textContent = tempHP;
    hpTempEl.hidden = tempHP === 0;

    const share = maxHP > 0 ? currentHP / maxHP : 0;
    hpCurrentEl.style.color =
      share >= 1 ? 'var(--hp-green)' :
      share > 0.5 ? 'var(--text)' :
      share > 0.25 ? 'var(--gold)' :
      'var(--hp-red)';
  }

  function commitHP() {
    Store.set('my_hp', currentHP);
    Store.set('my_max_hp', maxHP);
    Store.set('my_temp_hp', tempHP);
    updateHPUI();
    hpCurrentEl.style.transform = 'scale(1.3)';
    setTimeout(() => { hpCurrentEl.style.transform = 'scale(1)'; }, 100);
  }

  /* Урон сначала съедает временные хиты. Уведомлений нет: результат виден
     в самой шапке. */
  function applyDamage(amount) {
    const absorbed = Math.min(tempHP, amount);
    tempHP -= absorbed;
    currentHP = Math.max(0, currentHP - (amount - absorbed));
    commitHP();
  }

  /* Лечение временные хиты не восстанавливает — так по правилам. */
  function applyHeal(amount) {
    currentHP = Math.min(currentHP + amount, maxHP);
    commitHP();
  }

  function setTempHP(value, { keepHigher = false } = {}) {
    const parsed = Math.max(0, parseInt(value, 10) || 0);

    // Временные хиты не складываются: остаётся тот запас, что больше.
    if (keepHigher && parsed <= tempHP) {
      // Единственный случай, когда без подсказки непонятно: с виду ничего
      // не произошло, хотя кнопку нажали.
      if (parsed > 0) showNotice(`Прежний запас больше — оставлено ${tempHP}`);
      return;
    }

    tempHP = parsed;
    commitHP();
  }

  function restoreHP() {
    currentHP = maxHP;
    commitHP();
  }

  /* Отдых, в отличие от кнопки «восстановить всё», сбрасывает и запас. */
  function longRestHP() {
    currentHP = maxHP;
    tempHP = 0;
    commitHP();
  }

  function fromInput(raw) {
    const amount = Math.abs(parseInt(raw, 10));
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  document.getElementById('hp-full').addEventListener('click', restoreHP);

  hpCurrentEl.addEventListener('click', () => {
    Modal.prompt({
      title: 'Урон или лечение',
      text: `Сейчас ${hpLabel()}`,
      value: '',
      actions: [
        { label: 'Урон', className: 'btn-confirm', onClick: v => { const n = fromInput(v); if (n) applyDamage(n); } },
        { label: 'Лечение', className: 'btn-cancel', onClick: v => { const n = fromInput(v); if (n) applyHeal(n); } },
        { label: 'Временные', className: 'btn-cancel', onClick: v => { const n = fromInput(v); if (n) setTempHP(n, { keepHigher: true }); } }
      ]
    });
  });

  hpTempEl.addEventListener('click', () => {
    Modal.prompt({
      title: 'Временные хиты',
      text: 'Точное значение запаса. 0 — снять.',
      value: tempHP,
      onConfirm: value => setTempHP(value)
    });
  });

  hpMaxEl.addEventListener('click', () => {
    Modal.prompt({
      title: 'Максимальные ОЗ',
      value: maxHP,
      onConfirm: value => {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) return;
        maxHP = Math.max(1, parsed);
        if (currentHP > maxHP) currentHP = maxHP;
        commitHP();
      }
    });
  });

  /* Длительный отдых может запустить любая вкладка. Оболочка —
     единственное место, которое видит их все, поэтому она восстанавливает
     хиты и рассылает команду остальным: ячейки, заряды облика и прочие
     ресурсы каждая вкладка возвращает себе сама.

     Ответ идёт другим типом сообщения, иначе вкладка-инициатор получила бы
     своё же событие обратно и запустила бы бесконечный круг. */
  window.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'long-rest') return;

    // Метка нужна закрытым вкладкам: они доберут отдых при открытии.
    LongRest.mark();
    longRestHP();
    content.querySelectorAll('iframe').forEach(frame => {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'long-rest-apply' }, '*');
      }
    });
  });

  /* --- Кошелёк ------------------------------------------------------
     Все монеты лежат в одном ключе money. Курс из книги правил:
     1 пм = 10 зм = 100 см = 1000 мм, поэтому итог считается в медяках и
     переводится в золото только для показа — иначе горсть меди пропала бы
     при округлении. */

  const COINS = [
    { key: 'pp', short: 'ПМ', name: 'Платиновые', rate: 1000 },
    { key: 'gp', short: 'ЗМ', name: 'Золотые',    rate: 100 },
    { key: 'sp', short: 'СМ', name: 'Серебряные', rate: 10 },
    { key: 'cp', short: 'ММ', name: 'Медные',     rate: 1 }
  ];

  const savedMoney = Store.get('money', {});
  const money = {};
  COINS.forEach(coin => {
    const value = Math.floor(Number(savedMoney && savedMoney[coin.key]));
    money[coin.key] = Number.isFinite(value) && value > 0 ? value : 0;
  });

  const purseTotalEl = document.getElementById('purse-total');
  const coinListEl = document.getElementById('coin-list');

  function totalLabel() {
    const copper = COINS.reduce((sum, coin) => sum + money[coin.key] * coin.rate, 0);
    const gold = Math.floor(copper / 100);
    const rest = copper % 100;
    return rest === 0 ? `${gold} зм` : `${gold},${String(rest).padStart(2, '0')} зм`;
  }

  function updateMoneyUI() {
    purseTotalEl.innerHTML = `Всего: <b>${esc(totalLabel())}</b>`;
    coinListEl.innerHTML = COINS.map(coin => `
      <div class="coin-row ${money[coin.key] === 0 ? 'is-empty' : ''}">
        <span class="coin-name">
          <b class="coin-mark coin-${esc(coin.key)}">${esc(coin.short)}</b>${esc(coin.name)}
        </span>
        <span class="coin-controls">
          <button class="btn-base resource-btn" type="button"
                  data-coin="${esc(coin.key)}" data-delta="-1"
                  aria-label="Убрать одну: ${esc(coin.name)}">−</button>
          <button class="coin-count" type="button" data-coin-edit="${esc(coin.key)}"
                  title="Ввести число"
                  aria-label="Изменить числом: ${esc(coin.name)}">${money[coin.key]}</button>
          <button class="btn-base resource-btn" type="button"
                  data-coin="${esc(coin.key)}" data-delta="1"
                  aria-label="Добавить одну: ${esc(coin.name)}">+</button>
        </span>
      </div>
    `).join('');
  }

  function commitMoney() {
    Store.set('money', money);
    updateMoneyUI();
  }

  function changeMoney(key, delta) {
    const next = money[key] + delta;
    // В минус кошелёк не уходит: это скорее опечатка, чем долг.
    if (next < 0) return;
    money[key] = next;
    commitMoney();
  }

  /* Ввод числом устроен как у хитов: одно окно умеет и добавить, и
     потратить, и выставить точное значение. */
  function promptCoin(key) {
    const coin = COINS.find(c => c.key === key);
    Modal.prompt({
      title: `${coin.name} монеты`,
      text: `Сейчас ${money[key]} ${coin.short}`,
      value: '',
      actions: [
        { label: 'Добавить', className: 'btn-confirm', onClick: v => {
            const n = fromInput(v);
            if (n) changeMoney(key, n);
          } },
        { label: 'Потратить', className: 'btn-cancel', onClick: v => {
            const n = fromInput(v);
            if (!n) return;
            if (n > money[key]) {
              showNotice(`Не хватает: в кошельке ${money[key]} ${coin.short}`);
              return;
            }
            changeMoney(key, -n);
          } },
        { label: 'Задать', className: 'btn-cancel', onClick: v => {
            const parsed = parseInt(v, 10);
            if (!Number.isFinite(parsed)) return;
            money[key] = Math.max(0, parsed);
            commitMoney();
          } }
      ]
    });
  }

  function closePurse() { purse.classList.remove('is-open'); }

  document.getElementById('purse-btn').addEventListener('click', () => {
    purse.classList.add('is-open');
  });

  document.getElementById('purse-close').addEventListener('click', closePurse);

  purse.addEventListener('click', e => {
    if (e.target === purse) { closePurse(); return; }

    const step = e.target.closest('[data-coin]');
    if (step) { changeMoney(step.dataset.coin, Number(step.dataset.delta)); return; }

    const edit = e.target.closest('[data-coin-edit]');
    if (edit) promptCoin(edit.dataset.coinEdit);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !purse.classList.contains('is-open')) return;
    // Поверх кошелька может стоять окно ввода — тогда Escape закрывает его.
    const input = document.getElementById('modal-overlay');
    if (input && input.classList.contains('is-open')) return;
    closePurse();
  });

  updateMoneyUI();

  /* --- Вкладки ----------------------------------------------------- */

  function openTab(tabId) {
    const frame = document.getElementById(tabId);
    if (!frame) return;

    // src подставляется при первом открытии: незачем грузить все страницы сразу.
    if (!frame.src && frame.dataset.src) frame.src = frame.dataset.src;

    content.querySelectorAll('iframe').forEach(f => f.classList.toggle('active', f === frame));
    nav.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));

    Store.set('active_tab', tabId);
  }

  nav.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => openTab(btn.dataset.tab));
  });

  /* --- Экспорт / импорт -------------------------------------------- */

  const backupText = document.getElementById('backup-text');

  function closeBackup() { backup.classList.remove('is-open'); }

  document.getElementById('backup-btn').addEventListener('click', () => {
    backupText.value = Backup.collect();
    backup.classList.add('is-open');
  });

  document.getElementById('backup-close').addEventListener('click', closeBackup);
  backup.addEventListener('click', e => { if (e.target === backup) closeBackup(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && backup.classList.contains('is-open')) closeBackup();
  });

  document.getElementById('backup-download').addEventListener('click', () => {
    if (Backup.download(backupText.value)) {
      showNotice('Файл сохранён');
    } else {
      showNotice('Скачивание недоступно — скопируйте текст вручную');
      backupText.select();
    }
  });

  document.getElementById('backup-restore').addEventListener('click', () => {
    Modal.confirm({
      title: 'Заменить данные?',
      text: `Текущий прогресс «${CHARACTER.name}» будет перезаписан содержимым поля.`,
      confirmText: 'Заменить',
      onConfirm: () => {
        const result = Backup.restore(backupText.value);
        if (!result.ok) { showNotice(`Не удалось загрузить: ${result.error}`); return; }
        closeBackup();
        showNotice('Данные загружены, обновляю…');
        setTimeout(() => location.reload(), 700);
      }
    });
  });

  document.getElementById('backup-file').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      backupText.value = String(reader.result);
      showNotice('Файл прочитан — нажмите «Загрузить из поля»');
    };
    reader.onerror = () => showNotice('Не удалось прочитать файл');
    reader.readAsText(file);
    e.target.value = '';
  });

  /* --- Высота оболочки ----------------------------------------------
     Оболочка не скроллится сама, поэтому её высота обязана точно совпадать
     с видимой областью экрана: лишние пиксели уезжают под панель браузера,
     а добраться до них нечем. Именно так низ вкладки пропадал в Chrome на
     Андроиде — 100dvh там оказывался больше, чем видно на самом деле.
     visualViewport знает настоящую высоту, innerHeight — запасной путь. */

  let shellWidth = window.innerWidth;
  let shellHeight = 0;

  function viewportHeight() {
    const vv = window.visualViewport;
    // При щипковом зуме видно меньше страницы, но сама страница не меньше.
    const zoomed = vv && Math.abs(vv.scale - 1) > 0.01;
    return Math.round(vv && !zoomed ? vv.height : window.innerHeight);
  }

  function fitToViewport() {
    const width = window.innerWidth;
    const height = viewportHeight();
    // Высота резко просела, а ширина та же — это выехавшая клавиатура.
    // Сжимать под неё оболочку не нужно: поле ввода живёт внутри вкладки.
    const keyboard = width === shellWidth && shellHeight && height < shellHeight * 0.75;
    shellWidth = width;
    if (keyboard) return;
    shellHeight = height;
    document.body.style.height = height + 'px';
  }

  fitToViewport();
  window.addEventListener('resize', fitToViewport);
  // Поворот экрана: размеры доезжают не сразу, поэтому с задержкой.
  window.addEventListener('orientationchange', () => setTimeout(fitToViewport, 200));

  /* --- Старт ------------------------------------------------------- */

  const moved = migrateLegacyKeys();
  if (moved) {
    // Перенос мог подхватить данные другого листа, если раньше оба жили на
    // одном origin с общими ключами — просим проверить.
    setTimeout(() => showNotice('Перенесены данные старой версии — проверьте хиты'), 400);
  }

  // Значения могли приехать миграцией уже после первого чтения.
  maxHP = Math.max(1, readNumber('my_max_hp', DEFAULT_HP));
  currentHP = Math.max(0, Math.min(readNumber('my_hp', maxHP), maxHP));
  tempHP = Math.max(0, readNumber('my_temp_hp', 0));

  updateHPUI();

  const savedTab = Store.get('active_tab', CHARACTER.tabs[0].id);
  openTab(document.getElementById(savedTab) ? savedTab : CHARACTER.tabs[0].id);
})();
