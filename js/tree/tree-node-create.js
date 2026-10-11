// ===== tree-node-create.js -- именование и создание узлов дерева =====
//
// Выделено из js/tree.js при разделении на js/tree/*.js: генерация имён,
// стартовая палитра, создание папки/диапазона/поддиапазона.
//
// Файл обёрнут в IIFE: внутренние хелперы (initDefaultColor,
// generateUniqueNameFor, finishNodeCreation) не должны засорять window —
// голые top-level function в классических скриптах запрещены правилами
// проекта. Наружу — только App.tree.*; стартовая палитра дополнительно
// экспортируется как App.tree.initDefaultColor (её использует refresh.js).
(function() {

App.tree = App.tree || {};

// ===== ГЕНЕРАЦИЯ УНИКАЛЬНОГО ИМЕНИ =====
App.tree.generateUniqueName = function(baseName, existingNames) {
    if (!existingNames.includes(baseName)) {
        return baseName;
    }
    // Имя с числовым суффиксом " (N)" продолжаем серию ("X (2)" → "X (3)"),
    // а не плодим вложенные суффиксы вида "X (2) (2)"
    const m = /^(.*) \((\d+)\)$/.exec(String(baseName));
    const stem = m ? m[1] : baseName;
    let counter = m ? parseInt(m[2], 10) + 1 : 2;
    while (existingNames.includes(`${stem} (${counter})`)) {
        counter++;
    }
    return `${stem} (${counter})`;
}

// ============================================================
// ХЕЛПЕРЫ СОЗДАНИЯ УЗЛОВ (общие для тулбара и popup-меню дерева)
// ============================================================

// Стартовая палитра нового диапазона/поддиапазона: один простой
// цвет "Raise", он же становится активным цветом узла.
function initDefaultColor(nodeId) {
    const tableId = App.grid.getTableId(nodeId);
    App.state.colorsPerNode[tableId] = [];
    const colorId = App.state.nextColorId++;
    App.state.colorsPerNode[tableId].push({
        id: colorId,
        name: "Raise",
        color: "#E55757",
        type: 'simple'
    });
    App.state.activePerNode[tableId] = colorId;
}

// Единая точка стартовой палитры нового диапазона: используется внутри
// js/tree/*.js и из refresh.js (App.refresh.resetToCleanData).
App.tree.initDefaultColor = initDefaultColor;

// Придумать уникальное имя нового узла: parentId === null — среди
// корневых узлов, иначе — среди детей родителя.
// ВНИМАНИЕ: дефолтные имена узлов (см. решение №8 в russian-text-inventory.md)
// намеренно не локализуются — при создании узла в английском интерфейсе
// временно используется русское имя по умолчанию.
function generateUniqueNameFor(parentId, baseName) {
    let existingNames;
    if (parentId === null) {
        existingNames = App.state.nodes
            .filter(n => n.parentId === null)
            .map(n => n.name);
    } else {
        const parent = App.nodes.getNode(parentId);
        existingNames = parent
            ? parent.childrenIds.map(id => App.nodes.getNode(id)).filter(n => n).map(n => n.name)
            : [];
    }
    return App.tree.generateUniqueName(baseName, existingNames);
}

// Единый «хвост» создания узла: dirty-метки → перерисовка → выбор узла →
// стратегия сохранения. При несохранённых правках прежнего диапазона
// (аккаунт) новый узел точечно сохраняется ДО переключения: диалог
// «Сохранить изменения?» на «Нет» откатывает состояние из хранилища, и
// созданный узел обязан уже быть на сервере. Если правок нет —
// переключение мгновенное, сохранение следует за ним (как раньше).
// opts.table  — пометить таблицу узла изменённой (range/subrange);
// opts.colors — пометить цвета изменёнными (создан стартовый цвет).
async function finishNodeCreation(newId, opts) {
    opts = opts || {};
    try {
        App.dirty.markStructureDirty();
        if (opts.table) App.dirty.markTableDirty(newId);
        if (opts.colors) App.dirty.markColorsDirty();
        App.refresh.all();
        const loggedIn = App.auth && App.auth.isLoggedIn();
        const confirmNeeded = loggedIn && App.state.hasUnsavedChanges;
        if (confirmNeeded) {
            const results = await App.persistence.flushPersist([newId]);
            const saveSucceeded = !results || results.every(function(result) {
                return result && result.success !== false;
            });
            if (!saveSucceeded) {
                App.modals.showFloatingModal(App.i18n.t('range.saveFailed'));
            }
        }
        const selectOpts = {};
        if (opts.colors) {
            // «Нет» в диалоге откатывает состояние из хранилища. Если цветовой
            // ключ не отправлялся (были несогласованные правки цветов),
            // стартовая палитра нового узла осталась несохранённой —
            // пересоздаём её, чтобы новый диапазон не остался без цветов.
            // Хук нужен только узлам со стартовой палитрой (range/subrange):
            // у папки цветов нет, и создавать их после отката не нужно.
            selectOpts.afterRollback = function() {
                var colors = App.state.colorsPerNode[App.grid.getTableId(newId)];
                if (!colors || !colors.length) {
                    initDefaultColor(newId);
                    if (App.dirty) App.dirty.markColorsDirty();
                }
            };
        }
        App.navigation.selectNode(newId, selectOpts);
        if (!loggedIn) {
            App.persistence.markUnsaved();
            App.persistence.notifyGuestUnsavedChanges();
            return;
        }
        if (!confirmNeeded) {
            // Обычный путь (без диалога): сохраняем после selectNode —
            // метаданные уйдут с новым активным узлом (см. комментарий
            // про порядок selectNode → flushPersist в clipboard.js).
            App.persistence.flushPersist();
        }
    } catch (error) {
        // finishNodeCreation вызывается «fire-and-forget» (промис никто не
        // ждёт): без обработчика любое исключение — например, отказ
        // flushPersist — стало бы unhandled rejection. Сообщаем о проблеме
        // сохранения и не роняем дальнейшую работу.
        console.error('finishNodeCreation:', error);
        App.modals.showFloatingModal(App.i18n.t('range.saveFailed'));
    }
}

App.tree.addRootNode = function() {
    const newName = generateUniqueNameFor(null, 'Новая папка');

    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'folder'
    };
    App.nodes.addNode(newNode);
    App.grid.ensureTable(newId);

    // Единый «хвост» создания узла (как в addRootRange/createChildNode):
    // dirty-метки → перерисовка → выбор → стратегия сохранения. Папка
    // точечно сохраняется ДО переключения при несохранённых правках
    // (persistAll шлёт структуру лишь по таймеру — этого мало); opts.table/
    // opts.colors не нужны: у папки нет ни своей таблицы, ни стартовой палитры.
    finishNodeCreation(newId, {});
}

// Создать корневой диапазон из тулбара дерева. Раньше логика жила в старом init.js
// и теряла стартовый цвет; теперь единая точка создания диапазона наравне
// с popup-меню папки (createChildNode).
App.tree.addRootRange = function() {
    const newName = generateUniqueNameFor(null, 'Новый диапазон');

    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'range'
    };
    App.nodes.addNode(newNode);
    App.grid.ensureTable(newId);

    initDefaultColor(newId);
    finishNodeCreation(newId, { table: true, colors: true });
}

App.tree.createChildNode = function(parentId, type) {
    let parent = App.nodes.getNode(parentId);
    if (!parent) return;

    let baseName;
    if (type === 'folder') {
        baseName = 'Новая папка';
    } else if (type === 'range') {
        baseName = 'Новый диапазон';
    } else if (type === 'subrange') {
        baseName = 'Поддиапазон';
    } else {
        // Неизвестный тип — имя-заглушка, чтобы имя не стало «undefined»
        baseName = 'Новый узел';
    }

    // ============================================================
    // ДЛЯ ПОДДИАПАЗОНА — ПОКАЗЫВАЕМ ДИАЛОГ, ПОТОМ СОЗДАЁМ
    // ============================================================
    if (type === 'subrange') {
        App.modals.showComponentSelectionDialog(parentId, function(selectedIndex) {
            if (selectedIndex !== -1) {
                // ✅ ПОЛЬЗОВАТЕЛЬ ВЫБРАЛ → СОЗДАЁМ УЗЕЛ.
                // Имя генерируем ПОСЛЕ закрытия диалога: пока он открыт,
                // могли создаться другие узлы — уникальность считаем по
                // состоянию на момент создания
                const newName = generateUniqueNameFor(parentId, baseName);
                const newId = App.state.nextNodeId++;
                const newNode = {
                    id: newId,
                    name: newName,
                    parentId: parentId,
                    childrenIds: [],
                    type: 'subrange',
                    selectedComponentIndex: selectedIndex
                };
                App.nodes.addNode(newNode);
                parent.childrenIds.push(newId);
                App.grid.ensureTable(newId);

                initDefaultColor(newId);

                finishNodeCreation(newId, { table: true, colors: true });
            }
            // ❌ Если отмена → НИЧЕГО НЕ ДЕЛАЕМ
        });
        return; // Выходим, чтобы не создавать узел ДО диалога
    }

    // ============================================================
    // ДЛЯ ПАПОК И ДИАПАЗОНОВ — СОЗДАЁМ СРАЗУ
    // ============================================================
    const newName = generateUniqueNameFor(parentId, baseName);
    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: parentId,
        childrenIds: [],
        type: type
    };
    App.nodes.addNode(newNode);
    parent.childrenIds.push(newId);
    App.grid.ensureTable(newId);

    if (type === 'range') {
        // Создан стартовый цвет диапазона — отмечаем для цветового ключа
        initDefaultColor(newId);
    }

    finishNodeCreation(newId, { table: type === 'range', colors: type === 'range' });
}

})();