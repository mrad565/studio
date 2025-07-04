/**
 * Script to prepare the Vite build output for ESP32 SPIFFS filesystem
 * 
 * This script:
 * 1. Flattens the directory structure to work with SPIFFS path limitations
 * 2. Renames files to shorter names to work with SPIFFS path limitations
 * 3. Creates a data directory structure ready for ESP32 upload
 * 4. Fixes asset paths in HTML files for ESP32 SPIFFS
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_DIR = path.join(__dirname, '..', 'dist');
const DATA_DIR = path.join(__dirname, '..', 'data');
const MAX_FILENAME_LENGTH = 31;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} else {
  fs.readdirSync(DATA_DIR).forEach(file => {
    const filePath = path.join(DATA_DIR, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  });
}

const fileMapping = new Map();

function processDirectory(dirPath, targetPath = '') {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(sourcePath, path.join(targetPath, entry.name));
    } else {
      let fileName = entry.name;
      let extension = path.extname(fileName);
      let baseName = path.basename(fileName, extension);
      
      if (fileName.length > MAX_FILENAME_LENGTH) {
        const shortBaseName = baseName.substring(0, MAX_FILENAME_LENGTH - extension.length - 1);
        fileName = shortBaseName + extension;
      }
      
      const targetFilePath = path.join(DATA_DIR, fileName);
      
      const relativeSourcePath = path.relative(BUILD_DIR, sourcePath);
      const relativeTargetPath = path.relative(DATA_DIR, targetFilePath);
      fileMapping.set(relativeSourcePath, relativeTargetPath);
      
      fs.copyFileSync(sourcePath, targetFilePath);
      console.log(`Copied: ${sourcePath} -> ${targetFilePath}`);
    }
  }
}

function fixAssetPaths() {
  const htmlFiles = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.html'));
  
  for (const htmlFile of htmlFiles) {
    const filePath = path.join(DATA_DIR, htmlFile);
    let content = fs.readFileSync(filePath, 'utf8');
    
    content = content.replace(/src="\/assets\/([^"]+)"/g, (match, assetPath) => {
      const assetFileName = path.basename(assetPath);
      return `src="/${assetFileName}"`;
    });
    
    content = content.replace(/href="\/assets\/([^"]+)"/g, (match, assetPath) => {
      const assetFileName = path.basename(assetPath);
      return `href="/${assetFileName}"`;
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed asset paths in ${filePath}`);
  }
}

console.log('Building project with Vite...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed successfully.');
  
  console.log('Processing build files for ESP32 SPIFFS...');
  processDirectory(BUILD_DIR);
  
  console.log('Fixing asset paths in HTML files...');
  fixAssetPaths();
  
  console.log('Files prepared for ESP32 SPIFFS in I:\\Picine_Led_Controller\\PROJECT\\DigitalCurtainWatter_io\\data directory.');
  console.log('Use Arduino IDE or PlatformIO to upload the data directory to SPIFFS.');
} catch (error) {
  console.error('Error during build or processing:', error);
  process.exit(1);
}