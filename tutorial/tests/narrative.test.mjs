import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const table=html.match(/<table class="counterfactual-table">([\s\S]*?)<\/table>/)?.[1];
assert.ok(table,'The thought experiment must be present.');
const cells=[...table.matchAll(/<td\b([^>]*\bdata-potential-outcome[^>]*)>([^<]*)<\/td>/g)].map(([,attrs,text])=>({
  a:Number(attrs.match(/data-world-a="([01])"/)[1]),
  b:Number(attrs.match(/data-world-b="([01])"/)[1]),
  factual:attrs.includes('data-factual="true"'),text
}));
test('Two hypothetical completions preserve the same ten observed records',()=>{
  assert.equal(cells.length,20);
  const factual=cells.filter(c=>c.factual);
  assert.equal(factual.length,10);
  assert.equal(cells.filter(c=>!c.factual&&c.text==='?').length,10);
  for(const c of factual){assert.equal(c.a,c.b);assert.equal(c.text,c.a?'Alive':'Died');}
  for(let i=0;i<10;i++)assert.equal(cells[2*i].factual,i<5);
});
test('Equal survival marginals and SATE conceal different individual benefit and harm',()=>{
  for(const [world,expected] of [['a',{treated:6,control:4,helped:2,harmed:0}],['b',{treated:6,control:4,helped:4,harmed:2}]]){
    const result={treated:0,control:0,helped:0,harmed:0};
    for(let i=0;i<10;i++){
      const treated=cells[2*i][world],control=cells[2*i+1][world];
      result.treated+=treated;result.control+=control;
      result.helped+=Number(treated>control);result.harmed+=Number(treated<control);
    }
    assert.deepEqual(result,expected);
    assert.equal((result.treated-result.control)/10,.2);
  }
});
