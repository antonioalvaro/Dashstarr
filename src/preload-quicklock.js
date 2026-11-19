const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quickLock', {
  info: () => ipcRenderer.invoke('quicklock:info'),
  submit: (data) => ipcRenderer.invoke('quicklock:submit', data),
  cancel: () => ipcRenderer.send('quicklock:cancel'),
});
