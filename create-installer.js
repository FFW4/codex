const installer = require('electron-installer-windows');

async function createInstaller() {
  try {
    const result = await installer({
      src: './dist/CODEX-win32-x64',
      dest: './dist/installer',
      options: {
        name: 'CODEX',
        title: 'CODEX',
        companyName: 'FRAGUAR',
        exe: 'CODEX.exe',
        setupExe: 'CODEX-1.0.0-Setup.exe',
        noMsi: true
      }
    });
    console.log('Installer created successfully!');
    console.log(result);
  } catch (err) {
    console.error('Error creating installer:', err);
    process.exit(1);
  }
}

createInstaller();
