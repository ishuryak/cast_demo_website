#!/usr/bin/env node
// FIXES.md is the repository's evidence record: one row per landed change, with
// the symptom, the proof it was real, the test that pins it, the verification and
// whether it moved a published number. Two things about it are checkable, and
// both have already been wrong once.
//
// 1. The file opens by telling the reader "Entries are newest first." A reader
//    who trusts that sentence and stops at the first section believes they are
//    looking at the latest change. When a later section is appended in the middle
//    instead of at the top -- which is what happens when two changes land on the
//    same day as an earlier edit is still open -- the sentence becomes false and
//    nothing complains. The claim and the ordering are asserted together here, so
//    neither can drift from the other: delete the sentence and this suite fails
//    too, which forces the question rather than letting the claim quietly go.
//
// 2. Every reasoning document FIXES.md points at must exist. A row whose
//    `development/` link is dead is a row whose reasoning cannot be recovered,
//    which is the whole failure the development-record rule exists to prevent.
//
// Pure text over the committed tree: no browser, no R, no pipeline run.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "FIXES.md");
const text = readFileSync(path, "utf8");

let fails = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { console.log(`  ok    ${name}`); }
  else { fails++; console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ""}`); }
};

console.log(`FIXES.md order: ${path}`);

// ---- the claim itself must be present ------------------------------------
// Asserted explicitly so that removing the sentence cannot be used to make the
// ordering check below vacuous.
ok("the file states its own ordering contract",
   /^Entries are newest first\.$/m.test(text),
   'expected the line "Entries are newest first." in the preamble');

// ---- section dates are non-increasing -------------------------------------
const sections = [...text.matchAll(/^## (\d{4}-\d{2}-\d{2})\b(.*)$/gm)]
  .map(m => ({ date: m[1], title: m[0].slice(3).trim(),
               line: text.slice(0, m.index).split("\n").length }));

ok("the file has dated sections", sections.length > 0,
   "no `## YYYY-MM-DD` section headings found");

let outOfOrder = [];
for (let i = 1; i < sections.length; i++) {
  if (sections[i].date > sections[i - 1].date) outOfOrder.push(sections[i]);
}
ok(`all ${sections.length} sections run newest-first`,
   outOfOrder.length === 0,
   outOfOrder.map(s => `line ${s.line}: ${s.date} appears after an older section -- "${s.title}"`)
             .join("\n          "));

// ---- every development record linked from here exists ---------------------
const links = [...new Set([...text.matchAll(/development\/[A-Za-z0-9_.-]+\.md/g)].map(m => m[0]))];
const dead = links.filter(l => !existsSync(join(root, l)));
ok(`all ${links.length} development-record links resolve`, dead.length === 0,
   dead.join("\n          "));

// ---- entry numbers are unique ---------------------------------------------
const nums = [...text.matchAll(/^### (\d+)\. /gm)].map(m => Number(m[1]));
const dupes = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))];
ok(`all ${nums.length} entry numbers are unique`, dupes.length === 0,
   dupes.length ? `repeated: ${dupes.join(", ")}` : "");

console.log(`FIXES.md order: ${fails === 0 ? "PASS" : "FAIL"} (${fails} failure${fails === 1 ? "" : "s"})`);
process.exit(fails === 0 ? 0 : 1);
