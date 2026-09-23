// Grid toolbar
const CONSTRUCTOR_EDIT_BUTTON_IDS = [
    'tableSaveBtn',
    'tableUndoBtn',
    'tableClearBtn',
    'tableCopyBtn',
    'tablePasteBtn',
    'importRangeBtn',
    'tableMoreBtn'
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
    // Как и GTO, редактор работает с собственной веткой данных. Не смешиваем
    // App.editor.currentNodeId с Proxy App.state.currentNodeId в одном рендере:
    // это гарантирует, что матрица, статистика и превью относятся к одному
    // диапазону/поддиапазону.
    const branch = App.editor;
    const currentNodeId = branch.currentNodeId;
    document.getElementById('constructorPage')?.classList.toggle('analysis-mode', isAnalysis);
    document.getElementById('editorModeBtn')?.classList.toggle('active', !isAnalysis);
    document.getElementById('analysisModeBtn')?.classList.toggle('active', isAnalysis);

    // Кнопки редактирования диапазона в тулбаре таблицы гасим/возвращаем вместе
    // с режимом (см. updateConstructorToolbarState выше).
    App.grid.updateConstructorToolbarState();

    if (isAnalysis) {
        App.stats.renderBranchStats(
            currentNodeId,
            branch,
            App.stats.CONTAINERS.editorAnalysis
        );
        App.grid.showDefaultMatrixPreview('constructorGrid', currentNodeId);
    } else {
        const legendEl = document.getElementById(App.stats.CONTAINERS.editorAnalysis.legend);
        if (legendEl) legendEl.innerHTML = '';
        const barEl = document.getElementById(App.stats.CONTAINERS.editorAnalysis.bar);
        if (barEl) barEl.style.background = '';
        App.grid.hideCellPreview('constructorCellPreview');
        App.grid.unpinConstructorCell();
    }
}

export function updateCurrentDisplay() {
    const branch = App.editor;
    const currentNodeId = branch.currentNodeId;
    if (!currentNodeId) return;
	  // ===== ОБНОВЛЯЕМ НАЗВАНИЕ ДИАПАЗОНА =====
    const nameEl = document.getElementById("currentRangeName");
    if (nameEl) {
        const node = branch.nodeIndex.get(currentNodeId) || null;
        if (node) {
            nameEl.textContent = node.name;
        }
    }

    App.grid.renderGrid("constructorGrid", currentNodeId, null);
    
    App.grid.refreshConstructorAnalysisMode();

    App.stats.renderBranchStats(currentNodeId, branch, {
        stats: App.stats.CONTAINERS.editor.stats
    });
    
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
        iconBtn.dataset.tooltip = App.i18n.t('matrix.comments');
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
                overlayBtn.dataset.tooltip = App.i18n.t('matrix.rangeHeight');
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
                        overlayBtn.dataset.tooltip = isHidden ? App.i18n.t('matrix.fullHeight') : App.i18n.t('matrix.rangeHeight');
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
    textarea.placeholder = App.i18n.t('matrix.commentPlaceholder');
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