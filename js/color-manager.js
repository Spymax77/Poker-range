// ============================================================
// color-manager.js — НОВАЯ АРХИТЕКТУРА (ВСЁ В ОДНОМ СПИСКЕ)
// ============================================================

// ===== СТРУКТУРЫ ДАННЫХ =====
let colorsPerNode = {};       // { "node_1": [ {id, name, color, type, components?}, ... ] }
let activePerNode = {};       // { "node_1": id, "node_2": null } — ОДИН активный на диапазон

let nextColorId = 1;

// Вспомогательный Map для хранения ссылок на DOM-элементы профилей
let profileRefs = new Map();

// ============================================================
// ФУНКЦИИ ДОСТУПА
// ============================================================

function getColorsForNode(nodeId) {
    const tableId = getTableId(nodeId);
    if (!tableId) return [];
    return colorsPerNode[tableId] || [];
}
function getSimpleColors(nodeId) {
    const all = getColorsForNode(nodeId);
    return all.filter(c => c.type === 'simple' || (!c.type && c.color));
}
function setColorsForNode(nodeId, colors) {
    const tableId = getTableId(nodeId);
    if (!tableId) return;
    colorsPerNode[tableId] = colors;
}

function getActiveForNode(nodeId) {
    const tableId = getTableId(nodeId);
    if (!tableId) return null;
    return activePerNode[tableId] || null;
}

function setActiveForNode(nodeId, colorId) {
    const tableId = getTableId(nodeId);
    if (!tableId) return;
    if (colorId === null) {
        delete activePerNode[tableId];
    } else {
        activePerNode[tableId] = colorId;
    }
}


function getMultiColors(nodeId) {
    const all = getColorsForNode(nodeId);
    return all.filter(c => c.type === 'multi' || (c.components && c.components.length > 0));
}

function getGradientStyleFromColorForNode(nodeId, color) {
    if (!color) return '';
    
    if (color.type === 'simple' || (!color.type && color.color)) {
        return `background: ${color.color};`;
    }
    
    if (color.type === 'multi' || color.components) {
        const colorsList = getColorsForNode(nodeId);
        const componentColors = color.components.map(comp => {
            const compColor = colorsList.find(c => c.id === comp.colorId);
            return compColor ? compColor.color : '#3d3d3d';
        });
        const boundaries = color.boundaries || [];
        if (componentColors.length === 0) return '';
        return getGradientStyle(componentColors, boundaries);
    }
    
    return '';
}

// ============================================================
// ФУНКЦИИ ГРАДИЕНТА
// ============================================================

function getPositions(color) {
    let cnt = color.components ? color.components.length : 0;
    if (cnt === 0) return [100];
    let boundaries = color.boundaries || [];
    if (boundaries.length !== cnt) {
        boundaries = [];
        if (cnt === 1) boundaries = [100];
        else if (cnt === 2) boundaries = [50, 100];
        else if (cnt === 3) boundaries = [33, 66, 100];
        color.boundaries = boundaries;
    }
    return boundaries;
}

function getGradientStyle(colors, positions) {
    if (colors.length === 1) {
        let fillPercent = positions[0];
        return `background: linear-gradient(to right, ${colors[0]} 0%, ${colors[0]} ${fillPercent}%, #3d3d3d ${fillPercent}%, #3d3d3d 100%); background-size: 100% 100%; background-repeat: no-repeat;`;
    }
    let stops = [];
    let prev = 0;
    for (let i = 0; i < colors.length; i++) {
        let pos = Math.round(positions[i]);
        stops.push(`${colors[i]} ${prev}%, ${colors[i]} ${pos}%`);
        prev = pos;
    }
    let lastPos = positions[positions.length - 1];
    if (lastPos < 100) {
        stops.push(`#3d3d3d ${lastPos}%, #3d3d3d 100%`);
    }
    return `background: linear-gradient(to right, ${stops.join(', ')}); background-size: 100% 100%; background-repeat: no-repeat;`;
}

function getSliderGradient(color) {
    let r = parseInt(color.slice(1,3), 16);
    let g = parseInt(color.slice(3,5), 16);
    let b = parseInt(color.slice(5,7), 16);
    let darkR = Math.floor(r * 0.7);
    let darkG = Math.floor(g * 0.7);
    let darkB = Math.floor(b * 0.7);
    let darkColor = `rgb(${darkR}, ${darkG}, ${darkB})`;
    return `linear-gradient(145deg, ${darkColor}, ${color})`;
}

function getContrast(hex) {
    if (!hex || !hex.startsWith('#')) return 'white';
    let r = parseInt(hex.slice(1,3),16);
    let g = parseInt(hex.slice(3,5),16);
    let b = parseInt(hex.slice(5,7),16);
    return (0.299*r + 0.587*g + 0.114*b) > 140 ? '#1e2024' : '#ffffff';
}

// ============================================================
// СОЗДАНИЕ И УДАЛЕНИЕ
// ============================================================

function createSimpleColor(nodeId, name, hex) {
    const tableId = getTableId(nodeId);
    if (!tableId) return null;
    if (!colorsPerNode[tableId]) colorsPerNode[tableId] = [];
    
    const newId = nextColorId++;
    
let finalName = name;
if (!finalName) {
    // Считаем только "New action" и "New action N"
    const newActionColors = colorsPerNode[tableId].filter(c => 
        c.name === "New action" || c.name.startsWith("New action ")
    );
    const count = newActionColors.length;
    if (count === 0) {
        finalName = "New action";
    } else {
        finalName = `New action ${count + 1}`;
    }
}
    
    const newColor = {
        id: newId,
        name: finalName,
        color: hex,
        type: 'simple'
    };
    colorsPerNode[tableId].push(newColor);
    
    if (colorsPerNode[tableId].length === 1) {
        setActiveForNode(nodeId, newId);
    }
    
    return newId;
}

function createMultiColor(nodeId, name, components, boundaries) {
    const tableId = getTableId(nodeId);
    if (!tableId) return null;
    if (!colorsPerNode[tableId]) colorsPerNode[tableId] = [];
    
    const newId = nextColorId++;
    const newColor = {
        id: newId,
        name: name || 'Смесь',
        type: 'multi',
        components: components || [],
        boundaries: boundaries || []
    };
    colorsPerNode[tableId].push(newColor);
    
    return newId;
}

function deleteColor(nodeId, colorId) {
    const tableId = getTableId(nodeId);
    if (!tableId) return false;
    const colorsList = colorsPerNode[tableId] || [];
    
    // Проверяем, используется ли цвет в мультицветах
    const isUsed = colorsList.some(c => 
        c.type === 'multi' && c.components && c.components.some(comp => comp.colorId === colorId)
    );
    
    if (isUsed) {
        if (typeof showFloatingModal === 'function') {
            showFloatingModal('Данное действие используется в смеси. Сначала удалите смесь, использующую его.');
        }
        return false;
    }
    
    // Проверяем, используется ли цвет в матрице
    const isUsedInMatrix = isColorUsedInMatrix(nodeId, colorId);
    if (isUsedInMatrix) {
        if (typeof showSaveConfirmModal === 'function') {
            showSaveConfirmModal(
                'Данное действие используется в матрице. Все равно удалить?',
                function() {
                    proceedDeleteColor(nodeId, tableId, colorId);
                },
                function() {}
            );
            return false;
        }
    }
    
    proceedDeleteColor(nodeId, tableId, colorId);
    return true;
}

function proceedDeleteColor(nodeId, tableId, colorId) {
    const colorsList = colorsPerNode[tableId] || [];
    const idx = colorsList.findIndex(c => c.id === colorId);
    if (idx === -1) return;
    
    colorsList.splice(idx, 1);
    
    if (getActiveForNode(nodeId) === colorId) {
        setActiveForNode(nodeId, null);
    }
    
    // Очищаем ячейки, где использовался этот цвет
    const matrix = cellStorage[getTableId(nodeId)];
    if (matrix) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                if (matrix[i][j] === colorId) {
                    matrix[i][j] = null;
                }
            }
        }
    }
    
    renderAllColors(nodeId, true);
    if (typeof refreshAllGrids === 'function') refreshAllGrids();
    if (typeof markUnsaved === 'function') markUnsaved();
}

function isColorUsedInMatrix(nodeId, colorId) {
    const tid = getTableId(nodeId);
    const matrix = cellStorage[tid];
    if (!matrix) return false;
    
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            if (matrix[i][j] === colorId) {
                return true;
            }
        }
    }
    return false;
}

// ============================================================
// РЕНДЕРИНГ (ОБЪЕДИНЁННЫЙ)
// ============================================================

function renderAllColors(nodeId, editable) {
    const simpleContainer = document.getElementById("paletteList");
    const multiContainer = document.getElementById("profileList");
    
    if (!simpleContainer || !multiContainer) return;
    
    profileRefs.clear();
    simpleContainer.innerHTML = '';
    multiContainer.innerHTML = '';
    
    const allColors = getColorsForNode(nodeId);
    const simpleColors = allColors.filter(c => c.type === 'simple' || (!c.type && c.color));
    const multiColors = allColors.filter(c => c.type === 'multi' || (c.components && c.components.length > 0));
    const activeId = getActiveForNode(nodeId);
    
    // Рендерим простые цвета
    simpleColors.forEach((color, index) => {
        const el = renderSimpleColor(nodeId, color, activeId, editable, index);
        simpleContainer.appendChild(el);
    });
    
    // Рендерим мультицветы
    multiColors.forEach((color) => {
        const el = renderMultiColor(nodeId, color, activeId, editable);
        multiContainer.appendChild(el);
    });
    
    updateProfileButtonVisibility();
	
}

function renderSimpleColor(nodeId, color, activeId, editable, index) {
    const div = document.createElement("div");
    div.className = "palette-item";
    div.dataset.colorId = color.id;
    
    // Радио-кнопка
    const radio = document.createElement("div");
    radio.className = `profile-radio ${activeId === color.id ? 'active' : ''}`;
    radio.style.cursor = editable ? "pointer" : "default";
    if (editable) {
        radio.onclick = (e) => {
            e.stopPropagation();
            setActiveForNode(nodeId, color.id);
            renderAllColors(nodeId, true);
            if (typeof markUnsaved === 'function') markUnsaved();
        };
    } else {
        radio.style.opacity = "0.5";
    }
    div.appendChild(radio);
    
    // Цветной квадрат
    const colorBox = document.createElement("div");
    colorBox.className = "palette-color-box";
    colorBox.style.backgroundColor = color.color;
    if (editable) {
        colorBox.onclick = (e) => {
            e.stopPropagation();
            if (typeof openColorPicker === 'function') {
                openColorPicker(color.id, function(newHex) {
                    const colorsList = getColorsForNode(nodeId);
                    const colorToEdit = colorsList.find(c => c.id === color.id);
                    if (colorToEdit) {
                        colorToEdit.color = newHex;
                        colorBox.style.backgroundColor = newHex;
                        renderAllColors(nodeId, true);
                        if (typeof refreshAllGrids === 'function') refreshAllGrids();
                        if (typeof markUnsaved === 'function') markUnsaved();
                    }
                });
            }
        };
    }
    div.appendChild(colorBox);
    
    // Имя
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "palette-name";
    nameInput.value = color.name;
    nameInput.placeholder = "Название действия...";
    nameInput.onchange = (e) => {
        let nn = e.target.value.trim();
        if (nn) {
            color.name = nn;
            if (typeof markUnsaved === 'function') markUnsaved();
        }
    };
    if (!editable) nameInput.disabled = true;
    div.appendChild(nameInput);
    
    // Кнопка удаления
    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "✕";
    removeBtn.className = "remove-palette-btn";
    if (editable) {
        removeBtn.onclick = () => {
            deleteColor(nodeId, color.id);
        };
    } else {
        removeBtn.style.visibility = "hidden";
    }
    div.appendChild(removeBtn);
    
    return div;
}
function generateNameForColor(nodeId, color) {
    const simpleColors = getSimpleColors(nodeId);
    if (!color.components || color.components.length === 0) return '';
    const names = color.components.map(comp => {
        const c = simpleColors.find(s => s.id === comp.colorId);
        return c ? c.name : '?';
    });
    return names.join(' / ');
}
function refreshMultiColorSliders(nodeId, colorId) {
    const colorsList = getColorsForNode(nodeId);
    const color = colorsList.find(c => c.id === colorId);
    if (!color || color.type !== 'multi') return;
    
    const ref = profileRefs.get(colorId);
    if (!ref) return;
    
    const { sliderContainer, minusBtn, plusBtn, radioSpan } = ref;
    const positions = getPositions(color);
    const simpleColors = getSimpleColors(nodeId);
    

    
    // Очищаем старые элементы
    const oldThumbs = sliderContainer.querySelectorAll('.slider-thumb');
    oldThumbs.forEach(th => th.remove());
    const oldFills = sliderContainer.querySelectorAll('.slider-fill-segment');
    oldFills.forEach(el => el.remove());
    
    // Рисуем сегменты заливки
    for (let i = 0; i < color.components.length; i++) {
        const comp = color.components[i];
        const compColor = simpleColors.find(c => c.id === comp.colorId);
        const fillColor = compColor ? compColor.color : '#4a4a50';
        
        const leftPos = i === 0 ? 0 : positions[i - 1];
        const width = positions[i] - leftPos;
        
        const fill = document.createElement("div");
        fill.className = "slider-fill-segment";
        fill.style.position = 'absolute';
        fill.style.top = '80%';
        fill.style.left = leftPos + '%';
        fill.style.width = width + '%';
        fill.style.height = '2px';
        fill.style.background = fillColor;
        sliderContainer.appendChild(fill);
    }
    
    // Рисуем ползунки (ВСЕГДА активные, даже для одного цвета)
    for (let i = 0; i < color.components.length; i++) {
        const thumb = document.createElement("div");
        thumb.className = "slider-thumb";
        thumb.style.left = `${positions[i]}%`;
        
        const percentLabel = document.createElement("span");
        percentLabel.className = "slider-percent";
        percentLabel.textContent = Math.round(positions[i]);
        thumb.appendChild(percentLabel);
        
        // ✅ ВСЕГДА активный ползунок, даже для одного цвета
        thumb.style.pointerEvents = 'auto';
        thumb.style.opacity = '1';
        
        // Клик по ползунку — выбор цвета для компонента
        thumb.onclick = (e) => {
            e.stopPropagation();
            if (!ref.editable) return;
            const simpleColorsList = getSimpleColors(nodeId);
            if (simpleColorsList.length === 0) {
                alert("Сначала создайте простое действие!");
                return;
            }
            showColorPickerForMulti(nodeId, thumb, color, i, ref.editable);
        };
        
        // Перетаскивание ползунка (ВСЕГДА активное)
        if (ref.editable) {
            let dragging = false;
            const onMove = (me) => {
                if (!dragging) return;
                const rect = sliderContainer.getBoundingClientRect();
                let newP = Math.round((me.clientX - rect.left) / rect.width * 100);
                newP = Math.min(100, Math.max(0, newP));
                
                // Ограничения для соседних ползунков
                if (color.components.length > 1) {
                    if (i > 0) newP = Math.max(newP, positions[i-1] + 1);
                    if (i < positions.length - 1) newP = Math.min(newP, positions[i+1] - 1);
                }
                
                if (Math.abs(positions[i] - newP) < 0.5) return;
                positions[i] = newP;
                color.boundaries = positions;
				 if (color.components && color.components.length === positions.length) {
        let prev = 0;
        for (let idx = 0; idx < positions.length; idx++) {
            const b = positions[idx] || 0;
            color.components[idx].share = Math.round(b - prev);
            prev = b;
        }
    }
                refreshMultiColorSliders(nodeId, color.id);
                if (typeof refreshAllGrids === 'function') refreshAllGrids();
                if (typeof markUnsaved === 'function') markUnsaved();
            };
            const up = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', up); };
            
            thumb.onmousedown = (e) => {
                e.preventDefault();
                dragging = true;
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', up);
            };
        }
        
        sliderContainer.appendChild(thumb);
    }
    
    // Обновляем видимость кнопок
    if (minusBtn) {
        minusBtn.style.display = (color.components && color.components.length > 1 && ref.editable) ? 'inline-flex' : 'none';
    }
    if (plusBtn) {
        const canAdd = color.components && color.components.length < 3 && ref.editable;
        plusBtn.style.display = canAdd ? 'inline-flex' : 'none';
    }
    if (radioSpan) {
        const activeId = getActiveForNode(nodeId);
        if (activeId === color.id) {
            radioSpan.classList.add('active');
        } else {
            radioSpan.classList.remove('active');
        }
    }
}
function showColorPickerForMultiAdd(nodeId, anchor, color, editable) {
    if (!editable) return;
    closePopup();
    
    const simpleColors = getSimpleColors(nodeId);
    if (simpleColors.length === 0) return;
    
    const popup = document.createElement("div");
    popup.className = "color-picker-popup";
    
    simpleColors.forEach(simple => {
        const opt = document.createElement("div");
        opt.className = "picker-option";
        
        const swatch = document.createElement("div");
        swatch.className = "picker-swatch";
        swatch.style.backgroundColor = simple.color;
        
        const label = document.createElement("span");
        label.className = "picker-label";
        label.textContent = simple.name;
        
        opt.appendChild(swatch);
        opt.appendChild(label);
        
opt.onclick = () => {
    const newComp = { colorId: simple.id, share: 100 };
    color.components.push(newComp);
    if (!color.boundaries) color.boundaries = [];
    color.boundaries.push(100);

    // === АВТОМАТИЧЕСКИЙ СДВИГ ПОЛЗУНКОВ ===
    for (let i = 0; i < color.boundaries.length - 1; i++) {
        let pos = color.boundaries[i];
        if (pos === 100) {
            let newPos = 90;
            while (color.boundaries.includes(newPos)) {
                newPos++;
            }
            color.boundaries[i] = newPos;
        }
    }
	// Синхронизация share с новыми boundaries
if (color.components && color.components.length === color.boundaries.length) {
    let prev = 0;
    for (let idx = 0; idx < color.boundaries.length; idx++) {
        const b = color.boundaries[idx] || 0;
        color.components[idx].share = b - prev;
        prev = b;
    }
}

    renderAllColors(nodeId, true);
    if (typeof refreshAllGrids === 'function') refreshAllGrids();
    if (typeof markUnsaved === 'function') markUnsaved();
    closePopup();
};
        
        popup.appendChild(opt);
    });
    
    document.body.appendChild(popup);
    
const rect = anchor.getBoundingClientRect();
let left = rect.left + rect.width / 2 - popup.offsetWidth / 2;
let top = rect.bottom + 6;

// ===== ПРОВЕРКА: ПОМЕЩАЕТСЯ ЛИ ПОПАП НА ЭКРАНЕ =====
const spaceBelow = window.innerHeight - rect.bottom - 6;
const spaceAbove = rect.top - 6;

// Если снизу не хватает места, а сверху достаточно — показываем сверху
if (spaceBelow < popup.offsetHeight && spaceAbove > popup.offsetHeight) {
    top = rect.top - popup.offsetHeight - 6;
} else if (spaceBelow < popup.offsetHeight) {
    // Если не хватает места ни сверху, ни снизу — прижимаем к границе
    top = Math.min(rect.bottom + 6, window.innerHeight - popup.offsetHeight - 10);
    top = Math.max(10, top);
}
// ===== КОНЕЦ ПРОВЕРКИ =====

left = Math.min(window.innerWidth - popup.offsetWidth - 10, Math.max(10, left));
popup.style.left = left + 'px';
popup.style.top = top + 'px';
activePopup = popup;
    
    const outside = (e) => {
        if (!popup.contains(e.target)) {
            closePopup();
            document.removeEventListener('click', outside);
        }
    };
    setTimeout(() => document.addEventListener('click', outside), 0);
}
function renderMultiColor(nodeId, color, activeId, editable) {
    const card = document.createElement("div");
    card.className = "profile-card";
    card.dataset.colorId = color.id;
    
    const row = document.createElement("div");
    row.className = "profile-row";
    
    // === 1. РАДИО-КНОПКА ===
    const radio = document.createElement("div");
    radio.className = `profile-radio ${activeId === color.id ? 'active' : ''}`;
    if (editable) {
        radio.onclick = () => {
            setActiveForNode(nodeId, color.id);
            renderAllColors(nodeId, true);
            if (typeof markUnsaved === 'function') markUnsaved();
        };
    } else {
        radio.style.opacity = "0.5";
    }
    row.appendChild(radio);
    
    // === 2. КВАДРАТЫ С ЦВЕТАМИ ===
    const chipsContainer = document.createElement("div");
	chipsContainer.className = "chips-container";
    
    const simpleColors = getSimpleColors(nodeId);
    
    for (let i = 0; i < color.components.length; i++) {
        const comp = color.components[i];
        const compColor = simpleColors.find(c => c.id === comp.colorId);
        const hex = compColor ? compColor.color : '#4a4a50';
        const name = compColor ? compColor.name : '?';
        
        const wrapper = document.createElement("div");
        wrapper.style.position = "relative";
        wrapper.style.display = "inline-flex";
        wrapper.style.alignItems = "center";
        
        const chip = document.createElement("div");
chip.className = "multi-color-chip";  // ← класс вместо инлайн-стилей
chip.style.backgroundColor = hex;     // ← динамический цвет (оставляем)
chip.title = name;
        
        if (editable) {
            chip.onclick = (e) => {
                e.stopPropagation();
                const simpleColorsList = getSimpleColors(nodeId);
                if (simpleColorsList.length === 0) {
                    if (typeof showFloatingModal === 'function') {
                        showFloatingModal("Сначала создайте простое действие!");
                    }
                    return;
                }
                showColorPickerForMulti(nodeId, chip, color, i, editable);
            };
        }
        
        wrapper.appendChild(chip);
        
        // Крестик удаления (если цветов > 1)
        if (i > 0 && editable) {
            const delBtn = document.createElement("button");
delBtn.className = "multi-chip-delete";   // ← только класс
delBtn.innerHTML = "✕";
delBtn.title = "Удалить цвет";
            
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (color.components.length <= 1) return;
                color.components.splice(i, 1);
                color.boundaries.splice(i, 1);
				// Пересчитываем boundaries из оставшихся share
let sum = 0;
const newBoundaries = [];
for (const comp of color.components) {
    sum += comp.share || 0;
    newBoundaries.push(sum);
}
color.boundaries = newBoundaries;
                renderAllColors(nodeId, true);
                if (typeof refreshAllGrids === 'function') refreshAllGrids();
                if (typeof markUnsaved === 'function') markUnsaved();
            };
            
            wrapper.appendChild(delBtn);
        }
        
        chipsContainer.appendChild(wrapper);
    }
    
    // === 3. КНОПКА ДОБАВЛЕНИЯ ЦВЕТА (квадрат с плюсом) ===
    if (editable && color.components.length < 3) {
        const addBtn = document.createElement("button");
        addBtn.className = "multi-add-chip-btn";
		addBtn.textContent = "+";
        addBtn.title = "Добавить цвет";
        
        addBtn.onmouseenter = () => {
            addBtn.style.borderColor = "#d0d0d8";
            addBtn.style.color = "#d0d0d8";
        };
        addBtn.onmouseleave = () => {
            addBtn.style.borderColor = "#8a848a";
            addBtn.style.color = "#8a848a";
        };
        
addBtn.onclick = (e) => {
    e.stopPropagation();
    const simpleColorsList = getSimpleColors(nodeId);
    if (simpleColorsList.length === 0) {
        if (typeof showFloatingModal === 'function') {
            showFloatingModal("Сначала создайте простое действие!");
        }
        return;
    }
    showColorPickerForMultiAdd(nodeId, addBtn, color, editable);
};
        
        chipsContainer.appendChild(addBtn);
    }
    
    row.appendChild(chipsContainer);
    
// === 4. НАЗВАНИЕ (на уровне нижнего края квадратов) ===
const nameSpan = document.createElement("span");
nameSpan.className = "multi-profile-name";
nameSpan.textContent = generateNameForColor(nodeId, color);
// Название над строкой
const nameWrapper = document.createElement("div");
nameWrapper.style.display = "flex";
nameWrapper.style.justifyContent = "center";
nameWrapper.style.width = "100%";
nameWrapper.style.marginBottom = "4px";
nameWrapper.appendChild(nameSpan);
card.appendChild(nameWrapper);
    
// === 5. СЛАЙДЕРЫ (на уровне нижнего края квадратов) ===
const sliderWrap = document.createElement("div");
sliderWrap.className = "slider-wrapper";
sliderWrap.style.flex = "1";
sliderWrap.style.minWidth = "100px";
sliderWrap.style.margin = "0 4px";
sliderWrap.style.alignSelf = "flex-end";  // ← прижимаем к нижнему краю

const sliderCont = document.createElement("div");
sliderCont.className = "slider-track-container";

const track = document.createElement("div");
track.className = "slider-track";
sliderCont.appendChild(track);
sliderWrap.appendChild(sliderCont);
row.appendChild(sliderWrap);
    
    // === 6. КНОПКА УДАЛЕНИЯ ВСЕГО ПРОФИЛЯ ===
    const del = document.createElement("button");
    del.innerHTML = "✕";
    del.className = "delete-profile-btn";
    del.style.flexShrink = "0";
    if (editable) {
        del.onclick = () => {
            deleteColor(nodeId, color.id);
        };
    } else {
        del.style.visibility = "hidden";
    }
    row.appendChild(del);
    
    card.appendChild(row);
    
profileRefs.set(color.id, {
    rowDiv: row,
    sliderContainer: sliderCont,
    chipsContainer: chipsContainer,
    radioSpan: radio,
    editable: editable
});
    
    refreshMultiColorSliders(nodeId, color.id);
    
    return card;
}


function recalculateBoundaries(color) {
    if (!color.components || color.components.length === 0) return;
    const total = color.components.length;
    for (let i = 0; i < total; i++) {
        color.boundaries[i] = Math.round(((i + 1) / total) * 100);
    }
}

// ============================================================
// ВСПЛЫВАЮЩЕЕ ОКНО ДЛЯ ВЫБОРА ЦВЕТА В МУЛЬТИ
// ============================================================

function showColorPickerForMulti(nodeId, anchor, color, colorIdx, editable) {
    if (!editable) return;
    closePopup();
    
    const simpleColors = getSimpleColors(nodeId);
    if (simpleColors.length === 0) return;
    
    const popup = document.createElement("div");
    popup.className = "color-picker-popup";
    
    simpleColors.forEach(simple => {
        const opt = document.createElement("div");
        opt.className = "picker-option";
        
        const swatch = document.createElement("div");
        swatch.className = "picker-swatch";
        swatch.style.backgroundColor = simple.color;
        
        const label = document.createElement("span");
        label.className = "picker-label";
        label.textContent = simple.name;
        
        opt.appendChild(swatch);
        opt.appendChild(label);
        
        opt.onclick = () => {
            color.components[colorIdx].colorId = simple.id;
            renderAllColors(nodeId, true);
            if (typeof refreshAllGrids === 'function') refreshAllGrids();
            closePopup();
            if (typeof markUnsaved === 'function') markUnsaved();
        };
        
        popup.appendChild(opt);
    });
    
    document.body.appendChild(popup);
    
const rect = anchor.getBoundingClientRect();
let left = rect.left + rect.width / 2 - popup.offsetWidth / 2;
let top = rect.bottom + 6;

// ===== ПРОВЕРКА: ПОМЕЩАЕТСЯ ЛИ ПОПАП НА ЭКРАНЕ =====
const spaceBelow = window.innerHeight - rect.bottom - 6;
const spaceAbove = rect.top - 6;

// Если снизу не хватает места, а сверху достаточно — показываем сверху
if (spaceBelow < popup.offsetHeight && spaceAbove > popup.offsetHeight) {
    top = rect.top - popup.offsetHeight - 6;
} else if (spaceBelow < popup.offsetHeight) {
    // Если не хватает места ни сверху, ни снизу — прижимаем к границе
    top = Math.min(rect.bottom + 6, window.innerHeight - popup.offsetHeight - 10);
    top = Math.max(10, top);
}
// ===== КОНЕЦ ПРОВЕРКИ =====

left = Math.min(window.innerWidth - popup.offsetWidth - 10, Math.max(10, left));
popup.style.left = left + 'px';
popup.style.top = top + 'px';
activePopup = popup;
    
    const outside = (e) => {
        if (!popup.contains(e.target)) {
            closePopup();
            document.removeEventListener('click', outside);
        }
    };
    setTimeout(() => document.addEventListener('click', outside), 0);
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

let activePopup = null;

function closePopup() {
    if (activePopup) {
        activePopup.remove();
        activePopup = null;
    }
}

function updateProfileButtonVisibility() {
    const simpleBtn = document.getElementById("addPaletteColorBtn");
    const multiBtn = document.getElementById("newProfileBtn");
    
    if (simpleBtn) {
        simpleBtn.style.display = 'flex';
    }
    
    // Показываем кнопку "Добавить смесь" всегда
    if (multiBtn) {
        multiBtn.style.display = 'flex';
    }
}

// ============================================================
// ОБЁРТКИ ДЛЯ СОВМЕСТИМОСТИ (ВРЕМЕННО)
// ============================================================

// Старые названия — просто вызывают новые функции
function renderPalette(nodeId, editable) {
    // Просто вызываем новый рендер
    renderAllColors(nodeId, editable);
}

function renderAllProfiles(nodeId, editable) {
    // Просто вызываем новый рендер
    renderAllColors(nodeId, editable);
}

function refreshAllProfiles() {
    renderAllColors(currentNodeId, true);
}

function addPaletteColor() {
    // Создаём новое простое действие через пикер
    if (typeof openColorPicker === 'function') {
        openColorPicker(null, function(newHex) {
            if (currentNodeId && newHex) {
                const name = prompt("Введите название действия:", "Новое действие");
                if (name !== null && name.trim() !== '') {
                    createSimpleColor(currentNodeId, name.trim(), newHex);
                    renderAllColors(currentNodeId, true);
                    if (typeof refreshAllGrids === 'function') refreshAllGrids();
                    if (typeof markUnsaved === 'function') markUnsaved();
                }
            }
        });
    }
}

function createNewProfile() {
    if (!currentNodeId) return;
    
    const simpleColors = getSimpleColors(currentNodeId);
    if (simpleColors.length === 0) {
        if (typeof showFloatingModal === 'function') {
            showFloatingModal("Сначала создайте хотя бы одно простое действие!");
        }
        return;
    }
    
    // Берём активный цвет, если есть, иначе первый
    const activeId = getActiveForNode(currentNodeId);
    let activeSimple = simpleColors.find(c => c.id === activeId);
    if (!activeSimple) {
        activeSimple = simpleColors[0];
    }
    
    const components = [{ colorId: activeSimple.id, share: 100 }];
    const boundaries = [100];
    const name = activeSimple.name + " (смесь)";
    
    createMultiColor(currentNodeId, name, components, boundaries);
    renderAllColors(currentNodeId, true);
    if (typeof refreshAllGrids === 'function') refreshAllGrids();
    if (typeof markUnsaved === 'function') markUnsaved();
}

// ============================================================
// СТАРЫЕ ФУНКЦИИ ДЛЯ СОВМЕСТИМОСТИ
// ============================================================

function getColors() {
    return getColorsForNode(currentNodeId);
}

function getProfiles() {
    return getColorsForNode(currentNodeId);
}

function getActiveColor() {
    return getActiveForNode(currentNodeId);
}

function setActiveColor(colorId) {
    setActiveForNode(currentNodeId, colorId);
}

function getActiveProfile() {
    return getActiveForNode(currentNodeId);
}

function setActiveProfile(profileId) {
    setActiveForNode(currentNodeId, profileId);
}

function getGradientStyleFromProfile(profile) {
    return getGradientStyleFromColorForNode(currentNodeId, profile);
}

function refreshProfileCard(pid) {
    refreshMultiColorSliders(currentNodeId, pid);
}

function getCurrentNodeId() {
    return getTableId(currentNodeId);
}