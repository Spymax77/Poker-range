// ===== clipboard.js -- extracted from all.js (copy/paste/duplicate range) =====
// ===== ДУБЛИРОВАНИЕ ДИАПАЗОНА =====
function duplicateRange(nodeId) {
    const original = getNode(nodeId);
    if (!original) return;

    // ===== 1. ПРОВЕРКА НА НЕСОХРАНЁННЫЕ ИЗМЕНЕНИЯ =====
    if (App.state.hasUnsavedChanges) {
        const node = getNode(App.state.currentNodeId);
        const message = node
            ? `Диапазон <span style="color: #D4AF37; font-weight: 600;">${escapeHtml(node.name)}</span> был отредактирован. Сохранить изменения?`
            : 'Сохранить изменения?';

        showSaveConfirmModal(message, function() {
            // ДА — сохраняем
            persistAll();
            clearUnsaved();
            createCopyAndFinalize(original);
        }, function() {
            // НЕТ — откатываем
            loadFromStorage();
            refreshAll();
            updateCurrentDisplay();
            clearUnsaved();
            createCopyAndFinalize(original);
        });
        return;
    }

    // ===== 2. ЕСЛИ ИЗМЕНЕНИЙ НЕТ — СОЗДАЁМ КОПИЮ =====
    createCopyAndFinalize(original);
}

// ===== СОЗДАНИЕ КОПИИ ДИАПАЗОНА =====
function createCopyAndFinalize(original) {
    // ===== 1. Генерируем уникальное имя =====
    const parent = getNode(original.parentId);
    let siblings = [];
    if (parent) {
        siblings = parent.childrenIds.map(id => getNode(id)).filter(n => n);
    } else {
        siblings = App.state.nodes.filter(n => n.parentId === null);
    }

    const existingNames = siblings.filter(n => n.type === 'range').map(n => n.name);
    let newName = `${original.name} - дубль`;
    let counter = 2;
    while (existingNames.includes(newName)) {
        newName = `${original.name} - дубль (${counter})`;
        counter++;
    }

    // ===== 2. Создаём новый узел =====
    const newId = App.state.nextNodeId++;
    const newNode = {
    id: newId,
    name: newName,
    parentId: original.parentId,
    childrenIds: [],
    type: original.type   // ← сохраняем исходный тип ('range' или 'subrange')
};
    addNode(newNode);

    if (parent) {
        parent.childrenIds.push(newId);
    }

    // ===== 3. Копируем данные =====
    const sourceId = getTableId(original.id);
    const targetId = getTableId(newId);

    // 3.1 Копируем матрицу
    const originalTable = App.state.cellStorage[sourceId];
    ensureTable(newId);
    const newTable = App.state.cellStorage[targetId];

    // 3.2 Копируем все цвета (и простые, и мульти) с созданием colorMap
    const sourceColors = getColorsForNode(original.id);
    const targetColors = [];
    const colorMap = {};

    for (const color of sourceColors) {
        const newColorId = App.state.nextColorId++;
        const newColor = {
            id: newColorId,
            name: color.name,
            type: color.type
        };

        if (color.type === 'simple' || (!color.type && color.color)) {
            newColor.color = color.color;
        } else if (color.type === 'multi' || color.components) {
            newColor.components = color.components ? color.components.map(comp => ({
                colorId: comp.colorId, // пока старый ID, обновим позже
                share: comp.share
            })) : [];
            newColor.boundaries = color.boundaries ? [...color.boundaries] : [];
        }

        targetColors.push(newColor);
        colorMap[color.id] = newColorId;
    }

    // 3.3 Обновляем ссылки в components у мультицветов
    for (const color of targetColors) {
        if (color.type === 'multi' && color.components) {
            color.components = color.components.map(comp => ({
                colorId: colorMap[comp.colorId] || comp.colorId,
                share: comp.share
            }));
        }
    }

    App.state.colorsPerNode[targetId] = targetColors;

    // 3.4 Копируем активный элемент
    const activeId = getActiveForNode(original.id);
    if (activeId && colorMap[activeId]) {
        App.state.activePerNode[targetId] = colorMap[activeId];
    }

    // 3.5 Копируем матрицу с обновлёнными ID
    if (originalTable) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                const oldPid = originalTable[i][j];
                if (oldPid !== null && oldPid !== undefined) {
                    newTable[i][j] = colorMap[oldPid] || oldPid;
                } else {
                    newTable[i][j] = null;
                }
            }
        }
    }

    // ===== 4. Сохраняем и активируем =====
    persistAll();
    refreshAll();
    selectNode(newId);
    updateCurrentDisplay();

    const newNodeFinal = getNode(newId);
    if (newNodeFinal) {
        
    }
}
// ===== КОПИРОВАНИЕ ДИАПАЗОНА В БУФЕР =====
function copyRange(nodeId) {
    const node = getNode(nodeId);
    if (!node) {
        showFloatingModal('Диапазон не найден');
        return;
    }

    if (node.type !== 'range' && node.type !== 'subrange') {
        showFloatingModal('Можно копировать только диапазоны');
        return;
    }

    const tableId = getTableId(nodeId);
    
    // Копируем матрицу (глубокое копирование)
    const matrix = App.state.cellStorage[tableId];
    let copiedMatrix = null;
    if (matrix) {
        copiedMatrix = matrix.map(row => [...row]);
    }

    // Копируем цвета (профили)
    const colors = App.state.colorsPerNode[tableId] || [];
    const copiedColors = JSON.parse(JSON.stringify(colors));

    // Копируем активный цвет
    const activeId = App.state.activePerNode[tableId] || null;

    // Сохраняем в буфер
    App.state.clipboardRangeData = {
        matrix: copiedMatrix,
        colors: copiedColors,
        activeId: activeId,
        sourceNodeId: nodeId,
        sourceName: node.name
    };

    
    
    // Обновляем меню (активируем кнопку "Вставить")
    updatePasteButtonState();
	refreshAll();
}

// ===== ВСТАВКА ДИАПАЗОНА ИЗ БУФЕРА =====
function pasteRange(nodeId) {
    if (!App.state.clipboardRangeData) {
        showFloatingModal('Нет скопированного диапазона');
        return;
    }

    const targetNode = getNode(nodeId);
    if (!targetNode) {
        showFloatingModal('Целевой диапазон не найден');
        return;
    }

    if (targetNode.type !== 'range' && targetNode.type !== 'subrange') {
        showFloatingModal('Вставлять можно только в диапазоны');
        return;
    }

    const targetTableId = getTableId(nodeId);
    
    // Проверяем, пустой ли целевой диапазон
    const targetMatrix = App.state.cellStorage[targetTableId];
    let isTargetEmpty = true;
    if (targetMatrix) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                if (targetMatrix[i][j] !== null) {
                    isTargetEmpty = false;
                    break;
                }
            }
            if (!isTargetEmpty) break;
        }
    }

    // Если диапазон не пустой — показываем подтверждение
    if (!isTargetEmpty) {
        showSaveConfirmModal(
            `Диапазон «${escapeHtml(targetNode.name)}» не пустой. Вставить новые данные?`,
            function() {
                // ДА — выполняем вставку
                executePaste(nodeId);
            },
            function() {
                // НЕТ — ничего не делаем
            }
        );
        return;
    }

    // Если пустой — сразу вставляем
    executePaste(nodeId);
}

// ===== ВЫПОЛНЕНИЕ ВСТАВКИ =====
function executePaste(nodeId) {
    if (!App.state.clipboardRangeData) return;

    const targetTableId = getTableId(nodeId);
    
    // 1. Копируем цвета с новыми ID и создаем colorMap
    const sourceColors = App.state.clipboardRangeData.colors || [];
    const newColors = [];
    const colorMap = {};

    for (const color of sourceColors) {
        const newId = App.state.nextColorId++;
        const newColor = {
            id: newId,
            name: color.name,
            type: color.type
        };

        if (color.type === 'simple' || (!color.type && color.color)) {
            newColor.color = color.color;
        } else if (color.type === 'multi' || color.components) {
            newColor.components = color.components ? color.components.map(comp => ({
                colorId: comp.colorId,
                share: comp.share
            })) : [];
            newColor.boundaries = color.boundaries ? [...color.boundaries] : [];
        }

        newColors.push(newColor);
        colorMap[color.id] = newId;  // ← запоминаем соответствие старый ID → новый ID
    }

    // 2. Обновляем ссылки в компонентах мультицветов
    for (const color of newColors) {
        if (color.type === 'multi' && color.components) {
            color.components = color.components.map(comp => ({
                colorId: colorMap[comp.colorId] || comp.colorId,
                share: comp.share
            }));
        }
    }

    // 3. Сохраняем новые цвета
    App.state.colorsPerNode[targetTableId] = newColors;

    // 4. Вставляем матрицу с ОБНОВЛЕННЫМИ ID (через colorMap)
    ensureTable(nodeId);
    const targetMatrix = App.state.cellStorage[targetTableId];
    
    if (App.state.clipboardRangeData.matrix) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                const oldId = App.state.clipboardRangeData.matrix[i]?.[j];
                if (oldId !== null && oldId !== undefined) {
                    // ✅ ЗАМЕНЯЕМ СТАРЫЙ ID НА НОВЫЙ
                    targetMatrix[i][j] = colorMap[oldId] || null;
                } else {
                    targetMatrix[i][j] = null;
                }
            }
        }
    }

    // 5. Восстанавливаем активный цвет
    if (App.state.clipboardRangeData.activeId && colorMap[App.state.clipboardRangeData.activeId]) {
        App.state.activePerNode[targetTableId] = colorMap[App.state.clipboardRangeData.activeId];
    } else {
        // Если активного нет или он не найден — устанавливаем первый цвет
        const firstColor = newColors.find(c => c.type === 'simple' || (!c.type && c.color));
        if (firstColor) {
            App.state.activePerNode[targetTableId] = firstColor.id;
        }
    }

    // 6. Сохраняем данные и делаем диапазон активным
    
    
    // 👇 ДЕЛАЕМ ДИАПАЗОН АКТИВНЫМ
    selectNode(nodeId);
    
    // 7. Обновляем интерфейс
    refreshAll();
    updateCurrentDisplay();
    markUnsaved();

    const targetName = getNode(nodeId)?.name || 'диапазон';
     App.state.clipboardRangeData = null;
     updatePasteButtonState();
}

// ===== ПРОВЕРКА, ЕСТЬ ЛИ ДАННЫЕ В БУФЕРЕ =====
function hasClipboardData() {
    return App.state.clipboardRangeData !== null;
}
// ===== ОБНОВЛЕНИЕ СОСТОЯНИЯ КНОПКИ "ВСТАВИТЬ" =====
// Гашение вынесено в класс .toolbar-btn-disabled (styles/components.css), тем же
// классом гасятся остальные кнопки редактирования в режиме анализа конструктора
// (см. updateConstructorToolbarState в grid.js).
function updatePasteButtonState() {
    const pasteBtn = document.getElementById('tablePasteBtn');
    if (!pasteBtn) return;

    // В режиме анализа конструктора вставка запрещена наравне с остальными
    // кнопками редактирования, поэтому режим проверяем раньше буфера обмена:
    // иначе copyRange() / refreshAll() снова "зажгли" бы кнопку.
    if (App.state.analysisMode) {
        pasteBtn.classList.add('toolbar-btn-disabled');
        pasteBtn.title = '';
        return;
    }

    const hasData = hasClipboardData();
    pasteBtn.classList.toggle('toolbar-btn-disabled', !hasData);
    pasteBtn.title = hasData ? 'Вставить диапазон' : 'Сначала скопируйте диапазон';
}

