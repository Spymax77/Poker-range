// ============================================================
// default-data.js — дефолтные диапазоны для первого захода
// ============================================================
// Загружает data/default-editor.json (формат экспорта дерева из
// backup-manager.js) и разворачивает его в редакторе, когда у
// пользователя ещё нет сохранённой структуры:
//   - гость видит дефолт только в памяти сессии (сохранение недоступно);
//   - авторизованный пользователь при первом заходе получает дефолт
//     с разовой автозаписью в аккаунт (см. persistence.js).
// Обновление дефолта = замена json-файла, правки кода не требуются.
App.defaults = App.defaults || {};

(function() {
    const DEFAULT_URL = 'data/default-editor.json';

    // Кэш распарсенного json на время сессии: файл запрашивается один раз.
    // При ошибке загрузки кэш сбрасывается, чтобы следующая попытка
    // (например, после входа в аккаунт) могла повторить запрос.
    let cachedDataPromise = null;

    function fetchDefaultData() {
        if (cachedDataPromise) return cachedDataPromise;
        // cache: 'no-cache' — после замены файла на сервере браузер не должен
        // отдавать устаревшую копию из своего кэша.
        cachedDataPromise = fetch(DEFAULT_URL, { cache: 'no-cache' })
            .then(function(response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function(data) {
                if (!App.backupManager || !App.backupManager.isValidTreeStructure(data)) {
                    throw new Error('Некорректная структура ' + DEFAULT_URL);
                }
                return data;
            })
            .catch(function(error) {
                cachedDataPromise = null; // разрешаем повторную попытку
                throw error;
            });
        return cachedDataPromise;
    }

    // ===== ВЫБОР АКТИВНОГО ДИАПАЗОНА ПОСЛЕ ЗАГРУЗКИ ДЕФОЛТА =====
    // Активным становится первый диапазон в папке UTG ("Open UTG"),
    // папка UTG раскрывается. Если папка UTG переименована в json —
    // берём первую корневую папку с диапазоном, затем первый диапазон
    // дерева, чтобы выбор не ломался при изменении дефолтного файла.
    function selectDefaultNode() {
        const nodes = App.editor.nodes;
        if (!nodes || nodes.length === 0) return;

        const nodeById = function(id) { return App.editor.nodeIndex.get(id) || null; };
        const isRange = function(n) { return !!n && (n.type === 'range' || n.type === 'subrange'); };

        // Раскрываем корневые папки
        for (const node of nodes) {
            if (node.parentId === null && node.type === 'folder') {
                App.editor.expandedNodes.add(node.id);
            }
        }

        let folder = nodes.find(function(n) {
            return n.type === 'folder' && n.name === 'UTG';
        });
        if (!folder) {
            folder = nodes.find(function(n) {
                return n.parentId === null && n.type === 'folder' &&
                    n.childrenIds.some(function(id) { return isRange(nodeById(id)); });
            });
        }

        let target = null;
        if (folder) {
            App.editor.expandedNodes.add(folder.id);
            target = folder.childrenIds.map(nodeById).find(isRange) || null;
        }
        if (!target) {
            target = nodes.find(isRange);
        }
        if (!target) return;

        App.editor.currentNodeId = target.id;
        App.editor.selectedNodeId = target.id;
        App.editor.workDisplayNodeId = target.id;
    }

    // ===== ЗАГРУЗКА ДЕФОЛТНЫХ ДИАПАЗОНОВ В РЕДАКТОР =====
    App.defaults.load = async function() {
        const data = await fetchDefaultData();

        const oldNodesCount = App.editor.nodes.length;
        for (const rootNode of data) {
            App.backupManager.createEditorNodeFromData(rootNode, null);
        }

        // Импорт создаёт узлы, таблицы и цвета — отмечаем их dirty, иначе
        // сохранение не отправит данные на сервер (см. addGtoTreeToEditor).
        // Метаданные (активный диапазон, раскрытые папки) тоже сохраняем.
        if (App.dirty) {
            App.dirty.markStructureDirty('editor');
            App.dirty.markColorsDirty('editor');
            App.dirty.markMetadataDirty('editor');
            for (const node of App.editor.nodes.slice(oldNodesCount)) {
                if (node.type === 'range' || node.type === 'subrange') {
                    App.dirty.markTableDirty(node.id, 'editor');
                }
            }
        }

        selectDefaultNode();
        App.refresh.all();

        // Разовая автозапись дефолта в аккаунт при первом заходе
        // авторизованного пользователя. Гостю сохранять нечего и некуда:
        // persistAll/flushPersist сами выходят без авторизации.
        if (App.auth && App.auth.isLoggedIn() && typeof flushPersist === 'function') {
            await flushPersist();
        }
    };
})();
