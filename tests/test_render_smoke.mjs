// Render smoke test: run docs/app.js against a real scenarios.json in a minimal
// DOM shim and drive EVERY slider position, checking that each one produces a
// plot and fills every card.
//
// The data-contract test proves the JSON has the right fields. This proves the
// code that consumes them actually runs: it catches a typo'd element id, a card
// that throws on a null, a shape button that never wires up, and the class of
// break where the plot silently stays empty because render() returned early.
//
//   node tests/test_render_smoke.mjs [path/to/scenarios.json]

import fs from "fs";
import path from "path";
import vm from "vm";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const jsonPath = process.argv[2] || path.join(root, "docs", "data", "scenarios.json");
const appSrc = fs.readFileSync(path.join(root, "docs", "app.js"), "utf8");
const htmlSrc = fs.readFileSync(path.join(root, "docs", "index.html"), "utf8");
const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

const fail = [];

// ---- minimal DOM ---------------------------------------------------------
// Element ids come from the real index.html, so an id renamed in one file and
// not the other shows up here as a missing element rather than passing silently.
const ids = [...htmlSrc.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const classes = new Set([...htmlSrc.matchAll(/class="([^"]+)"/g)]
  .flatMap(m => m[1].split(/\s+/)));

function mkEl(tag = "div") {
  const el = {
    tagName: tag, children: [], dataset: {}, style: {}, title: "",
    _text: "", _html: "",
    classList: { _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); return c; }
  };
  Object.defineProperty(el, "textContent", {
    get() { return el._text; }, set(v) { el._text = String(v); } });
  Object.defineProperty(el, "innerHTML", {
    get() { return el._html; }, set(v) { el._html = String(v); } });
  return el;
}
const registry = new Map();
ids.forEach(i => registry.set(i, mkEl()));
const byClass = new Map();
classes.forEach(c => byClass.set("." + c, mkEl()));

const document = {
  getElementById: id => registry.get(id) || null,
  querySelector: sel => byClass.get(sel) || null,
  createElement: tag => mkEl(tag),
  createTextNode: t => ({ nodeType: 3, textContent: String(t) })
};

let plotCalls = 0, lastTraces = null;
const Plotly = { react(_id, traces) { plotCalls++; lastTraces = traces; } };
const fetch = () => Promise.resolve({ ok: true, json: async () => data });

const appErrors = [];
const sandbox = { document, Plotly, fetch, setTimeout, queueMicrotask,
  console: { error(e) { appErrors.push(String(e && e.message || e)); }, log() {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);

const EPILOGUE = "\n;globalThis.__api = { get state() { return state; }, render, init };";
try { vm.runInContext(appSrc + EPILOGUE, sandbox, { filename: "docs/app.js" }); }
catch (e) { fail.push(`app.js threw at load: ${e.message}`); }

// ---- drive every slider position ------------------------------------------
for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));  // drain the fetch chain
appErrors.forEach(e => fail.push(`app.js reported an error during init: ${e}`));
const api = sandbox.__api;
if (!api) fail.push("could not reach app.js internals (state/render)");

const shapes = data.shapes, confs = data.conf_grid, unmeas = data.unmeas_grid;
const cardIds = ["cox-hr", "cox-ph", "smd-text", "cast-text", "overlap-text",
                 "shrink-text", "unmeas-text", "conf-label"];

if (plotCalls === 0) fail.push("init() never produced a plot (render() aborted?)");

let combos = 0;
for (let si = 0; si < shapes.length; si++) {
  for (let ci = 0; ci < confs.length; ci++) {
    for (let ui = 0; ui < unmeas.length; ui++) {
      combos++;
      const before = plotCalls;
      cardIds.forEach(id => { const e = registry.get(id); if (e) { e._text = ""; e._html = ""; } });
      const rb = byClass.get(".rmse-bars"); if (rb) { rb._html = ""; rb.children.length = 0; }
      const plotEl = registry.get("plot"); if (plotEl) plotEl._html = "";
      const label = `${shapes[si]} g=${confs[ci]} G=${unmeas[ui]}`;
      try {
        api.state.shape = shapes[si];
        api.state.confIdx = ci;
        api.state.unmeasIdx = ui;
        api.render();
      } catch (e) {
        fail.push(`render(${label}) threw: ${e.message}`);
        continue;
      }
      if (plotCalls === before) fail.push(`${label}: no plot drawn`);
      // the "no scenario" path writes into #plot instead of plotting
      if (plotEl && plotEl._html.includes("No scenario"))
        fail.push(`${label}: render() hit the missing-scenario path`);
      for (const id of cardIds) {
        const e = registry.get(id);
        if (!e) { fail.push(`${label}: element #${id} missing from index.html`); continue; }
        if (!e._text && !e._html) fail.push(`${label}: card #${id} left empty`);
      }
      if (rb) {
        if (rb.children.length !== 6)
          fail.push(`${label}: ${rb.children.length} RMSE rows, expected 6 methods`);
        else if (!rb.children.every(c => c._html.includes("rmse-fill")))
          fail.push(`${label}: an RMSE row has no bar`);
      }
      const named = (lastTraces || []).filter(t => t.name).map(t => t.name);
      for (const want of ["Truth", "Naive", "RSF S-learner", "RSF T-learner",
                          "Cox (marginal)", "CSF (points)", "CAST trajectory"])
        if (!named.includes(want)) fail.push(`${label}: trace "${want}" missing from the plot`);
    }
  }
}

const nButtons = registry.get("shape-buttons")?.children.length ?? 0;
if (nButtons !== shapes.length)
  fail.push(`shape buttons: ${nButtons}, expected ${shapes.length}`);
const nToggles = registry.get("method-toggles")?.children.length ?? 0;
if (nToggles !== 8) fail.push(`method toggles: ${nToggles}, expected 8`);
if (!registry.get("gen-stamp")?._text) fail.push("generation stamp never set");

console.log(`render smoke: ${jsonPath}`);
console.log(`  drove ${combos} slider combinations, ${plotCalls} plot calls`);
fail.forEach(f => console.log("  FAIL  " + f));
console.log(fail.length ? `  => ${fail.length} FAILURES` : "  => PASS");
process.exit(fail.length ? 1 : 0);
