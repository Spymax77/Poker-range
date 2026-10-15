// ===== trainer-table.js — стол и кнопки действий в правой панели тренажёра =====
// Рисует покерный стол (овал) и кнопки действий из цветов активного узла
// в .table-panel вкладки «Тренажёр». Вызывается из renderTrainerPage (trainer-page.js)
// при каждом изменении активного узла.

import { getTrainerNodes, getActiveNodeId } from './trainer-store.js';
import { renderCards } from './trainer-cards.js';

// ===== РЕНДЕР СТОЛА И КНОПОК =====
export function renderTrainerTable() {
    const panel = document.querySelector('#trainerPage .table-panel');
    if (!panel) return;

    // Очищаем предыдущее содержимое
    panel.innerHTML = '';

    // Находим активный узел
    const activeId = getActiveNodeId();
    const nodes = getTrainerNodes();
    const activeNode = nodes.find(function(n) { return n.id === activeId; }) || nodes[0];
    if (!activeNode) return;

    // Извлекаем простые цвета (профили) из узла — они становятся кнопками
    var simpleColors = [];
    if (activeNode.colors) {
        simpleColors = activeNode.colors.filter(function(c) {
            return c.type === 'simple' || (!c.type && c.color);
        });
    }
    // Показываем до 3 action-цветов + фолд
    var actions = simpleColors.slice(0, 3).map(function(c) {
        return { name: c.name, color: c.color };
    });
    actions.push({ name: 'Fold', color: '#5a5d66' });

    // === КОНТЕЙНЕР ===
    var wrapper = document.createElement('div');
    wrapper.className = 'trainer-table-wrapper';

    // === ОВАЛ СТОЛА ===
    var tableDiv = document.createElement('div');
    tableDiv.className = 'trainer-table-surface';

    // Метка «POKER TABLE» — через flexbox, гарантированно по центру
    var tableLabel = document.createElement('div');
    tableLabel.className = 'trainer-table-label';
    tableLabel.textContent = 'POKER TABLE';
    tableDiv.appendChild(tableLabel);

    // Позиция игрока HERO — прямоугольник внизу по центру
    var playerDiv = document.createElement('div');
    playerDiv.className = 'trainer-player-chip';
    playerDiv.textContent = 'HERO';
    tableDiv.appendChild(playerDiv);

    wrapper.appendChild(tableDiv);

    // === КАРТЫ НА ПОЗИЦИИ HERO ===
    var cardsContainer = document.createElement('div');
    cardsContainer.className = 'trainer-cards-container';
    tableDiv.appendChild(cardsContainer);

    // Рендерим случайную руку из participation-матрицы узла
    renderCards(cardsContainer, activeNode.participation, activeNode.disabled);

    // === КНОПКИ ДЕЙСТВИЙ ===
    var btnContainer = document.createElement('div');
    btnContainer.className = 'trainer-action-buttons';

    actions.forEach(function(action) {
        var btn = document.createElement('button');
        btn.className = 'trainer-action-btn';
        btn.textContent = action.name;
        btn.style.borderColor = action.color;
        btn.style.color = '#a9afb5';
        btn.addEventListener('mouseenter', function() {
            btn.style.background = action.color + '18';
        });
        btn.addEventListener('mouseleave', function() {
            btn.style.background = 'transparent';
        });
        btnContainer.appendChild(btn);
    });

    wrapper.appendChild(btnContainer);

    // Вставляем в панель
    panel.appendChild(wrapper);
}