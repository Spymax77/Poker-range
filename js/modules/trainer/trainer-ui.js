// ===== trainer-ui.js — панель настройки тренировки в редакторе =====
// По кнопке «шапочка выпускника» (trainingModeBtn) в правой панели вместо
// цветов показывается копия матрицы текущего диапазона:
//   - светло-серые ячейки — правильные руки (закрашены в диапазоне);
//   - серые ячейки — неправильные («близкие» соседние, см. trainer-engine).
// Под копией — плашка «Генерировать автоматически» с индикатором: при
// включённой генерации набор рассчитывается автоматически, при выключенной
// пользователь кликом добавляет/убирает серые руки. Любая ручная правка
// выключает авто-генерацию. Под основной матрицей — плашка «Начать
// тренировку» (вместо блока статистики).

import { generateTrainingHands } from './trainer-engine.js';

const CORRECT_CLASS = 'training-cell-correct';
const INCORRECT_CLASS = 'training-cell-incorrect';

// Состояние панели настройки (живёт вне DOM).
const setupState = {
    visible: false,
    auto: true,          // «Генерировать автоматически» включена
    correct: [],         // [r,c] правильных рук
    incorrect: [],       // [r,c] неправильных рук
    nodeId: null
};

function cellKey(r, c) { return r + '_' + c; }

// ===== РЕНДЕР КОПИИ МАТРИЦЫ =====
function renderTrainingGrid() {
    const grid = document.getElementById('trainingGrid');
    if (!grid) return;
    const rowsData = globalThis.rowsData;
    const correctSet = new Set(setupState.correct.map(function(p) { return cellKey(p[0], p[1]); }));
    const incorrectSet = new Set(setupState.incorrect.map(function(p) { return cellKey(p[0], p[1]); }));
    let html = '';
    for (let r = 0; r < 13; r++) {
        for (let c = 0; c < 13; c++) {
            const k = cellKey(r, c);
            const cls = correctSet.has(k) ? CORRECT_CLASS : (incorrectSet.has(k) ? INCORRECT_CLASS : '');
            html += '<div class="training-cell ' + cls + '" data-row="' + r + '" data-col="' + c + '">' +
                rowsData[r][c] + '</div>';
        }
    }
    grid.innerHTML = html;
}

// ===== ПЕРЕСЧЁТ НАБОРА =====
function recalc(auto) {
    setupState.auto = auto;
    const hands = generateTrainingHands(setupState.nodeId);
    setupState.correct = hands.correct;
    if (auto) {
        setupState.incorrect = hands.incorrect;
    } else {
        // При выключенной генерации оставляем только ручные отметки,
        // не пересекающиеся с правильными руками.
        const correctSet = new Set(setupState.correct.map(function(p) { return cellKey(p[0], p[1]); }));
        setupState.incorrect = setupState.incorrect.filter(function(p) { return !correctSet.has(cellKey(p[0], p[1])); });
    }
    renderTrainingGrid();
    renderAutoIndicator();
}

function renderAutoIndicator() {
    const btn = document.getElementById('trainingAutoBtn');
    if (!btn) return;
    btn.classList.toggle('active', setupState.auto);
}

// ===== ПОКАЗАТЬ / СКРЫТЬ ПАНЕЛЬ =====
// Тренировка — самостоятельный режим наравне с «Редактор» и «Анализ»:
// при входе выходим из режима анализа (иначе остаётся легенда), при выходе
// возвращаемся в режим редактора. Активные кнопки всех трёх режимов
// синхронизирует refreshConstructorAnalysisMode (grid-toolbar.js).
function setVisible(visible) {
    setupState.visible = visible;
    setupState.nodeId = App.state.currentNodeId;

    // В тренировке легенда/статистика анализа не показываются.
    if (visible && App.state.analysisMode) App.state.analysisMode = false;

    // Класс на body гасит кисть в paint.js (handlePaintStart/handlePaintMove).
    document.body.classList.toggle('training-setup', visible);

    const panel = document.getElementById('trainingSetupPanel');
    const startBtn = document.getElementById('trainingStartBtn');
    const stats = document.getElementById('constructorStatsContainer');
    const palette = document.querySelector('#constructorPage .palette-section');
    const profiles = document.querySelector('#constructorPage .profiles-container');

    if (panel) panel.style.display = visible ? 'block' : 'none';
    if (startBtn) startBtn.style.display = visible ? 'flex' : 'none';
    if (stats) stats.style.display = visible ? 'none' : '';
    if (palette) palette.style.display = visible ? 'none' : '';
    if (profiles) profiles.style.display = visible ? 'none' : '';

    if (App.grid && typeof App.grid.refreshConstructorAnalysisMode === 'function') {
        App.grid.refreshConstructorAnalysisMode();
    }

    if (visible) {
        setupState.incorrect = [];
        recalc(true);
    }
}

// ===== КЛИК ПО ЯЧЕЙКЕ КОПИИ (ручная правка) =====
function onGridClick(e) {
    const cell = e.target.closest('.training-cell');
    if (!cell) return;
    const r = parseInt(cell.getAttribute('data-row'), 10);
    const c = parseInt(cell.getAttribute('data-col'), 10);
    const k = cellKey(r, c);

    // Правильные руки не редактируются — они заданы диапазоном.
    const isCorrect = setupState.correct.some(function(p) { return cellKey(p[0], p[1]) === k; });
    if (isCorrect) return;

    const idx = setupState.incorrect.findIndex(function(p) { return cellKey(p[0], p[1]) === k; });
    if (idx >= 0) setupState.incorrect.splice(idx, 1);
    else setupState.incorrect.push([r, c]);

    // Любая ручная правка выключает авто-генерацию.
    if (setupState.auto) {
        setupState.auto = false;
        renderAutoIndicator();
    }
    renderTrainingGrid();
}

// ===== ПУБЛИЧНЫЕ ФУНКЦИИ =====
export function initTrainingPanel() {
    const grid = document.getElementById('trainingGrid');
    if (grid) grid.addEventListener('click', onGridClick);

    const autoBtn = document.getElementById('trainingAutoBtn');
    if (autoBtn) {
        autoBtn.addEventListener('click', function() {
            if (setupState.auto) {
                // Выключить: набор остаётся как есть, доступна ручная правка.
                setupState.auto = false;
                renderAutoIndicator();
            } else {
                // Включить: пересчитать набор автоматически.
                recalc(true);
            }
        });
    }

    const startBtn = document.getElementById('trainingStartBtn');
    if (startBtn) {
        startBtn.addEventListener('click', function() {
            // Заглушка: сама тренировка будет во вкладке «Тренажёр».
            App.modals.showFloatingModal(App.i18n.t('trainer.startSoon'));
        });
    }
}

export function toggleTrainingPanel() {
    setVisible(!setupState.visible);
}

export function isTrainingPanelVisible() {
    return setupState.visible;
}

// Обновление копии при смене диапазона (вызывается из trainer-api).
export function refreshTrainingPanel() {
    if (!setupState.visible) return;
    setupState.nodeId = App.state.currentNodeId;
    recalc(setupState.auto);
}