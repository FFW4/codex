const MAX_CACHE_SIZE = 500;
const CACHE_CLEANUP_MS = 30000;
const THUMBNAIL_SIZE = 1024;

const artworkCache = new Map();
let cleanupInterval = null;

function getCacheKey(song) {
  return song.filePath || song.filename || `artwork_${Math.random()}`;
}

function convertBase64ToImage(base64Data) {
  if (!base64Data) return null;
  try {
    const base64 = typeof base64Data === 'string' ? base64Data : arrayBufferToBase64(base64Data);
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    return image;
  } catch (e) {
    console.error('Failed to convert base64 to image:', e);
    return null;
  }
}

function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function generateThumbnail(canvas, originalWidth, originalHeight) {
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = THUMBNAIL_SIZE;
  thumbCanvas.height = THUMBNAIL_SIZE;
  const ctx = thumbCanvas.getContext('2d');

  const size = Math.min(originalWidth, originalHeight);
  const x = (originalWidth - size) / 2;
  const y = (originalHeight - size) / 2;

  ctx.drawImage(canvas, x, y, size, size, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  return thumbCanvas.toDataURL('image/jpeg', 0.7);
}

function generateFullRes(canvas) {
  return canvas.toDataURL('image/jpeg', 0.9);
}

function getThumbnailUrl(song) {
  if (!song || !song.hasArtwork || !song.artwork || !song.artwork.data) {
    return null;
  }

  const key = getCacheKey(song);
  
  if (artworkCache.has(key)) {
    const cached = artworkCache.get(key);
    cached.timestamp = Date.now();
    return cached.thumb;
  }

  if (artworkCache.size >= MAX_CACHE_SIZE) {
    evictOldestEntry();
  }

  try {
    const base64 = typeof song.artwork.data === 'string' 
      ? song.artwork.data 
      : arrayBufferToBase64(song.artwork.data);
    
    const img = new Image();
    img.src = `data:${song.artwork.format || 'image/jpeg'};base64,${base64}`;
    
    if (img.complete && img.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      const thumb = generateThumbnail(canvas, img.naturalWidth, img.naturalHeight);
      const full = generateFullRes(canvas);
      
      artworkCache.set(key, { thumb, full, timestamp: Date.now() });
      return thumb;
    } else {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const thumb = generateThumbnail(canvas, img.naturalWidth, img.naturalHeight);
        const full = generateFullRes(canvas);
        
        artworkCache.set(key, { thumb, full, timestamp: Date.now() });
        
        const event = new CustomEvent('artwork-ready', { detail: { key, thumb, full } });
        window.dispatchEvent(event);
      };
      return null;
    }
  } catch (e) {
    console.error('Failed to generate thumbnail:', e);
    return null;
  }
}

function getFullArtworkUrl(song) {
  if (!song || !song.hasArtwork || !song.artwork || !song.artwork.data) {
    return null;
  }

  const key = getCacheKey(song);
  
  if (artworkCache.has(key)) {
    const cached = artworkCache.get(key);
    cached.timestamp = Date.now();
    return cached.full;
  }

  if (artworkCache.size >= MAX_CACHE_SIZE) {
    evictOldestEntry();
  }

  try {
    const base64 = typeof song.artwork.data === 'string' 
      ? song.artwork.data 
      : arrayBufferToBase64(song.artwork.data);
    
    const url = `data:${song.artwork.format || 'image/jpeg'};base64,${base64}`;
    
    const img = new Image();
    img.src = url;
    
    if (img.complete && img.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      const thumb = generateThumbnail(canvas, img.naturalWidth, img.naturalHeight);
      const full = generateFullRes(canvas);
      
      artworkCache.set(key, { thumb, full, timestamp: Date.now() });
      return full;
    } else {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const thumb = generateThumbnail(canvas, img.naturalWidth, img.naturalHeight);
        const full = generateFullRes(canvas);
        
        artworkCache.set(key, { thumb, full, timestamp: Date.now() });
        
        const event = new CustomEvent('artwork-ready', { detail: { key, thumb, full } });
        window.dispatchEvent(event);
      };
      return url;
    }
  } catch (e) {
    console.error('Failed to generate full artwork:', e);
    return null;
  }
}

function evictOldestEntry() {
  let oldestKey = null;
  let oldestTime = Infinity;
  
  for (const [key, value] of artworkCache) {
    if (value.timestamp < oldestTime) {
      oldestTime = value.timestamp;
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    artworkCache.delete(oldestKey);
  }
}

function cleanupStaleArtwork() {
  const now = Date.now();
  for (const [key, value] of artworkCache) {
    if (now - value.timestamp > CACHE_CLEANUP_MS) {
      artworkCache.delete(key);
    }
  }
}

function clearArtworkCache() {
  artworkCache.clear();
}

function startCleanupInterval() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupStaleArtwork, CACHE_CLEANUP_MS);
}

function stopCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

function getCacheStats() {
  return {
    size: artworkCache.size,
    maxSize: MAX_CACHE_SIZE,
    cleanupMs: CACHE_CLEANUP_MS
  };
}

startCleanupInterval();

window.artworkUtils = {
  getThumbnailUrl,
  getFullArtworkUrl,
  cleanupStaleArtwork,
  clearArtworkCache,
  getCacheStats,
  stopCleanupInterval
};
