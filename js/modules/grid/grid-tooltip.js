// Grid tooltip
// ===== ВСПЛЫВАЮЩАЯ ПОДСКАЗКА (TOOLTIP) =====
import { escapeHtml } from './grid-utils.js';

let tooltipElement = null;
let tooltipTimeout = null;

export function getTooltipElement() {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'cell-tooltip';
        
        // ✅ Добавляем тултип ВНУТРЬ .left-area
        const container = document.querySelector('.left-area');
        if (container) {
            container.appendChild(tooltipElement);
        } else {
            document.body.appendChild(tooltipElement);
            console.warn('⚠️ .left-area не найден, тултип в body');
        }
    }
    return tooltipElement;
}

export function showTooltip(event, hand, profileId) {
    const nodeId = App.state.workDisplayNodeId;
    if (!nodeId || !profileId) return;
    
    const profiles = App.colors.getColorsForNode(nodeId);
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    const colorsList = App.colors.getColorsForNode(nodeId);
    if (!colorsList || colorsList.length === 0) return;
    
    let html = `<div class="tooltip-hand">${hand}</div>`;
    html += `<hr class="tooltip-divider">`;
    
    // Определяем, простой это профиль или мульти
    let colorIds = [];
    let boundaries = [];
    
    if (profile.type === 'simple' || (!profile.type && profile.color)) {
        // Простой профиль
        colorIds = [profile.id];
        boundaries = [100];
    } else if (profile.type === 'multi' && profile.components) {
        // Мультипрофиль — берём компоненты
        colorIds = profile.components.map(c => c.colorId);
        boundaries = profile.boundaries || [];
    } else {
        return;
    }
    
    let prev = 0;
    for (let i = 0; i < colorIds.length; i++) {
        const colorId = colorIds[i];
        const colorObj = colorsList.find(c => c.id === colorId);
        if (!colorObj) continue;
        
        const percent = boundaries[i] - prev;
        prev = boundaries[i];
        
        html += `
            <div class="tooltip-row">
                <span class="tooltip-color-box" style="background: ${escapeHtml(colorObj.color)};"></span>
                <span class="tooltip-color-name">${escapeHtml(colorObj.name)}</span>
                <span class="tooltip-percent">${percent % 1 === 0 ? Math.round(percent) : percent.toFixed(1)}%</span>
            </div>
        `;
    }
    
    const tooltip = App.grid.getTooltipElement();
    tooltip.innerHTML = html;
    App.grid.positionTooltip(event, tooltip);
    tooltip.classList.add('visible');
}

export function positionTooltip(event, tooltip) {
    const cell = event.target.closest('.hand-cell');
    if (!cell) return;
    
    const container = document.querySelector('.left-area');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    
    // ✅ Временно делаем видимым, но прозрачным
    tooltip.style.display = 'block';
    tooltip.style.opacity = '0';
    
    const tooltipRect = tooltip.getBoundingClientRect();
    
    const horizontalPadding = 8;
    const verticalGap = 6;
    
    let left = (cellRect.left - containerRect.left) + (cellRect.width / 2) - (tooltipRect.width / 2);
    let top = (cellRect.bottom - containerRect.top) + verticalGap;
    
    if (left < horizontalPadding) {
        left = horizontalPadding;
    }
    
    if (left + tooltipRect.width > containerRect.width - horizontalPadding) {
        left = containerRect.width - tooltipRect.width - horizontalPadding;
    }
    
    if (top + tooltipRect.height > containerRect.height - horizontalPadding) {
        top = (cellRect.top - containerRect.top) - tooltipRect.height - verticalGap;
        if (top < horizontalPadding) top = horizontalPadding;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    
    // ✅ Теперь делаем видимым (анимация пойдёт из CSS)
    tooltip.style.opacity = '1';
}
export function hideTooltip() {
    const tooltip = App.grid.getTooltipElement();
    tooltip.classList.remove('visible');
    tooltip.style.opacity = '0';   // ← оставляем для синхронизации
    setTimeout(() => {
        if (!tooltip.classList.contains('visible')) {
            tooltip.style.display = 'none';
        }
    }, 400);
}