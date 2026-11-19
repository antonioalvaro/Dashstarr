const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
  get: () => ipcRenderer.invoke('settings:get'),
  saveLock: (data) => ipcRenderer.invoke('settings:saveLock', data),
  lockNow: () => ipcRenderer.send('settings:lockNow'),
});
