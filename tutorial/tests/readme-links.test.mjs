// Every design document the walkthrough README sends a reader to must exist.
// 2026-09-28: the README pointed at design/COLLABORATION.md, which was never in
// the tree. Deliberately local, gitignored notes (design/*.local.md) are exempt.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const readme=readFileSync(new URL('tutorial/README.md',root),'utf8');
test('design documents named in the walkthrough README exist',()=>{
  const named=[...readme.matchAll(/`(design\/[^`\s]+\.md)`/g)].map(m=>m[1]);
  assert.ok(named.length>0,'README names no design document; this check would verify nothing');
  const missing=named.filter(p=>!p.endsWith('.local.md')&&!existsSync(new URL(p,root)));
  assert.deepEqual(missing,[]);
});
