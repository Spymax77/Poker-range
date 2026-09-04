// ============================================================
// gto-loader.js — ЗАГРУЗКА И УПРАВЛЕНИЕ GTO-ДИАПАЗОНАМИ
// ============================================================

// ===== СООТВЕТСТВИЕ ЗНАЧЕНИЙ ФИЛЬТРОВ ЧАСТЯМ ИМЕНИ ФАЙЛА =====
// Имя файла собирается как:
//   {GameType}-{TableSize}-{LIMIT}-{Stack}-NoCC-{Sizing}.json
// Пример: Cash-6Max-NL50-100bb-NoCC-3bb.json
// Чтобы добавить новое значение фильтра (например tableSize=9max),
// просто допишите соответствующую строку в нужный словарь ниже —
// имя файла для новой комбинации соберётся автоматически.
const GTO_FILENAME_PARTS = {
    gameType: { 'cash': 'Cash', 'mtt': 'MTT', 'spin': 'Spin' },
    tableSize: { '6max': '6Max', '9max': '9Max', 'hu': 'HU' },
    stack: { '100bb': '100bb', '200bb': '200bb' },
    sizing: { '2.25': '2.25bb', '2.5': '2.5bb', '3': '3bb' }
};

// ===== ЗНАЧЕНИЯ ФИЛЬТРОВ ПО УМОЛЧАНИЮ =====
const GTO_DEFAULT_FILTERS = {
    gameType: 'cash',
    tableSize: '6max',
    limit: 'nl25',
    stack: '100bb',
    sizing: '2.5'
};

// ===== ПОЛУЧИТЬ ТЕКУЩЕЕ ЗНАЧЕНИЕ ОДНОГО ФИЛЬТРА =====
function getFilterValue(filterName) {
    const activeOpt = document.querySelector(`.gto-filter-options[data-filter="${filterName}"] .opt.active`);
    return activeOpt?.dataset.value || GTO_DEFAULT_FILTERS[filterName];
}

// ===== ПОЛУЧИТЬ ВСЕ ТЕКУЩИЕ ЗНАЧЕНИЯ ФИЛЬТРОВ =====
function getCurrentGtoFilters() {
    return {
        gameType: getFilterValue('gameType'),
        tableSize: getFilterValue('tableSize'),
        limit: getFilterValue('limit'),
        stack: getFilterValue('stack'),
        sizing: getFilterValue('sizing')
    };
}

// ===== ПОЛУЧИТЬ ТЕКУЩИЙ ЛИМИТ ИЗ ФИЛЬТРОВ =====
function getCurrentLimit() {
    return getFilterValue('limit');
}

// ===== СОБРАТЬ ИМЯ ФАЙЛА ПО ТЕКУЩЕЙ КОМБИНАЦИИ ФИЛЬТРОВ =====
function buildGtoFileName(filters) {
    const gameTypePart = GTO_FILENAME_PARTS.gameType[filters.gameType];
    const tableSizePart = GTO_FILENAME_PARTS.tableSize[filters.tableSize];
    const stackPart = GTO_FILENAME_PARTS.stack[filters.stack];
    const sizingPart = GTO_FILENAME_PARTS.sizing[filters.sizing];
    const limitPart = filters.limit ? filters.limit.toUpperCase() : null;

    // Если для какого-то значения фильтра нет соответствия — файл не собрать
    if (!gameTypePart || !tableSizePart || !limitPart || !stackPart || !sizingPart) {
        return null;
    }

    return `${gameTypePart}-${tableSizePart}-${limitPart}-${stackPart}-NoCC-${sizingPart}.json`;
}

// ===== СПИСОК РЕАЛЬНО СУЩЕСТВУЮЩИХ JSON-ФАЙЛОВ В ПАПКЕ /GTO =====
// В проекте нет серверного листинга папки, поэтому список ведётся руками.
// Порядок записей важен: если точной комбинации фильтров нет, берётся
// ПЕРВАЯ подходящая по нужному фильтру запись (см. findFallbackEntry),
// поэтому записи сгруппированы по лимиту.
// Когда добавляете новый .json в /GTO — добавьте сюда соответствующую
// строку (значения те же, что в data-value кнопок фильтра).
const GTO_EXISTING_FILES = [
    { gameType: 'cash', tableSize: '6max', limit: 'nl25',  stack: '100bb', sizing: '2.25' },
    { gameType: 'cash', tableSize: '6max', limit: 'nl25',  stack: '100bb', sizing: '2.5' },
    { gameType: 'cash', tableSize: '6max', limit: 'nl25',  stack: '100bb', sizing: '3' },
	{ gameType: 'cash', tableSize: '6max', limit: 'nl50',  stack: '100bb', sizing: '2.25' },
    { gameType: 'cash', tableSize: '6max', limit: 'nl50',  stack: '100bb', sizing: '2.5' },
    { gameType: 'cash', tableSize: '6max', limit: 'nl50',  stack: '100bb', sizing: '3' },
    { gameType: 'cash', tableSize: '6max', limit: 'nl100', stack: '100bb', sizing: '2.5' },
    { gameType: 'cash', tableSize: '6max', limit: 'nl100', stack: '100bb', sizing: '3' }
];

// ===== НАЙТИ ТОЧНОЕ СОВПАДЕНИЕ КОМБИНАЦИИ ФИЛЬТРОВ В МАНИФЕСТЕ =====
function findManifestEntry(filters) {
    return GTO_EXISTING_FILES.find(e =>
        e.gameType === filters.gameType &&
        e.tableSize === filters.tableSize &&
        e.limit === filters.limit &&
        e.stack === filters.stack &&
        e.sizing === filters.sizing
    ) || null;
}

// ===== НАЙТИ ПЕРВУЮ СУЩЕСТВУЮЩУЮ КОМБИНАЦИЮ С НУЖНЫМ ЗНАЧЕНИЕМ ОДНОГО ФИЛЬТРА =====
// Используется, когда точной комбинации нет: игнорируем остальные текущие
// фильтры и ищем любую запись, где filterName === value.
function findFallbackEntry(filterName, value) {
    return GTO_EXISTING_FILES.find(e => e[filterName] === value) || null;
}

// ===== УСТАНОВИТЬ АКТИВНЫЕ КНОПКИ ФИЛЬТРОВ ПО ЗАПИСИ МАНИФЕСТА =====
function setActiveFiltersFromEntry(entry) {
    Object.keys(entry).forEach(filterName => {
        const group = document.querySelector(`.gto-filter-options[data-filter="${filterName}"]`);
        if (!group) return;
        const target = group.querySelector(`.opt[data-value="${entry[filterName]}"]`);
        if (!target) return;
        group.querySelectorAll('.opt').forEach(o => o.classList.remove('active'));
        target.classList.add('active');
    });
}

// ===== ПОЛУЧИТЬ ПОДПИСЬ ФИЛЬТРА (ДЛЯ СООБЩЕНИЙ) =====
function getFilterLabel(filterName) {
    const label = document.querySelector(`.gto-filter-options[data-filter="${filterName}"]`)
        ?.closest('.gto-filter-item')
        ?.querySelector('.gto-filter-label');
    return label ? label.textContent.trim() : filterName;
}

// ===== ОБНОВИТЬ ПОДСВЕТКУ ВСЕХ КНОПОК ФИЛЬТРА =====
// Золотой (класс .active, цвет задан в CSS) — то, что сейчас загружено.
// Белый (без доп. класса) — комбинация с этим значением и текущими
// остальными фильтрами существует, но сейчас не загружена.
// Малозаметный (.unavailable) — такой комбинации нет совсем.
function updateGtoFilterColors() {
    const currentFilters = getCurrentGtoFilters();
    document.querySelectorAll('.gto-filter-options').forEach(group => {
        const filterName = group.dataset.filter;
        group.querySelectorAll('.opt').forEach(opt => {
            opt.classList.remove('unavailable');
            if (opt.classList.contains('active')) return;
            const hypothetical = Object.assign({}, currentFilters, { [filterName]: opt.dataset.value });
            if (!findManifestEntry(hypothetical)) {
                opt.classList.add('unavailable');
            }
        });
    });
}


// ===== КОНВЕРТЕР: ВЛОЖЕННОЕ ДЕРЕВО JSON → ПЛОСКИЙ ФОРМАТ =====
function convertGtoJson(jsonArray) {
    const nodes = [];
    const cellStorage = {};
    const colorsPerNode = {};
    const activePerNode = {};
    let nextNodeId = App.gto.nextNodeId || 1;
    let nextColorId = App.gto.nextColorId || 1;

    function processItem(item, parentId) {
        const nodeId = nextNodeId++;
        const tableId = getTableId(nodeId);

        // === Рекурсивно обрабатываем детей ===
        const childrenIds = [];
        if (item.children && item.children.length > 0) {
            for (const child of item.children) {
                childrenIds.push(processItem(child, nodeId));
            }
        }

                  // === Плоский узел ===
        const nodeObj = {
            id: nodeId,
            name: item.name,
            type: item.type, // 'folder' или 'range'
            parentId: parentId !== undefined ? parentId : null,
            childrenIds: childrenIds
        };
        
        // ===== СОХРАНЯЕМ ВЫБРАННЫЙ ЦВЕТ ДЛЯ ПОДДИАПАЗОНОВ =====
        if (item.type === 'subrange' && item.selectedComponentIndex !== undefined) {
            nodeObj.selectedComponentIndex = item.selectedComponentIndex;
        }
        
        nodes.push(nodeObj);

        // === Диапазон: таблица + цвета ===
        if (item.type === 'range' || item.type === 'subrange') {
            // Карта старых ID цветов → новые ID
            const colorIdMap = {};
            const colorList = [];

            // Простые цвета
            if (item.colors && item.colors.simple) {
                for (const sc of item.colors.simple) {
                    const newId = nextColorId++;
                    colorIdMap[sc.id] = newId;
                    colorList.push({
                        id: newId,
                        name: sc.name,
                        color: sc.color,
                        type: 'simple'
                    });
                }
            }

            // Мультицвета (ссылаются на простые через colorIdMap)
            if (item.colors && item.colors.multi) {
                for (const mc of item.colors.multi) {
                    const newId = nextColorId++;
                    colorIdMap[mc.id] = newId;  // ← регистрируем мультицвет в карте
                    const mappedComponents = (mc.components || []).map(comp => ({
                        colorId: colorIdMap[comp.colorId] || comp.colorId,
                        share: comp.share
                    }));
                    colorList.push({
                        id: newId,
                        name: mc.name,
                        type: 'multi',
                        components: mappedComponents,
                        boundaries: mc.boundaries || []
                    });
                }
            }

            // Таблица 13×13 из cells {"row,col": oldColorId}
            const matrix = Array(13).fill().map(() => Array(13).fill(null));
            if (item.cells) {
                for (const [key, oldColorId] of Object.entries(item.cells)) {
                    const [r, c] = key.split(',').map(Number);
                    if (r >= 0 && r < 13 && c >= 0 && c < 13) {
                        matrix[r][c] = colorIdMap[oldColorId] !== undefined
                            ? colorIdMap[oldColorId]
                            : oldColorId;
                    }
                }
            }
            cellStorage[tableId] = matrix;
            colorsPerNode[tableId] = colorList;

            // Первый простой цвет делаем активным
            const firstSimple = colorList.find(c => c.type === 'simple');
            if (firstSimple) {
                activePerNode[tableId] = firstSimple.id;
            }
        }

        return nodeId;
    }

    // Обрабатываем все корневые элементы
    for (const rootItem of jsonArray) {
        processItem(rootItem, null);
    }

    // Обновляем счётчики
    App.gto.nextNodeId = nextNodeId;
    App.gto.nextColorId = nextColorId;

    return { nodes, cellStorage, colorsPerNode, activePerNode };
}

function getGtoAssetUrls(fileName) {
    const candidates = [
        `./GTO/${encodeURI(fileName)}`,
        `./gto/${encodeURI(fileName)}`,
        `/GTO/${encodeURI(fileName)}`,
        `/gto/${encodeURI(fileName)}`
    ];
    return [...new Set(candidates)];
}

function cloneGtoStateSnapshot() {
    return {
        nodes: JSON.parse(JSON.stringify(App.gto.nodes || [])),
        cellStorage: JSON.parse(JSON.stringify(App.gto.cellStorage || {})),
        colorsPerNode: JSON.parse(JSON.stringify(App.gto.colorsPerNode || {})),
        activePerNode: JSON.parse(JSON.stringify(App.gto.activePerNode || {})),
        commentsPerNode: JSON.parse(JSON.stringify(App.gto.commentsPerNode || {})),
        expandedNodes: new Set(App.gto.expandedNodes || []),
        currentNodeId: App.gto.currentNodeId,
        nextNodeId: App.gto.nextNodeId,
        nextColorId: App.gto.nextColorId
    };
}

function restoreGtoStateSnapshot(snapshot) {
    if (!snapshot) return;
    App.gto.nodes = JSON.parse(JSON.stringify(snapshot.nodes || []));
    App.gto.cellStorage = JSON.parse(JSON.stringify(snapshot.cellStorage || {}));
    App.gto.colorsPerNode = JSON.parse(JSON.stringify(snapshot.colorsPerNode || {}));
    App.gto.activePerNode = JSON.parse(JSON.stringify(snapshot.activePerNode || {}));
    App.gto.commentsPerNode = JSON.parse(JSON.stringify(snapshot.commentsPerNode || {}));
    App.gto.expandedNodes = new Set(snapshot.expandedNodes || []);
    App.gto.currentNodeId = snapshot.currentNodeId;
    App.gto.nextNodeId = snapshot.nextNodeId;
    App.gto.nextColorId = snapshot.nextColorId;
    if (App.gto.nodes && App.gto.nodes.length) {
        rebuildNodeIndexFor(App.gto);
    }
}

// ===== ЗАГРУЗИТЬ ДАННЫЕ ИЗ JSON =====
// onSuccess вызывается только после успешной загрузки и рендера —
// используется, чтобы переключать активную кнопку фильтра лишь тогда,
// когда решение реально доступно.
function loadGtoData(fileName, onSuccess) {
    if (!fileName) {
        console.warn('⚠️ Имя файла не указано');
        return Promise.reject(new Error('Имя файла не указано'));
    }

    const snapshot = cloneGtoStateSnapshot();
    const assetUrls = getGtoAssetUrls(fileName);
    console.log('📂 Загружаем GTO:', fileName, assetUrls);

    async function fetchWithFallback() {
        let lastError = null;
        for (const url of assetUrls) {
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) {
                    lastError = new Error(`Файл ${fileName} не найден (${res.status}) по адресу ${url}`);
                    continue;
                }
                return await res.json();
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error(`Файл ${fileName} не найден`);
    }

    return fetchWithFallback()
        .then(data => {
            App.gto.nodes = [];
            App.gto.cellStorage = {};
            App.gto.colorsPerNode = {};
            App.gto.activePerNode = {};
            App.gto.expandedNodes = new Set();
            App.gto.commentsPerNode = {};
            App.gto.nextNodeId = 1;
            App.gto.nextColorId = 1;

            const converted = convertGtoJson(Array.isArray(data) ? data : [data]);
            App.gto.nodes = converted.nodes;
            App.gto.cellStorage = converted.cellStorage;
            App.gto.colorsPerNode = converted.colorsPerNode;
            App.gto.activePerNode = converted.activePerNode;

            rebuildNodeIndexFor(App.gto);

            const firstRange = App.gto.nodes.find(n => n.type === 'range');
            App.gto.currentNodeId = firstRange ? firstRange.id : null;

            App.gto.expandedNodes = new Set();
            if (firstRange) {
                const rootFolder = App.gto.nodes.find(n => n.parentId === null && n.type === 'folder');
                if (rootFolder) {
                    App.gto.expandedNodes.add(rootFolder.id);
                }
                let currentId = firstRange.id;
                while (currentId !== null) {
                    const node = getNodeFrom(App.gto, currentId);
                    if (!node || node.parentId === null) break;
                    const parent = getNodeFrom(App.gto, node.parentId);
                    if (parent && parent.type === 'folder') {
                       App.gto.expandedNodes.add(parent.id);
                    }
                    currentId = node.parentId;
                }
            }

            persistAll();
            renderGtoPage();
            animateGtoFade();

            const gtoTree = document.getElementById('gtoTree');
            if (gtoTree) {
                gtoTree.classList.remove('matrix-fade');
                void gtoTree.offsetWidth;
                gtoTree.classList.add('matrix-fade');
            }

            console.log(`✅ Загружен: ${fileName} (узлов: ${App.gto.nodes.length})`);

            if (typeof onSuccess === 'function') {
                onSuccess();
            }

            return true;
        })
        .catch(err => {
            console.error('❌ Ошибка загрузки GTO:', err);
            restoreGtoStateSnapshot(snapshot);
            showFloatingModal('В данный момент такое решение GTO недоступно');
            return false;
        });
}

// ===== ЗАГРУЗИТЬ ПО ТЕКУЩИМ ФИЛЬТРАМ С FALLBACK =====
// overrides — необязательный объект { filterName: value } для проверки
// гипотетической комбинации фильтров без предварительного переключения
// активного класса в DOM (используется при клике на опцию фильтра).
//
// FALLBACK-ЛОГИКА:
// 1. Проверяем, существует ли точная комбинация фильтров в манифесте.
// 2. Если нет — ищем первую существующую запись с таким же значением
//    изменённого фильтра (игнорируя остальные), переключаем на неё все
//    фильтры и загружаем её.
// 3. Если и такой нет — показываем сообщение.
function loadGtoByFilters(overrides, onSuccess) {
    const filters = getCurrentGtoFilters();
    if (overrides) {
        Object.assign(filters, overrides);
    }

    // Проверяем, существует ли точная комбинация
    let entry = findManifestEntry(filters);

    if (!entry) {
        // Точной комбинации нет.
        // Если функция вызвана из клика по фильтру (overrides задан) — ищем
        // fallback именно по изменённому значению; если для него вообще нет
        // ни одного файла — сообщаем пользователю и выходим.
        // Если overrides не задан (первичная загрузка / восстановленные из
        // localStorage фильтры, файл которых мог быть удалён) — подбираем
        // любую существующую комбинацию с тем же лимитом, без сообщения об
        // ошибке, а если и такой нет — берём первую запись манифеста.
        const changedFilterName = overrides ? Object.keys(overrides)[0] : 'limit';
        const changedValue = overrides ? overrides[changedFilterName] : filters.limit;
        entry = findFallbackEntry(changedFilterName, changedValue);

        if (!entry) {
            if (overrides) {
                // Ни точной комбинации, ни fallback не найдено — показываем сообщение.
                const label = getFilterLabel(changedFilterName);
                const optText = document.querySelector(`.gto-filter-options[data-filter="${changedFilterName}"] .opt[data-value="${changedValue}"]`)?.textContent.trim() || changedValue;
                showFloatingModal(`Решений для ${label} «${optText}» не найдено`);
                return;
            }
            // Совсем ничего не подошло (например, восстановленный лимит больше
            // не существует) — берём первую существующую запись манифеста.
            entry = GTO_EXISTING_FILES[0];
        }

        if (!entry) {
            showFloatingModal('В данный момент такое решение GTO недоступно');
            return;
        }

        // Нашли fallback — переключаем все активные кнопки на комбинацию
        // из манифеста и загружаем её (без рекурсии — она реально существует).
        console.log(`⚠️ Точной комбинации нет, загружаем fallback: ${getFilterLabel(changedFilterName)} ${changedValue}`);
        setActiveFiltersFromEntry(entry);
        const fallbackFileName = buildGtoFileName(entry);
        if (fallbackFileName) {
            loadGtoData(fallbackFileName, () => {
                saveGtoFilters();
                updateGtoFilterColors();
                if (onSuccess) onSuccess();
            });
        }
        return;
    }

    // Точная комбинация существует — собираем имя файла и загружаем.
    const fileName = buildGtoFileName(filters);
    if (!fileName) {
        showFloatingModal('В данный момент такое решение GTO недоступно');
        return;
    }

    loadGtoData(fileName, () => {
        updateGtoFilterColors();
        if (onSuccess) onSuccess();
    });
}

// ===== ЗАГРУЗИТЬ ПО УМОЛЧАНИЮ (NL25) =====
function loadDefaultGto() {
    // Пробуем восстановить сохранённые фильтры
    const restored = restoreGtoFilters();
    
    if (!restored) {
    // Устанавливаем NL25 активным в фильтре
    const nl25Opt = document.querySelector('.gto-filter-options[data-filter="limit"] .opt[data-value="nl25"]');
    if (nl25Opt) {
        const parent = nl25Opt.closest('.gto-filter-options');
        parent.querySelectorAll('.opt').forEach(o => o.classList.remove('active'));
        nl25Opt.classList.add('active');
        }
    }
    
    loadGtoByFilters();
    updateGtoFilterColors();
}

// ===== СОХРАНИТЬ ФИЛЬТРЫ В LOCALSTORAGE =====
function saveGtoFilters() {
    const filters = {};
    document.querySelectorAll('.gto-filter-options').forEach(group => {
        const active = group.querySelector('.opt.active');
        if (active) {
            filters[group.dataset.filter] = active.dataset.value;
        }
    });
    App.storage.save('gto_filters', filters);
}

// ===== ВОССТАНОВИТЬ ФИЛЬТРЫ ИЗ LOCALSTORAGE =====
function restoreGtoFilters() {
    const raw = App.storage.loadRaw('gto_filters');
    if (!raw) return false;
    try {
        const filters = JSON.parse(raw);
        for (const [filterName, value] of Object.entries(filters)) {
            const group = document.querySelector(`.gto-filter-options[data-filter="${filterName}"]`);
            if (!group) continue;
            const target = group.querySelector(`.opt[data-value="${value}"]`);
            if (!target) continue;
            group.querySelectorAll('.opt').forEach(o => o.classList.remove('active'));
            target.classList.add('active');
        }
        return true;
    } catch(e) {
        console.warn('Ошибка восстановления фильтров GTO:', e);
        return false;
    }
}

// ===== ОБРАБОТЧИКИ ФИЛЬТРОВ =====
function initGtoFilters() {
    // Список разрешённых значений для каждого фильтра.
    // Дисциплина, Стол и Стек пока заблокированы — файлов для других
    // значений ещё нет. Когда они появятся, просто добавьте значение
    // сюда и соответствующую запись в GTO_FILENAME_PARTS выше.
    const ALLOWED_FILTERS = {
        'gameType': ['cash'],
        'tableSize': ['6max'],
        'limit': ['nl25', 'nl50', 'nl100'],
        'stack': ['100bb'],
        'sizing': ['2.25', '2.5', '3']
    };

    function isFilterAllowed(filter, value) {
        return ALLOWED_FILTERS[filter]?.includes(value) || false;
    }

    document.querySelectorAll('.gto-filter-options .opt').forEach(opt => {
        opt.addEventListener('click', function(e) {
            const clickedOpt = this;
            const parent = clickedOpt.closest('.gto-filter-options');
            const filter = parent.dataset.filter;
            const value = clickedOpt.dataset.value;

            // Если кнопка не в разрешённом списке — блокируем клик
            if (!isFilterAllowed(filter, value)) {
                e.stopPropagation();
                e.preventDefault();
                return false;
            }

            // Уже активна — ничего делать не нужно
            if (clickedOpt.classList.contains('active')) {
                return;
            }

            // Пробуем загрузить решение для гипотетической комбинации фильтров
            // (текущие + изменённый), НЕ переключая активный класс заранее.
            // Активную кнопку переключаем только в случае успешной загрузки —
            // иначе, если решение недоступно, фильтр останется на том значении,
            // которое соответствует реально загруженному дереву.
            loadGtoByFilters({ [filter]: value }, function() {
                parent.querySelectorAll('.opt').forEach(o => o.classList.remove('active'));
                clickedOpt.classList.add('active');
                saveGtoFilters();
                updateGtoFilterColors();
            });
        });
    });

    // Устанавливаем начальную подсветку кнопок
    updateGtoFilterColors();
}

// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
const originalSwitchTab = window.switchTab;
window.switchTab = function(page) {
    // Вызываем оригинальную функцию (она уже делает loadDefaultGto + renderGtoPage)
    if (originalSwitchTab) {
        originalSwitchTab(page);
    }
    // Дополнительная логика не нужна — всё уже в оригинальном switchTab
};

// ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ =====
document.addEventListener('DOMContentLoaded', function() {
    initGtoFilters();
    
    // Пробуем восстановить сохранённые фильтры из localStorage
    const restored = restoreGtoFilters();
    
    // Если фильтры не были восстановлены (первый запуск), устанавливаем NL25 по умолчанию
    if (!restored) {
        const nl25Opt = document.querySelector('.gto-filter-options[data-filter="limit"] .opt[data-value="nl25"]');
        if (nl25Opt) {
            const parent = nl25Opt.closest('.gto-filter-options');
            parent.querySelectorAll('.opt').forEach(o => o.classList.remove('active'));
            nl25Opt.classList.add('active');
        }
    }
    
    // Если GTO-дерево уже восстановлено из localStorage (loadFromStorage в init.js
    // выполняется раньше этого события) — не перезатираем сохранённый currentNodeId
    // и expandedNodes повторной загрузкой JSON. Загружаем данные только если
    // GTO-ветка действительно пуста (первый визит / очищенное хранилище).
    if (!App.gto.nodes || App.gto.nodes.length === 0) {
        loadGtoByFilters();
    } else {
        // Дерево уже загружено — обновляем цветовую индикацию кнопок
        updateGtoFilterColors();
    }
});