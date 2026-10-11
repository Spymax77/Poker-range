// ===== tree-toolbar.js — кнопки дерева и навигация клавишами =====

App.treeToolbar = App.treeToolbar || {};

// ===== НАВИГАЦИЯ ПО ДЕРЕВУ КЛАВИШАМИ =====
App.treeToolbar.onKeyDown = function(e) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key)) return;
    if (e.target instanceof Element &&
        (e.target.isContentEditable || e.target.matches('input, textarea, select'))) return;

    const activeTree = App.currentMode === 'gto'
        ? document.getElementById('gtoPage')?.classList.contains('active-page')
        : document.getElementById('constructorPage')?.classList.contains('active-page');
    if (!activeTree) return;

    if (App.tree.handleKeyboardNavigation(e.key)) {
        e.preventDefault();
        e.stopPropagation();
    }
};
document.addEventListener('keydown', App.treeToolbar.onKeyDown);

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ ДЕРЕВА ==========

document.getElementById('treeAddFolderBtn')?.addEventListener('click', App.tree.addRootNode);

// Создание корневого диапазона перенесено в tree.js (App.tree.addRootRange),
// чтобы тулбар и popup-меню папки вели себя одинаково, включая стартовый цвет.
document.getElementById('treeAddRangeBtn')?.addEventListener('click', App.tree.addRootRange);

App.treeToolbar.onRenameClick = function() {
    if (App.state.selectedNodeId) {
        const node = App.nodes.getNode(App.state.selectedNodeId);
        if (node) {
            App.tree.startInlineRename(App.state.selectedNodeId);
        } else {
            App.modals.showFloatingModal(App.i18n.t('tree.noActiveNodeToRename'));
        }
    }
};
document.getElementById('treeRenameBtn')?.addEventListener('click', App.treeToolbar.onRenameClick);

document.getElementById('treeMoveUpBtn')?.addEventListener('click', () => {
    if (App.state.selectedNodeId) App.tree.moveNodeUp(App.state.selectedNodeId);
});

document.getElementById('treeMoveDownBtn')?.addEventListener('click', () => {
    if (App.state.selectedNodeId) App.tree.moveNodeDown(App.state.selectedNodeId);
});

document.getElementById('treeDeleteBtn')?.addEventListener('click', () => {
    if (App.state.selectedNodeId) App.tree.deleteNode(App.state.selectedNodeId);
});

App.treeToolbar.onCollapseEditorClick = function() {
    const container = document.getElementById('constructorTree');
    if (!container) return;

    const rootIds = new Set(
        App.editor.nodes
            .filter(n => n.parentId === null)
            .map(n => n.id)
    );
    App.editor.expandedNodes = rootIds;

    // Плавно закрываем ВСЕ вложенные уровни (кроме корневых папок)
    container.querySelectorAll('.tree-children .tree-children.open').forEach(ch => ch.classList.remove('open'));
    // Меняем стрелки на ▶ только у нод внутри вложенных уровней
    container.querySelectorAll('.tree-children .tree-arrow').forEach(a => { if (a.textContent) a.textContent = '▶'; });

    // Состояние свёрнутости — часть метаданных, помечаем для сохранения
    if (App.dirty) App.dirty.markMetadataDirty('editor');
    App.persistence.persistAll();
};
document.getElementById('treeCollapseText')?.addEventListener('click', App.treeToolbar.onCollapseEditorClick);

App.treeToolbar.onCollapseGtoClick = function() {
    const container = document.getElementById('gtoTree');
    if (!container) return;

    const rootIds = new Set(
        App.gto.nodes
            .filter(n => n.parentId === null)
            .map(n => n.id)
    );
    App.gto.expandedNodes = rootIds;

    // Плавно закрываем ВСЕ вложенные уровни (кроме корневых папок)
    container.querySelectorAll('.tree-children .tree-children.open').forEach(ch => ch.classList.remove('open'));
    // Меняем стрелки на ▶ только у нод внутри вложенных уровней
    container.querySelectorAll('.tree-children .tree-arrow').forEach(a => { if (a.textContent) a.textContent = '▶'; });

    // Состояние свёрнутости — часть метаданных, помечаем для сохранения
    if (App.dirty) App.dirty.markMetadataDirty('gto');
    App.persistence.persistAll();
};
document.getElementById('gtoTreeCollapseText')?.addEventListener('click', App.treeToolbar.onCollapseGtoClick);
