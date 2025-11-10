#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏗️  Building TimePaste for Chrome Web Store...\n');

// Create dist directory
const distDir = 'dist';
if (fs.existsSync(distDir)) {
  console.log('Cleaning existing dist directory...');
  execSync(`rm -rf ${distDir}`);
}
fs.mkdirSync(distDir, { recursive: true });

// Files and directories to copy
const filesToCopy = [
  'manifest.json',
  'src/popup.html',
  'src/popup.js',
  'src/options.html',
  'src/options.js',
  'src/background.js',
  'src/availability.js',
  'src/account-manager.js',
  'src/calendar.js',
  'src/content.js',
  'src/providers'
];

// Files to exclude
const excludePatterns = [
  'config.js',
  'config.example.js',
  '.DS_Store',
  'README.md',
  'ROLLBACK_NOTES.md'
];

console.log('Copying files...');

// Copy manifest
fs.copyFileSync('manifest.json', path.join(distDir, 'manifest.json'));
console.log('✓ manifest.json');

// Copy source files
filesToCopy.forEach(item => {
  const srcPath = item;
  const destPath = path.join(distDir, item);
  
  if (fs.existsSync(srcPath)) {
    const stats = fs.statSync(srcPath);
    
    if (stats.isDirectory()) {
      // Copy directory recursively
      copyDirectory(srcPath, destPath);
      console.log(`✓ ${item}/`);
    } else {
      // Copy file
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ ${item}`);
    }
  } else {
    console.warn(`⚠️  Warning: ${srcPath} not found`);
  }
});

// Copy icons if they exist
const iconsDir = 'icons';
if (fs.existsSync(iconsDir)) {
  copyDirectory(iconsDir, path.join(distDir, iconsDir));
  console.log(`✓ ${iconsDir}/`);
} else {
  console.warn('⚠️  Warning: icons/ directory not found. Chrome Web Store requires icons.');
  console.warn('   Please create icons/icon16.png, icons/icon48.png, and icons/icon128.png');
}

// Create config.js placeholder or read from existing
const configPath = 'src/config.js';
const distConfigPath = path.join(distDir, 'src/config.js');

// Check if config.js exists and create a placeholder that reads from manifest if needed
if (fs.existsSync(configPath)) {
  // Read the existing config to extract GOOGLE_CLIENT_ID
  const configContent = fs.readFileSync(configPath, 'utf8');
  const clientIdMatch = configContent.match(/GOOGLE_CLIENT_ID\s*=\s*["']([^"']+)["']/);
  
  if (clientIdMatch) {
    const clientId = clientIdMatch[1];
    // Create a config that can be used in production
    // Note: For Chrome Web Store, you may want to handle this differently
    fs.copyFileSync(configPath, distConfigPath);
    console.log('✓ src/config.js (copied - contains OAuth credentials)');
  }
} else {
  console.warn('⚠️  Warning: src/config.js not found. Extension will not work without OAuth credentials.');
}

// Create zip file
console.log('\n📦 Creating zip file...');
const zipPath = 'dist.zip';
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

process.chdir(distDir);
execSync('zip -r ../dist.zip . -x "*.DS_Store"');
process.chdir('..');

console.log(`\n✅ Build complete!`);
console.log(`📁 Distribution files: ${distDir}/`);
console.log(`📦 Zip file ready: ${zipPath}`);
console.log(`\nReady for Chrome Web Store upload!`);

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // Skip excluded files
    if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}


