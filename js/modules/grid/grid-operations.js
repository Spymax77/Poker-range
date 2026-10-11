import { getTableId, ensureTable } from './grid-utils.js';
export function getCellProfile(nodeId, r, c) {
    return App.state.cellStorage[getTableId(nodeId)]?.[r]?.[c] || null;
}

export function setCellProfile(nodeId, r, c, pid, immediateSave = true) {
    App.grid.ensureTable(nodeId);
    const tid = getTableId(nodeId);
    const old = App.state.cellStorage[tid][r][c];
    if (old === pid) return false;
    App.state.cellStorage[tid][r][c] = pid;
    // Ячейка реально изменена — помечаем таблицу как изменённую.
    // (раньше dirty-флаг ставил патч patchGridSetCellProfile из
    // dirty-integration.js; immediateSave на метку не влияет —
    // любое фактическое изменение матрицы должно сохраняться)
    if (App.dirty) App.dirty.markTableDirty(nodeId);
    return true;
}

// Полная очистка матрицы диапазона (кнопка «Очистить» в тулбаре).
// Возвращает false, если таблицы у узла нет. Dirty-метка ставится только
// при реальном изменении — как в setCellProfile.
export function clearTable(nodeId) {
    const table = App.state.cellStorage[getTableId(nodeId)];
    if (!table) return false;
    for (let r = 0; r < table.length; r++) {
        const row = table[r];
        for (let c = 0; c < row.length; c++) {
            row[c] = null;
        }
    }
    if (App.dirty) App.dirty.markTableDirty(nodeId);
    return true;
}