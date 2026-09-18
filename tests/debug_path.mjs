import {fileURLToPath} from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(new URL(import.meta.url).pathname)), '..');
console.log('root:', root);
console.log('appjs path:', path.join(root, 'docs', 'app.js'));
import fs from 'fs';
console.log('exists:', fs.existsSync(path.join(root, 'docs', 'app.js')));