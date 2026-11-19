const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('login', {
  submit: (user, pass, remember) => ipcRenderer.send('login:submit', { user, pass, remember }),
  cancel: () => ipcRenderer.send('login:submit', null),
});
