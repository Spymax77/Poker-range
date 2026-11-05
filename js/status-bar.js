// ===== status-bar.js — индикатор статуса сохранения (storage:*) =====

App.status = App.status || {};

App.events.on('storage:loading', function() {
    const status = document.getElementById('saveStatus');
    // Отдельный класс loading (не saving): иначе при смене языка статус
    // загрузки переписывался бы текстом «Сохранение…» (см. languagechange ниже).
    if (status) { status.textContent = App.i18n.t('status.loading'); status.className = 'save-status loading'; }
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
// Ошибка записи с планируемым повтором (retry-очередь storage.js активна) —
// показываем «повторная попытка», а не пугающую «Ошибка синхронизации»:
// данные будут дозаписаны автоматически. Финальная «Ошибка синхронизации»
// остаётся за событиями БЕЗ повтора (сбой загрузки и т.п.).
App.events.on('storage:retrying', function() {
    const status = document.getElementById('saveStatus');
    if (status) { status.textContent = App.i18n.t('status.retrying'); status.className = 'save-status retrying'; }
});

App.status.onLanguageChange = function() {
    const status = document.getElementById('saveStatus');
    if (status && status.classList.contains('loading')) {
        status.textContent = App.i18n.t('status.loading');
    } else if (status && status.classList.contains('saving')) {
        status.textContent = App.i18n.t('status.saving');
    } else if (status && status.classList.contains('saved')) {
        status.textContent = App.i18n.t('status.synced');
    } else if (status && status.classList.contains('error')) {
        status.textContent = App.i18n.t('status.error');
    } else if (status && status.classList.contains('retrying')) {
        status.textContent = App.i18n.t('status.retrying');
    }
};
document.addEventListener('languagechange', App.status.onLanguageChange);
