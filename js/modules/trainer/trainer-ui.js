// ===== trainer-ui.js — панель настройки тренировки в редакторе =====
// По кнопке «шапочка выпускника» (trainingModeBtn) в правой панели вместо
// цветов показывается отражение основной матрицы текущего диапазона
// (см. trainer-engine). Логики «правильных»/«неправильных» ячеек нет.
// Слой данных отражения — участие руки в тренировке: участвующие ячейки
// показываются светло-серыми (тёмный шрифт), не участвующие — обычными,
// недоступные (subrange-disabled) — disabled и кликам не подлежат. Участие
// по умолчанию генерируется динамически из основной матрицы (закрашенная в
// любой пропорции — участвует); клик-тогл живёт только до переключения
// диапазона — состояние не сохраняется (как хранить — отдельная задача).
// Плашка «Генерировать автоматически» остаётся под будущий тренажёр: клик
// пока только переключает её индикатор. Под отражением — плашка «Начать
// тренировку» (вместо блока статистики).

import { buildTrainingMatrix } from './trainer-engine.js';

const DISABLED_CLASS = 'training-cell-disabled';
const PARTICIPATING_CLASS = 'training-cell-participating';

// Состояние панели настройки (живёт вне DOM).
const setupState = {
    visible: false,
    nodeId: null,
    // Преходящие тоглы участия (ключ 'r_c' → bool) — только для текущего
    // диапазона; при переключении диапазона сбрасываются (см. renderTrainingGrid).
    toggles: new Map(),
    togglesNodeId: null
};

// Участие ячейки с учётом преходящих тоглов: тогл сильнее значения по
// умолчанию, сгенерированного из основной матрицы.
function isParticipating(cell, r, c) {
    const key = r + '_' + c;
    return setupState.toggles.has(key) ? setupState.toggles.get(key) : cell.participates;
}

// ===== РЕНДЕР ОТРАЖЕНИЯ МАТРИЦЫ =====
function renderTrainingGrid() {
    const grid = document.getElementById('trainingGrid');
    if (!grid) return;
    // Переключение диапазона сбрасывает тоглы: участие всегда генерируется
    // динамически заново и нигде не сохраняется (см. trainer-engine).
    if (setupState.togglesNodeId !== setupState.nodeId) {
        setupState.toggles.clear();
        setupState.togglesNodeId = setupState.nodeId;
    }
    const rowsData = globalThis.rowsData;
    const reflection = buildTrainingMatrix(setupState.nodeId);
    let html = '';
    for (let r = 0; r < 13; r++) {
        for (let c = 0; c < 13; c++) {
            const cell = reflection[r][c];
            // Участвующие в тренировке — светло-серые, недоступные
            // (subrange-disabled) — disabled (кликам не подлежат), остальные —
            // обычные. Цветовые профили основной матрицы не переносятся.
            let cls = '';
            if (cell.disabled) cls = DISABLED_CLASS;
            else if (isParticipating(cell, r, c)) cls = PARTICIPATING_CLASS;
            html += '<div class="training-cell ' + cls + '" data-row="' + r + '" data-col="' + c + '">' +
                '<span class="training-cell-hand">' + rowsData[r][c] + '</span></div>';
        }
    }
    grid.innerHTML = html;
}

// ===== КЛИК ПО ЯЧЕЙКЕ ОТРАЖЕНИЯ (тогл участия в тренировке) =====
function onGridClick(e) {
    const cell = e.target.closest('.training-cell');
    if (!cell) return;
    // Недоступные ячейки кликам не подлежат вообще (как subrange-disabled
    // в основной матрице).
    if (cell.classList.contains(DISABLED_CLASS)) return;
    const r = parseInt(cell.getAttribute('data-row'), 10);
    const c = parseInt(cell.getAttribute('data-col'), 10);
    const reflection = buildTrainingMatrix(setupState.nodeId);
    const key = r + '_' + c;
    // Тогл работает по любой ячейке: закрашенная (участвует по умолчанию) —
    // снимается, пустая — добавляется.
    const current = isParticipating(reflection[r][c], r, c);
    setupState.toggles.set(key, !current);
    renderTrainingGrid();
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

    if (visible) renderTrainingGrid();
}

// ===== ПУБЛИЧНЫЕ ФУНКЦИИ =====
export function initTrainingPanel() {
    const grid = document.getElementById('trainingGrid');
    if (grid) grid.addEventListener('click', onGridClick);

    const autoBtn = document.getElementById('trainingAutoBtn');
    if (autoBtn) {
        autoBtn.addEventListener('click', function() {
            // Плашка остаётся в панели под будущий тренажёр: логика
            // correct/incorrect удалена, генерировать больше нечего —
            // клик пока только переключает индикатор.
            autoBtn.classList.toggle('active');
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

// Обновление отражения при смене диапазона (вызывается из trainer-api).
export function refreshTrainingPanel() {
    if (!setupState.visible) return;
    setupState.nodeId = App.state.currentNodeId;
    renderTrainingGrid();
}