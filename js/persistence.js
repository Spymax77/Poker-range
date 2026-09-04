// ============================================================
// persistence.js — сохранение/загрузка состояния в localStorage
// ============================================================

// ===== PERSIST ALL =====
function persistAll() {
    // Сохраняем активную вкладку
    const activeBtn = document.querySelector('.tab-btn.active');
    const activeTab = activeBtn ? activeBtn.getAttribute('data-page') : 'constructor';

    const data = {
        // ---- РЕДАКТОР ----
        editor: {
            nodes: App.editor.nodes,
            nextNodeId: App.editor.nextNodeId,
            currentNodeId: App.editor.currentNodeId,
            cellStorage: App.editor.cellStorage,
            expandedNodes: Array.from(App.editor.expandedNodes),
            workLevels: App.editor.workLevels,
            workDisplayNodeId: App.editor.workDisplayNodeId,
            colorsPerNode: App.editor.colorsPerNode,
            activePerNode: App.editor.activePerNode,
            nextColorId: App.editor.nextColorId,
            commentsPerNode: App.editor.commentsPerNode
        },
        // ---- GTO ----
        gto: {
            nodes: App.gto.nodes,
            nextNodeId: App.gto.nextNodeId,
            currentNodeId: App.gto.currentNodeId,
            cellStorage: App.gto.cellStorage,
            expandedNodes: Array.from(App.gto.expandedNodes),
            workLevels: App.gto.workLevels,
            workDisplayNodeId: App.gto.workDisplayNodeId,
            colorsPerNode: App.gto.colorsPerNode,
            activePerNode: App.gto.activePerNode,
            nextColorId: App.gto.nextColorId,
            commentsPerNode: App.gto.commentsPerNode
        },
        activeTab: activeTab,
        // Режим анализа конструктора должен переживать перезагрузку страницы (F5),
        // поэтому сохраняем его на верхнем уровне (это UI-флаг, не привязан к editor/gto).
        analysisMode: App.state.analysisMode
    };


    App.storage.save("poker_range_tree_v6", data);
}

function loadFromStorage() {
    let raw = App.storage.loadRaw("poker_range_tree_v6");
    if (raw) {
        try {
            let d = JSON.parse(raw);
            
            // Проверяем новый формат (с editor/gto ветками) или старый
            if (d.editor) {
                // Новый формат: загружаем editor и gto отдельно
                App.editor.nodes = d.editor.nodes || [];
                App.editor.nextNodeId = d.editor.nextNodeId || 1;
                App.editor.currentNodeId = d.editor.currentNodeId || null;
                App.editor.cellStorage = d.editor.cellStorage || {};
                App.editor.expandedNodes = new Set(d.editor.expandedNodes || []);
                App.editor.workLevels = d.editor.workLevels || [];
                App.editor.workDisplayNodeId = d.editor.workDisplayNodeId || null;
                App.editor.colorsPerNode = d.editor.colorsPerNode || {};
                App.editor.activePerNode = d.editor.activePerNode || {};
                App.editor.nextColorId = d.editor.nextColorId || 1;
                App.editor.commentsPerNode = d.editor.commentsPerNode || {};

                if (d.gto) {
                    App.gto.nodes = d.gto.nodes || [];
                    App.gto.nextNodeId = d.gto.nextNodeId || 1;
                    App.gto.currentNodeId = d.gto.currentNodeId || null;
                    App.gto.cellStorage = d.gto.cellStorage || {};
                    App.gto.expandedNodes = new Set(d.gto.expandedNodes || []);
                    App.gto.workLevels = d.gto.workLevels || [];
                    App.gto.workDisplayNodeId = d.gto.workDisplayNodeId || null;
                    App.gto.colorsPerNode = d.gto.colorsPerNode || {};
                    App.gto.activePerNode = d.gto.activePerNode || {};
                    App.gto.nextColorId = d.gto.nextColorId || 1;
                    App.gto.commentsPerNode = d.gto.commentsPerNode || {};
                }
            } else {
                // Старый формат: загружаем только в editor
                App.editor.nodes = d.nodes || [];
                App.editor.nextNodeId = d.nextNodeId || 1;
                App.editor.currentNodeId = d.currentNodeId || null;
                App.editor.cellStorage = d.cellStorage || {};
                App.editor.expandedNodes = new Set(d.expandedNodes || []);
                App.editor.workLevels = d.workLevels || [];
                App.editor.workDisplayNodeId = d.workDisplayNodeId || null;
                App.editor.colorsPerNode = d.colorsPerNode || {};
                App.editor.activePerNode = d.activePerNode || {};
                App.editor.nextColorId = d.nextColorId || 1;
                App.editor.commentsPerNode = d.commentsPerNode || {};
            }

            // Загружаем активную вкладку
            const activeTab = d.activeTab || 'constructor';

            // Загружаем режим анализа конструктора (должен переживать F5).
            App.state.analysisMode = !!d.analysisMode;

            // Пересобираем индексы после загрузки
            rebuildNodeIndexFor(App.editor);
            rebuildNodeIndexFor(App.gto);

            if (App.editor.nodes.length === 0) {
                App.currentMode = 'editor';
                resetToCleanData();
            }
            return activeTab;
        } catch(e) {
            console.error('Ошибка загрузки:', e);
            // Данные ЕСТЬ, но не парсятся — они повреждены.
            // НЕ затираем молча: сначала спасаем точную копию в резервный
            // ключ, затем предупреждаем пользователя. Только после этого
            // поднимаем чистое дерево, чтобы приложение осталось рабочим.
            const backupKey = "poker_range_tree_v6_corrupted_" + Date.now();
            try {
                App.storage.saveRaw(backupKey, raw);
            } catch (backupErr) {
                console.error('Не удалось сохранить резервную копию повреждённых данных:', backupErr);
            }
            if (typeof showFloatingModal === 'function') {
                showFloatingModal(
                    'Сохранённые данные повреждены и не могут быть прочитаны. ' +
                    'Их копия сохранена под ключом «' + backupKey + '». ' +
                    'Загружено чистое дерево.'
                );
            }
            App.currentMode = 'editor';
            resetToCleanData();
            return 'constructor';
        }
    }
    // Данных НЕТ вообще — обычный первый запуск, тихий сброс без предупреждения.
    App.currentMode = 'editor';
    resetToCleanData();
    return 'constructor';
}

// ===== ФЛАГ ИЗМЕНЕНИЙ =====

function markUnsaved() {
    App.state.hasUnsavedChanges = true;
}

function clearUnsaved() {
    App.state.hasUnsavedChanges = false;
}

// ===== ПОДПИСКИ НА СОБЫТИЯ PERSISTENCE =====
App.events.on('unsaved:mark', markUnsaved);
App.events.on('unsaved:clear', clearUnsaved);
