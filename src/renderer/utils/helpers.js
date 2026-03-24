function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getQualityClass(quality) {
  const q = quality.toLowerCase();
  if (q.includes('lossless')) return 'lossless';
  if (q.includes('hi-quality') || q.includes('320')) return 'hi-quality';
  if (q.includes('high') || q.includes('256')) return 'high';
  if (q.includes('good') || q.includes('192')) return 'good';
  if (q.includes('standard') || q.includes('128')) return 'standard';
  return 'low';
}

function parseFilename(filename) {
  const name = filename.replace(/\.[^/.]+$/, '');
  const patterns = [
    /^(.+?)\s*-\s*(.+?)\s*\(/,
    /^(.+?)\s*-\s*(.+?)\s*\[/,
    /^(.+?)\s*-\s*(.+?)$/,
    /^(.+?)\s*_\s*(.+?)$/
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return { artist: match[1].trim(), title: match[2].trim() };
    }
  }

  return { artist: 'Unknown Artist', title: name };
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 24px;
    padding: 12px 20px;
    background: ${type === 'error' ? 'var(--quality-low)' : type === 'success' ? 'var(--quality-lossless)' : 'var(--bg-elevated)'};
    color: white;
    border-radius: var(--radius-md);
    font-size: 13px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);
