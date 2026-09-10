'use strict';

const state = { games: [], query: '' };

// ---------- UI sounds (Steam Deck style) ----------
let audioCtx = null;
const soundBuffers = {};
let soundOn = localStorage.getItem('skya-sound') !== 'off';
let lastHoverSound = 0;

function ensureAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* no audio device available */ }
}

function decodeSounds() {
  if (!audioCtx || !window.SKYA_SOUNDS || Object.keys(soundBuffers).length) return;
  for (const [key, b64] of Object.entries(window.SKYA_SOUNDS)) {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      audioCtx.decodeAudioData(bytes.buffer).then(buf => { soundBuffers[key] = buf; }).catch(() => {});
    } catch { /* ignore */ }
  }
}

function playSound(name, gain, rate) {
  if (!soundOn) return;
  ensureAudio();
  decodeSounds();
  const buf = soundBuffers[name];
  if (!buf || !audioCtx) return;
  try {
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = audioCtx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(audioCtx.destination);
    src.start();
  } catch { /* ignore */ }
}

function playHoverSound() {
  const now = performance.now();
  if (now - lastHoverSound < 65) return; // no machine-gun noise while sweeping the grid
  lastHoverSound = now;
  playSound('hover', 0.4, 0.97 + Math.random() * 0.06);
}

function updateSoundToggle() {
  const el = document.getElementById('sound-toggle');
  if (el) el.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
}

const artCache = new Map(); // game.id -> data URL (or null once we know there's no art)

const grid = document.getElementById('grid');
const searchInput = document.getElementById('search');
const countEl = document.getElementById('count');
const rescanBtn = document.getElementById('rescan');
const addGameBtn = document.getElementById('add-game');
const addFolderBtn = document.getElementById('add-folder');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function hueFromName(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function tileBackground(name) {
  const h = hueFromName(name);
  // Saturation/lightness come from the active theme's CSS variables.
  return `linear-gradient(135deg, hsl(${h}, var(--tile-s, 55%), var(--tile-l1, 22%)), hsl(${(h + 45) % 360}, var(--tile-s, 55%), var(--tile-l2, 12%)))`;
}

function initials(name) {
  const words = String(name).split(/[\s:_\-!.]+/).filter(Boolean);
  let s = (words[0] || '?')[0] || '?';
  if (words.length > 1) s += (words[1][0] || '');
  return s.toUpperCase();
}

function sourceLabel(g) {
  if (g.source === 'steam') return 'Steam';
  if (g.source === 'epic') return 'Epic Games';
  if (g.source === 'gamejolt') return 'GameJolt';
  if (g.source === 'manual') return 'Added';
  return 'PC';
}

function applyArt(card, dataUrl) {
  const tile = card.querySelector('.tile');
  if (!tile) return;
  tile.style.backgroundImage = `url(${dataUrl})`;
  const span = tile.querySelector('span');
  if (span) span.style.display = 'none';
}

function requestArt(game, card) {
  if (!window.skya.getBoxArt) return;
  window.skya.getBoxArt(game).then(res => {
    const url = res && res.ok ? res.data : null;
    artCache.set(game.id, url);
    if (url && card.isConnected) applyArt(card, url);
  }).catch(() => { artCache.set(game.id, null); });
}

function render() {
  const q = state.query.trim().toLowerCase();
  const games = state.games.filter(g => !q || g.name.toLowerCase().includes(q));
  countEl.textContent = `${games.length} game${games.length === 1 ? '' : 's'}`;
  grid.innerHTML = '';

  if (!games.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    if (state.games.length) {
      empty.textContent = 'No games match your search.';
    } else {
      empty.innerHTML = 'No games found yet.<br>Hit <b>Rescan</b> to look for Steam &amp; Epic games,<br>or add your own with <b>+ Add Game</b>.';
    }
    grid.appendChild(empty);
    return;
  }

  for (const g of games) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="tile" style="background-image:${tileBackground(g.name)}"><span>${escapeHtml(initials(g.name))}</span></div>
      <div class="meta">
        <div class="name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</div>
        <div class="src">${sourceLabel(g)}</div>
      </div>
      ${g.source === 'manual' ? '<button class="remove" title="Remove from Skya">&times;</button>' : ''}
    `;
    card.addEventListener('mouseenter', playHoverSound);
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove')) {
        window.skya.remove(g.id).then(games => { state.games = games; render(); });
        return;
      }
      card.classList.remove('launching');
      void card.offsetWidth; // restart the animation
      card.classList.add('launching');
      playSound('select', 0.35, 0.9);
      window.skya.launch(g);
    });
    grid.appendChild(card);

    // Box art: show it instantly if we have it cached, otherwise fetch it.
    const cached = artCache.get(g.id);
    if (cached) {
      applyArt(card, cached);
    } else if (!artCache.has(g.id) && (g.source === 'steam' || g.source === 'epic' || g.source === 'gamejolt')) {
      requestArt(g, card);
    }
  }
}

async function load() {
  state.games = await window.skya.getGames();
  render();
}

async function rescan() {
  rescanBtn.disabled = true;
  const old = rescanBtn.textContent;
  rescanBtn.textContent = 'Scanning\u2026';
  try {
    state.games = await window.skya.rescan();
    render();
  } finally {
    rescanBtn.disabled = false;
    rescanBtn.textContent = old;
  }
}

rescanBtn.addEventListener('click', rescan);
addGameBtn.addEventListener('click', async () => {
  state.games = await window.skya.addGame();
  render();
});
addFolderBtn.addEventListener('click', async () => {
  state.games = await window.skya.addFolder();
  render();
});
searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  render();
});

document.getElementById('exit-btn').addEventListener('click', () => {
  if (window.skya.quit) window.skya.quit();
});

document.getElementById('sound-toggle').addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem('skya-sound', soundOn ? 'on' : 'off');
  updateSoundToggle();
  if (soundOn) playSound('hover', 0.4, 1);
});
updateSoundToggle();

// Boot: load saved games; on a fresh install, scan right away.
(async function init() {
  // Always refresh scanned games on launch so moved/removed games self-heal.
  let games = await window.skya.rescan();
  if (!games.length) games = await window.skya.getGames();
  state.games = games;
  render();
})();
