// ============================================================
// color-manager.js — НОВАЯ АРХИТЕКТУРА (ВСЁ В ОДНОМ СПИСКЕ)
// ============================================================





// ============================================================
// ФУНКЦИИ ДОСТУПА
// ============================================================

App.colors = App.colors || {};
App.colors.getColorsForNode = function(nodeId) {
    const tableId = getTableId(nodeId);
    if (!tableId) return [];
    return App.state.colorsPerNode[tableId] || [];
}
App.colors.getSimpleColors = function(nodeId) {
    const all = App.colors.getColorsForNode(nodeId);
    return all.filter(c => c.type === 'simple' || (!c.type && c.color));
}
App.colors.setColorsForNode = function(nodeId, colors) {
    const tableId = getTableId(nodeId);
    if (!tableId) return;
    App.state.colorsPerNode[tableId] = colors;
}

App.colors.getActiveForNode = function(nodeId) {
    const tableId = getTableId(nodeId);
    if (!tableId) return null;
    return App.state.activePerNode[tableId] || null;
}

App.colors.setActiveForNode = function(nodeId, colorId) {
    const tableId = getTableId(nodeId);
    if (!tableId) return;
    if (colorId === null) {
        delete App.state.activePerNode[tableId];
    } else {
        App.state.activePerNode[tableId] = colorId;
    }
}


App.colors.getMultiColors = function(nodeId) {
    const all = App.colors.getColorsForNode(nodeId);
    return all.filter(c => c.type === 'multi' || (c.components && c.components.length > 0));
}

App.colors.getGradientStyleFromColorForNode = function(nodeId, color) {
    if (!color) return '';
    
    if (color.type === 'simple' || (!color.type && color.color)) {
        return `background: ${color.color};`;
    }
    
    if (color.type === 'multi' || color.components) {
        const colorsList = App.colors.getColorsForNode(nodeId);
        const componentColors = color.components.map(comp => {
            const compColor = colorsList.find(c => c.id === comp.colorId);
            return compColor ? compColor.color : '#3d3d3d';
        });
        const boundaries = color.boundaries || [];
        if (componentColors.length === 0) return '';
        return App.colors.getGradientStyle(componentColors, boundaries);
    }
    
    return '';
}

// ============================================================
// ФУНКЦИИ ГРАДИЕНТА
// ============================================================

App.colors.getPositions = function(color) {
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

App.colors.getGradientStyle = function(colors, positions) {
    if (colors.length === 1) {
        let fillPercent = positions[0];
        return `background: linear-gradient(to right, ${colors[0]} 0%, ${colors[0]} ${fillPercent}%, #313338 ${fillPercent}%, #313338 100%); background-size: 100% 100%; background-repeat: no-repeat;`;
    }
    let stops = [];
    let prev = 0;
    for (let i = 0; i < colors.length; i++) {
        let pos = Math.round(positions[i] * 10) / 10;
        stops.push(`${colors[i]} ${prev}%, ${colors[i]} ${pos}%`);
        prev = pos;
    }
    let lastPos = positions[positions.length - 1];
    if (lastPos < 100) {
        stops.push(`#3d3d3d ${lastPos}%, #3d3d3d 100%`);
    }
    return `background: linear-gradient(to right, ${stops.join(', ')}); background-size: 100% 100%; background-repeat: no-repeat;`;
}

App.colors.getSliderGradient = function(color) {
    let r = parseInt(color.slice(1,3), 16);
    let g = parseInt(color.slice(3,5), 16);
    let b = parseInt(color.slice(5,7), 16);
    let darkR = Math.floor(r * 0.7);
    let darkG = Math.floor(g * 0.7);
    let darkB = Math.floor(b * 0.7);
    let darkColor = `rgb(${darkR}, ${darkG}, ${darkB})`;
    return `linear-gradient(145deg, ${darkColor}, ${color})`;
}

App.colors.getContrast = function(hex) {
    if (!hex || !hex.startsWith('#')) return 'white';
    let r = parseInt(hex.slice(1,3),16);
    let g = parseInt(hex.slice(3,5),16);
    let b = parseInt(hex.slice(5,7),16);
    return (0.299*r + 0.587*g + 0.114*b) > 140 ? '#1e2024' : '#ffffff';
}

// ============================================================
// СОЗДАНИЕ И УДАЛЕНИЕ
// ============================================================

App.colors.createSimpleColor = function(nodeId, name, hex) {
    const tableId = getTableId(nodeId);
    if (!tableId) return null;
    if (!App.state.colorsPerNode[tableId]) App.state.colorsPerNode[tableId] = [];
    
    const newId = App.state.nextColorId++;
    
let finalName = name;
if (!finalName) {
    // Считаем только "New action" и "New action N"
    const newActionColors = App.state.colorsPerNode[tableId].filter(c => 
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
    App.state.colorsPerNode[tableId].push(newColor);
    
    if (App.state.colorsPerNode[tableId].length === 1) {
        App.colors.setActiveForNode(nodeId, newId);
    }
    
    return newId;
}

App.colors.createMultiColor = function(nodeId, name, components, boundaries) {
    const tableId = getTableId(nodeId);
    if (!tableId) return null;
    if (!App.state.colorsPerNode[tableId]) App.state.colorsPerNode[tableId] = [];
    
    const newId = App.state.nextColorId++;
    const newColor = {
        id: newId,
        name: name || 'Смесь',
        type: 'multi',
        components: components || [],
        boundaries: boundaries || []
    };
    App.state.colorsPerNode[tableId].push(newColor);
    
    return newId;
}

App.colors.deleteColor = function(nodeId, colorId) {
    const tableId = getTableId(nodeId);
    if (!tableId) return false;
    const colorsList = App.state.colorsPerNode[tableId] || [];
    
    // Проверяем, используется ли цвет в мультицветах
    const isUsed = colorsList.some(c => 
        c.type === 'multi' && c.components && c.components.some(comp => comp.colorId === colorId)
    );
    
    if (isUsed) {
        App.modals.showFloatingModal('Данное действие используется в мультицвете. Сначала удалите мультицвет, использующий его.');
        return false;
    }
    
    // Проверяем, используется ли цвет в матрице
    const isUsedInMatrix = App.colors.isColorUsedInMatrix(nodeId, colorId);
    if (isUsedInMatrix) {
        App.modals.showSaveConfirmModal(
            'Данное действие используется в матрице. Все равно удалить?',
            function() {
                App.colors.proceedDeleteColor(nodeId, tableId, colorId);
            },
            function() {}
        );
        return false;
    }
    
    App.colors.proceedDeleteColor(nodeId, tableId, colorId);
    return true;
}

App.colors.proceedDeleteColor = function(nodeId, tableId, colorId) {
    const colorsList = App.state.colorsPerNode[tableId] || [];
    const idx = colorsList.findIndex(c => c.id === colorId);
    if (idx === -1) return;
    
    colorsList.splice(idx, 1);
    
    if (App.colors.getActiveForNode(nodeId) === colorId) {
        App.colors.setActiveForNode(nodeId, null);
    }
    
    // Очищаем ячейки, где использовался этот цвет
    const matrix = App.state.cellStorage[getTableId(nodeId)];
    if (matrix) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                if (matrix[i][j] === colorId) {
                    matrix[i][j] = null;
                }
            }
        }
    }
    
    App.colors.renderAllColors(nodeId, true);
    App.events.emit('data:changed');
    App.events.emit('unsaved:mark');
}

App.colors.isColorUsedInMatrix = function(nodeId, colorId) {
    const tid = getTableId(nodeId);
    const matrix = App.state.cellStorage[tid];
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

App.colors.renderAllColors = function(nodeId, editable) {
    const isGto = App.currentMode === 'gto';
    const simpleContainer = document.getElementById(isGto ? "gtoPaletteList" : "paletteList");
    const multiContainer = document.getElementById(isGto ? "gtoProfileList" : "profileList");
    
    if (!simpleContainer || !multiContainer) return;
    
    App.state.profileRefs.clear();
    simpleContainer.innerHTML = '';
    multiContainer.innerHTML = '';
    
    const allColors = App.colors.getColorsForNode(nodeId);
    const simpleColors = allColors.filter(c => c.type === 'simple' || (!c.type && c.color));
    const multiColors = allColors.filter(c => c.type === 'multi' || (c.components && c.components.length > 0));
    const activeId = App.colors.getActiveForNode(nodeId);
    
    // Рендерим простые цвета
    simpleColors.forEach((color, index) => {
        const el = App.colors.renderSimpleColor(nodeId, color, activeId, editable, index);
        simpleContainer.appendChild(el);
    });
    
    // Рендерим мультицветы
    multiColors.forEach((color) => {
        const el = App.colors.renderMultiColor(nodeId, color, activeId, editable);
        multiContainer.appendChild(el);
    });
    
    App.colors.updateProfileButtonVisibility();
	
}

App.colors.renderSimpleColor = function(nodeId, color, activeId, editable, index) {
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
            App.colors.setActiveForNode(nodeId, color.id);
            App.colors.renderAllColors(nodeId, true);
            App.events.emit('unsaved:mark');
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
            App.ui.openColorPicker(color.id, function(newHex) {
                const colorsList = App.colors.getColorsForNode(nodeId);
                const colorToEdit = colorsList.find(c => c.id === color.id);
                if (colorToEdit) {
                    colorToEdit.color = newHex;
                    colorBox.style.backgroundColor = newHex;
                    App.colors.renderAllColors(nodeId, true);
                    App.events.emit('data:changed');
                    App.events.emit('unsaved:mark');
                }
            });
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
            App.events.emit('unsaved:mark');
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
            App.colors.deleteColor(nodeId, color.id);
        };
    } else {
        removeBtn.style.visibility = "hidden";
    }
    div.appendChild(removeBtn);
    
    return div;
}
App.colors.generateNameForColor = function(nodeId, color) {
    const simpleColors = App.colors.getSimpleColors(nodeId);
    if (!color.components || color.components.length === 0) return '';
    const names = color.components.map(comp => {
        const c = simpleColors.find(s => s.id === comp.colorId);
        return c ? c.name : '?';
    });
    return names.join(' / ');
}
App.colors.refreshMultiColorSliders = function(nodeId, colorId) {
    const colorsList = App.colors.getColorsForNode(nodeId);
    const color = colorsList.find(c => c.id === colorId);
    if (!color || color.type !== 'multi') return;
    
    const ref = App.state.profileRefs.get(colorId);
    if (!ref) return;
    
    const { sliderContainer, minusBtn, plusBtn, radioSpan } = ref;
    const positions = App.colors.getPositions(color);
    const simpleColors = App.colors.getSimpleColors(nodeId);
    

    
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
        
        let suppressClick = false;

        // Клик по ползунку — выбор цвета для компонента
        thumb.onclick = (e) => {
            e.stopPropagation();
            if (suppressClick) {
                suppressClick = false;
                return;
            }
            if (!ref.editable) return;
            const simpleColorsList = App.colors.getSimpleColors(nodeId);
            if (simpleColorsList.length === 0) {
                alert("Сначала создайте простое действие!");
                return;
            }
            App.colors.showColorPickerForMulti(nodeId, thumb, color, i, ref.editable);
        };
        
        // Перетаскивание ползунка (ВСЕГДА активное)
        if (ref.editable) {
            let dragging = false;
            let moved = false;
            const onMove = (me) => {
                if (!dragging) return;
                moved = true;
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
                App.colors.refreshMultiColorSliders(nodeId, color.id);
                App.events.emit('data:changed');
                App.events.emit('unsaved:mark');
            };
            const up = (e) => {
                if (!dragging) return;
                dragging = false;
                if (moved) suppressClick = true;
                if (sliderContainer.hasPointerCapture?.(e.pointerId)) {
                    sliderContainer.releasePointerCapture(e.pointerId);
                }
                sliderContainer.removeEventListener('pointermove', onMove);
                sliderContainer.removeEventListener('pointerup', up);
                sliderContainer.removeEventListener('pointercancel', up);
            };

            thumb.addEventListener('pointerdown', (e) => {
                if (e.button !== undefined && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                dragging = true;
                moved = false;
                sliderContainer.setPointerCapture?.(e.pointerId);
                sliderContainer.addEventListener('pointermove', onMove);
                sliderContainer.addEventListener('pointerup', up);
                sliderContainer.addEventListener('pointercancel', up);
            });
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
        const activeId = App.colors.getActiveForNode(nodeId);
        if (activeId === color.id) {
            radioSpan.classList.add('active');
        } else {
            radioSpan.classList.remove('active');
        }
    }
}
App.colors.showColorPickerForMultiAdd = function(nodeId, anchor, color, editable) {
    if (!editable) return;
    App.colors.closePopup();
    
    const simpleColors = App.colors.getSimpleColors(nodeId);
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

    App.colors.renderAllColors(nodeId, true);
    App.events.emit('data:changed');
    App.events.emit('unsaved:mark');
    App.colors.closePopup();
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
App.state.activePopup = popup;
    
    const outside = (e) => {
        if (!popup.contains(e.target)) {
            App.colors.closePopup();
            document.removeEventListener('click', outside);
        }
    };
    setTimeout(() => document.addEventListener('click', outside), 0);
}
App.colors.renderMultiColor = function(nodeId, color, activeId, editable) {
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
            App.colors.setActiveForNode(nodeId, color.id);
            App.colors.renderAllColors(nodeId, true);
            App.events.emit('unsaved:mark');
        };
    } else {
        radio.style.opacity = "0.5";
    }
    row.appendChild(radio);
    
    // === 2. КВАДРАТЫ С ЦВЕТАМИ ===
    const chipsContainer = document.createElement("div");
	chipsContainer.className = "chips-container";
    
    const simpleColors = App.colors.getSimpleColors(nodeId);
    
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
                const simpleColorsList = App.colors.getSimpleColors(nodeId);
                if (simpleColorsList.length === 0) {
                    App.modals.showFloatingModal("Сначала создайте простое действие!");
                    return;
                }
                App.colors.showColorPickerForMulti(nodeId, chip, color, i, editable);
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
                App.colors.renderAllColors(nodeId, true);
                App.events.emit('data:changed');
                App.events.emit('unsaved:mark');
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
    const simpleColorsList = App.colors.getSimpleColors(nodeId);
    if (simpleColorsList.length === 0) {
        App.modals.showFloatingModal("Сначала создайте простое действие!");
        return;
    }
    App.colors.showColorPickerForMultiAdd(nodeId, addBtn, color, editable);
};
        
        chipsContainer.appendChild(addBtn);
    }
    
    row.appendChild(chipsContainer);
    
// === 4. НАЗВАНИЕ (на уровне нижнего края квадратов) ===
const nameSpan = document.createElement("span");
nameSpan.className = "multi-profile-name";
nameSpan.textContent = App.colors.generateNameForColor(nodeId, color);
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
            App.colors.deleteColor(nodeId, color.id);
        };
    } else {
        del.style.visibility = "hidden";
    }
    row.appendChild(del);
    
    card.appendChild(row);
    
App.state.profileRefs.set(color.id, {
    rowDiv: row,
    sliderContainer: sliderCont,
    chipsContainer: chipsContainer,
    radioSpan: radio,
    editable: editable
});
    
    App.colors.refreshMultiColorSliders(nodeId, color.id);
    
    return card;
}


App.colors.recalculateBoundaries = function(color) {
    if (!color.components || color.components.length === 0) return;
    const total = color.components.length;
    for (let i = 0; i < total; i++) {
        color.boundaries[i] = Math.round(((i + 1) / total) * 100);
    }
}

// ============================================================
// ВСПЛЫВАЮЩЕЕ ОКНО ДЛЯ ВЫБОРА ЦВЕТА В МУЛЬТИ
// ============================================================

App.colors.showColorPickerForMulti = function(nodeId, anchor, color, colorIdx, editable) {
    if (!editable) return;
    App.colors.closePopup();
    
    const simpleColors = App.colors.getSimpleColors(nodeId);
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
            App.colors.renderAllColors(nodeId, true);
            App.events.emit('data:changed');
            App.colors.closePopup();
            App.events.emit('unsaved:mark');
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
App.state.activePopup = popup;
    
    const outside = (e) => {
        if (!popup.contains(e.target)) {
            App.colors.closePopup();
            document.removeEventListener('click', outside);
        }
    };
    setTimeout(() => document.addEventListener('click', outside), 0);
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================


App.colors.closePopup = function() {
    if (App.state.activePopup) {
        App.state.activePopup.remove();
        App.state.activePopup = null;
    }
}

App.colors.updateProfileButtonVisibility = function() {
    const isGto = App.currentMode === 'gto';
    const simpleBtn = document.getElementById(isGto ? "gtoAddPaletteColorBtn" : "addPaletteColorBtn");
    const multiBtn = document.getElementById(isGto ? "gtoNewProfileBtn" : "newProfileBtn");
    
    if (simpleBtn) {
        simpleBtn.style.display = 'flex';
    }
    
    // Показываем кнопку "Добавить смесь" всегда
    if (multiBtn) {
        multiBtn.style.display = 'flex';
    }
}

// ============================================================
// ДЕЙСТВИЯ UI: ПАЛИТРА / ПРОФИЛИ
// ============================================================

App.colors.addPaletteColor = function() {
    // Создаём новое простое действие через пикер
    App.ui.openColorPicker(null, function(newHex) {
        if (App.state.currentNodeId && newHex) {
            const name = prompt("Введите название действия:", "Новое действие");
            if (name !== null && name.trim() !== '') {
                App.colors.createSimpleColor(App.state.currentNodeId, name.trim(), newHex);
                App.colors.renderAllColors(App.state.currentNodeId, true);
                App.events.emit('data:changed');
                App.events.emit('unsaved:mark');
            }
        }
    });
}

App.colors.createNewProfile = function() {
    if (!App.state.currentNodeId) return;
    
    const simpleColors = App.colors.getSimpleColors(App.state.currentNodeId);
    if (simpleColors.length === 0) {
        App.modals.showFloatingModal("Сначала создайте хотя бы одно простое действие!");
        return;
    }
    
    // Берём активный цвет, если есть, иначе первый
    const activeId = App.colors.getActiveForNode(App.state.currentNodeId);
    let activeSimple = simpleColors.find(c => c.id === activeId);
    if (!activeSimple) {
        activeSimple = simpleColors[0];
    }
    
    const components = [{ colorId: activeSimple.id, share: 100 }];
    const boundaries = [100];
    const name = activeSimple.name + " (смесь)";
    
    App.colors.createMultiColor(App.state.currentNodeId, name, components, boundaries);
    App.colors.renderAllColors(App.state.currentNodeId, true);
    App.events.emit('data:changed');
    App.events.emit('unsaved:mark');
}

// ============================================================
// СОЗДАНИЕ / УДАЛЕНИЕ
// ============================================================
