// Render smoke test: run docs/app.js against a real scenarios.json in a minimal
// DOM shim and drive EVERY confounding-level combination through the page's own
// controls, checking that each one produces a plot and fills every card.
//
// The data-contract test proves the JSON has the right fields. This proves the
// code that consumes them actually runs: it catches a typo'd element id, a card
// that throws on a null, a shape button that never wires up, and the class of
// break where the plot silently stays empty because render() returned early.
//
//   node tests/test_render_smoke.mjs [path/to/scenarios.json]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
    type: "", name: "", id: "", value: "", checked: false, htmlFor: "",
    _text: "", _html: "",
    classList: { _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); return c; }
  };
  Object.defineProperty(el, "textContent", {
    get() { return el._text; }, set(v) { el._text = String(v); } });
  // Setting innerHTML replaces the children in a real DOM. The shim used to keep
  // them, which was invisible while each state was rendered once and became a
  // phantom "18 RMSE rows" the moment a state was rendered three times.
  Object.defineProperty(el, "innerHTML", {
    get() { return el._html; },
    set(v) { el._html = String(v); el.children.length = 0; } });
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

// ---- drive every confounding-level combination ----------------------------
for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));  // drain the fetch chain
appErrors.forEach(e => fail.push(`app.js reported an error during init: ${e}`));
const api = sandbox.__api;
if (!api) fail.push("could not reach app.js internals (state/render)");

const shapes = data.shapes, confs = data.conf_grid, unmeas = data.unmeas_grid;
const cardIds = ["cox-hr", "cox-ph", "smd-text", "cast-text", "overlap-text",
                 "shrink-text", "unmeas-text", "conf-label"];

if (plotCalls === 0) fail.push("init() never produced a plot (render() aborted?)");

// ---- the confounding axes are options, not a range input --------------------
// A four-stop slider promised a continuum the precomputed grid does not have.
// These assertions pin the replacement: one option per exported level, each one
// wired to render().
function radios(containerId) {
  return (registry.get(containerId)?.children ?? []).filter(c => c.type === "radio");
}
function pick(containerId, i) {
  const rs = radios(containerId);
  if (!rs.length) return;                       // hidden single-level axis
  rs.forEach((r, j) => { r.checked = j === i; });
  if (typeof rs[i]?.onchange !== "function")
    throw new Error(`${containerId} option ${i} has no onchange handler`);
  rs[i].onchange();
}
for (const [id, g, what] of [["conf-buttons", confs, "measured"],
                             ["unmeas-buttons", unmeas, "unmeasured"]]) {
  const n = radios(id).length;
  const want = g.length > 1 || id === "conf-buttons" ? g.length : 0;
  if (n !== want)
    fail.push(`#${id}: ${n} ${what}-confounding options, expected ${want}`);
  const labels = (registry.get(id)?.children ?? []).filter(c => c.tagName === "label");
  if (labels.length !== n)
    fail.push(`#${id}: ${n} options but ${labels.length} labels`);
  if (labels.some(l => !l._text))
    fail.push(`#${id}: an option has no label text`);
}
if (htmlSrc.includes('id="conf-slider"') || htmlSrc.includes('id="unmeas-slider"'))
  fail.push("a confounding range input is back in index.html; the axes are discrete");

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
        // Go through the controls' own handlers rather than assigning the index
        // directly: this is what proves the segmented options are wired to
        // render(), which assigning state would hide.
        pick("conf-buttons", ci);
        pick("unmeas-buttons", ui);
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

// ---- the cards are grouped, and each one opens from its own title ---------
// Structure checks on index.html itself: the layout is CSS, so the only thing a
// DOM shim can prove is that the markup the CSS targets is actually there.
const groups = [...htmlSrc.matchAll(/<section class="card-group">([\s\S]*?)<\/section>/g)];
if (groups.length < 2)
  fail.push(`cards: ${groups.length} card-group section(s); the cards are meant to be grouped`);
for (const [i, g] of groups.entries()) {
  if (!/<h2>/.test(g[1])) fail.push(`card group ${i + 1} has no heading, so its cards have no label`);
}
// Each card is ONE <details> whose control is its own <h3> title. The live
// numbers ride INSIDE the <summary>, which is what a closed card shows: a reader
// scanning seven cards sees seven headline numbers, not seven essays, and
// reaches the prose by clicking the title.
const cardBlocks = [...htmlSrc.matchAll(
  /<details class="card" id="(card-[\w-]+)">([\s\S]*?)\n *<\/details>/g)];
if (cardBlocks.length !== 7)
  fail.push(`matched ${cardBlocks.length} cards, expected 7`);
for (const [, id, body] of cardBlocks) {
  const sum = body.match(/<summary>([\s\S]*?)<\/summary>/);
  if (!sum) { fail.push(`#${id} has no <summary>, so its title is not a control`); continue; }
  if (!/<h3>[^<]+<\/h3>/.test(sum[1]))
    fail.push(`#${id}: the <summary> carries no <h3>, so the card title is not what opens it`);
  if (!body.includes('<ul class="brief">'))
    fail.push(`#${id} has no brief bullet list, so it opens as a wall of text`);
  if (/<details/.test(body))
    fail.push(`#${id} nests a second disclosure; one card is one click`);
  // The live numbers must be INSIDE the summary: they are what the card is for,
  // and a reader should not have to open it to see them.
  const summaryEnd = body.indexOf("</summary>");
  for (const m of body.matchAll(/id="([\w-]+(?:-text|-hr|-ph))"/g))
    if (m.index > summaryEnd)
      fail.push(`#${id}: live value #${m[1]} is hidden until the card is opened`);
  if (id === "card-rmse" && body.indexOf('class="rmse-bars"') > summaryEnd)
    fail.push("#card-rmse: the bars are hidden until the card is opened");
  // <summary> takes phrasing content plus headings. A <p> or <div> there is
  // invalid, and is exactly what a careless re-edit would reintroduce.
  for (const bad of ["<p ", "<p>", "<div ", "<div>", "<ul"])
    if (sum[1].includes(bad))
      fail.push(`#${id}: <summary> contains ${bad.trim()}>, which its content model does not allow`);
  // ...and the prose has to be somewhere, namely after the summary.
  if (!/<p class="hint">/.test(body.slice(summaryEnd)))
    fail.push(`#${id} has no prose after its summary; the explanation was lost, not collapsed`);
}

const nButtons = registry.get("shape-buttons")?.children.length ?? 0;
if (nButtons !== shapes.length)
  fail.push(`shape buttons: ${nButtons}, expected ${shapes.length}`);
const nToggles = registry.get("method-toggles")?.children.length ?? 0;
if (nToggles !== 8) fail.push(`method toggles: ${nToggles}, expected 8`);
if (!registry.get("gen-stamp")?._text) fail.push("generation stamp never set");

console.log(`render smoke: ${jsonPath}`);
console.log(`  drove ${combos} control combinations, ${plotCalls} plot calls`);
fail.forEach(f => console.log("  FAIL  " + f));
console.log(fail.length ? `  => ${fail.length} FAILURES` : "  => PASS");
process.exit(fail.length ? 1 : 0);
