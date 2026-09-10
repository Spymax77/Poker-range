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
    return true;
}