'use strict';

// Embeds version info (Publisher: Iris Snow) and the app icon into the built
// portable exe. Pure JS (resedit) — works on Windows, macOS and Linux, no
// signing tools or wine required. Unsigned exes still get flagged by
// SmartScreen; this only changes the file's metadata and icon.
//
// Usage: node scripts/embed-metadata.js [path-to-exe]
// If no path is given, the newest .exe in dist/ is used.

const fs = require('fs');
const path = require('path');
const ResEdit = require('resedit');

const pkg = require('../package.json');
const PUBLISHER = 'Iris Snow';

let exePath = process.argv[2];
if (!exePath) {
  const distDir = path.join(__dirname, '..', 'dist');
  const exes = fs.readdirSync(distDir).filter(f => f.toLowerCase().endsWith('.exe'))
    .map(f => ({ f, m: fs.statSync(path.join(distDir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (!exes.length) throw new Error('No .exe found in dist/ — build first.');
  exePath = path.join(distDir, exes[0].f);
}

const data = fs.readFileSync(exePath);
const exe = ResEdit.NtExecutable.from(data);
const res = ResEdit.NtExecutableResource.from(exe);

// ---------- Version info (Publisher) ----------
const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
if (!viList.length) throw new Error('No version info resource found.');
const vi = viList[0];
const [maj, min, patch] = pkg.version.split('.').map(n => parseInt(n, 10) || 0);
vi.setFileVersion(maj, min, patch, 0, 1033);
vi.setStringValues(
  { lang: 1033, codepage: 1200 },
  {
    CompanyName: PUBLISHER,
    FileDescription: pkg.productName,
    FileVersion: pkg.version,
    InternalName: pkg.name,
    LegalCopyright: `Copyright (c) 2026 ${PUBLISHER}`,
    OriginalFilename: path.basename(exePath),
    ProductName: pkg.productName,
    ProductVersion: pkg.version
  }
);
vi.outputToResourceEntries(res.entries);

// ---------- Icon ----------
const iconFile = ResEdit.Data.IconFile.from(
  fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'))
);
const groupIds = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries).map(e => e.id);
if (groupIds.length) {
  // Replace the first icon group (the app icon) with our full icon set.
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groupIds[0],
    1033,
    iconFile.icons.map(item => item.data)
  );
}

res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));

console.log(`Embedded publisher "${PUBLISHER}", version ${pkg.version}, and app icon into:`);
console.log(`  ${exePath}`);
