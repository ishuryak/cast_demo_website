// Publish chapter 2 of the walkthrough, "Option A or Option B?", at docs/tutorial_v2/,
// together with the shared theme, figure module and navigation helper it loads from
// docs/. The clinical edition that used to live at docs/tutorial_v3/ was folded into
// the walkthrough (chapter 3, "Read it like a clinician") on 2026-10-27; its URL is
// kept as a redirect so links that were shared before then still land somewhere useful.
import {cp,lstat,mkdir,readdir,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const docs=path.resolve(root,'docs');
if((await lstat(docs)).isSymbolicLink())throw new Error('Unsafe GitHub Pages output directory.');

for(const item of ['clinical-theme.css','narrative-figures.mjs','clinical-navigation.js'])await cp(path.join(root,'clinical',item),path.join(docs,item));
await mkdir(path.join(docs,'tutorial_v2'),{recursive:true});
for(const item of ['index.html','app.js'])await cp(path.join(root,'clinical/oncology',item),path.join(docs,'tutorial_v2',item));

const retired=path.resolve(docs,'tutorial_v3');
if(path.dirname(retired)!==docs||path.basename(retired)!=='tutorial_v3')throw new Error('Unsafe redirect directory.');
const existing=await lstat(retired).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
if(existing?.isSymbolicLink())throw new Error('Unsafe redirect directory.');
if(existing)for(const entry of await readdir(retired))if(entry!=='index.html')await rm(path.join(retired,entry),{recursive:true,force:true});
await mkdir(retired,{recursive:true});
await writeFile(path.join(retired,'index.html'),`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moved: the clinical walkthrough is now chapter 3</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="../tutorial/">
<meta http-equiv="refresh" content="0; url=../tutorial/#clinic">
</head>
<body>
<main><p>The clinical edition has been folded into the CAST walkthrough. Its notes are now chapter 3, <a href="../tutorial/#clinic">Read it like a clinician</a>, and the walkthrough begins at <a href="../tutorial/#start">Start here</a>.</p></main>
</body>
</html>
`);
console.log('Published chapter 2 in docs/tutorial_v2/ and the clinical-edition redirect in docs/tutorial_v3/.');
