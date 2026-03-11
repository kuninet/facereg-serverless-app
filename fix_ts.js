const fs = require('fs');
const file = 'frontend/src/pages/admin/AdminApp.tsx';
let content = fs.readFileSync(file, 'utf8');

// The original file contains literal '\', '`', 'E', 'N', 'T', 'R', 'Y' ...
// Let's just use string replacement avoiding regex escape shell issues
content = content.replace("\\`ENTRY-\\$", "\`ENTRY-\\$");
content = content.replace("i}\\`", "i}\`");
content = content.replace("\\`ゲスト 太郎 \\$", "\`ゲスト 太郎 \\$");

fs.writeFileSync(file, content);
