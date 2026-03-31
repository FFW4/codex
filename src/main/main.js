const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ElectronStore = require('electron-store');
const SoulSeekClient = require('./soulseek-client');
const { AudioAnalyzer } = require('./audio-analyzer');

// Clean up temp files on startup
function cleanupTempFiles() {
  const tempDir = path.join(os.tmpdir(), 'soulseek-player');
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      let cleaned = 0;
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        try {
          fs.unlinkSync(filePath);
          cleaned++;
        } catch (e) {}
      });
      log(`Cleaned up ${cleaned} temp files`);
    }
  } catch (e) {
    log(`Temp cleanup error: ${e.message}`);
  }
}

// Simple file logger
const logFile = path.join(app.getPath('userData'), 'soulseek-player.log');
function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, line);
  console.log(message);
}
log('--- CODEX started ---');
cleanupTempFiles();

const store = new ElectronStore({
  defaults: {
    downloads: [],
    library: [],
    settings: {
      downloadPath: path.join(app.getPath('music'), 'SoulSeek Player'),
      cachePath: path.join(app.getPath('cache'), 'soulseek-player'),
      streamBufferSize: 512 * 1024,
      maxConcurrentDownloads: 3
    }
  }
});

let mainWindow;
let soulseekClient;
let audioAnalyzer;
const activeTransfers = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  const downloadPath = store.get('settings.downloadPath');
  const cachePath = store.get('settings.cachePath');

  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }

  soulseekClient = new SoulSeekClient(cachePath);
  audioAnalyzer = new AudioAnalyzer();

  soulseekClient.on('connected', () => {
    if (mainWindow) {
      mainWindow.webContents.send('soulseek-status', { connected: true, username: soulseekClient.getUsername() });
    }
  });

  soulseekClient.on('disconnected', () => {
    if (mainWindow) {
      mainWindow.webContents.send('soulseek-status', { connected: false, username: null });
    }
  });

  soulseekClient.on('login-success', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('login-success', data);
    }
  });

  soulseekClient.on('login-fail', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('login-fail', data);
    }
  });

  soulseekClient.on('search-result', (result) => {
    if (mainWindow) {
      mainWindow.webContents.send('search-result', result);
    }
  });

  soulseekClient.on('transfer-complete', (transfer) => {
    if (mainWindow) {
      mainWindow.webContents.send('transfer-complete', transfer);
    }
  });

  soulseekClient.on('error', (err) => {
    console.error('SoulSeek error:', err.message);
  });

  // Auto-login with stored credentials
  const savedCreds = store.get('credentials');
  if (savedCreds && savedCreds.username && savedCreds.password) {
    soulseekClient.setCredentials(savedCreds.username, savedCreds.password);
    soulseekClient.connect().then((result) => {
      log(`Auto-login successful: ${JSON.stringify(result)}`);
    }).catch((err) => {
      log(`Auto-login failed: ${err.message}`);
    });
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (soulseekClient) {
    soulseekClient.disconnect();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('search', async (event, query) => {
  try {
    const results = await soulseekClient.search(query);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-file-info', async (event, filePath) => {
  try {
    const info = await audioAnalyzer.getFileInfo(filePath);
    return { success: true, info };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-song', async (event, { filename, username, path: remotePath }) => {
  try {
    const downloadPath = store.get('settings.downloadPath');
    log('[MAIN] Starting download for: ' + filename + ' from ' + username);
    const transferId = await soulseekClient.downloadFile(username, remotePath, downloadPath, filename);
    log('[MAIN] Download started with transferId: ' + transferId);
    return { success: true, transferId };
  } catch (error) {
    log('[MAIN] Download failed: ' + error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-multiple', async (event, files) => {
  try {
    const downloadPath = store.get('settings.downloadPath');
    log('[MAIN] Starting batch download for ' + files.length + ' files');
    const result = await soulseekClient.downloadMultiple(files, downloadPath);
    log('[MAIN] Batch download: ' + result.results.filter(r => r.success).length + ' queued, ' + result.errors.length + ' failed');
    return { success: true, ...result };
  } catch (error) {
    log('[MAIN] Batch download failed: ' + error.message);
    return { success: false, error: error.message };
  }
});

// Periodic progress sender - polls active transfers and sends updates
// Reduced frequency to every 2 seconds to reduce CPU/logging overhead
let lastTransferCount = 0;
setInterval(() => {
  if (!mainWindow || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
    return;
  }
  
  const transfers = soulseekClient.getActiveTransfers();
  
  // Only log if transfer count changes
  if (transfers.size !== lastTransferCount) {
    log('[PERIODIC] Active transfers: ' + transfers.size);
    lastTransferCount = transfers.size;
  }
  
  if (transfers.size === 0) return;
  
  transfers.forEach((transfer, id) => {
    const progress = {
      id: id,
      filename: transfer.filename,
      bytesTransferred: transfer.bytesTransferred,
      fileSize: transfer.fileSize,
      progress: transfer.progress || 0
    };
    mainWindow.webContents.send('transfer-progress', progress);
  });
}, 2000);

ipcMain.handle('stream-song', async (event, { filename, username, path: remotePath }) => {
  try {
    const cachePath = store.get('settings.cachePath');
    const streamUrl = await soulseekClient.startStream(username, remotePath, cachePath, filename);
    return { success: true, streamUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-transfer', async (event, transferId) => {
  try {
    const result = await soulseekClient.cancelTransfer(transferId);
    if (result && result.success) {
      return { success: true };
    }
    return { success: false, error: result?.error || 'Failed to cancel transfer' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-library', async () => {
  const settings = store.get('settings');
  const downloadPath = settings.downloadPath;
  const library = store.get('library', []) || [];
  
  // Scan download folder for music files
  if (downloadPath && fs.existsSync(downloadPath)) {
    const musicExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.wma', '.aiff'];
    const scannedFiles = await scanMusicFolder(downloadPath, musicExtensions);
    
    // Merge scanned files with library (scanned files take precedence)
    const mergedLibrary = [];
    const seenPaths = new Set();
    
    // First add scanned files
    for (const file of scannedFiles) {
      mergedLibrary.push(file);
      seenPaths.add(file.filePath);
    }
    
    // Then add library items that aren't already in scanned files
    for (const song of library) {
      if (!seenPaths.has(song.filePath)) {
        mergedLibrary.push(song);
      }
    }
    
    return mergedLibrary;
  }
  
  return library;
});

async function scanMusicFolder(folderPath, extensions) {
  const files = [];
  
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanMusicFolder(fullPath, extensions);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          try {
            const info = await audioAnalyzer.getFileInfo(fullPath);
            files.push({
              filePath: fullPath,
              filename: entry.name,
              title: info.title,
              artist: info.artist,
              album: info.album,
              genre: info.genre,
              quality: info.quality,
              format: info.format,
              bitrate: info.bitrate,
              sampleRate: info.sampleRate,
              duration: info.duration,
              durationFormatted: info.durationFormatted,
              fileSize: info.fileSize,
              hasArtwork: info.hasArtwork,
              artwork: info.artwork
            });
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }
    }
  } catch (e) {
    console.error('Error scanning folder:', e.message);
  }
  
  return files;
}

ipcMain.handle('add-to-library', async (event, song) => {
  const library = store.get('library', []);
  const existing = library.findIndex(s => s.filePath === song.filePath);
  if (existing >= 0) {
    library[existing] = song;
  } else {
    library.push(song);
  }
  store.set('library', library);
  return { success: true };
});

ipcMain.handle('remove-from-library', async (event, filePath) => {
  const library = store.get('library', []);
  const updated = library.filter(s => s.filePath !== filePath);
  store.set('library', updated);
  return { success: true };
});

ipcMain.handle('get-settings', async () => {
  return store.get('settings');
});

ipcMain.handle('update-settings', async (event, settings) => {
  store.set('settings', { ...store.get('settings'), ...settings });
  return { success: true };
});

ipcMain.handle('select-download-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    store.set('settings.downloadPath', result.filePaths[0]);
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('login', async (event, { username, password }) => {
  log(`Login attempt for user: ${username}`);
  try {
    soulseekClient.setCredentials(username, password);
    store.set('credentials', { username, password });

    await soulseekClient.connect();
    log(`Login successful for user: ${username}`);
    return { success: true, username };
  } catch (error) {
    log(`Login failed for user ${username}: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-credentials', async (event, { username, password }) => {
  store.set('credentials', { username, password });
  return { success: true };
});

ipcMain.handle('logout', async () => {
  try {
    soulseekClient.disconnect();
    store.delete('credentials');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-credentials', async () => {
  const creds = store.get('credentials');
  if (creds) {
    return { success: true, username: creds.username, hasPassword: true };
  }
  return { success: true, username: null, hasPassword: false };
});

ipcMain.handle('get-login-status', async () => {
  return {
    isLoggedIn: soulseekClient.isConnected(),
    username: soulseekClient.getUsername()
  };
});

ipcMain.handle('auto-login', async () => {
  const creds = store.get('credentials');
  if (creds && creds.username && creds.password) {
    try {
      soulseekClient.setCredentials(creds.username, creds.password);
      await soulseekClient.connect();
      return { success: true, username: creds.username };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'No saved credentials' };
});

ipcMain.handle('window-control', async (event, action) => {
  if (!mainWindow) return;
  switch (action) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
    case 'close':
      mainWindow.close();
      break;
  }
});

ipcMain.handle('get-local-files', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath).filter(f =>
      /\.(mp3|flac|wav|ogg|m4a|aac|wma)$/i.test(f)
    );
    const fileInfos = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(dirPath, file);
        const stats = fs.statSync(fullPath);
        try {
          const info = await audioAnalyzer.getFileInfo(fullPath);
          return {
            filePath: fullPath,
            filename: file,
            size: stats.size,
            modified: stats.mtime,
            ...info
          };
        } catch {
          return {
            filePath: fullPath,
            filename: file,
            size: stats.size,
            modified: stats.mtime,
            format: path.extname(file).slice(1).toUpperCase(),
            quality: 'Unknown'
          };
        }
      })
    );
    return { success: true, files: fileInfos };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-playlists', async () => {
  return store.get('playlists', []);
});

ipcMain.handle('save-playlist', async (event, playlist) => {
  const playlists = store.get('playlists', []);
  const existing = playlists.findIndex(p => p.id === playlist.id);
  if (existing >= 0) {
    playlists[existing] = playlist;
  } else {
    playlists.push(playlist);
  }
  store.set('playlists', playlists);
  return { success: true };
});

ipcMain.handle('delete-playlist', async (event, playlistId) => {
  const playlists = store.get('playlists', []);
  const filtered = playlists.filter(p => p.id !== playlistId);
  store.set('playlists', filtered);
  return { success: true };
});
