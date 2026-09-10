// Grid utilities
export let gtoPinnedCell = null;
export let constructorPinnedCell = null;

export const GTO_PIN_SAFE_SELECTOR = '#gtoOverlayToggleBtn';
export const CONSTRUCTOR_PIN_SAFE_SELECTOR = '#commentsToggleBtn, #constructorOverlayToggleBtn, #commentsWrapper';
export function isPinSafeTarget(e, safeSelector) {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (path.length) {
        for (const node of path) {
            if (node instanceof Element && node.matches(safeSelector)) return true;
        }
        return false;
    }
    return e.target instanceof Element && !!e.target.closest(safeSelector);
}

export function getMatrixPreviewContext(containerId) {
    if (containerId === 'gtoGrid') {
        return {
            branch: App.gto,
            matrixId: 'gtoGrid',
            previewId: 'gtoCellPreview',
            safeSelector: GTO_PIN_SAFE_SELECTOR,
            isModeActive: () => true,
            getPinnedCell: () => gtoPinnedCell,
            setPinnedCell: (value) => { gtoPinnedCell = value; },
            clearPinnedCell: () => {
                if (gtoPinnedCell) {
                    const oldCell = document.querySelector(
                        `#gtoGrid .hand-cell[data-row='${gtoPinnedCell.row}'][data-col='${gtoPinnedCell.col}']`
                    );
                    if (oldCell) oldCell.classList.remove('gto-cell-pinned');
                }
                gtoPinnedCell = null;
            }
        };
    }

    if (containerId === 'constructorGrid') {
        return {
            branch: App.editor,
            matrixId: 'constructorGrid',
            previewId: 'constructorCellPreview',
            safeSelector: CONSTRUCTOR_PIN_SAFE_SELECTOR,
            isModeActive: () => !!App.state.analysisMode,
            getPinnedCell: () => constructorPinnedCell,
            setPinnedCell: (value) => { constructorPinnedCell = value; },
            clearPinnedCell: () => {
                if (constructorPinnedCell) {
                    const oldCell = document.querySelector(
                        `#constructorGrid .hand-cell[data-row='${constructorPinnedCell.row}'][data-col='${constructorPinnedCell.col}']`
                    );
                    if (oldCell) oldCell.classList.remove('gto-cell-pinned');
                }
                constructorPinnedCell = null;
            }
        };
    }

    return null;
}
export function ensureTable(nodeId) {
    const tid = getTableId(nodeId);
    if (!App.state.cellStorage[tid]) App.state.cellStorage[tid] = Array(13).fill().map(() => Array(13).fill(null));
}
export function getParentRange(nodeId) {
    let node = getNode(nodeId);
    if (!node) return null;
    if (node.type === 'range') return node;
    if (node.type === 'subrange') {
        let current = node;
        while (current && current.type !== 'range') {
            current = getNode(current.parentId);
        }
        return current;
    }
    return null;
}

export function getNode(id) {
    return App.state.nodeIndex.get(id) || null;
}

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getTableId(nodeId) { return `node_${nodeId}`; }
globalThis.getTableId = getTableId;
