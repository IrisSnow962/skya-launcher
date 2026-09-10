'use strict';

// Tiny JSON persistence. Games live in the app's userData folder.

const fs = require('fs');
const path = require('path');

let dataFile = null;
const data = { scanned: [], manual: [] };

function save() {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Could not save games.json:', err.message);
  }
}

module.exports = {
  init(userDataDir) {
    dataFile = path.join(userDataDir, 'games.json');
    try {
      const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      data.scanned = Array.isArray(raw.scanned) ? raw.scanned : [];
      data.manual = Array.isArray(raw.manual) ? raw.manual : [];
    } catch {
      // First run or corrupt file — start fresh.
    }
  },

  all() {
    return [...data.scanned, ...data.manual];
  },

  replaceScanned(scanned) {
    data.scanned = scanned || [];
    save();
  },

  addManual(game) {
    if (!game || !game.path) return;
    if (data.manual.some(g => g.path === game.path)) return; // already added
    data.manual.push(game);
    save();
  },

  remove(id) {
    data.manual = data.manual.filter(g => g.id !== id);
    save();
  }
};
