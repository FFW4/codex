const EventEmitter = require('events');
const slsk = require('slsk-client');
const fs = require('fs');
const path = require('path');
const os = require('os');

function log(message) {
  const timestamp = new Date().toISOString();
  try {
    const logPath = path.join(process.env.APPDATA || '', 'soulseek-player', 'soulseek-player.log');
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (e) {}
  console.log(message);
}

class SoulSeekClient extends EventEmitter {
  constructor(cachePath) {
    super();
    this.cachePath = cachePath;
    this.client = null;
    this.loggedIn = false;
    this.username = null;
    this.password = null;
    this.activeTransfers = new Map();
    this.downloadsDir = path.join(cachePath, 'downloads');
    this.tmpDir = path.join(os.tmpdir(), 'soulseek-player');
  }

  setCredentials(username, password) {
    this.username = username;
    this.password = password;
  }

  isConnected() {
    return this.loggedIn;
  }

  getUsername() {
    return this.username;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!this.username || !this.password) {
        reject(new Error('No credentials set'));
        return;
      }

      if (this.loggedIn) {
        resolve();
        return;
      }

      // Ensure directories exist
      [this.downloadsDir, this.tmpDir].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      });

      process.env.TMPDIR = this.tmpDir;

      log(`Connecting as: ${this.username}`);

      slsk.connect({
        user: this.username,
        pass: this.password,
        localPort: 0
      }, (err, client) => {
        if (err) {
          log(`Connection failed: ${err.message}`);
          reject(err);
          return;
        }

        this.client = client;
        this.loggedIn = true;
        log('Login successful!');
        this.emit('login-success', { username: this.username });
        resolve({ success: true, username: this.username });
      });
    });
  }

  disconnect() {
    this.loggedIn = false;
    if (this.client) {
      try { slsk.disconnect(); } catch (e) {}
      this.client = null;
    }
  }

  _sanitizeSearchTerm(searchTerm) {
    const includedWords = [];
    const excludedWords = [];
    const partialWords = [];
    const phraseWords = [];

    // Parse search terms - split by spaces but keep quoted phrases together
    const regex = /"([^"]+)"|(\S+)/g;
    let match;
    
    while ((match = regex.exec(searchTerm)) !== null) {
      let word = match[1] || match[2];
      if (!word) continue;

      word = word.toLowerCase();

      // Handle exclusions (-word)
      if (word.startsWith('-') && word.length > 1) {
        const cleanWord = word.slice(1).replace(/[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/g, '');
        if (cleanWord.length >= 2) {
          excludedWords.push(cleanWord);
        }
      }
      // Handle partial matches (*word or word*)
      else if (word.startsWith('*') && word.length > 1) {
        partialWords.push({ type: 'ends', word: word.slice(1) });
      }
      else if (word.endsWith('*') && word.length > 1) {
        partialWords.push({ type: 'starts', word: word.slice(0, -1) });
      }
      // Handle quoted phrases - treat as exact match
      else if (match[1]) {
        phraseWords.push(word);
      }
      else {
        // Regular word - strip punctuation
        const cleanWord = word.replace(/[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/g, '');
        if (cleanWord.length >= 2) {
          includedWords.push(cleanWord);
        }
      }
    }

    return { includedWords, excludedWords, partialWords, phraseWords };
  }

  _matchesSearch(filename, searchTerm) {
    const { includedWords, excludedWords, partialWords, phraseWords } = this._sanitizeSearchTerm(searchTerm);
    const filenameLower = filename.toLowerCase();

    // Check exclusions first - if ANY excluded word is found, reject
    for (const word of excludedWords) {
      if (filenameLower.includes(word)) {
        return false;
      }
    }

    // For phrase matches (quoted), the entire phrase must appear
    for (const phrase of phraseWords) {
      if (!filenameLower.includes(phrase)) {
        return false;
      }
    }

    // For included words, ALL must match (AND logic)
    for (const word of includedWords) {
      if (!filenameLower.includes(word)) {
        return false;
      }
    }

    // Partial words
    for (const item of partialWords) {
      if (item.type === 'starts') {
        if (!filenameLower.startsWith(item.word) && !filenameLower.includes(' ' + item.word)) {
          return false;
        }
      } else if (item.type === 'ends') {
        if (!filenameLower.endsWith(item.word) && !filenameLower.includes(item.word + ' ')) {
          return false;
        }
      }
    }

    // At least one included word or phrase must be present
    return includedWords.length > 0 || phraseWords.length > 0 || partialWords.length > 0;
  }

  search(query) {
    return new Promise((resolve, reject) => {
      if (!this.loggedIn || !this.client) {
        reject(new Error('Not logged in'));
        return;
      }

      log(`Searching: ${query}`);

      const maxResults = 500;
      const results = [];

      this.client.search({
        req: query,
        timeout: 8000
      }, (err, allResults) => {
        if (err) {
          log(`Search error: ${err.message}`);
          reject(err);
          return;
        }

        log(`Received ${allResults.length} results, filtering and processing up to ${maxResults}`);

        // Improved filtering - ALL included words must match, excluded words must NOT match
        const filtered = (allResults || []).filter(r => {
          if (!r.file) return false;
          return this._matchesSearch(r.file, query);
        });

        log(`Filtered to ${filtered.length} relevant results`);

        // Process only the best results (with slots first, then by speed)
        const sorted = filtered
          .sort((a, b) => {
            if (a.slots && !b.slots) return -1;
            if (!a.slots && b.slots) return 1;
            return (b.speed || 0) - (a.speed || 0);
          })
          .slice(0, maxResults);

        for (const r of sorted) {
          const fullPath = r.file || '';
          const parts = fullPath.split('\\');
          const filename = parts[parts.length - 1] || fullPath;
          const ext = path.extname(filename).toLowerCase().replace('.', '');

          const result = {
            username: r.user,
            filename: filename,
            fullFilename: fullPath,
            filesize: r.size || 0,
            extension: ext,
            bitrate: r.bitrate || 0,
            slots: r.slots || false,
            speed: r.speed || 0,
            filePath: fullPath,
            quality: this._getQualityLabel(r.bitrate || 0, 0, ext),
            qualityScore: this._getQualityScore(r.bitrate || 0, 0, ext)
          };

          results.push(result);
          this.emit('search-result', result);
        }

        log(`Processed ${results.length} results`);
        resolve(results);
      });
    });
  }

  _getQualityLabel(bitrate, sampleRate, ext) {
    const lossless = ['flac', 'ape', 'wv', 'aiff', 'wav'];
    if (lossless.includes(ext)) return 'Lossless';
    if (bitrate >= 320) return '320kbps Hi-Quality';
    if (bitrate >= 256) return '256kbps High';
    if (bitrate >= 192) return '192kbps Good';
    if (bitrate >= 128) return '128kbps Standard';
    if (bitrate >= 96) return '96kbps Low';
    if (bitrate > 0) return `${bitrate}kbps`;
    return 'Unknown';
  }

  _getQualityScore(bitrate, sampleRate, ext) {
    const lossless = ['flac', 'ape', 'wv', 'aiff', 'wav'];
    if (lossless.includes(ext)) return 100;
    if (bitrate >= 320) return 90;
    if (bitrate >= 256) return 80;
    if (bitrate >= 192) return 70;
    if (bitrate >= 128) return 60;
    return 30;
  }

  downloadFile(username, remotePath, localDir, filename) {
    return new Promise((resolve, reject) => {
      if (!this.loggedIn || !this.client) {
        reject(new Error('Not logged in'));
        return;
      }

      const transferId = require('crypto').randomBytes(8).toString('hex');
      const destDir = localDir || this.downloadsDir;
      const localPath = path.join(destDir, filename);

      log(`Download: ${filename} from ${username}, transferId: ${transferId}`);

      // Initialize transfer with initial data
      const transfer = {
        id: transferId,
        filename,
        remotePath,
        username,
        fileSize: 0,
        bytesTransferred: 0,
        status: 'downloading',
        localPath
      };
      
      this.activeTransfers.set(transferId, transfer);

      // The slsk-client needs the file object with user and file path
      const fileInfo = {
        user: username,
        file: remotePath
      };

      // Progress callback from slsk-client
      const onProgress = (bytesReceived, totalSize) => {
        transfer.fileSize = totalSize;
        transfer.bytesTransferred = bytesReceived;
        const progressPercent = totalSize > 0 
          ? Math.min(100, Math.round((bytesReceived / totalSize) * 100)) 
          : 0;
        transfer.progress = progressPercent;
        
        this.emit('transfer-progress', {
          id: transferId,
          filename,
          bytesTransferred: bytesReceived,
          fileSize: totalSize,
          progress: progressPercent
        });
      };

      this.client.download({
        file: fileInfo,
        path: localPath,
        onProgress: onProgress
      }, (err, data) => {
        if (err) {
          log(`Download error: ${err.message}`);
          transfer.status = 'error';
          this.emit('transfer-error', { ...transfer, error: err.message });
          this.activeTransfers.delete(transferId);
          reject(err);
          return;
        }

        log(`Download complete: ${filename}`);
        
        // Get final file stats
        let finalSize = 0;
        if (fs.existsSync(localPath)) {
          try {
            const stats = fs.statSync(localPath);
            finalSize = stats.size;
          } catch (e) {}
        }
        
        transfer.status = 'complete';
        transfer.progress = 100;
        transfer.bytesTransferred = finalSize > 0 ? finalSize : transfer.bytesTransferred;
        transfer.fileSize = finalSize > 0 ? finalSize : transfer.fileSize;
        
        this.emit('transfer-complete', transfer);
        this.activeTransfers.delete(transferId);
        resolve(transferId);
      });
    });
  }

  startStream(username, remotePath, cacheDir, filename) {
    return new Promise(async (resolve, reject) => {
      try {
        const streamFile = path.join(cacheDir || this.tmpDir, `stream_${filename}`);
        
        // Download to temp location first
        await this.downloadFile(username, remotePath, cacheDir || this.tmpDir, `stream_${filename}`);

        const http = require('http');
        const server = http.createServer((req, res) => {
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Accept-Ranges', 'bytes');
          if (fs.existsSync(streamFile)) {
            fs.createReadStream(streamFile).pipe(res);
          } else {
            res.statusCode = 404;
            res.end('Not found');
          }
        });

        server.listen(0, '127.0.0.1', () => {
          const port = server.address().port;
          resolve(`http://127.0.0.1:${port}`);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  cancelTransfer(transferId) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      log(`Transfer not found: ${transferId}`);
      return Promise.resolve({ success: false, error: 'Transfer not found' });
    }
    
    log(`Cancelling transfer: ${transferId} - ${transfer.filename}`);
    
    // Use slsk-client's cancelDownload to properly clean up
    if (this.client && typeof this.client.cancelDownload === 'function') {
      try {
        this.client.cancelDownload(transfer.username, transfer.remotePath);
      } catch (e) {
        log(`Error calling client.cancelDownload: ${e.message}`);
      }
    }
    
    // Delete the partial file
    if (transfer.localPath && fs.existsSync(transfer.localPath)) {
      try {
        fs.unlinkSync(transfer.localPath);
        log(`Deleted partial file: ${transfer.localPath}`);
      } catch (e) {
        log(`Error deleting partial file: ${e.message}`);
      }
    }
    
    transfer.status = 'cancelled';
    this.activeTransfers.delete(transferId);
    this.emit('transfer-cancelled', transfer);
    log(`Transfer cancelled: ${transferId}`);
    
    return Promise.resolve({ success: true });
  }

  downloadMultiple(files, localDir) {
    return new Promise((resolve, reject) => {
      if (!this.loggedIn || !this.client) {
        reject(new Error('Not logged in'));
        return;
      }

      const results = [];
      const errors = [];
      const destDir = localDir || this.downloadsDir;
      let completed = 0;

      if (files.length === 0) {
        resolve({ results: [], errors: [] });
        return;
      }

      log(`Queuing ${files.length} files for download`);

      for (const file of files) {
        const transferId = require('crypto').randomBytes(8).toString('hex');
        const localPath = path.join(destDir, file.filename);

        const transfer = {
          id: transferId,
          filename: file.filename,
          remotePath: file.remotePath,
          username: file.username,
          fileSize: 0,
          bytesTransferred: 0,
          status: 'downloading',
          localPath
        };

        this.activeTransfers.set(transferId, transfer);
        log(`Queued: ${file.filename} (${transferId})`);

        const fileInfo = {
          user: file.username,
          file: file.remotePath
        };

        const onProgress = (bytesReceived, totalSize) => {
          transfer.fileSize = totalSize;
          transfer.bytesTransferred = bytesReceived;
          const progressPercent = totalSize > 0
            ? Math.min(100, Math.round((bytesReceived / totalSize) * 100))
            : 0;
          transfer.progress = progressPercent;

          this.emit('transfer-progress', {
            id: transferId,
            filename: file.filename,
            bytesTransferred: bytesReceived,
            fileSize: totalSize,
            progress: progressPercent
          });
        };

        this.client.download({ file: fileInfo, path: localPath, onProgress }, (err, data) => {
          completed++;

          if (err) {
            log(`Download error for ${file.filename}: ${err.message}`);
            transfer.status = 'error';
            this.emit('transfer-error', { ...transfer, error: err.message });
            this.activeTransfers.delete(transferId);
            errors.push({ filename: file.filename, error: err.message });
            results.push({ success: false, filename: file.filename, error: err.message });
          } else {
            log(`Download complete: ${file.filename}`);

            let finalSize = 0;
            if (fs.existsSync(localPath)) {
              try {
                const stats = fs.statSync(localPath);
                finalSize = stats.size;
              } catch (e) {}
            }

            transfer.status = 'complete';
            transfer.progress = 100;
            transfer.fileSize = finalSize > 0 ? finalSize : transfer.fileSize;
            transfer.bytesTransferred = finalSize > 0 ? finalSize : transfer.bytesTransferred;

            this.emit('transfer-complete', transfer);
            this.activeTransfers.delete(transferId);
            results.push({ success: true, filename: file.filename, transferId });
          }

          if (completed === files.length) {
            log(`Batch download complete: ${results.filter(r => r.success).length} succeeded, ${errors.length} failed`);
            resolve({ results, errors });
          }
        });
      }
    });
  }

  getActiveTransfers() {
    return this.activeTransfers;
  }
}

module.exports = SoulSeekClient;
