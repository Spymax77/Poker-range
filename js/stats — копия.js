// ===== stats.js -- combos and color statistics =====
App.stats = App.stats || {};

App.stats.getCellAvailabilityPercent = function(nodeId, i, j, recursive = true, branch = null) {
    const data = branch || App.state;
    const nodes = data.nodes || [];
    const node = nodes.find(item => item.id === nodeId) || getNode(nodeId);
    if (!node || node.type !== 'subrange') return 100;
    if (node.parentId === null) return 0;
    const parentTableId = getTableId(node.parentId);
    const parentMatrix = data.cellStorage[parentTableId];
    if (!parentMatrix) return 0;
    const parentPid = parentMatrix[i][j];
    if (parentPid === null || parentPid === undefined) return 0;
    const parentColors = data.colorsPerNode[parentTableId] || [];
    const parentColor = parentColors.find(color => color.id === parentPid);
    if (!parentColor) return 0;
    const selectedIndex = node.selectedComponentIndex !== undefined ? node.selectedComponentIndex : null;
    let availability = 100;
    if (parentColor.type === 'multi' && parentColor.components) {
        if (selectedIndex !== null) {
            const simpleColors = parentColors.filter(color => color.type === 'simple' || (!color.type && color.color));
            const selectedColor = simpleColors[selectedIndex];
            const component = selectedColor && parentColor.components.find(item => item.colorId === selectedColor.id);
            if (!component) return 0;
            availability = Math.min(100, component.share || 0);
        } else {
            availability = Math.min(100, parentColor.components.reduce((sum, component) => sum + (component.share || 0), 0));
        }
    } else if (selectedIndex !== null) {
        const simpleColors = parentColors.filter(color => color.type === 'simple' || (!color.type && color.color));
        if (!simpleColors[selectedIndex] || simpleColors[selectedIndex].id !== parentPid) return 0;
    }
    if (availability <= 0) return 0;
    if (recursive) {
        const parentNode = nodes.find(item => item.id === node.parentId) || getNode(node.parentId);
        if (parentNode && parentNode.type === 'subrange') {
            availability *= App.stats.getCellAvailabilityPercent(node.parentId, i, j, true, data) / 100;
        }
    }
    return availability;
};

App.stats.countTotalCombos = function(nodeId, branch = null) {
    const data = branch || App.state;
    const matrix = data.cellStorage[getTableId(nodeId)];
    if (!matrix) return 0;
    const colors = data.colorsPerNode[getTableId(nodeId)] || [];
    let total = 0;
    for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
        const profileId = matrix[i][j];
        if (profileId === null || profileId === undefined) continue;
        const hand = rowsData[i][j];
        let combos = hand.includes('s') ? 4 : hand.includes('o') ? 12 : 6;
        const profile = colors.find(color => color.id === profileId);
        if (profile && profile.type === 'multi' && profile.components) {
            const share = profile.components.reduce((sum, component) => sum + (component.share || 0), 0);
            combos *= share / 100;
        }
        const availability = App.stats.getCellAvailabilityPercent(nodeId, i, j, true, data);
        total += combos * availability / 100;
    }
    return Math.round(total * 10) / 10;
};

App.stats.computeColorStats = function(nodeId, branch) {
    if (!nodeId || !branch) return null;
    const tableId = getTableId(nodeId);
    const matrix = branch.cellStorage[tableId];
    const colors = branch.colorsPerNode[tableId] || [];
    if (!matrix) return null;
    const nodes = branch.nodes || [];
    const currentNode = nodes.find(node => node.id === nodeId);
    const isSubrange = currentNode && currentNode.type === 'subrange';

    function availableCombos(handCombos, startNode, row, col) {
        let available = handCombos;
        let node = startNode;
        while (node && node.parentId !== null) {
            const parentMatrix = branch.cellStorage[getTableId(node.parentId)];
            if (!parentMatrix) break;
            const parentColors = branch.colorsPerNode[getTableId(node.parentId)] || [];
            const parentPid = parentMatrix[row][col];
            if (parentPid === null || parentPid === undefined) return 0;
            const parentColor = parentColors.find(color => color.id === parentPid);
            if (!parentColor) return 0;
            const selectedIndex = node.selectedComponentIndex !== undefined ? node.selectedComponentIndex : null;
            let share = 100;
            if (parentColor.type === 'multi' && parentColor.components) {
                if (selectedIndex !== null) {
                    const simpleColors = parentColors.filter(color => color.type === 'simple' || (!color.type && color.color));
                    const selectedColor = simpleColors[selectedIndex];
                    const component = selectedColor && parentColor.components.find(item => item.colorId === selectedColor.id);
                    if (!component) return 0;
                    share = Math.min(100, component.share || 0);
                } else share = Math.min(100, parentColor.components.reduce((sum, component) => sum + (component.share || 0), 0));
            } else if (selectedIndex !== null) {
                const simpleColors = parentColors.filter(color => color.type === 'simple' || (!color.type && color.color));
                if (!simpleColors[selectedIndex] || simpleColors[selectedIndex].id !== parentPid) return 0;
            }
            if (share <= 0) return 0;
            available *= share / 100;
            node = nodes.find(item => item.id === node.parentId);
        }
        return available;
    }

    const colorStats = {};
    let foldCombos = 0;
    let rangeCombos = 0;
    for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
        const hand = rowsData[i][j];
        const handCombos = hand.includes('s') ? 4 : hand.includes('o') ? 12 : 6;
        const adjustedCombos = isSubrange ? availableCombos(handCombos, currentNode, i, j) : handCombos;
        if (adjustedCombos <= 0) continue;
        rangeCombos += adjustedCombos;
        const pid = matrix[i][j];
        if (pid === null || pid === undefined) { foldCombos += adjustedCombos; continue; }
        const profile = colors.find(color => color.id === pid);
        if (!profile) { foldCombos += adjustedCombos; continue; }
        const components = profile.type === 'multi' && profile.components ? profile.components : [{ colorId: profile.id, share: 100 }];
        const boundaries = profile.type === 'multi' && profile.components
            ? (profile.boundaries && profile.boundaries.length ? profile.boundaries : components.reduce((result, component, index) => { result.push((result[index - 1] || 0) + (component.share || 0)); return result; }, []))
            : [100];
        let previous = 0;
        for (let k = 0; k < components.length; k++) {
            const component = components[k];
            const share = Math.max(0, boundaries[k] - previous) / 100;
            const simpleColor = colors.find(color => color.id === component.colorId);
            if (simpleColor) {
                const key = `profile_${simpleColor.id}`;
                if (!colorStats[key]) colorStats[key] = { combos: 0, color: simpleColor.color, name: simpleColor.name };
                colorStats[key].combos += adjustedCombos * share;
            }
            previous = boundaries[k];
        }
        if (previous < 100) foldCombos += adjustedCombos * ((100 - previous) / 100);
    }
    let totalCombosSum = Object.values(colorStats).reduce((sum, data) => sum + data.combos, 0);
    totalCombosSum = Math.round(totalCombosSum * 10) / 10;
    foldCombos = Math.round(foldCombos * 10) / 10;
    const getActionPriority = name => {
        const normalizedName = String(name || '').trim();
        if (/(?:^|\s)raise(?:\s|$)/i.test(normalizedName)) return 0;
        if (/(?:^|\s)all[- ]?in(?:\s|$)/i.test(normalizedName)) return 1;
        return 2;
    };
    const sorted = Object.entries(colorStats).sort((a, b) => {
        const priorityDifference = getActionPriority(a[1].name) - getActionPriority(b[1].name);
        if (priorityDifference !== 0) return priorityDifference;
        return b[1].combos - a[1].combos;
    });
    return { sorted, totalCombosSum, totalPercent: totalCombosSum / 1326 * 100, foldCombos, rangeCombos, foldPercent: foldCombos / 1326 * 100 };
};

App.stats.getRoundedRangePercentages = function(stats) {
    const { sorted, foldCombos, totalCombosSum, rangeCombos } = stats;
    const base = totalCombosSum + foldCombos;
    const values = sorted.map(([, data]) => data.combos);
    if (foldCombos > 0) values.push(foldCombos);
    const rounded = values.map(value => Math.round((base ? value / base * 100 : 0) * 10) / 10);
    const sum = rounded.reduce((a, b) => a + b, 0);
    if (sum !== 100 && rounded.length) {
        const index = rounded.indexOf(Math.max(...rounded));
        rounded[index] = Math.round((rounded[index] + 100 - sum) * 10) / 10;
    }
    return rounded;
};

// Округляем комбинации для вывода и переносим накопившуюся погрешность в Fold,
// чтобы сумма строк совпадала с округлённым объёмом диапазона.
App.stats.getDisplayedComboValues = function(stats) {
    const { sorted, foldCombos, totalCombosSum, rangeCombos } = stats;
    const values = sorted.map(([, data]) => Math.round(data.combos * 10) / 10);
    const foldIndex = values.length;
    values.push(Math.round(foldCombos * 10) / 10);

    const target = Math.round((rangeCombos ?? (totalCombosSum + foldCombos)) * 10) / 10;
    const displayedSum = values.reduce((sum, value) => sum + value, 0);
    const correction = Math.round((target - displayedSum) * 10) / 10;

    values[foldIndex] = Math.round((values[foldIndex] + correction) * 10) / 10;
    return values;
};

App.stats.renderStatsTable = function(nodeId, branch, containerId) {
    const element = document.getElementById(containerId);
    if (!element || !nodeId) return;
    const stats = App.stats.computeColorStats(nodeId, branch);
    if (!stats) { element.innerHTML = '<div class="stats-empty">Нет данных</div>'; return; }
    const { sorted, totalCombosSum, totalPercent, foldCombos } = stats;
    const percentages = App.stats.getRoundedRangePercentages(stats);
    const comboValues = App.stats.getDisplayedComboValues(stats);
    let html = `<div class="stats-table stats-table--total"><div class="stats-row stats-row--total--prim"><div class="stats-cell stats-cell--empty"></div><div class="stats-cell stats-cell--percent--prim">${totalPercent.toFixed(1)}%</div><div class="stats-cell stats-cell--combos--prim">(${App.stats.formatCombos(totalCombosSum)}/1326)</div></div></div>`;
    html += '<div class="stats-table stats-table--details"><div class="stats-row stats-row--header"><div class="stats-cell stats-cell--header">Цвет</div><div class="stats-cell stats-cell--header">Действие</div><div class="stats-cell stats-cell--header">Combos</div><div class="stats-cell stats-cell--header">% of range</div><div class="stats-cell stats-cell--header">% of total</div></div>';
    sorted.forEach(([key, data], index) => { html += `<div class="stats-row"><div class="stats-cell stats-cell--color"><span class="stats-color" style="background-color: ${escapeHtml(data.color)};"></span></div><div class="stats-cell stats-cell--name">${escapeHtml(data.name)}</div><div class="stats-cell stats-cell--combos">${App.stats.formatCombos(comboValues[index])}</div><div class="stats-cell stats-cell--percent">${percentages[index].toFixed(1)}%</div><div class="stats-cell stats-cell--percent">${(data.combos / 1326 * 100).toFixed(1)}%</div></div>`; });
    const foldIndex = sorted.length;
    html += `<div class="stats-row"><div class="stats-cell stats-cell--color"><span class="stats-color stats-color--fold"></span></div><div class="stats-cell stats-cell--name">Fold</div><div class="stats-cell stats-cell--combos">${App.stats.formatCombos(comboValues[foldIndex])}</div><div class="stats-cell stats-cell--percent">${(percentages[foldIndex] || 0).toFixed(1)}%</div><div class="stats-cell stats-cell--percent">${(foldCombos / 1326 * 100).toFixed(1)}%</div></div></div>`;
    element.innerHTML = html;
};

App.stats.renderActionLegend = function(nodeId, branch, containerId) {
    const element = document.getElementById(containerId);
    if (!element) return;
    element.innerHTML = '';
    const stats = App.stats.computeColorStats(nodeId, branch);
    if (!stats) return;
    const { sorted, foldCombos } = stats;
    const comboValues = App.stats.getDisplayedComboValues(stats);
    const blocks = sorted.map(([, data]) => ({ color: data.color, name: data.name, combos: data.combos }));
    if (foldCombos > 0) blocks.push({ color: '#313338', name: 'Fold', combos: foldCombos, isFold: true });
    const percentages = App.stats.getRoundedRangePercentages(stats);
    blocks.forEach((block, index) => {
        const div = document.createElement('div');
        div.className = 'stats-action-legend-block';
        div.style.background = block.color;
        if (block.isFold) div.classList.add('stats-action-legend-block--fold');
        div.innerHTML = `<div class="stats-action-legend-block__name"></div><div class="stats-action-legend-block__bottom"><span class="stats-action-legend-block__percent"></span><span class="stats-action-legend-block__combos"><span class="stats-action-legend-block__combos-number"></span><span class="stats-action-legend-block__combos-label">combos</span></span></div>`;
        div.querySelector('.stats-action-legend-block__name').textContent = block.name;
        div.querySelector('.stats-action-legend-block__percent').textContent = `${percentages[index].toFixed(1)}%`;
        div.querySelector('.stats-action-legend-block__combos-number').textContent = App.stats.formatCombos(comboValues[index]);
        element.appendChild(div);
    });
};

App.stats.renderActionBar = function(nodeId, branch, containerId) {
    const element = document.getElementById(containerId);
    if (!element) return;
    const stats = App.stats.computeColorStats(nodeId, branch);
    if (!stats) { element.style.background = ''; return; }
    const { sorted, foldCombos, totalCombosSum } = stats;
    const base = totalCombosSum + foldCombos;
    const blocks = sorted.map(([, data]) => ({ color: data.color, combos: data.combos }));
    if (foldCombos > 0) blocks.push({ color: '#313338', combos: foldCombos });
    if (!blocks.length || base <= 0) { element.style.background = ''; return; }
    let previous = 0;
    const stops = [];
    blocks.forEach(block => { const position = Math.round((previous + block.combos / base * 100) * 10) / 10; stops.push(`${block.color} ${previous}%, ${block.color} ${position}%`); previous = position; });
    element.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
};

App.stats.formatCombos = function(combos) {
    const rounded = Math.round(combos * 10) / 10;
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
};