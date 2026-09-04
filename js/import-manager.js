// ===== КАРТА РУК (рука → координаты) =====
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

// ===== КОНВЕРТЕР: 4d4c → 44, AcKc → AKs, AcKd → AKo =====
function convertToShortHand(handWithSuits) {
    if (/^[2-9TJQKA]{1,2}[so]?$/.test(handWithSuits)) {
        return handWithSuits;
    }

    const parts = handWithSuits.match(/([2-9TJQKA])([cdhs])([2-9TJQKA])([cdhs])/);
    if (!parts) return handWithSuits;

    const rank1 = parts[1];
    const suit1 = parts[2];
    const rank2 = parts[3];
    const suit2 = parts[4];

    const rankOrder = '23456789TJQKA';

    if (rank1 === rank2) {
        return rank1 + rank1;
    }

    if (suit1 === suit2) {
        const sorted = rankOrder.indexOf(rank1) > rankOrder.indexOf(rank2) 
            ? rank1 + rank2 
            : rank2 + rank1;
        return sorted + 's';
    }

    const sorted = rankOrder.indexOf(rank1) > rankOrder.indexOf(rank2) 
        ? rank1 + rank2 
        : rank2 + rank1;
    return sorted + 'o';
}

// ===== НОРМАЛИЗАЦИЯ: объединяет комбинации одной руки со средним арифметическим =====
function normalizeHands(text) {
    const items = text.split(',').map(s => s.trim());
    const parsed = [];
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
        if (hand) parsed.push({ hand, freq });
    }

    const groups = {};
    for (const item of parsed) {
        const shortHand = convertToShortHand(item.hand);
        if (!groups[shortHand]) {
            groups[shortHand] = { frequencies: [], count: 0 };
        }
        groups[shortHand].frequencies.push(item.freq);
        groups[shortHand].count++;
    }

    const result = [];
    for (const shortHand of Object.keys(groups)) {
        const group = groups[shortHand];
        const sum = group.frequencies.reduce((a, b) => a + b, 0);
        const avg = sum / group.frequencies.length;
        const roundedAvg = Math.round(avg * 10000) / 10000;
        result.push({ hand: shortHand, freq: roundedAvg });
    }

    return result;
}

// ===== ПАРСИНГ ТЕКСТА (с частотами) =====
function parseHandsWithFrequencies(text) {
    const normalized = normalizeHands(text);
    const groups = {};
    for (const item of normalized) {
        const key = item.freq;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item.hand);
    }
    const result = [];
    for (const freq of Object.keys(groups)) {
        for (const hand of groups[freq]) {
            result.push({ hand, freq: parseFloat(freq) });
        }
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

    const currentNode = getNode(nodeId);
    const isSubrange = currentNode && currentNode.type === 'subrange';

    const overwriteCheck = document.getElementById('importOverwriteCheck');
    if (overwriteCheck && overwriteCheck.checked) {
        const tid = getTableId(nodeId);
        if (App.state.cellStorage[tid]) {
            for (let i = 0; i < 13; i++) {
                for (let j = 0; j < 13; j++) {
                    App.state.cellStorage[tid][i][j] = null;
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

        if (isSubrange) {
            for (const hand of hands) {
                const coords = handMap[hand];
                if (!coords) {
                    console.warn(`Рука не найдена в матрице: ${hand}`);
                    continue;
                }

                const [row, col] = coords;

                // Свободное пространство ячейки (100% минус высота оверлея).
                // Считается так же, как при отрисовке сетки (см. renderGrid в grid.js):
                // каскадный (recursive = true) процент доступности ячейки в цепочке
                // родительских поддиапазонов. Если оверлея нет — доступность 100%,
                // свободное пространство = 100%.
                const freeSpace = getCellAvailabilityPercent(nodeId, row, col, true);

                if (freeSpace <= 0) {
                    continue;
                }

                // условная_вероятность = freq / (свободное_пространство / 100)
                // (свободное_пространство здесь — проценты 0..100, как availabilityPercent;
                // что эквивалентно (freq × 100) / свободное_пространство)
                const normalizedFreq = Math.round((freq / (freeSpace / 100)) * 1000) / 1000;

                if (normalizedFreq <= 0) {
                    continue;
                }

                let finalColorId;

                const tid = getTableId(nodeId);
                const matrix = App.state.cellStorage[tid];
                const currentPid = matrix ? matrix[row][col] : null;

                if (normalizedFreq >= 1) {
                    if (currentPid === null) {
                        finalColorId = colorId;
                    } else {
                        finalColorId = getOrCreateMultiColorForCell(nodeId, row, col, colorId, 100);
                        if (finalColorId === null) {
                            console.warn(`Не удалось создать мультицвет для ${hand}`);
                            continue;
                        }
                    }
                } else {
                    const percent = Math.round(normalizedFreq * 1000) / 10;
                    if (percent === 0) {
                        continue;
                    }

                if (currentPid === null) {
    // Если процент >= 99, создаём простой цвет вместо мультицвета
    if (percent >= 99) {
        finalColorId = colorId;
    } else {
        const cacheKey = 'sub_' + normalizedFreq;
        if (!multiColorMap[cacheKey]) {
            const newId = createMultiColor(
                nodeId,
                'Смесь',
                [{ colorId: colorId, share: percent }],
                [percent]
            );
            multiColorMap[cacheKey] = newId;
            finalColorId = newId;
        } else {
            finalColorId = multiColorMap[cacheKey];
        }
    }
}
				 
				 else {
    // Ячейка не пустая — добавляем второй/последующий цвет с нормированным процентом
    // Ограничиваем процент до 100, чтобы избежать переполнения
    const safePercent = Math.min(100, percent);
    finalColorId = getOrCreateMultiColorForCell(nodeId, row, col, colorId, safePercent);
    if (finalColorId === null) {
        console.warn(`Не удалось создать мультицвет для ${hand}`);
        continue;
    }
}
                }

                setCellProfile(nodeId, row, col, finalColorId);
                paintedCount++;
            }
        } else {
            let targetColorId;

            if (freq === 1.0) {
                targetColorId = colorId;
            } else {
                const percent = Math.round(freq * 1000) / 10;

                if (percent === 0) {
                    continue;
                }

             if (!multiColorMap[freqKey]) {
    // Если процент = 99, создаём простой цвет вместо мультицвета
    if (percent >= 99) {
        targetColorId = colorId;
    } else {
        const newId = createMultiColor(
            nodeId,
            'Смесь',
            [{ colorId: colorId, share: percent }],
            [percent]
        );
        multiColorMap[freqKey] = newId;
        targetColorId = newId;
    }
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
                        const percent = Math.round(freq * 1000) / 10;

                        const tid = getTableId(nodeId);
                        const matrix = App.state.cellStorage[tid];
                        const currentPid = matrix ? matrix[row][col] : null;

                        if (currentPid === null) {
                            finalColorId = targetColorId;
                        } else {
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
    }

    renderAllColors(nodeId, true);
    refreshAll();
    updateCurrentDisplay();
    markUnsaved();

    deduplicateMultiColors(nodeId);
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
            <!-- ПЕРВОЕ ПОЛЕ -->
            <div class="import-field-group">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                    <div class="import-color-selector" style="display: flex; align-items: center; gap: 10px; cursor: pointer;" id="importColorSelector1">
                        <div id="importColorBox1" style="width: 36px; height: 36px; border-radius: 4px; border: 1px solid #3d3f46; background: #9C5479;"></div>
                        <span id="importColorName1" style="color: #e5eaf0; font-size: 16px;">action</span>
                    </div>
                    <span style="color: #8a848a; font-size: 14px;">Цвет 1</span>
                </div>
                <textarea id="importTextarea1" class="import-textarea" style="height: 150px; width: 100%;" placeholder="Вставьте руки для первого цвета..."></textarea>
                <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px; padding-left: 4px;">
                    <input type="checkbox" id="importOverwriteCheck">
                    <label for="importOverwriteCheck" style="color: #a9afb5; font-size: 15px; cursor: pointer;">Перезаписать текущий диапазон</label>
                </div>
            </div>

            <!-- ВТОРОЕ ПОЛЕ -->
            <div class="import-field-group" style="margin-top: 16px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                    <div class="import-color-selector" style="display: flex; align-items: center; gap: 10px; cursor: pointer;" id="importColorSelector2">
                        <div id="importColorBox2" style="width: 36px; height: 36px; border-radius: 4px; border: 1px solid #3d3f46; background: #79A65A;"></div>
                        <span id="importColorName2" style="color: #e5eaf0; font-size: 16px;">call</span>
                    </div>
                    <span style="color: #8a848a; font-size: 14px;">Цвет 2 (опционально)</span>
                </div>
                <textarea id="importTextarea2" class="import-textarea" style="height: 150px; width: 100%;" placeholder="Вставьте руки для второго цвета (оставьте пустым, если не нужно)..."></textarea>
            </div>
        </div>
        <div class="save-confirm-actions" style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px; border-top: 1px solid #3d3f46; padding-top: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
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

// ===== ХОТКЕИ 1/2: ВСТАВКА ИЗ БУФЕРА ОБМЕНА В ОКНО ИМПОРТА =====
// Работают только когда фокус НЕ находится в текстовом поле
// (то есть в поле нет мигающего курсора). Как только пользователь
// кликает в textarea и активирует ввод текста, хоткеи отключаются
// автоматически — потому что document.activeElement становится TEXTAREA.
async function handleImportHotkeys(e) {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key !== '1' && e.key !== '2') return;

    e.preventDefault();

    const textareaId = e.key === '1' ? 'importTextarea1' : 'importTextarea2';
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    try {
        const clipboardText = await navigator.clipboard.readText();
        if (!clipboardText) {
            showFloatingModal('Буфер обмена пуст');
            return;
        }
        textarea.value = clipboardText;
    } catch (err) {
        console.warn('Не удалось прочитать буфер обмена:', err);
        showFloatingModal('❌ Не удалось прочитать буфер обмена. Разрешите доступ к буферу обмена в браузере.');
    }
}

// ===== ПОКАЗ ОКНА ИМПОРТА =====
function showImportWindow() {
    // В режиме анализа импорт запрещён: кнопка #importRangeBtn погашена классом
    // .toolbar-btn-disabled, но showImportWindow вызывается ещё и напрямую
    // (userscript открывает окно программным importBtn.click()), поэтому режим
    // проверяем и здесь.
    if (App.state.analysisMode) return;

    if (App.state.importWindowInstance) {
        App.state.importWindowInstance.remove();
        App.state.importWindowInstance = null;
    }

    const savedNodeId = App.state.currentNodeId;
    const { overlay, modal } = createImportWindow();
    App.state.importWindowInstance = overlay;

    const header = modal.querySelector('#importHeader');
    makeDraggable(modal, header);

    // ===== ХОТКЕИ 1/2 ДЛЯ ВСТАВКИ ИЗ БУФЕРА ОБМЕНА =====
    // Активны, только когда фокус НЕ находится в одном из текстовых полей
    // (то есть курсор для ввода текста не мигает внутри поля).
    document.addEventListener('keydown', handleImportHotkeys);

    // ===== УСТАНАВЛИВАЕМ ЦВЕТА ДЛЯ ОБОИХ ПОЛЕЙ =====
    const tableId = getTableId(App.state.currentNodeId);
    const colors = App.state.colorsPerNode[tableId] || [];
    const simpleColors = colors.filter(c => c.type === 'simple' || (!c.type && c.color));

    // Проверяем, есть ли цвета в палитре
    if (simpleColors.length === 0) {
        showFloatingModal('❌ Сначала создайте хотя бы один цвет в палитре');
        App.state.importWindowInstance.remove();
        App.state.importWindowInstance = null;
        return;
    }

    // Цвет 1 — первый простой цвет
    const color1 = simpleColors[0];
    App.state.selectedColorId1 = color1.id;
    updateImportColorDisplay(1, color1.color, color1.name);

    // Цвет 2 — второй простой цвет (если есть), иначе тот же первый
    const color2 = simpleColors[1] || color1;
    App.state.selectedColorId2 = color2.id;
    updateImportColorDisplay(2, color2.color, color2.name);

    // ===== ОБРАБОТЧИКИ ДЛЯ ВЫБОРА ЦВЕТОВ =====
    modal.querySelector('#importColorSelector1').addEventListener('click', function(e) {
        e.stopPropagation();
        showColorPickerForImport(1, document.getElementById('importColorBox1'));
    });
    modal.querySelector('#importColorSelector2').addEventListener('click', function(e) {
        e.stopPropagation();
        showColorPickerForImport(2, document.getElementById('importColorBox2'));
    });

    // ===== ЗАКРЫТИЕ ОКНА =====
    function closeWindow() {
        if (window._importCheckInterval) {
            clearInterval(window._importCheckInterval);
            window._importCheckInterval = null;
        }
        document.removeEventListener('keydown', handleImportHotkeys);
        if (App.state.importWindowInstance) {
            App.state.importWindowInstance.remove();
            App.state.importWindowInstance = null;
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
        if (App.state.currentNodeId !== savedNodeId) closeWindow();
    }, 200);

    // ===== КНОПКА "ИМПОРТИРОВАТЬ" =====
    modal.querySelector('#importApplyBtn').addEventListener('click', function() {
        const text1 = document.getElementById('importTextarea1').value.trim();
        const text2 = document.getElementById('importTextarea2').value.trim();

        if (!text1 && !text2) {
            showFloatingModal('Вставьте данные хотя бы в одно поле');
            return;
        }

        // Первый импорт (всегда)
        if (text1) {
            applyImportToMatrix(App.state.currentNodeId, text1, App.state.selectedColorId1);
        }

        // Второй импорт (если есть текст во втором поле)
        if (text2) {
            // Временно отключаем чекбокс перезаписи для второго импорта
            const overwriteCheck = document.getElementById('importOverwriteCheck');
            const overwriteState = overwriteCheck ? overwriteCheck.checked : false;
            if (overwriteCheck) overwriteCheck.checked = false;
            
            applyImportToMatrix(App.state.currentNodeId, text2, App.state.selectedColorId2);
            
            // Восстанавливаем состояние чекбокса
            if (overwriteCheck) overwriteCheck.checked = overwriteState;
        }

        closeWindow();
    });

    // Автофокус на первое поле убран специально: пока курсор не мигает
    // ни в одном из полей, работают хоткеи 1/2 для вставки из буфера.
}

// ===== ВЫБОР ЦВЕТА В ОКНЕ ИМПОРТА =====
function showColorPickerForImport(index, anchor) {
    const tableId = getTableId(App.state.currentNodeId);
    const colors = App.state.colorsPerNode[tableId] || [];
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
            if (index === 1) {
                App.state.selectedColorId1 = color.id;
                updateImportColorDisplay(1, color.color, color.name);
            } else {
                App.state.selectedColorId2 = color.id;
                updateImportColorDisplay(2, color.color, color.name);
            }
            popup.remove();
        });

        popup.appendChild(opt);
    }

    document.body.appendChild(popup);

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
function updateImportColorDisplay(index, color, name) {
    const box = document.getElementById('importColorBox' + index);
    const nameEl = document.getElementById('importColorName' + index);
    if (!box || !nameEl) return;

    box.style.background = color || '#9C5479';
    nameEl.textContent = name || 'Цвет';
}

// ===== ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЯЧЕЙКИ ПЕРЕД СОЗДАНИЕМ МУЛЬТИЦВЕТА =====
function getOrCreateMultiColorForCell(nodeId, row, col, colorId, percent) {
    const tableId = getTableId(nodeId);
    const matrix = App.state.cellStorage[tableId];
    if (!matrix) return null;

    const currentPid = matrix[row][col];
    const colors = App.state.colorsPerNode[tableId] || [];

    if (currentPid === null) {
        const newId = createMultiColor(
            nodeId,
            'Смесь',
            [{ colorId: colorId, share: percent }],
            [percent]
        );
        return newId;
    }

    const existingColor = colors.find(c => c.id === currentPid);
    if (existingColor && existingColor.type === 'multi') {
        const newId = App.state.nextColorId++;
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

     // Добавляем новый компонент
newColor.components.push({ colorId: colorId, share: percent });

// ===== ОГРАНИЧИВАЕМ СУММУ ДО 100% =====
let sum = 0;
const newBoundaries = [];
for (const comp of newColor.components) {
    sum += comp.share;
    // Если сумма превышает 100, обрезаем последний компонент
    if (sum > 100) {
        // Уменьшаем долю последнего компонента, чтобы сумма стала 100
        const diff = sum - 100;
        const lastComp = newColor.components[newColor.components.length - 1];
        lastComp.share = Math.max(0, lastComp.share - diff);
        sum = 100;
        // Пересчитываем boundaries
        newBoundaries.length = 0;
        let newSum = 0;
        for (const comp of newColor.components) {
            newSum += comp.share;
            newBoundaries.push(newSum);
        }
        break;
    }
    newBoundaries.push(sum);
}
newColor.boundaries = newBoundaries;

        return newId;
    }

    return null;
}

// ===== ДЕДУПЛИКАЦИЯ МУЛЬТИЦВЕТОВ =====
function deduplicateMultiColors(nodeId) {
    const tableId = getTableId(nodeId);
    const colors = App.state.colorsPerNode[tableId] || [];
    const matrix = App.state.cellStorage[tableId];
    if (!matrix) return;

    const multiColors = colors.filter(c => c.type === 'multi');
    if (multiColors.length === 0) return;

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

        const keeper = group.reduce((a, b) => a.id < b.id ? a : b);

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
    const matrix = App.state.cellStorage[tableId];
    if (!matrix) return;

    const colors = App.state.colorsPerNode[tableId] || [];
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