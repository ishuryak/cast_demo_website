import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DEFAULT_STATE,parseState,stateSearch,selectedValues,plotDomain,percentagePoints,validateData} from '../core.mjs';
const bytes=readFileSync(new URL('../data/scenarios.json',import.meta.url));
const data=JSON.parse(bytes);
test('all 24 scenarios support every horizon and optional plotted series',()=>{
  validateData(data);let count=0;
  for(const shape of data.shapes)for(const conf of data.conf_grid)for(const unmeas of data.unmeas_grid){
    count++;for(const horizon of data.horizons){const s={...DEFAULT_STATE,shape,conf,unmeas,horizon};const v=selectedValues(data,s);const [lo,hi]=plotDomain(v.scenario);assert.ok(lo<v.low&&hi>v.high);assert.ok(lo<v.truth&&hi>v.truth);assert.ok(lo<v.fit&&hi>v.fit);}
  }assert.equal(count,24);
});
test('invalid links cannot select uncomputed horizons or arbitrary scenario values',()=>{
  assert.deepEqual(parseState('?shape=made-up&conf=99&unmeas=NaN&horizon=48&fit=yes',data),DEFAULT_STATE);
  const s={...DEFAULT_STATE,shape:'plateau',conf:2,unmeas:1.5,horizon:108,fit:true,truth:true,naive:true};assert.deepEqual(parseState(stateSearch(s),data),s);
});
test('the teaching example retains the actual peak miss and correct units',()=>{
  const v=selectedValues(data,DEFAULT_STATE);assert.equal(v.truth,.1638);assert.equal(v.fit,.1034);assert.equal(percentagePoints(v.estimate),'+18.1');
  assert.equal(percentagePoints(-.056),'−5.6');assert.equal(percentagePoints(0),'0.0');
});
test('frozen data matches the baseline copy and declared provenance',()=>{
  const original=readFileSync(new URL('../../docs/data/scenarios.json',import.meta.url));
  assert.equal(Buffer.compare(bytes,original),0);
  const provenance=JSON.parse(readFileSync(new URL('../data/provenance.json',import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sha256);
});
test('bad data fails explicitly instead of drawing partial evidence',()=>{
  const bad=structuredClone(data);bad.scenarios[Object.keys(bad.scenarios)[0]].csf.ate[0]=null;assert.throws(()=>validateData(bad),/CSF/);
});
