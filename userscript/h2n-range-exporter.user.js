// ==UserScript==
// @name         H2N ⇄ PFRangeTool Range Exporter
// @namespace    pfrange-tool
// @version      2.0.1
// @description  Экспорт диапазонов с hand2noteguide.com в формат PFRangeTool (localhost:3000). Учитывает тип узла: для поддиапазона частоты пересчитываются по доступности родительского диапазона.
// @author       PFRangeTool
// @match        https://hand2noteguide.com/*
// @match        http://localhost:3000/*
// @match        http://127.0.0.1:3000/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    // ДИАГНОСТИКА: если эта строка есть в консоли (F12) — скрипт запущен на странице
    console.log('[H2N Exporter] v2.0.1 загружен на', location.host);

    // ===== ОБЩЕЕ =====
    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const STORE_KEY = 'pfrange_context';
    const isPF = (location.host === 'localhost:3000' || location.host === '127.0.0.1:3000');
    const isH2N = (location.host.indexOf('hand2noteguide') !== -1);

    // Действия матрицы H2N (data-f = фолд, серый — не экспортируется)
    const ACTIONS = [
        { key: 'r', label: 'Рейз 100', color: '#ef4444', dataKey: 'r' },
        { key: 'b', label: 'Рейз 20',  color: '#f59e0b', dataKey: 'b' },
        { key: 'c', label: 'Колл',     color: '#22c55e', dataKey: 'c' }
    ];

    // percent (0..100, может быть дробным) → 'AA' | 'A8s:0.25' | null
    function formatHand(hand, percent) {
        if (percent <= 0) return null;
        if (Math.round(percent * 10) / 10 <= 0) return null; // как isDisplayablePercent
        if (percent >= 99.95) return hand;
        const freq = Math.round(percent * 100) / 10000; // до 4 знаков
        return hand + ':' + String(freq);
    }

    // ===== ЧАСТЬ 1: САЙТ PFRangeTool (localhost:3000) =====
    // Собирает контекст текущего узла и кладёт в общее хранилище Tampermonkey.

    function collectPFContext() {
        try {
            if (!W.App || !W.App.state || !W.getNode) return;
            const nodeId = W.App.state.currentNodeId;
            if (nodeId === null || nodeId === undefined) return;
            const node = W.getNode(nodeId);
            if (!node) return;

            const ctx = {
                ts: Date.now(),
                nodeId: nodeId,
                name: node.name || '',
                type: node.type || 'range',
                parentName: null,
                // руки с доступностью < 100% (только для поддиапазонов)
                avail: {},
                // простые цвета узла (для подсказки соответствия полей)
                colors: []
            };

            if (node.type === 'subrange' && node.parentId !== null && node.parentId !== undefined) {
                const pn = W.getNode(node.parentId);
                ctx.parentName = pn ? (pn.name || '') : null;
                if (W.App.stats && W.App.stats.getCellAvailabilityPercent && W.App.importManager) {
                    const map = W.App.importManager.generateHandMap();
                    Object.keys(map).forEach(hand => {
                        const ij = map[hand];
                        const av = W.App.stats.getCellAvailabilityPercent(nodeId, ij[0], ij[1], true);
                        if (av < 100) ctx.avail[hand] = Math.round(av * 100) / 100;
                    });
                }
            }

            const tid = W.getTableId(nodeId);
            const colors = (W.App.state.colorsPerNode[tid]) || [];
            ctx.colors = colors
                .filter(c => c.type === 'simple' || (!c.type && c.color))
                .map(c => ({ name: c.name, color: c.color }));

            GM_setValue(STORE_KEY, JSON.stringify(ctx));
        } catch (e) {
            console.warn('[H2N Exporter] Ошибка сбора контекста PF:', e);
        }
    }

    function startPF() {
        let lastNodeId = null;
        let lastType = null;
        setInterval(() => {
            try {
                const nid = (W.App && W.App.state) ? W.App.state.currentNodeId : null;
                const ntype = (nid !== null && W.getNode) ? (W.getNode(nid) || {}).type : null;
                if (nid !== lastNodeId || ntype !== lastType) {
                    lastNodeId = nid;
                    lastType = ntype;
                    collectPFContext();
                }
            } catch (e) {}
        }, 1000);
        // мгновенная реакция на клики (смена узла, заливка ячеек родителя и т.д.)
        document.addEventListener('click', () => setTimeout(collectPFContext, 200), true);
        collectPFContext();

        // индикатор моста
        const badge = document.createElement('div');
        badge.textContent = '📤 H2N мост активен';
        badge.title = 'Скрипт передаёт текущий узел в H2N Range Exporter (hand2noteguide.com)';
        badge.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99998;background:#2f81f7;color:#fff;font:11px system-ui,sans-serif;padding:4px 9px;border-radius:6px;opacity:.85;pointer-events:none;';
        document.body.appendChild(badge);
    }


    // ===== ЧАСТЬ 2: САЙТ hand2noteguide =====

    function parseGrid() {
        const grid = document.querySelector('table.gto-grid');
        if (!grid) return null;
        const cells = grid.querySelectorAll('.gto-cell[data-hand]');
        const result = {};
        ACTIONS.forEach(a => { result[a.key] = []; });
        cells.forEach(cell => {
            const hand = cell.dataset.hand;
            if (!hand) return;
            ACTIONS.forEach(a => {
                const percent = parseFloat(cell.dataset[a.dataKey]) || 0;
                if (percent > 0) result[a.key].push({ hand: hand, percent: percent });
            });
        });
        return result;
    }

    function readPFContext() {
        try {
            const raw = GM_getValue(STORE_KEY, null);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    // Собирает строки по каждому действию с учётом контекста PFRangeTool.
    // Диапазон      → проценты как на сайте (доля от всей клетки).
    // Поддиапазон   → ввод = процент × доступность / 100 (нормировка импорта на freeSpace).
    function buildBlocks(parsed, ctx) {
        const useAvail = !!(ctx && ctx.type === 'subrange');
        return ACTIONS.map(a => {
            const items = parsed[a.key].map(item => {
                let percent = item.percent;
                if (useAvail) {
                    const av = (ctx.avail && ctx.avail[item.hand] !== undefined) ? ctx.avail[item.hand] : 100;
                    percent = percent * av / 100;
                }
                return formatHand(item.hand, percent);
            }).filter(Boolean);
            return { action: a, text: items.join(', '), count: items.length };
        });
    }

    function contextLabel(ctx) {
        if (!ctx) return 'нет связи с PFRangeTool — сырые проценты';
        if (ctx.type === 'subrange') {
            return 'поддиапазон «' + ctx.name + '»' +
                (ctx.parentName ? ' · родитель: «' + ctx.parentName + '»' : '') +
                ' — частоты пересчитаны по доступности';
        }
        return 'диапазон «' + ctx.name + '» — проценты как на сайте';
    }


    // ===== ЧАСТЬ 3: ПАНЕЛЬ ЭКСПОРТА (hand2noteguide) =====

    let panel = null;

    function copyText(text, btn) {
        const done = () => {
            if (!btn) return;
            const old = btn.textContent;
            btn.textContent = '✓ Скопировано';
            setTimeout(() => { btn.textContent = old; }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
        } else {
            fallbackCopy(text, done);
        }
    }

    function fallbackCopy(text, done) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
    }

    function buildPanel() {
        panel = document.createElement('div');
        panel.id = 'h2n-export-panel';
        panel.style.cssText = [
            'position:fixed', 'top:70px', 'right:16px', 'z-index:99999',
            'width:440px', 'max-width:95vw', 'max-height:85vh', 'overflow:auto',
            'background:#1e2126', 'color:#e5eaf0', 'border:1px solid #3d3f46',
            'border-radius:10px', 'box-shadow:0 8px 30px rgba(0,0,0,.45)',
            'font:14px/1.4 system-ui, sans-serif', 'display:none', 'padding:14px'
        ].join(';');

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-weight:600;font-size:15px;">📤 Экспорт диапазона</div>
                <button id="h2n-export-close" style="background:none;border:none;color:#8a848a;font-size:18px;cursor:pointer;">✕</button>
            </div>
            <div id="h2n-export-context" style="color:#8a848a;font-size:12px;margin-bottom:4px;"></div>
            <div id="h2n-export-colors" style="color:#8a848a;font-size:12px;margin-bottom:10px;"></div>
            <div id="h2n-export-fields"></div>
            <div style="margin-top:10px;display:flex;gap:8px;">
                <button id="h2n-export-refresh" style="flex:1;padding:7px;border:1px solid #3d3f46;border-radius:6px;background:#2a2d33;color:#e5eaf0;cursor:pointer;">↻ Обновить</button>
                <button id="h2n-export-copyall" style="flex:1;padding:7px;border:1px solid #3d3f46;border-radius:6px;background:#2a2d33;color:#e5eaf0;cursor:pointer;">📋 Копировать всё</button>
            </div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('#h2n-export-close').addEventListener('click', () => { panel.style.display = 'none'; });
        panel.querySelector('#h2n-export-refresh').addEventListener('click', renderFields);
        panel.querySelector('#h2n-export-copyall').addEventListener('click', function () {
            const blocks = panel.querySelectorAll('textarea');
            const all = Array.from(blocks).map(t => t.value).filter(Boolean).join('\n');
            if (all) copyText(all, this);
        });
    }


    function renderFields() {
        if (!panel) return;
        const parsed = parseGrid();
        const ctx = readPFContext();
        const fields = panel.querySelector('#h2n-export-fields');
        panel.querySelector('#h2n-export-context').textContent = '🎯 ' + contextLabel(ctx);

        const colorsBox = panel.querySelector('#h2n-export-colors');
        if (ctx && ctx.colors && ctx.colors.length) {
            colorsBox.innerHTML = 'Простые цвета узла: ' + ctx.colors.map((c, i) =>
                '<span style="color:#e5eaf0;">' + (i + 1) + '. ' + c.name + '</span>'
            ).join(', ');
        } else {
            colorsBox.textContent = '';
        }

        fields.innerHTML = '';
        if (!parsed) {
            fields.innerHTML = '<div style="color:#e55757;">Матрица не найдена на странице.</div>';
            return;
        }

        const blocks = buildBlocks(parsed, ctx);
        let empty = true;
        blocks.forEach(block => {
            if (!block.text) return;
            empty = false;
            const el = document.createElement('div');
            el.style.cssText = 'margin-bottom:12px;';
            el.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="width:14px;height:14px;border-radius:3px;background:${block.action.color};display:inline-block;"></span>
                    <span style="font-weight:600;">${block.action.label}</span>
                    <span style="color:#8a848a;font-size:12px;">${block.count} рук</span>
                    <button data-copy="1" style="margin-left:auto;padding:3px 10px;border:1px solid #3d3f46;border-radius:5px;background:#2a2d33;color:#e5eaf0;cursor:pointer;font-size:12px;">📋 Копировать</button>
                </div>
                <textarea readonly style="width:100%;box-sizing:border-box;height:64px;resize:vertical;background:#14161a;color:#e5eaf0;border:1px solid #3d3f46;border-radius:6px;padding:6px;font:12px/1.5 monospace;"></textarea>
            `;
            el.querySelector('textarea').value = block.text;
            el.querySelector('[data-copy]').addEventListener('click', function () {
                copyText(block.text, this);
            });
            fields.appendChild(el);
        });

        if (empty) {
            fields.innerHTML = '<div style="color:#e5a557;">В матрице нет ни одной активной руки (только фолд).</div>';
        }
    }

    // ===== ЧАСТЬ 4: КНОПКА И СТАРТ =====

    function buildButton() {
        const btn = document.createElement('button');
        btn.id = 'h2n-export-btn';
        btn.textContent = '📤 Экспорт';
        btn.title = 'Экспорт диапазона в формат PFRangeTool';
        btn.style.cssText = [
            'position:fixed', 'bottom:20px', 'right:20px', 'z-index:99999',
            'padding:10px 16px', 'border:none', 'border-radius:8px',
            'background:#2f81f7', 'color:#fff', 'font:600 14px system-ui, sans-serif',
            'cursor:pointer', 'box-shadow:0 4px 14px rgba(0,0,0,.35)'
        ].join(';');
        btn.addEventListener('click', () => {
            if (!panel) buildPanel();
            if (panel.style.display === 'none') {
                renderFields();
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });
        document.body.appendChild(btn);
    }

    function startH2N() {
        buildButton();
        // автообновление открытой панели при смене узла на сайте PFRangeTool
        if (typeof GM_addValueChangeListener === 'function') {
            GM_addValueChangeListener(STORE_KEY, () => {
                if (panel && panel.style.display !== 'none') renderFields();
            });
        }
    }

    if (isPF) {
        const pfTimer = setInterval(() => {
            if (W.App && W.App.state) { clearInterval(pfTimer); startPF(); }
        }, 500);
        setTimeout(() => clearInterval(pfTimer), 20000);
    } else if (isH2N) {
        const h2nTimer = setInterval(() => {
            if (document.querySelector('table.gto-grid')) { clearInterval(h2nTimer); startH2N(); }
        }, 500);
        setTimeout(() => clearInterval(h2nTimer), 20000);
    }

})();
