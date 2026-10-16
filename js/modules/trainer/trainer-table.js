// ===== trainer-table.js — стол и кнопки действий в правой панели тренажёра =====
// Рисует покерный стол (овал) и кнопки действий из цветов активного узла
// в .table-panel вкладки «Тренажёр». Вызывается из renderTrainerPage (trainer-page.js)
// при каждом изменении активного узла.
//
// Начальное состояние — кнопка «Начать тренировку» (без карт и кнопок действий).
// Карты и кнопки действий появляются только после нажатия «Начать тренировку».
// Состояние определяется единственным сравнением:
//   trainingActiveNodeId === activeNodeId
// Если не совпадает (другой узел, переход из другой вкладки, первый вход) —
// показывается кнопка «Начать тренировку». Сброс не нужен.

import { getTrainerNodes, getActiveNodeId } from './trainer-store.js';
import { renderCards } from './trainer-cards.js';

// --- Состояние ---
var trainingActiveNodeId = null;
var matrixVisible = false;
var matrixToggleMode = false;
var toggleMap = new Map();
var toggleMapNodeId = null;

export function resetTrainingState() {
    trainingActiveNodeId = null;
    matrixVisible = false;
    matrixToggleMode = false;
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

// SVG «4 квадрата» — кнопка «Показать диапазон» (как иконка дерева в редакторе).
var GRID_SVG = '<svg class="trainer-grid-btn-icon" viewBox="0 0 24 24" fill="currentColor">' +
    '<rect x="2" y="2" width="9" height="9" rx="1"/>' +
    '<rect x="13" y="2" width="9" height="9" rx="1"/>' +
    '<rect x="2" y="13" width="9" height="9" rx="1"/>' +
    '<rect x="13" y="13" width="9" height="9" rx="1"/>' +
    '</svg>';

// SVG «палитра» — режим «показ в цвете».
var PALETTE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<circle cx="12" cy="12" r="10"/>' +
    '<path d="M12 2a10 10 0 0 0 0 20" fill="currentColor" opacity="0.3"/>' +
    '</svg>';

// SVG «тогл» — режим «с тоглами участия».
var TOGGLE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<rect x="1" y="5" width="22" height="14" rx="7"/>' +
    '<circle cx="16" cy="12" r="5" fill="currentColor"/>' +
    '</svg>';

// ===== ЗАЛИВКА ЯЧЕЙКИ ИЗ СНАПШОТА =====
// Аналог App.colors.applyCellFill, но использует массив цветов из снапшота
// узла тренажёра, а не из App.editor.colorsPerNode.
function applySnapshotFill(cell, colorProfile, snapshotColors) {
    if (!cell) return;
    var fill = cell.querySelector(':scope > .cell-fill');
    if (!colorProfile) {
        if (fill) fill.remove();
        return;
    }
    var segments = [];
    if (colorProfile.type === 'simple' || (!colorProfile.type && colorProfile.color)) {
        segments = [{ color: colorProfile.color, width: 100 }];
    } else if (colorProfile.type === 'multi' || colorProfile.components) {
        var componentColors = colorProfile.components.map(function(comp) {
            var found = snapshotColors.find(function(c) { return c.id === comp.colorId; });
            return found ? found.color : '#3d3d3d';
        });
        if (componentColors.length > 0) {
            var positions = App.colors.getPositions(colorProfile);
            var prev = 0;
            for (var i = 0; i < componentColors.length; i++) {
                var pos = Math.round((positions[i] || 0) * 10) / 10;
                var w = Math.round((pos - prev) * 10) / 10;
                if (w > 0) segments.push({ color: componentColors[i], width: w });
                prev = pos;
            }
            if (prev < 100) {
                segments.push({ color: App.colors.getEmptyCellBg(), width: Math.round((100 - prev) * 10) / 10 });
            }
        }
    }
    if (segments.length === 0) {
        if (fill) fill.remove();
        return;
    }
    if (!fill) {
        fill = document.createElement('div');
        fill.className = 'cell-fill';
        cell.insertBefore(fill, cell.firstChild);
    }
    fill.innerHTML = '';
    for (var j = 0; j < segments.length; j++) {
        var segEl = document.createElement('div');
        segEl.className = 'cell-fill-segment';
        segEl.style.backgroundColor = segments[j].color;
        segEl.style.width = segments[j].width + '%';
        fill.appendChild(segEl);
    }
}

// Найти цветовой профиль по id в массиве цветов снапшота.
function findColorById(colors, id) {
    if (!colors || id === null || id === undefined) return null;
    for (var i = 0; i < colors.length; i++) {
        if (colors[i].id === id) return colors[i];
    }
    return null;
}

// ===== РЕНДЕР СТОЛА И КНОПОК =====
export function renderTrainerTable() {
    var panel = document.querySelector('#trainerPage .table-panel');
    if (!panel) return;
    panel.innerHTML = '';

    var activeId = getActiveNodeId();
    var nodes = getTrainerNodes();
    var activeNode = nodes.find(function(n) { return n.id === activeId; }) || nodes[0];
    if (!activeNode) return;

    if (toggleMapNodeId !== activeId) { toggleMap.clear(); toggleMapNodeId = activeId; }

    var isTrainingActive = trainingActiveNodeId === activeId;
    var content = document.createElement('div');
    content.className = 'trainer-content-wrapper';

    // --- Левая колонка: стол + кнопки ---
    var leftCol = document.createElement('div');
    leftCol.className = 'trainer-table-col';

    var tableDiv = document.createElement('div');
    tableDiv.className = 'trainer-table-surface';
    var lbl = document.createElement('div'); lbl.className = 'trainer-table-label'; lbl.textContent = 'POKER TABLE'; tableDiv.appendChild(lbl);
    var chip = document.createElement('div'); chip.className = 'trainer-player-chip'; chip.textContent = 'HERO'; tableDiv.appendChild(chip);

    if (isTrainingActive) {
        var cc = document.createElement('div'); cc.className = 'trainer-cards-container'; tableDiv.appendChild(cc);
        renderCards(cc, activeNode.participation, activeNode.disabled);
    }
    leftCol.appendChild(tableDiv);

    var btnRow = document.createElement('div'); btnRow.className = 'trainer-action-buttons';
    if (isTrainingActive) {
        var sc = []; if (activeNode.colors) sc = activeNode.colors.filter(function(c) { return c.type === 'simple' || (!c.type && c.color); });
        var acts = sc.slice(0, 3).map(function(c) { return { name: c.name, color: c.color }; });
        acts.push({ name: 'Fold', color: '#5a5d66' });
        acts.forEach(function(a) {
            var b = document.createElement('button'); b.className = 'trainer-action-btn'; b.textContent = a.name;
            b.style.borderColor = a.color; b.style.color = '#a9afb5';
            b.addEventListener('mouseenter', function() { b.style.background = a.color + '18'; });
            b.addEventListener('mouseleave', function() { b.style.background = 'transparent'; });
            btnRow.appendChild(b);
        });
    } else {
        var sb = document.createElement('button'); sb.className = 'trainer-start-btn';
        sb.innerHTML = WAND_SVG + '<span>' + App.i18n.t('trainer.startTraining') + '</span>';
        sb.addEventListener('click', function() { trainingActiveNodeId = activeId; matrixVisible = false; renderTrainerTable(); });
        btnRow.appendChild(sb);
        var gridBtn = document.createElement('button'); gridBtn.className = 'trainer-grid-btn toolbar-btn' + (matrixVisible ? ' active' : '');
        gridBtn.innerHTML = GRID_SVG;
        gridBtn.setAttribute('data-tooltip', App.i18n.t('trainer.showRange'));
        gridBtn.addEventListener('click', function() { matrixVisible = !matrixVisible; renderTrainerTable(); });
        btnRow.appendChild(gridBtn);
    }
    leftCol.appendChild(btnRow);
    content.appendChild(leftCol);
    // --- Правая колонка: матрица (если видима) ---
    if (matrixVisible) {
        var rightCol = document.createElement('div');
        rightCol.className = 'trainer-matrix-col';

        var matrixGrid = document.createElement('div');
        matrixGrid.className = 'hands-grid trainer-matrix-grid';
        var rowsData = globalThis.rowsData;
        for (var r = 0; r < 13; r++) {
            for (var c = 0; c < 13; c++) {
                var cell = document.createElement('div');
                cell.className = 'hand-cell';
                cell.setAttribute('data-row', r);
                cell.setAttribute('data-col', c);
                if (matrixToggleMode) {
                    var isD = activeNode.disabled && activeNode.disabled[r] && activeNode.disabled[r][c];
                    var k = r + '_' + c;
                    var part = toggleMap.has(k) ? toggleMap.get(k) : (activeNode.participation && activeNode.participation[r] && activeNode.participation[r][c]);
                    if (isD) cell.classList.add('subrange-disabled');
                    else if (part) cell.classList.add('trainer-matrix-participating');
                    cell.addEventListener('click', function() {
                        var rr = Number(this.getAttribute('data-row')), cc = Number(this.getAttribute('data-col'));
                        var kk = rr + '_' + cc;
                        if (activeNode.disabled && activeNode.disabled[rr] && activeNode.disabled[rr][cc]) return;
                        var cur = toggleMap.has(kk) ? toggleMap.get(kk) : (activeNode.participation && activeNode.participation[rr] && activeNode.participation[cc]);
                        toggleMap.set(kk, !cur);
                        this.classList.toggle('trainer-matrix-participating');
                    });
                } else {
                    var pid = activeNode.matrix[r][c];
                    var prof = findColorById(activeNode.colors, pid);
                    if (prof) { applySnapshotFill(cell, prof, activeNode.colors); cell.style.color = '#FFF'; cell.style.textShadow = '0 1px 2px rgba(0,0,0,.45)'; }
                    if (activeNode.disabled && activeNode.disabled[r] && activeNode.disabled[r][c]) cell.classList.add('subrange-disabled');
                }
                var ts = document.createElement('span'); ts.textContent = rowsData[r][c]; ts.style.position = 'relative'; ts.style.zIndex = '2';
                cell.appendChild(ts);
                matrixGrid.appendChild(cell);
            }
        }
        rightCol.appendChild(matrixGrid);

        // Переключатели режимов
        var modes = document.createElement('div'); modes.className = 'trainer-matrix-modes';
        var cb = document.createElement('button'); cb.className = 'trainer-matrix-mode-btn toolbar-btn' + (!matrixToggleMode ? ' active' : '');
        cb.innerHTML = PALETTE_SVG; cb.setAttribute('data-tooltip', App.i18n.t('trainer.matrixColors'));
        cb.addEventListener('click', function() { matrixToggleMode = false; renderTrainerTable(); });
        var tb = document.createElement('button'); tb.className = 'trainer-matrix-mode-btn toolbar-btn' + (matrixToggleMode ? ' active' : '');
        tb.innerHTML = TOGGLE_SVG; tb.setAttribute('data-tooltip', App.i18n.t('trainer.matrixToggles'));
        tb.addEventListener('click', function() { matrixToggleMode = true; renderTrainerTable(); });
        modes.appendChild(cb); modes.appendChild(tb);
        rightCol.appendChild(modes);
        content.appendChild(rightCol);
    }

    panel.appendChild(content);
}