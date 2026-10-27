// The published walkthrough pages are whole, separate pages on one path.
//
// Pins the defects found in the 2026-09-21 review: a page that fetched a data
// file that did not exist, linked the methods page's stylesheet instead of the
// walkthrough's, carried two <main> elements and eleven duplicated ids, and a
// page that linked two directories too high and to a page that never existed.
// Every local href, src and fetch() target must resolve to a file under docs/.
//
// Since 2026-10-27 the site is one path: /tutorial/ (Start here, chapters 1 and
// 3 to 6) and /tutorial_v2/ (chapter 2). /tutorial_v3/, /clinical/ and
// /oncology/ are redirects, kept so shared links still land.
import {existsSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';

const DOCS=path.resolve(process.argv[2]||'docs');
let failures=0;
const check=(ok,msg)=>{console.log(`  ${ok?'ok  ':'FAIL'}  ${msg}`);if(!ok)failures++;};

function resolves(pageDir,ref){
  const clean=ref.split('#')[0].split('?')[0];
  if(!clean)return true;
  const target=path.resolve(pageDir,clean);
  if(!target.startsWith(DOCS+path.sep)&&target!==DOCS)return false;
  if(!existsSync(target))return false;
  return statSync(target).isFile()||existsSync(path.join(target,'index.html'));
}

function localRefs(html,js){
  const refs=[...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(m=>m[1]);
  for(const code of js)refs.push(...[...code.matchAll(/fetch\(\s*['"`]([^'"`]+)['"`]/g)].map(m=>m[1]));
  return refs.filter(r=>!/^(https?:|mailto:|data:|#|javascript:)/.test(r));
}

for(const variant of ['tutorial','tutorial_v2','tutorial_v3','clinical','oncology']){
  const dir=path.join(DOCS,variant),page=path.join(dir,'index.html');
  console.log(`== ${variant}`);
  if(!existsSync(page)){check(false,`${variant}/index.html exists`);continue;}
  const html=readFileSync(page,'utf8');
  const scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>path.resolve(dir,m[1]))
    .filter(existsSync).map(f=>readFileSync(f,'utf8'));
  // Static imports of the loaded modules are part of the page too.
  const imported=scripts.flatMap(code=>[...code.matchAll(/from\s*['"](\.[^'"]+)['"]/g)].map(m=>path.resolve(dir,m[1])))
    .filter(existsSync).map(f=>readFileSync(f,'utf8'));
  const broken=localRefs(html,[...scripts,...imported]).filter(r=>!resolves(dir,r));
  check(broken.length===0,`every local link, asset and fetch resolves${broken.length?': '+[...new Set(broken)].join(', '):''}`);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const dup=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
  check(dup.length===0,`no duplicated ids${dup.length?': '+dup.join(', '):''}`);
  const mains=(html.match(/<main[\s>]/g)||[]).length,closes=(html.match(/<\/main>/g)||[]).length;
  check(mains===1&&closes===1,`exactly one <main> (${mains} open, ${closes} close)`);
  const anchors=[...html.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]).filter(a=>!ids.includes(a));
  check(anchors.length===0,`every in-page link has a target${anchors.length?': #'+anchors.join(', #'):''}`);
}

// Cross-page anchors on the path must exist on the page they point at.
console.log('== the path');
const pages=Object.fromEntries(['tutorial','tutorial_v2'].map(v=>[v,readFileSync(path.join(DOCS,v,'index.html'),'utf8')]));
const idsOf=html=>new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const tutorialIds=idsOf(pages.tutorial);
for(const [from,html] of Object.entries(pages)){
  const missing=[...html.matchAll(/href="\.\.\/tutorial\/#([^"]+)"/g)].map(m=>m[1]).filter(id=>!tutorialIds.has(id));
  check(missing.length===0,`${from}: every link into the walkthrough has a target${missing.length?': #'+missing.join(', #'):''}`);
}
const chapters=['start','story','puzzle','clinic','methods','class-kit','end'];
check(chapters.every(id=>tutorialIds.has(id)),'the walkthrough carries all seven chapters, Start here through Where this leaves you');
for(const [name,html] of Object.entries(pages)){
  const strip=html.match(/<nav class="path-nav"[\s\S]*?<\/nav>/)?.[0]||'';
  check((strip.match(/<li>/g)||[]).length===7,`${name}: the chapter strip lists seven chapters`);
}
check((pages.tutorial.match(/data-reader-path=/g)||[]).length===4&&!/data-reader-path=/.test(pages.tutorial_v2),'one audience picker, on Start here, with four audiences');
check(/<nav class="chapter-next"/.test(pages.tutorial_v2)&&/href="\.\.\/tutorial\/#clinic"/.test(pages.tutorial_v2),'chapter 2 hands the reader on to chapter 3 at the bottom');
check(/<aside class="clinic-note" id="clinic-(options|indication|curve|whom|registry)"/.test(pages.tutorial)&&(pages.tutorial.match(/class="clinic-note"/g)||[]).length===5,'the five clinical readings live once, in chapter 3');

// The retired clinical edition redirects into chapter 3 and carries nothing else.
console.log('== tutorial_v3 redirect');
const v3=path.join(DOCS,'tutorial_v3');
const v3html=readFileSync(path.join(v3,'index.html'),'utf8');
check(/http-equiv="refresh" content="0; url=\.\.\/tutorial\/#clinic"/.test(v3html),'redirects to the walkthrough, chapter 3');
check(!/<script/.test(v3html),'loads no script');
check(!existsSync(path.join(v3,'app.mjs'))&&!existsSync(path.join(v3,'data')),'the duplicated walkthrough files are gone');

console.log(`tutorial variants: ${failures?'FAIL':'PASS'} (${failures} failure${failures===1?'':'s'})`);
process.exit(failures?1:0);
