const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(__dirname, '../node_modules');

function scanAndFix(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanAndFix(fullPath);
    } else if (file === 'build.gradle' && fullPath.includes('android')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('proguard-android.txt')) {
        content = content.replace(/proguard-android\.txt/g, 'proguard-android-optimize.txt');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed ProGuard in: ${fullPath}`);
      }
    }
  });
}

scanAndFix(path.join(nodeModulesPath, '@capacitor'));
