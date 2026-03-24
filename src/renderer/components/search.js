let searchResults = [];
let searchLoading = false;
let renderTimeout = null;
let selectedSongIndex = -1;

function performSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query || searchLoading) return;

  searchLoading = true;
  searchResults = [];
  renderSearchLoading();

  // Clear previous results immediately
  const container = document.getElementById('searchResults');
  container.innerHTML = '<div class="search-loading"><div class="spinner"></div><p style="color: var(--text-muted); font-size: 13px;">Searching...</p></div>';

  window.api.search(query).then(response => {
    console.log('Search response:', response);
    searchLoading = false;
    if (!response.success) {
      showNotification('Search failed: ' + response.error, 'error');
      renderSearchEmpty();
    } else if (response.results) {
      // Add all results at once
      searchResults = response.results;
      console.log('Setting searchResults:', searchResults.length);
      renderSearchResults();
    }
  }).catch(err => {
    searchLoading = false;
    console.error('Search error:', err);
    showNotification('Search error: ' + err.message, 'error');
    renderSearchEmpty();
  });
}

// Global function for IPC event listener
window.onSearchResult = function(result) {
  searchResults.push(result);
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
  console.log('renderSearchResults called, results:', searchResults.length);

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

  const displayLimit = 200;
  const displayResults = searchResults.slice(0, displayLimit);

  let html = `<p class="results-count">${searchResults.length} results${searchResults.length > displayLimit ? ` (showing ${displayLimit})` : ''}</p>`;
  html += '<div class="search-results-grid">';
  displayResults.forEach((result, index) => {
    html += renderSearchResultItem(result, index);
  });
  html += '</div>';

  container.innerHTML = html;
  console.log('Rendered HTML, container children:', container.children.length);
}

function renderSearchResultItem(result, index) {
  const { artist, title } = parseFilename(result.filename);
  const qualityClass = getQualityClass(result.quality);
  const sizeFormatted = formatFileSize(result.filesize);

  return `
    <div class="search-result-item" data-index="${index}">
      <div class="result-icon">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
          <circle cx="12" cy="12" r="1" fill="var(--bg-primary)"/>
        </svg>
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
        <button class="action-btn download" data-action="download" data-index="${index}" title="Download">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" fill="none" stroke="currentColor" stroke-width="2"/>
            <polyline points="7 10 12 15 17 10" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2"/>
          </svg>
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

  showNotification(`Streaming: ${parseFilename(result.filename).title}`, 'info');

  window.api.streamSong({
    filename: result.filename,
    username: result.username,
    path: result.filePath
  }).then(response => {
    if (response.success && response.streamUrl) {
      playFromUrl(response.streamUrl, {
        title: parseFilename(result.filename).title,
        artist: parseFilename(result.filename).artist,
        quality: result.quality
      });
    } else {
      showNotification('Failed to start stream: ' + (response.error || 'Unknown error'), 'error');
    }
  });
}

function downloadSong(index) {
  const result = searchResults[index];
  if (!result) return;

  const { artist, title } = parseFilename(result.filename);
  showNotification(`Starting download: ${title}`, 'info');

  window.api.downloadSong({
    filename: result.filename,
    username: result.username,
    path: result.filePath
  }).then(response => {
    if (response.success) {
      // Download started, completion will be notified via IPC
    } else {
      showNotification('Download failed: ' + response.error, 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
  }

  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
  }

  // Event delegation for search results
  document.addEventListener('click', (e) => {
    const resultItem = e.target.closest('.search-result-item');
    const actionBtn = e.target.closest('.action-btn');

    if (actionBtn) {
      const index = parseInt(actionBtn.dataset.index);
      const action = actionBtn.dataset.action;
      
      if (action === 'play') {
        streamSong(index);
      } else if (action === 'download') {
        downloadSong(index);
      }
    } else if (resultItem) {
      const index = parseInt(resultItem.dataset.index);
      selectSearchResult(index);
    }
  });
});
