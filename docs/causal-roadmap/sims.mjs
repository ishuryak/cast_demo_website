// Three teaching simulations for the causal roadmap primer.
//
// Adapted from the simulations in Igor Shuryak's October 2026 AIPHI talk
// ("How do you know a causal model is right?"). They are synthetic: no patient
// data enters any of them. Every number the page shows is computed here, in the
// reader's browser, from a fixed seed, so the prose never quotes a typed number.
//
// The running example is hypofractionated (T = 1) versus conventionally
// fractionated (T = 0) radiotherapy. Outcomes are simplified to a continuous
// "months of survival" with no censoring, so that ordinary least squares is
// enough and the only thing that differs between two models is WHICH variables
// they use. That is the point of all three simulations.

// ---------- random numbers ----------
export function rng(seed) {
  let a = seed >>> 0;
  const unif = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const norm = (mu = 0, sd = 1) => {
    if (spare !== null) { const s = spare; spare = null; return mu + sd * s; }
    let u = 0, v = 0;
    while (u === 0) u = unif();
    v = unif();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return mu + sd * r * Math.cos(2 * Math.PI * v);
  };
  const bern = (p) => (unif() < p ? 1 : 0);
  return { unif, norm, bern };
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// ---------- small linear algebra ----------
// Solve A x = b for symmetric positive definite A (Cholesky).
function cholSolve(A, b) {
  const n = A.length;
  const L = A.map(() => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (s <= 0) throw new Error("matrix not positive definite");
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
    y[i] = s / L[i][i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

function inverse(A) {
  const n = A.length;
  const out = A.map(() => new Float64Array(n));
  for (let j = 0; j < n; j++) {
    const e = new Float64Array(n); e[j] = 1;
    const col = cholSolve(A, e);
    for (let i = 0; i < n; i++) out[i][j] = col[i];
  }
  return out;
}

// Ordinary least squares. rows: array of design rows (intercept included by caller).
export function ols(rows, y) {
  const p = rows[0].length, n = rows.length;
  const XtX = Array.from({ length: p }, () => new Float64Array(p));
  const Xty = new Float64Array(p);
  for (let r = 0; r < n; r++) {
    const x = rows[r];
    for (let i = 0; i < p; i++) {
      Xty[i] += x[i] * y[r];
      for (let j = 0; j <= i; j++) XtX[i][j] += x[i] * x[j];
    }
  }
  for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) XtX[i][j] = XtX[j][i];
  const beta = cholSolve(XtX, Xty);
  let rss = 0;
  for (let r = 0; r < n; r++) {
    let f = 0; for (let i = 0; i < p; i++) f += rows[r][i] * beta[i];
    rss += (y[r] - f) ** 2;
  }
  const sigma2 = rss / (n - p);
  const inv = inverse(XtX);
  const se = Array.from({ length: p }, (_, i) => Math.sqrt(sigma2 * inv[i][i]));
  return { beta: Array.from(beta), se };
}

function predict(rows, beta) {
  return rows.map((x) => x.reduce((s, v, i) => s + v * beta[i], 0));
}

export function r2(y, yhat) {
  const m = y.reduce((s, v) => s + v, 0) / y.length;
  let ss = 0, st = 0;
  for (let i = 0; i < y.length; i++) { ss += (y[i] - yhat[i]) ** 2; st += (y[i] - m) ** 2; }
  return 1 - ss / st;
}

function fitAndScore(train, test, cols, coefIndex) {
  const design = (d) => d.map((o) => [1, ...cols.map((c) => o[c])]);
  const fit = ols(design(train), train.map((o) => o.Y));
  const est = fit.beta[coefIndex], se = fit.se[coefIndex];
  return {
    estimate: est, se, lo: est - 1.96 * se, hi: est + 1.96 * se,
    r2: r2(test.map((o) => o.Y), predict(design(test), fit.beta)),
  };
}

function split(data, frac, R) {
  const train = [], test = [];
  for (const d of data) (R.unif() < frac ? train : test).push(d);
  return { train, test };
}

// =====================================================================
// Simulation 1. Better prediction, wrong effect.
// Adjusting for a variable measured AFTER treatment starts.
//
//   X  frailty score at diagnosis (higher = frailer), standard normal
//   T  hypofractionation; frailer patients are more likely to get it
//   R  tumor response at 3 months; caused by T and by X
//   Y  survival in months (continuous, no censoring)
//
//   R = M*T - 0.5*X + u          Y = 48 - 12*X + bDirect*T + G*R + e
//
// The total effect of T is bDirect + G*M. A model that adjusts for R returns
// bDirect, so its bias is exactly -G*M in every scenario.
// =====================================================================
export const SIM1 = {
  n: 8000, M: 1.0, G: 6.0, responseSd: 0.8, outcomeSd: 6.0,
  treatOnFrailty: 1.0,
  scenarios: [
    { key: "A", label: "No effect", total: 0 },
    { key: "B", label: "Helps", total: 4 },
    { key: "C", label: "Harms", total: -4 },
  ],
};
export const SIM1_INDIRECT = SIM1.G * SIM1.M;

export function runSim1(seed = 20260918) {
  const R = rng(seed);
  const n = SIM1.n;
  const base = [];
  for (let i = 0; i < n; i++) {
    const X = R.norm();
    const T = R.bern(sigmoid(SIM1.treatOnFrailty * X));
    base.push({ X, T, train: R.unif() < 0.5 });
  }
  const scenarios = SIM1.scenarios.map((sc) => {
    const bDirect = sc.total - SIM1_INDIRECT;
    const data = base.map((b) => {
      const Rv = SIM1.M * b.T - 0.5 * b.X + R.norm(0, SIM1.responseSd);
      const Y = 48 - 12 * b.X + bDirect * b.T + SIM1.G * Rv + R.norm(0, SIM1.outcomeSd);
      return { ...b, R: Rv, Y };
    });
    const train = data.filter((d) => d.train), test = data.filter((d) => !d.train);
    return {
      ...sc, direct: bDirect,
      causal: fitAndScore(train, test, ["X", "T"], 2),
      predictive: fitAndScore(train, test, ["X", "T", "R"], 2),
    };
  });
  return { nTrain: base.filter((b) => b.train).length, nTest: base.filter((b) => !b.train).length, scenarios };
}

// =====================================================================
// Simulation 2. When the confounder is not in the data.
//
//   PS  performance status (higher = worse), standard normal, UNRECORDED in the
//       registry version of the data
//   C1..C3  recorded covariates (age, comorbidity, stage on a standardized scale)
//   T   hypofractionation; more likely when PS is worse
//   Y   survival in months; worse when PS is worse
//
// strength (0 to 1) scales both arrows out of PS together.
// =====================================================================
export const SIM2 = { n: 6000, truth: 1.0, outcomeSd: 8.0, maxPsOnTreat: 1.6, maxPsOnSurv: 8.0 };

export function runSim2(strength = 0.6, seed = 20261008) {
  const R = rng(seed);
  const g = SIM2.maxPsOnTreat * strength, d = SIM2.maxPsOnSurv * strength;
  const data = [];
  for (let i = 0; i < SIM2.n; i++) {
    const PS = R.norm(), C1 = R.norm(), C2 = R.norm(), C3 = R.norm();
    const T = R.bern(sigmoid(0.4 * C1 + g * PS));
    const Y = 40 - 3 * C1 - 2 * C2 + 1.5 * C3 - d * PS + SIM2.truth * T + R.norm(0, SIM2.outcomeSd);
    data.push({ PS, C1, C2, C3, T, Y });
  }
  const { train, test } = split(data, 0.7, R);
  const withPS = fitAndScore(train, test, ["C1", "C2", "C3", "PS", "T"], 5);
  const withoutPS = fitAndScore(train, test, ["C1", "C2", "C3", "T"], 4);
  return { truth: SIM2.truth, strength, nTrain: train.length, nTest: test.length, withPS, withoutPS };
}

// =====================================================================
// Simulation 3. Every confounder is measured, but the model is regularized.
//
// p covariates: a few matter strongly for survival and weakly for treatment,
// more matter weakly for survival and strongly for treatment, the rest for
// neither. A lasso tuned for prediction shrinks exactly the covariates that
// carry the confounding, so the treatment coefficient absorbs it. Cross-fitted
// partialling out (the linear case of double machine learning, DML) uses the
// same lasso for its two prediction steps and is far less sensitive to the
// penalty.
// =====================================================================
export const SIM3 = {
  n: 10000, pStrong: 4, pWeak: 60, pNoise: 20, truth: 0.3, outcomeSd: 2.0,
  strongOnY: 1.5, weakOnY: 0.06, weakOnT: 0.2, strongOnT: 0.05, nLambda: 26, folds: 5,
};

function standardizeCols(Xtr) {
  const n = Xtr.length, p = Xtr[0].length;
  const mean = new Float64Array(p), sd = new Float64Array(p);
  for (const r of Xtr) for (let j = 0; j < p; j++) mean[j] += r[j] / n;
  for (const r of Xtr) for (let j = 0; j < p; j++) sd[j] += (r[j] - mean[j]) ** 2 / n;
  for (let j = 0; j < p; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  return { mean, sd };
}

// Lasso by coordinate descent on the Gram matrix, for a whole lambda path.
// penalty[j] = 0 leaves column j unpenalized. Returns one fit per lambda with
// coefficients on the ORIGINAL scale plus the intercept.
export function lassoPath(Xtr, ytr, lambdas, penalty) {
  const n = Xtr.length, p = Xtr[0].length;
  const { mean, sd } = standardizeCols(Xtr);
  const ym = ytr.reduce((s, v) => s + v, 0) / n;
  const G = Array.from({ length: p }, () => new Float64Array(p));
  const c = new Float64Array(p);
  const z = new Float64Array(p);
  for (let r = 0; r < n; r++) {
    const row = Xtr[r];
    for (let j = 0; j < p; j++) z[j] = (row[j] - mean[j]) / sd[j];
    const yc = ytr[r] - ym;
    for (let j = 0; j < p; j++) {
      c[j] += (z[j] * yc) / n;
      const zj = z[j], Gj = G[j];
      for (let k = 0; k <= j; k++) Gj[k] += (zj * z[k]) / n;
    }
  }
  for (let j = 0; j < p; j++) for (let k = j + 1; k < p; k++) G[j][k] = G[k][j];
  const b = new Float64Array(p);
  const grad = Float64Array.from(c); // c - G b, with b = 0
  const out = [];
  for (const lam of lambdas) {
    for (let it = 0; it < 500; it++) {
      let maxDelta = 0;
      for (let j = 0; j < p; j++) {
        const rho = grad[j] + G[j][j] * b[j];
        const thr = lam * penalty[j];
        const nb = rho > thr ? (rho - thr) / G[j][j] : rho < -thr ? (rho + thr) / G[j][j] : 0;
        const delta = nb - b[j];
        if (delta !== 0) {
          for (let k = 0; k < p; k++) grad[k] -= G[k][j] * delta;
          b[j] = nb;
          if (Math.abs(delta) > maxDelta) maxDelta = Math.abs(delta);
        }
      }
      if (maxDelta < 1e-7) break;
    }
    const beta = Array.from(b, (v, j) => v / sd[j]);
    const intercept = ym - beta.reduce((s, v, j) => s + v * mean[j], 0);
    out.push({ lambda: lam, beta, intercept });
  }
  return out;
}

const predictLin = (X, fit) => X.map((r) => r.reduce((s, v, j) => s + v * fit.beta[j], fit.intercept));

function lambdaGrid(Xtr, ytr, nLam, penalty) {
  // Largest useful lambda: max |<z_j, y>|/n over penalized columns.
  const n = Xtr.length, p = Xtr[0].length;
  const { mean, sd } = standardizeCols(Xtr);
  const ym = ytr.reduce((s, v) => s + v, 0) / n;
  let lmax = 0;
  for (let j = 0; j < p; j++) {
    if (!penalty[j]) continue;
    let s = 0;
    for (let r = 0; r < n; r++) s += ((Xtr[r][j] - mean[j]) / sd[j]) * (ytr[r] - ym);
    lmax = Math.max(lmax, Math.abs(s / n));
  }
  const lmin = lmax * 1e-3;
  return Array.from({ length: nLam }, (_, i) => lmax * Math.pow(lmin / lmax, i / (nLam - 1)));
}

function foldIds(n, k, R) {
  const ids = Array.from({ length: n }, (_, i) => i % k);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(R.unif() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids;
}

function cvLambda(X, y, lambdas, penalty, folds) {
  const mse = new Float64Array(lambdas.length);
  const k = Math.max(...folds) + 1;
  for (let f = 0; f < k; f++) {
    const trX = [], trY = [], teX = [], teY = [];
    X.forEach((r, i) => (folds[i] === f ? (teX.push(r), teY.push(y[i])) : (trX.push(r), trY.push(y[i]))));
    const path = lassoPath(trX, trY, lambdas, penalty);
    path.forEach((fit, li) => {
      const pr = predictLin(teX, fit);
      for (let i = 0; i < teY.length; i++) mse[li] += (teY[i] - pr[i]) ** 2 / y.length;
    });
  }
  let best = 0;
  for (let i = 1; i < mse.length; i++) if (mse[i] < mse[best]) best = i;
  return best;
}

export function runSim3(seed = 20260914) {
  const S = SIM3, R = rng(seed);
  const p = S.pStrong + S.pWeak + S.pNoise;
  const X = [], T = [], Y = [];
  for (let i = 0; i < S.n; i++) {
    const x = Array.from({ length: p }, () => R.norm());
    let lt = 0, ly = 0;
    for (let j = 0; j < S.pStrong; j++) { lt += S.strongOnT * x[j]; ly += S.strongOnY * x[j]; }
    for (let j = S.pStrong; j < S.pStrong + S.pWeak; j++) { lt += S.weakOnT * x[j]; ly += S.weakOnY * x[j]; }
    const t = R.bern(sigmoid(lt));
    X.push(x); T.push(t); Y.push(40 + ly + S.truth * t + R.norm(0, S.outcomeSd));
  }
  // 70% fit, 30% held out, for the "prediction" view.
  const isTrain = X.map(() => R.unif() < 0.7);
  const trX = [], trY = [], teX = [], teY = [];
  X.forEach((x, i) => (isTrain[i] ? (trX.push([T[i], ...x]), trY.push(Y[i])) : (teX.push([T[i], ...x]), teY.push(Y[i]))));
  const pen = [0, ...Array(p).fill(1)]; // treatment column unpenalized
  const lambdas = lambdaGrid(trX, trY, S.nLambda, pen);
  const path = lassoPath(trX, trY, lambdas, pen).map((fit) => ({
    lambda: fit.lambda, estimate: fit.beta[0], r2: r2(teY, predictLin(teX, fit)),
  }));
  const folds = foldIds(trX.length, S.folds, R);
  const cvIndex = cvLambda(trX, trY, lambdas, pen, folds);

  // Cross-fitted partialling out (DML, linear case) on the full cohort, using
  // the same lasso for both nuisance regressions, each tuned by cross-validation.
  const penX = Array(p).fill(1);
  const allFolds = foldIds(S.n, S.folds, R);
  const lamY = lambdaGrid(X, Y, S.nLambda, penX), lamT = lambdaGrid(X, T, S.nLambda, penX);
  const bestY = lamY[cvLambda(X, Y, lamY, penX, allFolds)];
  const bestT = lamT[cvLambda(X, T, lamT, penX, allFolds)];
  const resY = new Float64Array(S.n), resT = new Float64Array(S.n);
  for (let f = 0; f < S.folds; f++) {
    const aX = [], aY = [], aT = [], idx = [];
    X.forEach((x, i) => (allFolds[i] === f ? idx.push(i) : (aX.push(x), aY.push(Y[i]), aT.push(T[i]))));
    const fy = lassoPath(aX, aY, [bestY], penX)[0];
    const ft = lassoPath(aX, aT, [bestT], penX)[0];
    for (const i of idx) {
      resY[i] = Y[i] - predictLin([X[i]], fy)[0];
      resT[i] = T[i] - predictLin([X[i]], ft)[0];
    }
  }
  let num = 0, den = 0;
  for (let i = 0; i < S.n; i++) { num += resT[i] * resY[i]; den += resT[i] * resT[i]; }
  const theta = num / den;
  let v = 0;
  for (let i = 0; i < S.n; i++) v += (resT[i] * (resY[i] - theta * resT[i])) ** 2;
  const se = Math.sqrt(v / S.n) / (den / S.n) / Math.sqrt(S.n);

  const bestR2 = Math.max(...path.map((q) => q.r2));
  const nearBest = path.filter((q) => q.r2 >= bestR2 - 0.002);
  return {
    truth: S.truth, p, n: S.n, nTrain: trX.length, nTest: teX.length,
    path, cvIndex, bestR2,
    nearBest: { count: nearBest.length, min: Math.min(...nearBest.map((q) => q.estimate)), max: Math.max(...nearBest.map((q) => q.estimate)) },
    dml: { estimate: theta, se, lo: theta - 1.96 * se, hi: theta + 1.96 * se },
  };
}
