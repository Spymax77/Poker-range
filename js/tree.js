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

// ============================================================
// ХЕЛПЕРЫ СОЗДАНИЯ УЗЛОВ (общие для тулбара и popup-меню дерева)
// ============================================================

// Стартовая палитра нового диапазона/поддиапазона: один простой
// цвет "Raise", он же становится активным цветом узла.
function initDefaultColor(nodeId) {
    const tableId = getTableId(nodeId);
    App.state.colorsPerNode[tableId] = [];
    const colorId = App.state.nextColorId++;
    App.state.colorsPerNode[tableId].push({
        id: colorId,
        name: "Raise",
        color: "#E55757",
        type: 'simple'
    });
    App.state.activePerNode[tableId] = colorId;
}

// Придумать уникальное имя нового узла: parentId === null — среди
// корневых узлов, иначе — среди детей родителя.
// ВНИМАНИЕ: дефолтные имена узлов (см. решение №8 в russian-text-inventory.md)
// намеренно не локализуются — при создании узла в английском интерфейсе
// временно используется русское имя по умолчанию.
function generateUniqueNameFor(parentId, baseName) {
    let existingNames;
    if (parentId === null) {
        existingNames = App.state.nodes
            .filter(n => n.parentId === null)
            .map(n => n.name);
    } else {
        const parent = getNode(parentId);
        existingNames = parent
            ? parent.childrenIds.map(id => getNode(id)).filter(n => n).map(n => n.name)
            : [];
    }
    return App.tree.generateUniqueName(baseName, existingNames);
}

// Единый «хвост» создания узла: dirty-метки → перерисовка → выбор узла
// → стратегия сохранения (аккаунт — немедленная отправка, гость —
// предупреждение о несохранённых изменениях).
// opts.table  — пометить таблицу узла изменённой (range/subrange);
// opts.colors — пометить цвета изменёнными (создан стартовый цвет).
function finishNodeCreation(newId, opts) {
    opts = opts || {};
    App.dirty.markStructureDirty();
    if (opts.table) App.dirty.markTableDirty(newId);
    if (opts.colors) App.dirty.markColorsDirty();
    App.refresh.all();
    App.navigation.selectNode(newId);
    if (App.auth && App.auth.isLoggedIn()) {
        flushPersist();
    } else {
        markUnsaved();
        notifyGuestUnsavedChanges();
    }
}

// ===== ДЕРЕВО (с компактным меню) =====
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
            if (App.dirty) App.dirty.markStructureDirty();
        }
    } else {
        let parent = getNode(parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx > 0) {
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            if (App.dirty) App.dirty.markStructureDirty();
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
            if (App.dirty) App.dirty.markStructureDirty();
        }
    } else {
        let parent = getNode(parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx < arr.length - 1) {
            [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
            if (App.dirty) App.dirty.markStructureDirty();
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

        // Хелпер: рекурсивный поиск последнего диапазона внутри папки
        function findLastRangeInFolder(folderId) {
            const folder = getNode(folderId);
            if (!folder) return null;
            for (let i = folder.childrenIds.length - 1; i >= 0; i--) {
                const child = getNode(folder.childrenIds[i]);
                if (!child) continue;
                if (child.type === 'range' || child.type === 'subrange') {
                    return child;
                }
                if (child.type === 'folder') {
                    const found = findLastRangeInFolder(child.id);
                    if (found) return found;
                }
            }
            return null;
        }

        // Хелпер: поиск соседнего диапазона для нового активного узла.
        // 1) предыдущий сосед (тот, что перед удаляемым); 2) если удаляемый
        // был первым — следующий сосед; 3) если соседей-диапазонов нет, а
        // родитель — диапазон (поддиапазон поддиапазона) — сам родитель.
        function findNeighbourRange(deletedNode) {
            let siblingIds;
            let idx;
            if (deletedNode.parentId !== null) {
                const parentNode = getNode(deletedNode.parentId);
                if (!parentNode) return null;
                siblingIds = parentNode.childrenIds;
                idx = siblingIds.indexOf(deletedNode.id);
            } else {
                // Порядок корневых узлов задаётся порядком в App.state.nodes
                siblingIds = App.state.nodes
                    .filter(n => n.parentId === null)
                    .map(n => n.id);
                idx = siblingIds.indexOf(deletedNode.id);
            }
            if (idx === -1) return null;

            function pickSibling(i) {
                const sib = getNode(siblingIds[i]);
                if (!sib) return null;
                if (sib.type === 'range' || sib.type === 'subrange') return sib;
                if (sib.type === 'folder') {
                    // Визуально ближайший к удаляемому узел внутри папки-соседа
                    return i < idx
                        ? findLastRangeInFolder(sib.id)
                        : findFirstRangeInFolder(sib.id);
                }
                return null;
            }

            for (let i = idx - 1; i >= 0; i--) {
                const found = pickSibling(i);
                if (found) return found;
            }
            for (let i = idx + 1; i < siblingIds.length; i++) {
                const found = pickSibling(i);
                if (found) return found;
            }
            // Родитель сам является диапазоном (случай поддиапазона поддиапазона)
            if (deletedNode.parentId !== null) {
                const parentNode = getNode(deletedNode.parentId);
                if (parentNode &&
                    (parentNode.type === 'range' || parentNode.type === 'subrange')) {
                    return parentNode;
                }
            }
            return null;
        }

        // Общий резервный поиск нового активного диапазона после удаления.
        // Один и тот же алгоритм для редактора и для режима просмотра:
        // сосед удаляемого → корневые диапазоны → первый диапазон в папках →
        // первый range/subrange во всём дереве.
        function findFallbackActiveRange(neighbourRange) {
            let foundRange = neighbourRange;

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

            return foundRange;
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

// Цвета, активный профиль и комментарии удалённого узла тоже удаляем:
// иначе они оставались в памяти, а при ближайшем сохранении
// (colorsPerNode уходит на сервер ЦЕЛИКОМ) мусорные записи от удалённых
// диапазонов накапливались в ключе poker_range_colors_* и в
// structure-ключе (commentsPerNode).
delete App.state.colorsPerNode[tableId];
delete App.state.activePerNode[tableId];
delete App.state.commentsPerNode[tableId];

// Серверный ключ таблицы удалённого узла больше не нужен: раньше он
// оставался в БД навсегда (осиротевший ключ на каждое удаление).
// Гостю не отправляем — он всё равно не сохраняет, а уведомление о
// необходимости авторизации здесь лишнее.
if (App.auth && App.auth.isLoggedIn()) {
    App.storage.remove('poker_range_table_' + App.currentMode + '_' + currentId);
}



let p = getNode(n.parentId);
            if (p) {
                p.childrenIds = p.childrenIds.filter(cid => cid !== currentId);
            }
        }

        // Сосед удаляемого узла вычисляется ДО удаления, пока его id ещё
        // присутствует в childrenIds родителя (после delSub позиция потеряна)
        const neighbourRange = findNeighbourRange(nodeToDelete);

        delSub(id);
        if (App.dirty) {
            App.dirty.markStructureDirty();
            // Очистка colorsPerNode/activePerNode удалённых узлов должна
            // уйти в цветовой ключ — он сохраняется только при dirty.colors
            App.dirty.markColorsDirty();
        }

        // Поиск нового активного диапазона в редакторе
        const activeExists = !!getNode(App.state.currentNodeId);
        if (!activeExists) {
            // Приоритет: сосед удаляемого узла (тот, что перед ним; если его
            // нет — следующий), либо родитель-диапазон (поддиапазон поддиапазона).
            // Кандидат вычислен до delSub (см. выше).
            const foundRange = findFallbackActiveRange(neighbourRange);

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
            const foundRange = findFallbackActiveRange(neighbourRange);
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
        if (App.dirty) App.dirty.markStructureDirty();
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
    const newName = generateUniqueNameFor(null, 'Новая папка');

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
    if (App.dirty) App.dirty.markStructureDirty();
    persistAll();
    App.refresh.all();
    App.navigation.selectNode(newId);
}

// Создать корневой диапазон из тулбара дерева. Раньше логика жила в init.js
// и теряла стартовый цвет; теперь единая точка создания диапазона наравне
// с popup-меню папки (createChildNode).
App.tree.addRootRange = function() {
    const newName = generateUniqueNameFor(null, 'Новый диапазон');

    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'range'
    };
    addNode(newNode);
    App.grid.ensureTable(newId);

    initDefaultColor(newId);
    finishNodeCreation(newId, { table: true, colors: true });
}

App.tree.createChildNode = function(parentId, type) {
    let parent = getNode(parentId);
    if (!parent) return;

    let baseName;
    if (type === 'folder') {
        baseName = 'Новая папка';
    } else if (type === 'range') {
        baseName = 'Новый диапазон';
    } else if (type === 'subrange') {
        baseName = 'Поддиапазон';
    }
    const newName = generateUniqueNameFor(parentId, baseName);

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
                
                initDefaultColor(newId);
                
                finishNodeCreation(newId, { table: true, colors: true });
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
        // Создан стартовый цвет диапазона — отмечаем для цветового ключа
        initDefaultColor(newId);
    }

    finishNodeCreation(newId, { table: type === 'range', colors: type === 'range' });
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
        if (key === 'Delete') {
            // Удаление доступно только в редакторе: в GTO дерево read-only
            // (меню с удалением рендерится только при editable), а getNode
            // ищет по индексу редактора — можно удалить чужой узел.
            if (App.currentMode === 'gto') return false;
            App.tree.deleteNode(selectedNode.id);
            return true;
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
        <rect x="13.5" y="3.5" width="7" height="7" rx="1" ${color ? `fill="${escapeHtml(color)}" stroke="${escapeHtml(color)}"` : `fill="none" stroke="var(--text-primary)"`} stroke-width="1"/>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1" ${color ? `fill="${escapeHtml(color)}" stroke="${escapeHtml(color)}"` : `fill="none" stroke="var(--text-primary)"`} stroke-width="1"/>
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
        let childNodes = node.childrenIds.map(cid => getNode(cid)).filter(n => n);
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
    } else if (document.getElementById("constructorPage").classList.contains("active-page")) {
        App.tree.renderTree("constructorTree", App.state.selectedNodeId || App.state.currentNodeId, true, App.navigation.selectNode);
    }
}
