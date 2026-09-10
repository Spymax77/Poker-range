// ============================================================
// persistence.js — сохранение/загрузка состояния (V2 только)
// ============================================================

// ===== PERSIST ALL =====
let persistTimer = null;

function persistAllNow(skipTables) {
    // Если нет изменений — ничего не делаем
    if (!App.dirty || !App.dirty.hasDirty()) {
        return Promise.resolve();
    }

    if (!App.auth || !App.auth.isLoggedIn()) {
        App.auth.requireAuthNotice();
        return Promise.resolve();
    }

    var dirty = App.dirty._raw;
    var promises = [];
    var savedCount = 0;

    for (var mi = 0; mi < ['editor', 'gto'].length; mi++) {
        var mode = ['editor', 'gto'][mi];
        var branch = mode === 'editor' ? App.editor : App.gto;

        // Сохраняем метаданные
        if (dirty.metadata[mode]) {
            var metadata = {
                currentNodeId: branch.currentNodeId,
                selectedNodeId: branch.selectedNodeId,
                expandedNodes: Array.from(branch.expandedNodes),
                workLevels: branch.workLevels,
                workDisplayNodeId: branch.workDisplayNodeId
            };
            promises.push(App.storage.saveRaw('poker_range_metadata_' + mode, JSON.stringify(metadata)));
            savedCount++;
        }

        // Сохраняем структуру
        if (dirty.structure[mode]) {
            var structure = {
                nodes: branch.nodes,
                nextNodeId: branch.nextNodeId,
                nextColorId: branch.nextColorId,
                colorsPerNode: branch.colorsPerNode,
                activePerNode: branch.activePerNode,
                commentsPerNode: branch.commentsPerNode
            };
            promises.push(App.storage.saveRaw('poker_range_structure_' + mode, JSON.stringify(structure)));
            savedCount++;
        }

        // Сохраняем изменённые таблицы ТОЛЬКО если это явное сохранение (не по таймеру)
        if (!skipTables) {
            var dirtyTables = App.dirty.getDirtyTables(mode);
            for (var ti = 0; ti < dirtyTables.length; ti++) {
                var nodeId = dirtyTables[ti];
                var tableId = getTableId(Number(nodeId));
                var tableData = branch.cellStorage[tableId];
                if (tableData) {
                    promises.push(App.storage.saveTable(mode, Number(nodeId), {
                        nodeId: Number(nodeId),
                        mode: mode,
                        matrix: tableData
                    }));
                    savedCount++;
                }
            }
        }
    }

    // Сохраняем общие UI-метаданные
    if (dirty.metadata.editor || dirty.metadata.gto) {
        var activeBtn = document.querySelector('.tab-btn.active');
        var activeTab = activeBtn ? activeBtn.getAttribute('data-page') : 'constructor';
        var uiMetadata = {
            activeTab: activeTab,
            analysisMode: App.state.analysisMode
        };
        promises.push(App.storage.saveMetadata(uiMetadata));
    }

    // Очищаем dirty: если skipTables — оставляем таблицы грязными (ждут явного сохранения)
    if (skipTables) {
        for (var m = 0; m < ['editor', 'gto'].length; m++) {
            var md = ['editor', 'gto'][m];
            dirty.metadata[md] = false;
            dirty.structure[md] = false;
        }
    } else {
        App.dirty.clearDirty();
    }
    return Promise.all(promises);
}

function persistAll() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(function() {
        persistTimer = null;
        persistAllNow(true); // по таймеру — только структура, без таблиц
    }, 2000);
}

function flushPersist() {
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    return persistAllNow();
}

function persistActiveTab(activeTab) {
    if (!App.auth || !App.auth.isLoggedIn()) {
        return;
    }
    App.storage.saveMetadata({
        activeTab: activeTab || 'constructor',
        analysisMode: App.state.analysisMode
    });
}

// ===== V2: Загрузка разделённых данных =====
async function loadFromStorageV2() {
    var uiMetadata = App.storage.loadMetadata() || {};

    for (var mi = 0; mi < ['editor', 'gto'].length; mi++) {
        var mode = ['editor', 'gto'][mi];
        var branch = mode === 'editor' ? App.editor : App.gto;

        // Загружаем структуру
        var structure = App.storage.loadStructure(mode);
        if (structure) {
            branch.nodes = structure.nodes || [];
            branch.nextNodeId = structure.nextNodeId || 1;
            branch.nextColorId = structure.nextColorId || 1;
            branch.colorsPerNode = structure.colorsPerNode || {};
            branch.activePerNode = structure.activePerNode || {};
            branch.commentsPerNode = structure.commentsPerNode || {};
        }

        // Загружаем метаданные
        var metadata = App.storage.load('poker_range_metadata_' + mode);
        if (metadata) {
            branch.currentNodeId = metadata.currentNodeId || null;
            branch.selectedNodeId = metadata.selectedNodeId || branch.currentNodeId || null;
            branch.expandedNodes = new Set(metadata.expandedNodes || []);
            branch.workLevels = metadata.workLevels || [{ parentNodeId: null, levelIndex: 0 }];
            branch.workDisplayNodeId = metadata.workDisplayNodeId || null;
        }

        // Если currentNodeId не задан — выбираем первый range/subrange
        if (!branch.currentNodeId && branch.nodes && branch.nodes.length > 0) {
            var firstRange = branch.nodes.find(function(n) {
                return n.type === 'range' || n.type === 'subrange';
            });
            if (firstRange) {
                branch.currentNodeId = firstRange.id;
            }
        }

        // Загружаем таблицы ТОЛЬКО для editor (GTO не сохраняется на сервер)
        branch.cellStorage = {};
        if (mode === 'editor' && branch.nodes) {
            // СНАЧАЛА загружаем все таблицы с сервера
            var tableKeys = [];
            for (var ni = 0; ni < branch.nodes.length; ni++) {
                tableKeys.push('poker_range_table_' + mode + '_' + branch.nodes[ni].id);
            }
            await App.storage.preload(tableKeys);
            
            // ПОТОМ читаем из кэша
            for (var ni = 0; ni < branch.nodes.length; ni++) {
                var node = branch.nodes[ni];
                var tableData = App.storage.loadTable(mode, node.id);
                if (tableData) {
                    var tableId = getTableId(node.id);
                    // tableData может быть объектом {matrix: ...} или сразу матрицей
                    branch.cellStorage[tableId] = tableData.matrix || tableData;
                }
            }
        }

        rebuildNodeIndexFor(branch);
    }

    App.state.analysisMode = !!uiMetadata.analysisMode;

    if (App.editor.nodes.length === 0) {
        App.currentMode = 'editor';
        App.refresh.resetToCleanData();
    }

    return uiMetadata.activeTab || 'constructor';
}

function loadFromStorage() {
    return loadFromStorageV2();
}

// ===== ФЛАГ ИЗМЕНЕНИЙ =====

function markUnsaved() {
    App.state.hasUnsavedChanges = true;
    if (App.grid && App.grid.updateConstructorToolbarState) App.grid.updateConstructorToolbarState();
}

function clearUnsaved() {
    App.state.hasUnsavedChanges = false;
    if (App.grid && App.grid.updateConstructorToolbarState) App.grid.updateConstructorToolbarState();
}

// ===== ПОДПИСКИ НА СОБЫТИЯ PERSISTENCE =====
App.events.on('unsaved:mark', markUnsaved);
App.events.on('unsaved:clear', clearUnsaved);