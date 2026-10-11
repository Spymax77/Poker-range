// ===== palette-toolbar.js — кнопки палитры (добавление цвета и профиля) =====

App.paletteToolbar = App.paletteToolbar || {};

// ===== КНОПКИ ДОБАВЛЕНИЯ ЦВЕТА И ПРОФИЛЯ =====

App.paletteToolbar.onAddColorClick = function() {
    App.colors.addPaletteColor();
    App.refresh.all();
};
document.getElementById("addPaletteColorBtn")?.addEventListener('click', App.paletteToolbar.onAddColorClick);

App.paletteToolbar.onNewProfileClick = function() {
    App.colors.createNewProfile();
    App.refresh.all();
};
document.getElementById("newProfileBtn")?.addEventListener('click', App.paletteToolbar.onNewProfileClick);

// GTO версии кнопок
App.paletteToolbar.onGtoAddColorClick = function() {
    App.colors.addPaletteColor();
    App.navigation.renderGtoPage();
};
document.getElementById("gtoAddPaletteColorBtn")?.addEventListener('click', App.paletteToolbar.onGtoAddColorClick);

App.paletteToolbar.onGtoNewProfileClick = function() {
    App.colors.createNewProfile();
    App.navigation.renderGtoPage();
};
document.getElementById("gtoNewProfileBtn")?.addEventListener('click', App.paletteToolbar.onGtoNewProfileClick);
