let isLoggedIn = false;
let currentUser = null;
let loginSuccessReceived = false;
let listenersSetup = false;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupNavButtons();
  setupPlayerControls();
});

function setupNavButtons() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      showView(view);
    });
  });

  document.querySelectorAll('.window-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      window.api.windowControl(action);
    });
  });

  document.getElementById('browseDownloadPath')?.addEventListener('click', selectDownloadPath);
}

function setupPlayerControls() {
  document.getElementById('prevBtn')?.addEventListener('click', previousTrack);
  document.getElementById('playPauseBtn')?.addEventListener('click', togglePlayPause);
  document.getElementById('nextBtn')?.addEventListener('click', nextTrack);
  document.getElementById('muteBtn')?.addEventListener('click', toggleMute);
  document.getElementById('volumeSlider')?.addEventListener('input', (e) => setVolume(e.target.value));
  document.getElementById('closeDetailBtn')?.addEventListener('click', closeSongDetail);
  document.getElementById('playFromDetailBtn')?.addEventListener('click', playFromDetail);
  document.getElementById('downloadFromDetailBtn')?.addEventListener('click', downloadFromDetail);
}

function initApp() {
  setupIPCListeners();
  setupEventListeners();
  loadSettings();
  showView('search');

  // Auto-connect happens in main process, just wait for status
  setTimeout(() => {
    window.api.getLoginStatus().then(status => {
      if (status.isLoggedIn) {
        isLoggedIn = true;
        currentUser = status.username;
        updateConnectionStatus(true, status.username);
        updateUserUI(status.username);
      }
    });
  }, 2000);
}

function onLoginSuccess(data) {
  isLoggedIn = true;
  currentUser = data.username;
  loadSettings();
  showView('search');
  updateUserUI(data.username);
  updateConnectionStatus(true, data.username);
  document.getElementById('searchInput')?.focus();
}

function updateConnectionStatus(connected, username) {
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-text');
  if (connected) {
    statusDot?.classList.add('connected');
    statusDot?.classList.remove('disconnected');
    if (statusText) statusText.textContent = username || 'Connected';
  } else {
    statusDot?.classList.remove('connected');
    statusDot?.classList.add('disconnected');
    if (statusText) statusText.textContent = 'Disconnected';
  }
}

function updateUserUI(username) {
  const sidebarUserName = document.getElementById('sidebarUserName');
  if (sidebarUserName) sidebarUserName.textContent = username;
}

function setupEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (!isLoggedIn) return;
    switch (e.code) {
      case 'Space': e.preventDefault(); togglePlayPause(); break;
      case 'ArrowLeft': if (audioPlayer.duration) audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 5); break;
      case 'ArrowRight': if (audioPlayer.duration) audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 5); break;
      case 'ArrowUp': e.preventDefault(); setVolume(Math.min(100, volume + 5)); break;
      case 'ArrowDown': e.preventDefault(); setVolume(Math.max(0, volume - 5)); break;
      case 'KeyM': toggleMute(); break;
    }
  });
}

function setupIPCListeners() {
  if (listenersSetup) {
    return;
  }
  listenersSetup = true;
  
  window.api.onSoulseekStatus((status) => {
    updateConnectionStatus(status.connected, status.username);
  });

  window.api.onLoginSuccess((data) => {
    loginSuccessReceived = true;
    onLoginSuccess(data);
  });

  window.api.onLoginFail((data) => {
    if (!loginSuccessReceived) showLoginOverlay();
    showLoginError(data.message || 'Login failed');
  });

  window.api.onSearchResult((result) => window.onSearchResult(result));
  window.api.onTransferComplete((transfer) => {
    // Show notification when download completes
    if (transfer.status === 'complete') {
      showNotification(`Download complete: ${transfer.filename}`, 'success');
      
      // Add to library
      if (transfer.localPath) {
        window.api.getFileInfo(transfer.localPath).then(response => {
          if (response.success) {
            const { artist, title } = parseFilename(transfer.filename);
            addToLibrary({
              filePath: transfer.localPath,
              filename: transfer.filename,
              title: response.info.title || title,
              artist: response.info.artist || artist,
              album: response.info.album,
              genre: response.info.genre,
              quality: response.info.quality,
              format: response.info.format,
              bitrate: response.info.bitrate,
              sampleRate: response.info.sampleRate,
              duration: response.info.duration,
              durationFormatted: response.info.durationFormatted,
              fileSize: response.info.fileSize,
              hasArtwork: response.info.hasArtwork,
              artwork: response.info.artwork
            });
          }
        });
      }
    }
  });
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const targetView = document.getElementById(`${viewName}View`);
  const targetBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (targetView) {
    targetView.classList.add('active');
  }
  if (targetBtn) targetBtn.classList.add('active');
  if (viewName === 'library') loadLibrary();
  else if (viewName === 'settings') {
    loadSettings();
  }
}

function selectDownloadPath() {
  window.api.selectDownloadPath().then(response => {
    if (response.success) {
      const input = document.getElementById('downloadPath');
      if (input) input.value = response.path;
      showNotification('Download path updated', 'success');
    }
  });
}

async function loadSettings() {
  try {
    const settings = await window.api.getSettings();
    const downloadPathInput = document.getElementById('downloadPath');
    const bufferSizeSelect = document.getElementById('bufferSize');
    const maxDownloadsSelect = document.getElementById('maxDownloads');
    
    if (downloadPathInput && settings.downloadPath) {
      downloadPathInput.value = settings.downloadPath;
    }
    if (bufferSizeSelect && settings.streamBufferSize) {
      bufferSizeSelect.value = settings.streamBufferSize;
    }
    if (maxDownloadsSelect && settings.maxConcurrentDownloads) {
      maxDownloadsSelect.value = settings.maxConcurrentDownloads;
    }

    // Save settings when changed
    if (bufferSizeSelect) {
      bufferSizeSelect.addEventListener('change', async () => {
        await window.api.updateSettings({ streamBufferSize: parseInt(bufferSizeSelect.value) });
        showNotification('Settings saved', 'success');
      });
    }
    if (maxDownloadsSelect) {
      maxDownloadsSelect.addEventListener('change', async () => {
        await window.api.updateSettings({ maxConcurrentDownloads: parseInt(maxDownloadsSelect.value) });
        showNotification('Settings saved', 'success');
      });
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

window.addEventListener('beforeunload', () => {
  window.api.removeAllListeners('search-result');
  window.api.removeAllListeners('transfer-progress');
  window.api.removeAllListeners('transfer-complete');
  window.api.removeAllListeners('soulseek-status');
  window.api.removeAllListeners('login-success');
  window.api.removeAllListeners('login-fail');
});
