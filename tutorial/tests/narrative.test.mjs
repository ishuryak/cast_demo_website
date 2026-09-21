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

// The reader picker asks "How would you describe yourself?". Until 2026-09-21
// its four answers were Statistics student, Researcher, Causal convert and
// Educator, so a clinician reading a page about cancer survival had no answer,
// and the first interaction on the page told them it was not for them. Nothing
// in the repository referenced `reader-path`, so the set could shrink again
// with no check noticing. It is pinned here, in the walkthrough's own suite.
test('The reader picker offers a clinician a path, and offers it first', () => {
  const paths = [...html.matchAll(/data-reader-path="([^"]+)"[^>]*aria-controls="([^"]+)"/g)]
    .map(m => ({ path: m[1], controls: m[2] }));
  assert.deepEqual(paths.map(p => p.path),
    ['clinician', 'student', 'researcher', 'convert', 'educator'],
    'the reader-path set, in document order');
  assert.equal(paths[0].path, 'clinician', 'a clinician should not read past four methods-facing labels');
  assert.match(html, /data-reader-path="clinician"[^>]*>Clinician or oncologist</);
  for (const p of paths) {
    assert.ok(new RegExp(`class="reader-itinerary" id="${p.controls}"`).test(html),
      `path ${p.path} points at an itinerary that exists`);
  }
});

test('Every itinerary offers exactly the three stops the status message announces', () => {
  // narrative.mjs tells a screen reader "Three suggested stops are below", so a
  // different count makes the page lie to the reader who can least check it.
  const blocks = [...html.matchAll(/class="reader-itinerary" id="(path-[^"]+)"([\s\S]*?)<\/ol>/g)];
  assert.equal(blocks.length, 5);
  for (const [, id, body] of blocks) {
    assert.equal((body.match(/<li>/g) || []).length, 3, `${id} stop count`);
    assert.ok(/<h3>/.test(body), `${id} has the h3 narrative.mjs reads for its status message`);
  }
});

test('The clinician path hands over to the oncology version, and says it leaves', () => {
  const block = html.match(/class="reader-itinerary" id="path-clinician"([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(block, 'the clinician itinerary must be present');
  assert.match(block, /href="\.\.\/oncology\/"/, 'links to the oncology version');
  assert.match(block, /class="leaves-walkthrough"/, 'marked as leaving this walkthrough');
  // The no-JavaScript fallback is the only route when scripting is off, so a
  // path that exists only for scripted readers is not a path.
  const fallback = html.match(/reader-fallback[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((fallback.match(/<a /g) || []).length, 5, 'fallback offers all five');
  assert.match(fallback, /href="\.\.\/oncology\/"/, 'fallback reaches the oncology version too');
});
