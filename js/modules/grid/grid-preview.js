import { getMatrixPreviewContext, isPinSafeTarget, getTableId, escapeHtml } from './grid-utils.js';
const rowsData = globalThis.rowsData;
export function clearPinnedCellPreview(containerId) {
    const ctx = App.grid.getMatrixPreviewContext(containerId);
    if (!ctx) return;
    ctx.clearPinnedCell();
}

export function unpinGtoCell() {
    App.grid.clearPinnedCellPreview('gtoGrid');
}

export function unpinConstructorCell() {
    App.grid.clearPinnedCellPreview('constructorGrid');
}

export function togglePinnedPreviewCell(cell, row, col, containerId) {
    const ctx = App.grid.getMatrixPreviewContext(containerId);
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
    App.grid.showCellPreview(cell, row, col, ctx.branch, ctx.previewId);
}

export function toggleGtoCellPin(cell, row, col) {
    App.grid.togglePinnedPreviewCell(cell, row, col, 'gtoGrid');
}

export function toggleConstructorCellPin(cell, row, col) {
    App.grid.togglePinnedPreviewCell(cell, row, col, 'constructorGrid');
}

export function handleOutsideMatrixPinClick(e) {
    const contexts = ['gtoGrid', 'constructorGrid']
        .map(App.grid.getMatrixPreviewContext)
        .filter(Boolean);

    for (const ctx of contexts) {
        const pinnedCell = ctx.getPinnedCell();
        if (!pinnedCell) continue;
        if (App.grid.isPinSafeTarget(e, ctx.safeSelector)) continue;
        const matrixEl = document.getElementById(ctx.matrixId);
        if (matrixEl && !matrixEl.contains(e.target)) {
            ctx.clearPinnedCell();
        }
    }
}

document.addEventListener('click', function(e) {
    App.grid.handleOutsideMatrixPinClick(e);
});

export function showDefaultMatrixPreview(containerId, nodeId) {
    const ctx = App.grid.getMatrixPreviewContext(containerId);
    if (!ctx || !ctx.isModeActive()) return;
    if (ctx.getPinnedCell() && ctx.getPinnedCell().nodeId === nodeId) return;

    const matrixEl = document.getElementById(ctx.matrixId);
    if (!matrixEl) return;

    const defaultCell = matrixEl.querySelector(".hand-cell[data-row='0'][data-col='0']");
    if (!defaultCell) return;

    App.grid.showCellPreview(defaultCell, 0, 0, ctx.branch, ctx.previewId);
}
export function showCellPreview(cell, row, col, branch, previewContainerId) {
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
    
    // Используем общий рекурсивный расчёт доступности для переданной ветки
    // (App.editor или App.gto), чтобы preview совпадал со статистикой.
    const availabilityPercent = isSubrange
        ? App.stats.getCellAvailabilityPercent(nodeId, row, col, true, branch)
        : 100;
    const adjustedCombos = handTotalCombos * availabilityPercent / 100;
    
    // Недоступная ячейка не содержит рук и действий, даже если в её матрице
    // остался старый профиль после изменения родительского поддиапазона.
    if (adjustedCombos <= 0) {
        const preview = document.getElementById(previewContainerId);
        if (!preview) return;
        preview.innerHTML = `<div class="gto-cell-preview__square">
            <div class="gto-cell-preview__hand">${hand}</div>
            <div class="gto-cell-preview__combos">0 combos</div>
        </div><div class="gto-cell-preview__actions"></div>`;
        preview.classList.add('active');
        return;
    }

    // Собираем список действий для этой ячейки
    const actions = [];
    
    if (pid === null) {
        actions.push({ name: 'Fold', combos: adjustedCombos, color: 'var(--cell-empty-bg)' });
    } else {
        const prof = colors.find(p => p.id === pid);
        if (!prof) {
            actions.push({ name: 'Fold', combos: adjustedCombos, color: 'var(--cell-empty-bg)' });
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
                actions.push({ name: 'Fold', combos: adjustedCombos * foldShare, color: 'var(--cell-empty-bg)' });
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
        <div class="gto-cell-preview__combos">${App.stats.formatCombos(adjustedCombos)} combos</div>
    </div>`;
    html += `<div class="gto-cell-preview__actions">`;

    const displayActions = [];
    const displayedPercents = [];
    actions.forEach(action => {
        const percent = adjustedCombos > 0 ? (action.combos / adjustedCombos) * 100 : 0;
        const roundedPercent = Math.round(percent * 10) / 10;
        if (roundedPercent > 0) {
            displayActions.push(action);
            displayedPercents.push(roundedPercent);
        }
    });
    const foldIndex = displayActions.findIndex(action => action.name === 'Fold');
    if (foldIndex !== -1) {
        const displayedSum = displayedPercents.reduce((sum, percent) => sum + percent, 0);
        const correction = Math.round((100 - displayedSum) * 10) / 10;
        displayedPercents[foldIndex] = Math.round((displayedPercents[foldIndex] + correction) * 10) / 10;
    }

    for (const [index, action] of displayActions.entries()) {
        // Значение — процент действия (закраски) в этой ячейке, а не число комбо
        const percent = displayedPercents[index];
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
                <div class="gto-cell-preview__action-color" style="background: ${escapeHtml(action.color)};"></div>
                <div class="gto-cell-preview__action-info">
                    <span class="gto-cell-preview__action-name">${escapeHtml(action.name)}</span>
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

export function hideCellPreview(previewContainerId) {
    const preview = document.getElementById(previewContainerId);
    if (!preview) return;
    preview.classList.remove('active');
    preview.innerHTML = '';
    preview.removeAttribute('style');
}