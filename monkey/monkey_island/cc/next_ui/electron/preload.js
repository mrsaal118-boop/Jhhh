const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true,
    version: '2.3.0',
    onNavigate: (callback) => ipcRenderer.on('navigate', (_, path) => callback(path)),
    saveConfig: (data, filePath) => ipcRenderer.send('save-config', data, filePath),
    getAppVersion: () => ipcRenderer.invoke('get-version')
});
