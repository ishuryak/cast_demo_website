# Public-release readiness audit and fix pass

**Date:** 2026-08-25
**Decision owner:** Igor Shuryak
**Trigger:** the repository was about to be made public on GitHub. a colleague
had approved the scientific content; the question asked was whether the code and
documentation were ready to publish alongside it.

The landed changes and their evidence are in [`../FIXES.md`](../FIXES.md). This
file records the *reasoning*: what was investigated, what was found, what was
investigated and dismissed, and what was decided and why.

---

## 1. State at the start of the audit

The committed tip as of 2026-08-25 was coherent and served correctly. The **working
tree was not**: it held an unfinished feature branch adding an
unmeasured-confounding axis to the simulation, together with an oracle CSF
refit, an AUTOC statistic and E-values. The R side had been updated and re-run;
the front end and the README had not.

The consequence was a hard break. `docs/app.js` looked up
`plateau_conf0.00`; the regenerated export keyed scenarios as
`plateau_conf0.00_unmeas0.00`. Every one of the eight lookups the sliders could
produce missed, `render()` returned early, and the page showed a blank plot with
no error at all.

## 2. What the audit covered

- Full read of all 1,757 lines of R, JS, HTML, CSS and shell.
- Git history: every path ever committed, and a secret/PHI scan across all
  revisions. Clean; the repository has only ever contained the 23 files that
  should be public.
- All 8 static figures opened and compared against their captions.
- The statistical core (`R/cast_core.R`) checked line by line against what the
  documentation claims it does.
- The pipeline run end-to-end in an isolated copy, at both smoke and full size.
- Both citations resolved to source and checked field by field.

## 3. Findings, and how each was established

Ordered as they were found, not by severity. Severity and the fix are in
`FIXES.md`; what follows is how each was *shown* rather than suspected.

| # | Finding | How it was established |
|---|---------|------------------------|
| 1 | Blank plot | Replayed `app.js`'s `key()` against the exported JSON in node: 0 of 24 scenarios reachable |
| 2 | `run_all.sh` not executable | Cloned the repo to a temp dir and ran the README's own command; `Permission denied` |
| 3 | Smoke test overwrites `docs/` | Ran the documented smoke test in an isolated copy; the published JSON went 24 → 2 scenarios |
| 4 | `auto_unbox` scalar breaks the page | Same run; `d.shapes.forEach is not a function` inside `init()` |
| 5 | Figure mislabelled | Same run; opened the produced PNG and read the title against its data |
| 6 | "~55 months" does not reproduce | Computed the marginal control median analytically over 200k draws: 46.6 |
| 7 | "trapezoidal" is not what runs | Read `cumsum(sweep(h0, 2, du, '*'))` against the claim |
| 8 | "Baselines fall short" is contradicted | 5-seed replication, below |
| 9 | RMSE card over-precise | Same replication |
| 10 | Ledoit–Wolf shrinkage inert | α = 0.002–0.026 and condition number unchanged in all 24 scenarios |
| 11 | Exporter republishes smoke data when run alone | Found by asking how else finding 3 could be reached; reproduced by running `R/03_export.R` after a smoke test and watching `docs/` drop to 2 scenarios |

## 4. Measurements taken

### 4.1 Five-seed replication (plateau, γ = 1, n = 2000)

Run to answer two questions: is the method ordering the site shows real, and is
Cox's advantage on the plateau a fluke of one draw?

| | naive | Cox | RSF-S | RSF-T | CSF | CAST |
|---|---|---|---|---|---|---|
| mean RMSE | 0.171 | **0.009** | 0.057 | 0.079 | 0.033 | 0.032 |
| sd | 0.013 | 0.006 | 0.022 | 0.013 | 0.013 | 0.011 |
| rank, 5 seeds | 6,6,6,6,6 | 1,3,1,1,1 | 4,4,4,4,4 | 5,5,5,5,5 | 3,1,2,2,3 | 2,2,3,3,2 |

Two conclusions, both now stated in the README:

1. **The coarse ordering is real.** Naive is worst in 5 of 5 seeds, RSF-T fifth
   in 5 of 5, RSF-S fourth in 5 of 5. The teaching point survives replication.
2. **The fine ordering is not.** CSF and CAST differ by 0.0004 on a between-seed
   spread of about 0.011 and swap rank between seeds. The card showed three
   decimals and a bar length, which implied a resolution the design does not
   have.

Cox's win on the plateau is systematic, not noise: the plateau DGP is a
proportional-hazards Weibull with linear covariate effects, so the Cox model is
correctly specified. This is a *good* property for a demo (it is not a straw-man
comparison) but the framing had to change to admit it.

### 4.2 Hypothesis investigated and **dismissed**: per-horizon forest seeds

`R/02_fit_methods.R` fits each horizon's CSF with `seed = FOREST_SEED + horizon`,
i.e. a different honest-splitting draw per horizon. The hypothesis was that this
injects independent split noise across horizons, artificially decorrelating them,
which would explain both the surprisingly well-conditioned Σ̂ and the inert
Ledoit–Wolf step, and would mean the demo's covariance machinery was being
flattered by an implementation detail.

Tested directly by refitting one scenario both ways:

| | mean abs off-diagonal correlation | cond(Σ) before | after |
|---|---|---|---|
| per-horizon seed (as shipped) | 0.398 | 10.95 | 10.40 |
| single shared seed | 0.408 | 11.89 | 11.26 |

**Refuted.** The difference is negligible. The correlation structure is real and
decays with horizon separation (0.42 between adjacent horizons down to 0.09
between the extremes), which is exactly what the README already claimed: the
survival-probability scale genuinely decorrelates horizons relative to the
cumulative-RMST scale. No change was made, and the seeding scheme was left alone.

This is recorded because it is the kind of question that will be asked again.

### 4.3 The unexplained warnings

A full run had always ended with *"There were 50 or more warnings"*, which nobody
had opened. Traced by re-running each component under a `withCallingHandlers`
collector: they are `grf`'s own *"estimated treatment propensities take values
very close to 0 or 1"*, fired by the strong-confounding scenarios. They are the
positivity stress the demo exists to teach. Left visible and documented rather
than suppressed.

## 5. Decisions

| Decision | Alternative considered | Why |
|---|---|---|
| Stamp `subsample` into `output/fits.rds` and have the exporter trust it | Rely on the `DEMO_SUBSAMPLE` env var alone | Found by reproducing the fix for finding 3 and then asking how else the same outcome could be reached. Running `R/03_export.R` on its own after a smoke test still published the reduced grid: the env var is gone by then but the reduced `fits.rds` is not. The results file is the thing that knows what produced it |
| **Finish** the unmeasured-confounding feature | Revert the working tree and publish the committed 8-scenario version | Chosen by Igor Shuryak, 2026-08-25. The latent-confounder axis is the strongest teaching content in the repository: it is the one failure no estimator on the page escapes, and reverting would have thrown it away to save front-end work |
| Smoke test exports to `output/preview/` | Refuse to export at all on a subsample run | Exporting exercises `03_export.R` and the plotting code, so the smoke test stays genuinely end-to-end; only its destination changes |
| Fix the *documentation* for "trapezoidal", not the code | Switch the integral to a trapezoidal rule | Changing it would move every published estimate for a difference far below Monte-Carlo noise |
| Keep the AUTOC block | Delete it as unused | Pre-existing work, not part of this pass's scope; it is now documented as exported rather than shipped silently |
| Static figures stay at the Γ = 0 slice, plus one figure for the latent axis | Render all 24 panels | 24 PNGs at ~130 KB would add ~3 MB to the repository for content the live site already provides interactively |
| The latent-axis figure plots **bias**, not estimates against one truth line | Overlay three truth curves | The true ATE itself shifts with Γ (peak 0.165 → 0.148); charging that shift to the estimator would overstate the bias. Caught by reading the first version of the figure after generating it |
| `sim_provenance.yaml` added; `References/` and `evidence_ledger.yaml` not | Scaffold all three | This repository has no manuscript and no numeric claims requiring reference-cell provenance; its two citations are verified in place. The simulation, by contrast, has 18 constants that genuinely needed their origin recorded |

## 6. Costs

- Full pipeline run: **9 min 11 s** wall clock (20:44:34 -> 20:53:45, `logs/full_run.log`)
  for 24 scenarios with all forests
  tuned (`grf` `tune.parameters = "all"`), R 4.5.1 on Windows via WSL.
- Smoke run (`DEMO_SUBSAMPLE=600`): **8 s**.
- The full run reproduced the pre-existing estimates **exactly** at the same
  seeds, which is what allows FIXES.md to state that no published estimate moved.

## 7. Verification at the end of the pass

- 4 test suites, 0 failures.
- **12 of 12 mutations caught.** Every test was confirmed to fail against the
  defect it guards before being accepted. One mutation (deleting the sandwich's
  meat term) initially passed, exposing that the GLS-only assertion was vacuous;
  a WLS-branch assertion was added and the mutation is now caught.
- 13 README numeric claims reconciled against the regenerated
  `scenarios.json`: 0 failures.
- All 9 static figures opened and checked against their captions.
- The site served over HTTP with every asset returning 200, and `app.js` driven
  headlessly through all 24 slider positions.
