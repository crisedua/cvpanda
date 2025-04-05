import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get build directory contents
const buildDir = path.join(__dirname, '..', 'dist');
const expectedFiles = [
  'index.html',
  'assets',
  'vite.svg'
];

console.log('\n🔍 Checking deployment files...\n');

// Check if build directory exists
if (!fs.existsSync(buildDir)) {
  console.error('❌ Build directory not found! Run npm run build first.');
  process.exit(1);
}

// Check for expected files
const missingFiles = [];
expectedFiles.forEach(file => {
  const filePath = path.join(buildDir, file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
});

// Check asset files
const assetDir = path.join(buildDir, 'assets');
if (fs.existsSync(assetDir)) {
  const assets = fs.readdirSync(assetDir);
  console.log('📦 Assets found:', assets.length);
  
  // Check for key asset types
  const jsFiles = assets.filter(f => f.endsWith('.js')).length;
  const cssFiles = assets.filter(f => f.endsWith('.css')).length;
  
  console.log(`   JavaScript files: ${jsFiles}`);
  console.log(`   CSS files: ${cssFiles}`);
}

if (missingFiles.length > 0) {
  console.error('\n❌ Missing files:', missingFiles.join(', '));
  process.exit(1);
} else {
  console.log('\n✅ All expected files present');
  
  // Check file sizes
  const indexSize = fs.statSync(path.join(buildDir, 'index.html')).size;
  console.log(`\n📊 index.html size: ${(indexSize / 1024).toFixed(2)}KB`);
}