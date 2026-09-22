import {cp,lstat,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import '../tutorial/scripts/build.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const docs=path.resolve(root,'docs');
const output=path.resolve(docs,'tutorial');
const existing=await lstat(output).catch(error=>{
  if(error.code==='ENOENT')return null;
  throw error;
});
// Replace only the generated walkthrough; preserve the root diagnostics page.
if(path.dirname(output)!==docs||path.basename(output)!=='tutorial'||
   (await lstat(docs)).isSymbolicLink()||existing?.isSymbolicLink()){
  throw new Error('Unsafe GitHub Pages output directory.');
}
await rm(output,{recursive:true,force:true});
await cp(path.join(root,'tutorial/dist'),output,{recursive:true});
console.log('Staged the full walkthrough in docs/tutorial/ for GitHub Pages.');
// The clinical edition is derived from the walkthrough just staged, so it is rebuilt with it.
await import('./build-tutorial-v3.mjs');

await import('./build-clinical-editions.mjs');
