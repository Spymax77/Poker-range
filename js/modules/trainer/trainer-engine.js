// ===== trainer-engine.js — генерация тренировочных наборов =====
// Правильные руки = все закрашенные ячейки диапазона (рейз+колл+олл-ин).
// Неправильные = «близкие» ячейки рядом с диапазоном: радиус <= 2 в матрице,
// чтобы ошибиться было реально, но явный мусор (23o и т.п.) в выборку не
// попадал. Объём: к диапазону добавляется ~45% близких рук (19% -> ~27%).

const GRID_SIZE = 13;
const NEAR_RADIUS = 2;     // макс. расстояние «неправильной» ячейки от диапазона
const EXTRA_RATIO = 0.45;  // доля близких рук к размеру диапазона
const MIN_EXTRA = 3;       // минимум неправильных рук, чтобы тренировка имела смысл

// Все закрашенные ячейки диапазона как пары [row, col].
export function getRangeHands(nodeId) {
    const result = [];
    if (!nodeId) return result;
    const matrix = App.state.cellStorage[App.grid.getTableId(nodeId)];
    if (!matrix) return result;
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (matrix[r][c] !== null && matrix[r][c] !== undefined) result.push([r, c]);
        }
    }
    return result;
}

// «Близкие» неправильные руки: кандидаты — незакрашенные ячейки в радиусе
// NEAR_RADIUS от любой правильной; сортировка — чем больше правильных
// соседей и чем ближе, тем правдоподобнее ошибка.
export function generateIncorrectHands(correctHands) {
    const correctSet = new Set(correctHands.map(function(p) { return p[0] + '_' + p[1]; }));
    const candidates = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (correctSet.has(r + '_' + c)) continue;
            let minDist = Infinity;
            let neighbors = 0;
            for (let i = 0; i < correctHands.length; i++) {
                const d = Math.max(Math.abs(correctHands[i][0] - r), Math.abs(correctHands[i][1] - c));
                if (d < minDist) minDist = d;
                if (d === 1) neighbors++;
            }
            if (minDist <= NEAR_RADIUS) candidates.push({ r: r, c: c, minDist: minDist, neighbors: neighbors });
        }
    }
    candidates.sort(function(a, b) {
        return (b.neighbors - a.neighbors) || (a.minDist - b.minDist);
    });
    const target = Math.max(MIN_EXTRA, Math.round(correctHands.length * EXTRA_RATIO));
    return candidates.slice(0, target).map(function(x) { return [x.r, x.c]; });
}

// Полный набор тренировки для диапазона.
export function generateTrainingHands(nodeId) {
    const correct = getRangeHands(nodeId);
    return { correct: correct, incorrect: generateIncorrectHands(correct) };
}