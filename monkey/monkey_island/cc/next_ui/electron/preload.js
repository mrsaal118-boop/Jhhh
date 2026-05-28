const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true,
    version: '2.3.0',
    getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    onNavigate: (callback) => ipcRenderer.on('navigate', (_, path) => callback(path))
});
