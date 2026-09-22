/* Oncology framing of the CAST demo: two active options, not treatment vs none.
 *
 * Self-contained on purpose. docs/app.js serves the methods page and
 * docs/tutorial/ the illustrated walkthrough; both are left untouched so the
 * versions can diverge without any of them breaking the others. This file
 * reads the same frozen export, ../data/scenarios.json.
 *
 * Four deliberate departures from the sibling pages, each answering a defect
 * found when a clinician read them:
 *   1. CSF and CAST no longer share a colour, and CAST is the only filled band.
 *   2. Nothing is hover-only. Every value on the figure is also in a table.
 *   3. The interpretation line REFUSES to interpret when the scenario carries an
 *      unrecorded confounder, because the assumptions it would invoke are
 *      violated by construction at those settings.
 *   4. The horizon is chosen by the reader, not silently fixed at the middle of
 *      the grid.
 */

const COLORS = {
  truth:    "#111111",
  naive:    "#d55e00",
  cox:      "#9467bd",
  rsf:      "#0072b2",
  tlearner: "#cc79a7",
  csf:      "#009e73",
  cast:     "#00356b"
};

// Labels name what each estimator DOES. The estimator's own name is kept in the
// table header and the technical disclosure so a reader can move between the
// three versions of this site without a glossary.
const METHODS = [
  { key: "truth",    label: "The truth (known here)",  color: COLORS.truth,    dash: "solid"    },
  { key: "cast",     label: "CAST trajectory",         color: COLORS.cast,     dash: "solid"    },
  { key: "castci",   label: "CAST 95% band",           color: COLORS.cast,     dash: "solid"    },
  { key: "csf",      label: "Per-timepoint estimates", color: COLORS.csf,      dash: "markers"  },
  { key: "naive",    label: "No adjustment",           color: COLORS.naive,    dash: "dash"     },
  { key: "coxate",   label: "Cox regression",          color: COLORS.cox,      dash: "dot"      },
  { key: "rsf",      label: "ML, one model",           color: COLORS.rsf,      dash: "dashdot"  },
  { key: "tlearner", label: "ML, one per arm",         color: COLORS.tlearner, dash: "longdash" }
];

const SHAPE_WORDS = {
  plateau:  "Option A helps throughout",
  reversal: "Option A helps early, harms late"
};
const SHAPE_HINTS = {
  plateau: "The true survival difference stays positive at the displayed horizons. That alone does not establish proportional hazards.",
  reversal: "The true survival difference changes sign during follow-up. A constant treatment coefficient in this Cox model cannot represent that reversal."
};
const CONF_WORDS   = { "0": "None", "0.5": "Mild", "1": "Moderate", "2": "Strong" };
const UNMEAS_WORDS = { "0": "None", "0.75": "Moderate", "1.5": "Strong" };

const CONF_HINTS = {
  "0":"Recorded characteristics do not drive assignment at this setting. Assignment is randomized only when hidden confounding is also None.",
  "0.5":"Recorded characteristics mildly influence treatment assignment in this simulation.",
  "1":"Recorded age, stage, performance status and comorbidity influence assignment. This is a teaching setting, not a calibrated description of a typical registry.",
  "2":"Recorded characteristics strongly influence assignment. Check the overlap diagnostics alongside the estimates."
};
const UNMEAS_HINTS = {
  "0":"No hidden common cause of treatment and survival is active in this scenario. That assumption cannot be established from measured balance alone in real data.",
  "0.75":"An unrecorded fitness factor affects both assignment and survival. The fitted models do not receive it.",
  "1.5":"A stronger unrecorded fitness factor affects assignment and survival. Compare each estimate with the known truth; recorded-data diagnostics cannot rule this out."
};

const $ = id => document.getElementById(id);
const pp = v => v * 100;                       // probability -> per 100 patients
const fmt = (v, d = 1) => v.toFixed(d);
const signed = (v, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d);
const covers = (lo, hi, t) => lo <= t && t <= hi;

let DATA = null;
let state = {
  shape: "reversal", conf: 1, unmeas: 0, horizon: 60,
  visible: { truth: true, cast: true, castci: true, csf: true,
             naive: true, coxate: false, rsf: false, tlearner: false }
};

const key = s => `${s.shape}_conf${Number(s.conf).toFixed(2)}_unmeas${Number(s.unmeas).toFixed(2)}`;
const scenario = () => DATA.scenarios[key(state)];

/* ---------- coverage, computed here rather than transcribed ---------- */

// Per-panel hit counts for a named method's interval. Returned per panel so the
// clustering is visible to the caller: the five horizons inside a panel come
// from ONE simulated cohort and move together, so they are not five trials.
function panelCoverage(method, filter) {
  const out = [];
  for (const [name, s] of Object.entries(DATA.scenarios)) {
    if (filter && !filter(s)) continue;
    const lo = method === "cast" ? s.cast.lo : s.csf.lo;
    const hi = method === "cast" ? s.cast.hi : s.csf.hi;
    let hits = 0;
    for (let i = 0; i < s.truth.length; i++) if (covers(lo[i], hi[i], s.truth[i])) hits++;
    out.push({ name, hits, cells: s.truth.length });
  }
  return out;
}

function summarize(panels) {
  const hits = panels.reduce((a, p) => a + p.hits, 0);
  const cells = panels.reduce((a, p) => a + p.cells, 0);
  const p = cells ? hits / cells : 0;
  // Cluster (panel-level) standard error. A binomial SE over cells would treat
  // the five horizons in a panel as independent, which they are not.
  const k = panels.length;
  const props = panels.map(x => x.hits / x.cells);
  const varCl = k > 1 ? props.reduce((a, x) => a + (x - p) ** 2, 0) / (k * (k - 1)) : 0;
  const se = Math.sqrt(varCl);
  return { hits, cells, p, se, lo: Math.max(0, p - 1.96 * se), hi: Math.min(1, p + 1.96 * se) };
}

/* ---------- controls ---------- */

function buildSeg(hostId, values, words, onPick, current) {
  const host = $(hostId);
  host.innerHTML = "";
  for (const v of values) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = words[String(v)] ?? String(v);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(v === current));
    if (v === current) b.classList.add("on");
    b.addEventListener("click", () => onPick(v));
    host.appendChild(b);
  }
}

function buildToggles() {
  const host = $("method-toggles");
  host.innerHTML = "";
  for (const m of METHODS) {
    const id = `tog-${m.key}`;
    const wrap = document.createElement("label");
    wrap.setAttribute("for", id);
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.id = id; cb.checked = !!state.visible[m.key];
    cb.addEventListener("change", () => { state.visible[m.key] = cb.checked; render(); });
    const sw = document.createElement("span");
    sw.className = "swatch"; sw.style.background = m.color;
    wrap.append(cb, sw, document.createTextNode(m.label));
    host.appendChild(wrap);
  }
}

/* ---------- figure ---------- */

function line(x, y, name, color, width, dash) {
  return { x, y, name, mode: "lines", type: "scatter",
           line: { color, width, dash }, hovertemplate: "%{y:.1f} per 100 at %{x} mo<extra>" + name + "</extra>" };
}

function drawPlot() {
  const s = scenario();
  const h = DATA.horizons;
  const traces = [];

  if (state.visible.castci) {
    const t = s.cast.curve_t, lo = s.cast.curve_lo.map(pp), hi = s.cast.curve_hi.map(pp);
    traces.push({
      x: t.concat(t.slice().reverse()), y: hi.concat(lo.slice().reverse()),
      fill: "toself", fillcolor: "rgba(0,53,107,0.13)", line: { width: 0 },
      type: "scatter", name: "CAST 95% band", hoverinfo: "skip", showlegend: true
    });
  }
  if (state.visible.naive)    traces.push(line(h, s.naive.map(pp), "No adjustment", COLORS.naive, 2.2, "dash"));
  if (state.visible.coxate)   traces.push(line(h, s.cox.ate.map(pp), "Cox regression", COLORS.cox, 2.2, "dot"));
  if (state.visible.rsf)      traces.push(line(h, s.rsf.map(pp), "ML, one model", COLORS.rsf, 2.2, "dashdot"));
  if (state.visible.tlearner) traces.push(line(h, s.tlearner.map(pp), "ML, one per arm", COLORS.tlearner, 2.2, "longdash"));
  if (state.visible.csf) {
    traces.push({
      x: h, y: s.csf.ate.map(pp), name: "Per-timepoint estimates (CSF)",
      mode: "markers", type: "scatter",
      marker: { color: COLORS.csf, size: 10, symbol: "circle" },
      error_y: { type: "data", symmetric: false,
                 array: h.map((_, i) => pp(s.csf.hi[i] - s.csf.ate[i])),
                 arrayminus: h.map((_, i) => pp(s.csf.ate[i] - s.csf.lo[i])),
                 color: COLORS.csf, thickness: 1.6, width: 6 },
      hovertemplate: "%{y:.1f} per 100 at %{x} mo<extra>CSF</extra>"
    });
  }
  if (state.visible.cast)  traces.push(line(s.cast.curve_t, s.cast.curve_fit.map(pp), "CAST trajectory", COLORS.cast, 3.2, "solid"));
  if (state.visible.truth) traces.push({...line(h, s.truth.map(pp), "Truth at exported horizons", COLORS.truth, 1.4, "dot"), mode:"lines+markers", marker:{symbol:"diamond",size:8,color:COLORS.truth}});

  const layout = {
    // No Plotly title. Plotly lays a title out at its full string width and
    // never wraps it, so a long scenario name overflows the SVG on a phone.
    // The same text is an HTML caption below the figure, which does wrap.
    margin: { l: 62, r: 16, t: 16, b: 54 },
    xaxis: { title: "Months of follow-up", zeroline: false },
    yaxis: { title: "Survival difference, A minus B (per 100)", zeroline: true,
             zerolinecolor: "#9aa4b1", zerolinewidth: 1 },
    legend: { orientation: "h", y: -0.2 },
    paper_bgcolor: "#fff", plot_bgcolor: "#fff", hovermode: "closest"
  };
  Plotly.react("plot", traces, layout, { displayModeBar: false, responsive: true });
  const cap = $("plot-caption");
  if (cap) cap.textContent =
    `${SHAPE_WORDS[state.shape]}. Recorded imbalance: ` +
    `${CONF_WORDS[String(state.conf)].toLowerCase()}. Imbalance nobody recorded: ` +
    `${UNMEAS_WORDS[String(state.unmeas)].toLowerCase()}.`;
}

/* ---------- table: nothing is hover-only ---------- */

const TABLE_LABELS = ["Month", "Truth", "CSF", "CSF 95% interval", "CAST",
  "CAST 95% band", "No adjustment", "Cox", "ML, one model", "ML, one per arm"];

function drawTable() {
  const s = scenario();
  $("values-caption").textContent =
    `Difference between Option A and Option B, in extra survivors per 100, for the selected scenario (n = ${s.meta.n.toLocaleString()}).`;
  const body = $("values-body");
  body.replaceChildren();
  DATA.horizons.forEach((t, i) => {
    const cells = [
      String(t),
      signed(pp(s.truth[i])),
      signed(pp(s.csf.ate[i])),
      `${signed(pp(s.csf.lo[i]))} to ${signed(pp(s.csf.hi[i]))}`,
      signed(pp(s.cast.fit[i])),
      `${signed(pp(s.cast.lo[i]))} to ${signed(pp(s.cast.hi[i]))}`,
      signed(pp(s.naive[i])),
      signed(pp(s.cox.ate[i])),
      signed(pp(s.rsf[i])),
      signed(pp(s.tlearner[i]))
    ];
    const tr = document.createElement("tr");
    if (t === state.horizon) tr.classList.add("selected-row");
    cells.forEach((c, j) => {
      const el = document.createElement(j === 0 ? "th" : "td");
      if (j === 0) el.scope = "row";
      // On a phone the stylesheet stacks each row into label/value pairs and
      // reads the label from here, because ten numeric columns cannot fit a
      // 360px viewport and this page does not put values behind a scroll.
      el.setAttribute("data-label", TABLE_LABELS[j]);
      el.textContent = c;
      tr.appendChild(el);
    });
    body.appendChild(tr);
  });
}

/* ---------- cards ---------- */

function drawHeadline() {
  const s = scenario();
  const i = DATA.horizons.indexOf(state.horizon);
  const est = pp(s.cast.fit[i]), lo = pp(s.cast.lo[i]), hi = pp(s.cast.hi[i]);
  const tru = pp(s.truth[i]);

  $("headline").innerHTML =
    `${signed(est)} <span class="unit">per 100 at ${state.horizon} months</span>`;

  const hit = covers(s.cast.lo[i], s.cast.hi[i], s.truth[i]);
  const spansZero = lo <= 0 && hi >= 0;

  // The interpretation REFUSES when the scenario carries an unrecorded
  // confounder. At those settings the no-unmeasured-confounding assumption is
  // violated BY CONSTRUCTION, so a sentence of the form "favors Option A, under
  // the causal assumptions" asserts something the simulation has already broken.
  let verdict;
  if (state.unmeas > 0) {
    verdict = `<strong>This estimate should not be read as the causal effect.</strong> This ` +
      `cohort carries an unrecorded factor driving both the choice of option and ` +
      `survival, so the assumption that would license a causal reading is false ` +
      `here by construction. The number above is what an analyst would report ` +
      `without knowing that. The truth at this time is ${signed(tru)}.`;
  } else if (spansZero) {
    verdict = `The pointwise interval spans zero, so this does not establish an advantage ` +
      `for either option at this time. The truth is ${signed(tru)}, which is ` +
      `${hit ? "inside" : "<strong>outside</strong>"} the band.`;
  } else {
    verdict = `The fitted pointwise interval lies entirely ${est > 0 ? "above" : "below"} zero. The fitted contrast favors ` +
      `<strong>Option ${est > 0 ? "A" : "B"}</strong> at this time. The truth is ` +
      `${signed(tru)}, which is ${hit ? "inside" : "<strong>outside</strong>"} the band ` +
      `(${signed(lo)} to ${signed(hi)}). This is a pointwise result, not a claim across all follow-up times.`;
  }
  $("headline-hint").innerHTML = verdict;

}

function drawBaseline() {
  const i=DATA.horizons.indexOf(state.horizon), s0=pp(scenario().robustness.s0_baseline[i]);
  $("baseline-big").innerHTML = `${fmt(s0)} <span class="unit">of 100 at ${state.horizon} months among patients who received B</span>`;
  $("baseline-text").textContent = "This is an observed-arm Kaplan–Meier estimate, under its censoring assumptions. It is not the whole cohort’s survival under B. Do not add the adjusted A–B difference to this number to infer survival under A.";
}

function drawCoverage() {
  const s = scenario();
  const strip = $("cov-strip");
  strip.replaceChildren();
  let hits = 0;
  DATA.horizons.forEach((t, i) => {
    const ok = covers(s.cast.lo[i], s.cast.hi[i], s.truth[i]);
    if (ok) hits++;
    const cell = document.createElement("div");
    cell.className = `cov-cell ${ok ? "in" : "out"}`;
    cell.innerHTML = `<span class="cov-mo">${t} mo</span><span class="cov-mark">${ok ? "in" : "out"}</span>`;
    cell.title = `${t} months: truth ${signed(pp(s.truth[i]))}, band ${signed(pp(s.cast.lo[i]))} to ${signed(pp(s.cast.hi[i]))}`;
    strip.appendChild(cell);
  });
  $("cov-text").innerHTML = hits === DATA.horizons.length
    ? `All ${hits} bands in this scenario contain the truth.`
    : `<strong>${hits} of ${DATA.horizons.length}</strong> bands in this scenario contain the truth. ` +
      `An interval can miss because of bias, sampling variability or model approximation.`;
}

function drawRmse() {
  const s = scenario();
  const r = s.rmse;
  const rows = [
    ["No adjustment", r.naive, COLORS.naive],
    ["Cox regression", r.cox, COLORS.cox],
    ["ML, one model (RSF S-learner)", r.rsf, COLORS.rsf],
    ["ML, one per arm (RSF T-learner)", r.tlearner, COLORS.tlearner],
    ["Per-timepoint estimates (CSF)", r.csf, COLORS.csf],
    ["CAST trajectory", r.cast, COLORS.cast]
  ].filter(x => x[1] != null);

  const top = Math.max(...rows.map(x => x[1]));
  const best = Math.min(...rows.map(x => x[1]));
  const wrap = $("rmse-bars");
  wrap.replaceChildren();
  for (const [name, v, col] of rows) {
    const w = Math.max(2, Math.min(100, 100 * v / top));
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      `<span class="name">${name}</span>` +
      `<span class="track"><span class="fill" style="width:${w.toFixed(1)}%;background:${col}"></span></span>` +
      `<span class="val">${pp(v).toFixed(1)}</span>`;
    wrap.appendChild(row);
  }
  $("rmse-note").textContent = "Root mean squared error over the five exported horizons, in percentage points. This ranks methods for this draw only; it is not a repeated-simulation benchmark.";
}

function drawBalance() {
  const s = scenario();
  const m = s.meta;
  const rows = [
    ["Age", m.smd_age], ["Performance status", m.smd_ps],
    ["Comorbidity", m.smd_comorb], ["Smoking", m.smd_smoke]
  ].filter(x => x[1] != null);
  if (m.smd_u_hidden != null) rows.push(["Unrecorded fitness factor", m.smd_u_hidden]);

  const cap = Math.max(0.3, ...rows.map(x => Math.abs(x[1])));
  const wrap = $("smd-bars");
  wrap.replaceChildren();
  for (const [name, v] of rows) {
    const bad = Math.abs(v) > 0.1;
    const hidden = name.startsWith("Unrecorded");
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      `<span class="name">${name}${hidden ? ' <em>(no model sees this)</em>' : ""}</span>` +
      `<span class="track"><span class="fill" style="width:${(100 * Math.abs(v) / cap).toFixed(1)}%;` +
      `background:${hidden ? "#6b7280" : bad ? "var(--bad)" : "var(--good)"}"></span></span>` +
      `<span class="val">${v.toFixed(3)}</span>`;
    row.title = bad ? "Imbalanced: beyond 0.10" : "Within 0.10";
    wrap.appendChild(row);
  }
  const worst = rows.filter(x => !x[0].startsWith("Unrecorded"))
                    .reduce((a, b) => Math.abs(b[1]) > Math.abs(a[1]) ? b : a);
  $("smd-text").innerHTML =
    (Math.abs(worst[1]) > 0.1
      ? `The largest displayed recorded imbalance is ${worst[0].toLowerCase()} at ${worst[1].toFixed(3)}, beyond the 0.10 line. `
      : `None of the displayed recorded characteristics exceeds 0.10 in this scenario. `) +
    `<strong>Stage is missing from this card.</strong> The simulation gives stage ` +
    `a strong role in treatment assignment, but ` +
    `its standardized difference is never computed by the pipeline, so it cannot ` +
    `be shown. Stage is included in the fitted models, but no balance statistic for it is exported. ` +
    `Cohort: ${s.meta.n.toLocaleString()} patients, ` +
    `${(s.meta.treated_frac * 100).toFixed(0)}% received Option A, ` +
    `${(s.meta.event_rate * 100).toFixed(0)}% died during follow-up.`;
}

function drawOverlap() {
  const s = scenario();
  const o = s.overlap;
  const pctEx = 100 * (o.pct_extreme ?? 0);
  $("overlap-big").innerHTML =
    `${fmt(pctEx, 1)}% <span class="unit">of patients had an estimated propensity below 5% or above 95%</span>`;
  $("overlap-text").innerHTML =
    `Across the cohort, the estimated chance of receiving Option A ranges from ` +
    `${(o.min * 100).toFixed(1)}% to ${(o.max * 100).toFixed(1)}%. ` +
    `"Near-certain" means below 5% or above 95%. ` +
    "These estimated propensities describe recorded covariates; they do not prove positivity for unrecorded patient types or establish exchangeability.";
}

function drawHidden() {
  const s=scenario(), i=DATA.horizons.indexOf(state.horizon), rb=s.robustness;
  if(state.unmeas===0 || rb.shift==null){
    $("unmeas-big").innerHTML='None <span class="unit">active in this scenario</span>';
    $("unmeas-text").textContent="No hidden common cause is active. Change the hidden-confounding setting to compare fits with and without that additional information."; return;
  }
  const gap=pp(rb.shift[i]), omit=pp(rb.ate_omitU[i]), withU=pp(rb.ate_withU[i]);
  $("unmeas-big").innerHTML=`${signed(gap)} <span class="unit">pp difference between CSF fits without and with the hidden factor</span>`;
  $("unmeas-text").textContent=`At ${state.horizon} months, the estimate without the factor is ${signed(omit)}; with the factor it is ${signed(withU)}. Truth is ${signed(pp(s.truth[i]))}. This refit comparison includes estimation error in both fits; it is not an exact decomposition of confounding bias. The hidden factor is available to us only because this is a simulation.`;
}

function drawGlobalCoverage() {
  const all = summarize(panelCoverage("cast"));
  const g0  = summarize(panelCoverage("cast", s => s.meta.unmeas_strength === 0));
  const gHi = summarize(panelCoverage("cast", s => s.meta.unmeas_strength === Math.max(...DATA.unmeas_grid)));
  const pct = x => `${x.hits} of ${x.cells} (${(x.p * 100).toFixed(0)}%)`;
  $("cov-global").textContent = pct(all);
  $("cov-g0").textContent = pct(g0);
  $("cov-g2").textContent = pct(gHi);

}

/* ---------- reader paths ---------- */

// Data-driven: the button set and the itineraries live in the HTML, so adding
// or removing an audience is an HTML change. tests/test_oncology_contract.mjs
// pins the set so a path cannot silently disappear.
function wireReaderPaths() {
  const choices = [...document.querySelectorAll("[data-reader-path]")];
  const routes = [...document.querySelectorAll(".reader-itinerary")];
  const reset = $("reader-reset");
  if (!choices.length) return;

  function choose(path) {
    const selected = choices.find(b => b.dataset.readerPath === path) || null;
    for (const b of choices) b.setAttribute("aria-pressed", String(b === selected));
    const target = selected && selected.getAttribute("aria-controls");
    for (const r of routes) r.hidden = r.id !== target;
    reset.hidden = !selected;
    const route = target && $(target);
    $("reader-status").textContent = selected
      ? `${selected.textContent} path selected. ${route.querySelector("h3").textContent} Three suggested stops are below.`
      : "Choice cleared. You can read the whole page or choose another starting point.";
  }
  for (const b of choices) b.addEventListener("click", () => choose(b.dataset.readerPath));
  reset.addEventListener("click", () => choose(null));
}

/* ---------- render ---------- */

function render() {
  buildSeg("shape-buttons", DATA.shapes, SHAPE_WORDS, v => { state.shape = v; render(); }, state.shape);
  buildSeg("conf-buttons", DATA.conf_grid, CONF_WORDS, v => { state.conf = v; render(); }, state.conf);
  buildSeg("unmeas-buttons", DATA.unmeas_grid, UNMEAS_WORDS, v => { state.unmeas = v; render(); }, state.unmeas);
  buildSeg("horizon-buttons", DATA.horizons,
    Object.fromEntries(DATA.horizons.map(h => [String(h), `${h} mo`])),
    v => { state.horizon = v; render(); }, state.horizon);

  $("shape-hint").textContent = SHAPE_HINTS[state.shape] || "";
  $("conf-hint").textContent = CONF_HINTS[String(state.conf)] || "";
  $("unmeas-hint").textContent = UNMEAS_HINTS[String(state.unmeas)] || "";

  drawPlot();
  drawTable();
  drawHeadline();
  drawBaseline();
  drawCoverage();
  drawRmse();
  drawBalance();
  drawOverlap();
  drawHidden();
}

async function boot() {
  const res = await fetch("../data/scenarios.json");
  if (!res.ok) throw new Error(`scenarios.json: HTTP ${res.status}`);
  DATA = await res.json();
  if (!DATA.scenarios || !DATA.horizons) throw new Error("scenarios.json is missing required fields");
  if (!DATA.horizons.includes(state.horizon)) state.horizon = DATA.horizons[Math.floor(DATA.horizons.length / 2)];
  buildToggles();
  wireReaderPaths();
  drawGlobalCoverage();
  render();
}

if (typeof document !== "undefined" && typeof window !== "undefined" && window.__ONCOLOGY_TEST__ !== true) {
  boot().catch(e => {
    const p = document.getElementById("plot");
    if (p) p.innerHTML = `<p class="load-error">Could not load the simulated results: ${e.message}</p>`;
  });
}
