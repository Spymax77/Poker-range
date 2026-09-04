// ============================================================
// comments.js — работа с комментариями к диапазонам
// ============================================================

function getComments(nodeId) {
    const tableId = getTableId(nodeId);
    return App.state.commentsPerNode[tableId] || '';
}

function setComments(nodeId, text) {
    const tableId = getTableId(nodeId);
    App.state.commentsPerNode[tableId] = text;
    markUnsaved();
}

function renderComments(nodeId) {
    const textarea = document.getElementById('commentsTextarea');
    if (!textarea) return;
    
    const comments = getComments(nodeId);
    textarea.value = comments;
}

// ===== ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ КОММЕНТАРИЕВ В ПРОСМОТРЕ =====
function renderWorkComments(nodeId) {
    const textarea = document.getElementById('workCommentsTextarea');
    if (!textarea) return;
    const comments = getComments(nodeId);
    textarea.value = comments;
}

function toggleComments() {
    const area = document.getElementById('commentsArea');
    const btn = document.getElementById('commentsToggleBtn');
    
    if (!area || !btn) return;
    
    const isOpen = area.style.display !== 'none';
    
    if (isOpen) {
        area.style.display = 'none';
        btn.classList.remove('active');
    } else {
        area.style.display = 'block';
        btn.classList.add('active');
        // Фокусируемся на поле ввода
        const textarea = document.getElementById('commentsTextarea');
        if (textarea) {
            setTimeout(() => textarea.focus(), 100);
        }
    }
}

function saveComments() {
    if (!App.state.currentNodeId) return;
    
    const textarea = document.getElementById('commentsTextarea');
    if (!textarea) return;
    
    setComments(App.state.currentNodeId, textarea.value);
    persistAll();
    clearUnsaved();
}

// ===== ИНИЦИАЛИЗАЦИЯ КОММЕНТАРИЕВ =====
function initComments() {
    const toggleBtn = document.getElementById('commentsToggleBtn');
    const textarea = document.getElementById('commentsTextarea');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleComments);
    }
    
    if (textarea) {
        // Автосохранение при вводе (с задержкой)
        let saveTimeout = null;
        textarea.addEventListener('input', function() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (App.state.currentNodeId) {
                    setComments(App.state.currentNodeId, this.value);
                }
            }, 500);
        });
        
        // Сохраняем при потере фокуса
        textarea.addEventListener('blur', function() {
            if (App.state.currentNodeId) {
                setComments(App.state.currentNodeId, this.value);
                persistAll();
                clearUnsaved();
            }
        });
    }
}
