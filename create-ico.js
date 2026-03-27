const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, 'public', 'icon.png');
const icoPath = path.join(__dirname, 'public', 'icon.ico');

async function convertToIco() {
  try {
    const pngBuffer = await sharp(pngPath)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    const sizes = [16, 32, 48, 64, 128, 256];
    const images = [];
    
    for (const size of sizes) {
      const resized = await sharp(pngBuffer)
        .resize(size, size, { fit: 'contain' })
        .png()
        .toBuffer();
      images.push({ size, buffer: resized });
    }
    
    const headerSize = 6;
    const dirEntrySize = 16;
    const dirSize = headerSize + (dirEntrySize * images.length);
    
    let dataOffset = dirSize;
    const offsets = [];
    let totalDataSize = 0;
    
    for (const img of images) {
      offsets.push(dataOffset);
      totalDataSize += img.buffer.length;
      dataOffset += img.buffer.length;
    }
    
    const icoBuffer = Buffer.alloc(dirSize + totalDataSize);
    let offset = 0;
    
    icoBuffer.writeUInt16LE(0, offset); offset += 2;
    icoBuffer.writeUInt16LE(1, offset); offset += 2;
    icoBuffer.writeUInt16LE(images.length, offset); offset += 2;
    
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const size = img.size >= 256 ? 0 : img.size;
      
      icoBuffer.writeUInt8(size, offset); offset += 1;
      icoBuffer.writeUInt8(size, offset); offset += 1;
      icoBuffer.writeUInt8(0, offset); offset += 1;
      icoBuffer.writeUInt8(0, offset); offset += 1;
      icoBuffer.writeUInt16LE(1, offset); offset += 2;
      icoBuffer.writeUInt16LE(32, offset); offset += 2;
      icoBuffer.writeUInt32LE(img.buffer.length, offset); offset += 4;
      icoBuffer.writeUInt32LE(offsets[i], offset); offset += 4;
    }
    
    for (const img of images) {
      img.buffer.copy(icoBuffer, offset);
      offset += img.buffer.length;
    }
    
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('ICO file created successfully:', icoPath);
  } catch (error) {
    console.error('Error creating ICO:', error);
    process.exit(1);
  }
}

convertToIco();
