const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (data) => ipcRenderer.invoke('login', data),
  logout: () => ipcRenderer.invoke('logout'),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  getLoginStatus: () => ipcRenderer.invoke('get-login-status'),
  autoLogin: () => ipcRenderer.invoke('auto-login'),
  saveCredentials: (data) => ipcRenderer.invoke('save-credentials', data),

  // Search & Playback
  search: (query) => ipcRenderer.invoke('search', query),
  downloadSong: (data) => ipcRenderer.invoke('download-song', data),
  streamSong: (data) => ipcRenderer.invoke('stream-song', data),
  cancelTransfer: (transferId) => ipcRenderer.invoke('cancel-transfer', transferId),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),

  // Library
  getLibrary: () => ipcRenderer.invoke('get-library'),
  addToLibrary: (song) => ipcRenderer.invoke('add-to-library', song),
  removeFromLibrary: (filePath) => ipcRenderer.invoke('remove-from-library', filePath),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  selectDownloadPath: () => ipcRenderer.invoke('select-download-path'),

  // Window
  windowControl: (action) => ipcRenderer.invoke('window-control', action),
  getLocalFiles: (dirPath) => ipcRenderer.invoke('get-local-files', dirPath),

  // Event listeners
  onSearchResult: (callback) => {
    ipcRenderer.on('search-result', (event, data) => callback(data));
  },
  onTransferComplete: (callback) => {
    ipcRenderer.on('transfer-complete', (event, data) => callback(data));
  },
  onSoulseekStatus: (callback) => {
    ipcRenderer.on('soulseek-status', (event, data) => callback(data));
  },
  onLoginSuccess: (callback) => {
    ipcRenderer.on('login-success', (event, data) => callback(data));
  },
  onLoginFail: (callback) => {
    ipcRenderer.on('login-fail', (event, data) => callback(data));
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
