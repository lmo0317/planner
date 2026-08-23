const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'public');
const destDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'www');
const vendorDir = path.join(destDir, 'vendor');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}
fs.mkdirSync(vendorDir, { recursive: true });

console.log('🔄 Syncing web files to Android app assets...');

fs.copyFileSync(path.join(srcDir, 'mobile.html'), path.join(destDir, 'index.html'));
fs.copyFileSync(path.join(srcDir, 'index.html'), path.join(destDir, 'desktop.html'));
fs.copyFileSync(path.join(srcDir, 'mobile-app.js'), path.join(destDir, 'mobile-app.js'));
fs.copyFileSync(path.join(srcDir, 'mobile.css'), path.join(destDir, 'mobile.css'));
fs.copyFileSync(path.join(srcDir, 'app.js'), path.join(destDir, 'app.js'));
fs.copyFileSync(path.join(srcDir, 'style.css'), path.join(destDir, 'style.css'));
fs.copyFileSync(path.join(srcDir, 'offline-storage.js'), path.join(destDir, 'offline-storage.js'));
fs.copyFileSync(path.join(srcDir, 'vendor', 'lucide.min.js'), path.join(vendorDir, 'lucide.min.js'));

console.log('✅ Android assets sync completed successfully!');
