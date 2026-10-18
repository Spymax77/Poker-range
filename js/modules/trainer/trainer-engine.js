// ===== trainer-engine.js — отражение основной матрицы для тренировки =====
// Вторая матрица в тренировке — не отдельная сущность, а отражение основной
// матрицы текущего диапазона. Слой данных отражения — участие руки
// в тренировке: он ВСЕГДА генерируется динамически при каждом обращении
// (переключение диапазона, перерисовка пары) и нигде не сохраняется
// (как хранить и где — отдельная будущая задача):
//   - закрашенная в основной матрице в любой пропорции ячейка участвует
//     по умолчанию;
//   - пустая ячейка участвует, если соседствует с закрашенной (4 соседа:
//     вправо-влево, вверх-вниз, по диагонали — не соседи);
//   - «линии» от закрашенных: от закрашенного одномастного туза (строка 0)
//     влево и вправо по две клетки захватываются соседние тузы, от
//     закрашенной пары (диагональ) по диагонали вверх-влево и вниз-вправо
//     по две клетки — соседние пары (AA — и пара, и туз, от неё действуют
//     обе линии). Пустая матрица не захватывает ничего;
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
// (4 соседа: вправо-влево, вверх-вниз), либо захвачена «линией» от
// закрашенной (соседние тузы по строке 0 или соседние пары по диагонали,
// по две клетки в каждую сторону) — и не недоступна,
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
    // захвата — соседей и «линий» (правило участия ниже).
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

    // «Линии» от закрашенных ячеек — расширенный захват вдоль своей линии
    // руки (в дополнение к соседям по сторонам выше):
    //   - линия одномастных тузов (строка 0: AA, AKs..A2s): закрашенный туз
    //     захватывает влево и вправо по ДВЕ клетки — соседние тузы по строке;
    //   - линия пар (диагональ r === c: AA..22): закрашенная пара захватывает
    //     по диагонали вверх-влево и вниз-вправо по ДВЕ клетки — соседние
    //     пары (88 → 66, 77, 99, TT).
    // AA — и пара, и туз (строка 0 и диагональ): от неё действуют обе линии.
    // Для ячейки-кандидата ищем закрашенную на своей линии на расстоянии 1..2.
    function hasPaintedOnAceLine(c) {
        for (let d = -2; d <= 2; d++) {
            if (d === 0) continue;
            const nc = c + d;
            if (nc < 0 || nc >= GRID_SIZE) continue;
            if (painted[0][nc]) return true;
        }
        return false;
    }

    function hasPaintedOnPairLine(r) {
        for (let d = -2; d <= 2; d++) {
            if (d === 0) continue;
            const nr = r + d;
            if (nr < 0 || nr >= GRID_SIZE) continue;
            if (painted[nr][nr]) return true;
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
            //   - закрашена в любой пропорции (профиль назначен);
            //   - пустая, но соседствует с закрашенной (4 соседа) — «край»
            //     диапазона вокруг закрашенных ячеек;
            //   - пустая на «линии» закрашенной руки на расстоянии 1..2:
            //     тузы по строке 0 (влево-вправо), пары по диагонали
            //     (вверх-влево/вниз-вправо) — см. hasPaintedOnAceLine /
            //     hasPaintedOnPairLine. Пустая матрица не захватывает ничего.
            // Недоступная ячейка не участвует никогда: правила захвата
            // попадают и на disabled-ячейки, маска !disabled держит инвариант
            // «disabled ⇒ не участвует» (тоглами такие ячейки тоже не
            // выделяются — см. trainer-ui).
            const isPair = r === c;
            const isSuitedAce = r === 0;
            const participates = (painted[r][c]
                || hasPaintedNeighbor(r, c)
                || (isSuitedAce && hasPaintedOnAceLine(c))
                || (isPair && hasPaintedOnPairLine(r)))
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

// ===== ОЦЕНКА ОТВЕТА =====
// Верный ответ — ЛЮБОЕ действие из ячейки (без «корзин» и броска ГСЧ):
//   - простой цвет — ячейка одного действия;
//   - мульти-профиль ячейки всегда состоит из простых цветов (компонентов) и,
//     возможно, «без цвета» = фолд. Верны все компоненты с НЕНУЛЕВОЙ долей
//     (границы — App.colors.getPositions, те же, которыми рисуется заливка
//     App.colors.applyCellFill) и фолд, если остаток до 100 положителен
//     (positions[last] < 100);
//   - незакрашенная ячейка — только фолд.
// Пример: рейз 50% + фолд 50% → верны и «рейз», и «фолд».
// Возвращает МАССИВ id действий (id простых цветов) и/или FOLD_ACTION.

export const FOLD_ACTION = 'fold';

export function getCorrectActions(node, row, col) {
    if (!node || !node.matrix || !node.matrix[row]) return [FOLD_ACTION];
    const profileId = node.matrix[row][col];
    const profile = (node.colors || []).find(function(c) { return c.id === profileId; }) || null;
    if (!profile) return [FOLD_ACTION]; // незакрашенная ячейка — всегда фолд

    // Простой цвет: ячейка целиком одного действия.
    if (profile.type === 'simple' || (!profile.type && profile.color)) {
        return [profile.id];
    }

    // Мульти-профиль: компоненты с ненулевой долей + фолд (остаток до 100).
    const components = profile.components || [];
    const positions = App.colors.getPositions(profile); // как у заливки
    const actions = [];
    let prev = 0;
    for (let i = 0; i < components.length; i++) {
        const pos = positions[i] || 0;
        const id = components[i].colorId;
        if (pos > prev && id !== undefined && id !== null && actions.indexOf(id) === -1) {
            actions.push(id);
        }
        prev = pos;
    }
    if ((positions[components.length - 1] || 0) < 100 && actions.indexOf(FOLD_ACTION) === -1) {
        actions.push(FOLD_ACTION);
    }
    return actions.length ? actions : [FOLD_ACTION];
}