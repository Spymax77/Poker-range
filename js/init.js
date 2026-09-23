// ===== init.js -- extracted from all.js (top-level listeners & bootstrap) =====
// ---------- ВЫБОР КАРТ ----------
const rankOrder = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const suits = ["h","c","d","s"];
const suitSymbols = { h: "♥", c: "♣", d: "♦", s: "♠" };
const suitColors = { h: "#ff6666", c: "#2ecc71", d: "#2f80ed", s: "#cccccc" };
let currentBoard = { flop: [null, null, null], turn: null, river: null };
const slotElements = {
    flop1: document.getElementById("flopSlot1"),
    flop2: document.getElementById("flopSlot2"),
    flop3: document.getElementById("flopSlot3"),
    turn: document.getElementById("turnSlot"),
    river: document.getElementById("riverSlot")
};

App.events.on('storage:loading', function() {
    const status = document.getElementById('saveStatus');
    if (status) { status.textContent = App.i18n.t('status.loading'); status.className = 'save-status saving'; }
});
App.events.on('storage:saving', function() {
    const status = document.getElementById('saveStatus');
    if (status) { status.textContent = App.i18n.t('status.saving'); status.className = 'save-status saving'; }
});
App.events.on('storage:saved', function() {
    const status = document.getElementById('saveStatus');
    if (status) { status.textContent = App.i18n.t('status.synced'); status.className = 'save-status saved'; }
});
App.events.on('storage:ready', function() {
    const status = document.getElementById('saveStatus');
    if (status) { status.textContent = App.i18n.t('status.synced'); status.className = 'save-status saved'; }
});
App.events.on('storage:error', function() {
    const status = document.getElementById('saveStatus');
    if (status) { status.textContent = App.i18n.t('status.error'); status.className = 'save-status error'; }
});

document.addEventListener('languagechange', function () {
    const status = document.getElementById('saveStatus');
    if (status && status.classList.contains('saving')) {
        status.textContent = App.i18n.t('status.saving');
    } else if (status && status.classList.contains('saved')) {
        status.textContent = App.i18n.t('status.synced');
    } else if (status && status.classList.contains('error')) {
        status.textContent = App.i18n.t('status.error');
    }
});

function showAuthDialog(mode) {
    const oldOverlay = document.querySelector('.auth-dialog-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'auth-dialog-overlay';
    const modal = document.createElement('div');
    modal.className = 'auth-dialog';
    const isRegister = mode === 'register';
    const isForgot = mode === 'forgot';

    let formHtml;
    if (isForgot) {
        formHtml = `
            <h2>${App.i18n.t('auth.forgotTitle')}</h2>
            <p class="auth-dialog-hint">${App.i18n.t('auth.forgotHint')}</p>
            <form id="authDialogForm">
                <label>${App.i18n.t('auth.email')}<input name="email" type="email" required autocomplete="email"></label>
                <div class="auth-dialog-error" id="authDialogError"></div>
                <button class="auth-submit" type="submit">${App.i18n.t('auth.sendLink')}</button>
            </form>
            <button type="button" class="auth-link" data-auth-mode="login">${App.i18n.t('auth.backToLogin')}</button>`;
    } else if (isRegister) {
        formHtml = `
            <h2>${App.i18n.t('auth.registerTitle')}</h2>
            <form id="authDialogForm">
                <label>${App.i18n.t('auth.loginLabel')}<input name="login" required minlength="3" maxlength="32" autocomplete="username"></label>
                <label>${App.i18n.t('auth.email')}<input name="email" type="email" required autocomplete="email"></label>
                <label>${App.i18n.t('auth.passwordLabel')}<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
                <label>${App.i18n.t('auth.passwordConfirmLabel')}<input name="passwordConfirm" type="password" required minlength="8" autocomplete="new-password"></label>
                <div class="auth-dialog-error" id="authDialogError"></div>
                <button class="auth-submit" type="submit">${App.i18n.t('auth.registerSubmit')}</button>
            </form>
            <button type="button" class="auth-link" data-auth-mode="login">${App.i18n.t('auth.haveAccount')}</button>`;
    } else {
        formHtml = `
            <h2>${App.i18n.t('auth.loginTitle')}</h2>
            <form id="authDialogForm">
                <label>${App.i18n.t('auth.loginLabel')}<input name="login" required autocomplete="username"></label>
                <label>${App.i18n.t('auth.passwordLabel')}<input name="password" type="password" required autocomplete="current-password"></label>
                <div class="auth-dialog-error" id="authDialogError"></div>
                <button class="auth-submit" type="submit">${App.i18n.t('auth.loginSubmit')}</button>
            </form>
            <button type="button" class="auth-link" data-auth-mode="forgot">${App.i18n.t('auth.forgotLink')}</button>
            <button type="button" class="auth-link" data-auth-mode="register">${App.i18n.t('auth.register')}</button>`;
    }

    modal.innerHTML = '<button type="button" class="auth-dialog-close" aria-label="' + App.i18n.t('auth.close') + '">&times;</button>' + formHtml;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal.querySelector('.auth-dialog-close').addEventListener('click', function() { overlay.remove(); });
    modal.querySelectorAll('[data-auth-mode]').forEach(function(button) {
        button.addEventListener('click', function() { showAuthDialog(button.dataset.authMode); });
    });
    modal.querySelector('form').addEventListener('submit', async function(event) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const errorElement = modal.querySelector('#authDialogError');
        const submit = modal.querySelector('.auth-submit');
        submit.disabled = true;
        errorElement.textContent = '';
        let result;
        if (isForgot) {
            result = await App.auth.forgotPassword(form.get('email'));
        } else if (isRegister) {
            result = await App.auth.register(form.get('login'), form.get('email'), form.get('password'), form.get('passwordConfirm'));
        } else {
            result = await App.auth.login(form.get('login'), form.get('password'));
        }
        submit.disabled = false;
        if (result && result.success) {
            overlay.remove();
            if (isForgot) App.modals.showFloatingModal(result.message || App.i18n.t('auth.forgotSent'));
        } else {
            errorElement.textContent = (result && (result.error || result.message)) || App.i18n.t('auth.operationFailed');
        }
    });
}

function closeAuthMenu() {
    const dropdown = document.getElementById('authDropdown');
    const btn = document.getElementById('authAvatarBtn');
    if (dropdown) dropdown.classList.remove('open');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('menu-open');
    }
}

function updateAuthUi(user) {
    const userName = document.getElementById('authUserName');
    const loginItem = document.getElementById('authLoginItem');
    const registerItem = document.getElementById('authRegisterItem');
    const logoutItem = document.getElementById('authLogoutItem');
    const userEmail = document.getElementById('authUserEmail');
    const configDivider = document.getElementById('authConfigDivider');
    const importTreeItem = document.getElementById('importTreeMenuBtn');
    const exportTreeItem = document.getElementById('exportTreeMenuBtn');
    const avatarBtn = document.getElementById('authAvatarBtn');
    const loggedIn = !!user;
    if (userName) {
        userName.textContent = '';
        userName.hidden = true;
    }
    if (loginItem) loginItem.hidden = loggedIn;
    if (registerItem) registerItem.hidden = loggedIn;
    if (logoutItem) logoutItem.hidden = !loggedIn;
    if (userEmail) {
        userEmail.textContent = user ? user.email : '';
        userEmail.hidden = !loggedIn;
    }
    if (configDivider) configDivider.hidden = !loggedIn;
    if (importTreeItem) importTreeItem.hidden = !loggedIn;
    if (exportTreeItem) exportTreeItem.hidden = !loggedIn;
    if (avatarBtn) avatarBtn.classList.toggle('logged-in', loggedIn);
}

const authAvatarBtn = document.getElementById('authAvatarBtn');
const authDropdown = document.getElementById('authDropdown');
if (authAvatarBtn && authDropdown) {
    authAvatarBtn.addEventListener('click', function() {
        const willOpen = !authDropdown.classList.contains('open');
        authDropdown.classList.toggle('open', willOpen);
        authAvatarBtn.setAttribute('aria-expanded', String(willOpen));
        authAvatarBtn.classList.toggle('menu-open', willOpen);
    });
}

document.getElementById('authLoginItem')?.addEventListener('click', function() {
    closeAuthMenu();
    showAuthDialog('login');
});
document.getElementById('authRegisterItem')?.addEventListener('click', function() {
    closeAuthMenu();
    showAuthDialog('register');
});
document.getElementById('authLogoutItem')?.addEventListener('click', function() {
    closeAuthMenu();

    const logout = async function() {
        await App.auth.logout();
        location.reload();
    };

    const hasUnsavedChanges = App.state.hasUnsavedChanges
        || (App.dirty && App.dirty.hasDirty());

    if (!hasUnsavedChanges) {
        logout();
        return;
    }

    const node = getNode(App.state.currentNodeId);
    const message = node
        ? App.i18n.t('range.saveChangesNamedQuestion', { name: node.name })
        : App.i18n.t('range.saveChangesQuestion');

    App.modals.showSaveConfirmModal(message, async function() {
        // Да — сохраняем перед выходом из аккаунта
        const results = await flushPersist();
        const saveSucceeded = !results || results.every(function(result) {
            return result && result.success !== false;
        });
        if (!saveSucceeded) {
            App.modals.showFloatingModal(App.i18n.t('range.saveFailed'));
            return;
        }
        clearUnsaved();
        await logout();
    }, async function() {
        // Нет — выходим без сохранения
        await logout();
    });
});

document.addEventListener('click', function(e) {
    const panel = document.getElementById('authPanel');
    if (panel && !panel.contains(e.target)) closeAuthMenu();
});

let initialLoadDone = false;

async function reloadAllData() {
    try {
        // После входа гостевая сессия не переносится в аккаунт: загружаем
        // только состояние, сохранённое для авторизованного пользователя.
        if (App.dirty) App.dirty.clearDirty();
        clearUnsaved();
        App.storage.clearCache();
        await App.storage.initialize();
        const activeTab = await loadFromStorage();
        const tab = activeTab || 'constructor';
        App.navigation.switchTab(tab);
        if (tab === 'constructor' && App.state.analysisMode) {
            App.grid.refreshConstructorAnalysisMode();
        }
    } catch (error) {
        console.error('Ошибка перезагрузки данных после входа:', error);
    }
}

App.events.on('auth:changed', function(user) {
    closeAuthMenu();
    updateAuthUi(user);
    if (!initialLoadDone) return;
    if (user) {
        // Гостевые изменения никогда не переносятся в аккаунт и не
        // сохраняются при входе. Сначала отбрасываем их из памяти, затем
        // загружаем авторитетное состояние пользователя с сервера.
        reloadAllData();
    }
});
App.events.on('auth:required', function() {
    App.modals.showFloatingModal(App.i18n.t('auth.requireAuthToSave'), function() {
        showAuthDialog('login');
    });
});
updateAuthUi(App.auth.getCurrentUser());

document.addEventListener('mousedown', App.paint.handlePaintStart);
document.addEventListener('mousemove', App.paint.handlePaintMove);
document.addEventListener('mouseup', App.paint.handlePaintEnd);

// На touch-устройствах удерживаем расширенное дерево только на время работы
// с каталогом. После касания матрицы или другой области оно снова становится
// компактным, чтобы освободить место для рабочей области.
document.addEventListener('pointerdown', function(e) {
    if (e.pointerType !== 'touch') return;
    const treePanel = e.target.closest?.('.tree-panel');
    document.querySelectorAll('.tree-panel.tree-interacting').forEach(panel => {
        if (panel !== treePanel) panel.classList.remove('tree-interacting');
    });
    if (treePanel) treePanel.classList.add('tree-interacting');
});

// ===== НАВИГАЦИЯ ПО ДЕРЕВУ КЛАВИШАМИ =====
document.addEventListener('keydown', function(e) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    if (e.target instanceof Element &&
        e.target.matches('input, textarea, select, [contenteditable="true"]')) return;

    const activeTree = App.currentMode === 'gto'
        ? document.getElementById('gtoPage')?.classList.contains('active-page')
        : document.getElementById('constructorPage')?.classList.contains('active-page');
    if (!activeTree) return;

    if (App.tree.handleKeyboardNavigation(e.key)) {
        e.preventDefault();
        e.stopPropagation();
    }
});

// ===== ФЛАГ ИЗМЕНЕНИЙ =====
// (markUnsaved / clearUnsaved вынесены в persistence.js)

// ===== КНОПКА "СОХРАНИТЬ" =====
document.getElementById('tableSaveBtn')?.addEventListener('click', async function() {
    // В режиме анализа кнопки редактирования погашены классом
    // .toolbar-btn-disabled (pointer-events: none), но CSS не мешает
    // программному .click() (например, из userscript'а), поэтому дублируем
    // проверку в обработчике.
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActiveSave'));
        return;
    }
    const results = await flushPersist();
    const saveSucceeded = !results || results.every(function(result) {
        return result && result.success !== false;
    });
    if (saveSucceeded) {
        clearUnsaved();
    } else {
        App.modals.showFloatingModal(App.i18n.t('range.saveFailed'));
    }
});

// ===== ДОПОЛНИТЕЛЬНОЕ МЕНЮ МАТРИЦЫ =====
const tableMoreBtn = document.getElementById('tableMoreBtn');
const tableMoreMenu = document.getElementById('tableMoreMenu');
if (tableMoreBtn && tableMoreMenu) {
    tableMoreBtn.addEventListener('click', function(e) {
        if (App.state.analysisMode) return;
        e.stopPropagation();
        const isOpen = tableMoreMenu.classList.toggle('open');
        tableMoreBtn.setAttribute('aria-expanded', String(isOpen));
    });

    document.getElementById('removeUnusedColorsBtn')?.addEventListener('click', function() {
        tableMoreMenu.classList.remove('open');
        tableMoreBtn.setAttribute('aria-expanded', 'false');
        if (App.state.analysisMode || !App.state.currentNodeId) return;

        const result = App.colors.removeUnusedColors(App.state.currentNodeId);
        App.modals.showFloatingModal(
            result.removed > 0
                ? App.i18n.t('colors.removedUnused', { count: result.removed })
                : App.i18n.t('colors.noUnusedFound')
        );
    });

    document.addEventListener('click', function(e) {
        if (!tableMoreMenu.contains(e.target) && !tableMoreBtn.contains(e.target)) {
            tableMoreMenu.classList.remove('open');
            tableMoreBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

// ===== КНОПКА "ОТМЕНИТЬ" =====
document.getElementById('tableUndoBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    if (!App.state.hasUnsavedChanges) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActive'));
        return;
    }

    const node = getNode(App.state.currentNodeId);
    const message = node
        ? App.i18n.t('range.undoChangesNamedQuestion', { name: node.name })
        : App.i18n.t('range.undoChangesQuestion');

    App.modals.showSaveConfirmModal(message, async function() {
        // Да — отменяем
        await loadFromStorage();
        App.refresh.all();
        App.grid.updateCurrentDisplay();
        clearUnsaved();
    }, function() {
        // Нет — ничего не делаем
    });
});
// ===== КНОПКИ КОПИРОВАТЬ/ВСТАВИТЬ В ТУЛБАРЕ =====
document.getElementById('tableCopyBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActiveCopy'));
        return;
    }
    App.clipboard.copyRange(App.state.currentNodeId);
    App.clipboard.updatePasteButtonState();
});

document.getElementById('tablePasteBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActivePaste'));
        return;
    }
    App.clipboard.pasteRange(App.state.currentNodeId);
});

// ===== ПЕРЕКЛЮЧЕНИЕ ДИАПАЗОНА С ПРОВЕРКОЙ =====
const originalSelectNode = App.navigation.selectNode;

App.navigation.selectNode = function(nodeId) {
    const targetNode = getNode(nodeId);
    if (targetNode && targetNode.type === 'folder') {
        originalSelectNode(nodeId);
        return;
    }
    if (nodeId === App.state.currentNodeId) {
        originalSelectNode(nodeId);
        return;
    }
    if (App.state.hasUnsavedChanges) {
        const node = getNode(App.state.currentNodeId);
        const message = node
    ? App.i18n.t('range.saveChangesNamedQuestion', { name: node.name })
    : App.i18n.t('range.saveChangesQuestion');

        // В гостевом режиме изменения живут в памяти. Не показываем диалог
        // сохранения и не вызываем loadFromStorage(): загрузка гостевого
        // состояния могла затереть раскрашенную матрицу.
        if (!App.auth || !App.auth.isLoggedIn()) {
            originalSelectNode(nodeId);
            return;
        }

        App.modals.showSaveConfirmModal(message, async function() {
            // Да — сохраняем
            const results = await flushPersist();
            const saveSucceeded = !results || results.every(function(result) {
                return result && result.success !== false;
            });
            if (!saveSucceeded) {
                App.modals.showFloatingModal(App.i18n.t('range.saveFailed'));
                return;
            }
            clearUnsaved();
            originalSelectNode(nodeId);
        }, async function() {
            // Нет — откатываем
            await loadFromStorage();
            App.refresh.all();
            App.grid.updateCurrentDisplay();
            clearUnsaved();
            originalSelectNode(nodeId);
        });
    } else {
        originalSelectNode(nodeId);
    }
};

// ===== ПОДПИСКИ НА СОБЫТИЯ =====
App.events.on('data:changed', App.refresh.allGrids);

// ===== МОБИЛЬНОЕ МЕНЮ ВКЛАДОК =====
const tabsToggle = document.getElementById('tabsToggle');
const mainTabs = document.getElementById('mainTabs');
const mobileTabsQuery = window.matchMedia('(max-width: 530px)');
const tabsMenuToggle = document.getElementById('tabsMenuToggle');
const mobileTabsMenuQuery = window.matchMedia('(max-width: 849px)');

function updateMobileTabsState() {
    if (!mainTabs || !tabsToggle) return;

    if (!mobileTabsQuery.matches) {
        mainTabs.classList.remove('tabs-open');
        tabsToggle.setAttribute('aria-expanded', 'false');
    }

    if (!mobileTabsMenuQuery.matches && tabsMenuToggle) {
        mainTabs.classList.remove('tabs-menu-open');
        tabsMenuToggle.setAttribute('aria-expanded', 'false');
        tabsMenuToggle.setAttribute('aria-label', App.i18n.t('tabs.openMenu'));
    }
}

if (tabsToggle && mainTabs) {
    tabsToggle.addEventListener('click', function() {
        const isOpen = mainTabs.classList.toggle('tabs-open');
        tabsToggle.setAttribute('aria-expanded', String(isOpen));
        tabsToggle.setAttribute(
            'aria-label',
            isOpen ? App.i18n.t('tabs.showPanelHide') : App.i18n.t('tabs.showPanel')
        );
    });

    window.addEventListener('resize', updateMobileTabsState);
    updateMobileTabsState();
}

if (tabsMenuToggle && mainTabs) {
    tabsMenuToggle.addEventListener('click', function() {
        const isOpen = mainTabs.classList.toggle('tabs-menu-open');
        tabsMenuToggle.setAttribute('aria-expanded', String(isOpen));
        tabsMenuToggle.setAttribute(
            'aria-label',
            isOpen ? App.i18n.t('tabs.openMenuClose') : App.i18n.t('tabs.openMenu')
        );
    });
}

// ===== МОБИЛЬНАЯ ПАНЕЛЬ ФИЛЬТРОВ GTO =====
const gtoFilterToggle = document.getElementById('gtoFilterToggle');
const gtoFilterBar = document.getElementById('gtoFilterBar');
const mobileGtoFilterQuery = window.matchMedia('(max-width: 849px)');

function updateMobileGtoFilterState() {
    if (!gtoFilterToggle || !gtoFilterBar) return;

    if (!mobileGtoFilterQuery.matches) {
        gtoFilterBar.classList.remove('gto-filter-open');
        gtoFilterToggle.setAttribute('aria-expanded', 'false');
    }
}

if (gtoFilterToggle && gtoFilterBar) {
    gtoFilterToggle.addEventListener('click', function() {
        const isOpen = gtoFilterBar.classList.toggle('gto-filter-open');
        gtoFilterToggle.setAttribute('aria-expanded', String(isOpen));
    });

    window.addEventListener('resize', updateMobileGtoFilterState);
    updateMobileGtoFilterState();
}

// ===== АДАПТИВНОЕ ПОЛОЖЕНИЕ КНОПОК РЕЖИМОВ КОНСТРУКТОРА =====
const constructorModeToolbar = document.querySelector('#constructorPage .matrix-mode-toolbar');
const constructorMatrixRow = document.querySelector('#constructorPage .matrix-row');
const constructorToolbarRight = document.querySelector('#constructorPage .toolbar-right');
const mobileConstructorToolbarQuery = window.matchMedia('(max-width: 849px)');

function updateConstructorModeToolbarPosition() {
    if (!constructorModeToolbar || !constructorMatrixRow || !constructorToolbarRight) return;

    if (mobileConstructorToolbarQuery.matches) {
        if (constructorModeToolbar.parentElement !== constructorToolbarRight) {
            constructorToolbarRight.appendChild(constructorModeToolbar);
        }
    } else if (constructorModeToolbar.parentElement !== constructorMatrixRow) {
        constructorMatrixRow.insertBefore(constructorModeToolbar, constructorMatrixRow.firstElementChild);
    }
}

if (constructorModeToolbar && constructorMatrixRow && constructorToolbarRight) {
    window.addEventListener('resize', updateConstructorModeToolbarPosition);
    updateConstructorModeToolbarPosition();
}

// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = function() {
        const page = this.getAttribute("data-page");

        // ===== ПРОВЕРКА ПРИ ПЕРЕКЛЮЧЕНИИ НА ПРОСМОТР =====
        if (page === "work" && App.state.hasUnsavedChanges && App.auth && App.auth.isLoggedIn()) {
            const node = getNode(App.state.currentNodeId);
            const message = node
                ? App.i18n.t('range.saveChangesNamedQuestion', { name: node.name })
                : App.i18n.t('range.saveChangesQuestion');

            App.modals.showSaveConfirmModal(message, async function() {
                // Да — сохраняем изменения перед переключением вкладки
                const results = await flushPersist();
                const saveSucceeded = !results || results.every(function(result) {
                    return result && result.success !== false;
                });
                if (!saveSucceeded) {
                    App.modals.showFloatingModal(App.i18n.t('range.saveFailed'));
                    return;
                }
                clearUnsaved();
                App.navigation.switchTab(page);
            }, async function() {
                // Нет — откатываем
                await loadFromStorage();
                App.refresh.all();
                App.grid.updateCurrentDisplay();
                clearUnsaved();
                App.navigation.switchTab(page);
            });
            return;
        }

        App.navigation.switchTab(page);
    };
});

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ ДЕРЕВА ==========

document.getElementById('treeAddFolderBtn')?.addEventListener('click', App.tree.addRootNode);

document.getElementById('treeAddRangeBtn')?.addEventListener('click', () => {
    // Собираем имена всех корневых узлов
    const rootNodes = App.state.nodes.filter(n => n.parentId === null);
    const existingNames = rootNodes.map(n => n.name);
    const newName = App.tree.generateUniqueName('Новый диапазон', existingNames);

    let newId = App.state.nextNodeId++;
    let newNode = {
        id: newId,
        name: newName,
        parentId: null,
        childrenIds: [],
        type: 'range'
    };
    addNode(newNode);
    App.grid.ensureTable(newId);
    App.dirty.markStructureDirty();
    App.dirty.markTableDirty(newId);
    if (App.auth && App.auth.isLoggedIn()) {
        flushPersist();
    } else {
        markUnsaved();
        notifyGuestUnsavedChanges();
    }
    App.refresh.all();
    App.navigation.selectNode(newId);
});

document.getElementById('treeRenameBtn')?.addEventListener('click', () => {
    if (App.state.currentNodeId) {
        const node = getNode(App.state.currentNodeId);
        if (node) {
            App.tree.startInlineRename(App.state.currentNodeId);
        } else {
            App.modals.showFloatingModal(App.i18n.t('tree.noActiveNodeToRename'));
        }
    }
});

document.getElementById('treeMoveUpBtn')?.addEventListener('click', () => {
    if (App.state.currentNodeId) App.tree.moveNodeUp(App.state.currentNodeId);
});

document.getElementById('treeMoveDownBtn')?.addEventListener('click', () => {
    if (App.state.currentNodeId) App.tree.moveNodeDown(App.state.currentNodeId);
});

document.getElementById('treeDeleteBtn')?.addEventListener('click', () => {
    if (App.state.currentNodeId) App.tree.deleteNode(App.state.currentNodeId);
});

document.getElementById('treeCollapseText')?.addEventListener('click', () => {
    const container = document.getElementById('constructorTree');
    if (!container) return;

    const rootIds = new Set(
        App.editor.nodes
            .filter(n => n.parentId === null)
            .map(n => n.id)
    );
    App.editor.expandedNodes = rootIds;

    // Плавно закрываем ВСЕ вложенные уровни (кроме корневых папок)
    container.querySelectorAll('.tree-children .tree-children.open').forEach(ch => ch.classList.remove('open'));
    // Меняем стрелки на ▶ только у нод внутри вложенных уровней
    container.querySelectorAll('.tree-children .tree-arrow').forEach(a => { if (a.textContent) a.textContent = '▶'; });

    persistAll();
});

document.getElementById('gtoTreeCollapseText')?.addEventListener('click', () => {
    const container = document.getElementById('gtoTree');
    if (!container) return;

    const rootIds = new Set(
        App.gto.nodes
            .filter(n => n.parentId === null)
            .map(n => n.id)
    );
    App.gto.expandedNodes = rootIds;

    // Плавно закрываем ВСЕ вложенные уровни (кроме корневых папок)
    container.querySelectorAll('.tree-children .tree-children.open').forEach(ch => ch.classList.remove('open'));
    // Меняем стрелки на ▶ только у нод внутри вложенных уровней
    container.querySelectorAll('.tree-children .tree-arrow').forEach(a => { if (a.textContent) a.textContent = '▶'; });

    persistAll();
});

// ===== КНОПКИ ДОБАВЛЕНИЯ ЦВЕТА И ПРОФИЛЯ =====

document.getElementById("addPaletteColorBtn").onclick = function() {
    App.colors.addPaletteColor();
    App.refresh.all();
};

document.getElementById("newProfileBtn").onclick = function() {
    App.colors.createNewProfile();
    App.refresh.all();
};

// GTO версии кнопок
document.getElementById("gtoAddPaletteColorBtn")?.addEventListener('click', function() {
    App.colors.addPaletteColor();
    App.navigation.renderGtoPage();
});

document.getElementById("gtoNewProfileBtn")?.addEventListener('click', function() {
    App.colors.createNewProfile();
    App.navigation.renderGtoPage();
});

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ МАТРИЦЫ ==========

// ===== КНОПКИ "РЕДАКТОР" / "АНАЛИЗ" (режим анализа конструктора) =====
// Синхронизация класса #constructorPage.analysis-mode и активной кнопки
// теперь целиком выполняется в refreshConstructorAnalysisMode() (grid.js),
// т.к. её нужно вызывать не только по клику, но и при восстановлении
// состояния после F5 / возврата на вкладку конструктора.
document.getElementById('editorModeBtn')?.addEventListener('click', function() {
    if (!App.state.analysisMode) return;
    App.state.analysisMode = false;
    App.grid.refreshConstructorAnalysisMode();
    if (App.dirty) App.dirty.markMetadataDirty('editor');
    persistAll();
});

document.getElementById('analysisModeBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    App.state.analysisMode = true;
    App.grid.refreshConstructorAnalysisMode();
    if (App.dirty) App.dirty.markMetadataDirty('editor');
    persistAll();
});


document.getElementById('tableClearBtn')?.addEventListener('click', () => {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) return;

    const node = getNode(App.state.currentNodeId);
    const message = node
        ? App.i18n.t('range.clearTableNamedQuestion', { name: node.name })
        : App.i18n.t('range.clearTableQuestion');

App.modals.showSaveConfirmModal(message, () => {
    const tid = getTableId(App.state.currentNodeId);
    if (App.state.cellStorage[tid]) {
        for (let i = 0; i < 13; i++) {
            for (let j = 0; j < 13; j++) {
                App.state.cellStorage[tid][i][j] = null;
            }
        }
        App.dirty.markTableDirty(App.state.currentNodeId);
        markUnsaved();
        App.grid.updateCurrentDisplay();
    }
}, null);
});

// ===== ГСЧ (Генератор случайных чисел) =====
const rngWidget = document.getElementById("rngNumber");
if (rngWidget) {
    rngWidget.textContent = Math.floor(Math.random() * 100) + 1;
    rngWidget.onclick = function() {
        this.textContent = Math.floor(Math.random() * 100) + 1;
    };
}
// ===== ИЗМЕНЕНИЕ ШИРИНЫ ПАНЕЛИ ДЕРЕВА ПЕРЕТАСКИВАНИЕМ =====
function initTreeResize() {
    document.querySelectorAll('.tree-panel').forEach(panel => {
        // Не добавляем повторно
        if (panel.querySelector('.tree-resize-handle')) return;

        const handle = document.createElement('div');
        handle.className = 'tree-resize-handle';
        panel.appendChild(handle);

        let startX = 0;
        let startWidth = 0;

        handle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            startWidth = panel.offsetWidth;
            handle.classList.add('active');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';

            function onMouseMove(e) {
                const delta = e.clientX - startX;
                const newWidth = startWidth + delta;

                // Фиксированный минимум 250px (тулбар сам перенесётся через flex-wrap)
                const minWidth = 250;

                const clamped = Math.max(minWidth, Math.min(700, newWidth));
                panel.style.width = clamped + 'px';
                panel.style.minWidth = clamped + 'px';
                panel.style.flex = '0 0 ' + clamped + 'px';
            }

            function onMouseUp() {
                handle.classList.remove('active');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}

// ===== ЗАПУСК ПРИ ЗАГРУЗКЕ =====
(function() {
    App.auth.checkSession().then(function() {
        return App.storage.initialize();
    }).then(function() {
        return loadFromStorage().then(function(tab) {
            return tab || 'constructor';
        });
    }).then(function(activeTab) {
        App.navigation.switchTab(activeTab);
        if (activeTab === 'constructor' && App.state.analysisMode) {
            App.grid.refreshConstructorAnalysisMode();
        }
        App.grid.updateConstructorToolbarState();
        App.comments.initComments();
        initTreeResize();
    }).catch(function(error) {
        console.error('Ошибка инициализации хранилища:', error);
        loadFromStorage().then(function(activeTab) {
            App.navigation.switchTab(activeTab || 'constructor');
            App.grid.updateConstructorToolbarState();
            App.comments.initComments();
            initTreeResize();
        }).catch(function(loadError) {
            console.error('Ошибка резервной загрузки состояния:', loadError);
            App.navigation.switchTab('constructor');
            App.grid.updateConstructorToolbarState();
            App.comments.initComments();
            initTreeResize();
        });
    }).then(function() {
        initialLoadDone = true;
    });
})();
