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
    var missingTableData = false;

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
        }

        // Сохраняем структуру (каталог дерева, БЕЗ цветов — они в отдельном
        // ключе poker_range_colors_*, чтобы автосохранения дерева не тащили
        // несогласованные правки цветов)
        if (dirty.structure[mode]) {
            var structure = {
                nodes: branch.nodes,
                nextNodeId: branch.nextNodeId,
                commentsPerNode: branch.commentsPerNode
            };
            promises.push(App.storage.saveRaw('poker_range_structure_' + mode, JSON.stringify(structure)));
        }

        // Сохраняем цвета/профили отдельным ключом:
        // - dirty.colors         — автосохранение (создание/удаление цветов);
        // - dirty.colorsExplicit — ТОЛЬКО явное сохранение (правки hex/имени,
        //   ползунков, состава мультицвета — напрямую влияют на вид ячеек).
        if (dirty.colors[mode] || (!skipTables && dirty.colorsExplicit[mode])) {
            var colorsData = {
                nextColorId: branch.nextColorId,
                colorsPerNode: branch.colorsPerNode,
                activePerNode: branch.activePerNode
            };
            promises.push(App.storage.saveColors(mode, colorsData));
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
                } else {
                    // Нельзя подтверждать сохранение таблицы, если её данные
                    // отсутствуют и запрос в storage не был отправлен.
                    missingTableData = true;
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

    // Очищаем dirty только после подтверждённого успешного сохранения.
    // Storage API возвращает { success: false } при ошибке, поэтому проверяем
    // не только отклонённые Promise, но и результаты запросов.
    return Promise.all(promises).then(function(results) {
        var saveFailed = results.some(function(result) {
            return !result || result.success === false;
        });

        if (saveFailed || missingTableData) {
            return results;
        }

        // При skipTables таблицы и colorsExplicit ещё не отправлялись
        // и должны остаться dirty.
        if (skipTables) {
            for (var m = 0; m < ['editor', 'gto'].length; m++) {
                var md = ['editor', 'gto'][m];
                dirty.metadata[md] = false;
                dirty.structure[md] = false;
                dirty.colors[md] = false;
            }
        } else {
            App.dirty.clearDirty();
        }

        return results;
    });
}

function persistAll() {
    // Гостевые изменения остаются только в памяти текущей страницы и никогда
    // не отправляются на сервер. При входе гостевое состояние сбрасывается,
    // после чего загружается состояние авторизованного пользователя.
    if (!App.auth || !App.auth.isLoggedIn()) {
        return;
    }
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
function resetBranchBeforeLoad(branch) {
    branch.nodes = [];
    branch.nodeIndex = new Map();
    branch.nextNodeId = 1;
    branch.currentNodeId = null;
    branch.selectedNodeId = null;
    branch.workLevels = [{ parentNodeId: null, levelIndex: 0 }];
    branch.workDisplayNodeId = null;
    branch.cellStorage = {};
    branch.expandedNodes = new Set();
    branch.colorsPerNode = {};
    branch.activePerNode = {};
    branch.nextColorId = 1;
    branch.profileRefs = new Map();
    branch.activePopup = null;
    branch.commentsPerNode = {};
}

async function loadFromStorageV2() {
    var uiMetadata = App.storage.loadMetadata() || {};
    // Флаг «у пользователя есть сохранённая структура редактора».
    // Отсутствие ключа структуры = первый заход (дефолт из json),
    // наличие ключа (даже с пустым деревом) = данные не трогаем.
    var editorStructureExisted = false;

    for (var mi = 0; mi < ['editor', 'gto'].length; mi++) {
        var mode = ['editor', 'gto'][mi];
        var branch = mode === 'editor' ? App.editor : App.gto;

        // Серверное состояние является единственным источником данных при
        // загрузке. Это также отбрасывает все изменения гостевой сессии,
        // которые оставались только в памяти браузера.
        resetBranchBeforeLoad(branch);

        // Загружаем структуру (каталог дерева, без цветов)
        var structure = App.storage.loadStructure(mode);
        if (structure) {
            if (mode === 'editor') editorStructureExisted = true;
            branch.nodes = structure.nodes || [];
            branch.nextNodeId = structure.nextNodeId || 1;
            branch.commentsPerNode = structure.commentsPerNode || {};
        }

        // Загружаем цвета/профили из отдельного ключа. Если ключа ещё нет
        // (данные до разделения хранения) — читаем цвета из structure и
        // МИГРИРУЕМ их в новый ключ один раз, чтобы автосохранения дерева
        // больше не перезаписывали их.
        var colorsData = App.storage.loadColors(mode);
        if (colorsData) {
            branch.nextColorId = colorsData.nextColorId || 1;
            branch.colorsPerNode = colorsData.colorsPerNode || {};
            branch.activePerNode = colorsData.activePerNode || {};
        } else if (structure && (structure.colorsPerNode || structure.activePerNode)) {
            branch.nextColorId = structure.nextColorId || 1;
            branch.colorsPerNode = structure.colorsPerNode || {};
            branch.activePerNode = structure.activePerNode || {};
            if (App.auth && App.auth.isLoggedIn()) {
                App.storage.saveColors(mode, {
                    nextColorId: branch.nextColorId,
                    colorsPerNode: branch.colorsPerNode,
                    activePerNode: branch.activePerNode
                });
            }
        } else {
            branch.nextColorId = branch.nextColorId || 1;
        }

        // Защита от рассинхрона счётчика: nextColorId в сохранённых данных мог
        // отстать от фактических ID — импорт дефолта/конфигураций и перенос
        // GTO→редактор берут ID цветов из источника, не обновляя счётчик
        // (у новых пользователей после развёртывания дефолта он оставался 1).
        // Поднимаем счётчик до max(ID)+1 по всем таблицам ветки. Только вверх
        // (через max): сами данные не трогаем, счётчик — лишь источник
        // кандидатов ID, уникальность внутри таблицы обеспечивают гварды.
        var maxColorId = 0;
        for (var cpnKey in branch.colorsPerNode) {
            var branchColors = branch.colorsPerNode[cpnKey];
            if (Array.isArray(branchColors)) {
                for (var bci = 0; bci < branchColors.length; bci++) {
                    var bcId = branchColors[bci] && branchColors[bci].id;
                    if (typeof bcId === 'number' && bcId > maxColorId) maxColorId = bcId;
                }
            }
        }
        if (branch.nextColorId <= maxColorId) branch.nextColorId = maxColorId + 1;

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

    // Первый заход (сохранённой структуры редактора нет): загружаем дефолтные
    // диапазоны из data/default-editor.json. Для авторизованного пользователя
    // это единственная разовая автозапись данных без явного согласия — после
    // неё ключ структуры появляется на сервере и дефолт больше не
    // перезаписывается (даже если пользователь удалит всё дерево).
    // Гостю дефолт разворачивается только в памяти сессии.
    if (!editorStructureExisted) {
        App.currentMode = 'editor';
        if (App.defaults && App.defaults.load) {
            try {
                await App.defaults.load();
            } catch (error) {
                // Fallback: если дефолтный json недоступен (сеть, 404, битый
                // JSON), создаём минимальный пустой скелет, чтобы редактор
                // не оставался совсем без дерева.
                console.error('Не удалось загрузить дефолтные диапазоны:', error);
                App.refresh.resetToCleanData();
            }
        } else {
            App.refresh.resetToCleanData();
        }
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

function notifyGuestUnsavedChanges() {
    if (App.auth && App.auth.isLoggedIn()) return;
    App.modals.showFloatingModal(App.i18n.t('auth.guestUnsaved'));
}

// ===== ПОДПИСКИ НА СОБЫТИЯ PERSISTENCE =====
App.events.on('unsaved:mark', markUnsaved);
App.events.on('unsaved:clear', clearUnsaved);