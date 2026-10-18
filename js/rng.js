// ===== rng.js — ГСЧ (генератор случайных чисел) =====

App.rng = App.rng || {};

// ===== ГСЧ (Генератор случайных чисел) =====
const rngWidget = document.getElementById("rngNumber");

// Чистое значение 1..100: использует виджет ГСЧ во вкладке «Просмотр»
// (App.rng.roll ниже).
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
