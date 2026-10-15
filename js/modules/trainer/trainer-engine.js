// ===== trainer-engine.js — отражение основной матрицы для тренировки =====
// Вторая матрица в тренировке — не отдельная сущность, а отражение основной
// матрицы текущего диапазона. Логика «правильных» и «неправильных» ячеек
// удалена полностью. Слой данных отражения — участие руки в тренировке:
// он ВСЕГДА генерируется динамически при каждом обращении (переключение
// диапазона, перерисовка пары) и нигде не сохраняется (как хранить и где —
// отдельная будущая задача):
//   - закрашенная в основной матрице в любой пропорции ячейка участвует
//     по умолчанию, незакрашенная — нет;
//   - недоступная ячейка не участвует и кликам не подлежит;
//   - клик-тоглы поверх участи по умолчанию живут только до переключения
//     диапазона (см. trainer-ui).
// Цветовые профили основной матрицы в ячейки отражения НЕ переносятся.
// Отражение — только визуальный слой участия; для переноса диапазона в
// тренажёр есть отдельный снимок данных — buildTrainerSnapshot ниже.

const GRID_SIZE = 13;

// Слой данных отражения: GRID_SIZE × GRID_SIZE объектов вида
//   { disabled, participates },
// где disabled — ячейка действительно недоступна (доступность 0%, как
// .hand-cell.subrange-disabled в основной матрице: grid-renderer.js),
// participates — рука участвует в тренировке по умолчанию (закрашена в
// основной матрице в любой пропорции и не недоступна). Значения строятся
// на каждый вызов, состояние не хранится.
export function buildTrainingMatrix(nodeId) {
    const matrix = nodeId ? App.editor.cellStorage[App.grid.getTableId(nodeId)] : null;
    const node = nodeId ? App.nodes.getNode(nodeId) : null;
    const isSubrange = !!node && node.type === 'subrange';
    const result = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        const row = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            // Недоступность раскрывается только в поддиапазонах: там её задаёт
            // цепочка родителей (каскадно, recursive = true). Частично
            // доступная ячейка — доступна (оверлей в основной матрице это
            // просто перекрывающий блок), поэтому порог строго 0%.
            const disabled = isSubrange &&
                App.stats.getCellAvailabilityPercent(nodeId, r, c, true, App.editor) <= 0;
            // Участие по умолчанию: закрашена в любой пропорции (профиль
            // назначен) и не недоступна.
            const painted = !!matrix && matrix[r][c] !== null && matrix[r][c] !== undefined;
            row.push({
                disabled: disabled,
                participates: painted && !disabled
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
//     из trainer-ui), а какие недоступны (disabled 13×13).
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
    for (let r = 0; r < GRID_SIZE; r++) {
        const mRow = [];
        const pRow = [];
        const dRow = [];
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
        }
        matrixCopy.push(mRow);
        participation.push(pRow);
        disabled.push(dRow);
    }

    // Глубокая копия цветов (простых и мульти-профилей с components).
    const colorsCopy = JSON.parse(JSON.stringify(colors));

    return {
        matrix: matrixCopy,
        colors: colorsCopy,
        participation: participation,
        disabled: disabled
    };
}