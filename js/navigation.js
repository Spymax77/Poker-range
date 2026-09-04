// ===== navigation.js -- extracted from all.js (select/switch, work nav, style popup) =====
// ===== СОХРАНЕНИЕ СТИЛЕЙ КНОПОК =====
function saveButtonStyle(nodeId, bg, border, text) {
    if (!nodeId) return;
    const data = {};
    if (bg) data.bg = bg;
    if (border) data.border = border;
    if (text) data.text = text;
    App.storage.save('btn_style_' + nodeId, data);
}

function loadButtonStyle(nodeId) {
    if (!nodeId) return null;
    return App.storage.load('btn_style_' + nodeId);
}
// ===== RESET TO CLEAN DATA =====
function resetToCleanData() {
    App.state.nodes = [];
    App.state.nodeIndex = new Map();
    App.state.nextNodeId = 1;
    App.state.currentNodeId = null;
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
        ensureTable(folderId);

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
        ensureTable(rangeId);

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
function selectNode(nodeId) {
    let node = getNode(nodeId);
    if (node && node.type === 'folder') {
        return;
    }
    App.state.currentNodeId = nodeId;
   persistAll();

    if (node && node.parentId !== null) {
        App.state.expandedNodes.add(node.parentId);
    }

    updateCurrentDisplay();
    refreshAll();
    if (document.getElementById("workPage").classList.contains("active-page")) {
        updateWorkDisplay();
    }

    // ===== АНИМАЦИИ =====
    animateConstructorFade();
}
// ===== GTO РЕНДЕРИНГ =====
function renderGtoPage() {
    // renderTree / renderGrid / renderAllColors работают через App.state и
    // App.currentMode: выбирают и ветку данных, и контейнеры (paletteList или
    // gtoPaletteList). renderGtoPage может быть вызван, когда активен редактор
    // (асинхронная загрузка GTO из gto-loader завершается уже после старта) —
    // тогда без переключения режима цветовой блок GTO попадал бы в контейнеры
    // редактора и затирал палитру активной матрицы. Поэтому на время рендера
    // жёстко включаем режим 'gto' и возвращаем предыдущий.
    const prevMode = App.currentMode;
    App.currentMode = 'gto';
    try {
        renderTree("gtoTree", App.gto.currentNodeId, false, selectGtoNode);
        renderGrid("gtoGrid", App.gto.currentNodeId, null);
        renderAllColors(App.gto.currentNodeId, true);

        // Название диапазона
        const nameEl = document.getElementById("gtoRangeName");
        if (nameEl) {
            const node = getNodeFrom(App.gto, App.gto.currentNodeId);
            nameEl.textContent = node ? node.name : "GTO диапазон";
        }

        // Статистика
        updateGtoStats(App.gto.currentNodeId);
        renderActionLegend(App.gto.currentNodeId, App.gto, 'gtoActionLegend');
        renderActionBar(App.gto.currentNodeId, App.gto, 'gtoActionBar');
        
        // ===== КНОПКА: ПОКАЗАТЬ/СКРЫТЬ ОВЕРЛЕИ ПОДДИАПАЗОНОВ (GTO) =====
        const gtoWrapper = document.querySelector('#gtoPage .matrix-wrapper');
        if (gtoWrapper) {
            const node = getNodeFrom(App.gto, App.gto.currentNodeId);
            const isSubrange = node && node.type === 'subrange';
            let overlayBtn = document.getElementById('gtoOverlayToggleBtn');
            if (isSubrange) {
                if (!overlayBtn) {
                    gtoWrapper.style.position = 'relative';
                    overlayBtn = document.createElement('button');
                    overlayBtn.id = 'gtoOverlayToggleBtn';
                    overlayBtn.className = 'matrix-btn';
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

function selectGtoNode(nodeId) {
    const node = getNodeFrom(App.gto, nodeId);
    if (node && node.type === 'folder') {
        return;  // ← НЕ ДАЁМ КЛИКНУТЬ НА ПАПКУ
    }
    // При переключении узла матрица GTO перестраивается с нуля (renderGrid
    // очищает innerHTML), поэтому DOM-класс закреплённой ячейки всё равно
    // потеряется — сбрасываем и сам стейт закрепления, чтобы не осталось
    // "зависшего" превью от предыдущего диапазона.
    if (typeof unpinGtoCell === 'function') unpinGtoCell();
    if (typeof hideCellPreview === 'function') hideCellPreview('gtoCellPreview');
    App.gto.currentNodeId = nodeId;
    if (node && node.parentId !== null) {
        App.gto.expandedNodes.add(node.parentId);
    }
    persistAll();
    renderGtoPage();
    animateGtoFade();
}

// ===== АНИМАЦИЯ МЕРЦАНИЯ ДЛЯ КОНСТРУКТОРА =====
function animateConstructorFade() {
    const grid = document.getElementById('constructorGrid');
    if (grid) {
        grid.classList.remove('matrix-fade');
        void grid.offsetWidth;
        grid.classList.add('matrix-fade');
    }

    const palette = document.getElementById('paletteList');
    if (palette) {
        palette.classList.remove('palette-fade');
        void palette.offsetWidth;
        palette.classList.add('palette-fade');
    }

    const profiles = document.getElementById('profileList');
    if (profiles) {
        profiles.classList.remove('profiles-fade');
        void profiles.offsetWidth;
        profiles.classList.add('profiles-fade');
    }

    const legend = document.querySelector('.constructor-legend-col');
    if (legend) {
        legend.classList.remove('matrix-fade');
        void legend.offsetWidth;
        legend.classList.add('matrix-fade');
    }

    const addColorBtn = document.getElementById('addPaletteColorBtn');
    if (addColorBtn) {
        addColorBtn.classList.remove('buttons-fade');
        void addColorBtn.offsetWidth;
        addColorBtn.classList.add('buttons-fade');
    }

    const addProfileBtn = document.getElementById('newProfileBtn');
    if (addProfileBtn) {
        addProfileBtn.classList.remove('buttons-fade');
        void addProfileBtn.offsetWidth;
        addProfileBtn.classList.add('buttons-fade');
    }
}

// ===== АНИМАЦИЯ МЕРЦАНИЯ ДЛЯ GTO =====
function animateGtoFade() {
    const grid = document.getElementById('gtoGrid');
    if (grid) {
        grid.classList.remove('matrix-fade');
        void grid.offsetWidth;
        grid.classList.add('matrix-fade');
    }

    const palette = document.getElementById('gtoPaletteList');
    if (palette) {
        palette.classList.remove('palette-fade');
        void palette.offsetWidth;
        palette.classList.add('palette-fade');
    }

    const profiles = document.getElementById('gtoProfileList');
    if (profiles) {
        profiles.classList.remove('profiles-fade');
        void profiles.offsetWidth;
        profiles.classList.add('profiles-fade');
    }

    const legend = document.querySelector('.gto-legend-col');
    if (legend) {
        legend.classList.remove('matrix-fade');
        void legend.offsetWidth;
        legend.classList.add('matrix-fade');
    }

    const addColorBtn = document.getElementById('gtoAddPaletteColorBtn');
    if (addColorBtn) {
        addColorBtn.classList.remove('buttons-fade');
        void addColorBtn.offsetWidth;
        addColorBtn.classList.add('buttons-fade');
    }

    const addProfileBtn = document.getElementById('gtoNewProfileBtn');
    if (addProfileBtn) {
        addProfileBtn.classList.remove('buttons-fade');
        void addProfileBtn.offsetWidth;
        addProfileBtn.classList.add('buttons-fade');
    }
}

function findFirstRange(nodeId) {
    let node = getNode(nodeId);
    if (!node) return null;
    if (node.type === 'range' || node.type === 'subrange') return node.id;
    for (let childId of node.childrenIds) {
        let result = findFirstRange(childId);
        if (result !== null) return result;
    }
    return null;
}

// Проверяет, входит ли узел nodeId в цепочку предков текущего отображаемого
// диапазона (включая сам узел). Нужно, чтобы подсвечивать все родительские
// кнопки пути (1-й, 2-й, 3-й уровень и т.д.).
function isNodeInWorkPath(nodeId) {
    if (App.state.workDisplayNodeId === nodeId) return true;
    let cur = getNode(App.state.workDisplayNodeId);
    if (!cur) return false;
    let p = cur.parentId;
    while (p !== null) {
        if (p === nodeId) return true;
        const parentNode = getNode(p);
        p = parentNode ? parentNode.parentId : null;
    }
    return false;
}

function renderWorkNavigation() {
    const container = document.getElementById("workLevelsContainer");
    if (!container) return;
    container.innerHTML = "";

    for (let li = 0; li < App.state.workLevels.length; li++) {
        const level = App.state.workLevels[li];
        const parentId = level.parentNodeId;
        let children = [];

        if (parentId === null) {
            children = App.state.nodes.filter(n => n.parentId === null);
            let rootOrder = App.state.nodes.filter(n => n.parentId === null).map(n => n.id);
            children.sort((a, b) => rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id));
        } else {
            let parent = getNode(parentId);
            if (parent) {
                children = parent.childrenIds.map(cid => getNode(cid)).filter(n => n);
                children.sort((a, b) => parent.childrenIds.indexOf(a.id) - parent.childrenIds.indexOf(b.id));
            }
        }

        if (children.length === 0) continue;

        const levelDiv = document.createElement("div");
        levelDiv.className = "work-level";
        levelDiv.style.display = "flex";
        levelDiv.style.flexWrap = "wrap";
        levelDiv.style.gap = "8px";

        for (let child of children) {
            if (child.type === 'folder') {
                let parent = getNode(child.parentId);
                let parentIsRange = parent && parent.type === 'range';
                let parentIsSelectedRange = parentIsRange && App.state.workLevels.some(l => l.parentNodeId === child.parentId);

                if (!parentIsSelectedRange) {
                    const btn = document.createElement("button");
                    btn.className = "folder-btn folder-btn-" + child.id;
                    btn.innerText = child.name;
					btn.style.border = '2px solid #3d3d3d';
                    btn.style.color = '#a9afb5';
					// === ЗАГРУЖАЕМ СОХРАНЁННЫЙ СТИЛЬ ===
const saved = loadButtonStyle(child.id);
if (saved) {
    if (saved.bg) {
        btn.style.background = saved.bg;
        btn.style.borderColor = saved.border || saved.bg;
    }
    if (saved.text) {
        btn.style.color = saved.text;
    }
}
					
                    btn.onclick = (function(c, idx) {
    return function() {
        App.state.workLevels = App.state.workLevels.slice(0, idx + 1);
        App.state.workLevels.push({ parentNodeId: c.id, levelIndex: idx + 1 });
        
        // Находим первый диапазон внутри папки
        let firstRange = findFirstRange(c.id);
        if (firstRange !== null) {
            App.state.workDisplayNodeId = firstRange;
        }
        
        persistAll();
        updateWorkDisplay();
    };
})(child, li);
// === ЗОЛОТАЯ КАПЛЯ ДЛЯ ПАПКИ ===
const dot = document.createElement('span');
dot.className = 'edit-dot';
dot.innerHTML = `
    <svg viewBox="-5 -1.5 24 24">
        <path d="M7 .565c4.667 6.09 7 10.423 7 13a7 7 0 1 1-14 0c0-2.577 2.333-6.91 7-13z" />
    </svg>
`;
dot.addEventListener('click', function(e) {
    e.stopPropagation();
    const container = document.getElementById('workLevelsContainer');
    if (!container || !container.classList.contains('style-edit-mode')) return;
    showStylePopup(btn);
});
btn.appendChild(dot);


                  const lastLevel = App.state.workLevels[App.state.workLevels.length - 1];
const isActiveFolder = lastLevel && lastLevel.parentNodeId === child.id;

// Проверяем, находится ли активный диапазон внутри этой папки
let isRangeInsideFolder = false;
if (App.state.workDisplayNodeId) {
    const activeRange = getNode(App.state.workDisplayNodeId);
    if (activeRange) {
        let parent = activeRange.parentId;
        while (parent !== null) {
            if (parent === child.id) {
                isRangeInsideFolder = true;
                break;
            }
            const parentNode = getNode(parent);
            parent = parentNode ? parentNode.parentId : null;
        }
    }
}

if (isActiveFolder || isRangeInsideFolder) {
    btn.classList.add("active");
} else {
    btn.classList.remove("active");
}
                    levelDiv.appendChild(btn);
                }
            } else if (child.type === 'range' || child.type === 'subrange') {
                let parent = getNode(child.parentId);
                let parentIsRange = parent && parent.type === 'range';
                let parentIsSelectedRange = parentIsRange && App.state.workLevels.some(l => l.parentNodeId === child.parentId);
                let isRoot = child.parentId === null;

                    if (isRoot || !parentIsSelectedRange || child.type === 'subrange') {
                    const link = document.createElement("span");
                    link.className = "range-link range-link-" + child.id;
                    link.innerText = child.name;
					const saved = loadButtonStyle(child.id);
if (saved && saved.text) {
    link.style.color = saved.text;
}
                    if (isNodeInWorkPath(child.id)) {
                        link.classList.add("active");
                    } else {
                        link.classList.remove("active");
                    }
                    link.onclick = (function(c) {
                        return function() {
                            App.state.workDisplayNodeId = c.id;
                            let path = [];
                            let current = c;
                            while (current && current.parentId !== null) {
                                let parentNode = getNode(current.parentId);
                                if (parentNode) {
                                    path.unshift(parentNode);
                                    current = parentNode;
                                } else {
                                    current = null;
                                }
                            }
                            App.state.workLevels = [{ parentNodeId: null, levelIndex: 0 }];
                            for (let p of path) {
                                App.state.workLevels.push({ parentNodeId: p.id, levelIndex: App.state.workLevels.length });
                            }
                            App.state.workLevels.push({ parentNodeId: c.id, levelIndex: App.state.workLevels.length });
                            persistAll();
                            updateWorkDisplay();
                            updateWorkGrid();
                        };
                    })(child);
// === ЗОЛОТАЯ КАПЛЯ ДЛЯ ДИАПАЗОНА ===
const dotLink = document.createElement('span');
dotLink.className = 'edit-dot';
dotLink.innerHTML = `
    <svg viewBox="-5 -1.5 24 24">
        <path d="M7 .565c4.667 6.09 7 10.423 7 13a7 7 0 1 1-14 0c0-2.577 2.333-6.91 7-13z" />
    </svg>
`;
dotLink.addEventListener('click', function(e) {
    e.stopPropagation();
    const container = document.getElementById('workLevelsContainer');
    if (!container || !container.classList.contains('style-edit-mode')) return;
    showStylePopup(link);
});
link.appendChild(dotLink);
                    levelDiv.appendChild(link);
                }
            }
        }

        container.appendChild(levelDiv);

        if (li === 0) {
            let sel = getNode(App.state.workDisplayNodeId);
            let rangeNode = sel;
            if (sel && sel.type === 'subrange') {
                rangeNode = getNode(sel.parentId);
            }
            if (rangeNode && rangeNode.type === 'range' && rangeNode.parentId === null) {
                let isInLevels = App.state.workLevels.some(l => l.parentNodeId === rangeNode.id);
                if (isInLevels) {
                    let kids = rangeNode.childrenIds.map(cid => getNode(cid)).filter(n => n);
                    if (kids.length) {
                        let alreadyAdded = false;
                        let mainDiv = container.querySelector('.work-level:last-child');
                        if (mainDiv) {
                            let mainItems = mainDiv.querySelectorAll('.folder-btn, .range-link');
                            mainItems.forEach(el => {
                                if (kids.some(k => k.name === el.textContent)) {
                                    alreadyAdded = true;
                                }
                            });
                        }
                        if (!alreadyAdded) {
                            const hr = document.createElement("hr");
                            hr.style.margin = "8px 0";
                            hr.style.border = "0";
                            hr.style.borderTop = "1px solid #3D3D3D";
                            container.appendChild(hr);

                            const subLevelDiv = document.createElement("div");
                            subLevelDiv.className = "work-level";
                            subLevelDiv.style.display = "flex";
                            subLevelDiv.style.flexWrap = "wrap";
                            subLevelDiv.style.gap = "8px";
                            subLevelDiv.style.marginBottom = "8px";
                            subLevelDiv.style.paddingLeft = "20px";

                            for (let kid of kids) {
                                if (kid.type === 'folder') {
                                    const subBtn = document.createElement("button");
                                    subBtn.className = "folder-btn folder-btn-" + child.id;
                                    subBtn.innerText = kid.name;
                                    subBtn.onclick = (function(k, idx) {
                                        return function() {
                                            App.state.workLevels = App.state.workLevels.slice(0, idx + 1);
                                            App.state.workLevels.push({ parentNodeId: k.id, levelIndex: idx + 1 });
                                            let firstRange = findFirstRange(k.id);
                                            if (firstRange !== null) {
                                                App.state.workDisplayNodeId = firstRange;
                                            }
                                            persistAll();
                                            updateWorkDisplay();
                                        };
                                    })(kid, App.state.workLevels.length);
                                    subLevelDiv.appendChild(subBtn);
                                } else if (kid.type === 'subrange') {
                                    const subLink = document.createElement("span");
                                    subLink.className = "range-link range-link-" + child.id;
                                    subLink.innerText = kid.name;
                                    if (isNodeInWorkPath(kid.id)) {
                                        subLink.classList.add("active");
                                    } else {
                                        subLink.classList.remove("active");
                                    }
                                    subLink.onclick = (function(k) {
                                        return function() {
                                            App.state.workDisplayNodeId = k.id;
                                            persistAll();
                                            updateWorkDisplay();
                                            updateWorkGrid();
                                        };
                                    })(kid);
                                    subLevelDiv.appendChild(subLink);
                                }
                            }
                            container.appendChild(subLevelDiv);
                        }
                    }
                }
            }
        }

        if (li < App.state.workLevels.length - 1) {
            const hr = document.createElement("hr");
            hr.style.border = "0";
            hr.style.borderTop = "1px solid #3D3D3D";
            container.appendChild(hr);
        }
    }

    if (!App.state.workDisplayNodeId) {
        const gridDiv = document.getElementById("workGrid");
        if (gridDiv) {
            gridDiv.innerHTML = "<div style='padding:20px; color: var(--text-muted);'>Выберите диапазон</div>";
        }
    }

}

function updateWorkGrid() {
    if (!App.state.workDisplayNodeId) return;
        
    let total = countTotalCombos(App.state.workDisplayNodeId);
    let percent = (total / 1326 * 100).toFixed(1);
    document.getElementById("workStats").innerHTML = `${percent}% (${total}/1326)`;
    renderGrid("workGrid", App.state.workDisplayNodeId, null);
    renderComments(App.state.workDisplayNodeId);
    updateWorkColorStats(App.state.workDisplayNodeId);
}
function updateWorkDisplay() {
	    // ===== ПРОВЕРКА ВАЛИДНОСТИ App.state.workDisplayNodeId =====
    const isValid = App.state.workDisplayNodeId && !!getNode(App.state.workDisplayNodeId);
    if (!isValid) {
        const firstRange = App.state.nodes.find(n => n.type === 'range' || n.type === 'subrange');
        if (firstRange) {
            App.state.workDisplayNodeId = firstRange.id;
        } else {
            App.state.workDisplayNodeId = null;
        }
    }
    renderWorkNavigation();
	// ===== ПОКАЗЫВАЕМ ВЛОЖЕННЫЕ ЭЛЕМЕНТЫ АКТИВНОГО ДИАПАЗОНА =====
if (App.state.workDisplayNodeId) {
    const activeNode = getNode(App.state.workDisplayNodeId);
    if (activeNode && activeNode.childrenIds && activeNode.childrenIds.length > 0) {
        const existingLevel = App.state.workLevels.find(l => l.parentNodeId === App.state.workDisplayNodeId);
        if (!existingLevel) {
            App.state.workLevels.push({ parentNodeId: App.state.workDisplayNodeId, levelIndex: App.state.workLevels.length });
            renderWorkNavigation();
        }
    }
}
    if (App.state.workDisplayNodeId) {
        updateWorkGrid();
		const workGrid = document.getElementById('workGrid');
        if (workGrid) {
            workGrid.classList.remove('matrix-fade');
            void workGrid.offsetWidth;
            workGrid.classList.add('matrix-fade');
        }
        let titleEl = document.getElementById("workRangeName");
        let node = getNode(App.state.workDisplayNodeId);
        if (titleEl && node) {
            // Собираем цепочку предков от текущего узла до корня (по parentId).
            // Папки (type === 'folder') не отображаем — только диапазоны и поддиапазоны.
            const chain = [];
            let cur = node;
            while (cur) {
                if (cur.type === 'range' || cur.type === 'subrange') {
                    chain.push(cur.name);
                }
                cur = (cur.parentId != null) ? getNode(cur.parentId) : null;
            }
            chain.reverse();
            titleEl.innerHTML = chain
                .map(name => escapeHtml(name))
                .join('<span class="breadcrumb-arrow">&#9654;</span>');
        }
    }
    
    // ========================================
    // ИКОНКИ (привязаны к таблице)
    // ========================================
    
    const workTableWrapper = document.querySelector('.matrix1-wrapper');
    const rangeNode = getNode(App.state.workDisplayNodeId);
    const isSubrange = rangeNode && rangeNode.type === 'subrange';
    
    if (workTableWrapper) {
		        // ===== НОВАЯ ИКОНКА: РЕДАКТИРОВАТЬ СТИЛИ =====
        let styleBtn = document.getElementById('styleEditToggle');
        if (!styleBtn) {
            styleBtn = document.createElement('button');
            styleBtn.id = 'styleEditToggle';
            styleBtn.className = 'icon-btn matrix-btn';
            styleBtn.dataset.tooltip = 'Редактировать стили кнопок';
            styleBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" stroke="#8a848a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.2,15l6.7-6.7c1-1,1.2-2.5,0.5-3.7c-1-1.5-3.2-1.7-4.4-0.4L17.2,11l0,0c-1.1-1.1-2.9-1.1-4,0l-0.7,0.7l8.1,8.1l0.7-0.7C22.4,17.9,22.4,16.1,21.2,15L21.2,15z"/>
                    <path d="M13,12c-3,3-6.9,4.6-10,5h0l11.5,11.5L20,20"/>
                </svg>
            `;
            workTableWrapper.appendChild(styleBtn);

            // Заглушка на клик
       styleBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    
    // Находим контейнер с кнопками
    const container = document.getElementById('workLevelsContainer');
    if (container) {
        container.classList.toggle('style-edit-mode');
    }
    
    this.classList.toggle('active');
});
        }
            
            // ===== КНОПКА: КОММЕНТАРИИ =====
        let iconBtn = document.getElementById('workCommentsToggleBtn');
        if (!iconBtn) {
            workTableWrapper.style.position = 'relative';
            iconBtn = document.createElement('button');
            iconBtn.id = 'workCommentsToggleBtn';
            iconBtn.className = 'comments-toggle-btn matrix-btn';
            iconBtn.dataset.tooltip = 'Комментарии';
            iconBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 32 32" fill="#8a848a" xmlns="http://www.w3.org/2000/svg">
                    <path  d="M25.7,9.3l-7-7A.9078.9078,0,0,0,18,2H8A2.0059,2.0059,0,0,0,6,4V28a2.0059,2.0059,0,0,0,2,2H24a2.0059,2.0059,0,0,0,2-2V10A.9078.9078,0,0,0,25.7,9.3ZM18,4.4,23.6,10H18ZM24,28H8V4h8v6a2.0059,2.0059,0,0,0,2,2h6Z"/>
                    <rect data-name="&lt;Transparent Rectangle&gt;" class="cls-1" fill="none"/>
                </svg>
            `;
            workTableWrapper.appendChild(iconBtn);
            iconBtn.addEventListener('click', function() {
                const area = document.getElementById('workCommentsArea');
                if (area) {
                    const isOpen = area.style.display !== 'none';
                    area.style.display = isOpen ? 'none' : 'block';
                    iconBtn.classList.toggle('active');
                    if (!isOpen) {
                        const textarea = document.getElementById('workCommentsTextarea');
                        if (textarea) setTimeout(() => textarea.focus(), 100);
                    }
                }
            });
        }
        
        // ===== КНОПКА: ПОКАЗАТЬ/СКРЫТЬ ОВЕРЛЕИ ПОДДИАПАЗОНОВ =====
        // Показываем только для поддиапазона
        let overlayBtn = document.getElementById('workOverlayToggleBtn');
        if (isSubrange) {
            if (!overlayBtn) {
                overlayBtn = document.createElement('button');
                overlayBtn.id = 'workOverlayToggleBtn';
                overlayBtn.className = 'comments-toggle-btn matrix-btn';
                overlayBtn.dataset.tooltip = 'высота диапазона';
                overlayBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="2" width="20" height="20" rx="1" />
                        <rect x="2" y="12" width="20" height="10" fill="currentColor" stroke="none" rx="1" />
                    </svg>
                `;
                workTableWrapper.appendChild(overlayBtn);
                overlayBtn.addEventListener('click', function() {
                    const wrapper = document.querySelector('.matrix1-wrapper');
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
            // Не поддиапазон — скрываем кнопку оверлея
            if (overlayBtn) overlayBtn.style.display = 'none';
        }
    }
    
    // 2. ПОЛЕ ДЛЯ КОММЕНТАРИЕВ
    let workCommentsWrapper = document.getElementById('workCommentsWrapper');
    if (!workCommentsWrapper && App.state.workDisplayNodeId) {
        workCommentsWrapper = document.createElement('div');
        workCommentsWrapper.id = 'workCommentsWrapper';
        workCommentsWrapper.className = 'comments-wrapper';
        workCommentsWrapper.style.width = '100%';
        workCommentsWrapper.style.maxWidth = '530px';
        workCommentsWrapper.style.marginTop = '8px';
        
        const area = document.createElement('div');
        area.className = 'comments-area';
        area.id = 'workCommentsArea';
        area.style.display = 'none';
        area.style.width = '100%';
        area.style.borderRadius = '6px';
        area.style.border = '1px solid #3d3f46';
        area.style.background = '#2d2f34';
        area.style.overflow = 'hidden';
        
        const textarea = document.createElement('textarea');
        textarea.id = 'workCommentsTextarea';
        textarea.placeholder = 'Комментарий к диапазону...';
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
        workCommentsWrapper.appendChild(area);
        
        // Добавляем после таблицы
        const leftArea = document.querySelector('.left-area');
        if (leftArea) {
            leftArea.appendChild(workCommentsWrapper);
        }
        
        // Автосохранение
        let saveTimeout = null;
        textarea.addEventListener('input', function() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (App.state.workDisplayNodeId) {
                    setComments(App.state.workDisplayNodeId, this.value);
                }
            }, 500);
        });
        
        textarea.addEventListener('blur', function() {
            if (App.state.workDisplayNodeId) {
                setComments(App.state.workDisplayNodeId, this.value);
                persistAll();
                clearUnsaved();
            }
        });
    }
    
    // 3. ЗАГРУЗИТЬ КОММЕНТАРИЙ
    renderWorkComments(App.state.workDisplayNodeId);
	 const commentsWrapper = document.getElementById('commentsWrapper');
    if (commentsWrapper) {
        commentsWrapper.style.display = 'block';
        renderWorkComments(App.state.workDisplayNodeId);
    }
}


function createStylePopup() {
    if (stylePopup) return;

    stylePopup = document.createElement('div');
    stylePopup.className = 'style-popup';
    stylePopup.id = 'stylePopup';
    stylePopup.innerHTML = `
    <div class="style-popup-title" id="popupTitle">Редактировать стили</div>
    <div class="style-popup-row">
        <div class="style-color-box" id="popupBgColor"></div>
        <span class="style-label">Цвет фона</span>
    </div>
    <div class="style-popup-row">
        <div class="style-color-box" id="popupTextColor"></div>
        <span class="style-label">Цвет текста</span>
    </div>
    <div class="style-popup-actions">
        <button class="btn-cancel" id="popupCancel">Отменить</button>
        <button class="btn-save" id="popupSave">Сохранить</button>
    </div>
`;

    document.body.appendChild(stylePopup);
	// === ПИКЕР ДЛЯ ЦВЕТА ФОНА ===
document.getElementById('popupBgColor').addEventListener('click', function() {
    if (!activeButton) return;
    const rect = this.getBoundingClientRect();
    const currentColor = document.getElementById('popupBgColor').style.background || '#3d3d3d';
openColorPicker(currentColor, function(hex) {
    document.getElementById('popupBgColor').style.background = hex;
}, rect);
});
document.getElementById('popupTextColor').addEventListener('click', function() {
    if (!activeButton) return;
    const rect = this.getBoundingClientRect();
    const currentColor = document.getElementById('popupTextColor').style.background || '#a9afb5';
openColorPicker(currentColor, function(hex) {
    document.getElementById('popupTextColor').style.background = hex;
}, rect);
});
	    // === ПЕРЕТАСКИВАНИЕ ===
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    stylePopup.addEventListener('mousedown', function(e) {
        if (e.target.closest('.style-color-box')) return;
        if (e.target.closest('.style-popup-actions')) return;
        isDragging = true;
        const rect = stylePopup.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        stylePopup.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging || !stylePopup) return;
        let left = e.clientX - dragOffsetX;
        let top = e.clientY - dragOffsetY;
        left = Math.max(10, Math.min(window.innerWidth - 260, left));
        top = Math.max(10, Math.min(window.innerHeight - 200, top));
        stylePopup.style.left = left + 'px';
        stylePopup.style.top = top + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            if (stylePopup) stylePopup.style.cursor = 'grab';
        }
    });
	// === КНОПКИ ===
document.getElementById('popupCancel').addEventListener('click', function() {
    hideStylePopup();
});

document.getElementById('popupSave').addEventListener('click', function() {
    if (!activeButton) return;

    const bgColor = document.getElementById('popupBgColor').style.background;
    const textColor = document.getElementById('popupTextColor').style.background;

    // Применяем к кнопке
  if (bgColor && activeButton.classList.contains('folder-btn')) {
        activeButton.style.backgroundColor = bgColor;
		activeButton.style.borderColor = bgColor;
    }
    if (textColor) {
        activeButton.style.color = textColor;
    }

const nodeId = parseInt(activeButton.className.match(/folder-btn-(\d+)/)?.[1]) ||
               parseInt(activeButton.className.match(/range-link-(\d+)/)?.[1]) ||
               App.state.workDisplayNodeId;
    if (nodeId) {
        const bg = document.getElementById('popupBgColor').style.background || '';
        const border = activeButton.style.borderColor || '';
        const text = activeButton.style.color || '';
        saveButtonStyle(nodeId, bg, border, text);
    }
    
    hideStylePopup();
});
}
function showStylePopup(button) {
    if (!stylePopup) createStylePopup();
    if (!stylePopup) return;

    activeButton = button;

    const isRange = button.classList.contains('range-link');
	stylePopup.classList.toggle('no-bg', isRange);

// Показываем или скрываем строку "Цвет фона"
const bgRow = stylePopup.querySelector('.style-popup-row');
if (bgRow) {
    bgRow.style.display = isRange ? 'none' : '';
}
    const title = document.getElementById('popupTitle');
    if (title) {
        title.textContent = isRange ? 'Редактировать стили диапазона' : 'Редактировать стили папки';
    }
    const bgColor = button.style.borderColor;
    const bgBox = document.getElementById('popupBgColor');
    if (bgBox && bgColor) {
        bgBox.style.background = bgColor;
    }
	    // Цвет текста
    const textColor = button.style.color || getComputedStyle(button).color;
    const textBox = document.getElementById('popupTextColor');
    if (textBox && textColor) {
        textBox.style.background = textColor;
    }
    const rect = button.getBoundingClientRect();
    let left = rect.right + 14;
    let top = rect.top - 10;

    if (left + 200 > window.innerWidth) {
        left = rect.left - 200 - 14;
    }
    if (top + 60 > window.innerHeight) {
        top = window.innerHeight - 60 - 10;
    }
    if (top < 10) top = 10;

    stylePopup.style.left = left + 'px';
    stylePopup.style.top = top + 'px';
    stylePopup.classList.add('visible');
}
function hideStylePopup() {
    // Закрываем пикер, если он открыт
    const overlay = document.getElementById('pickerOverlay');
    if (overlay && overlay.classList.contains('active')) {
        const closeBtn = document.getElementById('pickerClose');
        if (closeBtn) closeBtn.click();
    }

    if (stylePopup) {
        stylePopup.classList.remove('visible');
        activeButton = null;
    }
}

// ===== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА =====
function refreshAll() {
    // Только для редактора
    if (document.getElementById("constructorPage").classList.contains("active-page")) {
        renderTree("constructorTree", App.editor.currentNodeId, true, selectNode);
        updateCurrentDisplay();
        renderAllColors(App.editor.currentNodeId, true);
        renderComments(App.editor.currentNodeId);
    }
    // Просмотр — отдельно
    if (document.getElementById("workPage").classList.contains("active-page")) {
        updateWorkDisplay();
        renderAllColors(App.editor.workDisplayNodeId, false);
    }
    updatePasteButtonState();
}

function refreshAllGrids() {
    if (document.getElementById("constructorPage").classList.contains("active-page") && App.state.currentNodeId) {
        updateCurrentDisplay();
    } else if (document.getElementById("gtoPage").classList.contains("active-page") && App.state.currentNodeId) {
        renderGrid("gtoGrid", App.state.currentNodeId, null);
        updateGtoStats(App.gto.currentNodeId);
        renderActionLegend(App.gto.currentNodeId, App.gto, 'gtoActionLegend');
        renderActionBar(App.gto.currentNodeId, App.gto, 'gtoActionBar');
    } else if (document.getElementById("workPage").classList.contains("active-page") && App.state.workDisplayNodeId) {
        updateWorkGrid();
    }
}

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ =====
function switchTab(page) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(`.tab-btn[data-page="${page}"]`).classList.add("active");

    // Не сбрасываем сам режим анализа при переходе на другую вкладку (он должен
    // сохраняться до возврата в конструктор), но снимаем закрепление ячейки
    // кликом — постоянный показ превью и рамка не должны "утекать" на другие
    // вкладки и должны сбрасываться каждый раз при уходе из конструктора.
    if (page !== "constructor") {
        unpinConstructorCell();
        hideCellPreview('constructorCellPreview');
    }

    // Скрыть все страницы
    document.getElementById("constructorPage").classList.remove("active-page");
    document.getElementById("gtoPage").classList.remove("active-page");
    document.getElementById("workPage").classList.remove("active-page");

    if (page === "gto") {
    App.currentMode = 'gto';
    
    // Если GTO-ветка пуста — загружаем из JSON
    if (!App.gto.nodes || App.gto.nodes.length === 0) {
        if (window.loadDefaultGto) {
            loadDefaultGto();
        }
    }
    
    document.getElementById("gtoPage").classList.add("active-page");
    renderGtoPage();
    animateGtoFade();
}
	
	else if (page === "constructor") {
        App.currentMode = 'editor';
        if (!App.state.currentNodeId) {
            const firstRange = App.state.nodes.find(n => n.type === 'range' || n.type === 'subrange');
            if (firstRange) {
                App.state.currentNodeId = firstRange.id;
            }
        }
        document.getElementById("constructorPage").classList.add("active-page");
        refreshAll();
        animateConstructorFade();

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
        renderWorkComments(App.state.workDisplayNodeId);
        refreshAll();
    }

    persistAll();
}

// ===== УПРАВЛЕНИЕ ВИДИМОСТЬЮ КНОПКИ "ДОБАВИТЬ ПРОФИЛЬ" =====
function updateProfileButtonVisibility() {
    const isGto = App.currentMode === 'gto';
    const profileBtn = document.getElementById(isGto ? "gtoNewProfileBtn" : "newProfileBtn");
    if (!profileBtn) return;

    const colors = getColorsForNode(App.state.currentNodeId);
    const hasColors = colors.length > 0;

    profileBtn.style.display = hasColors ? '' : 'none';
}
