// ============================================================
// comments.js — работа с комментариями к диапазонам
// ============================================================

App.comments = App.comments || {};
App.comments.getComments = function(nodeId) {
    const tableId = getTableId(nodeId);
    return App.state.commentsPerNode[tableId] || '';
}

App.comments.setComments = function(nodeId, text) {
    const tableId = getTableId(nodeId);
    App.state.commentsPerNode[tableId] = text;
    markUnsaved();
}

App.comments.renderComments = function(nodeId) {
    const textarea = document.getElementById('commentsTextarea');
    if (!textarea) return;
    
    const comments = App.comments.getComments(nodeId);
    textarea.value = comments;
}

// ===== ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ КОММЕНТАРИЕВ В ПРОСМОТРЕ =====
App.comments.renderWorkComments = function(nodeId) {
    const textarea = document.getElementById('workCommentsTextarea');
    if (!textarea) return;
    const comments = App.comments.getComments(nodeId);
    textarea.value = comments;
}

App.comments.toggleComments = function() {
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

App.comments.saveComments = function() {
    if (!App.state.currentNodeId) return;
    
    const textarea = document.getElementById('commentsTextarea');
    if (!textarea) return;
    
    App.comments.setComments(App.state.currentNodeId, textarea.value);
    persistAll();
    clearUnsaved();
}

// ===== ИНИЦИАЛИЗАЦИЯ КОММЕНТАРИЕВ =====
App.comments.initComments = function() {
    const toggleBtn = document.getElementById('commentsToggleBtn');
    const textarea = document.getElementById('commentsTextarea');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', App.comments.toggleComments);
    }
    
    if (textarea) {
        // Автосохранение при вводе (с задержкой)
        let saveTimeout = null;
        textarea.addEventListener('input', function() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (App.state.currentNodeId) {
                    App.comments.setComments(App.state.currentNodeId, this.value);
                }
            }, 500);
        });
        
        // Сохраняем при потере фокуса
        textarea.addEventListener('blur', function() {
            if (App.state.currentNodeId) {
                App.comments.setComments(App.state.currentNodeId, this.value);
                persistAll();
                clearUnsaved();
            }
        });
    }
}
