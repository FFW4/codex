# CODEX
<img width="1920" height="1080" alt="Untitled" src="https://github.com/user-attachments/assets/62e8f479-acff-462e-9ab5-2dd9689e48eb" />

A music player and downloader for lossless quality built with Electron.

## Supported Formats

- **MP3** - 320kbps, VBR, 256kbps, 192kbps, 128kbps
- **FLAC** - Lossless

## Features

- **SoulSeek Integration** - Search and download music directly from the SoulSeek network
- **Music Library** - Auto-scans your download folder and builds a local library with search
- **Audio Player** - Play downloaded music with streaming support
- **Playlist Support** - Create and manage playlists
- **Shuffle & Repeat** - Randomized playback and repeat modes
- **V-Tech Aesthetic** - Dark theme with cyan/magenta accents, angular UI elements, and glowing effects

## Tech Stack

- Electron
- slsk-client (SoulSeek protocol)
- music-metadata (audio file analysis)
- electron-store (credential storage)

## Installation

### Pre-built Installers
Download the latest release from [GitHub Releases](https://github.com/FFW4/codex/releases).

### Development Setup

```bash
# Clone the repository
git clone https://github.com/FFW4/codex.git

# Navigate to project directory
cd codex

# Install dependencies
npm install

# Start in development mode
npm run dev
```

## Usage

1. Launch the application
2. Enter your SoulSeek credentials on first launch (credentials are stored securely locally)
3. Search for music using the search bar
4. Download songs or stream directly
5. Downloaded songs are automatically added to your library

## Download Folder

By default, music downloads to `C:\Users\<username>\Music\SoulSeek`. You can change this in the app settings.

## Keyboard Shortcuts

- **Space** - Play/Pause
- **Left Arrow** - Seek backward 5 seconds
- **Right Arrow** - Seek forward 5 seconds
- **Up Arrow** - Volume up
- **Down Arrow** - Volume down
- **M** - Mute/Unmute

## Building

```bash
# Build Windows installer
npm run build:win:nsis

# Build portable version
npm run build:win:portable
```

## License

Copyright © 2024 FRAGUAR