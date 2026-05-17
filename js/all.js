// ВСЕ МОДУЛИ В ОДНОМ ФАЙЛЕ - ПОЛНАЯ ВЕРСИЯ

// ---------- STORE ----------
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

let nodes = [];
let nextNodeId = 1;
let currentNodeId = null;
let workLevels = [];
let workDisplayNodeId = null;
let cellStorage = {};
let expandedNodes = new Set();

function getTableId(nodeId) { return `node_${nodeId}`; }
function ensureTable(nodeId) { let tid = getTableId(nodeId); if (!cellStorage[tid]) cellStorage[tid] = Array(13).fill().map(() => Array(13).fill(null)); }
function getCellProfile(nodeId, r, c) { return cellStorage[getTableId(nodeId)]?.[r]?.[c] || null; }
function setCellProfile(nodeId, r, c, pid) { ensureTable(nodeId); cellStorage[getTableId(nodeId)][r][c] = pid; persistAll(); }
function countTotalCombos(nodeId) {
    let tid = getTableId(nodeId);
    if (!cellStorage[tid]) return 0;
    let total = 0;
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            if (cellStorage[tid][i][j] !== null) {
                let hand = rowsData[i][j];
                if (hand.includes('s')) total += 4;
                else if (hand.includes('o')) total += 12;
                else if (hand[0] === hand[1]) total += 6;
            }
        }
    }
    return total;
}
function persistAll() {
    localStorage.setItem("poker_range_tree_v6", JSON.stringify({ nodes, nextNodeId, workLevels, workDisplayNodeId, cellStorage, expandedNodes: Array.from(expandedNodes) }));
}
function loadFromStorage() {
    let raw = localStorage.getItem("poker_range_tree_v6");
    if (raw) {
        try {
            let d = JSON.parse(raw);
            nodes = d.nodes || []; nextNodeId = d.nextNodeId || 1; workLevels = d.workLevels || []; workDisplayNodeId = d.workDisplayNodeId;
            cellStorage = d.cellStorage || {}; expandedNodes = new Set(d.expandedNodes || []);
            for (let n of nodes) if (!n.childrenIds) n.childrenIds = [];
            for (let n of nodes) ensureTable(n.id);
            return;
        } catch(e) {}
    }
    resetToCleanData();
}
function resetToCleanData() {
    nodes = []; nextNodeId = 1;
    ["EP","MP","CO","BU","SB","BB"].forEach(name => { let id = nextNodeId++; nodes.push({ id, name, parentId: null, childrenIds: [] }); ensureTable(id); });
    let ep = nodes.find(n => n.name === "EP");
    if (ep) {
        let c1 = { id: nextNodeId++, name: "EP vs 3B MP", parentId: ep.id, childrenIds: [] };
        let c2 = { id: nextNodeId++, name: "EP vs 3B CO", parentId: ep.id, childrenIds: [] };
        nodes.push(c1, c2); ep.childrenIds = [c1.id, c2.id]; ensureTable(c1.id); ensureTable(c2.id);
        let v5 = { id: nextNodeId++, name: "vs 5bet", parentId: c1.id, childrenIds: [] };
        nodes.push(v5); c1.childrenIds = [v5.id]; ensureTable(v5.id);
    }
    let mp = nodes.find(n => n.name === "MP");
    if (mp) { let ch = { id: nextNodeId++, name: "MP vs 3B", parentId: mp.id, childrenIds: [] }; nodes.push(ch); mp.childrenIds = [ch.id]; ensureTable(ch.id); }
    let firstRoot = nodes.find(n => n.parentId === null);
    workLevels = [{ parentNodeId: null, levelIndex: 0 }];
    workDisplayNodeId = firstRoot ? firstRoot.id : null;
    persistAll();
}

// ---------- PALETTE ----------
let paletteColors = [];
let activePopup = null;
function loadPalette() {
    let stored = localStorage.getItem("poker_range_palette");
    if (stored) { try { let p = JSON.parse(stored); if (Array.isArray(p) && p.length) { paletteColors = p; return; } } catch(e) {} }
    paletteColors = [{ name: "Алый", color: "#ff4d4d" }, { name: "Изумруд", color: "#2ecc71" }, { name: "Сапфир", color: "#2f80ed" }];
}
function savePalette() { localStorage.setItem("poker_range_palette", JSON.stringify(paletteColors)); }
function addPaletteColor() { if (paletteColors.length >= 10) { alert("Макс 10 цветов"); return; } paletteColors.push({ name: `Цвет ${paletteColors.length+1}`, color: "#aaaaaa" }); savePalette(); renderPalette(true); refreshAllProfiles(); }
function renderPalette(editable) {
    const container = document.getElementById("paletteList");
    if (!container) return;
    container.innerHTML = "";
    paletteColors.forEach((item, idx) => {
        const div = document.createElement("div"); div.className = "palette-item";
        const colorBox = document.createElement("div"); colorBox.className = "palette-color-box"; colorBox.style.backgroundColor = item.color;
        if (editable) colorBox.onclick = (e) => { e.stopPropagation(); const picker = document.createElement("input"); picker.type = "color"; picker.value = item.color; picker.onchange = (ce) => { item.color = ce.target.value; colorBox.style.backgroundColor = item.color; savePalette(); refreshAllProfiles(); refreshAllGrids(); }; picker.click(); };
        const nameInput = document.createElement("input"); nameInput.type = "text"; nameInput.className = "palette-name"; nameInput.value = item.name; nameInput.placeholder = "Цвет";
        nameInput.onchange = (e) => { let nn = e.target.value.trim(); if (nn) item.name = nn; savePalette(); };
        if (!editable) nameInput.disabled = true;
        const removeBtn = document.createElement("button"); removeBtn.innerHTML = "✕"; removeBtn.className = "remove-palette-btn";
        if (editable && paletteColors.length > 1) removeBtn.onclick = () => { paletteColors.splice(idx,1); savePalette(); renderPalette(editable); refreshAllProfiles(); };
        else removeBtn.style.visibility = "hidden";
        div.appendChild(colorBox); div.appendChild(nameInput); div.appendChild(removeBtn);
        container.appendChild(div);
    });
}
function closePopup() { if (activePopup) { activePopup.remove(); activePopup = null; } }
function showColorPicker(anchor, profile, colorIdx, editable) {
    if (!editable) return; closePopup(); if (paletteColors.length === 0) return;
    const popup = document.createElement("div"); popup.style.position = "fixed"; popup.style.background = "#2c2f36"; popup.style.borderRadius = "20px";
    popup.style.boxShadow = "0 8px 20px rgba(0,0,0,0.6)"; popup.style.padding = "8px"; popup.style.display = "flex"; popup.style.flexDirection = "column";
    popup.style.gap = "8px"; popup.style.zIndex = "1000"; popup.style.border = "1px solid #4a4e5a";
    paletteColors.forEach(pal => {
        const opt = document.createElement("div"); opt.style.display = "flex"; opt.style.alignItems = "center"; opt.style.gap = "12px";
        opt.style.background = "#1e2024"; opt.style.borderRadius = "14px"; opt.style.padding = "6px 12px"; opt.style.cursor = "pointer";
        opt.onmouseenter = () => opt.style.background = "#3a3e48"; opt.onmouseleave = () => opt.style.background = "#1e2024";
        const swatch = document.createElement("div"); swatch.style.width = "28px"; swatch.style.height = "28px"; swatch.style.borderRadius = "8px";
        swatch.style.backgroundColor = pal.color; swatch.style.border = "1px solid #7e8a9c";
        const label = document.createElement("span"); label.style.fontSize = "12px"; label.textContent = pal.name;
        opt.appendChild(swatch); opt.appendChild(label);
        opt.onclick = () => { profile.colors[colorIdx] = pal.color; saveProfiles(); refreshProfileCard(profile.id); refreshAllGrids(); closePopup(); };
        popup.appendChild(opt);
    });
    document.body.appendChild(popup);
    const rect = anchor.getBoundingClientRect(); let left = rect.left + rect.width/2 - popup.offsetWidth/2; let top = rect.bottom + 6;
    left = Math.min(window.innerWidth - popup.offsetWidth - 10, Math.max(10, left));
    popup.style.left = left + 'px'; popup.style.top = top + 'px';
    activePopup = popup;
    const outside = (e) => { if(!popup.contains(e.target)) { closePopup(); document.removeEventListener('click', outside); } };
    setTimeout(() => document.addEventListener('click', outside), 0);
}

// ---------- PROFILES ----------
let colorProfiles = [];
let nextProfileId = 1;
let activeProfileId = null;
let profileRefs = new Map();
function getPositions(profile) {
    let cnt = profile.colors.length;
    if (cnt === 1) return [100];
    let boundaries = profile.boundaries || [];
    if (boundaries.length !== cnt - 1) { boundaries = []; for (let i = 1; i < cnt; i++) boundaries.push(i * 100 / cnt); profile.boundaries = boundaries; }
    return [...boundaries, 100];
}
function getGradientStyle(colors, positions) {
    if (colors.length === 1) return `background: ${colors[0]};`;
    let stops = []; let prev = 0;
    for (let i = 0; i < colors.length; i++) { stops.push(`${colors[i]} ${prev}%, ${colors[i]} ${positions[i]}%`); prev = positions[i]; }
    return `background: linear-gradient(to right, ${stops.join(', ')});`;
}
function getContrast(hex) {
    if (!hex || !hex.startsWith('#')) return 'white';
    let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return (0.299*r + 0.587*g + 0.114*b) > 140 ? '#1e2024' : 'white';
}
function refreshProfileCard(pid) {
    const prof = colorProfiles.find(p => p.id === pid);
    if (!prof) return;
    const ref = profileRefs.get(pid);
    if (!ref) return;
    const { sliderContainer, previewBox, minusBtn, plusBtn, radioSpan } = ref;
    let positions = getPositions(prof);
    previewBox.setAttribute("style", getGradientStyle(prof.colors, positions) + "; border-radius: 12px; border: 1px solid #3a3e48;");
    previewBox.title = prof.colors.map((_,i)=> Math.round(positions[i] - (i===0?0:positions[i-1]))).join('/')+'%';
    const oldThumbs = sliderContainer.querySelectorAll('.slider-thumb');
    oldThumbs.forEach(th => th.remove());
    for (let i = 0; i < prof.colors.length; i++) {
        const thumb = document.createElement("div"); thumb.className = "slider-thumb";
        thumb.style.left = `${positions[i]}%`; thumb.style.backgroundColor = prof.colors[i]; thumb.style.color = getContrast(prof.colors[i]);
        thumb.textContent = `${Math.round(positions[i])}%`;
        const isLast = (i === prof.colors.length-1);
        thumb.onclick = (e) => { e.stopPropagation(); showColorPicker(thumb, prof, i, ref.editable); };
        if (!isLast) {
            let dragging = false;
            const onMove = (me) => {
                if (!dragging) return;
                const rect = sliderContainer.getBoundingClientRect();
                let newP = (me.clientX - rect.left)/rect.width*100;
                newP = Math.min(100, Math.max(0, newP));
                let min = i===0 ? 0 : positions[i-1];
                let max = positions[i+1];
                newP = Math.min(max, Math.max(min, newP));
                if (Math.abs(positions[i]-newP) < 0.2) return;
                positions[i] = newP;
                for(let j=0;j<positions.length-1;j++) prof.boundaries[j]=positions[j];
                saveProfiles(); refreshProfileCard(pid); refreshAllGrids();
            };
            const up = () => { dragging=false; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',up); };
            thumb.onmousedown = (e) => { e.preventDefault(); dragging=true; document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',up); };
        }
        sliderContainer.appendChild(thumb);
    }
    if(minusBtn) minusBtn.style.visibility = (prof.colors.length <= 1 || !ref.editable) ? 'hidden' : 'visible';
    if(plusBtn) plusBtn.style.visibility = (prof.colors.length >= 3 || !ref.editable) ? 'hidden' : 'visible';
    if (radioSpan) { if (activeProfileId === prof.id) radioSpan.classList.add('active'); else radioSpan.classList.remove('active'); }
}
function refreshAllProfiles() { colorProfiles.forEach(p => refreshProfileCard(p.id)); }
function saveProfiles() { persistAll(); }
function renderAllProfiles(editable) {
    const container = document.getElementById("profileList");
    if(!container) return;
    const existingIds = new Set(colorProfiles.map(p=>p.id));
    for(let [id,ref] of profileRefs.entries()) if(!existingIds.has(id) && ref.rowDiv?.parentNode) ref.rowDiv.parentNode.remove();
    for(let prof of colorProfiles) {
        let ref = profileRefs.get(prof.id);
        if(!ref) {
            const card = document.createElement("div"); card.className = "profile-card";
            const row = document.createElement("div"); row.className = "profile-row";
            const radio = document.createElement("div"); radio.className = `profile-radio ${activeProfileId===prof.id ? 'active':''}`;
            if (editable) radio.onclick = () => { activeProfileId = prof.id; saveProfiles(); document.querySelectorAll('.profile-radio').forEach(r=>r.classList.remove('active')); radio.classList.add('active'); refreshAllProfiles(); };
            else radio.style.opacity = "0.5";
            const minus = document.createElement("button"); minus.className = "side-btn"; minus.textContent = "−";
            const preview = document.createElement("div"); preview.className = "gradient-preview";
            const plus = document.createElement("button"); plus.className = "side-btn"; plus.textContent = "+";
            const sliderWrap = document.createElement("div"); sliderWrap.className = "slider-wrapper";
            const sliderCont = document.createElement("div"); sliderCont.className = "slider-track-container";
            const track = document.createElement("div"); track.className = "slider-track";
            sliderCont.appendChild(track); sliderWrap.appendChild(sliderCont);
            const del = document.createElement("button"); del.className = "delete-profile-btn"; del.innerHTML = "✕";
            if (editable) {
                minus.onclick = () => { if(prof.colors.length<=1) return; prof.colors.pop(); if(prof.colors.length===1) prof.boundaries=[]; else if(prof.colors.length===2) prof.boundaries=[50]; saveProfiles(); refreshProfileCard(prof.id); refreshAllGrids(); };
                plus.onclick = () => { if(prof.colors.length>=3) return; let newColor = paletteColors[0]?.color || "#aaaaaa"; prof.colors.push(newColor); if(prof.colors.length===2) prof.boundaries=[50]; else if(prof.colors.length===3) prof.boundaries=[33,66]; saveProfiles(); refreshProfileCard(prof.id); refreshAllGrids(); };
                del.onclick = () => { if(colorProfiles.length<=1) { alert("Нельзя удалить последний профиль"); return; } colorProfiles = colorProfiles.filter(p=>p.id!==prof.id); if(activeProfileId===prof.id) activeProfileId=colorProfiles[0]?.id; profileRefs.delete(prof.id); saveProfiles(); renderAllProfiles(true); refreshAllGrids(); };
            } else { minus.style.visibility = "hidden"; plus.style.visibility = "hidden"; del.style.visibility = "hidden"; radio.style.cursor = "default"; }
            row.appendChild(radio); row.appendChild(minus); row.appendChild(preview); row.appendChild(plus); row.appendChild(sliderWrap); row.appendChild(del);
            card.appendChild(row); container.appendChild(card);
            ref = { rowDiv: row, sliderContainer: sliderCont, previewBox: preview, minusBtn: minus, plusBtn: plus, radioSpan: radio, editable };
            profileRefs.set(prof.id, ref);
        } else { ref.editable = editable; if(ref.radioSpan) { if(activeProfileId===prof.id) ref.radioSpan.classList.add('active'); else ref.radioSpan.classList.remove('active'); } }
        refreshProfileCard(prof.id);
    }
}
function createNewProfile() {
    let name = prompt("Название профиля", "Новый профиль");
    if(name === null) return;
    let cnt = parseInt(prompt("Количество цветов (1-3)", "2"));
    if(isNaN(cnt)) cnt=2; cnt = Math.min(3,Math.max(1,cnt));
    let colors = []; for(let i=0;i<cnt;i++) colors.push(paletteColors[i%paletteColors.length]?.color || "#aaaaaa");
    let boundaries = []; if(cnt===2) boundaries=[50]; else if(cnt===3) boundaries=[33,66];
    let newId = nextProfileId++;
    colorProfiles.push({ id: newId, name: name || "", colors, boundaries });
    if(colorProfiles.length===1) activeProfileId = newId;
    saveProfiles(); renderAllProfiles(true); refreshAllGrids();
}
function resetDefaultProfiles() { let defaultCol = paletteColors[0]?.color || "#ff4d4d"; colorProfiles = [{ id: nextProfileId++, name: "Красный", colors: [defaultCol], boundaries: [] }]; activeProfileId = colorProfiles[0].id; }
function loadProfilesFromStorage(data) { if (data.colorProfiles) { colorProfiles = data.colorProfiles; nextProfileId = data.nextProfileId || 1; activeProfileId = data.activeProfileId || null; } if (!colorProfiles.length) resetDefaultProfiles(); else if (activeProfileId === null && colorProfiles.length) activeProfileId = colorProfiles[0].id; }

// ---------- TREE ----------
function addChildNode(parentId) {
    let name = prompt("Название дочернего узла:");
    if (!name) return; name = name.trim().slice(0,20); if (!name) return;
    let parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    let newId = nextNodeId++;
    let newNode = { id: newId, name, parentId: parentId, childrenIds: [] };
    nodes.push(newNode); parent.childrenIds.push(newId); ensureTable(newId); persistAll(); refreshAll(); selectNode(newId);
}
function renameNode(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let newName = prompt("Новое имя:", node.name);
    if (newName && newName.trim()) node.name = newName.trim().slice(0,20);
    persistAll(); refreshAll(); if (currentNodeId === nodeId) updateCurrentDisplay();
}
function moveNodeUp(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx > 0) { [roots[idx-1], roots[idx]] = [roots[idx], roots[idx-1]]; let newNodes = [...roots]; for (let n of nodes) if (n.parentId !== null) newNodes.push(n); nodes.length = 0; nodes.push(...newNodes); }
    } else {
        let parent = nodes.find(p => p.id === parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx > 0) { [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]]; }
    }
    persistAll(); refreshAll();
}
function moveNodeDown(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx < roots.length - 1) { [roots[idx+1], roots[idx]] = [roots[idx], roots[idx+1]]; let newNodes = [...roots]; for (let n of nodes) if (n.parentId !== null) newNodes.push(n); nodes.length = 0; nodes.push(...newNodes); }
    } else {
        let parent = nodes.find(p => p.id === parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx < arr.length - 1) { [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]]; }
    }
    persistAll(); refreshAll();
}
function deleteNode(nodeId) {
    let node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.parentId === null && nodes.filter(n => n.parentId === null).length <= 1) { alert("Нельзя удалить последний корневой узел"); return; }
    function delSub(id) {
        let n = nodes.find(nn => nn.id === id);
        if (!n) return;
        for (let cid of n.childrenIds) delSub(cid);
        const index = nodes.findIndex(nn => nn.id === id); if (index !== -1) nodes.splice(index,1);
        delete cellStorage[getTableId(id)];
        let p = nodes.find(p => p.id === n.parentId);
        if (p) p.childrenIds = p.childrenIds.filter(cid => cid !== id);
    }
    delSub(nodeId);
    if (currentNodeId === nodeId) { let newRoot = nodes.find(n => n.parentId === null); if (newRoot) selectNode(newRoot.id); }
    workLevels = workLevels.filter(lvl => lvl.parentNodeId !== nodeId);
    if (workDisplayNodeId === nodeId) workDisplayNodeId = nodes.find(n => n.parentId === null)?.id || null;
    if (!workLevels.length) workLevels = [{ parentNodeId: null, levelIndex: 0 }];
    persistAll(); refreshAll();
}
function addRootNode() {
    let name = prompt("Название корневого узла:");
    if (!name) return; name = name.trim().slice(0,20); if (!name) return;
    let newId = nextNodeId++;
    nodes.push({ id: newId, name, parentId: null, childrenIds: [] }); ensureTable(newId); persistAll(); refreshAll(); selectNode(newId);
}
function renderTree(containerId, activeNodeId, editable, onSelectNode) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    let rootNodes = nodes.filter(n => n.parentId === null);
    rootNodes.sort((a,b) => a.id - b.id);
    for (let node of rootNodes) renderTreeNode(container, node, activeNodeId, editable, onSelectNode);
}
function renderTreeNode(parentContainer, node, activeNodeId, editable, onSelectNode) {
    const nodeDiv = document.createElement("div"); nodeDiv.className = "tree-node";
    const itemDiv = document.createElement("div"); itemDiv.className = `tree-item ${activeNodeId === node.id ? 'active' : ''}`;
    const arrow = document.createElement("span"); const isOpen = expandedNodes.has(node.id); arrow.textContent = isOpen ? "▼" : "▶"; arrow.style.cursor = "pointer"; arrow.style.marginRight = "8px";
    const nameSpan = document.createElement("span"); nameSpan.className = "tree-item-name"; nameSpan.textContent = node.name;
    const actions = document.createElement("div"); actions.className = "tree-actions";
    if (editable) {
        const addBtn = document.createElement("button"); addBtn.textContent = "+"; addBtn.onclick = (e) => { e.stopPropagation(); addChildNode(node.id); };
        const renameBtn = document.createElement("button"); renameBtn.textContent = "✏️"; renameBtn.onclick = (e) => { e.stopPropagation(); renameNode(node.id); };
        const upBtn = document.createElement("button"); upBtn.textContent = "↑"; upBtn.onclick = (e) => { e.stopPropagation(); moveNodeUp(node.id); };
        const downBtn = document.createElement("button"); downBtn.textContent = "↓"; downBtn.onclick = (e) => { e.stopPropagation(); moveNodeDown(node.id); };
        const delBtn = document.createElement("button"); delBtn.textContent = "🗑️"; delBtn.onclick = (e) => { e.stopPropagation(); deleteNode(node.id); };
        actions.append(addBtn, renameBtn, upBtn, downBtn, delBtn);
    }
    itemDiv.append(arrow, nameSpan, actions);
    itemDiv.onclick = (e) => { if(e.target.tagName !== 'BUTTON' && e.target !== arrow) onSelectNode(node.id); };
    arrow.onclick = (e) => { e.stopPropagation(); expandedNodes.has(node.id) ? expandedNodes.delete(node.id) : expandedNodes.add(node.id); refreshTreeOnly(); };
    nodeDiv.appendChild(itemDiv);
    const childrenDiv = document.createElement("div"); childrenDiv.className = "tree-children"; if(isOpen) childrenDiv.classList.add("open");
    if(node.childrenIds && node.childrenIds.length) {
        let childNodes = node.childrenIds.map(cid => nodes.find(n=>n.id===cid)).filter(n=>n);
        childNodes.sort((a,b)=>a.id-b.id);
        for(let child of childNodes) renderTreeNode(childrenDiv, child, activeNodeId, editable, onSelectNode);
    }
    nodeDiv.appendChild(childrenDiv);
    parentContainer.appendChild(nodeDiv);
}
function refreshTreeOnly() { if(document.getElementById("constructorPage").classList.contains("active-page")) renderTree("constructorTree", currentNodeId, true, selectNode); }

// ---------- GRID ----------
function renderGrid(containerId, nodeId, clickHandler) {
    const gridDiv = document.getElementById(containerId);
    if (!nodeId || !cellStorage[getTableId(nodeId)]) { if(gridDiv) gridDiv.innerHTML = "<div style='padding:20px'>Нет таблицы</div>"; return; }
    const matrix = cellStorage[getTableId(nodeId)]; gridDiv.innerHTML = "";
    for (let i=0;i<13;i++) for (let j=0;j<13;j++) {
        const hand = rowsData[i][j]; const pid = matrix[i][j]; const prof = colorProfiles.find(p => p.id === pid);
        const cell = document.createElement("div"); cell.className = "hand-cell";
        if (prof && prof.colors && prof.colors.length) { let pos = getPositions(prof); const gradStyle = getGradientStyle(prof.colors, pos); cell.setAttribute("style", gradStyle + "; color: white; text-shadow: 0 0 2px black;"); }
        else { cell.style.backgroundColor = "var(--cell-bg)"; cell.style.color = "var(--text-muted)"; }
        cell.innerText = hand; if (clickHandler) cell.onclick = () => clickHandler(i, j);
        gridDiv.appendChild(cell);
    }
}
function updateCurrentDisplay() {
    if (!currentNodeId) return;
    let total = countTotalCombos(currentNodeId);
    const rangeStats = document.getElementById("rangeStats"); if(rangeStats) rangeStats.innerHTML = `Комбинаций: ${total} / 1326 (${(total/1326*100).toFixed(1)}%)`;
    const childContainer = document.getElementById("constructorChildButtons"); if(childContainer) childContainer.innerHTML = "";
    let node = nodes.find(n => n.id === currentNodeId);
    if (node && childContainer) {
        let childrenNodes = node.childrenIds.map(cid => nodes.find(n => n.id === cid)).filter(n => n);
        for (let child of childrenNodes) { let btn = document.createElement("button"); btn.className = "btn-oval"; btn.innerText = child.name; btn.onclick = () => selectNode(child.id); childContainer.appendChild(btn); }
    }
    const backBtn = document.getElementById("backButton");
    if (node && node.parentId !== null && backBtn) { let parentNode = nodes.find(n => n.id === node.parentId); if (parentNode) { backBtn.style.display = "flex"; backBtn.onclick = () => selectNode(parentNode.id); backBtn.innerText = `← ${parentNode.name}`; } else backBtn.style.display = "none"; }
    else if (backBtn) backBtn.style.display = "none";
    renderGrid("constructorGrid", currentNodeId, (r,c) => { if (activeProfileId) { setCellProfile(currentNodeId, r, c, getCellProfile(currentNodeId,r,c) === activeProfileId ? null : activeProfileId); } updateCurrentDisplay(); });
}
function updateWorkGrid() {
    if(!workDisplayNodeId) return;
    let total = countTotalCombos(workDisplayNodeId);
    const workStats = document.getElementById("workStats"); if(workStats) workStats.innerHTML = `Комбинаций: ${total} / 1326 (${(total/1326*100).toFixed(1)}%)`;
    renderGrid("workGrid", workDisplayNodeId, null);
}
function refreshAllGrids() { const isConstructor = document.getElementById("constructorPage").classList.contains("active-page"); if(isConstructor && currentNodeId) updateCurrentDisplay(); else if(!isConstructor && workDisplayNodeId) updateWorkGrid(); }
function setDynamicFontSize() { const grids = document.querySelectorAll('.hands-grid'); grids.forEach(grid => { const gridWidth = grid.clientWidth; if(gridWidth===0) return; let fontSize = (gridWidth/13)*0.45; fontSize = Math.min(20, Math.max(8, fontSize)); grid.style.fontSize = fontSize+'px'; }); }

// ---------- WORK ----------
function rebuildWorkNavigation() {
    const container = document.getElementById("workLevelsContainer");
    if(!container) return;
    container.innerHTML = "";
    for(let i=0; i<workLevels.length; i++){
        const level=workLevels[i]; const parentId=level.parentNodeId;
        let children=[];
        if(parentId===null) children=nodes.filter(n=>n.parentId===null);
        else { let p=nodes.find(n=>n.id===parentId); if(p) children=p.childrenIds.map(cid=>nodes.find(n=>n.id===cid)).filter(n=>n); }
        if(children.length===0) continue;
        const div=document.createElement("div"); div.className="button-bar"; div.style.marginTop=i===0?"20px":"10px";
        for(let child of children){
            const btn=document.createElement("button"); btn.className="btn-oval";
            if(workDisplayNodeId===child.id) btn.classList.add("active");
            btn.innerText=child.name;
            btn.onclick=(function(c){ return function(){ workDisplayNodeId=c.id; workLevels=workLevels.slice(0,i+1); if(c.childrenIds && c.childrenIds.length) workLevels.push({parentNodeId:c.id, levelIndex:i+1}); updateWorkDisplay(); persistAll(); }; })(child);
            div.appendChild(btn);
        }
        container.appendChild(div);
    }
    if(workDisplayNodeId) updateWorkGrid();
}
function updateWorkDisplay() { rebuildWorkNavigation(); }

// ---------- MAIN ----------
function refreshAll() {
    const isConstructor = document.getElementById("constructorPage").classList.contains("active-page");
    if (isConstructor) {
        renderTree("constructorTree", currentNodeId, true, selectNode);
        updateCurrentDisplay();
        renderPalette(true);
        renderAllProfiles(true);
    } else {
        updateWorkDisplay();
        renderPalette(false);
        renderAllProfiles(false);
    }
    setDynamicFontSize();
}

function selectNode(nodeId) {
    currentNodeId = nodeId;
    updateCurrentDisplay();
    refreshAll();
}

function init() {
    loadPalette();
    loadFromStorage();
    
    const raw = localStorage.getItem("poker_range_tree_v6");
    if (raw) {
        try {
            const d = JSON.parse(raw);
            loadProfilesFromStorage(d);
        } catch(e) {}
    }
    
    if (!nodes.length) resetToCleanData();
    if (!currentNodeId && nodes.length) currentNodeId = nodes[0].id;
    if (!workLevels.length) {
        let firstRoot = nodes.find(n => n.parentId === null);
        if (firstRoot) {
            workLevels.push({ parentNodeId: null, levelIndex: 0 });
            workDisplayNodeId = firstRoot.id;
        }
    }
    
    document.getElementById("addRootNodeBtn").onclick = () => addRootNode();
    document.getElementById("addPaletteColorBtn").onclick = () => { addPaletteColor(); refreshAll(); };
    document.getElementById("newProfileBtn").onclick = () => { createNewProfile(); refreshAll(); };
    
    const rngWidget = document.getElementById("rngNumber");
    if (rngWidget) {
        rngWidget.innerText = Math.floor(Math.random() * 100) + 1;
        rngWidget.onclick = () => { rngWidget.innerText = Math.floor(Math.random() * 100) + 1; };
    }
    
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const page = btn.getAttribute("data-page");
            const constructorPage = document.getElementById("constructorPage");
            const workPage = document.getElementById("workPage");
            if (constructorPage && workPage) {
                constructorPage.classList.toggle("active-page", page === "constructor");
                workPage.classList.toggle("active-page", page === "work");
            }
            refreshAll();
        };
    });
    
    refreshAll();
    window.addEventListener('resize', () => setDynamicFontSize());
}

window.refreshAllGrids = refreshAllGrids;
window.refreshAllProfiles = refreshAllProfiles;
window.saveProfiles = saveProfiles;
window.renderPalette = renderPalette;
window.selectNode = selectNode;
window.addRootNode = addRootNode;
window.addPaletteColor = addPaletteColor;
window.createNewProfile = createNewProfile;
window.updateCurrentDisplay = updateCurrentDisplay;
window.updateWorkGrid = updateWorkGrid;

document.addEventListener("DOMContentLoaded", init);