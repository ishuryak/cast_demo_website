// Writes sim3.json, the precomputed lasso path for Simulation 3.
// Simulation 3 takes one to two seconds, so the page reads this file instead of
// running it on load. tests/test_causal_roadmap_primer.mjs reruns it and fails
// if any saved field differs from what sims.mjs produces.
//   node docs/causal-roadmap/build_sim3.mjs
// Exits 1 without writing if any lasso fit failed to converge.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSim3, serializeSim3 } from "./sims.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = serializeSim3(runSim3());
if (out.solver.unconverged > 0 || out.solver.maxKKT > 1e-6) {
  console.error(`sim3 build refused: ${out.solver.unconverged} of ${out.solver.fits} fits did not converge, max KKT residual ${out.solver.maxKKT}`);
  process.exit(1);
}
writeFileSync(join(here, "sim3.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote sim3.json: ${out.path.length} penalties, DML ${out.dml.estimate}, ${out.solver.fits} fits converged (max ${out.solver.maxIterations} sweeps, KKT ${out.solver.maxKKT})`);
