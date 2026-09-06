import {cp,lstat,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import '../tutorial/scripts/build.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(root,'dist');
const existing=await lstat(output).catch(error=>{
  if(error.code==='ENOENT')return null;
  throw error;
});
// Only replace this repository's generated dist directory, never a linked path.
if(path.dirname(output)!==path.resolve(root)||path.basename(output)!=='dist'||existing?.isSymbolicLink()){
  throw new Error('Unsafe Sites output directory.');
}
await rm(output,{recursive:true,force:true});
await cp(path.join(root,'tutorial/dist'),output,{recursive:true});
console.log('Staged the validated static walkthrough in dist/.');
