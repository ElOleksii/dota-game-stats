const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = { accountId: null, alwaysOnTop: true, compact: false, bounds: null };
const SIZE_NORMAL = { width: 300, height: 400 };
const SIZE_COMPACT = { width: 150, height: 44 };

const sizeFor = (compact) => (compact ? SIZE_COMPACT : SIZE_NORMAL);

let settings = { ...DEFAULTS };
let win = null;

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE(), 'utf8');
    settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULTS };
  }
}

function writeSettings() {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

// Returns the saved position only if it is visible on one of the displays.
function validBounds(bounds) {
  if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return null;
  const visible = screen.getAllDisplays().some(({ workArea: a }) =>
    bounds.x >= a.x - 50 && bounds.y >= a.y - 10 &&
    bounds.x < a.x + a.width - 50 && bounds.y < a.y + a.height - 50);
  return visible ? bounds : null;
}

function createWindow() {
  const pos = validBounds(settings.bounds);
  // Compact mode makes no sense without a player, so open the full view.
  if (!settings.accountId) settings.compact = false;
  win = new BrowserWindow({
    ...sizeFor(settings.compact),
    ...(pos ? { x: pos.x, y: pos.y } : {}),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: settings.alwaysOnTop,
    title: 'Dota Today',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const saveBounds = () => {
    if (!win || win.isDestroyed()) return;
    const { x, y } = win.getBounds();
    settings.bounds = { x, y };
    writeSettings();
  };
  win.on('moved', saveBounds);
  win.on('close', saveBounds);

  // Block any attempt to open new windows or navigate away.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

ipcMain.handle('settings:get', () => ({ ...settings }));

ipcMain.handle('settings:save', (_e, patch) => {
  if (patch && typeof patch === 'object') {
    if ('accountId' in patch) {
      const id = patch.accountId;
      settings.accountId = typeof id === 'string' && /^\d{1,10}$/.test(id) ? id : null;
    }
  }
  writeSettings();
  return { ...settings };
});

ipcMain.handle('window:toggleOnTop', () => {
  settings.alwaysOnTop = !settings.alwaysOnTop;
  if (win) win.setAlwaysOnTop(settings.alwaysOnTop);
  writeSettings();
  return settings.alwaysOnTop;
});

ipcMain.handle('window:setCompact', (_e, compact) => {
  settings.compact = Boolean(compact) && Boolean(settings.accountId);
  if (win) {
    const { x, y } = win.getBounds();
    // On Windows, setBounds can be ignored for a non-resizable window.
    win.setResizable(true);
    win.setBounds({ x, y, ...sizeFor(settings.compact) });
    win.setResizable(false);
  }
  writeSettings();
  return settings.compact;
});

ipcMain.handle('window:minimize', () => win && win.minimize());
ipcMain.handle('window:close', () => win && win.close());

ipcMain.handle('shell:openMatch', (_e, matchId) => {
  if (/^\d{1,15}$/.test(String(matchId))) {
    shell.openExternal(`https://www.opendota.com/matches/${matchId}`);
  }
});

app.whenReady().then(() => {
  loadSettings();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
