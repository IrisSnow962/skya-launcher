'use strict';

// Screenshot harness — runs the real Skya UI offscreen with fixture game data
// (real Steam CDN cover art) and captures promotional screenshots.
// Usage: xvfb-run -a npx electron scripts/screenshot.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('../src/store');
const { initBoxArt, getBoxArt } = require('../src/boxart');

const FIXTURE = '/tmp/skya-shot-userdata';
const OUT = path.join(__dirname, '..', 'gamejolt-page');
fs.mkdirSync(OUT, { recursive: true });

const STEAM = 'https://cdn.cloudflare.steamstatic.com/steam/apps/';
const games = [
  { id: 'steam-367520', source: 'steam', appid: '367520', name: 'Hollow Knight' },
  { id: 'steam-504230', source: 'steam', appid: '504230', name: 'Celeste' },
  { id: 'steam-413150', source: 'steam', appid: '413150', name: 'Stardew Valley' },
  { id: 'steam-268910', source: 'steam', appid: '268910', name: 'Cuphead' },
  { id: 'steam-1145360', source: 'steam', appid: '1145360', name: 'Hades' },
  { id: 'steam-588650', source: 'steam', appid: '588650', name: 'Dead Cells' },
  { id: 'steam-105600', source: 'steam', appid: '105600', name: 'Terraria' },
  { id: 'steam-391540', source: 'steam', appid: '391540', name: 'Undertale' },
  { id: 'steam-646570', source: 'steam', appid: '646570', name: 'Slay the Spire' },
  { id: 'gj-1', source: 'gamejolt', name: 'Bendy and the Ink Machine', gjThumbnailUrl: null },
  { id: 'manual-1', source: 'manual', name: 'My Modded Build', gjThumbnailUrl: null }
].map(g => ({ ...g, installPath: '/games/' + g.name.replace(/\s+/g, '-') }));

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  fs.rmSync(FIXTURE, { recursive: true, force: true });
  fs.mkdirSync(FIXTURE, { recursive: true });
  fs.writeFileSync(path.join(FIXTURE, 'games.json'), JSON.stringify({ scanned: games, manual: [] }, null, 2));
  store.init(FIXTURE);
  initBoxArt(FIXTURE);

  const allGames = () => store.all();

  ipcMain.handle('get-games', () => allGames());
  ipcMain.handle('rescan', async () => allGames()); // don't rescan a machine with no real games
  ipcMain.handle('add-game', async () => allGames());
  ipcMain.handle('add-folder', async () => allGames());
  ipcMain.handle('launch-game', () => true);
  ipcMain.handle('remove-game', () => allGames());
  ipcMain.handle('get-boxart', async (_e, game) => {
    try {
      const file = await getBoxArt(game);
      if (!file) return { ok: false };
      return { ok: true, data: 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64') };
    } catch {
      return { ok: false };
    }
  });

  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    backgroundColor: '#0b0e14',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.on('console-message', (_e, _level, message) => {
    if (/error|uncaught/i.test(message)) console.log('RENDERER CONSOLE:', message.slice(0, 300));
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  await new Promise(r => win.webContents.once('did-finish-load', r));
  win.show();

  // Wait for box art to finish downloading/rendering (poll the DOM).
  const waitArts = async () => {
    for (let i = 0; i < 40; i++) {
      const done = await win.webContents.executeJavaScript(
        `document.querySelectorAll('.tile[style*=background-image]').length >= 9`
      );
      if (done) return true;
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  };
  const ok = await waitArts();
  console.log('box art loaded:', ok);
  await new Promise(r => setTimeout(r, 1500));

  // Shot 1: the full library
  const [w, h] = win.getContentSize();
  const rect = { x: 0, y: 0, width: w, height: h };
  const shot1 = await win.webContents.capturePage(rect, { imageScale: 2 });
  fs.writeFileSync(path.join(OUT, 'screenshot-1-library.png'), shot1.toPNG());
  console.log('screenshot-1-library.png saved');

  // Shot 2: search in action
  await win.webContents.executeJavaScript(`
    const s = document.getElementById('search');
    s.value = 'hol';
    s.dispatchEvent(new Event('input'));
  `);
  await new Promise(r => setTimeout(r, 800));
  const shot2 = await win.webContents.capturePage(rect, { imageScale: 2 });
  fs.writeFileSync(path.join(OUT, 'screenshot-2-search.png'), shot2.toPNG());
  console.log('screenshot-2-search.png saved');

  app.exit(0);
});
