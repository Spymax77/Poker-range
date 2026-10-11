// ===== tree-keyboard.js -- клавиатурная навигация по дереву =====
//
// Выделено из js/tree.js при разделении на js/tree/*.js: выбор ветки
// (редактор/GTO), список видимых узлов, раскрытие/свёртка узла,
// перемещение выбора, обработка клавиш.
//
// Файл обёрнут в IIFE: голые top-level function в классических скриптах
// запрещены правилами проекта. Наружу — только App.tree.*.
// App.tree.toggleNodeExpansion живёт здесь, но используется и из
// tree-render.js (buildTreeNodeArrow) — поэтому остаётся на App.tree.
(function() {

App.tree = App.tree || {};

// ===== КЛАВИАТУРНАЯ НАВИГАЦИЯ ПО ДЕРЕВУ =====
App.tree.getKeyboardBranch = function() {
    return App.currentMode === 'gto' ? App.gto : App.editor;
};

App.tree.getVisibleNodeIds = function(branch) {
    const result = [];
    const visit = function(node) {
        if (!node) return;
        result.push(node.id);
        if (!branch.expandedNodes.has(node.id)) return;
        (node.childrenIds || []).forEach(childId => visit(App.nodes.getNodeFrom(branch, childId)));
    };
    branch.nodes.filter(node => node.parentId === null).forEach(visit);
    return result;
};

App.tree.toggleNodeExpansion = function(nodeId, expanded) {
    const branch = App.tree.getKeyboardBranch();
    const node = App.nodes.getNodeFrom(branch, nodeId);
    if (!node || !node.childrenIds || !node.childrenIds.length) return false;

    const shouldExpand = expanded === undefined
        ? !branch.expandedNodes.has(nodeId)
        : expanded;
    if (shouldExpand) {
        branch.expandedNodes.add(nodeId);
    } else {
        branch.expandedNodes.delete(nodeId);
    }

    const treeId = App.currentMode === 'gto' ? 'gtoTree' : 'constructorTree';
    const item = document.querySelector(
        `#${treeId} .tree-item[data-node-id="${nodeId}"]`
    );
    const childrenDiv = item ? item.nextElementSibling : null;
    const arrow = item ? item.querySelector('.tree-arrow') : null;
    if (childrenDiv && childrenDiv.classList.contains('tree-children')) {
        childrenDiv.classList.toggle('open', shouldExpand);
    }
    if (arrow) {
        arrow.textContent = shouldExpand ? '▼' : '▶';
    }

    if (App.dirty) App.dirty.markMetadataDirty(App.currentMode);
    App.persistence.persistAll();
    return true;
};

App.tree.moveKeyboardSelection = function(offset) {
    const branch = App.tree.getKeyboardBranch();
    const visibleIds = App.tree.getVisibleNodeIds(branch);
    if (!visibleIds.length) return;

    const currentId = App.nodes.getNodeFrom(branch, branch.selectedNodeId)
        ? branch.selectedNodeId
        : branch.currentNodeId;
    const currentIndex = visibleIds.indexOf(currentId);
    const nextIndex = currentIndex < 0
        ? (offset > 0 ? 0 : visibleIds.length - 1)
        : Math.max(0, Math.min(visibleIds.length - 1, currentIndex + offset));
    const nextId = visibleIds[nextIndex];
    if (App.currentMode === 'gto') {
        App.navigation.selectGtoNode(nextId);
    } else {
        App.navigation.selectNode(nextId);
    }
};

App.tree.handleKeyboardNavigation = function(key) {
    const branch = App.tree.getKeyboardBranch();
    const selectedId = App.nodes.getNodeFrom(branch, branch.selectedNodeId)
        ? branch.selectedNodeId
        : branch.currentNodeId;
    const selectedNode = selectedId === null ? null : App.nodes.getNodeFrom(branch, selectedId);
    if (!selectedNode) return false;

    if (key === 'ArrowDown' || key === 'ArrowUp') {
        App.tree.moveKeyboardSelection(key === 'ArrowDown' ? 1 : -1);
        return true;
    }
    if (key === 'ArrowRight') {
        return App.tree.toggleNodeExpansion(selectedNode.id, true);
    }
    if (key === 'ArrowLeft') {
        if (selectedNode.childrenIds && selectedNode.childrenIds.length &&
            branch.expandedNodes.has(selectedNode.id)) {
            return App.tree.toggleNodeExpansion(selectedNode.id, false);
        }
        if (selectedNode.parentId !== null) {
            return App.tree.toggleNodeExpansion(selectedNode.parentId, false);
        }
    }
    if (key === 'Delete') {
        // Удаление доступно только в редакторе: в GTO дерево read-only
        // (меню с удалением рендерится только при editable), а App.nodes.getNode
        // ищет по индексу редактора — можно удалить чужой узел.
        if (App.currentMode === 'gto') return false;
        App.tree.deleteNode(selectedNode.id);
        return true;
    }
    return false;
};

})();