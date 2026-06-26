    // ---------- ОСНОВНАЯ МОДЕЛЬ (дерево, матрица, профили) ----------
    let nodes = []; let nextNodeId = 1; let currentNodeId = null; let workLevels = []; let workDisplayNodeId = null;
    let cellStorage = {}; let expandedNodes = new Set();
    let nodePaletteMap = {};
    let nodeProfileMap = {};
    const rowsData = [
        ["AA","AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s"],
        ["AKo","KK","KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","K4s","K3s","K2s"],
        ["AQo","KQo","QQ","QJs","QTs","Q9s","Q8s","Q7s","Q6s","Q5s","Q4s","Q3s","Q2s"],
        ["AJo","KJo","QJo","JJ","JTs","J9s","J8s","J7s","J6s","J5s","J4s","J3s","J2s"],
        ["ATo","KTo","QTo","JTo","TT","T9s","T8s","T7s","T6s","T5s","T4s","T3s","T2s"],
        ["A9o","K9o","Q9o","J9o","T9o","99","98s","97s","96s","95s","94s","93s","92s"],
        ["A8o","K8o","Q8o","J8o","T8o","98o","88","87s","86s","85s","84s","83s","82s"],
        ["A7o","K7o","Q7o","J7o","T7o","97o","87o","77","76s","75s","74s","73s","72s"],
        ["A6o","K6o","Q6o","J6o","T6o","96o","86o","76o","66","65s","64s","63s","62s"],
        ["A5o","K5o","Q5o","J5o","T5o","95o","85o","75o","65o","55","54s","53s","52s"],
        ["A4o","K4o","Q4o","J4o","T4o","94o","84o","74o","64o","54o","44","43s","42s"],
        ["A3o","K3o","Q3o","J3o","T3o","93o","83o","73o","63o","53o","43o","33","32s"],
        ["A2o","K2o","Q2o","J2o","T2o","92o","82o","72o","62o","52o","42o","32o","22"]
    ];
    function getTableId(nodeId) { return `node_${nodeId}`; }
    function ensureTable(nodeId) { let tid = getTableId(nodeId); if (!cellStorage[tid]) cellStorage[tid] = Array(13).fill().map(() => Array(13).fill(null)); }
    function getCellProfile(nodeId, r, c) { return cellStorage[getTableId(nodeId)]?.[r]?.[c] || null; }
    function setCellProfile(nodeId, r, c, pid, immediateSave = true) { ensureTable(nodeId); const tid = getTableId(nodeId); const old = cellStorage[tid][r][c]; if (old === pid) return false; cellStorage[tid][r][c] = pid; if (immediateSave) persistAll(); return true; }
    function countTotalCombos(nodeId) { let tid = getTableId(nodeId); if (!cellStorage[tid]) return 0; let total = 0; for (let i=0;i<13;i++) for (let j=0;j<13;j++) if (cellStorage[tid][i][j] !== null) { let hand = rowsData[i][j]; if (hand.includes('s')) total += 4; else if (hand.includes('o')) total += 12; else if (hand[0] === hand[1]) total += 6; } return total; }
    // Цвета и профили (сокращённо, но рабочий код)
    let paletteColors = []; let colorProfiles = []; let nextProfileId = 1; let activeProfileId = null; 
    let activeColorId = null;
    let profileRefs = new Map();
    function loadPalette() {
    let stored = localStorage.getItem("poker_range_palette");
    if (stored) {
        try {
            let p = JSON.parse(stored);
            if (Array.isArray(p)) {
                paletteColors = p;
                return;
            }
        } catch(e) {}
    }
    paletteColors = [];
}
    function savePalette() { localStorage.setItem("poker_range_palette", JSON.stringify(paletteColors)); }
   function renderPalette(editable) {
    const container = document.getElementById("paletteList");
    if (!container) return;
    container.innerHTML = "";

    // Получаем список разрешённых ID для текущего диапазона
    let allowedIds = nodePaletteMap[getTableId(currentNodeId)] || [];
    let filteredColors = paletteColors.filter(c => allowedIds.includes(c.id));

    filteredColors.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "palette-item";

        // ===== РАДИО-КНОПКА =====
        const radio = document.createElement("div");
        radio.className = `profile-radio ${activeColorId === item.id ? 'active' : ''}`;
        radio.style.cursor = "pointer";
        if (editable) {
            radio.onclick = (e) => {
                e.stopPropagation();
                activeColorId = item.id;
                renderPalette(editable);
                persistAll();
                savePalette();
            };
        } else {
            radio.style.opacity = "0.5";
            radio.style.cursor = "default";
        }
        div.appendChild(radio);

        // ===== ЦВЕТОВОЙ КВАДРАТ =====
        const colorBox = document.createElement("div");
        colorBox.className = "palette-color-box";
        colorBox.style.backgroundColor = item.color;

        if (editable) {
            colorBox.onclick = (e) => {
                e.stopPropagation();
                if (typeof openColorPicker === 'function') {
                    openColorPicker(item.id, function(newHex) {
                        item.color = newHex;
                        colorBox.style.backgroundColor = newHex;
                        savePalette();
                        renderPalette(editable);
                        refreshAllProfiles();
                        refreshAllGrids();
                    });
                } else {
                    const picker = document.createElement("input");
                    picker.type = "color";
                    picker.value = item.color;
                    picker.onchange = (ce) => {
                        item.color = ce.target.value;
                        colorBox.style.backgroundColor = item.color;
                        savePalette();
                        refreshAllProfiles();
                        refreshAllGrids();
                    };
                    picker.click();
                }
            };
        }

        // ===== ИМЯ ЦВЕТА =====
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "palette-name";
        nameInput.value = item.name;
        nameInput.onchange = (e) => {
            let nn = e.target.value.trim();
            if (nn) item.name = nn;
            savePalette();
        };
        if (!editable) nameInput.disabled = true;

        // ===== КНОПКА УДАЛЕНИЯ =====
        const removeBtn = document.createElement("button");
        removeBtn.innerHTML = "✕";
        removeBtn.className = "remove-palette-btn";
        if (editable) {
            removeBtn.onclick = () => {
                const globalIdx = paletteColors.findIndex(c => c.id === item.id);
                if (globalIdx !== -1) paletteColors.splice(globalIdx, 1);
                let nodeId = getTableId(currentNodeId);
                if (nodePaletteMap[nodeId]) {
                    nodePaletteMap[nodeId] = nodePaletteMap[nodeId].filter(id => id !== item.id);
                }
                savePalette();
                persistAll();
                renderPalette(editable);
                refreshAllProfiles();
                refreshAllGrids();
                updateProfileButtonVisibility();
            };
        } else {
            removeBtn.style.visibility = "hidden";
        }

        // ===== СБОРКА =====
        div.appendChild(colorBox);
        div.appendChild(nameInput);
        div.appendChild(removeBtn);
        container.appendChild(div);
    });
}
function addPaletteColor() {
    openColorPicker();
}
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
    function getContrast(hex) { if (!hex || !hex.startsWith('#')) return 'white'; let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16); return (0.299*r + 0.587*g + 0.114*b) > 140 ? '#1e2024' : '#ffffff'; }
    let activePopup = null;
    function closePopup() { if(activePopup) { activePopup.remove(); activePopup = null; } }
    function showColorPicker(anchor, profile, colorIdx, editable) {
    if (!editable) return;
    closePopup();
    
    // Фильтруем цвета только для текущего диапазона
    let allowedIds = nodePaletteMap[getTableId(currentNodeId)] || [];
    let filteredColors = paletteColors.filter(c => allowedIds.includes(c.id));
    if (filteredColors.length === 0) return;

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

    filteredColors.forEach(pal => {
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
    saveProfiles();
    refreshProfileCard(profile.id);
    refreshAllGrids();
    closePopup();
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
    function refreshProfileCard(pid) {
    const prof = colorProfiles.find(p => p.id === pid);
    if (!prof) return;
    const ref = profileRefs.get(pid);
    if (!ref) return;
    const { sliderContainer, previewBox, minusBtn, plusBtn, radioSpan } = ref;
    let positions = getPositions(prof);
    previewBox.setAttribute("style", getGradientStyleFromProfile(prof) + "; border: 1px solid #3a3e48;");
    
    const oldThumbs = sliderContainer.querySelectorAll('.slider-thumb');
    oldThumbs.forEach(th => th.remove());

    if (prof.colorIds.length === 1) {
        // Один подвижный ползунок
        const fillPercent = positions[0];
        const thumb = document.createElement("div");
        thumb.className = "slider-thumb";
        thumb.style.left = `${fillPercent}%`;
        let colorObj = paletteColors.find(c => c.id === prof.colorIds[0]);
        thumb.style.background = getSliderGradient(colorObj ? colorObj.color : '#3d3d3d');
        thumb.style.color = '#ffffff';
        thumb.textContent = `${Math.round(fillPercent)}%`;
        
        // ВЫБОР ЦВЕТА ПРИ КЛИКЕ
        thumb.onclick = (e) => {
            e.stopPropagation();
            showColorPicker(thumb, prof, 0, ref.editable);
        };
        
        let dragging = false;
        const onMove = (me) => {
            if (!dragging) return;
            const rect = sliderContainer.getBoundingClientRect();
            let newP = (me.clientX - rect.left) / rect.width * 100;
            newP = Math.min(100, Math.max(0, newP));
            if (Math.abs(fillPercent - newP) < 0.5) return;
            prof.boundaries = [newP];
            saveProfiles();
            refreshProfileCard(prof.id);
            refreshAllGrids();
        };
        const up = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', up); };
        thumb.onmousedown = (e) => {
            e.preventDefault();
            dragging = true;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', up);
        };
        sliderContainer.appendChild(thumb);
    } else {
        // Для 2 и 3 цветов
        for (let i = 0; i < prof.colorIds.length; i++) {
            const thumb = document.createElement("div");
            thumb.className = "slider-thumb";
            thumb.style.left = `${positions[i]}%`;
            let colorObj = paletteColors.find(c => c.id === prof.colorIds[i]);
            thumb.style.background = getSliderGradient(colorObj ? colorObj.color : '#3d3d3d');
            thumb.style.color = '#ffffff';
            thumb.textContent = `${Math.round(positions[i])}%`;
            
            // ВЫБОР ЦВЕТА ПРИ КЛИКЕ
            thumb.onclick = (e) => {
                e.stopPropagation();
                showColorPicker(thumb, prof, i, ref.editable);
            };
            
            let dragging = false;
            const onMove = (me) => {
                if (!dragging) return;
                const rect = sliderContainer.getBoundingClientRect();
                let newP = (me.clientX - rect.left) / rect.width * 100;
                newP = Math.min(100, Math.max(0, newP));
                if (i > 0) newP = Math.max(newP, positions[i-1] + 1);
                if (i < positions.length - 1) newP = Math.min(newP, positions[i+1] - 1);
                if (Math.abs(positions[i] - newP) < 0.5) return;
                positions[i] = newP;
                prof.boundaries = positions;
                saveProfiles();
                refreshProfileCard(prof.id);
                refreshAllGrids();
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
    }
    
    if(minusBtn) minusBtn.style.visibility = (prof.colorIds.length <= 1 || !ref.editable) ? 'hidden' : 'visible';
if(plusBtn) plusBtn.style.visibility = (prof.colorIds.length >= 3 || !ref.editable) ? 'hidden' : 'visible';
if (radioSpan) {
    if (activeProfileId === prof.id) radioSpan.classList.add('active');
    else radioSpan.classList.remove('active');
}
}
    function refreshAllProfiles() { colorProfiles.forEach(p => refreshProfileCard(p.id)); }
    function saveProfiles() { persistAll(); }
function renderAllProfiles(editable) {
    const container = document.getElementById("profileList");
    if (!container) return;

    profileRefs.clear();
    container.innerHTML = '';

    // Получаем список разрешённых ID для текущего диапазона
    let allowedIds = nodeProfileMap[getTableId(currentNodeId)] || [];
    let filteredProfiles = colorProfiles.filter(p => allowedIds.includes(p.id));

    const existingIds = new Set(filteredProfiles.map(p => p.id));
    for (let [id, ref] of profileRefs.entries()) {
        if (!existingIds.has(id) && ref.rowDiv?.parentNode) {
            ref.rowDiv.parentNode.remove();
        }
    }

    for (let prof of filteredProfiles) {
        let ref = profileRefs.get(prof.id);
        if (!ref) {
            const card = document.createElement("div");
            card.className = "profile-card";

            const row = document.createElement("div");
            row.className = "profile-row";

            const radio = document.createElement("div");
            radio.className = `profile-radio ${activeProfileId === prof.id ? 'active' : ''}`;
            if (editable) {
                radio.onclick = () => {
                    activeProfileId = prof.id;
                    saveProfiles();
                    radio.classList.add('active');
                    refreshAllProfiles();
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
        saveProfiles();
        refreshProfileCard(prof.id);
        refreshAllGrids();
    };

               plus.onclick = () => {
    if (prof.colorIds.length >= 3) return;
    let newColorId = activeColorId;
if (newColorId === null) {
    alert("Сначала выберите цвет в палитре");
    return;
}
    if (newColorId === null) return;
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
    saveProfiles();
    refreshProfileCard(prof.id);
    refreshAllGrids();
};

                del.onclick = () => {
                    // Разрешаем удалять все профили
              if (filteredProfiles.length === 0) {
                 alert("Нет профилей для удаления");
                    return;
               }
                    
                    showConfirmModal(`Удалить профиль?`, () => {
                        const cardRef = profileRefs.get(prof.id);
                        if (cardRef && cardRef.rowDiv?.parentNode) {
                            cardRef.rowDiv.parentNode.remove();
                        }
                        
                        const idx = colorProfiles.findIndex(p => p.id === prof.id);
                        if (idx !== -1) colorProfiles.splice(idx, 1);
                        
                        let nodeId = getTableId(currentNodeId);
                        if (nodeProfileMap[nodeId]) {
                            nodeProfileMap[nodeId] = nodeProfileMap[nodeId].filter(id => id !== prof.id);
                        }
                        
                        if (activeProfileId === prof.id) {
                            activeProfileId = filteredProfiles[0]?.id || null;
                        }
                        
                        profileRefs.delete(prof.id);
                        saveProfiles();
                        renderAllProfiles(true);
                        refreshAllGrids();
                    });
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
    // Проверяем, существует ли DOM-элемент
    if (!ref.rowDiv?.parentNode) {
        // Если элемент удалён, пересоздаём его
        // Создаём новый профиль заново
        const card = document.createElement("div");
        card.className = "profile-card";

        const row = document.createElement("div");
        row.className = "profile-row";

        const radio = document.createElement("div");
        radio.className = `profile-radio ${activeProfileId === prof.id ? 'active' : ''}`;
        if (editable) {
            radio.onclick = () => {
                activeProfileId = prof.id;
                saveProfiles();
                radio.classList.add('active');
                refreshAllProfiles();
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
        saveProfiles();
        refreshProfileCard(prof.id);
        refreshAllGrids();
    };

    plus.onclick = () => {
        if (prof.colorIds.length >= 3) return;
        let newColorId = activeColorId;
if (newColorId === null) {
    alert("Сначала выберите цвет в палитре");
    return;
}
        if (newColorId === null) return;
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
        saveProfiles();
        refreshProfileCard(prof.id);
        refreshAllGrids();
    };

            del.onclick = () => {
                if (filteredProfiles.length <= 1) {
                    alert("Нельзя удалить последний профиль");
                    return;
                }
                
                showConfirmModal(`Удалить профиль?`, () => {
                    const cardRef = profileRefs.get(prof.id);
                    if (cardRef && cardRef.rowDiv?.parentNode) {
                        cardRef.rowDiv.parentNode.remove();
                    }
                    
                    const idx = colorProfiles.findIndex(p => p.id === prof.id);
                    if (idx !== -1) colorProfiles.splice(idx, 1);
                    
                    let nodeId = getTableId(currentNodeId);
                    if (nodeProfileMap[nodeId]) {
                        nodeProfileMap[nodeId] = nodeProfileMap[nodeId].filter(id => id !== prof.id);
                    }
                    
                    if (activeProfileId === prof.id) {
                        activeProfileId = filteredProfiles[0]?.id || null;
                    }
                    
                    profileRefs.delete(prof.id);
                    saveProfiles();
                    renderAllProfiles(true);
                    refreshAllGrids();
                });
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

        profileRefs.set(prof.id, {
            rowDiv: row,
            sliderContainer: sliderCont,
            previewBox: preview,
            minusBtn: minus,
            plusBtn: plus,
            radioSpan: radio,
            editable
        });
    } else {
        ref.editable = editable;
        if (ref.radioSpan) {
            if (activeProfileId === prof.id) ref.radioSpan.classList.add('active');
            else ref.radioSpan.classList.remove('active');
        }
    }
}
        refreshProfileCard(prof.id);
    }
}
function getSliderGradient(color) {
    // Затемняем цвет на 30% для верхнего оттенка
    let r = parseInt(color.slice(1,3), 16);
    let g = parseInt(color.slice(3,5), 16);
    let b = parseInt(color.slice(5,7), 16);
    let darkR = Math.floor(r * 0.7);
    let darkG = Math.floor(g * 0.7);
    let darkB = Math.floor(b * 0.7);
    let darkColor = `rgb(${darkR}, ${darkG}, ${darkB})`;
    return `linear-gradient(145deg, ${darkColor}, ${color})`;
}
   function createNewProfile() {
    // Проверяем, есть ли активный цвет
    if (activeColorId === null) {
        alert("Сначала выберите цвет в палитре");
        return;
    }
    
    // Проверяем, существует ли цвет с таким ID
    let colorObj = paletteColors.find(c => c.id === activeColorId);
    if (!colorObj) {
        alert("Выбранный цвет не найден");
        return;
    }
    
    // Создаём профиль с активным цветом
    let newId = nextProfileId++;
    colorProfiles.push({
        id: newId,
        name: "Новый профиль",
        colorIds: [activeColorId],
        boundaries: [100]
    });
    
    let nodeId = getTableId(currentNodeId);
    if (!nodeProfileMap[nodeId]) {
        nodeProfileMap[nodeId] = [];
    }
    nodeProfileMap[nodeId].push(newId);
    
    if (colorProfiles.length === 1) activeProfileId = newId;
    saveProfiles();
    renderAllProfiles(true);
    refreshAllGrids();
}
   function resetDefaultProfiles() {
    colorProfiles = [];
    activeProfileId = null;
}
    // Дерево (с компактным меню)
  function addChildNode(parentId) {
    let name = prompt("Название дочернего узла:");
    if (!name) return;
    name = name.trim().slice(0, 20);
    if (!name) return;
    let parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    let newId = nextNodeId++;
    let newNode = {
        id: newId,
        name: name,
        parentId: parentId,
        childrenIds: []
    };
    nodes.push(newNode);
    parent.childrenIds.push(newId);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
}

function renameNode(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let newName = prompt("Новое имя:", node.name);
    if (newName && newName.trim()) {
        node.name = newName.trim().slice(0, 20);
    }
    persistAll();
    refreshAll();
    if (currentNodeId === nodeId) updateCurrentDisplay();
}

function moveNodeUp(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx > 0) {
            [roots[idx - 1], roots[idx]] = [roots[idx], roots[idx - 1]];
            let newNodes = [...roots];
            for (let n of nodes) {
                if (n.parentId !== null) newNodes.push(n);
            }
            nodes = newNodes;
        }
    } else {
        let parent = nodes.find(p => p.id === parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx > 0) {
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        }
    }
    persistAll();
    refreshAll();
}

function moveNodeDown(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx < roots.length - 1) {
            [roots[idx + 1], roots[idx]] = [roots[idx], roots[idx + 1]];
            let newNodes = [...roots];
            for (let n of nodes) {
                if (n.parentId !== null) newNodes.push(n);
            }
            nodes = newNodes;
        }
    } else {
        let parent = nodes.find(p => p.id === parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx < arr.length - 1) {
            [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        }
    }
    persistAll();
    refreshAll();
}

function deleteNode(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.parentId === null && nodes.filter(n => n.parentId === null).length <= 1) {
        alert("Нельзя удалить последний корневой узел");
        return;
    }
    
    function delSub(id) {
        let n = nodes.find(nn => nn.id === id);
        if (!n) return;
        for (let cid of n.childrenIds) {
            delSub(cid);
        }
        nodes = nodes.filter(nn => nn.id !== id);
        delete cellStorage[getTableId(id)];
        let p = nodes.find(p => p.id === n.parentId);
        if (p) {
            p.childrenIds = p.childrenIds.filter(cid => cid !== id);
        }
    }
    
    delSub(nodeId);
    
    if (currentNodeId === nodeId) {
        let newRoot = nodes.find(n => n.parentId === null);
        if (newRoot) {
            selectNode(newRoot.id);
        } else {
            currentNodeId = null;
        }
    }
    
    workLevels = workLevels.filter(lvl => lvl.parentNodeId !== nodeId);
    if (workDisplayNodeId === nodeId) {
        workDisplayNodeId = nodes.find(n => n.parentId === null)?.id || null;
    }
    if (!workLevels.length) {
        workLevels = [{ parentNodeId: null, levelIndex: 0 }];
    }
    persistAll();
    refreshAll();
}
    function addRootNode() {
    let name = prompt("Название новой папки:");
    if (!name) return;
    name = name.trim().slice(0, 20);
    if (!name) return;

    let newId = nextNodeId++;
    let newNode = {
        id: newId,
        name: name,
        parentId: null,
        childrenIds: [],
        type: 'folder'
    };
    nodes.push(newNode);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
}

function createChildNode(parentId, type) {
    let name = prompt("Название нового элемента:");
    if (!name) return;
    name = name.trim().slice(0, 20);
    if (!name) return;

    let parent = nodes.find(n => n.id === parentId);
    if (!parent) return;

    let newId = nextNodeId++;
    let newNode = {
        id: newId,
        name: name,
        parentId: parentId,
        childrenIds: [],
        type: type
    };
    nodes.push(newNode);
    parent.childrenIds.push(newId);
    ensureTable(newId);
    // Инициализируем пустые списки для нового узла
nodePaletteMap[getTableId(newId)] = [];
nodeProfileMap[getTableId(newId)] = [];


    persistAll();
    refreshAll();
    selectNode(newId);
}

function selectNode(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (node && node.type === 'folder') {
        return;
    }
    currentNodeId = nodeId;
    
    // Сбрасываем активный профиль, если он не принадлежит текущему диапазону
    let nodeIdStr = getTableId(currentNodeId);
    let allowedProfileIds = nodeProfileMap[nodeIdStr] || [];
    if (activeProfileId !== null && !allowedProfileIds.includes(activeProfileId)) {
        activeProfileId = null;
    }
    
    // Раскрываем только непосредственного родителя
    if (node && node.parentId !== null) {
        expandedNodes.add(node.parentId);
    }
    
    updateCurrentDisplay();
    refreshAll();
    if (document.getElementById("workPage").classList.contains("active-page")) {
        updateWorkDisplay();
    }
}

function renderTree(containerId, activeNodeId, editable, onSelectNode) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    let rootNodes = nodes.filter(n => n.parentId === null);
let rootOrder = nodes.filter(n => n.parentId === null).map(n => n.id);
rootNodes.sort((a, b) => rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id));
    for (let node of rootNodes) {
        renderTreeNode(container, node, activeNodeId, editable, onSelectNode);
    }
}

function renderTreeNode(parentContainer, node, activeNodeId, editable, onSelectNode) {
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "tree-node";

    const itemDiv = document.createElement("div");
    itemDiv.className = `tree-item ${activeNodeId === node.id ? 'active' : ''}`;

    const arrow = document.createElement("span");
    const isOpen = expandedNodes.has(node.id);
    arrow.textContent = isOpen ? "▼" : "▶";
    arrow.style.cursor = "pointer";
    arrow.style.marginRight = "8px";
    arrow.style.fontSize = "10px";
    arrow.style.color = "#909090";
    

    const nameSpan = document.createElement("span");
    nameSpan.className = "tree-item-name";
    nameSpan.textContent = node.name;

    // Иконка перед названием
    // Иконка перед названием
const iconSpan = document.createElement("span");
let iconSvg = '';
if (node.type === 'folder') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
} else if (node.type === 'range') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>`;
} else if (node.type === 'subrange') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24">
        <rect x="3" y="3" width="8" height="8" rx="1"/>
        <rect x="13.5" y="3.5" width="7" height="7" rx="1" fill="none" stroke="var(--text-primary)" stroke-width="1"/>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1" fill="none" stroke="var(--text-primary)" stroke-width="1"/>
        <rect x="13" y="13" width="8" height="8" rx="1"/>
    </svg>`;
}
iconSpan.innerHTML = iconSvg;
nameSpan.prepend(iconSpan);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "tree-actions-popup";
    if (editable) {
        const menuBtn = document.createElement("button");
        menuBtn.textContent = "⋮";
        menuBtn.className = "tree-menu-btn";
        menuBtn.style.fontSize = "20px";

        const popupMenu = document.createElement("div");
        popupMenu.className = "popup-menu";
        popupMenu.style.display = "none";

        // Кнопки в зависимости от типа узла
    if (node.type === 'folder') {
    // Для папки (корневой или вложенной) — добавляем папку и диапазон
    const addFolderBtn = document.createElement("button");
    addFolderBtn.textContent = "+ Добавить папку";
    addFolderBtn.onclick = (e) => {
        e.stopPropagation();
        createChildNode(node.id, 'folder');
        closeMenu();
    };
    popupMenu.appendChild(addFolderBtn);

    const addRangeBtn = document.createElement("button");
    addRangeBtn.textContent = "+ Добавить диапазон";
    addRangeBtn.onclick = (e) => {
        e.stopPropagation();
        createChildNode(node.id, 'range');
        closeMenu();
    };
    popupMenu.appendChild(addRangeBtn);
} else if (node.type === 'range') {
    // Для диапазона — добавляем папку и поддиапазон
    const addFolderBtn = document.createElement("button");
    addFolderBtn.textContent = "+ Добавить папку";
    addFolderBtn.onclick = (e) => {
        e.stopPropagation();
        createChildNode(node.id, 'folder');
        closeMenu();
    };
    popupMenu.appendChild(addFolderBtn);

    const addSubrangeBtn = document.createElement("button");
    addSubrangeBtn.textContent = "+ Добавить поддиапазон";
    addSubrangeBtn.onclick = (e) => {
        e.stopPropagation();
        createChildNode(node.id, 'subrange');
        closeMenu();
    };
    popupMenu.appendChild(addSubrangeBtn);
} else if (node.type === 'subrange') {
    // Для поддиапазона — ничего не добавляем (только общие кнопки)
}

        // Общие кнопки для всех типов
        const renameBtn = document.createElement("button");
        renameBtn.textContent = "Переименовать";
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            renameNode(node.id);
            closeMenu();
        };
        popupMenu.appendChild(renameBtn);
const upBtn = document.createElement("button");
upBtn.textContent = "↑ Вверх";
upBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    moveNodeUp(node.id);
    closeMenu();
};
        
        popupMenu.appendChild(upBtn);

       const downBtn = document.createElement("button");
downBtn.textContent = "↓ Вниз";
downBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    moveNodeDown(node.id);
    closeMenu();
};
        popupMenu.appendChild(downBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Удалить";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteNode(node.id);
            closeMenu();
        };
        popupMenu.appendChild(delBtn);

        actionsDiv.appendChild(menuBtn);
        actionsDiv.appendChild(popupMenu);

        function closeMenu() {
            popupMenu.style.display = "none";
            document.removeEventListener('click', outsideClick);
        }
        function outsideClick(e) {
            if (!actionsDiv.contains(e.target)) closeMenu();
        }
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpenMenu = popupMenu.style.display === "block";
            closeMenu();
            if (!isOpenMenu) {
                popupMenu.style.display = "block";
                document.addEventListener('click', outsideClick);
            }
        };
    }

    itemDiv.append(arrow, nameSpan, actionsDiv);
    itemDiv.onclick = (e) => {
        if (e.target.tagName !== 'BUTTON' && e.target !== arrow) {
            onSelectNode(node.id);
        }
    };
    arrow.onclick = (e) => {
        e.stopPropagation();
        expandedNodes.has(node.id) ? expandedNodes.delete(node.id) : expandedNodes.add(node.id);
        refreshTreeOnly();
    };

    nodeDiv.appendChild(itemDiv);

    const childrenDiv = document.createElement("div");
    childrenDiv.className = "tree-children";
    if (isOpen) childrenDiv.classList.add("open");

    if (node.childrenIds && node.childrenIds.length) {
        let childNodes = node.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
        childNodes.sort((a, b) => node.childrenIds.indexOf(a.id) - node.childrenIds.indexOf(b.id));
        for (let child of childNodes) {
            renderTreeNode(childrenDiv, child, activeNodeId, editable, onSelectNode);
        }
    }

    nodeDiv.appendChild(childrenDiv);
    parentContainer.appendChild(nodeDiv);
}

function refreshTreeOnly() {
    if (document.getElementById("constructorPage").classList.contains("active-page")) {
        renderTree("constructorTree", currentNodeId, true, selectNode);
    }
}

function findFirstRange(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    if (node.type === 'range' || node.type === 'subrange') return node.id;
    for (let childId of node.childrenIds) {
        let result = findFirstRange(childId);
        if (result !== null) return result;
    }
    return null;
}

function renderWorkNavigation() {
    const container = document.getElementById("workLevelsContainer");
    if (!container) return;
    container.innerHTML = "";

    for (let li = 0; li < workLevels.length; li++) {
        const level = workLevels[li];
        const parentId = level.parentNodeId;
        let children = [];

        if (parentId === null) {
            children = nodes.filter(n => n.parentId === null);
            let rootOrder = nodes.filter(n => n.parentId === null).map(n => n.id);
            children.sort((a, b) => rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id));
        } else {
            let parent = nodes.find(n => n.id === parentId);
            if (parent) {
                children = parent.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
                children.sort((a, b) => parent.childrenIds.indexOf(a.id) - parent.childrenIds.indexOf(b.id));
            }
        }

        if (children.length === 0) continue;

        const levelDiv = document.createElement("div");
        levelDiv.className = "work-level";
        levelDiv.style.display = "flex";
        levelDiv.style.flexWrap = "wrap";
        levelDiv.style.gap = "8px";
        levelDiv.style.marginBottom = "8px";

        for (let child of children) {
            if (child.type === 'folder') {
                let parent = nodes.find(n => n.id === child.parentId);
                let parentIsRange = parent && parent.type === 'range';
                let parentIsSelectedRange = parentIsRange && workLevels.some(l => l.parentNodeId === child.parentId);
                
                if (!parentIsSelectedRange) {
                    const btn = document.createElement("button");
                    btn.className = "folder-btn";
                    btn.innerText = child.name;
                    btn.onclick = (function(c, idx) {
                        return function() {
                            workLevels = workLevels.slice(0, idx + 1);
                            workLevels.push({ parentNodeId: c.id, levelIndex: idx + 1 });
                            persistAll();
                            updateWorkDisplay();
                        };
                    })(child, li);
                    
                    const lastLevel = workLevels[workLevels.length - 1];
                    const isActiveFolder = lastLevel && lastLevel.parentNodeId === child.id;
                    if (isActiveFolder) {
                        btn.classList.add("active");
                    } else {
                        btn.classList.remove("active");
                    }
                    levelDiv.appendChild(btn);
                }
            } else if (child.type === 'range' || child.type === 'subrange') {
                let parent = nodes.find(n => n.id === child.parentId);
                let parentIsRange = parent && parent.type === 'range';
                let parentIsSelectedRange = parentIsRange && workLevels.some(l => l.parentNodeId === child.parentId);
                let isRoot = child.parentId === null;
                
                if (isRoot || !parentIsSelectedRange) {
                    const link = document.createElement("span");
                    link.className = "range-link";
                    link.innerText = child.name;
                    if (workDisplayNodeId === child.id) {
                        link.classList.add("active");
                    } else {
                        link.classList.remove("active");
                    }
                    link.onclick = (function(c) {
                        return function() {
                            workDisplayNodeId = c.id;
                            let path = [];
                            let current = c;
                            while (current && current.parentId !== null) {
                                let parentNode = nodes.find(n => n.id === current.parentId);
                                if (parentNode) {
                                    path.unshift(parentNode);
                                    current = parentNode;
                                } else {
                                    current = null;
                                }
                            }
                            workLevels = [{ parentNodeId: null, levelIndex: 0 }];
                            for (let p of path) {
                                workLevels.push({ parentNodeId: p.id, levelIndex: workLevels.length });
                            }
                            workLevels.push({ parentNodeId: c.id, levelIndex: workLevels.length });
                            persistAll();
                            updateWorkDisplay();
                            updateWorkGrid();
                        };
                    })(child);
                    levelDiv.appendChild(link);
                }
            }
        }

        container.appendChild(levelDiv);

        // Дети диапазона (отдельный блок, только на первом уровне)
        if (li === 0) {
            let sel = nodes.find(n => n.id === workDisplayNodeId);
            let rangeNode = sel;
            if (sel && sel.type === 'subrange') {
                rangeNode = nodes.find(n => n.id === sel.parentId);
            }
            if (rangeNode && rangeNode.type === 'range' && rangeNode.parentId === null) {
                let isInLevels = workLevels.some(l => l.parentNodeId === rangeNode.id);
                if (isInLevels) {
                    let kids = rangeNode.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
                    if (kids.length) {
                        let alreadyAdded = false;
                        let mainDiv = container.querySelector('.work-level:last-child');
                        if (mainDiv) {
                            let mainItems = mainDiv.querySelectorAll('.folder-btn, .range-link');
                            mainItems.forEach(el => {
                                if (kids.some(k => k.name === el.textContent)) {
                                    alreadyAdded = true;
                                }
                            });
                        }
                        if (!alreadyAdded) {
                            const hr = document.createElement("hr");
                            hr.style.margin = "8px 0";
                            hr.style.border = "0";
                            hr.style.borderTop = "1px solid #3D3D3D";
                            container.appendChild(hr);
                            
                            const subLevelDiv = document.createElement("div");
                            subLevelDiv.className = "work-level";
                            subLevelDiv.style.display = "flex";
                            subLevelDiv.style.flexWrap = "wrap";
                            subLevelDiv.style.gap = "8px";
                            subLevelDiv.style.marginBottom = "8px";
                            subLevelDiv.style.paddingLeft = "20px";
                            
                            for (let kid of kids) {
                                if (kid.type === 'folder') {
                                    const subBtn = document.createElement("button");
                                    subBtn.className = "folder-btn";
                                    subBtn.innerText = kid.name;
                                    subBtn.onclick = (function(k, idx) {
                                        return function() {
                                            workLevels = workLevels.slice(0, idx + 1);
                                            workLevels.push({ parentNodeId: k.id, levelIndex: idx + 1 });
                                            let firstRange = findFirstRange(k.id);
                                            if (firstRange !== null) {
                                                workDisplayNodeId = firstRange;
                                            }
                                            persistAll();
                                            updateWorkDisplay();
                                        };
                                    })(kid, workLevels.length);
                                    subLevelDiv.appendChild(subBtn);
                                } else if (kid.type === 'subrange') {
                                    const subLink = document.createElement("span");
                                    subLink.className = "range-link";
                                    subLink.innerText = kid.name;
                                    if (workDisplayNodeId === kid.id) {
                                        subLink.classList.add("active");
                                    } else {
                                        subLink.classList.remove("active");
                                    }
                                    subLink.onclick = (function(k) {
                                        return function() {
                                            workDisplayNodeId = k.id;
                                            persistAll();
                                            updateWorkDisplay();
                                            updateWorkGrid();
                                        };
                                    })(kid);
                                    subLevelDiv.appendChild(subLink);
                                }
                            }
                            container.appendChild(subLevelDiv);
                        }
                    }
                }
            }
        }

        if (li < workLevels.length - 1) {
            const hr = document.createElement("hr");
            hr.style.margin = "8px 0";
            hr.style.border = "0";
            hr.style.borderTop = "1px solid #3D3D3D";
            container.appendChild(hr);
        }
    }

    if (!workDisplayNodeId) {
        const gridDiv = document.getElementById("workGrid");
        if (gridDiv) {
            gridDiv.innerHTML = "<div style='padding:20px; color: var(--text-muted);'>Выберите диапазон</div>";
        }
    }
}
    function updateWorkGrid() {
    if (!workDisplayNodeId) return;
    let total = countTotalCombos(workDisplayNodeId);
    let percent = (total / 1326 * 100).toFixed(1);
    document.getElementById("workStats").innerHTML = `${percent}% (${total}/1326)`;
    renderGrid("workGrid", workDisplayNodeId, null);
}
    function updateWorkDisplay() {
    renderWorkNavigation();
    if (workDisplayNodeId) {
        updateWorkGrid();
        // Обновляем заголовок с именем диапазона
        let rangeNode = nodes.find(n => n.id === workDisplayNodeId);
        let titleEl = document.getElementById("workRangeName");
        if (titleEl && rangeNode) {
            titleEl.textContent = rangeNode.name;
        }
    }
}

function getParentRange(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    if (node.type === 'range') return node;
    if (node.type === 'subrange') {
        let current = node;
        while (current && current.type !== 'range') {
            current = nodes.find(n => n.id === current.parentId);
        }
        return current;
    }
    return null;
}
    
function getGradientStyleFromProfile(profile) {
    if (!profile || !profile.colorIds || profile.colorIds.length === 0) {
        return '';
    }
    let colors = profile.colorIds.map(id => {
        let color = paletteColors.find(c => c.id === id);
        return color ? color.color : '#3d3d3d';
    });
    let positions = getPositions(profile);
    return getGradientStyle(colors, positions);
}

function renderGrid(containerId, nodeId, clickHandler) {
    const gridDiv = document.getElementById(containerId);
    if (!nodeId || !cellStorage[getTableId(nodeId)]) {
        gridDiv.innerHTML = "<div style='padding:20px'>Нет таблицы</div>";
        return;
    }
    const matrix = cellStorage[getTableId(nodeId)];
    gridDiv.innerHTML = "";
    
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const hand = rowsData[i][j];
            const pid = matrix[i][j];
            const prof = colorProfiles.find(p => p.id === pid);
            const cell = document.createElement("div");
            cell.className = "hand-cell";
            cell.setAttribute("data-row", i);
            cell.setAttribute("data-col", j);
            cell.justChanged = false;
            let cellKey = `${i}_${j}`;
            cell.blockUntil = blockUntilMap.get(cellKey) || 0;
// Проверяем, является ли текущий узел поддиапазоном
let currentNode = nodes.find(n => n.id === nodeId);
let isSubrange = currentNode && currentNode.type === 'subrange';
let parentRange = null;
if (isSubrange) {
    parentRange = getParentRange(nodeId);
}

// Проверяем, есть ли профиль у родителя для пустой ячейки
let hasParentProfile = false;
if (isSubrange && pid === null && parentRange) {
    let parentPid = getCellProfile(parentRange.id, i, j);
    if (parentPid !== null) {
        hasParentProfile = true;
    }
}

            let isColored = false;
            let originalGradient = null;
            let originalBg = null;
            let originalColor = null;
            let justCleared = false;

         if (prof && prof.colorIds && prof.colorIds.length) {
    let pos = getPositions(prof);
    originalGradient = getGradientStyleFromProfile(prof) + "; color: #FFFFFF;";
    cell.setAttribute("style", originalGradient);
    isColored = true;
} else {
    originalBg = "var(--bg-card)";
    // Если ячейка пустая и у родителя есть профиль — добавляем класс
    if (hasParentProfile) {
        cell.classList.add('has-parent-profile');
    }
}

   // Временное наведение (с принудительной перерисовкой)
cell.onmouseenter = () => {
    if (Date.now() < cell.blockUntil) {
        return;
    }
    if (containerId === "constructorGrid" && !painting && !cell.justChanged) {
        const isColored = pid !== null;
        if (isColored) {
            requestAnimationFrame(() => {
                cell.removeAttribute("style");
                cell.style.opacity = "0.7";
                cell.style.color = "#FFFFFF";
            });
        } else if (activeProfileId) {
           const activeProf = colorProfiles.find(p => p.id === activeProfileId);
if (activeProf && activeProf.colorIds && activeProf.colorIds.length) {
    let pos = getPositions(activeProf);
    let gradStyle = getGradientStyleFromProfile(activeProf);
    requestAnimationFrame(() => {
        cell.setAttribute("style", gradStyle + "; color: #FFFFFF; filter: brightness(0.7);");
    });
            }
        }
    }
};

           cell.onmouseleave = () => {
    if (!painting) {
        requestAnimationFrame(() => {
            if (isColored && originalGradient) {
                cell.setAttribute("style", originalGradient);
            } else {
                cell.removeAttribute("style");
                // Возвращаем класс, если нужно
                if (hasParentProfile) {
                    cell.classList.add('has-parent-profile');
                }
            }
            cell.justChanged = false;
            let cellKey = `${i}_${j}`;
            blockUntilMap.set(cellKey, 0);
            cell.blockUntil = 0;
        });
    }
};

            cell.innerText = hand;
            gridDiv.appendChild(cell);
        }
    }
}

function formatCombos(combos) {
    // Округляем до 1 знака
    let rounded = Math.round(combos * 10) / 10;
    
    // Если после округления число целое (без дробной части)
    if (rounded % 1 === 0) {
        return rounded.toString();
    }
    return rounded.toFixed(1);
}
    function updateCurrentDisplay() {
    if (!currentNodeId) return;
    let total = countTotalCombos(currentNodeId);
    const childContainer = document.getElementById("constructorChildButtons");
    if (childContainer) childContainer.innerHTML = "";
    let node = nodes.find(n => n.id === currentNodeId);
    if (node && childContainer) {
        let childrenNodes = node.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
        for (let child of childrenNodes) {
            let btn = document.createElement("button");
            btn.className = "btn-oval";
            btn.innerText = child.name;
            btn.onclick = () => selectNode(child.id);
            childContainer.appendChild(btn);
        }
    }
    const backBtn = document.getElementById("backButton");
    if (node && node.parentId !== null && backBtn) {
        let parentNode = nodes.find(n => n.id === node.parentId);
        if (parentNode) {
            backBtn.style.display = "flex";
            backBtn.onclick = () => selectNode(parentNode.id);
            backBtn.innerText = `← ${parentNode.name}`;
        } else backBtn.style.display = "none";
    } else if (backBtn) {
        backBtn.style.display = "none";
    }
    renderGrid("constructorGrid", currentNodeId, null);

    // ========== СТАТИСТИКА ПОД ТАБЛИЦЕЙ ==========
    let statsContainer = document.getElementById("profileStats");
    if (!statsContainer) {
        statsContainer = document.createElement("div");
        statsContainer.id = "profileStats";
        statsContainer.style.marginTop = "10px";
        statsContainer.style.fontSize = "13px";
        statsContainer.style.lineHeight = "1.8";
        statsContainer.style.display = "flex";
        statsContainer.style.justifyContent = "flex-end";
        const tablePanel = document.querySelector(".table-panel");
        if (tablePanel) tablePanel.appendChild(statsContainer);
    }

    const colorStats = {};
    let totalCombosWeighted = 0;
    const matrix = cellStorage[getTableId(currentNodeId)];
    if (matrix) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                const pid = matrix[i][j];
                if (pid === null) continue;
                const prof = colorProfiles.find(p => p.id === pid);
                if (!prof) continue;

                const hand = rowsData[i][j];
                let handTotalCombos = 0;
                if (hand.includes('s')) handTotalCombos = 4;
                else if (hand.includes('o')) handTotalCombos = 12;
                else if (hand[0] === hand[1]) handTotalCombos = 6;

                const positions = getPositions(prof);
                let prev = 0;
                for (let k = 0; k < prof.colorIds.length; k++) {
                    const share = (positions[k] - prev) / 100;
                    const combosShare = Math.round((handTotalCombos * share) * 10) / 10;
                    totalCombosWeighted += combosShare;

                    let colorObj = paletteColors.find(c => c.id === prof.colorIds[k]);
                    let color = colorObj ? colorObj.color : '#3d3d3d';
                    const colorKey = `color_${prof.colorIds[k]}_${k}`;
                    if (!colorStats[colorKey]) {
                        colorStats[colorKey] = { combos: 0, color: color };
                    }
                    colorStats[colorKey].combos += combosShare;
                    prev = positions[k];
                }
            }
        }
    }

    if (statsContainer && totalCombosWeighted > 0) {
        let html = `<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end;">`;
        
        let colorRows = [];
        let totalPercentSum = 0;
        let totalCombosSum = 0;
        
        for (const [key, data] of Object.entries(colorStats)) {
            const percent = (data.combos / 1326 * 100).toFixed(2);
            totalPercentSum += parseFloat(percent);
            totalCombosSum += data.combos;
            colorRows.push(`<div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
                                <span style="display: inline-block; width: 20px; height: 10px; background: ${data.color}; border-radius: 3px;"></span>
                                <span>${percent}% (${formatCombos(data.combos)}/1326)</span>
                             </div>`);
        }
        
        html += `<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; justify-content: flex-end;">
                    <span>${totalPercentSum.toFixed(2)}% (${formatCombos(totalCombosSum)}/1326)</span>
                 </div>`;
        
        html += colorRows.join('');
        html += `</div>`;
        statsContainer.innerHTML = html;
    } else if (statsContainer) {
        statsContainer.innerHTML = `<div style="color: var(--text-muted);">Нет установленных диапазонов</div>`;
    }
}
    // ---------- ВЫБОР КАРТ ----------
    const rankOrder = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
    const suits = ["h","c","d","s"];
    const suitSymbols = { h: "♥", c: "♣", d: "♦", s: "♠" };
    const suitColors = { h: "#ff6666", c: "#2ecc71", d: "#2f80ed", s: "#cccccc" };
    let currentBoard = { flop: [null,null,null], turn: null, river: null };
    const slotElements = { flop1: document.getElementById("flopSlot1"), flop2: document.getElementById("flopSlot2"), flop3: document.getElementById("flopSlot3"), turn: document.getElementById("turnSlot"), river: document.getElementById("riverSlot") };
// ========== МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ==========
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById("confirmModal");
    const msgSpan = document.getElementById("confirmMessage");
    const yesBtn = document.getElementById("confirmYes");
    const noBtn = document.getElementById("confirmNo");
    
    if (!modal) {
        console.error("Модальное окно не найдено в HTML");
        return;
    }
    
    msgSpan.textContent = message;
    modal.style.display = "flex";
    
    function cleanup() {
        modal.style.display = "none";
        yesBtn.removeEventListener("click", handleYes);
        noBtn.removeEventListener("click", handleNo);
    }
    
    function handleYes() {
        cleanup();
        onConfirm();
    }
    
    function handleNo() {
        cleanup();
    }
    
    yesBtn.addEventListener("click", handleYes);
    noBtn.addEventListener("click", handleNo);
}
    function renderCardsGrid() { const grid = document.getElementById("cardsGrid"); if (!grid) return; grid.innerHTML = ""; for (let rank of rankOrder.slice().reverse()) { for (let suit of suits) { const cardDiv = document.createElement("div"); cardDiv.className = "card-item"; const rankSpan = document.createElement("span"); rankSpan.textContent = rank; const suitSpan = document.createElement("span"); suitSpan.textContent = suitSymbols[suit]; suitSpan.style.color = suitColors[suit]; cardDiv.appendChild(rankSpan); cardDiv.appendChild(suitSpan); cardDiv.onclick = () => addCard(rank, suit); grid.appendChild(cardDiv); } } }
    function addCard(rank, suit) { for (let i=0;i<3;i++) if (currentBoard.flop[i] === null) { currentBoard.flop[i] = {rank,suit}; updateSlotUI(); return; } if (currentBoard.turn === null) { currentBoard.turn = {rank,suit}; updateSlotUI(); return; } if (currentBoard.river === null) { currentBoard.river = {rank,suit}; updateSlotUI(); return; } }
    function removeSlot(slotType, index) { if (slotType === 'flop' && index !== undefined) currentBoard.flop[index] = null; else if (slotType === 'turn') currentBoard.turn = null; else if (slotType === 'river') currentBoard.river = null; updateSlotUI(); }
    function updateSlotUI() { for (let i=0;i<3;i++) { let card = currentBoard.flop[i]; let el = i===0 ? slotElements.flop1 : (i===1 ? slotElements.flop2 : slotElements.flop3); if (card) { el.innerHTML = `${card.rank}<span style="color:${suitColors[card.suit]}">${suitSymbols[card.suit]}</span>`; el.classList.remove("empty"); el.onclick = () => removeSlot('flop', i); } else { el.innerHTML = "—"; el.classList.add("empty"); el.onclick = () => {}; } } if (currentBoard.turn) { slotElements.turn.innerHTML = `${currentBoard.turn.rank}<span style="color:${suitColors[currentBoard.turn.suit]}">${suitSymbols[currentBoard.turn.suit]}</span>`; slotElements.turn.classList.remove("empty"); slotElements.turn.onclick = () => removeSlot('turn'); } else { slotElements.turn.innerHTML = "—"; slotElements.turn.classList.add("empty"); } if (currentBoard.river) { slotElements.river.innerHTML = `${currentBoard.river.rank}<span style="color:${suitColors[currentBoard.river.suit]}">${suitSymbols[currentBoard.river.suit]}</span>`; slotElements.river.classList.remove("empty"); slotElements.river.onclick = () => removeSlot('river'); } else { slotElements.river.innerHTML = "—"; slotElements.river.classList.add("empty"); } }
    function clearAll() { currentBoard = { flop: [null,null,null], turn: null, river: null }; updateSlotUI(); }
    function randomCard() { const ranks = rankOrder.slice().reverse(); return { rank: ranks[Math.floor(Math.random() * ranks.length)], suit: suits[Math.floor(Math.random() * suits.length)] }; }
    function randomFill() { clearAll(); let used = new Set(); function addUnique() { for(let t=0;t<100;t++) { let c = randomCard(); let key = c.rank + c.suit; if (!used.has(key)) { used.add(key); return c; } } return null; } for (let i=0;i<3;i++) { let c = addUnique(); if(c) currentBoard.flop[i]=c; } let ct = addUnique(); if(ct) currentBoard.turn=ct; let cr = addUnique(); if(cr) currentBoard.river=cr; updateSlotUI(); }
    // ---------- АНАЛИЗ (разделение сета и трипса, бледные нули) ----------
    const rankMapEval = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14 };
    const suitMapEval = {"c":0,"d":1,"h":2,"s":3};
    function getBoardFromSlots() { let board = []; for (let i=0;i<3;i++) if (currentBoard.flop[i]) board.push(currentBoard.flop[i]); if (currentBoard.turn) board.push(currentBoard.turn); if (currentBoard.river) board.push(currentBoard.river); return board; }
    function getHandCombos(handStr, boardCards = []) {
    // Если нет карт на доске, считаем как обычно
    if (!boardCards || boardCards.length === 0) {
        if (handStr[0] === handStr[1]) return 6;
        if (handStr.includes('s')) return 4;
        return 12;
    }
    
    // Генерируем все возможные комбинации и считаем только те, что не используют карты с доски
    const allCombos = generateAllPossibleCombos(handStr);
    let validCount = 0;
    
    for (const combo of allCombos) {
        let used = false;
        for (const boardCard of boardCards) {
            if (combo.rank1 === boardCard.rank && combo.suit1 === boardCard.suit) used = true;
            if (combo.rank2 === boardCard.rank && combo.suit2 === boardCard.suit) used = true;
        }
        if (!used) validCount++;
    }
    return validCount;
}

// Вспомогательная функция: генерирует все возможные комбинации без учёта блокеров
function generateAllPossibleCombos(handStr) {
    const ranks = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
    const suits = ["c","d","h","s"];
    const combos = [];
    
    if (handStr[0] === handStr[1]) {
        // Карманная пара: все сочетания мастей
        for (let i = 0; i < suits.length; i++) {
            for (let j = i + 1; j < suits.length; j++) {
                combos.push({
                    rank1: handStr[0], suit1: suits[i],
                    rank2: handStr[0], suit2: suits[j]
                });
            }
        }
    } else if (handStr.includes('s')) {
        // Одномастные: только одинаковые масти
        for (let s of suits) {
            combos.push({
                rank1: handStr[0], suit1: s,
                rank2: handStr[1], suit2: s
            });
        }
    } else {
        // Разномастные: разные масти
        for (let s1 of suits) {
            for (let s2 of suits) {
                if (s1 !== s2) {
                    combos.push({
                        rank1: handStr[0], suit1: s1,
                        rank2: handStr[1], suit2: s2
                    });
                }
            }
        }
    }
    return combos;
}
    function parseHand(handStr) { if (handStr[0] === handStr[1]) return { rank1: handStr[0], rank2: handStr[0], suited: false }; return { rank1: handStr[0], rank2: handStr[1], suited: handStr[2] === 's' }; }
    function generateHoleCards(handStr, boardCards = []) {
    let info = parseHand(handStr);
    let suitsArr = ["c","d","h","s"];
    let allCombos = [];
    
    if (info.rank1 === info.rank2) {
        // Карманная пара
        for (let i = 0; i < suitsArr.length; i++) {
            for (let j = i + 1; j < suitsArr.length; j++) {
                allCombos.push({
                    rank1: info.rank1, suit1: suitsArr[i],
                    rank2: info.rank2, suit2: suitsArr[j]
                });
            }
        }
    } else if (info.suited) {
        // Одномастные
        for (let s of suitsArr) {
            allCombos.push({
                rank1: info.rank1, suit1: s,
                rank2: info.rank2, suit2: s
            });
        }
    } else {
        // Разномастные
        for (let s1 of suitsArr) {
            for (let s2 of suitsArr) {
                if (s1 !== s2) {
                    allCombos.push({
                        rank1: info.rank1, suit1: s1,
                        rank2: info.rank2, suit2: s2
                    });
                }
            }
        }
    }
    
    // Фильтруем комбинации, которые используют карты с доски
    if (!boardCards || boardCards.length === 0) return allCombos;
    
    return allCombos.filter(combo => {
        for (const boardCard of boardCards) {
            if (combo.rank1 === boardCard.rank && combo.suit1 === boardCard.suit) return false;
            if (combo.rank2 === boardCard.rank && combo.suit2 === boardCard.suit) return false;
        }
        return true;
    });
}
    function evaluate5Cards(cards) { let ranks = cards.map(c => rankMapEval[c.rank]).sort((a,b)=>a-b); let suits = cards.map(c => suitMapEval[c.suit]); let isFlush = suits.every(s => s === suits[0]); let isStraight = false; let uniqueRanks = [...new Set(ranks)]; if (uniqueRanks.length >= 5) { for (let i=0;i<=uniqueRanks.length-5;i++) if (uniqueRanks[i+4] - uniqueRanks[i] === 4) { isStraight=true; break; } if (!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) isStraight=true; } let rankCounts = {}; ranks.forEach(r=>rankCounts[r]=(rankCounts[r]||0)+1); let values = Object.values(rankCounts); let hasQuad = values.includes(4); let hasTrip = values.includes(3); let pairs = values.filter(v=>v===2).length; if (isFlush && isStraight) return "Стрит-флеш"; if (hasQuad) return "Каре"; if (hasTrip && pairs===1) return "Фулл-хаус"; if (isFlush) return "Флеш"; if (isStraight) return "Стрит"; if (hasTrip) return "Трипс"; if (pairs===2) return "Две пары"; if (pairs===1) return "Одна пара"; return "Старшая карта"; }
    function evaluateBestHandWithSetInfo(hole, board) { let allCards = [...hole, ...board]; if (allCards.length < 5) return { made: "Недостаточно карт", isSet: false }; let best = "Старшая карта"; let bestScore = 0; let bestIsSet = false; const handRankScore = { "Стрит-флеш":9, "Каре":8, "Фулл-хаус":7, "Флеш":6, "Стрит":5, "Трипс":4, "Две пары":3, "Одна пара":2, "Старшая карта":1 }; for (let i=0;i<allCards.length;i++) { for (let j=i+1;j<allCards.length;j++) { for (let k=j+1;k<allCards.length;k++) { for (let l=k+1;l<allCards.length;l++) { for (let m=l+1;m<allCards.length;m++) { let comb = [allCards[i],allCards[j],allCards[k],allCards[l],allCards[m]]; let made = evaluate5Cards(comb); let sc = handRankScore[made]; let isSet = false; if (made === "Трипс") { // находим ранг трипса
                        let combRanks = comb.map(c=>rankMapEval[c.rank]); let rankCounts = {}; combRanks.forEach(r=>rankCounts[r]=(rankCounts[r]||0)+1); let tripleRank = null; for (let r in rankCounts) if (rankCounts[r]===3) tripleRank = parseInt(r); if (tripleRank !== null) { // проверяем, есть ли в hole две карты этого ранга (карманная пара)
                            let holeRanks = [rankMapEval[hole[0].rank], rankMapEval[hole[1].rank]]; if (holeRanks[0] === holeRanks[1] && holeRanks[0] === tripleRank) isSet = true; } } if (sc > bestScore) { bestScore = sc; best = made; bestIsSet = isSet; } else if (sc === bestScore && !bestIsSet && isSet) bestIsSet = true; } } } } } return { made: best, isSet: bestIsSet }; }
    function getHandCategories(hole, board) { let result = { made: "", flushDraw: false, nutFlushDraw: false, oesd: false, gutshot: false, overcards: false, pairType: "", isSet: false }; if (board.length < 3) return result; let evalRes = evaluateBestHandWithSetInfo(hole, board); result.made = evalRes.made; result.isSet = evalRes.isSet; let holeRanks = [rankMapEval[hole[0].rank], rankMapEval[hole[1].rank]]; let boardRanks = board.map(c=>rankMapEval[c.rank]); let allRanks = [...holeRanks, ...boardRanks]; let rankCounts = {}; allRanks.forEach(r=>rankCounts[r]=(rankCounts[r]||0)+1); let pairRank = null; for (let r in rankCounts) if (rankCounts[r]===2) { pairRank = parseInt(r); break; } if (pairRank !== null) { let boardHighest = Math.max(...boardRanks); if (pairRank > boardHighest) result.pairType = "overpair"; else if (pairRank === boardHighest) result.pairType = "top pair"; else { let uniqueBoardRanks = [...new Set(boardRanks)].sort((a,b)=>b-a); if (pairRank === uniqueBoardRanks[1]) result.pairType = "middle pair"; else result.pairType = "weak pair"; } } else { if (holeRanks.includes(14) || boardRanks.includes(14)) result.pairType = "ace high"; else result.pairType = "no made hand"; } for (let s of ["c","d","h","s"]) { let holeSuitCount = hole.filter(c=>c.suit===s).length; let boardSuitCount = board.filter(c=>c.suit===s).length; if (holeSuitCount + boardSuitCount === 4) { result.flushDraw = true; let aceInSuit = hole.some(c=>c.rank==="A" && c.suit===s) || board.some(c=>c.rank==="A" && c.suit===s); if (aceInSuit) result.nutFlushDraw = true; break; } } let allRanksSorted = [...holeRanks, ...boardRanks].sort((a,b)=>a-b); let unique = [...new Set(allRanksSorted)]; let hasOESD = false, hasGutshot = false; for (let i=0;i<unique.length-3;i++) { if (unique[i+3]-unique[i]===3) { let ml = unique[i]-1, mh = unique[i+3]+1; if (ml>=2 && ml<=14 && !unique.includes(ml)) hasOESD=true; if (mh>=2 && mh<=14 && !unique.includes(mh)) hasOESD=true; } } if (!hasOESD) for (let i=0;i<unique.length-3;i++) if (unique[i+3]-unique[i]===4 && !unique.includes(unique[i]+1) && !unique.includes(unique[i]+2) && !unique.includes(unique[i]+3)) hasGutshot=true; result.oesd = hasOESD; result.gutshot = hasGutshot; if (!pairRank && !result.flushDraw && !result.oesd && !result.gutshot) { let maxBoard = Math.max(...boardRanks); if (holeRanks[0] > maxBoard && holeRanks[1] > maxBoard) result.overcards = true; } return result; }
    function analyzeRangeReal(nodeId, boardCards) { if (!nodeId) return null; const matrix = cellStorage[getTableId(nodeId)]; if (!matrix) return null; let categories = { "Каре":0,"Фулл-хаус":0,"Флеш":0,"Стрит":0,"Сет":0,"Трипс":0,"Две пары":0,"Оверпара":0,"Топ-пара":0,"Пара ниже топ-пары":0,"Средняя пара":0,"Слабая пара":0,"Туз-хай":0,"Нет руки":0,"Флеш-дро (2 карты)":0,"Натсовое флеш-дро (1 карта)":0,"OESD":0,"Гатшот":0,"Оверкарты":0,"Флеш-дро + пара":0,"Флеш-дро + OESD":0,"Флеш-дро + гатшот":0,"OESD + пара":0,"Гатшот + пара":0,"Гатшот + оверкарты":0 }; let totalCombos = 0; for (let i=0;i<13;i++) for (let j=0;j<13;j++) { let pid = matrix[i][j]; if (pid === null) continue; let handStr = rowsData[i][j]; let holeCombos = generateHoleCards(handStr, boardCards); for (let combo of holeCombos) { let hole = [{rank:combo.rank1, suit:combo.suit1}, {rank:combo.rank2, suit:combo.suit2}]; let cat = getHandCategories(hole, boardCards); let made = cat.made; let pairType = cat.pairType; let isSet = cat.isSet; if (made === "Каре") categories["Каре"]+=1; else if (made === "Фулл-хаус") categories["Фулл-хаус"]+=1; else if (made === "Флеш") categories["Флеш"]+=1; else if (made === "Стрит") categories["Стрит"]+=1; else if (made === "Трипс") { if (isSet) categories["Сет"]+=1; else categories["Трипс"]+=1; } else if (made === "Две пары") categories["Две пары"]+=1; else if (made === "Одна пара") { if (pairType === "overpair") categories["Оверпара"]+=1; else if (pairType === "top pair") categories["Топ-пара"]+=1; else if (pairType === "middle pair") categories["Средняя пара"]+=1; else if (pairType === "weak pair") categories["Слабая пара"]+=1; else categories["Пара ниже топ-пары"]+=1; } else if (pairType === "ace high") categories["Туз-хай"]+=1; else categories["Нет руки"]+=1; if (cat.flushDraw) { if (cat.nutFlushDraw) categories["Натсовое флеш-дро (1 карта)"]+=1; else categories["Флеш-дро (2 карты)"]+=1; } if (cat.oesd) categories["OESD"]+=1; if (cat.gutshot) categories["Гатшот"]+=1; if (cat.overcards) categories["Оверкарты"]+=1; if (cat.flushDraw && cat.oesd) categories["Флеш-дро + OESD"]+=1; if (cat.flushDraw && cat.gutshot) categories["Флеш-дро + гатшот"]+=1; if (cat.oesd && pairType && pairType.includes("pair")) categories["OESD + пара"]+=1; if (cat.gutshot && pairType && pairType.includes("pair")) categories["Гатшот + пара"]+=1; if (cat.gutshot && cat.overcards) categories["Гатшот + оверкарты"]+=1; if (cat.flushDraw && pairType && pairType.includes("pair")) categories["Флеш-дро + пара"]+=1; totalCombos++; } } return { totalCombos, categories }; }
 
    // Масштаб
    // const scaleSelect = document.getElementById('scaleSelect'); const workWrapper = document.getElementById('workTableWrapper'); if (scaleSelect && workWrapper) scaleSelect.addEventListener('change', (e) => { workWrapper.classList.remove('size-100', 'size-75', 'size-50'); workWrapper.classList.add(`size-${e.target.value}`); });
    // Заливка скольжением
    let painting = false; let lastPaintedCell = null;
    let blockUntilMap = new Map();
   function updateCellStyle(cell, pid) {
    if (pid === null) {
        cell.removeAttribute("style");
        return;
    }
    const prof = colorProfiles.find(p => p.id === pid);
if (prof && prof.colorIds && prof.colorIds.length) {
    let pos = getPositions(prof);
       const gradStyle = getGradientStyleFromProfile(prof);
cell.setAttribute("style", gradStyle + "; color: #F0F0F0;");
    } else {
        cell.removeAttribute("style");
    }
}

function paintCell(row, col) {
    if (!currentNodeId || !activeProfileId) return;
    const cell = document.querySelector(`#constructorGrid .hand-cell[data-row='${row}'][data-col='${col}']`);
    if (!cell) return;
    const currentPid = getCellProfile(currentNodeId, row, col);
    let newPid = (currentPid === activeProfileId) ? null : activeProfileId;
    setCellProfile(currentNodeId, row, col, newPid, false);
    updateCellStyle(cell, newPid);
    cell.justChanged = true;
    let cellKey = `${row}_${col}`;
    let newBlockUntil = Infinity;
    blockUntilMap.set(cellKey, newBlockUntil);
    cell.blockUntil = newBlockUntil;
    
}

function handlePaintStart(e) {
    if (!document.getElementById("constructorPage").classList.contains("active-page")) return;
    const cell = e.target.closest('.hand-cell');
    if (!cell) return;
    e.preventDefault();
    painting = true;
    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    paintCell(row, col);
    lastPaintedCell = `${row},${col}`;
}
    function handlePaintMove(e) { if (!painting) return; if (!document.getElementById("constructorPage").classList.contains("active-page")) { painting = false; return; } const cell = e.target.closest('.hand-cell'); if (!cell) return; const row = parseInt(cell.getAttribute('data-row')), col = parseInt(cell.getAttribute('data-col')); const key = `${row},${col}`; if (lastPaintedCell === key) return; paintCell(row, col); lastPaintedCell = key; }
    function handlePaintEnd() { painting = false; lastPaintedCell = null; persistAll(); if (currentNodeId) updateCurrentDisplay(); }
    document.addEventListener('mousedown', handlePaintStart); document.addEventListener('mousemove', handlePaintMove); document.addEventListener('mouseup', handlePaintEnd);
function persistAll() {
    localStorage.setItem("poker_range_tree_v6", JSON.stringify({
        nodes, nextNodeId, colorProfiles, nextProfileId, activeProfileId,
        cellStorage, expandedNodes: Array.from(expandedNodes),
        workLevels, workDisplayNodeId, paletteColors,
        nodePaletteMap, nodeProfileMap,
         activeColorId
    }));
}

function loadFromStorage() {
    let raw = localStorage.getItem("poker_range_tree_v6");
    if (raw) {
        try {
            let d = JSON.parse(raw);
            nodes = d.nodes || [];
            // Миграция: добавляем поле type для старых узлов
for (let n of nodes) {
    if (!n.type) {
        n.type = (n.childrenIds && n.childrenIds.length > 0) ? 'folder' : 'range';
    }
}
            nextNodeId = d.nextNodeId || 1;
            colorProfiles = d.colorProfiles || [];
            nextProfileId = d.nextProfileId || 1;
            activeProfileId = d.activeProfileId || null;
            cellStorage = d.cellStorage || {};
            expandedNodes = new Set(d.expandedNodes || []);
            workLevels = d.workLevels || [];
            workDisplayNodeId = d.workDisplayNodeId;
            paletteColors = d.paletteColors || [];
            nodePaletteMap = d.nodePaletteMap || {};
            nodeProfileMap = d.nodeProfileMap || {};
            activeColorId = d.activeColorId || null;
            if (!paletteColors.length) loadPalette();
            for (let n of nodes) if (!n.childrenIds) n.childrenIds = [];
            for (let n of nodes) ensureTable(n.id);
            if (!colorProfiles.length) resetDefaultProfiles();
            else if (activeProfileId === null && colorProfiles.length) activeProfileId = colorProfiles[0].id;
            return;
        } catch(e) {}
    }
    resetToCleanData();
}

function resetToCleanData() {
    nodes = [];
    nextNodeId = 1;

    // Создаём одну корневую папку
    let rootId = nextNodeId++;
    nodes.push({
        id: rootId,
        name: "Мои диапазоны",
        parentId: null,
        childrenIds: [],
        type: 'folder'
    });
    ensureTable(rootId);

    // Создаём один пустой диапазон внутри папки
    let rangeId = nextNodeId++;
    nodes.push({
        id: rangeId,
        name: "Новый диапазон",
        parentId: rootId,
        childrenIds: [],
        type: 'range'
    });
    nodes.find(n => n.id === rootId).childrenIds.push(rangeId);
    ensureTable(rangeId);

    loadPalette();
    resetDefaultProfiles();
    workLevels = [{ parentNodeId: null, levelIndex: 0 }];
    workDisplayNodeId = rangeId;
    currentNodeId = rangeId;
    persistAll();
}

loadFromStorage();
if (!nodes.length) resetToCleanData();
// Находим первый диапазон (не папку)
if (!currentNodeId && nodes.length) {
    let firstRange = nodes.find(n => n.type === 'range' || n.type === 'subrange');
    if (firstRange) {
        currentNodeId = firstRange.id;
    } else {
        currentNodeId = nodes[0].id; // fallback
    }
}
if (!workLevels.length) {
    let firstRoot = nodes.find(n => n.parentId === null);
    if (firstRoot) {
        workLevels = [{ parentNodeId: null, levelIndex: 0 }];
        workDisplayNodeId = firstRoot.id;
    }
}


document.getElementById("addPaletteColorBtn").onclick = () => {
    addPaletteColor();
    refreshAll();
 };
document.getElementById("newProfileBtn").onclick = () => {
    createNewProfile();
    refreshAll();
};
const rngWidget = document.getElementById("rngNumber");
if (rngWidget) {
    rngWidget.innerText = Math.floor(Math.random() * 100) + 1;
    rngWidget.onclick = () => {
        rngWidget.innerText = Math.floor(Math.random() * 100) + 1;
    };
}
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        let page = btn.getAttribute("data-page");
        document.getElementById("constructorPage").classList.toggle("active-page", page === "constructor");
        document.getElementById("workPage").classList.toggle("active-page", page === "work");
        refreshAll();
        
    };
});
function refreshAll() {
    let isConstructor = document.getElementById("constructorPage").classList.contains("active-page");
    if (isConstructor) {
        renderTree("constructorTree", currentNodeId, true, selectNode);
        updateCurrentDisplay();
        renderPalette(true);
        renderAllProfiles(true);
         updateProfileButtonVisibility();
        
            } else {
        updateWorkDisplay();
        renderPalette(false);
        renderAllProfiles(false);
    }
}

function refreshAllGrids() {
    let isConstructor = document.getElementById("constructorPage").classList.contains("active-page");
    if (isConstructor && currentNodeId) {
        updateCurrentDisplay();
    } else if (!isConstructor && workDisplayNodeId) {
        updateWorkGrid();
    }
}

 // ===== УПРАВЛЕНИЕ ВИДИМОСТЬЮ КНОПКИ "ДОБАВИТЬ ПРОФИЛЬ" =====
 function updateProfileButtonVisibility() {
    const profileBtn = document.getElementById("newProfileBtn");
    if (!profileBtn) return;
    
    let nodeId = getTableId(currentNodeId);
    let allowedIds = nodePaletteMap[nodeId] || [];
    let hasColors = paletteColors.some(c => allowedIds.includes(c.id));
    
    profileBtn.style.display = hasColors ? '' : 'none';
}

// renderCardsGrid();  // закомментировано — блок анализа удалён
// document.getElementById("clearAllBtn").onclick = clearAll;
// document.getElementById("randomBtn").onclick = randomFill;

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ ДЕРЕВА ==========

// Кнопка "Создать папку" — создаёт папку в корне
document.getElementById('treeAddFolderBtn')?.addEventListener('click', addRootNode);

// Кнопка "Создать диапазон" — создаёт диапазон в корне
document.getElementById('treeAddRangeBtn')?.addEventListener('click', () => {
    let name = prompt("Название нового диапазона:");
    if (!name) return;
    name = name.trim().slice(0, 20);
    if (!name) return;

    let newId = nextNodeId++;
    let newNode = {
        id: newId,
        name: name,
        parentId: null,
        childrenIds: [],
        type: 'range'
    };
    nodes.push(newNode);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
});

// Кнопка "Переименовать" — переименовывает выбранный узел
document.getElementById('treeRenameBtn')?.addEventListener('click', () => {
    if (currentNodeId) renameNode(currentNodeId);
});

// Кнопка "Вверх" — перемещает выбранный узел вверх
document.getElementById('treeMoveUpBtn')?.addEventListener('click', () => {
    if (currentNodeId) moveNodeUp(currentNodeId);
});

// Кнопка "Вниз" — перемещает выбранный узел вниз
document.getElementById('treeMoveDownBtn')?.addEventListener('click', () => {
    if (currentNodeId) moveNodeDown(currentNodeId);
});

// Кнопка "Удалить" — удаляет выбранный узел
document.getElementById('treeDeleteBtn')?.addEventListener('click', () => {
    if (currentNodeId) deleteNode(currentNodeId);
});

// Кнопка "Свернуть все" — сворачивает все узлы в дереве
document.getElementById('treeCollapseAllBtn')?.addEventListener('click', () => {
    expandedNodes.clear();
    refreshTreeOnly();
});

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ МАТРИЦЫ ==========

// Кнопка "Очистить таблицу" — очищает все ячейки
document.getElementById('tableClearBtn')?.addEventListener('click', () => {
    if (!currentNodeId) return;
    showConfirmModal('Очистить всю таблицу?', () => {
        const tid = getTableId(currentNodeId);
        if (cellStorage[tid]) {
            for (let i = 0; i < 13; i++) {
                for (let j = 0; j < 13; j++) {
                    cellStorage[tid][i][j] = null;
                }
            }
            persistAll();
            updateCurrentDisplay();
        }
    });
});
refreshAll();