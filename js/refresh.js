// ===== refresh.js — обновление интерфейса =====

App.refresh = App.refresh || {};

// ===== RESET TO CLEAN DATA =====
App.refresh.resetToCleanData = function() {
    App.state.nodes = [];
    App.state.nodeIndex = new Map();
    App.state.nextNodeId = 1;
    App.state.currentNodeId = null;
    App.state.selectedNodeId = null;
    App.state.cellStorage = {};
    App.state.expandedNodes = new Set();
    App.state.workLevels = [{ parentNodeId: null, levelIndex: 0 }];
    App.state.workDisplayNodeId = null;
    App.state.colorsPerNode = {};
    App.state.activePerNode = {};
    App.state.nextColorId = 1;
    App.state.commentsPerNode = {};

    const rootId = App.state.nextNodeId++;
    const rootNode = {
        id: rootId,
        name: 'My Ranges',
        parentId: null,
        childrenIds: [],
        type: 'folder'
    };
    addNode(rootNode);
    App.state.expandedNodes.add(rootId);
    const positions = ['EP', 'MP', 'CO', 'BU', 'SB', 'BB'];
    let epRangeId = null;
    let epFolderId = null;

    for (const pos of positions) {
        let folderId = App.state.nextNodeId++;
        const folderNode = {
            id: folderId,
            name: pos,
            parentId: rootId,
            childrenIds: [],
            type: 'folder'
        };
        addNode(folderNode);
		 rootNode.childrenIds.push(folderId);
        App.grid.ensureTable(folderId);

        if (pos === 'EP') {
            epFolderId = folderId;
        }

        // Создаём диапазон Open raise внутри папки
        let rangeId = App.state.nextNodeId++;
        const rangeNode = {
            id: rangeId,
            name: "Open raise",
            parentId: folderId,
            childrenIds: [],
            type: 'range'
        };
        addNode(rangeNode);
        folderNode.childrenIds.push(rangeId);
        App.grid.ensureTable(rangeId);

        if (pos === 'EP') {
            epRangeId = rangeId;
            App.state.expandedNodes.add(folderId);
        }

        // Создаём 2 цвета для диапазона
        const tableId = getTableId(rangeId);
        App.state.colorsPerNode[tableId] = [];

       const colorId = App.state.nextColorId++;
    App.state.colorsPerNode[tableId].push({
    id: colorId,
    name: "action",
    color: "#9C5479",
    type: 'simple'
});

App.state.activePerNode[tableId] = colorId;
    }

    if (epRangeId) {
        App.state.currentNodeId = epRangeId;
        App.state.workDisplayNodeId = epRangeId;
    }

    persistAll();
}

// ===== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА =====
App.refresh.all = function() {
    // Только для редактора
    if (document.getElementById("constructorPage").classList.contains("active-page")) {
        App.tree.renderTree("constructorTree", App.editor.selectedNodeId || App.editor.currentNodeId, true, App.navigation.selectNode);
        App.grid.updateCurrentDisplay();
        App.colors.renderAllColors(App.editor.currentNodeId, true);
        App.comments.renderComments(App.editor.currentNodeId);
    }
    // Просмотр — отдельно
    if (document.getElementById("workPage").classList.contains("active-page")) {
        App.work.updateDisplay();
        App.colors.renderAllColors(App.editor.workDisplayNodeId, false);
    }
    App.clipboard.updatePasteButtonState();
}

App.refresh.allGrids = function() {
    if (document.getElementById("constructorPage").classList.contains("active-page") && App.state.currentNodeId) {
        App.grid.updateCurrentDisplay();
    } else if (document.getElementById("gtoPage").classList.contains("active-page") && App.gto.currentNodeId) {
        App.grid.renderGrid("gtoGrid", App.gto.currentNodeId, null);
        App.stats.renderBranchStats(App.gto.currentNodeId, App.gto, App.stats.CONTAINERS.gto);
    } else if (document.getElementById("workPage").classList.contains("active-page") && App.state.workDisplayNodeId) {
        App.work.updateGrid();
    }
}
