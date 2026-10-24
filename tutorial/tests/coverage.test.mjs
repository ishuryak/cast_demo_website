// Keep the visible coverage comparison tied to the frozen study, including
// which column is CSF versus CAST. No inference from the illustrative chart.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const csv=readFileSync(new URL('validation/2026-10-19-propensity/summary.csv',root),'utf8');
const [header,...lines]=csv.trim().split(/\r?\n/).map(line=>line.split(',').map(x=>x.replaceAll('"','')));
const study=lines.map(row=>Object.fromEntries(header.map((name,i)=>[name,row[i]])));

test('walkthrough coverage columns match the frozen CSF and CAST study separately',()=>{
  const block=html.split('id="coverage-comparison"')[1]?.split('</section>')[0];
  assert.ok(block);
  assert.match(block,/<th scope="col">CSF interval<\/th><th scope="col">CAST pointwise band<\/th>/);
  const rows=[...block.matchAll(/<tr><th scope="row">([^<]+)<\/th><td>([\d.]+)%<\/td><td>([\d.]+)%<\/td><\/tr>/g)];
  assert.equal(rows.length,3);
  const arms={Forest:'forest',Logistic:'logistic','Super Learner':'superlearner'};
  for(const [,label,csf,cast] of rows)for(const [estimator,printed] of [['csf',csf],['cast',cast]]){
    const row=study.find(r=>r.arm===arms[label]&&r.month==='36'&&r.estimator===estimator);
    assert.ok(row);
    assert.equal(row.replicates,'300');
    assert.equal(printed,(100*Number(row.coverage)).toFixed(1));
  }
});
