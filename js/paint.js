// ===== paint.js -- extracted from all.js (cell painting) =====

function updateCellStyle(cell, pid) {
    if (pid === null) {
        cell.removeAttribute("style");
        return;
    }
    
    const profiles = getColorsForNode(App.state.currentNodeId);
    const prof = profiles.find(p => p.id === pid);
    if (!prof) {
        cell.removeAttribute("style");
        return;
    }
    
    // ✅ Правильно: используем существующую функцию
    let gradStyle = getGradientStyleFromColorForNode(App.state.currentNodeId, prof);
    if (gradStyle) {
        cell.setAttribute("style", gradStyle + "; color: #F0F0F0;");
    } else {
        cell.removeAttribute("style");
    }
}

function paintCell(row, col) {
    const activeProfile = getActiveForNode(App.state.currentNodeId);
    if (!App.state.currentNodeId || !activeProfile) return;
    const gridId = App.currentMode === 'gto' ? 'gtoGrid' : 'constructorGrid';
const cell = document.querySelector(`#${gridId} .hand-cell[data-row='${row}'][data-col='${col}']`);
    if (!cell) return;
    const currentPid = getCellProfile(App.state.currentNodeId, row, col);
    let newPid = (currentPid === activeProfile) ? null : activeProfile;
    setCellProfile(App.state.currentNodeId, row, col, newPid, false);
    updateCellStyle(cell, newPid);
    cell.justChanged = true;
    let cellKey = `${row}_${col}`;
    let newBlockUntil = Infinity;
    App.state.blockUntilMap.set(cellKey, newBlockUntil);
    cell.blockUntil = newBlockUntil;
	
	markUnsaved();
}

function handlePaintStart(e) {
    // Матрица GTO недоступна для редактирования — рисуем только в конструкторе
    const isEditor = document.getElementById("constructorPage").classList.contains("active-page");
    if (!isEditor) return;
    // В режиме анализа конструктора клики по ячейкам управляют только
    // закреплением превью (см. grid.js toggleConstructorCellPin), рисование отключено.
    if (App.state.analysisMode) return;
    
    const cell = e.target.closest('.hand-cell');
    if (!cell) return;
    e.preventDefault();
    App.state.painting = true;
    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    paintCell(row, col);
    App.state.lastPaintedCell = `${row},${col}`;
}

function handlePaintMove(e) {
    if (!App.state.painting) return;
    
    // Матрица GTO недоступна для редактирования — рисуем только в конструкторе
    const isEditor = document.getElementById("constructorPage").classList.contains("active-page");
    if (!isEditor) {
        App.state.painting = false;
        return;
    }
    if (App.state.analysisMode) {
        App.state.painting = false;
        return;
    }
    
    const cell = e.target.closest('.hand-cell');
    if (!cell) return;
    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    const key = `${row},${col}`;
    if (App.state.lastPaintedCell === key) return;
    paintCell(row, col);
    App.state.lastPaintedCell = key;  // ← ИСПРАВЛЕНО!
}

function handlePaintEnd() {
    App.state.painting = false;
    App.state.lastPaintedCell = null;
    // В режиме анализа рисование отключено (см. handlePaintStart/handlePaintMove),
    // поэтому полный ререндер сетки здесь не нужен — а главное, он вреден:
    // клик по ячейке идёт как mousedown → mouseup → click, и если mouseup
    // (этот обработчик) пересобирает #constructorGrid ДО того, как успел
    // отработать click-слушатель ячейки (toggleConstructorCellPin), рамка
    // закрепления добавляется на уже отсоединённый от DOM старый элемент
    // ячейки и визуально не появляется.
    if (App.state.currentNodeId && App.currentMode !== 'gto' && !App.state.analysisMode) {
        updateCurrentDisplay();
    }
}

