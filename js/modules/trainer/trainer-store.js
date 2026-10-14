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

const STORAGE_KEY = 'poker_range_trainer_nodes';

// Состояние живёт вне DOM: массив узлов в порядке добавления.
let trainerNodes = [];
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
export function loadTrainerNodes() {
    return App.storage.preload([STORAGE_KEY]).then(function() {
        const data = App.storage.load(STORAGE_KEY);
        const list = Array.isArray(data) ? data.map(normalizeNode).filter(Boolean) : [];
        trainerNodes = list;
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

export function getTrainerNodes() {
    return trainerNodes;
}

// Добавить узел (каждое добавление — новый узел). Возвращает созданный узел.
export function addTrainerNode(data) {
    const node = normalizeNode(Object.assign({}, data, {
        id: genId(),
        createdAt: Date.now()
    }));
    if (!node) return null;
    trainerNodes.push(node);
    persistNodes();
    return node;
}

// Удалить узел по id. true — узел был найден и удалён.
export function removeTrainerNode(id) {
    const idStr = String(id);
    const idx = trainerNodes.findIndex(function(n) { return n.id === idStr; });
    if (idx === -1) return false;
    trainerNodes.splice(idx, 1);
    persistNodes();
    return true;
}