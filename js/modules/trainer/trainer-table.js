// ===== trainer-table.js — стол, кнопки действий и статистика тренажёра =====
// Рисует покерный стол (овал), раздачу карт и кнопки действий активного
// узла в .table-panel вкладки «Тренажёр». Вызывается из renderTrainerPage
// (trainer-page.js) при каждом изменении активного узла.
//
// Начальное состояние — кнопка «Начать тренировку» (без карт и кнопок действий).
// Карты и кнопки действий появляются только после «Начать тренировку».
// Состояние определяется единственным сравнением:
//   trainingActiveNodeId === activeNodeId
// Если не совпадает (другой узел, первый вход) — показывается кнопка
// «Начать тренировку». Сессия НЕ переживает смену активного узла и уход
// на другую вкладку: в этих случаях она автоматически ФИНИШИРУЕТ как по
// кнопке «Закончить тренировку» (статистика пишется в БД). Смена узла —
// событие trainer:activeChanged (trainer-store → подписка в этом файле),
// уход на вкладку — хук в navigation.js switchTab (finishTrainingSession).
//
// Раздача: currentDeal (рука + карты + row/col ячейки).
// Верный ответ — ЛЮБОЕ действие из ячейки (trainer-engine.getCorrectActions):
// простой цвет — одно действие; мульти-профиль — все компоненты с ненулевой
// долей + остаток до 100% = фолд; пустая ячейка — только фолд. Пример:
// рейз 50% / фолд 50% → верны и «рейз», и «фолд». Клик по кнопке действия
// сверяется со списком верных, ответ пишется в статистику узла
// (trainer-stats). Следующая рука раздаётся ТОЛЬКО по кнопке «Следующая
// рука» (под кнопками действий, у правого края стола): после ответа рука
// остаётся на столе, рамка горит цветом вердикта до перехода.
//
// Статистика (всего рук / верных / ошибок / шкала % верных) — справа от стола
// при активной тренировке; вне тренировки там же всегда видна матрица
// диапазона.

import { getTrainerNodes, getActiveNodeId } from './trainer-store.js';
import { generateDeal, renderCards } from './trainer-cards.js';
import { getCorrectActions, FOLD_ACTION } from './trainer-engine.js';
import { recordAnswer, renderStats, renderHands, flushStats } from './trainer-stats.js';

// Имя действия Fold — единая константа (не переводится: покерный термин,
// одинаков в русском и английском интерфейсе). Используется в кнопке
// действия, легенде и строках (рука, вердикт).
var FOLD_NAME = 'Fold';
// Порог «Допустимо»: верный ответ с частотой действия ≤ порога помечается
// как «Допустимо!» (не «Верно!»), в статистике остаётся верным.
var ACCEPTABLE_SHARE_THRESHOLD = 25;

// --- Состояние ---
var trainingActiveNodeId = null;
var matrixToggleMode = false;
var currentDeal = null; // { rank1, rank2, type, row, col, cards } — текущая рука
// Ответ на текущую раздачу уже дан: кнопки действий заблокированы,
// показана кнопка «Следующая рука» (новая рука — только по ней).
var answerGiven = false;
// Вердикт ответа (для строки под кнопками): true — верно, false — неверно,
// null — ответа ещё нет.
var answerCorrect = null;
// Выбранное действие ответа (id кнопки) — для частоты в строке вердикта.
var answerActionId = null;
// Открыт попап «Показать диапазон» (матрица поверх стола, см.
// buildRangeMatrixGrid): закрывается кнопкой «Закрыть» и раздачей новой руки.
var rangePopupOpen = false;
// Подсветка рамки стола после ответа (см. showTableVerdict ниже):
// класс 'trainer-table-flash-ok' / 'trainer-table-flash-err' либо null.
// Горит, пока не нажата «Следующая рука».
var tableFlashClass = null;

export function resetTrainingState() {
    trainingActiveNodeId = null;
    matrixToggleMode = false;
    currentDeal = null;
    answerGiven = false;
    answerCorrect = null;
    answerActionId = null;
    rangePopupOpen = false;
    // Подсветка рамки после ответа сессии не принадлежит — гасим сразу.
    tableFlashClass = null;
}

// Финиш открытой сессии тренировки — как кнопка «Закончить тренировку»:
// накопленная статистика пишется в БД одним запросом (гостю не сохраняется —
// счётчики остаются в памяти сессии, см. isPersistable в trainer-stats),
// состояние тренировки сбрасывается. Идемпотентен: без открытой сессии — no-op.
export function finishTrainingSession() {
    if (trainingActiveNodeId === null) return false;
    flushStats();
    resetTrainingState();
    renderTrainerTable();
    return true;
}

// Отмена сессии БЕЗ записи статистики — для случая, когда удаляется сам
// тренируемый узел: его статистика удаляется вместе с ним (resetStats),
// отдельный запрос «записать → тут же удалить» не нужен.
// С nodeId — отменяется, только если в тренировке именно этот узел;
// без nodeId — любая открытая сессия.
export function abandonTrainingSession(nodeId) {
    if (trainingActiveNodeId === null) return false;
    if (nodeId !== undefined && nodeId !== null && String(nodeId) !== String(trainingActiveNodeId)) return false;
    resetTrainingState();
    return true;
}

// ===== ФИНИШ СЕССИИ ПО СОБЫТИЮ СМЕНЫ АКТИВНОГО УЗЛА =====
// Смена активного узла (событие из trainer-store, см. notifyActiveChanged)
// закрывает открытую сессию как кнопка «Закончить тренировку»: статистика
// пишется в БД (гостю — не сохраняется), состояние сбрасывается. Живёт
// ЗДЕСЬ, а не в renderTrainerTable: отрисовка остаётся чистой — без
// побочных эффектов и неожиданных записей в БД.
if (App.events && typeof App.events.on === 'function') {
    App.events.on('trainer:activeChanged', function() {
        finishTrainingSession();
    });
}

// ===== РАЗДАЧА И ОЦЕНКА ОТВЕТА =====

// Новая раздача: случайная рука.
function dealNewHand(node) {
    currentDeal = generateDeal(node.participation, node.disabled);
}

// ===== ПОДСВЕТКА РАМКИ СТОЛА ПОСЛЕ ОТВЕТА =====
// Рамка .trainer-table-surface горит цветом вердикта: зелёная — верный
// ответ, красная — ошибка (классы — см. styles/components.css). Горит с
// ответа и ДО нажатия «Следующая рука» (без автоперехода к новой руке).
// Стол перерисовывается на каждый ответ (renderTrainerTable), поэтому класс
// живёт в состоянии и применяется к новому столу; гасится раздачей новой
// руки (dealNextHand) и сбросом сессии (resetTrainingState).
function showTableVerdict(correct) {
    tableFlashClass = correct ? 'trainer-table-flash-ok' : 'trainer-table-flash-err';
    // Применяем сразу: renderTrainerTable к этому моменту уже отрисовал стол.
    // Сначала снимаем оба класса — на случай повторного применения.
    var surfaceEl = document.querySelector('#trainerPage .table-panel .trainer-table-surface');
    if (surfaceEl) {
        surfaceEl.classList.remove('trainer-table-flash-ok', 'trainer-table-flash-err');
        surfaceEl.classList.add(tableFlashClass);
    }
}

// Ответ на текущую раздачу: оценка по списку верных действий из ячейки →
// статистика. Новая рука
// НЕ раздаётся автоматически: рука остаётся на столе до кнопки
// «Следующая рука» (dealNextHand). actionName — подпись нажатой кнопки
// (для истории рук).
function submitAnswer(node, actionId, actionName) {
    if (!currentDeal || answerGiven) return;
    // Верный ответ — ЛЮБОЕ действие из ячейки: мульти-ячейка может содержать
    // несколько действий, каждое из них верно (см. trainer-engine).
    var correctActions = getCorrectActions(node, currentDeal.row, currentDeal.col);
    var correct = correctActions.indexOf(actionId) !== -1;
    // История рук: карты раздачи + выбранное действие (+ вердикт).
    recordAnswer(node.id, correct, {
        cards: currentDeal.cards.map(function(c) { return { rank: c.rank, suit: c.suit }; }),
        action: actionName
    }, { row: currentDeal.row, col: currentDeal.col });
    // Рука «отвечена»: кнопки действий блокируются (см. renderTrainerTable),
    // появляется кнопка «Следующая рука» и строка вердикта под ней.
    answerGiven = true;
    answerCorrect = correct;
    answerActionId = actionId;
    renderTrainerTable();
    // Рамка стола горит цветом вердикта до нажатия «Следующая рука».
    showTableVerdict(correct);
}

// Следующая рука — ТОЛЬКО по кнопке «Следующая рука» (без автоперехода).
// Сбрасывает состояние ответа и гасит рамку вердикта.
function dealNextHand(node) {
    dealNewHand(node);
    answerGiven = false;
    answerCorrect = null;
    answerActionId = null;
    // Попап «Показать диапазон» — просмотр уже отвеченной руки: с раздачей
    // новой руки закрывается.
    rangePopupOpen = false;
    tableFlashClass = null;
    renderTrainerTable();
}

// SVG «палочка со звёздами» — кнопка «Начать тренировку».
var WAND_SVG = '<svg class="trainer-start-btn-icon" viewBox="0 0 512 512" fill="currentColor">' +
    '<path d="M304.872,377.116v-53.41c0.007,0,0.011,0.008,0.018,0.015v-3.762c0.808-0.41,1.683-0.812,2.492-1.147' +
    'c0.808-0.402,1.68-0.805,2.487-1.214c10.425-4.968,21.73-10.354,31.409-16.477c2.965-1.877,5.725-3.896,8.213-6.116' +
    'c2.082-1.751,3.967-3.635,5.714-5.587c12.377-13.855,16.343-31.212,7.87-45.059c-4.711-7.665-11.836-12.112-19.371-13.52' +
    'c-4.302-0.946-8.741-0.812-13.05,0.336c-0.872,0.201-1.814,0.469-2.686,0.804c-5.583,1.952-10.563,5.513-14.131,10.63' +
    'c0.54-6.19-0.939-12.18-3.967-17.222c-0.465-0.804-0.938-1.616-1.542-2.354c-1.013-1.475-2.156-2.756-3.438-3.963v98.127' +
    'c-0.008-0.008-0.012-0.014-0.018-0.014v-98.127c0.007,0.008,0.011,0.008,0.018,0.014v-7.33c-0.008,0-0.012,0.008-0.018,0.008' +
    'V35.636C304.872,15.956,288.931,0,269.24,0H49.504C29.808,0,13.868,15.956,13.868,35.636v341.48' +
    'c0,19.68,15.94,35.629,35.636,35.636H269.24C288.931,412.745,304.872,396.797,304.872,377.116z M31.354,377.116V35.636' +
    'c0.018-10.027,8.123-18.131,18.15-18.153H269.24c10.022,0.022,18.127,8.126,18.15,18.153v341.48' +
    'c-0.023,10.026-8.127,18.13-18.15,18.146H49.504C39.477,395.247,31.372,387.142,31.354,377.116z"/>' +
    '<path d="M160.521,136.586c-0.343-0.998-0.644-1.542-1.158-1.542c-0.51,0-0.801,0.544-1.14,1.542' +
    'c-5.848,17.296-36.497,59.808-47.804,68.941l-0.54,0.849l0.54,0.842c11.307,9.148,41.957,51.652,47.804,68.956' +
    'c0.338,0.998,0.629,1.534,1.14,1.534c0.514,0,0.815-0.536,1.158-1.534c5.832-17.304,36.492-59.808,47.804-68.956l0.537-0.842' +
    'l-0.537-0.849C197.013,196.395,166.353,153.882,160.521,136.586z"/>' +
    '<path d="M77.474,42.698l-0.503-0.67l-0.495,0.67C73.974,50.14,60.774,68.45,55.898,72.368l-0.23,0.373l0.23,0.364' +
    'c4.876,3.918,18.076,22.235,20.578,29.677l0.495,0.663l0.503-0.663c2.504-7.442,15.706-25.758,20.574-29.677l0.235-0.364' +
    'l-0.235-0.373C93.181,68.45,79.978,50.14,77.474,42.698z"/>' +
    '<path d="M242.263,317.718l-0.5-0.664l-0.499,0.664c-2.503,7.449-15.699,25.758-20.571,29.677l-0.238,0.365l0.238,0.373' +
    'c4.872,3.918,18.068,22.228,20.571,29.669l0.499,0.671l0.5-0.671c2.503-7.442,15.706-25.752,20.578-29.669l0.231-0.373' +
    'l-0.231-0.365C257.969,343.476,244.766,325.166,242.263,317.718z"/>' +
    '<path d="M474.659,121.941L304.891,60.196v18.563l163.782,59.6c1.885,0.67,3.497,1.608,4.98,2.823' +
    'c0.738,0.536,1.479,1.207,2.082,1.877c4.506,4.783,6.186,11.911,3.836,18.571L362.74,482.528' +
    'c-3.43,9.408-13.859,14.257-23.271,10.824L132.978,418.22c-3.092-1.14-5.717-3.024-7.669-5.445h-19.773' +
    'c3.363,9.818,10.965,18.027,21.456,21.863l206.485,75.19c13.118,4.775,27.107,1.416,36.593-7.531' +
    'c1.349-1.214,2.556-2.556,3.699-4.038c2.22-2.89,4.105-6.123,5.378-9.75l116.831-320.898' +
    'C502.704,149.115,493.155,128.668,474.659,121.941z"/>' +
    '<path d="M412.831,205.639l0.466-0.149c4.723-4.574,17.669-8.939,27.122-14.943c10.224-6.473,14.876-17.498,9.844-25.73' +
    'c-5.274-8.574-17.118-8.216-22.291-0.782c0.808-9.021-8.041-16.91-17.592-13.729c-9.143,3.069-12.67,14.496-8.998,26.035' +
    'c3.39,10.674,10.504,22.34,11.174,28.88L412.831,205.639z"/>' +
    '</svg>';

// SVG «палитра» — режим «показ в цвете».
var PALETTE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<circle cx="12" cy="12" r="10"/>' +
    '<path d="M12 2a10 10 0 0 0 0 20" fill="currentColor" opacity="0.3"/>' +
    '</svg>';

// SVG «тогл» — режим просмотра участия (только просмотр, без кликов).
var TOGGLE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<rect x="1" y="5" width="22" height="14" rx="7"/>' +
    '<circle cx="16" cy="12" r="5" fill="currentColor"/>' +
    '</svg>';

// SVG «стрелка вправо» — кнопка «Следующая рука».
var NEXT_ARROW_SVG = '<svg class="trainer-next-hand-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 12h16M14 6l6 6-6 6"/>' +
    '</svg>';

// ===== ЗАЛИВКА ЯЧЕЙКИ ИЗ СНАПШОТА =====
// Эталонная заливка App.colors.applyCellFill / App.colors.getCellFillSegments
// (color-manager.js) — та же, что в редакторе. Цвета компонентов мульти-
// профилей берутся из снапшота узла тренажёра (4-й аргумент colorsList),
// а не из живого App.editor.colorsPerNode. Отдельная копия логики заливки
// не нужна: вторая реализация расходится с эталоном («баг второго
// экземпляра») при любом изменении общей логики.

// ===== МАТРИЦА ДИАПАЗОНА (общая: правая колонка вне тренировки + попап
// «Показать диапазон») =====
// Классы hands-grid trainer-matrix-grid — тот же вид и размер (13×37px +
// gap 1px = 493px), что у матрицы до «Начать тренировку». togglesMode=true —
// только просмотр участия рук в тренировке (клики по ячейкам отключены —
// участие формируется в редакторе, панель «Диапазон на тренировке», и
// попадает в узел только снапшотом при добавлении); false — цвета диапазона.
// highlight {row,col} — золотая рамка на ячейке текущей руки (как у
// закреплённой ячейки в режиме анализа редактора, .gto-cell-pinned).
function buildRangeMatrixGrid(activeNode, togglesMode, highlight) {
    var matrixGrid = document.createElement('div');
    matrixGrid.className = 'hands-grid trainer-matrix-grid';
    var rowsData = globalThis.rowsData;
    for (var r = 0; r < 13; r++) {
        for (var c = 0; c < 13; c++) {
            var cell = document.createElement('div');
            cell.className = 'hand-cell';
            cell.setAttribute('data-row', r);
            cell.setAttribute('data-col', c);
            if (togglesMode) {
                var isD = activeNode.disabled && activeNode.disabled[r] && activeNode.disabled[r][c];
                var part = activeNode.participation && activeNode.participation[r] && activeNode.participation[r][c];
                if (isD) cell.classList.add('subrange-disabled');
                else if (part) cell.classList.add('trainer-matrix-participating');
            } else {
                var pid = activeNode.matrix[r] ? activeNode.matrix[r][c] : null;
                var prof = (pid !== null && pid !== undefined && activeNode.colors)
                    ? activeNode.colors.find(function(c) { return c.id === pid; }) : null;
                // Эталонная заливка из редактора (color-manager.js), цвета
                // компонентов — из снапшота узла (colorsList).
                if (prof) {
                    App.colors.applyCellFill(cell, activeNode.id, prof, activeNode.colors);
                    cell.style.color = '#FFF';
                    cell.style.textShadow = '0 1px 2px rgba(0,0,0,.45)';
                }
                if (activeNode.disabled && activeNode.disabled[r] && activeNode.disabled[r][c]) cell.classList.add('subrange-disabled');
            }
            // Золотая рамка ячейки текущей руки (попап «Показать диапазон»).
            if (highlight && highlight.row === r && highlight.col === c) cell.classList.add('gto-cell-pinned');
            var ts = document.createElement('span'); ts.textContent = rowsData[r][c]; ts.style.position = 'relative'; ts.style.zIndex = '2';
            cell.appendChild(ts);
            matrixGrid.appendChild(cell);
        }
    }
    return matrixGrid;
}

// ===== ЛЕГЕНДА ЦВЕТОВ ДЕЙСТВИЙ (попап «Показать диапазон») =====
// Квадратик цвета + название действия: показываются только цвета, реально
// используемые в матрице (мульти-профили — по их компонентам), + Fold —
// цветом незакрашенной ячейки, всегда последним.
function buildRangeLegend(activeNode) {
    var used = {};
    for (var r = 0; r < 13; r++) {
        for (var c = 0; c < 13; c++) {
            var pid = activeNode.matrix[r] ? activeNode.matrix[r][c] : null;
            if (pid !== null && pid !== undefined) used[pid] = true;
        }
    }
    var items = [];
    var seen = {};
    (activeNode.colors || []).forEach(function(col) {
        if (!used[col.id]) return;
        var parts = (col.type === 'multi' && Array.isArray(col.components)) ? col.components : [col];
        parts.forEach(function(p) {
            // Компонент мульти-профиля ссылается на простой цвет (colorId) —
            // имя и цвет берём у него (у самого компонента их нет).
            var src = (p.colorId !== undefined && p.colorId !== null)
                ? (activeNode.colors || []).find(function(x) { return x.id === p.colorId; }) || p
                : p;
            if (!src.color) return;
            var name = src.name || '';
            var key = name + '|' + src.color;
            if (seen[key]) return;
            seen[key] = true;
            items.push({ name: name, color: src.color, fold: false });
        });
    });
    // Fold — цвет незакрашенной ячейки (фон .hand-cell без заливки); имя —
    // FOLD_NAME, как у кнопки действия (см. renderTrainerTable).
    items.push({ name: FOLD_NAME, color: 'var(--cell-empty-bg)', fold: true });

    var legend = document.createElement('div');
    legend.className = 'trainer-range-legend';
    items.forEach(function(it) {
        var item = document.createElement('span');
        item.className = 'trainer-range-legend-item';
        var sq = document.createElement('span');
        sq.className = 'trainer-range-legend-swatch' + (it.fold ? ' fold' : '');
        sq.style.background = it.color;
        var lbl = document.createElement('span');
        lbl.className = 'trainer-range-legend-label';
        lbl.textContent = it.name;
        item.appendChild(sq);
        item.appendChild(lbl);
        legend.appendChild(item);
    });
    return legend;
}

// ===== ДОЛИ ДЕЙСТВИЙ В ЯЧЕЙКЕ (общее: строка руки в попапе + строка вердикта) =====
// Компоненты мульти-профиля (границы — те же, что у заливки) + фолд (остаток
// до 100%); простой цвет — 100%; пустая ячейка — только фолд. Названия
// действий — ТОЧНО как у цветов-действий. Возвращает [{ id, name, share }]
// (id = id простого цвета либо FOLD_ACTION) в порядке ячейки, Fold —
// последним, когда имеется.
function getCellActionShares(activeNode, row, col) {
    var shares = [];
    var profileId = activeNode.matrix[row] ? activeNode.matrix[row][col] : null;
    var profile = (activeNode.colors || []).find(function(c) { return c.id === profileId; }) || null;
    if (!profile) {
        shares.push({ id: FOLD_ACTION, name: FOLD_NAME, share: 100 });
    } else if (profile.type === 'simple' || (!profile.type && profile.color)) {
        shares.push({ id: profile.id, name: profile.name || '', share: 100 });
    } else {
        var components = profile.components || [];
        var positions = App.colors.getPositions(profile); // как у заливки
        var prev = 0;
        for (var i = 0; i < components.length; i++) {
            var pos = positions[i] || 0;
            var share = pos - prev;
            prev = pos;
            if (share <= 0) continue;
            var id = components[i].colorId;
            if (id === undefined || id === null) continue;
            // Компонент мульти-профиля ссылается на простой цвет (colorId) —
            // название действия берём у него, точное название цвета-действия.
            var src = (activeNode.colors || []).find(function(x) { return x.id === id; }) || components[i];
            // Одинаковое действие в нескольких компонентах складываем (по id —
            // сопоставление с кнопками устойчиво к переименованиям и пустым
            // именам).
            var same = shares.find(function(s) { return s.id === id; });
            if (same) same.share += share;
            else shares.push({ id: id, name: src.name || '', share: share });
        }
        var foldShare = 100 - prev;
        if (foldShare > 0) shares.push({ id: FOLD_ACTION, name: FOLD_NAME, share: foldShare });
    }
    return shares;
}

// ===== СТРОКА «РУКА + ДОЛИ ДЕЙСТВИЙ» (попап «Показать диапазон») =====
// Вторая строка слева внизу попапа (под легендой): рука текущей раздачи и
// доли действий в её ячейке. Пример: Рука: AQo · Raise 20 50% · Fold 50%.
function buildHandInfoLine(activeNode, deal) {
    var rowsData = globalThis.rowsData;
    var label = (rowsData[deal.row] && rowsData[deal.row][deal.col]) || '';
    var shares = getCellActionShares(activeNode, deal.row, deal.col);

    var line = document.createElement('div');
    line.className = 'trainer-range-popup-hand';
    // Элементы строки: «Рука: …», затем каждое действие с долей — через
    // разделитель «·» (без двоеточия между названием действия и процентом).
    // Действия — с точными именами цветов-действий; Fold — всегда, когда он
    // имеется в ячейке. Пример: Рука: AQo · Raise 20 50% · Fold 50%.
    // Зазоры между элементами — 12px (styles .trainer-range-popup-hand).
    var addSpan = function(text) {
        var sp = document.createElement('span');
        sp.textContent = text;
        line.appendChild(sp);
    };
    addSpan(App.i18n.t('trainer.handLabel') + ': ' + label);
    shares.forEach(function(s) {
        addSpan('·');
        addSpan(s.name + ' ' + Math.round(s.share) + '%');
    });
    return line;
}

// ===== СТРОКА ВЕРДИКТА (под кнопками после ответа) =====
// «✔ Верно!» (зелёный #78A659) или «✘ Неверно!» (красный #E55757) + через
// разделитель «·» перечисление действий ячейки с долями текстом #dedede
// (названия — точные имена цветов-действий, без двоеточий; Fold — когда
// имеется). Пример: ✔ Верно! Raise 8 25% · Call 25% · Fold 50%.
// Правило: у верного ответа с частотой ≤ ACCEPTABLE_SHARE_THRESHOLD слово
// «Верно!» заменяется на «Допустимо!» — оценка и статистика при этом НЕ
// меняются (ответ верный).
function buildVerdictLine(activeNode, deal, correct, chosenId) {
    var shares = getCellActionShares(activeNode, deal.row, deal.col);
    // Частота выбранного действия — по id действия (устойчиво к
    // переименованиям цветов и пустым именам).
    var chosenShare = null;
    shares.forEach(function(s) { if (s.id === chosenId) chosenShare = s.share; });
    var statusKey = 'trainer.verdictWrong';
    if (correct) {
        statusKey = (chosenShare !== null && chosenShare <= ACCEPTABLE_SHARE_THRESHOLD)
            ? 'trainer.verdictAcceptable'
            : 'trainer.verdictCorrect';
    }

    var row = document.createElement('div');
    row.className = 'trainer-verdict-row';
    var status = document.createElement('span');
    status.className = 'trainer-verdict-status ' + (correct ? 'ok' : 'err');
    status.textContent = (correct ? '✔ ' : '✘ ') + App.i18n.t(statusKey);
    row.appendChild(status);
    row.appendChild(document.createTextNode(' '));
    var actions = document.createElement('span');
    actions.className = 'trainer-verdict-actions';
    actions.textContent = shares
        .map(function(s) { return s.name + ' ' + Math.round(s.share) + '%'; })
        .join(' · ');
    row.appendChild(actions);
    return row;
}

// ===== РЕНДЕР СТОЛА И КНОПОК =====
// Чистая отрисовка: никаких побочных эффектов и записей в БД. Финиш
// сессии при смене активного узла — в подписке на событие
// trainer:activeChanged (см. выше), а не здесь.
export function renderTrainerTable() {
    var panel = document.querySelector('#trainerPage .table-panel');
    if (!panel) return;
    panel.innerHTML = '';

    var activeId = getActiveNodeId();
    var nodes = getTrainerNodes();
    var activeNode = nodes.find(function(n) { return n.id === activeId; }) || nodes[0];
    if (!activeNode) return;

    var isTrainingActive = trainingActiveNodeId === activeId;
    var content = document.createElement('div');
    content.className = 'trainer-content-wrapper';

    // --- Левая колонка: стол + кнопки ---
    var leftCol = document.createElement('div');
    leftCol.className = 'trainer-table-col';

    var tableDiv = document.createElement('div');
    tableDiv.className = 'trainer-table-surface';
    // Подсветка рамки после ответа (см. showTableVerdict) переживает
    // перерисовку — применяем класс к новому столу.
    if (tableFlashClass) tableDiv.classList.add(tableFlashClass);
    var lbl = document.createElement('div'); lbl.className = 'trainer-table-label'; lbl.textContent = 'POKER TABLE'; tableDiv.appendChild(lbl);
    var chip = document.createElement('div'); chip.className = 'trainer-player-chip'; chip.textContent = 'HERO'; tableDiv.appendChild(chip);

    if (isTrainingActive) {
        var cc = document.createElement('div'); cc.className = 'trainer-cards-container'; tableDiv.appendChild(cc);
        renderCards(cc, currentDeal ? currentDeal.cards : null);
    }
    leftCol.appendChild(tableDiv);

    var btnRow = document.createElement('div'); btnRow.className = 'trainer-action-buttons';
    if (isTrainingActive) {
        // Кнопки = ВСЕ простые цвета снапшота + Fold (мульти-профили состоят
        // из простых цветов, верный ответ всегда сводится к одной из кнопок).
        var sc = []; if (activeNode.colors) sc = activeNode.colors.filter(function(c) { return c.type === 'simple' || (!c.type && c.color); });
        var acts = sc.map(function(c) { return { id: c.id, name: c.name, color: c.color }; });
        acts.push({ id: FOLD_ACTION, name: FOLD_NAME, color: '#5a5d66' });
        acts.forEach(function(a) {
            var b = document.createElement('button'); b.className = 'trainer-action-btn'; b.textContent = a.name;
            b.style.borderColor = a.color; b.style.color = '#a9afb5';
            b.addEventListener('mouseenter', function() { if (!b.disabled) b.style.background = a.color + '18'; });
            b.addEventListener('mouseleave', function() { b.style.background = 'transparent'; });
            b.addEventListener('click', function() { submitAnswer(activeNode, a.id, a.name); });
            // Ответ уже дан: кнопки действий блокируются (второй ответ
            // невозможен) до нажатия «Следующая рука». Ненажатые кнопки
            // гаснут (см. CSS), нажатая остаётся выделенной заливкой своего
            // цвета (как hover) — видно, каким действием отвечали.
            if (answerGiven) {
                b.disabled = true;
                if (a.id === answerActionId) {
                    b.classList.add('trainer-action-btn--chosen');
                    b.style.background = a.color + '18';
                }
            }
            btnRow.appendChild(b);
        });
    } else {
        var sb = document.createElement('button'); sb.className = 'trainer-start-btn';
        sb.innerHTML = WAND_SVG + '<span>' + App.i18n.t('trainer.startTraining') + '</span>';
        sb.addEventListener('click', function() {
            trainingActiveNodeId = activeId;
            dealNewHand(activeNode); // первая раздача
            renderTrainerTable();
        });
        btnRow.appendChild(sb);
    }
    leftCol.appendChild(btnRow);
    // Ряд кнопок после ответа — ТОЛЬКО после ответа (до ответа не виден), под
    // кнопками действий, по центру стола (493px = ширина .trainer-table-surface).
    // «Показать диапазон» — перед «Следующая рука» (слева от неё). Новая рука
    // раздаётся только по «Следующая рука».
    if (isTrainingActive && answerGiven) {
        var nextRow = document.createElement('div'); nextRow.className = 'trainer-next-hand-row';
        var showBtn = document.createElement('button'); showBtn.className = 'trainer-next-hand-btn';
        showBtn.textContent = App.i18n.t('trainer.showRange');
        showBtn.addEventListener('click', function() {
            rangePopupOpen = true;
            renderTrainerTable();
            // Плавное появление — только при открытии кнопкой: при других
            // перерендерах попап пересоздаётся уже видимым, без анимации.
            var p = document.querySelector('#trainerPage .trainer-range-popup');
            if (p) p.classList.add('enter');
        });
        nextRow.appendChild(showBtn);
        var nb = document.createElement('button'); nb.className = 'trainer-next-hand-btn';
        nb.innerHTML = '<span>' + App.i18n.t('trainer.nextHand') + '</span>' + NEXT_ARROW_SVG;
        nb.addEventListener('click', function() { dealNextHand(activeNode); });
        nextRow.appendChild(nb);
        leftCol.appendChild(nextRow);
    }
    // Строка вердикта — после ответа, под кнопками «Показать диапазон» /
    // «Следующая рука»: «✔ Верно!» / «✘ Неверно!» + перечисление действий
    // ячейки с долями (см. buildVerdictLine).
    if (isTrainingActive && answerGiven && currentDeal) {
        leftCol.appendChild(buildVerdictLine(activeNode, currentDeal, answerCorrect, answerActionId));
    }
    // --- Попап «Показать диапазон»: матрица поверх стола (строго на месте
    // стола — top/left = 0 колонки стола, см. .trainer-range-popup в
    // styles/components.css), НЕ блокируя остальной интерфейс (без оверлея).
    if (isTrainingActive && rangePopupOpen && currentDeal) {
        var popup = document.createElement('div'); popup.className = 'trainer-range-popup';
        // Матрица в точности как вне тренировки (цвета диапазона), но с
        // золотой рамкой на ячейке текущей руки.
        var popupGrid = buildRangeMatrixGrid(activeNode, false, { row: currentDeal.row, col: currentDeal.col });
        popupGrid.classList.add('trainer-range-matrix');
        popup.appendChild(popupGrid);
        // Нижний ряд: слева (у левого края матрицы) две строки — легенда цветов
        // действий и строка «Рука + доли действий», справа — текстовая кнопка
        // «Закрыть» (у нижнего правого края матрицы).
        var closeRow = document.createElement('div'); closeRow.className = 'trainer-range-popup-close-row';
        var infoCol = document.createElement('div'); infoCol.className = 'trainer-range-popup-info';
        infoCol.appendChild(buildRangeLegend(activeNode));
        infoCol.appendChild(buildHandInfoLine(activeNode, currentDeal));
        closeRow.appendChild(infoCol);
        var closeBtn = document.createElement('button'); closeBtn.className = 'training-plate-close';
        closeBtn.textContent = App.i18n.t('trainer.close');
        closeBtn.addEventListener('click', function() {
            // Плавное закрытие: затухание, затем уборка попапа. setTimeout —
            // чтобы закрытие сработало и при отключённых анимациях.
            if (popup.classList.contains('closing')) return;
            popup.classList.add('closing');
            setTimeout(function() {
                rangePopupOpen = false;
                renderTrainerTable();
            }, 200);
        });
        closeRow.appendChild(closeBtn);
        popup.appendChild(closeRow);
        leftCol.appendChild(popup);
    }
    content.appendChild(leftCol);
    // --- Статистика: при активной тренировке (зона матрицы, справа от стола) ---
    if (isTrainingActive) {
        var statsCol = document.createElement('div');
        statsCol.className = 'trainer-stats-col';
        renderStats(statsCol, activeNode.id);
        // Кнопка «Закончить тренировку» — текстом (без плашки) ниже шкалы.
        // Единственное место записи статистики в БД за тренировку: ответы
        // копились в памяти (trainer-stats), здесь уходит один запрос.
        var endBtn = document.createElement('button');
        endBtn.className = 'trainer-end-btn';
        endBtn.textContent = App.i18n.t('trainer.endTraining');
        endBtn.addEventListener('click', function() {
            finishTrainingSession();
        });
        statsCol.appendChild(endBtn);
        // Второй блок: история рук нарастающим итогом (под «Закончить
        // тренировку»), с галкой свернуть/развернуть и анимацией-шторкой.
        renderHands(statsCol, activeNode.id);
        content.appendChild(statsCol);
    }
    // --- Матрица диапазона: видна всегда вне активной тренировки (во время
    // тренировки эту зону занимает статистика) ---
    // activeNode.availability (проценты доступности ячеек) в узле уже
    // хранится (см. trainer-engine.buildTrainerSnapshot), но оверлей
    // частичной доступности (перекрывающий блок .cell-overlay,
    // grid-renderer.js) здесь пока НЕ рисуется — данные готовы под
    // будущую реализацию.
    if (!isTrainingActive) {
        var rightCol = document.createElement('div');
        rightCol.className = 'trainer-matrix-col';

        var matrixGrid = buildRangeMatrixGrid(activeNode, matrixToggleMode, null);
        rightCol.appendChild(matrixGrid);

        // Переключатель режимов матрицы: «Диапазон» (цвета) ↔ «Руки в
        // тренировке» (просмотр участия). Тумблер с двумя подписями; клик
        // по тумблеру или по любой из подписей переключает режим.
        var modes = document.createElement('div'); modes.className = 'trainer-matrix-modes';
        var toggleWrap = document.createElement('div'); toggleWrap.className = 'trainer-matrix-mode-toggle';
        var lblRange = document.createElement('span'); lblRange.className = 'trainer-matrix-mode-toggle-label' + (!matrixToggleMode ? ' active' : '');
        lblRange.textContent = App.i18n.t('trainer.matrixModeRange');
        var sw = document.createElement('button'); sw.className = 'trainer-matrix-mode-toggle-sw' + (matrixToggleMode ? ' on' : '');
        var knob = document.createElement('div'); knob.className = 'trainer-matrix-mode-toggle-knob';
        sw.appendChild(knob);
        var lblHands = document.createElement('span'); lblHands.className = 'trainer-matrix-mode-toggle-label' + (matrixToggleMode ? ' active' : '');
        lblHands.textContent = App.i18n.t('trainer.matrixModeHands');
        var onModeToggle = function() {
            matrixToggleMode = !matrixToggleMode;
            // Тумблер обновляется на месте, без renderTrainerTable(): полный
            // перерендер пересоздавал бы DOM и ручка перескакивала без анимации.
            // Перестраивается только сетка матрицы.
            sw.className = 'trainer-matrix-mode-toggle-sw' + (matrixToggleMode ? ' on' : '');
            lblRange.className = 'trainer-matrix-mode-toggle-label' + (!matrixToggleMode ? ' active' : '');
            lblHands.className = 'trainer-matrix-mode-toggle-label' + (matrixToggleMode ? ' active' : '');
            var newGrid = buildRangeMatrixGrid(activeNode, matrixToggleMode, null);
            rightCol.replaceChild(newGrid, matrixGrid);
            matrixGrid = newGrid;
        };
        lblRange.addEventListener('click', onModeToggle);
        sw.addEventListener('click', onModeToggle);
        lblHands.addEventListener('click', onModeToggle);
        toggleWrap.appendChild(lblRange); toggleWrap.appendChild(sw); toggleWrap.appendChild(lblHands);
        modes.appendChild(toggleWrap);
        rightCol.appendChild(modes);
        content.appendChild(rightCol);
    }

    panel.appendChild(content);
}