// ===== trainer-stats.js — статистика тренировки узла: счётчики + БД =====
// Накопительная статистика ответов по каждому узлу тренажёра:
//   всего рук (total), верных ответов (correct), ошибок (wrong),
//   история рук (hands): { cards, action, correct } — нарастающим итогом,
//   новые сверху. Всего рук = correct + wrong: прерванные раздачи
//   (не нажат ответ) не считаются.
// История рук ограничена скользящим окном MAX_HANDS последних раздач —
//   иначе база разрастается тысячами записей (каждый ответ ≈ 100 байт,
//   а весь объект статистики пишется целиком при каждом флоше и читается
//   целиком при старте). Счётчики total/correct/wrong НЕ ограничены и
//   хранят итоги за всю жизнь узла.
// Ячейная статистика cells: 13×13 пар [верно, неверно] — агрегат ответов
//   по каждой руке для будущей тепловой карты диапазона. Окном истории
//   НЕ ограничивается и копится всегда (обрезке не подлежит).
// Хранение — отдельным ключом poker_range_trainer_stats одним объектом
//   { [nodeId]: { total, correct, wrong, hands, updatedAt } } — паттерн
// btn_styles_all (style-manager.js): статистика не должна перетирать список
// узлов (poker_range_trainer_nodes). Пустой объект — удаление ключа.
//
// ВАЖНО (ТЗ): во время тренировки ответы накапливаются ТОЛЬКО в памяти,
// в БД статистика пишется ОДНИМ запросом по кнопке «Закончить тренировку»
// (flushStats). Быстрые ответы не порождают запрос на каждый клик.
// Гостю статистика не сохраняется на сервер (как и в gto-loader.js: иначе
// App.storage.save показывал бы «требуется авторизация» на каждом ответе) —
// счётчики живут в памяти сессии.
// Удаление узла тренажёра вычищает его статистику (см. clearNodeStats).

import { SUIT_SYMBOL, SUIT_CLASS } from './trainer-cards.js';

const STORAGE_KEY = 'poker_range_trainer_stats';

// Размер скользящего окна истории рук: хранятся последние MAX_HANDS
// раздач на узел (новые вытесняют старые). Счётчики не ограничены.
const MAX_HANDS = 100;

// Пустая ячейная сетка: 13×13 пар [верно, неверно].
function emptyCells() {
    const grid = [];
    for (let r = 0; r < 13; r++) {
        const row = [];
        for (let c = 0; c < 13; c++) row.push([0, 0]);
        grid.push(row);
    }
    return grid;
}

// Состояние вне DOM: { [nodeId]: { total, correct, wrong, updatedAt } }
let statsByNodeId = {};
// Узлы с несохранёнными ответами (пишутся по «Закончить тренировку»).
let dirtyNodeIds = new Set();

function normalizeHand(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.cards) || raw.cards.length !== 2) return null;
    return {
        cards: raw.cards.map(function(c) {
            return { rank: String((c && c.rank) || ''), suit: String((c && c.suit) || '') };
        }),
        action: String(raw.action || ''),
        correct: !!raw.correct
    };
}

// Нормализация ячейной сетки: 13×13 пар [верно, неверно] (неотрицательные
// целые). null — поля нет (запись статистики до появления ячейных данных).
function normalizeCells(rawCells) {
    if (!Array.isArray(rawCells)) return null;
    const grid = emptyCells();
    for (let r = 0; r < 13; r++) {
        if (!Array.isArray(rawCells[r])) continue;
        for (let c = 0; c < 13; c++) {
            const slot = rawCells[r][c];
            if (Array.isArray(slot)) {
                grid[r][c] = [
                    Math.max(0, Math.floor(Number(slot[0])) || 0),
                    Math.max(0, Math.floor(Number(slot[1])) || 0)
                ];
            }
        }
    }
    return grid;
}

function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        total: Number(raw.total) || 0,
        correct: Number(raw.correct) || 0,
        wrong: Number(raw.wrong) || 0,
        cells: normalizeCells(raw.cells) || emptyCells(),
        // Обрезка до окна: руки лежат новые сверху, остаются последние
        // MAX_HANDS. Лечит старые раздутые записи из БД при загрузке;
        // в БД урезанная версия запишется при следующем обычном
        // сохранении (без записей «просто так»).
        hands: Array.isArray(raw.hands) ? raw.hands.map(normalizeHand).filter(Boolean).slice(0, MAX_HANDS) : [],
        updatedAt: Number(raw.updatedAt) || 0
    };
}

function isPersistable() {
    return !!(App.auth && App.auth.isLoggedIn());
}

// ===== ЗАГРУЗКА / СОХРАНЕНИЕ =====

export function loadTrainerStats() {
    return App.storage.preload([STORAGE_KEY]).then(function() {
        const data = App.storage.load(STORAGE_KEY);
        const result = {};
        if (data && typeof data === 'object') {
            Object.keys(data).forEach(function(nodeId) {
                const entry = normalizeEntry(data[nodeId]);
                if (entry) result[nodeId] = entry;
            });
        }
        statsByNodeId = result;
        return statsByNodeId;
    }).catch(function(error) {
        console.warn('⚠️ trainer-stats: не удалось загрузить статистику:', error);
        return statsByNodeId;
    });
}

function persistStats() {
    // Один запрос пишет ВСЮ карту статистики — все накопленные узлы сразу.
    if (!isPersistable()) return Promise.resolve();
    dirtyNodeIds.clear();
    const ids = Object.keys(statsByNodeId);
    if (ids.length === 0) {
        return App.storage.remove(STORAGE_KEY);
    }
    return App.storage.save(STORAGE_KEY, statsByNodeId);
}

// Запись накопленной статистики в БД — по кнопке «Закончить тренировку».
// За время тренировки запросов в БД НЕТ; уходит ровно один здесь.
export function flushStats() {
    if (dirtyNodeIds.size === 0) return false;
    persistStats();
    return true;
}

// ===== СЧЁТЧИКИ =====

// Статистика узла (копия — снаружи состояние не мутируется).
export function getStats(nodeId) {
    const entry = nodeId ? statsByNodeId[nodeId] : null;
    return entry
        ? { total: entry.total, correct: entry.correct, wrong: entry.wrong }
        : { total: 0, correct: 0, wrong: 0 };
}

// История рук узла (копия массива, новые сверху).
export function getHands(nodeId) {
    const entry = nodeId ? statsByNodeId[nodeId] : null;
    return entry && Array.isArray(entry.hands) ? entry.hands.slice() : [];
}

// Ячейная статистика узла: 13×13 пар [верно, неверно] — для тепловой карты.
// Копия — снаружи состояние не мутируется. Пустая сетка — если данных нет.
export function getCells(nodeId) {
    const entry = nodeId ? statsByNodeId[nodeId] : null;
    const src = entry && entry.cells ? entry.cells : null;
    const grid = emptyCells();
    if (!src) return grid;
    for (let r = 0; r < 13; r++) {
        for (let c = 0; c < 13; c++) {
            grid[r][c] = [src[r][c][0] || 0, src[r][c][1] || 0];
        }
    }
    return grid;
}

// Учесть один отвеченный разбор: correct — верный ответ был или нет.
// hand — данные раздачи для истории: { cards: [{rank,suit},…], action }.
// cell — { row, col } ячейки руки в матрице — для ячейной статистики
// (будущая тепловая карта): инкремент [верно, неверно] в cells.
// ТОЛЬКО память (см. шапку файла): запись в БД — по кнопке
// «Закончить тренировку» (flushStats), не на каждый ответ.
export function recordAnswer(nodeId, correct, hand, cell) {
    if (!nodeId) return getStats(nodeId);
    let entry = statsByNodeId[nodeId];
    if (!entry) {
        entry = { total: 0, correct: 0, wrong: 0, hands: [], cells: emptyCells(), updatedAt: 0 };
        statsByNodeId[nodeId] = entry;
    }
    if (!Array.isArray(entry.hands)) entry.hands = [];
    if (!entry.cells) entry.cells = emptyCells();
    entry.total += 1;
    if (correct) entry.correct += 1;
    else entry.wrong += 1;
    // Ячейная статистика (тепловая карта): окном истории не ограничивается.
    if (cell && Number.isInteger(cell.row) && Number.isInteger(cell.col) &&
        cell.row >= 0 && cell.row < 13 && cell.col >= 0 && cell.col < 13) {
        const slot = entry.cells[cell.row][cell.col];
        if (correct) slot[0] += 1;
        else slot[1] += 1;
    }
    // История рук: нарастающим итогом, новая рука — сверху списка.
    const normalized = normalizeHand({
        cards: hand && hand.cards,
        action: hand && hand.action,
        correct: correct
    });
    if (normalized) {
        entry.hands.unshift(normalized);
        // Скользящее окно: старые руки вытесняются новыми. Счётчики выше
        // от этого не страдают — они накопительные за всю жизнь узла.
        if (entry.hands.length > MAX_HANDS) entry.hands.length = MAX_HANDS;
    }
    entry.updatedAt = Date.now();
    dirtyNodeIds.add(nodeId);
    return { total: entry.total, correct: entry.correct, wrong: entry.wrong };
}

// Сброс статистики узла (пункт меню «Сбросить статистику», удаление узла).
// Явное действие пользователя — пишется в БД сразу (запросов мало).
export function resetStats(nodeId) {
    if (!nodeId || !statsByNodeId[nodeId]) return false;
    delete statsByNodeId[nodeId];
    dirtyNodeIds.delete(nodeId);
    persistStats();
    return true;
}

// Узел удалён из тренажёра — его статистика больше не нужна.
// (Вызывается из trainer-api.removeRange вместе с удалением узла.)

// Сбросить всё (смена аккаунта: состояние предыдущего пользователя не утекает).
export function resetAllStats() {
    statsByNodeId = {};
    dirtyNodeIds.clear();
}

// ===== РЕНДЕР БЛОКА СТАТИСТИКИ (справа от стола) =====
// Сверху вниз: всего рук → верных ответов → ошибок → шкала % верных ответов.
export function renderStats(container, nodeId) {
    if (!container) return;
    container.innerHTML = '';

    const stats = getStats(nodeId);
    const accuracy = stats.total > 0 ? (stats.correct / stats.total * 100) : 0;

    const rows = [
        { label: App.i18n.t('trainer.statsTotal'), value: stats.total, cls: 'total' },
        { label: App.i18n.t('trainer.statsCorrect'), value: stats.correct, cls: 'correct' },
        { label: App.i18n.t('trainer.statsWrong'), value: stats.wrong, cls: 'wrong' }
    ];
    rows.forEach(function(row) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'trainer-stats-row trainer-stats-row--' + row.cls;

        const labelSpan = document.createElement('span');
        labelSpan.className = 'trainer-stats-label';
        labelSpan.textContent = row.label;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'trainer-stats-value';
        valueSpan.textContent = row.value;

        rowDiv.appendChild(labelSpan);
        rowDiv.appendChild(valueSpan);
        container.appendChild(rowDiv);
    });

    // Шкала % верных ответов: цифра % по центру + прогресс-бар 0..100%.
    const scaleDiv = document.createElement('div');
    scaleDiv.className = 'trainer-stats-scale';

    const scaleLabel = document.createElement('div');
    scaleLabel.className = 'trainer-stats-scale-label';
    scaleLabel.textContent = accuracy.toFixed(1) + '%';

    const barTrack = document.createElement('div');
    barTrack.className = 'trainer-stats-scale-track';
    const barFill = document.createElement('div');
    barFill.className = 'trainer-stats-scale-fill';
    barFill.style.width = accuracy + '%';
    barTrack.appendChild(barFill);

    scaleDiv.appendChild(scaleLabel);
    scaleDiv.appendChild(barTrack);
    container.appendChild(scaleDiv);
}

// ===== ВТОРАЯ ПОЛОВИНА: ИСТОРИЯ РУК (нарастающим итогом) =====
// Ниже блока статистики — разделитель с галкой (свернуть/развернуть) и
// список рук: мини-карты раздачи, выбранное действие, кружок (зелёный —
// верный ответ, красный — ошибка). Новые руки — сверху списка.
// Галка-шеврон: свёрнуто — вершиной вниз, развёрнуто — вершиной вверх.
// Блок выезжает «шторкой» сверху вниз и заезжает обратно наверх
// (height-transition, а не мгновенное появление/исчезновение).
// Состояние галки (handsCollapsed) переживает перерисовки страницы.

let handsCollapsed = false;

// SVG-галка: базовый путь «вершина вниз» (∨), развёрнуто — rotate(180°).
const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 9l7 7 7-7"/></svg>';

// Строка истории: две мини-карты → действие → кружок вердикта.
function buildHandRow(hand) {
    const row = document.createElement('div');
    row.className = 'trainer-hand-row';

    const cards = document.createElement('div');
    cards.className = 'trainer-hand-cards';
    hand.cards.forEach(function(card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'trainer-hand-card ' + (SUIT_CLASS[card.suit] || '');
        const suitSpan = document.createElement('span');
        suitSpan.className = 'suit';
        suitSpan.textContent = SUIT_SYMBOL[card.suit] || '';
        cardDiv.appendChild(suitSpan);
        cardDiv.appendChild(document.createTextNode(card.rank));
        cards.appendChild(cardDiv);
    });

    const action = document.createElement('div');
    action.className = 'trainer-hand-action';
    action.textContent = hand.action;

    const dot = document.createElement('div');
    dot.className = 'trainer-hand-dot' + (hand.correct ? ' ok' : '');

    row.appendChild(cards);
    row.appendChild(action);
    row.appendChild(dot);
    return row;
}

// «Шторка» истории: высота анимируется от/к высоте содержимого.
// collapse=true — блок заезжает наверх, false — выезжает сверху вниз.
// Прерывание (быстрые клики по галке посреди анимации) безопасно:
//  - «догоняющий» шаг разворачивания (height = auto по transitionend)
//    снимается перед каждым новым шагом — иначе его запоздалый вызов
//    приходился на конец ЧУЖОЙ анимации (сворачивания) и разворачивал
//    уже свёрнутый список: галка «свёрнуто», а список открыт;
//  - текущая (анимированная) высота замораживается перед новым шагом —
//    реверс плавно продолжается с текущего кадра, а не дёргается.
function slideHands(wrap, collapse) {
    // Снять отложенный финальный шаг прошлого разворачивания.
    if (wrap._handsAutoHeightHandler) {
        wrap.removeEventListener('transitionend', wrap._handsAutoHeightHandler);
        wrap._handsAutoHeightHandler = null;
    }
    // Заморозить текущую высоту (при идущей анимации — её текущий кадр).
    wrap.style.height = getComputedStyle(wrap).height;
    void wrap.offsetHeight; // reflow: transition должен стартовать с этой высоты
    if (collapse) {
        // Текущая высота → 0: содержимое уезжает вверх под разделитель.
        wrap.style.height = '0px';
    } else {
        // 0 → высота содержимого: блок выезжает сверху вниз.
        wrap.style.height = wrap.scrollHeight + 'px';
        const done = function(e) {
            if (e.target !== wrap || e.propertyName !== 'height') return;
            wrap.removeEventListener('transitionend', done);
            wrap._handsAutoHeightHandler = null;
            // auto — чтобы список мог расти дальше без пересчёта высоты.
            wrap.style.height = 'auto';
        };
        wrap._handsAutoHeightHandler = done;
        wrap.addEventListener('transitionend', done);
    }
}

// Рендер разделителя-галки и истории рук под блоком статистики.
export function renderHands(container, nodeId) {
    if (!container) return;

    // --- Разделитель с галкой (между двумя блоками) ---
    const divider = document.createElement('div');
    divider.className = 'trainer-hands-divider' + (handsCollapsed ? ' collapsed' : '');
    divider.innerHTML = '<span class="line"></span>' +
        '<span class="chev">' + CHEVRON_SVG + '</span>' +
        '<span class="line"></span>';

    // --- Шторка истории рук ---
    const wrap = document.createElement('div');
    wrap.className = 'trainer-hands-wrap';
    const list = document.createElement('div');
    list.className = 'trainer-hands-list';
    getHands(nodeId).forEach(function(hand) {
        list.appendChild(buildHandRow(hand));
    });
    wrap.appendChild(list);
    // Текущее состояние — без анимации (анимирует только клик по галке).
    wrap.style.height = handsCollapsed ? '0px' : 'auto';

    divider.addEventListener('click', function() {
        handsCollapsed = !handsCollapsed;
        divider.classList.toggle('collapsed', handsCollapsed);
        slideHands(wrap, handsCollapsed);
    });

    container.appendChild(divider);
    container.appendChild(wrap);
}