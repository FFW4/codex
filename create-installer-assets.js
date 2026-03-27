const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'public');

async function createInstallerAssets() {
  const cyan = '#0AFAFF';
  const magenta = '#FF0080';
  const bg = '#0A0A12';
  
  // Header image (150x57)
  const headerWidth = 150;
  const headerHeight = 57;
  const header = sharp({
    create: {
      width: headerWidth,
      height: headerHeight,
      channels: 4,
      background: { r: 10, g: 10, b: 18, alpha: 1 }
    }
  })
    .png();
  
  // Create a simple header with text effect
  const headerBuffer = await sharp({
    create: {
      width: headerWidth,
      height: headerHeight,
      channels: 4,
      background: { r: 10, g: 10, b: 18, alpha: 1 }
    }
  })
    .composite([{
      input: Buffer.from(`<svg width="${headerWidth}" height="${headerHeight}">
        <rect x="0" y="0" width="${headerWidth}" height="${headerHeight}" fill="#0A0A12"/>
        <rect x="0" y="0" width="${headerWidth}" height="2" fill="#0AFAFF"/>
        <rect x="0" y="${headerHeight-2}" width="${headerWidth}" height="2" fill="#0AFAFF"/>
        <text x="10" y="38" font-family="Consolas, monospace" font-size="16" font-weight="bold" fill="#0AFAFF">CODEX</text>
      </svg>`),
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();
  
  fs.writeFileSync(path.join(outputDir, 'installer-header.png'), headerBuffer);
  console.log('Created installer-header.png');
  
  // Sidebar image (164x314)
  const sidebarWidth = 164;
  const sidebarHeight = 314;
  const sidebarBuffer = await sharp({
    create: {
      width: sidebarWidth,
      height: sidebarHeight,
      channels: 4,
      background: { r: 10, g: 10, b: 18, alpha: 1 }
    }
  })
    .composite([{
      input: Buffer.from(`<svg width="${sidebarWidth}" height="${sidebarHeight}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#0AFAFF;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FF0080;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${sidebarWidth}" height="${sidebarHeight}" fill="#0A0A12"/>
        <rect x="0" y="0" width="3" height="${sidebarHeight}" fill="url(#grad)"/>
        <polygon points="82,80 40,140 82,200 124,140" fill="none" stroke="#0AFAFF" stroke-width="2"/>
        <polygon points="82,100 60,130 82,160 104,130" fill="#0AFAFF" opacity="0.3"/>
        <circle cx="82" cy="130" r="10" fill="#0AFAFF"/>
        <text x="10" y="260" font-family="Consolas, monospace" font-size="12" font-weight="bold" fill="#0AFAFF">CODEX</text>
        <text x="10" y="280" font-family="Consolas, monospace" font-size="8" fill="#FF0080">v1.0.0</text>
      </svg>`),
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();
  
  fs.writeFileSync(path.join(outputDir, 'installer-sidebar.bmp'), sidebarBuffer);
  console.log('Created installer-sidebar.bmp');
  
  console.log('Installer assets created successfully!');
}

createInstallerAssets().catch(console.error);
