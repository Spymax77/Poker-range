// ===== rng.js — ГСЧ (генератор случайных чисел) =====

App.rng = App.rng || {};

// ===== ГСЧ (Генератор случайных чисел) =====
const rngWidget = document.getElementById("rngNumber");

// Чистое значение 1..100 без привязки к виджету: используется тренажёром
// (js/modules/trainer/) для оценки верного ответа при каждой раздаче.
App.rng.next = function() {
    return Math.floor(Math.random() * 100) + 1;
};

App.rng.roll = function() {
    rngWidget.textContent = App.rng.next();
};

if (rngWidget) {
    App.rng.roll();
    rngWidget.addEventListener('click', App.rng.roll);
}
