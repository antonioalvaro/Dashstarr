const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabsApi', {
  onTabs: (fn) => ipcRenderer.on('tabs', (_e, state) => fn(state)),
  activate: (id) => ipcRenderer.send('tab:activate', id),
  close: (id) => ipcRenderer.send('tab:close', id),
  contextMenu: (id) => ipcRenderer.send('tab:context-menu', id),
  home: () => ipcRenderer.send('tab:home'),
});
