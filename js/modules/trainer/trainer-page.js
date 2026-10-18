// ===== trainer-page.js — левая панель вкладки «Тренажёр» =====
// Плоский список узлов тренажёра (см. trainer-store). Каждый узел:
//   - иконка «шапочка учёного» (как кнопка «Режим тренировки» в редакторе),
//   - имя узла — копия названия исходного диапазона на момент добавления,
//   - кнопка «три точки» → popup-меню (как в дереве редактора) с пунктами
//     «Сбросить статистику» и «Удалить из тренировки».
// Разметка повторяет дерево (tree-node/tree-item/popup-menu) — стили и
// поведение меню переиспользуются из styles/components.css без изменений.
// Правая часть вкладки — стол, кнопки действий и статистика
// (см. trainer-table.js). Сессия тренировки НЕ переживает уход на другую
// вкладку и смену активного узла: она автоматически финиширует как по
// кнопке «Закончить тренировку» — статистика пишется в БД
// (trainer-table.js finishTrainingSession, navigation.js switchTab).

import { getTrainerNodes, removeTrainerNode, getActiveNodeId, setActiveNodeId } from './trainer-store.js';
import { renderTrainerTable } from './trainer-table.js';
import { resetStats } from './trainer-stats.js';

// Иконка «шапочка выпускника» — Lucide graduation-cap, тот же SVG, что у
// #trainingModeBtn (index.html) после перевода иконок на контурный стиль.
const CAP_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>' +
    '<path d="M22 10v6"/>' +
    '<path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>' +
    '</svg>';

// Иконка «три точки» — та же SVG, что у tree-menu-btn (tree-render.js).
const DOTS_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M14 5C14 6.10457 13.1046 7 12 7C10.8954 7 10 6.10457 10 5C10 3.89543 10.8954 3 12 3C13.1046 3 14 3.89543 14 5Z" fill="currentColor"/>' +
    '<path d="M14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" fill="currentColor"/>' +
    '<path d="M12 21C13.1046 21 14 20.1046 14 19C14 17.8954 13.1046 17 12 17C10.8954 17 10 17.8954 10 19C10 20.1046 10.8954 21 12 21Z" fill="currentColor"/>' +
    '</svg>';

// (selectedNodeId удалён: активный узел теперь в trainer-store, персистентно в БД)

// ===== ПЕРЕВОД ПРИ СМЕНЕ ЯЗЫКА =====
// Тексты тренажёра (кнопки, статистика, история, пункты меню) рендерятся
// через App.i18n.t() на момент отрисовки — статический механизм [data-i18n]
// (i18n.js applyLanguage) их не видит. Поэтому при смене языка вкладка
// перерисовывается целиком (паттерн js/stats.js: событие 'languagechange').
// Состояние сессии тренировки живёт в trainer-table.js и переживает
// перерисовку — тренировка не прерывается.
// ВАЖНО: i18n.js шлёт 'languagechange' при КАЖДОМ applyLanguage (в том числе
// от MutationObserver на любое изменение DOM), поэтому перерисовываем только
// при реальной смене языка — сравнение с renderedLang (обновляется в
// renderTrainerPage, т.е. хранит язык последней отрисовки).
let renderedLang = App.i18n.getLanguage();

document.addEventListener('languagechange', function(e) {
    const lang = (e && e.detail && e.detail.language) || App.i18n.getLanguage();
    if (lang === renderedLang) return;
    renderTrainerPage();
});

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
        const prevId = getActiveNodeId();
        setActiveNodeId(node.id);
        renderTrainerPage();
        // Мерцание матрицы и тумблера под ней при переключении диапазона —
        // так же, как матрица редактора при смене диапазона
        // (App.animations.constructorFade). Только при реальной смене узла.
        if (prevId !== node.id) App.animations.trainerFade();
    };

    nodeDiv.appendChild(itemDiv);
    return nodeDiv;
}

// ===== РЕНДЕР СПИСКА УЗЛОВ =====
export function renderTrainerPage() {
    const container = document.getElementById('trainerTree');
    if (!container) return;
    // Язык этой отрисовки (см. подписку 'languagechange' выше).
    renderedLang = App.i18n.getLanguage();
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

    // Рисуем стол, кнопки действий и статистику для активного узла.
    // Открытая сессия автоматически финиширует при смене активного узла
    // (событие trainer:activeChanged — см. trainer-table.js) — поэтому
    // здесь состояние тренировки специально не трогаем.
    renderTrainerTable();
}

// Удалить узел из тренировки (шаг после подтверждения в меню узла).
// Корректировка активного узла выполняется внутри removeTrainerNode (store).
export function removeTrainerNodeAndRefresh(id) {
    const removed = removeTrainerNode(id);
    renderTrainerPage();
    return removed;
}