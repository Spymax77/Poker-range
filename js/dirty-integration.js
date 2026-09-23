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

    // ===== ПАТЧ: moveNodeUp (tree.js) — перемещение вверх =====
    if (typeof App.tree.moveNodeUp === 'function') {
        var _origMoveNodeUp = App.tree.moveNodeUp;
        App.tree.moveNodeUp = function(nodeId) {
            _origMoveNodeUp(nodeId);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: moveNodeDown (tree.js) — перемещение вниз =====
    if (typeof App.tree.moveNodeDown === 'function') {
        var _origMoveNodeDown = App.tree.moveNodeDown;
        App.tree.moveNodeDown = function(nodeId) {
            _origMoveNodeDown(nodeId);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: deleteNode (tree.js) — удаление узла =====
    if (typeof App.tree.deleteNode === 'function') {
        var _origDeleteNode = App.tree.deleteNode;
        App.tree.deleteNode = function(nodeId) {
            _origDeleteNode(nodeId);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: addChildNode (tree.js) — добавление дочернего узла =====
    if (typeof App.tree.addChildNode === 'function') {
        var _origAddChildNode = App.tree.addChildNode;
        App.tree.addChildNode = function(parentId) {
            _origAddChildNode(parentId);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: addRootNode (tree.js) — добавление корневого узла =====
    if (typeof App.tree.addRootNode === 'function') {
        var _origAddRootNode = App.tree.addRootNode;
        App.tree.addRootNode = function() {
            _origAddRootNode();
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: finishInlineRename (tree.js) — завершение инлайн-переименования =====
    if (typeof App.tree.finishInlineRename === 'function') {
        var _origFinishInlineRename = App.tree.finishInlineRename;
        App.tree.finishInlineRename = function(save) {
            _origFinishInlineRename(save);
            if (save && ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: selectNode (navigation.js) — выбор узла (меняет метаданные) =====
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

    // ===== ПАТЧ: saveButtonStyle (style-manager.js) — стиль кнопки =====
    if (typeof App.styles.saveButtonStyle === 'function') {
        var _origSaveButtonStyle = App.styles.saveButtonStyle;
        App.styles.saveButtonStyle = function(nodeId, bg, border, text) {
            _origSaveButtonStyle(nodeId, bg, border, text);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: setActiveForNode (color-manager.js) — смена активного профиля =====
    if (typeof App.colors.setActiveForNode === 'function') {
        var _origSetActiveForNode = App.colors.setActiveForNode;
        App.colors.setActiveForNode = function(nodeId, colorId) {
            _origSetActiveForNode(nodeId, colorId);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: addPaletteColor (color-manager.js) — добавление цвета =====
    if (typeof App.colors.addPaletteColor === 'function') {
        var _origAddPaletteColor = App.colors.addPaletteColor;
        App.colors.addPaletteColor = function() {
            _origAddPaletteColor();
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: createNewProfile (color-manager.js) — создание профиля =====
    if (typeof App.colors.createNewProfile === 'function') {
        var _origCreateNewProfile = App.colors.createNewProfile;
        App.colors.createNewProfile = function() {
            _origCreateNewProfile();
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: createMultiColor (color-manager.js) — создание мультицвета =====
    if (typeof App.colors.createMultiColor === 'function') {
        var _origCreateMultiColor = App.colors.createMultiColor;
        App.colors.createMultiColor = function(nodeId, name, components, boundaries) {
            var result = _origCreateMultiColor(nodeId, name, components, boundaries);
            if (ensureDirty()) App.dirty.markStructureDirty();
            return result;
        };
    }

    // ===== ПАТЧ: proceedDeleteColor (color-manager.js) — удаление цвета =====
    if (typeof App.colors.proceedDeleteColor === 'function') {
        var _origProceedDeleteColor = App.colors.proceedDeleteColor;
        App.colors.proceedDeleteColor = function(nodeId, tableId, colorId) {
            _origProceedDeleteColor(nodeId, tableId, colorId);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

    // ===== ПАТЧ: copyRange (clipboard.js) — копирование (не меняет данные) =====
    // НЕ трогаем — копирование не меняет состояние

    // ===== ПАТЧ: pasteRange (clipboard.js) — вставка диапазона =====
    if (typeof App.clipboard.pasteRange === 'function') {
        var _origPasteRange = App.clipboard.pasteRange;
        App.clipboard.pasteRange = function(nodeId) {
            _origPasteRange(nodeId);
            if (ensureDirty() && nodeId) {
                App.dirty.markTableDirty(nodeId);
            }
        };
    }

    // ===== ПАТЧ: moveNodeWithChildren (drag-drop.js) — drag & drop =====
    if (typeof App.dragDrop.moveNodeWithChildren === 'function') {
        var _origMoveNodeWithChildren = App.dragDrop.moveNodeWithChildren;
        App.dragDrop.moveNodeWithChildren = function(sourceId, targetId) {
            _origMoveNodeWithChildren(sourceId, targetId);
            if (ensureDirty()) App.dirty.markStructureDirty();
        };
    }

})();