// ============================================================
// storage.js — серверное хранилище с in-memory кэшем
// ============================================================
(function() {
    const API_URL = 'https://pfrange.ru/api/storage-api.php';
    // user_id больше не передаётся с клиента — сервер определяет пользователя
    // из cookie-сессии (см. api/storage-api.php). Гость (не авторизован)
    // может пользоваться сайтом, но save/saveBatch/remove не отправляются
    // на сервер — только показывается уведомление "требуется авторизация".
    const cache = new Map(); // In-memory кэш только для текущей сессии
    const pendingWrites = new Map();
    const retryQueue = new Map();
    const retryDelays = [2000, 5000, 15000, 30000];
    let retryTimer = null;

    function scheduleRetry(key, rawValue, action) {
        retryQueue.set(key, { rawValue: rawValue, action: action || 'save', attempt: 0 });
        if (!retryTimer) retryTimer = setTimeout(processRetryQueue, retryDelays[0]);
    }

    function processRetryQueue() {
        retryTimer = null;
        retryQueue.forEach(function(item, key) {
            const request = item.action === 'remove'
                ? removeRemote(key, true)
                : saveRemote(key, item.rawValue, true);
            request.then(function(result) {
                if (result.success) {
                    retryQueue.delete(key);
                } else {
                    item.attempt = Math.min(item.attempt + 1, retryDelays.length - 1);
                    retryTimer = retryTimer || setTimeout(processRetryQueue, retryDelays[item.attempt]);
                }
            });
        });
    }

    function emit(event, data) {
        if (window.App && App.events) App.events.emit(event, data);
    }

    function requiresAuth() {
        return !App.auth || !App.auth.isLoggedIn();
    }

    function authRequiredResult() {
        if (App.auth && App.auth.requireAuthNotice) App.auth.requireAuthNotice();
        return Promise.resolve({ success: false, requiresAuth: true });
    }

    // ===== ПАКЕТНОЕ СОХРАНЕНИЕ =====
    function saveBatch(items) {
        const request = fetch(API_URL + '?action=save_batch', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
        }).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        }).then(function(result) {
            if (!result.success) throw new Error(result.message || 'Ошибка API');
            return result;
        }).catch(function(error) {
            console.error('Ошибка пакетного сохранения:', error);
            emit('storage:error', error);
            return { success: false, error: error };
        });
        return request;
    }

    // ===== ПАКЕТНАЯ ЗАГРУЗКА =====
    async function loadBatch(keys) {
        try {
            const response = await fetch(API_URL + '?action=load_batch', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keys: keys })
            });
            
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const result = await response.json();
            
            if (!result.success) throw new Error(result.message || 'Ошибка API');
            
            // Загружаем данные в кэш
            const items = result.items || {};
            Object.keys(items).forEach(function(key) {
                cache.set(key, items[key]);
            });
            
            return items;
        } catch (error) {
            console.error('Ошибка пакетной загрузки:', error);
            emit('storage:error', error);
            return {};
        }
    }

    function saveRemote(key, rawValue, isRetry) {
        if (requiresAuth()) return authRequiredResult();

        const request = fetch(API_URL + '?action=save', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key, value: rawValue })
        }).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        }).then(function(result) {
            if (!result.success) throw new Error(result.message || 'Ошибка API');
            if (pendingWrites.get(key) === request) pendingWrites.delete(key);
            if (pendingWrites.size === 0) emit('storage:saved');
            return result;
        }).catch(function(error) {
            if (pendingWrites.get(key) === request) pendingWrites.delete(key);
            console.error('Ошибка сохранения данных "' + key + '":', error);
            emit('storage:error', error);
            if (!isRetry) scheduleRetry(key, rawValue);
            return { success: false, error: error };
        });
        pendingWrites.set(key, request);
        return request;
    }

    function removeRemote(key, isRetry) {
        if (requiresAuth()) return authRequiredResult();

        return fetch(API_URL + '?action=remove', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key })
        }).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        }).then(function(result) {
            if (!result.success) throw new Error(result.message || 'Ошибка API');
            return result;
        }).catch(function(error) {
            console.error('Ошибка удаления данных "' + key + '":', error);
            emit('storage:error', error);
            if (!isRetry) scheduleRetry(key, null, 'remove');
            return { success: false, error: error };
        });
    }

    function save(key, value) {
        const rawValue = JSON.stringify(value);
        cache.set(key, rawValue);
        emit('storage:saving');
        return saveRemote(key, rawValue);
    }

    function saveRaw(key, rawString) {
        cache.set(key, rawString);
        emit('storage:saving');
        return saveRemote(key, rawString);
    }

    async function initialize() {
        emit("storage:loading");

        var baseKeys = [
            "poker_range_tree_v6",
            "poker_range_metadata",
            "poker_range_metadata_editor",
            "poker_range_metadata_gto",
            "poker_range_structure_editor",
            "poker_range_structure_gto",
            "poker_range_v2_migrated",
            "gto_filters",
            "btn_styles_all"
        ];

        await loadBatch(baseKeys);
        emit("storage:ready");
    }

    async function preload(keys) {
        if (keys.length === 0) return;
        
        const uniqueKeys = Array.from(new Set(keys)).filter(function(key) {
            return !cache.has(key);
        });
        
        if (uniqueKeys.length === 0) return;
        
        await loadBatch(uniqueKeys);
    }



    App.storage = {
        save: save,
        saveRaw: saveRaw,
        load: function(key) {
            const raw = cache.has(key) ? cache.get(key) : null;
            if (raw === null) return null;
            try { return JSON.parse(raw); } catch (error) { return null; }
        },
        loadRaw: function(key) {
            return cache.has(key) ? cache.get(key) : null;
        },
        remove: function(key) {
            cache.delete(key);
            emit('storage:saving');
            if (requiresAuth()) return authRequiredResult();
            return removeRemote(key, false).then(function(result) {
                if (!result.success) return result;
                emit('storage:saved');
                return result;
            });
        },
        initialize: initialize,
        preload: preload,
        cache: cache, // Экспортируем кэш для отладки
        clearCache: function() {
            cache.clear();
        },

        // ===== V2: Methods for split data storage =====
        saveMetadata: function(metadata) {
            return saveRaw('poker_range_metadata', JSON.stringify(metadata));
        },
        loadMetadata: function() {
            return App.storage.load('poker_range_metadata');
        },
        saveStructure: function(mode, structure) {
            return saveRaw('poker_range_structure_' + mode, JSON.stringify(structure));
        },
        loadStructure: function(mode) {
            return App.storage.load('poker_range_structure_' + mode);
        },
        saveTable: function(mode, nodeId, tableData) {
            return saveRaw('poker_range_table_' + mode + '_' + nodeId, JSON.stringify(tableData));
        },
        loadTable: function(mode, nodeId) {
            return App.storage.load('poker_range_table_' + mode + '_' + nodeId);
        },
        loadTablesBatch: async function(tableRefs) {
            var keys = tableRefs.map(function(ref) {
                return 'poker_range_table_' + ref.mode + '_' + ref.nodeId;
            });
            await preload(keys);
            var result = new Map();
            for (var i = 0; i < tableRefs.length; i++) {
                var ref = tableRefs[i];
                var key = 'poker_range_table_' + ref.mode + '_' + ref.nodeId;
                var data = App.storage.load(key);
                if (data) result.set(ref.mode + '_' + ref.nodeId, data);
            }
            return result;
        },
        
        // ===== Пакетное сохранение =====
        saveBatch: function(items) {
            emit('storage:saving');
            
            // Сохраняем в in-memory кэш
            for (var i = 0; i < items.length; i++) {
                cache.set(items[i].key, items[i].value);
            }

            if (requiresAuth()) return authRequiredResult();
            
            // Отправляем на сервер пакетом
            return saveBatch(items).then(function(result) {
                if (result.success) {
                    emit('storage:saved');
                }
                return result;
            });
        }
    };
})();
