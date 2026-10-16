// ===== trainer-page.js — левая панель вкладки «Тренажёр» =====
// Плоский список узлов тренажёра (см. trainer-store). Каждый узел:
//   - иконка «шапочка учёного» (как кнопка «Режим тренировки» в редакторе),
//   - имя узла — копия названия исходного диапазона на момент добавления,
//   - кнопка «три точки» → popup-меню (как в дереве редактора) с пунктами
//     «Сбросить статистику» и «Удалить из тренировки».
// Разметка повторяет дерево (tree-node/tree-item/popup-menu) — стили и
// поведение меню переиспользуются из styles/components.css без изменений.
// Правая часть вкладки — стол, ГСЧ, кнопки действий и статистика
// (см. trainer-table.js). Состояние тренировки при рендере НЕ сбрасывается:
// сессия переживает переключение вкладок (сравнение
// trainingActiveNodeId === activeNodeId в trainer-table.js).

import { getTrainerNodes, removeTrainerNode, getActiveNodeId, setActiveNodeId } from './trainer-store.js';
import { renderTrainerTable } from './trainer-table.js';
import { resetStats } from './trainer-stats.js';

// Иконка «шапочка учёного» — тот же SVG, что у #trainingModeBtn (index.html).
const CAP_ICON_SVG = '<svg viewBox="0.2 4.3 16.6 11.3">' +
    '<path d="M16.141 7.905c.24.102.24.269 0 .37l-7.204 3.058a1.288 1.288 0 0 1-.874 0L.859 8.276c-.24-.102-.24-.27 0-.371l7.204-3.058a1.287 1.287 0 0 1 .874 0zm-6.833 4.303 3.983-1.69v2.081c0 1.394-2.145 2.524-4.791 2.524s-4.79-1.13-4.79-2.524v-2.082l3.982 1.69a2.226 2.226 0 0 0 1.616 0zm4.94 1.677h1.642v-1.091a.822.822 0 1 0-1.643 0zm.82-3.603a.554.554 0 1 0-.553-.554.554.554 0 0 0 .554.554zm0 1.415a.554.554 0 1 0-.553-.555.554.554 0 0 0 .554.555z"/>' +
    '</svg>';

// Иконка «три точки» — та же SVG, что у tree-menu-btn (tree-render.js).
const DOTS_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M14 5C14 6.10457 13.1046 7 12 7C10.8954 7 10 6.10457 10 5C10 3.89543 10.8954 3 12 3C13.1046 3 14 3.89543 14 5Z" fill="currentColor"/>' +
    '<path d="M14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" fill="currentColor"/>' +
    '<path d="M12 21C13.1046 21 14 20.1046 14 19C14 17.8954 13.1046 17 12 17C10.8954 17 10 17.8954 10 19C10 20.1046 10.8954 21 12 21Z" fill="currentColor"/>' +
    '</svg>';

// (selectedNodeId удалён: активный узел теперь в trainer-store, персистентно в БД)

// ===== POPUP-МЕНЮ УЗЛА (один пункт — «Удалить из тренировки») =====
// Логика открытия/закрытия повторяет buildTreeNodeActions (tree-render.js):
// fixed-позиция у правого края панели, анимации menu-entering/menu-closing,
// закрытие по клику вне меню.
function buildNodeActions(node) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'tree-actions-popup';

    const menuBtn = document.createElement('button');
    menuBtn.className = 'toolbar-btn tree-menu-btn';
    menuBtn.innerHTML = DOTS_ICON_SVG;

    const popupMenu = document.createElement('div');
    popupMenu.className = 'popup-menu';
    popupMenu.style.display = 'none';

    const resetStatsBtn = document.createElement('button');
    resetStatsBtn.innerHTML = '<span class="menu-icon"></span><span class="menu-text">' +
        App.i18n.t('trainer.resetStats') + '</span>';
    resetStatsBtn.onclick = (e) => {
        e.stopPropagation();
        closeMenu();
        resetStats(node.id);
        renderTrainerPage();
    };
    popupMenu.appendChild(resetStatsBtn);

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '<span class="menu-icon"></span><span class="menu-text">' +
        App.i18n.t('trainer.removeFrom') + '</span>';
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        closeMenu();
        App.trainer.removeRange(node.id);
    };
    popupMenu.appendChild(removeBtn);

    actionsDiv.appendChild(menuBtn);
    actionsDiv.appendChild(popupMenu);

    let closeTimer = null;

    function finishClose() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        popupMenu.classList.remove('menu-entering', 'menu-closing');
        popupMenu.style.display = 'none';
        actionsDiv.classList.remove('menu-open');
        document.removeEventListener('click', outsideClick);
        // Сбрасываем позиционирование popup-меню
        popupMenu.style.position = '';
        popupMenu.style.top = '';
        popupMenu.style.left = '';
        popupMenu.style.right = '';
        popupMenu.style.transformOrigin = '';
    }

    function closeMenu() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        popupMenu.classList.remove('menu-entering');
        const wasOpen = popupMenu.style.display === 'block';
        if (!wasOpen) {
            finishClose();
            return;
        }
        // Эффект закрытия как у freebetrange: быстрое затухание ~120мс
        popupMenu.classList.add('menu-closing');
        closeTimer = setTimeout(finishClose, 120);
    }

    function outsideClick(e) {
        if (!actionsDiv.contains(e.target)) closeMenu();
    }

    menuBtn.onclick = (e) => {
        e.stopPropagation();

        // ===== ЗАКРЫВАЕМ ВСЕ ОСТАЛЬНЫЕ МЕНЮ =====
        document.querySelectorAll('.popup-menu').forEach(m => {
            if (m !== popupMenu) {
                m.classList.remove('menu-entering', 'menu-closing');
                m.style.display = 'none';
                m.style.position = '';
                m.style.top = '';
                m.style.left = '';
                m.style.right = '';
                m.style.transformOrigin = '';
                const parent = m.closest('.tree-actions-popup');
                if (parent) parent.classList.remove('menu-open');
            }
        });

        const isOpenMenu = popupMenu.style.display === 'block';
        closeMenu();
        if (!isOpenMenu) {
            popupMenu.classList.remove('menu-closing');
            popupMenu.style.display = 'block';
            // Фиксируем относительно viewport, чтобы меню не обрезалось
            // скроллом дерева (как в tree-render.js).
            const btnRect = menuBtn.getBoundingClientRect();
            const panel = menuBtn.closest('.tree-panel');
            const panelRect = panel ? panel.getBoundingClientRect() : null;
            popupMenu.style.position = 'fixed';
            popupMenu.style.top = (btnRect.top - 4) + 'px';
            popupMenu.style.left = panelRect ? (panelRect.right - 2) + 'px' : (btnRect.right - 2) + 'px';
            popupMenu.style.right = 'auto';

            // Корректируем позицию, если меню выходит за нижнюю границу экрана
            const popupRect = popupMenu.getBoundingClientRect();
            if (popupRect.bottom > window.innerHeight - 8) {
                popupMenu.style.top = Math.max(8, window.innerHeight - popupRect.height - 8) + 'px';
                popupMenu.style.transformOrigin = '0 100%';
            }

            popupMenu.classList.add('menu-entering');
            actionsDiv.classList.add('menu-open');
            document.addEventListener('click', outsideClick);
        }
    };

    return actionsDiv;
}

// ===== СТРОКА УЗЛА =====
function buildNodeItem(node) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';

    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-item' + (getActiveNodeId() === node.id ? ' active' : '');
    itemDiv.dataset.trainerId = node.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tree-item-name';
    nameSpan.textContent = node.name;

    // Иконка «шапочка учёного» перед именем (как iconSpan в tree-render.js).
    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = CAP_ICON_SVG;
    nameSpan.prepend(iconSpan);

    itemDiv.append(nameSpan, buildNodeActions(node));

    // Клик по строке — выбор узла (пока только подсветка: правая часть
    // вкладки пустая до будущего тренажёра).
    itemDiv.onclick = (e) => {
        if (e.target.closest('.tree-actions-popup')) return;
        setActiveNodeId(node.id);
        renderTrainerPage();
    };

    nodeDiv.appendChild(itemDiv);
    return nodeDiv;
}

// ===== РЕНДЕР СПИСКА УЗЛОВ =====
export function renderTrainerPage() {
    const container = document.getElementById('trainerTree');
    if (!container) return;
    container.innerHTML = '';

    const nodes = getTrainerNodes();
    if (nodes.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'trainer-empty-hint';
        hint.textContent = App.i18n.t('trainer.empty');
        container.appendChild(hint);
        // Очищаем правую панель
        renderTrainerTable();
        return;
    }

    for (const node of nodes) {
        container.appendChild(buildNodeItem(node));
    }

    // Рисуем стол, ГСЧ, кнопки действий и статистику для активного узла.
    // Состояние тренировки НЕ сбрасываем: активная сессия переживает
    // переключение вкладок (сравнение trainingActiveNodeId === activeNodeId
    // в trainer-table.js само покажет «Начать тренировку» при смене узла).
    renderTrainerTable();
}

// Удалить узел из тренировки (шаг после подтверждения в меню узла).
// Корректировка активного узла выполняется внутри removeTrainerNode (store).
export function removeTrainerNodeAndRefresh(id) {
    const removed = removeTrainerNode(id);
    renderTrainerPage();
    return removed;
}