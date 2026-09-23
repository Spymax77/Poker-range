// ============================================================
// auth.js — клиентская авторизация (регистрация/вход/выход/восстановление)
// ============================================================
App.auth = App.auth || {};

(function() {
    const API_URL = 'https://pfrange.ru/api/auth-api.php';

    let currentUser = null;   // { id, login, email } | null

    async function request(action, method, body) {
        const opts = {
            method: method,
            credentials: 'include',
            headers: {},
        };
        if (body) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const url = API_URL + '?action=' + encodeURIComponent(action);
        let response;
        try {
            response = await fetch(url, opts);
        } catch (e) {
            return { success: false, error: App.i18n.t('auth.networkError') };
        }
        let json;
        try {
            json = await response.json();
        } catch (e) {
            return { success: false, error: App.i18n.t('auth.badResponse') };
        }
        // Клиент переводит код ответа через словарь локализации (см.
        // russian-text-inventory.md, решение №9). Серверный текст используется
        // только как запасной вариант для нераспознанных кодов.
        if (json && json.code) {
            if (json.success === false && json.error !== undefined) {
                json.error = App.i18n.translateApiCode(json.code, json.error);
            }
            if (json.message !== undefined) {
                json.message = App.i18n.translateApiCode(json.code, json.message);
            }
        }
        return json;
    }

    // ===== ПРОВЕРКА ТЕКУЩЕЙ СЕССИИ (при старте приложения) =====
    App.auth.checkSession = async function() {
        const result = await request('me', 'GET');
        currentUser = (result && result.success && result.user) ? result.user : null;
        App.events.emit('auth:changed', currentUser);
        return currentUser;
    };

    App.auth.isLoggedIn = function() {
        return currentUser !== null;
    };

    App.auth.getCurrentUser = function() {
        return currentUser;
    };

    // ===== РЕГИСТРАЦИЯ =====
    App.auth.register = async function(login, email, password, passwordConfirm) {
        const result = await request('register', 'POST', {
            login: login,
            email: email,
            password: password,
            password_confirm: passwordConfirm,
        });
        if (result && result.success && result.user) {
            currentUser = result.user;
            App.events.emit('auth:changed', currentUser);
        }
        return result;
    };

    // ===== ВХОД =====
    App.auth.login = async function(login, password) {
        const result = await request('login', 'POST', { login: login, password: password });
        if (result && result.success && result.user) {
            currentUser = result.user;
            App.events.emit('auth:changed', currentUser);
        }
        return result;
    };

    // ===== ВЫХОД =====
    App.auth.logout = async function() {
        const result = await request('logout', 'POST', {});
        currentUser = null;
        App.events.emit('auth:changed', null);
        return result;
    };

    // ===== ВОССТАНОВЛЕНИЕ ПАРОЛЯ =====
    App.auth.forgotPassword = async function(email) {
        return request('forgot_password', 'POST', {
            email: email,
            lang: App.i18n.getLanguage(),
        });
    };

    App.auth.resetPassword = async function(token, password, passwordConfirm) {
        return request('reset_password', 'POST', {
            token: token,
            password: password,
            password_confirm: passwordConfirm,
        });
    };

    // ===== СООБЩЕНИЕ "ТРЕБУЕТСЯ АВТОРИЗАЦИЯ" (вызывается из storage.js) =====
    App.auth.requireAuthNotice = function() {
        App.events.emit('auth:required');
    };
})();
