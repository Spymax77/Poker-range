// ============================================================
// modals.js — модальные окна (подтверждение, информация, диалоги)
// ============================================================

// ===== ПЛАВАЮЩЕЕ МОДАЛЬНОЕ ОКНО (информационное, с кнопкой ОК) =====
function showFloatingModal(message, callback) {
    if (!message) {
        console.warn('⚠️ showFloatingModal: не передан текст сообщения');
        if (callback) callback();
        return;
    }

    const oldModal = document.querySelector('.save-confirm-overlay');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'save-confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'save-confirm-modal';
    modal.innerHTML = `
        <div class="save-confirm-header" id="modalHeader">
            <span>Сообщение</span>
        </div>
        <div class="save-confirm-body">
            <p>${message}</p>
        </div>
        <div class="save-confirm-actions" style="justify-content: center;">
            <button class="btn btn-confirm" id="floatingOkBtn">ОК</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ===== ПЕРЕТАСКИВАНИЕ =====
    const header = modal.querySelector('#modalHeader');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    function onDrag(e) {
        if (!isDragging) return;
        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, left));
        top = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, top));
        modal.style.left = left + 'px';
        modal.style.top = top + 'px';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    // ===== КНОПКА ОК =====
    modal.querySelector('#floatingOkBtn').onclick = () => {
        overlay.remove();
        if (callback) callback();
    };
}

// ===== КАСТОМНОЕ ОКНО ДЛЯ ПОДТВЕРЖДЕНИЯ (Да/Нет) =====
function showSaveConfirmModal(message, onSave, onCancel) {
    if (!message) {
        console.warn('⚠️ showSaveConfirmModal: не передан текст сообщения');
        return;
    }

    const oldModal = document.querySelector('.save-confirm-overlay');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'save-confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'save-confirm-modal';
    modal.innerHTML = `
        <div class="save-confirm-header" id="saveConfirmHeader">
            <span>Cообщение</span>
        </div>
        <div class="save-confirm-body">
            <p>${message}</p>
        </div>
        <div class="save-confirm-actions">
            <button class="btn btn-cancel" id="saveConfirmNo">Нет</button>
            <button class="btn btn-confirm" id="saveConfirmYes">Да</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ===== ПЕРЕТАСКИВАНИЕ =====
    const header = modal.querySelector('#saveConfirmHeader');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    function onDrag(e) {
        if (!isDragging) return;
        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, left));
        top = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, top));
        modal.style.left = left + 'px';
        modal.style.top = top + 'px';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    // ===== КНОПКИ =====
    modal.querySelector('#saveConfirmYes').onclick = () => {
        overlay.remove();
        if (onSave) onSave();
    };

    modal.querySelector('#saveConfirmNo').onclick = () => {
        overlay.remove();
        if (onCancel) onCancel();
    };
}

// ========== МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ (из HTML-шаблона) ==========
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById("confirmModal");
    const msgSpan = document.getElementById("confirmMessage");
    const yesBtn = document.getElementById("confirmYes");
    const noBtn = document.getElementById("confirmNo");

    if (!modal) {
        console.error("Модальное окно не найдено в HTML");
        return;
    }

    msgSpan.textContent = message;
    modal.classList.add('active');

    function cleanup() {
        modal.classList.remove('active');
        yesBtn.removeEventListener("click", handleYes);
        noBtn.removeEventListener("click", handleNo);
    }

    function handleYes() {
        cleanup();
        onConfirm();
    }

    function handleNo() {
        cleanup();
    }

    yesBtn.addEventListener("click", handleYes);
    noBtn.addEventListener("click", handleNo);
}

// ===== ДИАЛОГ ВЫБОРА КОМПОНЕНТА (для поддиапазонов) =====
function showComponentSelectionDialog(parentNodeId, callback) {
    
    const parent = getNode(parentNodeId);
    if (!parent) {
        if (callback) callback(null);
        return;
    }

    const tableId = getTableId(parentNodeId);
    const colors = App.state.colorsPerNode[tableId] || [];
    
    // Находим все мультицветы в родителе
    const multiColors = colors.filter(c => c.type === 'multi');
    // Берём ТОЛЬКО простые цвета
const components = colors.filter(c => c.type === 'simple' || (!c.type && c.color));


    
    // Создаём HTML для списка
    let listHtml = `
    <div class="component-dialog-body">
       <div class="component-option" data-index="null">
    <div class="profile-radio" data-index="null"></div>
    <div class="color-swatch sum-all"></div>
    <span class="color-name">Все цвета</span>
</div>
`;

for (const comp of components) {
    const colorName = comp.name || 'Цвет';
    const colorHex = comp.color || '#9C5479';
    
    listHtml += `
      <div class="component-option" data-index="${components.indexOf(comp)}">
    <div class="profile-radio" data-index="${components.indexOf(comp)}"></div>
    <div class="color-swatch" style="background: ${colorHex};"></div>
    <span class="color-name">${colorName}</span>
</div> 
    `;
}

listHtml += `</div>`;

    // Создаём окно
    const overlay = document.createElement('div');
    overlay.className = 'save-confirm-overlay';

    const modal = document.createElement('div');
    modal.className = 'save-confirm-modal';
    modal.style.width = '400px';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '80vh';
    modal.style.overflow = 'auto';

    modal.innerHTML = `
        <div class="save-confirm-header" id="componentDialogHeader" style="cursor: grab; display: flex; justify-content: space-between; align-items: center;">
            <span>Добавить поддиапазон</span>
            <button id="componentDialogClose" style="background: none; border: none; color: #8a848a; font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1;">✕</button>
        </div>
        <div class="save-confirm-body">
            ${listHtml}
        </div>
        <div class="save-confirm-actions" style="justify-content: flex-end;">
            <button class="btn btn-cancel" id="componentDialogCancel">Отмена</button>
            <button class="btn btn-confirm" id="componentDialogOk">ОК</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ===== ПЕРЕТАСКИВАНИЕ =====
    const header = modal.querySelector('#componentDialogHeader');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
        if (e.target.closest('button')) return;
        isDragging = true;
        const rect = modal.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
    });

    function onDrag(e) {
        if (!isDragging) return;
        let left = e.clientX - offsetX;
        let top = e.clientY - offsetY;
        left = Math.max(10, Math.min(window.innerWidth - modal.offsetWidth - 10, left));
        top = Math.max(10, Math.min(window.innerHeight - modal.offsetHeight - 10, top));
        modal.style.left = left + 'px';
        modal.style.top = top + 'px';
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    // ===== ОБРАБОТЧИКИ =====
    function closeDialog(selectedIndex) {
        overlay.remove();
        if (callback) callback(selectedIndex);
    }

    modal.querySelector('#componentDialogClose').addEventListener('click', () => closeDialog(-1));
    modal.querySelector('#componentDialogCancel').addEventListener('click', () => closeDialog(-1));
	modal.querySelector('#componentDialogOk').addEventListener('click', function() {
    // Если ничего не выбрано (undefined) — не закрываем
    if (selectedIndex === undefined) return;
    // Иначе передаём выбранное значение (null — Все цвета, число — конкретный цвет)
    closeDialog(selectedIndex);
});

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeDialog(null);
        }
    });

    // Выбор компонента
    // ===== ВЫБОР КОМПОНЕНТА (РАДИО) =====
const options = modal.querySelectorAll('.component-option');
const radios = modal.querySelectorAll('.profile-radio');
let selectedIndex = undefined;

function selectOption(index) {
    // Снимаем активность со всех радио
    radios.forEach(r => r.classList.remove('active'));
    // Находим радио для выбранного индекса
    const targetRadio = modal.querySelector(`.profile-radio[data-index="${index === null ? 'null' : index}"]`);
    if (targetRadio) {
        targetRadio.classList.add('active');
    }
    selectedIndex = index;
}

// Ховер-эффекты (оставляем как было)
options.forEach(opt => {
    opt.addEventListener('mouseenter', function() {
        this.style.background = '#3a3d45';
    });
    opt.addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
        this.style.borderColor = 'transparent';
    });
});

// Клик по строке (не по радио)
options.forEach(opt => {
    opt.addEventListener('click', function(e) {
        if (e.target.classList.contains('profile-radio')) return;
        const idx = this.dataset.index;
        const index = idx === 'null' ? null : parseInt(idx);
        selectOption(index);
    });
});

// Клик по радио-кнопке
radios.forEach(radio => {
    radio.addEventListener('click', function(e) {
        e.stopPropagation();
        const idx = this.dataset.index;
        const index = idx === 'null' ? null : parseInt(idx);
        selectOption(index);
    });
});
}
