// ===== trainer-stats.js — статистика тренировки узла: счётчики + БД =====
// Накопительная статистика ответов по каждому узлу тренажёра:
//   всего рук (total), верных ответов (correct), ошибок (wrong).
// Всего рук = correct + wrong: прерванные раздачи (не нажат ответ) не считаются.
// Хранение — отдельным ключом poker_range_trainer_stats одним объектом
//   { [nodeId]: { total, correct, wrong, updatedAt } } — паттерн btn_styles_all
// (style-manager.js): статистика не должна перетирать список узлов
// (poker_range_trainer_nodes). Пустой объект — удаление ключа.
//
// ВАЖНО (ТЗ): во время тренировки ответы накапливаются ТОЛЬКО в памяти,
// в БД статистика пишется ОДНИМ запросом по кнопке «Закончить тренировку»
// (flushStats). Быстрые ответы не порождают запрос на каждый клик.
// Гостю статистика не сохраняется на сервер (как и в gto-loader.js: иначе
// App.storage.save показывал бы «требуется авторизация» на каждом ответе) —
// счётчики живут в памяти сессии.
// Удаление узла тренажёра вычищает его статистику (см. clearNodeStats).

const STORAGE_KEY = 'poker_range_trainer_stats';

// Состояние вне DOM: { [nodeId]: { total, correct, wrong, updatedAt } }
let statsByNodeId = {};
// Узлы с несохранёнными ответами (пишутся по «Закончить тренировку»).
let dirtyNodeIds = new Set();

function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        total: Number(raw.total) || 0,
        correct: Number(raw.correct) || 0,
        wrong: Number(raw.wrong) || 0,
        updatedAt: Number(raw.updatedAt) || 0
    };
}

function isPersistable() {
    return !!(App.auth && App.auth.isLoggedIn());
}

// ===== ЗАГРУЗКА / СОХРАНЕНИЕ =====

export function loadTrainerStats() {
    return App.storage.preload([STORAGE_KEY]).then(function() {
        const data = App.storage.load(STORAGE_KEY);
        const result = {};
        if (data && typeof data === 'object') {
            Object.keys(data).forEach(function(nodeId) {
                const entry = normalizeEntry(data[nodeId]);
                if (entry) result[nodeId] = entry;
            });
        }
        statsByNodeId = result;
        return statsByNodeId;
    }).catch(function(error) {
        console.warn('⚠️ trainer-stats: не удалось загрузить статистику:', error);
        return statsByNodeId;
    });
}

function persistStats() {
    // Один запрос пишет ВСЮ карту статистики — все накопленные узлы сразу.
    if (!isPersistable()) return Promise.resolve();
    dirtyNodeIds.clear();
    const ids = Object.keys(statsByNodeId);
    if (ids.length === 0) {
        return App.storage.remove(STORAGE_KEY);
    }
    return App.storage.save(STORAGE_KEY, statsByNodeId);
}

// Запись накопленной статистики в БД — по кнопке «Закончить тренировку».
// За время тренировки запросов в БД НЕТ; уходит ровно один здесь.
export function flushStats() {
    if (dirtyNodeIds.size === 0) return false;
    persistStats();
    return true;
}

// ===== СЧЁТЧИКИ =====

// Статистика узла (копия — снаружи состояние не мутируется).
export function getStats(nodeId) {
    const entry = nodeId ? statsByNodeId[nodeId] : null;
    return entry
        ? { total: entry.total, correct: entry.correct, wrong: entry.wrong }
        : { total: 0, correct: 0, wrong: 0 };
}

// Учесть один отвеченный разбор: correct — верный ответ был или нет.
// ТОЛЬКО память (см. шапку файла): запись в БД — по кнопке
// «Закончить тренировку» (flushStats), не на каждый ответ.
export function recordAnswer(nodeId, correct) {
    if (!nodeId) return getStats(nodeId);
    let entry = statsByNodeId[nodeId];
    if (!entry) {
        entry = { total: 0, correct: 0, wrong: 0, updatedAt: 0 };
        statsByNodeId[nodeId] = entry;
    }
    entry.total += 1;
    if (correct) entry.correct += 1;
    else entry.wrong += 1;
    entry.updatedAt = Date.now();
    dirtyNodeIds.add(nodeId);
    return { total: entry.total, correct: entry.correct, wrong: entry.wrong };
}

// Сброс статистики узла (пункт меню «Сбросить статистику», удаление узла).
// Явное действие пользователя — пишется в БД сразу (запросов мало).
export function resetStats(nodeId) {
    if (!nodeId || !statsByNodeId[nodeId]) return false;
    delete statsByNodeId[nodeId];
    dirtyNodeIds.delete(nodeId);
    persistStats();
    return true;
}

// Узел удалён из тренажёра — его статистика больше не нужна.
// (Вызывается из trainer-api.removeRange вместе с удалением узла.)

// Сбросить всё (смена аккаунта: состояние предыдущего пользователя не утекает).
export function resetAllStats() {
    statsByNodeId = {};
    dirtyNodeIds.clear();
}

// ===== РЕНДЕР БЛОКА СТАТИСТИКИ (справа от стола) =====
// Сверху вниз: всего рук → верных ответов → ошибок → шкала % верных ответов.
export function renderStats(container, nodeId) {
    if (!container) return;
    container.innerHTML = '';

    const stats = getStats(nodeId);
    const accuracy = stats.total > 0 ? (stats.correct / stats.total * 100) : 0;

    const rows = [
        { label: App.i18n.t('trainer.statsTotal'), value: stats.total, cls: 'total' },
        { label: App.i18n.t('trainer.statsCorrect'), value: stats.correct, cls: 'correct' },
        { label: App.i18n.t('trainer.statsWrong'), value: stats.wrong, cls: 'wrong' }
    ];
    rows.forEach(function(row) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'trainer-stats-row trainer-stats-row--' + row.cls;

        const labelSpan = document.createElement('span');
        labelSpan.className = 'trainer-stats-label';
        labelSpan.textContent = row.label;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'trainer-stats-value';
        valueSpan.textContent = row.value;

        rowDiv.appendChild(labelSpan);
        rowDiv.appendChild(valueSpan);
        container.appendChild(rowDiv);
    });

    // Шкала % верных ответов: цифра % по центру + прогресс-бар 0..100%.
    const scaleDiv = document.createElement('div');
    scaleDiv.className = 'trainer-stats-scale';

    const scaleLabel = document.createElement('div');
    scaleLabel.className = 'trainer-stats-scale-label';
    scaleLabel.textContent = accuracy.toFixed(1) + '%';

    const barTrack = document.createElement('div');
    barTrack.className = 'trainer-stats-scale-track';
    const barFill = document.createElement('div');
    barFill.className = 'trainer-stats-scale-fill';
    barFill.style.width = accuracy + '%';
    barTrack.appendChild(barFill);

    scaleDiv.appendChild(scaleLabel);
    scaleDiv.appendChild(barTrack);
    container.appendChild(scaleDiv);
}