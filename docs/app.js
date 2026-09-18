// CAST demo front-end. Loads precomputed scenarios.json and renders an
// interactive ATE-vs-horizon figure with a measured-confounding selector, an
// unmeasured-confounding selector, an effect-shape selector, and per-method
// toggles, plus accuracy / Cox / balance / overlap / trajectory / shrinkage /
// unmeasured-confounding cards.

const COLORS = {
  truth: "#111111", naive: "#d55e00", rsf: "#0072b2", tlearner: "#cc79a7",
  coxate: "#9467bd", csf: "#009e73", cast: "#009e73"
};
const METHODS = [
  { key: "truth",    label: "Truth",            color: COLORS.truth },
  { key: "naive",    label: "Naive (unadjusted)", color: COLORS.naive },
  { key: "rsf",      label: "RSF S-learner",    color: COLORS.rsf },
  { key: "tlearner", label: "RSF T-learner",    color: COLORS.tlearner },
  { key: "coxate",   label: "Cox (marginal)",   color: COLORS.coxate },
  { key: "csf",      label: "CSF (points)",     color: COLORS.csf },
  { key: "cast",     label: "CAST trajectory",  color: COLORS.cast },
  { key: "castci",   label: "CAST 95% band", color: COLORS.cast }
];
// Keyed to the VALUE of gamma, not to a control's position, so a change to the
// exported grid can never silently relabel a panel.
const CONF_WORDS   = { "0": "none", "0.5": "mild", "1": "moderate", "2": "strong" };
const UNMEAS_WORDS = { "0": "none", "0.75": "moderate", "1.5": "strong" };
const SHAPE_TOOLTIPS = {
  plateau: "Treatment is protective throughout (constant hazard ratio ≈ 0.54); on the survival-probability scale the survival gap rises, peaks, then slowly narrows as both arms approach low survival.",
  reversal: "Treatment helps early (HR ≈ 0.39) but harms late (HR ≈ 2.05), with a smooth transition around 48 months; the survival curves cross, so the survival-probability difference rises, peaks, then turns negative. Simulated, like the plateau shape, and drawn sharper than most real crossings so each estimator's response to it is easy to see."
};

let DATA = null;
let state = { shape: null, confIdx: 0, unmeasIdx: 0, visible: {} };
METHODS.forEach(m => state.visible[m.key] = true);
state.visible.castci = true;

function fatal(html) {
  document.getElementById("plot").innerHTML = "<p style='padding:2rem'>" + html + "</p>";
}

// Distinguish the two failure modes that used to report the same message: the
// data file not loading, and Plotly (a CDN script) not being on the page.
if (typeof Plotly === "undefined") {
  fatal("The Plotly library did not load. It is fetched from <code>cdn.plot.ly</code>, " +
        "so this page needs network access to that host; a blocked CDN or an " +
        "offline machine will stop here. The data file itself is fine.");
} else {
  fetch("data/scenarios.json")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(d => { DATA = d; init(); })
    .catch(e => {
      fatal("Could not load <code>data/scenarios.json</code> (" + e.message + "). " +
            "Run the R pipeline first (see README), and serve the folder over http " +
            "(e.g. <code>python3 -m http.server</code>) so <code>fetch()</code> works.");
      console.error(e);
    });
}

function num(x) { return Number(x).toFixed(2); }
// Scenario keys carry both confounding axes. The unmeasured axis is optional so
// that a reduced export (the smoke-test preview) still renders.
function key(shape, conf, unmeas) {
  return `${shape}_conf${num(conf)}_unmeas${num(unmeas)}`;
}
// `sym` is the axis's own symbol, so an unregistered value on the unmeasured
// axis is not labelled with the measured axis's gamma.
function word(map, v, sym) { return map[String(v)] || `${sym} = ${v}`; }
function grid(name, fallback) {
  const g = DATA[name];
  if (Array.isArray(g) && g.length) return g;
  return fallback;             // tolerate an older / reduced export
}

// Both confounding axes are exported as a short list of discrete levels, so they
// are rendered as one option per level rather than as a range input: a slider
// with four stops promises a continuum the precomputed scenario grid does not
// have, which is exactly how it read to a reviewer. Real radio inputs, so
// arrow-key navigation and screen-reader semantics come from the platform; the
// CSS hides the input and styles its label to match the effect-shape buttons.
function buildLevels(containerId, name, values, words, sym, onPick) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.innerHTML = "";
  values.forEach((v, i) => {
    const id = `${name}-opt-${i}`;
    const input = document.createElement("input");
    input.type = "radio"; input.name = name; input.id = id;
    input.value = String(i);
    input.checked = (i === 0);
    // Keyed to the VALUE, like the label text, so a change to the exported grid
    // cannot silently relabel an option.
    input.title = `${sym} = ${v}`;
    input.onchange = () => onPick(i);
    const lab = document.createElement("label");
    lab.htmlFor = id;
    lab.textContent = word(words, v, sym);
    lab.title = input.title;
    box.appendChild(input);
    box.appendChild(lab);
  });
}

function init() {
  state.shape = grid("shapes", ["plateau"])[0];

  // shape buttons
  const sb = document.getElementById("shape-buttons");
  grid("shapes", ["plateau"]).forEach(sh => {
    const b = document.createElement("button");
    b.textContent = sh.charAt(0).toUpperCase() + sh.slice(1);
    b.dataset.shape = sh;
    b.title = SHAPE_TOOLTIPS[sh] || "";   // hover explanation at the control
    if (sh === state.shape) b.classList.add("active");
    b.onclick = () => {
      state.shape = sh;
      [...sb.children].forEach(c => c.classList.toggle("active", c.dataset.shape === sh));
      render();
    };
    sb.appendChild(b);
  });

  // measured-confounding options
  buildLevels("conf-buttons", "conf", grid("conf_grid", [0]), CONF_WORDS, "γ",
              i => { state.confIdx = i; render(); });

  // unmeasured-confounding options. Hidden entirely when the export carries only
  // the single Gamma_u = 0 slice, so a reduced run does not show a dead control.
  const ug = grid("unmeas_grid", [0]);
  const uctrl = document.getElementById("unmeas-ctrl");
  if (ug.length > 1) {
    buildLevels("unmeas-buttons", "unmeas", ug, UNMEAS_WORDS, "Γ",
                i => { state.unmeasIdx = i; render(); });
  } else {
    uctrl.style.display = "none";
  }

  // method toggles
  const mt = document.getElementById("method-toggles");
  METHODS.forEach(m => {
    const l = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = state.visible[m.key];
    cb.onchange = () => { state.visible[m.key] = cb.checked; render(); };
    const sw = document.createElement("span");
    sw.className = "swatch"; sw.style.background = m.color;
    if (m.key === "castci") sw.style.opacity = 0.3;
    l.appendChild(cb); l.appendChild(sw);
    l.appendChild(document.createTextNode(m.label));
    mt.appendChild(l);
  });

  const nsc = Object.keys(DATA.scenarios || {}).length;
  document.getElementById("gen-stamp").textContent =
    "Generated " + (DATA.generated || "") + " · " + nsc + " scenarios: " +
    grid("shapes", []).length + " effect shape(s) × " +
    grid("conf_grid", []).length + " measured-confounding level(s) × " +
    ug.length + " unmeasured-confounding level(s).";

  render();
}

function render() {
  const conf   = grid("conf_grid", [0])[state.confIdx];
  const unmeas = grid("unmeas_grid", [0])[state.unmeasIdx];
  // The selected option already shows the word ("none", "strong"), so the label
  // carries the numeric value rather than repeating it.
  document.getElementById("conf-label").textContent = `γ = ${conf}`;
  const ulab = document.getElementById("unmeas-label");
  if (ulab) ulab.textContent = `Γ = ${unmeas}`;

  const k = key(state.shape, conf, unmeas);
  const s = DATA.scenarios[k];
  if (!s) { fatal(`No scenario <code>${k}</code> in <code>data/scenarios.json</code>. ` +
                  `Re-run the R pipeline so the exported grid matches this page.`); return; }
  const h = DATA.horizons;
  // dense grid for the smooth quadratic; fall back to the horizons if absent
  const ct = (s.cast.curve_t && s.cast.curve_t.length) ? s.cast.curve_t : h;
  const cfit = (s.cast.curve_fit && s.cast.curve_fit.length) ? s.cast.curve_fit : s.cast.fit;
  const clo = (s.cast.curve_lo && s.cast.curve_lo.length) ? s.cast.curve_lo : s.cast.lo;
  const chi = (s.cast.curve_hi && s.cast.curve_hi.length) ? s.cast.curve_hi : s.cast.hi;
  const traces = [];

  // zero reference
  traces.push({ x: h, y: h.map(() => 0), mode: "lines", hoverinfo: "skip",
    line: { color: "#c9ced6", width: 1, dash: "dot" }, showlegend: false });

  if (state.visible.castci && clo && clo.every(v => v != null)) {
    traces.push({ x: ct.concat([...ct].reverse()),
      y: chi.concat([...clo].reverse()),
      fill: "toself", fillcolor: "rgba(0,158,115,0.15)", line: { width: 0 },
      hoverinfo: "skip", name: "CAST 95% band", showlegend: false });
  }
  if (state.visible.truth)
    traces.push(line(h, s.truth, "Truth", COLORS.truth, 3.5, "solid"));
  if (state.visible.naive)
    traces.push(line(h, s.naive, "Naive", COLORS.naive, 2.2, "dash"));
  if (state.visible.rsf)
    traces.push(line(h, s.rsf, "RSF S-learner", COLORS.rsf, 2.2, "dashdot"));
  if (state.visible.tlearner)
    traces.push(line(h, s.tlearner, "RSF T-learner", COLORS.tlearner, 2.2, "longdash"));
  if (state.visible.coxate && s.cox && s.cox.ate)
    traces.push(line(h, s.cox.ate, "Cox (marginal)", COLORS.coxate, 2.2, "dot"));
  if (state.visible.csf)
    traces.push({ x: h, y: s.csf.ate, mode: "markers", name: "CSF (points)",
      marker: { color: COLORS.csf, size: 9 },
      error_y: { type: "data", symmetric: false,
        array: s.csf.hi.map((v, i) => v - s.csf.ate[i]),
        arrayminus: s.csf.ate.map((v, i) => v - s.csf.lo[i]),
        color: "rgba(0,158,115,0.45)", thickness: 1.3, width: 3 } });
  if (state.visible.cast)
    traces.push(line(ct, cfit, "CAST trajectory", COLORS.cast, 3, "solid"));

  const layout = {
    margin: { l: 64, r: 16, t: 16, b: 52 },
    xaxis: { title: { text: "Horizon (months)", font: { size: 15 } },
      tickfont: { size: 13 }, zeroline: false, gridcolor: "#eef1f5" },
    yaxis: { title: { text: "ATE: survival-probability difference", font: { size: 15 } },
      tickfont: { size: 13 }, zeroline: false, gridcolor: "#eef1f5" },
    legend: { orientation: "h", y: 1.04, x: 0, font: { size: 12 } },
    paper_bgcolor: "#fff", plot_bgcolor: "#fff", hovermode: "x unified"
  };
  Plotly.react("plot", traces, layout, { displayModeBar: false, responsive: true });

  renderCards(s);
}

function line(x, y, name, color, width, dash) {
  return { x, y, mode: "lines", name, line: { color, width, dash } };
}

function renderCards(s) {
  // RMSE bars
  const rmse = s.rmse;
  const rows = [
    ["Naive", rmse.naive, COLORS.naive],
    ["S-learner", rmse.rsf, COLORS.rsf],
    ["T-learner", rmse.tlearner, COLORS.tlearner],
    ["Cox", rmse.cox, COLORS.coxate],
    ["CSF", rmse.csf, COLORS.csf],
    ["CAST", rmse.cast, COLORS.cast]
  ].filter(r => r[1] != null);
  const maxv = Math.max(...rows.map(r => r[1]), 0.001);
  const wrap = document.querySelector(".rmse-bars");
  wrap.innerHTML = "";
  rows.forEach(([name, val, color]) => {
    const row = document.createElement("span");
    row.className = "rmse-row";
    row.innerHTML =
      `<span class="name">${name}</span>` +
      `<span class="rmse-track"><span class="rmse-fill" style="width:${(100*val/maxv).toFixed(1)}%;background:${color}"></span></span>` +
      `<span class="val">${val.toFixed(3)}</span>`;
    wrap.appendChild(row);
  });

  // Cox
  const cox = s.cox;
  // The hazard ratio and its interval on separate lines: in a card column the
  // combined string wrapped in the middle of the interval, splitting "(0.478-"
  // from "0.593)".
  document.getElementById("cox-hr").textContent = `HR ${cox.hr}`;
  const php = cox.ph_p;
  // ph_p is rounded to 4 dp in scenarios.json, so a tiny p-value arrives as 0;
  // show "p < 0.0001" rather than the misleading "p = 0".
  const phpTxt = php === 0 ? "p < 0.0001" : `p = ${php}`;
  const ci = `95% CI ${cox.lo}–${cox.hi}`;
  document.getElementById("cox-ph").textContent =
    php == null ? ci :
    `${ci} · PH test ${phpTxt}` +
      (php < 0.05 ? ", proportional-hazards assumption violated"
                  : ", no strong PH violation here");

  // Balance
  document.getElementById("smd-text").innerHTML =
    `Confounders: age = <strong>${fmt(s.meta.smd_age)}</strong>, ` +
    `performance status = <strong>${fmt(s.meta.smd_ps)}</strong>, ` +
    `comorbidity = <strong>${fmt(s.meta.smd_comorb)}</strong><br>` +
    `Non-confounder: smoking = <strong>${fmt(s.meta.smd_smoke)}</strong> (stays ≈ 0)<br>` +
    (s.meta.smd_u_hidden == null ? "" :
      `<em>Unmeasured</em> confounder: <strong>${fmt(s.meta.smd_u_hidden)}</strong> ` +
      `(invisible to every model)<br>`) +
    `events ${(100*s.meta.event_rate).toFixed(0)}% · treated ${(100*s.meta.treated_frac).toFixed(0)}% · n = ${s.meta.n}`;

  // CAST trajectory metrics
  const ct = s.cast;
  const peakTxt = ct.peak_in_range
    ? `model summary: peak ${ct.peak_effect >= 0 ? "+" : ""}${ct.peak_effect} at ${ct.peak_time} months`
    : "model summary: monotonic over 12–108 months (no interior peak)";
  document.getElementById("cast-text").innerHTML =
    `fit = <strong>${ct.method}</strong> · R² = ${ct.r_squared}<br>${peakTxt}`;

  // Propensity overlap (positivity)
  const ov = s.overlap;
  const ovEl = document.getElementById("overlap-text");
  if (ov && ovEl) {
    ovEl.innerHTML =
      `estimated P(treat) ∈ [<strong>${ov.min}</strong>, <strong>${ov.max}</strong>]<br>` +
      `${(100 * ov.pct_extreme).toFixed(1)}% beyond [0.05, 0.95] · ` +
      `${(100 * ov.pct_clipped).toFixed(1)}% clipped at [0.01, 0.99]`;
  }

  // Unmeasured confounding: what the oracle refit recovers, and the E-value.
  const rb = s.robustness, rbEl = document.getElementById("unmeas-text");
  if (rbEl) {
    if (!rb || !rb.shift) { rbEl.textContent = "–"; }
    else {
      const mid = Math.floor(rb.shift.length / 2);   // mid horizon (60 months)
      const sh = rb.shift[mid], ev = rb.evalue ? rb.evalue[mid] : null;
      const s0 = rb.s0_baseline ? rb.s0_baseline[mid] : null;
      const gam = s.meta.unmeas_strength;
      rbEl.innerHTML =
        `latent strength <strong>Γ = ${gam}</strong>` +
        (gam === 0 ? " (none: the oracle refit is a null check)" : "") + `<br>` +
        `CSF at 60 months: <strong>${f4(rb.ate_omitU[mid])}</strong> without the latent ` +
        `factor vs <strong>${f4(rb.ate_withU[mid])}</strong> with it ` +
        `(shift ${sh >= 0 ? "+" : ""}${f4(sh)})<br>` +
        (ev == null ? "" : `E-value <strong>${ev}</strong>` +
          (s0 == null ? "" : ` (risk ratio anchored to control survival ${f4(s0)} at this horizon)`));
    }
  }

  // Shrinkage
  const sk = s.shrinkage;
  document.getElementById("shrink-text").innerHTML =
    `λ = <strong>${sk.alpha}</strong> · target μ = ${sk.target_scale}<br>` +
    `condition number ${fmtBig(sk.cond_before)} → <strong>${fmtBig(sk.cond_after)}</strong>`;
}

function fmt(x) { return x == null ? "–" : (x >= 0 ? "+" : "") + x.toFixed(2); }
function f4(x) { return x == null ? "–" : x.toFixed(3); }
function fmtBig(x) {
  if (x == null) return "–";
  if (x >= 1000) return x.toExponential(1);
  return Math.round(x).toString();
}
