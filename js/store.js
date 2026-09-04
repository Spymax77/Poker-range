// ============================================================
// STORE — ХРАНИЛИЩЕ СОСТОЯНИЯ (IIFE)
// ============================================================
(function() {
    // ===== ДАННЫЕ РЕДАКТОРА =====
    const editor = {
        nodes: [],
        nodeIndex: new Map(),
        nextNodeId: 1,
        currentNodeId: null,
        workLevels: [{ parentNodeId: null, levelIndex: 0 }],
        workDisplayNodeId: null,
        cellStorage: {},
        expandedNodes: new Set(),
        colorsPerNode: {},
        activePerNode: {},
        nextColorId: 1,
        profileRefs: new Map(),
        activePopup: null,
        commentsPerNode: {}
    };

    // ===== ДАННЫЕ GTO =====
    const gto = {
        nodes: [],
        nodeIndex: new Map(),
        nextNodeId: 1,
        currentNodeId: null,
        workLevels: [{ parentNodeId: null, levelIndex: 0 }],
        workDisplayNodeId: null,
        cellStorage: {},
        expandedNodes: new Set(),
        colorsPerNode: {},
        activePerNode: {},
        nextColorId: 1,
        profileRefs: new Map(),
        activePopup: null,
        commentsPerNode: {}
    };

    // ===== ОБЩИЕ UI-СОСТОЯНИЯ (не зависят от режима) =====
    const ui = {
        // ---- Drag & Drop (all.js) ----
        dragData: null,
        ghostElement: null,
        isDragging: false,
        startX: 0,
        startY: 0,
        expandTimeout: null,
        highlightedNode: null,

        // ---- Редактирование имени (all.js) ----
        renameInput: null,
        renameNodeId: null,
        renameOldName: '',

        // ---- Стили (all.js) ----
        stylePopup: null,
        activeButton: null,

        // ---- Копирование (all.js) ----
        clipboardRangeData: null,

        // ---- Флаги (all.js) ----
        hasUnsavedChanges: false,
        painting: false,
        lastPaintedCell: null,
        blockUntilMap: new Map(),

        // ---- Режим анализа конструктора (grid.js / navigation.js / init.js) ----
        analysisMode: false,

        // ---- Импорт (import-manager.js) ----
        importWindowInstance: null,
        selectedColorId: null,

        // ---- Пикер (ui-utils.js) ----
        editColorId: null,
        editCallback: null,
        currentColors: [
            '#9b5378', '#79a65a', '#e55656', '#db9713',
            '#4b9ce7', '#3d6b95', '#61489b', '#939521',
            '#d65b7a', '#4ca38c', '#c97b3a', '#6a7fb0'
        ],

        // ---- Активная вкладка (all.js) ----
        activeTab: 'constructor'
    };

    // ===== ТЕКУЩИЙ РЕЖИМ =====
    let currentMode = 'editor';

    // ===== PROXY: App.state автоматически направляет в нужную ветку =====
    const stateProxy = new Proxy({}, {
        get(target, prop) {
            if (prop in ui) return ui[prop];
            const branch = currentMode === 'editor' ? editor : gto;
            return branch[prop];
        },
        set(target, prop, value) {
            if (prop in ui) { ui[prop] = value; return true; }
            const branch = currentMode === 'editor' ? editor : gto;
            branch[prop] = value;
            return true;
        },
        has(target, prop) {
            return (prop in ui) || (prop in editor) || (prop in gto);
        },
        ownKeys(target) {
            const keys = new Set([...Object.keys(ui), ...Object.keys(editor), ...Object.keys(gto)]);
            return [...keys];
        },
        getOwnPropertyDescriptor(target, prop) {
            if (prop in ui) return { configurable: true, enumerable: true, value: ui[prop], writable: true };
            const branch = currentMode === 'editor' ? editor : gto;
            if (prop in branch) return { configurable: true, enumerable: true, value: branch[prop], writable: true };
            return undefined;
        }
    });

    // ===== EVENT BUS =====
    const events = {
        _handlers: {},
        on(event, fn) {
            if (!this._handlers[event]) this._handlers[event] = [];
            this._handlers[event].push(fn);
        },
        off(event, fn) {
            if (!this._handlers[event]) return;
            this._handlers[event] = this._handlers[event].filter(h => h !== fn);
        },
        emit(event, ...args) {
            if (!this._handlers[event]) return;
            for (const fn of this._handlers[event]) fn(...args);
        }
    };

    window.App = {
        state: stateProxy,
        events: events,
        get currentMode() { return currentMode; },
        set currentMode(v) { currentMode = v; },
        // Для прямого доступа к редактору (нужно для persistAll / loadFromStorage)
        editor: editor,
        gto: gto
    };
})();

// ============================================================
// NODE INDEX — быстрый доступ к узлам по id
// ============================================================

/**
 * Получить узел по id из текущей ветки (editor или gto).
 * O(1) вместо O(n).
 */
function getNode(id) {
    return App.state.nodeIndex.get(id) || null;
}

/**
 * Получить узел по id из конкретной ветки (editor/gto).
 */
function getNodeFrom(branch, id) {
    return branch.nodeIndex.get(id) || null;
}

/**
 * Пересобрать индекс из массива nodes.
 * Вызывать после loadFromStorage и массовых операций.
 */
function rebuildNodeIndex() {
    App.state.nodeIndex.clear();
    for (const node of App.state.nodes) {
        App.state.nodeIndex.set(node.id, node);
    }
}

/**
 * Пересобрать индекс для конкретной ветки.
 */
function rebuildNodeIndexFor(branch) {
    branch.nodeIndex.clear();
    for (const node of branch.nodes) {
        branch.nodeIndex.set(node.id, node);
    }
}

/**
 * Добавить узел в массив nodes И в индекс.
 */
function addNode(node) {
    App.state.nodes.push(node);
    App.state.nodeIndex.set(node.id, node);
}

/**
 * Удалить узел из массива nodes И из индекса по id.
 */
function removeNode(id) {
    App.state.nodeIndex.delete(id);
    const idx = App.state.nodes.findIndex(n => n.id === id);
    if (idx !== -1) App.state.nodes.splice(idx, 1);
}

// ============================================================
// КОНСТАНТЫ И УТИЛИТЫ (используются во всех модулях)
// ============================================================

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

/**
 * Экранирует HTML-спецсимволы в строке, чтобы её можно было безопасно
 * вставлять в innerHTML (защита от XSS через имена узлов/цветов).
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
