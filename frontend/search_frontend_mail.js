const fs = require('fs');
const path = require('path');

function searchFiles(dir, depth = 0) {
  if (depth > 6) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchFiles(fullPath, depth + 1);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.toLowerCase().includes('mail') || content.toLowerCase().includes('receipt') || content.toLowerCase().includes('invoice') || content.toLowerCase().includes('notify')) {
            console.log('Match in file:', fullPath);
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (line.toLowerCase().includes('mail') || line.toLowerCase().includes('receipt') || line.toLowerCase().includes('invoice') || line.toLowerCase().includes('notify')) {
                console.log(`  L${idx + 1}: ${line.trim()}`);
              }
            });
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
}

searchFiles('c:\\Users\\shahi\\OneDrive\\Payment_Portal\\frontend\\src');
