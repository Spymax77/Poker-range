// ===== tree.js -- extracted from all.js (range tree render & node ops) =====

// ===== ГЕНЕРАЦИЯ УНИКАЛЬНОГО ИМЕНИ =====
App.tree = App.tree || {};
App.tree.generateUniqueName = function(baseName, existingNames) {
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
App.tree.addChildNode = function(parentId) {
    let parent = getNode(parentId);
    if (!parent) return;
    
    // Собираем имена всех дочерних узлов
    const children = parent.childrenIds.map(id => getNode(id)).filter(n => n);
    const existingNames = children.map(n => n.name);
    // ВНИМАНИЕ: дефолтные имена узлов (см. решение №8 в russian-text-inventory.md)
    // намеренно не локализуются — вопрос отложен.
    const newName = App.tree.generateUniqueName('Новый элемент', existingNames);
    
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
    App.grid.ensureTable(newId);
    persistAll();
    App.refresh.all();
    App.navigation.selectNode(newId);
}

App.tree.moveNodeUp = function(nodeId) {
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
    App.refresh.all();
}

App.tree.moveNodeDown = function(nodeId) {
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
    App.refresh.all();
}

App.tree.deleteNode = function(nodeId) {
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
            App.modals.showFloatingModal(App.i18n.t('tree.deleteFolderSingleRangeError'));
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
            App.modals.showSaveConfirmModal(
                App.i18n.t('tree.folderHasFilledRanges'),
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
        App.modals.showFloatingModal(App.i18n.t('tree.deleteSingleRangeError'));
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
            App.modals.showSaveConfirmModal(
                App.i18n.t('tree.rangeNotEmptyConfirm'),
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
                App.navigation.selectNode(foundRange.id);
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
        App.refresh.all();
    }

    // Запускаем удаление (если папка не заблокирована)
    if (node.type !== 'folder' || !hasFilledRanges) {
        proceedDelete(nodeId);
    }
}
App.tree.startInlineRename = function(nodeId) {
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
            App.tree.finishInlineRename(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            App.tree.finishInlineRename(false);
        }
    });
    
    renameInput.addEventListener('blur', function() {
        App.tree.finishInlineRename(true);
    });
}

App.tree.finishInlineRename = function(save) {
    if (!renameInput || renameNodeId === null) return;
    
    const node = getNode(renameNodeId);
    if (!node) return;
    
    const newName = renameInput.value.trim();
    
    // Если сохраняем и имя не пустое
    if (save && newName.length > 0) {
        node.name = newName;
        persistAll();
        App.refresh.all();
        if (App.state.currentNodeId === renameNodeId) {
            App.grid.updateCurrentDisplay();
        }
    } else {
        // Отмена или пустое имя — возвращаем старое
        App.refresh.all();
    }
    
    // Очищаем
    renameInput = null;
    renameNodeId = null;
    renameOldName = '';
}

App.tree.addRootNode = function() {
    // Собираем имена всех корневых узлов
    const rootNodes = App.state.nodes.filter(n => n.parentId === null);
    const existingNames = rootNodes.map(n => n.name);
    // ВНИМАНИЕ: дефолтные имена узлов (см. решение №8 в russian-text-inventory.md)
    // намеренно не локализуются — при создании узла в английском интерфейсе
    // временно используется русское имя по умолчанию.
    const newName = App.tree.generateUniqueName('Новая папка', existingNames);

    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'folder'
    };
    addNode(newNode);
    App.grid.ensureTable(newId);
    persistAll();
    App.refresh.all();
    App.navigation.selectNode(newId);
}

App.tree.createChildNode = function(parentId, type) {
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
    
    const newName = App.tree.generateUniqueName(baseName, existingNames);

    // ============================================================
    // ДЛЯ ПОДДИАПАЗОНА — ПОКАЗЫВАЕМ ДИАЛОГ, ПОТОМ СОЗДАЁМ
    // ============================================================
    if (type === 'subrange') {
        App.modals.showComponentSelectionDialog(parentId, function(selectedIndex) {
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
                App.grid.ensureTable(newId);
                
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
                
                App.dirty.markStructureDirty();
                App.dirty.markTableDirty(newId);
                App.refresh.all();
                App.navigation.selectNode(newId);
                if (App.auth && App.auth.isLoggedIn()) {
                    flushPersist();
                } else {
                    markUnsaved();
                    notifyGuestUnsavedChanges();
                }
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
    App.grid.ensureTable(newId);
    
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

    App.dirty.markStructureDirty();
    if (type === 'range') {
        App.dirty.markTableDirty(newId);
    }
    App.refresh.all();
    App.navigation.selectNode(newId);
    if (App.auth && App.auth.isLoggedIn()) {
        flushPersist();
    } else {
        markUnsaved();
        notifyGuestUnsavedChanges();
    }
}
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
            (node.childrenIds || []).forEach(childId => visit(getNodeFrom(branch, childId)));
        };
        branch.nodes.filter(node => node.parentId === null).forEach(visit);
        return result;
    };

    App.tree.toggleNodeExpansion = function(nodeId, expanded) {
        const branch = App.tree.getKeyboardBranch();
        const node = getNodeFrom(branch, nodeId);
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
        persistAll();
        return true;
    };

    App.tree.moveKeyboardSelection = function(offset) {
        const branch = App.tree.getKeyboardBranch();
        const visibleIds = App.tree.getVisibleNodeIds(branch);
        if (!visibleIds.length) return;

        const currentId = getNodeFrom(branch, branch.selectedNodeId)
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
        const selectedId = getNodeFrom(branch, branch.selectedNodeId)
            ? branch.selectedNodeId
            : branch.currentNodeId;
        const selectedNode = selectedId === null ? null : getNodeFrom(branch, selectedId);
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
        return false;
    };
// ===== ВЫЧИСЛЕНИЕ УРОВНЯ ВЛОЖЕННОСТИ =====
App.tree.getNodeLevel = function(nodeId) {
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
App.tree.getSubrangeColor = function(node) {
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
App.tree.renderTreeNode = function(parentContainer, node, activeNodeId, editable, onSelectNode) {
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";

    const itemDiv = document.createElement("div");
    itemDiv.className = `tree-item ${activeNodeId === node.id ? 'active' : ''}`;
	    // ===== DRAG & DROP: ЗАПУСК =====
    itemDiv.dataset.nodeId = node.id;

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
const level = App.tree.getNodeLevel(node.id);
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

        App.tree.toggleNodeExpansion(node.id);
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
        App.tree.startInlineRename(node.id);
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
        <rect x="13.5" y="3.5" width="7" height="7" rx="1" ${color ? `fill="${escapeHtml(color)}" stroke="${escapeHtml(color)}"` : `fill="none" stroke="var(--text-primary)"`} stroke-width="1"/>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1" ${color ? `fill="${escapeHtml(color)}" stroke="${escapeHtml(color)}"` : `fill="none" stroke="var(--text-primary)"`} stroke-width="1"/>
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
    duplicateBtn.innerHTML = `<span class="menu-icon"></span><span class="menu-text">${App.i18n.t('menu.duplicateRange')}</span>`;
    duplicateBtn.onclick = (e) => {
        e.stopPropagation();
        App.clipboard.duplicateRange(node.id);
        closeMenu();
    };
    popupMenu.appendChild(duplicateBtn);
	    // ===== ДОБАВЛЯЕМ НОВЫЕ ПУНКТЫ =====
    
// Копировать диапазон
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

// Вставить диапазон
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
            App.tree.renderTreeNode(childrenInner, child, activeNodeId, editable, onSelectNode);
        }
    }

    childrenDiv.appendChild(childrenInner);
    nodeDiv.appendChild(childrenDiv);
    parentContainer.appendChild(nodeDiv);
}

App.tree.refreshTreeOnly = function() {
    if (App.currentMode === 'gto') {
        App.navigation.renderGtoPage();
    } else if (document.getElementById("constructorPage").classList.contains("active-page")) {
        App.tree.renderTree("constructorTree", App.state.selectedNodeId || App.state.currentNodeId, true, App.navigation.selectNode);
    }
}
