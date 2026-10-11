// ===== tabs.js — вкладки (переключение, мобильное меню, позиция кнопок) =====

App.tabs = App.tabs || {};

// ===== МОБИЛЬНОЕ МЕНЮ ВКЛАДОК =====
const tabsToggle = document.getElementById('tabsToggle');
const mainTabs = document.getElementById('mainTabs');
const mobileTabsQuery = window.matchMedia(MOBILE_TABS_QUERY);


App.tabs.updateMobileState = function() {
    if (!mainTabs || !tabsToggle) return;

    // Панель вкладок по умолчанию открыта; свернутое состояние существует
    // только на мобильной ширине и сбрасывается при возврате на десктоп.
    if (!mobileTabsQuery.matches) {
        mainTabs.classList.remove('tabs-closed');
        document.body.classList.remove('tabs-closed');
        tabsToggle.setAttribute('aria-expanded', 'true');
        tabsToggle.setAttribute('aria-label', App.i18n.t('tabs.showPanelHide'));
    }
};

App.tabs.onToggleClick = function() {
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
};

if (tabsToggle && mainTabs) {
    tabsToggle.addEventListener('click', App.tabs.onToggleClick);

    App.tabs.updateMobileState();
}

// ===== СКРОЛЛЯЩИЕСЯ КНОПКИ ВКЛАДОК (МОБИЛЬНЫЕ) =====
// На мобильной ширине строка кнопок GTO/Редактор/Просмотр перемещается
// внутрь активной страницы — она прокручивается вместе с контентом и
// уезжает вверх при скролле. На десктопе возвращается в шапку.
// Паттерн тот же, что у updateConstructorModeToolbarPosition.
const tabButtons = document.getElementById('tabButtons');
const authPanel = document.getElementById('authPanel');

App.tabs.updateButtonsPosition = function() {
    if (!tabButtons || !mainTabs) return;

    const activePage = document.querySelector('.page.active-page');
    if (App.layout.mobileQuery.matches && activePage) {
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
    App.layout.updateGtoFilterTogglePosition();
    // Высота шапки изменилась — пересчитываем отступ шторки дерева.
    App.treePanel.updateOffset();
};

// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
App.tabs.onTabClick = function(btn) {
    const page = btn.getAttribute("data-page");

    // ===== ПРОВЕРКА ПРИ ПЕРЕКЛЮЧЕНИИ НА ПРОСМОТР =====
    if (page === "work" && App.state.hasUnsavedChanges && App.auth && App.auth.isLoggedIn()) {
        const node = App.nodes.getNode(App.state.currentNodeId);
        // Голый fallback «Сохранить изменения?» (без имени) удалён: если
        // текущий диапазон не существует, спрашивать не о чем — переключаем
        // вкладку молча.
        if (node) {
            const message = App.i18n.t('range.saveChangesNamedQuestion', { name: node.name });

            // Да — сохраняем изменения перед переключением вкладки, Нет —
            // откатываемся и переключаем (App.ui.saveAndContinue / rollbackAndContinue).
            App.modals.showSaveConfirmModal(message, App.ui.saveAndContinue(function() {
                App.navigation.switchTab(page);
            }), App.ui.rollbackAndContinue(function() {
                App.navigation.switchTab(page);
            }));
            return;
        }
    }

    App.navigation.switchTab(page);
};

document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener('click', function() { App.tabs.onTabClick(btn); });
});
