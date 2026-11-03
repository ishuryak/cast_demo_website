// Numerical checks for the causal roadmap primer's simulations.
//   node tests/test_causal_roadmap_numerics.mjs
// Exits 1 on any failure. These are deterministic reference checks of the code,
// not a Monte Carlo study of coverage or of how methods compare in general.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ols, lassoPath, runSim1, runSim3, serializeSim3, dmlFromResiduals, SIM3, SIM3_SEED } from "../docs/causal-roadmap/sims.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "docs", "causal-roadmap");
let fails = 0, passes = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passes++; console.log(`PASS ${name}`); } else { fails++; console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`); }
};
const close = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------- sim3.json: every saved field, plus independent invariants ----------
const savedText = readFileSync(join(dir, "sim3.json"), "utf8");
const saved = JSON.parse(savedText);
const fresh = serializeSim3(runSim3());
const freshText = JSON.stringify(fresh, null, 1) + "\n";
check("sim3.json equals a fresh build field for field (regenerate with build_sim3.mjs)", freshText === savedText);
check("sim3 build is deterministic (two builds give the same text)", JSON.stringify(serializeSim3(runSim3())) === JSON.stringify(fresh));
{
  const s = saved, d = s.design;
  const nums = JSON.stringify(s).match(/-?\d+(\.\d+)?(e-?\d+)?/g).map(Number);
  check("sim3: every number is finite", nums.every(Number.isFinite));
  check("sim3: design and counts agree", s.seed === SIM3_SEED && JSON.stringify(d) === JSON.stringify(SIM3) && s.n === d.n && s.truth === d.truth && s.p === d.pStrong + d.pWeak + d.pNoise);
  check("sim3: fitting and holdout samples partition the cohort", s.nTrain + s.nTest === s.n && s.nTrain > 0 && s.nTest > 0);
  check("sim3: allocation block matches the counts it discloses", s.allocation.lassoPathFit === s.nTrain && s.allocation.predictionHoldout === s.nTest && s.allocation.dmlEstimation === s.n);
  check("sim3: one path entry per penalty, penalties strictly decreasing", s.path.length === d.nLambda && s.path.every((q, i) => i === 0 || q.lambda < s.path[i - 1].lambda));
  check("sim3: CV index is a valid path position", Number.isInteger(s.cvIndex) && s.cvIndex >= 0 && s.cvIndex < s.path.length);
  const best = Math.max(...s.path.map((q) => q.r2));
  check("sim3: best R2 is the path maximum", close(s.bestR2, best, 1e-6));
  const nb = s.path.filter((q) => q.r2 >= best - 0.002);
  check("sim3: near-best summary recomputed from the path", nb.length === s.nearBest.count && close(s.nearBest.min, Math.min(...nb.map((q) => q.estimate)), 1e-6) && close(s.nearBest.max, Math.max(...nb.map((q) => q.estimate)), 1e-6));
  const m = s.dml;
  check("sim3: DML standard error positive and interval is estimate +/- 1.96 SE", m.se > 0 && m.lo < m.estimate && m.estimate < m.hi && close(m.hi - m.lo, 2 * 1.96 * m.se, 2e-6) && close((m.hi + m.lo) / 2, m.estimate, 2e-6));
  check("sim3: every lasso fit converged (KKT residual below 1e-6)", s.solver.fits === 426 && s.solver.unconverged === 0 && s.solver.maxKKT < 1e-6, JSON.stringify(s.solver));
}

// ---------- lasso solver against analytic references ----------
{
  // Well-conditioned, lambda = 0: must equal OLS.
  const X = [], y = [];
  for (let i = 0; i < 300; i++) { const a = Math.sin(0.37 * i), b = Math.cos(0.91 * i), c = Math.sin(1.7 * i + 1); X.push([a, b, c]); y.push(3 + 1.5 * a - 2 * b + 0.25 * c + 0.05 * Math.sin(5.3 * i)); }
  const fit = lassoPath(X, y, [0], [1, 1, 1])[0];
  const ref = ols(X.map((r) => [1, ...r]), y);
  check("lasso at zero penalty equals OLS (well-conditioned fixture)", fit.converged && close(fit.intercept, ref.beta[0], 1e-6) && fit.beta.every((b, j) => close(b, ref.beta[j + 1], 1e-6)));
}
{
  // The audit's correlated fixture: at 500 sweeps it must REPORT nonconvergence
  // rather than return an inaccurate answer silently, and with more sweeps it converges.
  const X = [], y = [];
  for (let i = 0; i < 200; i++) { const x1 = Math.sin(0.3 * i), x2 = Math.cos(0.7 * i), x3 = x1 + 0.1 * Math.cos(0.15 * i); X.push([x1, x2, x3]); y.push(7 + 2 * x1 - 3 * x2 + 0.5 * x3 + 0.01 * Math.sin(i)); }
  const ref = ols(X.map((r) => [1, ...r]), y);
  const capped = lassoPath(X, y, [0], [1, 1, 1], { maxIter: 500 })[0];
  const errCapped = Math.max(...capped.beta.map((b, j) => Math.abs(b - ref.beta[j + 1])));
  check("correlated fixture: a fit more than 1e-4 from OLS never claims convergence", errCapped < 1e-4 || capped.converged === false, `converged=${capped.converged}, error ${errCapped.toExponential(2)}`);
  const long = lassoPath(X, y, [0], [1, 1, 1], { maxIter: 200000, tol: 1e-12 })[0];
  const errLong = Math.max(...long.beta.map((b, j) => Math.abs(b - ref.beta[j + 1])));
  check("correlated fixture: converges to OLS when allowed enough sweeps", long.converged && errLong < 1e-4, `error ${errLong.toExponential(2)}`);
}
{
  // Orthogonal standardized design: the lasso solution is soft thresholding of <z_j, y>/n.
  const n = 8;
  const cols = [[1, -1, 1, -1, 1, -1, 1, -1], [1, 1, -1, -1, 1, 1, -1, -1], [1, 1, 1, 1, -1, -1, -1, -1]];
  const X = Array.from({ length: n }, (_, i) => cols.map((c) => c[i]));
  const y = X.map((r, i) => 2 * r[0] - 0.5 * r[1] + 0.1 * r[2] + [0.3, -0.2, 0.1, 0, 0.05, -0.1, 0.2, -0.35][i]);
  const lam = 0.3;
  const fit = lassoPath(X, y, [lam], [1, 1, 1])[0];
  const ym = y.reduce((s, v) => s + v, 0) / n;
  const soft = (c) => Math.sign(c) * Math.max(Math.abs(c) - lam, 0);
  const want = cols.map((c) => soft(c.reduce((s, v, i) => s + v * (y[i] - ym), 0) / n));
  check("lasso with orthogonal columns equals analytic soft thresholding", fit.converged && fit.beta.every((b, j) => close(b, want[j], 1e-9)), `${fit.beta.map((v) => v.toFixed(4))} vs ${want.map((v) => v.toFixed(4))}`);
}
{
  const r = runSim3(SIM3_SEED, { maxIter: 2 });
  check("a deliberately tiny iteration limit is reported, not hidden", r.solver.unconverged > 0, `${r.solver.unconverged} unconverged`);
}

// ---------- OLS and DML standard errors against independent formulas ----------
{
  // Simple regression: slope = Sxy/Sxx, SE = sqrt(s2/Sxx), s2 = RSS/(n-2).
  const x = [1, 2, 3, 4, 5, 6, 7, 8], y = [1.1, 1.9, 3.2, 3.8, 5.3, 5.9, 7.2, 7.8];
  const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  const sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0), sxy = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  const slope = sxy / sxx, icpt = my - slope * mx;
  const rss = x.reduce((s, v, i) => s + (y[i] - icpt - slope * v) ** 2, 0);
  const se = Math.sqrt(rss / (n - 2) / sxx);
  const fit = ols(x.map((v) => [1, v]), y);
  check("OLS slope and its standard error match the closed form", close(fit.beta[1], slope, 1e-10) && close(fit.se[1], se, 1e-10));
}
{
  // Residual-on-residual estimate with a sandwich SE, written independently.
  const rt = [0.5, -0.3, 0.8, -0.6, 0.1, -0.9, 0.4, 0.2], ry = [1.2, -0.4, 1.9, -1.1, 0.5, -2.2, 0.6, 0.9];
  const b = rt.reduce((s, v, i) => s + v * ry[i], 0) / rt.reduce((s, v) => s + v * v, 0);
  const meat = rt.reduce((s, v, i) => s + (v * (ry[i] - b * v)) ** 2, 0);
  const bread = rt.reduce((s, v) => s + v * v, 0);
  const got = dmlFromResiduals(ry, rt);
  check("DML estimate and sandwich SE match an independent computation", close(got.theta, b, 1e-12) && close(got.se, Math.sqrt(meat) / bread, 1e-12));
}
{
  const r = runSim1(20260918);
  check("sim1: every interval is estimate +/- 1.96 SE", r.scenarios.every((s) => ["causal", "predictive"].every((k) => close(s[k].hi - s[k].lo, 2 * 1.96 * s[k].se, 1e-9))));
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
