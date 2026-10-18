// ===== trainer-engine.js — отражение основной матрицы для тренировки =====
// Вторая матрица в тренировке — не отдельная сущность, а отражение основной
// матрицы текущего диапазона. Логика «правильных» и «неправильных» ячеек
// удалена полностью. Слой данных отражения — участие руки в тренировке:
// он ВСЕГДА генерируется динамически при каждом обращении (переключение
// диапазона, перерисовка пары) и нигде не сохраняется (как хранить и где —
// отдельная будущая задача):
//   - закрашенная в основной матрице в любой пропорции ячейка участвует
//     по умолчанию;
//   - пустая ячейка участвует, если соседствует с закрашенной (4 соседа:
//     вправо-влево, вверх-вниз, по диагонали — не соседи), либо это пара
//     (AA..22), либо одномастный туз (AKs..A2s) — пары и тузы участвуют
//     всегда, даже пустыми и вдали от закрашенных;
//   - недоступная ячейка не участвует и кликам не подлежит;
//   - клик-тоглы поверх участи по умолчанию живут только до переключения
//     диапазона (см. trainer-ui).
// Цветовые профили основной матрицы в ячейки отражения НЕ переносятся.
// Отражение — только визуальный слой участия; для переноса диапазона в
// тренажёр есть отдельный снимок данных — buildTrainerSnapshot ниже.

const GRID_SIZE = 13;

// Слой данных отражения: GRID_SIZE × GRID_SIZE объектов вида
//   { disabled, participates, availability },
// где disabled — ячейка действительно недоступна (доступность 0%, как
// .hand-cell.subrange-disabled в основной матрице: grid-renderer.js),
// participates — рука участвует в тренировке по умолчанию: закрашена в
// основной матрице в любой пропорции, либо пустая рядом с закрашенной
// (4 соседа: вправо-влево, вверх-вниз), либо пара (AA..22), либо одномастный туз (AKs..A2s) —
// и не недоступна,
// availability — процент доступности ячейки 0..100 (каскадно, recursive
// = true): готовые данные под будущий оверлей частичной доступности
// (перекрывающий блок .cell-overlay, grid-renderer.js) — см. комментарий
// в buildTrainerSnapshot. Значения строятся на каждый вызов, состояние
// не хранится.
export function buildTrainingMatrix(nodeId) {
    const matrix = nodeId ? App.editor.cellStorage[App.grid.getTableId(nodeId)] : null;
    const node = nodeId ? App.nodes.getNode(nodeId) : null;
    const isSubrange = !!node && node.type === 'subrange';

    // Маска закрашенности (профиль назначен в любой пропорции) — считается
    // один раз на всю матрицу: нужна и для признака «закрашена», и для поиска
    // пустых соседей закрашенных ячеек (правило участия ниже).
    const painted = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        const pRow = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            pRow.push(!!matrix && matrix[r][c] !== null && matrix[r][c] !== undefined);
        }
        painted.push(pRow);
    }

    // Соседство с закрашенной: 4 направления (вправо-влево, вверх-вниз) с
    // проверкой границ матрицы. По диагонали — не соседи.
    function hasPaintedNeighbor(r, c) {
        const around = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let i = 0; i < around.length; i++) {
            const nr = r + around[i][0];
            const nc = c + around[i][1];
            if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
            if (painted[nr][nc]) return true;
        }
        return false;
    }

    const result = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        const row = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            // Недоступность раскрывается только в поддиапазонах: там её задаёт
            // цепочка родителей (каскадно, recursive = true). Частично
            // доступная ячейка — доступна (оверлей в основной матрице это
            // просто перекрывающий блок), поэтому порог строго 0%.
            const availability = isSubrange
                ? App.stats.getCellAvailabilityPercent(nodeId, r, c, true, App.editor)
                : 100;
            const disabled = availability <= 0;
            // Участие по умолчанию — объединение правил:
            //   - закрашена в любой пропорции (профиль назначен) — как раньше;
            //   - пустая, но соседствует с закрашенной (4 соседа) — «край»
            //     диапазона вокруг закрашенных ячеек;
            //   - все пары (диагональ r === c: AA..22) и все одномастные тузы
            //     (строка 0, столбцы 1–12: AKs..A2s) — участвуют всегда, даже
            //     пустыми и вдали от закрашенных.
            // Недоступная ячейка не участвует никогда: правило пар/тузов/соседей
            // попадает и на disabled-ячейки, маска !disabled держит инвариант
            // «disabled ⇒ не участвует» (тоглами такие ячейки тоже не
            // выделяются — см. trainer-ui).
            const isPair = r === c;
            const isSuitedAce = r === 0 && c > 0;
            const participates = (painted[r][c] || hasPaintedNeighbor(r, c) || isPair || isSuitedAce)
                && !disabled;
            row.push({
                disabled: disabled,
                participates: participates,
                availability: availability
            });
        }
        result.push(row);
    }
    return result;
}

// ===== СНАПШОТ ДАННЫХ ДЛЯ УЗЛА ТРЕНАЖЁРА =====
// Объединяет данные ОБЕИХ матриц текущего диапазона в один снимок:
//   - данные ПЕРВОЙ (основной) матрицы: закраска ячеек (matrix 13×13,
//     значения — id цвета / null), названия и профили цветов (colors),
//   - данные ВТОРОЙ матрицы («Диапазон на тренировке»): какие ячейки
//     участвуют в тренировке (participation 13×13, с учётом клик-тоглов
//     из trainer-ui), а какие недоступны (disabled 13×13) и процент
//     доступности каждой ячейки (availability 13×13, 0..100).
//
// ПОЛЕ AVAILABILITY — ГОТОВЫЕ ДАННЫЕ ПОД БУДУЩИЙ ОВЕРЛЕЙ частичной
// доступности (перекрывающий блок .cell-overlay в grid-renderer.js:
// недоступная часть ячейки закрывается серым блоком). Данные сохраняем
// в узел СРАЗУ, чтобы при реализации оверлея они уже были на месте;
// сам оверлей в матрицах тренажёра пока НЕ рисуется.
// Снимок замораживается на момент вызова: дальнейшие правки диапазона
// на него не влияют. Всё копируется глубоко — снимок не разделяет
// ссылки с живым состоянием редактора.
export function buildTrainerSnapshot(nodeId, toggles) {
    const tableId = App.grid.getTableId(nodeId);
    const matrix = App.editor.cellStorage[tableId];
    const colors = App.editor.colorsPerNode[tableId] || [];
    const reflection = buildTrainingMatrix(nodeId);

    // Копия матрицы закраски 13×13 (id цвета / null).
    const matrixCopy = [];
    // Участие и недоступность — из второй матрицы (с тоглами поверх).
    const participation = [];
    const disabled = [];
    // Процент доступности — под будущий оверлей (см. комментарий выше).
    const availability = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        const mRow = [];
        const pRow = [];
        const dRow = [];
        const aRow = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            mRow.push(matrix ? matrix[r][c] : null);
            const cell = reflection[r][c];
            const key = r + '_' + c;
            // Тогл сильнее значения по умолчанию (та же логика, что
            // в isParticipating trainer-ui).
            const participates = (toggles && toggles.has(key))
                ? toggles.get(key)
                : cell.participates;
            pRow.push(!!(participates && !cell.disabled));
            dRow.push(!!cell.disabled);
            aRow.push(cell.availability);
        }
        matrixCopy.push(mRow);
        participation.push(pRow);
        disabled.push(dRow);
        availability.push(aRow);
    }

    // Глубокая копия цветов (простых и мульти-профилей с components).
    const colorsCopy = JSON.parse(JSON.stringify(colors));

    return {
        matrix: matrixCopy,
        colors: colorsCopy,
        participation: participation,
        disabled: disabled,
        availability: availability
    };
}

// ===== ОЦЕНКА ОТВЕТА ПО БРОСКУ ГСЧ (1..100) =====
// Мульти-профиль ячейки всегда состоит из простых цветов (компонентов) и,
// возможно, «без цвета» = фолд. Корзины берутся из App.colors.getPositions —
// тех же границ, которыми рисуется заливка (App.colors.applyCellFill):
//   компонент i занимает (positions[i-1], positions[i]],
//   остаток до 100 (positions[last] < 100) — фолд.
// Пример: рейз 25% + фолд 75% → roll 1..25 = верный «рейз», 26..100 = «фолд».
// Простой цвет (или незакрашенная ячейка) — корзина одна: действие / фолд.
// Возвращает id действия (простого цвета) либо FOLD_ACTION.

export const FOLD_ACTION = 'fold';

export function getCorrectAnswer(node, row, col, roll) {
    if (!node || !node.matrix || !node.matrix[row]) return FOLD_ACTION;
    const profileId = node.matrix[row][col];
    const profile = (node.colors || []).find(function(c) { return c.id === profileId; }) || null;
    if (!profile) return FOLD_ACTION; // незакрашенная ячейка — всегда фолд

    // Простой цвет: ячейка целиком одного действия.
    if (profile.type === 'simple' || (!profile.type && profile.color)) {
        return profile.id;
    }

    // Мульти-профиль: корзины компонентов, остаток до 100 — фолд.
    const components = profile.components || [];
    const positions = App.colors.getPositions(profile); // как у заливки
    for (let i = 0; i < components.length; i++) {
        if (roll <= (positions[i] || 0)) {
            return components[i].colorId;
        }
    }
    return FOLD_ACTION;
}