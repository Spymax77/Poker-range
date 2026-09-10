// ============================================================
// dirty-tracker.js — отслеживание изменений данных
// ============================================================
(function() {
    const dirty = {
        metadata: { editor: false, gto: false },
        structure: { editor: false, gto: false },
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

    function markTableDirty(nodeId, mode) {
        if (!mode) mode = App.currentMode;
        dirty.tables[mode].add(String(nodeId));
    }

    function hasDirty() {
        for (const m of ['editor', 'gto']) {
            if (dirty.metadata[m]) return true;
            if (dirty.structure[m]) return true;
            if (dirty.tables[m].size > 0) return true;
        }
        return false;
    }

    function clearDirty(mode) {
        if (mode) {
            dirty.metadata[mode] = false;
            dirty.structure[mode] = false;
            dirty.tables[mode].clear();
        } else {
            for (const m of ['editor', 'gto']) {
                dirty.metadata[m] = false;
                dirty.structure[m] = false;
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
        markTableDirty: markTableDirty,
        hasDirty: hasDirty,
        clearDirty: clearDirty,
        getDirtyTables: getDirtyTables,
        _raw: dirty
    };
})();
