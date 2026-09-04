// ===== drag-drop.js -- extracted from all.js (tree drag & drop) =====
// ===== DRAG & DROP: ПРОВЕРКА, МОЖНО ЛИ ТАЩИТЬ =====
function canDrag(nodeId) {
    const node = getNode(nodeId);
    if (!node) return false;

    // Поддиапазоны — никогда
    if (node.type === 'subrange') return false;

    // Проверяем, не находится ли узел внутри диапазона (или не является его частью)
    let current = node;
    while (current) {
        // Если мы нашли диапазон
        if (current.type === 'range') {
            // Если это сам перетаскиваемый узел — можно (это диапазон)
            if (current.id === nodeId) return true;
            // Если это любой другой узел внутри диапазона — нельзя
            return false;
        }
        current = getNode(current.parentId);
    }

    // Папки вне диапазона — можно
    return node.type === 'folder' || node.type === 'range';
}


// ===== DRAG & DROP: ПРОВЕРКА, МОЖНО ЛИ ВСТАВИТЬ =====
function canDrop(sourceId, targetId) {
    // Запрещаем вставку в родителя
    const source = getNode(sourceId);
    if (source && source.parentId === targetId) {
        return false;
    }

    if (sourceId === targetId) return false;

    // Защита от циклов
    let current = getNode(targetId);
    while (current) {
        if (current.id === sourceId) return false;
        current = getNode(current.parentId);
    }

    const target = getNode(targetId);
    if (!source || !target) return false;

    if (target.type !== 'folder') return false;

    // Нельзя вставлять в папку внутри диапазона
    let t = target;
    while (t) {
        if (t.type === 'range') return false;
        t = getNode(t.parentId);
    }

    return true;
}

// ===== DRAG & DROP: ПРОВЕРКА, ВНУТРИ ЛИ ДИАПАЗОНА =====
function isInsideRange(nodeId) {
    let current = getNode(nodeId);
    while (current) {
        const parent = getNode(current.parentId);
        if (parent && parent.type === 'range') return true;
        current = parent;
    }
    return false;
}


// ===== DRAG & DROP: ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ =====

document.addEventListener('mousemove', function(e) {
    if (!App.state.dragData) return;

    const dx = e.clientX - App.state.startX;
    const dy = e.clientY - App.state.startY;

    if (!App.state.isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    App.state.isDragging = true;
	document.body.classList.add('dragging');
    if (App.state.dragData.element) {
        App.state.dragData.element.style.opacity = '1';
    }

// ===== СОЗДАЁМ ПРИЗРАК =====
const sourceElement = document.querySelector(`.tree-item[data-node-id="${App.state.dragData.nodeId}"]`);
if (sourceElement) {
    App.state.ghostElement = sourceElement.cloneNode(true);

    // Удаляем стрелку и меню
    const arrow = App.state.ghostElement.querySelector('.tree-arrow');
    if (arrow) arrow.remove();
    const menu = App.state.ghostElement.querySelector('.tree-actions-popup');
    if (menu) menu.remove();

    // Применяем класс drag-ghost
    App.state.ghostElement.className = 'drag-ghost';

    // ===== КОПИРУЕМ ТОЛЬКО ДИНАМИЧЕСКИЕ СТИЛИ =====
    // 1. Ширина
    const itemWidth = sourceElement.getBoundingClientRect().width;
    App.state.ghostElement.style.width = itemWidth + 'px';

    // 2. padding
    const computedStyle = window.getComputedStyle(sourceElement);
    //App.state.ghostElement.style.padding = computedStyle.padding;

    // 3. Внутренний блок (.tree-item-name) — отступ и gap
    const nameEl = sourceElement.querySelector('.tree-item-name');
    const nameClone = App.state.ghostElement.querySelector('.tree-item-name');

    if (nameEl && nameClone) {
        // Реальный отступ от края .tree-item
        const itemRect = sourceElement.getBoundingClientRect();
        const nameRect = nameEl.getBoundingClientRect();
        const totalOffset = nameRect.left - itemRect.left;
        nameClone.style.marginLeft = totalOffset + 'px';

        // gap
        const nameStyle = window.getComputedStyle(nameEl);
        nameClone.style.gap = nameStyle.gap;
    }

    // Ставим призрак под курсор
       App.state.ghostElement.style.left = (e.clientX - App.state.dragData.offsetX) + 'px';
       App.state.ghostElement.style.top = (e.clientY - App.state.dragData.offsetY) + 'px';

    document.body.appendChild(App.state.ghostElement);

	
    // Подсказка
    const hintEl = document.createElement('div');
    hintEl.className = 'drag-hint';
    hintEl.id = 'dragHint';
    hintEl.innerHTML = `→ переместить в <strong id="hintTargetName">...</strong>`;
    hintEl.style.left = e.clientX + 'px';
    hintEl.style.top = (e.clientY + 26) + 'px';
    document.body.appendChild(hintEl);
}
}

if (App.state.isDragging) {
    if (App.state.ghostElement) {
      App.state.ghostElement.style.left = (e.clientX - App.state.dragData.offsetX) + 'px';
      App.state.ghostElement.style.top = (e.clientY - App.state.dragData.offsetY) + 'px';
    }

    const hintEl = document.getElementById('dragHint');
    if (hintEl) {
        const ghostRect = App.state.ghostElement.getBoundingClientRect();
        hintEl.style.left = (ghostRect.left + ghostRect.width / 2) + 'px';
        hintEl.style.top = (ghostRect.bottom + 4) + 'px';
        hintEl.style.transform = 'translateX(-50%)';
    }

    highlightDropTarget(e.clientX, e.clientY);

    const targetId = getDropTarget(e.clientX, e.clientY);
    updateGhostTarget(targetId);
}
});

document.addEventListener('mouseup', function(e) {
    if (!App.state.dragData) return;

    if (App.state.isDragging) {
        if (App.state.dragData.element) {
            App.state.dragData.element.style.opacity = '1';
        }

        if (App.state.ghostElement) {
            App.state.ghostElement.remove();
            App.state.ghostElement = null;
        }

        const hintEl = document.getElementById('dragHint');
        if (hintEl) {
            hintEl.remove();
        }

        clearHighlight();

        const targetId = getDropTarget(e.clientX, e.clientY);

if (targetId && targetId !== App.state.dragData.nodeId) {
    if (canDrop(App.state.dragData.nodeId, targetId)) {
        showMoveConfirm(App.state.dragData.nodeId, targetId);
    }
}
document.body.classList.remove('dragging');
    }

    App.state.dragData = null;
    App.state.isDragging = false;
});
function clearHighlight() {
    if (App.state.highlightedNode) {
        App.state.highlightedNode.style.background = '';
        App.state.highlightedNode.style.border = '';
        App.state.highlightedNode.style.borderRadius = '';
        App.state.highlightedNode = null;
    }
    if (App.state.expandTimeout) {
        clearTimeout(App.state.expandTimeout);
        App.state.expandTimeout = null;
    }
}
function highlightDropTarget(clientX, clientY) {
    // Если цель — текущий родитель, не подсвечиваем
if (App.state.dragData) {
    const targetId = getDropTarget(clientX, clientY);
    const source = getNode(App.state.dragData.nodeId);
    if (source && source.parentId === targetId) {
        clearHighlight();
        return;
    }
}

    const element = document.elementFromPoint(clientX, clientY);
    const treeItem = element?.closest('.tree-item');
    
    if (!treeItem) {
        clearHighlight();
        return;
    }

    const nodeId = parseInt(treeItem.dataset.nodeId);
    if (!nodeId) return;

    const node = getNode(nodeId);
    if (!node) return;

    if (node.type === 'folder') {
        clearHighlight();
        treeItem.style.background = '#3a3d45';
		treeItem.style.borderTop = '1px solid #D4AF37';
        treeItem.style.borderBottom = '1px solid #D4AF37';
        treeItem.style.borderLeft = 'none';
        treeItem.style.borderRight = 'none';
        
        App.state.highlightedNode = treeItem;

        // Авто-раскрытие
        const hasChildren = node.childrenIds && node.childrenIds.length > 0;
        const isOpen = App.state.expandedNodes.has(node.id);

        if (hasChildren && !isOpen) {
            if (App.state.expandTimeout) {
                clearTimeout(App.state.expandTimeout);
                App.state.expandTimeout = null;
            }

            App.state.expandTimeout = setTimeout(() => {
                App.state.expandedNodes.add(node.id);
                refreshTreeOnly();

                setTimeout(() => {
                    const newItem = document.querySelector(`.tree-item[data-node-id="${node.id}"]`);
                    if (newItem) {
                        newItem.style.background = '#3a3d45';
                        newItem.style.border = '2px solid #D4AF37';
                        newItem.style.borderRadius = '4px';
                        App.state.highlightedNode = newItem;
                    }
                }, 50);

                App.state.expandTimeout = null;
            }, 800);
        }
    } else {
        clearHighlight();
    }
}
// ===== DRAG & DROP: ОПРЕДЕЛЕНИЕ ЦЕЛИ ПОД МЫШКОЙ =====
function getDropTarget(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    const treeItem = element?.closest('.tree-item');
    if (!treeItem) return null;

    const nodeId = parseInt(treeItem.dataset.nodeId);
    if (!nodeId) return null;

    const node = getNode(nodeId);
    if (!node) return null;

    // Можно вставлять только в папки (не в диапазоны)
if (node.type === 'folder' || node.type === 'range') {
    return nodeId;
}
return null;
}

function updateGhostTarget(targetNodeId) {
    const hintEl = document.getElementById('dragHint');
    if (!hintEl) return;

    if (!targetNodeId) {
        hintEl.innerHTML = `→ переместить в <strong>...</strong>`;
        return;
    }

    const target = getNode(targetNodeId);
    if (!target) {
        hintEl.innerHTML = `→ переместить в <strong>...</strong>`;
        return;
    }

    if (canDrop(App.state.dragData.nodeId, targetNodeId)) {
        hintEl.innerHTML = `→ переместить в <strong>${escapeHtml(target.name)}</strong>`;
    } else {
        hintEl.innerHTML = `🚫`;
    }
}
// ===== DRAG & DROP: ОКНО ПОДТВЕРЖДЕНИЯ ПЕРЕМЕЩЕНИЯ =====
function showMoveConfirm(sourceId, targetId) {
    const source = getNode(sourceId);
    const target = getNode(targetId);
    if (!source || !target) return;

    const typeName = source.type === 'folder' ? 'папку' : 'диапазон';
    const targetTypeName = target.type === 'folder' ? 'папку' : 'диапазон';

    // Удаляем старый popup, если есть
    const oldPopup = document.querySelector('.move-popup-overlay');
    if (oldPopup) oldPopup.remove();

    const overlay = document.createElement('div');
    overlay.className = 'move-popup-overlay';

    const popup = document.createElement('div');
    popup.className = 'move-popup';
    popup.innerHTML = `
        <div class="move-popup-question">
            Переместить ${typeName} <strong>«${escapeHtml(source.name)}»</strong><br>
            в ${targetTypeName} <strong>«${escapeHtml(target.name)}»</strong>?
        </div>
        <div class="move-popup-actions">
            <button class="btn btn-cancel" id="moveCancelBtn">Нет</button>
            <button class="btn btn-confirm" id="moveConfirmBtn">Да</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Закрытие по клику вне
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeMovePopup(overlay, sourceId);
        }
    });

    // Escape
    const escapeHandler = function(e) {
        if (e.key === 'Escape') {
            closeMovePopup(overlay, sourceId);
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    popup.querySelector('#moveCancelBtn').onclick = () => {
        closeMovePopup(overlay, sourceId);
    };

    popup.querySelector('#moveConfirmBtn').onclick = () => {
        overlay.remove();
        moveNodeWithChildren(sourceId, targetId);
        clearHighlight();
        const el = document.querySelector(`.tree-item[data-node-id="${sourceId}"]`);
        if (el) el.style.opacity = '1';
    };
}

function closeMovePopup(overlay, sourceId) {
    overlay.remove();
    clearHighlight();
    const el = document.querySelector(`.tree-item[data-node-id="${sourceId}"]`);
    if (el) el.style.opacity = '1';
}
// ===== DRAG & DROP: ПЕРЕМЕЩЕНИЕ УЗЛА =====
function moveNodeWithChildren(sourceId, targetId) {
    const source = getNode(sourceId);
    const target = getNode(targetId);
    if (!source || !target) return;

    // Удаляем из старого родителя
    const oldParent = getNode(source.parentId);
    if (oldParent) {
        oldParent.childrenIds = oldParent.childrenIds.filter(id => id !== sourceId);
    }

    // Добавляем в нового родителя
    source.parentId = targetId;
    target.childrenIds.push(sourceId);

    persistAll();
    refreshAll();
    selectNode(sourceId);
}
