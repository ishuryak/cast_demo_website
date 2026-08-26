# Second public-release audit: the oracle refit and the E-value anchor

**Date:** 2026-08-25 (same day as, and immediately after,
[`2026_08_25_public-release-audit.md`](2026_08_25_public-release-audit.md))
**Decision owner:** Igor Shuryak
**Trigger:** the question put was narrower than last time and its answer was
different: *"is it ready to push, and is it ready to be public?"* The first pass
had already established the repository was internally consistent, tested and
clean. This pass asked whether the things it **teaches** are true.

The landed changes and their evidence are in [`../FIXES.md`](../FIXES.md). This
file records the reasoning: what was checked, what was found, what was checked
and dismissed, and what was decided.

---

## 1. Why a second pass found anything at all

The first pass audited the repository against **itself**: does the front end
match the export, does the README match the code, does a clone run, is the
history clean. Everything it checked was true and stayed true.

This pass audited the repository against **the world**: is the statistic on the
card the statistic it is named after, and does the sentence under the figure
describe that figure. Those are different questions, and the two defects found
here were invisible to every check of the first kind. Both produced well-formed,
in-range, internally consistent numbers. Both would have passed any freshness,
schema or existence check indefinitely.

This is worth recording as a general lesson for the project: **an audit that
compares a repository to itself certifies consistency, not correctness.** The
checks that caught these two were (a) recomputing a displayed statistic from its
own inputs and asking whether the definition was satisfied, and (b) taking a
caption's number and asking which panel it came from.

## 2. What was checked

- Every claim on the site and in the README that asserts a number, re-derived
  from `docs/data/scenarios.json` rather than read.
- The Plotly Subresource Integrity hash, recomputed from the live CDN artifact.
- Full git history for anything a public flip would expose.
- The exact publish set (`git ls-files` + untracked-not-ignored): 34 files.
- A simulated fresh clone, rebuilt with git's recorded file modes, running the
  documented first command.
- Both static figures opened and compared to their captions and their JSON.
- `R/cast_core.R` and `R/02_fit_methods.R` read against what the documentation
  says they do.
- The routing auditors: `simulation-audit`, `stale-constant-audit`,
  `paper-code-audit` (README equations vs `01_simulate.R`), `pipeline-audit`
  (the four existing suites), and `surprising-result-skeptic` applied to the
  oracle-gap claim.

## 3. Findings

Ordered by severity. Findings 3-9 are documentation; 1 and 2 changed results.

| # | Finding | How it was established |
|---|---------|------------------------|
| 1 | The "oracle" refit is not an oracle | Recomputed, per scenario, what fraction of the actual bias the oracle gap accounts for: mean **53%**, range **8%-141%**, and the oracle itself still reports 0.233 where the truth is 0.140 |
| 2 | E-value anchored to a flat 0.5 baseline at every horizon | Read `rr_from_diff(ate, base = 0.5)` against the control-arm survival curve, which runs 0.90 → 0.11 across the same horizons; the assumption appeared in no documentation |
| 3 | "peak falls from 0.165 to 0.148" describes no panel | The captioned panel is plateau γ = 1, whose peaks are 0.163 → 0.140; 0.165 and 0.148 are maxima *across* scenarios |
| 4 | README runtime 9 min 11 s | The log that produced the shipped `docs/` ran 8 min 40 s; no surviving log shows 9:11 |
| 5 | `cast_core.R` header advertised a bootstrap estimator | Replaced by the influence-function estimator, as the same file says 50 lines later |
| 6 | GLS branch has an undocumented second condition | `r2g >= 0.5` in the source; README and site described only the conditioning test |
| 7 | Code comment claimed the propensity clip binds | `pct_clipped` is 0 in all 24 scenarios; the site already said so, the comment contradicted it |
| 8 | Site had no link back to the repository | A visitor on the Pages site could not find the code |
| 9 | Cox card contradicts its own PH readout at Γ > 0 | 4 of 12 plateau panels report p < 0.05 while the card says Cox is correctly specified there |

### Finding 1 in detail, because it is the one that matters

`R/02_fit_methods.R` passed `W.hat = W_hat` to the oracle refit: the propensity
estimated **without** the latent factor. The latent factor enters the true
propensity with coefficient `0.60 * Γ`, so at Γ > 0 that propensity is
misspecified, and a causal survival forest orthogonalizes on `W - W.hat`. Adding
the latent factor to `X` while leaving the treatment side blind therefore fixes
only half the problem.

The consequence is measurable in the shipped data. At the 60-month horizon:

| scenario | truth | CSF | "oracle" | gap shown | true bias | caught |
|---|--:|--:|--:|--:|--:|--:|
| plateau γ=1 Γ=1.5 | 0.140 | 0.330 | 0.233 | 0.097 | 0.190 | 51% |
| plateau γ=2 Γ=0.75 | 0.156 | 0.221 | 0.215 | 0.005 | 0.065 | 8% |
| reversal γ=0.5 Γ=1.5 | 0.076 | 0.273 | 0.101 | 0.171 | 0.196 | 87% |

Mean across the 16 scenarios with Γ > 0: **53%**.

The site said, of that gap: *"The gap between the two is the empirical bias from
not seeing it."* It was about half of it, and the shortfall varied by a factor
of ten between panels with no way for a reader to tell.

**Why this rated as blocking rather than a nit.** A demo whose entire fourth
teaching step is *"here is what unmeasured confounding costs you, measured
exactly, which is the one thing a real analysis can never do"* is making the
measurement its selling point. Being wrong about it by a factor of two, in the
direction of reassurance, is the worst available direction to be wrong in.

### Finding 2 in detail

The E-value is defined on a risk ratio. The estimand here is a
survival-*probability* difference, so a conversion is needed, and a conversion
needs a baseline risk. The code used 0.5 at every horizon. Actual control-arm
survival:

| horizon | 12 mo | 36 mo | 60 mo | 84 mo | 108 mo |
|---|--:|--:|--:|--:|--:|
| control survival | ~0.90 | ~0.62 | ~0.37 | ~0.21 | ~0.11 |
| assumed | 0.50 | 0.50 | 0.50 | 0.50 | 0.50 |

The number was therefore roughly right in the middle of the window and wrong at
both ends, in opposite directions, while looking entirely plausible throughout.
Nothing in the README, the site or `sim_provenance.yaml` disclosed the
assumption.

## 4. Options considered, and what was decided

**Finding 1.** Three options:

1. *Delete the oracle card.* The static figure already plots CSF bias against
   the known truth directly, which is a stronger demonstration and needs no
   oracle at all. Cheapest, and loses the E-value's context.
2. *Keep the partial oracle and describe it accurately* ("the bias from not
   seeing it in the outcome model"). Honest, no re-run, but teaches a
   distinction almost no reader wants and leaves a number on screen that is not
   the number anyone would assume it is.
3. *Make it a full oracle*: estimate a second propensity that sees the latent
   factor, and pass that. One line, plus a 9-minute re-run and regenerated
   figures.

**Decided: option 3**, on the grounds that the honest version of the card is
also the useful version, and that the cost was a re-run rather than a redesign.
Option 1 was the fallback had the fix not substantially closed the gap.

**Finding 2.** Two options: document the flat 0.5, or anchor per horizon.
**Decided: anchor per horizon**, using the observed control-arm Kaplan-Meier
survival. That needs no oracle knowledge, is what a real analysis would use, and
is exported as `robustness.s0_baseline` so the anchor is visible on the card
rather than buried. Documenting a fixed 0.5 would have been defensible for a
statistic labelled as a rough companion, but the site describes it in the
standard terms, and a teaching site is where people learn what an E-value is.

**Findings 3-9** were straightforward corrections with no options to weigh.

## 5. Investigated and dismissed

Recorded so the next pass does not re-open them.

- **Does CSF's residual bias at strong confounding really come from positivity?**
  The site attributes it to overlap stress. Checked: CSF RMSE rises 0.013 →
  0.055 (plateau) and 0.006 → 0.043 (reversal) from γ = 0.5 to γ = 2, the
  propensity spreads to [0.079, 0.979], and the bias turns systematically
  positive. The attribution holds directionally. The share of patients outside
  [0.05, 0.95] is small (1.0-1.2% at γ = 2), so the mechanism is asserted more
  firmly than the diagnostic alone proves, but the site already hedges it as a
  "near-violation" and the claim was left as it stands.
- **Is the AUTOC statistic computed on in-sample priorities?** No.
  `predict(f_mid)` with no `newdata` returns grf's out-of-bag predictions, which
  is the correct input to `rank_average_treatment_effect`. No change.
- **Is the naive estimator's "matches the truth only under randomization" claim
  exact?** Not exactly: at γ = 0, Γ = 0.75 the naive RMSE (0.022) is marginally
  *lower* than at Γ = 0 (0.027) and is the best on that panel. The difference is
  well inside the ±0.01 between-seed noise the README already documents. Left
  alone; tightening the sentence would over-claim precision the design cannot
  support.
- **Was the Plotly SRI hash correct?** Yes, recomputed from the live CDN and
  byte-identical. A wrong hash would have blocked the script for every visitor
  permanently, so it was checked rather than assumed.
- **Does anything in git history need a rewrite before going public?** No. Every
  path ever committed is source, docs or figures. The 2.5 MB screenshot and the
  editorial notes were never committed, only untracked-and-unignored, which the
  first pass fixed.
- **Should `References/` and `evidence_ledger.yaml` be scaffolded?** No, and this
  reaffirms the first pass's decision rather than revisiting it: there is no
  manuscript and no numeric claim needing reference-cell provenance. The two
  citations are verified in place in `CITATION.cff` and the README.
  `constant_registry.yaml` **was** added this pass, because the two defects above
  were both hard-coded constants and the registry is what makes their
  replacements checkable.

## 6. Costs and measurements

- Full pipeline: 8 min 40 s before the fix, 24 scenarios, R 4.5.1, all forests
  tuned. The oracle propensity adds one tuned `regression_forest` per scenario.
- Smoke test: 7 s at `DEMO_SUBSAMPLE=600`.
- Mutation testing: 5 mutations of `R/02_fit_methods.R` against
  `tests/test_fit_contract.R`, all caught; 1 mutation against the constant
  registry's retired-value guard, caught. 32 assertions in
  `tests/test_data_contract.mjs` fail against the pre-fix export.
- Oracle-gap coverage before the fix: mean 53%, range 8%-141%, n = 16 scenarios
  with Γ > 0.
