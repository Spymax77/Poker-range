// ===== tooltip-clamp.js — зажатие кастомных тултипов в границах экрана =====
//
// Тултипы кнопок — псевдоэлементы ::after, позиционируемые от кнопки
// (styles/components.css «КАСТОМНЫЙ ТУЛТИП», .matrix-btn, .style-reset-btn,
// styles/palette.css .multi-add-chip-btn). У кнопок у правого края тултип
// (white-space: nowrap, центр по кнопке) вылезал за экран. На мобильном Chrome
// это не давало скроллбар, а РАСШИРЯЛ layout-вьюпорт (на замерах: innerWidth
// 360 → 393 — ровно на вылезание тултипа в 33px), визуальный вьюпорт оставался
// 360 и панорамировался внутри расширенного — сайт «уезжал» вбок. Правило
// html { overflow-x: hidden } из mobile.css этого не останавливает.
//
// Фикс — тот же приём, что у тултипа ячейки матрицы (grid-tooltip.js,
// positionTooltip): считаем позицию «по центру кнопки» и зажимаем в границы
// экрана с отступом EDGE px. Результат отдаём в CSS через переменную
// --tt-shift, которую используют правила left (components.css/palette.css).
//
// Псевдоэлемент не имеет getBoundingClientRect, но его ширина читается через
// getComputedStyle(el, '::after') — width возвращается в пикселях (измерено:
// 104.19px контента + 14 + 14 паддингов + 2 бордера = 133.33px полной ширины,
// сходится с translateX(-50%) = -66.6652px из transform).
//
// Один делегированный обработчик на документе: наведение/фокус — зажатие,
// скролл/ресайс/панорамирование вьюпорта — пересчёт уже показанного тултипа.
(function() {
    'use strict';

    const EDGE = 8;                       // отступ тултипа от края экрана, px
    const SELECTOR = '[data-tooltip]';

    // Семейства с левым якорем (в CSS left начинался с 0) — базовая позиция =
    // левый край кнопки. Остальные (.toolbar-btn, .style-reset-btn) центрируются
    // по кнопке через translateX(-50%) — база = центр кнопки минус половина
    // ширины тултипа.
    function isLeftAnchored(el) {
        return el.matches('.matrix-btn, .multi-add-chip-btn, .tree-toolbar .toolbar-btn:first-child');
    }

    // Полная ширина тултипа: content-width + паддинги + бордеры.
    // 0 — если у элемента нет ::after (не наше семейство) или он скрыт.
    function tooltipWidth(el) {
        const s = getComputedStyle(el, '::after');
        if (s.content === 'none' || s.display === 'none') return 0;
        const w = parseFloat(s.width);
        if (!w) return 0;
        return w +
            (parseFloat(s.paddingLeft) || 0) +
            (parseFloat(s.paddingRight) || 0) +
            (parseFloat(s.borderLeftWidth) || 0) +
            (parseFloat(s.borderRightWidth) || 0);
    }

    function clampOne(el) {
        const w = tooltipWidth(el);
        if (!w) return;

        // documentElement.clientWidth, а НЕ window.innerWidth: на мобильном
        // innerWidth как раз раздувается вместе со страницей (баг, который чиним),
        // а clientWidth остаётся шириной экрана (360 в замерах).
        const vw = document.documentElement.clientWidth;
        const r = el.getBoundingClientRect();

        const baseLeft = isLeftAnchored(el)
            ? r.left
            : r.left + r.width / 2 - w / 2;

        // зажатие в [EDGE ; vw - EDGE - w]; если тултип шире экрана — по левому краю
        const clamped = Math.min(
            Math.max(baseLeft, EDGE),
            Math.max(EDGE, vw - EDGE - w)
        );

        el.style.setProperty('--tt-shift', (clamped - baseLeft) + 'px');
    }

    function closestTooltip(target) {
        return target && target.closest ? target.closest(SELECTOR) : null;
    }

    function hoveredTooltip() {
        return document.querySelector(SELECTOR + ':hover');
    }

    // Наведение (мышь и синтезированный hover при тапе) и клавиатурный фокус —
    // зажатие к моменту показа, позиция верна сразу.
    document.addEventListener('mouseover', function(e) {
        const el = closestTooltip(e.target);
        if (el) clampOne(el);
    }, true);

    document.addEventListener('focusin', function(e) {
        const el = closestTooltip(e.target);
        if (el) clampOne(el);
    });

    // Пересчёт уже показанного тултипа: скролл (в т.ч. внутренние контейнеры —
    // capture), ресайс и панорамирование визуального вьюпорта на мобильном.
    function recalc() {
        const el = hoveredTooltip();
        if (el) clampOne(el);
    }
    window.addEventListener('scroll', recalc, true);
    window.addEventListener('resize', recalc);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('scroll', recalc);
        window.visualViewport.addEventListener('resize', recalc);
    }
})();
