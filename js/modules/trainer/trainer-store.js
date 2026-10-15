// ===== trainer-store.js — узлы тренажёра: состояние и сохранение в БД =====
// Узел тренажёра — отдельная от дерева сущность: снапшот «объединённых
// данных» двух матриц (см. trainer-engine.buildTrainerSnapshot) + имя
// исходного диапазона на момент добавления. Каждое нажатие «Добавить в
// тренажёр» создаёт НОВЫЙ узел (дубликаты диапазона разрешены).
// Список хранится одним ключом poker_range_trainer_nodes (паттерн
// btn_styles_all из style-manager.js):
//   - добавление/удаление узла перезаписывает ключ;
//   - при удалении ПОСЛЕДНЕГО узла ключ удаляется из БД полностью
//     (App.storage.remove), а не сохраняется пустым — мусор в БД не копится;
//   - гость: App.storage.save/remove сами покажут «требуется
//     авторизация», состояние остаётся в памяти сессии.
//
// Активный узел (который подсвечен в левом дереве тренажёра) хранится
// отдельным ключом poker_range_trainer_active_node (строка — id узла).
// В тренажёре ВСЕГДА ровно один активный узел:
//   - при загрузке, если сохранённый id не найден в списке узлов,
//     активируется первый узел;
//   - при добавлении нового узла он автоматически становится активным;
//   - при удалении активного узла активным становится следующий
//     (или предыдущий, если удалён последний).

const STORAGE_KEY = 'poker_range_trainer_nodes';
const STORAGE_KEY_ACTIVE = 'poker_range_trainer_active_node';

// Состояние живёт вне DOM: массив узлов в порядке добавления.
let trainerNodes = [];
let activeNodeId = null;
let seq = 0;

function genId() {
    seq += 1;
    return 'trn_' + Date.now().toString(36) + '_' + seq;
}

// Нормализация записи (из БД или при создании): отбрасываем мусор,
// недостающие поля заполняем значениями по умолчанию.
function normalizeNode(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.name !== 'string' || !Array.isArray(raw.matrix)) return null;
    return {
        id: raw.id ? String(raw.id) : genId(),
        sourceNodeId: (raw.sourceNodeId !== undefined && raw.sourceNodeId !== null)
            ? Number(raw.sourceNodeId) : null,
        name: raw.name,
        colors: Array.isArray(raw.colors) ? raw.colors : [],
        matrix: raw.matrix,
        participation: Array.isArray(raw.participation) ? raw.participation : [],
        disabled: Array.isArray(raw.disabled) ? raw.disabled : [],
        createdAt: Number(raw.createdAt) || Date.now()
    };
}

// Загрузка узлов из БД (in-memory кэш storage + сервер). Возвращает список.
// Параллельно загружает активный узел и гарантирует, что он указывает
// на существующий узел (иначе — первый в списке, либо null если список пуст).
export function loadTrainerNodes() {
    return App.storage.preload([STORAGE_KEY, STORAGE_KEY_ACTIVE]).then(function() {
        // --- узлы ---
        const data = App.storage.load(STORAGE_KEY);
        const list = Array.isArray(data) ? data.map(normalizeNode).filter(Boolean) : [];
        trainerNodes = list;

        // --- активный узел ---
        const savedActive = App.storage.load(STORAGE_KEY_ACTIVE);
        if (savedActive && typeof savedActive === 'string') {
            const exists = trainerNodes.some(function(n) { return n.id === savedActive; });
            activeNodeId = exists ? savedActive : null;
        } else {
            activeNodeId = null;
        }
        // Гарантия «один всегда активен»
        if (!activeNodeId && trainerNodes.length > 0) {
            activeNodeId = trainerNodes[0].id;
            persistActiveNodeId();
        }

        return trainerNodes;
    }).catch(function(error) {
        console.warn('⚠️ trainer-store: не удалось загрузить узлы тренажёра:', error);
        return trainerNodes;
    });
}

// Сохранение списка в БД. Пустой список — удаление ключа целиком.
function persistNodes() {
    if (trainerNodes.length === 0) {
        return App.storage.remove(STORAGE_KEY);
    }
    return App.storage.save(STORAGE_KEY, trainerNodes);
}

// Сохранение активного узла в БД. null — удаление ключа.
function persistActiveNodeId() {
    if (activeNodeId === null) {
        return App.storage.remove(STORAGE_KEY_ACTIVE);
    }
    return App.storage.save(STORAGE_KEY_ACTIVE, activeNodeId);
}

export function getTrainerNodes() {
    return trainerNodes;
}

// ===== АКТИВНЫЙ УЗЕЛ =====

export function getActiveNodeId() {
    return activeNodeId;
}

export function setActiveNodeId(id) {
    const idStr = id !== null ? String(id) : null;
    if (idStr !== null) {
        // Проверяем, что узел существует
        const exists = trainerNodes.some(function(n) { return n.id === idStr; });
        if (!exists) return false;
    }
    if (activeNodeId === idStr) return true; // уже активен — no-op
    activeNodeId = idStr;
    persistActiveNodeId();
    return true;
}

// ===== ДОБАВЛЕНИЕ / УДАЛЕНИЕ УЗЛОВ =====

// Добавить узел (каждое добавление — новый узел).
// Новый узел автоматически становится активным. Возвращает созданный узел.
export function addTrainerNode(data) {
    const node = normalizeNode(Object.assign({}, data, {
        id: genId(),
        createdAt: Date.now()
    }));
    if (!node) return null;
    trainerNodes.push(node);
    persistNodes();
    // Новый узел сразу активен
    activeNodeId = node.id;
    persistActiveNodeId();
    return node;
}

// Удалить узел по id. true — узел был найден и удалён.
// Если удалённый узел был активным, активным становится соседний
// (следующий, либо предыдущий, если удалён последний) или null.
export function removeTrainerNode(id) {
    const idStr = String(id);
    const idx = trainerNodes.findIndex(function(n) { return n.id === idStr; });
    if (idx === -1) return false;
    trainerNodes.splice(idx, 1);
    persistNodes();
    // Корректировка активного узла
    if (activeNodeId === idStr) {
        if (trainerNodes.length === 0) {
            activeNodeId = null;
        } else {
            // Следующий, либо последний (если удалён был последний)
            const newIdx = idx < trainerNodes.length ? idx : trainerNodes.length - 1;
            activeNodeId = trainerNodes[newIdx].id;
        }
        persistActiveNodeId();
    }
    return true;
}