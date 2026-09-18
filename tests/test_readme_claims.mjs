#!/usr/bin/env node
// Does the README's arithmetic still describe the shipped export?
//
// WHY THIS EXISTS. The README is this project's methods document: it is what a
// reader, a reviewer and the Data/Code Availability statement all point at. On
// 2026-09-18 an audit found four kinds of claim in it that the repository's own
// files contradicted, none of which any existing suite could see:
//
//   * a COVERAGE claim quoting the easy corner of the grid ("28 of 30 horizons,
//     which is what nominal coverage looks like") while the whole grid stands at
//     44 of 120, and 0 of 40 at the strongest hidden confounding;
//   * a TUNING claim ("all forests are tuned", CSF among them) that grf does not
//     honour, because `tune.parameters` reaches only the propensity forest grf
//     would fit for itself and this pipeline supplies `W.hat`;
//   * a BASELINE claim about the two RSF learners' "two different failure modes"
//     where the S-learner in fact has the lower RMSE in 20 of the 24 panels;
//   * a constant_registry.yaml justification asserting "single digits" condition
//     numbers against a shipped maximum of 17.6.
//
// Every one of these is a number in prose, and a number in prose that nothing
// recomputes is a number that drifts. This file recomputes each from
// docs/data/scenarios.json (and, for the tuning claim, from the R source) and
// fails when the text and the data disagree.
//
// EVERY ASSERTION IS POSITIVE. A "the README must not say X" check passes just
// as happily when the sentence is deleted, and a deleted caveat is the outcome
// these exist to prevent. Each one therefore locates the claim first (and fails
// if it has gone) and only then checks its arithmetic.
//
// CONFIRMED TO FAIL: against README.md at db72206 (4 failures: the coverage
// claim's subset framing, and the three absent claims), and against a mutated
// scenarios.json (the recomputed tallies move and every count assertion fires).
//
//   node tests/test_readme_claims.mjs [scenarios.json]

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSONP = resolve(process.argv[2] || join(ROOT, "docs/data/scenarios.json"));
const data = JSON.parse(readFileSync(JSONP, "utf8"));
const README = readFileSync(join(ROOT, "README.md"), "utf8");
const REGISTRY = readFileSync(join(ROOT, "constant_registry.yaml"), "utf8");
const FITSRC = readFileSync(join(ROOT, "R/02_fit_methods.R"), "utf8");

let fails = 0;
const ok = (msg, cond) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${msg}`); };
const S = Object.values(data.scenarios);

console.log("README claims: " + JSONP);

// SKIPS, rather than fails, on an export that is not the published grid.
// ./tests/run_tests.sh documents a second mode -- pass another scenarios.json,
// e.g. output/preview/ after a DEMO_SUBSAMPLE smoke run -- and every claim here
// is a statement about the 24-scenario grid the README describes. Compared
// against a 2-scenario subsample they are not wrong, they are inapplicable, and
// reporting them as failures would train a reader to ignore this suite. The
// dimensions are checked rather than the path, so a full export at any path is
// still audited.
const FULL = { shapes: 2, conf: 4, unmeas: 3, n: 24 };
const dims = { shapes: data.shapes.length, conf: data.conf_grid.length,
               unmeas: data.unmeas_grid.length, n: S.length };
if (dims.shapes !== FULL.shapes || dims.conf !== FULL.conf ||
    dims.unmeas !== FULL.unmeas || dims.n !== FULL.n) {
  console.log(`README claims: SKIP (this export is ${dims.n} scenarios over ` +
    `${dims.shapes} shapes x ${dims.conf} \u03b3 x ${dims.unmeas} \u0393; the README's ` +
    `claims describe the published ${FULL.n}-scenario grid, so there is nothing ` +
    `here to compare them against)`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1. Coverage. Recomputed the same way the clinical page recomputes it.
// ---------------------------------------------------------------------------
const hits = (s, k) => s.truth.map((t, i) => s[k].lo[i] <= t && t <= s[k].hi[i]);
function tally(sel, k) {
  let c = 0, n = 0;
  for (const s of S) if (sel(s.meta)) for (const h of hits(s, k)) { c += h ? 1 : 0; n++; }
  return [c, n];
}
const easy   = tally(m => m.unmeas_strength === 0 && m.conf_strength <= 1, "csf");
const csfAll = tally(() => true, "csf");
const castAll= tally(() => true, "cast");
const gmax   = Math.max(...data.unmeas_grid);
const csfMax = tally(m => m.unmeas_strength === gmax, "csf");
const castMax= tally(m => m.unmeas_strength === gmax, "cast");

const mEasy = README.match(/the CSF interval contains the\s+truth at (\d+) of (\d+) horizons/);
ok(`the README no longer states the Γ = 0, γ ≤ 1 CSF coverage`, !!mEasy);
if (mEasy) ok(`README says CSF covers ${mEasy[1]}/${mEasy[2]} on the easy corner; data says ${easy[0]}/${easy[1]}`,
              Number(mEasy[1]) === easy[0] && Number(mEasy[2]) === easy[1]);

const mAll = README.match(/CSF intervals contain the truth at (\d+) of (\d+)\s*\n?\s*horizons and the CAST band at (\d+) of (\d+)/);
ok("the README no longer states whole-grid coverage for CSF and CAST", !!mAll);
if (mAll) {
  ok(`README says CSF ${mAll[1]}/${mAll[2]} over the whole grid; data says ${csfAll[0]}/${csfAll[1]}`,
     Number(mAll[1]) === csfAll[0] && Number(mAll[2]) === csfAll[1]);
  ok(`README says CAST ${mAll[3]}/${mAll[4]} over the whole grid; data says ${castAll[0]}/${castAll[1]}`,
     Number(mAll[3]) === castAll[0] && Number(mAll[4]) === castAll[1]);
}

const mZero = README.match(/at the strongest hidden confounding\s*\n?\s*both are (\d+) of (\d+)/);
ok("the README no longer states coverage at the strongest hidden confounding", !!mZero);
if (mZero) ok(`README says ${mZero[1]}/${mZero[2]} at Γ = ${gmax}; data says CSF ${csfMax[0]}/${csfMax[1]}, ` +
              `CAST ${castMax[0]}/${castMax[1]}`,
              Number(mZero[1]) === csfMax[0] && Number(mZero[1]) === castMax[0] &&
              Number(mZero[2]) === csfMax[1] && Number(mZero[2]) === castMax[1]);

// A nominal interval that is not measured must not be described as though it
// were. This is the one negative check here, and it is narrow on purpose: the
// exact sentence that shipped, not the topic.
ok('the README again reads "which is what nominal coverage looks like" about an unmeasured interval',
   !/which is what\s*\n?\s*nominal coverage looks like/.test(README));

// ---------------------------------------------------------------------------
// 2. Tuning. The README's claim is true only while the code supplies W.hat.
// ---------------------------------------------------------------------------
// grf 2.5.0 references tune.parameters inside causal_survival_forest in exactly
// one place: forwarded to the propensity forest it fits when W.hat is NULL. So
// the README's "CSF is not tuned" is a statement about THIS call site. If a
// later edit stops supplying W.hat, the claim silently becomes wrong -- which is
// what this pins.
const csfCall = FITSRC.match(/causal_survival_forest\(X, Y, W, D,[\s\S]{0,400}?\)/);
ok("could not find the primary causal_survival_forest call in R/02_fit_methods.R", !!csfCall);
if (csfCall) {
  ok("the CSF call no longer supplies W.hat, so the README's \"CSF is not tuned\" " +
     "no longer follows (grf would then tune its own propensity forest)",
     /W\.hat\s*=/.test(csfCall[0]));
}
ok("the README no longer records that CSF runs untuned", /\*\*CSF is NOT tuned\.\*\*/.test(README));
ok("the README again claims all forests are tuned", !/On a full run all forests are tuned/.test(README));

// ---------------------------------------------------------------------------
// 3. Baselines: the S-vs-T claim, and CAST-vs-CSF.
// ---------------------------------------------------------------------------
const sWins   = S.filter(s => s.rmse.rsf < s.rmse.tlearner).length;
const castBad = S.filter(s => s.rmse.cast > s.rmse.csf);
const castBadRev = castBad.filter(s => s.meta.shape === "reversal").length;

const mS = README.match(/S-learner has the lower RMSE in (\d+) of\s*\n?\s*the (\d+) panels/);
ok("the README no longer states how often the RSF S-learner beats the T-learner", !!mS);
if (mS) ok(`README says the S-learner wins ${mS[1]} of ${mS[2]}; data says ${sWins} of ${S.length}`,
           Number(mS[1]) === sWins && Number(mS[2]) === S.length);

const mC = README.match(/LARGER RMSE than the CSF points it smooths in (\d+)\s*\n?\s*of the (\d+) scenarios, (\d+) of them on the reversal/);
ok("the README no longer states how often CAST is less accurate than CSF", !!mC);
if (mC) ok(`README says CAST is worse in ${mC[1]}/${mC[2]} (${mC[3]} on reversal); ` +
           `data says ${castBad.length}/${S.length} (${castBadRev} on reversal)`,
           Number(mC[1]) === castBad.length && Number(mC[2]) === S.length &&
           Number(mC[3]) === castBadRev);

// The one worked example the band passage quotes.
const rev05 = data.scenarios["reversal_conf0.50_unmeas0.00"];
const mEx = README.match(/on the reversal at γ = 0\.5\s*\n?\s*the RMSE goes from ([\d.]+) for CSF to ([\d.]+) for CAST/);
ok("the README no longer gives the reversal γ = 0.5 worked example", !!mEx);
if (mEx && rev05) ok(`README quotes CSF ${mEx[1]} -> CAST ${mEx[2]}; data has ` +
                     `${rev05.rmse.csf} -> ${rev05.rmse.cast}`,
                     Number(mEx[1]) === rev05.rmse.csf && Number(mEx[2]) === rev05.rmse.cast);

// ---------------------------------------------------------------------------
// 4. constant_registry.yaml: gls_cond_max's justification quotes a range.
// ---------------------------------------------------------------------------
const conds = S.map(s => s.shrinkage?.cond_after).filter(v => v != null);
const lo = Math.min(...conds), hi = Math.max(...conds);
const mR = REGISTRY.match(/realized condition numbers run from ([\d.]+) to\s*\n?\s*([\d.]+)/);
ok("constant_registry no longer states the realized condition-number range", !!mR);
if (mR) ok(`registry says cond_after runs ${mR[1]} to ${mR[2]}; data says ` +
           `${lo.toFixed(1)} to ${hi.toFixed(1)}`,
           Math.abs(Number(mR[1]) - lo) < 0.05 && Math.abs(Number(mR[2]) - hi) < 0.05);
// and the threshold it justifies must still not bind
ok(`gls_cond_max is 100 but a shipped scenario reaches ${hi}`, hi <= 100);

console.log(`README claims: ${fails === 0 ? "PASS" : "FAIL"} (${fails} failure${fails === 1 ? "" : "s"})`);
process.exit(fails === 0 ? 0 : 1);
