// ===== stats.js -- extracted from all.js (combos & color statistics) =====
// ===== ВСПОМОГАТЕЛЬНАЯ: ПРОЦЕНТ ДОСТУПНОСТИ ЯЧЕЙКИ В ПОДДИАПАЗОНЕ =====
function getCellAvailabilityPercent(nodeId, i, j, recursive = true) {
    const node = getNode(nodeId);
    if (!node || node.type !== 'subrange') return 100;

    const parentId = node.parentId;
    if (parentId === null) return 0;

    const parentTableId = getTableId(parentId);
    const parentMatrix = App.state.cellStorage[parentTableId];
    if (!parentMatrix) return 0;

    const parentPid = parentMatrix[i][j];
    if (parentPid === null) return 0;

    const selectedComponentIndex = node.selectedComponentIndex !== undefined ? node.selectedComponentIndex : null;
    const parentColors = App.state.colorsPerNode[parentTableId] || [];
    const color = parentColors.find(c => c.id === parentPid);

    if (!color) return 0;

    // Вычисляем процент доступности в прямом родителе
    let parentAvailability = 100;

    // Простой цвет
    if (color.type === 'simple' || (!color.type && color.color)) {
        if (selectedComponentIndex !== null) {
            const simpleColors = parentColors.filter(c => c.type === 'simple' || (!c.type && c.color));
            const selectedSimpleColor = simpleColors[selectedComponentIndex];
            if (selectedSimpleColor && parentPid === selectedSimpleColor.id) {
                parentAvailability = 100;
            } else {
                return 0;
            }
        }
    }
    // Мультицвет
    else if (color.type === 'multi' && color.components) {
        if (selectedComponentIndex !== null) {
            const simpleColors = parentColors.filter(c => c.type === 'simple' || (!c.type && c.color));
            const selectedSimpleColor = simpleColors[selectedComponentIndex];
            if (selectedSimpleColor) {
                const matchedComp = color.components.find(comp => comp.colorId === selectedSimpleColor.id);
                if (matchedComp) {
                    parentAvailability = Math.min(100, matchedComp.share || 0);
                } else {
                    return 0;
                }
            } else {
                return 0;
            }
        } else {
            let totalShare = 0;
            for (const comp of color.components) {
                totalShare += comp.share || 0;
            }
            parentAvailability = Math.min(100, totalShare);
        }
    }

    if (parentAvailability <= 0) return 0;

    // Если нужно рекурсивное наследование и родитель — поддиапазон,
    // умножаем на его доступность (каскадное наследование для статистики)
    if (recursive) {
        const parentNode = getNode(parentId);
        if (parentNode && parentNode.type === 'subrange') {
            const grandParentAvailability = getCellAvailabilityPercent(parentId, i, j, true);
            return parentAvailability * (grandParentAvailability / 100);
        }
    }

    return parentAvailability;
}
function countTotalCombos(nodeId) {
    let tid = getTableId(nodeId);
    if (!App.state.cellStorage[tid]) return 0;
    let total = 0;
    const colors = App.state.colorsPerNode[tid] || [];
    
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const pid = App.state.cellStorage[tid][i][j];
            if (pid === null) continue;
            
            let hand = rowsData[i][j];
            let combos = 0;
            if (hand.includes('s')) combos = 4;
            else if (hand.includes('o')) combos = 12;
            else if (hand[0] === hand[1]) combos = 6;
            
            // Проверяем, мультицвет ли это
            const color = colors.find(c => c.id === pid);
            if (color && color.type === 'multi') {
                // Суммируем доли всех компонентов мультицвета
                let totalShare = 0;
                for (const comp of color.components) {
                    totalShare += comp.share || 0;
                }
                // Если сумма долей > 0, умножаем комбинации на долю / 100
                if (totalShare > 0) {
                    combos = combos * (totalShare / 100);
                }
            }
            
            // Учитываем доступность ячейки для поддиапазона
            const availability = getCellAvailabilityPercent(nodeId, i, j);
            if (availability < 100) {
                combos = combos * (availability / 100);
            }
            
            total += combos;
        }
    }
    return Math.round(total * 10) / 10;
}

// ===== ДЕТАЛЬНАЯ СТАТИСТИКА ПО ЦВЕТАМ В РЕЖИМЕ ПРОСМОТРА =====
function updateWorkColorStats(nodeId) {
    const tid = getTableId(nodeId);
    const matrix = App.state.cellStorage[tid];
    if (!matrix) return;

    let statsContainer = document.getElementById("workColorStats");
    if (!statsContainer) {
        statsContainer = document.createElement("div");
        statsContainer.id = "workColorStats";
        statsContainer.style.marginTop = "6px";
        statsContainer.style.fontSize = "13px";
        statsContainer.style.lineHeight = "1.4";
        statsContainer.style.display = "flex";
        statsContainer.style.justifyContent = "flex-end";
        const wrapper = document.getElementById("workTableWrapper");
        if (wrapper) wrapper.appendChild(statsContainer);
    }

    const profiles = getColorsForNode(nodeId);
    const colorStats = {};
    let totalCombosWeighted = 0;

    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const pid = matrix[i][j];
            if (pid === null) continue;
            const prof = profiles.find(p => p.id === pid);
            if (!prof) continue;

            const hand = rowsData[i][j];
            let handTotalCombos = 0;
            if (hand.includes('s')) handTotalCombos = 4;
            else if (hand.includes('o')) handTotalCombos = 12;
            else if (hand[0] === hand[1]) handTotalCombos = 6;

            // Учитываем доступность ячейки для поддиапазона
            const availability = getCellAvailabilityPercent(nodeId, i, j);
            if (availability <= 0) continue;
            handTotalCombos = handTotalCombos * (availability / 100);

            // Получаем компоненты профиля
            let components = [];
            let boundaries = [];

            if (prof.type === 'simple' || (!prof.type && prof.color)) {
                components = [{ colorId: prof.id, share: 100 }];
                boundaries = [100];
            } else if (prof.type === 'multi' && prof.components) {
                components = prof.components;
                boundaries = prof.boundaries || [];
            }

            // Проходим по каждому компоненту мультипрофиля
            let prev = 0;
            for (let k = 0; k < components.length; k++) {
                const comp = components[k];
                const share = (boundaries[k] - prev) / 100;
                const combosShare = Math.round((handTotalCombos * share) * 10) / 10;

                // Находим одноцветный профиль для этого компонента
                const simpleProf = profiles.find(p => p.id === comp.colorId);
                if (!simpleProf) continue;

                const profileKey = `profile_${simpleProf.id}`;
                if (!colorStats[profileKey]) {
                    colorStats[profileKey] = { 
                        combos: 0, 
                        color: simpleProf.color,
                        name: simpleProf.name
                    };
                }
                colorStats[profileKey].combos += combosShare;
                totalCombosWeighted += combosShare;
                prev = boundaries[k];
            }
        }
    }

    if (totalCombosWeighted > 0) {
        const sortedEntries = Object.entries(colorStats).sort((a, b) => b[1].combos - a[1].combos);
        let rows = [];

        for (const [key, data] of sortedEntries) {
            const percent = (data.combos / 1326 * 100).toFixed(1);
            rows.push({
                color: data.color,
                percent: percent,
                combos: data.combos
            });
        }

        let html = `<div style="display: inline-block; min-width: 180px;">
            <table style="width: auto; border-collapse: collapse; font-size: 13px;">
                <tbody>`;

        for (const row of rows) {
            html += `<tr>
                <td style="padding: 2px 4px 2px 0; text-align: right; width: 20px;">
                    <span style="display: inline-block; width: 15px; height: 13px; background: ${row.color}; border-radius: 3px;"></span>
                </td>
                <td style="padding: 2px 8px 2px 0; text-align: right; min-width: 70px;">
                    ${row.percent}%
                </td>
                <td style="padding: 2px 0; text-align: right; min-width: 80px;">
                    (${formatCombos(row.combos)}/1326)
                </td>
            </tr>`;
        }

        html += `</tbody></table></div>`;
        statsContainer.innerHTML = html;
    } else if (statsContainer) {
        statsContainer.innerHTML = `<div style="color: var(--text-muted);">Нет установленных диапазонов</div>`;
    }
}

function formatCombos(combos) {
    let rounded = Math.round(combos * 10) / 10;
    if (rounded % 1 === 0) {
        return rounded.toString();
    }
    return rounded.toFixed(1);
}

