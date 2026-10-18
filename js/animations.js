// ===== animations.js — анимации мерцания =====

App.animations = App.animations || {};

App.animations.fadeStatsTable = function(containerId) {
    const stats = document.getElementById(containerId);
    if (stats) {
        stats.classList.remove('matrix-fade');
        void stats.offsetWidth;
        stats.classList.add('matrix-fade');
    }
}

// ===== АНИМАЦИЯ МЕРЦАНИЯ ДЛЯ КОНСТРУКТОРА =====
App.animations.constructorFade = function() {
    const grid = document.getElementById('constructorGrid');
    if (grid) {
        grid.classList.remove('matrix-fade');
        void grid.offsetWidth;
        grid.classList.add('matrix-fade');
    }

    // Панель настройки тренировки (вторая матрица справа) мерцает вместе с
    // основной: тот же класс matrix-fade (та же keyframes fadeEffect и
    // длительность 0.45s), навешенный в этом же кадре, поэтому обе матрицы
    // начинают и заканчивают fade одновременно и не «разъезжаются» при
    // переключении диапазона. Вне режима тренировки панель display:none —
    // класс на ней безвреден.
    const trainingPanel = document.getElementById('trainingSetupPanel');
    if (trainingPanel) {
        trainingPanel.classList.remove('matrix-fade');
        void trainingPanel.offsetWidth;
        trainingPanel.classList.add('matrix-fade');
    }

    // Плашка «Добавить в тренажёр» под основной матрицей мерцает вместе с ней:
    // тот же класс matrix-fade (та же keyframes fadeEffect и длительность
    // 0.45s), навешенный в этом же кадре — fade начинается и заканчивается
    // одновременно с матрицей. Вне режима тренировки кнопка display:none —
    // класс на ней безвреден.
    const trainingStartBtn = document.getElementById('trainingStartBtn');
    if (trainingStartBtn) {
        trainingStartBtn.classList.remove('matrix-fade');
        void trainingStartBtn.offsetWidth;
        trainingStartBtn.classList.add('matrix-fade');
    }

    App.animations.fadeStatsTable('constructorStatsContainer');

    const palette = document.getElementById('paletteList');
    if (palette) {
        palette.classList.remove('palette-fade');
        void palette.offsetWidth;
        palette.classList.add('palette-fade');
    }

    const profiles = document.getElementById('profileList');
    if (profiles) {
        profiles.classList.remove('profiles-fade');
        void profiles.offsetWidth;
        profiles.classList.add('profiles-fade');
    }

    const legend = document.querySelector('.constructor-legend-col');
    if (legend) {
        legend.classList.remove('matrix-fade');
        void legend.offsetWidth;
        legend.classList.add('matrix-fade');
    }

    const addColorBtn = document.getElementById('addPaletteColorBtn');
    if (addColorBtn) {
        addColorBtn.classList.remove('buttons-fade');
        void addColorBtn.offsetWidth;
        addColorBtn.classList.add('buttons-fade');
    }

    const addProfileBtn = document.getElementById('newProfileBtn');
    if (addProfileBtn) {
        addProfileBtn.classList.remove('buttons-fade');
        void addProfileBtn.offsetWidth;
        addProfileBtn.classList.add('buttons-fade');
    }
}

// ===== АНИМАЦИЯ МЕРЦАНИЯ ДЛЯ GTO =====
App.animations.gtoFade = function() {
    const grid = document.getElementById('gtoGrid');
    if (grid) {
        grid.classList.remove('matrix-fade');
        void grid.offsetWidth;
        grid.classList.add('matrix-fade');
    }

    App.animations.fadeStatsTable('gtoStatsContainer');

    const palette = document.getElementById('gtoPaletteList');
    if (palette) {
        palette.classList.remove('palette-fade');
        void palette.offsetWidth;
        palette.classList.add('palette-fade');
    }

    const profiles = document.getElementById('gtoProfileList');
    if (profiles) {
        profiles.classList.remove('profiles-fade');
        void profiles.offsetWidth;
        profiles.classList.add('profiles-fade');
    }

    const legend = document.querySelector('.gto-legend-col');
    if (legend) {
        legend.classList.remove('matrix-fade');
        void legend.offsetWidth;
        legend.classList.add('matrix-fade');
    }

    const addColorBtn = document.getElementById('gtoAddPaletteColorBtn');
    if (addColorBtn) {
        addColorBtn.classList.remove('buttons-fade');
        void addColorBtn.offsetWidth;
        addColorBtn.classList.add('buttons-fade');
    }

    const addProfileBtn = document.getElementById('gtoNewProfileBtn');
    if (addProfileBtn) {
        addProfileBtn.classList.remove('buttons-fade');
        void addProfileBtn.offsetWidth;
        addProfileBtn.classList.add('buttons-fade');
    }
}

// ===== АНИМАЦИЯ МЕРЦАНИЯ ДЛЯ ТРЕНАЖЁРА =====
// При переключении диапазона в списке тренажёра матрица и тумблер режимов
// под ней мерцают так же, как матрица редактора при смене диапазона:
// класс matrix-fade (та же keyframes fadeEffect и длительность 0.45s),
// навешенный в этом же кадре — оба начинают и заканчивают fade одновременно.
App.animations.trainerFade = function() {
    const grid = document.querySelector('#trainerPage .trainer-matrix-grid');
    if (grid) {
        grid.classList.remove('matrix-fade');
        void grid.offsetWidth;
        grid.classList.add('matrix-fade');
    }

    const toggle = document.querySelector('#trainerPage .trainer-matrix-mode-toggle');
    if (toggle) {
        toggle.classList.remove('matrix-fade');
        void toggle.offsetWidth;
        toggle.classList.add('matrix-fade');
    }
}
