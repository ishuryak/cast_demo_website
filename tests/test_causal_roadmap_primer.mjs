// Tests for the causal roadmap primer (docs/causal-roadmap/).
//   node tests/test_causal_roadmap_primer.mjs
// Exits 1 on any failure. The simulation checks below are deterministic SMOKE
// checks over small fixed seed sets: they show the displayed lessons are not a
// fluke of one seed. They are not a Monte Carlo study of coverage or of how the
// methods compare in general. Exact numerics live in test_causal_roadmap_numerics.mjs.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSim1, runSim2, runSim3, SIM1_INDIRECT, SIM2 } from "../docs/causal-roadmap/sims.mjs";
import { trialArgument, OPTIONS, LEANS, classifyInterval } from "../docs/causal-roadmap/trial_argument.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "docs", "causal-roadmap");
let fails = 0, passes = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passes++; console.log(`PASS ${name}`); } else { fails++; console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`); }
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const html = readFileSync(join(dir, "index.html"), "utf8");
const app = readFileSync(join(dir, "app.mjs"), "utf8");
const css = readFileSync(join(dir, "style.css"), "utf8");
const body = html.slice(0, html.indexOf('id="references"'));
const text = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const sectionHtml = (id) => { const a = html.indexOf(`id="${id}"`); return html.slice(a, html.indexOf("</section>", a)); };

// ---------- Simulation 1 smoke checks (25 fixed seeds) ----------
{
  const reps = Array.from({ length: 25 }, (_, i) => runSim1(1000 + i));
  const sc = reps.flatMap((r) => r.scenarios);
  check("sim1 smoke: predictive model has higher held-out R2 in every scenario of every seed", sc.every((s) => s.predictive.r2 > s.causal.r2));
  const predBias = mean(sc.map((s) => s.predictive.estimate - s.total));
  check("sim1 smoke: predictive bias is about minus the mediated effect", Math.abs(predBias + SIM1_INDIRECT) < 0.25, `mean bias ${predBias.toFixed(3)}`);
  const causalBias = mean(sc.map((s) => s.causal.estimate - s.total));
  check("sim1 smoke: causal model's mean error is near zero", Math.abs(causalBias) < 0.15, `mean bias ${causalBias.toFixed(3)}`);
  const cov = mean(sc.map((s) => (s.causal.lo <= s.total && s.total <= s.causal.hi ? 1 : 0)));
  check("sim1 smoke: causal intervals contain the truth in most of the 75 fixed runs", cov >= 0.88, `share ${cov.toFixed(3)}`);
  check("sim1 smoke: no predictive interval contains the truth", sc.every((s) => !(s.predictive.lo <= s.total && s.total <= s.predictive.hi)));
  check("sim1: same seed reproduces exactly", JSON.stringify(runSim1(20260918)) === JSON.stringify(runSim1(20260918)));
}

// ---------- Simulation 2 smoke checks ----------
{
  const zero = Array.from({ length: 15 }, (_, i) => runSim2(0, 2000 + i));
  check("sim2 smoke: with no unrecorded confounding the two models agree", zero.every((r) => Math.abs(r.withPS.estimate - r.withoutPS.estimate) < 0.25));
  const mid = Array.from({ length: 15 }, (_, i) => runSim2(0.6, 3000 + i));
  check("sim2 smoke: at strength 0.6 omitting performance status shifts the estimate by more than 2 units", mid.every((r) => r.withoutPS.estimate - SIM2.truth < -2));
  const cov = mean(mid.map((r) => (r.withPS.lo <= SIM2.truth && SIM2.truth <= r.withPS.hi ? 1 : 0)));
  check("sim2 smoke: with performance status the interval contains the truth in most fixed runs", cov >= 0.8, `share ${cov.toFixed(2)}`);
  const biases = Array.from({ length: 6 }, (_, k) => runSim2(k / 5, 4000)).map((r) => r.withoutPS.estimate - SIM2.truth);
  check("sim2 smoke: bias grows as the slider moves right", biases.every((v, i) => i === 0 || v < biases[i - 1] + 0.3), biases.map((v) => v.toFixed(2)).join(" "));
}

// ---------- Simulation 3 smoke checks (exact file checks are in the numerics suite) ----------
{
  const saved = JSON.parse(readFileSync(join(dir, "sim3.json"), "utf8"));
  check("sim3: every near-best-R2 penalty overestimates the truth at the shown seed", saved.nearBest.min > saved.truth, `min ${saved.nearBest.min}`);
  check("sim3: the DML interval contains the truth at the shown seed", saved.dml.lo <= saved.truth && saved.truth <= saved.dml.hi);
  const reps = Array.from({ length: 6 }, (_, i) => runSim3(5000 + i));
  const cvErr = mean(reps.map((r) => r.path[r.cvIndex].estimate - r.truth));
  const dmlErr = mean(reps.map((r) => r.dml.estimate - r.truth));
  check("sim3 smoke: over 6 fixed seeds the CV-tuned lasso errs upward on average and DML less", cvErr > 0.03 && Math.abs(dmlErr) < cvErr, `lasso ${cvErr.toFixed(3)}, DML ${dmlErr.toFixed(3)}`);
}

// ---------- Page contract: style, citations, links, acronyms ----------
{
  check("page: no em dash anywhere", !/—/.test(html + app));
  check("page: no semicolon-joined prose in visible text", !/[a-z]; [a-z]/.test(text));
  const order = [];
  for (const m of body.matchAll(/href="#ref-(\d+)"/g)) { const n = +m[1]; if (!order.includes(n)) order.push(n); }
  const listed = [...html.matchAll(/<li id="ref-(\d+)"/g)].map((m) => +m[1]);
  check("page: citations appear in first-use order", order.every((n, i) => n === i + 1), order.join(","));
  check("page: every listed reference is cited and every cite is listed", listed.length === order.length && listed.every((n) => order.includes(n)));
  const forbidden = ["PSPS", "Georg", "RADCURE", "pypsps", "23,0", "1.4 months", "DeStephano", "Unpublished"];
  const hit = forbidden.filter((f) => (html + app).includes(f));
  check("page: no unpublished project material or names", hit.length === 0, hit.join(", "));
  const hosts = [...html.matchAll(/(?:href|src)="(https?:\/\/[^/"]+)/g)].map((m) => m[1]);
  const allowed = ["https://ishuryak.github.io", "https://doi.org", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://miguelhernan.org",
    "https://www.fda.gov", "https://arxiv.org", "https://bayes.cs.ucla.edu", "https://www.fox.temple.edu", "https://hsph.harvard.edu",
    "https://vanderlaan-lab.org", "https://causalai.net", "https://www.mit.edu", "https://www.gsb.stanford.edu"];
  const bad = hosts.filter((h) => !allowed.includes(h));
  check("page: external links only to the CAST site, DOIs, fonts, sources and the listed researchers' pages", bad.length === 0, bad.join(", "));
  const missing = [];
  for (const a of ["RMST", "HR", "DAG", "ATE", "ATT", "CATE", "IPTW", "AIPW", "TMLE", "DML", "LMTP", "CSF", "CAST", "NCDB", "SEER", "EHR", "SHAP", "C-index", "RCT", "FDA", "PATH", "SDR"]) {
    const def = text.indexOf(`(${a})`);
    const first = text.search(new RegExp(`(^|[^A-Za-z(-])${a.replace("-", "\\-")}(?![A-Za-z)])`));
    if (def < 0 || (first >= 0 && first < def)) missing.push(a);
  }
  check("page: every acronym is defined at or before its first use", missing.length === 0, missing.join(", "));
  check("page: no bare ML abbreviation", !/\bML\b/.test(text.replace(/Petersen ML/g, "")));
}

// ---------- Layout: main points visible, details collapsible ----------
{
  const ids = ["history", "questions", "question", "trial", "dag", "estimand", "identify", "policies", "estimators", "checks", "compare", "rct", "trial-argument", "worksheet"];
  const lacking = ids.filter((id) => { const s = sectionHtml(id); return !/class="lede"/.test(s) || !/<details class="more/.test(s); });
  check("layout: every section has a visible main point and collapsible details", lacking.length === 0, lacking.join(", "));
  check("layout: no details section starts open", !/<details[^>]*\bopen\b/.test(html));
  check("layout: simulations, traps, examples and the try-it questions are collapsible", ["sim1", "sim2", "sim3"].every((s) => new RegExp(`<details class="more sim" id="${s}"`).test(html)) && (html.match(/class="more trap-box"/g) || []).length >= 3 && /<summary>Try it: which kind of question is this\?<\/summary>/.test(html) && /<summary>Two lessons from history<\/summary>/.test(html));
  check("layout: an expand-all control exists and is wired", /id="expand-all"/.test(html) && /#expand-all/.test(app));
  check("layout: charts are redrawn when a collapsed section opens", /addEventListener\("toggle"/.test(app));
  check("layout: body text is at least 20px and long references wrap", /font-size: 20px/.test(css) && /\.refs li \{[^}]*overflow-wrap: anywhere/.test(css));
  check("layout: blue, green and red accents are defined for light and dark modes", (css.match(/--blue:/g) || []).length >= 3 && (css.match(/--green:/g) || []).length >= 3 && (css.match(/--red:/g) || []).length >= 3);
}

// ---------- Content the author asked for, and the audit's corrections ----------
{
  const head = html.slice(0, html.indexOf("</header>"));
  check("goal: improving treatment for subgroups and individual patients is stated in the masthead", /better treatment/.test(head) && /each group of patients/.test(head) && /each patient/.test(head));
  check("goal: the end goal (an argument about a new RCT) is stated in the masthead", /end goal of the analysis itself is an argument/.test(head) && /randomized controlled trial \(RCT\)/.test(head));
  const hist = sectionHtml("history");
  const people = (hist.match(/<li><a href="https:/g) || []).length + (hist.match(/ and <a href="https:/g) || []).length;
  check("history: names at least eight researchers with links and says the list is not exhaustive", people >= 8 && /not exhaustive/.test(hist), String(people));
  check("history: covers Pearl, Robins, Hernán, Rubin, Bareinboim, Chernozhukov and Athey", ["Pearl", "Robins", "Hernán", "Rubin", "Bareinboim", "Chernozhukov", "Athey"].every((n) => hist.includes(n)));
  // F17: one numbering scheme. No "step N" cross-references, and every "section N" exists.
  const ta = readFileSync(join(dir, "trial_argument.mjs"), "utf8");
  const strings = [...(app + ta).matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]).join(" ");
  check("numbering: no 'step N' cross-references remain, in the page or in script text", !/\bsteps? \d/i.test(text) && !/\bsteps? \d/i.test(strings), ((text + " " + strings).match(/.{30}\bsteps? \d.{20}/i) || [""])[0]);
  const refs = [...text.matchAll(/\bsections? (\d+)(?: and (\d+))?/g)].flatMap((m) => [m[1], m[2]].filter(Boolean).map(Number));
  check("numbering: every 'section N' reference points to a section 0 to 11", refs.length > 10 && refs.every((n) => n >= 0 && n <= 11), refs.join(","));
  const nav = html.slice(html.indexOf('class="roadmap'), html.indexOf("</nav>"));
  const navNums = [...nav.matchAll(/class="n">(\d+)</g)].map((m) => +m[1]);
  check("numbering: roadmap runs 0 to 11", navNums.join(",") === Array.from({ length: 12 }, (_, i) => i).join(","));
  const eyebrows = [...html.matchAll(/<section class="part" id="([a-z-]+)">\s*<div class="wrap">\s*<p class="eyebrow"><span class="stepnum">(\d+)<\/span>/g)].map((m) => [m[1], +m[2]]);
  const navMap = Object.fromEntries([...nav.matchAll(/href="#([a-z-]+)"><span class="n">(\d+)</g)].map((m) => [m[1], +m[2]]));
  check("numbering: every section eyebrow matches its roadmap number", eyebrows.length === 12 && eyebrows.every(([id, n]) => navMap[id] === n), JSON.stringify(eyebrows));
  // F01: censoring belongs to identification.
  const ident = sectionHtml("identify");
  check("F01: identification covers ignorable censoring and follow-up through the horizon", /Ignorable censoring/.test(ident) && /Follow-up through the horizon/.test(ident) && /Randomization does not fix informative loss to follow-up/.test(ident));
  check("F01: the chooser and worksheet carry a censoring plan", /const CENSOR = /.test(app) && /\["cens", "Censoring, follow-up and missing data"/.test(app));
  // F04: sensitivity on the estimand's scale.
  check("F04: the E-value is tied to ratio scales, and RMST gets its own bias analysis", /applies directly to a risk ratio/.test(sectionHtml("checks")) && /needs a conversion whose assumptions must be stated/.test(sectionHtml("checks")) && /on the RMST scale/.test(sectionHtml("checks")));
  // F05: LMTP and DML qualifications.
  const est = sectionHtml("estimators");
  check("F05: SDR and TMLE robustness are distinguished, and valid intervals need conditions", /Sequentially doubly robust \(SDR\): at each time point/.test(est) && /ordered combinations/.test(est) && /does not earn a valid interval/.test(est) && /When effects vary, it estimates a weighted average/.test(est));
  // F06: total versus direct path.
  check("F06: the diagram labels the direct path and defines the total effect as both paths", /direct path/.test(app) && /total effect = both teal paths/.test(app) && !/effect of interest/.test(app) && /sum of both teal paths/.test(html));
  check("F06: the mediator rule is scoped, and g-methods may use post-treatment history", /in a baseline analysis of the total effect/.test(html) && /use post-treatment history, on purpose/.test(html));
  // F07: delayed entry has no fixed direction, immortal time is separate.
  const trialSec = sectionHtml("trial");
  check("F07: delayed entry is selection with no fixed direction, distinct from immortal time", /selection bias/.test(trialSec) && /Its direction is not fixed/.test(trialSec) && /immortal time/.test(trialSec) && !/makes the conventional group look healthier/.test(trialSec));
  // F08: fully specified strategies; one-time rules route differently from time-varying ones.
  check("F08: strategies must be fully specified, and the chooser separates baseline rules from time-varying decisions", /total dose, dose per fraction, number of fractions/.test(html) && /value="rule"/.test(html) && /time === "rule"/.test(app));
  // F09/F10: toy outcomes and disclosed allocation.
  check("F09: simulations are labeled as toy continuous outcomes, not survival times", (html.match(/toy/g) || []).length >= 3 && /not a survival-time simulation/.test(html) && !/3-month response/.test(html + app));
  check("F10: simulation 3 discloses sample sizes, tuning and that it is not a benchmark", /d\.nTrain/.test(app) && /d\.nTest/.test(app) && /not a benchmark of the methods/.test(app));
  check("F03: CHHiP's primary endpoint is named", /biochemical or clinical failure/.test(html));
  const rct = sectionHtml("rct");
  check("R4: generalizability and transportability follow Degtiar, and excluded patients are an extrapolation", /subset of the target population/.test(rct) && /at least partly outside it/.test(rct) && /extrapolation/.test(rct));
  check("R13: the worksheet storage key was bumped so returning users get the corrected text", /causal-roadmap-worksheet-v2/.test(app));
}

// ---------- Section 10 builder: radios match the logic exactly ----------
{
  const radios = [...html.matchAll(/name="a-(\w+)" value="(\w+)"/g)].map((m) => [m[1], m[2]]);
  const want = Object.entries(OPTIONS).flatMap(([k, vs]) => vs.map((v) => [k, v]));
  const key = (x) => x.map(([k, v]) => `${k}=${v}`).sort().join(" ");
  check("builder: page radios match the logic's options exactly", key(radios) === key(want), key(radios));
  check("builder: page script passes every option to the logic", Object.keys(OPTIONS).every((k) => app.includes(`${k}: v("${k}")`)));
}

// ---------- Section 10 builder: scientific invariants over every combination ----------
{
  const combos = Object.entries(OPTIONS).reduce((acc, [k, vs]) => acc.flatMap((c) => vs.map((v) => ({ ...c, [k]: v }))), [{}]);
  const expected = Object.values(OPTIONS).reduce((p, v) => p * v.length, 1);
  const res = combos.map((c) => [c, trialArgument(c)]);
  const all = (pred) => res.every(([c, r]) => pred(c, r));
  const txt = (r) => [r.lean, ...r.supports, ...r.cannot, ...r.open, ...r.extras, ...r.design].join(" ");
  check(`builder: all ${expected} combinations give a lean and at least one reason`, res.length === expected && all((c, r) => r.lean && r.supports.length + r.cannot.length > 0));
  check("A02: only a conclusive trial of the same question lowers the priority of a duplicate", all((c, r) => (r.key === "duplicate") === (c.prior === "conclusive" && c.bench !== "no")));
  check("A02: an inconclusive trial is never treated as settling the question", all((c, r) => c.prior !== "inconclusive" || (r.key !== "duplicate" && r.extras.some((t) => /does not settle this question/.test(t)))));
  check("A02: a failed benchmark limits the estimate but does not forbid a trial", all((c, r) => !(c.bench === "no" && c.prior !== "conclusive") || (r.key === "investigate" && /may still be justified/.test(txt(r)))));
  check("A03: a restricted population is stated, and an unsupported group is a separate question", all((c, r) => (c.support === "restricted") === r.extras.some((t) => /only to the patients with overlap/.test(t) && /separate question/.test(t))));
  const AGAINST = ["duplicate", "lowpriority", "nobenefit", "harm", "ni_doubt"];
  check("A03: no output both deprioritizes a trial and proposes one, in design inputs or in notes", all((c, r) => !AGAINST.includes(r.key) || (r.design.length === 0 && !r.extras.some((t) => /support a trial in them|Argue either for a trial/.test(t)))));
  check("R2: a failed benchmark against a conclusive trial offers no design for a duplicate", all((c, r) => !(c.prior === "conclusive" && c.bench === "no") || (r.key === "investigate" && r.design.length === 0 && /justified only if that difference defines a new question/.test(txt(r)))));
  check("R3: meaningful benefit excluded with the bias analysis holding is not called inconclusive", all((c, r) => !(c.aim === "superiority" && c.ci === "harm_or_none" && c.bias === "within" && c.prior !== "conclusive" && c.bench !== "no") || r.key === "nobenefit"));
  check("R4: extending a trial to patients it excluded is called an extrapolation", all((c, r) => c.prior !== "excludes" || AGAINST.includes(r.key) || r.extras.some((t) => /extrapolation/.test(t))));
  check("A04: a noninferiority argument always names the margin and never calls similarity proof", all((c, r) => c.aim !== "noninferiority" || r.key === "duplicate" || r.key === "investigate" || r.key === "notready" || (/margin/.test(txt(r)) && /does not establish noninferiority/.test(txt(r)))));
  check("A04: low priority only for superiority, negligible effects, and a bias analysis that holds", all((c, r) => r.key !== "lowpriority" || (c.aim === "superiority" && c.ci === "negligible" && c.bias === "within")));
  check("A04: a negligible superiority result still points to noninferiority if the schedule has other advantages", all((c, r) => r.key !== "lowpriority" || r.open.some((t) => /noninferiority/.test(t))));
  check("A05: a harm-side interval is never read as benefit or as a reason for a superiority trial", all((c, r) => !["clear_harm", "harm_or_none"].includes(c.ci) || !["hypothesis", "consider", "lowpriority"].includes(r.key)));
  // R5: the six patterns partition every numeric interval, given harm < 0 < benefit.
  const grid = [-3, -2, -1.5, -1, -0.5, -0.2, 0, 0.2, 0.5, 1, 1.5, 2, 3];
  const seen = new Set();
  let partitionOk = true;
  for (const lo of grid) for (const hi of grid) if (lo <= hi) {
    const k = classifyInterval(lo, hi, -1, 1); seen.add(k);
    const hits = { clear_benefit: lo >= 1, clear_harm: hi <= -1, both: lo <= -1 && hi >= 1, benefit_or_none: lo > -1 && lo < 1 && hi >= 1, harm_or_none: hi < 1 && hi > -1 && lo <= -1, negligible: lo > -1 && hi < 1 };
    if (Object.values(hits).filter(Boolean).length !== 1 || !hits[k]) partitionOk = false;
  }
  check("R5: every numeric interval falls in exactly one pattern, and every pattern is reachable", partitionOk && OPTIONS.ci.every((k) => seen.has(k)), [...seen].join(","));
  check("R5: a clearly positive but trivially small effect counts as negligible, not as a clear benefit", classifyInterval(0.1, 0.4, -1, 1) === "negligible" && classifyInterval(1.1, 2, -1, 1) === "clear_benefit");
  check("A05: a benefit-side interval is never read as harm", all((c, r) => !["clear_benefit", "benefit_or_none"].includes(c.ci) || !["harm", "ni_doubt"].includes(r.key)));
  check("A05: every interval pattern appears in plain words in some output", Object.keys(OPTIONS.ci.reduce((o, k) => ({ ...o, [k]: 1 }), {})).every((k) => res.some(([c, r]) => c.ci === k && txt(r).length > 0)));
  check("A06: without a bias analysis there is no categorical verdict", all((c, r) => c.bias !== "unknown" || c.prior === "conclusive" || c.bench === "no" || r.key === "notready"));
  check("A06: no output attaches an E-value to the builder's estimate", all((c, r) => !/E-value/.test(txt(r))));
  check("F04: sample size comes from a clinical target, not from the observational interval", all((c, r) => r.design.length === 0 || r.design.some((t) => /clinically relevant target effect or margin/.test(t) && /sampling error only/.test(t))));
  check("builder: positive controls give specific answers", trialArgument({ aim: "superiority", prior: "none", bench: "na", ci: "clear_benefit", bias: "within", support: "full", hte: "no" }).key === "hypothesis"
    && trialArgument({ aim: "superiority", prior: "none", bench: "na", ci: "both", bias: "within", support: "full", hte: "no" }).key === "consider"
    && trialArgument({ aim: "superiority", prior: "conclusive", bench: "yes", ci: "both", bias: "unknown", support: "full", hte: "no" }).key === "duplicate");
  check("builder: positivity gaps and heterogeneity always add their note", all((c, r) => (c.hte === "yes") === r.extras.some((t) => /stratified randomization/.test(t))));
  check("builder: text has no em dash or semicolon", all((c, r) => !/[—;]/.test(txt(r))));
  check("builder: every lean is one of the declared leans", all((c, r) => Object.values(LEANS).includes(r.lean)));
  let threw = false;
  try { trialArgument({ ...combos[0], ci: "maybe" }); } catch { threw = true; }
  check("builder: an unknown input value is rejected, not silently mapped", threw);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
