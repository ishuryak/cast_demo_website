// CAST demo front-end. Loads precomputed scenarios.json and renders an
// interactive ATE-vs-horizon figure with a confounding slider, an effect-shape
// selector, and per-method toggles, plus accuracy / Cox / balance / shrinkage cards.

const COLORS = {
  truth: "#111111", naive: "#d55e00", rsf: "#0072b2",
  csf: "#009e73", cast: "#009e73"
};
const METHODS = [
  { key: "truth",   label: "Truth",            color: COLORS.truth },
  { key: "naive",   label: "Naive (unadjusted)", color: COLORS.naive },
  { key: "rsf",     label: "RSF S-learner",    color: COLORS.rsf },
  { key: "csf",     label: "CSF (points)",     color: COLORS.csf },
  { key: "cast",    label: "CAST trajectory",  color: COLORS.cast },
  { key: "castci",  label: "CAST 95% band (conditional)", color: COLORS.cast }
];
const CONF_WORDS = ["none", "mild", "moderate", "strong", "very strong"];

let DATA = null;
let state = { shape: null, confIdx: 0, visible: {} };
METHODS.forEach(m => state.visible[m.key] = true);
state.visible.castci = true;

fetch("data/scenarios.json")
  .then(r => r.json())
  .then(d => { DATA = d; init(); })
  .catch(e => {
    document.getElementById("plot").innerHTML =
      "<p style='padding:2rem'>Could not load <code>data/scenarios.json</code>. " +
      "Run the R pipeline first (see README). Serve over http (e.g. " +
      "<code>python3 -m http.server</code>) so fetch() works.</p>";
    console.error(e);
  });

function key(shape, conf) { return `${shape}_conf${Number(conf).toFixed(2)}`; }

function init() {
  state.shape = DATA.shapes[0];

  // shape buttons
  const sb = document.getElementById("shape-buttons");
  DATA.shapes.forEach(sh => {
    const b = document.createElement("button");
    b.textContent = sh.charAt(0).toUpperCase() + sh.slice(1);
    b.dataset.shape = sh;
    if (sh === state.shape) b.classList.add("active");
    b.onclick = () => {
      state.shape = sh;
      [...sb.children].forEach(c => c.classList.toggle("active", c.dataset.shape === sh));
      render();
    };
    sb.appendChild(b);
  });

  // confounding slider
  const sl = document.getElementById("conf-slider");
  sl.max = DATA.conf_grid.length - 1;
  sl.value = 0;
  sl.oninput = () => { state.confIdx = +sl.value; render(); };

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

  document.getElementById("gen-stamp").textContent =
    "Generated " + (DATA.generated || "") + " · " +
    DATA.shapes.length + " shape(s) × " + DATA.conf_grid.length + " confounding level(s).";

  render();
}

function render() {
  const conf = DATA.conf_grid[state.confIdx];
  document.getElementById("conf-label").textContent =
    `${CONF_WORDS[state.confIdx] || "level " + state.confIdx} (γ = ${conf})`;

  const s = DATA.scenarios[key(state.shape, conf)];
  if (!s) return;
  const h = DATA.horizons;
  const traces = [];

  // zero reference
  traces.push({ x: h, y: h.map(() => 0), mode: "lines", hoverinfo: "skip",
    line: { color: "#c9ced6", width: 1, dash: "dot" }, showlegend: false });

  if (state.visible.castci && s.cast.lo) {
    traces.push({ x: h.concat([...h].reverse()),
      y: s.cast.hi.concat([...s.cast.lo].reverse()),
      fill: "toself", fillcolor: "rgba(0,158,115,0.15)", line: { width: 0 },
      hoverinfo: "skip", name: "CAST 95% band (conditional)", showlegend: false });
  }
  if (state.visible.truth)
    traces.push(line(h, s.truth, "Truth", COLORS.truth, 3.5, "solid"));
  if (state.visible.naive)
    traces.push(line(h, s.naive, "Naive", COLORS.naive, 2.2, "dash"));
  if (state.visible.rsf)
    traces.push(line(h, s.rsf, "RSF S-learner", COLORS.rsf, 2.2, "dashdot"));
  if (state.visible.csf)
    traces.push({ x: h, y: s.csf.ate, mode: "markers", name: "CSF (points)",
      marker: { color: COLORS.csf, size: 9 },
      error_y: { type: "data", symmetric: false,
        array: s.csf.hi.map((v, i) => v - s.csf.ate[i]),
        arrayminus: s.csf.ate.map((v, i) => v - s.csf.lo[i]),
        color: "rgba(0,158,115,0.45)", thickness: 1.3, width: 3 } });
  if (state.visible.cast)
    traces.push(line(h, s.cast.fit, "CAST trajectory", COLORS.cast, 3, "solid"));

  const layout = {
    margin: { l: 64, r: 16, t: 16, b: 52 },
    xaxis: { title: { text: "Horizon (months)", font: { size: 15 } },
      tickfont: { size: 13 }, zeroline: false, gridcolor: "#eef1f5" },
    yaxis: { title: { text: "ATE: RMST difference (months)", font: { size: 15 } },
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
    ["RSF", rmse.rsf, COLORS.rsf],
    ["CSF", rmse.csf, COLORS.csf],
    ["CAST", rmse.cast, COLORS.cast]
  ].filter(r => r[1] != null);
  const maxv = Math.max(...rows.map(r => r[1]), 0.001);
  const wrap = document.querySelector(".rmse-bars");
  wrap.innerHTML = "";
  rows.forEach(([name, val, color]) => {
    const row = document.createElement("div");
    row.className = "rmse-row";
    row.innerHTML =
      `<span class="name">${name}</span>` +
      `<span class="rmse-track"><span class="rmse-fill" style="width:${(100*val/maxv).toFixed(1)}%;background:${color}"></span></span>` +
      `<span class="val">${val.toFixed(2)}</span>`;
    wrap.appendChild(row);
  });

  // Cox
  const cox = s.cox;
  document.getElementById("cox-hr").textContent =
    `HR ${cox.hr} (${cox.lo}–${cox.hi})`;
  const php = cox.ph_p;
  document.getElementById("cox-ph").textContent =
    php == null ? "" :
    `PH test p = ${php}` + (php < 0.05 ? " — proportional-hazards assumption violated" :
                                          " — no strong PH violation here");

  // Balance
  document.getElementById("smd-text").innerHTML =
    `Confounders — age = <strong>${fmt(s.meta.smd_age)}</strong>, ` +
    `performance status = <strong>${fmt(s.meta.smd_ps)}</strong>, ` +
    `comorbidity = <strong>${fmt(s.meta.smd_comorb)}</strong><br>` +
    `Non-confounder — smoking = <strong>${fmt(s.meta.smd_smoke)}</strong> (stays ≈ 0)<br>` +
    `events ${(100*s.meta.event_rate).toFixed(0)}% · treated ${(100*s.meta.treated_frac).toFixed(0)}% · n = ${s.meta.n}`;

  // CAST trajectory metrics
  const ct = s.cast;
  const peakTxt = ct.peak_in_range
    ? `model summary: peak +${ct.peak_effect} mo at ${ct.peak_time} months`
    : "model summary: monotonic over 12–120 months (no interior peak)";
  document.getElementById("cast-text").innerHTML =
    `fit = <strong>${ct.method}</strong> · R² = ${ct.r_squared}<br>${peakTxt}`;

  // Shrinkage
  const sk = s.shrinkage;
  document.getElementById("shrink-text").innerHTML =
    `λ = <strong>${sk.alpha}</strong> · target μ = ${sk.target_scale}<br>` +
    `condition number ${fmtBig(sk.cond_before)} → <strong>${fmtBig(sk.cond_after)}</strong>`;
}

function fmt(x) { return x == null ? "–" : (x >= 0 ? "+" : "") + x.toFixed(2); }
function fmtBig(x) {
  if (x == null) return "–";
  if (x >= 1000) return x.toExponential(1);
  return Math.round(x).toString();
}
