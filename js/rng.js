// ===== rng.js — ГСЧ (генератор случайных чисел) =====

App.rng = App.rng || {};

// ===== ГСЧ (Генератор случайных чисел) =====
const rngWidget = document.getElementById("rngNumber");

App.rng.roll = function() {
    rngWidget.textContent = Math.floor(Math.random() * 100) + 1;
};

if (rngWidget) {
    App.rng.roll();
    rngWidget.addEventListener('click', App.rng.roll);
}
