// ===== style-manager.js — стили кнопок (попап стилей) =====

App.styles = App.styles || {};

// Состояние попапа стилей (общее для createPopup / showPopup / hidePopup)
let stylePopup = null;
let activeButton = null;

// Значения по умолчанию — используются для сброса цвета
const DEFAULT_BG_COLOR = '#3d3d3d';
const DEFAULT_TEXT_COLOR = '#a9afb5';

App.styles.saveButtonStyle = function(nodeId, bg, border, text) {
    if (!nodeId) return;
    
    // Загружаем все стили
    let allStyles = App.storage.load('btn_styles_all') || {};
    
    // Обновляем стиль для узла
    const data = {};
    if (bg) data.bg = bg;
    if (border) data.border = border;
    if (text) data.text = text;
    
    allStyles[nodeId] = data;
    
    // Сохраняем все стили одним запросом
    App.storage.save('btn_styles_all', allStyles);
}

App.styles.loadButtonStyle = function(nodeId) {
    if (!nodeId) return null;
    const allStyles = App.storage.load('btn_styles_all') || {};
    return allStyles[nodeId] || null;
}

App.styles.createPopup = function() {
    if (stylePopup) return;

    stylePopup = document.createElement('div');
    stylePopup.className = 'style-popup';
    stylePopup.id = 'stylePopup';
    stylePopup.innerHTML = `
    <div class="style-popup-title" id="popupTitle">${App.i18n.t('styles.editTitle')}</div>
    <div class="style-popup-row">
        <div class="style-color-box" id="popupBgColor"></div>
        <span class="style-label">${App.i18n.t('styles.bgColor')}</span>
        <button type="button" class="style-reset-btn" id="resetBgColor" data-tooltip="${App.i18n.t('styles.resetDefault')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
            </svg>
        </button>
    </div>
    <div class="style-popup-row">
        <div class="style-color-box" id="popupTextColor"></div>
        <span class="style-label">${App.i18n.t('styles.textColor')}</span>
        <button type="button" class="style-reset-btn" id="resetTextColor" data-tooltip="${App.i18n.t('styles.resetDefault')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
            </svg>
        </button>
    </div>
    <div class="style-popup-actions">
        <button class="btn-cancel" id="popupCancel">${App.i18n.t('styles.cancel')}</button>
        <button class="btn-save" id="popupSave">${App.i18n.t('styles.save')}</button>
    </div>
`;

    document.body.appendChild(stylePopup);
	// === ПИКЕР ДЛЯ ЦВЕТА ФОНА ===
document.getElementById('popupBgColor').addEventListener('click', function() {
    if (!activeButton) return;
    const rect = this.getBoundingClientRect();
    const currentColor = document.getElementById('popupBgColor').style.background || DEFAULT_BG_COLOR;
App.ui.openColorPicker(currentColor, function(hex) {
    document.getElementById('popupBgColor').style.background = hex;
}, rect);
});
document.getElementById('popupTextColor').addEventListener('click', function() {
    if (!activeButton) return;
    const rect = this.getBoundingClientRect();
    const currentColor = document.getElementById('popupTextColor').style.background || DEFAULT_TEXT_COLOR;
App.ui.openColorPicker(currentColor, function(hex) {
    document.getElementById('popupTextColor').style.background = hex;
}, rect);
});

    // === СБРОС ЦВЕТА НА ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ ===
    document.getElementById('resetBgColor').addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('popupBgColor').style.background = DEFAULT_BG_COLOR;
    });

    document.getElementById('resetTextColor').addEventListener('click', function(e) {
        e.stopPropagation();
        document.getElementById('popupTextColor').style.background = DEFAULT_TEXT_COLOR;
    });
	    // === ПЕРЕТАСКИВАНИЕ ===
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    stylePopup.addEventListener('mousedown', function(e) {
        if (e.target.closest('.style-color-box')) return;
        if (e.target.closest('.style-reset-btn')) return;
        if (e.target.closest('.style-popup-actions')) return;
        isDragging = true;
        const rect = stylePopup.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        stylePopup.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging || !stylePopup) return;
        let left = e.clientX - dragOffsetX;
        let top = e.clientY - dragOffsetY;
        left = Math.max(10, Math.min(window.innerWidth - 260, left));
        top = Math.max(10, Math.min(window.innerHeight - 200, top));
        stylePopup.style.left = left + 'px';
        stylePopup.style.top = top + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            if (stylePopup) stylePopup.style.cursor = 'grab';
        }
    });
	// === КНОПКИ ===
document.getElementById('popupCancel').addEventListener('click', function() {
    App.styles.hidePopup();
});

document.getElementById('popupSave').addEventListener('click', function() {
    if (!activeButton) return;

    const bgColor = document.getElementById('popupBgColor').style.background;
    const textColor = document.getElementById('popupTextColor').style.background;

    // Применяем к кнопке
  if (bgColor && activeButton.classList.contains('folder-btn')) {
        activeButton.style.backgroundColor = bgColor;
		activeButton.style.borderColor = bgColor;
    }
    if (textColor) {
        activeButton.style.color = textColor;
    }

const nodeId = parseInt(activeButton.className.match(/folder-btn-(\d+)/)?.[1]) ||
               parseInt(activeButton.className.match(/range-link-(\d+)/)?.[1]) ||
               App.state.workDisplayNodeId;
    if (nodeId) {
        const bg = document.getElementById('popupBgColor').style.background || '';
        const border = activeButton.style.borderColor || '';
        const text = activeButton.style.color || '';
        App.styles.saveButtonStyle(nodeId, bg, border, text);
    }
    
    App.styles.hidePopup();
});
}

App.styles.showPopup = function(button) {
    if (!stylePopup) App.styles.createPopup();
    if (!stylePopup) return;

    activeButton = button;

    const isRange = button.classList.contains('range-link');
	stylePopup.classList.toggle('no-bg', isRange);

// Показываем или скрываем строку "Цвет фона"
const bgRow = stylePopup.querySelector('.style-popup-row');
if (bgRow) {
    bgRow.style.display = isRange ? 'none' : '';
}
    const title = document.getElementById('popupTitle');
    if (title) {
        title.textContent = isRange ? App.i18n.t('styles.editRangeTitle') : App.i18n.t('styles.editFolderTitle');
    }
    const bgColor = button.style.borderColor;
    const bgBox = document.getElementById('popupBgColor');
    if (bgBox && bgColor) {
        bgBox.style.background = bgColor;
    }
	    // Цвет текста
    const textColor = button.style.color || getComputedStyle(button).color;
    const textBox = document.getElementById('popupTextColor');
    if (textBox && textColor) {
        textBox.style.background = textColor;
    }
    const rect = button.getBoundingClientRect();
    let left = rect.right + 14;
    let top = rect.top - 10;

    if (left + 200 > window.innerWidth) {
        left = rect.left - 200 - 14;
    }
    if (top + 60 > window.innerHeight) {
        top = window.innerHeight - 60 - 10;
    }
    if (top < 10) top = 10;

    stylePopup.style.left = left + 'px';
    stylePopup.style.top = top + 'px';
    stylePopup.classList.add('visible');
}

App.styles.hidePopup = function() {
    // Закрываем пикер, если он открыт
    const overlay = document.getElementById('pickerOverlay');
    if (overlay && overlay.classList.contains('active')) {
        const closeBtn = document.getElementById('pickerClose');
        if (closeBtn) closeBtn.click();
    }

    if (stylePopup) {
        stylePopup.classList.remove('visible');
        activeButton = null;
    }
}
