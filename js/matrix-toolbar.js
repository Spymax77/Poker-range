// ===== matrix-toolbar.js — кнопки матрицы (сохранение, отмена, буфер, режимы) =====

App.matrixToolbar = App.matrixToolbar || {};

document.addEventListener('mousedown', App.paint.handlePaintStart);
document.addEventListener('mousemove', App.paint.handlePaintMove);
document.addEventListener('mouseup', App.paint.handlePaintEnd);

// ===== ФЛАГ ИЗМЕНЕНИЙ =====
// (App.persistence.markUnsaved / App.persistence.clearUnsaved вынесены в persistence.js)

// ===== КНОПКА "СОХРАНИТЬ" =====
App.matrixToolbar.onSaveClick = function() {
    // В режимах анализа/тренировки кнопки редактирования погашены классом
    // .toolbar-btn-disabled (pointer-events: none), но CSS не мешает
    // программному .click() (например, из userscript'а), поэтому дублируем
    // проверку в обработчике.
    if (App.state.analysisMode || App.grid.isTrainingSetupActive()) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActiveSave'));
        return;
    }
    // Тот же сценарий сохранения, что в App.ui.saveAndContinue (App.persistence.flushPersist →
    // проверка → App.persistence.clearUnsaved / range.saveFailed), но без продолжения:
    // хелпер возвращает колбэк «Да» — вызываем его сразу.
    const saveWithoutContinue = App.ui.saveAndContinue();
    saveWithoutContinue();
};
document.getElementById('tableSaveBtn')?.addEventListener('click', App.matrixToolbar.onSaveClick);

// ===== ДОПОЛНИТЕЛЬНОЕ МЕНЮ МАТРИЦЫ =====
const tableMoreBtn = document.getElementById('tableMoreBtn');
const tableMoreMenu = document.getElementById('tableMoreMenu');

App.matrixToolbar.onMoreToggle = function(e) {
    if (App.state.analysisMode || App.grid.isTrainingSetupActive()) return;
    e.stopPropagation();
    const isOpen = tableMoreMenu.classList.toggle('open');
    tableMoreBtn.setAttribute('aria-expanded', String(isOpen));
};

App.matrixToolbar.onRemoveUnusedColors = function() {
    tableMoreMenu.classList.remove('open');
    tableMoreBtn.setAttribute('aria-expanded', 'false');
    if (App.state.analysisMode || App.grid.isTrainingSetupActive() || !App.state.currentNodeId) return;

    const result = App.colors.removeUnusedColors(App.state.currentNodeId);
    App.modals.showFloatingModal(
        result.removed > 0
            ? App.i18n.t('colors.removedUnused', { count: result.removed })
            : App.i18n.t('colors.noUnusedFound')
    );
};

if (tableMoreBtn && tableMoreMenu) {
    tableMoreBtn.addEventListener('click', App.matrixToolbar.onMoreToggle);

    document.getElementById('removeUnusedColorsBtn')?.addEventListener('click', App.matrixToolbar.onRemoveUnusedColors);

    document.addEventListener('click', function(e) {
        if (!tableMoreMenu.contains(e.target) && !tableMoreBtn.contains(e.target)) {
            tableMoreMenu.classList.remove('open');
            tableMoreBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

// ===== КНОПКА "ОТМЕНИТЬ" =====
App.matrixToolbar.onUndoClick = function() {
    if (App.state.analysisMode || App.grid.isTrainingSetupActive()) return;
    if (!App.state.hasUnsavedChanges) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActive'));
        return;
    }

    const node = App.nodes.getNode(App.state.currentNodeId);
    const message = node
        ? App.i18n.t('range.undoChangesNamedQuestion', { name: node.name })
        : App.i18n.t('range.undoChangesQuestion');

    // Да — отменяем (тот же сценарий, что App.ui.rollbackAndContinue);
    // Нет — ничего не делаем.
    App.modals.showSaveConfirmModal(message, App.ui.rollbackAndContinue(), null);
};
document.getElementById('tableUndoBtn')?.addEventListener('click', App.matrixToolbar.onUndoClick);
// ===== КНОПКИ КОПИРОВАТЬ/ВСТАВИТЬ В ТУЛБАРЕ =====
App.matrixToolbar.onCopyClick = function() {
    if (App.state.analysisMode || App.grid.isTrainingSetupActive()) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActiveCopy'));
        return;
    }
    App.clipboard.copyRange(App.state.currentNodeId);
    App.clipboard.updatePasteButtonState();
};
document.getElementById('tableCopyBtn')?.addEventListener('click', App.matrixToolbar.onCopyClick);

App.matrixToolbar.onPasteClick = function() {
    if (App.state.analysisMode || App.grid.isTrainingSetupActive()) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActivePaste'));
        return;
    }
    App.clipboard.pasteRange(App.state.currentNodeId);
};
document.getElementById('tablePasteBtn')?.addEventListener('click', App.matrixToolbar.onPasteClick);

// Проверка несохранённых изменений при переключении диапазона встроена
// в App.navigation.selectNode (см. navigation.js) — monkey-patch здесь
// больше не нужен.

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ МАТРИЦЫ ==========

// ===== КНОПКИ "РЕДАКТОР" / "АНАЛИЗ" (режим анализа конструктора) =====
// Синхронизация класса #constructorPage.analysis-mode и активной кнопки
// теперь целиком выполняется в refreshConstructorAnalysisMode() (grid.js),
// т.к. её нужно вызывать не только по клику, но и при восстановлении
// состояния после F5 / возврата на вкладку конструктора.
App.matrixToolbar.onEditorModeClick = function() {
    // Три кнопки режима взаимоисключающие: закрываем панель тренировки,
    // если она открыта (клик по «Редактор» = вернуться в режим редактора).
    if (App.trainer && typeof App.trainer.isSetupVisible === 'function' && App.trainer.isSetupVisible()) {
        App.trainer.toggleSetup();
    }
    if (!App.state.analysisMode) return;
    App.state.analysisMode = false;
    App.grid.refreshConstructorAnalysisMode();
    if (App.dirty) App.dirty.markMetadataDirty('editor');
    App.persistence.persistAll();
};
document.getElementById('editorModeBtn')?.addEventListener('click', App.matrixToolbar.onEditorModeClick);

App.matrixToolbar.onAnalysisModeClick = function() {
    // Три кнопки режима взаимоисключающие: закрываем панель тренировки,
    // если она открыта (клик по «Анализ» = показать легенду).
    if (App.trainer && typeof App.trainer.isSetupVisible === 'function' && App.trainer.isSetupVisible()) {
        App.trainer.toggleSetup();
    }
    if (App.state.analysisMode) return;
    App.state.analysisMode = true;
    App.grid.refreshConstructorAnalysisMode();
    if (App.dirty) App.dirty.markMetadataDirty('editor');
    App.persistence.persistAll();
};
document.getElementById('analysisModeBtn')?.addEventListener('click', App.matrixToolbar.onAnalysisModeClick);

// ===== КНОПКА "ТРЕНИРОВКА" (панель настройки, см. js/modules/trainer/) =====
App.matrixToolbar.onTrainingModeClick = function() {
    App.trainer.toggleSetup();
};
document.getElementById('trainingModeBtn')?.addEventListener('click', App.matrixToolbar.onTrainingModeClick);


App.matrixToolbar.onClearClick = function() {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) return;

    const node = App.nodes.getNode(App.state.currentNodeId);
    const message = node
        ? App.i18n.t('range.clearTableNamedQuestion', { name: node.name })
        : App.i18n.t('range.clearTableQuestion');

    App.modals.showSaveConfirmModal(message, () => {
        // Очистка матрицы — App.grid.clearTable (grid-operations.js).
        if (App.grid.clearTable(App.state.currentNodeId)) {
            App.persistence.markUnsaved();
            App.grid.updateCurrentDisplay();
        }
    }, null);
};
document.getElementById('tableClearBtn')?.addEventListener('click', App.matrixToolbar.onClearClick);
