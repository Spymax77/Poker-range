// ============================================================
// dirty-tracker.js — отслеживание изменений данных
// ============================================================
(function() {
    const dirty = {
        metadata: { editor: false, gto: false },
        structure: { editor: false, gto: false },
        // ===== ЦВЕТА/ПРОФИЛИ (отдельный ключ хранения poker_range_colors_*) =====
        // colors         — автосохранение (создание/удаление цветов и профилей);
        // colorsExplicit — правки, напрямую влияющие на вид ячеек матрицы
        //                  (hex цвета, имя, boundaries ползунками, состав
        //                  мультицвета): сохраняются ТОЛЬКО по явному согласию
        //                  (кнопка «Сохранить», «Да» в диалоге переключения).
        colors: { editor: false, gto: false },
        colorsExplicit: { editor: false, gto: false },
        tables: { editor: new Set(), gto: new Set() }
    };

    function markMetadataDirty(mode) {
        if (!mode) mode = App.currentMode;
        dirty.metadata[mode] = true;
    }

    function markStructureDirty(mode) {
        if (!mode) mode = App.currentMode;
        dirty.structure[mode] = true;
    }

    function markColorsDirty(mode) {
        if (!mode) mode = App.currentMode;
        dirty.colors[mode] = true;
    }

    // Правки цветов, влияющие на вид ячеек: только явное сохранение
    function markColorsDirtyExplicit(mode) {
        if (!mode) mode = App.currentMode;
        dirty.colorsExplicit[mode] = true;
    }

    function markTableDirty(nodeId, mode) {
        if (!mode) mode = App.currentMode;
        dirty.tables[mode].add(String(nodeId));
    }

    function hasDirty() {
        for (const m of ['editor', 'gto']) {
            if (dirty.metadata[m]) return true;
            if (dirty.structure[m]) return true;
            if (dirty.colors[m]) return true;
            if (dirty.colorsExplicit[m]) return true;
            if (dirty.tables[m].size > 0) return true;
        }
        return false;
    }

    function clearDirty(mode) {
        if (mode) {
            dirty.metadata[mode] = false;
            dirty.structure[mode] = false;
            dirty.colors[mode] = false;
            dirty.colorsExplicit[mode] = false;
            dirty.tables[mode].clear();
        } else {
            for (const m of ['editor', 'gto']) {
                dirty.metadata[m] = false;
                dirty.structure[m] = false;
                dirty.colors[m] = false;
                dirty.colorsExplicit[m] = false;
                dirty.tables[m].clear();
            }
        }
    }

    function getDirtyTables(mode) {
        if (!mode) mode = App.currentMode;
        return Array.from(dirty.tables[mode]);
    }

    App.dirty = {
        markMetadataDirty: markMetadataDirty,
        markStructureDirty: markStructureDirty,
        markColorsDirty: markColorsDirty,
        markColorsDirtyExplicit: markColorsDirtyExplicit,
        markTableDirty: markTableDirty,
        hasDirty: hasDirty,
        clearDirty: clearDirty,
        getDirtyTables: getDirtyTables,
        _raw: dirty
    };
})();
