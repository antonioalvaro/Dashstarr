const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  list: () => ipcRenderer.invoke('servers:list'),
  add: (data) => ipcRenderer.invoke('servers:add', data),
  update: (data) => ipcRenderer.invoke('servers:update', data),
  remove: (id) => ipcRenderer.invoke('servers:remove', id),
  connect: (id) => ipcRenderer.invoke('connect', id),
  quickConnect: (address) => ipcRenderer.invoke('quick-connect', address),
  refreshStatus: () => ipcRenderer.invoke('status:refresh'),
  contextMenu: (id) => ipcRenderer.send('context-menu', id),
  onServers: (fn) => ipcRenderer.on('servers', (_e, list) => fn(list)),
  onStatus: (fn) => ipcRenderer.on('status', (_e, s) => fn(s)),
  onEdit: (fn) => ipcRenderer.on('edit', (_e, id) => fn(id)),
  onOpen: (fn) => ipcRenderer.on('open', (_e, ids) => fn(ids)),
  tsState: () => ipcRenderer.invoke('ts:state'),
  tsMenu: () => ipcRenderer.send('ts:menu'),
  tsLogin: () => ipcRenderer.send('ts:login'),
  tsEnable: () => ipcRenderer.send('ts:enable'),
  onTs: (fn) => ipcRenderer.on('ts', (_e, state) => fn(state)),
});
