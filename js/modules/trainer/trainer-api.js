// ===== trainer-api.js — тренировка: точка входа (App.trainer) =====
// Раскладка модулей:
//   trainer-api.js     ← точка входа, App.trainer (этот файл)
//   trainer-engine.js  ← отражение основной матрицы + снапшот данных узла
//   trainer-ui.js      ← панель настройки тренировки в редакторе
//   trainer-store.js   ← узлы тренажёра: состояние и сохранение в БД
//   trainer-page.js    ← левая панель вкладки «Тренажёр» (список узлов)
//   trainer-stats.js   ← статистика сессии (будет)
// Сама тренировка (правая часть вкладки) будет позже — сейчас узлы
// добавляются в тренажёр из редактора и хранятся в БД.

import { initTrainingPanel, toggleTrainingPanel, setTrainingPanelVisible, isTrainingPanelVisible, refreshTrainingPanel } from './trainer-ui.js';
import { addTrainerNode, loadTrainerNodes, getTrainerNodes } from './trainer-store.js';
import { renderTrainerPage, removeTrainerNodeAndRefresh } from './trainer-page.js';

// ===== СОСТОЯНИЕ СЕССИИ (заглушки до правой части вкладки «Тренажёр») =====
const trainerState = {
    active: false,   // сессия тренировки запущена
    situation: null  // текущая ситуация
};

App.trainer = {

    // ===== НАСТРОЙКА В РЕДАКТОРЕ (панель по кнопке «шапочка выпускника») =====

    // Инициализация: привязка обработчиков панели + загрузка узлов
    // тренажёра из БД. Вызывается один раз.
    init: function() {
        initTrainingPanel();
        loadTrainerNodes().then(function() {
            renderTrainerPage();
        });
        // Смена аккаунта (login/logout): узлы перечитываются из БД —
        // состояние предыдущего пользователя/гостя не должно «утекать».
        if (App.events && typeof App.events.on === 'function') {
            App.events.on('auth:changed', function() {
                loadTrainerNodes().then(function() {
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
    // data: { sourceNodeId, name, colors, matrix, participation, disabled } —
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
    removeRange: function(trainerNodeId) {
        const removed = removeTrainerNodeAndRefresh(trainerNodeId);
        if (removed) {
            App.modals.showToast(App.i18n.t('trainer.removed'));
        }
        return removed;
    },

    // Список узлов тренажёра (для будущей сессии тренировки).
    getNodes: function() {
        return getTrainerNodes();
    },

    // Перерисовать левую панель вкладки «Тренажёр» (вызывается при
    // переключении на вкладку — см. navigation.js).
    renderPage: function() {
        renderTrainerPage();
    },

    // ===== СЕССИЯ (заглушки: правая часть вкладки будет позже) =====

    getState: function() {
        return trainerState;
    },

    startSession: function(options) {
        trainerState.active = true;
        trainerState.situation = null;
        return null;
    },

    stopSession: function() {
        trainerState.active = false;
        trainerState.situation = null;
    },

    nextSituation: function() {
        trainerState.situation = null;
        return null;
    },

    submitAnswer: function(answer) {
        return null;
    },

    getStats: function() {
        return null;
    }
};

// Инициализация панели после загрузки DOM (модули выполняются отложенно).
App.trainer.init();
