// Grid toolbar
const CONSTRUCTOR_EDIT_BUTTON_IDS = [
    'tableSaveBtn',
    'tableUndoBtn',
    'tableClearBtn',
    'tableCopyBtn',
    'tablePasteBtn',
    'importRangeBtn'
];

export function updateConstructorToolbarState() {
    const isAnalysis = !!App.state.analysisMode;
    CONSTRUCTOR_EDIT_BUTTON_IDS.forEach(id => {
        document.getElementById(id)?.classList.toggle('toolbar-btn-disabled', isAnalysis);
    });

    // Кнопка «Отменить»: активна только когда есть несохранённые изменения
    // (вне режима анализа — в анализе она уже погашена циклом выше)
    if (!isAnalysis) {
        var undoBtn = document.getElementById('tableUndoBtn');
        if (undoBtn) {
            undoBtn.classList.toggle('toolbar-btn-disabled', !App.state.hasUnsavedChanges);
        }
    }

    // Конечное состояние "Вставить" всегда определяет updatePasteButtonState
    // (clipboard.js): она учитывает и режим анализа, и наличие скопированных
    // данных, поэтому при выходе из анализа кнопка не "загорится" с пустым буфером.
    if (typeof App.clipboard.updatePasteButtonState === 'function') App.clipboard.updatePasteButtonState();
}

export function refreshConstructorAnalysisMode() {
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
    App.grid.updateConstructorToolbarState();

    if (isAnalysis) {
        App.stats.renderActionLegend(App.editor.currentNodeId, App.editor, 'constructorActionLegend');
        App.stats.renderActionBar(App.editor.currentNodeId, App.editor, 'constructorActionBar');
        App.grid.showDefaultMatrixPreview('constructorGrid', App.state.currentNodeId);
    } else {
        const legendEl = document.getElementById("constructorActionLegend");
        if (legendEl) legendEl.innerHTML = '';
        const barEl = document.getElementById("constructorActionBar");
        if (barEl) barEl.style.background = '';
        App.grid.hideCellPreview('constructorCellPreview');
        App.grid.unpinConstructorCell();
    }
}

export function updateCurrentDisplay() {
    if (!App.state.currentNodeId) return;
    let total = App.stats.countTotalCombos(App.state.currentNodeId, App.editor);
	  // ===== ОБНОВЛЯЕМ НАЗВАНИЕ ДИАПАЗОНА =====
    const nameEl = document.getElementById("currentRangeName");
    if (nameEl) {
        const node = getNode(App.state.currentNodeId);
        if (node) {
            nameEl.textContent = node.name;
        }
    }

    App.grid.renderGrid("constructorGrid", App.state.currentNodeId, null);
    
    App.grid.refreshConstructorAnalysisMode();

    App.stats.renderStatsTable(App.state.currentNodeId, App.editor, 'constructorStatsContainer');
    
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
        iconBtn.dataset.tooltip = '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438';
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a848a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-5.1a7.5 7.5 0 0 1-1.5-4.4A7.5 7.5 0 0 1 10 5h2.5A7.5 7.5 0 0 1 20 11.5Z"/>
            </svg>
        `;
        
        // Делаем wrapper относительным для позиционирования иконки
        gridWrapper.style.position = 'relative';
        gridWrapper.appendChild(iconBtn);
        
        // Вешаем обработчик
        iconBtn.addEventListener('click', App.comments.toggleComments);
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
                overlayBtn.dataset.tooltip = '\u0412\u044b\u0441\u043e\u0442\u0430 \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d\u0430';
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
                        overlayBtn.dataset.tooltip = isHidden ? '\u041f\u043e\u043b\u043d\u0430\u044f \u0432\u044b\u0441\u043e\u0442\u0430' : '\u0412\u044b\u0441\u043e\u0442\u0430 \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d\u0430';
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
    commentsWrapper.style.maxWidth = '100%';
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
    textarea.placeholder = '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043a \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d\u0443...';
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
    
    const constructorMatrixCol = document.querySelector('.constructor-matrix-col');
    if (constructorMatrixCol) constructorMatrixCol.appendChild(commentsWrapper);
    
    // Сохраняем ссылку на textarea для renderComments
    window.commentsTextarea = textarea;
}

// ???? ???? ???????????? ??? ??? ?????? ?????, ?? ????? ?????? ???
// ?????? ??????? ???????, ????? ?? ?? ?????????? ?? ?????? ????? ?????????.
const constructorMatrixCol = document.querySelector('.constructor-matrix-col');
if (constructorMatrixCol && commentsWrapper.parentElement !== constructorMatrixCol) {
    constructorMatrixCol.appendChild(commentsWrapper);
}

// Загружаем комментарий
if (App.currentMode !== 'gto') {
    App.comments.renderComments(App.state.currentNodeId);
}
}