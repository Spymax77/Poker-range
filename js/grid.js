// ===== grid.js -- extracted from all.js (matrix render, cell style, tooltip) =====

// ===== ГЛОБАЛЬНАЯ ЛОГИКА ПРЕВЬЮ ДЛЯ GTO И РЕЖИМА АНАЛИЗА =====
// Хранит {row, col, nodeId} ячейки, закреплённой по клику. null — обычный
// режим показа по наведению. Логика общая для GTO и конструктора в анализе.
let gtoPinnedCell = null;
let constructorPinnedCell = null;

const GTO_PIN_SAFE_SELECTOR = '#gtoOverlayToggleBtn';
const CONSTRUCTOR_PIN_SAFE_SELECTOR = '#commentsToggleBtn, #constructorOverlayToggleBtn, #commentsWrapper';

function isPinSafeTarget(e, safeSelector) {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (path.length) {
        for (const node of path) {
            if (node instanceof Element && node.matches(safeSelector)) return true;
        }
        return false;
    }
    return e.target instanceof Element && !!e.target.closest(safeSelector);
}

function getMatrixPreviewContext(containerId) {
    if (containerId === 'gtoGrid') {
        return {
            branch: App.gto,
            matrixId: 'gtoGrid',
            previewId: 'gtoCellPreview',
            safeSelector: GTO_PIN_SAFE_SELECTOR,
            isModeActive: () => true,
            getPinnedCell: () => gtoPinnedCell,
            setPinnedCell: (value) => { gtoPinnedCell = value; },
            clearPinnedCell: () => {
                if (gtoPinnedCell) {
                    const oldCell = document.querySelector(
                        `#gtoGrid .hand-cell[data-row='${gtoPinnedCell.row}'][data-col='${gtoPinnedCell.col}']`
                    );
                    if (oldCell) oldCell.classList.remove('gto-cell-pinned');
                }
                gtoPinnedCell = null;
            }
        };
    }

    if (containerId === 'constructorGrid') {
        return {
            branch: App.editor,
            matrixId: 'constructorGrid',
            previewId: 'constructorCellPreview',
            safeSelector: CONSTRUCTOR_PIN_SAFE_SELECTOR,
            isModeActive: () => !!App.state.analysisMode,
            getPinnedCell: () => constructorPinnedCell,
            setPinnedCell: (value) => { constructorPinnedCell = value; },
            clearPinnedCell: () => {
                if (constructorPinnedCell) {
                    const oldCell = document.querySelector(
                        `#constructorGrid .hand-cell[data-row='${constructorPinnedCell.row}'][data-col='${constructorPinnedCell.col}']`
                    );
                    if (oldCell) oldCell.classList.remove('gto-cell-pinned');
                }
                constructorPinnedCell = null;
            }
        };
    }

    return null;
}

function clearPinnedCellPreview(containerId) {
    const ctx = getMatrixPreviewContext(containerId);
    if (!ctx) return;
    ctx.clearPinnedCell();
}

function unpinGtoCell() {
    clearPinnedCellPreview('gtoGrid');
}

function unpinConstructorCell() {
    clearPinnedCellPreview('constructorGrid');
}

function togglePinnedPreviewCell(cell, row, col, containerId) {
    const ctx = getMatrixPreviewContext(containerId);
    if (!ctx || !ctx.isModeActive()) return;

    const nodeId = ctx.branch.currentNodeId;
    const pinnedCell = ctx.getPinnedCell();
    if (pinnedCell && pinnedCell.row === row && pinnedCell.col === col && pinnedCell.nodeId === nodeId) {
        ctx.clearPinnedCell();
        return;
    }

    ctx.clearPinnedCell();
    ctx.setPinnedCell({ row, col, nodeId });
    cell.classList.add('gto-cell-pinned');
    showCellPreview(cell, row, col, ctx.branch, ctx.previewId);
}

function toggleGtoCellPin(cell, row, col) {
    togglePinnedPreviewCell(cell, row, col, 'gtoGrid');
}

function toggleConstructorCellPin(cell, row, col) {
    togglePinnedPreviewCell(cell, row, col, 'constructorGrid');
}

function handleOutsideMatrixPinClick(e) {
    const contexts = ['gtoGrid', 'constructorGrid']
        .map(getMatrixPreviewContext)
        .filter(Boolean);

    for (const ctx of contexts) {
        const pinnedCell = ctx.getPinnedCell();
        if (!pinnedCell) continue;
        if (isPinSafeTarget(e, ctx.safeSelector)) continue;
        const matrixEl = document.getElementById(ctx.matrixId);
        if (matrixEl && !matrixEl.contains(e.target)) {
            ctx.clearPinnedCell();
        }
    }
}

document.addEventListener('click', function(e) {
    handleOutsideMatrixPinClick(e);
});

function showDefaultMatrixPreview(containerId, nodeId) {
    const ctx = getMatrixPreviewContext(containerId);
    if (!ctx || !ctx.isModeActive()) return;
    if (ctx.getPinnedCell() && ctx.getPinnedCell().nodeId === nodeId) return;

    const matrixEl = document.getElementById(ctx.matrixId);
    if (!matrixEl) return;

    const defaultCell = matrixEl.querySelector(".hand-cell[data-row='0'][data-col='0']");
    if (!defaultCell) return;

    showCellPreview(defaultCell, 0, 0, ctx.branch, ctx.previewId);
}


function ensureTable(nodeId) {
    let tid = getTableId(nodeId);
    if (!App.state.cellStorage[tid]) App.state.cellStorage[tid] = Array(13).fill().map(() => Array(13).fill(null));
}

function getCellProfile(nodeId, r, c) {
    return App.state.cellStorage[getTableId(nodeId)]?.[r]?.[c] || null;
}

function setCellProfile(nodeId, r, c, pid, immediateSave = true) {
    ensureTable(nodeId);
    const tid = getTableId(nodeId);
    const old = App.state.cellStorage[tid][r][c];
    if (old === pid) return false;
    App.state.cellStorage[tid][r][c] = pid;
    return true;
}

function getParentRange(nodeId) {
    let node = getNode(nodeId);
    if (!node) return null;
    if (node.type === 'range') return node;
    if (node.type === 'subrange') {
        let current = node;
        while (current && current.type !== 'range') {
            current = getNode(current.parentId);
        }
        return current;
    }
    return null;
}

function renderGrid(containerId, nodeId, clickHandler) {
    const gridDiv = document.getElementById(containerId);
    if (!nodeId || !App.state.cellStorage[getTableId(nodeId)]) {
        gridDiv.innerHTML = "<div style='padding:20px'>Нет таблицы</div>";
        return;
    }
    const matrix = App.state.cellStorage[getTableId(nodeId)];
    gridDiv.innerHTML = "";

     const profiles = getColorsForNode(nodeId);
	     // ===== ПОЛУЧАЕМ ВЫБРАННЫЙ КОМПОНЕНТ ДЛЯ ПОДДИАПАЗОНА =====
    const currentNode = getNode(nodeId);
    let selectedComponentIndex = null;
    if (currentNode && currentNode.type === 'subrange') {
        selectedComponentIndex = currentNode.selectedComponentIndex !== undefined 
            ? currentNode.selectedComponentIndex 
            : null;
    }
	
for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
        const hand = rowsData[i][j];
        const pid = matrix[i][j];
        const prof = profiles.find(p => p.id === pid);

      // 1. Проверяем, является ли текущий узел поддиапазоном
let isSubrange = false;
if (currentNode) {
    isSubrange = currentNode.type === 'subrange';
}

// 2. Бинарная доступность
let isAvailable = true;
if (isSubrange) {
    const cellAvail = getCellAvailabilityPercent(nodeId, i, j);
    isAvailable = cellAvail > 0;
}

// 3. Процент закраски в родительской ячейке (для псевдоэлемента)
// ВАЖНО: используем каскадный (recursive = true) расчёт, а не только
// доступность прямого родителя. Если у родительского поддиапазона сама
// ячейка уже частично недоступна (у него есть свой оверлей), эта
// недоступность должна накапливаться при построении следующего
// поддиапазона (например: родитель доступен на 50%, в нём закрашено ещё
// 50% → итоговая доступность 25%, оверлей 75%).
let availabilityPercent = 100;
if (isSubrange && isAvailable) {
    availabilityPercent = getCellAvailabilityPercent(nodeId, i, j, true);
}

// Если ячейка закрашена, но недоступна → очищаем (старая логика)
if (isSubrange && pid !== null && !isAvailable) {
    const currentTableId = getTableId(nodeId);
    if (App.state.cellStorage[currentTableId]) {
        App.state.cellStorage[currentTableId][i][j] = null;
    }
}

        // 3. Создаём ячейку
        const cell = document.createElement("div");
        cell.className = "hand-cell";
        cell.setAttribute("data-row", i);
        cell.setAttribute("data-col", j);
		// ===== ЧАСТИЧНАЯ ДОСТУПНОСТЬ (ОТДЕЛЬНЫЙ БЛОК) =====
if (i === 9 && j === 0) {
   
}

		

        // 4. Если ячейка недоступна — добавляем класс
        if (!isAvailable) {
            cell.classList.add('subrange-disabled');
        }

        cell.justChanged = false;
        let cellKey = `${i}_${j}`;
        cell.blockUntil = App.state.blockUntilMap.get(cellKey) || 0;

        let isColored = false;
        let originalGradient = null;
        let originalBg = null;
        let originalColor = null;
        let justCleared = false;

if (prof) {
    let gradStyle = getGradientStyleFromColorForNode(nodeId, prof);
    if (gradStyle) {
        originalGradient = gradStyle + "; color: #FFFFFF; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6), 0 0 8px rgba(0, 0, 0, 0.3);";
        cell.setAttribute("style", originalGradient);
        isColored = true;
    } else {
        originalBg = "var(--bg-card)";
    }
} else {
    originalBg = "var(--bg-card)";
}

cell.onmouseenter = () => {
    if (Date.now() < cell.blockUntil) {
        return;
    }
    if (containerId === "constructorGrid" && !App.state.analysisMode && !App.state.painting && !cell.justChanged) {
        const activeProfileId = getActiveForNode(nodeId);
        const currentPid = getCellProfile(nodeId, i, j);
        
        // Если ячейка уже содержит активный профиль → затемнение
        if (currentPid === activeProfileId) {
            requestAnimationFrame(() => {
                cell.removeAttribute("style");
                cell.style.opacity = "0.7";
                cell.style.color = "#FFFFFF";
            });
        } else if (activeProfileId) {
            // Во всех остальных случаях (пустая ИЛИ с другим профилем) → превью активного профиля
            const activeProf = getColorsForNode(nodeId).find(p => p.id === activeProfileId);
            if (activeProf) {
                let gradStyle = getGradientStyleFromColorForNode(nodeId, activeProf);
                requestAnimationFrame(() => {
                    cell.setAttribute("style", gradStyle + "; color: #FFFFFF; filter: brightness(0.7); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6), 0 0 8px rgba(0, 0, 0, 0.3);");
                });
            }
        }
    }
};

          cell.onmouseleave = () => {
    if (!App.state.painting) {
        requestAnimationFrame(() => {
            if (isColored && originalGradient) {
                cell.setAttribute("style", originalGradient);
            } else {
                cell.removeAttribute("style");
            }
            // Восстанавливаем clip-height
            if (cell.dataset.clipHeight) {
                cell.style.setProperty('--clip-height', cell.dataset.clipHeight + '%');
            }
            cell.justChanged = false;
            let cellKey = `${i}_${j}`;
            App.state.blockUntilMap.set(cellKey, 0);
            cell.blockUntil = 0;
        });
    }
};

            const textSpan = document.createElement('span');
textSpan.textContent = hand;
textSpan.style.position = 'relative';
textSpan.style.zIndex = '2';
cell.appendChild(textSpan);
			if (isSubrange && isAvailable && availabilityPercent < 100) {
    const clipHeight = 100 - availabilityPercent;
    const overlay = document.createElement('div');
    overlay.className = 'cell-overlay';
    overlay.style.cssText = `

        height: ${clipHeight}%;
        
    `;
    cell.appendChild(overlay);
}
			           // Добавляем атрибуты для тултипа
cell.setAttribute('data-hand', hand);
if (pid !== null) {
    cell.setAttribute('data-profile-id', pid);
}

// ✅ ТОЛЬКО ДЛЯ РЕЖИМА ПРОСМОТРА
if (containerId === "workGrid") {
    // Обработчики для тултипа
    cell.addEventListener('mouseenter', function(e) {
        const profileId = this.getAttribute('data-profile-id');
        if (profileId) {
            const hand = this.getAttribute('data-hand');
            showTooltip(e, hand, parseInt(profileId));
        }
    });

    cell.addEventListener('mouseleave', function(e) {
        hideTooltip();
    });
}

// Универсальные обработчики для GTO и анализа конструктора: превью
// всегда остаётся видимым после mouseleave, обновляется при hover, а клик
// фиксирует ячейку золотой рамкой. Логика вынесена в общие функции и
// применяется к обеим матрицам без дублирования.
const previewMatrixIds = ['gtoGrid', 'constructorGrid'];
if (previewMatrixIds.includes(containerId)) {
    const ctx = getMatrixPreviewContext(containerId);
    if (ctx) {
        cell.addEventListener('mouseenter', function(e) {
            if (!ctx.isModeActive()) return;
            if (ctx.getPinnedCell()) return;
            const row = parseInt(this.getAttribute('data-row'));
            const col = parseInt(this.getAttribute('data-col'));
            showCellPreview(this, row, col, ctx.branch, ctx.previewId);
        });

        cell.addEventListener('mouseleave', function(e) {
            if (!ctx.isModeActive()) return;
            if (ctx.getPinnedCell()) return;
            // Не скрываем превью при уходе мыши: блок должен оставаться на экране
            // и обновляться при следующем hover. По умолчанию показываем AA.
        });

        cell.addEventListener('click', function(e) {
            if (!ctx.isModeActive()) return;
            const row = parseInt(this.getAttribute('data-row'));
            const col = parseInt(this.getAttribute('data-col'));
            togglePinnedPreviewCell(this, row, col, containerId);
        });
    }
}

                     gridDiv.appendChild(cell);
        }
    }

    // ===== GTO: восстановление рамки закреплённой ячейки после перерисовки =====
    // renderGrid полностью пересобирает innerHTML (например, при раскрытии/
    // сворачивании дерева через refreshTreeOnly → renderGtoPage), поэтому DOM-
    // класс .gto-cell-pinned теряется, даже когда сам стейт закрепления
    // (gtoPinnedCell) остаётся актуальным. Восстанавливаем класс на нужной
    // ячейке, если закрепление относится к текущему отрисованному диапазону.
    if (containerId === "gtoGrid" && gtoPinnedCell && gtoPinnedCell.nodeId === nodeId) {
        const pinnedCellEl = gridDiv.querySelector(
            `.hand-cell[data-row='${gtoPinnedCell.row}'][data-col='${gtoPinnedCell.col}']`
        );
        if (pinnedCellEl) pinnedCellEl.classList.add('gto-cell-pinned');
    }

    // ===== КОНСТРУКТОР (АНАЛИЗ): восстановление рамки закреплённой ячейки после перерисовки =====
    if (containerId === "constructorGrid" && constructorPinnedCell && constructorPinnedCell.nodeId === nodeId) {
        const pinnedCellEl = gridDiv.querySelector(
            `.hand-cell[data-row='${constructorPinnedCell.row}'][data-col='${constructorPinnedCell.col}']`
        );
        if (pinnedCellEl) pinnedCellEl.classList.add('gto-cell-pinned');
    }

    // Превью всегда показывается: по умолчанию — AA, при hover обновляется,
    // а при клике остаётся на закреплённой ячейке до следующего сброса.
    if (containerId === 'gtoGrid' || (containerId === 'constructorGrid' && App.state.analysisMode)) {
        showDefaultMatrixPreview(containerId, nodeId);
    }
}

// ===== СТАТИСТИКА ПО ЦВЕТАМ (общие вычисления) =====
// Универсальная функция: работает с любой ветки данных (branch) — App.gto или
// App.editor. Используется и текстовой статистикой под матрицей (updateGtoStats),
// и цветным блоком-легендой справа от матрицы (renderActionLegend), и в GTO,
// и в режиме "Анализ" конструктора.
function computeColorStats(nodeId, branch) {
    if (!nodeId || !branch) return null;

    const tid = getTableId(nodeId);
    const matrix = branch.cellStorage[tid];
    const colors = branch.colorsPerNode[tid] || [];

    if (!matrix) return null;

    // ===== ОПРЕДЕЛЯЕМ, ЯВЛЯЕТСЯ ЛИ УЗЕЛ ПОДДИАПАЗОНОМ =====
    const currentNode = (branch.nodes || []).find(n => n.id === nodeId);
    const isSubrange = currentNode && currentNode.type === 'subrange';
    let parentMatrix = null;
    let parentColors = null;
    let selectedComponentIndex = null;

    if (isSubrange && currentNode.parentId !== null) {
        const parentTableId = getTableId(currentNode.parentId);
        parentMatrix = branch.cellStorage[parentTableId];
        parentColors = branch.colorsPerNode[parentTableId] || [];
        selectedComponentIndex = currentNode.selectedComponentIndex !== undefined ? currentNode.selectedComponentIndex : null;
    }

    // Собираем статистику по цветам
    const colorStats = {};
    let totalCombosSum = 0;
    let foldCombos = 0;

    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const pid = matrix[i][j];

            const hand = rowsData[i][j];
            let handTotalCombos = 0;
            if (hand.includes('s')) handTotalCombos = 4;
            else if (hand.includes('o')) handTotalCombos = 12;
            else if (hand[0] === hand[1]) handTotalCombos = 6;

            // ===== УЧИТЫВАЕМ РОДИТЕЛЬСКУЮ ЗАКРАСКУ ДЛЯ ПОДДИАПАЗОНОВ =====
            let adjustedCombos = handTotalCombos;
            if (isSubrange && parentMatrix) {
                const parentPid = parentMatrix[i][j];

                if (parentPid === null) {
                    continue;
                }

                const parentColor = parentColors.find(c => c.id === parentPid);
                if (!parentColor) {
                    continue;
                }

                let parentShare = 0;

                if (parentColor.type === 'simple' || (!parentColor.type && parentColor.color)) {
                    if (selectedComponentIndex !== null) {
                        const simpleColors = parentColors.filter(c => c.type === 'simple' || (!c.type && c.color));
                        const selectedSimpleColor = simpleColors[selectedComponentIndex];
                        if (selectedSimpleColor && parentPid === selectedSimpleColor.id) {
                            parentShare = 100;
                        } else {
                            continue;
                        }
                    } else {
                        parentShare = 100;
                    }
                } else if (parentColor.type === 'multi' && parentColor.components) {
                    if (selectedComponentIndex !== null) {
                        const simpleColors = parentColors.filter(c => c.type === 'simple' || (!c.type && c.color));
                        const selectedSimpleColor = simpleColors[selectedComponentIndex];
                        if (selectedSimpleColor) {
                            const matchedComp = parentColor.components.find(comp => comp.colorId === selectedSimpleColor.id);
                            if (matchedComp) {
                                parentShare = Math.min(100, matchedComp.share || 0);
                            } else {
                                continue;
                            }
                        } else {
                            continue;
                        }
                    } else {
                        let totalShare = 0;
                        for (const comp of parentColor.components) {
                            totalShare += comp.share || 0;
                        }
                        parentShare = Math.min(100, totalShare);
                    }
                }

                if (parentShare === 0) {
                    continue;
                }

                adjustedCombos = handTotalCombos * (parentShare / 100);
            }

            if (pid === null) {
                foldCombos += adjustedCombos;
                continue;
            }

            const prof = colors.find(c => c.id === pid);
            if (!prof) {
                foldCombos += adjustedCombos;
                continue;
            }

            let components = [];
            let boundaries = [];

            if (prof.type === 'simple' || (!prof.type && prof.color)) {
                components = [{ colorId: prof.id, share: 100 }];
                boundaries = [100];
            } else if (prof.type === 'multi' && prof.components) {
                components = prof.components;
                boundaries = prof.boundaries || [];
            }

            let prev = 0;
            for (let k = 0; k < components.length; k++) {
                const comp = components[k];
                const share = (boundaries[k] - prev) / 100;
                const combosShare = Math.round((adjustedCombos * share) * 10) / 10;

                const simpleProf = colors.find(c => c.id === comp.colorId);
                if (!simpleProf) continue;

                const key = `profile_${simpleProf.id}`;
                if (!colorStats[key]) {
                    colorStats[key] = {
                        combos: 0,
                        color: simpleProf.color,
                        name: simpleProf.name
                    };
                }
                colorStats[key].combos += combosShare;
                prev = boundaries[k];
            }

            // Оставшаяся непокрытая часть → fold
            if (prev < 100) {
                foldCombos += adjustedCombos * ((100 - prev) / 100);
            }
        }
    }

    // Суммируем
    for (const data of Object.values(colorStats)) {
        totalCombosSum += data.combos;
    }

    const sorted = Object.entries(colorStats).sort((a, b) => b[1].combos - a[1].combos);
    const totalPercent = (totalCombosSum / 1326 * 100);

    return {
        sorted,               // [[key, {combos, color, name}], ...] отсортировано по убыванию
        totalCombosSum,
        totalPercent,
        foldCombos,
        foldPercent: (foldCombos / 1326 * 100)
    };
}

// ===== СТАТИСТИКА GTO (текстовая таблица под матрицей) =====
function updateGtoStats(nodeId) {
    const statsEl = document.getElementById("gtoStatsContainer");
    if (!statsEl || !nodeId) return;

    const stats = computeColorStats(nodeId, App.gto);
    if (!stats) {
        statsEl.innerHTML = '<div style="color: var(--text-muted);">Нет данных</div>';
        return;
    }

    const { sorted, totalCombosSum, totalPercent, foldCombos, foldPercent } = stats;

    // Строим таблицу
    let html = `<div style="display: inline-block; min-width: 220px;">
        <table style="width: auto; border-collapse: collapse; font-size: 13px;">
            <tbody>
                <tr>
                    <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;"></td>
                    <td colspan="2" style="padding: 2px 8px 2px 0; text-align: right; min-width: 60px; font-weight: 600;">
                        ${totalPercent.toFixed(1)}%
                    </td>
                    <td style="padding: 2px 0; text-align: right; min-width: 80px; font-weight: 600;">
                        (${formatCombos(totalCombosSum)}/1326)
                    </td>
                </tr>`;

    for (const [key, data] of sorted) {
        const percent = (data.combos / 1326 * 100).toFixed(1);
        html += `<tr>
            <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;">
                <span style="display: inline-block; width: 15px; height: 13px; background: ${data.color}; border-radius: 3px;"></span>
            </td>
            <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 60px;">
                ${data.name}
            </td>
            <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 50px;">
                ${percent}%
            </td>
            <td style="padding: 2px 0; text-align: right; min-width: 80px;">
                (${formatCombos(data.combos)}/1326)
            </td>
        </tr>`;
    }

// Fold (незакрашенные)
    html += `<tr>
        <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;">
            <span style="display: inline-block; width: 15px; height: 13px; background: #313338; border-radius: 3px; border: 1px solid #3d3f46;"></span>
        </td>
        <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 60px;">
            Fold
        </td>
        <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 50px;">
            ${foldPercent.toFixed(1)}%
        </td>
        <td style="padding: 2px 0; text-align: right; min-width: 80px;">
            (${formatCombos(foldCombos)}/1326)
        </td>
    </tr>`;
    html += `</tbody></table></div>`;
    statsEl.innerHTML = html;
    statsEl.style.textAlign = 'right';
}

// ===== ЦВЕТНОЙ БЛОК-ЛЕГЕНДА СПРАВА ОТ МАТРИЦЫ =====
// Показывает те же действия, что и текстовая статистика под матрицей
// (действия + fold), в виде равных по ширине цветных подблоков.
// В каждом подблоке: название действия (верх-лево), % рук (низ-лево) и
// количество комбо (низ-право).
//
// ВАЖНО про % рук: он считается не от 1326, а от количества рук, которые
// "дошли" до текущего узла с предыдущего уровня. Для корневого диапазона
// это все 1326 комбинаций, а для поддиапазона — только те руки, что попали
// в него из выбранного действия родителя (например, если рейз родителя был
// 17.9% / 237 рук, то весь рейз+колл+фолд ВНУТРИ этого поддиапазона считается
// от 237, а не от 1326). computeColorStats уже учитывает родительскую
// закраску (parentShare) при подсчёте totalCombosSum/foldCombos именно этого
// узла, поэтому их сумма и есть искомая база — сколько рук "пришло" на этот
// уровень.
//
// Универсальная: branch — ветка данных (App.gto / App.editor), containerId —
// id DOM-контейнера легенды ('gtoActionLegend' / 'constructorActionLegend').
function renderActionLegend(nodeId, branch, containerId) {
    const legendEl = document.getElementById(containerId);
    if (!legendEl) return;

    legendEl.innerHTML = '';

    const stats = computeColorStats(nodeId, branch);
    if (!stats) return;

    const { sorted, foldCombos, totalCombosSum } = stats;

    // База для % — сколько комбо всего "пришло" на этот узел (действия + fold).
    const baseCombos = totalCombosSum + foldCombos;

    // Собираем список подблоков: сначала закрашенные действия (в том же
    // порядке, что и в статистике под матрицей), затем Fold — если есть.
    const blocks = sorted.map(([key, data]) => ({ color: data.color, name: data.name, combos: data.combos }));
    if (foldCombos > 0) {
        blocks.push({ color: '#313338', name: 'Fold', combos: foldCombos, isFold: true });
    }

    if (blocks.length === 0) return;

    blocks.forEach(block => {
        const div = document.createElement('div');
        div.className = 'gto-action-legend-block';
        div.style.background = block.color;
        if (block.isFold) {
            div.classList.add('gto-action-legend-block--fold');
        }

        const percent = baseCombos > 0 ? (block.combos / baseCombos * 100) : 0;

        const nameEl = document.createElement('div');
        nameEl.className = 'gto-action-legend-block__name';
        nameEl.textContent = block.name;

        const bottomEl = document.createElement('div');
        bottomEl.className = 'gto-action-legend-block__bottom';

        const percentEl = document.createElement('span');
        percentEl.className = 'gto-action-legend-block__percent';
        percentEl.textContent = `${percent.toFixed(1)}%`;

        const combosEl = document.createElement('span');
        combosEl.className = 'gto-action-legend-block__combos';

        const combosNumberEl = document.createElement('span');
        combosNumberEl.className = 'gto-action-legend-block__combos-number';
        combosNumberEl.textContent = formatCombos(block.combos);

        const combosLabelEl = document.createElement('span');
        combosLabelEl.className = 'gto-action-legend-block__combos-label';
        combosLabelEl.textContent = 'combos';

        combosEl.appendChild(combosNumberEl);
        combosEl.appendChild(combosLabelEl);

        bottomEl.appendChild(percentEl);
        bottomEl.appendChild(combosEl);

        div.appendChild(nameEl);
        div.appendChild(bottomEl);

        legendEl.appendChild(div);
    });
}

// ===== ACTION BAR (полоса долей действий по комбо, между легендой и превью) =====
// Использует те же данные, что и renderActionLegend, но рисует их как
// одну горизонтальную полосу шириной 100% (490px), поделённую на цветные
// сегменты пропорционально доле каждого действия (в комбо) от общего числа
// комбо, пришедших на этот узел (действия + fold).
//
// Универсальная: branch — ветка данных (App.gto / App.editor), containerId —
// id DOM-контейнера полосы ('gtoActionBar' / 'constructorActionBar').
function renderActionBar(nodeId, branch, containerId) {
    const barEl = document.getElementById(containerId);
    if (!barEl) return;

    const stats = computeColorStats(nodeId, branch);
    if (!stats) {
        barEl.style.background = '';
        return;
    }

    const { sorted, foldCombos, totalCombosSum } = stats;
    const baseCombos = totalCombosSum + foldCombos;

    // Тот же порядок блоков, что и в легенде: действия, затем Fold.
    const blocks = sorted.map(([key, data]) => ({ color: data.color, combos: data.combos }));
    if (foldCombos > 0) {
        blocks.push({ color: '#313338', combos: foldCombos });
    }

    if (blocks.length === 0 || baseCombos <= 0) {
        barEl.style.background = '';
        return;
    }

    let stops = [];
    let prevPos = 0;
    for (const block of blocks) {
        const percent = (block.combos / baseCombos) * 100;
        const pos = Math.round((prevPos + percent) * 10) / 10;
        stops.push(`${block.color} ${prevPos}%, ${block.color} ${pos}%`);
        prevPos = pos;
    }

    barEl.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
}

// ===== РЕЖИМ АНАЛИЗА КОНСТРУКТОРА: ОБРАБОТЧИКИ КНОПОК И РЕНДЕР =====
// Слушатели для "Редактор" / "Анализ" кнопок устанавливаются в init.js после загрузки DOM.
// Рендер легенды/полосы/превью для конструктора вызывается из refreshConstructorAnalysisMode() ниже,
// который, в свою очередь, вызывается из переключателей режима и из updateCurrentDisplay().

// ===== ТУЛБАР ТАБЛИЦЫ: КНОПКИ РЕДАКТИРОВАНИЯ В РЕЖИМЕ АНАЛИЗА =====
// В режиме анализа матрица конструктора только читается (рисование отключено в
// paint.js, клик по ячейке лишь закрепляет превью), поэтому все действия,
// меняющие диапазон, гасим — как кнопку "Вставить" при пустом буфере обмена.
// Гашение делает класс .toolbar-btn-disabled: opacity 0.4 + pointer-events: none,
// то есть кнопка не кликается и не показывает тултип.
const CONSTRUCTOR_EDIT_BUTTON_IDS = [
    'tableSaveBtn',
    'tableUndoBtn',
    'tableClearBtn',
    'tableCopyBtn',
    'tablePasteBtn',
    'importRangeBtn'
];

function updateConstructorToolbarState() {
    const isAnalysis = !!App.state.analysisMode;
    CONSTRUCTOR_EDIT_BUTTON_IDS.forEach(id => {
        document.getElementById(id)?.classList.toggle('toolbar-btn-disabled', isAnalysis);
    });

    // Конечное состояние "Вставить" всегда определяет updatePasteButtonState
    // (clipboard.js): она учитывает и режим анализа, и наличие скопированных
    // данных, поэтому при выходе из анализа кнопка не "загорится" с пустым буфером.
    if (typeof updatePasteButtonState === 'function') updatePasteButtonState();
}

function refreshConstructorAnalysisMode() {
    // Синхронизируем класс страницы и активную кнопку с текущим значением
    // App.state.analysisMode. Вынесено сюда (а не только в обработчики кликов
    // editorModeBtn/analysisModeBtn), чтобы состояние корректно восстанавливалось
    // после перезагрузки страницы (F5) и при возврате на вкладку конструктора —
    // единственный источник истины теперь App.state.analysisMode.
    const isAnalysis = !!App.state.analysisMode;
    document.getElementById('constructorPage')?.classList.toggle('analysis-mode', isAnalysis);
    document.getElementById('editorModeBtn')?.classList.toggle('active', !isAnalysis);
    document.getElementById('analysisModeBtn')?.classList.toggle('active', isAnalysis);

    // Кнопки редактирования диапазона в тулбаре таблицы гасим/возвращаем вместе
    // с режимом (см. updateConstructorToolbarState выше).
    updateConstructorToolbarState();

    if (isAnalysis) {
        renderActionLegend(App.editor.currentNodeId, App.editor, 'constructorActionLegend');
        renderActionBar(App.editor.currentNodeId, App.editor, 'constructorActionBar');
        showDefaultMatrixPreview('constructorGrid', App.state.currentNodeId);
    } else {
        const legendEl = document.getElementById("constructorActionLegend");
        if (legendEl) legendEl.innerHTML = '';
        const barEl = document.getElementById("constructorActionBar");
        if (barEl) barEl.style.background = '';
        hideCellPreview('constructorCellPreview');
        unpinConstructorCell();
    }
}

function updateCurrentDisplay() {
    if (!App.state.currentNodeId) return;
    let total = countTotalCombos(App.state.currentNodeId);
	  // ===== ОБНОВЛЯЕМ НАЗВАНИЕ ДИАПАЗОНА =====
    const nameEl = document.getElementById("currentRangeName");
    if (nameEl) {
        const node = getNode(App.state.currentNodeId);
        if (node) {
            nameEl.textContent = node.name;
        }
    }

    renderGrid("constructorGrid", App.state.currentNodeId, null);
    
    refreshConstructorAnalysisMode();

    let statsContainer = document.getElementById("profileStats");
    if (!statsContainer) {
        statsContainer = document.createElement("div");
        statsContainer.id = "profileStats";
        statsContainer.style.marginTop = "10px";
        statsContainer.style.fontSize = "13px";
        statsContainer.style.lineHeight = "1.4";
        statsContainer.style.display = "flex";
        statsContainer.style.justifyContent = "flex-end";
        // ВАЖНО: вкладываем в .constructor-matrix-col (а не в .table-panel),
        // чтобы ширина блока статистики всегда совпадала с шириной колонки
        // матрицы, а не с шириной всего .table-panel (который в режиме
        // анализа расширяется за счёт .constructor-legend-col). Так же
        // сделано на странице GTO — gtoStatsContainer лежит внутри
        // .gto-matrix-col, а не в .table-panel.
        const matrixCol = document.querySelector(".constructor-matrix-col");
        if (matrixCol) matrixCol.appendChild(statsContainer);
    }

const colorStats = {};
let totalCombosWeighted = 0;
const matrix = App.state.cellStorage[getTableId(App.state.currentNodeId)];
if (matrix) {
    const profiles = getColorsForNode(App.state.currentNodeId);
    
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const pid = matrix[i][j];
            if (pid === null) continue;
            const prof = profiles.find(p => p.id === pid);
            if (!prof) continue;

            const hand = rowsData[i][j];
            let handTotalCombos = 0;
            if (hand.includes('s')) handTotalCombos = 4;
            else if (hand.includes('o')) handTotalCombos = 12;
            else if (hand[0] === hand[1]) handTotalCombos = 6;

            // Учитываем доступность ячейки для поддиапазона
            const availability = getCellAvailabilityPercent(App.state.currentNodeId, i, j);
            if (availability <= 0) continue;
            handTotalCombos = handTotalCombos * (availability / 100);

            // Получаем компоненты профиля
            let components = [];
            let boundaries = [];

            if (prof.type === 'simple' || (!prof.type && prof.color)) {
                // Простой профиль: один компонент (сам себя)
                components = [{ colorId: prof.id, share: 100 }];
                boundaries = [100];
            } else if (prof.type === 'multi' && prof.components) {
                // Мультипрофиль: несколько компонентов
                components = prof.components;
                boundaries = prof.boundaries || [];
            }

            // Проходим по каждому компоненту мультипрофиля
            let prev = 0;
            for (let k = 0; k < components.length; k++) {
                const comp = components[k];
                const share = (boundaries[k] - prev) / 100;
                const combosShare = Math.round((handTotalCombos * share) * 10) / 10;
                
                // Находим одноцветный профиль для этого компонента
                const simpleProf = profiles.find(p => p.id === comp.colorId);
                if (!simpleProf) continue;

                // Используем ID одноцветного профиля как ключ
                const profileKey = `profile_${simpleProf.id}`;
                if (!colorStats[profileKey]) {
                    colorStats[profileKey] = { 
                        combos: 0, 
                        color: simpleProf.color,
                        name: simpleProf.name
                    };
                }
                colorStats[profileKey].combos += combosShare;
                totalCombosWeighted += combosShare;
                prev = boundaries[k];
            }
        }
    }
}
            if (statsContainer && totalCombosWeighted > 0) {
    // Сортируем цвета по убыванию комбинаций
    const sortedEntries = Object.entries(colorStats).sort((a, b) => b[1].combos - a[1].combos);
    
    let rows = [];
    let totalPercentSum = 0;
    let totalCombosSum = 0;
    
    for (const [key, data] of sortedEntries) {
        const percent = (data.combos / 1326 * 100).toFixed(1);
        totalPercentSum += parseFloat(percent);
        totalCombosSum += data.combos;
        rows.push({
            color: data.color,
            percent: percent,
            combos: data.combos
        });
    }
    
    //let emptyCombos = 1326 - totalCombosWeighted;
    //let emptyPercent = (emptyCombos / 1326 * 100).toFixed(1);
    
    // ===== ТАБЛИЦА С 3 КОЛОНКАМИ =====
    let html = `<div style="display: inline-block; min-width: 180px;">
        <table style="width: auto; border-collapse: collapse; font-size: 13px;">
            <tbody>`;
    
    // Первая строка — сумма закрашенных (БЕЗ квадратика, БЕЗ линий, обычный шрифт)
    html += `<tr>
        <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;"></td>
        <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 70px; font-weight: 600;">
            ${totalPercentSum.toFixed(1)}%
        </td>
        <td style="padding: 2px 0; text-align: right; min-width: 80px; font-weight: 600;">
            (${formatCombos(totalCombosSum)}/1326)
        </td>
    </tr>`;
    
    // Цветные строки
    for (const row of rows) {
        html += `<tr>
            <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;">
                <span style="display: inline-block; width: 15px; height: 13px; background: ${row.color}; border-radius: 3px;"></span>
            </td>
            <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 70px;">
                ${row.percent}%
            </td>
            <td style="padding: 2px 0; text-align: right; min-width: 80px;">
                (${formatCombos(row.combos)}/1326)
            </td>
        </tr>`;
    }
    
    // Незакрашенные (последние)
    //html += `<tr>
        // <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;">
             //<span style="display: inline-block; width: 15px; height: 13px; background: #313338; border-radius: 3px; border: 1px solid #3d3f46;"></span>
         //</td>
        // <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 70px;">
             //${emptyPercent}%
         //</td>
         //<td style="padding: 2px 0; text-align: right; min-width: 80px;">
             //(${formatCombos(emptyCombos)}/1326)
         //</td>
     //</tr>`;
    
    html += `</tbody></table></div>`;
    statsContainer.innerHTML = html;
}
	else if (statsContainer) {
        statsContainer.innerHTML = `<div style="color: var(--text-muted);">Нет установленных диапазонов</div>`;
    }
    
    // ===== ИКОНКА КОММЕНТАРИЕВ (ФИКСИРОВАННАЯ) =====
// Вставляем иконку в тот же контейнер, где матрица
if (App.currentMode !== 'gto') {
    const gridWrapper = document.querySelector('.matrix-wrapper');
    if (gridWrapper) {
        let iconBtn = document.getElementById('commentsToggleBtn');
    if (!iconBtn) {
        iconBtn = document.createElement('button');
        iconBtn.id = 'commentsToggleBtn';
        iconBtn.className = 'comments-toggle-btn matrix-btn';
        iconBtn.title = 'Комментарии';
        iconBtn.style.position = 'absolute';
        iconBtn.style.bottom = '-32px';
        iconBtn.style.left = '0px';
        iconBtn.style.background = 'transparent';
        iconBtn.style.border = 'none';
        iconBtn.style.padding = '4px 8px';
        iconBtn.style.cursor = 'pointer';
        iconBtn.style.borderRadius = '4px';
        iconBtn.style.zIndex = '10';
        iconBtn.style.display = 'flex';
        iconBtn.style.alignItems = 'center';
        iconBtn.style.justifyContent = 'center';
        iconBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 32 32" fill="#8a848a" xmlns="http://www.w3.org/2000/svg">
                <path d="M25.7,9.3l-7-7A.9078.9078,0,0,0,18,2H8A2.0059,2.0059,0,0,0,6,4V28a2.0059,2.0059,0,0,0,2,2H24a2.0059,2.0059,0,0,0,2-2V10A.9078.9078,0,0,0,25.7,9.3ZM18,4.4,23.6,10H18ZM24,28H8V4h8v6a2.0059,2.0059,0,0,0,2,2h6Z"/>
                <rect data-name="&lt;Transparent Rectangle&gt;" class="cls-1" fill="none"/>
            </svg>
        `;
        
        // Делаем wrapper относительным для позиционирования иконки
        gridWrapper.style.position = 'relative';
        gridWrapper.appendChild(iconBtn);
        
        // Вешаем обработчик
        iconBtn.addEventListener('click', toggleComments);
    }
}
}
    
    // ===== КНОПКА: ПОКАЗАТЬ/СКРЫТЬ ОВЕРЛЕИ ПОДДИАПАЗОНОВ (КОНСТРУКТОР) =====
    const constructorWrapper = document.querySelector('.table-panel .matrix-wrapper');
    if (constructorWrapper) {
        const node = getNode(App.state.currentNodeId);
        const isSubrange = node && node.type === 'subrange';
        let overlayBtn = document.getElementById('constructorOverlayToggleBtn');
        if (isSubrange) {
            if (!overlayBtn) {
                constructorWrapper.style.position = 'relative';
                overlayBtn = document.createElement('button');
                overlayBtn.id = 'constructorOverlayToggleBtn';
                overlayBtn.className = 'matrix-btn';
                overlayBtn.dataset.tooltip = 'высота диапазона';
                overlayBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="2" width="20" height="20" rx="1" />
                        <rect x="2" y="12" width="20" height="10" fill="currentColor" stroke="none" rx="1" />
                    </svg>
                `;
                constructorWrapper.appendChild(overlayBtn);
                overlayBtn.addEventListener('click', function() {
                    const wrapper = document.querySelector('.table-panel .matrix-wrapper');
                    if (wrapper) {
                        const isHidden = wrapper.classList.toggle('hide-subrange-overlays');
                        overlayBtn.innerHTML = isHidden
                            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="2" width="20" height="20" rx="1" fill="currentColor" stroke="none" />
                               </svg>`
                            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="2" width="20" height="20" rx="1" />
                                <rect x="2" y="12" width="20" height="10" fill="currentColor" stroke="none" rx="1" />
                               </svg>`;
                        overlayBtn.dataset.tooltip = isHidden ? 'полная высота' : 'высота диапазона';
                    }
                });
            }
            overlayBtn.style.display = 'flex';
        } else {
            if (overlayBtn) overlayBtn.style.display = 'none';
        }
    }

// ===== ПОЛЕ ДЛЯ КОММЕНТАРИЕВ (ПОД СТАТИСТИКОЙ) =====
let commentsWrapper = document.getElementById('commentsWrapper');
if (!commentsWrapper) {
    commentsWrapper = document.createElement('div');
    commentsWrapper.id = 'commentsWrapper';
    commentsWrapper.className = 'comments-wrapper';
    commentsWrapper.style.width = '100%';
    commentsWrapper.style.maxWidth = '530px';
    commentsWrapper.style.marginTop = '8px';
    
    const area = document.createElement('div');
    area.className = 'comments-area';
    area.id = 'commentsArea';
    area.style.display = 'none';
    area.style.width = '100%';
    area.style.borderRadius = '6px';
    area.style.border = '1px solid #3d3f46';
    area.style.background = '#2d2f34';
    area.style.overflow = 'hidden';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'commentsTextarea';
    textarea.placeholder = 'Комментарий к диапазону...';
    textarea.maxLength = 2000;
    textarea.style.width = '100%';
    textarea.style.height = '100px';
    textarea.style.minHeight = '100px';
    textarea.style.maxHeight = '300px';
    textarea.style.background = 'transparent';
    textarea.style.border = 'none';
    textarea.style.color = '#e5eaf0';
    textarea.style.fontSize = '13px';
    textarea.style.fontFamily = "'Roboto', 'Helvetica Neue', sans-serif";
    textarea.style.padding = '10px 12px';
    textarea.style.resize = 'vertical';
    textarea.style.outline = 'none';
    textarea.style.lineHeight = '1.5';
    textarea.style.boxSizing = 'border-box';
    
    area.appendChild(textarea);
    commentsWrapper.appendChild(area);
    
    const tablePanel = document.querySelector('.table-panel');
    if (tablePanel) tablePanel.appendChild(commentsWrapper);
    
    // Сохраняем ссылку на textarea для renderComments
    window.commentsTextarea = textarea;
}

// Загружаем комментарий
if (App.currentMode !== 'gto') {
    renderComments(App.state.currentNodeId);
}
}
// ===== ВСПЛЫВАЮЩАЯ ПОДСКАЗКА (TOOLTIP) =====
let tooltipElement = null;
let tooltipTimeout = null;

function getTooltipElement() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'cell-tooltip';
        
        // ✅ Добавляем тултип ВНУТРЬ .left-area
        const container = document.querySelector('.left-area');
        if (container) {
            container.appendChild(tooltipElement);
        } else {
            document.body.appendChild(tooltipElement);
            console.warn('⚠️ .left-area не найден, тултип в body');
        }
    }
    return tooltipElement;
}

function showTooltip(event, hand, profileId) {
    const nodeId = App.state.workDisplayNodeId;
    if (!nodeId || !profileId) return;
    
    const profiles = getColorsForNode(nodeId);
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    const colorsList = getColorsForNode(nodeId);
    if (!colorsList || colorsList.length === 0) return;
    
    let html = `<div class="tooltip-hand">${hand}</div>`;
    html += `<hr class="tooltip-divider">`;
    
    // Определяем, простой это профиль или мульти
    let colorIds = [];
    let boundaries = [];
    
    if (profile.type === 'simple' || (!profile.type && profile.color)) {
        // Простой профиль
        colorIds = [profile.id];
        boundaries = [100];
    } else if (profile.type === 'multi' && profile.components) {
        // Мультипрофиль — берём компоненты
        colorIds = profile.components.map(c => c.colorId);
        boundaries = profile.boundaries || [];
    } else {
        return;
    }
    
    let prev = 0;
    for (let i = 0; i < colorIds.length; i++) {
        const colorId = colorIds[i];
        const colorObj = colorsList.find(c => c.id === colorId);
        if (!colorObj) continue;
        
        const percent = boundaries[i] - prev;
        prev = boundaries[i];
        
        html += `
            <div class="tooltip-row">
                <span class="tooltip-color-box" style="background: ${colorObj.color};"></span>
                <span class="tooltip-color-name">${colorObj.name}</span>
                <span class="tooltip-percent">${percent % 1 === 0 ? Math.round(percent) : percent.toFixed(1)}%</span>
            </div>
        `;
    }
    
    const tooltip = getTooltipElement();
    tooltip.innerHTML = html;
    positionTooltip(event, tooltip);
    tooltip.classList.add('visible');
}

function positionTooltip(event, tooltip) {
    const cell = event.target.closest('.hand-cell');
    if (!cell) return;
    
    const container = document.querySelector('.left-area');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    
    // ✅ Временно делаем видимым, но прозрачным
    tooltip.style.display = 'block';
    tooltip.style.opacity = '0';
    
    const tooltipRect = tooltip.getBoundingClientRect();
    
    const horizontalPadding = 8;
    const verticalGap = 6;
    
    let left = (cellRect.left - containerRect.left) + (cellRect.width / 2) - (tooltipRect.width / 2);
    let top = (cellRect.bottom - containerRect.top) + verticalGap;
    
    if (left < horizontalPadding) {
        left = horizontalPadding;
    }
    
    if (left + tooltipRect.width > containerRect.width - horizontalPadding) {
        left = containerRect.width - tooltipRect.width - horizontalPadding;
    }
    
    if (top + tooltipRect.height > containerRect.height - horizontalPadding) {
        top = (cellRect.top - containerRect.top) - tooltipRect.height - verticalGap;
        if (top < horizontalPadding) top = horizontalPadding;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    
    // ✅ Теперь делаем видимым (анимация пойдёт из CSS)
    tooltip.style.opacity = '1';
}
function hideTooltip() {
    const tooltip = getTooltipElement();
    tooltip.classList.remove('visible');
    tooltip.style.opacity = '0';   // ← оставляем для синхронизации
    setTimeout(() => {
        if (!tooltip.classList.contains('visible')) {
            tooltip.style.display = 'none';
        }
    }, 400);
}

// ===== CELL PREVIEW (серый квадрат с рукой + колонка блоков действий) =====
// Универсальная: branch — ветка данных (App.gto / App.editor),
// previewContainerId — id DOM-контейнера превью ('gtoCellPreview' /
// 'constructorCellPreview').
function showCellPreview(cell, row, col, branch, previewContainerId) {
    if (!branch) return;
    const nodeId = branch.currentNodeId;
    if (!nodeId) return;
    
    const hand = rowsData[row][col];
    const matrix = branch.cellStorage[getTableId(nodeId)];
    if (!matrix) return;
    
    const pid = matrix[row][col];
    const colors = branch.colorsPerNode[getTableId(nodeId)] || [];
    
    // Определяем, поддиапазон ли это
    const currentNode = (branch.nodes || []).find(n => n.id === nodeId);
    const isSubrange = currentNode && currentNode.type === 'subrange';
    
    // Вычисляем общее количество комбо для этой руки
    let handTotalCombos = 0;
    if (hand.includes('s')) handTotalCombos = 4;
    else if (hand.includes('o')) handTotalCombos = 12;
    else if (hand[0] === hand[1]) handTotalCombos = 6;
    
    // Учитываем родительскую закраску для поддиапазонов
    let adjustedCombos = handTotalCombos;
    if (isSubrange && currentNode.parentId !== null) {
        const parentTableId = getTableId(currentNode.parentId);
        const parentMatrix = branch.cellStorage[parentTableId];
        const parentColors = branch.colorsPerNode[parentTableId] || [];
        const selectedComponentIndex = currentNode.selectedComponentIndex !== undefined ? currentNode.selectedComponentIndex : null;
        
        if (parentMatrix) {
            const parentPid = parentMatrix[row][col];
            if (parentPid !== null) {
                const parentColor = parentColors.find(c => c.id === parentPid);
                if (parentColor) {
                    let parentShare = 0;
                    
                    if (parentColor.type === 'simple' || (!parentColor.type && parentColor.color)) {
                        if (selectedComponentIndex !== null) {
                            const simpleColors = parentColors.filter(c => c.type === 'simple' || (!c.type && c.color));
                            const selectedSimpleColor = simpleColors[selectedComponentIndex];
                            if (selectedSimpleColor && parentPid === selectedSimpleColor.id) {
                                parentShare = 100;
                            }
                        } else {
                            parentShare = 100;
                        }
                    } else if (parentColor.type === 'multi' && parentColor.components) {
                        if (selectedComponentIndex !== null) {
                            const simpleColors = parentColors.filter(c => c.type === 'simple' || (!c.type && c.color));
                            const selectedSimpleColor = simpleColors[selectedComponentIndex];
                            if (selectedSimpleColor) {
                                const matchedComp = parentColor.components.find(comp => comp.colorId === selectedSimpleColor.id);
                                if (matchedComp) {
                                    parentShare = Math.min(100, matchedComp.share || 0);
                                }
                            }
                        } else {
                            let totalShare = 0;
                            for (const comp of parentColor.components) {
                                totalShare += comp.share || 0;
                            }
                            parentShare = Math.min(100, totalShare);
                        }
                    }
                    
                    adjustedCombos = handTotalCombos * (parentShare / 100);
                }
            }
        }
    }
    
    // Собираем список действий для этой ячейки
    const actions = [];
    
    if (pid === null) {
        actions.push({ name: 'Fold', combos: adjustedCombos, color: '#313338' });
    } else {
        const prof = colors.find(p => p.id === pid);
        if (!prof) {
            actions.push({ name: 'Fold', combos: adjustedCombos, color: '#313338' });
        } else {
            let components = [];
            let boundaries = [];
            
            if (prof.type === 'simple' || (!prof.type && prof.color)) {
                components = [{ colorId: prof.id, share: 100 }];
                boundaries = [100];
            } else if (prof.type === 'multi' && prof.components) {
                components = prof.components;
                boundaries = prof.boundaries || [];
            }
            
            let prev = 0;
            for (let k = 0; k < components.length; k++) {
                const comp = components[k];
                const share = (boundaries[k] - prev) / 100;
                const combosShare = adjustedCombos * share;
                
                const simpleProf = colors.find(c => c.id === comp.colorId);
                if (simpleProf) {
                    actions.push({ name: simpleProf.name, combos: combosShare, color: simpleProf.color });
                }
                prev = boundaries[k];
            }
            
            if (prev < 100) {
                const foldShare = (100 - prev) / 100;
                actions.push({ name: 'Fold', combos: adjustedCombos * foldShare, color: '#313338' });
            }
        }
    }
    
    // Строим HTML: серый квадрат с названием руки + количество комбо для
    // этой руки (adjustedCombos — уже с учётом рекурсивной родительской
    // закраски, той же логикой, что и в computeColorStats) в левом нижнем
    // углу + колонка блоков действий (цвет действия 36x36, название, % — как
    // в ячейке, но в виде "таблицы" из блоков)
    let html = `<div class="gto-cell-preview__square">
        <div class="gto-cell-preview__hand">${hand}</div>
        <div class="gto-cell-preview__combos">${formatCombos(adjustedCombos)} combos</div>
    </div>`;
    html += `<div class="gto-cell-preview__actions">`;

    for (const action of actions) {
        // Значение — процент действия (закраски) в этой ячейке, а не число комбо
        const percent = adjustedCombos > 0 ? (action.combos / adjustedCombos) * 100 : 0;
        // Форматируем через toFixed (корректное десятичное округление строкой),
        // затем отрезаем ".0" у целых значений. Проверка через % 1 на самом
        // числе ненадёжна из-за погрешностей двоичного представления float
        // (например 33.3 % 1 может не быть строго равно 0.3), а строковый
        // способ работает предсказуемо в любом случае.
        let percentFormatted = percent.toFixed(1);
        if (percentFormatted.endsWith('.0')) {
            percentFormatted = percentFormatted.slice(0, -2);
        }
        html += `
            <div class="gto-cell-preview__action-row">
                <div class="gto-cell-preview__action-color" style="background: ${action.color};"></div>
                <div class="gto-cell-preview__action-info">
                    <span class="gto-cell-preview__action-name">${action.name}</span>
                    <span class="gto-cell-preview__action-percent">${percentFormatted}%</span>
                </div>
            </div>
        `;
    }

    html += `</div>`;

    const preview = document.getElementById(previewContainerId);
    if (!preview) return;
    preview.innerHTML = html;
    preview.classList.add('active');
}

function hideCellPreview(previewContainerId) {
    const preview = document.getElementById(previewContainerId);
    if (!preview) return;
    preview.classList.remove('active');
    preview.innerHTML = '';
    preview.removeAttribute('style');
}
