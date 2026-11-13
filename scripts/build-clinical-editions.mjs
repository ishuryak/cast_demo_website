// Stage the separate oncology diagnostics and its shared assets.
import {cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'docs');
for(const item of ['clinical-theme.css','narrative-figures.mjs','clinical-navigation.js'])await cp(path.join(root,'clinical',item),path.join(out,item));
for(const item of ['index.html','app.js'])await cp(path.join(root,'clinical/oncology',item),path.join(out,'tutorial_v2',item));
console.log('Built the separate oncology diagnostics and shared assets.');
