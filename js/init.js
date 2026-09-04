// ===== init.js -- extracted from all.js (top-level listeners & bootstrap) =====
// ---------- ВЫБОР КАРТ ----------
const rankOrder = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const suits = ["h","c","d","s"];
const suitSymbols = { h: "♥", c: "♣", d: "♦", s: "♠" };
const suitColors = { h: "#ff6666", c: "#2ecc71", d: "#2f80ed", s: "#cccccc" };
let currentBoard = { flop: [null, null, null], turn: null, river: null };
const slotElements = {
    flop1: document.getElementById("flopSlot1"),
    flop2: document.getElementById("flopSlot2"),
    flop3: document.getElementById("flopSlot3"),
    turn: document.getElementById("turnSlot"),
    river: document.getElementById("riverSlot")
};

document.addEventListener('mousedown', handlePaintStart);
document.addEventListener('mousemove', handlePaintMove);
document.addEventListener('mouseup', handlePaintEnd);

// ===== ФЛАГ ИЗМЕНЕНИЙ =====
// (markUnsaved / clearUnsaved вынесены в persistence.js)

// ===== КНОПКА "СОХРАНИТЬ" =====
document.getElementById('tableSaveBtn')?.addEventListener('click', function() {
    // В режиме анализа кнопки редактирования погашены классом
    // .toolbar-btn-disabled (pointer-events: none), но CSS не мешает
    // программному .click() (например, из userscript'а), поэтому дублируем
    // проверку в обработчике.
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) {
        showFloatingModal('Нет активного диапазона для сохранения');
        return;
    }
    persistAll();
    clearUnsaved();
});

// ===== КНОПКА "ОТМЕНИТЬ" =====
document.getElementById('tableUndoBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) {
        showFloatingModal('Нет активного диапазона');
        return;
    }

    const node = getNode(App.state.currentNodeId);
    const message = node
        ? `Отменить все изменения в диапазоне <span style="color: #D4AF37; font-weight: 600;">${escapeHtml(node.name)}</span>?`
        : 'Отменить все изменения в текущем диапазоне?';

    showSaveConfirmModal(message, function() {
        // Да — отменяем
        loadFromStorage();
        refreshAll();
        updateCurrentDisplay();
        clearUnsaved();
    }, function() {
        // Нет — ничего не делаем
    });
});
// ===== КНОПКИ КОПИРОВАТЬ/ВСТАВИТЬ В ТУЛБАРЕ =====
document.getElementById('tableCopyBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) {
        showFloatingModal('Нет активного диапазона для копирования');
        return;
    }
    copyRange(App.state.currentNodeId);
    updatePasteButtonState();
});

document.getElementById('tablePasteBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) {
        showFloatingModal('Нет активного диапазона для вставки');
        return;
    }
    pasteRange(App.state.currentNodeId);
});

// ===== ПЕРЕКЛЮЧЕНИЕ ДИАПАЗОНА С ПРОВЕРКОЙ =====
const originalSelectNode = selectNode;

selectNode = function(nodeId) {
    if (App.state.hasUnsavedChanges) {
        const node = getNode(App.state.currentNodeId);
        const message = node
    ? `Диапазон <span style="color: #D4AF37; font-weight: 600;">${escapeHtml(node.name)}</span> был отредактирован. Сохранить изменения?`
    : 'Сохранить изменения?';

        showSaveConfirmModal(message, function() {
            // Да — сохраняем
            persistAll();
            clearUnsaved();
            originalSelectNode(nodeId);
        }, function() {
            // Нет — откатываем
            loadFromStorage();
            refreshAll();
            updateCurrentDisplay();
            clearUnsaved();
            originalSelectNode(nodeId);
        });
    } else {
        originalSelectNode(nodeId);
    }
};

// ===== ПОДПИСКИ НА СОБЫТИЯ =====
App.events.on('data:changed', refreshAllGrids);
// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = function() {
        const page = this.getAttribute("data-page");

        // ===== ПРОВЕРКА ПРИ ПЕРЕКЛЮЧЕНИИ НА ПРОСМОТР =====
        if (page === "work" && App.state.hasUnsavedChanges) {
            const node = getNode(App.state.currentNodeId);
            const message = node
                ? `Диапазон <span style="color: #D4AF37; font-weight: 600;">${escapeHtml(node.name)}</span> был отредактирован. Сохранить изменения?`
                : 'Сохранить изменения?';

            showSaveConfirmModal(message, function() {
                // Да — оставляем изменения в памяти
                clearUnsaved();
                switchTab(page);
            }, function() {
                // Нет — откатываем
                loadFromStorage();
                refreshAll();
                updateCurrentDisplay();
                clearUnsaved();
                switchTab(page);
            });
            return;
        }

        switchTab(page);
    };
});

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ ДЕРЕВА ==========

document.getElementById('treeAddFolderBtn')?.addEventListener('click', addRootNode);

document.getElementById('treeAddRangeBtn')?.addEventListener('click', () => {
    // Собираем имена всех корневых узлов
    const rootNodes = App.state.nodes.filter(n => n.parentId === null);
    const existingNames = rootNodes.map(n => n.name);
    const newName = generateUniqueName('Новый диапазон', existingNames);

    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'range'
    };
    addNode(newNode);
    ensureTable(newId);
    persistAll();
    refreshAll();
    selectNode(newId);
});

document.getElementById('treeRenameBtn')?.addEventListener('click', () => {
    if (App.state.currentNodeId) {
        const node = getNode(App.state.currentNodeId);
        if (node) {
            startInlineRename(App.state.currentNodeId);
        } else {
            showFloatingModal("Нет активного узла для переименования");
        }
    }
});

document.getElementById('treeMoveUpBtn')?.addEventListener('click', () => {
    if (App.state.currentNodeId) moveNodeUp(App.state.currentNodeId);
});

document.getElementById('treeMoveDownBtn')?.addEventListener('click', () => {
    if (App.state.currentNodeId) moveNodeDown(App.state.currentNodeId);
});

document.getElementById('treeDeleteBtn')?.addEventListener('click', () => {
    if (App.state.currentNodeId) deleteNode(App.state.currentNodeId);
});

document.getElementById('treeCollapseText')?.addEventListener('click', () => {
    const container = document.getElementById('constructorTree');
    if (!container) return;

    const rootIds = new Set(
        App.editor.nodes
            .filter(n => n.parentId === null)
            .map(n => n.id)
    );
    App.editor.expandedNodes = rootIds;

    // Плавно закрываем ВСЕ вложенные уровни (кроме корневых папок)
    container.querySelectorAll('.tree-children .tree-children.open').forEach(ch => ch.classList.remove('open'));
    // Меняем стрелки на ▶ только у нод внутри вложенных уровней
    container.querySelectorAll('.tree-children .tree-arrow').forEach(a => { if (a.textContent) a.textContent = '▶'; });

    persistAll();
});

document.getElementById('gtoTreeCollapseText')?.addEventListener('click', () => {
    const container = document.getElementById('gtoTree');
    if (!container) return;

    const rootIds = new Set(
        App.gto.nodes
            .filter(n => n.parentId === null)
            .map(n => n.id)
    );
    App.gto.expandedNodes = rootIds;

    // Плавно закрываем ВСЕ вложенные уровни (кроме корневых папок)
    container.querySelectorAll('.tree-children .tree-children.open').forEach(ch => ch.classList.remove('open'));
    // Меняем стрелки на ▶ только у нод внутри вложенных уровней
    container.querySelectorAll('.tree-children .tree-arrow').forEach(a => { if (a.textContent) a.textContent = '▶'; });

    persistAll();
});

// ===== КНОПКИ ДОБАВЛЕНИЯ ЦВЕТА И ПРОФИЛЯ =====

document.getElementById("addPaletteColorBtn").onclick = function() {
    addPaletteColor();
    refreshAll();
};

document.getElementById("newProfileBtn").onclick = function() {
    createNewProfile();
    refreshAll();
};

// GTO версии кнопок
document.getElementById("gtoAddPaletteColorBtn")?.addEventListener('click', function() {
    addPaletteColor();
    renderGtoPage();
});

document.getElementById("gtoNewProfileBtn")?.addEventListener('click', function() {
    createNewProfile();
    renderGtoPage();
});

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ МАТРИЦЫ ==========

// ===== КНОПКИ "РЕДАКТОР" / "АНАЛИЗ" (режим анализа конструктора) =====
// Синхронизация класса #constructorPage.analysis-mode и активной кнопки
// теперь целиком выполняется в refreshConstructorAnalysisMode() (grid.js),
// т.к. её нужно вызывать не только по клику, но и при восстановлении
// состояния после F5 / возврата на вкладку конструктора.
document.getElementById('editorModeBtn')?.addEventListener('click', function() {
    if (!App.state.analysisMode) return;
    App.state.analysisMode = false;
    refreshConstructorAnalysisMode();
    persistAll();
});

document.getElementById('analysisModeBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    App.state.analysisMode = true;
    refreshConstructorAnalysisMode();
    persistAll();
});


document.getElementById('tableClearBtn')?.addEventListener('click', () => {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) return;

    const node = getNode(App.state.currentNodeId);
    const message = node
        ? `Очистить всю таблицу диапазона <span style="color: #D4AF37; font-weight: 600;">${escapeHtml(node.name)}</span>?`
        : 'Очистить всю таблицу?';

showSaveConfirmModal(message, () => {
    const tid = getTableId(App.state.currentNodeId);
    if (App.state.cellStorage[tid]) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                App.state.cellStorage[tid][i][j] = null;
            }
        }
        markUnsaved();
        updateCurrentDisplay();
    }
}, null);
});

// ===== ГСЧ (Генератор случайных чисел) =====
const rngWidget = document.getElementById("rngNumber");
if (rngWidget) {
    rngWidget.textContent = Math.floor(Math.random() * 100) + 1;
    rngWidget.onclick = function() {
        this.textContent = Math.floor(Math.random() * 100) + 1;
    };
}
// ===== ИЗМЕНЕНИЕ ШИРИНЫ ПАНЕЛИ ДЕРЕВА ПЕРЕТАСКИВАНИЕМ =====
function initTreeResize() {
    document.querySelectorAll('.tree-panel').forEach(panel => {
        // Не добавляем повторно
        if (panel.querySelector('.tree-resize-handle')) return;

        const handle = document.createElement('div');
        handle.className = 'tree-resize-handle';
        panel.appendChild(handle);

        let startX = 0;
        let startWidth = 0;

        handle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            startWidth = panel.offsetWidth;
            handle.classList.add('active');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';

            function onMouseMove(e) {
                const delta = e.clientX - startX;
                const newWidth = startWidth + delta;

                // Фиксированный минимум 250px (тулбар сам перенесётся через flex-wrap)
                const minWidth = 250;

                const clamped = Math.max(minWidth, Math.min(700, newWidth));
                panel.style.width = clamped + 'px';
                panel.style.minWidth = clamped + 'px';
                panel.style.flex = '0 0 ' + clamped + 'px';
            }

            function onMouseUp() {
                handle.classList.remove('active');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}

// ===== ЗАПУСК ПРИ ЗАГРУЗКЕ =====
(function() {
    const activeTab = loadFromStorage() || 'constructor';
    switchTab(activeTab);
    
    // Если загрузились с включенным режимом анализа конструктора, нужно
    // синхронизировать DOM (класс .analysis-mode, активные кнопки) сразу
    // после восстановления из localStorage, т.к. HTML-атрибуты жёстко прописаны
    // в index.html как editorModeBtn.active / analysisModeBtn (без active).
    if (activeTab === 'constructor' && App.state.analysisMode) {
        refreshConstructorAnalysisMode();
    }
    
    initComments();
    initTreeResize();
})();
