// ==UserScript==
// @name         GTOWizard <-> Poker Range Copy/Paste
// @namespace    poker-range-dev
// @version      1.3
// @description  Единый скрипт: на GTOWizard копирует диапазон по хоткеям и шлёт сигнал (текст + название скопированного действия), на localhost:3000 слушает сигнал, при необходимости переименовывает цвет в соответствующем поле окна импорта (importColorName1/2), чтобы его название совпадало с названием скопированного диапазона, и вставляет текст в это поле (открывая окно через #importRangeBtn, если оно ещё не открыто). После нажатия «Импортировать» автоматически сохраняет диапазон (эмулирует клик по #tableSaveBtn). Объединён в один скрипт, потому что GM_setValue/GM_addValueChangeListener хранят данные в изолированном namespace каждого userscript'а и не видят друг друга между разными скриптами.
// @match        https://app.gtowizard.com/*
// @match        http://localhost:3000/*
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (location.hostname === 'app.gtowizard.com') {
    runGtoWizardSide();
  } else if (location.hostname === 'localhost') {
    runPokerRangeSide();
  }

  // ===================== GTOWizard: копирование =====================
  function runGtoWizardSide() {
    function sendPasteSignal(text, actionName) {
      GM_setValue('copy_channel_signal', { action: 'paste', text, actionName, ts: Date.now() });
    }

    // Подменю копирования всегда содержит кнопки в порядке:
    // [0] "Весь диапазон" (исключаем, не нужна)
    // [1] Allin, [2] Raise, [3] Call, [4] Fold (набор может отличаться по споту).
    // Хоткей N -> N-я кнопка после "Весь диапазон". W/E/R/T -> левая таблица,
    // Z/X/C/V -> правая (по горизонтальной позиции на экране).
    const HOTKEYS = {
      KeyW: { tableIndex: 0, index: 0 },
      KeyE: { tableIndex: 0, index: 1 },
      KeyR: { tableIndex: 0, index: 2 },
      KeyT: { tableIndex: 0, index: 3 },
      KeyZ: { tableIndex: 1, index: 0 },
      KeyX: { tableIndex: 1, index: 1 },
      KeyC: { tableIndex: 1, index: 2 },
      KeyV: { tableIndex: 1, index: 3 },
    };

    function dispatchMouse(el, type) {
      el.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
      }));
    }

    function findCopyOpeners() {
      return [...document.querySelectorAll('.gw_pop_menu')]
        .filter(menu => menu.querySelector('.mdi-content-copy'))
        .map(menu => menu.querySelector('.gw_pop_menu_opener'))
        .filter(el => el && el.offsetParent !== null)
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    }

    async function openMenuAndGetButtons(menuOpener) {
      dispatchMouse(menuOpener, 'mouseover');
      dispatchMouse(menuOpener, 'mouseenter');
      await new Promise((resolve) => setTimeout(resolve, 60));
      const menu = menuOpener.closest('.gw_pop_menu');
      const content = menu && menu.querySelector('.gw_pop_menu_content');
      if (!content) return null;
      return [...content.querySelectorAll('.gwbtns_btn')];
    }

    function closeMenu(menuOpener) {
      dispatchMouse(menuOpener, 'mouseleave');
      dispatchMouse(menuOpener, 'mouseout');
    }

    async function triggerCopy(action) {
      const openers = findCopyOpeners();
      if (!openers.length) {
        console.warn('[gwHotkeys] кнопка "копировать" не найдена');
        return;
      }

      const opener = openers[action.tableIndex];
      if (!opener) {
        console.warn('[gwHotkeys] таблицы', action.tableIndex + 1, 'нет. Найдено:', openers.length);
        return;
      }

      const buttons = await openMenuAndGetButtons(opener);
      if (!buttons) {
        console.warn('[gwHotkeys] подменю не открылось');
        return;
      }

      const rest = buttons.slice(1);
      const target = rest[action.index];
      if (!target) {
        console.warn('[gwHotkeys] кнопки', action.index + 1, 'нет. Доступны:', rest.map(b => b.textContent.trim()));
        closeMenu(opener);
        return;
      }

      dispatchMouse(target, 'mousedown');
      dispatchMouse(target, 'mouseup');
      dispatchMouse(target, 'click');
      closeMenu(opener);
      const actionName = target.textContent.trim();
      console.log('[gwHotkeys] скопировано:', actionName);

      // Клик выше — настоящий, инициированный кодом в рамках доверенного
      // обработчика keydown, поэтому именно здесь navigator.clipboard.readText()
      // ещё может сработать (activation ещё не "остыла"). Дальше, на стороне
      // localhost, читать буфер из синтетического keydown уже нельзя.
      setTimeout(async () => {
        let text = '';
        try {
          text = await navigator.clipboard.readText();
        } catch (err) {
          console.warn('[gwHotkeys] не удалось прочитать буфер обмена:', err);
        }
        sendPasteSignal(text, actionName);
        console.log('[gwHotkeys] сигнал отправлен, длина текста:', text.length, ', название действия:', actionName);
      }, 50);
    }

    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const action = HOTKEYS[e.code];
      if (!action) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      triggerCopy(action);
    }, true);

    console.log('[gwHotkeys] активны: W/E/R/T = левая, Z/X/C/V = правая');
  }

  // ===================== localhost:3000: автовставка =====================
  function runPokerRangeSide() {
    let lastHandledTs = 0;

    GM_addValueChangeListener('copy_channel_signal', (name, oldValue, newValue, remote) => {
      if (!remote) return;
      if (!newValue || newValue.action !== 'paste') return;
      if (newValue.ts === lastHandledTs) return;
      lastHandledTs = newValue.ts;

      console.log('[autoPaste] получен сигнал через GM_addValueChangeListener');
      handleAutoPaste(newValue.text || '', newValue.actionName || '');
    });

    // ===== АВТОСОХРАНЕНИЕ ПОСЛЕ ИМПОРТА =====
    // Слушатель навешан на document (делегирование), потому что кнопка
    // #importApplyBtn пересоздаётся каждый раз при открытии окна импорта
    // (см. createImportWindow() в import-manager.js) — обычный addEventListener
    // на самой кнопке в момент загрузки страницы её ещё не застал бы.
    //
    // Клик по кнопке всплывает от неё к document, поэтому собственный
    // обработчик сайта (навешанный прямо на #importApplyBtn) успевает
    // полностью отработать раньше, чем сработает этот слушатель — можно
    // проверять результат его работы синхронно, без setTimeout.
    //
    // Обработчик сайта закрывает окно импорта (удаляет #importApplyBtn из
    // DOM) только если импорт реально применился (хотя бы одно поле было
    // заполнено). Если оба поля пустые — сайт показывает предупреждение и
    // оставляет окно открытым, #importApplyBtn остаётся в DOM. Поэтому
    // "диапазон импортирован" определяем по исчезновению кнопки из DOM —
    // это не даёт сохранять при неудачной попытке импорта.
    document.addEventListener('click', function (e) {
      const applyBtn = e.target && e.target.closest && e.target.closest('#importApplyBtn');
      if (!applyBtn) return;

      if (document.getElementById('importApplyBtn')) {
        console.log('[autoSave] окно импорта осталось открытым (импорт не применён), сохранение отменено');
        return;
      }

      const saveBtn = document.getElementById('tableSaveBtn');
      if (!saveBtn) {
        console.warn('[autoSave] кнопка #tableSaveBtn не найдена, сохранение не выполнено');
        return;
      }

      saveBtn.click();
      console.log('[autoSave] диапазон импортирован, сохранение выполнено (клик по #tableSaveBtn)');
    }, false);

    // Эмуляция нажатия клавиш убрана: navigator.clipboard.readText() внутри
    // handleImportHotkeys() не срабатывает на синтетическом keydown (нет
    // настоящей user activation). Вместо этого текст диапазона едет прямо в
    // сигнале GM_setValue и записывается в textarea.value напрямую.
    function handleAutoPaste(text, actionName) {
      const textarea1 = document.getElementById('importTextarea1');
      const textarea2 = document.getElementById('importTextarea2');

      if (textarea1 && textarea2) {
        // Окно импорта уже открыто — вставляем сразу.
        pasteIntoFields(text, actionName);
        return;
      }

      // Окно импорта не открыто — открываем его кликом по кнопке
      // importRangeBtn (она вызывает showImportWindow) и ждём, пока в DOM
      // появятся textarea1/textarea2, прежде чем вставлять текст.
      const importBtn = document.getElementById('importRangeBtn');
      if (!importBtn) {
        console.warn('[autoPaste] окно импорта не открыто, кнопка #importRangeBtn не найдена');
        return;
      }

      console.log('[autoPaste] окно импорта не открыто, открываем через #importRangeBtn');
      importBtn.click();
      waitForImportWindowAndPaste(text, actionName);
    }

    // Опрашивает DOM на появление textarea1/textarea2 после клика по
    // importRangeBtn и вставляет текст, как только окно импорта откроется.
    function waitForImportWindowAndPaste(text, actionName, attemptsLeft = 20) {
      const textarea1 = document.getElementById('importTextarea1');
      const textarea2 = document.getElementById('importTextarea2');

      if (textarea1 && textarea2) {
        pasteIntoFields(text, actionName);
        return;
      }

      if (attemptsLeft <= 0) {
        console.warn('[autoPaste] не удалось дождаться открытия окна импорта');
        return;
      }

      setTimeout(() => waitForImportWindowAndPaste(text, actionName, attemptsLeft - 1), 50);
    }

    // ===== ПЕРЕИМЕНОВАНИЕ ЦВЕТА ПРИ НЕСОВПАДЕНИИ НАЗВАНИЯ =====
    // Название цвета, выбранного для поля importTextarea1/2, отображается в
    // соответствующем span importColorName1/2. Если оно не совпадает с
    // названием скопированного на GTOWizard действия (actionName) — реально
    // переименовываем цвет через App.state (доступен со страницы sandbox'а
    // userscript'а через unsafeWindow), чтобы переименование переживало
    // persistAll() и не было чисто визуальным.
    function renameColorIfNeeded(index, actionName) {
      if (!actionName) return;

      const nameEl = document.getElementById('importColorName' + index);
      if (nameEl && nameEl.textContent.trim() === actionName) {
        // Название уже совпадает — переименовывать не нужно.
        return;
      }

      const App = unsafeWindow.App;
      if (!App) {
        console.warn('[autoPaste] unsafeWindow.App не найден, переименование цвета невозможно');
        return;
      }

      const colorId = index === 1 ? App.state.selectedColorId1 : App.state.selectedColorId2;
      const tableId = 'node_' + App.state.currentNodeId;
      const colors = App.state.colorsPerNode[tableId] || [];
      const color = colors.find(c => c.id === colorId);
      if (!color) {
        console.warn('[autoPaste] не найден цвет поля ' + index + ' для переименования');
        return;
      }

      const oldName = color.name;
      color.name = actionName;

      // Обновляем отображение названия в самом окне импорта.
      if (typeof unsafeWindow.updateImportColorDisplay === 'function') {
        unsafeWindow.updateImportColorDisplay(index, color.color, actionName);
      } else if (nameEl) {
        nameEl.textContent = actionName;
      }

      // Обновляем палитру под окном импорта, чтобы новое название было
      // видно и там (не только в модалке импорта).
      if (typeof unsafeWindow.renderAllColors === 'function') {
        unsafeWindow.renderAllColors(App.state.currentNodeId, true);
      }

      App.events.emit('unsaved:mark');

      console.log('[autoPaste] цвет поля ' + index + ' переименован: "' + oldName + '" -> "' + actionName + '"');
    }

    function pasteIntoFields(text, actionName) {
      const textarea1 = document.getElementById('importTextarea1');
      const textarea2 = document.getElementById('importTextarea2');

      if (!textarea1 || !textarea2) {
        console.log('[autoPaste] окно импорта не открыто');
        return;
      }

      if (!text) {
        console.log('[autoPaste] в сигнале нет текста, вставка отменена');
        return;
      }

      const field1Empty = textarea1.value.trim() === '';
      const field2Empty = textarea2.value.trim() === '';

      let target;
      let index;
      if (field1Empty) {
        target = textarea1;
        index = 1;
        console.log('[autoPaste] поле 1 пустое, вставляем в него');
      } else if (field2Empty) {
        target = textarea2;
        index = 2;
        console.log('[autoPaste] поле 2 пустое, вставляем в него');
      } else {
        console.log('[autoPaste] оба поля заполнены, вставка отменена');
        return;
      }

      renameColorIfNeeded(index, actionName);

      target.value = text;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[autoPaste] текст вставлен напрямую в', target.id);
    }

    console.log('[autoPaste] слушатель активен');
  }
})();
