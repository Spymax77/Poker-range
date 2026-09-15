// ===== backup-manager.js =====
(function() {

    let backupContainer = null;
    const mobileBackupQuery = window.matchMedia('(max-width: 849px)');

    function createBackupButtons() {
        const toolbar = document.querySelector('#constructorPage .table-toolbar');
        if (!toolbar) return;

        const constructorPage = document.getElementById('constructorPage');
        const isConstructor = constructorPage?.classList.contains('active-page');
        const toolbarRight = toolbar.querySelector('.toolbar-right');
        const target = mobileBackupQuery.matches ? toolbarRight : toolbar;

        if (!isConstructor || !target) {
            if (backupContainer && !isConstructor) {
                backupContainer.remove();
                backupContainer = null;
            }
            return;
        }

        // Повторные вызовы приходят от MutationObserver и переключения вкладок.
        // Если контейнер уже на месте, не пересоздаём кнопки и обработчики.
        const existingContainer = document.querySelector('#constructorPage .backup-tree-actions');
        if (existingContainer) {
            backupContainer = existingContainer;
            if (existingContainer.parentElement !== target) {
                target.appendChild(existingContainer);
            }
            existingContainer.style.marginLeft = mobileBackupQuery.matches ? '0' : 'auto';
            return;
        }

        if (backupContainer) {
            backupContainer.remove();
            backupContainer = null;
        }

        const container = document.createElement('div');
        container.className = 'backup-tree-actions';
        container.style.marginLeft = mobileBackupQuery.matches ? '0' : 'auto';
        container.style.display = 'flex';
        container.style.gap = '6px';
        container.style.alignItems = 'center';

        container.innerHTML = `
            <button class="toolbar-btn" id="exportTreeBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Экспорт</span>
            </button>
            <button class="toolbar-btn" id="importTreeBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Импорт</span>
            </button>
        `;

        target.appendChild(container);
        backupContainer = container;

        document.getElementById('exportTreeBtn').addEventListener('click', exportTree);
        document.getElementById('importTreeBtn').addEventListener('click', importTree);
    }

    // ===== ЭКСПОРТ ДЕРЕВА С ЦВЕТАМИ И МАТРИЦЕЙ =====
    function exportTree() {
        const rootNodes = App.state.nodes.filter(n => n.parentId === null);
        
        if (rootNodes.length === 0) {
            App.modals.showFloatingModal('Нет данных для экспорта');
            return;
        }

        function serializeNode(node) {
            const result = {
                name: node.name,
                type: node.type
            };
                        // ===== СОХРАНЯЕМ ВЫБРАННЫЙ ЦВЕТ ДЛЯ ПОДДИАПАЗОНА =====
            if (node.type === 'subrange' && node.selectedComponentIndex !== undefined) {
                result.selectedComponentIndex = node.selectedComponentIndex;
            }
            if (node.type === 'range' || node.type === 'subrange') {
                const tableId = getTableId(node.id);
                const colors = App.state.colorsPerNode[tableId] || [];
                
                // ===== ЭКСПОРТ ЦВЕТОВ (ОПТИМИЗИРОВАННЫЙ) =====
                if (colors.length > 0) {
                    const simpleColors = colors.filter(c => c.type === 'simple' || (!c.type && c.color));
                    const multiColors = colors.filter(c => c.type === 'multi' || (c.components && c.components.length > 0));
                    
                    const colorsData = {};
                    
                    if (simpleColors.length > 0) {
                        colorsData.simple = simpleColors.map(c => ({
                            id: c.id,
                            name: c.name || 'Без имени',
                            color: c.color
                        }));
                    }
                    
                    if (multiColors.length > 0) {
                        colorsData.multi = multiColors.map(c => {
                            const components = c.components.map(comp => ({
                                colorId: comp.colorId,
                                share: comp.share
                            }));
                            
                            // Оптимизация: не сохраняем name если он "Смесь" (дефолт)
                            // Оптимизация: не сохраняем boundaries, т.к. они вычисляются из share
                            const result = {
                                id: c.id,
                                components: components
                            };
                            
                            // Сохраняем name только если он отличается от "Смесь"
                            if (c.name && c.name !== 'Смесь') {
                                result.name = c.name;
                            }
                            
                            return result;
                        });
                    }
                    
                    result.colors = colorsData;
                }
                
                // ===== ЭКСПОРТ МАТРИЦЫ (ОПТИМИЗИРОВАННЫЙ - МАССИВ 13x13) =====
                const matrix = App.state.cellStorage[tableId];
                if (matrix) {
                    // Сохраняем матрицу как массив 13×13 (компактнее чем объект с ключами)
                    result.cells = matrix;
                }
            }
            
            if (node.childrenIds && node.childrenIds.length > 0) {
                result.children = node.childrenIds
                    .map(id => getNode(id))
                    .filter(n => n)
                    .map(child => serializeNode(child));
            } else {
                result.children = [];
            }
            
            return result;
        }
        
        const exportData = rootNodes.map(node => serializeNode(node));
        
        // Экспорт БЕЗ форматирования (компактный JSON)
        const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tree_export_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ===== ВАЛИДАЦИЯ СТРУКТУРЫ ИМПОРТИРУЕМОГО ДЕРЕВА =====
    function isValidTreeStructure(data) {
        if (!Array.isArray(data)) return false;
        if (data.length === 0) return false;

        const MAX_DEPTH = 50;
        const MAX_NODES = 5000;
        const VALID_TYPES = new Set(['folder', 'range', 'subrange']);
        let totalNodes = 0;

        function validateNode(node, depth) {
            if (depth > MAX_DEPTH) return false;
            totalNodes++;
            if (totalNodes > MAX_NODES) return false;

            // Проверяем, что узел — объект
            if (!node || typeof node !== 'object') return false;

            // name: обязательная строка
            if (typeof node.name !== 'string') return false;

            // type: обязательный, из допустимого набора
            if (!VALID_TYPES.has(node.type)) return false;

            // children: если есть — должен быть массивом
            if (node.children !== undefined) {
                if (!Array.isArray(node.children)) return false;
                for (const child of node.children) {
                    if (!validateNode(child, depth + 1)) return false;
                }
            }

            return true;
        }

        for (const root of data) {
            if (!validateNode(root, 1)) return false;
        }

        return true;
    }

    // ===== ИМПОРТ ДЕРЕВА С ЦВЕТАМИ И МАТРИЦЕЙ =====
    function importTree() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const data = JSON.parse(ev.target.result);
                    
                    if (!isValidTreeStructure(data)) {
                        App.modals.showFloatingModal('Неверный формат файла. Импорт отменён.');
                        return;
                    }

                    const oldNodesCount = App.state.nodes.length;
                    
                    function createNodeFromImport(importedNode, parentId) {
                        const newId = App.state.nextNodeId++;
                        const type = importedNode.type || 'folder';
                        
                        const newNode = {
    id: newId,
    name: importedNode.name || 'Без имени',
    parentId: parentId,
    childrenIds: [],
    type: type,
    selectedComponentIndex: importedNode.selectedComponentIndex !== undefined ? importedNode.selectedComponentIndex : null
};
                        App.state.nodes.push(newNode);
                        App.state.nodeIndex.set(newNode.id, newNode);
                        
                        if (parentId !== null) {
                            const parent = getNode(parentId);
                            if (parent) {
                                parent.childrenIds.push(newId);
                            }
                        }
                        
                        if (type === 'range' || type === 'subrange') {
                            // 1. СОЗДАЁМ ТАБЛИЦУ
                            App.grid.ensureTable(newId);
                            const tableId = getTableId(newId);
                            
                            // 2. ВОССТАНАВЛИВАЕМ ЦВЕТА
                            if (importedNode.colors) {
                                App.state.colorsPerNode[tableId] = [];
                                
                                const colorsData = importedNode.colors;
                                const simpleColors = colorsData.simple || [];
                                const multiColors = colorsData.multi || [];
                                
                                for (const sc of simpleColors) {
                                    let colorId = sc.id;
                                    if (App.state.colorsPerNode[tableId].some(c => c.id === colorId)) {
                                        colorId = App.state.nextColorId++;
                                    }
                                    App.state.colorsPerNode[tableId].push({
                                        id: colorId,
                                        name: sc.name || 'Без имени',
                                        color: sc.color || '#9C5479',
                                        type: 'simple'
                                    });
                                }
                                
                                for (const mc of multiColors) {
                                    let colorId = mc.id;
                                    if (App.state.colorsPerNode[tableId].some(c => c.id === colorId)) {
                                        colorId = App.state.nextColorId++;
                                    }
                                    
                                    const components = mc.components.map(comp => ({
                                        colorId: comp.colorId,
                                        share: comp.share || 0
                                    })).filter(comp => 
                                        App.state.colorsPerNode[tableId].some(c => c.id === comp.colorId && c.type === 'simple')
                                    );
                                    
                                    // Восстанавливаем boundaries из share при импорте (если не указаны)
                                    let boundaries = mc.boundaries;
                                    if (!boundaries || boundaries.length === 0) {
                                        boundaries = [];
                                        let sum = 0;
                                        for (const comp of components) {
                                            sum += comp.share;
                                            boundaries.push(sum);
                                        }
                                    }
                                    
                                    App.state.colorsPerNode[tableId].push({
                                        id: colorId,
                                        name: mc.name || 'Смесь',
                                        type: 'multi',
                                        components: components,
                                        boundaries: boundaries
                                    });
                                }
                                
                                if (simpleColors.length > 0) {
                                    const firstSimpleId = simpleColors[0].id;
                                    if (App.state.colorsPerNode[tableId].some(c => c.id === firstSimpleId)) {
                                        App.state.activePerNode[tableId] = firstSimpleId;
                                    }
                                } else if (multiColors.length > 0) {
                                    const firstMultiId = multiColors[0].id;
                                    if (App.state.colorsPerNode[tableId].some(c => c.id === firstMultiId)) {
                                        App.state.activePerNode[tableId] = firstMultiId;
                                    }
                                }
                            }
                            
                            // ===== 3. ВОССТАНАВЛИВАЕМ ЗАПОЛНЕННЫЕ ЯЧЕЙКИ (С ПОДДЕРЖКОЙ ОБОИХ ФОРМАТОВ) =====
                            if (importedNode.cells) {
                                const currentTableId = getTableId(newId);
                                const currentMatrix = App.state.cellStorage[currentTableId];
                                if (currentMatrix) {
                                    if (Array.isArray(importedNode.cells)) {
                                        // НОВЫЙ формат - массив 13×13
                                        for (let i = 0; i < 13; i++) {
                                            for (let j = 0; j < 13; j++) {
                                                if (importedNode.cells[i] && importedNode.cells[i][j] !== null && importedNode.cells[i][j] !== undefined) {
                                                    const colorId = importedNode.cells[i][j];
                                                    if (App.state.colorsPerNode[currentTableId].some(c => c.id === colorId)) {
                                                        currentMatrix[i][j] = colorId;
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        // СТАРЫЙ формат - объект {"0,0": 385, ...}
                                        for (const [key, colorId] of Object.entries(importedNode.cells)) {
                                            const [row, col] = key.split(',').map(Number);
                                            // Проверяем, что такой цвет существует в текущей таблице
                                            if (App.state.colorsPerNode[currentTableId].some(c => c.id === colorId)) {
                                                currentMatrix[row][col] = colorId;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (importedNode.children && Array.isArray(importedNode.children)) {
                            for (const child of importedNode.children) {
                                createNodeFromImport(child, newId);
                            }
                        }
                        
                        return newId;
                    }
                    
                    for (const rootNode of data) {
                        createNodeFromImport(rootNode, null);
                    }
                    
                    persistAll();
                    App.refresh.all();
                    
                    const importedCount = App.state.nodes.length - oldNodesCount;
                    App.modals.showFloatingModal(`✅ Импортировано ${importedCount} узлов с цветами и матрицей`);
                    
                } catch(err) {
                    App.modals.showFloatingModal('❌ Ошибка импорта: ' + err.message);
                    console.error(err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ===== СЕРИАЛИЗАЦИЯ УЗЛА GTO-ДЕРЕВА (аналогично serializeNode из exportTree,     =====
    // ===== но всегда читает из ветки App.gto, независимо от активного режима)       =====
    function serializeGtoNode(node) {
        const result = {
            name: node.name,
            type: node.type
        };

        if (node.type === 'subrange' && node.selectedComponentIndex !== undefined && node.selectedComponentIndex !== null) {
            result.selectedComponentIndex = node.selectedComponentIndex;
        }

        if (node.type === 'range' || node.type === 'subrange') {
            const tableId = getTableId(node.id);
            const colors = App.gto.colorsPerNode[tableId] || [];

            if (colors.length > 0) {
                const simpleColors = colors.filter(c => c.type === 'simple' || (!c.type && c.color));
                const multiColors = colors.filter(c => c.type === 'multi' || (c.components && c.components.length > 0));

                const colorsData = {};

                if (simpleColors.length > 0) {
                    colorsData.simple = simpleColors.map(c => ({
                        id: c.id,
                        name: c.name || 'Без имени',
                        color: c.color
                    }));
                }

                if (multiColors.length > 0) {
                    colorsData.multi = multiColors.map(c => {
                        const components = c.components.map(comp => ({
                            colorId: comp.colorId,
                            share: comp.share
                        }));
                        
                        // Оптимизация: не сохраняем name если он "Смесь" (дефолт)
                        // Оптимизация: не сохраняем boundaries, т.к. они вычисляются из share
                        const result = {
                            id: c.id,
                            components: components
                        };
                        
                        // Сохраняем name только если он отличается от "Смесь"
                        if (c.name && c.name !== 'Смесь') {
                            result.name = c.name;
                        }
                        
                        return result;
                    });
                }

                result.colors = colorsData;
            }

            const matrix = App.gto.cellStorage[tableId];
            if (matrix) {
                // Сохраняем матрицу как массив 13×13 (компактнее чем объект с ключами)
                result.cells = matrix;
            }
        }

        if (node.childrenIds && node.childrenIds.length > 0) {
            result.children = node.childrenIds
                .map(id => getNodeFrom(App.gto, id))
                .filter(n => n)
                .map(child => serializeGtoNode(child));
        } else {
            result.children = [];
        }

        return result;
    }

    // ===== СОЗДАНИЕ УЗЛА В РЕДАКТОРЕ ИЗ ДАННЫХ GTO (аналогично createNodeFromImport из =====
    // ===== importTree, но пишет всегда в ветку App.editor, а не в App.state)          =====
    function createEditorNodeFromData(importedNode, parentId) {
        const newId = App.editor.nextNodeId++;
        const type = importedNode.type || 'folder';

        const newNode = {
            id: newId,
            name: importedNode.name || 'Без имени',
            parentId: parentId,
            childrenIds: [],
            type: type,
            selectedComponentIndex: importedNode.selectedComponentIndex !== undefined ? importedNode.selectedComponentIndex : null
        };
        App.editor.nodes.push(newNode);
        App.editor.nodeIndex.set(newNode.id, newNode);

        if (parentId !== null) {
            const parent = getNodeFrom(App.editor, parentId);
            if (parent) {
                parent.childrenIds.push(newId);
            }
        }

        if (type === 'range' || type === 'subrange') {
            // 1. СОЗДАЁМ ТАБЛИЦУ
            const tableId = getTableId(newId);
            App.editor.cellStorage[tableId] = Array(13).fill().map(() => Array(13).fill(null));

            // 2. ВОССТАНАВЛИВАЕМ ЦВЕТА
            if (importedNode.colors) {
                App.editor.colorsPerNode[tableId] = [];

                const colorsData = importedNode.colors;
                const simpleColors = colorsData.simple || [];
                const multiColors = colorsData.multi || [];

                for (const sc of simpleColors) {
                    let colorId = sc.id;
                    if (App.editor.colorsPerNode[tableId].some(c => c.id === colorId)) {
                        colorId = App.editor.nextColorId++;
                    }
                    App.editor.colorsPerNode[tableId].push({
                        id: colorId,
                        name: sc.name || 'Без имени',
                        color: sc.color || '#9C5479',
                        type: 'simple'
                    });
                }

                for (const mc of multiColors) {
                    let colorId = mc.id;
                    if (App.editor.colorsPerNode[tableId].some(c => c.id === colorId)) {
                        colorId = App.editor.nextColorId++;
                    }

                    const components = (mc.components || []).map(comp => ({
                        colorId: comp.colorId,
                        share: comp.share || 0
                    })).filter(comp =>
                        App.editor.colorsPerNode[tableId].some(c => c.id === comp.colorId && c.type === 'simple')
                    );

                    // Восстанавливаем boundaries из share при импорте (если не указаны)
                    let boundaries = mc.boundaries;
                    if (!boundaries || boundaries.length === 0) {
                        boundaries = [];
                        let sum = 0;
                        for (const comp of components) {
                            sum += comp.share;
                            boundaries.push(sum);
                        }
                    }

                    App.editor.colorsPerNode[tableId].push({
                        id: colorId,
                        name: mc.name || 'Смесь',
                        type: 'multi',
                        components: components,
                        boundaries: boundaries
                    });
                }

                const simpleColorsFinal = App.editor.colorsPerNode[tableId].filter(c => c.type === 'simple');
                const multiColorsFinal = App.editor.colorsPerNode[tableId].filter(c => c.type === 'multi');
                if (simpleColorsFinal.length > 0) {
                    App.editor.activePerNode[tableId] = simpleColorsFinal[0].id;
                } else if (multiColorsFinal.length > 0) {
                    App.editor.activePerNode[tableId] = multiColorsFinal[0].id;
                }
            }

            // 3. ВОССТАНАВЛИВАЕМ ЗАПОЛНЕННЫЕ ЯЧЕЙКИ (С ПОДДЕРЖКОЙ ОБОИХ ФОРМАТОВ)
            if (importedNode.cells) {
                const currentMatrix = App.editor.cellStorage[tableId];
                if (currentMatrix) {
                    if (Array.isArray(importedNode.cells)) {
                        // НОВЫЙ формат - массив 13×13
                        for (let i = 0; i < 13; i++) {
                            for (let j = 0; j < 13; j++) {
                                if (importedNode.cells[i] && importedNode.cells[i][j] !== null && importedNode.cells[i][j] !== undefined) {
                                    const colorId = importedNode.cells[i][j];
                                    if (App.editor.colorsPerNode[tableId] && App.editor.colorsPerNode[tableId].some(c => c.id === colorId)) {
                                        currentMatrix[i][j] = colorId;
                                    }
                                }
                            }
                        }
                    } else {
                        // СТАРЫЙ формат - объект {"0,0": 385, ...}
                        for (const [key, colorId] of Object.entries(importedNode.cells)) {
                            const [row, col] = key.split(',').map(Number);
                            if (App.editor.colorsPerNode[tableId] && App.editor.colorsPerNode[tableId].some(c => c.id === colorId)) {
                                currentMatrix[row][col] = colorId;
                            }
                        }
                    }
                }
            }
        }

        if (importedNode.children && Array.isArray(importedNode.children)) {
            for (const child of importedNode.children) {
                createEditorNodeFromData(child, newId);
            }
        }

        return newId;
    }

    // ===== ДОБАВИТЬ ТЕКУЩЕЕ GTO-ДЕРЕВО В РЕДАКТОР =====
    async function addGtoTreeToEditor() {
        const rootNodes = App.gto.nodes.filter(n => n.parentId === null);

        if (rootNodes.length === 0) {
            console.warn('⚠️ Нет данных GTO для добавления');
            App.modals.showFloatingModal('Нет данных GTO для добавления');
            return;
        }

        const serialized = rootNodes.map(node => serializeGtoNode(node));

        const oldNodesCount = App.editor.nodes.length;
        
        for (const rootData of serialized) {
            createEditorNodeFromData(rootData, null);
        }
        
        const addedCount = App.editor.nodes.length - oldNodesCount;

        // Перенос изменяет структуру редактора и создаёт новые таблицы.
        // Явно отмечаем их dirty, иначе V2-сохранение не отправит данные на сервер.
        if (App.dirty) {
            App.dirty.markStructureDirty('editor');
            for (const node of App.editor.nodes.slice(oldNodesCount)) {
                if (node.type === 'range' || node.type === 'subrange') {
                    App.dirty.markTableDirty(node.id, 'editor');
                }
            }
        }

        App.refresh.all();

        // Перенос GTO должен сохранить не только структуру, но и все созданные
        // матрицы. Обычный persistAll() сохраняет по таймеру только структуру
        // (skipTables=true), поэтому после F5 таблицы могли быть пустыми.
        if (typeof flushPersist === 'function') {
            await flushPersist();
        } else {
            persistAll();
        }

        App.modals.showFloatingModal(`✅ Добавлено ${addedCount} узлов в редактор`);
    }

    function initGtoAddToEditorButton() {
        const btn = document.getElementById('gtoAddToEditorBtn');
        if (btn) {
            btn.addEventListener('click', addGtoTreeToEditor);
        }
    }

    // ===== НАБЛЮДЕНИЕ ЗА АКТИВНОЙ ВКЛАДКОЙ =====
    // Активная вкладка восстанавливается асинхронно после загрузки storage,
    // поэтому одного вызова на DOMContentLoaded недостаточно.
    const constructorPage = document.getElementById('constructorPage');
    if (constructorPage && typeof MutationObserver !== 'undefined') {
        const backupObserver = new MutationObserver(function() {
            createBackupButtons();
        });
        backupObserver.observe(constructorPage, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    mobileBackupQuery.addEventListener?.('change', createBackupButtons);

    // ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            setTimeout(createBackupButtons, 50);
        });
    });

    // ===== ЗАПУСК =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            createBackupButtons();
            initGtoAddToEditorButton();
            createBackupButtons();
        });
    } else {
        createBackupButtons();
        initGtoAddToEditorButton();
        createBackupButtons();
    }

})();