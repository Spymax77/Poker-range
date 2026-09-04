// ===== tree.js -- extracted from all.js (range tree render & node ops) =====

// ===== ГЕНЕРАЦИЯ УНИКАЛЬНОГО ИМЕНИ =====
function generateUniqueName(baseName, existingNames) {
    if (!existingNames.includes(baseName)) {
        return baseName;
    }
    let counter = 2;
    while (existingNames.includes(`${baseName} (${counter})`)) {
        counter++;
    }
    return `${baseName} (${counter})`;
}
// ===== ДЕРЕВО (с компактным меню) =====
function addChildNode(parentId) {
    let parent = getNode(parentId);
    if (!parent) return;
    
    // Собираем имена всех дочерних узлов
    const children = parent.childrenIds.map(id => getNode(id)).filter(n => n);
    const existingNames = children.map(n => n.name);
    const newName = generateUniqueName('Новый элемент', existingNames);
    
    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: parentId,
        childrenIds: [],
        type: 'folder'
    };
    addNode(newNode);
    parent.childrenIds.push(newId);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
}

function renameNode(nodeId) {
    let node = getNode(nodeId);
    if (!node) return;
    let newName = prompt("Новое имя:", node.name);
    if (newName && newName.trim()) {
        node.name = newName.trim().slice(0, 35);
    }
    persistAll();
    refreshAll();
    if (App.state.currentNodeId === nodeId) updateCurrentDisplay();
}

function moveNodeUp(nodeId) {
    let node = getNode(nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = App.state.nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx > 0) {
            [roots[idx - 1], roots[idx]] = [roots[idx], roots[idx - 1]];
            let newNodes = [...roots];
            for (let n of App.state.nodes) {
                if (n.parentId !== null) newNodes.push(n);
            }
            App.state.nodes = newNodes;
        }
    } else {
        let parent = getNode(parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx > 0) {
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        }
    }
    persistAll();
    refreshAll();
}

function moveNodeDown(nodeId) {
    let node = getNode(nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = App.state.nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx < roots.length - 1) {
            [roots[idx + 1], roots[idx]] = [roots[idx], roots[idx + 1]];
            let newNodes = [...roots];
            for (let n of App.state.nodes) {
                if (n.parentId !== null) newNodes.push(n);
            }
            App.state.nodes = newNodes;
        }
    } else {
        let parent = getNode(parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx < arr.length - 1) {
            [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        }
    }
    persistAll();
    refreshAll();
}

function deleteNode(nodeId) {
    let node = getNode(nodeId);
    if (!node) return;

    let hasFilledRanges = false; // ← ОБЪЯВЛЯЕМ ЗДЕСЬ (в начале функции)

    // ===== НОВЫЕ ПРОВЕРКИ ДЛЯ ПАПОК =====
    if (node.type === 'folder') {
        // Вспомогательная функция: сбор всех диапазонов внутри папки (рекурсивно)
        function getAllRangesInFolder(folderId) {
            const folder = getNode(folderId);
            if (!folder) return [];
            let result = [];
            for (const childId of folder.childrenIds) {
                const child = getNode(childId);
                if (!child) continue;
                if (child.type === 'range' || child.type === 'subrange') {
                    result.push(child);
                } else if (child.type === 'folder') {
                    result = result.concat(getAllRangesInFolder(child.id));
                }
            }
            return result;
        }

        // Вспомогательная функция: проверка, есть ли профили в матрице
        function hasProfilesInMatrix(rangeId) {
            const tid = getTableId(rangeId);
            const matrix = App.state.cellStorage[tid];
            if (!matrix) return false;
            for (let i = 0; i < 13; i++) {
                for (let j = 0; j < 13; j++) {
                    if (matrix[i][j] !== null) return true;
                }
            }
            return false;
        }

        const allRangesInTree = App.state.nodes.filter(n => n.type === 'range' || n.type === 'subrange');
        const rangesInFolder = getAllRangesInFolder(node.id);

        // ПРАВИЛО 1: единственный диапазон во всём дереве
        if (rangesInFolder.length > 0 && rangesInFolder.length === allRangesInTree.length) {
            showFloatingModal("Эту папку удалить нельзя, так как в ней содержится единственный диапазон");
            return;
        }

        // ПРАВИЛО 2: есть заполненные диапазоны
        for (const range of rangesInFolder) {
            if (hasProfilesInMatrix(range.id)) {
                hasFilledRanges = true;
                break;
            }
        }

        if (hasFilledRanges) {
            showSaveConfirmModal(
                "В данной папке есть заполненные диапазоны. Все равно удалить?",
                function() {
                    // ДА — продолжаем удаление
                    proceedDelete(nodeId);
                },
                function() {
                    // НЕТ — ничего не делаем
                }
            );
            return;
        }
    }

    // ===== СТАРАЯ ПРОВЕРКА ДЛЯ ДИАПАЗОНОВ =====
    const allRanges = App.state.nodes.filter(n => n.type === 'range' || n.type === 'subrange');
    if (allRanges.length <= 1 && (node.type === 'range' || node.type === 'subrange')) {
        showFloatingModal("Нельзя удалить единственный диапазон");
        return;
    }
	    // ===== ПРАВИЛО 3: проверка на заполненность диапазона =====
    if (node.type === 'range' || node.type === 'subrange') {
        const tid = getTableId(node.id);
        const matrix = App.state.cellStorage[tid];
        let isFilled = false;

        if (matrix) {
            for (let i = 0; i < 13; i++) {
                for (let j = 0; j < 13; j++) {
                    if (matrix[i][j] !== null) {
                        isFilled = true;
                        break;
                    }
                }
                if (isFilled) break;
            }
        }

        if (isFilled) {
            showSaveConfirmModal(
                "Данный диапазон не пустой. Все равно удалить?",
                function() {
                    // ДА — продолжаем удаление
                    proceedDelete(nodeId);
                },
                function() {
                    // НЕТ — ничего не делаем
                }
            );
            return;
        }
    }

    // ===== ОСНОВНАЯ ЛОГИКА УДАЛЕНИЯ =====
    function proceedDelete(id) {
        const nodeToDelete = getNode(id);
        if (!nodeToDelete) return;

        // Хелпер: рекурсивный поиск первого диапазона внутри папки
        function findFirstRangeInFolder(folderId) {
            const folder = getNode(folderId);
            if (!folder) return null;
            for (const childId of folder.childrenIds) {
                const child = getNode(childId);
                if (!child) continue;
                if (child.type === 'range' || child.type === 'subrange') {
                    return child;
                }
                if (child.type === 'folder') {
                    const found = findFirstRangeInFolder(child.id);
                    if (found) return found;
                }
            }
            return null;
        }

        function delSub(currentId) {
            let n = getNode(currentId);
            if (!n) return;
            for (let cid of n.childrenIds) {
                delSub(cid);
            }
            removeNode(currentId);

const tableId = getTableId(currentId);
delete App.state.cellStorage[tableId];



let p = getNode(n.parentId);
            if (p) {
                p.childrenIds = p.childrenIds.filter(cid => cid !== currentId);
            }
        }

        delSub(id);

        // Поиск нового активного диапазона в редакторе
        const activeExists = !!getNode(App.state.currentNodeId);
        if (!activeExists) {
            let foundRange = null;

            // Ищем в той же родительской папке (если она ещё есть)
            if (nodeToDelete.parentId !== null) {
                const parentNode = getNode(nodeToDelete.parentId);
                if (parentNode) {
                    foundRange = findFirstRangeInFolder(parentNode.id);
                }
            }

            // Ищем среди корневых диапазонов
            if (!foundRange) {
                const rootRanges = App.state.nodes.filter(n =>
                    (n.type === 'range' || n.type === 'subrange') &&
                    n.parentId === null
                );
                if (rootRanges.length > 0) {
                    foundRange = rootRanges[0];
                }
            }

            // Ищем во всех папках (рекурсивно)
            if (!foundRange) {
                const folders = App.state.nodes.filter(n => n.type === 'folder');
                for (const folder of folders) {
                    const rangeInFolder = findFirstRangeInFolder(folder.id);
                    if (rangeInFolder) {
                        foundRange = rangeInFolder;
                        break;
                    }
                }
            }

            // Последний fallback: первый range/subrange во всём дереве
            if (!foundRange) {
                foundRange = App.state.nodes.find(n => n.type === 'range' || n.type === 'subrange');
            }

            if (foundRange) {
                selectNode(foundRange.id);
            } else {
                App.state.currentNodeId = null;
            }
        }

        // Поиск нового активного диапазона в просмотре
        App.state.workLevels = App.state.workLevels.filter(lvl => lvl.parentNodeId !== id);
        const workActiveExists = !!getNode(App.state.workDisplayNodeId);
        if (!workActiveExists) {
            let foundRange = null;

            if (nodeToDelete.parentId !== null) {
                const parentNode = getNode(nodeToDelete.parentId);
                if (parentNode) {
                    foundRange = findFirstRangeInFolder(parentNode.id);
                }
            }

            if (!foundRange) {
                const rootRanges = App.state.nodes.filter(n =>
                    (n.type === 'range' || n.type === 'subrange') &&
                    n.parentId === null
                );
                if (rootRanges.length > 0) {
                    foundRange = rootRanges[0];
                }
            }

            if (!foundRange) {
                const folders = App.state.nodes.filter(n => n.type === 'folder');
                for (const folder of folders) {
                    const rangeInFolder = findFirstRangeInFolder(folder.id);
                    if (rangeInFolder) {
                        foundRange = rangeInFolder;
                        break;
                    }
                }
            }

            if (!foundRange) {
                foundRange = App.state.nodes.find(n => n.type === 'range' || n.type === 'subrange');
            }

            App.state.workDisplayNodeId = foundRange ? foundRange.id : null;
            persistAll();
        }

        if (!App.state.workLevels.length) {
            App.state.workLevels = [{ parentNodeId: null, levelIndex: 0 }];
        }

        persistAll();
        refreshAll();
    }

    // Запускаем удаление (если папка не заблокирована)
    if (node.type !== 'folder' || !hasFilledRanges) {
        proceedDelete(nodeId);
    }
}
function startInlineRename(nodeId) {
    const node = getNode(nodeId);
    if (!node) return;
    
    // Ищем элемент в дереве по data-node-id
    const treeItems = document.querySelectorAll('.tree-item-name');
    let targetElement = null;
    
    for (let el of treeItems) {
        if (parseInt(el.dataset.nodeId) === nodeId) {
            targetElement = el;
            break;
        }
    }
    
    if (!targetElement) {
       console.warn('❌ Элемент для редактирования не найден для ID:', nodeId);
        return;
    }
    
    // Сохраняем данные
    renameNodeId = nodeId;
    renameOldName = node.name;
    
    // Создаём input
    renameInput = document.createElement('input');
    renameInput.type = 'text';
    renameInput.className = 'rename-input';
    renameInput.value = node.name;
    renameInput.maxLength = 35;
    
    // Заменяем текст на input
    const parent = targetElement.parentNode;
    
    // Сохраняем иконку если есть
    const icon = targetElement.querySelector('svg');
    let iconHtml = '';
    if (icon) {
        iconHtml = icon.outerHTML;
    }
    
    // Для дерева — заменяем содержимое
    targetElement.innerHTML = '';
    if (icon) {
        targetElement.appendChild(icon);
    }
    targetElement.appendChild(renameInput);
    
    // Фокус и выделение текста
    renameInput.focus();
    renameInput.select();
    // Останавливаем всплытие, чтобы клик внутри поля не вызывал selectNode()
renameInput.addEventListener('mousedown', function(e) {
    e.stopPropagation();
});
    // Обработчики
    renameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishInlineRename(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finishInlineRename(false);
        }
    });
    
    renameInput.addEventListener('blur', function() {
        finishInlineRename(true);
    });
}

function finishInlineRename(save) {
    if (!renameInput || renameNodeId === null) return;
    
    const node = getNode(renameNodeId);
    if (!node) return;
    
    const newName = renameInput.value.trim();
    
    // Если сохраняем и имя не пустое
    if (save && newName.length > 0) {
        node.name = newName;
        persistAll();
        refreshAll();
        if (App.state.currentNodeId === renameNodeId) {
            updateCurrentDisplay();
        }
    } else {
        // Отмена или пустое имя — возвращаем старое
        refreshAll();
    }
    
    // Очищаем
    renameInput = null;
    renameNodeId = null;
    renameOldName = '';
}

function addRootNode() {
    // Собираем имена всех корневых узлов
    const rootNodes = App.state.nodes.filter(n => n.parentId === null);
    const existingNames = rootNodes.map(n => n.name);
    const newName = generateUniqueName('Новая папка', existingNames);

    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'folder'
    };
    addNode(newNode);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
}

function createChildNode(parentId, type) {
    let parent = getNode(parentId);
    if (!parent) return;

    const children = parent.childrenIds.map(id => getNode(id)).filter(n => n);
    const existingNames = children.map(n => n.name);
    
    let baseName;
    if (type === 'folder') {
        baseName = 'Новая папка';
    } else if (type === 'range') {
        baseName = 'Новый диапазон';
    } else if (type === 'subrange') {
        baseName = 'Поддиапазон';
    }
    
    const newName = generateUniqueName(baseName, existingNames);

    // ============================================================
    // ДЛЯ ПОДДИАПАЗОНА — ПОКАЗЫВАЕМ ДИАЛОГ, ПОТОМ СОЗДАЁМ
    // ============================================================
    if (type === 'subrange') {
        showComponentSelectionDialog(parentId, function(selectedIndex) {
            if (selectedIndex !== -1) {
                // ✅ ПОЛЬЗОВАТЕЛЬ ВЫБРАЛ → СОЗДАЁМ УЗЕЛ
                const newId = App.state.nextNodeId++;
                const newNode = {
                    id: newId,
                    name: newName,
                    parentId: parentId,
                    childrenIds: [],
                    type: 'subrange',
                    selectedComponentIndex: selectedIndex
                };
                addNode(newNode);
                parent.childrenIds.push(newId);
                ensureTable(newId);
                
                const tableId = getTableId(newId);
                App.state.colorsPerNode[tableId] = [];
                const colorId = App.state.nextColorId++;
                App.state.colorsPerNode[tableId].push({
                    id: colorId,
                    name: "action",
                    color: "#9C5479",
                    type: 'simple'
                });
                App.state.activePerNode[tableId] = colorId;
                
                persistAll();
                refreshAll();
                selectNode(newId);
            }
            // ❌ Если отмена → НИЧЕГО НЕ ДЕЛАЕМ
        });
        return; // Выходим, чтобы не создавать узел ДО диалога
    }

    // ============================================================
    // ДЛЯ ПАПОК И ДИАПАЗОНОВ — СОЗДАЁМ СРАЗУ
    // ============================================================
    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: parentId,
        childrenIds: [],
        type: type
    };
    addNode(newNode);
    parent.childrenIds.push(newId);
    ensureTable(newId);
    
    if (type === 'range') {
        const tableId = getTableId(newId);
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

    persistAll();
    refreshAll();
    selectNode(newId);
}
function renderTree(containerId, activeNodeId, editable, onSelectNode) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    let rootNodes = App.state.nodes.filter(n => n.parentId === null);
    let rootOrder = App.state.nodes.filter(n => n.parentId === null).map(n => n.id);
    rootNodes.sort((a, b) => rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id));
    for (let node of rootNodes) {
        renderTreeNode(container, node, activeNodeId, editable, onSelectNode);
    }
}
// ===== ВЫЧИСЛЕНИЕ УРОВНЯ ВЛОЖЕННОСТИ =====
function getNodeLevel(nodeId) {
    let level = 0;
    let current = getNode(nodeId);
    while (current && current.parentId !== null) {
        level++;
        current = getNode(current.parentId);
    }
    return level;
}
// ============================================================
// ПОЛУЧАЕМ ЦВЕТ ВЫБРАННОГО КОМПОНЕНТА ДЛЯ ПОДДИАПАЗОНА
// ============================================================
function getSubrangeColor(node) {
    if (node.type !== 'subrange' || node.selectedComponentIndex === null) {
        return null;
    }
    
    const parent = getNode(node.parentId);
    if (!parent) return null;
    
    const tableId = getTableId(parent.id);
    const colors = App.state.colorsPerNode[tableId] || [];
    
    // Берём только простые цвета (selectedComponentIndex — это индекс среди них)
    const simpleColors = colors.filter(c => c.type === 'simple' || (!c.type && c.color));
    const selectedColor = simpleColors[node.selectedComponentIndex];
    if (selectedColor) {
        return selectedColor.color;
    }
    return null;
}
function renderTreeNode(parentContainer, node, activeNodeId, editable, onSelectNode) {
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";

    const itemDiv = document.createElement("div");
    itemDiv.className = `tree-item ${activeNodeId === node.id ? 'active' : ''}`;
	    // ===== DRAG & DROP: ЗАПУСК =====
    itemDiv.dataset.nodeId = node.id;

    itemDiv.addEventListener('mousedown', function(e) {
    if (!editable) return;
    if (e.button !== 0) return;
    if (!canDrag(node.id)) return;
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

// ===== ТРЕУГОЛЬНИК (только если есть дети) =====
const hasChildren = node.childrenIds && node.childrenIds.length > 0;
const isOpen = App.state.expandedNodes.has(node.id);

const arrow = document.createElement("span");
arrow.className = "tree-arrow";
arrow.style.display = "inline-block";
arrow.style.width = "18px";
arrow.style.marginRight = "1px";
arrow.style.textAlign = "center";
// ===== ДИНАМИЧЕСКИЙ ОТСТУП ДЛЯ СТРЕЛКИ =====
const level = getNodeLevel(node.id);
const STEP = 20;
const marginLeft = level * STEP;
arrow.style.marginLeft = marginLeft + 'px';

if (hasChildren) {
    arrow.textContent = isOpen ? "▼" : "▶";
    arrow.style.cursor = "pointer";
    arrow.style.opacity = "1";
    
    arrow.onclick = (e) => {
        e.stopPropagation();
        const childrenDiv = itemDiv.nextElementSibling;
        if (!childrenDiv || !childrenDiv.classList.contains('tree-children')) return;

        const wasOpen = App.state.expandedNodes.has(node.id);
        if (wasOpen) {
            App.state.expandedNodes.delete(node.id);
            childrenDiv.classList.remove('open');
        } else {
            App.state.expandedNodes.add(node.id);
            childrenDiv.classList.add('open');
        }
        arrow.textContent = wasOpen ? "▶" : "▼";
        persistAll(); 
    };
} else {
    arrow.textContent = "";
    arrow.style.cursor = "default";
    arrow.style.opacity = "0";
    arrow.style.pointerEvents = "none";
}

    const nameSpan = document.createElement("span");
    nameSpan.className = "tree-item-name";
    nameSpan.textContent = node.name;
	nameSpan.dataset.nodeId = node.id;
    nameSpan.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    if (editable) {
        startInlineRename(node.id);
    }
});
    const iconSpan = document.createElement("span");
    let iconSvg = '';
    if (node.type === 'folder') {
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    } else if (node.type === 'range') {
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24">
    <rect x="3" y="3" width="8" height="8" fill="currentColor"/>
    <rect x="13" y="3" width="8" height="8" fill="currentColor"/>
    <rect x="3" y="13" width="8" height="8" fill="currentColor"/>
    <rect x="13" y="13" width="8" height="8" fill="currentColor"/>
</svg>`;
    } 
	else if (node.type === 'subrange') {
    let color = null;
    if (node.selectedComponentIndex !== null) {
        const parent = getNode(node.parentId);
        if (parent) {
            const tableId = getTableId(parent.id);
            const colors = App.state.colorsPerNode[tableId] || [];
            // Берём только простые цвета (selectedComponentIndex — это индекс среди них)
            const simpleColors = colors.filter(c => c.type === 'simple' || (!c.type && c.color));
            const selectedColor = simpleColors[node.selectedComponentIndex];
            if (selectedColor) {
                color = selectedColor.color;
            }
        }
    }
    
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24">
        <rect x="3" y="3" width="8" height="8" rx="1"/>
        <rect x="13.5" y="3.5" width="7" height="7" rx="1" ${color ? `fill="${color}" stroke="${color}"` : `fill="none" stroke="var(--text-primary)"`} stroke-width="1"/>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1" ${color ? `fill="${color}" stroke="${color}"` : `fill="none" stroke="var(--text-primary)"`} stroke-width="1"/>
        <rect x="13" y="13" width="8" height="8" rx="1"/>
    </svg>`;
}
    iconSpan.innerHTML = iconSvg;
    nameSpan.prepend(iconSpan);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "tree-actions-popup";
    if (editable) {
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
    addFolderBtn.innerHTML = `<span class="menu-icon">+</span><span class="menu-text">Добавить папку</span>`;
    addFolderBtn.onclick = (e) => {
        e.stopPropagation();
        createChildNode(node.id, 'folder');
        closeMenu();
    };
    popupMenu.appendChild(addFolderBtn);

    const addRangeBtn = document.createElement("button");
    addRangeBtn.innerHTML = `<span class="menu-icon">+</span><span class="menu-text">Добавить диапазон</span>`;
    addRangeBtn.onclick = (e) => {
        e.stopPropagation();
        createChildNode(node.id, 'range');
        closeMenu();
    };
    popupMenu.appendChild(addRangeBtn);
} else if (node.type === 'range' || node.type === 'subrange') {
    const addSubrangeBtn = document.createElement("button");
    addSubrangeBtn.innerHTML = `<span class="menu-icon">+</span><span class="menu-text">Добавить поддиапазон</span>`;
    addSubrangeBtn.onclick = (e) => {
        e.stopPropagation();
        createChildNode(node.id, 'subrange');
        closeMenu();
    };
    popupMenu.appendChild(addSubrangeBtn);

    const duplicateBtn = document.createElement("button");
    duplicateBtn.innerHTML = `<span class="menu-icon"></span><span class="menu-text">Дублировать диапазон</span>`;
    duplicateBtn.onclick = (e) => {
        e.stopPropagation();
        duplicateRange(node.id);
        closeMenu();
    };
    popupMenu.appendChild(duplicateBtn);
	    // ===== ДОБАВЛЯЕМ НОВЫЕ ПУНКТЫ =====
    
// Копировать диапазон
const copyBtn = document.createElement("button");
copyBtn.innerHTML = `
    <span class="menu-icon"></span>
    <span class="menu-text">Копировать диапазон</span>
`;
copyBtn.onclick = (e) => {
    e.stopPropagation();
    copyRange(node.id);
    closeMenu();
};
popupMenu.appendChild(copyBtn);

// Вставить диапазон
const pasteBtn = document.createElement("button");
const hasData = hasClipboardData();
pasteBtn.innerHTML = `
    <span class="menu-icon"></span>
    <span class="menu-text">Вставить диапазон</span>
`;
pasteBtn.onclick = (e) => {
    e.stopPropagation();
    pasteRange(node.id);
    closeMenu();
};

// Если нет данных в буфере — делаем кнопку неактивной
if (!hasData) {
    pasteBtn.style.opacity = '0.4';
    pasteBtn.style.cursor = 'default';
    pasteBtn.style.pointerEvents = 'none';
    pasteBtn.title = 'Сначала скопируйте диапазон';
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
renameBtn.innerHTML = `<span class="menu-icon"></span><span class="menu-text">Переименовать</span>`;
renameBtn.onclick = (e) => {
    e.stopPropagation();
    startInlineRename(node.id);
    closeMenu();
};
popupMenu.appendChild(renameBtn);

const upBtn = document.createElement("button");
upBtn.innerHTML = `<span class="menu-icon">↑</span><span class="menu-text">Вверх</span>`;
upBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    moveNodeUp(node.id);
    closeMenu();
};
popupMenu.appendChild(upBtn);

const downBtn = document.createElement("button");
downBtn.innerHTML = `<span class="menu-icon">↓</span><span class="menu-text">Вниз</span>`;
downBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    moveNodeDown(node.id);
    closeMenu();
};
popupMenu.appendChild(downBtn);

const delBtn = document.createElement("button");
delBtn.innerHTML = `<span class="menu-icon"></span><span class="menu-text">Удалить</span>`;
delBtn.onclick = (e) => {
    e.stopPropagation();
    deleteNode(node.id);
    closeMenu();
};
popupMenu.appendChild(delBtn);

        actionsDiv.appendChild(menuBtn);
        actionsDiv.appendChild(popupMenu);

        function closeMenu() {
            popupMenu.style.display = "none";
			actionsDiv.classList.remove('menu-open');
            document.removeEventListener('click', outsideClick);
            // Сбрасываем позиционирование popup-меню
            popupMenu.style.position = '';
            popupMenu.style.top = '';
            popupMenu.style.left = '';
            popupMenu.style.right = '';
        }

        function outsideClick(e) {
            if (!actionsDiv.contains(e.target)) closeMenu();
        }

        menuBtn.onclick = (e) => {
    e.stopPropagation();

// ===== ЗАКРЫВАЕМ ВСЕ ОСТАЛЬНЫЕ МЕНЮ =====
document.querySelectorAll('.popup-menu').forEach(m => {
    if (m !== popupMenu) {
        m.style.display = 'none';
        m.style.position = '';
        m.style.top = '';
        m.style.left = '';
        m.style.right = '';
        const parent = m.closest('.tree-actions-popup');
        if (parent) parent.classList.remove('menu-open');
    }
});

    const isOpenMenu = popupMenu.style.display === "block";
    closeMenu();
    if (!isOpenMenu) {
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
        }

        actionsDiv.classList.add('menu-open');
        document.addEventListener('click', outsideClick);
    }
};
    }

    itemDiv.append(arrow, nameSpan, actionsDiv);
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

    nodeDiv.appendChild(itemDiv);

    const childrenDiv = document.createElement("div");
    childrenDiv.className = "tree-children";
    if (isOpen) childrenDiv.classList.add("open");

    const childrenInner = document.createElement("div");
    childrenInner.className = "tree-children-inner";

    if (node.childrenIds && node.childrenIds.length) {
        let childNodes = node.childrenIds.map(cid => getNode(cid)).filter(n => n);
        childNodes.sort((a, b) => node.childrenIds.indexOf(a.id) - node.childrenIds.indexOf(b.id));
        for (let child of childNodes) {
            renderTreeNode(childrenInner, child, activeNodeId, editable, onSelectNode);
        }
    }

    childrenDiv.appendChild(childrenInner);
    nodeDiv.appendChild(childrenDiv);
    parentContainer.appendChild(nodeDiv);
}

function refreshTreeOnly() {
    if (App.currentMode === 'gto') {
        renderGtoPage();
    } else if (document.getElementById("constructorPage").classList.contains("active-page")) {
        renderTree("constructorTree", App.state.currentNodeId, true, selectNode);
    }
}

