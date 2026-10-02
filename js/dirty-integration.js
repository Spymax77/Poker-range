// ============================================================
// dirty-integration.js — интеграция dirty tracking во все точки мутаций
// Загружается ПОСЛЕ всех остальных модулей
// ============================================================
(function() {
    // Ждём инициализации App.dirty
    function ensureDirty() {
        if (!App.dirty) {
            console.warn('⚠️ dirty-tracker не загружен, пропускаем интеграцию');
            return false;
        }
        return true;
    }

    // ===== ПАТЧ: setCellProfile (grid modules) — клик/покраска ячейки =====
    // Отключён: markTableDirty перенесён внутрь setCellProfile
    // (js/modules/grid/grid-operations.js) — метка ставится только при
    // фактическом изменении ячейки.
    /*
    function patchGridSetCellProfile() {
        if (!App.grid || typeof App.grid.setCellProfile !== 'function') return false;
        var _origSetCellProfile = App.grid.setCellProfile;
        App.grid.setCellProfile = function(nodeId, r, c, pid, immediateSave) {
            _origSetCellProfile(nodeId, r, c, pid, immediateSave);
            if (ensureDirty() && nodeId) {
                App.dirty.markTableDirty(nodeId);
            }
        };
        return true;
    }
    if (!patchGridSetCellProfile()) {
        document.addEventListener('DOMContentLoaded', patchGridSetCellProfile, { once: true });
    }
    */

    // ===== ПАТЧ: selectNode (navigation.js) — выбор узла (меняет метаданные) =====
    // Отключён: markMetadataDirty перенесён внутрь selectNode (navigation.js)
    // после смены currentNodeId. Патч помечал метаданные ДО диалога
    // «Сохранить?» — после «Да» они сохранялись со старым узлом.
    /*
    if (typeof App.navigation.selectNode === 'function') {
        var _origSelectNode = App.navigation.selectNode;
        App.navigation.selectNode = function(nodeId) {
            _origSelectNode(nodeId);
            // Выбор узла меняет только текущий экран. В гостевом режиме не
            // переносим это навигационное состояние в серверные данные при
            // последующем входе в аккаунт.
            if (ensureDirty() && App.auth && App.auth.isLoggedIn()) {
                App.dirty.markMetadataDirty();
            }
        };
    }
    */

    // ===== ПАТЧ: saveButtonStyle (style-manager.js) — стиль кнопки =====
    // Отключён: markStructureDirty перенесён внутрь saveButtonStyle (style-manager.js)
    /*
    if (typeof App.styles.saveButtonStyle === 'function') {
        var _origSaveButtonStyle = App.styles.saveButtonStyle;
        App.styles.saveButtonStyle = function(nodeId, bg, border, text) {
            _origSaveButtonStyle(nodeId, bg, border, text);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }
    */

    // ===== ПАТЧ: setActiveForNode (color-manager.js) — смена активного профиля =====
    // Отключён: markColorsDirty перенесён внутрь setActiveForNode (color-manager.js)
    /*
    if (typeof App.colors.setActiveForNode === 'function') {
        var _origSetActiveForNode = App.colors.setActiveForNode;
        App.colors.setActiveForNode = function(nodeId, colorId) {
            _origSetActiveForNode(nodeId, colorId);
            if (ensureDirty()) App.dirty.markColorsDirty();
        };
    }
    */

    // ===== ПАТЧ: addPaletteColor (color-manager.js) — добавление цвета =====
    // Отключён: markColorsDirty перенесён внутрь колбэка openColorPicker
    // (color-manager.js) — флаг ставится только при реальном создании цвета,
    // а не при открытии пикера.
    /*
    if (typeof App.colors.addPaletteColor === 'function') {
        var _origAddPaletteColor = App.colors.addPaletteColor;
        App.colors.addPaletteColor = function() {
            _origAddPaletteColor();
            if (ensureDirty()) App.dirty.markColorsDirty();
        };
    }
    */

    // ===== ПАТЧ: createNewProfile (color-manager.js) — создание профиля =====
    // Отключён: markColorsDirty теперь приходит из createMultiColor (вызывается
    // внутри createNewProfile), флаг ставится в точке реального создания.
    /*
    if (typeof App.colors.createNewProfile === 'function') {
        var _origCreateNewProfile = App.colors.createNewProfile;
        App.colors.createNewProfile = function() {
            _origCreateNewProfile();
            if (ensureDirty()) App.dirty.markColorsDirty();
        };
    }
    */

    // ===== ПАТЧ: createMultiColor (color-manager.js) — создание мультицвета =====
    // Отключён: markColorsDirty перенесён внутрь createMultiColor
    // (color-manager.js) — покрывает все пути вызова: кнопку «Добавить
    // мультицвет» (createNewProfile) и импорт диапазонов (import-manager.js).
    /*
    if (typeof App.colors.createMultiColor === 'function') {
        var _origCreateMultiColor = App.colors.createMultiColor;
        App.colors.createMultiColor = function(nodeId, name, components, boundaries) {
            var result = _origCreateMultiColor(nodeId, name, components, boundaries);
            if (ensureDirty()) App.dirty.markColorsDirty();
            return result;
        };
    }
    */

    // ===== ПАТЧ: proceedDeleteColor (color-manager.js) — удаление цвета =====
    // Отключён: markColorsDirty перенесён внутрь proceedDeleteColor
    // (color-manager.js). Там же — markTableDirty, если очищались ячейки
    // матрицы (цвет использовался в ячейках → таблица реально меняется).
    /*
    if (typeof App.colors.proceedDeleteColor === 'function') {
        var _origProceedDeleteColor = App.colors.proceedDeleteColor;
        App.colors.proceedDeleteColor = function(nodeId, tableId, colorId) {
            _origProceedDeleteColor(nodeId, tableId, colorId);
            if (ensureDirty()) App.dirty.markColorsDirty();
        };
    }
    */

    // ===== ПАТЧ: copyRange (clipboard.js) — копирование (не меняет данные) =====
    // НЕ трогаем — копирование не меняет состояние

    // ===== ПАТЧ: pasteRange (clipboard.js) — вставка диапазона =====
    // Отключён: markTableDirty перенесён внутрь executePaste (clipboard.js) —
    // после фактической вставки, а не при открытии подтверждения.
    /*
    if (typeof App.clipboard.pasteRange === 'function') {
        var _origPasteRange = App.clipboard.pasteRange;
        App.clipboard.pasteRange = function(nodeId) {
            _origPasteRange(nodeId);
            if (ensureDirty() && nodeId) {
                App.dirty.markTableDirty(nodeId);
            }
        };
    }
    */

    // ===== ПАТЧ: moveNodeWithChildren (drag-drop.js) — drag & drop =====
    // Отключён: markStructureDirty перенесён внутрь moveNodeWithChildren (drag-drop.js)
    /*
    if (typeof App.dragDrop.moveNodeWithChildren === 'function') {
        var _origMoveNodeWithChildren = App.dragDrop.moveNodeWithChildren;
        App.dragDrop.moveNodeWithChildren = function(sourceId, targetId) {
            _origMoveNodeWithChildren(sourceId, targetId);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }
    */

})();