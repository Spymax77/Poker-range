// ===== ЦВЕТОВОЙ ПИКЕР (НОВЫЙ) =====
(function() {
  const overlay    = document.getElementById('pickerOverlay');
  const picker     = document.getElementById('pickerWindow');
  const header     = document.getElementById('pickerHeader');
  const closeBtn   = document.getElementById('pickerClose');
  const canvas     = document.getElementById('paletteCanvas');
  const ctx        = canvas ? canvas.getContext('2d') : null;
  const hueSlider  = document.getElementById('hueSlider');
  const preview    = document.getElementById('colorPreview');
  const hexInput   = document.getElementById('hexInput');
  const grid       = document.getElementById('presetGrid');
  const okBtn      = document.getElementById('okBtn');
  const cancelBtn  = document.getElementById('cancelBtn');
  const resetBtn   = document.getElementById('resetBtn');
  const formatBtns = document.querySelectorAll('.picker-format-btn');

  if (!canvas || !ctx) {
    console.error('Canvas не найден');
    return;
  }

  let h = 0, s = 100, l = 50;
  let activeIndex = 0;
  let currentFormat = 'hex';
  let lastPresetHex = '#9b5378';

  const defaultColors = [
    '#9b5378', '#79a65a', '#e55656', '#db9713',
    '#4b9ce7', '#3d6b95', '#61489b', '#939521',
    '#d65b7a', '#4ca38c', '#c97b3a', '#6a7fb0'
  ];
  let currentColors = defaultColors.map(hex => ({ hex, hue: hexToHsl(hex).h }));

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.min(100, Math.max(0, s)) / 100;
    l = Math.min(100, Math.max(0, l)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function getFormatValue(format) {
    const hex = hslToHex(h, s, l);
    const { r, g, b } = hexToRgb(hex);
    switch (format) {
      case 'hex': return hex.toUpperCase();
      case 'rgba': return `rgba(${r}, ${g}, ${b}, 1)`;
      case 'hsla': return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, 1)`;
      default: return hex.toUpperCase();
    }
  }

  function drawCanvas() {
    const w = canvas.width, ch = canvas.height;
    const img = ctx.createImageData(w, ch);
    for (let y = 0; y < ch; y++) {
      const lightness = 100 - (y / ch) * 100;
      for (let x = 0; x < w; x++) {
        const hex = hslToHex(h, s, lightness);
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const idx = (y * w + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function updateUI(keepActive = true) {
    const hex = hslToHex(h, s, l);
    preview.style.background = hex;
    hexInput.value = getFormatValue(currentFormat);
    hueSlider.value = h;
    drawCanvas();
    updatePresets(keepActive);
  }

  function buildPresets() {
    grid.innerHTML = '';
    currentColors.forEach((c, i) => {
      const div = document.createElement('div');
      div.className = 'picker-preset';
      div.style.backgroundColor = c.hex;
      div.dataset.index = i;
      const dot = document.createElement('span');
      dot.className = 'dot';
      div.appendChild(dot);
      div.addEventListener('click', () => onPresetClick(i));
      grid.appendChild(div);
    });
    updatePresets(true);
  }

  function updatePresets(keepActive) {
    const items = grid.children;
    for (let i = 0; i < items.length; i++) {
      items[i].style.backgroundColor = currentColors[i].hex;
      items[i].classList.remove('active');
    }
    if (keepActive && activeIndex >= 0 && activeIndex < items.length) {
      items[activeIndex].classList.add('active');
    }
  }

  function onPresetClick(idx) {
    const color = currentColors[idx];
    const hsl = hexToHsl(color.hex);
    h = hsl.h; s = hsl.s; l = hsl.l;
    activeIndex = idx;
    lastPresetHex = color.hex;
    updateUI(true);
  }

  function syncFromHex(val) {
    const clean = val.trim().toUpperCase();
    let hex = null;
    if (/^#[0-9A-F]{6}$/.test(clean)) hex = clean;
    else if (/^[0-9A-F]{6}$/.test(clean)) hex = '#' + clean;
    else if (/^RGBA?\(/i.test(clean)) {
      const match = clean.match(/[\d.]+/g);
      if (match && match.length >= 3) {
        const r = Math.round(parseFloat(match[0]));
        const g = Math.round(parseFloat(match[1]));
        const b = Math.round(parseFloat(match[2]));
        hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
      }
    } else if (/^HSLA?\(/i.test(clean)) {
      const match = clean.match(/[\d.]+/g);
      if (match && match.length >= 3) {
        const hh = parseFloat(match[0]) % 360;
        const ss = parseFloat(match[1]);
        const ll = parseFloat(match[2]);
        hex = hslToHex(hh, ss, ll);
      }
    }
    if (hex && /^#[0-9A-F]{6}$/.test(hex)) {
      const hsl = hexToHsl(hex);
      h = hsl.h; s = hsl.s; l = hsl.l;
      lastPresetHex = hex;
      updateUI(true);
      return true;
    }
    return false;
  }

  function resetToLastPreset() {
    const hsl = hexToHsl(lastPresetHex);
    h = hsl.h; s = hsl.s; l = hsl.l;
    updateUI(true);
  }

  formatBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      formatBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentFormat = this.dataset.format;
      hexInput.value = getFormatValue(currentFormat);
    });
  });

  canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    l = Math.round(Math.min(100, Math.max(0, 100 - (y / canvas.height) * 100)));
    updateUI(true);
  });

  hueSlider.addEventListener('input', function() {
    h = parseInt(this.value);
    updateUI(true);
  });

  hexInput.addEventListener('blur', function() {
    const val = this.value.trim();
    if (!syncFromHex(val)) {
      this.value = getFormatValue(currentFormat);
    }
  });

  hexInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const val = this.value.trim();
      if (!syncFromHex(val)) {
        this.value = getFormatValue(currentFormat);
      }
    }
  });

  resetBtn.addEventListener('click', resetToLastPreset);

function openPicker(colorId, callback) {
  editColorId = colorId || null;
  editCallback = callback || null;

  // Если редактируем цвет — загружаем его
  if (editColorId !== null) {
    const color = paletteColors.find(c => c.id === editColorId);
    if (color) {
      const hsl = hexToHsl(color.color);
      h = hsl.h; s = hsl.s; l = hsl.l;
      // Находим ближайший пресет
      let minDist = Infinity;
      let nearestIdx = 0;
      currentColors.forEach((c, i) => {
        const dist = Math.abs(hexToHsl(c.hex).h - h);
        if (dist < minDist) { minDist = dist; nearestIdx = i; }
      });
      activeIndex = nearestIdx;
      lastPresetHex = color.color;
      buildPresets();
      updateUI(true);
    }
  } else {
    const init = currentColors[0];
    const hsl = hexToHsl(init.hex);
    lastPresetHex = init.hex;
    h = hsl.h; s = hsl.s; l = hsl.l;
    activeIndex = 0;
    buildPresets();
    updateUI(true);
  }

  const btn = document.getElementById('addPaletteColorBtn');
  const rect = btn ? btn.getBoundingClientRect() : null;

  overlay.classList.add('active');
  picker.classList.add('open');
  picker.style.display = 'block';

  if (rect) {
    let left = rect.right + 10;
    let top = rect.top - 20;
    const pickerWidth = 218;
    if (left + pickerWidth > window.innerWidth - 10) {
      left = rect.left - pickerWidth - 10;
    }
    picker.style.left = left + 'px';
    picker.style.top = top + 'px';
    picker.style.transform = 'none';
  } else {
    picker.style.top = '50%';
    picker.style.left = '50%';
    picker.style.transform = 'translate(-50%, -50%)';
  }
}

  function closePicker() {
    overlay.classList.remove('active');
    picker.classList.remove('open');
    picker.style.display = 'none';
  }

  okBtn.addEventListener('click', function() {
  const hex = hslToHex(h, s, l);
  
  if (editColorId !== null && typeof editCallback === 'function') {
    // === РЕЖИМ РЕДАКТИРОВАНИЯ ===
    editCallback(hex);
  } else {
    // === РЕЖИМ СОЗДАНИЯ ===
  // === ПРОВЕРКА currentNodeId ===
if (!currentNodeId) {
    console.error('currentNodeId не определён');
    closePicker();
    return;
}

let newId = paletteColors.length > 0 ? Math.max(...paletteColors.map(c => c.id)) + 1 : 1;
paletteColors.push({
    id: newId,
    name: `Цвет ${paletteColors.length + 1}`,
    color: hex
});

let nodeId = getTableId(currentNodeId);
if (!nodePaletteMap[nodeId]) {
    nodePaletteMap[nodeId] = [];
}
nodePaletteMap[nodeId].push(newId);

// Принудительно сохраняем
savePalette();
persistAll();  // ← добавить, если нет

renderPalette(true);
refreshAllProfiles();
refreshAllGrids();
updateProfileButtonVisibility();
  }
  
  // Сброс
  editColorId = null;
  editCallback = null;
  
  closePicker();
});

  closeBtn.addEventListener('click', closePicker);
  cancelBtn.addEventListener('click', closePicker);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closePicker();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) closePicker();
  });

  let dragging = false, startX, startY, startLeft, startTop;
  header.addEventListener('mousedown', function(e) {
    if (e.target.closest('.picker-close')) return;
    const rect = picker.getBoundingClientRect();
    const tr = window.getComputedStyle(picker).transform;
    if (tr !== 'none' && tr !== 'matrix(1, 0, 0, 1, 0, 0)') {
      picker.style.left = rect.left + 'px';
      picker.style.top = rect.top + 'px';
      picker.style.transform = 'none';
    }
    startX = e.clientX; startY = e.clientY;
    startLeft = parseFloat(picker.style.left) || 0;
    startTop = parseFloat(picker.style.top) || 0;
    dragging = true;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  function onMove(e) {
    if (!dragging) return;
    let left = startLeft + e.clientX - startX;
    let top = startTop + e.clientY - startY;
    const rect = picker.getBoundingClientRect();
    left = Math.max(10, Math.min(window.innerWidth - rect.width - 10, left));
    top = Math.max(10, Math.min(window.innerHeight - rect.height - 10, top));
    picker.style.left = left + 'px';
    picker.style.top = top + 'px';
  }
  function onUp() {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  buildPresets();
  updateUI(true);
  closePicker();

window.openColorPicker = function(colorId, callback) {
  openPicker(colorId, callback);
};
})();