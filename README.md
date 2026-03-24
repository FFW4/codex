# CODEX

A music player built with Electron.

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

