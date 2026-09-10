'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skya', {
  getGames: () => ipcRenderer.invoke('get-games'),
  rescan: () => ipcRenderer.invoke('rescan'),
  addGame: () => ipcRenderer.invoke('add-game'),
  addFolder: () => ipcRenderer.invoke('add-folder'),
  launch: (game) => ipcRenderer.invoke('launch-game', game),
  remove: (id) => ipcRenderer.invoke('remove-game', id),
  quit: () => ipcRenderer.invoke('quit-app'),
  getBoxArt: (game) => ipcRenderer.invoke('get-boxart', game)
});
