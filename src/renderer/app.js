let isLoggedIn = false;
let currentUser = null;
let loginSuccessReceived = false;
let listenersSetup = false;
let loginModal;
let downloadStates = new Map();
let activeDownloads = new Map();

document.addEventListener('DOMContentLoaded', () => {
  loginModal = document.getElementById('loginModal');
  initApp();
  setupNavButtons();
  setupPlayerControls();
  setupLoginModal();
  checkLoginStatus();
});

function setupLoginModal() {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const loginStatus = document.getElementById('loginStatus');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
      loginError.textContent = 'Please enter username and password';
      return;
    }

    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    loginError.textContent = '';
    loginStatus.textContent = 'Connecting to SoulSeek...';

    try {
      const result = await window.api.login({ username, password });
      if (result.success) {
        loginStatus.textContent = 'Connected!';
        loginModal.classList.remove('active');
        isLoggedIn = true;
        currentUser = result.username;
        updateConnectionStatus(true, result.username);
        updateUserUI(result.username);
        loadSettings();
      } else {
        loginError.textContent = result.error || 'Login failed';
        loginStatus.textContent = 'Connection failed';
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
      }
    } catch (error) {
      loginError.textContent = error.message || 'Connection error';
      loginStatus.textContent = 'Connection error';
      loginBtn.disabled = false;
      loginBtn.classList.remove('loading');
    }
  });
}

function checkLoginStatus() {
  setTimeout(async () => {
    try {
      const result = await window.api.getCredentials();
      if (result.username && result.hasPassword) {
        loginStatus.textContent = 'Auto-connecting...';
        const autoLoginResult = await window.api.autoLogin();
        if (autoLoginResult.success) {
          loginModal.classList.remove('active');
          isLoggedIn = true;
          currentUser = autoLoginResult.username;
          updateConnectionStatus(true, autoLoginResult.username);
          updateUserUI(autoLoginResult.username);
        } else {
          loginModal.classList.add('active');
          document.getElementById('loginUsername').value = result.username;
          document.getElementById('loginStatus').textContent = 'Session expired. Please login again.';
        }
      } else {
        loginModal.classList.add('active');
      }
    } catch (error) {
      loginModal.classList.add('active');
    }
  }, 1000);
}

function showLoginModal() {
  if (loginModal) {
    loginModal.classList.add('active');
  }
}

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
  document.getElementById('shuffleBtn')?.addEventListener('click', toggleShuffle);
  document.getElementById('repeatBtn')?.addEventListener('click', toggleRepeat);
}

function initApp() {
  setupIPCListeners();
  setupEventListeners();
  loadSettings();
  showView('search');
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

  window.api.onTransferProgress((progress) => {
    activeDownloads.set(progress.id, {
      id: progress.id,
      filename: progress.filename,
      bytesTransferred: progress.bytesTransferred,
      fileSize: progress.fileSize,
      progress: progress.progress || 0
    });
    updateDownloadsBar();
  });

  window.api.onTransferComplete((transfer) => {
    if (transfer.status === 'complete') {
      activeDownloads.delete(transfer.id);
      updateDownloadsBar();
      showNotification(`Download complete: ${transfer.filename}`, 'success');
      
      if (transfer.remotePath) {
        downloadStates.set(transfer.remotePath, 'complete');
        setTimeout(() => downloadStates.delete(transfer.remotePath), 30000);
        renderSearchResults();
      }
      
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

function updateDownloadsBar() {
  const bar = document.getElementById('downloadsBar');
  if (!bar) return;
  
  const downloads = Array.from(activeDownloads.values());
  
  if (downloads.length === 0) {
    bar.classList.remove('active');
    bar.innerHTML = '';
    return;
  }
  
  bar.classList.add('active');
  
  let html = `
    <div class="downloads-bar-header">
      <span class="downloads-bar-title">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        Downloading ${downloads.length} ${downloads.length === 1 ? 'file' : 'files'}
      </span>
    </div>
    <div class="downloads-list">
  `;
  
  downloads.forEach(d => {
    const percent = Math.round(d.progress || 0);
    const downloaded = formatFileSize(d.bytesTransferred || 0);
    const total = formatFileSize(d.fileSize || 0);
    const shortName = d.filename.length > 40 ? d.filename.substring(0, 40) + '...' : d.filename;
    
    html += `
      <div class="download-item" data-id="${d.id}">
        <div class="download-item-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="8" stroke-dasharray="50" stroke-dashoffset="10">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
        <div class="download-item-info">
          <div class="download-item-name">${shortName}</div>
          <div class="download-item-progress">
            <div class="download-item-bar">
              <div class="download-item-fill" style="width: ${percent}%"></div>
            </div>
            <span class="download-item-percent">${percent}%</span>
            <span class="download-item-size">${downloaded} / ${total}</span>
          </div>
        </div>
        <button class="download-item-cancel" data-cancel-id="${d.id}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
  });
  
  html += '</div>';
  bar.innerHTML = html;
}

window.cancelDownload = async function(id) {
  try {
    const result = await window.api.cancelTransfer(id);
    if (result.success) {
      activeDownloads.delete(id);
      updateDownloadsBar();
    } else {
      showNotification('Failed to cancel download: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    console.error('Failed to cancel download:', err);
    showNotification('Failed to cancel download', 'error');
  }
};

// Download bar click handler
document.addEventListener('click', (e) => {
  const cancelBtn = e.target.closest('[data-cancel-id]');
  if (cancelBtn) {
    const id = cancelBtn.dataset.cancelId;
    window.cancelDownload(id);
  }
});

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const targetView = document.getElementById(`${viewName}View`);
  const targetBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (targetView) {
    targetView.classList.add('active');
  }
  if (targetBtn) targetBtn.classList.add('active');
  
  if (window.artworkUtils) {
    window.artworkUtils.cleanupStaleArtwork();
  }
  
  if (viewName === 'library') loadLibrary();
  else if (viewName === 'playlists') loadPlaylists();
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
  
  if (window.artworkUtils) {
    window.artworkUtils.clearArtworkCache();
    window.artworkUtils.stopCleanupInterval();
  }
  downloadStates.clear();
  activeDownloads.clear();
});
