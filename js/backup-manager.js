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
        const rootNodes = nodes.filter(n => n.parentId === null);
        
        if (rootNodes.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }

        function serializeNode(node) {
            const result = {
                name: node.name,
                type: node.type
            };
            
            if (node.type === 'range' || node.type === 'subrange') {
                const tableId = getTableId(node.id);
                const colors = colorsPerNode[tableId] || [];
                
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
                const matrix = cellStorage[tableId];
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
                    .map(id => nodes.find(n => n.id === id))
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
                    
                    if (!Array.isArray(data) || data.length === 0) {
                        throw new Error('Неверный формат: ожидается массив корневых узлов');
                    }

                    const oldNodesCount = nodes.length;
                    
                    function createNodeFromImport(importedNode, parentId) {
                        const newId = nextNodeId++;
                        const type = importedNode.type || 'folder';
                        
                        const newNode = {
                            id: newId,
                            name: importedNode.name || 'Без имени',
                            parentId: parentId,
                            childrenIds: [],
                            type: type
                        };
                        nodes.push(newNode);
                        
                        if (parentId !== null) {
                            const parent = nodes.find(n => n.id === parentId);
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
                                colorsPerNode[tableId] = [];
                                
                                const colorsData = importedNode.colors;
                                const simpleColors = colorsData.simple || [];
                                const multiColors = colorsData.multi || [];
                                
                                for (const sc of simpleColors) {
                                    let colorId = sc.id;
                                    if (colorsPerNode[tableId].some(c => c.id === colorId)) {
                                        colorId = nextColorId++;
                                    }
                                    colorsPerNode[tableId].push({
                                        id: colorId,
                                        name: sc.name || 'Без имени',
                                        color: sc.color || '#9C5479',
                                        type: 'simple'
                                    });
                                }
                                
                                for (const mc of multiColors) {
                                    let colorId = mc.id;
                                    if (colorsPerNode[tableId].some(c => c.id === colorId)) {
                                        colorId = nextColorId++;
                                    }
                                    
                                    const components = mc.components.map(comp => ({
                                        colorId: comp.colorId,
                                        share: comp.share || 0
                                    })).filter(comp => 
                                        colorsPerNode[tableId].some(c => c.id === comp.colorId && c.type === 'simple')
                                    );
                                    
                                    colorsPerNode[tableId].push({
                                        id: colorId,
                                        name: mc.name || 'Смесь',
                                        type: 'multi',
                                        components: components,
                                        boundaries: mc.boundaries || []
                                    });
                                }
                                
                                if (simpleColors.length > 0) {
                                    const firstSimpleId = simpleColors[0].id;
                                    if (colorsPerNode[tableId].some(c => c.id === firstSimpleId)) {
                                        activePerNode[tableId] = firstSimpleId;
                                    }
                                } else if (multiColors.length > 0) {
                                    const firstMultiId = multiColors[0].id;
                                    if (colorsPerNode[tableId].some(c => c.id === firstMultiId)) {
                                        activePerNode[tableId] = firstMultiId;
                                    }
                                }
                            }
                            
                            // ===== 3. ВОССТАНАВЛИВАЕМ ЗАПОЛНЕННЫЕ ЯЧЕЙКИ =====
                            if (importedNode.cells) {
                                const currentTableId = getTableId(newId);
                                const currentMatrix = cellStorage[currentTableId];
                                if (currentMatrix) {
                                    for (const [key, colorId] of Object.entries(importedNode.cells)) {
                                        const [row, col] = key.split(',').map(Number);
                                        // Проверяем, что такой цвет существует в текущей таблице
                                        if (colorsPerNode[currentTableId].some(c => c.id === colorId)) {
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
                    
                    const importedCount = nodes.length - oldNodesCount;
                    alert(`✅ Импортировано ${importedCount} узлов с цветами и матрицей`);
                    
                } catch(err) {
                    alert('❌ Ошибка импорта: ' + err.message);
                    console.error(err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            setTimeout(createBackupButtons, 50);
        });
    });

    // ===== ЗАПУСК =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBackupButtons);
    } else {
        createBackupButtons();
    }

})();