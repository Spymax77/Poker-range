// ===== init.js -- extracted from all.js (top-level listeners & bootstrap) =====

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

// ===== ОБЩИЕ ХЕЛПЕРЫ «СОХРАНИТЬ И ПРОДОЛЖИТЬ» / «ОТКАТИТЬСЯ И ПРОДОЛЖИТЬ» =====
// Один и тот же сценарий повторяется в трёх обработчиках (выход из аккаунта,
// выбор диапазона, переключение вкладки), поэтому вынесен в App.ui.
// onSuccess может быть как sync-, так и async-функцией.

App.ui = App.ui || {};

// Колбэк «Да» для showSaveConfirmModal: сохраняет всё грязное через
// App.persistence.flushPersist; при провале показывает range.saveFailed и прерывает
// (onSuccess не вызывается), при успехе снимает флаг несохранённых
// изменений и вызывает onSuccess.
App.ui.saveAndContinue = function(onSuccess) {
    return async function() {
        const results = await App.persistence.flushPersist();
        const saveSucceeded = !results || results.every(function(result) {
            return result && result.success !== false;
        });
        if (!saveSucceeded) {
            App.modals.showFloatingModal(App.i18n.t('range.saveFailed'));
            return;
        }
        App.persistence.clearUnsaved();
        if (onSuccess) await onSuccess();
    };
};

// Колбэк «Нет» для showSaveConfirmModal: отбрасывает несохранённые правки
// (перезагрузка состояния из хранилища), перерисовывает интерфейс, снимает
// флаг несохранённых изменений и вызывает onSuccess.
App.ui.rollbackAndContinue = function(onSuccess) {
    return async function() {
        await App.persistence.loadFromStorage();
        App.refresh.all();
        App.grid.updateCurrentDisplay();
        App.persistence.clearUnsaved();
        if (onSuccess) await onSuccess();
    };
};

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

    const node = App.nodes.getNode(App.state.currentNodeId);
    const message = node
        ? App.i18n.t('range.saveChangesNamedQuestion', { name: node.name })
        : App.i18n.t('range.saveChangesQuestion');

    // Да — сохраняем перед выходом из аккаунта; при провале сохранения хелпер
    // покажет range.saveFailed и выход из аккаунта не произойдёт.
    App.modals.showSaveConfirmModal(message, App.ui.saveAndContinue(logout), async function() {
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
        App.persistence.clearUnsaved();
        App.storage.clearCache();
        await App.storage.initialize();
        const activeTab = await App.persistence.loadFromStorage();
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
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key)) return;
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
// (App.persistence.markUnsaved / App.persistence.clearUnsaved вынесены в persistence.js)

// ===== КНОПКА "СОХРАНИТЬ" =====
document.getElementById('tableSaveBtn')?.addEventListener('click', function() {
    // В режиме анализа кнопки редактирования погашены классом
    // .toolbar-btn-disabled (pointer-events: none), но CSS не мешает
    // программному .click() (например, из userscript'а), поэтому дублируем
    // проверку в обработчике.
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) {
        App.modals.showFloatingModal(App.i18n.t('range.noActiveSave'));
        return;
    }
    // Тот же сценарий сохранения, что в App.ui.saveAndContinue (App.persistence.flushPersist →
    // проверка → App.persistence.clearUnsaved / range.saveFailed), но без продолжения:
    // хелпер возвращает колбэк «Да» — вызываем его сразу.
    App.ui.saveAndContinue()();
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

    const node = App.nodes.getNode(App.state.currentNodeId);
    const message = node
        ? App.i18n.t('range.undoChangesNamedQuestion', { name: node.name })
        : App.i18n.t('range.undoChangesQuestion');

    App.modals.showSaveConfirmModal(message, async function() {
        // Да — отменяем
        await App.persistence.loadFromStorage();
        App.refresh.all();
        App.grid.updateCurrentDisplay();
        App.persistence.clearUnsaved();
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
    const targetNode = App.nodes.getNode(nodeId);
    if (targetNode && targetNode.type === 'folder') {
        originalSelectNode(nodeId);
        return;
    }
    if (nodeId === App.state.currentNodeId) {
        originalSelectNode(nodeId);
        return;
    }
    if (App.state.hasUnsavedChanges) {
        const node = App.nodes.getNode(App.state.currentNodeId);
        const message = node
    ? App.i18n.t('range.saveChangesNamedQuestion', { name: node.name })
    : App.i18n.t('range.saveChangesQuestion');

        // В гостевом режиме изменения живут в памяти. Не показываем диалог
        // сохранения и не вызываем App.persistence.loadFromStorage(): загрузка гостевого
        // состояния могла затереть раскрашенную матрицу.
        if (!App.auth || !App.auth.isLoggedIn()) {
            originalSelectNode(nodeId);
            return;
        }

        // Да — сохраняем и переключаем узел, Нет — откатываемся и переключаем
        // (общие хелперы App.ui.saveAndContinue / App.ui.rollbackAndContinue).
        App.modals.showSaveConfirmModal(message, App.ui.saveAndContinue(function() {
            originalSelectNode(nodeId);
        }), App.ui.rollbackAndContinue(function() {
            originalSelectNode(nodeId);
        }));
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

function updateMobileTabsState() {
    if (!mainTabs || !tabsToggle) return;

    // Панель вкладок по умолчанию открыта; свернутое состояние существует
    // только на мобильной ширине и сбрасывается при возврате на десктоп.
    if (!mobileTabsQuery.matches) {
        mainTabs.classList.remove('tabs-closed');
        document.body.classList.remove('tabs-closed');
        tabsToggle.setAttribute('aria-expanded', 'true');
        tabsToggle.setAttribute('aria-label', App.i18n.t('tabs.showPanelHide'));
    }
}

if (tabsToggle && mainTabs) {
    tabsToggle.addEventListener('click', function() {
        // Панель открыта по умолчанию: клик по язычку сворачивает её.
        // Класс дублируется на body, чтобы скрыть и кнопки вкладок,
        // которые на мобильных находятся внутри контента страницы.
        const isClosed = mainTabs.classList.toggle('tabs-closed');
        document.body.classList.toggle('tabs-closed', isClosed);
        tabsToggle.setAttribute('aria-expanded', String(!isClosed));
        tabsToggle.setAttribute(
            'aria-label',
            isClosed ? App.i18n.t('tabs.showPanel') : App.i18n.t('tabs.showPanelHide')
        );
    });

    window.addEventListener('resize', updateMobileTabsState);
    updateMobileTabsState();
}

// ===== МОБИЛЬНАЯ ВЫЕЗЖАЮЩАЯ ПАНЕЛЬ ДЕРЕВА (GTO / Редактор) =====
// Кнопка «три полоски» в шапке выезжает деревом слева поверх матрицы.
// Закрытие: повторное нажатие, касание вне панели, свайп влево по панели
// или смена вкладки.
function setTreePanelOpen(open) {
    document.body.classList.toggle('tree-open', open);
    if (tabsMenuToggle) {
        tabsMenuToggle.setAttribute('aria-expanded', String(open));
        tabsMenuToggle.setAttribute(
            'aria-label',
            open ? App.i18n.t('tree.hidePanel') : App.i18n.t('tree.openPanel')
        );
    }
}

// Высота шапки передаётся в CSS-переменную, чтобы шторка дерева
// начиналась ровно под ней.
function updateTreePanelOffset() {
    if (!mainTabs) return;
    document.documentElement.style.setProperty(
        '--mobile-header-h',
        mainTabs.offsetHeight + 'px'
    );
}

if (tabsMenuToggle) {
    tabsMenuToggle.addEventListener('click', function() {
        setTreePanelOpen(!document.body.classList.contains('tree-open'));
    });

    // Касание вне панели дерева (по матрице и любому другому месту) закрывает её.
    document.addEventListener('pointerdown', function(e) {
        if (!document.body.classList.contains('tree-open')) return;
        if (e.target.closest && (e.target.closest('.tree-panel') || e.target.closest('#tabsMenuToggle'))) return;
        setTreePanelOpen(false);
    });

    // Свайп влево по панели дерева закрывает шторку (только мобильные).
    // Жест обрабатывается непрерывно: пока направление не определено, жест
    // принадлежит нативному вертикальному скроллу дерева; после «замка» на
    // горизонталь (|dx| превысил порог и больше |dy|) вертикальный дрейф
    // игнорируется и шторка тянется пальцем. На отрыве пальца шторка
    // закрывается при смещении влево больше порога или резком флике,
    // иначе плавно возвращается на место.
    // touch-события на десктопе не возникают, поэтому поведение там не меняется.
    // Логика жеста общая для обеих шторок, состояние раздельное — единое
    // хранилище с ключом по id дерева внутри панели (constructorTree / gtoTree).
    const treeSwipeStates = {};
    const TREE_SWIPE_LOCK_PX = 10;        // порог «замка» направления
    const TREE_SWIPE_CLOSE_PX = 50;       // минимальное смещение для закрытия
    const TREE_SWIPE_FLICK_V = 0.5;       // px/мс — скорость флика влево

    function treeSwipeKey(panel) {
        const tree = panel.querySelector('[id$="Tree"]');
        return tree ? tree.id : null;
    }

    // Завершение жеста. Инлайновый transform на время перетаскивания
    // перекрывает CSS, поэтому снимаем его после снятия класса drag,
    // и анимацию (закрытие или возврат) доигрывает CSS-переход .25s.
    function treeSwipeRelease(panel, key, close) {
        delete treeSwipeStates[key];
        panel.classList.remove('tree-swipe-dragging');
        if (close) {
            setTreePanelOpen(false);
            requestAnimationFrame(function() {
                panel.style.transform = '';
            });
        } else {
            panel.style.transform = '';
        }
    }

    function treeSwipeShouldClose(st, x) {
        const dx = x - st.x;
        const first = st.samples[0];
        const velocity = (x - first.x) / Math.max(1, Date.now() - first.t);
        return dx < -TREE_SWIPE_CLOSE_PX ||
            velocity < -TREE_SWIPE_FLICK_V;
    }

    document.querySelectorAll('.tree-panel').forEach(function(panel) {
        const key = treeSwipeKey(panel);
        if (!key) return;

        panel.addEventListener('touchstart', function(e) {
            if (!window.matchMedia('(max-width: 849px)').matches) return;
            if (e.touches.length !== 1) {
                if (treeSwipeStates[key]) treeSwipeRelease(panel, key, false);
                return;
            }
            treeSwipeStates[key] = {
                x: e.touches[0].clientX,
                lastX: e.touches[0].clientX,
                y: e.touches[0].clientY,
                locked: false,
                samples: [{ x: e.touches[0].clientX, t: Date.now() }]
            };
        }, { passive: true });

        panel.addEventListener('touchmove', function(e) {
            const st = treeSwipeStates[key];
            if (!st) return;
            if (e.touches.length !== 1) { treeSwipeRelease(panel, key, false); return; }
            const t = e.touches[0];
            st.lastX = t.clientX;
            const dx = t.clientX - st.x;
            const dy = t.clientY - st.y;
            if (!st.locked) {
                if (Math.abs(dx) > TREE_SWIPE_LOCK_PX && Math.abs(dx) > Math.abs(dy)) {
                    st.locked = true;
                    panel.classList.add('tree-swipe-dragging');
                } else {
                    return; // замка нет — не мешаем нативному скроллу дерева
                }
            }
            if (e.cancelable) e.preventDefault();
            // Окно скорости: держим сэмплы за последние 120 мс для флика.
            const now = Date.now();
            st.samples.push({ x: t.clientX, t: now });
            while (st.samples.length > 1 && now - st.samples[0].t > 120) st.samples.shift();
            const clamped = Math.max(-panel.offsetWidth, Math.min(0, dx));
            panel.style.transform = 'translateX(' + clamped + 'px)';
        }, { passive: false });

        panel.addEventListener('touchend', function(e) {
            const st = treeSwipeStates[key];
            if (!st) return;
            if (!st.locked) {
                treeSwipeRelease(panel, key, false);
                return;
            }
            const x = e.changedTouches[0] ? e.changedTouches[0].clientX : st.lastX;
            treeSwipeRelease(panel, key, treeSwipeShouldClose(st, x));
        }, { passive: true });
        panel.addEventListener('touchcancel', function(e) {
            const st = treeSwipeStates[key];
            if (!st) return;
            const x = e.changedTouches[0] ? e.changedTouches[0].clientX : st.lastX;
            const movedLeft = x - st.x < -TREE_SWIPE_CLOSE_PX;
            treeSwipeRelease(panel, key,
                movedLeft || (st.locked && treeSwipeShouldClose(st, x)));
        }, { passive: true });
    });

    window.addEventListener('resize', updateTreePanelOffset);
    window.addEventListener('load', updateTreePanelOffset);
    updateTreePanelOffset();
}

// ===== СКРОЛЛЯЩИЕСЯ КНОПКИ ВКЛАДОК (МОБИЛЬНЫЕ) =====
// На мобильной ширине строка кнопок GTO/Редактор/Просмотр перемещается
// внутрь активной страницы — она прокручивается вместе с контентом и
// уезжает вверх при скролле. На десктопе возвращается в шапку.
// Паттерн тот же, что у updateConstructorModeToolbarPosition.
const tabButtons = document.getElementById('tabButtons');
const authPanel = document.getElementById('authPanel');
const tabButtonsMobileQuery = window.matchMedia('(max-width: 849px)');

function updateTabButtonsPosition() {
    if (!tabButtons || !mainTabs) return;

    const activePage = document.querySelector('.page.active-page');
    if (tabButtonsMobileQuery.matches && activePage) {
        if (tabButtons.parentElement !== activePage) {
            activePage.insertBefore(tabButtons, activePage.firstChild);
        }
    } else if (tabButtons.parentElement !== mainTabs) {
        // Возвращаем в шапку на исходное место (перед панелью аккаунта).
        if (authPanel) {
            mainTabs.insertBefore(tabButtons, authPanel);
        } else {
            mainTabs.appendChild(tabButtons);
        }
    }
    // Кнопка «Фильтр» GTO следует за строкой вкладок: на мобильных она
    // уезжает в её правый край, на десктопе возвращается на своё место.
    updateGtoFilterTogglePosition();
    // Высота шапки изменилась — пересчитываем отступ шторки дерева.
    updateTreePanelOffset();
}

// ===== ПОЗИЦИЯ КНОПКИ «ФИЛЬТР» GTO (МОБИЛЬНЫЕ) =====
// На мобильной ширине кнопка переносится в конец строки вкладок
// (GTO / Редактор / Просмотр) и прижимается к правому краю экрана.
// На десктопе возвращается в .gto-filter-area перед панелью фильтров.
// Паттерн тот же, что у updateConstructorModeToolbarPosition.
// Элементы ищутся через getElementById: функция вызывается из
// updateTabButtonsPosition, которая объявлена выше по файлу, чем
// const gtoFilterToggle/gtoFilterBar, — так она не зависит от их TDZ.
const gtoFilterToggleMobileQuery = window.matchMedia('(max-width: 849px)');

function updateGtoFilterTogglePosition() {
    const toggle = document.getElementById('gtoFilterToggle');
    const bar = document.getElementById('gtoFilterBar');
    const tabButtonsEl = document.getElementById('tabButtons');
    if (!toggle || !bar || !tabButtonsEl) return;

    const filterArea = bar.parentElement;
    if (gtoFilterToggleMobileQuery.matches && tabButtonsEl.parentElement && tabButtonsEl.parentElement.id === 'gtoPage') {
        // Мобильные: строка вкладок лежит внутри #gtoPage — кнопка встаёт
        // последней в строке и уходит к правому краю (margin-left: auto).
        if (toggle.parentElement !== tabButtonsEl) {
            tabButtonsEl.appendChild(toggle);
        }
    } else if (filterArea && toggle.parentElement !== filterArea) {
        // Десктоп либо строка вкладок ещё в шапке: исходное место в разметке.
        filterArea.insertBefore(toggle, bar);
    }
}

// Точка входа для switchTab (navigation.js) и обработчиков ресайза.
App.ui = App.ui || {};
App.ui.updateTabButtonsPosition = updateTabButtonsPosition;
App.ui.updateTreePanelOffset = updateTreePanelOffset;

window.addEventListener('resize', updateTabButtonsPosition);

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
            const node = App.nodes.getNode(App.state.currentNodeId);
            const message = node
                ? App.i18n.t('range.saveChangesNamedQuestion', { name: node.name })
                : App.i18n.t('range.saveChangesQuestion');

            // Да — сохраняем изменения перед переключением вкладки, Нет —
            // откатываемся и переключаем (App.ui.saveAndContinue / rollbackAndContinue).
            App.modals.showSaveConfirmModal(message, App.ui.saveAndContinue(function() {
                App.navigation.switchTab(page);
            }), App.ui.rollbackAndContinue(function() {
                App.navigation.switchTab(page);
            }));
            return;
        }

        App.navigation.switchTab(page);
    };
});

// ========== НАВИГАЦИОННАЯ ПАНЕЛЬ ДЕРЕВА ==========

document.getElementById('treeAddFolderBtn')?.addEventListener('click', App.tree.addRootNode);

// Создание корневого диапазона перенесено в tree.js (App.tree.addRootRange),
// чтобы тулбар и popup-меню папки вели себя одинаково, включая стартовый цвет.
document.getElementById('treeAddRangeBtn')?.addEventListener('click', App.tree.addRootRange);

document.getElementById('treeRenameBtn')?.addEventListener('click', () => {
    if (App.state.selectedNodeId) {
        const node = App.nodes.getNode(App.state.selectedNodeId);
        if (node) {
            App.tree.startInlineRename(App.state.selectedNodeId);
        } else {
            App.modals.showFloatingModal(App.i18n.t('tree.noActiveNodeToRename'));
        }
    }
});

document.getElementById('treeMoveUpBtn')?.addEventListener('click', () => {
    if (App.state.selectedNodeId) App.tree.moveNodeUp(App.state.selectedNodeId);
});

document.getElementById('treeMoveDownBtn')?.addEventListener('click', () => {
    if (App.state.selectedNodeId) App.tree.moveNodeDown(App.state.selectedNodeId);
});

document.getElementById('treeDeleteBtn')?.addEventListener('click', () => {
    if (App.state.selectedNodeId) App.tree.deleteNode(App.state.selectedNodeId);
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

    // Состояние свёрнутости — часть метаданных, помечаем для сохранения
    if (App.dirty) App.dirty.markMetadataDirty('editor');
    App.persistence.persistAll();
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

    // Состояние свёрнутости — часть метаданных, помечаем для сохранения
    if (App.dirty) App.dirty.markMetadataDirty('gto');
    App.persistence.persistAll();
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
    App.persistence.persistAll();
});

document.getElementById('analysisModeBtn')?.addEventListener('click', function() {
    if (App.state.analysisMode) return;
    App.state.analysisMode = true;
    App.grid.refreshConstructorAnalysisMode();
    if (App.dirty) App.dirty.markMetadataDirty('editor');
    App.persistence.persistAll();
});


document.getElementById('tableClearBtn')?.addEventListener('click', () => {
    if (App.state.analysisMode) return;
    if (!App.state.currentNodeId) return;

    const node = App.nodes.getNode(App.state.currentNodeId);
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
        App.persistence.markUnsaved();
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
    // ES-модули матрицы (js/modules/grid/grid-*.js) исполняются асинхронно
    // после классических скриптов. Если auth/storage успевают отработать
    // раньше, чем догрузятся модули, App.grid ещё не существует и
    // App.refresh.all() падает сразу после отрисовки дерева: дерево есть,
    // матрицы нет (лечится F5). Поэтому явно дожидаемся модулей — параллельно
    // с остальной инициализацией, так что обычный старт не замедляется.
    function waitForGridModules(timeoutMs) {
        if (App.grid) return Promise.resolve();
        return new Promise(function(resolve) {
            var started = Date.now();
            var timer = setInterval(function() {
                if (App.grid || Date.now() - started > timeoutMs) {
                    clearInterval(timer);
                    resolve();
                }
            }, 25);
        });
    }

    function switchTabWhenReady(tab) {
        return waitForGridModules(10000).then(function() {
            App.navigation.switchTab(tab);
            if (tab === 'constructor' && App.state.analysisMode) {
                App.grid.refreshConstructorAnalysisMode();
            }
            App.grid.updateConstructorToolbarState();
            App.comments.initComments();
            initTreeResize();
        });
    }

    App.auth.checkSession().then(function() {
        return Promise.all([
            App.storage.initialize(),
            waitForGridModules(10000)
        ]);
    }).then(function() {
        return App.persistence.loadFromStorage().then(function(tab) {
            return tab || 'constructor';
        });
    }).then(function(activeTab) {
        return switchTabWhenReady(activeTab);
    }).catch(function(error) {
        console.error('Ошибка инициализации хранилища:', error);
        App.persistence.loadFromStorage().then(function(activeTab) {
            return switchTabWhenReady(activeTab || 'constructor');
        }).catch(function(loadError) {
            console.error('Ошибка резервной загрузки состояния:', loadError);
            return switchTabWhenReady('constructor');
        });
    }).then(function() {
        initialLoadDone = true;
    });
})();
