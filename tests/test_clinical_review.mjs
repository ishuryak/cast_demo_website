// Regression checks for the published clinical editions' scientific display contracts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {storyPlots} from '../clinical/narrative-figures.mjs';
const root=new URL('../',import.meta.url),out=new URL('docs/',root);
const read=(p,base=out)=>readFileSync(new URL(p,base),'utf8');
const data=JSON.parse(read('data/scenarios.json')),nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:''});return nodes.get(id);};
const context={document:{getElementById:node},window:{__ONCOLOGY_TEST__:true},fixture:data};
vm.createContext(context);vm.runInContext(read('tutorial_v2/app.js'),context);vm.runInContext('DATA=fixture;',context);
let checks=0;
for(const s of Object.values(data.scenarios)){
  context.next={shape:s.meta.shape,conf:s.meta.conf_strength,unmeas:s.meta.unmeas_strength};
  vm.runInContext('Object.assign(state,next);drawOverlap();',context);
  assert(node('overlap-big').innerHTML.startsWith(`${(100*s.overlap.pct_extreme).toFixed(1)}%`),'Overlap must convert exported proportion to percent');checks++;
  for(let i=0;i<data.horizons.length;i++){
    context.horizon=data.horizons[i];vm.runInContext('state.horizon=horizon;drawHeadline();drawBaseline();drawHidden();',context);
    if(s.meta.unmeas_strength>0)assert.match(node('headline-hint').innerHTML,/should not be read as the causal effect/);
    if(s.meta.unmeas_strength===0)assert.match(node('headline-hint').innerHTML,/pointwise/);
    assert.match(node('baseline-text').textContent,/not the whole cohort/);checks++;
  }
}
for(const page of ['tutorial','tutorial_v2','tutorial_v3']){
  for(const file of ['index.html',page==='tutorial_v2'?'app.js':'app.mjs'])assert(!/\u2014|&mdash;|&#8212;|&#x2014;/i.test(read(`${page}/${file}`)),`${page}/${file}: no em dashes`);
  assert(!/clinical-guide|data-guide-start/.test(read(`${page}/index.html`)));checks++;
}
const hash=s=>createHash('sha256').update(s).digest('hex');
assert.equal(hash(read('data/scenarios.json')),'0e72f90e939f1397f02f7ac58f30743003f4bc15ef712560802d938a5989afb4');checks++;
const s=data.scenarios['reversal_conf1.00_unmeas0.00'],plots=storyPlots(data);
assert(!/nnt-text/.test(read('tutorial_v2/index.html')+read('tutorial_v2/app.js')));
assert(s.cast.lo[3]>0&&s.truth[3]<0,'The 84-month caveat must agree with the plotted values');
assert(read('tutorial_v2/index.html').includes('p &lt; 0.0001')&&s.cox.ph_p===0,'Rounded PH test must not be presented as p=0');
assert(s.naive.every(x=>x>0)&&s.cox.ate.every(x=>x>0)&&s.truth[0]>0&&s.truth.at(-1)<0);
assert.deepEqual(plots['story-cox'].find(x=>x.name==='Known truth').y,s.truth.map(x=>x*100));
assert.deepEqual(plots['story-cast'].find(x=>x.name==='CSF').y,s.csf.ate.map(x=>x*100));checks+=3;
console.log(`Final clinical review checks: PASS (${checks}; 24 scenarios, 120 horizons, units, claims, punctuation and unchanged data).`);
