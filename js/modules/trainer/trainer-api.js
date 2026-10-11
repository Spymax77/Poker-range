// ===== trainer-api.js — тренировка: точка входа (App.trainer) =====
// Раскладка модулей:
//   trainer-api.js     ← точка входа, App.trainer (этот файл)
//   trainer-engine.js  ← генерация набора рук (правильные + близкие неправильные)
//   trainer-ui.js      ← панель настройки тренировки в редакторе
//   trainer-stats.js   ← статистика сессии (будет)
// Сама тренировка будет во вкладке «Тренажёр» — здесь пока только подводка
// и настройка в редакторе.

import { initTrainingPanel, toggleTrainingPanel, isTrainingPanelVisible, refreshTrainingPanel } from './trainer-ui.js';

// ===== СОСТОЯНИЕ СЕССИИ (заглушки до вкладки «Тренажёр») =====
const trainerState = {
    active: false,   // сессия тренировки запущена
    situation: null  // текущая ситуация
};

App.trainer = {

    // ===== НАСТРОЙКА В РЕДАКТОРЕ (панель по кнопке «шапочка выпускника») =====

    // Инициализация: привязка обработчиков панели. Вызывается один раз.
    init: function() {
        initTrainingPanel();
    },

    // Показать/скрыть панель настройки тренировки.
    toggleSetup: function() {
        toggleTrainingPanel();
    },

    isSetupVisible: function() {
        return isTrainingPanelVisible();
    },

    // Обновить копию матрицы (смена диапазона / правка ячеек).
    refreshSetup: function() {
        refreshTrainingPanel();
    },

    // ===== СЕССИЯ (заглушки: вкладка «Тренажёр» будет позже) =====

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
