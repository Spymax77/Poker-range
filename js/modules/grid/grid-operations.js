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