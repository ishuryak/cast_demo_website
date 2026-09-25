# 2026-09-18: repository hygiene, and the claims that had drifted from the data

Audit of the whole project (branch `clinical-version`), then the fixes it
produced. Three reviewers were run in parallel on the estimation code, the
learned-model layer and the uncommitted clinical page. Their findings were
verified against the source and the shipped export before anything was changed.

## What was found, including what was dismissed

### Confirmed and fixed in this pass

1. **`db72206` committed four things its message did not mention.** A gitlink
   (`cast_demo_website`, mode 160000) with no `.gitmodules`, pointing at
   `68a22b3`, a commit in this same repository. `.backup_untracked/`, four
   superseded duplicates of tracked files. `tests/debug_path.mjs` and
   `debug_path2.mjs`, six-line `console.log` scratch. And
   `.claude/settings.local.json`, per-machine permission grants.

   Evidence: `git ls-files -s cast_demo_website` returns
   `160000 68a22b3ea1bafa7f86e6cbbbc3e03ee6ea83f7f4 0`, and `.gitmodules` does
   not exist, so a fresh clone gets a directory git calls a submodule with no URL
   to fetch it from. The nested copy also doubles the tree for anything that
   walks it: six of the seven `stale_constant_audit.py` sweep warnings that day
   resolved into `cast_demo_website/...` rather than into real code. Of the four
   backup files, two were byte-identical to their originals and two had drifted.
   The drifted `test_viewport_overflow.mjs` cites
   `development/2026_08_27_everest-yang-feedback.md` where the tracked file cites
   `2026_08_27_site-review-comments.md`, so committing it re-introduced a
   misattribution this repository had already corrected.

2. **The README said CSF is tuned. grf ignores the argument.**
   `R/02_fit_methods.R:220` passes `tune.parameters = TUNE` to
   `causal_survival_forest`. Deparsing the installed grf 2.5.0 shows that
   argument referenced in exactly two places in the function: its own signature
   default, and line 71, inside `if (is.null(W.hat))`, where it is forwarded to
   the propensity forest grf would fit for itself. This pipeline supplies
   `W.hat`, so the branch never runs, the nuisance survival and censoring forests
   at lines 83-92 never receive it, and every CSF fit in all 24 scenarios runs at
   grf defaults. No error, no warning. The untracked clinical page stated this
   correctly while the tracked README stated the opposite.

3. **The coverage claim quoted the easy corner of the grid.** "Over the Γ = 0
   panels with γ ≤ 1 the CSF interval covers the truth at 28 of 30 horizons,
   which is what nominal coverage looks like" is arithmetically right and is six
   cohorts, not thirty trials: the five horizons within a panel come from one
   draw. Recomputed over the whole shipped grid, CSF intervals contain the truth
   at 44 of 120 and the CAST band at 41 of 120, and at Γ = 1.5 both are 0 of 40. No
   coverage study exists anywhere in the repository.

4. **Three clinical-page defects, each of which showed a reader a wrong number.**
   The hidden-confounder card printed `+shift` as "moves the estimate by", but
   `shift = ate_omitU - ate_withU`, so the move caused by adding the factor is
   `-shift`: at plateau/γ=0/Γ=1.5, h=60 the estimate falls from 34.3 to 18.0 per
   100 and the card read "+16.4". Wrong on all 16 panels with a hidden factor.
   The balance card read "smoking ... stays near zero however strong the
   confounding" while `|SMD|` reaches 0.112 and 0.102, and in those two panels
   the card's own bar renders red with the tooltip "Imbalanced: beyond 0.10"
   directly above the sentence. And three separate comments (app.js header,
   style.css, the test) described bars "sized against a shared scale rather than
   the worst method" when `app.js` scales to the worst method.

5. **Two assertions in `test_clinical_contract.mjs` could not fail.**
   `barWidthWins > 0` counted panels whose widest bar is ≥ 95, and the widest bar
   is exactly 100 by construction. Its message described cap logic the code
   comments say was removed. `Math.min(...ratios) === 1` compared the best row to
   itself. This was the third and fourth iteration of the same mistake: the file
   already records two earlier bar-geometry checks that passed under the defect
   they were written for.

6. **The viewport suite was flaky, on a step gating every push.** It failed twice
   in five runs with "the harness produced no measurement". Cause: the harness
   left its JSON in a `<pre>` for `--dump-dom`, which fires when Chrome's
   `--virtual-time-budget` expires, and virtual time compresses the harness's own
   `setTimeout` sleeps, so the dump could land mid-measurement.

7. **`constant_registry.yaml` carried a stale justification.** `gls_cond_max`
   was justified by "realized condition numbers are single digits". The shipped
   `shrinkage.cond_after` runs 8.1 to 17.6.

8. **Two README claims the shipped grid contradicts.** Residual CSF bias was
   attributed to positivity under strong confounding, but the plateau γ = 0 panel
   (no confounding, no positivity problem) carries max |bias| 0.0505 against
   0.0700 at γ = 2, and γ = 0.5 sits lower than both at 0.0234. And the two RSF
   learners were framed as "two different failure modes" where the S-learner has
   the lower RMSE in 20 of the 24 panels.

9. **Four attestation hashes in `audit_manifest.yaml` were never computed.**
   Found while re-taking the hashes this pass had invalidated, not during the
   audit itself. They are 63 or 65 hex characters where a sha256 is 64, in
   hand-typed walking-nibble patterns, and `8a7b6c5d4e3f2a1b...` stood as the
   `report_sha256` of three different reports at once, which is impossible for a
   digest. The whole point of a content-bound attestation is that the verdict is
   tied to the bytes it was reached against, so an invented hash binds nothing.
   `audit_gate.py` classified one of them as "stale", a milder and incorrect
   diagnosis, and that misclassification is why this survived every green gate
   run since the manifest was written. All 51 hashes in the file were recomputed.

   This one is worth separating from the rest of the pass, because it is the only
   finding here that degrades a *guarantee* rather than a claim. The repository's
   own FIXES.md entry 25 records an earlier round of dangling attestations and
   the discipline adopted in response, so the mechanism was already understood.
   What was missing was anything that checked it, which is now
   `tests/test_repo_hygiene.mjs` section 4.

### Investigated and dismissed

- **"CSF is untuned because DiceKriging is a missing grf `Suggests`."** Raised by
  the ML reviewer, with the conclusion that a fresh clone following the README
  runs untuned and silent. Not so for grf 2.5.0: `packageDescription("grf")$Imports`
  lists DiceKriging, so `install.packages("grf")` pulls it, and version 1.6.0 is
  installed here. The propensity forest genuinely is tuned. The real defect is
  narrower and is finding 2 above.
- **"The clinical page's bar widths and its `times best` column disagree about
  which method is worst."** Produced by a check written during this pass, at
  reversal/γ=0/Γ=1.5. It is a display artifact: the ratio column rounds to one
  decimal, so four methods legitimately read 2.5x while their unrounded widths
  differ. The check was removed rather than weakened, because it could not tell
  that tie from a defect. Both displays are pinned independently against the
  JSON, which is stronger.
- **Rewriting `db72206`.** The first draft of the audit reported the commit as
  local-only, on the basis that it is absent from `main` and `origin/main`. It is
  the tip of `origin/everest-yang-review`, so it is published. No history was
  rewritten, and every fix here is forward-only.

## The plan that was approved, and the decision taken

Igor asked for all findings to be fixed autonomously, each tested, then a smoke
test, then a stop for review. Two boundaries were applied to "all":

**Forward-only on published history.** Finding 1 could be fixed either by
rewriting `db72206` or by a new commit that untracks the four paths. Because the
commit is pushed, a rewrite would invalidate every existing clone of
`everest-yang-review` and needs Igor's explicit authorization, which was not
sought mid-task. The forward fix was taken. The consequence is stated rather than
hidden: the four blobs stay reachable in history. None is patient data or a
paywalled PDF, so this is untidiness rather than a disclosure, and purging them
remains available as a separate authorized step.

**Documentation over re-estimation, wherever a fix would move a published
number.** Findings 2, 3, 7 and 8 could each be "fixed" by changing the code
instead of the text: tune CSF for real, run a coverage study, re-anchor the
E-value to a standardized baseline. Every one of those re-runs the pipeline and
changes numbers currently on a public site. The rule applied is the standing one,
that a change forcing a rerun is held for approval, so this pass made the text
describe what the code does and left the estimator alone. What that defers is
listed under Open work below, so the deferral is a record rather than a silence.

## What each fix is pinned by

Every check below was confirmed to fail against the unfixed code before being
kept. A check only ever observed passing is not known to be a check.

| Finding | Test | Confirmed to fail against |
|---|---|---|
| 1 | `tests/test_repo_hygiene.mjs` | `db72206` worktree: 9 failures |
| 2 | `tests/test_readme_claims.mjs` (tuning group) | `db72206` README: 2 failures |
| 3 | `tests/test_readme_claims.mjs` (coverage group) | `db72206` README: 4 failures, mutated export: 2 |
| 4 | `tests/test_clinical_contract.mjs` (4b, 4c) | original `app.js`: 18 failures, re-inverted sign: 16 |
| 5 | same file, bar-width recomputation | scaling mutated to `/30`: 23 failures |
| 6 | `tests/test_viewport_overflow.mjs` | measurement stubbed to 0: control assertion fires |
| 7 | `tests/test_readme_claims.mjs` (registry group) | `db72206` registry: 1 failure |
| 8 | `tests/test_readme_claims.mjs` (baseline group) | `db72206` README: 2 failures |

The viewport fix was additionally measured rather than argued: 10 consecutive
runs, 10 passes, against 2 failures in 5 before it.

## Costs and measurements taken along the way

- Full local suite: 14 suites (5 R, 9 node). All pass.
- Coverage recomputed from `docs/data/scenarios.json`: CSF 28/30 on the Γ = 0,
  γ ≤ 1 subset, 31/40 over all Γ = 0, 44/120 over the grid, and 0/40 at Γ = 1.5.
  CAST band 41/120 over the grid, 0/40 at Γ = 1.5.
- RSF S-learner lower RMSE in 20 of 24 panels. On plateau/γ=0/Γ=0, which is
  random assignment, RSF-S is the worst method present at 0.051 against naive
  0.027.
- CAST RMSE exceeds CSF RMSE in 9 of 24 panels, 7 of them on the reversal.
- `shrinkage.cond_after` across the 24 scenarios: 8.1 to 17.6.
- `stale_constant_audit.py`: REGISTRY mode, 12 constants, 0 errors. The 7 sweep
  warnings are advisory and six of them came from the nested copy now untracked.

## Open work, deliberately not done here

Each of these changes a published number and is held for a decision:

1. **Tune CSF, or state permanently that it is untuned.** Passing
   `tune.parameters` through a supplied-`W.hat` call is a no-op. Making it real
   means fitting CSF differently and re-exporting all 24 scenarios.
2. **Measure coverage.** `R/04_replicate_seeds.R` already re-draws a scenario at
   N seeds and records RMSE only. Adding an interval-hit tally is cheap and would
   replace the current honest "this is not measured" with a number.
3. **Re-anchor the E-value.** `R/02_fit_methods.R:275` builds it from the crude
   control-arm KM survival while combining it with the AIPW-adjusted ATE. Under
   confounding by indication that biases the E-value toward looking robust. A
   covariate-standardized S₀ is already computed at `:136`. No CI-limit E-value
   is computed either, and VanderWeele and Ding require both.
4. **Baseline tuning parity.** CSF is untuned, the propensity gets grf's full
   tuner and the RSF baselines get a 12-point hand grid scored by out-of-bag
   concordance at a single horizon. Concordance is a ranking metric and the
   estimand is a difference of absolute survival probabilities, so the RSF tuner
   is blind to the error that drives its own RMSE.
5. **Hyperparameters are re-tuned per scenario**, so the confounding sweep is
   confounded with retuning.
6. **`autoc.est` / `autoc.se` ship in the public `scenarios.json`** and are read
   by nothing and defined nowhere a consumer of that file would find.
7. **No environment pin.** No `renv` or `DESCRIPTION`, so results are reproducible
   across runs at a fixed grf version and not across versions.
