let library = [];
let libraryViewMode = 'grid';

async function loadLibrary() {
  try {
    library = await window.api.getLibrary();
    renderLibrary();
  } catch (error) {
    console.error('Failed to load library:', error);
  }
}

function renderLibrary() {
  const container = document.getElementById('libraryContent');
  const countEl = document.getElementById('libraryCount');

  countEl.textContent = `${library.length} song${library.length !== 1 ? 's' : ''}`;

  if (library.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="80" height="80">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1" fill="none" opacity="0.3"/>
          <path d="M6.5 2H20L20 22H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1" fill="none" opacity="0.3"/>
        </svg>
        <p class="empty-text">Your library is empty. Download songs to add them here.</p>
      </div>
    `;
    return;
  }

  if (libraryViewMode === 'grid') {
    renderLibraryGrid(container);
  } else {
    renderLibraryList(container);
  }
}

function renderLibraryGrid(container) {
  container.innerHTML = `
    <div class="library-grid">
      ${library.map((song, index) => renderLibraryGridItem(song, index)).join('')}
    </div>
  `;
}

function renderLibraryGridItem(song, index) {
  const qualityClass = getQualityClass(song.quality || 'Unknown');
  const hasArtwork = song.hasArtwork && song.artwork && song.artwork.data;
  let artworkSrc = '';
  
  if (hasArtwork) {
    const base64Data = typeof song.artwork.data === 'string' 
      ? song.artwork.data 
      : '';
    artworkSrc = `data:${song.artwork.format};base64,${base64Data}`;
  }

  return `
    <div class="library-item" data-index="${index}">
      <div class="library-item-art ${hasArtwork ? 'has-artwork' : ''}">
        ${hasArtwork && artworkSrc
          ? `<img src="${artworkSrc}" alt="Album Art">`
          : `<div class="library-item-default-art">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.5"/>
                <path d="M9 9 L9 15 L15 12 Z" fill="currentColor" opacity="0.7"/>
              </svg>
            </div>`
        }
        <div class="library-item-overlay">
          <button class="library-play-btn">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <polygon points="5,3 19,12 5,21" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="library-item-info">
        <div class="library-item-title">${song.title || 'Unknown'}</div>
        <div class="library-item-artist">${song.artist || 'Unknown Artist'}</div>
        <span class="library-item-quality result-quality ${qualityClass}">${song.quality || 'Unknown'}</span>
      </div>
    </div>
  `;
}

function renderLibraryList(container) {
  container.innerHTML = `
    <div class="library-list">
      <div class="library-list-item" style="background: var(--bg-tertiary); border: none;">
        <span class="library-list-number">#</span>
        <span class="library-list-title" style="color: var(--text-muted); font-weight: 500;">Title</span>
        <span class="library-list-artist" style="color: var(--text-muted);">Artist</span>
        <span class="library-list-album" style="color: var(--text-muted);">Album</span>
        <span class="library-list-duration" style="color: var(--text-muted);">Duration</span>
        <span class="library-list-quality" style="color: var(--text-muted);">Quality</span>
      </div>
      ${library.map((song, index) => renderLibraryListItem(song, index)).join('')}
    </div>
  `;
}

function renderLibraryListItem(song, index) {
  const qualityClass = getQualityClass(song.quality || 'Unknown');
  const isPlaying = currentTrack && currentTrack.filePath === song.filePath;

  return `
    <div class="library-list-item ${isPlaying ? 'playing' : ''}" data-index="${index}">
      <span class="library-list-number">${isPlaying ? '♪' : index + 1}</span>
      <span class="library-list-title">${song.title || 'Unknown'}</span>
      <span class="library-list-artist">${song.artist || 'Unknown Artist'}</span>
      <span class="library-list-album">${song.album || '—'}</span>
      <span class="library-list-duration">${song.durationFormatted || '0:00'}</span>
      <span class="library-list-quality">
        <span class="result-quality ${qualityClass}" style="font-size: 9px; padding: 2px 6px;">${song.quality || 'Unknown'}</span>
      </span>
    </div>
  `;
}

function toggleLibraryView(mode) {
  libraryViewMode = mode;
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderLibrary();
}

function playLibrarySong(index) {
  const song = library[index];
  if (!song) return;

  if (song.filePath) {
    window.api.getFileInfo(song.filePath).then(response => {
      if (response.success) {
        playLocalFile(song.filePath, {
          title: song.title || response.info.title,
          artist: song.artist || response.info.artist,
          album: song.album || response.info.album,
          quality: song.quality || response.info.quality,
          duration: response.info.duration,
          artwork: response.info.artwork
        });
      }
    });
  }
}

function addToLibrary(songData) {
  window.api.addToLibrary(songData).then(() => {
    loadLibrary();
  });
}

function removeFromLibrary(filePath) {
  window.api.removeFromLibrary(filePath).then(() => {
    loadLibrary();
    showNotification('Removed from library', 'info');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Event delegation for library items
  document.getElementById('libraryContent').addEventListener('click', (e) => {
    const item = e.target.closest('[data-index]');
    if (item) {
      const index = parseInt(item.dataset.index);
      playLibrarySong(index);
    }
  });
});
