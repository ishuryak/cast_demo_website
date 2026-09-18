// Contract + render tests for the clinician-facing page (docs/clinical/).
//
// WHY A SEPARATE SUITE. docs/clinical/ shares scenarios.json with the parent
// page but has its own markup, its own element ids and two computations the
// parent does not have: the unit conversion to patients-per-100 and the interval
// coverage check. The parent suites cover neither, and would not notice either
// breaking.
//
// WHAT IT ASSERTS
//   1. The page runs at all 24 control positions and fills every card.
//   2. Its coverage figures match an INDEPENDENT recomputation from the same
//      JSON. The test does not call the page's own coverage function and compare
//      it with itself; it re-derives the answer and checks the DOM the page
//      wrote.
//   3. Plotted values really are 100x the survival-probability differences.
//   4. The error bars discriminate between methods rather than rendering the
//      five that matter as identical slivers.
//   5. The page's text obeys the rules a clinical reader depends on: acronyms
//      expanded, no em dashes, and no tuning claim the code cannot deliver.
//
//   node tests/test_clinical_contract.mjs [path/to/scenarios.json]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "docs", "clinical");
const jsonPath = process.argv[2] || path.join(root, "docs", "data", "scenarios.json");
const appSrc = fs.readFileSync(path.join(dir, "app.js"), "utf8");
const htmlSrc = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const cssSrc = fs.readFileSync(path.join(dir, "style.css"), "utf8");
const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

const fail = [];
const ok = (msg, cond) => { if (!cond) fail.push(msg); };

// ---- minimal DOM ---------------------------------------------------------
const ids = [...htmlSrc.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
function mkEl(tag = "div") {
  const el = {
    tagName: tag, children: [], dataset: {}, style: {}, title: "",
    type: "", name: "", id: "", value: "", checked: false, htmlFor: "",
    _text: "", _html: "",
    classList: { _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); return c; }
  };
  Object.defineProperty(el, "textContent",
    { get: () => el._text, set: v => { el._text = String(v); } });
  Object.defineProperty(el, "innerHTML",
    { get: () => el._html, set: v => { el._html = String(v); el.children.length = 0; } });
  return el;
}
const registry = new Map();
ids.forEach(i => registry.set(i, mkEl()));
const document = {
  getElementById: id => registry.get(id) || null,
  createElement: tag => mkEl(tag),
  createTextNode: t => ({ nodeType: 3, textContent: String(t) })
};

let plotCalls = 0, lastTraces = null;
const Plotly = { react(_id, traces) { plotCalls++; lastTraces = traces; } };
const fetchShim = () => Promise.resolve({ ok: true, json: async () => data });
const appErrors = [];
const sandbox = { document, Plotly, fetch: fetchShim, setTimeout, queueMicrotask,
  console: { error(e) { appErrors.push(String((e && e.message) || e)); }, log() {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
const EPILOGUE = "\n;globalThis.__api = { get state() { return state; }, render, init };";
try { vm.runInContext(appSrc + EPILOGUE, sandbox, { filename: "docs/clinical/app.js" }); }
catch (e) { fail.push(`clinical app.js threw at load: ${e.message}`); }
for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
appErrors.forEach(e => fail.push(`app.js reported an error during init: ${e}`));
const api = sandbox.__api;
ok("could not reach clinical app.js internals", !!api);

// ---- 2. coverage, recomputed independently --------------------------------
// Deliberately NOT the page's own function: a test that calls the code under
// test and compares it with itself cannot fail for the reason that matters.
const HZ = data.horizons;
// Derived exactly as app.js:240 derives it, so the two cannot drift apart.
const MID = Math.floor(HZ.length / 2);
let allHit = 0, allN = 0, g0Hit = 0, g0N = 0, gMaxHit = 0, gMaxN = 0;
const gmax = Math.max(...data.unmeas_grid);
for (const s of Object.values(data.scenarios)) {
  const G = s.meta.unmeas_strength;
  s.truth.forEach((t, i) => {
    const hit = s.cast.lo[i] <= t && t <= s.cast.hi[i];
    allHit += hit ? 1 : 0; allN++;
    if (G === 0)    { g0Hit   += hit ? 1 : 0; g0N++; }
    if (G === gmax) { gMaxHit += hit ? 1 : 0; gMaxN++; }
  });
}
const shown = id => (registry.get(id)?._text || "");
ok(`#cov-global should report ${allHit} of ${allN}, page says "${shown("cov-global")}"`,
   shown("cov-global").startsWith(`${allHit} of ${allN}`));
ok(`#cov-g0 should report ${g0Hit} of ${g0N}, page says "${shown("cov-g0")}"`,
   shown("cov-g0").startsWith(`${g0Hit} of ${g0N}`));
ok(`#cov-g2 should report ${gMaxHit} of ${gMaxN}, page says "${shown("cov-g2")}"`,
   shown("cov-g2").startsWith(`${gMaxHit} of ${gMaxN}`));
// The finding this page exists to surface: nominal 95% is not delivered.
ok(`coverage should be well below nominal (got ${allHit}/${allN}); if this ever ` +
   `passes 95% the data changed and the page's framing needs re-reading`,
   allHit / allN < 0.95);

// ---- 1. render at every control position ----------------------------------
function radios(containerId) {
  return (registry.get(containerId)?.children ?? []).filter(c => c.type === "radio");
}
function pick(containerId, i) {
  const rs = radios(containerId);
  if (!rs.length) return;
  rs.forEach((r, j) => { r.checked = j === i; });
  if (typeof rs[i]?.onchange !== "function")
    throw new Error(`${containerId} option ${i} has no onchange handler`);
  rs[i].onchange();
}
const cardIds = ["headline", "headline-hint", "peak-text", "cov-text",
                 "smd-text", "overlap-big", "overlap-text", "unmeas-big",
                 "unmeas-text"];
let combos = 0;
for (const sh of data.shapes) {
  for (let ci = 0; ci < data.conf_grid.length; ci++) {
    for (let ui = 0; ui < data.unmeas_grid.length; ui++) {
      combos++;
      const label = `${sh} g=${data.conf_grid[ci]} G=${data.unmeas_grid[ui]}`;
      const before = plotCalls;
      cardIds.forEach(id => { const e = registry.get(id); if (e) { e._text = ""; e._html = ""; } });
      ["cov-strip", "rmse-bars", "smd-bars"].forEach(id => {
        const e = registry.get(id); if (e) { e._html = ""; e.children.length = 0; } });
      try {
        api.state.shape = sh;
        pick("conf-buttons", ci);
        pick("unmeas-buttons", ui);
        api.render();
      } catch (e) { fail.push(`render(${label}) threw: ${e.message}`); continue; }

      ok(`${label}: no plot drawn`, plotCalls > before);
      for (const id of cardIds) {
        const e = registry.get(id);
        if (!e) { fail.push(`${label}: #${id} missing from index.html`); continue; }
        ok(`${label}: card #${id} left empty`, !!(e._text || e._html));
      }
      const strip = registry.get("cov-strip");
      ok(`${label}: coverage strip has ${strip.children.length} cells, expected ${HZ.length}`,
         strip.children.length === HZ.length);
      ok(`${label}: a coverage cell is neither hit nor miss`,
         strip.children.every(c => c.classList.contains("hit") || c.classList.contains("miss")));
      const s2 = data.scenarios[`${sh}_conf${Number(data.conf_grid[ci]).toFixed(2)}` +
                                `_unmeas${Number(data.unmeas_grid[ui]).toFixed(2)}`];
      const bars = registry.get("rmse-bars");
      ok(`${label}: ${bars.children.length} error rows, expected 6`, bars.children.length === 6);

      // 4. bar geometry, recomputed from the JSON rather than described.
      // app.js scales each bar to the WORST method on the panel:
      //   w = max(2, min(100, 100 * v / top)).
      // Three comments in this repository used to claim a "shared scale rather
      // than the worst method"; no such code ever existed, and no assertion
      // here could have noticed, because the two that tried both keyed on the
      // LONGEST bar -- which is exactly 100 under either rule. Recomputing every
      // width from the source data is the form that fails when the rule changes.
      const rmseOrder = ["naive", "rsf", "tlearner", "cox", "csf", "cast"];
      const widths = bars.children
        .map(c => (c._html.match(/width:([\d.]+)%/) || [])[1])
        .filter(Boolean).map(Number);
      ok(`${label}: could not read bar widths`, widths.length === 6);
      if (widths.length === 6) {
        const v = rmseOrder.map(k => s2.rmse[k] * 100);
        const top = Math.max(...v);
        const want = v.map(x => Math.max(2, Math.min(100, 100 * x / top)));
        const off = want.findIndex((w, i) => Math.abs(w - widths[i]) > 0.11);
        ok(`${label}: bar width wrong at row ${off} (${rmseOrder[off]}: ` +
           `shows ${widths[off]}%, worst-method scaling gives ${want[off]?.toFixed(1)}%)`,
           off === -1);
      }
      // What makes this table readable is the multiple of the best method, not
      // the bar width. Two earlier versions of this check asserted on bar
      // geometry and BOTH passed under the defect they were written to catch:
      // the first measured the longest bar (always full width), the second the
      // second-longest (never below 45% in this data, so the cap it was testing
      // never fired). The ratio is the quantity a reader actually uses, so it is
      // the quantity pinned here, against a recomputation from the JSON.
      const ratios = bars.children
        .map(c => (c._html.match(/<b>([\d.]+)\u00d7<\/b>/) || [])[1])
        .filter(Boolean).map(Number);
      ok(`${label}: could not read the "times best" column`, ratios.length === 6);
      if (ratios.length === 6) {
        const src = ["naive", "rsf", "tlearner", "cox", "csf", "cast"].map(k => s2.rmse[k] * 100);
        const bestSrc = Math.min(...src);
        const wrong = src.findIndex((v, i) => Math.abs(v / bestSrc - ratios[i]) > 0.051);
        ok(`${label}: "times best" column wrong at row ${wrong} ` +
           `(shows ${ratios[wrong]}, data gives ${(src[wrong] / bestSrc).toFixed(1)})`, wrong === -1);
        // `Math.min(...ratios) === 1` used to sit here and could not fail: the
        // best row is best/best by construction. It is not replaced by a
        // bar-vs-ratio cross-check either. The ratio column is rounded to one
        // decimal, so at reversal/g=0/G=1.5 four methods legitimately read 2.5x
        // while their unrounded widths differ, and such a check cannot tell that
        // tie from a defect. Both displays are pinned INDEPENDENTLY against the
        // JSON above, which is the stronger arrangement.
      }

      // 4b. the hidden-confounder card must state the move in the direction the
      // data has it. robustness.shift is ate_omitU - ate_withU, so ADDING the
      // hidden factor moves the estimate by MINUS shift. The card printed
      // +shift as "moves the estimate by", inverting the direction on all 16
      // panels with a hidden factor: at plateau/g=0/G=1.5, h=60 the estimate
      // falls 34.3 -> 18.0 per 100 and the page read "+16.4".
      //
      // Parsed out of the rendered card and compared against the JSON, so it
      // pins the NUMBER A READER SEES, not the expression that produced it.
      const rb2 = s2.robustness;
      if (rb2 && data.unmeas_grid[ui] !== 0) {
        const utxt = registry.get("unmeas-text")._html || "";
        // \d+(?:\.\d+)? and not [\d.]+ : the latter is greedy across the
        // sentence's own full stop, so "a move of -4.7." yielded "4.7." and
        // Number() returned NaN, which compares unequal to everything and so
        // reported a failure on all 16 panels, including the correct ones.
        const mMove = utxt.match(/a move of ([+\u2212-])(\d+(?:\.\d+)?)/);
        ok(`${label}: the hidden-confounder card does not state a signed move`, !!mMove);
        if (mMove) {
          const shown = (mMove[1] === "+" ? 1 : -1) * Number(mMove[2]);
          const want  = 100 * (rb2.ate_withU[MID] - rb2.ate_omitU[MID]);
          ok(`${label}: card says the refit moves the estimate by ${shown.toFixed(1)} ` +
             `per 100, data says ${want.toFixed(1)} (sign inverted?)`,
             Math.abs(shown - want) <= 0.11);
        }
      }

      // 3. units: plotted truth must be 100x the stored survival-probability diff.
      const s = s2;
      const truthTrace = (lastTraces || []).find(t => t.name === "The truth");
      if (!truthTrace) fail.push(`${label}: the truth is not on the figure`);
      else {
        const bad = truthTrace.y.findIndex((v, i) => Math.abs(v - 100 * s.truth[i]) > 1e-9);
        ok(`${label}: plotted truth is not 100x the stored value at horizon index ${bad}`,
           bad === -1);
      }
    }
  }
}
// The per-panel checks above run on any export. The two below are statements
// about the PUBLISHED grid, so on a DEMO_SUBSAMPLE export (the documented second
// mode of ./tests/run_tests.sh) they are inapplicable rather than false.
const EXPECTED_COMBOS = data.shapes.length * data.conf_grid.length * data.unmeas_grid.length;
const FULL_GRID = EXPECTED_COMBOS === 24 && data.shapes.length === 2 &&
                  data.conf_grid.length === 4 && data.unmeas_grid.length === 3;
ok(`drove ${combos} combinations, expected ${EXPECTED_COMBOS}`, combos === EXPECTED_COMBOS);
if (!FULL_GRID) {
  console.log(`  skip  grid-wide checks (this export is ${EXPECTED_COMBOS} panels, ` +
              `not the published 24)`);
}

// ---- 4c. the balance card's claim about smoking, against the data ----------
// The card used to read "Smoking affects survival but not who gets treated, so
// it stays near zero however strong the confounding." The first clause is true
// of the data-generating process: smoking enters lp_surv (R/01_simulate.R:83)
// and NOT lp_treat (:92-94). The second is false of the shipped grid -- with one
// cohort of 2000, |SMD| reaches 0.112 and 0.102, and in those two panels the
// card's OWN bar turns red with the tooltip "Imbalanced: beyond 0.10", directly
// above the sentence denying it.
//
// The rewrite states a COUNT, so the count is checked here rather than trusted.
// A prose number nobody recomputes is the same defect one layer up.
if (FULL_GRID) {
  const smds = Object.values(data.scenarios).map(s => Math.abs(s.meta.smd_smoke));
  const over = smds.filter(v => v > 0.10).length;
  const WORDS = { 0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };
  const smText = registry.get("smd-text")._html || "";

  // (a) the page must not assert smoking stays balanced when it does not.
  ok(`the balance card claims smoking "stays near zero" but |SMD| exceeds 0.10 ` +
     `in ${over} of ${smds.length} panels (max ${Math.max(...smds).toFixed(3)})`,
     over === 0 || !/stays near zero/.test(smText));

  // (b) whatever count it states must be the count in the data. Asserted
  // POSITIVELY: a "must not say X" check passes just as happily when the whole
  // passage is deleted, which is the outcome it exists to prevent.
  const stated = smText.match(/it does cross 0\.10 in (\w+) of the (\d+) panels/);
  ok(`the balance card no longer states how often smoking crosses 0.10`, !!stated);
  if (stated) {
    ok(`the balance card says smoking crosses 0.10 in "${stated[1]}" of ${stated[2]} ` +
       `panels; the data says ${WORDS[over] || over} of ${smds.length}`,
       stated[1] === (WORDS[over] || String(over)) && Number(stated[2]) === smds.length);
  }
}

// ---- 5. text rules a clinical reader depends on ---------------------------
// A reader sees the markup AND the labels app.js generates, so the acronym rule
// applies to the union. Checking index.html alone reported RSF as undefined
// while its expansion sat in the method tooltip two files away.
const text = htmlSrc.replace(/<[^>]+>/g, " ");
const visibleText = text + " " + appSrc;
ok("index.html contains an em dash (U+2014); the house rule is en dash, hyphen or a comma",
   !/—/.test(htmlSrc));
for (const [acr, expansion] of [
  ["CAST", "Causal Analysis for Survival Trajectories"],
  ["CSF", "causal survival forest"],
  ["RSF", "Random survival forest"]]) {
  const iExp = visibleText.toLowerCase().indexOf(expansion.toLowerCase());
  ok(`${acr} is used but never expanded as "${expansion}"`, iExp !== -1);
  // Where the acronym also appears in prose, the expansion must reach the reader
  // in the same breath rather than only in a tooltip elsewhere.
  if (acr !== "RSF") {
    const iAcr = text.indexOf(acr);
    if (iAcr !== -1) {
      const iExpHtml = text.toLowerCase().indexOf(expansion.toLowerCase());
      ok(`${acr} appears in the page text at ${iAcr} but is expanded only at ${iExpHtml}`,
         iExpHtml !== -1 && iExpHtml <= iAcr + expansion.length + 40);
    }
  }
}
// The parent README states that all forests are tuned. grf applies
// tune.parameters only when it estimates the propensity itself, and this
// pipeline supplies W.hat, so the causal survival forests run at defaults. This
// page must say so rather than repeat the claim. Asserted POSITIVELY: a
// "must not contain" check passes just as happily when the whole passage is
// deleted, which is the outcome it is meant to prevent.
ok("the page does not state that the causal survival forests are NOT tuned",
   /causal survival forests are <strong>not<\/strong> tuned/i.test(htmlSrc));
ok("the page does not explain why tuning did not apply (the supplied propensity)",
   /propensity is supplied/i.test(text));
ok("no named limitations section", /How to read this honestly/i.test(text));
ok("the limitations section does not carry the coverage figures",
   /id="cov-global"/.test(htmlSrc) && /id="cov-g0"/.test(htmlSrc) && /id="cov-g2"/.test(htmlSrc));
ok("the plot is not labelled in clinical units",
   /Extra survivors per 100 treated/.test(appSrc));
ok("style.css does not size the coverage cells", /\.cov\s+\.cell/.test(cssSrc));
// Shared data, not a copy: a second scenarios.json under docs/clinical/ could
// drift from the parent's and would make the two pages disagree.
ok("docs/clinical/ carries its own scenarios.json; it must share the parent's",
   !fs.existsSync(path.join(dir, "data", "scenarios.json")));
ok("app.js does not read the shared ../data/scenarios.json",
   appSrc.includes('fetch("../data/scenarios.json")'));

// ---- report ---------------------------------------------------------------
console.log(`clinical contract: ${path.relative(root, jsonPath)}`);
console.log(`  ${combos} control combinations, ${plotCalls} plot calls, ` +
            `coverage ${allHit}/${allN} overall, ${gMaxHit}/${gMaxN} at strongest hidden confounding`);
if (fail.length) {
  console.error(`clinical contract: FAIL (${fail.length})`);
  fail.forEach(f => console.error("  - " + f));
  process.exit(1);
}
console.log("  => PASS");
