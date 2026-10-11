// ===== tree-render.js -- рендер дерева диапазонов =====
//
// Выделено из js/tree.js при разделении на js/tree/*.js: renderTree,
// построение строки узла (стрелка, имя, иконка, popup-меню, дети),
// прокрутка, refreshTreeOnly.
//
// Файл обёрнут в IIFE: builder-функции (buildTreeNode*, attachTreeNode*)
// не должны засорять window — голые top-level function в классических
// скриптах запрещены правилами проекта. Наружу — только App.tree.*.
(function() {

App.tree = App.tree || {};

App.tree.renderTree = function(containerId, activeNodeId, editable, onSelectNode) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    let rootNodes = App.state.nodes.filter(n => n.parentId === null);
    let rootOrder = App.state.nodes.filter(n => n.parentId === null).map(n => n.id);
    rootNodes.sort((a, b) => rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id));
    for (let node of rootNodes) {
        App.tree.renderTreeNode(container, node, activeNodeId, editable, onSelectNode);
    }
};

App.tree.scrollNodeIntoView = function(nodeId) {
    const treeId = App.currentMode === 'gto' ? 'gtoTree' : 'constructorTree';
    const item = document.querySelector(
        `#${treeId} .tree-item[data-node-id="${nodeId}"]`
    );
    if (item) {
        item.scrollIntoView({ block: 'nearest' });
    }
};

// ===== ВЫЧИСЛЕНИЕ УРОВНЯ ВЛОЖЕННОСТИ =====
App.tree.getNodeLevel = function(nodeId) {
    let level = 0;
    let current = App.nodes.getNode(nodeId);
    while (current && current.parentId !== null) {
        level++;
        current = App.nodes.getNode(current.parentId);
    }
    return level;
}

// ============================================================
// ПОЛУЧАЕМ ЦВЕТ ВЫБРАННОГО КОМПОНЕНТА ДЛЯ ПОДДИАПАЗОНА
// ============================================================
App.tree.getSubrangeColor = function(node) {
    if (node.type !== 'subrange' || node.selectedComponentIndex === null) {
        return null;
    }

    const parent = App.nodes.getNode(node.parentId);
    if (!parent) return null;

    const tableId = App.grid.getTableId(parent.id);
    const colors = App.state.colorsPerNode[tableId] || [];

    // Берём только простые цвета (selectedComponentIndex — это индекс среди них)
    const simpleColors = colors.filter(c => c.type === 'simple' || (!c.type && c.color));
    const selectedColor = simpleColors[node.selectedComponentIndex];
    if (selectedColor) {
        return selectedColor.color;
    }
    return null;
}

// ============================================================
// ХЕЛПЕРЫ РЕНДЕРИНГА УЗЛА ДЕРЕВА (builder-функции renderTreeNode)
// ============================================================

// Обработчик старта drag&drop на строке узла (this внутри — itemDiv).
function attachTreeNodeDrag(itemDiv, node, editable) {
    itemDiv.addEventListener('mousedown', function(e) {
        if (!editable) return;
        if (e.button !== 0) return;
        if (!App.dragDrop.canDrag(node.id)) return;
        if (e.target.closest('.tree-actions-popup')) return;

        App.state.isDragging = false;
        App.state.startX = e.clientX;
        App.state.startY = e.clientY;

        const rect = this.getBoundingClientRect();

        App.state.dragData = {
            nodeId: node.id,
            element: this,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top
        };
    });
}

// Стрелка раскрытия узла (треугольник) с отступом по уровню вложенности.
// Возвращает { arrow, isOpen } — isOpen нужен контейнеру детей.
function buildTreeNodeArrow(node, itemDiv) {
    const hasChildren = node.childrenIds && node.childrenIds.length > 0;
    const isOpen = App.state.expandedNodes.has(node.id);

    const arrow = document.createElement("span");
    arrow.className = "tree-arrow";
    arrow.style.display = "inline-block";
    arrow.style.width = "18px";
    arrow.style.marginRight = "1px";
    arrow.style.textAlign = "center";
    // Динамический отступ для стрелки по уровню вложенности
    const level = App.tree.getNodeLevel(node.id);
    const STEP = 20;
    arrow.style.marginLeft = (level * STEP) + 'px';

    if (hasChildren) {
        arrow.textContent = isOpen ? "▼" : "▶";
        arrow.style.cursor = "pointer";
        arrow.style.opacity = "1";
        arrow.onclick = (e) => {
            e.stopPropagation();
            const childrenDiv = itemDiv.nextElementSibling;
            if (!childrenDiv || !childrenDiv.classList.contains('tree-children')) return;
            App.tree.toggleNodeExpansion(node.id);
        };
    } else {
        arrow.textContent = "";
        arrow.style.cursor = "default";
        arrow.style.opacity = "0";
        arrow.style.pointerEvents = "none";
    }
    return { arrow, isOpen };
}

// Имя узла (двойной клик — inline-переименование в редакторе).
function buildTreeNodeName(node, editable) {
    const nameSpan = document.createElement("span");
    nameSpan.className = "tree-item-name";
    nameSpan.textContent = node.name;
    nameSpan.dataset.nodeId = node.id;
    nameSpan.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        if (editable) {
            App.tree.startInlineRename(node.id);
        }
    });
    return nameSpan;
}

// SVG-иконка узла: папка / диапазон / поддиапазон.
function buildTreeNodeIconSvg(node) {
    if (node.type === 'folder') {
        return `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    }
    if (node.type === 'range') {
        return `<svg width="20" height="20" viewBox="0 0 24 24">
    <rect x="3" y="3" width="8" height="8" fill="currentColor"/>
    <rect x="13" y="3" width="8" height="8" fill="currentColor"/>
    <rect x="3" y="13" width="8" height="8" fill="currentColor"/>
    <rect x="13" y="13" width="8" height="8" fill="currentColor"/>
</svg>`;
    }
    // Поддиапазон: квадраты красятся цветом выбранного компонента родителя
    const color = App.tree.getSubrangeColor(node);
    return `<svg width="20" height="20" viewBox="0 0 24 24">
        <rect x="3" y="3" width="8" height="8" rx="1"/>
        <rect x="13.5" y="3.5" width="7" height="7" rx="1" ${color ? `fill="${App.nodes.escapeHtml(color)}" stroke="${App.nodes.escapeHtml(color)}"` : `fill="none" stroke="var(--text-primary)"`} stroke-width="1"/>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1" ${color ? `fill="${App.nodes.escapeHtml(color)}" stroke="${App.nodes.escapeHtml(color)}"` : `fill="none" stroke="var(--text-primary)"`} stroke-width="1"/>
        <rect x="13" y="13" width="8" height="8" rx="1"/>
    </svg>`;
}

// Кнопка меню и popup-меню узла (все пункты управления узлом).
// При !editable возвращается пустой контейнер — как раньше.
function buildTreeNodeActions(node, editable) {
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "tree-actions-popup";
    if (!editable) {
        return actionsDiv;
    }

    const menuBtn = document.createElement("button");
    menuBtn.className = "toolbar-btn tree-menu-btn";
    menuBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 5C14 6.10457 13.1046 7 12 7C10.8954 7 10 6.10457 10 5C10 3.89543 10.8954 3 12 3C13.1046 3 14 3.89543 14 5Z" fill="currentColor"/>
        <path d="M14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" fill="currentColor"/>
        <path d="M12 21C13.1046 21 14 20.1046 14 19C14 17.8954 13.1046 17 12 17C10.8954 17 10 17.8954 10 19C10 20.1046 10.8954 21 12 21Z" fill="currentColor"/>
    </svg>
`;

    const popupMenu = document.createElement("div");
    popupMenu.className = "popup-menu";
    popupMenu.style.display = "none";

    if (node.type === 'folder') {
        const addFolderBtn = document.createElement("button");
        addFolderBtn.innerHTML = `<span class="menu-icon">+</span><span class="menu-text">${App.i18n.t('menu.addFolder')}</span>`;
        addFolderBtn.onclick = (e) => {
            e.stopPropagation();
            App.tree.createChildNode(node.id, 'folder');
            closeMenu();
        };
        popupMenu.appendChild(addFolderBtn);

        const addRangeBtn = document.createElement("button");
        addRangeBtn.innerHTML = `<span class="menu-icon">+</span><span class="menu-text">${App.i18n.t('menu.addRange')}</span>`;
        addRangeBtn.onclick = (e) => {
            e.stopPropagation();
            App.tree.createChildNode(node.id, 'range');
            closeMenu();
        };
        popupMenu.appendChild(addRangeBtn);
    } else if (node.type === 'range' || node.type === 'subrange') {
        const addSubrangeBtn = document.createElement("button");
        addSubrangeBtn.innerHTML = `<span class="menu-icon">+</span><span class="menu-text">${App.i18n.t('menu.addSubrange')}</span>`;
        addSubrangeBtn.onclick = (e) => {
            e.stopPropagation();
            App.tree.createChildNode(node.id, 'subrange');
            closeMenu();
        };
        popupMenu.appendChild(addSubrangeBtn);

        const duplicateBtn = document.createElement("button");
        // Для поддиапазона — своя подпись пункта меню
        const duplicateLabelKey = node.type === 'subrange' ? 'menu.duplicateSubrange' : 'menu.duplicateRange';
        duplicateBtn.innerHTML = `<span class="menu-icon"></span><span class="menu-text">${App.i18n.t(duplicateLabelKey)}</span>`;
        duplicateBtn.onclick = (e) => {
            e.stopPropagation();
            App.clipboard.duplicateRange(node.id);
            closeMenu();
        };
        popupMenu.appendChild(duplicateBtn);

        const copyBtn = document.createElement("button");
        copyBtn.innerHTML = `
    <span class="menu-icon"></span>
    <span class="menu-text">${App.i18n.t('menu.copyRange')}</span>
`;
        copyBtn.onclick = (e) => {
            e.stopPropagation();
            App.clipboard.copyRange(node.id);
            closeMenu();
        };
        popupMenu.appendChild(copyBtn);

        const pasteBtn = document.createElement("button");
        const hasData = App.clipboard.hasClipboardData();
        pasteBtn.innerHTML = `
    <span class="menu-icon"></span>
    <span class="menu-text">${App.i18n.t('menu.pasteRange')}</span>
`;
        pasteBtn.onclick = (e) => {
            e.stopPropagation();
            App.clipboard.pasteRange(node.id);
            closeMenu();
        };
        // Если нет данных в буфере — делаем кнопку неактивной
        if (!hasData) {
            pasteBtn.style.opacity = '0.4';
            pasteBtn.style.cursor = 'default';
            pasteBtn.style.pointerEvents = 'none';
            pasteBtn.title = App.i18n.t('clipboard.copyRangeFirst');
        } else {
            pasteBtn.style.opacity = '1';
            pasteBtn.style.cursor = 'pointer';
            pasteBtn.style.pointerEvents = 'auto';
            pasteBtn.title = '';
        }
        popupMenu.appendChild(pasteBtn);
    }

    // ===== ОБЩИЕ ПУНКТЫ =====
    const renameBtn = document.createElement("button");
    renameBtn.innerHTML = `<span class="menu-icon"></span><span class="menu-text">${App.i18n.t('menu.rename')}</span>`;
    renameBtn.onclick = (e) => {
        e.stopPropagation();
        App.tree.startInlineRename(node.id);
        closeMenu();
    };
    popupMenu.appendChild(renameBtn);

    const upBtn = document.createElement("button");
    upBtn.innerHTML = `<span class="menu-icon">↑</span><span class="menu-text">${App.i18n.t('menu.moveUp')}</span>`;
    upBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        App.tree.moveNodeUp(node.id);
        closeMenu();
    };
    popupMenu.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.innerHTML = `<span class="menu-icon">↓</span><span class="menu-text">${App.i18n.t('menu.moveDown')}</span>`;
    downBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        App.tree.moveNodeDown(node.id);
        closeMenu();
    };
    popupMenu.appendChild(downBtn);

    const delBtn = document.createElement("button");
    delBtn.innerHTML = `<span class="menu-icon"></span><span class="menu-text">${App.i18n.t('menu.delete')}</span>`;
    delBtn.onclick = (e) => {
        e.stopPropagation();
        App.tree.deleteNode(node.id);
        closeMenu();
    };
    popupMenu.appendChild(delBtn);

    actionsDiv.appendChild(menuBtn);
    actionsDiv.appendChild(popupMenu);

    let closeTimer = null;

    function finishClose() {
        closeTimer = null;
        popupMenu.classList.remove('menu-closing');
        popupMenu.style.display = "none";
        actionsDiv.classList.remove('menu-open');
        document.removeEventListener('click', outsideClick);
        // Сбрасываем позиционирование popup-меню
        popupMenu.style.position = '';
        popupMenu.style.top = '';
        popupMenu.style.left = '';
        popupMenu.style.right = '';
        popupMenu.style.transformOrigin = '';
    }

    function closeMenu() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        popupMenu.classList.remove('menu-entering');
        const wasOpen = popupMenu.style.display === "block";
        if (!wasOpen) {
            finishClose();
            return;
        }
        // Эффект закрытия как у freebetrange: быстрое затухание ~120мс
        popupMenu.classList.add('menu-closing');
        closeTimer = setTimeout(finishClose, 120);
    }

    function outsideClick(e) {
        if (!actionsDiv.contains(e.target)) closeMenu();
    }

    menuBtn.onclick = (e) => {
        e.stopPropagation();

        // ===== ЗАКРЫВАЕМ ВСЕ ОСТАЛЬНЫЕ МЕНЮ =====
        document.querySelectorAll('.popup-menu').forEach(m => {
            if (m !== popupMenu) {
                m.classList.remove('menu-entering', 'menu-closing');
                m.style.display = 'none';
                m.style.position = '';
                m.style.top = '';
                m.style.left = '';
                m.style.right = '';
                m.style.transformOrigin = '';
                const parent = m.closest('.tree-actions-popup');
                if (parent) parent.classList.remove('menu-open');
            }
        });

        const isOpenMenu = popupMenu.style.display === "block";
        closeMenu();
        if (!isOpenMenu) {
            popupMenu.classList.remove('menu-closing');
            popupMenu.style.display = "block";
            // Позиционируем меню фиксированно относительно viewport, чтобы не обрезалось при overflow скролле дерева
            const btnRect = menuBtn.getBoundingClientRect();
            const panel = menuBtn.closest('.tree-panel');
            const panelRect = panel ? panel.getBoundingClientRect() : null;
            popupMenu.style.position = 'fixed';
            popupMenu.style.top = (btnRect.top - 4) + 'px';
            // left от правого края панели (не зависит от скроллбара внутри дерева)
            popupMenu.style.left = panelRect ? (panelRect.right - 2) + 'px' : (btnRect.right - 2) + 'px';
            popupMenu.style.right = 'auto';

            // Корректируем позицию, если меню выходит за нижнюю границу экрана
            const popupRect = popupMenu.getBoundingClientRect();
            if (popupRect.bottom > window.innerHeight - 8) {
                popupMenu.style.top = Math.max(8, window.innerHeight - popupRect.height - 8) + 'px';
                // Меню прижато к низу — растёт из нижнего угла
                popupMenu.style.transformOrigin = '0 100%';
            }

            // Эффект появления как у freebetrange: рост из 80% + проявление, ~120мс
            popupMenu.classList.add('menu-entering');

            actionsDiv.classList.add('menu-open');
            document.addEventListener('click', outsideClick);
        }
    };

    return actionsDiv;
}

// Клик по строке узла — выбор узла (игнорируем клики по полю ввода,
// кнопкам меню и стрелке; реагируем только на одиночный клик).
function attachTreeNodeClick(itemDiv, node, arrow, onSelectNode) {
    itemDiv.onclick = (e) => {
        // Если клик по полю ввода — игнорируем
        if (e.target.tagName === 'INPUT') {
            return;
        }
        if (e.target.tagName !== 'BUTTON' && e.target !== arrow) {
            // Проверяем, не был ли это двойной клик
            if (e.detail === 1) {
                onSelectNode(node.id);
            }
        }
    };
}

// Контейнер с дочерними узлами: рекурсивный рендер в порядке childrenIds.
function buildTreeNodeChildren(node, activeNodeId, editable, onSelectNode, isOpen) {
    const childrenDiv = document.createElement("div");
    childrenDiv.className = "tree-children";
    if (isOpen) childrenDiv.classList.add("open");

    const childrenInner = document.createElement("div");
    childrenInner.className = "tree-children-inner";

    if (node.childrenIds && node.childrenIds.length) {
        let childNodes = node.childrenIds.map(cid => App.nodes.getNode(cid)).filter(n => n);
        childNodes.sort((a, b) => node.childrenIds.indexOf(a.id) - node.childrenIds.indexOf(b.id));
        for (let child of childNodes) {
            App.tree.renderTreeNode(childrenInner, child, activeNodeId, editable, onSelectNode);
        }
    }

    childrenDiv.appendChild(childrenInner);
    return childrenDiv;
}

App.tree.renderTreeNode = function(parentContainer, node, activeNodeId, editable, onSelectNode) {
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";

    const itemDiv = document.createElement("div");
    itemDiv.className = `tree-item ${activeNodeId === node.id ? 'active' : ''}`;
    // ===== DRAG & DROP: ЗАПУСК =====
    itemDiv.dataset.nodeId = node.id;
    attachTreeNodeDrag(itemDiv, node, editable);

    const { arrow, isOpen } = buildTreeNodeArrow(node, itemDiv);
    const nameSpan = buildTreeNodeName(node, editable);
    const iconSpan = document.createElement("span");
    iconSpan.innerHTML = buildTreeNodeIconSvg(node);
    nameSpan.prepend(iconSpan);

    itemDiv.append(arrow, nameSpan, buildTreeNodeActions(node, editable));
    attachTreeNodeClick(itemDiv, node, arrow, onSelectNode);

    nodeDiv.appendChild(itemDiv);
    nodeDiv.appendChild(buildTreeNodeChildren(node, activeNodeId, editable, onSelectNode, isOpen));
    parentContainer.appendChild(nodeDiv);
}

App.tree.refreshTreeOnly = function() {
    if (App.currentMode === 'gto') {
        App.navigation.renderGtoPage();
    } else if (document.getElementById("constructorPage")?.classList.contains("active-page")) {
        App.tree.renderTree("constructorTree", App.state.selectedNodeId || App.state.currentNodeId, true, App.navigation.selectNode);
    }
}

})();