// Contract + render tests for the oncology-framed page (docs/oncology/).
//
// WHY A SEPARATE SUITE. docs/oncology/ shares scenarios.json with the other two
// versions but carries five things neither of them has, each of which was added
// to answer a defect a clinician found in the siblings. Every one is pinned
// here, because a framing decision that nothing checks is a framing decision
// that quietly reverts:
//
//   1. FIVE reader paths with a clinician FIRST. The sibling walkthrough asks
//      "How would you describe yourself?" and offers an oncologist no answer.
//      Nothing pinned that set, so nothing would notice it shrinking again.
//   2. Option A / Option B, never treatment / control. Oncology compares two
//      active options; "control" implies a no-treatment reference that the
//      estimand never required.
//   3. The interpretation line REFUSES to interpret when the scenario carries
//      an unrecorded confounder. The sibling walkthrough asserts "under the
//      causal assumptions" at settings where the simulation has broken them.
//   4. Nothing is hover-only: every figure value is also in the table.
//   5. CSF and CAST do not share a colour, and the hidden-factor card does not
//      flip sign between its headline and its body.
//
//   node tests/test_oncology_contract.mjs [path/to/scenarios.json]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "docs", "oncology");
const jsonPath = process.argv.slice(2).find(a => !a.startsWith("--")) ||
  path.join(root, "docs", "data", "scenarios.json");

// Mutation hooks. --mutate=<name> deliberately breaks one thing so the group
// that guards it can be OBSERVED failing. A check only ever seen passing is not
// known to be a check.
const MUTATE = (process.argv.find(a => a.startsWith("--mutate=")) || "").split("=")[1] || "";

let appSrc = fs.readFileSync(path.join(dir, "app.js"), "utf8");
let htmlSrc = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const cssSrc = fs.readFileSync(path.join(dir, "style.css"), "utf8");
const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

if (MUTATE === "drop-clinician-path") {
  htmlSrc = htmlSrc.replace(
    /<button type="button" data-reader-path="clinician"[\s\S]*?<\/button>\s*/, "");
}
if (MUTATE === "reinstate-control") {
  // Re-introduce treatment/control arm language, which is what this page exists
  // to replace. One occurrence is enough: the guard is about the WORD appearing
  // as an arm label at all, not about how often.
  const before = htmlSrc;
  htmlSrc = htmlSrc.replace(/Option B/, "the control group");
  if (htmlSrc === before) throw new Error("mutation reinstate-control was a no-op; it proves nothing");
}
if (MUTATE === "interpret-anyway") {
  appSrc = appSrc.replace("if (state.unmeas > 0) {", "if (false) {");
}
if (MUTATE === "share-colour") {
  appSrc = appSrc.replace('cast:     "#00356b"', 'cast:     "#009e73"');
}
if (MUTATE === "flip-hidden-sign") {
  appSrc = appSrc.replace("const shift  = pp(rb.shift[i]);", "const shift  = -pp(rb.shift[i]);");
}
if (MUTATE === "binomial-ci") {
  appSrc = appSrc.replace(
    "const varCl = k > 1 ? props.reduce((a, x) => a + (x - p) ** 2, 0) / (k * (k - 1)) : 0;",
    "const varCl = p * (1 - p) / cells;");
}
if (MUTATE === "drop-table-rows") {
  appSrc = appSrc.replace("DATA.horizons.forEach((t, i) => {", "DATA.horizons.slice(0, 1).forEach((t, i) => {");
}

const fail = [];
const pass = [];
const ok = (msg, cond) => { cond ? pass.push(msg) : fail.push(msg); };

/* ---------------- minimal DOM ---------------- */

function mkEl(tag = "div") {
  const el = {
    tagName: tag, children: [], dataset: {}, style: {}, title: "", scope: "",
    type: "", id: "", value: "", checked: false, hidden: false,
    _text: "", _html: "", _attrs: {}, _listeners: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { cs.forEach(c => this.children.push(c)); },
    replaceChildren(...cs) { this.children.length = 0; cs.forEach(c => this.children.push(c)); },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    addEventListener(ev, fn) { (this._listeners[ev] ||= []).push(fn); },
    click() { (this._listeners.click || []).forEach(f => f()); },
    querySelector() { return mkEl(); }
  };
  Object.defineProperty(el, "textContent", {
    get: () => el._text || el.children.map(c => c.textContent || "").join(""),
    set: v => { el._text = String(v); el.children.length = 0; }
  });
  Object.defineProperty(el, "innerHTML", {
    get: () => el._html, set: v => { el._html = String(v); el.children.length = 0; }
  });
  return el;
}

const ids = [...htmlSrc.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const registry = new Map();
ids.forEach(i => { const e = mkEl(); e.id = i; registry.set(i, e); });

// Reader-path buttons and itineraries, built from the HTML so the app sees the
// real set rather than one the test invented.
const pathOrder = [...htmlSrc.matchAll(/data-reader-path="([^"]+)"[^>]*aria-controls="([^"]+)"/g)]
  .map(m => ({ path: m[1], controls: m[2] }));
const readerButtons = pathOrder.map(p => {
  const b = mkEl("button");
  b.dataset.readerPath = p.path;
  b.setAttribute("aria-controls", p.controls);
  b.setAttribute("aria-pressed", "false");
  b._text = p.path;
  return b;
});
const itineraryEls = [...htmlSrc.matchAll(/class="reader-itinerary" id="([^"]+)"/g)].map(m => {
  const e = registry.get(m[1]) || mkEl();
  e.id = m[1];
  e.querySelector = () => ({ textContent: "heading" });
  registry.set(m[1], e);
  return e;
});

const document = {
  getElementById: id => registry.get(id) || null,
  createElement: tag => mkEl(tag),
  createTextNode: t => ({ nodeType: 3, textContent: String(t) }),
  querySelectorAll(sel) {
    if (sel === "[data-reader-path]") return readerButtons;
    if (sel === ".reader-itinerary") return itineraryEls;
    return [];
  }
};

let lastTraces = null, plotCalls = 0;
const Plotly = { react(_id, traces) { plotCalls++; lastTraces = traces; } };
const appErrors = [];
const sandbox = {
  document, Plotly,
  fetch: () => Promise.resolve({ ok: true, json: async () => data }),
  setTimeout, queueMicrotask,
  console: { error(e) { appErrors.push(String((e && e.message) || e)); }, log() {} }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const EPILOGUE = `
;globalThis.__api = { get state(){return state;}, get DATA(){return DATA;},
  render, drawHidden, drawHeadline, COLORS, summarize, panelCoverage };`;
try { vm.runInContext(appSrc + EPILOGUE, sandbox, { filename: "docs/oncology/app.js" }); }
catch (e) { fail.push(`oncology app.js threw at load: ${e.message}`); }
for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r));
appErrors.forEach(e => fail.push(`app.js reported an error during init: ${e}`));

const api = sandbox.__api;
ok("reached docs/oncology/app.js internals", !!api);
if (!api) { report(); process.exit(1); }

const txt = id => { const e = registry.get(id); return e ? (e._html || e._text || "") : ""; };
const HZ = data.horizons;
const pp = v => v * 100;
const signedStr = (v, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d);

/* ---------------- 1. reader paths (the pin) ---------------- */

const EXPECTED_PATHS = ["clinician", "student", "researcher", "convert", "educator"];
ok(`the page offers exactly ${EXPECTED_PATHS.length} reader paths (found ${pathOrder.length})`,
  pathOrder.length === EXPECTED_PATHS.length);
ok(`the reader-path set is exactly ${EXPECTED_PATHS.join(", ")} (found ${pathOrder.map(p => p.path).join(", ")})`,
  JSON.stringify(pathOrder.map(p => p.path)) === JSON.stringify(EXPECTED_PATHS));
ok("a clinician path exists at all -- the sibling walkthrough offers an oncologist no answer",
  pathOrder.some(p => p.path === "clinician"));
ok("the clinician path is FIRST in document order",
  pathOrder.length > 0 && pathOrder[0].path === "clinician");
ok("the clinician button is labelled for a clinical reader",
  /data-reader-path="clinician"[^>]*>\s*Clinician or oncologist\s*</.test(htmlSrc));
for (const p of pathOrder) {
  ok(`reader path "${p.path}" points at an itinerary that exists (#${p.controls})`,
    new RegExp(`class="reader-itinerary" id="${p.controls}"`).test(htmlSrc));
}
// The status string the app announces promises "Three suggested stops", so an
// itinerary with a different count makes the page lie to a screen reader.
for (const m of htmlSrc.matchAll(/class="reader-itinerary" id="(path-[^"]+)"([\s\S]*?)<\/ol>/g)) {
  const stops = (m[2].match(/<li>/g) || []).length;
  ok(`itinerary #${m[1]} has exactly three stops (found ${stops}), as the announced status claims`, stops === 3);
}
const noscriptLinks = (htmlSrc.match(/reader-fallback[\s\S]*?<\/nav>/)?.[0].match(/<a /g) || []).length;
ok(`the no-JavaScript fallback offers all ${EXPECTED_PATHS.length} paths (found ${noscriptLinks})`,
  noscriptLinks === EXPECTED_PATHS.length);

/* ---------------- 2. Option A / Option B framing ---------------- */

const ARM_AS_CONTROL = /\bcontrol (arm|group|patients|subjects)\b|\btreatment (vs\.?|versus) control\b|\bversus control\b|\bthe control\b/i;
const htmlProse = htmlSrc.replace(/<!--[\s\S]*?-->/g, "");
ok(`index.html never labels an arm "control" (oncology compares two active options)`,
  !ARM_AS_CONTROL.test(htmlProse));
const appProse = appSrc.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
ok(`app.js never labels an arm "control" in reader-facing strings`,
  !ARM_AS_CONTROL.test(appProse));
const aCount = (htmlSrc.match(/Option A/g) || []).length;
const bCount = (htmlSrc.match(/Option B/g) || []).length;
ok(`index.html uses "Option A" as the arm label (${aCount} uses, need >= 10)`, aCount >= 10);
ok(`index.html uses "Option B" as the arm label (${bCount} uses, need >= 10)`, bCount >= 10);
ok("the page explains WHY it says Option A and Option B rather than treatment and control",
  /why this page says option a and option b/i.test(htmlSrc));
ok("the page names real oncology comparisons the framing covers",
  /fractionation|chemoradiation/i.test(htmlSrc));
ok("the technical section states that relabelling changes no computation",
  /requires\s+either\s+arm\s+to\s+be\s+untreated/i.test(htmlSrc));

/* ---------------- 3. refuse to interpret under hidden confounding ---------------- */

const REFUSAL = /should not be interpreted/i;
function setScenario(shape, conf, unmeas, horizon) {
  api.state.shape = shape; api.state.conf = conf; api.state.unmeas = unmeas;
  if (horizon != null) api.state.horizon = horizon;
  api.render();
}
let refusedWhenItShould = 0, refusedWhenItShouldNot = 0, panelsWithU = 0, panelsWithoutU = 0;
for (const shape of data.shapes) {
  for (const conf of data.conf_grid) {
    for (const unmeas of data.unmeas_grid) {
      for (const h of HZ) {
        setScenario(shape, conf, unmeas, h);
        const hint = txt("headline-hint");
        if (unmeas > 0) { panelsWithU++; if (REFUSAL.test(hint)) refusedWhenItShould++; }
        else { panelsWithoutU++; if (REFUSAL.test(hint)) refusedWhenItShouldNot++; }
      }
    }
  }
}
ok(`the headline refuses to interpret at every setting with an unrecorded confounder (${refusedWhenItShould}/${panelsWithU})`,
  refusedWhenItShould === panelsWithU && panelsWithU > 0);
ok(`the headline still interprets when nothing is unrecorded (${panelsWithoutU - refusedWhenItShouldNot}/${panelsWithoutU})`,
  refusedWhenItShouldNot === 0 && panelsWithoutU > 0);
ok("the page carries an on-page warning that a peak is not a stopping time",
  /a peak is not a stopping\s*\n?\s*time/i.test(htmlSrc) || /peak is not a stopping/i.test(htmlSrc));

/* ---------------- 4. hidden-factor card: one sign, not two ---------------- */

let signChecked = 0;
for (const shape of data.shapes) {
  for (const conf of data.conf_grid) {
    for (const unmeas of data.unmeas_grid.filter(u => u > 0)) {
      for (const h of HZ) {
        setScenario(shape, conf, unmeas, h);
        const s = data.scenarios[`${shape}_conf${conf.toFixed(2)}_unmeas${unmeas.toFixed(2)}`];
        const i = HZ.indexOf(h);
        const shift = pp(s.robustness.shift[i]);
        const big = txt("unmeas-big");
        const body = txt("unmeas-text");
        ok(`hidden card headline shows the bias with the data's own sign at ${shape}/${conf}/${unmeas}/${h}mo`,
          big.includes(signedStr(shift)));
        const saysOver = /overstates/.test(body), saysUnder = /understates/.test(body);
        ok(`hidden card body direction agrees with its own headline at ${shape}/${conf}/${unmeas}/${h}mo`,
          (shift > 0 && saysOver && !saysUnder) || (shift < 0 && saysUnder && !saysOver) || shift === 0);
        ok(`hidden card quotes both endpoints at ${shape}/${conf}/${unmeas}/${h}mo`,
          body.includes(signedStr(pp(s.robustness.ate_omitU[i]))) &&
          body.includes(signedStr(pp(s.robustness.ate_withU[i]))));
        ok(`hidden card keeps the "component, not the whole error" caveat at ${shape}/${conf}/${unmeas}/${h}mo`,
          /component of the error, not the whole/i.test(body));
        signChecked++;
      }
    }
  }
}
ok(`the hidden-factor card was exercised on every panel that has one (${signChecked})`, signChecked === 2 * 4 * 2 * HZ.length);

/* ---------------- 5. nothing is hover-only ---------------- */

setScenario("reversal", 1, 0, 60);
const tableText = registry.get("values-body").children.map(r =>
  r.children.map(c => c.textContent).join(" ")).join(" | ");
const s0 = data.scenarios["reversal_conf1.00_unmeas0.00"];
let missing = 0;
HZ.forEach((t, i) => {
  for (const [name, v] of [["truth", s0.truth[i]], ["csf", s0.csf.ate[i]], ["cast", s0.cast.fit[i]],
                            ["naive", s0.naive[i]], ["cox", s0.cox.ate[i]],
                            ["rsf", s0.rsf[i]], ["tlearner", s0.tlearner[i]]]) {
    if (!tableText.includes(signedStr(pp(v)))) { missing++; }
  }
});
ok(`every figure value at every horizon also appears in the table (${missing} missing)`, missing === 0);
ok(`the table lists one row per horizon (${registry.get("values-body").children.length})`,
  registry.get("values-body").children.length === HZ.length);
ok("the table carries the machine-learning baselines the sibling walkthrough ships but never displays",
  /ML, one model/.test(htmlSrc) && /ML, one per arm/.test(htmlSrc));

/* ---------------- 6. CSF and CAST are distinguishable ---------------- */

ok(`CSF and CAST do not share a colour (csf ${api.COLORS.csf}, cast ${api.COLORS.cast})`,
  api.COLORS.csf.toLowerCase() !== api.COLORS.cast.toLowerCase());
ok("the stylesheet declares the same two colours as distinct",
  /--csf:\s*([#\w]+)/.exec(cssSrc)?.[1]?.toLowerCase() !== /--cast:\s*([#\w]+)/.exec(cssSrc)?.[1]?.toLowerCase());
ok("CSF is drawn as markers and CAST as a line, so the two never rely on colour alone",
  lastTraces.some(t => t.mode === "markers") && lastTraces.some(t => t.mode === "lines"));

/* ---------------- 7. coverage, recomputed independently ---------------- */

// Deliberately not the page's own helper: a test that calls the code under test
// and compares it with itself cannot fail for the reason that matters.
function coverageOver(filter) {
  const panels = [];
  for (const s of Object.values(data.scenarios)) {
    if (filter && !filter(s)) continue;
    let hits = 0;
    s.truth.forEach((t, i) => { if (s.cast.lo[i] <= t && t <= s.cast.hi[i]) hits++; });
    panels.push({ hits, cells: s.truth.length });
  }
  const hits = panels.reduce((a, x) => a + x.hits, 0);
  const cells = panels.reduce((a, x) => a + x.cells, 0);
  const p = hits / cells, k = panels.length;
  const props = panels.map(x => x.hits / x.cells);
  const se = Math.sqrt(props.reduce((a, x) => a + (x - p) ** 2, 0) / (k * (k - 1)));
  return { hits, cells, p, lo: Math.max(0, p - 1.96 * se), hi: Math.min(1, p + 1.96 * se) };
}
const gmax = Math.max(...data.unmeas_grid);
const all = coverageOver();
const g0 = coverageOver(s => s.meta.unmeas_strength === 0);
const gH = coverageOver(s => s.meta.unmeas_strength === gmax);
ok(`#cov-global reports ${all.hits} of ${all.cells}; page says "${txt("cov-global")}"`,
  txt("cov-global").includes(`${all.hits} of ${all.cells}`));
ok(`#cov-g0 reports ${g0.hits} of ${g0.cells}; page says "${txt("cov-g0")}"`,
  txt("cov-g0").includes(`${g0.hits} of ${g0.cells}`));
ok(`#cov-g2 reports ${gH.hits} of ${gH.cells}; page says "${txt("cov-g2")}"`,
  txt("cov-g2").includes(`${gH.hits} of ${gH.cells}`));
const ciWanted = `${(all.lo * 100).toFixed(0)}% to ${(all.hi * 100).toFixed(0)}%`;
ok(`#cov-ci reports the CLUSTER interval ${ciWanted}; page says "${txt("cov-ci")}"`,
  txt("cov-ci") === ciWanted);
// The cluster interval must be genuinely wider than a naive binomial one, or the
// page is making the same independence claim it exists to retract.
const binSe = Math.sqrt(all.p * (1 - all.p) / all.cells);
ok(`the reported interval is wider than a binomial one over cells (cluster ${(all.hi - all.lo).toFixed(3)} vs binomial ${(2 * 1.96 * binSe).toFixed(3)})`,
  (all.hi - all.lo) > 2 * 1.96 * binSe * 1.2);
ok("the page states in words that the 120 cells are 24 draws",
  /120 cells are 24 simulated cohorts/i.test(htmlSrc));

/* ---------------- 8. number needed to treat ---------------- */

let nntChecked = 0, nntBad = 0;
for (const h of HZ) {
  setScenario("plateau", 1, 0, h);
  const s = data.scenarios["plateau_conf1.00_unmeas0.00"];
  const est = pp(s.cast.fit[HZ.indexOf(h)]);
  const t = txt("nnt-text");
  if (Math.abs(est) >= 0.5) {
    const nnt = Math.abs(100 / est);
    const wanted = nnt < 10 ? nnt.toFixed(1) : String(Math.round(nnt));
    if (!t.includes(wanted)) nntBad++;
    nntChecked++;
  }
}
ok(`the number needed to treat is 100/|difference| at every checked horizon (${nntChecked} checked, ${nntBad} wrong)`,
  nntChecked > 0 && nntBad === 0);
ok("the page says the number needed to treat comes from the difference alone, not from the arm survival",
  /adjusted difference alone/i.test(appSrc));

/* ---------------- 9. baseline anchor is labelled unadjusted ---------------- */

setScenario("plateau", 2, 0, 60);
const sB = data.scenarios["plateau_conf2.00_unmeas0.00"];
ok(`the Option B survival shown is the exported Kaplan-Meier value`,
  txt("baseline-big").includes(pp(sB.robustness.s0_baseline[HZ.indexOf(60)]).toFixed(1)));
ok("the baseline card states that this arm survival is unadjusted and therefore biased under confounding",
  /is not adjusted/i.test(txt("baseline-text")));

/* ---------------- 10. reader-facing text rules ---------------- */

ok("no em dash anywhere in the page", !htmlSrc.includes("—") && !appSrc.includes("—"));
ok("CSF is expanded on first use", /causal survival forest<\/strong>\s*\(CSF\)|causal survival forest.{0,40}\(CSF\)/is.test(htmlSrc));
ok("CAST is expanded on first use", /CAST<\/strong>\s*\(Causal Analysis for Survival Trajectories\)/i.test(htmlSrc));
ok("the page explains what a forest IS, not only what it does",
  /forest of decision trees/i.test(htmlSrc));
ok("the units are stated in words before the first number",
  /extra survivors per 100/i.test(htmlSrc));
ok("percentage points are spelled out rather than abbreviated to pp",
  !/\bpp\b/.test(htmlSrc.replace(/<code>[\s\S]*?<\/code>/g, "")));
ok("the page does NOT claim the causal survival forests are tuned",
  /causal survival forests are\s*<?\/?strong>?\s*not<\/strong>?\s*tuned|causal survival forests are not tuned/i.test(htmlSrc));
ok("the limitations disclose that stage is missing from the balance card",
  /stage is missing from this card|Stage is in the simulation and is not in the balance card/i.test(htmlSrc + txt("smd-text")));
ok("the limitations state the data are simulated and no real treatment is compared",
  /no real treatment is being\s*\n?\s*compared/i.test(htmlSrc));

/* ---------------- 11. the page renders at all 24 positions ---------------- */

let rendered = 0;
for (const shape of data.shapes) for (const conf of data.conf_grid) for (const unmeas of data.unmeas_grid) {
  setScenario(shape, conf, unmeas, HZ[2]);
  if (txt("headline") && txt("headline").includes("per 100")) rendered++;
}
ok(`the page fills its headline at all ${data.shapes.length * data.conf_grid.length * data.unmeas_grid.length} control positions (${rendered})`,
  rendered === data.shapes.length * data.conf_grid.length * data.unmeas_grid.length);
ok(`Plotly was asked to draw on every render (${plotCalls} calls)`, plotCalls > 24);

/* ---------------- report ---------------- */

function report() {
  const label = MUTATE ? `oncology contract [MUTATED: ${MUTATE}]` : "oncology contract";
  console.log(`${label}: ${dir}`);
  if (!MUTATE) for (const p of pass.slice(0, 0)) console.log(`  ok    ${p}`);
  for (const f of fail) console.log(`  FAIL  ${f}`);
  console.log(`${label}: ${fail.length ? `FAIL (${fail.length} failures, ${pass.length} passed)` : `PASS (${pass.length} checks, 0 failures)`}`);
}
report();
process.exit(fail.length ? 1 : 0);
