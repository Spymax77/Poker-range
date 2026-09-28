import { getTableId } from './grid/grid-utils.js';

const COLORS = {
    page: '#121212',
    emptyCell: '#313338',
    disabledBorder: '#454545',
    title: '#D4AF37',
    cellText: '#6c6c6c',
    coloredCellText: '#FFFFFF',
    statsCell: '#3b3d42',
    statsHeader: '#313338',
    statsHeaderText: '#8a848a',
    statsText: '#a9afb5',
    watermark: '#a9afb5'
};

const GRID_SIZE = 13;
const CELL_SIZE = 36;
const CELL_GAP = 2;
const GRID_WIDTH = GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * CELL_GAP;
const FONT_FAMILY = "Roboto, 'Helvetica Neue', sans-serif";
const EXPORT_PADDING = 20;
const TITLE_TOP_PADDING = 8;
const TITLE_TEXT_OFFSET = 5;
const TITLE_MATRIX_GAP = 0;
const SECTION_GAP = 14;
const WATERMARK_BOTTOM_PADDING = 5;
const WATERMARK_EXTRA_BOTTOM_SPACE = 7;

function roundRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
    roundRectPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = fillStyle;
    ctx.fill();
}

function getNode(state, nodeId) {
    return state.nodeIndex?.get(nodeId)
        || (state.nodes || []).find(node => node.id === nodeId)
        || null;
}

function getSimpleColors(colors) {
    return colors.filter(color => color.type === 'simple' || (!color.type && color.color));
}

function getComponentColor(colors, colorId) {
    return colors.find(color => color.id === colorId)?.color || COLORS.emptyCell;
}

function getGradientBoundaries(profile) {
    const components = Array.isArray(profile.components) ? profile.components : [];
    if (!components.length) return [];

    const supplied = Array.isArray(profile.boundaries) && profile.boundaries.length === components.length
        ? profile.boundaries
        : components.reduce((result, component, index) => {
            const previous = result[index - 1] || 0;
            result.push(previous + (Number(component.share) || 0));
            return result;
        }, []);

    let previous = 0;
    return supplied.map(value => {
        const boundary = Math.max(previous, Math.min(100, Number(value) || 0));
        previous = boundary;
        return boundary;
    });
}

function getProfileFillStyle(ctx, nodeColors, profile, x, y, width) {
    if (!profile) return COLORS.emptyCell;

    if (profile.type !== 'multi' && !profile.components) {
        return profile.color || COLORS.emptyCell;
    }

    const components = Array.isArray(profile.components) ? profile.components : [];
    if (!components.length) return COLORS.emptyCell;

    const colors = components.map(component => getComponentColor(nodeColors, component.colorId));
    const boundaries = getGradientBoundaries(profile);
    if (!boundaries.length) return COLORS.emptyCell;

    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    let previous = 0;
    colors.forEach((color, index) => {
        const end = boundaries[index] / 100;
        gradient.addColorStop(previous, color);
        gradient.addColorStop(end, color);
        previous = end;
    });
    if (previous < 1) {
        gradient.addColorStop(previous, COLORS.emptyCell);
        gradient.addColorStop(1, COLORS.emptyCell);
    }
    return gradient;
}

function getHandCombos(hand) {
    return hand.includes('s') ? 4 : hand.includes('o') ? 12 : 6;
}

function getTextWidth(ctx, text) {
    return ctx.measureText(String(text ?? '')).width;
}

function wrapText(ctx, text, maxWidth) {
    const value = String(text ?? '');
    if (!value || maxWidth <= 0 || getTextWidth(ctx, value) <= maxWidth) return [value];

    const words = value.split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach(word => {
        const candidate = current ? `${current} ${word}` : word;
        if (current && getTextWidth(ctx, candidate) > maxWidth) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    });
    if (current) lines.push(current);

    return lines.length ? lines : [value];
}

function drawTextLines(ctx, lines, x, centerY, lineHeight, align = 'center') {
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => ctx.fillText(line, x, firstY + index * lineHeight));
}

function createStatsRows(nodeId, state) {
    const stats = App.stats.computeColorStats(nodeId, state);
    if (!stats) return { rows: [], stats: null };

    const { sorted, foldCombos } = stats;
    const percentages = App.stats.getRoundedRangePercentages(stats);
    const comboValues = App.stats.getDisplayedComboValues(stats);

    const rows = sorted.map(([key, data], index) => ({
        type: 'action',
        key,
        color: data.color || COLORS.emptyCell,
        name: data.name || '',
        combosText: App.stats.formatCombos(comboValues[index]),
        percentOfRangeText: `${percentages[index].toFixed(1)}%`,
        percentOfTotalText: `${(data.combos / 1326 * 100).toFixed(1)}%`
    }));

    rows.push({
        type: 'fold',
        color: COLORS.emptyCell,
        name: 'Fold',
        combosText: App.stats.formatCombos(comboValues[sorted.length]),
        percentOfRangeText: `${(percentages[sorted.length] || 0).toFixed(1)}%`,
        percentOfTotalText: `${(foldCombos / 1326 * 100).toFixed(1)}%`
    });

    return { rows, stats };
}

function getStatsLayout(ctx, width, rows) {
    const gap = 2;
    const columns = [40, 75, 75, 75];
    columns.splice(1, 0, Math.max(80, width - columns.reduce((sum, value) => sum + value, 0) - gap * 4));
    const headerFont = `13px ${FONT_FAMILY}`;
    const bodyFont = `13px ${FONT_FAMILY}`;
    const headers = [
        App.i18n.t('stats.color'),
        App.i18n.t('stats.action'),
        'Combos',
        '% of range',
        '% of total'
    ];

    ctx.font = headerFont;
    const headerLines = headers.map((header, index) => wrapText(ctx, header, columns[index] - 4));
    ctx.font = bodyFont;
    const rowLines = rows.map(row => wrapText(ctx, row.name, columns[1] - 4));
    const lineHeight = 14;
    const headerHeight = Math.max(24, ...headerLines.map(lines => lines.length * lineHeight + 4));
    const rowHeights = rowLines.map(lines => Math.max(24, lines.length * lineHeight + 4));
    const totalHeight = headerHeight + rowHeights.reduce((sum, height) => sum + height, 0) + gap * (rows.length + 1);

    return { columns, gap, headers, headerLines, rowLines, headerHeight, rowHeights, totalHeight };
}

function drawStatsTable(ctx, x, y, width, rows) {
    const layout = getStatsLayout(ctx, width, rows);
    let rowY = y;

    const drawCell = (cellX, cellY, cellWidth, cellHeight, fillStyle, lines, textColor, font) => {
        drawRoundedRect(ctx, cellX, cellY, cellWidth, cellHeight, 2, fillStyle);
        ctx.font = font;
        ctx.fillStyle = textColor;
        drawTextLines(ctx, lines, cellX + cellWidth / 2, cellY + cellHeight / 2, 14);
    };

    const drawRow = (height, cells, isHeader = false) => {
        let cellX = x;
        cells.forEach((cell, index) => {
            drawCell(
                cellX,
                rowY,
                layout.columns[index],
                height,
                isHeader ? COLORS.statsHeader : COLORS.statsCell,
                cell.lines,
                isHeader ? COLORS.statsHeaderText : COLORS.statsText,
                isHeader ? `13px ${FONT_FAMILY}` : `13px ${FONT_FAMILY}`
            );
            cellX += layout.columns[index] + layout.gap;
        });
        rowY += height + layout.gap;
    };

    drawRow(layout.headerHeight, layout.headerLines.map(lines => ({ lines })), true);

    rows.forEach((row, index) => {
        const cells = [
            { lines: [''], color: row.color },
            { lines: layout.rowLines[index] },
            { lines: [row.combosText] },
            { lines: [row.percentOfRangeText] },
            { lines: [row.percentOfTotalText] }
        ];
        drawRow(layout.rowHeights[index], cells);

        const colorCellX = x + 5;
        const colorCellY = rowY - layout.rowHeights[index] - layout.gap + (layout.rowHeights[index] - 18) / 2;
        drawRoundedRect(ctx, colorCellX, colorCellY, 30, 18, 2, row.color);
        ctx.strokeStyle = '#3d3f46';
        ctx.lineWidth = 1;
        roundRectPath(ctx, colorCellX + 0.5, colorCellY + 0.5, 29, 17, 2);
        ctx.stroke();
    });

    return layout.totalHeight;
}

function drawMatrix(ctx, nodeId, state, x, y, showSubrangeOverlays = true) {
    const matrix = state.cellStorage[getTableId(nodeId)];
    const nodeColors = App.colors.getColorsForNode(nodeId);
    const node = getNode(state, nodeId);
    const isSubrange = node?.type === 'subrange';
    const rowsData = globalThis.rowsData || [];

    for (let row = 0; row < GRID_SIZE; row += 1) {
        for (let col = 0; col < GRID_SIZE; col += 1) {
            const cellX = x + col * (CELL_SIZE + CELL_GAP);
            const cellY = y + row * (CELL_SIZE + CELL_GAP);
            const profileId = matrix?.[row]?.[col];
            const profile = nodeColors.find(color => color.id === profileId);
            const hand = rowsData[row]?.[col] || '';
            const availability = isSubrange
                ? Math.max(0, Math.min(100, App.stats.getCellAvailabilityPercent(nodeId, row, col, true, state)))
                : 100;

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
            const isAvailable = availability > 0;
            const fill = isAvailable
                ? getProfileFillStyle(ctx, nodeColors, profile, cellX, cellY, CELL_SIZE)
                : COLORS.page;
            drawRoundedRect(ctx, cellX, cellY, CELL_SIZE, CELL_SIZE, 4, fill);
            ctx.restore();

            if (showSubrangeOverlays && isSubrange && isAvailable && availability < 100) {
                const overlayHeight = CELL_SIZE * (1 - availability / 100);
                ctx.save();
                roundRectPath(ctx, cellX, cellY, CELL_SIZE, CELL_SIZE, 4);
                ctx.clip();
                ctx.fillStyle = COLORS.page;
                ctx.fillRect(cellX, cellY, CELL_SIZE, overlayHeight);
                ctx.restore();
            }

            if (!isAvailable) {
                ctx.save();
                ctx.strokeStyle = COLORS.disabledBorder;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 2]);
                roundRectPath(ctx, cellX + 0.5, cellY + 0.5, CELL_SIZE - 1, CELL_SIZE - 1, 4);
                ctx.stroke();
                ctx.restore();
            }

            ctx.font = `13px ${FONT_FAMILY}`;
            ctx.fillStyle = profile && isAvailable ? COLORS.coloredCellText : COLORS.cellText;
            ctx.shadowColor = profile && isAvailable ? 'rgba(0, 0, 0, 0.4)' : 'transparent';
            ctx.shadowBlur = profile && isAvailable ? 3 : 0;
            ctx.shadowOffsetY = profile && isAvailable ? 1 : 0;
            drawTextLines(ctx, [hand], cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2, 14);
            ctx.shadowColor = 'transparent';
        }
    }
}

function drawTitle(ctx, title, x, y, width) {
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.title;
    const lines = wrapText(ctx, title, width);
    drawTextLines(ctx, lines, x, y + lines.length * 9 + TITLE_TEXT_OFFSET, 18, 'left');
    return Math.max(28, lines.length * 18);
}

function drawWatermark(ctx, width, height) {
    ctx.save();
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.watermark;
    ctx.globalAlpha = 0.55;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('pfrange.ru', width - EXPORT_PADDING, height - WATERMARK_BOTTOM_PADDING);
    ctx.restore();
}

function renderRangeToCanvas(nodeId, state) {
    const node = getNode(state, nodeId);
    if (!node) throw new Error('Current range is unavailable');

    const title = String(node.name || '');
    const statsResult = createStatsRows(nodeId, state);
    const rows = statsResult.rows;
    const titleProbe = document.createElement('canvas').getContext('2d');
    titleProbe.font = `14px ${FONT_FAMILY}`;
    const contentWidth = Math.ceil(Math.max(GRID_WIDTH, getTextWidth(titleProbe, title)));
    const width = contentWidth + EXPORT_PADDING * 2;
    const titleHeight = Math.max(28, wrapText(titleProbe, title, contentWidth).length * 18);
    const statsLayoutProbe = document.createElement('canvas').getContext('2d');
    const statsLayout = getStatsLayout(statsLayoutProbe, contentWidth, rows);
    const constructorMatrixWrapper = document.querySelector('.table-panel .matrix-wrapper');
    const showSubrangeOverlays = !constructorMatrixWrapper?.classList.contains('hide-subrange-overlays');
    const matrixY = TITLE_TOP_PADDING + titleHeight + TITLE_MATRIX_GAP;
    const statsY = matrixY + GRID_WIDTH + SECTION_GAP;
    const logicalHeight = statsY + statsLayout.totalHeight + EXPORT_PADDING + WATERMARK_EXTRA_BOTTOM_SPACE;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(logicalHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(0, 0, width, logicalHeight);

    drawTitle(ctx, title, EXPORT_PADDING, TITLE_TOP_PADDING, contentWidth);
    drawMatrix(ctx, nodeId, state, EXPORT_PADDING, matrixY, showSubrangeOverlays);
    drawStatsTable(ctx, EXPORT_PADDING, statsY, contentWidth, rows);
    drawWatermark(ctx, width, logicalHeight);

    return canvas;
}

function downloadCanvas(canvas, nodeName) {
    canvas.toBlob(blob => {
        if (!blob) return;
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = String(nodeName || 'range')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .trim() || 'range';
        link.href = objectUrl;
        link.download = `${safeName}.png`;
        link.click();
        URL.revokeObjectURL(objectUrl);
    }, 'image/png');
}

export async function downloadCurrentRange() {
    try {
        if (document.fonts?.ready) await document.fonts.ready;

        const state = App.state;
        const nodeId = state.currentNodeId;
        if (!nodeId) return;

        const node = getNode(state, nodeId);
        if (!node) return;

        const canvas = renderRangeToCanvas(nodeId, state);
        downloadCanvas(canvas, node.name);
    } catch (error) {
        console.error('Range PNG export failed:', error);
    }
}

globalThis.App = globalThis.App || {};
App.rangeExport = { downloadCurrentRange };

document.addEventListener('click', event => {
    const shareButton = event.target instanceof Element
        ? event.target.closest('#shareRangeBtn')
        : null;
    if (shareButton) void downloadCurrentRange();
});