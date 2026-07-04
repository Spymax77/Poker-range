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

// ===== ГЛАВНЫЙ ОБЪЕКТ ДАННЫХ =====
let appData = {
    nodes: [],
    nextNodeId: 1,
    currentNodeId: null,
    cellStorage: {},
    expandedNodes: [],
    workLevels: [{ parentNodeId: null, levelIndex: 0 }],
    workDisplayNodeId: null,
    colorsPerNode: {},
    profilesPerNode: {},
    activeColorPerNode: {},
    activeProfilePerNode: {},
    nextColorId: 1,
    nextProfileId: 1,
    activeTab: 'constructor'  // ← ДОБАВИТЬ ЭТУ СТРОКУ
};
// ===== DRAG & DROP: ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let dragData = null;
let ghostElement = null;
let isDragging = false;
let startX = 0;
let startY = 0;
let expandTimeout = null;
let highlightedNode = null;


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
    let counter = 1;
    while (existingNames.includes(`${baseName} ${counter}`)) {
        counter++;
    }
    return `${baseName} ${counter}`;
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
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            if (cellStorage[tid][i][j] !== null) {
                let hand = rowsData[i][j];
                if (hand.includes('s')) total += 4;
                else if (hand.includes('o')) total += 12;
                else if (hand[0] === hand[1]) total += 6;
            }
        }
    }
    return total;
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
    appData.profilesPerNode = profilesPerNode;
    appData.activeColorPerNode = activeColorPerNode;
    appData.activeProfilePerNode = activeProfilePerNode;
    appData.nextColorId = nextColorId;
    appData.nextProfileId = nextProfileId;
    
    // Сохраняем активную вкладку
    const activeBtn = document.querySelector('.tab-btn.active');
    appData.activeTab = activeBtn ? activeBtn.getAttribute('data-page') : 'constructor';

    localStorage.setItem("poker_range_tree_v6", JSON.stringify(appData));
}

// ===== LOAD FROM STORAGE =====
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
            profilesPerNode = d.profilesPerNode || {};
            activeColorPerNode = d.activeColorPerNode || {};
            activeProfilePerNode = d.activeProfilePerNode || {};
            nextColorId = d.nextColorId || 1;
            nextProfileId = d.nextProfileId || 1;
            
            // Загружаем активную вкладку
            const activeTab = d.activeTab || 'constructor';

            if (nodes.length === 0) {
                resetToCleanData();
            }
            return activeTab;  // ← возвращаем активную вкладку
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
    profilesPerNode = {};
    activeColorPerNode = {};
    activeProfilePerNode = {};
    nextColorId = 1;
    nextProfileId = 1;

    let rootId = nextNodeId++;
    nodes.push({
        id: rootId,
        name: "Мои диапазоны",
        parentId: null,
        childrenIds: [],
        type: 'folder'
    });
    ensureTable(rootId);

    let rangeId = nextNodeId++;
    nodes.push({
        id: rangeId,
        name: "Новый диапазон",
        parentId: rootId,
        childrenIds: [],
        type: 'range'
    });
    nodes.find(n => n.id === rootId).childrenIds.push(rangeId);
    ensureTable(rangeId);

    currentNodeId = rangeId;
    workDisplayNodeId = rangeId;
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
    // Проверяем, есть ли в дереве другие диапазоны (кроме удаляемого)
const allRanges = nodes.filter(n => n.type === 'range' || n.type === 'subrange');
if (allRanges.length <= 1 && (node.type === 'range' || node.type === 'subrange')) {
    showFloatingModal("Нельзя удалить единственный диапазон");
    return;
}

    function delSub(id) {
        let n = nodes.find(nn => nn.id === id);
        if (!n) return;
        for (let cid of n.childrenIds) {
            delSub(cid);
        }
        nodes = nodes.filter(nn => nn.id !== id);
        delete cellStorage[getTableId(id)];
        let p = nodes.find(p => p.id === n.parentId);
        if (p) {
            p.childrenIds = p.childrenIds.filter(cid => cid !== id);
        }
    }

    delSub(nodeId);

if (currentNodeId === nodeId) {
    let foundRange = null;

    // 1. Ищем в той же папке
    const sameFolderRanges = nodes.filter(n => 
        (n.type === 'range' || n.type === 'subrange') && 
        n.parentId === node.parentId && 
        n.id !== nodeId
    );
    if (sameFolderRanges.length > 0) {
        foundRange = sameFolderRanges[0];
    }

    // 2. Если не нашли в папке — ищем сверху вниз, начиная с корня
    if (!foundRange) {
        // Сначала ищем в корне (parentId === null)
        const rootRanges = nodes.filter(n => 
            (n.type === 'range' || n.type === 'subrange') && 
            n.parentId === null && 
            n.id !== nodeId
        );
        if (rootRanges.length > 0) {
            foundRange = rootRanges[0];
        }
    }

    // 3. Если и в корне нет — обходим все папки сверху вниз
    if (!foundRange) {
        // Получаем все папки, отсортированные по порядку
        const folders = nodes.filter(n => n.type === 'folder');
        // Сортируем папки по порядку (сначала корневые)
        folders.sort((a, b) => {
            if (a.parentId === null && b.parentId !== null) return -1;
            if (a.parentId !== null && b.parentId === null) return 1;
            return 0;
        });

        for (const folder of folders) {
            const rangeInFolder = nodes.find(n => 
                (n.type === 'range' || n.type === 'subrange') && 
                n.parentId === folder.id && 
                n.id !== nodeId
            );
            if (rangeInFolder) {
                foundRange = rangeInFolder;
                break;
            }
        }
    }

    // Если нашли — делаем активным
    if (foundRange) {
        selectNode(foundRange.id);
    } else {
        currentNodeId = null;
    }
}

workLevels = workLevels.filter(lvl => lvl.parentNodeId !== nodeId);
if (workDisplayNodeId === nodeId) {
    // Используем ту же логику, что и для редактора
    let foundRange = null;

    // 1. Ищем в той же папке
    const sameFolderRanges = nodes.filter(n => 
        (n.type === 'range' || n.type === 'subrange') && 
        n.parentId === node.parentId
    );
    if (sameFolderRanges.length > 0) {
        foundRange = sameFolderRanges[0];
    }

    // 2. Если не нашли в папке — ищем в корне
    if (!foundRange) {
        const rootRanges = nodes.filter(n => 
            (n.type === 'range' || n.type === 'subrange') && 
            n.parentId === null
        );
        if (rootRanges.length > 0) {
            foundRange = rootRanges[0];
        }
    }

    // 3. Если и в корне нет — обходим все папки сверху вниз
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
    saveActiveNode();
}

if (!workLevels.length) {
    workLevels = [{ parentNodeId: null, levelIndex: 0 }];
}
persistAll();
refreshAll();
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
    
    // Базовое имя в зависимости от типа
    let baseName;
    if (type === 'folder') {
        baseName = 'Папка';
    } else if (type === 'range') {
        baseName = 'Диапазон';
    } else if (type === 'subrange') {
        baseName = 'Поддиапазон';
    }
    
    const newName = generateUniqueName(baseName, existingNames);

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
	 saveActiveNode();

    if (node && node.parentId !== null) {
        expandedNodes.add(node.parentId);
    }

    updateCurrentDisplay();
	refreshAll();
    if (document.getElementById("workPage").classList.contains("active-page")) {
        updateWorkDisplay();
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

if (hasChildren) {
    arrow.textContent = isOpen ? "▼" : "▶";
    arrow.style.cursor = "pointer";
    arrow.style.opacity = "1";
    
    arrow.onclick = (e) => {
        e.stopPropagation();
        expandedNodes.has(node.id) ? expandedNodes.delete(node.id) : expandedNodes.add(node.id);
        refreshTreeOnly();
		saveActiveNode(); 
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
    } else if (node.type === 'subrange') {
        iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24">
            <rect x="3" y="3" width="8" height="8" rx="1"/>
            <rect x="13.5" y="3.5" width="7" height="7" rx="1" fill="none" stroke="var(--text-primary)" stroke-width="1"/>
            <rect x="3.5" y="13.5" width="7" height="7" rx="1" fill="none" stroke="var(--text-primary)" stroke-width="1"/>
            <rect x="13" y="13" width="8" height="8" rx="1"/>
        </svg>`;
    }
    iconSpan.innerHTML = iconSvg;
    nameSpan.prepend(iconSpan);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "tree-actions-popup";
    if (editable) {
        const menuBtn = document.createElement("button");
        menuBtn.textContent = "⋮";
        menuBtn.className = "tree-menu-btn";
        menuBtn.style.fontSize = "20px";

        const popupMenu = document.createElement("div");
        popupMenu.className = "popup-menu";
        popupMenu.style.display = "none";

        if (node.type === 'folder') {
            const addFolderBtn = document.createElement("button");
            addFolderBtn.textContent = "+ Добавить папку";
            addFolderBtn.onclick = (e) => {
                e.stopPropagation();
                createChildNode(node.id, 'folder');
                closeMenu();
            };
            popupMenu.appendChild(addFolderBtn);

            const addRangeBtn = document.createElement("button");
            addRangeBtn.textContent = "+ Добавить диапазон";
            addRangeBtn.onclick = (e) => {
                e.stopPropagation();
                createChildNode(node.id, 'range');
                closeMenu();
            };
            popupMenu.appendChild(addRangeBtn);
        } else if (node.type === 'range') {
            const addFolderBtn = document.createElement("button");
            addFolderBtn.textContent = "+ Добавить папку";
            addFolderBtn.onclick = (e) => {
                e.stopPropagation();
                createChildNode(node.id, 'folder');
                closeMenu();
            };
            popupMenu.appendChild(addFolderBtn);

            const addSubrangeBtn = document.createElement("button");
            addSubrangeBtn.textContent = "+ Добавить поддиапазон";
            addSubrangeBtn.onclick = (e) => {
                e.stopPropagation();
                createChildNode(node.id, 'subrange');
                closeMenu();
            };
            popupMenu.appendChild(addSubrangeBtn);
        }

        const renameBtn = document.createElement("button");
        renameBtn.textContent = "Переименовать";
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            startInlineRename(node.id);
            closeMenu();
        };
        popupMenu.appendChild(renameBtn);

        const upBtn = document.createElement("button");
        upBtn.textContent = "↑ Вверх";
        upBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            moveNodeUp(node.id);
            closeMenu();
        };
        popupMenu.appendChild(upBtn);

        const downBtn = document.createElement("button");
        downBtn.textContent = "↓ Вниз";
        downBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            moveNodeDown(node.id);
            closeMenu();
        };
        popupMenu.appendChild(downBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Удалить";
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
            document.removeEventListener('click', outsideClick);
        }

        function outsideClick(e) {
            if (!actionsDiv.contains(e.target)) closeMenu();
        }

        menuBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpenMenu = popupMenu.style.display === "block";
            closeMenu();
            if (!isOpenMenu) {
                popupMenu.style.display = "block";
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
                    btn.className = "folder-btn";
                    btn.innerText = child.name;
                    btn.onclick = (function(c, idx) {
                        return function() {
                            workLevels = workLevels.slice(0, idx + 1);
                            workLevels.push({ parentNodeId: c.id, levelIndex: idx + 1 });
                            persistAll();
                            updateWorkDisplay();
                        };
                    })(child, li);

                    const lastLevel = workLevels[workLevels.length - 1];
                    const isActiveFolder = lastLevel && lastLevel.parentNodeId === child.id;
                    if (isActiveFolder) {
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

                if (isRoot || !parentIsSelectedRange) {
                    const link = document.createElement("span");
                    link.className = "range-link";
                    link.innerText = child.name;
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
							saveActiveNode();
                            persistAll();
                            updateWorkDisplay();
                            updateWorkGrid();
                        };
                    })(child);
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
                                    subBtn.className = "folder-btn";
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
                                    subLink.className = "range-link";
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
    
    // Сохраняем старый currentNodeId
    const oldCurrentNodeId = currentNodeId;
    
    // Временно подменяем для отрисовки
    currentNodeId = workDisplayNodeId;
    
    let total = countTotalCombos(workDisplayNodeId);
    let percent = (total / 1326 * 100).toFixed(1);
    document.getElementById("workStats").innerHTML = `${percent}% (${total}/1326)`;
    renderGrid("workGrid", workDisplayNodeId, null);
    
    // Возвращаем старый currentNodeId
    currentNodeId = oldCurrentNodeId;
}

function updateWorkDisplay() {
    renderWorkNavigation();
    if (workDisplayNodeId) {
        updateWorkGrid();
        let rangeNode = nodes.find(n => n.id === workDisplayNodeId);
        let titleEl = document.getElementById("workRangeName");
        if (titleEl && rangeNode) {
            titleEl.textContent = rangeNode.name;
        }
    }
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

    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const hand = rowsData[i][j];
            const pid = matrix[i][j];
            const prof = getProfiles().find(p => p.id === pid);
            const cell = document.createElement("div");
            cell.className = "hand-cell";
            cell.setAttribute("data-row", i);
            cell.setAttribute("data-col", j);
            cell.justChanged = false;
            let cellKey = `${i}_${j}`;
            cell.blockUntil = blockUntilMap.get(cellKey) || 0;

            // Проверяем, является ли текущий узел поддиапазоном
            let isSubrange = false;
            let parentRange = null;
            const currentNode = nodes.find(n => n.id === nodeId);
            if (currentNode) {
                isSubrange = currentNode.type === 'subrange';
                if (isSubrange) {
                    parentRange = getParentRange(nodeId);
                }
            }

            let hasParentProfile = false;
            if (isSubrange && pid === null && parentRange) {
                let parentPid = getCellProfile(parentRange.id, i, j);
                if (parentPid !== null) {
                    hasParentProfile = true;
                }
            }

            let isColored = false;
            let originalGradient = null;
            let originalBg = null;
            let originalColor = null;
            let justCleared = false;

            if (prof && prof.colorIds && prof.colorIds.length) {
                let pos = getPositions(prof);
                originalGradient = getGradientStyleFromProfile(prof) + "; color: #FFFFFF;";
                cell.setAttribute("style", originalGradient);
                isColored = true;
            } else {
                originalBg = "var(--bg-card)";
                if (hasParentProfile) {
                    cell.classList.add('has-parent-profile');
                }
            }

           cell.onmouseenter = () => {
    if (Date.now() < cell.blockUntil) {
        return;
    }
    if (containerId === "constructorGrid" && !painting && !cell.justChanged) {
        const activeProfileId = getActiveProfile();
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
            const activeProf = getProfiles().find(p => p.id === activeProfileId);
            if (activeProf && activeProf.colorIds && activeProf.colorIds.length) {
                let gradStyle = getGradientStyleFromProfile(activeProf);
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
                            if (hasParentProfile) {
                                cell.classList.add('has-parent-profile');
                            }
                        }
                        cell.justChanged = false;
                        let cellKey = `${i}_${j}`;
                        blockUntilMap.set(cellKey, 0);
                        cell.blockUntil = 0;
                    });
                }
            };

            cell.innerText = hand;
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
    const childContainer = document.getElementById("constructorChildButtons");
    if (childContainer) childContainer.innerHTML = "";
    let node = nodes.find(n => n.id === currentNodeId);
    if (node && childContainer) {
        let childrenNodes = node.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
        for (let child of childrenNodes) {
            let btn = document.createElement("button");
            btn.className = "btn-oval";
            btn.innerText = child.name;
            btn.onclick = () => selectNode(child.id);
            childContainer.appendChild(btn);
        }
    }
    const backBtn = document.getElementById("backButton");
    if (node && node.parentId !== null && backBtn) {
        let parentNode = nodes.find(n => n.id === node.parentId);
        if (parentNode) {
            backBtn.style.display = "flex";
            backBtn.onclick = () => selectNode(parentNode.id);
            backBtn.innerText = `← ${parentNode.name}`;
        } else backBtn.style.display = "none";
    } else if (backBtn) {
        backBtn.style.display = "none";
    }
    renderGrid("constructorGrid", currentNodeId, null);

    let statsContainer = document.getElementById("profileStats");
    if (!statsContainer) {
        statsContainer = document.createElement("div");
        statsContainer.id = "profileStats";
        statsContainer.style.marginTop = "10px";
        statsContainer.style.fontSize = "13px";
        statsContainer.style.lineHeight = "1.8";
        statsContainer.style.display = "flex";
        statsContainer.style.justifyContent = "flex-end";
        const tablePanel = document.querySelector(".table-panel");
        if (tablePanel) tablePanel.appendChild(statsContainer);
    }

    const colorStats = {};
    let totalCombosWeighted = 0;
    const matrix = cellStorage[getTableId(currentNodeId)];
    if (matrix) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                const pid = matrix[i][j];
                if (pid === null) continue;
                const prof = getProfiles().find(p => p.id === pid);
                if (!prof) continue;

                const hand = rowsData[i][j];
                let handTotalCombos = 0;
                if (hand.includes('s')) handTotalCombos = 4;
                else if (hand.includes('o')) handTotalCombos = 12;
                else if (hand[0] === hand[1]) handTotalCombos = 6;

                const positions = getPositions(prof);
                let prev = 0;
                for (let k = 0; k < prof.colorIds.length; k++) {
                    const share = (positions[k] - prev) / 100;
                    const combosShare = Math.round((handTotalCombos * share) * 10) / 10;
                    totalCombosWeighted += combosShare;

                    const colorsList = getColors();
                    let colorObj = colorsList.find(c => c.id === prof.colorIds[k]);
                    let color = colorObj ? colorObj.color : '#3d3d3d';
                    const colorKey = `color_${prof.colorIds[k]}`;
                    if (!colorStats[colorKey]) {
                        colorStats[colorKey] = { combos: 0, color: color };
                    }
                    colorStats[colorKey].combos += combosShare;
                    prev = positions[k];
                }
            }
        }
    }

    if (statsContainer && totalCombosWeighted > 0) {
        let html = `<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end;">`;
        let colorRows = [];
        let totalPercentSum = 0;
        let totalCombosSum = 0;

        // Сортируем цвета по убыванию комбинаций
const sortedEntries = Object.entries(colorStats).sort((a, b) => b[1].combos - a[1].combos);

for (const [key, data] of sortedEntries) {
    const percent = (data.combos / 1326 * 100).toFixed(2);
    totalPercentSum += parseFloat(percent);
    totalCombosSum += data.combos;
    colorRows.push(`<div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
                        <span style="display: inline-block; width: 20px; height: 10px; background: ${data.color}; border-radius: 3px;"></span>
                        <span>${percent}% (${formatCombos(data.combos)}/1326)</span>
                     </div>`);
}

        html += `<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; justify-content: flex-end;">
                    <span>${totalPercentSum.toFixed(2)}% (${formatCombos(totalCombosSum)}/1326)</span>
                 </div>`;

        html += colorRows.join('');
        html += `</div>`;
        statsContainer.innerHTML = html;
    } else if (statsContainer) {
        statsContainer.innerHTML = `<div style="color: var(--text-muted);">Нет установленных диапазонов</div>`;
    }
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
    const nodeId = currentNodeId;
    if (!nodeId || !profileId) return;
    
    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    const colorsList = getColors();
    if (!colorsList || colorsList.length === 0) return;
    
    let html = `<div class="tooltip-hand">${hand}</div>`;
    html += `<hr class="tooltip-divider">`;
    
    const positions = getPositions(profile);
    let prev = 0;
    
    for (let i = 0; i < profile.colorIds.length; i++) {
        const colorId = profile.colorIds[i];
        const colorObj = colorsList.find(c => c.id === colorId);
        if (!colorObj) continue;
        
        const percent = positions[i] - prev;
        prev = positions[i];
        
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
    
    // ✅ СНАЧАЛА позиционируем (тултип ещё невидим)
    positionTooltip(event, tooltip);
    
    // ✅ ПОТОМ добавляем класс для анимации
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
                console.log('✅ Показываем окно подтверждения');
                showMoveConfirm(dragData.nodeId, targetId);
            } else {
                console.log('❌ canDrop вернул false');
            }
        } else {
            console.log('❌ targetId не подходит:', targetId);
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
// ===== СОХРАНЕНИЕ ТОЛЬКО ДАННЫХ ДИАПАЗОНА (МАТРИЦА, ЦВЕТА, ПРОФИЛИ) =====
function saveRangeData() {
    if (!currentNodeId) return;

    const nodeId = getTableId(currentNodeId);
    const data = {
        matrix: cellStorage[nodeId] || null,
        colors: colorsPerNode[nodeId] || [],
        profiles: profilesPerNode[nodeId] || [],
        activeColor: activeColorPerNode[nodeId] || null,
        activeProfile: activeProfilePerNode[nodeId] || null
    };

    localStorage.setItem("poker_range_data_" + nodeId, JSON.stringify(data));
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
    const prof = getProfiles().find(p => p.id === pid);
    if (prof && prof.colorIds && prof.colorIds.length) {
        let pos = getPositions(prof);
        const gradStyle = getGradientStyleFromProfile(prof);
        cell.setAttribute("style", gradStyle + "; color: #F0F0F0;");
    } else {
        cell.removeAttribute("style");
    }
}

function paintCell(row, col) {
    const activeProfile = getActiveProfile();
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
        renderPalette(true);
        renderAllProfiles(true);
        updateProfileButtonVisibility();
    } else {
        updateWorkDisplay();
        renderPalette(false);
        renderAllProfiles(false);
    }
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
    btn.onclick = () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        let page = btn.getAttribute("data-page");
        document.getElementById("constructorPage").classList.toggle("active-page", page === "constructor");
        document.getElementById("workPage").classList.toggle("active-page", page === "work");
        
        // Если переключаемся на просмотр
        if (page === "work") {
    if (!workDisplayNodeId) {
        const firstRange = nodes.find(n => n.type === 'range' || n.type === 'subrange');
        if (firstRange) {
            workDisplayNodeId = firstRange.id;
        }
    }
    updateWorkDisplay();
    updateWorkGrid();  // ← ДОБАВИТЬ!
}
        
        refreshAll();
        persistAll();
    };
});

// ===== УПРАВЛЕНИЕ ВИДИМОСТЬЮ КНОПКИ "ДОБАВИТЬ ПРОФИЛЬ" =====
function updateProfileButtonVisibility() {
    // ... остальной код ...
}
// ===== УПРАВЛЕНИЕ ВИДИМОСТЬЮ КНОПКИ "ДОБАВИТЬ ПРОФИЛЬ" =====
function updateProfileButtonVisibility() {
    const profileBtn = document.getElementById("newProfileBtn");
    if (!profileBtn) return;

    const colors = getColors();
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

document.getElementById('treeCollapseAllBtn')?.addEventListener('click', () => {
    expandedNodes.clear();
    refreshTreeOnly();
	saveActiveNode();
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
// ===== СОХРАНЕНИЕ ТОЛЬКО НАВИГАЦИИ =====
function saveActiveNode() {
    const data = {
        currentNodeId: currentNodeId,
        workDisplayNodeId: workDisplayNodeId,
        expandedNodes: Array.from(expandedNodes)
    };
    localStorage.setItem("poker_range_active_node", JSON.stringify(data));
}
// ===== ЗАГРУЗКА ТОЛЬКО НАВИГАЦИИ =====
function loadActiveNode() {
    const raw = localStorage.getItem("poker_range_active_node");
    if (raw) {
        try {
            const d = JSON.parse(raw);
            if (d.currentNodeId !== undefined) currentNodeId = d.currentNodeId;
            if (d.workDisplayNodeId !== undefined) workDisplayNodeId = d.workDisplayNodeId;
            if (d.expandedNodes) expandedNodes = new Set(d.expandedNodes);
        } catch(e) {
            console.warn('Ошибка загрузки навигации:', e);
        }
    }
}
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
        loadActiveNode();  // ← ДОБАВИТЬ!
        
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
    } else {
        console.warn('⏳ Ожидание загрузки color-manager.js...');
        setTimeout(tryRefresh, 200);
    }
})();