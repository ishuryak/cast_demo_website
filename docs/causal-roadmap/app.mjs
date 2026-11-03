import { runSim1, runSim2, SIM1_INDIRECT, SIM2 } from "./sims.mjs";
import { trialArgument } from "./trial_argument.mjs";

const $ = (s) => document.querySelector(s);
const fmt = (x, d = 1) => {
  const v = Math.abs(x) < 0.5 * 10 ** -d ? 0 : x;
  return v.toFixed(d).replace("-", "−");
};
const signed = (x, d = 1) => (x > 0 ? "+" : "") + fmt(x, d);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- tooltip ----------
const tip = $("#tip");
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest?.("[data-tip]");
  if (!t) return;
  tip.textContent = t.getAttribute("data-tip");
  tip.hidden = false;
});
document.addEventListener("pointermove", (e) => {
  if (tip.hidden) return;
  const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${e.clientY + 14}px`;
});
document.addEventListener("pointerout", (e) => { if (e.target.closest?.("[data-tip]")) tip.hidden = true; });

// ---------- tiny SVG chart kit ----------
// Charts are drawn at their container's real width, so text stays at its CSS size.
const widthOf = (sel, fallback = 460) => Math.max(280, Math.round($(sel)?.getBoundingClientRect().width || fallback));
function frame({ W = 460, H = 250, m = { t: 14, r: 14, b: 34, l: 52 }, y0, y1, yTicks, yLabel }) {
  const sy = (v) => m.t + (H - m.t - m.b) * (1 - (v - y0) / (y1 - y0));
  // Enough decimals that every tick label is exact (0.25 must not print as 0.3).
  const dec = Math.max(0, ...yTicks.map((t) => (String(t).split(".")[1] || "").length));
  let g = "";
  for (const t of yTicks) {
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(t)}" y2="${sy(t)}" stroke="var(--line)" stroke-width="1"/>`;
    g += `<text x="${m.l - 8}" y="${sy(t) + 4}" text-anchor="end">${fmt(t, dec)}</text>`;
  }
  if (yLabel) g += `<text x="12" y="${m.t + (H - m.t - m.b) / 2}" transform="rotate(-90 12 ${m.t + (H - m.t - m.b) / 2})" text-anchor="middle">${yLabel}</text>`;
  return { W, H, m, sy, g };
}
const svg = (f, body, label) =>
  `<svg viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="${esc(label)}">${f.g}${body}</svg>`;
function ticks(lo, hi, n = 5) {
  const step = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].find((s) => (hi - lo) / s <= n) || 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

// =====================================================================
// Quiz
// =====================================================================
const QUIZ = [
  ["Which patients starting radiotherapy will die within 2 years?", "Prediction", "The outcome is eventually observed for patients followed long enough, so a model can be scored on held-out patients, with censoring handled."],
  ["Would patients aged 75 or older live longer, on average, if all of them received hypofractionation instead of conventional fractionation?", "Cause and effect", "It compares outcomes under two treatments for the same patients, one of which is never observed."],
  ["How did the share of hypofractionated courses change from 2010 to 2022?", "Description", "It summarizes what happened, with no model of what would have happened otherwise."],
  ["Patients treated with hypofractionation had higher 5-year survival in our registry.", "Description", "A crude comparison between groups that differ in age, stage and fitness. It describes an association, not an effect."],
  ["SHAP values show that fractionation is the third most important feature in our XGBoost survival model.", "Prediction", "SHAP describes how the model uses its inputs to predict. It does not say what changing the schedule would do."],
  ["How would 3-year survival change if the clinic adopted the rule 'hypofractionate whenever travel time exceeds one hour'?", "Cause and effect", "A treatment rule is an intervention. Comparing rules is a causal question (section 6)."],
  ["Which patients benefit most from hypofractionation?", "Cause and effect", "Who benefits more is a question about treatment effects in subgroups (the CATE), which is causal and needs its own checks."],
];
const KINDS = ["Description", "Prediction", "Cause and effect"];
$("#quiz").innerHTML = QUIZ.map(([q, a, why], i) => `
  <li data-answer="${a}">
    <div class="q">${esc(q)}</div>
    <div class="opts" role="group" aria-label="Kind of question ${i + 1}">${KINDS.map((k) => `<button type="button" aria-pressed="false" data-kind="${k}">${k}</button>`).join("")}</div>
    <div class="why" hidden>${esc(why)}</div>
  </li>`).join("");
$("#quiz").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-kind]");
  if (!b) return;
  const li = b.closest("li");
  const right = li.dataset.answer;
  li.querySelectorAll("button").forEach((x) => { x.setAttribute("aria-pressed", "false"); x.classList.remove("right", "wrong"); });
  b.setAttribute("aria-pressed", "true");
  b.classList.add(b.dataset.kind === right ? "right" : "wrong");
  const why = li.querySelector(".why");
  why.hidden = false;
  why.textContent = (b.dataset.kind === right ? "Yes. " : `Not quite: this is ${right.toLowerCase()}. `) + QUIZ[[...li.parentNode.children].indexOf(li)][2];
});

// =====================================================================
// DAG
// =====================================================================
(function drawDag() {
  const box = (x, y, w, h, title, lines, style = "") => {
    let t = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${style}/>`;
    t += `<text x="${x + 14}" y="${y + 26}" style="font-weight:600">${title}</text>`;
    lines.forEach((l, i) => (t += `<text class="small" x="${x + 14}" y="${y + 50 + i * 20}">${l}</text>`));
    return t;
  };
  const solid = 'fill="var(--wash)" stroke="var(--line)" stroke-width="1.5"';
  const out = `
  <svg viewBox="0 0 1000 450" role="img" aria-label="Causal diagram: recorded and unrecorded baseline factors affect both the fractionation schedule and survival. The schedule affects survival along a direct path and along a path through events after treatment starts. The total effect of the schedule is the sum of both paths.">
    <defs>
      <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker>
      <marker id="ah-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--teal)"/></marker>
      <marker id="ah-c" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--caution)"/></marker>
    </defs>
    ${box(16, 16, 290, 232, "Recorded before treatment", ["Age, comorbidity", "Stage, tumor size, histology", "Facility type, distance to facility", "Insurance", "Calendar year", "Adjust for these"], solid)}
    ${box(16, 290, 290, 140, "Often not recorded", ["Performance status", "Patient preference", "Detailed frailty"], 'fill="var(--caution-wash)" stroke="var(--caution)" stroke-width="1.5" stroke-dasharray="6 5"')}
    ${box(400, 178, 210, 92, "Fractionation", ["hypofractionated or conventional"], 'fill="var(--teal-wash)" stroke="var(--teal)" stroke-width="2"')}
    ${box(700, 16, 284, 172, "After treatment starts", ["Treatment interruptions", "Acute toxicity", "Early tumor response", "Later systemic therapy"], solid)}
    ${box(700, 318, 284, 92, "Survival", ["death from any cause, 5 years"], 'fill="var(--paper)" stroke="var(--ink)" stroke-width="2"')}
    <g fill="none" stroke-width="2">
      <path d="M306,150 L396,206" stroke="var(--muted)" marker-end="url(#ah)"/>
      <path d="M306,226 C440,330 560,352 696,356" stroke="var(--muted)" marker-end="url(#ah)"/>
      <path d="M306,336 L396,258" stroke="var(--caution)" stroke-dasharray="6 5" marker-end="url(#ah-c)"/>
      <path d="M306,396 L696,396" stroke="var(--caution)" stroke-dasharray="6 5" marker-end="url(#ah-c)"/>
      <path d="M610,200 L696,140" stroke="var(--teal)" stroke-width="3.5" stroke-dasharray="9 5" marker-end="url(#ah-teal)"/>
      <path d="M842,188 L842,314" stroke="var(--teal)" stroke-width="3.5" stroke-dasharray="9 5" marker-end="url(#ah-teal)"/>
      <path d="M610,252 L696,334" stroke="var(--teal)" stroke-width="3.5" marker-end="url(#ah-teal)"/>
    </g>
    <text class="small" x="316" y="138">confounding</text>
    <text class="small" x="598" y="306" text-anchor="end" style="fill:var(--teal);font-weight:600">direct path</text>
    <text class="small" x="858" y="256" style="fill:var(--teal);font-weight:600">mediated path</text>
    <text class="small" x="430" y="166" style="fill:var(--teal);font-weight:600">total effect = both teal paths</text>
    <text class="small" x="430" y="388" style="fill:var(--caution)">unmeasured confounding</text>
  </svg>`;
  $("#dag-figure").innerHTML = out;
})();

const rerenders = [];

// =====================================================================
// Simulation 1
// =====================================================================
let sim1Seed = 20260918;
function renderSim1() {
  const r = runSim1(sim1Seed);
  const sc = r.scenarios;
  $("#sim1-n").textContent = `${r.nTrain.toLocaleString("en-US")} simulated patients fitted, ${r.nTest.toLocaleString("en-US")} held out`;

  // R2 bars
  const f1 = frame({ W: widthOf("#sim1-r2"), y0: 0, y1: 1, yTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], yLabel: "Held-out R²" });
  const gw = (f1.W - f1.m.l - f1.m.r) / sc.length;
  let b1 = "";
  sc.forEach((s, i) => {
    const cx = f1.m.l + gw * (i + 0.5);
    [["causal", "var(--causal)", -1], ["predictive", "var(--predictive)", 1]].forEach(([k, col, side]) => {
      const v = s[k].r2, x = cx + side * 3 + (side < 0 ? -34 : 0), w = 34;
      const y = f1.sy(v), base = f1.sy(0);
      b1 += `<path d="M${x},${base} V${y + 4} q0,-4 4,-4 h${w - 8} q4,0 4,4 V${base} z" fill="${col}" data-tip="Scenario ${s.key} (${s.label.toLowerCase()}), ${k} model: R² ${fmt(v, 2)}"/>`;
      b1 += `<text class="lab" x="${x + w / 2}" y="${y - 6}" text-anchor="middle">${fmt(v, 2)}</text>`;
    });
    b1 += `<text x="${cx}" y="${f1.H - 12}" text-anchor="middle">${s.key}: ${s.label.toLowerCase()}</text>`;
  });
  $("#sim1-r2").innerHTML = svg(f1, b1, "Held-out R squared by scenario for the causal and predictive models");

  // Estimates
  const vals = sc.flatMap((s) => [s.total, s.causal.lo, s.causal.hi, s.predictive.lo, s.predictive.hi]);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const f2 = frame({ W: widthOf("#sim1-est"), y0: lo, y1: hi, yTicks: ticks(lo, hi, 6), yLabel: "Outcome units" });
  const gw2 = (f2.W - f2.m.l - f2.m.r) / sc.length;
  let b2 = `<line x1="${f2.m.l}" x2="${f2.W - f2.m.r}" y1="${f2.sy(0)}" y2="${f2.sy(0)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
  sc.forEach((s, i) => {
    const cx = f2.m.l + gw2 * (i + 0.5);
    b2 += `<line x1="${cx - 40}" x2="${cx + 40}" y1="${f2.sy(s.total)}" y2="${f2.sy(s.total)}" stroke="var(--truth)" stroke-width="3" data-tip="Scenario ${s.key}: true total effect ${signed(s.total)} units"/>`;
    [["causal", "var(--causal)", -16], ["predictive", "var(--predictive)", 16]].forEach(([k, col, dx]) => {
      const e = s[k];
      b2 += `<line x1="${cx + dx}" x2="${cx + dx}" y1="${f2.sy(e.lo)}" y2="${f2.sy(e.hi)}" stroke="${col}" stroke-width="2.5"/>`;
      b2 += `<circle cx="${cx + dx}" cy="${f2.sy(e.estimate)}" r="5.5" fill="${col}" stroke="var(--paper)" stroke-width="2" data-tip="Scenario ${s.key}, ${k} model: ${signed(e.estimate)} units (95% interval ${signed(e.lo)} to ${signed(e.hi)}); truth ${signed(s.total)}"/>`;
    });
    b2 += `<text x="${cx}" y="${f2.H - 12}" text-anchor="middle">${s.key}: ${s.label.toLowerCase()}</text>`;
  });
  $("#sim1-est").innerHTML = svg(f2, b2, "Estimated effect with 95 percent intervals against the truth, by scenario");

  // Readout, generated from the numbers so it stays true for any seed.
  const predWins = sc.filter((s) => s.predictive.r2 > s.causal.r2).length;
  const causalCovers = sc.filter((s) => s.causal.lo <= s.total && s.total <= s.causal.hi).length;
  const predCovers = sc.filter((s) => s.predictive.lo <= s.total && s.total <= s.predictive.hi).length;
  const r2c = sc.map((s) => s.causal.r2), r2p = sc.map((s) => s.predictive.r2);
  const word = (n) => ["none", "one", "two", "all three"][n];
  $("#sim1-readout").innerHTML = `<p>The predictive model has the higher held-out R² in ${word(predWins)} of the scenarios (${fmt(Math.min(...r2p), 2)} to ${fmt(Math.max(...r2p), 2)}, against ${fmt(Math.min(...r2c), 2)} to ${fmt(Math.max(...r2c), 2)}). Its interval covers the true effect in ${word(predCovers)} of them, because adjusting for the post-treatment variable removes the part of the effect that runs through it, ${fmt(SIM1_INDIRECT, 0)} units by construction. The causal model's interval covers the truth in ${word(causalCovers)}. In scenario A hypofractionation does nothing overall, yet the better predictor reports ${signed(sc[0].predictive.estimate)} units. Held-out accuracy cannot reveal this. The predictive model is good at the task it was scored on, a retrospective prediction that uses a value measured after treatment starts. That value would not exist when the schedule is chosen, and adjusting for it answers a different question from the total effect.</p>`;
}
$("#sim1-reseed").addEventListener("click", () => { sim1Seed = (sim1Seed * 1103515245 + 12345) % 2147483647; renderSim1(); });
renderSim1();
rerenders.push(renderSim1);

// =====================================================================
// Simulation 2
// =====================================================================
document.querySelectorAll('[data-bind="sim2-truth"]').forEach((el) => (el.textContent = signed(SIM2.truth, 1)));
function renderSim2() {
  const s = Number($("#sim2-strength").value) / 10;
  $("#sim2-strength-label").textContent = s === 0 ? "none" : `${Math.round(s * 100)}% of maximum`;
  const r = runSim2(s);
  const lo = -10, hi = 4;
  const W = widthOf("#sim2-est"), H = 150, m = { l: 120, r: 16, t: 14, b: 32 };
  const sx = (v) => m.l + (W - m.l - m.r) * (v - lo) / (hi - lo);
  let g = "";
  for (const t of ticks(lo, hi, 7)) {
    g += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--line)"/><text x="${sx(t)}" y="${H - 12}" text-anchor="middle">${fmt(t, 0)}</text>`;
  }
  g += `<line x1="${sx(r.truth)}" x2="${sx(r.truth)}" y1="${m.t - 4}" y2="${H - m.b}" stroke="var(--truth)" stroke-width="3" data-tip="True effect ${signed(r.truth)} unit"/>`;
  [["Recorded", r.withPS, "var(--causal)", 44], ["Not recorded", r.withoutPS, "var(--predictive)", 88]].forEach(([lab, e, col, y]) => {
    g += `<text class="lab" x="${m.l - 12}" y="${y + 4}" text-anchor="end">${lab}</text>`;
    g += `<line x1="${sx(Math.max(lo, e.lo))}" x2="${sx(Math.min(hi, e.hi))}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="2.5"/>`;
    g += `<circle cx="${sx(Math.max(lo, Math.min(hi, e.estimate)))}" cy="${y}" r="6" fill="${col}" stroke="var(--paper)" stroke-width="2" data-tip="Performance status ${lab.toLowerCase()}: ${signed(e.estimate)} units (95% interval ${signed(e.lo)} to ${signed(e.hi)}), held-out R² ${fmt(e.r2, 2)}"/>`;
  });
  $("#sim2-est").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated effect with and without performance status against the truth">${g}</svg>`;
  const off = r.withoutPS.estimate - r.truth;
  const covers = r.withoutPS.lo <= r.truth && r.truth <= r.withoutPS.hi;
  $("#sim2-readout").innerHTML = s === 0
    ? `<p>With no unrecorded confounding, both models agree: ${signed(r.withPS.estimate, 2)} and ${signed(r.withoutPS.estimate, 2)} units against a truth of ${signed(r.truth)}. Move the slider to the right.</p>`
    : `<p>With performance status recorded, the estimate is ${signed(r.withPS.estimate, 2)} units (95% interval ${signed(r.withPS.lo, 2)} to ${signed(r.withPS.hi, 2)}). Without it, the estimate is ${signed(r.withoutPS.estimate, 2)} units, ${fmt(Math.abs(off), 2)} units ${off < 0 ? "below" : "above"} the truth, and its interval ${covers ? "still covers" : "excludes"} the true value. Held-out R² is ${fmt(r.withPS.r2, 2)} with performance status and ${fmt(r.withoutPS.r2, 2)} without it. Any estimator given only the recorded covariates, including the machine-learning estimators of section 7, faces the same missing information: no estimator can adjust for a confounder it cannot see.</p>`;
}
$("#sim2-strength").addEventListener("input", renderSim2);
renderSim2();
rerenders.push(renderSim2);

// =====================================================================
// Simulation 3 (precomputed by build_sim3.mjs, same code as sims.mjs)
// =====================================================================
async function loadSim3() {
  const inline = document.getElementById("sim3-data");
  if (inline) return JSON.parse(inline.textContent);
  const res = await fetch(new URL("./sim3.json", import.meta.url));
  return res.json();
}
loadSim3().then((d) => {
  const N = d.path.length;
  const bind = { "sim3-n": d.n.toLocaleString("en-US"), "sim3-p": String(d.p), "sim3-truth": signed(d.truth), "sim3-nlam": String(N) };
  for (const [k, v] of Object.entries(bind)) document.querySelectorAll(`[data-bind="${k}"]`).forEach((el) => (el.textContent = v));
  // slider position i: 0 = weakest penalty (last on the path), N-1 = strongest
  const at = (i) => d.path[N - 1 - i];
  const slider = $("#sim3-lambda");
  slider.max = String(N - 1);
  slider.value = String(N - 1 - d.cvIndex);
  let W = 460; const H = 240, m = { t: 14, r: 14, b: 40, l: 52 };
  const sx = (i) => m.l + (W - m.l - m.r) * i / (N - 1);
  function render() {
    W = widthOf("#sim3-r2");
    const xAxis = `<text x="${m.l}" y="${H - 10}">weak penalty</text><text x="${W - m.r}" y="${H - 10}" text-anchor="end">strong penalty</text>`;
    const i = Number(slider.value), q = at(i);
    // R2 panel
    const f1 = frame({ W, H, m, y0: 0, y1: 0.8, yTicks: [0, 0.2, 0.4, 0.6, 0.8], yLabel: "Held-out R²" });
    let p1 = `<polyline fill="none" stroke="var(--predictive)" stroke-width="2" points="${d.path.map((_, j) => `${sx(j)},${f1.sy(at(j).r2)}`).join(" ")}"/>`;
    p1 += `<line x1="${sx(i)}" x2="${sx(i)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--muted)" stroke-dasharray="3 3"/>`;
    p1 += `<circle cx="${sx(i)}" cy="${f1.sy(q.r2)}" r="6" fill="var(--predictive)" stroke="var(--paper)" stroke-width="2" data-tip="Held-out R² ${fmt(q.r2, 3)}"/>`;
    $("#sim3-r2").innerHTML = svg(f1, p1 + xAxis, "Held-out R squared along the lasso penalty path");
    // Estimate panel
    const ests = d.path.map((p) => p.estimate).concat([d.dml.lo, d.dml.hi, d.truth]);
    const y0 = Math.min(0, Math.floor(Math.min(...ests) * 10) / 10), y1 = Math.ceil(Math.max(...ests) * 10) / 10 + 0.1;
    const f2 = frame({ W, H, m, y0, y1, yTicks: ticks(y0, y1, 6), yLabel: "Outcome units" });
    let p2 = `<rect x="${m.l}" width="${W - m.l - m.r}" y="${f2.sy(d.dml.hi)}" height="${f2.sy(d.dml.lo) - f2.sy(d.dml.hi)}" fill="var(--causal)" opacity="0.18" data-tip="DML with the same lasso: ${signed(d.dml.estimate, 2)} units (95% interval ${signed(d.dml.lo, 2)} to ${signed(d.dml.hi, 2)})"/>`;
    p2 += `<line x1="${m.l}" x2="${W - m.r}" y1="${f2.sy(d.dml.estimate)}" y2="${f2.sy(d.dml.estimate)}" stroke="var(--causal)" stroke-width="2"/>`;
    p2 += `<line x1="${m.l}" x2="${W - m.r}" y1="${f2.sy(d.truth)}" y2="${f2.sy(d.truth)}" stroke="var(--truth)" stroke-width="2" stroke-dasharray="6 4"/>`;
    p2 += `<polyline fill="none" stroke="var(--predictive)" stroke-width="2" points="${d.path.map((_, j) => `${sx(j)},${f2.sy(at(j).estimate)}`).join(" ")}"/>`;
    p2 += `<line x1="${sx(i)}" x2="${sx(i)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--muted)" stroke-dasharray="3 3"/>`;
    p2 += `<circle cx="${sx(i)}" cy="${f2.sy(q.estimate)}" r="6" fill="var(--predictive)" stroke="var(--paper)" stroke-width="2" data-tip="Lasso at this penalty: ${signed(q.estimate, 2)} units"/>`;
    $("#sim3-est").innerHTML = svg(f2, p2 + xAxis, "Lasso treatment coefficient along the penalty path, with the DML estimate and the truth");
    const cv = d.path[d.cvIndex];
    $("#sim3-lambda-label").textContent = `${i + 1} of ${N}${N - 1 - i === d.cvIndex ? " (chosen by cross-validation)" : ""}`;
    $("#sim3-readout").innerHTML = `<p>At this penalty the held-out R² is ${fmt(q.r2, 3)} (the best on the path is ${fmt(d.bestR2, 3)}), and the lasso reports ${signed(q.estimate, 2)} units against a truth of ${signed(d.truth)}. The ${d.nearBest.count} penalties that predict within 0.002 of the best R² report effects from ${signed(d.nearBest.min, 2)} to ${signed(d.nearBest.max, 2)} units. Five-fold cross-validation picks a penalty that reports ${signed(cv.estimate, 2)}. DML, using the same lasso for its two prediction steps, reports ${signed(d.dml.estimate, 2)} units (95% interval ${signed(d.dml.lo, 2)} to ${signed(d.dml.hi, 2)}).</p><p class="small-print">The lasso path was fitted on ${d.nTrain.toLocaleString("en-US")} patients and its R² scored on ${d.nTest.toLocaleString("en-US")} held out. DML used all ${d.n.toLocaleString("en-US")}: one penalty per prediction step was chosen by cross-validation on the full cohort, then the predictions were cross-fitted over 5 folds. The two methods therefore use different samples and tuning, so this is a configured illustration of regularization bias, not a benchmark of the methods. All ${d.solver.fits} lasso fits converged.</p>`;
  }
  slider.addEventListener("input", render);
  render();
  rerenders.push(render);
}).catch(() => {
  $("#sim3-readout").innerHTML = "<p>The precomputed results for this simulation could not be loaded. Reload the page to try again.</p>";
});

// "Expand all details" opens or closes every collapsible section at once
// (for reading straight through, or printing).
$("#expand-all").addEventListener("click", (e) => {
  const open = e.currentTarget.getAttribute("aria-pressed") !== "true";
  document.querySelectorAll("details.more").forEach((d) => (d.open = open));
  e.currentTarget.setAttribute("aria-pressed", String(open));
  e.currentTarget.textContent = open ? "Collapse all details" : "Expand all details";
  rerenders.forEach((f) => f());
});
// A link to an anchor inside a closed section opens that section first.
function openTo(hash) {
  const el = hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  for (let d = el?.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
}
window.addEventListener("hashchange", () => openTo(location.hash));
openTo(location.hash);

// Charts inside a closed section have no width yet: redraw when it opens.
document.addEventListener("toggle", (e) => {
  if (e.target.open && e.target.querySelector(".chart")) rerenders.forEach((f) => f());
}, true);

// Redraw the charts when their width changes (rotation, window resize).
let lastWidth = 0, resizeTimer = 0;
new ResizeObserver(() => {
  const w = widthOf("#sim1-r2");
  if (Math.abs(w - lastWidth) < 8) return;
  lastWidth = w;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => rerenders.forEach((f) => f()), 120);
}).observe(document.body);

// =====================================================================
// Estimator chooser
// =====================================================================
const CAST = '<a href="https://ishuryak.github.io/cast_demo_website/tutorial/">CAST walkthrough</a>';
const CENSOR = " Whatever you choose, it must handle censoring: a survival version of the estimator (or censoring weights), with censoring assumed independent of the outcome given the measured variables, and enough patients still followed at each horizon (section 5).";
function choose() {
  const v = (n) => document.querySelector(`input[name="${n}"]:checked`).value;
  const time = v("c-time"), goal = v("c-goal"), when = v("c-when");
  let html;
  if (time === "varying") {
    html = `<p><strong>Start with the LMTP estimators.</strong> They are built for decisions made during treatment, such as replanning after weight loss, and handle treatment-confounder feedback that a Cox model with time-varying covariates does not. The sequentially doubly robust (SDR) version is the more forgiving one: it stays consistent if, at each time point, either the outcome model or the treatment model is right.</p><p>Define each decision point, the rule being compared, and the outcome horizon before modeling.${goal === "who" ? " Questions about who benefits from a rule are harder still. Settle the average effect of the rule first." : ""}${CENSOR}</p>`;
  } else if (time === "rule") {
    html = `<p><strong>A rule decided once from baseline factors</strong>, such as "hypofractionate if age is 70 or older or travel exceeds one hour", is a single-time-point policy. AIPW or TMLE can estimate the average outcome if everyone followed the rule, using the same outcome and treatment models as for a static comparison. LMTP software can also do this, with one time point.</p><p>Write the rule down completely before seeing results, and check that patients of every kind the rule covers received the schedule it assigns them.${CENSOR}</p>`;
  } else if (goal === "average" && when === "one") {
    html = `<p><strong>Start with TMLE or AIPW</strong>, with super learning or cross-fitted machine learning for the outcome and propensity models. Report RMST or survival differences at the prespecified horizons.</p><p>Run IPTW and outcome regression alongside as checks (section 8). If they disagree, find out why before reporting any of them.${CENSOR}</p>`;
  } else if (goal === "average" && when === "trajectory") {
    html = `<p><strong>Estimate the effect at several horizons</strong> with TMLE or a causal survival forest, then consider CAST to join them into a smooth trajectory with a band. The trajectory adds a smoothing model and assumptions about uncertainty across horizons, so a peak or a crossing is a model-based summary, not a separate finding. The ${CAST} shows this on simulated data.</p><p>Prespecify the horizons.${CENSOR}</p>`;
  } else {
    html = `<p><strong>Start with a causal survival forest</strong> at one prespecified horizon to estimate the CATE, alongside the average effect.</p><p>Treat any subgroup finding as exploratory until you have checked that ranking patients by predicted benefit separates them better than chance on held-out data. Positivity matters more here: small subgroups often lack patients on one of the two schedules.${when === "trajectory" ? ` For the average trajectory over follow-up, see the ${CAST}. Individual trajectories are much harder to estimate reliably.` : ""}${CENSOR}</p>`;
  }
  $("#chooser-answer").innerHTML = html;
}
$("#chooser").addEventListener("change", choose);
choose();

// =====================================================================
// Trial argument builder (section 10)
// =====================================================================
function argue() {
  const v = (n) => document.querySelector(`input[name="a-${n}"]:checked`).value;
  const r = trialArgument({ aim: v("aim"), prior: v("prior"), bench: v("bench"), ci: v("ci"), bias: v("bias"), support: v("support"), hte: v("hte") });
  const block = (title, items) => (items.length ? `<p class="arg-h">${title}</p><ul>${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
  $("#argue-answer").innerHTML = `<p class="lean"><strong>${esc(r.lean)}.</strong></p>`
    + block("What the retrospective evidence supports", r.supports)
    + block("What it cannot establish", r.cannot)
    + block("Still open", r.open)
    + block("Also consider", r.extras)
    + block("If you propose a trial, your analysis already supplies", r.design)
    + '<p class="small-print">A teaching aid for structuring the argument. The real decision also weighs feasibility, cost, equipoise and patient priorities, which no checklist captures.</p>';
}
$("#argue").addEventListener("change", argue);
argue();

// =====================================================================
// Worksheet
// =====================================================================
const FIELDS = [
  ["q", "Clinical question", "Population, strategies, outcome, horizon, scale", "Among adults starting curative-intent radiotherapy for [tumor site], does moderate hypofractionation change 5-year survival compared with conventional fractionation?"],
  ["pop", "Eligibility", "Who would be enrolled in the target trial. Any restriction changes the population your answer applies to.", "Adults with newly diagnosed [tumor site], curative intent, no prior radiotherapy to the region, both schedules clinically acceptable. Exclude palliative courses."],
  ["strat", "Treatment strategies", "Fully specified at the start: total dose, dose per fraction, number of fractions, timing, essential cointerventions", "A: conventional, [total dose] Gy in [number] fractions of [1.8 to 2] Gy. B: moderate hypofractionation, [total dose] Gy in [number] fractions of [dose] Gy. Same [concurrent therapy]. Classified by the schedule prescribed at the start. If B is a family of schedules, state how the version is chosen."],
  ["t0", "Time zero and follow-up", "Where the target trial would randomize", "First day of radiotherapy for both groups. Follow until death, last contact or 5 years."],
  ["estimand", "Outcome and estimand", "The exact number, for whom, on which scale", "Death from any cause. Difference in 5-year RMST (months) and in 2- and 5-year survival probability. Average treatment effect in the eligible population, plus prespecified subgroups if the goal is to tailor treatment."],
  ["conf", "Baseline confounders to adjust for", "Common causes of schedule and outcome, measured before treatment, from your DAG", "Age, comorbidity score, stage, tumor size, histology, facility type, distance to facility, insurance, calendar year."],
  ["post", "Not in a baseline adjustment for the total effect", "Variables the schedule itself can change", "Treatment interruptions, acute toxicity, early tumor response, later systemic therapy."],
  ["long", "Post-treatment history your method needs", "For per-protocol effects, treatment rules or censoring, g-methods use some of these on purpose", "None for the primary intention-to-treat analog. For a per-protocol analog: interruptions and the factors that drive them, by week."],
  ["cens", "Censoring, follow-up and missing data", "Why patients are censored, whether that could depend on prognosis, and how it is handled", "Administrative censoring at the data cutoff. Loss to follow-up handled by censoring weights or a survival estimator, assuming it is independent of survival given the measured variables. Check that enough patients in each group remain followed at 5 years. Missing baseline data: [plan]."],
  ["gaps", "Data source and known gaps", "What is missing, and how you will probe it", "[Registry or EHR]. No performance status, toxicity or recurrence. Plan a bias analysis for unrecorded performance status."],
  ["est", "Estimators", "Primary, and the ones you run as checks", "Primary: TMLE with super learning, in its survival form. Checks: IPTW and outcome regression. Effect over follow-up: causal survival forest at prespecified horizons, then CAST."],
  ["checks", "Diagnostics and sensitivity", "How you will challenge the result", "Overlap and balance plots. Agreement across estimators. A planted-effect simulation. Shuffled treatment labels (a software check). A negative-control outcome (it can reveal residual bias). Bias analysis on the RMST scale: could plausible unrecorded performance status move the estimate across the benefit or harm thresholds? If a 5-year mortality risk ratio is also reported, its E-value."],
  ["trial", "The argument about a new trial", "What each possible result would mean for the next randomized trial (section 10)", "Thresholds: a meaningful RMST difference is [value] months. If the interval includes both a meaningful benefit and harm, or the bias analysis shows plausible unrecorded performance status could cross a threshold, argue for considering a randomized trial in [the population], with [endpoint, or a noninferiority margin if the shorter schedule is meant to be as good] and a sample size from that target. If a precise trial already answered this question in these patients and the emulation reproduces it, argue that a duplicate trial is a low priority."],
];
const KEY = "causal-roadmap-worksheet-v2";
const sheet = $("#sheet");
sheet.innerHTML = FIELDS.map(([id, label, hint]) => `<label for="ws-${id}">${label}<span class="hint">${hint}</span><textarea id="ws-${id}" rows="2"></textarea></label>`).join("");
sheet.addEventListener("submit", (e) => e.preventDefault());
function loadSheet() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { saved = null; }
  FIELDS.forEach(([id, , , ex]) => { $(`#ws-${id}`).value = saved && typeof saved[id] === "string" ? saved[id] : ex; });
}
function sheetText() {
  return "Causal analysis plan\n\n" + FIELDS.map(([id, label]) => `${label}\n${$(`#ws-${id}`).value.trim() || "(not yet filled in)"}`).join("\n\n");
}
function updateSheet() {
  $("#sheet-out").textContent = sheetText();
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(FIELDS.map(([id]) => [id, $(`#ws-${id}`).value])))); } catch { /* storage unavailable: the page still works */ }
}
loadSheet();
updateSheet();
sheet.addEventListener("input", updateSheet);
const status = (t) => { $("#sheet-status").textContent = t; setTimeout(() => ($("#sheet-status").textContent = ""), 3000); };
$("#sheet-copy").addEventListener("click", () => {
  const text = sheetText();
  const fallback = () => {
    const r = document.createRange(); r.selectNodeContents($("#sheet-out"));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    status("Text selected. Press Ctrl+C or Cmd+C to copy.");
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => status("Copied."), fallback);
  else fallback();
});
$("#sheet-example").addEventListener("click", () => { FIELDS.forEach(([id, , , ex]) => ($(`#ws-${id}`).value = ex)); updateSheet(); status("Example restored."); });
$("#sheet-clear").addEventListener("click", () => { FIELDS.forEach(([id]) => ($(`#ws-${id}`).value = "")); updateSheet(); status("All fields cleared."); });
