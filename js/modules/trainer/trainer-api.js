// ===== trainer-api.js — тренировка: точка входа (App.trainer) =====
// Раскладка модулей:
//   trainer-api.js     ← точка входа, App.trainer (этот файл)
//   trainer-engine.js  ← отражение основной матрицы + снапшот данных узла
//                        + оценка ответа (getCorrectActions)
//   trainer-ui.js      ← панель настройки тренировки в редакторе
//   trainer-store.js   ← узлы тренажёра: состояние и сохранение в БД
//   trainer-stats.js   ← статистика тренировки узла: счётчики + БД
//   trainer-page.js    ← левая панель вкладки «Тренажёр» (список узлов)
//   trainer-table.js   ← стол, кнопки действий, статистика (правая часть)
//   trainer-cards.js   ← колода, раздача и рендер карт HERO

import { initTrainingPanel, toggleTrainingPanel, setTrainingPanelVisible, isTrainingPanelVisible, refreshTrainingPanel } from './trainer-ui.js';
import { addTrainerNode, loadTrainerNodes, getTrainerNodes, getActiveNodeId, setActiveNodeId } from './trainer-store.js';
import { renderTrainerPage, removeTrainerNodeAndRefresh } from './trainer-page.js';
import { loadTrainerStats, getStats, getCells, resetStats, resetAllStats } from './trainer-stats.js';
import { finishTrainingSession, abandonTrainingSession } from './trainer-table.js';

App.trainer = {

    // ===== НАСТРОЙКА В РЕДАКТОРЕ (панель по кнопке «шапочка выпускника») =====

    // Инициализация: привязка обработчиков панели + загрузка узлов
    // тренажёра и их статистики из БД. Вызывается один раз.
    init: function() {
        initTrainingPanel();
        loadTrainerNodes().then(function() {
            return loadTrainerStats();
        }).then(function() {
            renderTrainerPage();
        });
        // Смена аккаунта (login/logout): узлы и статистика перечитываются
        // из БД — состояние предыдущего пользователя/гостя не должно «утекать».
        if (App.events && typeof App.events.on === 'function') {
            App.events.on('auth:changed', function() {
                // Сессия тренировки принадлежит ПРЕДЫДУЩЕМУ аккаунту/гостю:
                // закрываем её БЕЗ записи (при logout данные уже сохранены —
                // флош до выхода в auth-ui.js; гостевые не сохраняются вовсе).
                // Явное закрытие ДО сброса статистики делает защиту от утечки
                // данных между аккаунтами независимой от порядка обработчиков.
                abandonTrainingSession();
                resetAllStats();
                loadTrainerNodes().then(function() {
                    return loadTrainerStats();
                }).then(function() {
                    renderTrainerPage();
                });
            });
        }
    },

    // Показать/скрыть панель настройки тренировки.
    toggleSetup: function() {
        toggleTrainingPanel();
    },

    // Явный показ/скрыть (восстановление режима после F5 / после входа —
    // bootstrap.js и auth-ui.js). Идемпотентен: без смены видимости —
    // no-op. persist=false гасит сохранение в БД: состояние приходит
    // оттуда же.
    setSetupVisible: function(visible, persist) {
        setTrainingPanelVisible(visible, persist);
    },

    isSetupVisible: function() {
        return isTrainingPanelVisible();
    },

    // Обновить копию матрицы (смена диапазона / правка ячеек).
    refreshSetup: function() {
        refreshTrainingPanel();
    },

    // ===== УЗЛЫ ТРЕНАЖЁРА (вкладка «Тренажёр», левая панель) =====

    // Добавить диапазон в тренажёр (кнопка «Добавить в тренажёр» в редакторе).
    // data: { sourceNodeId, name, colors, matrix, participation, disabled,
    //         availability } —
    // снапшот обеих матриц (см. trainer-engine.buildTrainerSnapshot).
    // Каждый вызов создаёт новый узел.
    addRange: function(data) {
        const node = addTrainerNode(data);
        if (node) {
            renderTrainerPage();
            App.modals.showToast(App.i18n.t('trainer.added', { name: node.name }));
        }
        return node;
    },

    // Удалить узел из тренировки (пункт меню «⋮ → Удалить из тренировки»).
    // Статистика удалённого узла вычищается из БД вместе с узлом.
    removeRange: function(trainerNodeId) {
        // Удаляется узел текущей сессии — сессия отменяется БЕЗ записи
        // статистики: статистика удаляется вместе с узлом (resetStats ниже),
        // иначе уходят два запроса «записать → тут же удалить».
        abandonTrainingSession(trainerNodeId);
        const removed = removeTrainerNodeAndRefresh(trainerNodeId);
        if (removed) {
            resetStats(trainerNodeId);
            App.modals.showToast(App.i18n.t('trainer.removed'));
        }
        return removed;
    },

    // Список узлов тренажёра (для будущей сессии тренировки).
    getNodes: function() {
        return getTrainerNodes();
    },

    // Активный узел тренажёра (всегда ровно один, персистентно в БД).
    getActiveNodeId: function() {
        return getActiveNodeId();
    },

    // Смена активного узла. id=null при непустом списке отклоняется —
    // инвариант «всегда ровно один активный» (см. trainer-store.js).
    setActiveNodeId: function(id) {
        return setActiveNodeId(id);
    },

    // Перерисовать левую панель вкладки «Тренажёр» (вызывается при
    // переключении на вкладку — см. navigation.js).
    renderPage: function() {
        renderTrainerPage();
    },

    // ===== СТАТИСТИКА ТРЕНИРОВКИ (см. trainer-stats.js) =====
    // Накопительная по узлу, хранится в БД (poker_range_trainer_stats).
    // Сама сессия (раздача + оценка ответа) живёт в trainer-table.js.

    // Статистика узла: { total, correct, wrong } (+ % верных на шкале).
    getStats: function(trainerNodeId) {
        return getStats(trainerNodeId);
    },

    // Ячейная статистика узла (для будущей тепловой карты): 13×13 пар
    // [верно, неверно], накопительно без ограничений.
    getCells: function(trainerNodeId) {
        return getCells(trainerNodeId);
    },

    // Сброс статистики узла (пункт меню «⋮ → Сбросить статистику»).
    resetStats: function(trainerNodeId) {
        return resetStats(trainerNodeId);
    },

    // Финиш открытой сессии тренировки — как кнопка «Закончить тренировку»:
    // статистика пишется в БД одним запросом (гостю — не сохраняется),
    // состояние тренировки сбрасывается. Вызывается при уходе на другую
    // вкладку (navigation.js switchTab); смена активного узла финиширует
    // сессию по событию trainer:activeChanged (trainer-store → trainer-table).
    finishTraining: function() {
        return finishTrainingSession();
    }
};

// Инициализация панели после загрузки DOM (модули выполняются отложенно).
App.trainer.init();
