'use strict';

// Finds installed games on the local machine. No network calls, no telemetry.
// (Box art downloads live in src/boxart.js, called on demand from the UI.)

const fs = require('fs');
const path = require('path');
const os = require('os');

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function tryRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function listDir(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; }
}

function readJsonIfExists(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// ---------- Steam ----------

function steamRoots() {
  const candidates = IS_WIN
    ? ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']
    : IS_MAC
      ? [path.join(os.homedir(), 'Library', 'Application Support', 'Steam'),
         path.join(os.homedir(), '.steam', 'steam')]
      : [];
  return candidates.filter(exists);
}

// Pull library paths out of libraryfolders.vdf (handles games installed on other drives).
function steamLibraries(root) {
  const libraries = new Set([root]);
  const vdf = tryRead(path.join(root, 'steamapps', 'libraryfolders.vdf'));
  if (vdf) {
    const re = /"path"\s+"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(vdf))) {
      libraries.add(m[1].replace(/\\\\/g, '\\'));
    }
  }
  return [...libraries];
}

function scanSteam() {
  const games = [];
  const seen = new Set();
  for (const root of steamRoots()) {
    for (const lib of steamLibraries(root)) {
      const appsDir = path.join(lib, 'steamapps');
      if (!exists(appsDir)) continue;
      for (const entry of listDir(appsDir)) {
        if (!entry.isFile()) continue;
        if (!/^appmanifest_.*\.acf$/i.test(entry.name)) continue;
        const acf = tryRead(path.join(appsDir, entry.name));
        if (!acf) continue;
        const idM = acf.match(/"appid"\s+"(\d+)"/);
        const nameM = acf.match(/"name"\s+"((?:[^"\\]|\\.)*)"/);
        const dirM = acf.match(/"installdir"\s+"((?:[^"\\]|\\.)*)"/);
        if (!idM || !nameM || !dirM) continue;
        const installPath = path.join(appsDir, 'common', dirM[1]);
        if (!exists(installPath)) continue; // manifest exists but game uninstalled
        const id = 'steam-' + idM[1];
        if (seen.has(id)) continue;
        seen.add(id);
        games.push({
          id,
          source: 'steam',
          appid: idM[1],
          name: nameM[1],
          installPath
        });
      }
    }
  }
  return games;
}

// ---------- Epic Games ----------

function epicManifestDirs() {
  return IS_WIN
    ? ['C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests']
    : IS_MAC
      ? [path.join(os.homedir(), 'Library', 'Application Support', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'),
         path.join('/Users', 'Shared', 'Epic Games Launcher', 'Data', 'Manifests')]
      : [];
}

function scanEpic() {
  const games = [];
  const seen = new Set();
  for (const dir of epicManifestDirs()) {
    if (!exists(dir)) continue;
    for (const entry of listDir(dir)) {
      if (!entry.isFile() || !/\.item$/i.test(entry.name)) continue;
      let m;
      try { m = JSON.parse(fs.readFileSync(path.join(dir, entry.name), 'utf8')); } catch { continue; }
      const name = m.DisplayName || m.AppName;
      if (!name || !m.InstallLocation || !m.LaunchExecutable) continue;
      const exe = path.join(m.InstallLocation, m.LaunchExecutable);
      if (!exists(exe)) continue;
      const id = 'epic-' + (m.InstallationGuid || m.AppName || name);
      if (seen.has(id)) continue;
      seen.add(id);
      games.push({
        id,
        source: 'epic',
        name,
        executablePath: exe,
        installPath: m.InstallLocation,
        namespace: m.CatalogNamespace || null,
        itemId: m.CatalogItemId || null
      });
    }
  }
  return games;
}

// ---------- GameJolt ----------

// The GameJolt desktop client keeps a local database of installed games:
//   games.wttf    -> { version, objects: { [gameId]: { title, slug, thumbnail_media_item: { img_url } , ... } } }
//   packages.wttf -> { version, objects: { [pkgId]: { game_id, title, install_dir, launch_options: [{ os, executable_path }] , ... } } }
// Both are plain JSON files (the client reads them with JSON.parse).

function gamejoltDataDirs() {
  const dirs = [];
  if (IS_WIN) {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    dirs.push(path.join(local, 'game-jolt-client', 'User Data', 'Default'));
    dirs.push(path.join(local, 'game-jolt-client'));
  } else if (IS_MAC) {
    dirs.push(path.join(os.homedir(), 'Library', 'Application Support', 'game-jolt-client', 'User Data', 'Default'));
    dirs.push(path.join(os.homedir(), 'Library', 'Application Support', 'game-jolt-client'));
  }
  return dirs.filter(exists);
}

// Default places the client installs games to, used as a fallback when the
// client database can't be found (e.g. it was moved).
function gamejoltGamesFolders() {
  const out = [];
  if (IS_WIN) {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    out.push(path.join(local, 'game-jolt-client', 'Games'));
    out.push(path.join(os.homedir(), 'Documents', 'GameJolt Games'));
  } else if (IS_MAC) {
    out.push(path.join(os.homedir(), 'Library', 'Application Support', 'game-jolt-client', 'Games'));
    out.push(path.join(os.homedir(), 'Documents', 'GameJolt Games'));
  }
  return out.filter(exists);
}

function currentOsName() {
  return IS_WIN ? 'windows' : IS_MAC ? 'mac' : 'linux';
}

// Find the best executable inside an installed game folder.
function findGameExecutable(dir) {
  if (!dir || !exists(dir)) return null;
  if (IS_MAC) {
    let found = null;
    walk(dir, 2, (p, isDir) => {
      if (!found && isDir && /\.app$/i.test(p)) found = p;
    }, p => /\.app$/i.test(p));
    return found;
  }
  const exes = [];
  walk(dir, 2, (p, isDir) => {
    if (!isDir && /\.exe$/i.test(p) && !JUNK_EXE.test(path.basename(p))) exes.push(p);
  });
  if (!exes.length) return null;
  const base = path.basename(dir);
  return exes.find(p => path.basename(p, '.exe').toLowerCase() === base.toLowerCase()) || exes[0];
}

function gamejoltExecutable(pkg, installDir) {
  const options = Array.isArray(pkg.launch_options) ? pkg.launch_options : [];
  const osName = currentOsName();
  // The client stores launch options per OS, e.g. os: "windows_64" / "mac".
  const match = options.find(o => o && o.executable_path && o.os && o.os.split('_')[0] === osName)
    || options.find(o => o && o.executable_path);
  if (match) {
    const rel = match.executable_path;
    const abs = path.isAbsolute(rel) ? rel : path.join(installDir, rel);
    if (exists(abs)) return abs;
  }
  return findGameExecutable(installDir);
}

function scanGameJolt() {
  const games = [];
  const seen = new Set();
  const gameRecords = new Map(); // gameId -> record from games.wttf
  let foundDatabase = false;

  for (const dataDir of gamejoltDataDirs()) {
    const gamesData = readJsonIfExists(path.join(dataDir, 'games.wttf'));
    if (gamesData && gamesData.objects && typeof gamesData.objects === 'object') {
      foundDatabase = true;
      for (const g of Object.values(gamesData.objects)) {
        if (g && g.id && g.title) gameRecords.set(String(g.id), g);
      }
    }

    const packagesData = readJsonIfExists(path.join(dataDir, 'packages.wttf'));
    if (packagesData && packagesData.objects && typeof packagesData.objects === 'object') {
      for (const pkg of Object.values(packagesData.objects)) {
        if (!pkg || !pkg.game_id) continue;
        const installDir = pkg.install_dir || '';
        if (!installDir || !exists(installDir)) continue; // not installed anymore
        const id = 'gj-' + pkg.game_id;
        if (seen.has(id)) continue;
        const record = gameRecords.get(String(pkg.game_id));
        const name = (record && record.title) || pkg.title || path.basename(installDir);
        const exe = gamejoltExecutable(pkg, installDir);
        if (!exe) continue; // installed but nothing launchable found
        seen.add(id);
        const thumb = record && record.thumbnail_media_item ? record.thumbnail_media_item.img_url : null;
        games.push({
          id,
          source: 'gamejolt',
          name,
          executablePath: exe,
          installPath: installDir,
          gjThumbnailUrl: thumb || null
        });
      }
    }
  }

  // Games downloaded from gamejolt.com as zips (no client involved) are scanned
  // ONLY from folders explicitly named "GameJolt" in the usual places — including
  // the OneDrive-redirected Desktop — plus the GameJolt client's default folders.
  // Nothing else on the Desktop or in Downloads is ever scanned.
  const dbNames = new Set(games.map(g => g.name.toLowerCase()));
  const home = os.homedir();
  const oneDrive = process.env.OneDrive || null;
  const scanTargets = [...gamejoltGamesFolders()];
  const candidates = [
    path.join(home, 'Desktop', 'GameJolt'),
    path.join(home, 'OneDrive', 'Desktop', 'GameJolt'),
    path.join(home, 'Downloads', 'GameJolt'),
    path.join(home, 'Documents', 'GameJolt')
  ];
  if (oneDrive) candidates.push(path.join(oneDrive, 'Desktop', 'GameJolt'));
  for (const f of candidates) {
    if (exists(f) && !scanTargets.includes(f)) scanTargets.push(f);
  }
  // Dedupe on the executable path so overlapping scan targets
  // (e.g. Downloads and Downloads\GameJolt) never add the same game twice.
  const seenPaths = new Set(games.map(g => (g.executablePath || '').toLowerCase()));
  for (const folder of scanTargets) {
    for (const game of scanFolder(folder)) {
      if (dbNames.has(game.name.toLowerCase())) continue; // already found via the database
      const exeKey = (game.path || '').toLowerCase();
      if (seenPaths.has(exeKey)) continue;
      seenPaths.add(exeKey);
      const id = 'gj-' + game.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(id)) continue;
      seen.add(id);
      games.push({
        id,
        source: 'gamejolt',
        name: game.name,
        executablePath: game.path,
        installPath: game.installPath,
        gjThumbnailUrl: null
      });
    }
  }

  return games;
}

// ---------- Manual / custom folders ----------

const JUNK_EXE = /(unins\d|crash|redist|dxsetup|eula|bugreport|unitycrashhandler|vc_redist)/i;
const JUNK_DIRS = /^(bin|binaries|win64|win32|x64|x86|data|engine|redist|__installer|prereq|support)$/i;

function walk(dir, depth, visit, stopDescend) {
  for (const entry of listDir(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (stopDescend && stopDescend(full)) continue;
      visit(full, true);
      if (depth > 0) walk(full, depth - 1, visit, stopDescend);
    } else {
      visit(full, false);
    }
  }
}

// Scans a user-picked folder and tries to find real games inside it.
function scanFolder(dir) {
  const found = new Map(); // lowercased name -> game

  if (IS_MAC) {
    walk(dir, 2, (p, isDir) => {
      if (isDir && /\.app$/i.test(p)) {
        const name = path.basename(p, '.app');
        found.set(name.toLowerCase(), {
          id: 'manual-' + p,
          source: 'manual',
          name,
          path: p,
          installPath: path.dirname(p)
        });
      }
    }, p => /\.app$/i.test(p)); // don't descend into .app bundles
    return [...found.values()];
  }

  if (IS_WIN) {
    const exes = [];
    walk(dir, 3, (p, isDir) => {
      if (!isDir && /\.exe$/i.test(p) && !JUNK_EXE.test(path.basename(p))) exes.push(p);
    });
    for (const exe of exes) {
      const exeBase = path.basename(exe, '.exe');
      const segs = path.relative(dir, exe).split(path.sep);
      // Prefer a folder that matches the exe name (e.g. Hollow Knight/Hollow Knight.exe),
      // otherwise the first folder that isn't an engine/runtime directory.
      let name = segs.find(s => s !== exeBase && s.toLowerCase() === exeBase.toLowerCase()) || exeBase;
      if (name === exeBase) {
        const firstReal = segs.find(s => !JUNK_DIRS.test(s) && !/\.exe$/i.test(s));
        name = firstReal || exeBase;
      }
      const key = name.toLowerCase();
      if (found.has(key)) continue;
      found.set(key, {
        id: 'manual-' + exe,
        source: 'manual',
        name,
        path: exe,
        installPath: path.dirname(exe)
      });
    }
    return [...found.values()];
  }

  return [];
}

// ---------- Entry point ----------

function scanAll() {
  return [...scanSteam(), ...scanEpic(), ...scanGameJolt()];
}

module.exports = { scanAll, scanFolder };
