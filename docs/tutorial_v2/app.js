/* Oncology framing of the CAST demo: two active options, not treatment vs none.
 *
 * Self-contained on purpose. docs/app.js serves the methods page and
 * docs/clinical/app.js serves the clinical view; both are left untouched so the
 * three versions can diverge without any of them breaking the others. This file
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
  plateau:  "The more intensive option is protective across all of follow-up. " +
            "A single hazard ratio can describe this case.",
  reversal: "The more intensive option buys an early advantage and costs it back " +
            "later, so the survival curves cross. This is the case a single " +
            "hazard ratio cannot describe."
};
const CONF_WORDS   = { "0": "None", "0.5": "Mild", "1": "Moderate", "2": "Strong" };
const UNMEAS_WORDS = { "0": "None", "0.75": "Moderate", "1.5": "Strong" };

const CONF_HINTS = {
  "0":   "Both options were assigned at random. Nothing needs adjusting, and " +
         "this is the sanity check: a method that cannot get this right is not " +
         "going to get the harder panels right.",
  "0.5": "Mild selection: the fitter patients are somewhat more likely to " +
         "receive Option A. Comparable to a well-matched registry series.",
  "1":   "Moderate selection, and the default here. Age, performance status " +
         "and comorbidity all push the choice. This is what an ordinary " +
         "single-institution series looks like.",
  "2":   "Strong selection: the fittest patients almost always receive Option " +
         "A. Adjustment is working near the edge of what the data support."
};
const UNMEAS_HINTS = {
  "0":   "Everything that drives the choice of option is recorded and given to " +
         "the models. This is the assumption every adjusted analysis makes and " +
         "no real study can verify.",
  "0.75":"An unrecorded fitness factor is influencing both the choice and " +
         "survival. No model on this page can see it.",
  "1.5": "A strong unrecorded factor. Watch every method fail together while " +
         "the balance and overlap cards above still look healthy."
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
  if (state.visible.truth) traces.push(line(h, s.truth.map(pp), "The truth", COLORS.truth, 3, "solid"));

  const layout = {
    // No Plotly title. Plotly lays a title out at its full string width and
    // never wraps it, so a long scenario name overflows the SVG on a phone.
    // The same text is an HTML caption below the figure, which does wrap.
    margin: { l: 62, r: 16, t: 16, b: 54 },
    xaxis: { title: "Months of follow-up", zeroline: false },
    yaxis: { title: "Extra survivors per 100 given Option A", zeroline: true,
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
    verdict = `<strong>This estimate should not be interpreted.</strong> This ` +
      `cohort carries an unrecorded factor driving both the choice of option and ` +
      `survival, so the assumption that would license a causal reading is false ` +
      `here by construction. The number above is what an analyst would report ` +
      `without knowing that. The truth at this time is ${signed(tru)}.`;
  } else if (spansZero) {
    verdict = `The 95% band spans zero, so this does not establish an advantage ` +
      `for either option at this time. The truth is ${signed(tru)}, which is ` +
      `${hit ? "inside" : "<strong>outside</strong>"} the band.`;
  } else {
    verdict = `The band lies entirely ${est > 0 ? "above" : "below"} zero, favoring ` +
      `<strong>Option ${est > 0 ? "A" : "B"}</strong> at this time. The truth is ` +
      `${signed(tru)}, which is ${hit ? "inside" : "<strong>outside</strong>"} the band ` +
      `(${signed(lo)} to ${signed(hi)}).`;
  }
  $("headline-hint").innerHTML = verdict;

  // Number needed to treat, from the risk difference alone. NNT = 100/|diff per
  // 100| needs no baseline survival, so it does not mix the adjusted difference
  // with the unadjusted arm survival shown in the card beside it.
  if (Math.abs(est) < 0.5) {
    $("nnt-text").textContent =
      "The estimated difference is under half a patient per 100, too small for a " +
      "number needed to treat to be meaningful.";
  } else {
    const nnt = Math.abs(100 / est);
    const better = est > 0 ? "A" : "B";
    $("nnt-text").innerHTML =
      `That is a <strong>number needed to treat of about ${nnt < 10 ? nnt.toFixed(1) : Math.round(nnt)}</strong>: ` +
      `roughly ${nnt < 10 ? nnt.toFixed(1) : Math.round(nnt)} patients given Option ${better} ` +
      `instead of Option ${better === "A" ? "B" : "A"} for one extra survivor at ` +
      `${state.horizon} months. Derived from the adjusted difference alone.`;
  }
}

function drawBaseline() {
  const s = scenario();
  const i = DATA.horizons.indexOf(state.horizon);
  const s0 = pp(s.robustness.s0_baseline[i]);
  const diff = pp(s.cast.fit[i]);
  $("baseline-big").innerHTML =
    `${fmt(s0)} <span class="unit">of 100 alive on Option B at ${state.horizon} months</span>`;
  $("baseline-text").innerHTML =
    `Against that, a difference of ${signed(diff)} per 100 is ` +
    `${Math.abs(diff) / Math.max(s0, 1) > 0.25 ? "a large" : "a modest"} relative change. ` +
    `<em>This arm survival is the raw observed Kaplan&ndash;Meier figure in the ` +
    `Option B arm and is not adjusted</em>, so where the arms differ at baseline ` +
    `it is itself a biased picture of what Option B does. It is here as a scale ` +
    `anchor, not as an estimate.`;
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
      `A missed band is not a wide one. It is a narrow band in the wrong place.`;
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
  // A "times worse than best" multiple is deliberately NOT shown. On this grid
  // the best method is often under 1 patient per 100 from the truth, which is
  // inside the noise of a single simulated cohort, and dividing by it
  // manufactures ratios up to 36x out of the third decimal place of the export.
  const bestPP = pp(best);
  $("rmse-note").innerHTML =
    `Values are extra survivors per 100, averaged across follow-up. The best ` +
    `here is ${bestPP.toFixed(1)}. ` +
    (bestPP < 1
      ? `That is below one patient per 100, which is within the noise of a ` +
        `single simulated cohort, so read the ordering and not the gaps.`
      : `Differences smaller than about one patient per 100 are noise from this ` +
        `being a single simulated cohort.`);
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
      ? `The largest recorded imbalance is ${worst[0].toLowerCase()} at ${worst[1].toFixed(3)}, beyond the 0.10 line. `
      : `No recorded characteristic exceeds 0.10 in this scenario. `) +
    `<strong>Stage is missing from this card.</strong> The simulation gives stage ` +
    `the largest single influence on which option is chosen, larger than age, but ` +
    `its standardized difference is never computed by the pipeline, so it cannot ` +
    `be shown. An oncologist would look for it first, and it is not here. ` +
    `Cohort: ${s.meta.n.toLocaleString()} patients, ` +
    `${(s.meta.treated_frac * 100).toFixed(0)}% received Option A, ` +
    `${(s.meta.event_rate * 100).toFixed(0)}% died during follow-up.`;
}

function drawOverlap() {
  const s = scenario();
  const o = s.overlap;
  const pctEx = o.pct_extreme ?? 0;
  $("overlap-big").innerHTML =
    `${fmt(pctEx, 1)}% <span class="unit">of patients were near-certain to receive one option</span>`;
  $("overlap-text").innerHTML =
    `Across the cohort, the estimated chance of receiving Option A ranges from ` +
    `${(o.min * 100).toFixed(1)}% to ${(o.max * 100).toFixed(1)}%. ` +
    `"Near-certain" means below 5% or above 95%. ` +
    (pctEx < 1
      ? `Almost every patient could plausibly have received either option, so ` +
        `adjustment has comparable patients to learn from.`
      : `A visible group had little genuine choice, so for those patients the ` +
        `adjustment is extrapolating rather than comparing.`);
}

function drawHidden() {
  const s = scenario();
  const i = DATA.horizons.indexOf(state.horizon);
  const rb = s.robustness;
  const big = $("unmeas-big");

  if (state.unmeas === 0 || rb.shift == null) {
    big.innerHTML = `None <span class="unit">in this scenario</span>`;
    $("unmeas-text").innerHTML =
      `Every characteristic that drives the choice of option is recorded and ` +
      `given to the models. This is the assumption an adjusted analysis of real ` +
      `data has to make and can never check. Move the "imbalance nobody recorded" ` +
      `control above to see what happens when it is false.`;
    return;
  }

  // shift = ate_omitU - ate_withU, so it IS the bias in the reported estimate
  // caused by the factor being unrecorded. The headline and the body must carry
  // the same sign: the sibling clinical page printed +shift in the headline and
  // described a move of -shift two sentences later.
  const shift  = pp(rb.shift[i]);
  const omitU  = pp(rb.ate_omitU[i]);
  const withU  = pp(rb.ate_withU[i]);
  const tru    = pp(s.truth[i]);
  const ev     = rb.evalue ? rb.evalue[i] : null;

  big.innerHTML =
    `${signed(shift)} <span class="unit">per 100 of bias, from the factor nobody recorded</span>`;

  $("unmeas-text").innerHTML =
    `At ${state.horizon} months a model that cannot see the factor reports ` +
    `${signed(omitU)} per 100. Refitting with the factor supplied gives ` +
    `${signed(withU)}, so not seeing it ` +
    `${shift > 0 ? "<strong>overstates</strong>" : "<strong>understates</strong>"} ` +
    `the advantage of Option A by ${fmt(Math.abs(shift))} per 100. ` +
    `<strong>Read that as one component of the error, not the whole of it:</strong> ` +
    `the refitted estimate is still ${fmt(Math.abs(withU - tru))} per 100 away from ` +
    `the truth of ${signed(tru)}. ` +
    (ev ? `The E-value here is ${ev.toFixed(2)}: an unrecorded factor would need ` +
          `associations of about that size with both the choice and survival to ` +
          `explain the reported effect away. ` : "") +
    `No real analysis can perform this refit, because the factor is unrecorded ` +
    `by definition. Every card above still looks healthy.`;
}

function drawGlobalCoverage() {
  const all = summarize(panelCoverage("cast"));
  const g0  = summarize(panelCoverage("cast", s => s.meta.unmeas_strength === 0));
  const gHi = summarize(panelCoverage("cast", s => s.meta.unmeas_strength === Math.max(...DATA.unmeas_grid)));
  const pct = x => `${x.hits} of ${x.cells} (${(x.p * 100).toFixed(0)}%)`;
  $("cov-global").textContent = pct(all);
  $("cov-g0").textContent = pct(g0);
  $("cov-g2").textContent = pct(gHi);
  $("cov-ci").textContent = `${(all.lo * 100).toFixed(0)}% to ${(all.hi * 100).toFixed(0)}%`;
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
