'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const store = require('./src/store');
const { scanAll, scanFolder } = require('./src/scanners');
const { initBoxArt, getBoxArt } = require('./src/boxart');

let mainWindow;

// Hover sounds fire without a click first — allow audio without a user gesture.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#0b0e14',
    title: 'Skya Launcher',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function launchGame(game) {
  // Steam games launch through the Steam client so overlays / achievements keep working.
  if (game.source === 'steam' && game.appid) {
    shell.openExternal(`steam://rungameid/${game.appid}`);
    return true;
  }
  const exe = game.executablePath || game.path;
  if (!exe || !fs.existsSync(exe)) return false;
  if (process.platform === 'darwin') {
    spawn('open', [exe], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn(exe, [], { detached: true, cwd: path.dirname(exe), stdio: 'ignore' }).unref();
  }
  return true;
}

app.whenReady().then(() => {
  store.init(app.getPath('userData'));
  initBoxArt(app.getPath('userData'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC (renderer bridge) ----------

ipcMain.handle('get-games', () => store.all());

ipcMain.handle('rescan', async () => {
  store.replaceScanned(scanAll());
  return store.all();
});

ipcMain.handle('get-boxart', async (_e, game) => {
  try {
    const file = await getBoxArt(game);
    if (!file) return { ok: false };
    const data = 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle('add-game', async () => {
  const filters = process.platform === 'darwin'
    ? [{ name: 'Applications', extensions: ['app'] }]
    : [{ name: 'Executables', extensions: ['exe'] }];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add a game',
    properties: ['openFile'],
    filters
  });
  if (result.canceled || !result.filePaths.length) return store.all();
  const filePath = result.filePaths[0];
  const name = path.basename(filePath).replace(/\.(exe|app)$/i, '');
  store.addManual({
    id: 'manual-' + Date.now(),
    name,
    path: filePath,
    installPath: path.dirname(filePath),
    source: 'manual'
  });
  return store.all();
});

ipcMain.handle('add-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add a folder of games',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return store.all();
  for (const game of scanFolder(result.filePaths[0])) {
    store.addManual(game);
  }
  return store.all();
});

ipcMain.handle('launch-game', (_e, game) => launchGame(game));

ipcMain.handle('quit-app', () => {
  app.quit();
});

ipcMain.handle('remove-game', (_e, id) => {
  store.remove(id);
  return store.all();
});
