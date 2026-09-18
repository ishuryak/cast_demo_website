// Clinician-facing CAST demo.
//
// Reads the SAME docs/data/scenarios.json as the methods-facing page, so the two
// versions can never disagree about a number. Everything below is presentation:
// no estimate is recomputed here.
//
// Three deliberate departures from the parent page:
//   1. Effects are shown as patients per 100, not as a survival-probability
//      difference in [-1, 1]. Same quantity, clinical unit.
//   2. Interval coverage against the known truth is COMPUTED and displayed. The
//      parent page draws 95% bands and never checks them; because the truth ships
//      in the same file, the check costs nothing and is the one grading this
//      demo's own premise demands.
//   3. Error bars are scaled TO THE WORST METHOD on the panel. That compresses
//      the middle, so the bar is a sketch and the number carrying the comparison
//      is the multiple of the best method printed beside it. (An earlier draft of
//      this header, of style.css and of the test all claimed a shared scale
//      "rather than the worst method". No such code ever existed.)

const COLORS = {
  truth: "#111111", naive: "#d55e00", rsf: "#0072b2", tlearner: "#cc79a7",
  coxate: "#9467bd", csf: "#009e73", cast: "#009e73"
};

// Clinical labels. The parent page names estimators; this one names what each
// estimator is doing, with the estimator name kept in the tooltip so a reader
// moving between the two pages can map them.
const METHODS = [
  { key: "truth",    label: "The truth",              color: COLORS.truth,
    tip: "The real effect, known because these patients are simulated." },
  { key: "cast",     label: "CAST trajectory",        color: COLORS.cast,
    tip: "CAST: one smooth curve fitted through the per-timepoint causal estimates." },
  { key: "castci",   label: "CAST 95% band",          color: COLORS.cast,
    tip: "Pointwise 95% interval around the CAST curve." },
  { key: "csf",      label: "Per-timepoint estimates", color: COLORS.csf,
    tip: "Causal survival forest (CSF), estimated separately at each follow-up time." },
  { key: "naive",    label: "No adjustment",          color: COLORS.naive,
    tip: "Raw survival difference between the groups. Shows the size of the problem." },
  { key: "coxate",   label: "Cox regression",         color: COLORS.coxate,
    tip: "Cox proportional-hazards model, standardized to the survival scale." },
  { key: "rsf",      label: "ML, one model",          color: COLORS.rsf,
    tip: "Random survival forest (RSF) S-learner: treatment is one feature among many." },
  { key: "tlearner", label: "ML, one per group",      color: COLORS.tlearner,
    tip: "Random survival forest (RSF) T-learner: a separate model per treatment group." }
];

const SHAPE_WORDS = {
  plateau:  "Helps throughout",
  reversal: "Helps early, harms late"
};
const SHAPE_TIPS = {
  plateau: "Treatment is protective for the whole of follow-up. The survival gap rises, peaks, then slowly narrows as both groups approach low survival.",
  reversal: "Treatment helps early but harms late, with the survival curves crossing around four years. Drawn sharper than most real crossings so each method's response is visible."
};
const CONF_WORDS   = { "0": "None", "0.5": "Mild", "1": "Moderate", "2": "Strong" };
const UNMEAS_WORDS = { "0": "None", "0.75": "Moderate", "1.5": "Strong" };

let DATA = null;
let state = { shape: null, confIdx: 0, unmeasIdx: 0, visible: {} };
METHODS.forEach(m => { state.visible[m.key] = true; });

function fatal(html) {
  document.getElementById("plot").innerHTML = "<p style='padding:2rem'>" + html + "</p>";
}

if (typeof Plotly === "undefined") {
  fatal("The Plotly library did not load. It is fetched from <code>cdn.plot.ly</code>, " +
        "so this page needs network access to that host. The data file itself is fine.");
} else {
  // ../data/scenarios.json: this page lives one level below docs/ and shares the
  // parent's data file rather than carrying a copy that could drift from it.
  fetch("../data/scenarios.json")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(d => { DATA = d; init(); })
    .catch(e => {
      fatal("Could not load <code>../data/scenarios.json</code> (" + e.message + "). " +
            "Serve the <code>docs/</code> folder over http, for example " +
            "<code>python3 -m http.server</code>, so <code>fetch()</code> works.");
      console.error(e);
    });
}

const pp = x => x * 100;                 // survival-probability difference -> per 100 patients
const n2 = x => Number(x).toFixed(2);
const key = (shape, conf, unmeas) => `${shape}_conf${n2(conf)}_unmeas${n2(unmeas)}`;
const word = (map, v, sym) => map[String(v)] || `${sym} = ${v}`;
function grid(name, fallback) {
  const g = DATA[name];
  return (Array.isArray(g) && g.length) ? g : fallback;
}
function signed(x, digits) {
  const d = digits == null ? 1 : digits;
  return (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
}

// ---------------------------------------------------------------------------
// Coverage. Does the nominal 95% interval contain the known truth?
// Computed from the shipped data on every load, never transcribed.
// ---------------------------------------------------------------------------
function covers(lo, hi, truth) {
  return lo != null && hi != null && truth != null && lo <= truth && truth <= hi;
}
function scenarioCoverage(s) {
  const out = [];
  s.truth.forEach((t, i) => out.push(covers(s.cast.lo[i], s.cast.hi[i], t)));
  return out;
}
function globalCoverage() {
  const tally = { all: [0, 0], g0: [0, 0], gMax: [0, 0] };
  const gmax = Math.max(...grid("unmeas_grid", [0]));
  Object.values(DATA.scenarios).forEach(s => {
    const g = s.meta.unmeas_strength;
    scenarioCoverage(s).forEach(hit => {
      tally.all[0] += hit ? 1 : 0; tally.all[1]++;
      if (g === 0)    { tally.g0[0]   += hit ? 1 : 0; tally.g0[1]++; }
      if (g === gmax) { tally.gMax[0] += hit ? 1 : 0; tally.gMax[1]++; }
    });
  });
  return tally;
}
const pct = ([c, n]) => n ? `${c} of ${n} (${Math.round(100 * c / n)}%)` : "–";

// ---------------------------------------------------------------------------
function buildLevels(containerId, name, values, words, sym, onPick, tips) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = "";
  values.forEach((v, i) => {
    const id = `${name}-opt-${i}`;
    const input = document.createElement("input");
    input.type = "radio"; input.name = name; input.id = id;
    input.value = String(i); input.checked = (i === 0);
    input.title = (tips && tips[v]) || `${sym} = ${v}`;
    input.onchange = () => onPick(i);
    const lab = document.createElement("label");
    lab.htmlFor = id;
    lab.textContent = word(words, v, sym);
    lab.title = input.title;
    box.appendChild(input); box.appendChild(lab);
  });
}

function init() {
  const shapes = grid("shapes", ["plateau"]);
  state.shape = shapes[0];

  // Shape options carry the long explanation on hover, as the parent page does.
  // Passed in rather than swept up afterwards with querySelectorAll: the option
  // that needs the tooltip is the one being built, and a post-hoc sweep also
  // needs a DOM API the headless test harness has no reason to implement.
  buildLevels("shape-buttons", "shape", shapes, SHAPE_WORDS, "shape", i => {
    state.shape = shapes[i]; render();
  }, SHAPE_TIPS);

  buildLevels("conf-buttons", "conf", grid("conf_grid", [0]), CONF_WORDS, "γ",
              i => { state.confIdx = i; render(); });
  buildLevels("unmeas-buttons", "unmeas", grid("unmeas_grid", [0]), UNMEAS_WORDS, "Γ",
              i => { state.unmeasIdx = i; render(); });

  const tog = document.getElementById("method-toggles");
  METHODS.forEach(m => {
    const lab = document.createElement("label");
    lab.title = m.tip;
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = true;
    cb.onchange = () => { state.visible[m.key] = cb.checked; render(); };
    const sw = document.createElement("span");
    sw.classList.add("swatch"); sw.style.background = m.color;
    lab.appendChild(cb); lab.appendChild(sw);
    lab.appendChild(document.createTextNode(m.label));
    tog.appendChild(lab);
  });

  // Whole-demo coverage, into the limitations section.
  const g = globalCoverage();
  document.getElementById("cov-global").textContent = pct(g.all);
  document.getElementById("cov-g0").textContent     = pct(g.g0);
  document.getElementById("cov-g2").textContent     = pct(g.gMax);

  render();
}

function line(x, y, name, color, width, dash) {
  return { x, y: y.map(pp), mode: "lines", name, line: { color, width, dash } };
}

function render() {
  const conf   = grid("conf_grid", [0])[state.confIdx];
  const unmeas = grid("unmeas_grid", [0])[state.unmeasIdx];
  const k = key(state.shape, conf, unmeas);
  const s = DATA.scenarios[k];
  if (!s) { fatal(`No scenario <code>${k}</code> in the data file.`); return; }

  const h  = DATA.horizons;
  const ct = (s.cast.curve_t   && s.cast.curve_t.length)   ? s.cast.curve_t   : h;
  const cf = (s.cast.curve_fit && s.cast.curve_fit.length) ? s.cast.curve_fit : s.cast.fit;
  const cl = (s.cast.curve_lo  && s.cast.curve_lo.length)  ? s.cast.curve_lo  : s.cast.lo;
  const chh= (s.cast.curve_hi  && s.cast.curve_hi.length)  ? s.cast.curve_hi  : s.cast.hi;
  const traces = [];

  traces.push({ x: h, y: h.map(() => 0), mode: "lines", hoverinfo: "skip",
    line: { color: "#c9ced6", width: 1, dash: "dot" }, showlegend: false });

  if (state.visible.castci && cl && cl.every(v => v != null)) {
    traces.push({ x: ct.concat([...ct].reverse()),
      y: chh.map(pp).concat([...cl].reverse().map(pp)),
      fill: "toself", fillcolor: "rgba(0,158,115,0.15)", line: { width: 0 },
      hoverinfo: "skip", showlegend: false });
  }
  if (state.visible.naive)    traces.push(line(h, s.naive, "No adjustment", COLORS.naive, 2.2, "dash"));
  if (state.visible.rsf)      traces.push(line(h, s.rsf, "ML, one model", COLORS.rsf, 2.2, "dashdot"));
  if (state.visible.tlearner) traces.push(line(h, s.tlearner, "ML, one per group", COLORS.tlearner, 2.2, "longdash"));
  if (state.visible.coxate && s.cox && s.cox.ate)
    traces.push(line(h, s.cox.ate, "Cox regression", COLORS.coxate, 2.2, "dot"));
  if (state.visible.csf)
    traces.push({ x: h, y: s.csf.ate.map(pp), mode: "markers", name: "Per-timepoint estimates",
      marker: { color: COLORS.csf, size: 9 },
      error_y: { type: "data", symmetric: false,
        array:      s.csf.hi.map((v, i) => pp(v - s.csf.ate[i])),
        arrayminus: s.csf.ate.map((v, i) => pp(v - s.csf.lo[i])),
        color: "rgba(0,158,115,0.45)", thickness: 1.3, width: 3 } });
  if (state.visible.cast) traces.push(line(ct, cf, "CAST trajectory", COLORS.cast, 3, "solid"));
  // Truth last so it draws on top of every estimate.
  if (state.visible.truth) traces.push(line(h, s.truth, "The truth", COLORS.truth, 3.5, "solid"));

  Plotly.react("plot", traces, {
    margin: { l: 66, r: 16, t: 16, b: 54 },
    xaxis: { title: { text: "Time since treatment (months)", font: { size: 15 } },
             tickfont: { size: 13 }, zeroline: false, gridcolor: "#eef1f5" },
    yaxis: { title: { text: "Extra survivors per 100 treated", font: { size: 15 } },
             tickfont: { size: 13 }, zeroline: false, gridcolor: "#eef1f5" },
    legend: { orientation: "h", y: 1.06, x: 0, font: { size: 12 } },
    paper_bgcolor: "#fff", plot_bgcolor: "#fff", hovermode: "x unified"
  }, { displayModeBar: false, responsive: true });

  renderCards(s, h);
}

function renderCards(s, h) {
  const mid = Math.floor(h.length / 2);

  // --- Headline: the estimate a real analysis would report, and the truth.
  const est = pp(s.cast.fit[mid]), lo = pp(s.cast.lo[mid]), hi = pp(s.cast.hi[mid]);
  const tru = pp(s.truth[mid]);
  document.getElementById("headline").innerHTML =
    `${signed(est)} <span style="font-size:.95rem;font-weight:600">per 100 at ${h[mid]} months</span>`;
  const hit = covers(s.cast.lo[mid], s.cast.hi[mid], s.truth[mid]);
  document.getElementById("headline-hint").innerHTML =
    `CAST estimate, 95&percnt; interval ${signed(lo)} to ${signed(hi)}.<br>` +
    `The truth at this time is <strong>${signed(tru)}</strong>, which is ` +
    (hit ? `<span style="color:var(--good);font-weight:700">inside</span>`
         : `<span style="color:var(--bad);font-weight:700">outside</span>`) +
    ` that interval.`;

  const c = s.cast;
  document.getElementById("peak-text").textContent = c.peak_in_range
    ? `Fitted curve peaks near ${Math.round(c.peak_time)} months at about ` +
      `${signed(pp(c.peak_effect), 0)} per 100. No interval is available for the timing.`
    : "The fitted curve has no interior peak between 12 and 108 months.";

  // --- Coverage strip for this scenario.
  const hits = scenarioCoverage(s);
  const strip = document.getElementById("cov-strip");
  strip.innerHTML = "";
  hits.forEach((ok, i) => {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.classList.add(ok ? "hit" : "miss");
    cell.innerHTML = (ok ? "in" : "out") + `<span>${h[i]} mo</span>`;
    cell.title = ok
      ? `At ${h[i]} months the 95% interval contains the truth.`
      : `At ${h[i]} months the 95% interval misses the truth.`;
    strip.appendChild(cell);
  });
  const nHit = hits.filter(Boolean).length;
  document.getElementById("cov-text").textContent =
    `${nHit} of ${hits.length} intervals contain the truth in this scenario.` +
    (nHit === hits.length ? "" : " A missed interval is not a wide one: it is a narrow interval in the wrong place.");
  document.getElementById("coverage-card").classList.toggle("flag", nHit < hits.length);

  // --- Distance from truth. Scaled so the outlier does not flatten the rest.
  const r = s.rmse;
  const rows = [
    ["No adjustment", r.naive, COLORS.naive], ["ML, one model", r.rsf, COLORS.rsf],
    ["ML, per group", r.tlearner, COLORS.tlearner], ["Cox", r.cox, COLORS.coxate],
    ["CSF", r.csf, COLORS.csf], ["CAST", r.cast, COLORS.cast]
  ].filter(x => x[1] != null).map(([n, v, col]) => [n, pp(v), col]);
  const vals = rows.map(x => x[1]).sort((a, b) => a - b);
  const best = vals[0] || 1e-9;
  const top = vals[vals.length - 1] || 1e-9;
  // Bars are scaled to the worst method on the panel. That is honest but it does
  // compress the middle, so the thing carrying the comparison is not the bar: it
  // is the multiple of the best method printed beside it. The bar is a sketch,
  // the number is the answer.
  //
  // An earlier draft capped the axis when one method ran away with the scale.
  // Measured against the shipped grid, the largest error is never more than 2.2x
  // the second largest, so that branch never executed on any of the 24 panels.
  // Removed rather than kept as insurance against data it will not see.
  const wrap = document.getElementById("rmse-bars");
  wrap.innerHTML = "";
  rows.forEach(([name, v, col]) => {
    const w = Math.max(2, Math.min(100, 100 * v / top));
    const row = document.createElement("div");
    row.classList.add("bar-row");
    row.innerHTML =
      `<span class="name">${name}</span>` +
      `<span class="track"><span class="fill" ` +
        `style="width:${w.toFixed(1)}%;background:${col}"></span></span>` +
      `<span class="val"><b>${(v / best).toFixed(1)}×</b> ${v.toFixed(1)}</span>`;
    row.title = `${v.toFixed(2)} patients per 100 from the truth on average, ` +
                `${(v / best).toFixed(1)} times the best method on this panel`;
    wrap.appendChild(row);
  });

  // --- Baseline imbalance, in words.
  const m = s.meta;
  const sm = [
    ["Age", m.smd_age], ["Performance status", m.smd_ps],
    ["Comorbidity", m.smd_comorb], ["Smoking", m.smd_smoke]
  ].filter(x => x[1] != null);
  if (m.smd_u_hidden != null) sm.push(["Hidden factor", m.smd_u_hidden]);
  const smWrap = document.getElementById("smd-bars");
  smWrap.innerHTML = "";
  const smCap = Math.max(0.3, ...sm.map(x => Math.abs(x[1])));
  sm.forEach(([name, v]) => {
    const bad = Math.abs(v) > 0.1;
    const hidden = name === "Hidden factor";
    const row = document.createElement("div");
    row.classList.add("bar-row");
    row.innerHTML =
      `<span class="name">${name}</span>` +
      `<span class="track"><span class="fill" style="width:${(100*Math.abs(v)/smCap).toFixed(1)}%;` +
        `background:${hidden ? "#7a7f8a" : (bad ? "var(--bad)" : "var(--good)")}"></span></span>` +
      `<span class="val">${signed(v, 2)}</span>`;
    row.title = hidden
      ? "Withheld from every model. No method can adjust for it."
      : (bad ? "Imbalanced: beyond 0.10." : "Balanced.");
    smWrap.appendChild(row);
  });
  document.getElementById("smd-text").innerHTML =
    `Smoking affects survival but not who gets treated: it is absent from the ` +
    `assignment model, so raising the confounding strength does not pull it ` +
    `apart. Any imbalance you see in it is chance, and with one cohort of ` +
    `${m.n} it does cross 0.10 in two of the 24 panels, a reminder that the ` +
    `threshold flags accidents as well as confounding.` +
    (m.smd_u_hidden == null ? "" :
      ` The hidden factor is shown in grey because no method on this page can see it.`) +
    `<br>Cohort: ${m.n} patients, ${Math.round(100*m.treated_frac)}&percnt; treated, ` +
    `${Math.round(100*m.event_rate)}&percnt; died during follow-up.`;

  // --- Overlap, in words.
  const ov = s.overlap;
  if (ov) {
    const pctEx = 100 * ov.pct_extreme;
    document.getElementById("overlap-big").innerHTML =
      `${pctEx.toFixed(1)}&percnt; <span style="font-size:.95rem;font-weight:600">of patients are near-certain to get one arm</span>`;
    document.getElementById("overlap-text").textContent =
      `Estimated chance of being treated ranges from ${(100*ov.min).toFixed(0)}% to ` +
      `${(100*ov.max).toFixed(0)}% across the cohort. ` +
      (pctEx < 1 ? "Comparable patients exist across the range, so adjustment has something to work with."
                 : "Where that chance approaches 0% or 100% there are few comparable patients, and the adjustment is extrapolating.");
  }

  // --- Unmeasured confounding, in words.
  const rb = s.robustness, g = m.unmeas_strength;
  const big = document.getElementById("unmeas-big");
  const txt = document.getElementById("unmeas-text");
  document.getElementById("unmeas-card").classList.toggle("flag", g > 0);
  if (!rb || !rb.shift) { big.textContent = "–"; txt.textContent = ""; return; }
  const shift = pp(rb.shift[mid]);
  if (g === 0) {
    big.innerHTML = `None <span style="font-size:.95rem;font-weight:600">in this scenario</span>`;
    txt.textContent = "The hidden factor is switched off here, so refitting with it " +
      "changes almost nothing. This panel is the control condition.";
  } else {
    // DIRECTION. rb.shift is ate_omitU - ate_withU (R/02_fit_methods.R:284), so a
    // POSITIVE shift means the model that cannot see the hidden factor reports a
    // LARGER benefit than the oracle refit: the move caused by adding the factor
    // is -shift. An earlier draft printed +shift as "moves the estimate by",
    // which inverted the direction on all 16 panels with a hidden factor. Both
    // endpoints are printed now, as the parent page does, so the direction is
    // readable off the sentence rather than inferred from a sign convention.
    const omitU = pp(rb.ate_omitU[mid]), withU = pp(rb.ate_withU[mid]);
    big.innerHTML = `${signed(shift)} <span style="font-size:.95rem;font-weight:600">per 100 hidden from every method</span>`;
    txt.innerHTML =
      `At ${h[mid]} months the model that cannot see the hidden factor reports ` +
      `${signed(omitU)} patients per 100. Refitting it <em>with</em> that factor ` +
      `gives ${signed(withU)}, a move of ${signed(-shift)}. No real analysis ` +
      `could run that refit, which is the point: in a real study this shift is ` +
      `invisible, the recorded characteristics still look balanced, and the ` +
      `interval still looks narrow.`;
  }
}
