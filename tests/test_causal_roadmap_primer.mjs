// Tests for the causal roadmap primer (docs/causal-roadmap/).
//   node tests/test_causal_roadmap_primer.mjs
// Exits 1 on any failure. Each simulation claim the page makes in words is
// checked over many seeds, so the displayed seed is shown to be typical.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSim1, runSim2, runSim3, SIM1_INDIRECT, SIM2 } from "../docs/causal-roadmap/sims.mjs";
import { trialArgument, OPTIONS } from "../docs/causal-roadmap/trial_argument.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "docs", "causal-roadmap");
let fails = 0, passes = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passes++; console.log(`PASS ${name}`); } else { fails++; console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`); }
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

// ---------- Simulation 1: better prediction, wrong effect ----------
{
  const reps = Array.from({ length: 25 }, (_, i) => runSim1(1000 + i));
  const sc = reps.flatMap((r) => r.scenarios);
  check("sim1: predictive model has higher held-out R2 in every scenario of every replicate",
    sc.every((s) => s.predictive.r2 > s.causal.r2));
  const predBias = mean(sc.map((s) => s.predictive.estimate - s.total));
  check("sim1: predictive bias equals minus the indirect effect", Math.abs(predBias + SIM1_INDIRECT) < 0.25, `mean bias ${predBias.toFixed(3)}`);
  const causalBias = mean(sc.map((s) => s.causal.estimate - s.total));
  check("sim1: causal model is unbiased", Math.abs(causalBias) < 0.15, `mean bias ${causalBias.toFixed(3)}`);
  const cov = mean(sc.map((s) => (s.causal.lo <= s.total && s.total <= s.causal.hi ? 1 : 0)));
  check("sim1: causal 95% intervals cover at a nominal rate", cov >= 0.88, `coverage ${cov.toFixed(3)}`);
  check("sim1: no predictive interval covers the truth", sc.every((s) => !(s.predictive.lo <= s.total && s.total <= s.predictive.hi)));
  const a = runSim1(20260918), b = runSim1(20260918);
  check("sim1: same seed reproduces exactly", JSON.stringify(a) === JSON.stringify(b));
}

// ---------- Simulation 2: unmeasured confounder ----------
{
  const zero = Array.from({ length: 15 }, (_, i) => runSim2(0, 2000 + i));
  check("sim2: with no unrecorded confounding the two models agree",
    zero.every((r) => Math.abs(r.withPS.estimate - r.withoutPS.estimate) < 0.25));
  const mid = Array.from({ length: 15 }, (_, i) => runSim2(0.6, 3000 + i));
  check("sim2: at strength 0.6 omitting performance status biases the estimate by more than 2 months",
    mid.every((r) => r.withoutPS.estimate - SIM2.truth < -2));
  const cov = mean(mid.map((r) => (r.withPS.lo <= SIM2.truth && SIM2.truth <= r.withPS.hi ? 1 : 0)));
  check("sim2: with performance status the interval covers the truth at a nominal rate", cov >= 0.8, `coverage ${cov.toFixed(2)}`);
  const strong = Array.from({ length: 6 }, (_, k) => runSim2(k / 5, 4000));
  const biases = strong.map((r) => r.withoutPS.estimate - SIM2.truth);
  check("sim2: bias grows as the slider moves right", biases.every((v, i) => i === 0 || v < biases[i - 1] + 0.3), biases.map((v) => v.toFixed(2)).join(" "));
}

// ---------- Simulation 3: regularization ----------
{
  const saved = JSON.parse(readFileSync(join(dir, "sim3.json"), "utf8"));
  const fresh = runSim3();
  const same = saved.path.length === fresh.path.length &&
    saved.path.every((q, i) => Math.abs(q.estimate - fresh.path[i].estimate) < 1e-5 && Math.abs(q.r2 - fresh.path[i].r2) < 1e-5) &&
    Math.abs(saved.dml.estimate - fresh.dml.estimate) < 1e-5 && saved.cvIndex === fresh.cvIndex;
  check("sim3: sim3.json matches a fresh run of sims.mjs (regenerate with build_sim3.mjs)", same);
  check("sim3: every near-best-R2 penalty overestimates the truth", saved.nearBest.min > saved.truth, `min ${saved.nearBest.min}`);
  check("sim3: the DML interval covers the truth", saved.dml.lo <= saved.truth && saved.truth <= saved.dml.hi);
  check("sim3: near-best R2 really is flat (more than 5 penalties)", saved.nearBest.count > 5);
  // The shown seed is typical: over fresh seeds, DML is closer to the truth than the CV-tuned lasso on average.
  const reps = Array.from({ length: 6 }, (_, i) => runSim3(5000 + i));
  const cvErr = mean(reps.map((r) => r.path[r.cvIndex].estimate - r.truth));
  const dmlErr = mean(reps.map((r) => r.dml.estimate - r.truth));
  check("sim3: CV-tuned lasso is biased upward across seeds, DML much less", cvErr > 0.03 && Math.abs(dmlErr) < cvErr, `lasso ${cvErr.toFixed(3)}, DML ${dmlErr.toFixed(3)}`);
}

// ---------- Page contract ----------
{
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const app = readFileSync(join(dir, "app.mjs"), "utf8");
  const body = html.slice(0, html.indexOf('id="references"'));
  check("page: no em dash anywhere", !/—/.test(html + app));
  check("page: no semicolon-joined prose in visible text", !/[a-z]; [a-z]/.test(body.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, "")));
  const order = [];
  for (const m of body.matchAll(/href="#ref-(\d+)"/g)) { const n = +m[1]; if (!order.includes(n)) order.push(n); }
  const listed = [...html.matchAll(/<li id="ref-(\d+)"/g)].map((m) => +m[1]);
  check("page: citations appear in first-use order", order.every((n, i) => n === i + 1), order.join(","));
  check("page: every listed reference is cited and every cite is listed", listed.length === order.length && listed.every((n) => order.includes(n)));
  const forbidden = ["PSPS", "Georg", "RADCURE", "pypsps", "23,0", "1.4 months", "DeStephano", "Unpublished"];
  const hit = forbidden.filter((f) => (html + app).includes(f));
  check("page: no unpublished project material or names", hit.length === 0, hit.join(", "));
  const hosts = [...html.matchAll(/(?:href|src)="(https?:\/\/[^/"]+)/g)].map((m) => m[1]);
  const allowed = ["https://ishuryak.github.io", "https://doi.org", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://miguelhernan.org", "https://www.fda.gov", "https://arxiv.org"];
  const bad = hosts.filter((h) => !allowed.includes(h));
  check("page: external links only to the CAST site, DOIs, fonts, the What If book, the FDA guidance and arXiv", bad.length === 0, bad.join(", "));
  // Acronyms: first bare use must come at or after the "(ACR)" definition.
  const text = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const missing = [];
  for (const a of ["RMST", "HR", "DAG", "ATE", "ATT", "CATE", "IPTW", "AIPW", "TMLE", "DML", "LMTP", "CSF", "CAST", "NCDB", "SEER", "EHR", "SHAP", "C-index", "RCT", "FDA", "PATH"]) {
    const def = text.indexOf(`(${a})`);
    const first = text.search(new RegExp(`(^|[^A-Za-z(-])${a.replace("-", "\\-")}(?![A-Za-z)])`));
    if (def < 0 || (first >= 0 && first < def)) missing.push(a);
  }
  check("page: every acronym is defined at or before its first use", missing.length === 0, missing.join(", "));
  check("page: no bare ML abbreviation", !/\bML\b/.test(text.replace(/Petersen ML/g, "")));
}

// ---------- Sections 9 and 10: trial data and the argument about a new trial ----------
{
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const app = readFileSync(join(dir, "app.mjs"), "utf8");
  const ids = ["rct", "trial-argument", "worksheet"];
  check("page: sections 9, 10 and 11 exist and are linked from the roadmap", ids.every((id) => html.includes(`id="${id}"`) && html.includes(`href="#${id}"`)));
  const nav = html.slice(html.indexOf('class="roadmap'), html.indexOf("</nav>"));
  const nums = [...nav.matchAll(/class="n">(\d+)</g)].map((m) => +m[1]);
  check("page: roadmap steps are numbered 0 to 11 in order", nums.join(",") === Array.from({ length: 12 }, (_, i) => i).join(","), nums.join(","));
  check("page: the end goal is stated in the masthead", /end goal is an argument/.test(html.slice(0, html.indexOf("</header>"))));
  check("page: randomized trial use is flagged before section 9", html.indexOf('href="#rct"') < html.indexOf('id="rct"') && /randomized controlled trial \(RCT\) data/.test(html));
  // Every radio button in the builder must be a value the logic accepts, and every value must have a button.
  const radios = [...html.matchAll(/name="a-(\w+)" value="(\w+)"/g)].map((m) => [m[1], m[2]]);
  const want = Object.entries(OPTIONS).flatMap(([k, vs]) => vs.map((v) => [k, v]));
  const key = (x) => x.map(([k, v]) => `${k}=${v}`).sort().join(" ");
  check("builder: page radios match the logic's options exactly", key(radios) === key(want), key(radios));
  check("builder: page script wires the builder and the worksheet has the trial field", /trialArgument\(/.test(app) && /\["trial", "The argument about a new trial"/.test(app));
  // Exhaustive: every combination yields a verdict, and the rules that must hold do hold.
  const combos = Object.entries(OPTIONS).reduce((acc, [k, vs]) => acc.flatMap((c) => vs.map((v) => ({ ...c, [k]: v }))), [{}]);
  const res = combos.map((c) => [c, trialArgument(c)]);
  check("builder: all 324 combinations give a verdict and reasons", res.length === 324 && res.every(([, r]) => r.verdict && r.reasons.length > 0));
  check("builder: a transportable trial that the emulation does not contradict always wins",
    res.filter(([c]) => c.prior === "transports" && c.bench !== "no").every(([, r]) => r.key === "existing"));
  check("builder: a failed benchmark is always resolved first (unless a trial already answers it)",
    res.filter(([c]) => c.bench === "no").every(([, r]) => r.key === "disagree"));
  check("builder: an interval spanning benefit and harm argues for a trial whatever the robustness",
    res.filter(([c]) => c.ci === "both" && c.bench !== "no" && c.prior !== "transports").every(([, r]) => r.key === "uncertain"));
  check("builder: a clear but fragile effect argues for a trial, a clear robust one is a hypothesis, unknown robustness is not ready",
    res.filter(([c]) => c.ci === "benefit" && c.bench !== "no" && c.prior !== "transports").every(([c, r]) =>
      r.key === { fragile: "confounding", robust: "hypothesis", unknown: "notready" }[c.robust]));
  check("builder: no trial design inputs are offered when the argument is against a trial",
    res.every(([, r]) => (r.key === "existing" || r.key === "lowpriority") === (r.design.length === 0)));
  check("builder: positivity gaps and heterogeneity always add their note",
    res.every(([c, r]) => (c.gaps === "yes") === r.extras.some((t) => /positivity/.test(t)) && (c.hte === "yes") === r.extras.some((t) => /stratified randomization/.test(t))));
  check("builder: text has no em dash or semicolon", res.every(([, r]) => !/[—;]/.test([r.verdict, ...r.reasons, ...r.extras, ...r.design].join(" "))));
  let threw = false;
  try { trialArgument({ ...combos[0], ci: "maybe" }); } catch { threw = true; }
  check("builder: an unknown input value is rejected, not silently mapped", threw);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
