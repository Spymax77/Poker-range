// ===== backup-manager.js =====
(function() {

    let backupContainer = null;

    function createBackupButtons() {
        const tabs = document.querySelector('.tabs');
        if (!tabs) return;

        if (backupContainer) {
            backupContainer.remove();
            backupContainer = null;
        }

        const isConstructor = document.getElementById('constructorPage').classList.contains('active-page');
        if (!isConstructor) return;

        const container = document.createElement('div');
        container.style.marginLeft = 'auto';
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

        tabs.appendChild(container);
        backupContainer = container;

        document.getElementById('exportTreeBtn').addEventListener('click', exportTree);
        document.getElementById('importTreeBtn').addEventListener('click', importTree);
    }

    // ===== ЭКСПОРТ ДЕРЕВА С ЦВЕТАМИ И МАТРИЦЕЙ =====
    function exportTree() {
        const rootNodes = App.state.nodes.filter(n => n.parentId === null);
        
        if (rootNodes.length === 0) {
            showFloatingModal('Нет данных для экспорта');
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
                
                // ===== ЭКСПОРТ ЦВЕТОВ =====
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
                        colorsData.multi = multiColors.map(c => ({
                            id: c.id,
                            name: c.name || 'Смесь',
                            components: c.components.map(comp => ({
                                colorId: comp.colorId,
                                share: comp.share
                            })),
                            boundaries: c.boundaries || []
                        }));
                    }
                    
                    result.colors = colorsData;
                }
                
                // ===== ЭКСПОРТ МАТРИЦЫ (ЗАПОЛНЕННЫЕ ЯЧЕЙКИ) =====
                const matrix = App.state.cellStorage[tableId];
                if (matrix) {
                    const cells = {};
                    for (let i = 0; i < 13; i++) {
                        for (let j = 0; j < 13; j++) {
                            if (matrix[i][j] !== null) {
                                const key = i + ',' + j;
                                cells[key] = matrix[i][j];
                            }
                        }
                    }
                    if (Object.keys(cells).length > 0) {
                        result.cells = cells;
                    }
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
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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
                        showFloatingModal('Неверный формат файла. Импорт отменён.');
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
                            ensureTable(newId);
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
                                    
                                    App.state.colorsPerNode[tableId].push({
                                        id: colorId,
                                        name: mc.name || 'Смесь',
                                        type: 'multi',
                                        components: components,
                                        boundaries: mc.boundaries || []
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
                            
                            // ===== 3. ВОССТАНАВЛИВАЕМ ЗАПОЛНЕННЫЕ ЯЧЕЙКИ =====
                            if (importedNode.cells) {
                                const currentTableId = getTableId(newId);
                                const currentMatrix = App.state.cellStorage[currentTableId];
                                if (currentMatrix) {
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
                    refreshAll();
                    
                    const importedCount = App.state.nodes.length - oldNodesCount;
                    showFloatingModal(`✅ Импортировано ${importedCount} узлов с цветами и матрицей`);
                    
                } catch(err) {
                    showFloatingModal('❌ Ошибка импорта: ' + err.message);
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
                    colorsData.multi = multiColors.map(c => ({
                        id: c.id,
                        name: c.name || 'Смесь',
                        components: c.components.map(comp => ({
                            colorId: comp.colorId,
                            share: comp.share
                        })),
                        boundaries: c.boundaries || []
                    }));
                }

                result.colors = colorsData;
            }

            const matrix = App.gto.cellStorage[tableId];
            if (matrix) {
                const cells = {};
                for (let i = 0; i < 13; i++) {
                    for (let j = 0; j < 13; j++) {
                        if (matrix[i][j] !== null) {
                            cells[i + ',' + j] = matrix[i][j];
                        }
                    }
                }
                if (Object.keys(cells).length > 0) {
                    result.cells = cells;
                }
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

                    App.editor.colorsPerNode[tableId].push({
                        id: colorId,
                        name: mc.name || 'Смесь',
                        type: 'multi',
                        components: components,
                        boundaries: mc.boundaries || []
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

            // 3. ВОССТАНАВЛИВАЕМ ЗАПОЛНЕННЫЕ ЯЧЕЙКИ
            if (importedNode.cells) {
                const currentMatrix = App.editor.cellStorage[tableId];
                if (currentMatrix) {
                    for (const [key, colorId] of Object.entries(importedNode.cells)) {
                        const [row, col] = key.split(',').map(Number);
                        if (App.editor.colorsPerNode[tableId] && App.editor.colorsPerNode[tableId].some(c => c.id === colorId)) {
                            currentMatrix[row][col] = colorId;
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
    function addGtoTreeToEditor() {
        const rootNodes = App.gto.nodes.filter(n => n.parentId === null);

        if (rootNodes.length === 0) {
            showFloatingModal('Нет данных GTO для добавления');
            return;
        }

        const serialized = rootNodes.map(node => serializeGtoNode(node));

        const oldNodesCount = App.editor.nodes.length;
        for (const rootData of serialized) {
            createEditorNodeFromData(rootData, null);
        }
        const addedCount = App.editor.nodes.length - oldNodesCount;

        persistAll();
        refreshAll();

        showFloatingModal(`✅ Добавлено ${addedCount} узлов в редактор`);
    }

    function initGtoAddToEditorButton() {
        const btn = document.getElementById('gtoAddToEditorBtn');
        if (btn) {
            btn.addEventListener('click', addGtoTreeToEditor);
        }
    }

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
        });
    } else {
        createBackupButtons();
        initGtoAddToEditorButton();
    }

})();