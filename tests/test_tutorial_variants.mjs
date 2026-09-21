// The published tutorial variants are whole, separate pages.
//
// Pins the defects found in the 2026-09-21 review: tutorial_v3 fetched a data
// file that did not exist, linked the methods page's stylesheet instead of the
// walkthrough's, carried two <main> elements and eleven duplicated ids, and
// tutorial_v2 linked two directories too high and to a page that never existed.
// Every local href, src and fetch() target must resolve to a file under docs/.
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

for(const variant of ['tutorial','tutorial_v2','tutorial_v3','oncology']){
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

// v3 is the walkthrough plus a clinical layer: same stylesheets, same scripts.
const v3=path.join(DOCS,'tutorial_v3'),v1=path.join(DOCS,'tutorial');
if(existsSync(path.join(v3,'index.html'))){
  console.log('== tutorial_v3 keeps the walkthrough');
  for(const f of ['style.css','narrative.css','app.mjs','narrative.mjs','core.mjs','data/scenarios.json']){
    const same=existsSync(path.join(v3,f))&&readFileSync(path.join(v3,f),'utf8')===readFileSync(path.join(v1,f),'utf8');
    check(same,`${f} is identical to the walkthrough's`);
  }
  const html=readFileSync(path.join(v3,'index.html'),'utf8');
  const heads=s=>[...s.matchAll(/<h2[^>]*>([^<]+)/g)].map(m=>m[1]);
  check(JSON.stringify(heads(html))===JSON.stringify(heads(readFileSync(path.join(v1,'index.html'),'utf8'))),
    'same chapter headings, in the same order, as the walkthrough');
  check(/data-reader-path="clinician"/.test(html)&&/id="path-clinician"/.test(html),'offers a clinician reading path');
  check((html.match(/class="clinic-note"/g)||[]).length>=4,'carries the clinical asides');
}

console.log(`tutorial variants: ${failures?'FAIL':'PASS'} (${failures} failure${failures===1?'':'s'})`);
process.exit(failures?1:0);
