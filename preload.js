const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  toggleOnTop: () => ipcRenderer.invoke('window:toggleOnTop'),
  setCompact: (compact) => ipcRenderer.invoke('window:setCompact', compact),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  openMatch: (matchId) => ipcRenderer.invoke('shell:openMatch', matchId),
});
