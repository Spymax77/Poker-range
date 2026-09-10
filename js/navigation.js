// ===== navigation.js — основная навигация (выбор узла, вкладки, рендер GTO) =====

App.navigation = App.navigation || {};

App.navigation.selectNode = function(nodeId) {
    let node = getNode(nodeId);
    App.state.selectedNodeId = nodeId;
    if (node && node.type === 'folder') {
        App.tree.renderTree("constructorTree", App.state.selectedNodeId, true, App.navigation.selectNode);
        App.tree.scrollNodeIntoView(nodeId);
        return;
    }
    if (nodeId === App.state.currentNodeId) {
        App.tree.renderTree("constructorTree", App.state.selectedNodeId, true, App.navigation.selectNode);
        App.tree.scrollNodeIntoView(nodeId);
        return;
    }
    App.state.currentNodeId = nodeId;
   persistAll();

    if (node && node.parentId !== null) {
        App.state.expandedNodes.add(node.parentId);
    }

    App.grid.updateCurrentDisplay();
    App.refresh.all();
    if (document.getElementById("workPage").classList.contains("active-page")) {
        App.work.updateDisplay();
    }
    App.tree.scrollNodeIntoView(nodeId);

    // ===== АНИМАЦИИ =====
    App.animations.constructorFade();
}

// ===== GTO РЕНДЕРИНГ =====
App.navigation.renderGtoPage = function() {
    const prevMode = App.currentMode;
    App.currentMode = 'gto';
    try {
        const selectedGtoNode = getNodeFrom(App.gto, App.gto.selectedNodeId);
        const activeGtoNode = getNodeFrom(App.gto, App.gto.currentNodeId);
        const treeActiveNodeId = selectedGtoNode ? selectedGtoNode.id
            : (activeGtoNode ? activeGtoNode.id : null);
        App.gto.selectedNodeId = treeActiveNodeId;
        App.tree.renderTree("gtoTree", treeActiveNodeId, false, App.navigation.selectGtoNode);
        App.grid.renderGrid("gtoGrid", App.gto.currentNodeId, null);
        App.colors.renderAllColors(App.gto.currentNodeId, true);

        // Всё остальное показываем только когда матрица уже загружена
        const hasTable = App.gto.currentNodeId && App.state.cellStorage[getTableId(App.gto.currentNodeId)];

        // Название диапазона
        const nameEl = document.getElementById("gtoRangeName");
        const titleWrapper = nameEl ? nameEl.closest('.range-title-wrapper') : null;
        if (nameEl && hasTable) {
            const node = getNodeFrom(App.gto, App.gto.currentNodeId);
            nameEl.textContent = node ? node.name : "GTO диапазон";
        }

        // Легенда и action bar
        const legendCol = document.querySelector('#gtoPage .gto-legend-col');
        if (hasTable) {
            if (titleWrapper) titleWrapper.style.display = '';
            if (legendCol) legendCol.style.display = '';
            App.stats.renderStatsTable(App.gto.currentNodeId, App.gto, 'gtoStatsContainer');
            App.stats.renderActionLegend(App.gto.currentNodeId, App.gto, 'gtoActionLegend');
            App.stats.renderActionBar(App.gto.currentNodeId, App.gto, 'gtoActionBar');
        } else {
            if (titleWrapper) titleWrapper.style.display = 'none';
            if (legendCol) legendCol.style.display = 'none';
            const statsEl = document.getElementById('gtoStatsContainer');
            if (statsEl) statsEl.textContent = '';
        }
        
        // ===== КНОПКА: ПОКАЗАТЬ/СКРЫТЬ ОВЕРЛЕИ ПОДДИАПАЗОНОВ (GTO) =====
        const gtoWrapper = document.querySelector('#gtoPage .matrix-wrapper');
        if (gtoWrapper) {
            const node = getNodeFrom(App.gto, App.gto.currentNodeId);
            const isSubrange = node && node.type === 'subrange';
            let overlayBtn = document.getElementById('gtoOverlayToggleBtn');
            if (isSubrange && hasTable) {
                if (!overlayBtn) {
                    gtoWrapper.style.position = 'relative';
                    overlayBtn = document.createElement('button');
                    overlayBtn.id = 'gtoOverlayToggleBtn';
                    overlayBtn.className = 'matrix-btn';
                    overlayBtn.style.display = 'none';
                    overlayBtn.dataset.tooltip = 'высота диапазона';
                    overlayBtn.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                            <rect x="2" y="2" width="20" height="20" rx="1" />
                            <rect x="2" y="12" width="20" height="10" fill="currentColor" stroke="none" rx="1" />
                        </svg>
                    `;
                    gtoWrapper.appendChild(overlayBtn);
                    overlayBtn.addEventListener('click', function() {
                        const wrapper = document.querySelector('#gtoPage .matrix-wrapper');
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
                            overlayBtn.dataset.tooltip = isHidden ? 'полная высота' : 'высота диапазона';
                        }
                    });
                }
                overlayBtn.style.display = 'flex';
            } else {
                if (overlayBtn) overlayBtn.style.display = 'none';
            }
        }
    } finally {
        App.currentMode = prevMode;
    }
}

App.navigation.selectGtoNode = function(nodeId) {
    const node = getNodeFrom(App.gto, nodeId);
    App.gto.selectedNodeId = nodeId;
    if (node && node.type === 'folder') {
        App.tree.renderTree("gtoTree", App.gto.selectedNodeId, false, App.navigation.selectGtoNode);
        App.tree.scrollNodeIntoView(nodeId);
        return;
    }
    if (nodeId === App.gto.currentNodeId) {
        App.tree.renderTree("gtoTree", App.gto.selectedNodeId, false, App.navigation.selectGtoNode);
        App.tree.scrollNodeIntoView(nodeId);
        return;
    }
    // При переключении узла матрица GTO перестраивается с нуля (renderGrid
    // очищает innerHTML), поэтому DOM-класс закреплённой ячейки всё равно
    // потеряется — сбрасываем и сам стейт закрепления, чтобы не осталось
    // "зависшего" превью от предыдущего диапазона.
    if (typeof App.grid.unpinGtoCell === 'function') App.grid.unpinGtoCell();
    if (typeof App.grid.hideCellPreview === 'function') App.grid.hideCellPreview('gtoCellPreview');
    App.gto.currentNodeId = nodeId;
    if (node && node.parentId !== null) {
        App.gto.expandedNodes.add(node.parentId);
    }
    if (App.dirty) App.dirty.markMetadataDirty('gto');
    persistAll();
    App.navigation.renderGtoPage();
    App.tree.scrollNodeIntoView(nodeId);
    App.animations.gtoFade();
}

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ =====
App.navigation.switchTab = function(page) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(`.tab-btn[data-page="${page}"]`).classList.add("active");

    // Не сбрасываем сам режим анализа при переходе на другую вкладку (он должен
    // сохраняться до возврата в конструктор), но снимаем закрепление ячейки
    // кликом — постоянный показ превью и рамка не должны "утекать" на другие
    // вкладки и должны сбрасываться каждый раз при уходе из конструктора.
    if (page !== "constructor") {
        App.grid.unpinConstructorCell();
        App.grid.hideCellPreview('constructorCellPreview');
    }

    // Скрыть все страницы
    document.getElementById("constructorPage").classList.remove("active-page");
    document.getElementById("gtoPage").classList.remove("active-page");
    document.getElementById("workPage").classList.remove("active-page");

    if (page === "gto") {
    App.currentMode = 'gto';
    
    // Таблицы GTO read-only и после перезагрузки восстанавливаются из JSON.
    // При этом loadGtoData сохраняет метаданные текущего дерева.
    if (!App.gto.nodes || App.gto.nodes.length === 0 ||
        !App.gto.cellStorage || Object.keys(App.gto.cellStorage).length === 0) {
        if (window.loadDefaultGto) {
            loadDefaultGto();
        }
    }
    if (!App.gto.selectedNodeId) {
        App.gto.selectedNodeId = App.gto.currentNodeId;
    }
    
    document.getElementById("gtoPage").classList.add("active-page");
    App.navigation.renderGtoPage();
    App.animations.gtoFade();
}
	
	else if (page === "constructor") {
        App.currentMode = 'editor';
        if (!App.state.currentNodeId) {
            const firstRange = App.state.nodes.find(n => n.type === 'range' || n.type === 'subrange');
            if (firstRange) {
                App.state.currentNodeId = firstRange.id;
            }
        }
        if (!App.state.selectedNodeId) {
            App.state.selectedNodeId = App.state.currentNodeId;
        }
        document.getElementById("constructorPage").classList.add("active-page");
        App.refresh.all();
        App.animations.constructorFade();

        // Показываем комментарии в редакторе
        const cmtWrapperEd = document.getElementById('commentsWrapper');
        if (cmtWrapperEd) cmtWrapperEd.style.display = 'block';
        const cmtToggleEd = document.getElementById('commentsToggleBtn');
        if (cmtToggleEd) cmtToggleEd.style.display = 'flex';
    } else if (page === "work") {
        App.currentMode = 'editor';  // Просмотр всегда из редактора
        if (!App.state.workDisplayNodeId) {
            const firstRange = App.state.nodes.find(n => n.type === 'range' || n.type === 'subrange');
            if (firstRange) {
                App.state.workDisplayNodeId = firstRange.id;
            }
        }
        document.getElementById("workPage").classList.add("active-page");

        const commentsWrapper = document.getElementById('commentsWrapper');
        if (commentsWrapper) {
            commentsWrapper.style.display = 'block';
        }
        App.comments.renderWorkComments(App.state.workDisplayNodeId);
        App.refresh.all();
    }

    persistAll();
    persistActiveTab(page);
}
