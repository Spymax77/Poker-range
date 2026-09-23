import { ensureTable, getTableId, getNode, gtoPinnedCell, constructorPinnedCell } from './grid-utils.js';
const rowsData = globalThis.rowsData;
export function renderGrid(containerId, nodeId, clickHandler) {
    const gridDiv = document.getElementById(containerId);
    const branch = containerId === 'gtoGrid' ? App.gto : App.editor;
    if (!nodeId || !App.state.cellStorage[getTableId(nodeId)]) {
        gridDiv.innerHTML = '';
        return;
    }
    const matrix = App.state.cellStorage[getTableId(nodeId)];
    gridDiv.innerHTML = "";

    const profiles = App.colors.getColorsForNode(nodeId);
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
        const cellAvail = App.stats.getCellAvailabilityPercent(nodeId, i, j, true, branch);
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
        availabilityPercent = App.stats.getCellAvailabilityPercent(nodeId, i, j, true, branch);
}

// Если ячейка закрашена, но недоступна → очищаем (старая логика)
if (isSubrange && pid !== null && !isAvailable) {
    const currentTableId = getTableId(nodeId);
    if (branch.cellStorage[currentTableId]) {
        branch.cellStorage[currentTableId][i][j] = null;
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
    let gradStyle = App.colors.getGradientStyleFromColorForNode(nodeId, prof);
    if (gradStyle) {
        originalGradient = gradStyle + "; color: #FFFFFF; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.4), 0 0 3px rgba(0, 0, 0, 0.2);";
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
        const activeProfileId = App.colors.getActiveForNode(nodeId);
        const currentPid = App.grid.getCellProfile(nodeId, i, j);
        
        // Если ячейка уже содержит активный профиль → затемнение
        if (currentPid === activeProfileId) {
            requestAnimationFrame(() => {
                cell.removeAttribute("style");
                cell.style.opacity = "0.7";
                cell.style.color = "#FFFFFF";
            });
        } else if (activeProfileId) {
            // Во всех остальных случаях (пустая ИЛИ с другим профилем) → превью активного профиля
            const activeProf = App.colors.getColorsForNode(nodeId).find(p => p.id === activeProfileId);
            if (activeProf) {
                let gradStyle = App.colors.getGradientStyleFromColorForNode(nodeId, activeProf);
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
            App.grid.showTooltip(e, hand, parseInt(profileId));
        }
    });

    cell.addEventListener('mouseleave', function(e) {
        App.grid.hideTooltip();
    });
}

// Универсальные обработчики для GTO и анализа конструктора: превью
// всегда остаётся видимым после mouseleave, обновляется при hover, а клик
// фиксирует ячейку золотой рамкой. Логика вынесена в общие функции и
// применяется к обеим матрицам без дублирования.
const previewMatrixIds = ['gtoGrid', 'constructorGrid'];
if (previewMatrixIds.includes(containerId)) {
    const ctx = App.grid.getMatrixPreviewContext(containerId);
    if (ctx) {
        cell.addEventListener('mouseenter', function(e) {
            if (!ctx.isModeActive()) return;
            if (ctx.getPinnedCell()) return;
            const row = parseInt(this.getAttribute('data-row'));
            const col = parseInt(this.getAttribute('data-col'));
            App.grid.showCellPreview(this, row, col, ctx.branch, ctx.previewId);
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
            App.grid.togglePinnedPreviewCell(this, row, col, containerId);
        });
    }
}

                     gridDiv.appendChild(cell);
        }
    }

    // ===== GTO: восстановление рамки закреплённой ячейки после перерисовки =====
    // renderGrid полностью пересобирает innerHTML, поэтому DOM-
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
        App.grid.showDefaultMatrixPreview(containerId, nodeId);
    }
}