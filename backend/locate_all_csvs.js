const fs = require('fs');
const path = require('path');

function findCsvFiles(dir, depth = 0) {
  if (depth > 6) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
            findCsvFiles(fullPath, depth + 1);
          }
        } else if (file.endsWith('.csv')) {
          console.log('CSV:', fullPath, 'Size:', stat.size);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

findCsvFiles('c:\\Users\\shahi\\OneDrive');
