'use strict';

// Downloads and caches game box art locally. Falls back silently to the
// initials tiles in the UI when a game has no art available.

const fs = require('fs');
const path = require('path');

let boxartDir = null;
const inFlight = new Map();

function initBoxArt(userDataDir) {
  boxartDir = path.join(userDataDir, 'boxart');
  fs.mkdirSync(boxartDir, { recursive: true });
}

function safeName(id) {
  return String(id).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function isImage(buf) {
  // JPEG or PNG magic bytes
  return (buf[0] === 0xff && buf[1] === 0xd8) || (buf[0] === 0x89 && buf[1] === 0x50);
}

async function downloadImage(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) SkyaLauncher/1.1' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000 || !isImage(buf)) throw new Error('not a usable image');
  fs.writeFileSync(dest, buf);
}

// Ask Epic's public catalog API for this game's box art URL.
async function epicKeyArtUrl(namespace, itemId) {
  const body = {
    query: 'query catalogQuery($namespace: String!, $offerId: String!) { Catalog { catalogOffer(namespace: $namespace, id: $offerId) { keyImages { type url } } } }',
    variables: { namespace, offerId: itemId }
  };
  const res = await fetch('https://store.launcher.epicgames.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0)' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  const images = json && json.data && json.data.Catalog && json.data.Catalog.catalogOffer
    ? json.data.Catalog.catalogOffer.keyImages
    : null;
  if (!Array.isArray(images) || images.length === 0) throw new Error('no key images');
  const prefs = ['DieselGameBoxTall', 'DieselGameBox', 'DieselStoreFrontTall', 'DieselStoreFrontWide'];
  for (const type of prefs) {
    const hit = images.find(i => i.type === type);
    if (hit && hit.url) return hit.url;
  }
  return images[0].url;
}

// Ordered list of URLs to try for this game's art.
async function candidateUrls(game) {
  if (game.source === 'steam' && game.appid) {
    return [
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`
    ];
  }
  if (game.source === 'gamejolt') {
    // Direct CDN URL stored by the GameJolt client in its local database.
    return game.gjThumbnailUrl ? [game.gjThumbnailUrl] : [];
  }
  if (game.source === 'epic' && game.namespace && game.itemId) {
    try {
      return [await epicKeyArtUrl(game.namespace, game.itemId)];
    } catch {
      return [];
    }
  }
  return [];
}

// Resolves to a local file path for the cached art, or null if unavailable.
function getBoxArt(game) {
  if (!boxartDir || !game || !game.id) return Promise.resolve(null);
  const name = safeName(game.id);
  const file = path.join(boxartDir, name + '.jpg');
  const noart = path.join(boxartDir, name + '.noart');
  if (fs.existsSync(file)) return Promise.resolve(file);
  if (fs.existsSync(noart)) return Promise.resolve(null);
  if (inFlight.has(game.id)) return inFlight.get(game.id);

  const job = (async () => {
    try {
      const urls = await candidateUrls(game);
      for (const url of urls) {
        try {
          await downloadImage(url, file);
          return file;
        } catch {
          // try the next candidate
        }
      }
      try { fs.writeFileSync(noart, ''); } catch {}
      return null;
    } catch {
      try { fs.writeFileSync(noart, ''); } catch {}
      return null;
    } finally {
      inFlight.delete(game.id);
    }
  })();
  inFlight.set(game.id, job);
  return job;
}

module.exports = { initBoxArt, getBoxArt };
