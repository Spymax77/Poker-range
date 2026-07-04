// ============================================================
// color-manager.js — НОВАЯ АРХИТЕКТУРА ЦВЕТОВ И ПРОФИЛЕЙ
// ============================================================

// ===== НОВЫЕ СТРУКТУРЫ ДАННЫХ =====
// Цвета и профили теперь хранятся привязанными к ID диапазона
let colorsPerNode = {};       // { "node_1": [ {id, name, color}, ... ] }
let profilesPerNode = {};     // { "node_1": [ {id, name, colorIds, boundaries}, ... ] }
let activeColorPerNode = {};  // { "node_1": id, "node_2": null }
let activeProfilePerNode = {}; // { "node_1": id, "node_2": null }

// Глобальные счётчики для генерации уникальных ID (общие для всех диапазонов)
let nextColorId = 1;
let nextProfileId = 1;

// Вспомогательный Map для хранения ссылок на DOM-элементы профилей (для обновления)
let profileRefs = new Map();

// ===== ФУНКЦИИ ДОСТУПА К ДАННЫМ =====
// Получаем ID текущего диапазона
function getCurrentNodeId() {
    return getTableId(currentNodeId);
}

// Получить цвета текущего диапазона
function getColors() {
    const nodeId = getCurrentNodeId();
    return colorsPerNode[nodeId] || [];
}

// Получить профили текущего диапазона
function getProfiles() {
    const nodeId = getCurrentNodeId();
    return profilesPerNode[nodeId] || [];
}

// Получить активный цвет для текущего диапазона
function getActiveColor() {
    const nodeId = getCurrentNodeId();
    return activeColorPerNode[nodeId] || null;
}

// Установить активный цвет для текущего диапазона (сохраняем в persistAll)
function setActiveColor(colorId) {
    const nodeId = getCurrentNodeId();
    if (colorId === null) {
        delete activeColorPerNode[nodeId];
    } else {
        activeColorPerNode[nodeId] = colorId;
    }
    // НЕ вызываем persistAll() — это будет делать кнопка "Сохранить"
}

// Получить активный профиль для текущего диапазона
function getActiveProfile() {
    const nodeId = getCurrentNodeId();
    return activeProfilePerNode[nodeId] || null;
}

// Установить активный профиль для текущего диапазона
function setActiveProfile(profileId) {
    const nodeId = getCurrentNodeId();
    if (profileId === null) {
        delete activeProfilePerNode[nodeId];
    } else {
        activeProfilePerNode[nodeId] = profileId;
    }
    // НЕ вызываем persistAll()
}
// ===== ФУНКЦИИ ГРАДИЕНТА =====

function getPositions(profile) {
    let cnt = profile.colorIds ? profile.colorIds.length : 0;
    if (cnt === 0) return [100];
    let boundaries = profile.boundaries || [];
    if (boundaries.length !== cnt) {
        boundaries = [];
        if (cnt === 1) boundaries = [100];
        else if (cnt === 2) boundaries = [50, 100];
        else if (cnt === 3) boundaries = [33, 66, 100];
        profile.boundaries = boundaries;
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

function getGradientStyleFromProfile(profile) {
    if (!profile || !profile.colorIds || profile.colorIds.length === 0) {
        return '';
    }
    // Получаем цвета из текущего диапазона (colorsPerNode)
    const nodeId = getCurrentNodeId();
    const colorsList = colorsPerNode[nodeId] || [];
    let colors = profile.colorIds.map(id => {
        let color = colorsList.find(c => c.id === id);
        return color ? color.color : '#3d3d3d';
    });
    let positions = getPositions(profile);
    return getGradientStyle(colors, positions);
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
// ===== РЕНДЕРИНГ ПАЛИТРЫ =====

function renderPalette(editable) {
    const container = document.getElementById("paletteList");
    if (!container) return;
    container.innerHTML = "";

    const colors = getColors();
    const activeColor = getActiveColor();

    colors.forEach((item) => {
        const div = document.createElement("div");
        div.className = "palette-item";

        const radio = document.createElement("div");
        radio.className = `profile-radio ${activeColor === item.id ? 'active' : ''}`;
        radio.style.cursor = "pointer";
        if (editable) {
            radio.onclick = (e) => {
                e.stopPropagation();
                setActiveColor(item.id);
                renderPalette(editable);
                markUnsaved();
            };
        } else {
            radio.style.opacity = "0.5";
            radio.style.cursor = "default";
        }
        div.appendChild(radio);

        const colorBox = document.createElement("div");
        colorBox.className = "palette-color-box";
        colorBox.style.backgroundColor = item.color;

        if (editable) {
            colorBox.onclick = (e) => {
                e.stopPropagation();
                if (typeof openColorPicker === 'function') {
                    openColorPicker(item.id, function(newHex) {
                        const nodeId = getCurrentNodeId();
                        const colorsList = colorsPerNode[nodeId] || [];
                        const colorToEdit = colorsList.find(c => c.id === item.id);
                        if (colorToEdit) {
                            colorToEdit.color = newHex;
                            colorBox.style.backgroundColor = newHex;
                            renderPalette(editable);
                            refreshAllProfiles();
                            refreshAllGrids();
                            markUnsaved();
                        }
                    });
                }
            };
        }

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "palette-name";
        nameInput.value = item.name;
        nameInput.onchange = (e) => {
            let nn = e.target.value.trim();
            if (nn) item.name = nn;
        };
        if (!editable) nameInput.disabled = true;

        const removeBtn = document.createElement("button");
        removeBtn.innerHTML = "✕";
        removeBtn.className = "remove-palette-btn";
        if (editable) {
            removeBtn.onclick = () => {
                const nodeId = getCurrentNodeId();
                const colorsList = colorsPerNode[nodeId] || [];
                const profilesList = profilesPerNode[nodeId] || [];

                // Проверяем, используется ли цвет в профилях
                const isUsed = profilesList.some(profile => profile.colorIds.includes(item.id));

                if (isUsed) {
                    showFloatingModal('Данный цвет используется в профиле. Сначала удалите профиль с этим цветом.');
                    return;
                }

                const idx = colorsList.findIndex(c => c.id === item.id);
                if (idx !== -1) {
                    colorsList.splice(idx, 1);
                    if (getActiveColor() === item.id) {
                        setActiveColor(null);
                    }
                    renderPalette(editable);
                    refreshAllProfiles();
                    refreshAllGrids();
                    updateProfileButtonVisibility();
                    markUnsaved();
                }
            };
        } else {
            removeBtn.style.visibility = "hidden";
        }

        div.appendChild(colorBox);
        div.appendChild(nameInput);
        div.appendChild(removeBtn);
        container.appendChild(div);
    });
}
// ===== РЕНДЕРИНГ ПРОФИЛЕЙ =====
function isProfileUsedInMatrix(nodeId, profileId) {
    const tid = getTableId(nodeId);
    const matrix = cellStorage[tid];
    if (!matrix) return false;
    
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            if (matrix[i][j] === profileId) {
                return true;
            }
        }
    }
    return false;
}
function renderAllProfiles(editable) {
    const container = document.getElementById("profileList");
    if (!container) return;

    profileRefs.clear();
    container.innerHTML = '';

    // Получаем профили ТЕКУЩЕГО диапазона
    const profiles = getProfiles();
    const activeProfile = getActiveProfile();

    for (let prof of profiles) {
        let ref = profileRefs.get(prof.id);
        if (!ref) {
            const card = document.createElement("div");
            card.className = "profile-card";

            const row = document.createElement("div");
            row.className = "profile-row";

            const radio = document.createElement("div");
            radio.className = `profile-radio ${activeProfile === prof.id ? 'active' : ''}`;
            if (editable) {
                radio.onclick = () => {
                    setActiveProfile(prof.id);
                    renderAllProfiles(editable);
					markUnsaved();
                    // НЕ сохраняем автоматически!
                };
            } else {
                radio.style.opacity = "0.5";
            }

            const minus = document.createElement("button");
            minus.className = "side-btn";
            minus.textContent = "−";

            const preview = document.createElement("div");
            preview.className = "gradient-preview";

            const plus = document.createElement("button");
            plus.className = "side-btn";
            plus.textContent = "+";

            const sliderWrap = document.createElement("div");
            sliderWrap.className = "slider-wrapper";

            const sliderCont = document.createElement("div");
            sliderCont.className = "slider-track-container";

            const track = document.createElement("div");
            track.className = "slider-track";
            sliderCont.appendChild(track);
            sliderWrap.appendChild(sliderCont);

            const del = document.createElement("button");
            del.className = "delete-profile-btn";
            del.innerHTML = "✕";

            if (editable) {
                minus.onclick = () => {
                    if (prof.colorIds.length <= 1) return;
                    prof.colorIds.pop();
                    prof.boundaries.pop();
                    refreshProfileCard(prof.id);
                    refreshAllGrids();
					markUnsaved();
                    // НЕ сохраняем автоматически!
                };

                plus.onclick = () => {
                    if (prof.colorIds.length >= 3) return;
                    let newColorId = getActiveColor();
                    if (newColorId === null) {
                        alert("Сначала выберите цвет в палитре");
                        return;
                    }
                    let newBoundary = 100;
                    
                    if (prof.colorIds.length === 1) {
                        let oldBoundary = prof.boundaries[0];
                        if (oldBoundary > 90) oldBoundary = 90;
                        prof.boundaries = [oldBoundary, newBoundary];
                        prof.colorIds.push(newColorId);
                    } else if (prof.colorIds.length === 2) {
                        let oldBoundary1 = prof.boundaries[0];
                        let oldBoundary2 = prof.boundaries[1];
                        if (oldBoundary1 > 80) oldBoundary1 = 80;
                        if (oldBoundary2 > 90) oldBoundary2 = 90;
                        prof.boundaries = [oldBoundary1, oldBoundary2, newBoundary];
                        prof.colorIds.push(newColorId);
                    }
                    refreshProfileCard(prof.id);
                    refreshAllGrids();
					markUnsaved();
                    // НЕ сохраняем автоматически!
                };

               del.onclick = () => {
    const nodeId = currentNodeId;
    const profileId = prof.id;
    const isUsed = isProfileUsedInMatrix(nodeId, profileId);
    function doDelete() {
    const cardRef = profileRefs.get(profileId);
    if (cardRef && cardRef.rowDiv?.parentNode) {
        cardRef.rowDiv.parentNode.remove();
    }

    const nodeIdStr = getTableId(nodeId);  // ← преобразуем число в "node_2"
    const profilesList = profilesPerNode[nodeIdStr] || [];
    const idx = profilesList.findIndex(p => p.id === profileId);
    if (idx !== -1) profilesList.splice(idx, 1);
    // Очищаем ячейки, где использовался удалённый профиль
const matrix = cellStorage[getTableId(currentNodeId)];
if (matrix) {
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            if (matrix[i][j] === profileId) {
                matrix[i][j] = null;
            }
        }
    }
}
    if (getActiveProfile() === profileId) {
        setActiveProfile(null);
    }

    profileRefs.delete(profileId);
    renderAllProfiles(true);
    refreshAllGrids();
    markUnsaved();
}
    
if (isUsed) {
    const node = nodes.find(n => n.id === currentNodeId);
    const message = node
        ? `Данный профиль используется в матрице диапазона <span style="color: #D4AF37; font-weight: 600;">${node.name}</span>.\n\nВсе равно удалить?`
        : 'Данный профиль используется в матрице.\n\nВсе равно удалить?';

    showSaveConfirmModal(message, doDelete, null);
} else {
    doDelete();
}
};
            } else {
                minus.style.visibility = "hidden";
                plus.style.visibility = "hidden";
                del.style.visibility = "hidden";
                radio.style.cursor = "default";
            }

            row.appendChild(radio);
            row.appendChild(minus);
            row.appendChild(preview);
            row.appendChild(plus);
            row.appendChild(sliderWrap);
            row.appendChild(del);
            card.appendChild(row);
            container.appendChild(card);

            ref = {
                rowDiv: row,
                sliderContainer: sliderCont,
                previewBox: preview,
                minusBtn: minus,
                plusBtn: plus,
                radioSpan: radio,
                editable
            };
            profileRefs.set(prof.id, ref);
        } else {
            ref.editable = editable;
            if (ref.radioSpan) {
                if (getActiveProfile() === prof.id) ref.radioSpan.classList.add('active');
                else ref.radioSpan.classList.remove('active');
            }
        }
        refreshProfileCard(prof.id);
    }
}
// ===== ОБНОВЛЕНИЕ КАРТОЧКИ ПРОФИЛЯ =====

function refreshProfileCard(pid) {
    const nodeId = getCurrentNodeId();
    const profilesList = profilesPerNode[nodeId] || [];
    const prof = profilesList.find(p => p.id === pid);
    if (!prof) return;
    
    const ref = profileRefs.get(pid);
    if (!ref) return;
    
    const { sliderContainer, previewBox, minusBtn, plusBtn, radioSpan } = ref;
    let positions = getPositions(prof);
    
    // Обновляем превью градиента
    previewBox.setAttribute("style", getGradientStyleFromProfile(prof) + ";");
    
    // Очищаем старые ползунки
    const oldThumbs = sliderContainer.querySelectorAll('.slider-thumb');
    oldThumbs.forEach(th => th.remove());
// Удаляем старые сегменты заливки
const oldFills = sliderContainer.querySelectorAll('.slider-fill-segment');
oldFills.forEach(el => el.remove());

// Создаём сегменты заливки для каждого цвета
const colorsList = colorsPerNode[nodeId] || [];
for (let i = 0; i < prof.colorIds.length; i++) {
    const colorId = prof.colorIds[i];
    const colorObj = colorsList.find(c => c.id === colorId);
    
    // Если цвет не найден — используем цвет шкалы из CSS
    const color = colorObj ? colorObj.color : '#4a4a50';
    
    const leftPos = i === 0 ? 0 : positions[i - 1];
    const width = positions[i] - leftPos;
    
    const fill = document.createElement("div");
    fill.className = "slider-fill-segment";
	fill.style.position = 'absolute';
    fill.style.top = '50%';
    fill.style.left = leftPos + '%';
    fill.style.width = width + '%';
	fill.style.height = '2px';
    fill.style.background = color;
    sliderContainer.appendChild(fill);
}
    // Создаём ползунки для каждого цвета
    for (let i = 0; i < prof.colorIds.length; i++) {
       const thumb = document.createElement("div");
thumb.className = "slider-thumb";
thumb.style.left = `${positions[i]}%`;

const percentLabel = document.createElement("span");
percentLabel.className = "slider-percent";
percentLabel.textContent = Math.round(positions[i]);

thumb.appendChild(percentLabel);

thumb.onclick = (e) => {
    e.stopPropagation();
    showColorPicker(thumb, prof, i, ref.editable);
};
        
        // Перетаскивание ползунка
        let dragging = false;
        const onMove = (me) => {
            if (!dragging) return;
            const rect = sliderContainer.getBoundingClientRect();
            let newP = (me.clientX - rect.left) / rect.width * 100;
            newP = Math.min(100, Math.max(0, newP));
            
            // Логика ограничений для 2-х и 3-х ползунков
            if (prof.colorIds.length > 1) {
                if (i > 0) newP = Math.max(newP, positions[i-1] + 1);
                if (i < positions.length - 1) newP = Math.min(newP, positions[i+1] - 1);
            }
            
            if (Math.abs(positions[i] - newP) < 0.5) return;
            positions[i] = newP;
            prof.boundaries = positions;
            refreshProfileCard(prof.id);
            refreshAllGrids();
			markUnsaved();
            // НЕ сохраняем автоматически!
        };
        const up = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', up); };
        
        thumb.onmousedown = (e) => {
            e.preventDefault();
            dragging = true;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', up);
        };
        
        sliderContainer.appendChild(thumb);
    }
    
    // Видимость кнопок + и -
    if (minusBtn) minusBtn.style.visibility = (prof.colorIds.length <= 1 || !ref.editable) ? 'hidden' : 'visible';
    if (plusBtn) plusBtn.style.visibility = (prof.colorIds.length >= 3 || !ref.editable) ? 'hidden' : 'visible';
    
    // Активность радио-кнопки
    if (radioSpan) {
        if (getActiveProfile() === prof.id) radioSpan.classList.add('active');
        else radioSpan.classList.remove('active');
    }
}
// ===== ПЕРЕМЕННЫЕ ДЛЯ ВСПЛЫВАЮЩИХ ОКАН =====
let activePopup = null;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function refreshAllProfiles() {
    const profiles = getProfiles();
    profiles.forEach(p => refreshProfileCard(p.id));
}

function updateProfileButtonVisibility() {
    const profileBtn = document.getElementById("newProfileBtn");
    if (!profileBtn) return;
    
    const colors = getColors();
    const hasColors = colors.length > 0;
    
    profileBtn.style.display = hasColors ? '' : 'none';
}

function closePopup() {
    if (activePopup) {
        activePopup.remove();
        activePopup = null;
    }
}

function showColorPicker(anchor, profile, colorIdx, editable) {
    if (!editable) return;
    closePopup();
    
    const colors = getColors();
    if (colors.length === 0) return;

    const popup = document.createElement("div");
    popup.style.position = "fixed";
    popup.style.background = "#2c2f36";
    popup.style.borderRadius = "20px";
    popup.style.boxShadow = "0 8px 20px rgba(0,0,0,0.6)";
    popup.style.padding = "8px";
    popup.style.display = "flex";
    popup.style.flexDirection = "column";
    popup.style.gap = "8px";
    popup.style.zIndex = "1000";
    popup.style.border = "1px solid #4a4e5a";

    colors.forEach(pal => {
        const opt = document.createElement("div");
        opt.style.display = "flex";
        opt.style.alignItems = "center";
        opt.style.gap = "12px";
        opt.style.background = "#1e2024";
        opt.style.borderRadius = "14px";
        opt.style.padding = "6px 12px";
        opt.style.cursor = "pointer";
        opt.onmouseenter = () => opt.style.background = "#3a3e48";
        opt.onmouseleave = () => opt.style.background = "#1e2024";

        const swatch = document.createElement("div");
        swatch.style.width = "28px";
        swatch.style.height = "28px";
        swatch.style.borderRadius = "8px";
        swatch.style.backgroundColor = pal.color;
        swatch.style.border = "1px solid #7e8a9c";

        const label = document.createElement("span");
        label.style.fontSize = "12px";
        label.textContent = pal.name;

        opt.appendChild(swatch);
        opt.appendChild(label);

        opt.onclick = () => {
            profile.colorIds[colorIdx] = pal.id;
            refreshProfileCard(profile.id);
            refreshAllGrids();
            closePopup();
            // НЕ сохраняем автоматически!
        };

        popup.appendChild(opt);
    });

    document.body.appendChild(popup);

    const rect = anchor.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - popup.offsetWidth / 2;
    let top = rect.bottom + 6;
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

// ===== СОЗДАНИЕ И УДАЛЕНИЕ ПРОФИЛЯ =====

function createNewProfile() {
    const activeColor = getActiveColor();
    if (activeColor === null) {
        alert("Сначала выберите цвет в палитре");
        return;
    }
    
    const nodeId = getCurrentNodeId();
    const colorsList = colorsPerNode[nodeId] || [];
    const colorObj = colorsList.find(c => c.id === activeColor);
    if (!colorObj) {
        alert("Выбранный цвет не найден");
        return;
    }
    
    const newId = nextProfileId++;
    const newProfile = {
        id: newId,
        name: "Новый профиль",
        colorIds: [activeColor],
        boundaries: [100]
    };
    
    if (!profilesPerNode[nodeId]) {
        profilesPerNode[nodeId] = [];
    }
    profilesPerNode[nodeId].push(newProfile);
    
    // Если это первый профиль в диапазоне, делаем его активным
    if (profilesPerNode[nodeId].length === 1) {
        setActiveProfile(newId);
    }
    
    renderAllProfiles(true);
    refreshAllGrids();
	markUnsaved();
    // НЕ сохраняем автоматически!
}

function resetDefaultProfiles() {
    // Сбрасываем только для текущего диапазона
    const nodeId = getCurrentNodeId();
    profilesPerNode[nodeId] = [];
    setActiveProfile(null);
    renderAllProfiles(true);
}

// ===== ДОБАВЛЕНИЕ ЦВЕТА (через пикер) =====

function addPaletteColor() {
    openColorPicker();
}