  // ---------- ОСНОВНАЯ МОДЕЛЬ (дерево, матрица, профили) ----------
let nodes = [];
let nextNodeId = 1;
let currentNodeId = null;
let workLevels = [];
let workDisplayNodeId = null;
let cellStorage = {};
let expandedNodes = new Set();
let renameInput = null;
let renameNodeId = null;
let renameOldName = '';
let commentsPerNode = {};
let stylePopup = null;
let activeButton = null;

// ===== ГЛАВНЫЙ ОБЪЕКТ ДАННЫХ =====
let appData = {
    nodes: [],
    nextNodeId: 1,
    currentNodeId: null,
    cellStorage: {},
    expandedNodes: [],
    workLevels: [{ parentNodeId: null, levelIndex: 0 }],
    workDisplayNodeId: null,
    colorsPerNode: {},      // ← ОСТАЁТСЯ (теперь здесь всё)
    activePerNode: {},      // ← НОВОЕ (один активный на диапазон)
    nextColorId: 1,         // ← ОСТАЁТСЯ (только один счётчик)
    activeTab: 'constructor',
    commentsPerNode: {}
};
// ===== DRAG & DROP: ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let dragData = null;
let ghostElement = null;
let isDragging = false;
let startX = 0;
let startY = 0;
let expandTimeout = null;
let highlightedNode = null;
let clipboardRangeData = null



const rowsData = [
    ["AA","AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s"],
    ["AKo","KK","KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","K4s","K3s","K2s"],
    ["AQo","KQo","QQ","QJs","QTs","Q9s","Q8s","Q7s","Q6s","Q5s","Q4s","Q3s","Q2s"],
    ["AJo","KJo","QJo","JJ","JTs","J9s","J8s","J7s","J6s","J5s","J4s","J3s","J2s"],
    ["ATo","KTo","QTo","JTo","TT","T9s","T8s","T7s","T6s","T5s","T4s","T3s","T2s"],
    ["A9o","K9o","Q9o","J9o","T9o","99","98s","97s","96s","95s","94s","93s","92s"],
    ["A8o","K8o","Q8o","J8o","T8o","98o","88","87s","86s","85s","84s","83s","82s"],
    ["A7o","K7o","Q7o","J7o","T7o","97o","87o","77","76s","75s","74s","73s","72s"],
    ["A6o","K6o","Q6o","J6o","T6o","96o","86o","76o","66","65s","64s","63s","62s"],
    ["A5o","K5o","Q5o","J5o","T5o","95o","85o","75o","65o","55","54s","53s","52s"],
    ["A4o","K4o","Q4o","J4o","T4o","94o","84o","74o","64o","54o","44","43s","42s"],
    ["A3o","K3o","Q3o","J3o","T3o","93o","83o","73o","63o","53o","43o","33","32s"],
    ["A2o","K2o","Q2o","J2o","T2o","92o","82o","72o","62o","52o","42o","32o","22"]
];

function getTableId(nodeId) { return `node_${nodeId}`; }
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
// ===== СОХРАНЕНИЕ СТИЛЕЙ КНОПОК =====
function saveButtonStyle(nodeId, bg, border, text) {
    if (!nodeId) return;
    const data = {};
    if (bg) data.bg = bg;
    if (border) data.border = border;
    if (text) data.text = text;
    localStorage.setItem('btn_style_' + nodeId, JSON.stringify(data));
}

function loadButtonStyle(nodeId) {
    if (!nodeId) return null;
    const raw = localStorage.getItem('btn_style_' + nodeId);
    if (raw) {
        try { return JSON.parse(raw); } catch(e) {}
    }
    return null;
}
function ensureTable(nodeId) {
    let tid = getTableId(nodeId);
    if (!cellStorage[tid]) cellStorage[tid] = Array(13).fill().map(() => Array(13).fill(null));
}

function getCellProfile(nodeId, r, c) {
    return cellStorage[getTableId(nodeId)]?.[r]?.[c] || null;
}

function setCellProfile(nodeId, r, c, pid, immediateSave = true) {
    ensureTable(nodeId);
    const tid = getTableId(nodeId);
    const old = cellStorage[tid][r][c];
    if (old === pid) return false;
    cellStorage[tid][r][c] = pid;
    return true;
}

function countTotalCombos(nodeId) {
    let tid = getTableId(nodeId);
    if (!cellStorage[tid]) return 0;
    let total = 0;
    const colors = colorsPerNode[tid] || [];
    
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const pid = cellStorage[tid][i][j];
            if (pid === null) continue;
            
            let hand = rowsData[i][j];
            let combos = 0;
            if (hand.includes('s')) combos = 4;
            else if (hand.includes('o')) combos = 12;
            else if (hand[0] === hand[1]) combos = 6;
            
            // Проверяем, мультицвет ли это
            const color = colors.find(c => c.id === pid);
            if (color && color.type === 'multi') {
                // Суммируем доли всех компонентов мультицвета
                let totalShare = 0;
                for (const comp of color.components) {
                    totalShare += comp.share || 0;
                }
                // Если сумма долей > 0, умножаем комбинации на долю / 100
                if (totalShare > 0) {
                    combos = combos * (totalShare / 100);
                }
            }
            
            total += combos;
        }
    }
    return Math.round(total * 10) / 10;
}

// ===== PERSIST ALL =====
function persistAll() {
    appData.nodes = nodes;
    appData.nextNodeId = nextNodeId;
    appData.currentNodeId = currentNodeId;
    appData.cellStorage = cellStorage;
    appData.expandedNodes = Array.from(expandedNodes);
    appData.workLevels = workLevels;
    appData.workDisplayNodeId = workDisplayNodeId;
    appData.colorsPerNode = colorsPerNode;
    appData.activePerNode = activePerNode;
    appData.nextColorId = nextColorId;
    appData.commentsPerNode = commentsPerNode;
    
    // Сохраняем активную вкладку
    const activeBtn = document.querySelector('.tab-btn.active');
    appData.activeTab = activeBtn ? activeBtn.getAttribute('data-page') : 'constructor';

    localStorage.setItem("poker_range_tree_v6", JSON.stringify(appData));
}

function loadFromStorage() {
    let raw = localStorage.getItem("poker_range_tree_v6");
    if (raw) {
        try {
            let d = JSON.parse(raw);
            nodes = d.nodes || [];
            nextNodeId = d.nextNodeId || 1;
            currentNodeId = d.currentNodeId || null;
            cellStorage = d.cellStorage || {};
            expandedNodes = new Set(d.expandedNodes || []);
            workLevels = d.workLevels || [];
            workDisplayNodeId = d.workDisplayNodeId || null;
            colorsPerNode = d.colorsPerNode || {};
            activePerNode = d.activePerNode || {};
            nextColorId = d.nextColorId || 1;
            commentsPerNode = d.commentsPerNode || {};
            // Загружаем активную вкладку
            const activeTab = d.activeTab || 'constructor';

            if (nodes.length === 0) {
                resetToCleanData();
            }
            return activeTab;
        } catch(e) {
            console.error('Ошибка загрузки:', e);
        }
    }
    resetToCleanData();
    return 'constructor';
}

// ===== RESET TO CLEAN DATA =====
function resetToCleanData() {
    nodes = [];
    nextNodeId = 1;
    currentNodeId = null;
    cellStorage = {};
    expandedNodes = new Set();
    workLevels = [{ parentNodeId: null, levelIndex: 0 }];
    workDisplayNodeId = null;
    colorsPerNode = {};
    activePerNode = {};
    nextColorId = 1;
    commentsPerNode = {};

    const rootId = nextNodeId++;
    const rootNode = {
        id: rootId,
        name: 'My Ranges',
        parentId: null,
        childrenIds: [],
        type: 'folder'
    };
    nodes.push(rootNode);
    expandedNodes.add(rootId);
    const positions = ['EP', 'MP', 'CO', 'BU', 'SB', 'BB'];
    let epRangeId = null;
    let epFolderId = null;

    for (const pos of positions) {
        let folderId = nextNodeId++;
        nodes.push({
            id: folderId,
            name: pos,
            parentId: rootId,        // ← нет родителя!
            childrenIds: [],
            type: 'folder'
        });
		 rootNode.childrenIds.push(folderId);
        ensureTable(folderId);

        if (pos === 'EP') {
            epFolderId = folderId;
        }

        // Создаём диапазон Open raise внутри папки
        let rangeId = nextNodeId++;
        nodes.push({
            id: rangeId,
            name: "Open raise",
            parentId: folderId,
            childrenIds: [],
            type: 'range'
        });
        nodes.find(n => n.id === folderId).childrenIds.push(rangeId);
        ensureTable(rangeId);

        if (pos === 'EP') {
            epRangeId = rangeId;
            expandedNodes.add(folderId);  // раскрываем EP
        }

        // Создаём 2 цвета для диапазона
        const tableId = getTableId(rangeId);
        colorsPerNode[tableId] = [];

       const colorId = nextColorId++;
colorsPerNode[tableId].push({
    id: colorId,
    name: "action",
    color: "#9C5479",
    type: 'simple'
});

activePerNode[tableId] = colorId;
    }

    if (epRangeId) {
        currentNodeId = epRangeId;
        workDisplayNodeId = epRangeId;
    }

    persistAll();
}
// ===== ДЕРЕВО (с компактным меню) =====
function addChildNode(parentId) {
    let parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    
    // Собираем имена всех дочерних узлов
    const children = parent.childrenIds.map(id => nodes.find(n => n.id === id)).filter(n => n);
    const existingNames = children.map(n => n.name);
    const newName = generateUniqueName('Новый элемент', existingNames);
    
    let newId = nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: parentId,
        childrenIds: [],
        type: 'folder' // или 'range'? По умолчанию папка
    };
    nodes.push(newNode);
    parent.childrenIds.push(newId);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
}

function renameNode(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let newName = prompt("Новое имя:", node.name);
    if (newName && newName.trim()) {
        node.name = newName.trim().slice(0, 20);
    }
    persistAll();
    refreshAll();
    if (currentNodeId === nodeId) updateCurrentDisplay();
}

function moveNodeUp(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx > 0) {
            [roots[idx - 1], roots[idx]] = [roots[idx], roots[idx - 1]];
            let newNodes = [...roots];
            for (let n of nodes) {
                if (n.parentId !== null) newNodes.push(n);
            }
            nodes = newNodes;
        }
    } else {
        let parent = nodes.find(p => p.id === parentId);
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
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx < roots.length - 1) {
            [roots[idx + 1], roots[idx]] = [roots[idx], roots[idx + 1]];
            let newNodes = [...roots];
            for (let n of nodes) {
                if (n.parentId !== null) newNodes.push(n);
            }
            nodes = newNodes;
        }
    } else {
        let parent = nodes.find(p => p.id === parentId);
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
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    let hasFilledRanges = false; // ← ОБЪЯВЛЯЕМ ЗДЕСЬ (в начале функции)

    // ===== НОВЫЕ ПРОВЕРКИ ДЛЯ ПАПОК =====
    if (node.type === 'folder') {
        // Вспомогательная функция: сбор всех диапазонов внутри папки (рекурсивно)
        function getAllRangesInFolder(folderId) {
            const folder = nodes.find(n => n.id === folderId);
            if (!folder) return [];
            let result = [];
            for (const childId of folder.childrenIds) {
                const child = nodes.find(n => n.id === childId);
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
            const matrix = cellStorage[tid];
            if (!matrix) return false;
            for (let i = 0; i < 13; i++) {
                for (let j = 0; j < 13; j++) {
                    if (matrix[i][j] !== null) return true;
                }
            }
            return false;
        }

        const allRangesInTree = nodes.filter(n => n.type === 'range' || n.type === 'subrange');
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
    const allRanges = nodes.filter(n => n.type === 'range' || n.type === 'subrange');
    if (allRanges.length <= 1 && (node.type === 'range' || node.type === 'subrange')) {
        showFloatingModal("Нельзя удалить единственный диапазон");
        return;
    }
	    // ===== ПРАВИЛО 3: проверка на заполненность диапазона =====
    if (node.type === 'range' || node.type === 'subrange') {
        const tid = getTableId(node.id);
        const matrix = cellStorage[tid];
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
        const nodeToDelete = nodes.find(n => n.id === id);
        if (!nodeToDelete) return;

        function delSub(currentId) {
            let n = nodes.find(nn => nn.id === currentId);
            if (!n) return;
            for (let cid of n.childrenIds) {
                delSub(cid);
            }
         nodes = nodes.filter(nn => nn.id !== currentId);

const tableId = getTableId(currentId);
delete cellStorage[tableId];



let p = nodes.find(p => p.id === n.parentId);
            if (p) {
                p.childrenIds = p.childrenIds.filter(cid => cid !== currentId);
            }
        }

        delSub(id);

        // Поиск нового активного диапазона в редакторе
        if (currentNodeId === id) {
            let foundRange = null;

            const sameFolderRanges = nodes.filter(n =>
                (n.type === 'range' || n.type === 'subrange') &&
                n.parentId === nodeToDelete.parentId &&
                n.id !== id
            );
            if (sameFolderRanges.length > 0) {
                foundRange = sameFolderRanges[0];
            }

            if (!foundRange) {
                const rootRanges = nodes.filter(n =>
                    (n.type === 'range' || n.type === 'subrange') &&
                    n.parentId === null &&
                    n.id !== id
                );
                if (rootRanges.length > 0) {
                    foundRange = rootRanges[0];
                }
            }

            if (!foundRange) {
                const folders = nodes.filter(n => n.type === 'folder');
                for (const folder of folders) {
                    const rangeInFolder = nodes.find(n =>
                        (n.type === 'range' || n.type === 'subrange') &&
                        n.parentId === folder.id &&
                        n.id !== id
                    );
                    if (rangeInFolder) {
                        foundRange = rangeInFolder;
                        break;
                    }
                }
            }

            if (foundRange) {
                selectNode(foundRange.id);
            } else {
                currentNodeId = null;
            }
        }

        // Поиск нового активного диапазона в просмотре
        workLevels = workLevels.filter(lvl => lvl.parentNodeId !== id);
        if (workDisplayNodeId === id) {
            let foundRange = null;

            const sameFolderRanges = nodes.filter(n =>
                (n.type === 'range' || n.type === 'subrange') &&
                n.parentId === nodeToDelete.parentId
            );
            if (sameFolderRanges.length > 0) {
                foundRange = sameFolderRanges[0];
            }

            if (!foundRange) {
                const rootRanges = nodes.filter(n =>
                    (n.type === 'range' || n.type === 'subrange') &&
                    n.parentId === null
                );
                if (rootRanges.length > 0) {
                    foundRange = rootRanges[0];
                }
            }

            if (!foundRange) {
                const folders = nodes.filter(n => n.type === 'folder');
                for (const folder of folders) {
                    const rangeInFolder = nodes.find(n =>
                        (n.type === 'range' || n.type === 'subrange') &&
                        n.parentId === folder.id
                    );
                    if (rangeInFolder) {
                        foundRange = rangeInFolder;
                        break;
                    }
                }
            }

            workDisplayNodeId = foundRange ? foundRange.id : null;
            persistAll();
        }

        if (!workLevels.length) {
            workLevels = [{ parentNodeId: null, levelIndex: 0 }];
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
    const node = nodes.find(n => n.id === nodeId);
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
    renameInput.maxLength = 20;
    
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
    
    const node = nodes.find(n => n.id === renameNodeId);
    if (!node) return;
    
    const newName = renameInput.value.trim();
    
    // Если сохраняем и имя не пустое
    if (save && newName.length > 0) {
        node.name = newName;
        persistAll();
        refreshAll();
        if (currentNodeId === renameNodeId) {
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
    const rootNodes = nodes.filter(n => n.parentId === null);
    const existingNames = rootNodes.map(n => n.name);
    const newName = generateUniqueName('Новая папка', existingNames);

    let newId = nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'folder'
    };
    nodes.push(newNode);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
}

function createChildNode(parentId, type) {
    let parent = nodes.find(n => n.id === parentId);
    if (!parent) return;

    const children = parent.childrenIds.map(id => nodes.find(n => n.id === id)).filter(n => n);
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
                const newId = nextNodeId++;
                const newNode = {
                    id: newId,
                    name: newName,
                    parentId: parentId,
                    childrenIds: [],
                    type: 'subrange',
                    selectedComponentIndex: selectedIndex
                };
                nodes.push(newNode);
                parent.childrenIds.push(newId);
                ensureTable(newId);
                
                const tableId = getTableId(newId);
                colorsPerNode[tableId] = [];
                const colorId = nextColorId++;
                colorsPerNode[tableId].push({
                    id: colorId,
                    name: "action",
                    color: "#9C5479",
                    type: 'simple'
                });
                activePerNode[tableId] = colorId;
                
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
    let newId = nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: parentId,
        childrenIds: [],
        type: type
    };
    nodes.push(newNode);
    parent.childrenIds.push(newId);
    ensureTable(newId);
    
    if (type === 'range') {
        const tableId = getTableId(newId);
        colorsPerNode[tableId] = [];
        const colorId = nextColorId++;
        colorsPerNode[tableId].push({
            id: colorId,
            name: "action",
            color: "#9C5479",
            type: 'simple'
        });
        activePerNode[tableId] = colorId;
    }

    persistAll();
    refreshAll();
    selectNode(newId);
}
function selectNode(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (node && node.type === 'folder') {
        return;
    }
    currentNodeId = nodeId;
   persistAll();

    if (node && node.parentId !== null) {
        expandedNodes.add(node.parentId);
    }

    updateCurrentDisplay();
    refreshAll();
    if (document.getElementById("workPage").classList.contains("active-page")) {
        updateWorkDisplay();
    }

    // ===== АНИМАЦИИ =====
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

function renderTree(containerId, activeNodeId, editable, onSelectNode) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    let rootNodes = nodes.filter(n => n.parentId === null);
    let rootOrder = nodes.filter(n => n.parentId === null).map(n => n.id);
    rootNodes.sort((a, b) => rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id));
    for (let node of rootNodes) {
        renderTreeNode(container, node, activeNodeId, editable, onSelectNode);
    }
}
// ===== ВЫЧИСЛЕНИЕ УРОВНЯ ВЛОЖЕННОСТИ =====
function getNodeLevel(nodeId) {
    let level = 0;
    let current = nodes.find(n => n.id === nodeId);
    while (current && current.parentId !== null) {
        level++;
        current = nodes.find(n => n.id === current.parentId);
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
    
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent) return null;
    
    const tableId = getTableId(parent.id);
    const colors = colorsPerNode[tableId] || [];
    
    for (const c of colors) {
        if (c.type === 'multi' && c.components && c.components[node.selectedComponentIndex]) {
            const comp = c.components[node.selectedComponentIndex];
            const simpleColor = colors.find(sc => sc.id === comp.colorId);
            if (simpleColor) {
                return simpleColor.color;
            }
        }
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
    if (e.button !== 0) return;
    if (!canDrag(node.id)) return;
    if (e.target.closest('.tree-actions-popup')) return;

    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = this.getBoundingClientRect();

    dragData = {
        nodeId: node.id,
        element: this,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top
    };
});

// ===== ТРЕУГОЛЬНИК (только если есть дети) =====
const hasChildren = node.childrenIds && node.childrenIds.length > 0;
const isOpen = expandedNodes.has(node.id);

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
        expandedNodes.has(node.id) ? expandedNodes.delete(node.id) : expandedNodes.add(node.id);
        refreshTreeOnly();
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
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>`;
    } 
	else if (node.type === 'subrange') {
    let color = null;
    if (node.selectedComponentIndex !== null) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent) {
            const tableId = getTableId(parent.id);
            const colors = colorsPerNode[tableId] || [];
            for (const c of colors) {
                if (c.type === 'multi' && c.components && c.components[node.selectedComponentIndex]) {
                    const comp = c.components[node.selectedComponentIndex];
                    const simpleColor = colors.find(sc => sc.id === comp.colorId);
                    if (simpleColor) {
                        color = simpleColor.color;
                        break;
                    }
                }
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
        }

        function outsideClick(e) {
            if (!actionsDiv.contains(e.target)) closeMenu();
        }

        menuBtn.onclick = (e) => {
    e.stopPropagation();

// ===== ЗАКРЫВАЕМ ВСЕ ОСТАЛЬНЫЕ МЕНЮ =====
document.querySelectorAll('.popup-menu').forEach(m => {
    if (m !== popupMenu) {
        const parent = m.closest('.tree-actions-popup');
        if (parent) parent.classList.remove('menu-open');
    }
});

    const isOpenMenu = popupMenu.style.display === "block";
    closeMenu();
    if (!isOpenMenu) {
        popupMenu.style.display = "block";
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

    if (node.childrenIds && node.childrenIds.length) {
        let childNodes = node.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
        childNodes.sort((a, b) => node.childrenIds.indexOf(a.id) - node.childrenIds.indexOf(b.id));
        for (let child of childNodes) {
            renderTreeNode(childrenDiv, child, activeNodeId, editable, onSelectNode);
        }
    }

    nodeDiv.appendChild(childrenDiv);
    parentContainer.appendChild(nodeDiv);
}

function refreshTreeOnly() {
    if (document.getElementById("constructorPage").classList.contains("active-page")) {
        renderTree("constructorTree", currentNodeId, true, selectNode);
    }
}

function findFirstRange(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    if (node.type === 'range' || node.type === 'subrange') return node.id;
    for (let childId of node.childrenIds) {
        let result = findFirstRange(childId);
        if (result !== null) return result;
    }
    return null;
}

function renderWorkNavigation() {
    const container = document.getElementById("workLevelsContainer");
    if (!container) return;
    container.innerHTML = "";

    for (let li = 0; li < workLevels.length; li++) {
        const level = workLevels[li];
        const parentId = level.parentNodeId;
        let children = [];

        if (parentId === null) {
            children = nodes.filter(n => n.parentId === null);
            let rootOrder = nodes.filter(n => n.parentId === null).map(n => n.id);
            children.sort((a, b) => rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id));
        } else {
            let parent = nodes.find(n => n.id === parentId);
            if (parent) {
                children = parent.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
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
                let parent = nodes.find(n => n.id === child.parentId);
                let parentIsRange = parent && parent.type === 'range';
                let parentIsSelectedRange = parentIsRange && workLevels.some(l => l.parentNodeId === child.parentId);

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
        workLevels = workLevels.slice(0, idx + 1);
        workLevels.push({ parentNodeId: c.id, levelIndex: idx + 1 });
        
        // Находим первый диапазон внутри папки
        let firstRange = findFirstRange(c.id);
        if (firstRange !== null) {
            workDisplayNodeId = firstRange;
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


                  const lastLevel = workLevels[workLevels.length - 1];
const isActiveFolder = lastLevel && lastLevel.parentNodeId === child.id;

// Проверяем, находится ли активный диапазон внутри этой папки
let isRangeInsideFolder = false;
if (workDisplayNodeId) {
    const activeRange = nodes.find(n => n.id === workDisplayNodeId);
    if (activeRange) {
        let parent = activeRange.parentId;
        while (parent !== null) {
            if (parent === child.id) {
                isRangeInsideFolder = true;
                break;
            }
            const parentNode = nodes.find(n => n.id === parent);
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
                let parent = nodes.find(n => n.id === child.parentId);
                let parentIsRange = parent && parent.type === 'range';
                let parentIsSelectedRange = parentIsRange && workLevels.some(l => l.parentNodeId === child.parentId);
                let isRoot = child.parentId === null;

                    if (isRoot || !parentIsSelectedRange || child.type === 'subrange') {
                    const link = document.createElement("span");
                    link.className = "range-link range-link-" + child.id;
                    link.innerText = child.name;
					const saved = loadButtonStyle(child.id);
if (saved && saved.text) {
    link.style.color = saved.text;
}
                    if (workDisplayNodeId === child.id) {
                        link.classList.add("active");
                    } else {
                        link.classList.remove("active");
                    }
                    link.onclick = (function(c) {
                        return function() {
                            workDisplayNodeId = c.id;
                            let path = [];
                            let current = c;
                            while (current && current.parentId !== null) {
                                let parentNode = nodes.find(n => n.id === current.parentId);
                                if (parentNode) {
                                    path.unshift(parentNode);
                                    current = parentNode;
                                } else {
                                    current = null;
                                }
                            }
                            workLevels = [{ parentNodeId: null, levelIndex: 0 }];
                            for (let p of path) {
                                workLevels.push({ parentNodeId: p.id, levelIndex: workLevels.length });
                            }
                            workLevels.push({ parentNodeId: c.id, levelIndex: workLevels.length });
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
            let sel = nodes.find(n => n.id === workDisplayNodeId);
            let rangeNode = sel;
            if (sel && sel.type === 'subrange') {
                rangeNode = nodes.find(n => n.id === sel.parentId);
            }
            if (rangeNode && rangeNode.type === 'range' && rangeNode.parentId === null) {
                let isInLevels = workLevels.some(l => l.parentNodeId === rangeNode.id);
                if (isInLevels) {
                    let kids = rangeNode.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
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
                                            workLevels = workLevels.slice(0, idx + 1);
                                            workLevels.push({ parentNodeId: k.id, levelIndex: idx + 1 });
                                            let firstRange = findFirstRange(k.id);
                                            if (firstRange !== null) {
                                                workDisplayNodeId = firstRange;
                                            }
                                            persistAll();
                                            updateWorkDisplay();
                                        };
                                    })(kid, workLevels.length);
                                    subLevelDiv.appendChild(subBtn);
                                } else if (kid.type === 'subrange') {
                                    const subLink = document.createElement("span");
                                    subLink.className = "range-link range-link-" + child.id;
                                    subLink.innerText = kid.name;
                                    if (workDisplayNodeId === kid.id) {
                                        subLink.classList.add("active");
                                    } else {
                                        subLink.classList.remove("active");
                                    }
                                    subLink.onclick = (function(k) {
                                        return function() {
                                            workDisplayNodeId = k.id;
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

        if (li < workLevels.length - 1) {
            const hr = document.createElement("hr");
            hr.style.border = "0";
            hr.style.borderTop = "1px solid #3D3D3D";
            container.appendChild(hr);
        }
    }

    if (!workDisplayNodeId) {
        const gridDiv = document.getElementById("workGrid");
        if (gridDiv) {
            gridDiv.innerHTML = "<div style='padding:20px; color: var(--text-muted);'>Выберите диапазон</div>";
        }
    }

}

function updateWorkGrid() {
    if (!workDisplayNodeId) return;
        
    let total = countTotalCombos(workDisplayNodeId);
    let percent = (total / 1326 * 100).toFixed(1);
    document.getElementById("workStats").innerHTML = `${percent}% (${total}/1326)`;
    renderGrid("workGrid", workDisplayNodeId, null);
    renderComments(workDisplayNodeId);
}

function updateWorkDisplay() {
	    // ===== ПРОВЕРКА ВАЛИДНОСТИ workDisplayNodeId =====
    const isValid = workDisplayNodeId && nodes.some(n => n.id === workDisplayNodeId);
    if (!isValid) {
        const firstRange = nodes.find(n => n.type === 'range' || n.type === 'subrange');
        if (firstRange) {
            workDisplayNodeId = firstRange.id;
        } else {
            workDisplayNodeId = null;
        }
    }
    renderWorkNavigation();
	// ===== ПОКАЗЫВАЕМ ВЛОЖЕННЫЕ ЭЛЕМЕНТЫ АКТИВНОГО ДИАПАЗОНА =====
if (workDisplayNodeId) {
    const activeNode = nodes.find(n => n.id === workDisplayNodeId);
    if (activeNode && activeNode.childrenIds && activeNode.childrenIds.length > 0) {
        const existingLevel = workLevels.find(l => l.parentNodeId === workDisplayNodeId);
        if (!existingLevel) {
            workLevels.push({ parentNodeId: workDisplayNodeId, levelIndex: workLevels.length });
            renderWorkNavigation();
        }
    }
}
    if (workDisplayNodeId) {
        updateWorkGrid();
		const workGrid = document.getElementById('workGrid');
        if (workGrid) {
            workGrid.classList.remove('matrix-fade');
            void workGrid.offsetWidth;
            workGrid.classList.add('matrix-fade');
        }
        let rangeNode = nodes.find(n => n.id === workDisplayNodeId);
        let titleEl = document.getElementById("workRangeName");
        if (titleEl && rangeNode) {
            titleEl.textContent = rangeNode.name;
        }
    }
    
    // ========================================
    // ДОБАВИТЬ ЭТОТ БЛОК (иконка + поле в просмотре)
    // ========================================
    
    // 1. ИКОНКА (привязана к таблице)
    const workTableWrapper = document.querySelector('.matrix1-wrapper');
    if (workTableWrapper) {
		        // ===== НОВАЯ ИКОНКА: РЕДАКТИРОВАТЬ СТИЛИ =====
        let styleBtn = document.getElementById('styleEditToggle');
        if (!styleBtn) {
            styleBtn = document.createElement('button');
            styleBtn.id = 'styleEditToggle';
            styleBtn.className = 'icon-btn';
            styleBtn.dataset.tooltip = 'Редактировать стили кнопок';
            styleBtn.style.position = 'absolute';
            styleBtn.style.bottom = '-32px';
            styleBtn.style.left = '0px';
            styleBtn.style.background = 'transparent';
            styleBtn.style.border = 'none';
            styleBtn.style.padding = '4px 8px';
            styleBtn.style.cursor = 'pointer';
            styleBtn.style.borderRadius = '4px';
            styleBtn.style.zIndex = '10';
            styleBtn.style.display = 'flex';
            styleBtn.style.alignItems = 'center';
            styleBtn.style.justifyContent = 'center';
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
        let iconBtn = document.getElementById('workCommentsToggleBtn');
        if (!iconBtn) {
            workTableWrapper.style.position = 'relative';
            
            iconBtn = document.createElement('button');
            iconBtn.id = 'workCommentsToggleBtn';
            iconBtn.className = 'comments-toggle-btn';
             iconBtn.dataset.tooltip = 'Комментарии';
            iconBtn.style.position = 'absolute';
            iconBtn.style.bottom = '-32px';
            iconBtn.style.left = '36px';
            iconBtn.style.background = 'transparent';
            iconBtn.style.border = 'none';
            iconBtn.style.padding = '4px 8px';
            iconBtn.style.cursor = 'pointer';
            iconBtn.style.borderRadius = '4px';
            iconBtn.style.zIndex = '10';
            iconBtn.style.display = 'flex';
            iconBtn.style.alignItems = 'center';
            iconBtn.style.justifyContent = 'center';
            iconBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 32 32" fill="#8a848a" xmlns="http://www.w3.org/2000/svg">
                    <path  d="M25.7,9.3l-7-7A.9078.9078,0,0,0,18,2H8A2.0059,2.0059,0,0,0,6,4V28a2.0059,2.0059,0,0,0,2,2H24a2.0059,2.0059,0,0,0,2-2V10A.9078.9078,0,0,0,25.7,9.3ZM18,4.4,23.6,10H18ZM24,28H8V4h8v6a2.0059,2.0059,0,0,0,2,2h6Z"/>
                    <rect data-name="&lt;Transparent Rectangle&gt;" class="cls-1" fill="none"/>
                </svg>
            `;
            
            workTableWrapper.appendChild(iconBtn);
            // Обработчик клика
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
    }
    
    // 2. ПОЛЕ ДЛЯ КОММЕНТАРИЕВ
    let workCommentsWrapper = document.getElementById('workCommentsWrapper');
    if (!workCommentsWrapper && workDisplayNodeId) {
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
                if (workDisplayNodeId) {
                    setComments(workDisplayNodeId, this.value);
                }
            }, 500);
        });
        
        textarea.addEventListener('blur', function() {
            if (workDisplayNodeId) {
                setComments(workDisplayNodeId, this.value);
                persistAll();
                clearUnsaved();
            }
        });
    }
    
    // 3. ЗАГРУЗИТЬ КОММЕНТАРИЙ
    renderWorkComments(workDisplayNodeId);
	 const commentsWrapper = document.getElementById('commentsWrapper');
    if (commentsWrapper) {
        commentsWrapper.style.display = 'block';
        renderWorkComments(workDisplayNodeId);
    }
}


// ===== ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ КОММЕНТАРИЕВ В ПРОСМОТРЕ =====
function renderWorkComments(nodeId) {
    const textarea = document.getElementById('workCommentsTextarea');
    if (!textarea) return;
    const comments = getComments(nodeId);
    textarea.value = comments;
}


function getParentRange(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    if (node.type === 'range') return node;
    if (node.type === 'subrange') {
        let current = node;
        while (current && current.type !== 'range') {
            current = nodes.find(n => n.id === current.parentId);
        }
        return current;
    }
    return null;
}

function renderGrid(containerId, nodeId, clickHandler) {
    const gridDiv = document.getElementById(containerId);
    if (!nodeId || !cellStorage[getTableId(nodeId)]) {
        gridDiv.innerHTML = "<div style='padding:20px'>Нет таблицы</div>";
        return;
    }
    const matrix = cellStorage[getTableId(nodeId)];
    gridDiv.innerHTML = "";

     const profiles = getColorsForNode(nodeId);
	     // ===== ПОЛУЧАЕМ ВЫБРАННЫЙ КОМПОНЕНТ ДЛЯ ПОДДИАПАЗОНА =====
    const currentNode = nodes.find(n => n.id === nodeId);
    let selectedComponentIndex = null;
    if (currentNode && currentNode.type === 'subrange') {
        selectedComponentIndex = currentNode.selectedComponentIndex !== undefined 
            ? currentNode.selectedComponentIndex 
            : null;
    }
	
for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
        const hand = rowsData[i][j];
        const pid = matrix[i][j];
        const prof = profiles.find(p => p.id === pid);

      // 1. Проверяем, является ли текущий узел поддиапазоном
let isSubrange = false;
if (currentNode) {
    isSubrange = currentNode.type === 'subrange';
}

// 2. Бинарная доступность (как было)
let isAvailable = true;
if (isSubrange) {
    const parentId = currentNode.parentId;
    if (parentId !== null) {
        const parentTableId = getTableId(parentId);
        const parentMatrix = cellStorage[parentTableId];
        isAvailable = parentMatrix ? parentMatrix[i][j] !== null : false;
    } else {
        isAvailable = false;
    }
}

// 3. Процент закраски в родительской ячейке (для псевдоэлемента)
let availabilityPercent = 100; // по умолчанию
if (isSubrange && isAvailable) {
    const parentId = currentNode.parentId;
    if (parentId !== null) {
        const parentTableId = getTableId(parentId);
        const parentMatrix = cellStorage[parentTableId];
        if (parentMatrix) {
            const parentPid = parentMatrix[i][j];
            if (parentPid !== null) {
                const parentColors = colorsPerNode[parentTableId] || [];
                const color = parentColors.find(c => c.id === parentPid);
               if (color && color.type === 'multi') {
    // ============================================================
    // ВСТАВКА: ПРОВЕРКА НА ВЫБРАННЫЙ КОМПОНЕНТ
    // ============================================================
    if (selectedComponentIndex !== null && color.components && color.components[selectedComponentIndex]) {
        const comp = color.components[selectedComponentIndex];
        availabilityPercent = Math.min(100, comp.share || 0);
    } else {
        let totalShare = 0;
        for (const comp of color.components) {
            totalShare += comp.share || 0;
        }
        availabilityPercent = Math.min(100, totalShare);
    }
    // ============================================================
}
				else {
                    availabilityPercent = 100; // простой цвет
                }
            }
        }
    }
}

// Если ячейка закрашена, но недоступна → очищаем (старая логика)
if (isSubrange && pid !== null && !isAvailable) {
    const currentTableId = getTableId(nodeId);
    if (cellStorage[currentTableId]) {
        cellStorage[currentTableId][i][j] = null;
    }
}

        // 3. Создаём ячейку
        const cell = document.createElement("div");
        cell.className = "hand-cell";
        cell.setAttribute("data-row", i);
        cell.setAttribute("data-col", j);
		// ===== ЧАСТИЧНАЯ ДОСТУПНОСТЬ (ОТДЕЛЬНЫЙ БЛОК) =====
if (i === 9 && j === 0) {
   
}

		

        // 4. Если ячейка недоступна — добавляем класс
        if (!isAvailable) {
            cell.classList.add('subrange-disabled');
        }

        cell.justChanged = false;
        let cellKey = `${i}_${j}`;
        cell.blockUntil = blockUntilMap.get(cellKey) || 0;

        let isColored = false;
        let originalGradient = null;
        let originalBg = null;
        let originalColor = null;
        let justCleared = false;

if (prof) {
    let gradStyle = getGradientStyleFromColorForNode(nodeId, prof);
    if (gradStyle) {
        originalGradient = gradStyle + "; color: #FFFFFF;";
        cell.setAttribute("style", originalGradient);
        isColored = true;
    } else {
        originalBg = "var(--bg-card)";
    }
} else {
    originalBg = "var(--bg-card)";
}

cell.onmouseenter = () => {
    if (Date.now() < cell.blockUntil) {
        return;
    }
    if (containerId === "constructorGrid" && !painting && !cell.justChanged) {
        const activeProfileId = getActiveForNode(nodeId);
        const currentPid = getCellProfile(nodeId, i, j);
        
        // Если ячейка уже содержит активный профиль → затемнение
        if (currentPid === activeProfileId) {
            requestAnimationFrame(() => {
                cell.removeAttribute("style");
                cell.style.opacity = "0.7";
                cell.style.color = "#FFFFFF";
            });
        } else if (activeProfileId) {
            // Во всех остальных случаях (пустая ИЛИ с другим профилем) → превью активного профиля
            const activeProf = getColorsForNode(nodeId).find(p => p.id === activeProfileId);
            if (activeProf) {
                let gradStyle = getGradientStyleFromColorForNode(nodeId, activeProf);
                requestAnimationFrame(() => {
                    cell.setAttribute("style", gradStyle + "; color: #FFFFFF; filter: brightness(0.7);");
                });
            }
        }
    }
};

          cell.onmouseleave = () => {
    if (!painting) {
        requestAnimationFrame(() => {
            if (isColored && originalGradient) {
                cell.setAttribute("style", originalGradient);
            } else {
                cell.removeAttribute("style");
            }
            // Восстанавливаем clip-height
            if (cell.dataset.clipHeight) {
                cell.style.setProperty('--clip-height', cell.dataset.clipHeight + '%');
            }
            cell.justChanged = false;
            let cellKey = `${i}_${j}`;
            blockUntilMap.set(cellKey, 0);
            cell.blockUntil = 0;
        });
    }
};

            const textSpan = document.createElement('span');
textSpan.textContent = hand;
textSpan.style.position = 'relative';
textSpan.style.zIndex = '2';
cell.appendChild(textSpan);
			if (isSubrange && isAvailable && availabilityPercent < 100) {
    const clipHeight = 100 - availabilityPercent;
    const overlay = document.createElement('div');
    overlay.className = 'cell-overlay';
    overlay.style.cssText = `

        height: ${clipHeight}%;
        
    `;
    cell.appendChild(overlay);
}
			           // Добавляем атрибуты для тултипа
cell.setAttribute('data-hand', hand);
if (pid !== null) {
    cell.setAttribute('data-profile-id', pid);
}

// ✅ ТОЛЬКО ДЛЯ РЕЖИМА ПРОСМОТРА
if (containerId === "workGrid") {
    // Обработчики для тултипа
    cell.addEventListener('mouseenter', function(e) {
        const profileId = this.getAttribute('data-profile-id');
        if (profileId) {
            const hand = this.getAttribute('data-hand');
            showTooltip(e, hand, parseInt(profileId));
        }
    });

    cell.addEventListener('mouseleave', function(e) {
        hideTooltip();
    });
}

                     gridDiv.appendChild(cell);
        }
    }
}
function formatCombos(combos) {
    let rounded = Math.round(combos * 10) / 10;
    if (rounded % 1 === 0) {
        return rounded.toString();
    }
    return rounded.toFixed(1);
}

function updateCurrentDisplay() {
    if (!currentNodeId) return;
    let total = countTotalCombos(currentNodeId);
	  // ===== ОБНОВЛЯЕМ НАЗВАНИЕ ДИАПАЗОНА =====
    const nameEl = document.getElementById("currentRangeName");
    if (nameEl) {
        const node = nodes.find(n => n.id === currentNodeId);
        if (node) {
            nameEl.textContent = node.name;
        }
    }

    renderGrid("constructorGrid", currentNodeId, null);

    let statsContainer = document.getElementById("profileStats");
    if (!statsContainer) {
        statsContainer = document.createElement("div");
        statsContainer.id = "profileStats";
        statsContainer.style.marginTop = "10px";
        statsContainer.style.fontSize = "13px";
        statsContainer.style.lineHeight = "1.4";
        statsContainer.style.display = "flex";
        statsContainer.style.justifyContent = "flex-end";
        const tablePanel = document.querySelector(".table-panel");
        if (tablePanel) tablePanel.appendChild(statsContainer);
    }

const colorStats = {};
let totalCombosWeighted = 0;
const matrix = cellStorage[getTableId(currentNodeId)];
if (matrix) {
    const profiles = getColorsForNode(currentNodeId);
    
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const pid = matrix[i][j];
            if (pid === null) continue;
            const prof = profiles.find(p => p.id === pid);
            if (!prof) continue;

            const hand = rowsData[i][j];
            let handTotalCombos = 0;
            if (hand.includes('s')) handTotalCombos = 4;
            else if (hand.includes('o')) handTotalCombos = 12;
            else if (hand[0] === hand[1]) handTotalCombos = 6;

            // Получаем компоненты профиля
            let components = [];
            let boundaries = [];

            if (prof.type === 'simple' || (!prof.type && prof.color)) {
                // Простой профиль: один компонент (сам себя)
                components = [{ colorId: prof.id, share: 100 }];
                boundaries = [100];
            } else if (prof.type === 'multi' && prof.components) {
                // Мультипрофиль: несколько компонентов
                components = prof.components;
                boundaries = prof.boundaries || [];
            }

            // Проходим по каждому компоненту мультипрофиля
            let prev = 0;
            for (let k = 0; k < components.length; k++) {
                const comp = components[k];
                const share = (boundaries[k] - prev) / 100;
                const combosShare = Math.round((handTotalCombos * share) * 10) / 10;
                
                // Находим одноцветный профиль для этого компонента
                const simpleProf = profiles.find(p => p.id === comp.colorId);
                if (!simpleProf) continue;

                // Используем ID одноцветного профиля как ключ
                const profileKey = `profile_${simpleProf.id}`;
                if (!colorStats[profileKey]) {
                    colorStats[profileKey] = { 
                        combos: 0, 
                        color: simpleProf.color,
                        name: simpleProf.name
                    };
                }
                colorStats[profileKey].combos += combosShare;
                totalCombosWeighted += combosShare;
                prev = boundaries[k];
            }
        }
    }
}
            if (statsContainer && totalCombosWeighted > 0) {
    // Сортируем цвета по убыванию комбинаций
    const sortedEntries = Object.entries(colorStats).sort((a, b) => b[1].combos - a[1].combos);
    
    let rows = [];
    let totalPercentSum = 0;
    let totalCombosSum = 0;
    
    for (const [key, data] of sortedEntries) {
        const percent = (data.combos / 1326 * 100).toFixed(1);
        totalPercentSum += parseFloat(percent);
        totalCombosSum += data.combos;
        rows.push({
            color: data.color,
            percent: percent,
            combos: data.combos
        });
    }
    
    //let emptyCombos = 1326 - totalCombosWeighted;
    //let emptyPercent = (emptyCombos / 1326 * 100).toFixed(1);
    
    // ===== ТАБЛИЦА С 3 КОЛОНКАМИ =====
    let html = `<div style="display: inline-block; min-width: 180px;">
        <table style="width: auto; border-collapse: collapse; font-size: 13px;">
            <tbody>`;
    
    // Первая строка — сумма закрашенных (БЕЗ квадратика, БЕЗ линий, обычный шрифт)
    html += `<tr>
        <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;"></td>
        <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 70px; font-weight: 600;">
            ${totalPercentSum.toFixed(1)}%
        </td>
        <td style="padding: 2px 0; text-align: right; min-width: 80px; font-weight: 600;">
            (${formatCombos(totalCombosSum)}/1326)
        </td>
    </tr>`;
    
    // Цветные строки
    for (const row of rows) {
        html += `<tr>
            <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;">
                <span style="display: inline-block; width: 15px; height: 13px; background: ${row.color}; border-radius: 3px;"></span>
            </td>
            <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 70px;">
                ${row.percent}%
            </td>
            <td style="padding: 2px 0; text-align: right; min-width: 80px;">
                (${formatCombos(row.combos)}/1326)
            </td>
        </tr>`;
    }
    
    // Незакрашенные (последние)
    //html += `<tr>
        // <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;">
             //<span style="display: inline-block; width: 15px; height: 13px; background: #313338; border-radius: 3px; border: 1px solid #3d3f46;"></span>
         //</td>
        // <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 70px;">
             //${emptyPercent}%
         //</td>
         //<td style="padding: 2px 0; text-align: right; min-width: 80px;">
             //(${formatCombos(emptyCombos)}/1326)
         //</td>
     //</tr>`;
    
    html += `</tbody></table></div>`;
    statsContainer.innerHTML = html;
}
	else if (statsContainer) {
        statsContainer.innerHTML = `<div style="color: var(--text-muted);">Нет установленных диапазонов</div>`;
    }
    
// ===== ИКОНКА КОММЕНТАРИЕВ (ФИКСИРОВАННАЯ) =====
// Вставляем иконку в тот же контейнер, где матрица
const gridWrapper = document.querySelector('.matrix-wrapper');
if (gridWrapper) {
    let iconBtn = document.getElementById('commentsToggleBtn');
    if (!iconBtn) {
        iconBtn = document.createElement('button');
        iconBtn.id = 'commentsToggleBtn';
        iconBtn.className = 'comments-toggle-btn';
        iconBtn.title = 'Комментарии';
        iconBtn.style.position = 'absolute';
        iconBtn.style.bottom = '-32px';
        iconBtn.style.left = '0';
        iconBtn.style.background = 'transparent';
        iconBtn.style.border = 'none';
        iconBtn.style.padding = '4px 8px';
        iconBtn.style.cursor = 'pointer';
        iconBtn.style.borderRadius = '4px';
        iconBtn.style.zIndex = '10';
        iconBtn.style.display = 'flex';
        iconBtn.style.alignItems = 'center';
        iconBtn.style.justifyContent = 'center';
        iconBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 32 32" fill="#8a848a" xmlns="http://www.w3.org/2000/svg">
                <path d="M25.7,9.3l-7-7A.9078.9078,0,0,0,18,2H8A2.0059,2.0059,0,0,0,6,4V28a2.0059,2.0059,0,0,0,2,2H24a2.0059,2.0059,0,0,0,2-2V10A.9078.9078,0,0,0,25.7,9.3ZM18,4.4,23.6,10H18ZM24,28H8V4h8v6a2.0059,2.0059,0,0,0,2,2h6Z"/>
                <rect data-name="&lt;Transparent Rectangle&gt;" class="cls-1" fill="none"/>
            </svg>
        `;
        
        // Делаем wrapper относительным для позиционирования иконки
        gridWrapper.style.position = 'relative';
        gridWrapper.appendChild(iconBtn);
        
        // Вешаем обработчик
        iconBtn.addEventListener('click', toggleComments);
    }
}

// ===== ПОЛЕ ДЛЯ КОММЕНТАРИЕВ (ПОД СТАТИСТИКОЙ) =====
let commentsWrapper = document.getElementById('commentsWrapper');
if (!commentsWrapper) {
    commentsWrapper = document.createElement('div');
    commentsWrapper.id = 'commentsWrapper';
    commentsWrapper.className = 'comments-wrapper';
    commentsWrapper.style.width = '100%';
    commentsWrapper.style.maxWidth = '530px';
    commentsWrapper.style.marginTop = '8px';
    
    const area = document.createElement('div');
    area.className = 'comments-area';
    area.id = 'commentsArea';
    area.style.display = 'none';
    area.style.width = '100%';
    area.style.borderRadius = '6px';
    area.style.border = '1px solid #3d3f46';
    area.style.background = '#2d2f34';
    area.style.overflow = 'hidden';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'commentsTextarea';
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
    commentsWrapper.appendChild(area);
    
    const tablePanel = document.querySelector('.table-panel');
    if (tablePanel) tablePanel.appendChild(commentsWrapper);
    
    // Сохраняем ссылку на textarea для renderComments
    window.commentsTextarea = textarea;
}

// Загружаем комментарий
renderComments(currentNodeId);
}
// ===== ВСПЛЫВАЮЩАЯ ПОДСКАЗКА (TOOLTIP) =====
let tooltipElement = null;
let tooltipTimeout = null;

function getTooltipElement() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'cell-tooltip';
        
        // ✅ Добавляем тултип ВНУТРЬ .left-area
        const container = document.querySelector('.left-area');
        if (container) {
            container.appendChild(tooltipElement);
        } else {
            document.body.appendChild(tooltipElement);
            console.warn('⚠️ .left-area не найден, тултип в body');
        }
    }
    return tooltipElement;
}

function showTooltip(event, hand, profileId) {
    const nodeId = workDisplayNodeId;
    if (!nodeId || !profileId) return;
    
    const profiles = getColorsForNode(nodeId);
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    const colorsList = getColorsForNode(nodeId);
    if (!colorsList || colorsList.length === 0) return;
    
    let html = `<div class="tooltip-hand">${hand}</div>`;
    html += `<hr class="tooltip-divider">`;
    
    // Определяем, простой это профиль или мульти
    let colorIds = [];
    let boundaries = [];
    
    if (profile.type === 'simple' || (!profile.type && profile.color)) {
        // Простой профиль
        colorIds = [profile.id];
        boundaries = [100];
    } else if (profile.type === 'multi' && profile.components) {
        // Мультипрофиль — берём компоненты
        colorIds = profile.components.map(c => c.colorId);
        boundaries = profile.boundaries || [];
    } else {
        return;
    }
    
    let prev = 0;
    for (let i = 0; i < colorIds.length; i++) {
        const colorId = colorIds[i];
        const colorObj = colorsList.find(c => c.id === colorId);
        if (!colorObj) continue;
        
        const percent = boundaries[i] - prev;
        prev = boundaries[i];
        
        html += `
            <div class="tooltip-row">
                <span class="tooltip-color-box" style="background: ${colorObj.color};"></span>
                <span class="tooltip-color-name">${colorObj.name}</span>
                <span class="tooltip-percent">${Math.round(percent)}%</span>
            </div>
        `;
    }
    
    const tooltip = getTooltipElement();
    tooltip.innerHTML = html;
    positionTooltip(event, tooltip);
    tooltip.classList.add('visible');
}

function positionTooltip(event, tooltip) {
    const cell = event.target.closest('.hand-cell');
    if (!cell) return;
    
    const container = document.querySelector('.left-area');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    
    // ✅ Временно делаем видимым, но прозрачным
    tooltip.style.display = 'block';
    tooltip.style.opacity = '0';
    
    const tooltipRect = tooltip.getBoundingClientRect();
    
    const horizontalPadding = 8;
    const verticalGap = 6;
    
    let left = (cellRect.left - containerRect.left) + (cellRect.width / 2) - (tooltipRect.width / 2);
    let top = (cellRect.bottom - containerRect.top) + verticalGap;
    
    if (left < horizontalPadding) {
        left = horizontalPadding;
    }
    
    if (left + tooltipRect.width > containerRect.width - horizontalPadding) {
        left = containerRect.width - tooltipRect.width - horizontalPadding;
    }
    
    if (top + tooltipRect.height > containerRect.height - horizontalPadding) {
        top = (cellRect.top - containerRect.top) - tooltipRect.height - verticalGap;
        if (top < horizontalPadding) top = horizontalPadding;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    
    // ✅ Теперь делаем видимым (анимация пойдёт из CSS)
    tooltip.style.opacity = '1';
}
function hideTooltip() {
    const tooltip = getTooltipElement();
    tooltip.classList.remove('visible');
    tooltip.style.opacity = '0';   // ← оставляем для синхронизации
    setTimeout(() => {
        if (!tooltip.classList.contains('visible')) {
            tooltip.style.display = 'none';
        }
    }, 400);
}
// ===== DRAG & DROP: ПРОВЕРКА, МОЖНО ЛИ ТАЩИТЬ =====
function canDrag(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return false;

    // Поддиапазоны — никогда
    if (node.type === 'subrange') return false;

    // Проверяем, не находится ли узел внутри диапазона (или не является его частью)
    let current = node;
    while (current) {
        // Если мы нашли диапазон
        if (current.type === 'range') {
            // Если это сам перетаскиваемый узел — можно (это диапазон)
            if (current.id === nodeId) return true;
            // Если это любой другой узел внутри диапазона — нельзя
            return false;
        }
        current = nodes.find(n => n.id === current.parentId);
    }

    // Папки вне диапазона — можно
    return node.type === 'folder' || node.type === 'range';
}


// ===== DRAG & DROP: ПРОВЕРКА, МОЖНО ЛИ ВСТАВИТЬ =====
function canDrop(sourceId, targetId) {
    // Запрещаем вставку в родителя
    const source = nodes.find(n => n.id === sourceId);
    if (source && source.parentId === targetId) {
        return false;
    }

    if (sourceId === targetId) return false;

    // Защита от циклов
    let current = nodes.find(n => n.id === targetId);
    while (current) {
        if (current.id === sourceId) return false;
        current = nodes.find(n => n.id === current.parentId);
    }

    const target = nodes.find(n => n.id === targetId);
    if (!source || !target) return false;

    if (target.type !== 'folder') return false;

    // Нельзя вставлять в папку внутри диапазона
    let t = target;
    while (t) {
        if (t.type === 'range') return false;
        t = nodes.find(n => n.id === t.parentId);
    }

    return true;
}

// ===== DRAG & DROP: ПРОВЕРКА, ВНУТРИ ЛИ ДИАПАЗОНА =====
function isInsideRange(nodeId) {
    let current = nodes.find(n => n.id === nodeId);
    while (current) {
        const parent = nodes.find(n => n.id === current.parentId);
        if (parent && parent.type === 'range') return true;
        current = parent;
    }
    return false;
}


// ===== DRAG & DROP: ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ =====

document.addEventListener('mousemove', function(e) {
    if (!dragData) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    isDragging = true;
	document.body.classList.add('dragging');
    if (dragData.element) {
        dragData.element.style.opacity = '1';
    }

// ===== СОЗДАЁМ ПРИЗРАК =====
const sourceElement = document.querySelector(`.tree-item[data-node-id="${dragData.nodeId}"]`);
if (sourceElement) {
    ghostElement = sourceElement.cloneNode(true);

    // Удаляем стрелку и меню
    const arrow = ghostElement.querySelector('.tree-arrow');
    if (arrow) arrow.remove();
    const menu = ghostElement.querySelector('.tree-actions-popup');
    if (menu) menu.remove();

    // Применяем класс drag-ghost
    ghostElement.className = 'drag-ghost';

    // ===== КОПИРУЕМ ТОЛЬКО ДИНАМИЧЕСКИЕ СТИЛИ =====
    // 1. Ширина
    const itemWidth = sourceElement.getBoundingClientRect().width;
    ghostElement.style.width = itemWidth + 'px';

    // 2. padding
    const computedStyle = window.getComputedStyle(sourceElement);
    //ghostElement.style.padding = computedStyle.padding;

    // 3. Внутренний блок (.tree-item-name) — отступ и gap
    const nameEl = sourceElement.querySelector('.tree-item-name');
    const nameClone = ghostElement.querySelector('.tree-item-name');

    if (nameEl && nameClone) {
        // Реальный отступ от края .tree-item
        const itemRect = sourceElement.getBoundingClientRect();
        const nameRect = nameEl.getBoundingClientRect();
        const totalOffset = nameRect.left - itemRect.left;
        nameClone.style.marginLeft = totalOffset + 'px';

        // gap
        const nameStyle = window.getComputedStyle(nameEl);
        nameClone.style.gap = nameStyle.gap;
    }

    // Ставим призрак под курсор
       ghostElement.style.left = (e.clientX - dragData.offsetX) + 'px';
       ghostElement.style.top = (e.clientY - dragData.offsetY) + 'px';

    document.body.appendChild(ghostElement);

	
    // Подсказка
    const hintEl = document.createElement('div');
    hintEl.className = 'drag-hint';
    hintEl.id = 'dragHint';
    hintEl.innerHTML = `→ переместить в <strong id="hintTargetName">...</strong>`;
    hintEl.style.left = e.clientX + 'px';
    hintEl.style.top = (e.clientY + 26) + 'px';
    document.body.appendChild(hintEl);
}
}

if (isDragging) {
    if (ghostElement) {
      ghostElement.style.left = (e.clientX - dragData.offsetX) + 'px';
      ghostElement.style.top = (e.clientY - dragData.offsetY) + 'px';
    }

    const hintEl = document.getElementById('dragHint');
    if (hintEl) {
        const ghostRect = ghostElement.getBoundingClientRect();
        hintEl.style.left = (ghostRect.left + ghostRect.width / 2) + 'px';
        hintEl.style.top = (ghostRect.bottom + 4) + 'px';
        hintEl.style.transform = 'translateX(-50%)';
    }

    highlightDropTarget(e.clientX, e.clientY);

    const targetId = getDropTarget(e.clientX, e.clientY);
    updateGhostTarget(targetId);
}
});

document.addEventListener('mouseup', function(e) {
    if (!dragData) return;

    if (isDragging) {
        if (dragData.element) {
            dragData.element.style.opacity = '1';
        }

        if (ghostElement) {
            ghostElement.remove();
            ghostElement = null;
        }

        const hintEl = document.getElementById('dragHint');
        if (hintEl) {
            hintEl.remove();
        }

        clearHighlight();

        const targetId = getDropTarget(e.clientX, e.clientY);

if (targetId && targetId !== dragData.nodeId) {
    if (canDrop(dragData.nodeId, targetId)) {
        showMoveConfirm(dragData.nodeId, targetId);
    }
}
document.body.classList.remove('dragging');
    }

    dragData = null;
    isDragging = false;
});
function clearHighlight() {
    if (highlightedNode) {
        highlightedNode.style.background = '';
        highlightedNode.style.border = '';
        highlightedNode.style.borderRadius = '';
        highlightedNode = null;
    }
    if (expandTimeout) {
        clearTimeout(expandTimeout);
        expandTimeout = null;
    }
}
function highlightDropTarget(clientX, clientY) {
    // Если цель — текущий родитель, не подсвечиваем
if (dragData) {
    const targetId = getDropTarget(clientX, clientY);
    const source = nodes.find(n => n.id === dragData.nodeId);
    if (source && source.parentId === targetId) {
        clearHighlight();
        return;
    }
}

    const element = document.elementFromPoint(clientX, clientY);
    const treeItem = element?.closest('.tree-item');
    
    if (!treeItem) {
        clearHighlight();
        return;
    }

    const nodeId = parseInt(treeItem.dataset.nodeId);
    if (!nodeId) return;

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (node.type === 'folder') {
        clearHighlight();
        treeItem.style.background = '#3a3d45';
		treeItem.style.borderTop = '1px solid #D4AF37';
        treeItem.style.borderBottom = '1px solid #D4AF37';
        treeItem.style.borderLeft = 'none';
        treeItem.style.borderRight = 'none';
        
        highlightedNode = treeItem;

        // Авто-раскрытие
        const hasChildren = node.childrenIds && node.childrenIds.length > 0;
        const isOpen = expandedNodes.has(node.id);

        if (hasChildren && !isOpen) {
            if (expandTimeout) {
                clearTimeout(expandTimeout);
                expandTimeout = null;
            }

            expandTimeout = setTimeout(() => {
                expandedNodes.add(node.id);
                refreshTreeOnly();

                setTimeout(() => {
                    const newItem = document.querySelector(`.tree-item[data-node-id="${node.id}"]`);
                    if (newItem) {
                        newItem.style.background = '#3a3d45';
                        newItem.style.border = '2px solid #D4AF37';
                        newItem.style.borderRadius = '4px';
                        highlightedNode = newItem;
                    }
                }, 50);

                expandTimeout = null;
            }, 800);
        }
    } else {
        clearHighlight();
    }
}
// ===== DRAG & DROP: ОПРЕДЕЛЕНИЕ ЦЕЛИ ПОД МЫШКОЙ =====
function getDropTarget(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    const treeItem = element?.closest('.tree-item');
    if (!treeItem) return null;

    const nodeId = parseInt(treeItem.dataset.nodeId);
    if (!nodeId) return null;

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    // Можно вставлять только в папки (не в диапазоны)
if (node.type === 'folder' || node.type === 'range') {
    return nodeId;
}
return null;
}

function updateGhostTarget(targetNodeId) {
    const hintEl = document.getElementById('dragHint');
    if (!hintEl) return;

    if (!targetNodeId) {
        hintEl.innerHTML = `→ переместить в <strong>...</strong>`;
        return;
    }

    const target = nodes.find(n => n.id === targetNodeId);
    if (!target) {
        hintEl.innerHTML = `→ переместить в <strong>...</strong>`;
        return;
    }

    if (canDrop(dragData.nodeId, targetNodeId)) {
        hintEl.innerHTML = `→ переместить в <strong>${target.name}</strong>`;
    } else {
        hintEl.innerHTML = `🚫`;
    }
}
// ===== DRAG & DROP: ОКНО ПОДТВЕРЖДЕНИЯ ПЕРЕМЕЩЕНИЯ =====
function showMoveConfirm(sourceId, targetId) {
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    if (!source || !target) return;

    const typeName = source.type === 'folder' ? 'папку' : 'диапазон';
    const targetTypeName = target.type === 'folder' ? 'папку' : 'диапазон';

    // Удаляем старый popup, если есть
    const oldPopup = document.querySelector('.move-popup-overlay');
    if (oldPopup) oldPopup.remove();

    const overlay = document.createElement('div');
    overlay.className = 'move-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'move-popup';
    popup.innerHTML = `
        <div class="move-popup-question">
            Переместить ${typeName} <strong>«${source.name}»</strong><br>
            в ${targetTypeName} <strong>«${target.name}»</strong>?
        </div>
        <div class="move-popup-actions">
            <button class="btn btn-cancel" id="moveCancelBtn">Нет</button>
            <button class="btn btn-confirm" id="moveConfirmBtn">Да</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Закрытие по клику вне
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeMovePopup(overlay, sourceId);
        }
    });

    // Escape
    const escapeHandler = function(e) {
        if (e.key === 'Escape') {
            closeMovePopup(overlay, sourceId);
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    popup.querySelector('#moveCancelBtn').onclick = () => {
        closeMovePopup(overlay, sourceId);
    };

    popup.querySelector('#moveConfirmBtn').onclick = () => {
        overlay.remove();
        moveNodeWithChildren(sourceId, targetId);
        clearHighlight();
        const el = document.querySelector(`.tree-item[data-node-id="${sourceId}"]`);
        if (el) el.style.opacity = '1';
    };
}

function closeMovePopup(overlay, sourceId) {
    overlay.remove();
    clearHighlight();
    const el = document.querySelector(`.tree-item[data-node-id="${sourceId}"]`);
    if (el) el.style.opacity = '1';
}
// ===== DRAG & DROP: ПЕРЕМЕЩЕНИЕ УЗЛА =====
function moveNodeWithChildren(sourceId, targetId) {
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    if (!source || !target) return;

    // Удаляем из старого родителя
    const oldParent = nodes.find(n => n.id === source.parentId);
    if (oldParent) {
        oldParent.childrenIds = oldParent.childrenIds.filter(id => id !== sourceId);
    }

    // Добавляем в нового родителя
    source.parentId = targetId;
    target.childrenIds.push(sourceId);

    persistAll();
    refreshAll();
    selectNode(sourceId);
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
               workDisplayNodeId;
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

// ===== КАСТОМНОЕ ОКНО ДЛЯ ПОДТВЕРЖДЕНИЯ СОХРАНЕНИЯ =====
function showSaveConfirmModal(message, onSave, onCancel) {
    if (!message) {
        console.warn('⚠️ showSaveConfirmModal: не передан текст сообщения');
        return;
    }

    const oldModal = document.querySelector('.save-confirm-overlay');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'save-confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'save-confirm-modal';
    modal.innerHTML = `
        <div class="save-confirm-header" id="saveConfirmHeader">
            <span>Cообщение</span>
        </div>
        <div class="save-confirm-body">
            <p>${message}</p>
        </div>
        <div class="save-confirm-actions">
            <button class="btn btn-cancel" id="saveConfirmNo">Нет</button>
            <button class="btn btn-confirm" id="saveConfirmYes">Да</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ===== ПЕРЕТАСКИВАНИЕ =====
    const header = modal.querySelector('#saveConfirmHeader');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    function onDrag(e) {
        if (!isDragging) return;
        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, left));
        top = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, top));
        modal.style.left = left + 'px';
        modal.style.top = top + 'px';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    // ===== КНОПКИ =====
    modal.querySelector('#saveConfirmYes').onclick = () => {
        overlay.remove();
        if (onSave) onSave();
    };

    modal.querySelector('#saveConfirmNo').onclick = () => {
        overlay.remove();
        if (onCancel) onCancel();
    };
}
// ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ ДИАЛОГА ВЫБОРА КОМПОНЕНТА
function showComponentSelectionDialog(parentNodeId, callback) {
    
    const parent = nodes.find(n => n.id === parentNodeId);
    if (!parent) {
        if (callback) callback(null);
        return;
    }

    const tableId = getTableId(parentNodeId);
    const colors = colorsPerNode[tableId] || [];
    
    // Находим все мультицветы в родителе
    const multiColors = colors.filter(c => c.type === 'multi');
    // Берём ТОЛЬКО простые цвета
const components = colors.filter(c => c.type === 'simple' || (!c.type && c.color));


    
    // Создаём HTML для списка
    let listHtml = `
    <div class="component-dialog-body">
       <div class="component-option" data-index="null">
    <div class="profile-radio" data-index="null"></div>
    <div class="color-swatch sum-all"></div>
    <span class="color-name">Все цвета</span>
</div>
`;

for (const comp of components) {
    const colorName = comp.name || 'Цвет';
    const colorHex = comp.color || '#9C5479';
    
    listHtml += `
      <div class="component-option" data-index="${components.indexOf(comp)}">
    <div class="profile-radio" data-index="${components.indexOf(comp)}"></div>
    <div class="color-swatch" style="background: ${colorHex};"></div>
    <span class="color-name">${colorName}</span>
</div> 
    `;
}

listHtml += `</div>`;

    // Создаём окно
    const overlay = document.createElement('div');
    overlay.className = 'save-confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'save-confirm-modal';
    modal.style.width = '400px';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '80vh';
    modal.style.overflow = 'auto';

    modal.innerHTML = `
        <div class="save-confirm-header" id="componentDialogHeader" style="cursor: grab; display: flex; justify-content: space-between; align-items: center;">
            <span>Добавить поддиапазон</span>
            <button id="componentDialogClose" style="background: none; border: none; color: #8a848a; font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1;">✕</button>
        </div>
        <div class="save-confirm-body">
            ${listHtml}
        </div>
        <div class="save-confirm-actions" style="justify-content: flex-end;">
            <button class="btn btn-cancel" id="componentDialogCancel">Отмена</button>
            <button class="btn btn-confirm" id="componentDialogOk">ОК</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ===== ПЕРЕТАСКИВАНИЕ =====
    const header = modal.querySelector('#componentDialogHeader');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
        if (e.target.closest('button')) return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    });

    function onDrag(e) {
        if (!isDragging) return;
        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(10, Math.min(window.innerWidth - modal.offsetWidth - 10, left));
        top = Math.max(10, Math.min(window.innerHeight - modal.offsetHeight - 10, top));
        modal.style.left = left + 'px';
        modal.style.top = top + 'px';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    // ===== ОБРАБОТЧИКИ =====
    function closeDialog(selectedIndex) {
        overlay.remove();
        if (callback) callback(selectedIndex);
    }

    modal.querySelector('#componentDialogClose').addEventListener('click', () => closeDialog(-1));
    modal.querySelector('#componentDialogCancel').addEventListener('click', () => closeDialog(-1));
	modal.querySelector('#componentDialogOk').addEventListener('click', function() {
    // Если ничего не выбрано (undefined) — не закрываем
    if (selectedIndex === undefined) return;
    // Иначе передаём выбранное значение (null — Все цвета, число — конкретный цвет)
    closeDialog(selectedIndex);
});

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeDialog(null);
        }
    });

    // Выбор компонента
    // ===== ВЫБОР КОМПОНЕНТА (РАДИО) =====
const options = modal.querySelectorAll('.component-option');
const radios = modal.querySelectorAll('.profile-radio');
let selectedIndex = undefined;

function selectOption(index) {
    // Снимаем активность со всех радио
    radios.forEach(r => r.classList.remove('active'));
    // Находим радио для выбранного индекса
    const targetRadio = modal.querySelector(`.profile-radio[data-index="${index === null ? 'null' : index}"]`);
    if (targetRadio) {
        targetRadio.classList.add('active');
    }
    selectedIndex = index;
}

// Ховер-эффекты (оставляем как было)
options.forEach(opt => {
    opt.addEventListener('mouseenter', function() {
        this.style.background = '#3a3d45';
    });
    opt.addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
        this.style.borderColor = 'transparent';
    });
});

// Клик по строке (не по радио)
options.forEach(opt => {
    opt.addEventListener('click', function(e) {
        if (e.target.classList.contains('profile-radio')) return;
        const idx = this.dataset.index;
        const index = idx === 'null' ? null : parseInt(idx);
        selectOption(index);
    });
});

// Клик по радио-кнопке
radios.forEach(radio => {
    radio.addEventListener('click', function(e) {
        e.stopPropagation();
        const idx = this.dataset.index;
        const index = idx === 'null' ? null : parseInt(idx);
        selectOption(index);
    });
});
}
// ===== СОХРАНЕНИЕ ТОЛЬКО ДАННЫХ ДИАПАЗОНА (МАТРИЦА, ЦВЕТА, ПРОФИЛИ) =====
function saveRangeData() {
    if (!currentNodeId) return;

    const nodeId = getTableId(currentNodeId);
    const data = {
        matrix: cellStorage[nodeId] || null,
        colors: colorsPerNode[nodeId] || [],
        activeColor: activePerNode[nodeId] || null
    };

    localStorage.setItem("poker_range_data_" + nodeId, JSON.stringify(data));
}
// ===== ДУБЛИРОВАНИЕ ДИАПАЗОНА =====
function duplicateRange(nodeId) {
    const original = nodes.find(n => n.id === nodeId);
    if (!original) return;

    // ===== 1. ПРОВЕРКА НА НЕСОХРАНЁННЫЕ ИЗМЕНЕНИЯ =====
    if (hasUnsavedChanges) {
        const node = nodes.find(n => n.id === currentNodeId);
        const message = node
            ? `Диапазон <span style="color: #D4AF37; font-weight: 600;">${node.name}</span> был отредактирован. Сохранить изменения?`
            : 'Сохранить изменения?';

        showSaveConfirmModal(message, function() {
            // ДА — сохраняем
            persistAll();
            clearUnsaved();
            createCopyAndFinalize(original);
        }, function() {
            // НЕТ — откатываем
            loadFromStorage();
            refreshAll();
            updateCurrentDisplay();
            clearUnsaved();
            createCopyAndFinalize(original);
        });
        return;
    }

    // ===== 2. ЕСЛИ ИЗМЕНЕНИЙ НЕТ — СОЗДАЁМ КОПИЮ =====
    createCopyAndFinalize(original);
}

// ===== СОЗДАНИЕ КОПИИ ДИАПАЗОНА =====
function createCopyAndFinalize(original) {
    // ===== 1. Генерируем уникальное имя =====
    const parent = nodes.find(n => n.id === original.parentId);
    let siblings = [];
    if (parent) {
        siblings = parent.childrenIds.map(id => nodes.find(n => n.id === id)).filter(n => n);
    } else {
        siblings = nodes.filter(n => n.parentId === null);
    }

    const existingNames = siblings.filter(n => n.type === 'range').map(n => n.name);
    let newName = `${original.name} - дубль`;
    let counter = 2;
    while (existingNames.includes(newName)) {
        newName = `${original.name} - дубль (${counter})`;
        counter++;
    }

    // ===== 2. Создаём новый узел =====
    const newId = nextNodeId++;
    const newNode = {
    id: newId,
    name: newName,
    parentId: original.parentId,
    childrenIds: [],
    type: original.type   // ← сохраняем исходный тип ('range' или 'subrange')
};
    nodes.push(newNode);

    if (parent) {
        parent.childrenIds.push(newId);
    }

    // ===== 3. Копируем данные =====
    const sourceId = getTableId(original.id);
    const targetId = getTableId(newId);

    // 3.1 Копируем матрицу
    const originalTable = cellStorage[sourceId];
    ensureTable(newId);
    const newTable = cellStorage[targetId];

    // 3.2 Копируем все цвета (и простые, и мульти) с созданием colorMap
    const sourceColors = getColorsForNode(original.id);
    const targetColors = [];
    const colorMap = {};

    for (const color of sourceColors) {
        const newColorId = nextColorId++;
        const newColor = {
            id: newColorId,
            name: color.name,
            type: color.type
        };

        if (color.type === 'simple' || (!color.type && color.color)) {
            newColor.color = color.color;
        } else if (color.type === 'multi' || color.components) {
            newColor.components = color.components ? color.components.map(comp => ({
                colorId: comp.colorId, // пока старый ID, обновим позже
                share: comp.share
            })) : [];
            newColor.boundaries = color.boundaries ? [...color.boundaries] : [];
        }

        targetColors.push(newColor);
        colorMap[color.id] = newColorId;
    }

    // 3.3 Обновляем ссылки в components у мультицветов
    for (const color of targetColors) {
        if (color.type === 'multi' && color.components) {
            color.components = color.components.map(comp => ({
                colorId: colorMap[comp.colorId] || comp.colorId,
                share: comp.share
            }));
        }
    }

    colorsPerNode[targetId] = targetColors;

    // 3.4 Копируем активный элемент
    const activeId = getActiveForNode(original.id);
    if (activeId && colorMap[activeId]) {
        activePerNode[targetId] = colorMap[activeId];
    }

    // 3.5 Копируем матрицу с обновлёнными ID
    if (originalTable) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                const oldPid = originalTable[i][j];
                if (oldPid !== null && oldPid !== undefined) {
                    newTable[i][j] = colorMap[oldPid] || oldPid;
                } else {
                    newTable[i][j] = null;
                }
            }
        }
    }

    // ===== 4. Сохраняем и активируем =====
    persistAll();
    refreshAll();
    selectNode(newId);
    updateCurrentDisplay();

    const newNodeFinal = nodes.find(n => n.id === newId);
    if (newNodeFinal) {
        
    }
}
// ===== КОПИРОВАНИЕ ДИАПАЗОНА В БУФЕР =====
function copyRange(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
        showFloatingModal('Диапазон не найден');
        return;
    }

    if (node.type !== 'range' && node.type !== 'subrange') {
        showFloatingModal('Можно копировать только диапазоны');
        return;
    }

    const tableId = getTableId(nodeId);
    
    // Копируем матрицу (глубокое копирование)
    const matrix = cellStorage[tableId];
    let copiedMatrix = null;
    if (matrix) {
        copiedMatrix = matrix.map(row => [...row]);
    }

    // Копируем цвета (профили)
    const colors = colorsPerNode[tableId] || [];
    const copiedColors = JSON.parse(JSON.stringify(colors));

    // Копируем активный цвет
    const activeId = activePerNode[tableId] || null;

    // Сохраняем в буфер
    clipboardRangeData = {
        matrix: copiedMatrix,
        colors: copiedColors,
        activeId: activeId,
        sourceNodeId: nodeId,
        sourceName: node.name
    };

    
    
    // Обновляем меню (активируем кнопку "Вставить")
    updatePasteButtonState();
	refreshAll();
}

// ===== ВСТАВКА ДИАПАЗОНА ИЗ БУФЕРА =====
function pasteRange(nodeId) {
    if (!clipboardRangeData) {
        showFloatingModal('Нет скопированного диапазона');
        return;
    }

    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode) {
        showFloatingModal('Целевой диапазон не найден');
        return;
    }

    if (targetNode.type !== 'range' && targetNode.type !== 'subrange') {
        showFloatingModal('Вставлять можно только в диапазоны');
        return;
    }

    const targetTableId = getTableId(nodeId);
    
    // Проверяем, пустой ли целевой диапазон
    const targetMatrix = cellStorage[targetTableId];
    let isTargetEmpty = true;
    if (targetMatrix) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                if (targetMatrix[i][j] !== null) {
                    isTargetEmpty = false;
                    break;
                }
            }
            if (!isTargetEmpty) break;
        }
    }

    // Если диапазон не пустой — показываем подтверждение
    if (!isTargetEmpty) {
        showSaveConfirmModal(
            `Диапазон «${targetNode.name}» не пустой. Вставить новые данные?`,
            function() {
                // ДА — выполняем вставку
                executePaste(nodeId);
            },
            function() {
                // НЕТ — ничего не делаем
            }
        );
        return;
    }

    // Если пустой — сразу вставляем
    executePaste(nodeId);
}

// ===== ВЫПОЛНЕНИЕ ВСТАВКИ =====
function executePaste(nodeId) {
    if (!clipboardRangeData) return;

    const targetTableId = getTableId(nodeId);
    
    // 1. Копируем цвета с новыми ID и создаем colorMap
    const sourceColors = clipboardRangeData.colors || [];
    const newColors = [];
    const colorMap = {};

    for (const color of sourceColors) {
        const newId = nextColorId++;
        const newColor = {
            id: newId,
            name: color.name,
            type: color.type
        };

        if (color.type === 'simple' || (!color.type && color.color)) {
            newColor.color = color.color;
        } else if (color.type === 'multi' || color.components) {
            newColor.components = color.components ? color.components.map(comp => ({
                colorId: comp.colorId,
                share: comp.share
            })) : [];
            newColor.boundaries = color.boundaries ? [...color.boundaries] : [];
        }

        newColors.push(newColor);
        colorMap[color.id] = newId;  // ← запоминаем соответствие старый ID → новый ID
    }

    // 2. Обновляем ссылки в компонентах мультицветов
    for (const color of newColors) {
        if (color.type === 'multi' && color.components) {
            color.components = color.components.map(comp => ({
                colorId: colorMap[comp.colorId] || comp.colorId,
                share: comp.share
            }));
        }
    }

    // 3. Сохраняем новые цвета
    colorsPerNode[targetTableId] = newColors;

    // 4. Вставляем матрицу с ОБНОВЛЕННЫМИ ID (через colorMap)
    ensureTable(nodeId);
    const targetMatrix = cellStorage[targetTableId];
    
    if (clipboardRangeData.matrix) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                const oldId = clipboardRangeData.matrix[i]?.[j];
                if (oldId !== null && oldId !== undefined) {
                    // ✅ ЗАМЕНЯЕМ СТАРЫЙ ID НА НОВЫЙ
                    targetMatrix[i][j] = colorMap[oldId] || null;
                } else {
                    targetMatrix[i][j] = null;
                }
            }
        }
    }

    // 5. Восстанавливаем активный цвет
    if (clipboardRangeData.activeId && colorMap[clipboardRangeData.activeId]) {
        activePerNode[targetTableId] = colorMap[clipboardRangeData.activeId];
    } else {
        // Если активного нет или он не найден — устанавливаем первый цвет
        const firstColor = newColors.find(c => c.type === 'simple' || (!c.type && c.color));
        if (firstColor) {
            activePerNode[targetTableId] = firstColor.id;
        }
    }

    // 6. Сохраняем данные и делаем диапазон активным
    
    
    // 👇 ДЕЛАЕМ ДИАПАЗОН АКТИВНЫМ
    selectNode(nodeId);
    
    // 7. Обновляем интерфейс
    refreshAll();
    updateCurrentDisplay();
    markUnsaved();

    const targetName = nodes.find(n => n.id === nodeId)?.name || 'диапазон';
     clipboardRangeData = null;
     updatePasteButtonState();
}

// ===== ПРОВЕРКА, ЕСТЬ ЛИ ДАННЫЕ В БУФЕРЕ =====
function hasClipboardData() {
    return clipboardRangeData !== null;
}
// ===== ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПКИ "ВСТАВИТЬ" =====
function updatePasteButtonState() {
    const pasteBtn = document.getElementById('tablePasteBtn');
    if (!pasteBtn) return;
    
    const hasData = hasClipboardData();
    if (!hasData) {
        pasteBtn.style.opacity = '0.4';
        pasteBtn.style.cursor = 'default';
        pasteBtn.style.pointerEvents = 'none';
        pasteBtn.title = 'Сначала скопируйте диапазон';
    } else {
        pasteBtn.style.opacity = '1';
        pasteBtn.style.cursor = 'pointer';
        pasteBtn.style.pointerEvents = 'auto';
        pasteBtn.title = 'Вставить диапазон';
    }
}
// ===== КОММЕНТАРИИ =====

function getComments(nodeId) {
    const tableId = getTableId(nodeId);
    return commentsPerNode[tableId] || '';
}

function setComments(nodeId, text) {
    const tableId = getTableId(nodeId);
    commentsPerNode[tableId] = text;
    markUnsaved();
}

function renderComments(nodeId) {
    const textarea = document.getElementById('commentsTextarea');
    if (!textarea) return;
    
    const comments = getComments(nodeId);
    textarea.value = comments;
}

function toggleComments() {
    const area = document.getElementById('commentsArea');
    const btn = document.getElementById('commentsToggleBtn');
    
    if (!area || !btn) return;
    
    const isOpen = area.style.display !== 'none';
    
    if (isOpen) {
        area.style.display = 'none';
        btn.classList.remove('active');
    } else {
        area.style.display = 'block';
        btn.classList.add('active');
        // Фокусируемся на поле ввода
        const textarea = document.getElementById('commentsTextarea');
        if (textarea) {
            setTimeout(() => textarea.focus(), 100);
        }
    }
}

function saveComments() {
    if (!currentNodeId) return;
    
    const textarea = document.getElementById('commentsTextarea');
    if (!textarea) return;
    
    setComments(currentNodeId, textarea.value);
    persistAll();
    clearUnsaved();
}

// ===== ИНИЦИАЛИЗАЦИЯ КОММЕНТАРИЕВ =====
function initComments() {
    const toggleBtn = document.getElementById('commentsToggleBtn');
    const textarea = document.getElementById('commentsTextarea');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleComments);
    }
    
    if (textarea) {
        // Автосохранение при вводе (с задержкой)
        let saveTimeout = null;
        textarea.addEventListener('input', function() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (currentNodeId) {
                    setComments(currentNodeId, this.value);
                }
            }, 500);
        });
        
        // Сохраняем при потере фокуса
        textarea.addEventListener('blur', function() {
            if (currentNodeId) {
                setComments(currentNodeId, this.value);
                persistAll();
                clearUnsaved();
            }
        });
    }
}
// ---------- ВЫБОР КАРТ ----------
const rankOrder = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const suits = ["h","c","d","s"];
const suitSymbols = { h: "♥", c: "♣", d: "♦", s: "♠" };
const suitColors = { h: "#ff6666", c: "#2ecc71", d: "#2f80ed", s: "#cccccc" };
let currentBoard = { flop: [null, null, null], turn: null, river: null };
const slotElements = {
    flop1: document.getElementById("flopSlot1"),
    flop2: document.getElementById("flopSlot2"),
    flop3: document.getElementById("flopSlot3"),
    turn: document.getElementById("turnSlot"),
    river: document.getElementById("riverSlot")
};

// ========== МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ==========
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById("confirmModal");
    const msgSpan = document.getElementById("confirmMessage");
    const yesBtn = document.getElementById("confirmYes");
    const noBtn = document.getElementById("confirmNo");

    if (!modal) {
        console.error("Модальное окно не найдено в HTML");
        return;
    }

    msgSpan.textContent = message;
    modal.classList.add('active');

    function cleanup() {
        modal.classList.remove('active');
        yesBtn.removeEventListener("click", handleYes);
        noBtn.removeEventListener("click", handleNo);
    }

    function handleYes() {
        cleanup();
        onConfirm();
    }

    function handleNo() {
        cleanup();
    }

    yesBtn.addEventListener("click", handleYes);
    noBtn.addEventListener("click", handleNo);
}

// ... (анализ, карты и другие функции остаются без изменений, так как они не влияют на сохранение)

// ===== ЗАЛИВКА СКОЛЬЖЕНИЕМ =====
let painting = false;
let lastPaintedCell = null;
let blockUntilMap = new Map();
// ===== ПЛАВАЮЩЕЕ МОДАЛЬНОЕ ОКНО =====
function showFloatingModal(message, callback) {
    if (!message) {
        console.warn('⚠️ showFloatingModal: не передан текст сообщения');
        if (callback) callback();
        return;
    }

    const oldModal = document.querySelector('.save-confirm-overlay');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'save-confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'save-confirm-modal';
    modal.innerHTML = `
        <div class="save-confirm-header" id="modalHeader">
            <span>Сообщение</span>
        </div>
        <div class="save-confirm-body">
            <p>${message}</p>
        </div>
        <div class="save-confirm-actions" style="justify-content: center;">
            <button class="btn btn-confirm" id="floatingOkBtn">ОК</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ===== ПЕРЕТАСКИВАНИЕ =====
    const header = modal.querySelector('#modalHeader');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    function onDrag(e) {
        if (!isDragging) return;
        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, left));
        top = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, top));
        modal.style.left = left + 'px';
        modal.style.top = top + 'px';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    // ===== КНОПКА ОК =====
    modal.querySelector('#floatingOkBtn').onclick = () => {
        overlay.remove();
        if (callback) callback();
    };
}
function updateCellStyle(cell, pid) {
    if (pid === null) {
        cell.removeAttribute("style");
        return;
    }
    
    const profiles = getColorsForNode(currentNodeId);
    const prof = profiles.find(p => p.id === pid);
    if (!prof) {
        cell.removeAttribute("style");
        return;
    }
    
    // ✅ Правильно: используем существующую функцию
    let gradStyle = getGradientStyleFromColorForNode(currentNodeId, prof);
    if (gradStyle) {
        cell.setAttribute("style", gradStyle + "; color: #F0F0F0;");
    } else {
        cell.removeAttribute("style");
    }
}

function paintCell(row, col) {
    const activeProfile = getActiveForNode(currentNodeId);
    if (!currentNodeId || !activeProfile) return;
    const cell = document.querySelector(`#constructorGrid .hand-cell[data-row='${row}'][data-col='${col}']`);
    if (!cell) return;
    const currentPid = getCellProfile(currentNodeId, row, col);
    let newPid = (currentPid === activeProfile) ? null : activeProfile;
    setCellProfile(currentNodeId, row, col, newPid, false);
    updateCellStyle(cell, newPid);
    cell.justChanged = true;
    let cellKey = `${row}_${col}`;
    let newBlockUntil = Infinity;
    blockUntilMap.set(cellKey, newBlockUntil);
    cell.blockUntil = newBlockUntil;
	
	markUnsaved();
}

function handlePaintStart(e) {
    if (!document.getElementById("constructorPage").classList.contains("active-page")) return;
    const cell = e.target.closest('.hand-cell');
    if (!cell) return;
    e.preventDefault();
    painting = true;
    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    paintCell(row, col);
    lastPaintedCell = `${row},${col}`;
}

function handlePaintMove(e) {
    if (!painting) return;
    if (!document.getElementById("constructorPage").classList.contains("active-page")) {
        painting = false;
        return;
    }
    const cell = e.target.closest('.hand-cell');
    if (!cell) return;
    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    const key = `${row},${col}`;
    if (lastPaintedCell === key) return;
    paintCell(row, col);
    lastPaintedCell = key;
}

function handlePaintEnd() {
    painting = false;
    lastPaintedCell = null;
    if (currentNodeId) updateCurrentDisplay();
}

document.addEventListener('mousedown', handlePaintStart);
document.addEventListener('mousemove', handlePaintMove);
document.addEventListener('mouseup', handlePaintEnd);

// ===== ФЛАГ ИЗМЕНЕНИЙ =====
let hasUnsavedChanges = false;

function markUnsaved() {
    hasUnsavedChanges = true;
}

function clearUnsaved() {
    hasUnsavedChanges = false;
}

// ===== КНОПКА "СОХРАНИТЬ" =====
document.getElementById('tableSaveBtn')?.addEventListener('click', function() {
    if (!currentNodeId) {
        showFloatingModal('Нет активного диапазона для сохранения');
        return;
    }
    persistAll();
    clearUnsaved();
});

// ===== КНОПКА "ОТМЕНИТЬ" =====
document.getElementById('tableUndoBtn')?.addEventListener('click', function() {
    if (!currentNodeId) {
        showFloatingModal('Нет активного диапазона');
        return;
    }

    const node = nodes.find(n => n.id === currentNodeId);
    const message = node
        ? `Отменить все изменения в диапазоне <span style="color: #D4AF37; font-weight: 600;">${node.name}</span>?`
        : 'Отменить все изменения в текущем диапазоне?';

    showSaveConfirmModal(message, function() {
        // Да — отменяем
        loadFromStorage();
        refreshAll();
        updateCurrentDisplay();
        clearUnsaved();
    }, function() {
        // Нет — ничего не делаем
    });
});
// ===== КНОПКИ КОПИРОВАТЬ/ВСТАВИТЬ В ТУЛБАРЕ =====
document.getElementById('tableCopyBtn')?.addEventListener('click', function() {
    if (!currentNodeId) {
        showFloatingModal('Нет активного диапазона для копирования');
        return;
    }
    copyRange(currentNodeId);
    updatePasteButtonState();
});

document.getElementById('tablePasteBtn')?.addEventListener('click', function() {
    if (!currentNodeId) {
        showFloatingModal('Нет активного диапазона для вставки');
        return;
    }
    pasteRange(currentNodeId);
});

// ===== ПЕРЕКЛЮЧЕНИЕ ДИАПАЗОНА С ПРОВЕРКОЙ =====
const originalSelectNode = selectNode;

selectNode = function(nodeId) {
    if (hasUnsavedChanges) {
        const node = nodes.find(n => n.id === currentNodeId);
        const message = node
    ? `Диапазон <span style="color: #D4AF37; font-weight: 600;">${node.name}</span> был отредактирован. Сохранить изменения?`
    : 'Сохранить изменения?';

        showSaveConfirmModal(message, function() {
            // Да — сохраняем
            persistAll();
            clearUnsaved();
            originalSelectNode(nodeId);
        }, function() {
            // Нет — откатываем
            loadFromStorage();
            refreshAll();
            updateCurrentDisplay();
            clearUnsaved();
            originalSelectNode(nodeId);
        });
    } else {
        originalSelectNode(nodeId);
    }
};

// ===== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА =====
function refreshAll() {
    let isConstructor = document.getElementById("constructorPage").classList.contains("active-page");
    if (isConstructor) {
        renderTree("constructorTree", currentNodeId, true, selectNode);
        updateCurrentDisplay();
        renderPalette(currentNodeId, true);      // ← добавили nodeId
        renderAllProfiles(currentNodeId, true);  // ← добавили nodeId
        updateProfileButtonVisibility();
		renderComments(currentNodeId);
    } else {
        updateWorkDisplay();
        renderPalette(workDisplayNodeId, false);     // ← добавили nodeId
        renderAllProfiles(workDisplayNodeId, false); // ← добавили nodeId
    }
	 updatePasteButtonState();
}

function refreshAllGrids() {
    let isConstructor = document.getElementById("constructorPage").classList.contains("active-page");
    if (isConstructor && currentNodeId) {
        updateCurrentDisplay();
    } else if (!isConstructor && workDisplayNodeId) {
        updateWorkGrid();
    }
}
// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = function() {
        const page = this.getAttribute("data-page");

        // ===== ПРОВЕРКА ПРИ ПЕРЕКЛЮЧЕНИИ НА ПРОСМОТР =====
        if (page === "work" && hasUnsavedChanges) {
            const node = nodes.find(n => n.id === currentNodeId);
            const message = node
                ? `Диапазон <span style="color: #D4AF37; font-weight: 600;">${node.name}</span> был отредактирован. Сохранить изменения?`
                : 'Сохранить изменения?';

            showSaveConfirmModal(message, function() {
                // Да — сохраняем ТОЛЬКО данные диапазона
                saveRangeData();
                clearUnsaved();
                switchTab(page);
            }, function() {
                // Нет — откатываем
                loadFromStorage();
                refreshAll();
                updateCurrentDisplay();
                clearUnsaved();
                switchTab(page);
            });
            return;
        }

        switchTab(page);
    };
});

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ =====
function switchTab(page) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(`.tab-btn[data-page="${page}"]`).classList.add("active");

    document.getElementById("constructorPage").classList.toggle("active-page", page === "constructor");
    document.getElementById("workPage").classList.toggle("active-page", page === "work");

    if (page === "work") {
        if (!workDisplayNodeId) {
            const firstRange = nodes.find(n => n.type === 'range' || n.type === 'subrange');
            if (firstRange) {
                workDisplayNodeId = firstRange.id;
            }
        }
        updateWorkDisplay();
        updateWorkGrid();
        
        const commentsWrapper = document.getElementById('commentsWrapper');
        if (commentsWrapper) {
            commentsWrapper.style.display = 'block';
        }
        renderWorkComments(workDisplayNodeId);
    } else {
        const commentsWrapper = document.getElementById('commentsWrapper');
        if (commentsWrapper) {
            commentsWrapper.style.display = 'block';
        }
        renderComments(currentNodeId);
    }

    refreshAll();
    persistAll();
}

// ===== УПРАВЛЕНИЕ ВИДИМОСТЬЮ КНОПКИ "ДОБАВИТЬ ПРОФИЛЬ" =====
function updateProfileButtonVisibility() {
    const profileBtn = document.getElementById("newProfileBtn");
    if (!profileBtn) return;

    const colors = getColorsForNode(currentNodeId);
    const hasColors = colors.length > 0;

    profileBtn.style.display = hasColors ? '' : 'none';
}

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ ДЕРЕВА ==========

document.getElementById('treeAddFolderBtn')?.addEventListener('click', addRootNode);

document.getElementById('treeAddRangeBtn')?.addEventListener('click', () => {
    // Собираем имена всех корневых узлов
    const rootNodes = nodes.filter(n => n.parentId === null);
    const existingNames = rootNodes.map(n => n.name);
    const newName = generateUniqueName('Новый диапазон', existingNames);

    let newId = nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'range'
    };
    nodes.push(newNode);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
});

document.getElementById('treeRenameBtn')?.addEventListener('click', () => {
    if (currentNodeId) {
        const node = nodes.find(n => n.id === currentNodeId);
        if (node) {
            startInlineRename(currentNodeId);
        } else {
            showFloatingModal("Нет активного узла для переименования");
        }
    }
});

document.getElementById('treeMoveUpBtn')?.addEventListener('click', () => {
    if (currentNodeId) moveNodeUp(currentNodeId);
});

document.getElementById('treeMoveDownBtn')?.addEventListener('click', () => {
    if (currentNodeId) moveNodeDown(currentNodeId);
});

document.getElementById('treeDeleteBtn')?.addEventListener('click', () => {
    if (currentNodeId) deleteNode(currentNodeId);
});

document.getElementById('treeCollapseText')?.addEventListener('click', () => {
    expandedNodes.clear();
    refreshTreeOnly();
	persistAll();
});

// ===== КНОПКИ ДОБАВЛЕНИЯ ЦВЕТА И ПРОФИЛЯ =====

document.getElementById("addPaletteColorBtn").onclick = function() {
    addPaletteColor();
    refreshAll();
};

document.getElementById("newProfileBtn").onclick = function() {
    createNewProfile();
    refreshAll();
};

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ МАТРИЦЫ ==========

document.getElementById('tableClearBtn')?.addEventListener('click', () => {
    if (!currentNodeId) return;

    const node = nodes.find(n => n.id === currentNodeId);
    const message = node
        ? `Очистить всю таблицу диапазона <span style="color: #D4AF37; font-weight: 600;">${node.name}</span>?`
        : 'Очистить всю таблицу?';

showSaveConfirmModal(message, () => {
    const tid = getTableId(currentNodeId);
    if (cellStorage[tid]) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                cellStorage[tid][i][j] = null;
            }
        }
        markUnsaved();
        updateCurrentDisplay();
    }
}, null);
});

// ===== ГСЧ (Генератор случайных чисел) =====
const rngWidget = document.getElementById("rngNumber");
if (rngWidget) {
    rngWidget.textContent = Math.floor(Math.random() * 100) + 1;
    rngWidget.onclick = function() {
        this.textContent = Math.floor(Math.random() * 100) + 1;
    };
}
// ===== ЗАПУСК ПРИ ЗАГРУЗКЕ =====
(function tryRefresh() {
    if (typeof getProfiles === 'function' && typeof getColors === 'function') {
        const activeTab = loadFromStorage() || 'constructor';
        
        // ===== ЗАГРУЖАЕМ НАВИГАЦИЮ =====
        loadFromStorage();  // ← ДОБАВИТЬ!
        
        // Восстанавливаем активную вкладку
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-page') === activeTab);
        });
        document.getElementById("constructorPage").classList.toggle("active-page", activeTab === "constructor");
        document.getElementById("workPage").classList.toggle("active-page", activeTab === "work");
        
        // Если вкладка "Просмотр" — обновляем отображение
        if (activeTab === "work") {
            if (!workDisplayNodeId) {
                const firstRange = nodes.find(n => n.type === 'range' || n.type === 'subrange');
                if (firstRange) {
                    workDisplayNodeId = firstRange.id;
                }
            }
            updateWorkDisplay();
        }
        
        refreshAll();
		initComments();
    } else {
        console.warn('⏳ Ожидание загрузки color-manager.js...');
        setTimeout(tryRefresh, 200);
    }

})();