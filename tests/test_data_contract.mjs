// Contract test: does scenarios.json satisfy everything docs/app.js reads?
//
// This is the check the site did not have when its exported scenario keys gained
// an "_unmeasNN" suffix and app.js kept looking up the old key: every lookup
// missed, render() returned early, and the page showed a permanently blank plot
// with no error. Nothing else in the project would have caught it.
//
//   node tests/test_data_contract.mjs [path/to/scenarios.json]
//
// Exits non-zero on any FAIL.

import fs from "fs";
import path from "path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2] || path.join(root, "docs", "data", "scenarios.json");
const appjs = fs.readFileSync(path.join(root, "docs", "app.js"), "utf8");

const fail = [], warn = [];
const F = m => fail.push(m), W = m => warn.push(m);

let d;
try { d = JSON.parse(fs.readFileSync(file, "utf8")); }
catch (e) { console.error(`FAIL  cannot read/parse ${file}: ${e.message}`); process.exit(1); }

// The key format app.js builds. Kept in sync with docs/app.js:key().
const key = (shape, conf, unmeas) =>
  `${shape}_conf${Number(conf).toFixed(2)}_unmeas${Number(unmeas).toFixed(2)}`;

// ---- 1. top-level shape --------------------------------------------------
for (const f of ["generated", "horizons", "shapes", "conf_grid", "unmeas_grid", "scenarios"])
  if (d[f] == null) F(`top-level field missing: ${f}`);
// auto_unbox in jsonlite turns a length-1 vector into a scalar, which makes
// DATA.shapes.forEach throw. I() on the R side keeps them arrays.
for (const f of ["horizons", "shapes", "conf_grid", "unmeas_grid"])
  if (d[f] != null && !Array.isArray(d[f]))
    F(`${f} is ${typeof d[f]} (${JSON.stringify(d[f])}), not an array: ` +
      `a length-1 grid was unboxed and app.js's .forEach/.length will fail`);

const K = (d.horizons || []).length;
if (!K) F("horizons is empty");

// ---- 2. every reachable control setting resolves to a scenario -----------
let reachable = 0;
for (const sh of d.shapes || [])
  for (const c of d.conf_grid || [])
    for (const u of d.unmeas_grid || []) {
      const k = key(sh, c, u), s = (d.scenarios || {})[k];
      if (!s) { F(`app.js lookup "${k}" -> NOT FOUND (render() aborts; blank plot)`); continue; }
      reachable++;

      const vec = (v, name, len = K) => {
        if (!Array.isArray(v)) { F(`${k}.${name} is not an array`); return false; }
        if (v.length !== len) { F(`${k}.${name} length ${v.length} != ${len}`); return false; }
        if (v.some(x => x == null)) W(`${k}.${name} contains nulls`);
        return true;
      };
      for (const p of ["truth", "naive", "rsf", "tlearner"]) vec(s[p], p);
      for (const p of ["ate", "lo", "hi"]) vec(s.csf?.[p], `csf.${p}`);
      for (const p of ["fit", "lo", "hi"]) vec(s.cast?.[p], `cast.${p}`);
      vec(s.cox?.ate, "cox.ate");

      // dense trajectory: optional, but if present all four arrays must align
      const ct = s.cast?.curve_t;
      if (Array.isArray(ct) && ct.length) {
        for (const p of ["curve_fit", "curve_lo", "curve_hi"])
          vec(s.cast[p], `cast.${p}`, ct.length);
        if (ct[0] !== d.horizons[0] || ct[ct.length - 1] !== d.horizons[K - 1])
          F(`${k}.cast.curve_t spans [${ct[0]}, ${ct[ct.length-1]}] but horizons ` +
            `span [${d.horizons[0]}, ${d.horizons[K-1]}]`);
      } else W(`${k}.cast.curve_t absent: CAST renders as a polyline, not a smooth curve`);

      // scalars each card reads
      const need = (obj, keys, label) => keys.forEach(p => {
        if (obj?.[p] === undefined) F(`${k}.${label}.${p} missing`);
      });
      need(s.cox, ["hr", "lo", "hi", "ph_p"], "cox");
      need(s.rmse, ["naive", "cox", "rsf", "tlearner", "csf", "cast"], "rmse");
      need(s.meta, ["shape", "conf_strength", "unmeas_strength", "n", "event_rate",
                    "treated_frac", "smd_age", "smd_ps", "smd_comorb", "smd_smoke",
                    "smd_u_hidden"], "meta");
      need(s.overlap, ["min", "max", "pct_extreme", "pct_clipped"], "overlap");
      need(s.shrinkage, ["alpha", "target_scale", "cond_before", "cond_after"], "shrinkage");
      need(s.cast, ["method", "r_squared", "peak_in_range"], "cast");
      need(s.robustness, ["ate_omitU", "ate_withU", "shift", "s0_baseline", "evalue"],
           "robustness");
      for (const p of ["ate_omitU", "ate_withU", "shift", "s0_baseline", "evalue"])
        if (Array.isArray(s.robustness?.[p])) vec(s.robustness[p], `robustness.${p}`);

      // The E-value's risk-ratio conversion is anchored to the control arm's
      // own survival at each horizon. It used to assume a flat 0.5 everywhere,
      // which mis-anchored both ends of a window where control survival runs
      // from about 0.90 to about 0.11. Check the anchor is a real, falling
      // survival curve -- not a constant, and not something out of range.
      const s0 = s.robustness?.s0_baseline;
      if (Array.isArray(s0) && s0.length === K) {
        if (s0.some(v => !(v > 0 && v <= 1)))
          F(`${k}.robustness.s0_baseline is not a survival probability: ${JSON.stringify(s0)}`);
        for (let i = 1; i < s0.length; i++)
          if (s0[i] > s0[i - 1] + 1e-9)
            F(`${k}.robustness.s0_baseline rises between horizons ${i - 1}->${i} ` +
              `(${s0[i - 1]} -> ${s0[i]}); a survival curve cannot increase`);
        if (s0.every(v => Math.abs(v - s0[0]) < 1e-9))
          F(`${k}.robustness.s0_baseline is constant at ${s0[0]} across all ` +
            `${K} horizons; the E-value baseline is not anchored per horizon`);
        // ...and the exported E-value must actually be that formula applied to
        // that anchor, so the two cannot drift apart silently.
        const ev = s.robustness?.evalue, a = s.robustness?.ate_omitU;
        if (Array.isArray(ev) && Array.isArray(a))
          for (let i = 0; i < K; i++) {
            const b = Math.min(Math.max(s0[i], 1e-4), 1 - 1e-4);
            const t = Math.min(Math.max(b + a[i], 1e-4), 1 - 1e-4);
            let rr = (1 - b) / (1 - t); if (rr < 1) rr = 1 / rr;
            const want = rr + Math.sqrt(rr * (rr - 1));
            if (Math.abs(want - ev[i]) > 0.02)
              F(`${k}.robustness.evalue[${i}] = ${ev[i]} does not reproduce from ` +
                `ate ${a[i]} at baseline ${s0[i]} (expected ${want.toFixed(2)})`);
          }
      }

      // The oracle refit gets the latent factor in BOTH the covariates and the
      // propensity. What pins THAT specific defect is the source-level contract
      // in tests/test_fit_contract.R; the assertions here check that the export
      // behaves the way a working oracle has to behave, which is a weaker but
      // independent check (they would not, on their own, have caught an oracle
      // blinded on the treatment side -- at Gamma = 1.5 that version still cut
      // the bias by a third).
      const rb = s.robustness;
      if (Array.isArray(s.truth) && Array.isArray(rb?.ate_omitU) && Array.isArray(rb?.ate_withU)) {
        const mid = Math.floor(K / 2);
        const blind = Math.abs(rb.ate_omitU[mid] - s.truth[mid]);
        const orac  = Math.abs(rb.ate_withU[mid] - s.truth[mid]);
        const gap   = rb.ate_omitU[mid] - rb.ate_withU[mid];
        const total = rb.ate_omitU[mid] - s.truth[mid];

        if (Number(u) === 0) {
          // Null check: with no latent factor there is nothing for the oracle to
          // see, so it must land essentially on top of the blinded fit. A gap
          // here would mean the two fits differ for some reason OTHER than the
          // latent factor, which would invalidate every nonzero-Gamma reading.
          if (Math.abs(gap) > 0.03)
            F(`${k}: Gamma = 0 but the oracle gap is ${gap.toFixed(3)}; with no ` +
              `latent factor the oracle and blinded fits must agree`);
        } else {
          // The latent factor is protective and pro-treatment, so omitting it
          // biases upward: the gap must be positive.
          if (!(gap > 0))
            F(`${k}: the oracle gap is ${gap.toFixed(3)}; omitting a protective, ` +
              `pro-treatment latent factor must bias the estimate upward`);
          // ...and it cannot exceed the total bias by much, or the oracle is
          // over-correcting past the truth rather than recovering it.
          if (gap > 1.6 * total + 0.03)
            F(`${k}: the oracle gap ${gap.toFixed(3)} overshoots the total bias ` +
              `${total.toFixed(3)}; the oracle is correcting past the truth`);
        }
        // At the strong latent setting the oracle must get materially closer to
        // the truth. It does not reach it: a separate measured-confounding
        // residual survives at high gamma (up to 0.070 at Gamma = 0), which is
        // the positivity limit the demo teaches elsewhere and is not the
        // oracle's to fix.
        if (Number(u) === 1.5 && blind > 0.05 && !(orac <= 0.75 * blind))
          F(`${k}: at Gamma = 1.5 the oracle is not materially closer to the ` +
            `truth (|oracle - truth| = ${orac.toFixed(3)} vs ` +
            `|blinded - truth| = ${blind.toFixed(3)})`);
      }

      // the meta must agree with the key it is filed under
      if (s.meta && (s.meta.shape !== sh ||
                     Number(s.meta.conf_strength) !== Number(c) ||
                     Number(s.meta.unmeas_strength) !== Number(u)))
        F(`${k}.meta says (${s.meta.shape}, ${s.meta.conf_strength}, ` +
          `${s.meta.unmeas_strength}) but is filed under (${sh}, ${c}, ${u})`);

      if (s.cast?.peak_in_range === true &&
          (s.cast.peak_time == null || s.cast.peak_effect == null))
        F(`${k}.cast peak_in_range is true but peak_time/peak_effect are null`);
    }

// ---- 3. nothing shipped that the UI cannot reach --------------------------
const total = Object.keys(d.scenarios || {}).length;
if (total > reachable)
  F(`${total - reachable} of ${total} scenarios are unreachable from the UI ` +
    `(shipped weight the site never displays)`);

// ---- 4. the R and JS confounding vocabularies must agree ------------------
// Both sides key their labels to the value of gamma; if they drift, the static
// figures and the live controls disagree about what "moderate" means.
const m = appjs.match(/const CONF_WORDS\s*=\s*\{([^}]*)\}/);
if (!m) F("could not find CONF_WORDS in docs/app.js");
else {
  const js = Object.fromEntries([...m[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map(x => [x[1], x[2]]));
  const rfile = fs.readFileSync(path.join(root, "R", "scenario_labels.R"), "utf8");
  const rm = rfile.match(/CONF_WORDS\s*<-\s*c\(([^)]*)\)/);
  const r = rm ? Object.fromEntries([...rm[1].matchAll(/"([^"]+)"\s*=\s*"([^"]+)"/g)].map(x => [x[1], x[2]])) : null;
  if (!r) F("could not find CONF_WORDS in R/scenario_labels.R");
  else if (JSON.stringify(js) !== JSON.stringify(r))
    F(`CONF_WORDS disagree: app.js ${JSON.stringify(js)} vs R ${JSON.stringify(r)}`);
  for (const c of d.conf_grid || [])
    if (!(String(c) in js)) W(`gamma = ${c} has no word in CONF_WORDS; the control shows the raw value`);
}

// ---- report ---------------------------------------------------------------
console.log(`data contract: ${file}`);
console.log(`  ${total} scenarios, ${reachable} reachable from the UI, ${K} horizons`);
warn.forEach(w => console.log("  WARN  " + w));
fail.forEach(f => console.log("  FAIL  " + f));
console.log(fail.length ? `  => ${fail.length} FAILURES` : "  => PASS");
process.exit(fail.length ? 1 : 0);
