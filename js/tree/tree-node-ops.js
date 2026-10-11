// ===== tree-node-ops.js -- операции над узлами дерева =====
//
// Выделено из js/tree.js при разделении на js/tree/*.js: перестановка
// узлов, удаление (со всеми правилами для папок и заполненных диапазонов),
// переименование узла.
//
// Файл обёрнут в IIFE: вложенные хелперы deleteNode (proceedDelete,
// findNeighbourRange и т.д.) и finishInlineRename не должны засорять
// window — голые top-level function в классических скриптах запрещены
// правилами проекта. Наружу — только App.tree.*.
(function() {

App.tree = App.tree || {};

// ===== ДЕРЕВО (с компактным меню) =====
App.tree.moveNodeUp = function(nodeId) {
    let node = App.nodes.getNode(nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = App.state.nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx > 0) {
            [roots[idx - 1], roots[idx]] = [roots[idx], roots[idx - 1]];
            let newNodes = [...roots];
            for (let n of App.state.nodes) {
                if (n.parentId !== null) newNodes.push(n);
            }
            App.state.nodes = newNodes;
            if (App.dirty) App.dirty.markStructureDirty();
        }
    } else {
        let parent = App.nodes.getNode(parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx > 0) {
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            if (App.dirty) App.dirty.markStructureDirty();
        }
    }
    App.persistence.persistAll();
    App.refresh.all();
}

App.tree.moveNodeDown = function(nodeId) {
    let node = App.nodes.getNode(nodeId);
    if (!node) return;
    let parentId = node.parentId;
    if (parentId === null) {
        let roots = App.state.nodes.filter(n => n.parentId === null);
        let idx = roots.findIndex(n => n.id === nodeId);
        if (idx < roots.length - 1) {
            [roots[idx + 1], roots[idx]] = [roots[idx], roots[idx + 1]];
            let newNodes = [...roots];
            for (let n of App.state.nodes) {
                if (n.parentId !== null) newNodes.push(n);
            }
            App.state.nodes = newNodes;
            if (App.dirty) App.dirty.markStructureDirty();
        }
    } else {
        let parent = App.nodes.getNode(parentId);
        let arr = parent.childrenIds;
        let idx = arr.indexOf(nodeId);
        if (idx < arr.length - 1) {
            [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
            if (App.dirty) App.dirty.markStructureDirty();
        }
    }
    App.persistence.persistAll();
    App.refresh.all();
}

App.tree.deleteNode = function(nodeId) {
    let node = App.nodes.getNode(nodeId);
    if (!node) return;

    let hasFilledRanges = false; // ← ОБЪЯВЛЯЕМ ЗДЕСЬ (в начале функции)

    // ===== НОВЫЕ ПРОВЕРКИ ДЛЯ ПАПОК =====
    if (node.type === 'folder') {
        // Вспомогательная функция: сбор всех диапазонов внутри папки (рекурсивно)
        function getAllRangesInFolder(folderId) {
            const folder = App.nodes.getNode(folderId);
            if (!folder) return [];
            let result = [];
            for (const childId of folder.childrenIds) {
                const child = App.nodes.getNode(childId);
                if (!child) continue;
                if (child.type === 'range' || child.type === 'subrange') {
                    result.push(child);
                } else if (child.type === 'folder') {
                    result = result.concat(getAllRangesInFolder(child.id));
                }
            }
            return result;
        }

        // Вспомогательная функция: проверка, есть ли профили в матрице
        function hasProfilesInMatrix(rangeId) {
            const tid = App.grid.getTableId(rangeId);
            const matrix = App.state.cellStorage[tid];
            if (!matrix) return false;
            for (let i = 0; i < 13; i++) {
                const row = matrix[i];
                if (!row) continue; // битая/неполная матрица — строку пропускаем
                for (let j = 0; j < 13; j++) {
                    // != null: undefined (неполная загрузка/импорт) тоже «пусто»
                    if (row[j] != null) return true;
                }
            }
            return false;
        }

        const allRangesInTree = App.state.nodes.filter(n => n.type === 'range' || n.type === 'subrange');
        const rangesInFolder = getAllRangesInFolder(node.id);

        // ПРАВИЛО 1: единственный диапазон во всём дереве
        if (rangesInFolder.length > 0 && rangesInFolder.length === allRangesInTree.length) {
            App.modals.showFloatingModal(App.i18n.t('tree.deleteFolderSingleRangeError'));
            return;
        }

        // ПРАВИЛО 2: есть заполненные диапазоны
        for (const range of rangesInFolder) {
            if (hasProfilesInMatrix(range.id)) {
                hasFilledRanges = true;
                break;
            }
        }

        if (hasFilledRanges) {
            App.modals.showSaveConfirmModal(
                App.i18n.t('tree.folderHasFilledRanges'),
                function() {
                    // ДА — продолжаем удаление
                    proceedDelete(nodeId);
                },
                function() {
                    // НЕТ — ничего не делаем
                }
            );
            return;
        }
    }

    // ===== СТАРАЯ ПРОВЕРКА ДЛЯ ДИАПАЗОНОВ =====
    const allRanges = App.state.nodes.filter(n => n.type === 'range' || n.type === 'subrange');
    if (allRanges.length <= 1 && (node.type === 'range' || node.type === 'subrange')) {
        App.modals.showFloatingModal(App.i18n.t('tree.deleteSingleRangeError'));
        return;
    }
    // ===== ПРАВИЛО 3: проверка на заполненность диапазона =====
    if (node.type === 'range' || node.type === 'subrange') {
        const tid = App.grid.getTableId(node.id);
        const matrix = App.state.cellStorage[tid];
        let isFilled = false;

        if (matrix) {
            for (let i = 0; i < 13; i++) {
                const row = matrix[i];
                if (!row) continue; // битая/неполная матрица — строку пропускаем
                for (let j = 0; j < 13; j++) {
                    // != null: undefined (неполная загрузка/импорт) тоже «пусто»
                    if (row[j] != null) {
                        isFilled = true;
                        break;
                    }
                }
                if (isFilled) break;
            }
        }

        if (isFilled) {
            App.modals.showSaveConfirmModal(
                App.i18n.t('tree.rangeNotEmptyConfirm'),
                function() {
                    // ДА — продолжаем удаление
                    proceedDelete(nodeId);
                },
                function() {
                    // НЕТ — ничего не делаем
                }
            );
            return;
        }
    }

    // ===== ОСНОВНАЯ ЛОГИКА УДАЛЕНИЯ =====
    function proceedDelete(id) {
        const nodeToDelete = App.nodes.getNode(id);
        if (!nodeToDelete) return;

        // Хелпер: рекурсивный поиск первого диапазона внутри папки
        function findFirstRangeInFolder(folderId) {
            const folder = App.nodes.getNode(folderId);
            if (!folder) return null;
            for (const childId of folder.childrenIds) {
                const child = App.nodes.getNode(childId);
                if (!child) continue;
                if (child.type === 'range' || child.type === 'subrange') {
                    return child;
                }
                if (child.type === 'folder') {
                    const found = findFirstRangeInFolder(child.id);
                    if (found) return found;
                }
            }
            return null;
        }

        // Хелпер: рекурсивный поиск последнего диапазона внутри папки
        function findLastRangeInFolder(folderId) {
            const folder = App.nodes.getNode(folderId);
            if (!folder) return null;
            for (let i = folder.childrenIds.length - 1; i >= 0; i--) {
                const child = App.nodes.getNode(folder.childrenIds[i]);
                if (!child) continue;
                if (child.type === 'range' || child.type === 'subrange') {
                    return child;
                }
                if (child.type === 'folder') {
                    const found = findLastRangeInFolder(child.id);
                    if (found) return found;
                }
            }
            return null;
        }

        // Хелпер: поиск соседнего диапазона для нового активного узла.
        // 1) предыдущий сосед (тот, что перед удаляемым); 2) если удаляемый
        // был первым — следующий сосед; 3) если соседей-диапазонов нет, а
        // родитель — диапазон (поддиапазон поддиапазона) — сам родитель.
        function findNeighbourRange(deletedNode) {
            let siblingIds;
            let idx;
            if (deletedNode.parentId !== null) {
                const parentNode = App.nodes.getNode(deletedNode.parentId);
                if (!parentNode) return null;
                siblingIds = parentNode.childrenIds;
                idx = siblingIds.indexOf(deletedNode.id);
            } else {
                // Порядок корневых узлов задаётся порядком в App.state.nodes
                siblingIds = App.state.nodes
                    .filter(n => n.parentId === null)
                    .map(n => n.id);
                idx = siblingIds.indexOf(deletedNode.id);
            }
            if (idx === -1) return null;

            function pickSibling(i) {
                const sib = App.nodes.getNode(siblingIds[i]);
                if (!sib) return null;
                if (sib.type === 'range' || sib.type === 'subrange') return sib;
                if (sib.type === 'folder') {
                    // Визуально ближайший к удаляемому узел внутри папки-соседа
                    return i < idx
                        ? findLastRangeInFolder(sib.id)
                        : findFirstRangeInFolder(sib.id);
                }
                return null;
            }

            for (let i = idx - 1; i >= 0; i--) {
                const found = pickSibling(i);
                if (found) return found;
            }
            for (let i = idx + 1; i < siblingIds.length; i++) {
                const found = pickSibling(i);
                if (found) return found;
            }
            // Родитель сам является диапазоном (случай поддиапазона поддиапазона)
            if (deletedNode.parentId !== null) {
                const parentNode = App.nodes.getNode(deletedNode.parentId);
                if (parentNode &&
                    (parentNode.type === 'range' || parentNode.type === 'subrange')) {
                    return parentNode;
                }
            }
            return null;
        }

        // Общий резервный поиск нового активного диапазона после удаления.
        // Один и тот же алгоритм для редактора и для режима просмотра:
        // сосед удаляемого → корневые диапазоны → первый диапазон в папках →
        // первый range/subrange во всём дереве.
        function findFallbackActiveRange(neighbourRange) {
            let foundRange = neighbourRange;

            // Ищем среди корневых диапазонов
            if (!foundRange) {
                const rootRanges = App.state.nodes.filter(n =>
                    (n.type === 'range' || n.type === 'subrange') &&
                    n.parentId === null
                );
                if (rootRanges.length > 0) {
                    foundRange = rootRanges[0];
                }
            }

            // Ищем во всех папках (рекурсивно)
            if (!foundRange) {
                const folders = App.state.nodes.filter(n => n.type === 'folder');
                for (const folder of folders) {
                    const rangeInFolder = findFirstRangeInFolder(folder.id);
                    if (rangeInFolder) {
                        foundRange = rangeInFolder;
                        break;
                    }
                }
            }

            // Последний fallback: первый range/subrange во всём дереве
            if (!foundRange) {
                foundRange = App.state.nodes.find(n => n.type === 'range' || n.type === 'subrange');
            }

            return foundRange;
        }

        function delSub(currentId) {
            let n = App.nodes.getNode(currentId);
            if (!n) return;
            for (let cid of n.childrenIds) {
                delSub(cid);
            }
            App.nodes.removeNode(currentId);

const tableId = App.grid.getTableId(currentId);
delete App.state.cellStorage[tableId];

// Цвета, активный профиль и комментарии удалённого узла тоже удаляем:
// иначе они оставались в памяти, а при ближайшем сохранении
// (colorsPerNode уходит на сервер ЦЕЛИКОМ) мусорные записи от удалённых
// диапазонов накапливались в ключе poker_range_colors_* и в
// structure-ключе (commentsPerNode).
delete App.state.colorsPerNode[tableId];
delete App.state.activePerNode[tableId];
delete App.state.commentsPerNode[tableId];

// Серверный ключ таблицы удалённого узла больше не нужен: раньше он
// оставался в БД навсегда (осиротевший ключ на каждое удаление).
// Гостю не отправляем — он всё равно не сохраняет, и уведомление о
// необходимости авторизации здесь лишнее.
if (App.auth && App.auth.isLoggedIn()) {
    App.storage.remove('poker_range_table_' + App.currentMode + '_' + currentId);
}



let p = App.nodes.getNode(n.parentId);
            if (p) {
                p.childrenIds = p.childrenIds.filter(cid => cid !== currentId);
            }
        }

        // Сосед удаляемого узла вычисляется ДО удаления, пока его id ещё
        // присутствует в childrenIds родителя (после delSub позиция потеряна)
        const neighbourRange = findNeighbourRange(nodeToDelete);

        delSub(id);
        if (App.dirty) {
            App.dirty.markStructureDirty();
            // Очистка colorsPerNode/activePerNode удалённых узлов должна
            // уйти в цветовой ключ — он сохраняется только при dirty.colors
            App.dirty.markColorsDirty();
        }

        // Несохранённые правки могли относиться только к текущему диапазону:
        // любое переключение между диапазонами разряжает флаг диалогом
        // «Сохранить изменения?», так что грязным бывает лишь текущий узел.
        // Снимаем флаг ТОЛЬКО если текущий узел попал в удалённое поддерево —
        // тогда его правки действительно исчезли вместе с узлом, иначе при
        // перескоке на соседний диапазон выскакивал бы фантомный
        // «Сохранить изменения?» об уже удалённом узле. Удаление ЧУЖОГО узла
        // флаг гасить не должно: правки текущего узла уходят на сервер только
        // через flushPersist (автосохранение по таймеру шлёт лишь структуру),
        // и без флага они потеряются при переключении/F5 без диалога.
        // Dirty-метки structure/colors самого удаления не трогаем — это другой
        // механизм, они уходят на сервер автосохранением ниже.
        const activeExists = !!App.nodes.getNode(App.state.currentNodeId);
        if (!activeExists) {
            App.persistence.clearUnsaved();
        }

        // Поиск нового активного диапазона в редакторе
        if (!activeExists) {
            // Приоритет: сосед удаляемого узла (тот, что перед ним; если его
            // нет — следующий), либо родитель-диапазон (поддиапазон поддиапазона).
            // Кандидат вычислен до delSub (см. выше).
            const foundRange = findFallbackActiveRange(neighbourRange);

            if (foundRange) {
                App.navigation.selectNode(foundRange.id, { skipUnsavedCheck: true });
            } else {
                App.state.currentNodeId = null;
            }
        }

        // Поиск нового активного диапазона в просмотре.
        // Убираем уровни просмотра, указывающие на узлы удалённого поддерева:
        // parentNodeId мог быть не только самим id, но и любой вложенной
        // папкой/узлом внутри него — такие уровни-сироты раньше оставались
        // жить (фильтр был только по верхнему id). Корневой уровень
        // (parentNodeId === null) оставляем всегда.
        App.state.workLevels = App.state.workLevels.filter(lvl =>
            lvl.parentNodeId === null || App.nodes.getNode(lvl.parentNodeId)
        );
        const workActiveExists = !!App.nodes.getNode(App.state.workDisplayNodeId);
        if (!workActiveExists) {
            const foundRange = findFallbackActiveRange(neighbourRange);
            App.state.workDisplayNodeId = foundRange ? foundRange.id : null;
            // persistAll здесь не нужен: сохранение единообразно ниже
        }

        if (!App.state.workLevels.length) {
            App.state.workLevels = [{ parentNodeId: null, levelIndex: 0 }];
        }

        App.persistence.persistAll();
        App.refresh.all();
    }

    // Запускаем удаление (если папка не заблокирована)
    if (node.type !== 'folder' || !hasFilledRanges) {
        proceedDelete(nodeId);
    }
}

App.tree.startInlineRename = function(nodeId) {
    const node = App.nodes.getNode(nodeId);
    if (!node) return;

    // Ищем элемент по data-node-id ТОЛЬКО в своём дереве: искать по всему
    // документу нельзя — числовые id веток editor/gto пересекаются, и input
    // мог попасть в чужое дерево. Сравниваем id как строки — parseInt
    // ломает нечисловые id.
    const treeId = App.currentMode === 'gto' ? 'gtoTree' : 'constructorTree';
    const treeItems = document.querySelectorAll(`#${treeId} .tree-item-name`);
    let targetElement = null;

    for (let el of treeItems) {
        if (String(el.dataset.nodeId) === String(nodeId)) {
            targetElement = el;
            break;
        }
    }

    if (!targetElement) {
       console.warn('❌ Элемент для редактирования не найден для ID:', nodeId);
        return;
    }

    // Сохраняем данные
    App.state.renameNodeId = nodeId;
    App.state.renameOldName = node.name;

    // Создаём input
    App.state.renameInput = document.createElement('input');
    App.state.renameInput.type = 'text';
    App.state.renameInput.className = 'rename-input';
    App.state.renameInput.value = node.name;
    App.state.renameInput.maxLength = 35;

    // Заменяем текст на input
    const parent = targetElement.parentNode;

    // Сохраняем иконку если есть
    const icon = targetElement.querySelector('svg');
    let iconHtml = '';
    if (icon) {
        iconHtml = icon.outerHTML;
    }

    // Для дерева — заменяем содержимое
    targetElement.innerHTML = '';
    if (icon) {
        targetElement.appendChild(icon);
    }
    targetElement.appendChild(App.state.renameInput);

    // Фокус и выделение текста
    App.state.renameInput.focus();
    App.state.renameInput.select();
    // Останавливаем всплытие, чтобы клик внутри поля не вызывал selectNode()
App.state.renameInput.addEventListener('mousedown', function(e) {
    e.stopPropagation();
});
    // Обработчики
    App.state.renameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            App.tree.finishInlineRename(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            App.tree.finishInlineRename(false);
        }
    });

    App.state.renameInput.addEventListener('blur', function() {
        App.tree.finishInlineRename(true);
    });
}

App.tree.finishInlineRename = function(save) {
    if (!App.state.renameInput || App.state.renameNodeId === null) return;

    const node = App.nodes.getNode(App.state.renameNodeId);
    if (!node) {
        // Узел исчез, пока input был открыт (например, удалён): сбрасываем
        // состояние переименования, иначе оно «залипнет» до следующего
        // старта, а input останется висеть в DOM
        App.state.renameInput = null;
        App.state.renameNodeId = null;
        App.state.renameOldName = '';
        App.refresh.all();
        return;
    }

    const newName = App.state.renameInput.value.trim();

    // Если сохраняем и имя не пустое
    if (save && newName.length > 0) {
        node.name = newName;
        if (App.dirty) App.dirty.markStructureDirty();
        App.persistence.persistAll();
        App.refresh.all();
        if (App.state.currentNodeId === App.state.renameNodeId) {
            App.grid.updateCurrentDisplay();
        }
    } else {
        // Отмена или пустое имя — возвращаем старое
        App.refresh.all();
    }

    // Очищаем
    App.state.renameInput = null;
    App.state.renameNodeId = null;
    App.state.renameOldName = '';
}

})();