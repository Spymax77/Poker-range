// ===== auth-ui.js — авторизация (диалог, меню аккаунта, перезагрузка данных) =====

// Хелперы «Сохранить и продолжить» / «Откатиться и продолжить» вынесены в
// ui-utils.js (App.ui.saveAndContinue / App.ui.rollbackAndContinue): этот файл
// загружается раньше navigation.js и clipboard.js, которые ими пользуются.

App.authUi = App.authUi || {};

App.authUi.showDialog = function(mode) {
    const oldOverlay = document.querySelector('.auth-dialog-overlay');
    if (oldOverlay) {
        // Снимаем слушатель клавиш старого диалога (см. dialogKeys ниже).
        if (oldOverlay._dialogKeys) oldOverlay._dialogKeys.abort();
        oldOverlay.remove();
    }

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

    modal.innerHTML = formHtml;
    // Кнопку закрытия собираем DOM-ом: aria-label через setAttribute,
    // а не конкатенацией в HTML-строку (кавычки в переводе её бы ломали).
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'auth-dialog-close';
    closeBtn.setAttribute('aria-label', App.i18n.t('auth.close'));
    closeBtn.innerHTML = '&times;';
    modal.prepend(closeBtn);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    // Глаз-переключатель видимости пароля во всех парольных полях формы
    modal.querySelectorAll('input[type="password"]').forEach(function(input) {
        App.ui.addPasswordToggle(input);
    });
    // Контроллер слушателя клавиш: живёт на document, чтобы ловить Escape/Tab
    // и когда фокус вне диалога; снимается при закрытии или смене режима.
    const dialogKeys = new AbortController();

    function closeDialog() {
        dialogKeys.abort();
        overlay.remove();
    }

    modal.querySelector('.auth-dialog-close').addEventListener('click', closeDialog);

    // Escape — закрыть диалог; Tab зацикливается внутри него, фокус не должен
    // уходить под оверлей.
    document.addEventListener('keydown', function(e) {
        if (!overlay.isConnected) {
            dialogKeys.abort();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDialog();
            return;
        }
        if (e.key === 'Tab') {
            const focusables = modal.querySelectorAll(
                'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
            );
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, { signal: dialogKeys.signal });

    // Ссылка на контроллер — чтобы снять слушатель при переключении режима
    // (showAuthDialog удаляет старый оверлей в начале).
    overlay._dialogKeys = dialogKeys;

    // Фокус в первое поле формы при открытии диалога.
    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();
    modal.querySelectorAll('[data-auth-mode]').forEach(function(button) {
        button.addEventListener('click', function() { App.authUi.showDialog(button.dataset.authMode); });
    });
    modal.querySelector('form').addEventListener('submit', async function(event) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const errorElement = modal.querySelector('#authDialogError');
        const submit = modal.querySelector('.auth-submit');
        submit.disabled = true;
        errorElement.textContent = '';
        try {
            let result;
            if (isForgot) {
                result = await App.auth.forgotPassword(form.get('email'));
            } else if (isRegister) {
                result = await App.auth.register(form.get('login'), form.get('email'), form.get('password'), form.get('passwordConfirm'));
            } else {
                result = await App.auth.login(form.get('login'), form.get('password'));
            }
            if (result && result.success) {
                closeDialog();
                if (isForgot) App.modals.showFloatingModal(result.message || App.i18n.t('auth.forgotSent'));
            } else {
                errorElement.textContent = (result && (result.error || result.message)) || App.i18n.t('auth.operationFailed');
            }
        } catch (error) {
            // Исключение из App.auth.* не должно оставлять форму «зависшей»
            // с заблокированной кнопкой — показываем ошибку.
            console.error('Ошибка авторизации:', error);
            errorElement.textContent = App.i18n.t('auth.operationFailed');
        } finally {
            submit.disabled = false;
        }
    });
};

App.authUi.closeMenu = function() {
    const dropdown = document.getElementById('authDropdown');
    const btn = document.getElementById('authAvatarBtn');
    if (dropdown) dropdown.classList.remove('open');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('menu-open');
    }
};

App.authUi.updateUi = function(user) {
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
        // Логин — первичный идентификатор аккаунта в карточке (над емейлом).
        const login = user && user.login ? user.login : '';
        userName.textContent = login;
        userName.hidden = !loggedIn || !login;
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
};

const authAvatarBtn = document.getElementById('authAvatarBtn');
const authDropdown = document.getElementById('authDropdown');
App.authUi.onAvatarClick = function() {
    const willOpen = !authDropdown.classList.contains('open');
    authDropdown.classList.toggle('open', willOpen);
    authAvatarBtn.setAttribute('aria-expanded', String(willOpen));
    authAvatarBtn.classList.toggle('menu-open', willOpen);
};

if (authAvatarBtn && authDropdown) {
    authAvatarBtn.addEventListener('click', App.authUi.onAvatarClick);
}

document.getElementById('authLoginItem')?.addEventListener('click', function() {
    App.authUi.closeMenu();
    App.authUi.showDialog('login');
});
document.getElementById('authRegisterItem')?.addEventListener('click', function() {
    App.authUi.closeMenu();
    App.authUi.showDialog('register');
});
App.authUi.onLogoutClick = function() {
    App.authUi.closeMenu();

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
    // Голый fallback «Сохранить изменения?» (без имени) удалён: если текущий
    // диапазон не существует, спрашивать не о чем — выходим без сохранения.
    if (!node) {
        logout();
        return;
    }
    const message = App.i18n.t('range.saveChangesNamedQuestion', { name: node.name });

    // Да — сохраняем перед выходом из аккаунта; при провале сохранения хелпер
    // покажет range.saveFailed и выход из аккаунта не произойдёт.
    App.modals.showSaveConfirmModal(message, App.ui.saveAndContinue(logout), async function() {
        // Нет — выходим без сохранения
        await logout();
    });
};
document.getElementById('authLogoutItem')?.addEventListener('click', App.authUi.onLogoutClick);

document.addEventListener('click', function(e) {
    const panel = document.getElementById('authPanel');
    if (panel && !panel.contains(e.target)) App.authUi.closeMenu();
});

// Флаг завершения первой загрузки — App.state.initialLoadDone (store.js):
// общий для auth-обработчика ниже и bootstrap-цепочки (bootstrap.js).

App.authUi.reloadAllData = async function() {
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
};

App.authUi.onAuthChanged = function(user) {
    App.authUi.closeMenu();
    App.authUi.updateUi(user);
    if (!App.state.initialLoadDone) return;
    if (user) {
        // Гостевые изменения никогда не переносятся в аккаунт и не
        // сохраняются при входе. Сначала отбрасываем их из памяти, затем
        // загружаем авторитетное состояние пользователя с сервера.
        App.authUi.reloadAllData();
    }
};
App.events.on('auth:changed', App.authUi.onAuthChanged);
App.events.on('auth:required', function() {
    App.modals.showFloatingModal(App.i18n.t('auth.requireAuthToSave'), function() {
        App.authUi.showDialog('login');
    });
});
App.authUi.updateUi(App.auth.getCurrentUser());
