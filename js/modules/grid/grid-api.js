import { renderGrid } from './grid-renderer.js';
import {
    clearPinnedCellPreview,
    unpinGtoCell,
    unpinConstructorCell,
    togglePinnedPreviewCell,
    toggleGtoCellPin,
    toggleConstructorCellPin,
    handleOutsideMatrixPinClick,
    showDefaultMatrixPreview,
    showCellPreview,
    hideCellPreview
} from './grid-preview.js';
import { getTooltipElement, showTooltip, positionTooltip, hideTooltip } from './grid-tooltip.js';
import { isTrainingSetupActive, updateConstructorToolbarState, refreshConstructorAnalysisMode, updateCurrentDisplay } from './grid-toolbar.js';
import { isPinSafeTarget, getMatrixPreviewContext, getParentRange, ensureTable, getTableId } from './grid-utils.js';
import { getCellProfile, setCellProfile, clearTable } from './grid-operations.js';

App.grid = {
    isPinSafeTarget,
    getMatrixPreviewContext,
    getParentRange,
    ensureTable,
    getTableId,
    renderGrid,
    clearPinnedCellPreview,
    unpinGtoCell,
    unpinConstructorCell,
    togglePinnedPreviewCell,
    toggleGtoCellPin,
    toggleConstructorCellPin,
    handleOutsideMatrixPinClick,
    showDefaultMatrixPreview,
    showCellPreview,
    hideCellPreview,
    getTooltipElement,
    showTooltip,
    positionTooltip,
    hideTooltip,
    isTrainingSetupActive,
    updateConstructorToolbarState,
    refreshConstructorAnalysisMode,
    updateCurrentDisplay,
    getCellProfile,
    setCellProfile,
    clearTable
};