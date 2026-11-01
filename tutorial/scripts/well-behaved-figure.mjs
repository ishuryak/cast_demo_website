// Draws tutorial/assets/art/methods/well-behaved.svg: the well-behaved case
// for section 02. A constant hazard ratio on a smooth Weibull baseline, shown
// three ways: survival curves, log(−log S) against log t, and the survival
// difference the one number implies. Schematic, not the simulated cohort.
// Run: node tutorial/scripts/well-behaved-figure.mjs
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'assets/art/methods/well-behaved.svg');

const HR=0.5, K=1.1, LAMBDA=60; // months
const S0=t=>Math.exp(-((t/LAMBDA)**K));
const S1=t=>S0(t)**HR;
const cll=s=>Math.log(-Math.log(s));

const teal='#087e8b', rust='#a65736', ink='#242a29', muted='#656c68', line='#dcded5';
const W=960, H=370, PAD={top:56,right:18,bottom:46,left:44}, GAP=34;
const panelW=(W-GAP*2)/3;
const plotH=H-PAD.top-PAD.bottom;
const fmt=n=>Number.isInteger(n)?String(n):n.toFixed(1).replace(/\.0$/,'');
const f2=n=>n.toFixed(2);

function panel(i){const x0=i*(panelW+GAP);return{x0:x0+PAD.left,x1:x0+panelW-PAD.right,y0:PAD.top,y1:H-PAD.bottom};}
function scale(d0,d1,r0,r1){return v=>r0+(v-d0)/(d1-d0)*(r1-r0);}
function pathOf(pts){return pts.map((p,i)=>(i?'L':'M')+f2(p[0])+' '+f2(p[1])).join(' ');}
const text=(x,y,s,attrs='')=>`<text x="${f2(x)}" y="${f2(y)}" ${attrs}>${s}</text>`;

const parts=[];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="wb-title wb-desc" font-family="'DM Sans',Arial,sans-serif" font-size="12">`);
parts.push(`<title id="wb-title">The well-behaved case: a constant hazard ratio shown three ways</title>`);
parts.push(`<desc id="wb-desc">Left: survival curves for treated and control separate steadily. Middle: log(−log S) against log t gives two parallel lines whose gap is log HR at every time. Right: the survival difference that the one number implies rises and then narrows as both groups run out of survivors.</desc>`);
parts.push(`<style>text{fill:${muted}}.t{fill:${ink};font-size:13px;font-weight:600}.ax{stroke:${line};stroke-width:1}.grid{stroke:${line};stroke-width:.7}.c0{fill:none;stroke:${rust};stroke-width:2.2}.c1{fill:none;stroke:${teal};stroke-width:2.2}.d{fill:none;stroke:${ink};stroke-width:2.2}.lab1{fill:${teal};font-weight:600}.lab0{fill:${rust};font-weight:600}.note{fill:${ink}}.arrow{stroke:${ink};stroke-width:1.2;fill:none}.dot{fill:${ink}}</style>`);

// Panel 1: survival curves
{
  const p=panel(0), xs=scale(0,120,p.x0,p.x1), ys=scale(0,1,p.y1,p.y0);
  parts.push(text(p.x0,24,'Survival curves separate steadily','class="t"'));
  for(const v of [0,.25,.5,.75,1]){parts.push(`<line class="grid" x1="${f2(p.x0)}" x2="${f2(p.x1)}" y1="${f2(ys(v))}" y2="${f2(ys(v))}"/>`);if(v!==.25&&v!==.75)parts.push(text(p.x0-8,ys(v)+4,fmt(v),'text-anchor="end"'));}
  for(const t of [0,36,72,108]){parts.push(text(xs(t),p.y1+18,String(t),'text-anchor="middle"'));}
  parts.push(text((p.x0+p.x1)/2,p.y1+36,'months','text-anchor="middle"'));
  const ts=[];for(let t=0;t<=120;t+=1.5)ts.push(t);
  parts.push(`<path class="c0" d="${pathOf(ts.map(t=>[xs(t),ys(S0(t))]))}"/>`);
  parts.push(`<path class="c1" d="${pathOf(ts.map(t=>[xs(t),ys(S1(t))]))}"/>`);
  parts.push(text(xs(120)-2,ys(S1(120))-8,'treated','class="lab1" text-anchor="end"'));
  parts.push(text(xs(120)-2,ys(S0(120))+16,'control','class="lab0" text-anchor="end"'));
  parts.push(text(xs(4),ys(.17),`HR = ${HR}`,'class="note" font-size="15" font-weight="600"'));
  parts.push(text(xs(4),ys(.17)+16,'one number, whole follow-up','class="note"'));
}

// Panel 2: log(−log S) against log t
{
  const p=panel(1), t0=6, t1=120, xs=scale(Math.log(t0),Math.log(t1),p.x0,p.x1);
  const yMin=cll(S1(t0))-0.2, yMax=cll(S0(t1))+0.2, ys=scale(yMin,yMax,p.y1,p.y0);
  parts.push(text(p.x0,24,'log(−log S): a constant gap','class="t"'));
  for(const v of [-3,-2,-1,0,1]){if(v<yMin||v>yMax)continue;parts.push(`<line class="grid" x1="${f2(p.x0)}" x2="${f2(p.x1)}" y1="${f2(ys(v))}" y2="${f2(ys(v))}"/>`);parts.push(text(p.x0-8,ys(v)+4,String(v),'text-anchor="end"'));}
  for(const t of [6,12,36,108]){parts.push(text(xs(Math.log(t)),p.y1+18,String(t),'text-anchor="middle"'));}
  parts.push(text((p.x0+p.x1)/2,p.y1+36,'months, log scale','text-anchor="middle"'));
  parts.push(`<path class="c0" d="${pathOf([[xs(Math.log(t0)),ys(cll(S0(t0)))],[xs(Math.log(t1)),ys(cll(S0(t1)))]])}"/>`);
  parts.push(`<path class="c1" d="${pathOf([[xs(Math.log(t0)),ys(cll(S1(t0)))],[xs(Math.log(t1)),ys(cll(S1(t1)))]])}"/>`);
  for(const t of [12,60]){
    const x=xs(Math.log(t)), top=Math.min(ys(cll(S0(t))),ys(cll(S1(t)))), bot=Math.max(ys(cll(S0(t))),ys(cll(S1(t))));
    parts.push(`<path class="arrow" d="M${f2(x)} ${f2(top)}L${f2(x)} ${f2(bot)}"/>`);
    parts.push(`<path class="arrow" d="M${f2(x-4)} ${f2(top+5)}L${f2(x)} ${f2(top)}L${f2(x+4)} ${f2(top+5)}"/>`);
    parts.push(`<path class="arrow" d="M${f2(x-4)} ${f2(bot-5)}L${f2(x)} ${f2(bot)}L${f2(x+4)} ${f2(bot-5)}"/>`);
  }
  parts.push(text(p.x1,ys(yMin+0.55),`gap = log ${HR}`,'class="note" text-anchor="end" font-weight="600"'));
  parts.push(text(p.x1,ys(yMin+0.55)+16,'the same at every t','class="note" text-anchor="end"'));
  parts.push(text(xs(Math.log(t1))-2,ys(cll(S1(t1)))+16,'treated','class="lab1" text-anchor="end"'));
  parts.push(text(xs(Math.log(t1))-2,ys(cll(S0(t1)))-8,'control','class="lab0" text-anchor="end"'));
}

// Panel 3: implied survival difference
{
  const p=panel(2), xs=scale(0,120,p.x0,p.x1), ys=scale(0,30,p.y1,p.y0);
  parts.push(text(p.x0,24,'The difference one number implies','class="t"'));
  for(const v of [0,10,20,30]){parts.push(`<line class="grid" x1="${f2(p.x0)}" x2="${f2(p.x1)}" y1="${f2(ys(v))}" y2="${f2(ys(v))}"/>`);parts.push(text(p.x0-8,ys(v)+4,String(v),'text-anchor="end"'));}
  for(const t of [0,36,72,108]){parts.push(text(xs(t),p.y1+18,String(t),'text-anchor="middle"'));}
  parts.push(text((p.x0+p.x1)/2,p.y1+36,'months','text-anchor="middle"'));
  parts.push(text(p.x0,42,'points more alive, treated minus control','font-size="11"'));
  const ts=[];for(let t=0;t<=120;t+=1.5)ts.push(t);
  parts.push(`<path class="d" d="${pathOf(ts.map(t=>[xs(t),ys(100*(S1(t)-S0(t)))]))}"/>`);
  for(const t of [12,36,60,84,108]){parts.push(`<circle class="dot" cx="${f2(xs(t))}" cy="${f2(ys(100*(S1(t)-S0(t))))}" r="3.5"/>`);}
  parts.push(text(xs(118),ys(13),'narrows as both groups','text-anchor="end"'));
  parts.push(text(xs(118),ys(13)+16,'run out of survivors','text-anchor="end"'));
}

parts.push('</svg>');
await writeFile(out,parts.join('\n')+'\n');
console.log('Wrote',path.relative(root,out));
