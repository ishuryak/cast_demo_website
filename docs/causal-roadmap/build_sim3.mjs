// Writes sim3.json, the precomputed lasso path for Simulation 3.
// Simulation 3 takes one to two seconds, so the page reads this file instead of
// running it on load. tests/test_causal_roadmap_primer.mjs reruns it and fails
// if the file no longer matches what sims.mjs produces.
//   node docs/causal-roadmap/build_sim3.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSim3, SIM3 } from "./sims.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const round = (x) => Math.round(x * 1e6) / 1e6;
const r = runSim3();
const out = {
  note: "Synthetic data only. Regenerate with: node docs/causal-roadmap/build_sim3.mjs",
  design: SIM3,
  truth: r.truth, n: r.n, p: r.p, nTrain: r.nTrain, nTest: r.nTest,
  cvIndex: r.cvIndex, bestR2: round(r.bestR2),
  nearBest: { count: r.nearBest.count, min: round(r.nearBest.min), max: round(r.nearBest.max) },
  dml: Object.fromEntries(Object.entries(r.dml).map(([k, v]) => [k, round(v)])),
  path: r.path.map((q) => ({ lambda: round(q.lambda), estimate: round(q.estimate), r2: round(q.r2) })),
};
writeFileSync(join(here, "sim3.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote sim3.json: ${out.path.length} penalties, DML ${out.dml.estimate}`);
