// ===== layout.js — адаптивный layout (брейкпоинты, позиции тулбаров, resize) =====

App.layout = App.layout || {};

// ===== БРЕЙКПОИНТЫ (общие для мобильных секций ниже) =====
// Один MediaQueryList на брейкпоинт: раньше каждый блок (tabs / tree swipe /
// gto filter / constructor toolbar) создавал свой matchMedia с той же строкой.
const MOBILE_QUERY = '(max-width: 849px)';
const MOBILE_TABS_QUERY = '(max-width: 530px)';
App.layout.mobileQuery = window.matchMedia(MOBILE_QUERY);

// ===== ПОЗИЦИЯ КНОПКИ «ФИЛЬТР» GTO (МОБИЛЬНЫЕ) =====
// На мобильной ширине кнопка переносится в конец строки вкладок
// (GTO / Редактор / Просмотр) и прижимается к правому краю экрана.
// На десктопе возвращается в .gto-filter-area перед панелью фильтров.
// Паттерн тот же, что у updateConstructorModeToolbarPosition.
// Элементы ищутся через getElementById: функция вызывается из
// App.tabs.updateButtonsPosition (tabs.js), поэтому не зависит от TDZ
// const gtoFilterToggle/gtoFilterBar в этом файле.

App.layout.updateGtoFilterTogglePosition = function() {
    const toggle = document.getElementById('gtoFilterToggle');
    const bar = document.getElementById('gtoFilterBar');
    const tabButtonsEl = document.getElementById('tabButtons');
    if (!toggle || !bar || !tabButtonsEl) return;

    const filterArea = bar.parentElement;
    if (App.layout.mobileQuery.matches && tabButtonsEl.parentElement && tabButtonsEl.parentElement.id === 'gtoPage') {
        // Мобильные: строка вкладок лежит внутри #gtoPage — кнопка встаёт
        // последней в строке и уходит к правому краю (margin-left: auto).
        if (toggle.parentElement !== tabButtonsEl) {
            tabButtonsEl.appendChild(toggle);
        }
    } else if (filterArea && toggle.parentElement !== filterArea) {
        // Десктоп либо строка вкладок ещё в шапке: исходное место в разметке.
        filterArea.insertBefore(toggle, bar);
    }
};

// Точка входа для switchTab (navigation.js) — App.tabs.updateButtonsPosition;
// на resize функция зовётся через единый App.layout.updateAll (см. ниже).

// ===== МОБИЛЬНАЯ ПАНЕЛЬ ФИЛЬТРОВ GTO =====
const gtoFilterToggle = document.getElementById('gtoFilterToggle');
const gtoFilterBar = document.getElementById('gtoFilterBar');

App.layout.updateMobileGtoFilterState = function() {
    if (!gtoFilterToggle || !gtoFilterBar) return;

    if (!App.layout.mobileQuery.matches) {
        gtoFilterBar.classList.remove('gto-filter-open');
        gtoFilterToggle.setAttribute('aria-expanded', 'false');
    }
};

if (gtoFilterToggle && gtoFilterBar) {
    gtoFilterToggle.addEventListener('click', function() {
        const isOpen = gtoFilterBar.classList.toggle('gto-filter-open');
        gtoFilterToggle.setAttribute('aria-expanded', String(isOpen));
    });

    App.layout.updateMobileGtoFilterState();
}

// ===== АДАПТИВНОЕ ПОЛОЖЕНИЕ КНОПОК РЕЖИМОВ КОНСТРУКТОРА =====
const constructorModeToolbar = document.querySelector('#constructorPage .matrix-mode-toolbar');
const constructorMatrixRow = document.querySelector('#constructorPage .matrix-row');
const constructorToolbarRight = document.querySelector('#constructorPage .toolbar-right');

App.layout.updateConstructorModeToolbarPosition = function() {
    if (!constructorModeToolbar || !constructorMatrixRow || !constructorToolbarRight) return;

    if (App.layout.mobileQuery.matches) {
        if (constructorModeToolbar.parentElement !== constructorToolbarRight) {
            constructorToolbarRight.appendChild(constructorModeToolbar);
        }
    } else if (constructorModeToolbar.parentElement !== constructorMatrixRow) {
        constructorMatrixRow.insertBefore(constructorModeToolbar, constructorMatrixRow.firstElementChild);
    }
};

if (constructorModeToolbar && constructorMatrixRow && constructorToolbarRight) {
    App.layout.updateConstructorModeToolbarPosition();
}

// ===== ЕДИНЫЙ ОБРАБОТЧИК RESIZE =====
// Раньше каждая мобильная секция подписывалась на resize отдельно (пять
// слушателей), и каждое событие ресайза приводило до пяти перерисовок подряд.
// Теперь один обработчик с rAF-троттлингом вызывает их по порядку; сами
// функции идемпотентны и сами проверяют наличие своих элементов.
App.layout.updateAll = function() {
    App.tabs.updateMobileState();
    App.tabs.updateButtonsPosition();
    App.layout.updateMobileGtoFilterState();
    App.layout.updateConstructorModeToolbarPosition();
    App.treePanel.updateOffset();
};

let layoutRafId = null;
window.addEventListener('resize', function() {
    if (layoutRafId !== null) return;
    layoutRafId = requestAnimationFrame(function() {
        layoutRafId = null;
        App.layout.updateAll();
    });
});
