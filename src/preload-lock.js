const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lock', {
  info: () => ipcRenderer.invoke('lock:info'),
  unlock: (user, pass) => ipcRenderer.invoke('lock:unlock', { user, pass }),
  touchId: () => ipcRenderer.invoke('lock:touchid'),
});
