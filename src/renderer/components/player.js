let audioPlayer = document.getElementById('audioPlayer');
let currentTrack = null;
let isPlaying = false;
let volume = 75;
let isMuted = false;
let previousVolume = 75;
let shuffle = false;
let repeat = 'off';
window.playlist = [];
window.currentPlaylistIndex = -1;

function initPlayer() {
  audioPlayer.volume = volume / 100;
  updateVolumeUI();

  audioPlayer.addEventListener('timeupdate', updateProgress);
  audioPlayer.addEventListener('loadedmetadata', onMetadataLoaded);
  audioPlayer.addEventListener('ended', onTrackEnded);
  audioPlayer.addEventListener('error', onPlayerError);
  audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    updatePlayPauseButton();
  });
  audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayPauseButton();
  });

  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      if (audioPlayer.duration) {
        audioPlayer.currentTime = percent * audioPlayer.duration;
      }
    });
  }
}

function playFromUrl(url, trackInfo) {
  currentTrack = {
    ...trackInfo,
    url: url,
    isStream: true
  };

  audioPlayer.src = url;
  audioPlayer.load();
  audioPlayer.play().catch(err => {
    console.error('Playback failed:', err);
    showNotification('Playback failed', 'error');
  });

  updateNowPlaying(trackInfo);
  updateQualityBadge(trackInfo.quality);
}

function playLocalFile(filePath, trackInfo) {
  currentTrack = {
    ...trackInfo,
    filePath: filePath,
    isStream: false
  };

  audioPlayer.src = `file://${filePath}`;
  audioPlayer.load();
  audioPlayer.play().catch(err => {
    console.error('Playback failed:', err);
    showNotification('Playback failed', 'error');
  });

  updateNowPlaying(trackInfo);
  updateQualityBadge(trackInfo.quality);
}

function togglePlayPause() {
  if (!currentTrack) return;

  if (isPlaying) {
    audioPlayer.pause();
  } else {
    audioPlayer.play().catch(err => {
      console.error('Playback failed:', err);
    });
  }
}

function previousTrack() {
  if (audioPlayer.currentTime > 3) {
    audioPlayer.currentTime = 0;
    return;
  }

  if (window.playlist.length > 0) {
    if (shuffle) {
      window.currentPlaylistIndex = Math.floor(Math.random() * window.playlist.length);
    } else {
      window.currentPlaylistIndex = (window.currentPlaylistIndex - 1 + window.playlist.length) % window.playlist.length;
    }
    playFromPlaylist(window.currentPlaylistIndex);
  }
}

function nextTrack() {
  if (window.playlist.length > 0) {
    if (shuffle) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * window.playlist.length);
      } while (nextIndex === window.currentPlaylistIndex && window.playlist.length > 1);
      window.currentPlaylistIndex = nextIndex;
    } else {
      window.currentPlaylistIndex = (window.currentPlaylistIndex + 1) % window.playlist.length;
    }
    playFromPlaylist(window.currentPlaylistIndex);
  }
}

function playFromPlaylist(index) {
  if (index < 0 || index >= window.playlist.length) return;
  const track = window.playlist[index];
  window.currentPlaylistIndex = index;

  if (track.filePath) {
    playLocalFile(track.filePath, track);
  } else if (track.url) {
    playFromUrl(track.url, track);
  }
}

function updateProgress() {
  const current = audioPlayer.currentTime;
  const duration = audioPlayer.duration || 0;
  const percent = duration > 0 ? (current / duration) * 100 : 0;

  const progressFill = document.getElementById('progressFill');
  const currentTimeEl = document.getElementById('currentTime');

  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }
  if (currentTimeEl) {
    currentTimeEl.textContent = formatDuration(current);
  }
}

function onMetadataLoaded() {
  const duration = audioPlayer.duration;
  const totalTimeEl = document.getElementById('totalTime');
  if (totalTimeEl) {
    totalTimeEl.textContent = formatDuration(duration);
  }

  if (currentTrack && currentTrack.duration !== duration) {
    currentTrack.duration = duration;
    currentTrack.durationFormatted = formatDuration(duration);
  }
}

function onTrackEnded() {
  if (repeat === 'one') {
    audioPlayer.currentTime = 0;
    audioPlayer.play();
  } else if (window.playlist.length > 0) {
    if (shuffle || repeat === 'all' || window.currentPlaylistIndex < window.playlist.length - 1) {
      nextTrack();
    } else {
      isPlaying = false;
      updatePlayPauseButton();
    }
  }
}

function onPlayerError(e) {
  console.error('Player error:', e);
  showNotification('Error playing track', 'error');
}

function updateNowPlaying(trackInfo) {
  const titleEl = document.getElementById('nowPlayingTitle');
  const artistEl = document.getElementById('nowPlayingArtist');
  const artEl = document.getElementById('albumArt');

  if (titleEl) {
    titleEl.textContent = trackInfo.title || 'Unknown';
  }
  if (artistEl) {
    artistEl.textContent = trackInfo.artist || 'Unknown Artist';
  }
  if (artEl) {
    let artworkSrc = '';
    if (trackInfo.artwork && trackInfo.hasArtwork !== false) {
      artworkSrc = window.artworkUtils?.getFullArtworkUrl(trackInfo) || '';
    }
    
    if (artworkSrc) {
      artEl.innerHTML = `<img src="${artworkSrc}" alt="Album Art">`;
      artEl.classList.add('has-artwork');
    } else {
      artEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
        </svg>
      `;
      artEl.classList.remove('has-artwork');
    }
  }

  document.title = `${trackInfo.title || 'CODEX'} - CODEX`;
}

function updatePlayPauseButton() {
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');

  if (isPlaying) {
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';
  } else {
    if (playIcon) playIcon.style.display = 'block';
    if (pauseIcon) pauseIcon.style.display = 'none';
  }
}

function updateQualityBadge(quality) {
  const badge = document.getElementById('qualityBadge');
  if (!badge) return;

  const qualityClass = getQualityClass(quality || 'Unknown');
  badge.textContent = quality || 'Unknown';
  badge.className = `quality-badge ${qualityClass}`;
}

function setVolume(value) {
  volume = parseInt(value);
  audioPlayer.volume = volume / 100;
  isMuted = volume === 0;
  updateVolumeUI();
}

function toggleMute() {
  if (isMuted) {
    volume = previousVolume;
    isMuted = false;
  } else {
    previousVolume = volume;
    volume = 0;
    isMuted = true;
  }
  audioPlayer.volume = volume / 100;
  updateVolumeUI();
}

function updateVolumeUI() {
  const volumeFill = document.getElementById('volumeFill');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeIcon = document.getElementById('volumeIcon');
  const muteIcon = document.getElementById('muteIcon');
  const volumeValue = document.getElementById('volumeValue');

  if (volumeFill) {
    volumeFill.style.width = `${volume}%`;
  }
  if (volumeSlider) {
    volumeSlider.value = volume;
  }
  if (volumeValue) {
    volumeValue.textContent = `${volume}%`;
  }

  if (volumeIcon && muteIcon) {
    if (isMuted || volume === 0) {
      volumeIcon.style.display = 'none';
      muteIcon.style.display = 'block';
    } else {
      volumeIcon.style.display = 'block';
      muteIcon.style.display = 'none';
    }
  }
}

function toggleShuffle() {
  shuffle = !shuffle;
  const btn = document.getElementById('shuffleBtn');
  if (btn) {
    btn.classList.toggle('active', shuffle);
  }
}

function toggleRepeat() {
  const modes = ['off', 'all', 'one'];
  const currentIndex = modes.indexOf(repeat);
  repeat = modes[(currentIndex + 1) % modes.length];

  const btn = document.getElementById('repeatBtn');
  const indicator = document.getElementById('repeatIndicator');
  if (btn) {
    btn.classList.toggle('active', repeat !== 'off');
    btn.title = `Repeat: ${repeat}`;
  }
  if (indicator) {
    indicator.style.display = repeat === 'one' ? 'block' : 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPlayer();
});
