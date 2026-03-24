let library = [];
let libraryViewMode = 'grid';
let libraryVirtualList = null;
const VIRTUAL_THRESHOLD = 50;

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
  if (libraryVirtualList) {
    libraryVirtualList.destroy();
    libraryVirtualList = null;
  }
  
  container.innerHTML = '<div class="library-grid" id="libraryGridContainer"></div>';
  const gridContainer = document.getElementById('libraryGridContainer');
  
  let html = '';
  library.forEach((song, index) => {
    html += renderLibraryGridItem(song, index);
  });
  gridContainer.innerHTML = html;
}

function renderLibraryGridItem(song, index) {
  const qualityClass = getQualityClass(song.quality || 'Unknown');
  let artworkSrc = '';
  
  if (song.hasArtwork && song.artwork) {
    artworkSrc = window.artworkUtils?.getThumbnailUrl(song) || '';
  }

  return `
    <div class="library-item" data-index="${index}">
      <div class="library-item-art ${artworkSrc ? 'has-artwork' : ''}">
        ${artworkSrc
          ? `<img src="${artworkSrc}" alt="Album Art" loading="lazy">`
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
        <div class="library-item-actions">
          <button class="library-action-btn add-to-playlist" data-action="add" title="Add to Playlist">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
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
  if (libraryVirtualList) {
    libraryVirtualList.destroy();
    libraryVirtualList = null;
  }
  
  container.innerHTML = `
    <div class="library-list" id="libraryListContainer">
      <div class="library-list-item library-list-header" style="background: var(--bg-tertiary); border: none;">
        <span class="library-list-number">#</span>
        <span class="library-list-title" style="color: var(--text-muted); font-weight: 500;">Title</span>
        <span class="library-list-artist" style="color: var(--text-muted);">Artist</span>
        <span class="library-list-album" style="color: var(--text-muted);">Album</span>
        <span class="library-list-duration" style="color: var(--text-muted);">Duration</span>
        <span class="library-list-quality" style="color: var(--text-muted);">Quality</span>
      </div>
      <div id="libraryListItems"></div>
    </div>
  `;
  
  const listContainer = document.getElementById('libraryListItems');
  
  if (library.length > VIRTUAL_THRESHOLD) {
    libraryVirtualList = new VirtualList(listContainer, {
      itemHeight: 50,
      bufferSize: 5,
      useVirtual: true
    });
    
    libraryVirtualList.renderItem = (song, index) => {
      return renderLibraryListItem(song, index);
    };
    
    libraryVirtualList.setItems(library.map((song, index) => ({ song, index })));
  } else {
    let html = '';
    library.forEach((song, index) => {
      html += renderLibraryListItem(song, index);
    });
    listContainer.innerHTML = html;
  }
}

function renderLibraryListItem(item, index) {
  const song = item.song || item;
  const idx = item.index !== undefined ? item.index : index;
  const qualityClass = getQualityClass(song.quality || 'Unknown');
  const isPlaying = window.currentTrack && window.currentTrack.filePath === song.filePath;

  return `
    <div class="library-list-item ${isPlaying ? 'playing' : ''}" data-index="${idx}">
      <span class="library-list-number">${isPlaying ? '♪' : idx + 1}</span>
      <span class="library-list-title">${song.title || 'Unknown'}</span>
      <span class="library-list-artist">${song.artist || 'Unknown Artist'}</span>
      <span class="library-list-album">${song.album || '—'}</span>
      <span class="library-list-duration">${song.durationFormatted || '0:00'}</span>
      <span class="library-list-quality">
        <span class="result-quality ${qualityClass}" style="font-size: 9px; padding: 2px 6px;">${song.quality || 'Unknown'}</span>
      </span>
      <div class="library-list-actions">
        <button class="library-list-action-btn add-to-playlist" data-action="add" title="Add to Playlist">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
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

function showAddToPlaylistModal(song) {
  const modal = document.getElementById('addToPlaylistModal');
  const content = document.getElementById('addToPlaylistContent');
  
  window.api.getPlaylists().then(playlists => {
    let html = `
      <div class="add-to-playlist-header">
        <span class="add-to-playlist-song">${song.title || 'Unknown'}</span>
        <span class="add-to-playlist-artist">${song.artist || 'Unknown Artist'}</span>
      </div>
      <div class="add-to-playlist-list">
        <button class="add-to-playlist-item create-new" id="createPlaylistWithSong">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Create new playlist</span>
        </button>
    `;
    
    if (playlists && playlists.length > 0) {
      playlists.forEach(playlist => {
        html += `
          <button class="add-to-playlist-item" data-playlist-id="${playlist.id}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
            </svg>
            <span>${playlist.name}</span>
            <span class="add-to-playlist-count">${playlist.songs ? playlist.songs.length : 0}</span>
          </button>
        `;
      });
    }
    
    html += '</div>';
    content.innerHTML = html;
    
    content.querySelectorAll('.add-to-playlist-item[data-playlist-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const playlistId = btn.dataset.playlistId;
        addSongToPlaylist(playlistId, song);
        modal.classList.remove('active');
      });
    });
    
    document.getElementById('createPlaylistWithSong').addEventListener('click', () => {
      modal.classList.remove('active');
      document.getElementById('newPlaylistSongData').value = JSON.stringify(song);
      document.getElementById('createPlaylistModal').classList.add('active');
      document.getElementById('playlistNameInput').focus();
    });
  });
  
  modal.classList.add('active');
}

function addSongToPlaylist(playlistId, song) {
  window.api.getPlaylists().then(playlists => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist) {
      if (!playlist.songs) playlist.songs = [];
      const exists = playlist.songs.some(s => s.filePath === song.filePath);
      if (!exists) {
        playlist.songs.push(song);
        window.api.savePlaylist(playlist).then(() => {
          showNotification(`Added to "${playlist.name}"`, 'success');
        });
      } else {
        showNotification('Song already in playlist', 'info');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('libraryContent').addEventListener('click', (e) => {
    const addBtn = e.target.closest('.add-to-playlist');
    if (addBtn) {
      e.stopPropagation();
      const item = addBtn.closest('[data-index]');
      if (item) {
        const index = parseInt(item.dataset.index);
        showAddToPlaylistModal(library[index]);
      }
      return;
    }
    
    const item = e.target.closest('[data-index]');
    if (item) {
      const index = parseInt(item.dataset.index);
      playLibrarySong(index);
    }
  });
  
  const addModal = document.getElementById('addToPlaylistModal');
  if (addModal) {
    addModal.addEventListener('click', (e) => {
      if (e.target.id === 'addToPlaylistModal') {
        addModal.classList.remove('active');
      }
    });
  }
});
