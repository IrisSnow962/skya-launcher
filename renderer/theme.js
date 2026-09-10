'use strict';

// ---------- Theme engine: presets, J.A.R.V.I.S, and custom themes ----------

(function () {
  const PRESETS = {
    midnight: {
      name: 'Midnight',
      vars: {
        bg: '#0b0e14', card: '#11162a', border: '#1c2333', text: '#e8ecf4',
        muted: '#8a94a8', btnText: '#cdd6e4', accent: '#3b82f6', accent2: '#7c3aed',
        accentText: '#ffffff', logo1: '#7dd3fc', logo2: '#a78bfa',
        tileS: '55%', tileL1: '22%', tileL2: '12%',
        tileText: 'rgba(255,255,255,.85)', pulse: 'rgba(59,130,246,.6)'
      }
    },
    jarvis: {
      name: 'J.A.R.V.I.S',
      vars: {
        bg: '#0a0503', card: '#150c05', border: 'rgba(255,158,31,.25)', text: '#ffe9c9',
        muted: '#a88050', btnText: '#ffd9a8', accent: '#ff9e00', accent2: '#ff5e13',
        accentText: '#140800', logo1: '#ffc46b', logo2: '#ff8c1a',
        tileS: '70%', tileL1: '22%', tileL2: '8%',
        tileText: 'rgba(255,240,220,.9)', pulse: 'rgba(255,158,0,.55)'
      }
    },
    ocean: {
      name: 'Ocean',
      vars: {
        bg: '#0a1220', card: '#121e30', border: '#22344e', text: '#e6f0fb',
        muted: '#8ba3c0', btnText: '#c2d2e6', accent: '#3b82f6', accent2: '#06b6d4',
        accentText: '#ffffff', logo1: '#38bdf8', logo2: '#22d3ee',
        tileS: '55%', tileL1: '24%', tileL2: '12%',
        tileText: 'rgba(255,255,255,.85)', pulse: 'rgba(56,189,248,.6)'
      }
    },
    ember: {
      name: 'Ember',
      vars: {
        bg: '#0e0b0a', card: '#1a1310', border: '#332019', text: '#f5e8e0',
        muted: '#a88f80', btnText: '#e2cfc2', accent: '#f97316', accent2: '#ef4444',
        accentText: '#ffffff', logo1: '#fdba74', logo2: '#f87171',
        tileS: '50%', tileL1: '20%', tileL2: '10%',
        tileText: 'rgba(255,248,244,.85)', pulse: 'rgba(249,115,22,.6)'
      }
    },
    emerald: {
      name: 'Emerald',
      vars: {
        bg: '#071410', card: '#0e211a', border: '#1c3b2e', text: '#e0f5ec',
        muted: '#7aa895', btnText: '#c4dcd0', accent: '#10b981', accent2: '#14b8a6',
        accentText: '#ffffff', logo1: '#6ee7b7', logo2: '#2dd4bf',
        tileS: '50%', tileL1: '20%', tileL2: '10%',
        tileText: 'rgba(240,255,248,.85)', pulse: 'rgba(16,185,129,.6)'
      }
    },
    rose: {
      name: 'Rose',
      vars: {
        bg: '#120a10', card: '#211420', border: '#3c2937', text: '#f7e8f2',
        muted: '#b08aa0', btnText: '#e6cfdd', accent: '#ec4899', accent2: '#8b5cf6',
        accentText: '#ffffff', logo1: '#f9a8d4', logo2: '#c4b5fd',
        tileS: '50%', tileL1: '20%', tileL2: '11%',
        tileText: 'rgba(255,244,250,.85)', pulse: 'rgba(236,72,153,.6)'
      }
    },
    paper: {
      name: 'Paper',
      vars: {
        bg: '#f4f2ed', card: '#ffffff', border: '#ddd8cf', text: '#1f2937',
        muted: '#6b7280', btnText: '#374151', accent: '#2563eb', accent2: '#7c3aed',
        accentText: '#ffffff', logo1: '#2563eb', logo2: '#7c3aed',
        tileS: '45%', tileL1: '82%', tileL2: '68%',
        tileText: 'rgba(30,41,59,.55)', pulse: 'rgba(37,99,235,.45)'
      }
    }
  };

  const CSS_MAP = {
    bg: '--bg', card: '--card', border: '--border', text: '--text',
    muted: '--muted', btnText: '--btn-text', accent: '--accent', accent2: '--accent-2',
    accentText: '--accent-text', logo1: '--logo-1', logo2: '--logo-2',
    tileS: '--tile-s', tileL1: '--tile-l1', tileL2: '--tile-l2',
    tileText: '--tile-text', pulse: '--pulse'
  };

  // The six editable colors of a custom theme.
  const FIELDS = [
    ['bg', 'Background'], ['card', 'Surface'], ['border', 'Border'],
    ['text', 'Text'], ['muted', 'Muted text'], ['accent', 'Accent']
  ];

  // ---------- color helpers ----------

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(rgb) { return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''); }

  function anyToHex(v) {
    v = String(v || '').trim();
    if (v.startsWith('#')) {
      const rgb = hexToRgb(v);
      return rgb ? rgbToHex(rgb) : '#000000';
    }
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
    if (m) return rgbToHex([+m[1], +m[2], +m[3]]);
    return '#000000';
  }

  function lighten(hex, amount) {
    const rgb = hexToRgb(hex) || [0, 0, 0];
    return rgbToHex(rgb.map(v => Math.round(v + (255 - v) * amount)));
  }

  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex) || [0, 0, 0];
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function hexToRgbaString(hex, alpha) {
    const [r, g, b] = hexToRgb(hex) || [0, 0, 0];
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Build the full variable set from six base colors.
  function buildVars(base) {
    const accent = base.accent;
    return {
      bg: base.bg, card: base.card, border: base.border,
      text: base.text, muted: base.muted, btnText: base.text,
      accent, accent2: lighten(accent, luminance(accent) > 0.5 ? -0.18 : 0.12),
      accentText: luminance(accent) > 0.55 ? '#0a0f14' : '#ffffff',
      logo1: lighten(accent, 0.2), logo2: accent,
      tileS: '55%',
      tileL1: luminance(base.bg) > 0.5 ? '80%' : '22%',
      tileL2: luminance(base.bg) > 0.5 ? '66%' : '12%',
      tileText: luminance(base.bg) > 0.5 ? 'rgba(20,29,40,.55)' : 'rgba(255,255,255,.85)',
      pulse: hexToRgbaString(accent, luminance(base.bg) > 0.5 ? 0.35 : 0.6)
    };
  }

  // ---------- state ----------

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function loadCustom() {
    try { return JSON.parse(localStorage.getItem('skya-custom-themes') || '[]'); }
    catch { return []; }
  }

  function saveCustomList(list) {
    localStorage.setItem('skya-custom-themes', JSON.stringify(list));
  }

  let activeId = localStorage.getItem('skya-theme') || 'midnight';

  function findTheme(id) {
    if (id && id.startsWith('custom:')) {
      const name = id.slice(7).toLowerCase();
      const c = loadCustom().find(t => t.name.toLowerCase() === name);
      return c ? { name: c.name, vars: c.vars } : null;
    }
    return PRESETS[id] || null;
  }

  function applyTheme(id) {
    const t = findTheme(id);
    if (!t) { id = 'midnight'; activeId = id; }
    const root = document.documentElement;
    for (const key of Object.keys(CSS_MAP)) root.style.removeProperty(CSS_MAP[key]);
    const vars = findTheme(id).vars;
    for (const key of Object.keys(vars)) {
      if (CSS_MAP[key]) root.style.setProperty(CSS_MAP[key], vars[key]);
    }
    root.dataset.theme = id.startsWith('custom:') ? 'custom' : id;
    localStorage.setItem('skya-theme', id);
    activeId = id;
  }

  // ---------- swatches ----------

  const modal = document.getElementById('theme-modal');
  const swatchesEl = document.getElementById('theme-swatches');
  const nameInput = document.getElementById('theme-name');
  const saveBtn = document.getElementById('theme-save');

  function swatchHtml(id, theme, isCustom) {
    const v = theme.vars;
    const colors = `
      <span style="background:${v.bg}"></span>
      <span style="background:${v.card}"></span>
      <span style="background:${v.accent}"></span>
      <span style="background:${v.text}"></span>
      <span style="background:${anyToHex(v.border)}"></span>`;
    const active = activeId === id ? ' active' : '';
    const rm = isCustom ? '<button class="swatch-remove" title="Delete theme">&times;</button>' : '';
    return `<div class="swatch${active}" data-id="${escapeHtml(id)}" title="${escapeHtml(theme.name)}">
      ${rm}<div class="swatch-colors">${colors}</div>
      <div class="swatch-name">${escapeHtml(theme.name)}</div>
    </div>`;
  }

  function renderSwatches() {
    let html = '';
    for (const id of Object.keys(PRESETS)) html += swatchHtml(id, PRESETS[id], false);
    for (const c of loadCustom()) html += swatchHtml('custom:' + c.name, c, true);
    swatchesEl.innerHTML = html;
  }

  swatchesEl.addEventListener('click', (e) => {
    const swatch = e.target.closest('.swatch');
    if (!swatch) return;
    const id = swatch.dataset.id;
    if (e.target.classList.contains('swatch-remove')) {
      const list = loadCustom().filter(t => ('custom:' + t.name) !== id);
      saveCustomList(list);
      if (activeId === id) applyTheme('midnight');
      renderSwatches();
      return;
    }
    applyTheme(id);
    renderSwatches();
    if (typeof playSound === 'function') playSound('hover', 0.4, 1);
  });

  // ---------- custom theme editor ----------

  const colorGrid = document.getElementById('color-grid');
  const colorInputs = {};

  for (const [key, label] of FIELDS) {
    const row = document.createElement('div');
    row.className = 'color-row';
    row.innerHTML = `<label>${label}</label><input type="color" data-key="${key}">`;
    colorGrid.appendChild(row);
    const input = row.querySelector('input');
    colorInputs[key] = input;
    input.addEventListener('input', livePreview);
  }

  function editorBase() {
    const base = {};
    for (const [key] of FIELDS) base[key] = colorInputs[key].value;
    return base;
  }

  function livePreview() {
    const vars = buildVars(editorBase());
    const root = document.documentElement;
    for (const key of Object.keys(vars)) {
      if (CSS_MAP[key]) root.style.setProperty(CSS_MAP[key], vars[key]);
    }
    root.dataset.theme = 'custom';
  }

  function prefillEditor() {
    const t = findTheme(activeId) || PRESETS.midnight;
    for (const [key] of FIELDS) colorInputs[key].value = anyToHex(t.vars[key]);
    nameInput.value = activeId.startsWith('custom:') ? activeId.slice(7) : '';
  }

  saveBtn.addEventListener('click', () => {
    const name = (nameInput.value || 'My Theme').trim().slice(0, 24) || 'My Theme';
    const entry = { name, vars: buildVars(editorBase()) };
    const list = loadCustom().filter(t => t.name.toLowerCase() !== name.toLowerCase());
    list.push(entry);
    saveCustomList(list);
    applyTheme('custom:' + name);
    renderSwatches();
    if (typeof playSound === 'function') playSound('select', 0.35, 0.9);
  });

  // ---------- open / close ----------

  const openBtn = document.getElementById('theme-open');
  const closeBtn = document.getElementById('theme-close');

  openBtn.addEventListener('click', () => {
    prefillEditor();
    modal.classList.remove('hidden');
    if (typeof playSound === 'function') playSound('hover', 0.4, 1);
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    applyTheme(activeId); // discard unsaved live-preview changes
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeBtn.click();
  });

  // ---------- boot ----------

  renderSwatches();
  applyTheme(activeId);
})();
