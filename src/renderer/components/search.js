let searchResults = [];
let searchLoading = false;
let renderTimeout = null;
let selectedSongIndex = -1;
const MAX_SEARCH_RESULTS = 200;

let viewMode = 'albums';
let albumGroups = [];
let selectedAlbum = null;
let selectedTracks = new Set();

function groupByAlbum(results) {
  const groups = new Map();
  
  results.forEach(result => {
    const fullPath = result.fullFilename || result.filePath || '';
    const parts = fullPath.split(/[\\/]/);
    const parentDir = parts.slice(0, -1).join('/');
    const key = `${result.username}::${parentDir}`;
    
    if (!groups.has(key)) {
      const albumName = parts.length > 1 ? parts[parts.length - 2] : 'Unknown Album';
      const artistName = parts.length > 2 ? parts[parts.length - 3] : 'Unknown Artist';
      
      groups.set(key, {
        id: key,
        name: albumName,
        artist: artistName,
        parentPath: parentDir,
        username: result.username,
        files: [],
        totalSize: 0
      });
    }
    
    const group = groups.get(key);
    group.files.push(result);
    group.totalSize += result.filesize || 0;
  });
  
  return Array.from(groups.values()).sort((a, b) => b.files.length - a.files.length);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getQualityClass(quality) {
  if (!quality) return 'unknown';
  const q = quality.toLowerCase();
  if (q.includes('lossless')) return 'lossless';
  if (q.includes('320') || q.includes('hi-quality')) return 'hi-quality';
  if (q.includes('256') || q.includes('high')) return 'high';
  if (q.includes('192') || q.includes('good')) return 'good';
  if (q.includes('128') || q.includes('standard')) return 'standard';
  return 'unknown';
}

function performSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query || searchLoading) return;

  if (renderTimeout) {
    clearTimeout(renderTimeout);
    renderTimeout = null;
  }

  searchLoading = true;
  searchResults = [];
  albumGroups = [];
  selectedAlbum = null;
  selectedTracks.clear();
  viewMode = 'albums';

  renderSearchLoading();

  const container = document.getElementById('searchResults');
  container.innerHTML = '<div class="search-loading"><div class="spinner"></div><p style="color: var(--text-muted); font-size: 13px;">Searching...</p></div>';

  window.api.search(query).then(response => {
    console.log('Search response:', response);
    searchLoading = false;
    if (!response.success) {
      showNotification('Search failed: ' + response.error, 'error');
      renderSearchEmpty();
    } else if (response.results) {
      searchResults = response.results.slice(0, MAX_SEARCH_RESULTS);
      albumGroups = groupByAlbum(searchResults);
      console.log('Setting searchResults:', searchResults.length, 'albumGroups:', albumGroups.length);
      renderSearchResults();
    }
  }).catch(err => {
    searchLoading = false;
    console.error('Search error:', err);
    showNotification('Search error: ' + err.message, 'error');
    renderSearchEmpty();
  });
}

window.onSearchResult = function(result) {
  if (searchResults.length < MAX_SEARCH_RESULTS) {
    searchResults.push(result);
    const groups = groupByAlbum(searchResults);
    if (groups.length !== albumGroups.length) {
      albumGroups = groups;
    }
  }
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    renderSearchResults();
  }, 100);
};

function renderSearchLoading() {
  const container = document.getElementById('searchResults');
  container.innerHTML = `
    <div class="search-loading">
      <div class="spinner"></div>
      <p style="color: var(--text-muted); font-size: 13px;">Searching SoulSeek...</p>
    </div>
  `;
}

function renderSearchEmpty() {
  const container = document.getElementById('searchResults');
  container.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 100 100" width="80" height="80">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <circle cx="50" cy="50" r="4" fill="currentColor" opacity="0.3"/>
        <path d="M50 10 L50 25 M50 75 L50 90 M10 50 L25 50 M75 50 L90 50" stroke="currentColor" stroke-width="2" opacity="0.3"/>
      </svg>
      <p class="empty-text">Enter a search term to find music on SoulSeek</p>
    </div>
  `;
}

function renderSearchResults() {
  const container = document.getElementById('searchResults');
  console.log('renderSearchResults called, results:', searchResults.length, 'mode:', viewMode);

  if (searchResults.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="80" height="80">
          <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
          <path d="M21 21 L16.65 16.65" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
        </svg>
        <p class="empty-text">No results found</p>
      </div>
    `;
    return;
  }

  if (selectedAlbum !== null) {
    renderAlbumTracks(albumGroups[selectedAlbum]);
    return;
  }

  if (viewMode === 'albums') {
    renderAlbumView();
  } else {
    renderTracksView();
  }
}

function renderAlbumView() {
  const container = document.getElementById('searchResults');
  
  const totalAlbums = albumGroups.length;
  const totalTracks = searchResults.length;
  
  let html = `
    <div class="search-header-row">
      <div class="view-toggle">
        <button class="view-toggle-btn ${viewMode === 'albums' ? 'active' : ''}" data-view="albums">Albums</button>
        <button class="view-toggle-btn ${viewMode === 'tracks' ? 'active' : ''}" data-view="tracks">Tracks</button>
      </div>
      <p class="results-count">${totalAlbums} albums, ${totalTracks} tracks</p>
    </div>
    <div class="album-grid" id="albumGrid">
  `;
  
  albumGroups.forEach((album, index) => {
    const trackCount = album.files.length;
    const sizeFormatted = formatFileSize(album.totalSize);
    
    html += `
      <div class="album-card" data-index="${index}">
        <div class="album-icon">
          <svg viewBox="0 0 24 24" width="40" height="40">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="1" fill="currentColor"/>
          </svg>
        </div>
        <div class="album-info">
          <div class="album-name" title="${album.name}">${album.name}</div>
          <div class="album-artist">${album.artist}</div>
          <div class="album-meta">
            <span>${trackCount} track${trackCount !== 1 ? 's' : ''}</span>
            <span>${sizeFormatted}</span>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function renderTracksView() {
  const container = document.getElementById('searchResults');
  
  const totalAlbums = albumGroups.length;
  const totalTracks = searchResults.length;
  
  let html = `
    <div class="search-header-row">
      <div class="view-toggle">
        <button class="view-toggle-btn ${viewMode === 'albums' ? 'active' : ''}" data-view="albums">Albums</button>
        <button class="view-toggle-btn ${viewMode === 'tracks' ? 'active' : ''}" data-view="tracks">Tracks</button>
      </div>
      <p class="results-count">${totalAlbums} albums, ${totalTracks} tracks</p>
    </div>
    <div class="search-results-grid" id="searchResultsGrid">
  `;
  
  searchResults.forEach((result, index) => {
    html += renderSearchResultItem(result, index);
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function renderAlbumTracks(album) {
  const container = document.getElementById('searchResults');
  const trackCount = album.files.length;
  const sizeFormatted = formatFileSize(album.totalSize);
  
  let html = `
    <div class="album-tracks-view">
      <div class="album-tracks-header">
        <button class="back-btn" id="backToAlbums">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          Back
        </button>
        <div class="album-tracks-info">
          <h2 class="album-tracks-title">${album.name}</h2>
          <p class="album-tracks-meta">${album.artist} • ${trackCount} tracks • ${sizeFormatted}</p>
        </div>
        <div class="album-tracks-actions">
          <button class="play-all-btn" data-play-album="${album.id}">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <polygon points="5,3 19,12 5,21" fill="currentColor"/>
            </svg>
            Play All
          </button>
        </div>
      </div>
      <div class="album-tracks-list" id="albumTracksList">
        <div class="album-tracks-list-header">
          <label class="track-checkbox-header">
            <input type="checkbox" id="selectAllTracks" ${selectedTracks.size === album.files.length ? 'checked' : ''}>
          </label>
          <span class="track-number">#</span>
          <span class="track-title-col">Title</span>
          <span class="track-size">Size</span>
        </div>
  `;
  
  album.files.forEach((file, index) => {
    const isSelected = selectedTracks.has(index);
    const state = downloadStates.get(file.filePath) || 'idle';
    
    html += `
      <div class="album-track-item ${isSelected ? 'selected' : ''}" data-track-index="${index}">
        <label class="track-checkbox-col">
          <input type="checkbox" class="track-checkbox" data-index="${index}" ${isSelected ? 'checked' : ''}>
        </label>
        <span class="track-number">${index + 1}</span>
        <span class="track-title-col" title="${file.filename}">${file.filename}</span>
        <span class="track-size">${formatFileSize(file.filesize || 0)}</span>
      </div>
    `;
  });
  
  html += `
      </div>
      <div class="album-tracks-footer">
        <button class="select-all-btn" id="selectAllBtn">Select All</button>
        <button class="deselect-all-btn" id="deselectAllBtn">Deselect All</button>
        <div class="selection-info">
          <span id="selectedCount">${selectedTracks.size} selected</span>
        </div>
        <button class="download-selected-btn" id="downloadSelectedBtn" ${selectedTracks.size === 0 ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" fill="none" stroke="currentColor" stroke-width="2"/>
            <polyline points="7 10 12 15 17 10" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2"/>
          </svg>
          Download (${selectedTracks.size})
        </button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

function renderSearchResultItem(result, index) {
  const { artist, title } = parseFilename(result.filename);
  const qualityClass = getQualityClass(result.quality);
  const sizeFormatted = formatFileSize(result.filesize);
  const state = downloadStates.get(result.filePath) || 'idle';

  let statusIcon = '';
  if (state === 'downloading') {
    statusIcon = `<svg class="download-status downloading" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="8" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-dasharray="50" stroke-dashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>`;
  } else if (state === 'complete') {
    statusIcon = `<svg class="download-status complete" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" fill="none" stroke="var(--green)" stroke-width="2"/><polyline points="8,12 11,15 16,9" fill="none" stroke="var(--green)" stroke-width="2"/></svg>`;
  }

  return `
    <div class="search-result-item" data-index="${index}">
      <div class="result-icon">
        ${statusIcon || `<svg viewBox="0 0 24 24" width="24" height="24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
          <circle cx="12" cy="12" r="1" fill="var(--bg-primary)"/>
        </svg>`}
      </div>
      <div class="result-info">
        <div class="result-title" title="${result.filename}">${title}</div>
        <div class="result-artist">${artist}</div>
        <div class="result-meta">
          <span class="result-meta-item">${result.extension.toUpperCase()}</span>
          <span class="result-meta-item">${sizeFormatted}</span>
          ${result.sampleRate > 0 ? `<span class="result-meta-item">${(result.sampleRate / 1000).toFixed(1)}kHz</span>` : ''}
          ${result.channels > 0 ? `<span class="result-meta-item">${result.channels === 1 ? 'Mono' : 'Stereo'}</span>` : ''}
          <span class="result-quality ${qualityClass}">${result.quality}</span>
        </div>
        <div class="result-username">Shared by: ${result.username}</div>
      </div>
      <div class="result-actions">
        <button class="action-btn play" data-action="play" data-index="${index}" title="Stream">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <polygon points="5,3 19,12 5,21" fill="currentColor"/>
          </svg>
        </button>
        <button class="action-btn download" data-action="download" data-index="${index}" title="Download" ${state === 'downloading' || state === 'complete' ? 'disabled' : ''}>
          ${state === 'complete' ? `<svg viewBox="0 0 24 24" width="16" height="16"><polyline points="20,6 9,17 4,12" fill="none" stroke="var(--green)" stroke-width="2"/></svg>` : 
            state === 'downloading' ? `<svg viewBox="0 0 24 24" width="16" height="16" class="spin"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="50" stroke-dashoffset="10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>` :
            `<svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" fill="none" stroke="currentColor" stroke-width="2"/>
            <polyline points="7 10 12 15 17 10" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2"/>
          </svg>`}
        </button>
      </div>
    </div>
  `;
}

function selectSearchResult(index) {
  const items = document.querySelectorAll('.search-result-item');
  items.forEach(item => item.classList.remove('selected'));
  items[index]?.classList.add('selected');
  selectedSongIndex = index;
  showSongDetail(index);
}

function showSongDetail(index) {
  const result = searchResults[index];
  if (!result) return;

  const panel = document.getElementById('songDetailPanel');
  const content = document.getElementById('songDetailContent');
  
  const { artist, title } = parseFilename(result.filename);
  const sizeFormatted = formatFileSize(result.filesize);

  content.innerHTML = `
    <div class="song-detail-item">
      <div class="song-detail-label">Title</div>
      <div class="song-detail-value">${title}</div>
    </div>
    <div class="song-detail-item">
      <div class="song-detail-label">Artist</div>
      <div class="song-detail-value">${artist}</div>
    </div>
    <div class="song-detail-item">
      <div class="song-detail-label">Shared By</div>
      <div class="song-detail-value">${result.username}</div>
    </div>
    <div class="song-detail-item">
      <div class="song-detail-label">Format</div>
      <div class="song-detail-value">${result.extension.toUpperCase()}</div>
    </div>
    <div class="song-detail-item">
      <div class="song-detail-label">Size</div>
      <div class="song-detail-value">${sizeFormatted}</div>
    </div>
    <div class="song-detail-item">
      <div class="song-detail-label">Quality</div>
      <div class="song-detail-value"><span class="result-quality ${getQualityClass(result.quality)}">${result.quality}</span></div>
    </div>
    ${result.sampleRate > 0 ? `
    <div class="song-detail-item">
      <div class="song-detail-label">Sample Rate</div>
      <div class="song-detail-value">${(result.sampleRate / 1000).toFixed(1)} kHz</div>
    </div>
    ` : ''}
    ${result.bitrate > 0 ? `
    <div class="song-detail-item">
      <div class="song-detail-label">Bitrate</div>
      <div class="song-detail-value">${result.bitrate} kbps</div>
    </div>
    ` : ''}
  `;

  panel.classList.add('active');
}

function closeSongDetail() {
  const panel = document.getElementById('songDetailPanel');
  panel.classList.remove('active');
  selectedSongIndex = -1;
}

function playFromDetail() {
  if (selectedSongIndex >= 0) {
    streamSong(selectedSongIndex);
  }
}

function downloadFromDetail() {
  if (selectedSongIndex >= 0) {
    downloadSong(selectedSongIndex);
  }
}

function streamSong(index) {
  const result = searchResults[index];
  if (!result) return;

  const { artist, title } = parseFilename(result.filename);

  downloadStates.set(result.filePath, 'streaming');

  const playlistContext = {
    playlist: [...searchResults],
    currentIndex: index
  };

  window.api.streamSong({
    username: result.username,
    path: result.filePath
  }).then(response => {
    if (response.success && response.url) {
      playFromUrl(response.url, {
        title: title,
        artist: artist,
        filename: result.filename
      }, playlistContext);
      showNotification(`Streaming: ${title}`, 'info');
    } else {
      showNotification('Streaming failed: ' + (response.error || 'Unknown error'), 'error');
      downloadStates.delete(result.filePath);
    }
  }).catch(err => {
    console.error('Stream error:', err);
    showNotification('Streaming error: ' + err.message, 'error');
    downloadStates.delete(result.filePath);
  });
}

function downloadSong(index) {
  const result = searchResults[index];
  if (!result) return;

  const state = downloadStates.get(result.filePath);
  if (state === 'downloading' || state === 'complete') return;

  downloadStates.set(result.filePath, 'downloading');
  renderSearchResults();

  window.api.downloadSong({
    username: result.username,
    filename: result.filename,
    path: result.filePath
  }).then(response => {
    if (response.success) {
      showNotification(`Download started: ${result.filename}`, 'info');
    } else {
      downloadStates.delete(result.filePath);
      renderSearchResults();
      showNotification('Download failed: ' + (response.error || 'Unknown error'), 'error');
    }
  }).catch(err => {
    downloadStates.delete(result.filePath);
    renderSearchResults();
    showNotification('Download error: ' + err.message, 'error');
  });
}

function playAlbum(albumIndex) {
  const album = albumGroups[albumIndex];
  if (!album || album.files.length === 0) return;

  const firstFile = album.files[0];
  const { artist, title } = parseFilename(firstFile.filename);

  downloadStates.set(firstFile.filePath, 'streaming');

  window.api.streamSong({
    username: album.username,
    path: firstFile.filePath
  }).then(response => {
    if (response.success && response.url) {
      playFromUrl(response.url, {
        title: title,
        artist: artist,
        filename: firstFile.filename
      });
      showNotification(`Playing: ${title}`, 'info');
    } else {
      downloadStates.delete(firstFile.filePath);
      showNotification('Streaming failed', 'error');
    }
  }).catch(err => {
    downloadStates.delete(firstFile.filePath);
    showNotification('Streaming error: ' + err.message, 'error');
  });
}

function downloadSelectedTracks() {
  if (selectedTracks.size === 0 || selectedAlbum === null) return;

  const album = albumGroups[selectedAlbum];
  if (!album) return;

  const filesToDownload = Array.from(selectedTracks).map(index => {
    const file = album.files[index];
    return {
      username: album.username,
      filename: file.filename,
      remotePath: file.filePath
    };
  });

  filesToDownload.forEach(file => {
    downloadStates.set(file.remotePath, 'downloading');
  });
  renderAlbumTracks(album);

  window.api.downloadMultiple(filesToDownload).then(response => {
    if (response.success) {
      showNotification(`Downloading ${filesToDownload.length} files...`, 'info');
    } else {
      showNotification('Batch download failed', 'error');
      filesToDownload.forEach(file => {
        downloadStates.delete(file.remotePath);
      });
      renderAlbumTracks(album);
    }
  }).catch(err => {
    showNotification('Batch download error: ' + err.message, 'error');
    filesToDownload.forEach(file => {
      downloadStates.delete(file.remotePath);
    });
    renderAlbumTracks(album);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('searchResults');

  container.addEventListener('click', (e) => {
    if (e.target.closest('#backToAlbums')) {
      selectedAlbum = null;
      selectedTracks.clear();
      renderSearchResults();
      return;
    }

    if (e.target.closest('#selectAllBtn')) {
      if (selectedAlbum !== null) {
        const album = albumGroups[selectedAlbum];
        if (album) {
          album.files.forEach((_, i) => selectedTracks.add(i));
          renderAlbumTracks(album);
        }
      }
      return;
    }

    if (e.target.closest('#deselectAllBtn')) {
      selectedTracks.clear();
      if (selectedAlbum !== null) {
        const album = albumGroups[selectedAlbum];
        if (album) renderAlbumTracks(album);
      }
      return;
    }

    if (e.target.closest('#downloadSelectedBtn')) {
      downloadSelectedTracks();
      return;
    }

    if (e.target.closest('#selectAllTracks')) {
      const checkbox = e.target;
      if (selectedAlbum !== null) {
        const album = albumGroups[selectedAlbum];
        if (album) {
          if (checkbox.checked) {
            album.files.forEach((_, i) => selectedTracks.add(i));
          } else {
            selectedTracks.clear();
          }
          renderAlbumTracks(album);
        }
      }
      return;
    }

    const trackCheckbox = e.target.closest('.track-checkbox');
    if (trackCheckbox) {
      const index = parseInt(trackCheckbox.dataset.index);
      if (trackCheckbox.checked) {
        selectedTracks.add(index);
      } else {
        selectedTracks.delete(index);
      }
      if (selectedAlbum !== null) {
        const album = albumGroups[selectedAlbum];
        if (album) {
          const countEl = document.getElementById('selectedCount');
          if (countEl) countEl.textContent = `${selectedTracks.size} selected`;
          const downloadBtn = document.getElementById('downloadSelectedBtn');
          if (downloadBtn) downloadBtn.disabled = selectedTracks.size === 0;
          const trackItem = trackCheckbox.closest('.album-track-item');
          if (trackItem) trackItem.classList.toggle('selected', selectedTracks.has(index));
        }
      }
      return;
    }

    if (e.target.closest('.album-card')) {
      const card = e.target.closest('.album-card');
      const index = parseInt(card.dataset.index);
      selectedAlbum = index;
      selectedTracks.clear();
      renderAlbumTracks(albumGroups[index]);
      return;
    }

    const playAlbumBtn = e.target.closest('[data-play-album]');
    if (playAlbumBtn) {
      const albumId = playAlbumBtn.dataset.playAlbum;
      const albumIndex = albumGroups.findIndex(a => a.id === albumId);
      if (albumIndex >= 0) {
        playAlbum(albumIndex);
      }
      return;
    }

    const viewToggleBtn = e.target.closest('.view-toggle-btn');
    if (viewToggleBtn) {
      const view = viewToggleBtn.dataset.view;
      if (view === 'albums' || view === 'tracks') {
        viewMode = view;
        selectedAlbum = null;
        selectedTracks.clear();
        renderSearchResults();
      }
      return;
    }

    const actionBtn = e.target.closest('.action-btn');
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const index = parseInt(actionBtn.dataset.index);
      
      if (action === 'play') {
        streamSong(index);
      } else if (action === 'download') {
        downloadSong(index);
      }
      return;
    }

    const item = e.target.closest('.search-result-item');
    if (item) {
      const index = parseInt(item.dataset.index);
      selectSearchResult(index);
    }
  });

  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
  }

  const closeDetailBtn = document.getElementById('closeDetailBtn');
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', closeSongDetail);
  }

  const playFromDetailBtn = document.getElementById('playFromDetailBtn');
  if (playFromDetailBtn) {
    playFromDetailBtn.addEventListener('click', playFromDetail);
  }

  const downloadFromDetailBtn = document.getElementById('downloadFromDetailBtn');
  if (downloadFromDetailBtn) {
    downloadFromDetailBtn.addEventListener('click', downloadFromDetail);
  }
});
