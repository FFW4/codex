let playlists = [];
let selectedPlaylist = null;

async function loadPlaylists() {
  try {
    playlists = await window.api.getPlaylists() || [];
    renderPlaylists();
  } catch (error) {
    console.error('Failed to load playlists:', error);
  }
}

function renderPlaylists() {
  const container = document.getElementById('playlistsContent');
  
  if (playlists.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="80" height="80">
          <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1" opacity="0.3"/>
          <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1" opacity="0.3"/>
          <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="1" opacity="0.3"/>
        </svg>
        <p class="empty-text">No playlists yet. Create one to organize your music.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="playlists-grid">
      ${playlists.map((playlist, index) => renderPlaylistCard(playlist, index)).join('')}
    </div>
  `;
}

function renderPlaylistCard(playlist, index) {
  const songCount = playlist.songs ? playlist.songs.length : 0;
  const hasArtwork = playlist.songs && playlist.songs.length > 0 && playlist.songs[0].artwork && playlist.songs[0].artwork.data;
  
  let artworkSrc = '';
  if (hasArtwork) {
    const base64Data = typeof playlist.songs[0].artwork.data === 'string' 
      ? playlist.songs[0].artwork.data 
      : '';
    artworkSrc = `data:${playlist.songs[0].artwork.format};base64,${base64Data}`;
  }
  
  return `
    <div class="playlist-card" data-index="${index}">
      <div class="playlist-card-art ${hasArtwork ? 'has-artwork' : ''}">
        ${hasArtwork && artworkSrc
          ? `<img src="${artworkSrc}" alt="Playlist Art">`
          : `<div class="playlist-card-default-art">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
              </svg>
            </div>`
        }
        <div class="playlist-card-overlay">
          <button class="playlist-play-btn">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <polygon points="5,3 19,12 5,21" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="playlist-card-info">
        <div class="playlist-card-title">${playlist.name}</div>
        <div class="playlist-card-meta">${songCount} song${songCount !== 1 ? 's' : ''}</div>
      </div>
      <button class="playlist-card-delete" data-delete="${playlist.id}" title="Delete Playlist">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;
}

function createPlaylist(name, songs = []) {
  const newPlaylist = {
    id: 'playlist_' + Date.now(),
    name: name,
    songs: songs,
    createdAt: new Date().toISOString()
  };
  
  window.api.savePlaylist(newPlaylist).then(() => {
    playlists.push(newPlaylist);
    renderPlaylists();
    if (songs.length > 0) {
      showNotification(`Created "${name}" with 1 song`, 'success');
    } else {
      showNotification(`Playlist "${name}" created`, 'success');
    }
  });
}

function deletePlaylist(playlistId) {
  window.api.deletePlaylist(playlistId).then(() => {
    playlists = playlists.filter(p => p.id !== playlistId);
    renderPlaylists();
    showNotification('Playlist deleted', 'info');
  });
}

function playPlaylist(index) {
  const playlist = playlists[index];
  if (!playlist || !playlist.songs || playlist.songs.length === 0) return;
  
  currentPlaylist = 'playlist_' + index;
  currentPlaylistSongs = playlist.songs;
  playFromPlaylist(0);
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('playlistsContent');
  if (container) {
    container.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('[data-delete]');
      if (deleteBtn) {
        e.stopPropagation();
        deletePlaylist(deleteBtn.dataset.delete);
        return;
      }
      
      const card = e.target.closest('.playlist-card');
      if (card) {
        const index = parseInt(card.dataset.index);
        playPlaylist(index);
      }
    });
  }
  
  const createBtn = document.getElementById('createPlaylistBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      document.getElementById('newPlaylistSongData').value = '';
      document.getElementById('createPlaylistModal').classList.add('active');
      document.getElementById('playlistNameInput').focus();
    });
  }
  
  const cancelBtn = document.getElementById('cancelPlaylistBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('createPlaylistModal').classList.remove('active');
      document.getElementById('playlistNameInput').value = '';
      document.getElementById('newPlaylistSongData').value = '';
    });
  }
  
  const closeAddBtn = document.getElementById('closeAddToPlaylistBtn');
  if (closeAddBtn) {
    closeAddBtn.addEventListener('click', () => {
      document.getElementById('addToPlaylistModal').classList.remove('active');
    });
  }
  
  const form = document.getElementById('createPlaylistForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('playlistNameInput');
      const songDataInput = document.getElementById('newPlaylistSongData');
      const name = nameInput.value.trim();
      if (name) {
        let songs = [];
        if (songDataInput.value) {
          try {
            songs = [JSON.parse(songDataInput.value)];
          } catch (e) {}
        }
        createPlaylist(name, songs);
        document.getElementById('createPlaylistModal').classList.remove('active');
        nameInput.value = '';
        songDataInput.value = '';
      }
    });
  }
  
  const modal = document.getElementById('createPlaylistModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'createPlaylistModal') {
        document.getElementById('createPlaylistModal').classList.remove('active');
        document.getElementById('playlistNameInput').value = '';
        document.getElementById('newPlaylistSongData').value = '';
      }
    });
  }
});
