const mm = require('music-metadata');
const path = require('path');
const fs = require('fs');

class AudioAnalyzer {
  async getFileInfo(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      const metadata = await mm.parseFile(filePath);

      const format = metadata.format;
      const quality = this._determineQuality(format, ext);
      const duration = format.duration || 0;

      let artwork = null;
      let hasArtwork = false;
      
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        hasArtwork = true;
        // Convert Buffer to base64 for IPC transfer
        const base64Data = Buffer.from(pic.data).toString('base64');
        artwork = {
          format: pic.format,
          type: pic.type,
          description: pic.description,
          data: base64Data
        };
      }

      return {
        title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
        artist: metadata.common.artist || 'Unknown Artist',
        album: metadata.common.album || 'Unknown Album',
        genre: metadata.common.genre ? metadata.common.genre.join(', ') : 'Unknown',
        year: metadata.common.year,
        format: ext.toUpperCase(),
        codec: format.codec || ext.toUpperCase(),
        bitrate: format.bitrate || 0,
        sampleRate: format.sampleRate || 0,
        channels: format.numberOfChannels || 0,
        duration,
        durationFormatted: this._formatDuration(duration),
        fileSize: stats.size,
        fileSizeFormatted: this._formatFileSize(stats.size),
        quality,
        qualityScore: this._getQualityScore(format, ext),
        hasArtwork,
        artwork,
        waveform: null,
        peaks: null
      };
    } catch (error) {
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      return {
        title: path.basename(filePath, path.extname(filePath)),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        format: ext.toUpperCase(),
        codec: ext.toUpperCase(),
        bitrate: 0,
        sampleRate: 0,
        channels: 0,
        duration: 0,
        durationFormatted: '0:00',
        fileSize: fs.statSync(filePath).size,
        fileSizeFormatted: this._formatFileSize(fs.statSync(filePath).size),
        quality: 'Unknown',
        qualityScore: 0,
        hasArtwork: false
      };
    }
  }

  _determineQuality(format, ext) {
    if (['flac', 'ape', 'wv', 'aiff', 'wav'].includes(ext)) {
      if (format.bitrate && format.bitrate > 0) {
        return `Lossless (${(format.bitrate / 1000).toFixed(0)}kbps)`;
      }
      if (format.sampleRate && format.sampleRate >= 44100) {
        return `Lossless (${(format.sampleRate / 1000).toFixed(1)}kHz/${format.bitsPerSample || 16}bit)`;
      }
      return 'Lossless';
    }

    if (format.bitrate) {
      const kbps = Math.round(format.bitrate / 1000);
      if (kbps >= 320) return `${kbps}kbps (Hi-Quality)`;
      if (kbps >= 256) return `${kbps}kbps (High)`;
      if (kbps >= 192) return `${kbps}kbps (Good)`;
      if (kbps >= 128) return `${kbps}kbps (Standard)`;
      return `${kbps}kbps (Low)`;
    }

    return 'Unknown';
  }

  _getQualityScore(format, ext) {
    if (['flac', 'ape', 'wv'].includes(ext)) return 100;
    if (['aiff', 'wav'].includes(ext)) return 95;
    if (format.bitrate >= 320) return 90;
    if (format.bitrate >= 256) return 80;
    if (format.bitrate >= 192) return 70;
    if (format.bitrate >= 128) return 60;
    if (format.bitrate >= 96) return 40;
    if (format.bitrate > 0) return 30;
    return 20;
  }

  _formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

module.exports = { AudioAnalyzer };
