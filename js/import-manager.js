// ===== import-manager.js =====
// РАБОЧАЯ ВЕРСИЯ — ИМПОРТ С ЧАСТОТАМИ (С ИСПРАВЛЕНИЕМ getPositions)

let importWindowInstance = null;
let selectedColorId = null;

// ===== КАРТА РУК (рука → координаты) =====
function generateHandMap() {
    const map = {};
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const hand = rowsData[i][j];
            map[hand] = [i, j];
        }
    }
    return map;
}

// ===== ПАРСИНГ ТЕКСТА (с частотами) =====
function parseHandsWithFrequencies(text) {
    const items = text.split(',').map(s => s.trim());
    const result = [];
    for (const item of items) {
        let hand, freq = 1.0;
        if (item.includes(':')) {
            const parts = item.split(':');
            hand = parts[0].trim();
            freq = parseFloat(parts[1].trim());
            if (isNaN(freq)) freq = 1.0;
        } else {
            hand = item;
        }
        if (hand) result.push({ hand, freq });
    }
    return result;
}

// ===== ГРУППИРОВКА ПО ЧАСТОТАМ =====
function groupByFrequency(parsedData) {
    const groups = {};
    for (const item of parsedData) {
        const key = item.freq;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item.hand);
    }
    return groups;
}

// ===== ПРИМЕНЕНИЕ ИМПОРТА К МАТРИЦЕ =====
function applyImportToMatrix(nodeId, text, colorId) {
    if (!nodeId || !text || colorId === null) {
        showFloatingModal('Ошибка: нет диапазона, текста или цвета');
        return;
    }
	 
	 const overwriteCheck = document.getElementById('importOverwriteCheck');
    if (overwriteCheck && overwriteCheck.checked) {
        const tid = getTableId(nodeId);
        if (cellStorage[tid]) {
            for (let i = 0; i < 13; i++) {
                for (let j = 0; j < 13; j++) {
                    cellStorage[tid][i][j] = null;
                }
            }
        }
    }

    const handMap = generateHandMap();
    const parsed = parseHandsWithFrequencies(text);
    
    if (parsed.length === 0) {
        showFloatingModal('Не найдено ни одной руки для импорта');
        return;
    }

    const groups = groupByFrequency(parsed);
    let paintedCount = 0;
    const multiColorMap = {};

    for (const freqKey of Object.keys(groups)) {
        const freq = parseFloat(freqKey);
        const hands = groups[freqKey];

        let targetColorId;

      if (freq === 1.0) {
    targetColorId = colorId;
} else {
    const percent = Math.round(freq * 100);
    
    // Проверяем, есть ли уже мультицвет с таким процентом (для кеширования)
    if (!multiColorMap[freqKey]) {
        // Создаём временный мультицвет (заглушка)
     const newId = createMultiColor(
    nodeId,
    'Смесь',
    [{ colorId: colorId, share: percent }],
    [percent]
);
multiColorMap[freqKey] = newId;
targetColorId = newId;
    } else {
        targetColorId = multiColorMap[freqKey];
    }
}

for (const hand of hands) {
    const coords = handMap[hand];
    if (coords) {
        const [row, col] = coords;
        let finalColorId;
        
        if (freq === 1.0) {
            finalColorId = colorId;
        } else {
            const percent = Math.round(freq * 100);
            
            // Проверяем, пустая ли ячейка
            const tid = getTableId(nodeId);
            const matrix = cellStorage[tid];
            const currentPid = matrix ? matrix[row][col] : null;
            
            if (currentPid === null) {
                // Ячейка пустая — используем общий мультицвет из multiColorMap
                finalColorId = targetColorId;
            } else {
                // Ячейка не пустая — создаём копию с добавлением второго цвета
                finalColorId = getOrCreateMultiColorForCell(nodeId, row, col, colorId, percent);
                if (finalColorId === null) {
                    console.warn(`Не удалось создать мультицвет для ${hand}`);
                    continue;
                }
            }
        }
        
        setCellProfile(nodeId, row, col, finalColorId);
        paintedCount++;
    } else {
        console.warn(`Рука не найдена в матрице: ${hand}`);
    }
}
    }

    // 3. Синхронизируем интерфейс (перерисовка палитры)
    renderAllColors(nodeId, true);
    refreshAll();
    updateCurrentDisplay();
    markUnsaved();

    showFloatingModal(`✅ Импортировано ${paintedCount} рук с учётом частот`);
	
	// 1. Дедупликация (схлопываем одинаковые мультицвета)
    deduplicateMultiColors(nodeId);
	
	// Удаляем неиспользуемые мультицвета
	removeUnusedMultiColors(nodeId);
}

// ===== СОЗДАНИЕ ОКНА ИМПОРТА =====
function createImportWindow() {
    const overlay = document.createElement('div');
    overlay.className = 'save-confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'save-confirm-modal';
    modal.style.width = '600px';
    modal.style.maxWidth = '90vw';

    modal.innerHTML = `
        <div class="save-confirm-header" id="importHeader" style="cursor: grab; display: flex; justify-content: space-between; align-items: center;">
            <span>Импортировать диапазон</span>
            <button id="importCloseBtn" style="background: none; border: none; color: #8a848a; font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1;">✕</button>
        </div>
        <div class="save-confirm-body" style="margin-bottom: 18px;">
            <textarea id="importTextarea" class="import-textarea" style="height: 350px;"></textarea>
        </div>
        <div class="save-confirm-actions" style="display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center; gap: 10px;">
       <input type="checkbox" id="importOverwriteCheck">
        <label for="importOverwriteCheck" style="color: #a9afb5; font-size: 16px; cursor: pointer;">Перезаписать текущий диапазон</label>
    </div>
    <div style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
        <div class="import-color-selector" style="display: flex; align-items: center; gap: 10px; margin-right: auto; cursor: pointer;" id="importColorSelector">
            <div id="importColorBox" style="width: 36px; height: 36px; border-radius: 4px; border: 1px solid #3d3f46; background: #9C5479;"></div>
            <span id="importColorName" style="color: #e5eaf0; font-size: 16px;">action</span>
        </div>
        <button class="btn btn-cancel" id="importCancelBtn" style="width: 135px;">Отмена</button>
        <button class="btn btn-confirm" id="importApplyBtn" style="width: 135px;">Импортировать</button>
    </div>
</div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    return { overlay, modal };
}

// ===== ПЕРЕТАСКИВАНИЕ ОКНА =====
function makeDraggable(modal, header) {
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
        if (e.target.closest('button')) return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    });

    function onDrag(e) {
        if (!isDragging) return;
        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(10, Math.min(window.innerWidth - modal.offsetWidth - 10, left));
        top = Math.max(10, Math.min(window.innerHeight - modal.offsetHeight - 10, top));
        modal.style.left = left + 'px';
        modal.style.top = top + 'px';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

// ===== ПОКАЗ ОКНА ИМПОРТА =====
function showImportWindow() {
    if (importWindowInstance) {
        importWindowInstance.remove();
        importWindowInstance = null;
    }

    const savedNodeId = currentNodeId;
    const { overlay, modal } = createImportWindow();
    importWindowInstance = overlay;

    const header = modal.querySelector('#importHeader');
    makeDraggable(modal, header);

    // ===== УСТАНАВЛИВАЕМ ПЕРВЫЙ ПРОСТОЙ ЦВЕТ =====
    const tableId = getTableId(currentNodeId);
    const colors = colorsPerNode[tableId] || [];
    const simpleColors = colors.filter(c => c.type === 'simple' || (!c.type && c.color));
    if (simpleColors.length > 0) {
        selectedColorId = simpleColors[0].id;
        updateImportColorDisplay();
    }

    // ===== КЛИК ПО КВАДРАТИКУ =====
    const selector = modal.querySelector('#importColorSelector');
    if (selector) {
        selector.addEventListener('click', function(e) {
            e.stopPropagation();
            const box = document.getElementById('importColorBox');
            if (box) showColorPickerForImport(box);
        });
    }

    // ===== ЗАКРЫТИЕ ОКНА =====
    function closeWindow() {
        if (window._importCheckInterval) {
            clearInterval(window._importCheckInterval);
            window._importCheckInterval = null;
        }
        if (importWindowInstance) {
            importWindowInstance.remove();
            importWindowInstance = null;
        }
        const popup = document.querySelector('.color-picker-popup');
        if (popup) popup.remove();
    }

    modal.querySelector('#importCloseBtn').addEventListener('click', closeWindow);
    modal.querySelector('#importCancelBtn').addEventListener('click', closeWindow);

    // ===== ЗАКРЫТИЕ ПРИ СМЕНЕ ДИАПАЗОНА =====
    if (window._importCheckInterval) {
        clearInterval(window._importCheckInterval);
    }
    window._importCheckInterval = setInterval(() => {
        if (currentNodeId !== savedNodeId) closeWindow();
    }, 200);

    // ===== КНОПКА "ИМПОРТИРОВАТЬ" =====
    modal.querySelector('#importApplyBtn').addEventListener('click', function() {
        const text = document.getElementById('importTextarea').value.trim();
        if (!text) {
            showFloatingModal('Вставьте данные для импорта');
            return;
        }
        applyImportToMatrix(currentNodeId, text, selectedColorId);
        closeWindow();
    });

    setTimeout(() => {
        const textarea = document.getElementById('importTextarea');
        if (textarea) textarea.focus();
    }, 100);
}

// ===== ВЫБОР ЦВЕТА В ОКНЕ ИМПОРТА =====
function showColorPickerForImport(anchor) {
    const tableId = getTableId(currentNodeId);
    const colors = colorsPerNode[tableId] || [];
    const simpleColors = colors.filter(c => c.type === 'simple' || (!c.type && c.color));
    
    if (simpleColors.length === 0) return;

    const oldPopup = document.querySelector('.color-picker-popup');
    if (oldPopup) oldPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'color-picker-popup';

    for (const color of simpleColors) {
        const opt = document.createElement('div');
        opt.className = 'picker-option';

        const swatch = document.createElement('div');
        swatch.className = 'picker-swatch';
        swatch.style.backgroundColor = color.color;

        const label = document.createElement('span');
        label.className = 'picker-label';
        label.textContent = color.name || 'Без имени';

        opt.appendChild(swatch);
        opt.appendChild(label);

        opt.addEventListener('click', () => {
            selectedColorId = color.id;
            updateImportColorDisplay();
            popup.remove();
        });

        popup.appendChild(opt);
    }

    document.body.appendChild(popup);

    // ===== ЗАКРЫТИЕ ПРИ КЛИКЕ ВНЕ ПЛАШКИ =====
    setTimeout(() => {
        document.addEventListener('click', function outsideClick(e) {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', outsideClick);
            }
        });
    }, 10);

    const rect = anchor.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;

    const spaceBelow = window.innerHeight - rect.bottom - 6;
    const spaceAbove = rect.top - 6;

    if (spaceBelow < popup.offsetHeight && spaceAbove > popup.offsetHeight) {
        top = rect.top - popup.offsetHeight - 6;
    } else if (spaceBelow < popup.offsetHeight) {
        top = Math.min(rect.bottom + 6, window.innerHeight - popup.offsetHeight - 10);
        top = Math.max(10, top);
    }

    left = Math.min(window.innerWidth - popup.offsetWidth - 10, Math.max(10, left));
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
}

// ===== ОБНОВЛЕНИЕ ОТОБРАЖЕНИЯ ЦВЕТА В ОКНЕ =====
function updateImportColorDisplay() {
    const box = document.getElementById('importColorBox');
    const nameEl = document.getElementById('importColorName');
    if (!box || !nameEl) return;

    const tableId = getTableId(currentNodeId);
    const colors = colorsPerNode[tableId] || [];
    const color = colors.find(c => c.id === selectedColorId);
    if (color) {
        box.style.background = color.color;
        nameEl.textContent = color.name || 'Без имени';
    }
}
// ===== ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЯЧЕЙКИ ПЕРЕД СОЗДАНИЕМ МУЛЬТИЦВЕТА =====
function getOrCreateMultiColorForCell(nodeId, row, col, colorId, percent) {
    const tableId = getTableId(nodeId);
    const matrix = cellStorage[tableId];
    if (!matrix) return null;

    const currentPid = matrix[row][col];
    const colors = colorsPerNode[tableId] || [];

    // Если ячейка пустая — создаём новый мультицвет
    if (currentPid === null) {
     const newId = createMultiColor(
    nodeId,
    'Смесь',
    [{ colorId: colorId, share: percent }],
    [percent]
);
return newId;
    }

    // Если ячейка уже содержит мультицвет — создаём копию и добавляем второй цвет
    const existingColor = colors.find(c => c.id === currentPid);
    if (existingColor && existingColor.type === 'multi') {
        const newId = nextColorId++;
        const newColor = {
            id: newId,
            name: 'Смесь',
            type: 'multi',
            components: existingColor.components.map(comp => ({
                colorId: comp.colorId,
                share: comp.share
            })),
            boundaries: existingColor.boundaries ? [...existingColor.boundaries] : []
        };
        colors.push(newColor);

        newColor.components.push({ colorId: colorId, share: percent });
        let sum = 0;
        const newBoundaries = [];
        for (const comp of newColor.components) {
            sum += comp.share;
            newBoundaries.push(sum);
        }
        newColor.boundaries = newBoundaries;

        return newId;
    }

    // Если ячейка содержит что-то другое (не должно случаться)
    return null;
}
// ===== ДЕДУПЛИКАЦИЯ МУЛЬТИЦВЕТОВ =====
function deduplicateMultiColors(nodeId) {
    const tableId = getTableId(nodeId);
    const colors = colorsPerNode[tableId] || [];
    const matrix = cellStorage[tableId];
    if (!matrix) return;

    const multiColors = colors.filter(c => c.type === 'multi');
    if (multiColors.length === 0) return;

    // Группируем по содержимому
    const groups = {};
    for (const color of multiColors) {
        const key = color.components
            .map(comp => `${comp.colorId}:${comp.share}`)
            .sort()
            .join('|');
        if (!groups[key]) groups[key] = [];
        groups[key].push(color);
    }

    for (const key of Object.keys(groups)) {
        const group = groups[key];
        if (group.length <= 1) continue;

        // Оставляем мультицвет с наименьшим ID
        const keeper = group.reduce((a, b) => a.id < b.id ? a : b);

        // Заменяем все ячейки, которые ссылаются на дубли, на keeper
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                const pid = matrix[i][j];
                if (pid === null) continue;
                const isDuplicate = group.some(c => c.id === pid && c.id !== keeper.id);
                if (isDuplicate) {
                    matrix[i][j] = keeper.id;
                }
            }
        }

        // Удаляем дубли из colorsPerNode
        for (const dup of group) {
            if (dup.id !== keeper.id) {
                const idx = colors.indexOf(dup);
                if (idx !== -1) colors.splice(idx, 1);
            }
        }
    }

    renderAllColors(nodeId, true);
}
// ===== УДАЛЕНИЕ НЕИСПОЛЬЗУЕМЫХ МУЛЬТИЦВЕТОВ =====
function removeUnusedMultiColors(nodeId) {
    const tableId = getTableId(nodeId);
    const matrix = cellStorage[tableId];
    if (!matrix) return;

    const colors = colorsPerNode[tableId] || [];
    const multiColors = colors.filter(c => c.type === 'multi');
    if (multiColors.length === 0) return;

    const usedColorIds = new Set();
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const pid = matrix[i][j];
            if (pid !== null) usedColorIds.add(pid);
        }
    }

    let removedCount = 0;
    for (const color of multiColors) {
        if (!usedColorIds.has(color.id)) {
            const idx = colors.indexOf(color);
            if (idx !== -1) {
                colors.splice(idx, 1);
                removedCount++;
            }
        }
    }

    if (removedCount > 0) {
        console.log(`🗑️ Удалено ${removedCount} неиспользуемых мультицветов`);
        renderAllColors(nodeId, true);
    }
}
// ===== ПРИВЯЗКА К КНОПКЕ =====
document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('importRangeBtn');
    if (btn) {
        btn.addEventListener('click', showImportWindow);
    }
});