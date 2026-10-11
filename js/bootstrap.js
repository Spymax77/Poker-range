// ===== bootstrap.js — запуск приложения (стартовая цепочка инициализации) =====

App.bootstrap = App.bootstrap || {};

// ===== ПОДПИСКИ НА СОБЫТИЯ =====
App.events.on('data:changed', App.refresh.allGrids);

// ===== ЗАПУСК ПРИ ЗАГРУЗКЕ =====
(function() {
    // ES-модули матрицы (js/modules/grid/grid-*.js) исполняются асинхронно
    // после классических скриптов. Если auth/storage успевают отработать
    // раньше, чем догрузятся модули, App.grid ещё не существует и
    // App.refresh.all() падает сразу после отрисовки дерева: дерево есть,
    // матрицы нет (лечится F5). Поэтому явно дожидаемся модулей — параллельно
    // с остальной инициализацией, так что обычный старт не замедляется.
    App.bootstrap.waitForGridModules = function(timeoutMs) {
        if (App.grid) return Promise.resolve();
        return new Promise(function(resolve) {
            let started = Date.now();
            let timer = setInterval(function() {
                if (App.grid || Date.now() - started > timeoutMs) {
                    clearInterval(timer);
                    resolve();
                }
            }, 25);
        });
    };

    App.bootstrap.switchTabWhenReady = function(tab) {
        return App.bootstrap.waitForGridModules(10000).then(function() {
            // Модули матрицы могли не догрузиться за отведённое время — тогда
            // App.grid недоступен. Вызовы App.grid.* гасим проверками (паттерн
            // persistence.js), а App.navigation.switchTab оборачиваем в
            // try/catch: он сам трогает App.grid внутри (App.refresh.all →
            // App.grid.updateCurrentDisplay) и без матрицы падает TypeError'ом.
            // Инициализация при этом не обрывается: комментарии и ресайз дерева
            // отрабатывают в любом случае.
            try {
                App.navigation.switchTab(tab);
                if (App.grid) {
                    if (tab === 'constructor' && App.state.analysisMode) {
                        App.grid.refreshConstructorAnalysisMode();
                    }
                    App.grid.updateConstructorToolbarState();
                }
            } catch (error) {
                console.error('Ошибка переключения вкладки при запуске:', error);
            }
            App.comments.initComments();
            App.treePanel.initResize();
        });
    };

    App.auth.checkSession().then(function() {
        return Promise.all([
            App.storage.initialize(),
            App.bootstrap.waitForGridModules(10000)
        ]);
    }).then(function() {
        return App.persistence.loadFromStorage().then(function(tab) {
            return tab || 'constructor';
        });
    }).then(function(activeTab) {
        return App.bootstrap.switchTabWhenReady(activeTab);
    }).catch(function(error) {
        console.error('Ошибка инициализации хранилища:', error);
        // Промис резервной инициализации возвращаем (раньше терялся):
        // финальная стадия цепочки должна дождаться его завершения,
        // а не выполняться параллельно ему.
        return App.persistence.loadFromStorage().then(function(activeTab) {
            return App.bootstrap.switchTabWhenReady(activeTab || 'constructor');
        }).catch(function(loadError) {
            console.error('Ошибка резервной загрузки состояния:', loadError);
            return App.bootstrap.switchTabWhenReady('constructor');
        });
    }).finally(function() {
        // Выставляем всегда — и по успеху, и после резервной ветки: без флага
        // auth:changed будет игнорировать вход в аккаунт (reloadAllData).
        App.state.initialLoadDone = true;
    });
})();
