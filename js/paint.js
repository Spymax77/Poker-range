// ===== paint.js -- extracted from all.js (cell painting) =====

App.paint = App.paint || {};
App.paint.updateCellStyle = function(cell, pid) {
    if (pid === null) {
        cell.removeAttribute("style");
        App.colors.applyCellFill(cell, null, null);
        return;
    }
    
    const profiles = App.colors.getColorsForNode(App.state.currentNodeId);
    const prof = profiles.find(p => p.id === pid);
    if (!prof) {
        cell.removeAttribute("style");
        App.colors.applyCellFill(cell, null, null);
        return;
    }
    
    // Плоская заливка слоями вместо градиента (см. App.colors.applyCellFill)
    if (App.colors.applyCellFill(cell, App.state.currentNodeId, prof)) {
        cell.style.color = "#FFFFFF";
        cell.style.textShadow = "0 1px 1px rgba(0,0,0,.4), 0 0 3px rgba(0,0,0,.2)";
    } else {
        cell.removeAttribute("style");
    }
}

App.paint.paintCell = function(row, col) {
    const activeProfile = App.colors.getActiveForNode(App.state.currentNodeId);
    if (!App.state.currentNodeId || !activeProfile) return;
    const gridId = App.currentMode === 'gto' ? 'gtoGrid' : 'constructorGrid';
const cell = document.querySelector(`#${gridId} .hand-cell[data-row='${row}'][data-col='${col}']`);
    if (!cell) return;
    const currentPid = App.grid.getCellProfile(App.state.currentNodeId, row, col);
    let newPid = (currentPid === activeProfile) ? null : activeProfile;
    App.grid.setCellProfile(App.state.currentNodeId, row, col, newPid, false);
    App.paint.updateCellStyle(cell, newPid);
    cell.justChanged = true;
    let cellKey = `${row}_${col}`;
    let newBlockUntil = Infinity;
    App.state.blockUntilMap.set(cellKey, newBlockUntil);
    cell.blockUntil = newBlockUntil;
	
	App.persistence.markUnsaved();
}

App.paint.handlePaintStart = function(e) {
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
    App.paint.paintCell(row, col);
    App.state.lastPaintedCell = `${row},${col}`;
}

App.paint.handlePaintMove = function(e) {
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
    App.paint.paintCell(row, col);
    App.state.lastPaintedCell = key;  // ← ИСПРАВЛЕНО!
}

App.paint.handlePaintEnd = function() {
    // Запоминаем, шло ли рисование, ДО сброса флага: mouseup случается на любом
    // клике по странице (кнопки, слайдеры, дерево), а не только на ячейках матрицы.
    const wasPainting = App.state.painting;
    App.state.painting = false;
    App.state.lastPaintedCell = null;
    // В режиме анализа рисование отключено (см. handlePaintStart/handlePaintMove),
    // поэтому полный ререндер сетки здесь не нужен — а главное, он вреден:
    // клик по ячейке идёт как mousedown → mouseup → click, и если mouseup
    // (этот обработчик) пересобирает #constructorGrid ДО того, как успел
    // отработать click-слушатель ячейки (toggleConstructorCellPin), рамка
    // закрепления добавляется на уже отсоединённый от DOM старый элемент
    // ячейки и визуально не появляется.
    //
    // Ререндер нужен только после реального рисования. Без проверки wasPainting
    // любой клик по кнопкам (например, «высота диапазона») пересобирает сетку
    // на mouseup, а click-обработчик кнопки затем меняет класс на wrapper уже
    // ПОСЛЕ пересоздания оверлеев: Chrome не анимирует transition на элементах,
    // которые ещё ни разу не были отрисованы, и оверлеи схлопываются мгновенно.
    if (wasPainting && App.state.currentNodeId && App.currentMode !== 'gto' && !App.state.analysisMode) {
        App.grid.updateCurrentDisplay();
    }
}

