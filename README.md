# Skya Launcher

A sleek, no-fuss game launcher for **Windows and macOS**. Skya automatically finds your games installed through **Steam** and the **Epic Games Launcher**, shows them in a clean grid, and launches them with one click. You can also add games manually or point it at a folder.

## Features

- Automatic detection of Steam, Epic Games, and GameJolt installs (including Steam libraries on other drives)
- Launch Steam games through Steam itself, so overlays and achievements keep working
- Add any game manually (pick the `.exe` on Windows or `.app` on macOS)
- Add a whole folder — Skya finds the games inside it
- Instant search, dark minimal UI
- Box art downloaded automatically from Steam / Epic (falls back to initials tiles)
- Everything stays local: no accounts, no network calls, no telemetry

## Requirements

Nothing for the person *using* Skya — the shipped app is a normal installer.

To **build** it yourself you need [Node.js LTS](https://nodejs.org).

## Run it (development)

```
npm install
npm start
```

## Build the installer

```
npm run dist:win   # -> dist/Skya Launcher Setup 1.0.0.exe
npm run dist:mac   # -> dist/Skya Launcher-1.0.0.dmg
```

Build the Windows installer on Windows and the macOS one on a Mac (that's a
limitation of how installers are packaged).

### macOS note

The build is unsigned, so Gatekeeper will complain on first launch.
Right-click the app → **Open** → **Open**, or clear the flag once:

```
xattr -cr "/Applications/Skya Launcher.app"
```

## How detection works

- **Steam** — reads `steamapps` install manifests (including extra libraries from `libraryfolders.vdf`) and launches via `steam://rungameid/<appid>`.
- **Epic** — reads the launcher's `.item` manifest files and launches the game executable directly.
- **GameJolt** — reads the GameJolt client's local database (`games.wttf` / `packages.wttf`, plain JSON) for installed games and their cover art. No client? Games downloaded from the site as zips are found automatically in Downloads, Desktop, and the default GameJolt games folders.
- **Manual** — whatever executable you point it at, saved alongside the scanned list.

Box art images are cached in a `boxart` folder next to `games.json`, so they load instantly on future launches.

Your game list is stored in a small `games.json` inside Skya's data folder
(`%APPDATA%/skya-launcher` on Windows, `~/Library/Application Support/skya-launcher` on macOS).

## Project layout

```
main.js               Electron main process (window, launching, dialogs)
preload.js            Secure bridge between UI and main process
src/scanners.js       Finds Steam / Epic / folder games
src/store.js          JSON persistence
renderer/             The UI (HTML/CSS/JS, no frameworks)
assets/icon.png       App icon
```

## License

MIT — Copyright (c) 2026 Iris Snow. See [LICENSE](LICENSE).
