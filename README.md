# CODEX
<img width="1920" height="1080" alt="Untitled" src="https://github.com/user-attachments/assets/62e8f479-acff-462e-9ab5-2dd9689e48eb" />

A music player and downloader lossless quality built with Electron .

MP3 - 320kbps VBR 256kbps 192kbps 128kbps
FLAC - Lossless

## Features

- **SoulSeek Integration** - Search and download music directly from the SoulSeek network
- **Music Library** - Auto-scans your download folder and builds a local library
- **Audio Player** - Play downloaded music with streaming support
- **V-Tech Aesthetic** - Dark theme with cyan/magenta accents, angular UI elements, and glowing effects

## Tech Stack

- Electron
- slsk-client (SoulSeek protocol)
- music-metadata (audio file analysis)
- electron-store (credential storage)

## Setup

```bash
npm install
npm start
```

On first launch, enter your SoulSeek credentials. They will be securely stored locally.

## Download Folder

By default, music downloads to `C:\Users\<username>\Music\SoulSeek`. You can change this in the app settings.

