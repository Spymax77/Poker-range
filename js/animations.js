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
