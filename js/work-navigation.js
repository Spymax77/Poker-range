// ===== work-navigation.js — просмотр диапазонов (раздел "Работа") =====

App.work = App.work || {};

App.work.findFirstRange = function(nodeId) {
    let node = getNode(nodeId);
    if (!node) return null;
    if (node.type === 'range' || node.type === 'subrange') return node.id;
    for (let childId of node.childrenIds) {
        let result = App.work.findFirstRange(childId);
        if (result !== null) return result;
    }
    return null;
}

// Проверяет, входит ли узел nodeId в цепочку предков текущего отображаемого
// диапазона (включая сам узел). Нужно, чтобы подсвечивать все родительские
// кнопки пути (1-й, 2-й, 3-й уровень и т.д.).
App.work.isNodeInPath = function(nodeId) {
    if (App.state.workDisplayNodeId === nodeId) return true;
    let cur = getNode(App.state.workDisplayNodeId);
    if (!cur) return false;
    let p = cur.parentId;
    while (p !== null) {
        if (p === nodeId) return true;
        const parentNode = getNode(p);
        p = parentNode ? parentNode.parentId : null;
    }
    return false;
}

App.work.renderNavigation = function() {
    const container = document.getElementById("workLevelsContainer");
    if (!container) return;
    container.innerHTML = "";

    for (let li = 0; li < App.state.workLevels.length; li++) {
        const level = App.state.workLevels[li];
        const parentId = level.parentNodeId;
        let children = [];

        if (parentId === null) {
            children = App.state.nodes.filter(n => n.parentId === null);
            let rootOrder = App.state.nodes.filter(n => n.parentId === null).map(n => n.id);
            children.sort((a, b) => rootOrder.indexOf(a.id) - rootOrder.indexOf(b.id));
        } else {
            let parent = getNode(parentId);
            if (parent) {
                children = parent.childrenIds.map(cid => getNode(cid)).filter(n => n);
                children.sort((a, b) => parent.childrenIds.indexOf(a.id) - parent.childrenIds.indexOf(b.id));
            }
        }

        if (children.length === 0) continue;

        const levelDiv = document.createElement("div");
        levelDiv.className = "work-level";
        levelDiv.style.display = "flex";
        levelDiv.style.flexWrap = "wrap";
        levelDiv.style.gap = "8px";

        for (let child of children) {
            if (child.type === 'folder') {
                let parent = getNode(child.parentId);
                let parentIsRange = parent && parent.type === 'range';
                let parentIsSelectedRange = parentIsRange && App.state.workLevels.some(l => l.parentNodeId === child.parentId);

                if (!parentIsSelectedRange) {
                    const btn = document.createElement("button");
                    btn.className = "folder-btn folder-btn-" + child.id;
                    btn.innerText = child.name;
					btn.style.border = '2px solid #3d3d3d';
                    btn.style.color = '#a9afb5';
					// === ЗАГРУЖАЕМ СОХРАНЁННЫЙ СТИЛЬ ===
const saved = App.styles.loadButtonStyle(child.id);
if (saved) {
    if (saved.bg) {
        btn.style.background = saved.bg;
        btn.style.borderColor = saved.border || saved.bg;
    }
    if (saved.text) {
        btn.style.color = saved.text;
    }
}
					
                    btn.onclick = (function(c, idx) {
    return function() {
        App.state.workLevels = App.state.workLevels.slice(0, idx + 1);
        App.state.workLevels.push({ parentNodeId: c.id, levelIndex: idx + 1 });
        
        // Находим первый диапазон внутри папки
        let firstRange = App.work.findFirstRange(c.id);
        if (firstRange !== null) {
            App.state.workDisplayNodeId = firstRange;
        }
        
        if (App.dirty) App.dirty.markMetadataDirty('editor');
        persistAll();
        App.work.updateDisplay();
    };
})(child, li);
// === ЗОЛОТАЯ КАПЛЯ ДЛЯ ПАПКИ ===
const dot = document.createElement('span');
dot.className = 'edit-dot';
dot.innerHTML = `
    <svg viewBox="-5 -1.5 24 24">
        <path d="M7 .565c4.667 6.09 7 10.423 7 13a7 7 0 1 1-14 0c0-2.577 2.333-6.91 7-13z" />
    </svg>
`;
dot.addEventListener('click', function(e) {
    e.stopPropagation();
    const container = document.getElementById('workLevelsContainer');
    if (!container || !container.classList.contains('style-edit-mode')) return;
    App.styles.showPopup(btn);
});
btn.appendChild(dot);

                  const lastLevel = App.state.workLevels[App.state.workLevels.length - 1];
const isActiveFolder = lastLevel && lastLevel.parentNodeId === child.id;

// Проверяем, находится ли активный диапазон внутри этой папки
let isRangeInsideFolder = false;
if (App.state.workDisplayNodeId) {
    const activeRange = getNode(App.state.workDisplayNodeId);
    if (activeRange) {
        let parent = activeRange.parentId;
        while (parent !== null) {
            if (parent === child.id) {
                isRangeInsideFolder = true;
                break;
            }
            const parentNode = getNode(parent);
            parent = parentNode ? parentNode.parentId : null;
        }
    }
}

if (isActiveFolder || isRangeInsideFolder) {
    btn.classList.add("active");
} else {
    btn.classList.remove("active");
}
                    levelDiv.appendChild(btn);
                }
            } else if (child.type === 'range' || child.type === 'subrange') {
                let parent = getNode(child.parentId);
                let parentIsRange = parent && parent.type === 'range';
                let parentIsSelectedRange = parentIsRange && App.state.workLevels.some(l => l.parentNodeId === child.parentId);
                let isRoot = child.parentId === null;

                    if (isRoot || !parentIsSelectedRange || child.type === 'subrange') {
                    const link = document.createElement("span");
                    link.className = "range-link range-link-" + child.id;
                    link.innerText = child.name;
					const saved = App.styles.loadButtonStyle(child.id);
if (saved && saved.text) {
    link.style.color = saved.text;
}
                    if (App.work.isNodeInPath(child.id)) {
                        link.classList.add("active");
                    } else {
                        link.classList.remove("active");
                    }
                    link.onclick = (function(c) {
                        return function() {
                            App.state.workDisplayNodeId = c.id;
                            let path = [];
                            let current = c;
                            while (current && current.parentId !== null) {
                                let parentNode = getNode(current.parentId);
                                if (parentNode) {
                                    path.unshift(parentNode);
                                    current = parentNode;
                                } else {
                                    current = null;
                                }
                            }
                            App.state.workLevels = [{ parentNodeId: null, levelIndex: 0 }];
                            for (let p of path) {
                                App.state.workLevels.push({ parentNodeId: p.id, levelIndex: App.state.workLevels.length });
                            }
                            App.state.workLevels.push({ parentNodeId: c.id, levelIndex: App.state.workLevels.length });
                            if (App.dirty) App.dirty.markMetadataDirty('editor');
                            persistAll();
                            App.work.updateDisplay();
                            App.work.updateGrid();
                        };
                    })(child);
// === ЗОЛОТАЯ КАПЛЯ ДЛЯ ДИАПАЗОНА ===
const dotLink = document.createElement('span');
dotLink.className = 'edit-dot';
dotLink.innerHTML = `
    <svg viewBox="-5 -1.5 24 24">
        <path d="M7 .565c4.667 6.09 7 10.423 7 13a7 7 0 1 1-14 0c0-2.577 2.333-6.91 7-13z" />
    </svg>
`;
dotLink.addEventListener('click', function(e) {
    e.stopPropagation();
    const container = document.getElementById('workLevelsContainer');
    if (!container || !container.classList.contains('style-edit-mode')) return;
    App.styles.showPopup(link);
});
link.appendChild(dotLink);
                    levelDiv.appendChild(link);
                }
            }
        }

        container.appendChild(levelDiv);

        if (li === 0) {
            let sel = getNode(App.state.workDisplayNodeId);
            let rangeNode = sel;
            if (sel && sel.type === 'subrange') {
                rangeNode = getNode(sel.parentId);
            }
            if (rangeNode && rangeNode.type === 'range' && rangeNode.parentId === null) {
                let isInLevels = App.state.workLevels.some(l => l.parentNodeId === rangeNode.id);
                if (isInLevels) {
                    let kids = rangeNode.childrenIds.map(cid => getNode(cid)).filter(n => n);
                    if (kids.length) {
                        let alreadyAdded = false;
                        let mainDiv = container.querySelector('.work-level:last-child');
                        if (mainDiv) {
                            let mainItems = mainDiv.querySelectorAll('.folder-btn, .range-link');
                            mainItems.forEach(el => {
                                if (kids.some(k => k.name === el.textContent)) {
                                    alreadyAdded = true;
                                }
                            });
                        }
                        if (!alreadyAdded) {
                            const hr = document.createElement("hr");
                            hr.style.margin = "8px 0";
                            hr.style.border = "0";
                            hr.style.borderTop = "1px solid #3D3D3D";
                            container.appendChild(hr);

                            const subLevelDiv = document.createElement("div");
                            subLevelDiv.className = "work-level";
                            subLevelDiv.style.display = "flex";
                            subLevelDiv.style.flexWrap = "wrap";
                            subLevelDiv.style.gap = "8px";
                            subLevelDiv.style.marginBottom = "8px";
                            subLevelDiv.style.paddingLeft = "20px";

                            for (let kid of kids) {
                                if (kid.type === 'folder') {
                                    const subBtn = document.createElement("button");
                                    subBtn.className = "folder-btn folder-btn-" + kid.id;
                                    subBtn.innerText = kid.name;
                                    subBtn.onclick = (function(k, idx) {
                                        return function() {
                                            App.state.workLevels = App.state.workLevels.slice(0, idx + 1);
                                            App.state.workLevels.push({ parentNodeId: k.id, levelIndex: idx + 1 });
                                            let firstRange = App.work.findFirstRange(k.id);
                                            if (firstRange !== null) {
                                                App.state.workDisplayNodeId = firstRange;
                                            }
                                                            if (App.dirty) App.dirty.markMetadataDirty('editor');
                                            persistAll();
                                            App.work.updateDisplay();
                                        };
                                    })(kid, App.state.workLevels.length);
                                    subLevelDiv.appendChild(subBtn);
                                } else if (kid.type === 'subrange') {
                                    const subLink = document.createElement("span");
                                    subLink.className = "range-link range-link-" + kid.id;
                                    subLink.innerText = kid.name;
                                    if (App.work.isNodeInPath(kid.id)) {
                                        subLink.classList.add("active");
                                    } else {
                                        subLink.classList.remove("active");
                                    }
                                    subLink.onclick = (function(k) {
                                        return function() {
                                            App.state.workDisplayNodeId = k.id;
                                            if (App.dirty) App.dirty.markMetadataDirty('editor');
                                            persistAll();
                                            App.work.updateDisplay();
                                            App.work.updateGrid();
                                        };
                                    })(kid);
                                    subLevelDiv.appendChild(subLink);
                                }
                            }
                            container.appendChild(subLevelDiv);
                        }
                    }
                }
            }
        }

        if (li < App.state.workLevels.length - 1) {
            const hr = document.createElement("hr");
            hr.style.border = "0";
            hr.style.borderTop = "1px solid #3D3D3D";
            container.appendChild(hr);
        }
    }

    if (!App.state.workDisplayNodeId) {
        const gridDiv = document.getElementById("workGrid");
        if (gridDiv) {
            gridDiv.innerHTML = "<div style='padding:20px; color: var(--text-muted);'>" + App.i18n.t('work.selectRange') + "</div>";
        }
    }

}

App.work.updateGrid = function() {
    if (!App.state.workDisplayNodeId) return;
        
    App.grid.renderGrid("workGrid", App.state.workDisplayNodeId, null);
    App.comments.renderComments(App.state.workDisplayNodeId);
    App.stats.renderBranchStats(
        App.state.workDisplayNodeId,
        App.editor,
        App.stats.CONTAINERS.work
    );
}

App.work.updateDisplay = function() {
	    // ===== ПРОВЕРКА ВАЛИДНОСТИ App.state.workDisplayNodeId =====
    const isValid = App.state.workDisplayNodeId && !!getNode(App.state.workDisplayNodeId);
    if (!isValid) {
        const firstRange = App.state.nodes.find(n => n.type === 'range' || n.type === 'subrange');
        if (firstRange) {
            App.state.workDisplayNodeId = firstRange.id;
        } else {
            App.state.workDisplayNodeId = null;
        }
    }
    App.work.renderNavigation();
	// ===== ПОКАЗЫВАЕМ ВЛОЖЕННЫЕ ЭЛЕМЕНТЫ АКТИВНОГО ДИАПАЗОНА =====
if (App.state.workDisplayNodeId) {
    const activeNode = getNode(App.state.workDisplayNodeId);
    if (activeNode && activeNode.childrenIds && activeNode.childrenIds.length > 0) {
        const existingLevel = App.state.workLevels.find(l => l.parentNodeId === App.state.workDisplayNodeId);
        if (!existingLevel) {
            App.state.workLevels.push({ parentNodeId: App.state.workDisplayNodeId, levelIndex: App.state.workLevels.length });
            App.work.renderNavigation();
        }
    }
}
    if (App.state.workDisplayNodeId) {
        App.work.updateGrid();
		const workGrid = document.getElementById('workGrid');
        if (workGrid) {
            workGrid.classList.remove('matrix-fade');
            void workGrid.offsetWidth;
            workGrid.classList.add('matrix-fade');
        }
        let titleEl = document.getElementById("workRangeName");
        let node = getNode(App.state.workDisplayNodeId);
        if (titleEl && node) {
            // Собираем цепочку предков от текущего узла до корня (по parentId).
            // Папки (type === 'folder') не отображаем — только диапазоны и поддиапазоны.
            const chain = [];
            let cur = node;
            while (cur) {
                if (cur.type === 'range' || cur.type === 'subrange') {
                    chain.push(cur.name);
                }
                cur = (cur.parentId != null) ? getNode(cur.parentId) : null;
            }
            chain.reverse();
            titleEl.innerHTML = chain
                .map(name => escapeHtml(name))
                .join('<span class="breadcrumb-arrow">&#9654;</span>');
        }
    }
    
    // ========================================
    // ИКОНКИ (привязаны к таблице)
    // ========================================
    
    const workTableWrapper = document.querySelector('.matrix1-wrapper');
    const rangeNode = getNode(App.state.workDisplayNodeId);
    const isSubrange = rangeNode && rangeNode.type === 'subrange';
    
    if (workTableWrapper) {
		        // ===== НОВАЯ ИКОНКА: РЕДАКТИРОВАТЬ СТИЛИ =====
        let styleBtn = document.getElementById('styleEditToggle');
        if (!styleBtn) {
            styleBtn = document.createElement('button');
            styleBtn.id = 'styleEditToggle';
            styleBtn.className = 'icon-btn matrix-btn';
            styleBtn.dataset.tooltip = App.i18n.t('matrix.editStyles');
            styleBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" stroke="#8a848a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.2,15l6.7-6.7c1-1,1.2-2.5,0.5-3.7c-1-1.5-3.2-1.7-4.4-0.4L17.2,11l0,0c-1.1-1.1-2.9-1.1-4,0l-0.7,0.7l8.1,8.1l0.7-0.7C22.4,17.9,22.4,16.1,21.2,15L21.2,15z"/>
                    <path d="M13,12c-3,3-6.9,4.6-10,5h0l11.5,11.5L20,20"/>
                </svg>
            `;
            workTableWrapper.appendChild(styleBtn);

            // Заглушка на клик
       styleBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    
    // Находим контейнер с кнопками
    const container = document.getElementById('workLevelsContainer');
    if (container) {
        container.classList.toggle('style-edit-mode');
    }
    
    this.classList.toggle('active');
});
        }
            
            // ===== КНОПКА: КОММЕНТАРИИ =====
        let iconBtn = document.getElementById('workCommentsToggleBtn');
        if (!iconBtn) {
            workTableWrapper.style.position = 'relative';
            iconBtn = document.createElement('button');
            iconBtn.id = 'workCommentsToggleBtn';
            iconBtn.className = 'comments-toggle-btn matrix-btn';
            iconBtn.dataset.tooltip = App.i18n.t('matrix.comments');
            iconBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-5.1a7.5 7.5 0 0 1-1.5-4.4A7.5 7.5 0 0 1 10 5h2.5A7.5 7.5 0 0 1 20 11.5Z"/>
                </svg>
            `;
            workTableWrapper.appendChild(iconBtn);
            iconBtn.addEventListener('click', function() {
                const area = document.getElementById('workCommentsArea');
                if (area) {
                    const isOpen = area.style.display !== 'none';
                    area.style.display = isOpen ? 'none' : 'block';
                    iconBtn.classList.toggle('active');
                    if (!isOpen) {
                        const textarea = document.getElementById('workCommentsTextarea');
                        if (textarea) setTimeout(() => textarea.focus(), 100);
                    }
                }
            });
        }
        
        // ===== КНОПКА: ПОКАЗАТЬ/СКРЫТЬ ОВЕРЛЕИ ПОДДИАПАЗОНОВ =====
        // Показываем только для поддиапазона
        let overlayBtn = document.getElementById('workOverlayToggleBtn');
        if (isSubrange) {
            if (!overlayBtn) {
                overlayBtn = document.createElement('button');
                overlayBtn.id = 'workOverlayToggleBtn';
                overlayBtn.className = 'comments-toggle-btn matrix-btn';
                overlayBtn.dataset.tooltip = App.i18n.t('matrix.rangeHeight');
                overlayBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="2" width="20" height="20" rx="1" />
                        <rect x="2" y="12" width="20" height="10" fill="currentColor" stroke="none" rx="1" />
                    </svg>
                `;
                workTableWrapper.appendChild(overlayBtn);
                overlayBtn.addEventListener('click', function() {
                    const wrapper = document.querySelector('.matrix1-wrapper');
                    if (wrapper) {
                        const isHidden = wrapper.classList.toggle('hide-subrange-overlays');
                        overlayBtn.innerHTML = isHidden
                            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="2" width="20" height="20" rx="1" fill="currentColor" stroke="none" />
                               </svg>`
                            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="2" width="20" height="20" rx="1" />
                                <rect x="2" y="12" width="20" height="10" fill="currentColor" stroke="none" rx="1" />
                               </svg>`;
                        overlayBtn.dataset.tooltip = isHidden ? App.i18n.t('matrix.fullHeight') : App.i18n.t('matrix.rangeHeight');
                    }
                });
            }
            overlayBtn.style.display = 'flex';
        } else {
            // Не поддиапазон — скрываем кнопку оверлея
            if (overlayBtn) overlayBtn.style.display = 'none';
        }

        // ===== КНОПКА: ПОКАЗАТЬ/СКРЫТЬ ДЕТАЛЬНУЮ СТАТИСТИКУ =====
        let statsToggleBtn = document.getElementById('workStatsToggleBtn');
        if (!statsToggleBtn) {
            statsToggleBtn = document.createElement('button');
            statsToggleBtn.id = 'workStatsToggleBtn';
            statsToggleBtn.className = 'matrix-btn';
            statsToggleBtn.dataset.tooltip = App.i18n.t('matrix.showDetails');
            statsToggleBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/>
                    <circle cx="12" cy="12" r="2.5"/>
                </svg>
            `;
            workTableWrapper.appendChild(statsToggleBtn);
            statsToggleBtn.addEventListener('click', function() {
                const statsContainer = document.getElementById('workStatsContainer');
                if (!statsContainer) return;

                const isVisible = statsContainer.classList.toggle('details-visible');
                statsToggleBtn.classList.toggle('active', isVisible);
                statsToggleBtn.dataset.tooltip = isVisible
                    ? App.i18n.t('matrix.hideDetails')
                    : App.i18n.t('matrix.showDetails');
            });
        }
    }
    
    // 2. ПОЛЕ ДЛЯ КОММЕНТАРИЕВ
    let workCommentsWrapper = document.getElementById('workCommentsWrapper');
    if (!workCommentsWrapper && App.state.workDisplayNodeId) {
        workCommentsWrapper = document.createElement('div');
        workCommentsWrapper.id = 'workCommentsWrapper';
        workCommentsWrapper.className = 'comments-wrapper';
        workCommentsWrapper.style.width = '100%';
        workCommentsWrapper.style.maxWidth = '530px';
        workCommentsWrapper.style.marginTop = '8px';
        
        const area = document.createElement('div');
        area.className = 'comments-area';
        area.id = 'workCommentsArea';
        area.style.display = 'none';
        area.style.width = '100%';
        area.style.borderRadius = '6px';
        area.style.border = '1px solid #3d3f46';
        area.style.background = '#2d2f34';
        area.style.overflow = 'hidden';
        
        const textarea = document.createElement('textarea');
        textarea.id = 'workCommentsTextarea';
        textarea.placeholder = App.i18n.t('matrix.commentPlaceholder');
        textarea.maxLength = 2000;
        textarea.style.width = '100%';
        textarea.style.height = '100px';
        textarea.style.minHeight = '100px';
        textarea.style.maxHeight = '300px';
        textarea.style.background = 'transparent';
        textarea.style.border = 'none';
        textarea.style.color = '#e5eaf0';
        textarea.style.fontSize = '13px';
        textarea.style.fontFamily = "'Roboto', 'Helvetica Neue', sans-serif";
        textarea.style.padding = '10px 12px';
        textarea.style.resize = 'vertical';
        textarea.style.outline = 'none';
        textarea.style.lineHeight = '1.5';
        textarea.style.boxSizing = 'border-box';
        
        area.appendChild(textarea);
        workCommentsWrapper.appendChild(area);
        
        // Добавляем после таблицы
        const leftArea = document.querySelector('.left-area');
        if (leftArea) {
            leftArea.appendChild(workCommentsWrapper);
        }
        
        // Автосохранение
        let saveTimeout = null;
        textarea.addEventListener('input', function() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (App.state.workDisplayNodeId) {
                    App.comments.setComments(App.state.workDisplayNodeId, this.value);
                }
            }, 500);
        });
        
        textarea.addEventListener('blur', function() {
            if (App.state.workDisplayNodeId) {
                App.comments.setComments(App.state.workDisplayNodeId, this.value);
                persistAll();
                clearUnsaved();
            }
        });
    }
    
    // 3. ЗАГРУЗИТЬ КОММЕНТАРИЙ
    App.comments.renderWorkComments(App.state.workDisplayNodeId);
	 const commentsWrapper = document.getElementById('commentsWrapper');
    if (commentsWrapper) {
        commentsWrapper.style.display = 'block';
        App.comments.renderWorkComments(App.state.workDisplayNodeId);
    }
}
