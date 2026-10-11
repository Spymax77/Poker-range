// ===== tree-panel.js — панель дерева (шторка, свайп, ширина) =====

App.treePanel = App.treePanel || {};

// На touch-устройствах удерживаем расширенное дерево только на время работы
// с каталогом. После касания матрицы или другой области оно снова становится
// компактным, чтобы освободить место для рабочей области.
App.treePanel.onPointerDown = function(e) {
    if (e.pointerType !== 'touch') return;
    const treePanel = e.target.closest?.('.tree-panel');
    document.querySelectorAll('.tree-panel.tree-interacting').forEach(panel => {
        if (panel !== treePanel) panel.classList.remove('tree-interacting');
    });
    if (treePanel) treePanel.classList.add('tree-interacting');
};
document.addEventListener('pointerdown', App.treePanel.onPointerDown);

// ===== МОБИЛЬНАЯ ВЫЕЗЖАЮЩАЯ ПАНЕЛЬ ДЕРЕВА (GTO / Редактор) =====
// Кнопка «три полоски» в шапке выезжает деревом слева поверх матрицы.
// Закрытие: повторное нажатие, касание вне панели, свайп влево по панели
// или смена вкладки.
const tabsMenuToggle = document.getElementById('tabsMenuToggle');

App.treePanel.setOpen = function(open) {
    document.body.classList.toggle('tree-open', open);
    if (tabsMenuToggle) {
        tabsMenuToggle.setAttribute('aria-expanded', String(open));
        tabsMenuToggle.setAttribute(
            'aria-label',
            open ? App.i18n.t('tree.hidePanel') : App.i18n.t('tree.openPanel')
        );
    }
};

// Высота шапки передаётся в CSS-переменную, чтобы шторка дерева
// начиналась ровно под ней.
App.treePanel.updateOffset = function() {
    const mainTabsEl = document.getElementById('mainTabs');
    if (!mainTabsEl) return;
    document.documentElement.style.setProperty(
        '--mobile-header-h',
        mainTabsEl.offsetHeight + 'px'
    );
};

if (tabsMenuToggle) {
    tabsMenuToggle.addEventListener('click', function() {
        App.treePanel.setOpen(!document.body.classList.contains('tree-open'));
    });

    // Касание вне панели дерева (по матрице и любому другому месту) закрывает её.
    document.addEventListener('pointerdown', function(e) {
        if (!document.body.classList.contains('tree-open')) return;
        if (e.target.closest && (e.target.closest('.tree-panel') || e.target.closest('#tabsMenuToggle'))) return;
        App.treePanel.setOpen(false);
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

    const treeSwipeKey = function(panel) {
        const tree = panel.querySelector('[id$="Tree"]');
        return tree ? tree.id : null;
    };

    // Завершение жеста. Инлайновый transform на время перетаскивания
    // перекрывает CSS, поэтому снимаем его после снятия класса drag,
    // и анимацию (закрытие или возврат) доигрывает CSS-переход .25s.
    const treeSwipeRelease = function(panel, key, close) {
        delete treeSwipeStates[key];
        panel.classList.remove('tree-swipe-dragging');
        if (close) {
            App.treePanel.setOpen(false);
            requestAnimationFrame(function() {
                panel.style.transform = '';
            });
        } else {
            panel.style.transform = '';
        }
    };

    const treeSwipeShouldClose = function(st, x) {
        const dx = x - st.x;
        const first = st.samples[0];
        const velocity = (x - first.x) / Math.max(1, Date.now() - first.t);
        return dx < -TREE_SWIPE_CLOSE_PX ||
            velocity < -TREE_SWIPE_FLICK_V;
    };

    document.querySelectorAll('.tree-panel').forEach(function(panel) {
        const key = treeSwipeKey(panel);
        if (!key) return;

        panel.addEventListener('touchstart', function(e) {
            if (!App.layout.mobileQuery.matches) return;
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

    window.addEventListener('load', App.treePanel.updateOffset);
    App.treePanel.updateOffset();
}

// ===== ИЗМЕНЕНИЕ ШИРИНЫ ПАНЕЛИ ДЕРЕВА ПЕРЕТАСКИВАНИЕМ =====
// Ширина запоминается между сессиями (localStorage, ключ по id дерева внутри
// панели). Восстанавливается только на десктопе: на мобильных ширину задаёт
// раскладка, инлайн-стиль не должен её перебивать.
const TREE_PANEL_WIDTH_KEY = 'treePanelWidth:';
const TREE_PANEL_MIN_WIDTH = 250; // тулбар сам перенесётся через flex-wrap
const TREE_PANEL_MAX_WIDTH = 700;

App.treePanel.initResize = function() {
    document.querySelectorAll('.tree-panel').forEach(panel => {
        // Не добавляем повторно
        if (panel.querySelector('.tree-resize-handle')) return;

        const handle = document.createElement('div');
        handle.className = 'tree-resize-handle';
        panel.appendChild(handle);

        const panelKey = (panel.querySelector('[id$="Tree"]') || {}).id || 'tree';

        const applyWidth = function(widthPx) {
            const clamped = Math.max(TREE_PANEL_MIN_WIDTH, Math.min(TREE_PANEL_MAX_WIDTH, widthPx));
            panel.style.width = clamped + 'px';
            panel.style.minWidth = clamped + 'px';
            panel.style.flex = '0 0 ' + clamped + 'px';
        };

        try {
            const savedWidth = Number(localStorage.getItem(TREE_PANEL_WIDTH_KEY + panelKey));
            if (savedWidth && !App.layout.mobileQuery.matches) applyWidth(savedWidth);
        } catch (err) { /* localStorage недоступен — работаем без запоминания */ }

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
                // Страховка от пропущенного mouseup (мышь отпущена вне окна).
                if (e.buttons === 0) { onMouseUp(); return; }
                applyWidth(startWidth + (e.clientX - startX));
            }

            function onMouseUp() {
                handle.classList.remove('active');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                // Отпускание мыши вне окна браузера приходит как blur окна —
                // снимаем и его слушатель, иначе обработчики и стили body
                // «залипают» навсегда.
                window.removeEventListener('blur', onMouseUp);
                try {
                    localStorage.setItem(TREE_PANEL_WIDTH_KEY + panelKey, String(panel.offsetWidth));
                } catch (err) { /* localStorage недоступен */ }
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            window.addEventListener('blur', onMouseUp);
        });
    });
};
