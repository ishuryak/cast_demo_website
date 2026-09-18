import path from 'path';
const root = path.resolve('..');
console.log('root:', root);
console.log('appjs path:', path.join(root, 'docs', 'app.js'));
import fs from 'fs';
console.log('exists:', fs.existsSync(path.join(root, 'docs', 'app.js')));