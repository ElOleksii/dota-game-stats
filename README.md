# Dota Today

A small desktop widget (Electron) that shows how many Dota 2 games you won and lost **today** (since 00:00 local time). Data comes from the free [OpenDota API](https://docs.opendota.com/), so no API key is needed.

## How to run

### 1. Install Node.js (once)

You need Node.js 18 or newer. Download the LTS version from [nodejs.org](https://nodejs.org/) and install it with the default settings.

To check that it is installed, run this in a terminal (PowerShell or Command Prompt):

```bash
node -v
```

You should see a version number, for example `v22.21.0`.

### 2. Open a terminal in the project folder

For example, in PowerShell:

```bash
cd D:\web\dota-stats
```

Or open the folder in File Explorer, click the address bar, type `powershell` and press Enter.

### 3. Install dependencies (once)

```bash
npm install
```

This downloads Electron (about 100 MB) into the `node_modules` folder. You only need to run it again if you delete `node_modules` or change `package.json`.

### 4. Start the widget

```bash
npm start
```

A small widget window opens. To close it, click ✕ in the window's title bar or press `Ctrl+C` in the terminal.

After the first time, steps 2 and 4 are enough to start it.

### Tests

Checks the logic (ID parsing, win/loss counting):

```bash
npm test
```

### Troubleshooting

- **`npm` is not recognized as a command.** Node.js is not installed, or the terminal was opened before installing it. Reinstall Node.js and open a new terminal.
- **`Electron failed to install correctly`.** Delete the `node_modules` folder and run `npm install` again.
- **The widget says "Profile not found or private".** Enable **Expose Public Match Data** in Dota 2 (see below) and play at least one match after that.

## How to use

1. On first launch, enter a player ID. Accepted formats:
   - Steam32 / Dota ID (`86745912`);
   - Steam64 ID (`76561198047011640`);
   - links like `opendota.com/players/…`, `dotabuff.com/players/…`, `stratz.com/players/…`, `steamcommunity.com/profiles/…`.
   Custom URLs (`steamcommunity.com/id/name`) are not supported, because resolving them needs a Steam API key.
2. In Dota 2, **Settings → Social → Expose Public Match Data** must be enabled, otherwise OpenDota cannot see your matches.
3. Title bar buttons: ⟳ refresh (and ask OpenDota to fetch fresh matches), ▭ compact mode, 📌 always on top, ⚙ change player, — minimize, ✕ close.
4. Click a match to open it on opendota.com.
5. **Compact mode** (▭) shrinks the widget to a 150×44 bar with only the `W : L` score. Drag it from anywhere; to go back to the full view, hover over it and click ⤢ on the right. A red dot on the left means the last refresh failed (hover to see the error). The mode is remembered between launches.

The widget refreshes itself every 3 minutes. New matches usually appear on OpenDota a few minutes after the game ends.
Settings (player ID, window position, always on top, compact mode) are stored in `%APPDATA%\dota-stats\settings.json`.
