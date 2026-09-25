# 2026-09-25: claim corrections that never reached main, CI without R, and the class lab's intervals

Igor asked on 2026-09-25 for four fixes to be made autonomously after a status
review of this repository and its GitHub remote:

1. Merge the 2026-09-18 claim corrections into `main`.
2. Settle the class-lab interval problem found on 2026-09-10, before the
   educator kit is taught.
3. Make CI run the R suites, and remove an internal tool note from the public
   site.
4. Delete the stale nested clone of this repository on his machine.

Item 4 touched no tracked file. The inner clone at `cast_demo_website/` held
only commits already present in the outer repository and regenerable build
output, verified object by object. It was archived to
`NeurIPS_2025/cast_demo_website_inner_clone_archive_2026_09_25.tar.gz`, outside
the repository, and then removed.

## What was found

### The 2026-09-18 corrections were stranded on a side branch

`66bb021` corrected four README claims that the shipped export contradicted
(CSF described as tuned, the coverage framing, the positivity-only account of
residual bias, the "single digits" condition numbers). It landed on
`clinical-framing`, which then diverged from `main` by six commits on each side.
Andy's 2026-09-21 release was built on `main`, so the public README kept every
claim the audit had shown to be false. Evidence: on `bc633b1`,
`node tests/test_readme_claims.mjs` (the suite `66bb021` added) reports 10
failures, and the README still contains "all forests tuned" and "which is what
nominal coverage looks like".

### CI ran no R

`.github/workflows/tests.yml` ran only node suites. The workflow's own comment
said so, and the 2026-09-10 audit showed that a 600-fold band inflation in
`R/cast_core.R` passes CI while the local R suite fails.

### A tool-process note was public

`assets/art/manifest.json`, copied into `docs/tutorial/` and
`docs/tutorial_v3/`, carried "Codex owns this manifest. Claude supplies assets
and ART_NOTES.md; integration follows review." The page never displays the
field, but GitHub Pages serves the file.

### The class lab's intervals miss its own answer key, systematically

Run as the kit instructs, `analyze_demo()` on the shipped 600-person cohort
gives CSF 95% intervals that exclude `data/answer-key.csv` at 36, 60 and 108
months. The 2026-09-10 audit had attributed this to the forest propensity, but
by a subagent, without independent confirmation. It was tested here directly.

**Measurement.** A coverage study (`tutorial/scripts/class-lab-coverage-study.R`,
run from `tutorial/class-kit/`) redraws the kit's scenario
(reversal, γ = 1, no hidden factor, n = 600) at fresh cohort seeds, runs the
class-lab estimator exactly, and records whether each 95% interval contains
that cohort's own answer key. Results, per horizon (12, 36, 60, 84, 108 months):

| Propensity | Cohorts | CSF coverage | CSF bias / SE | CAST coverage |
|:--|--:|:--|:--|:--|
| forest, as shipped | 300 | 0.86, 0.76, 0.75, 0.76, 0.81 | +0.66, +1.20, +1.27, +1.13, +0.96 | 0.86, 0.84, 0.74, 0.21, 0.82 |
| forest, `tune.parameters = "all"` | 300 | 0.87, 0.77, 0.76, 0.77, 0.83 | +0.65, +1.18, +1.25, +1.09, +0.92 | 0.87, 0.84, 0.74, 0.21, 0.83 |
| forest, 2,000 trees | 150 | 0.91, 0.74, 0.71, 0.78, 0.78 | +0.57, +1.22, +1.34, +1.19, +1.08 | 0.90, 0.87, 0.73, 0.17, 0.80 |
| true propensity from the simulator | 150 | 0.97, 0.94, 0.96, 0.97, 0.93 | −0.11, −0.00, +0.01, +0.07, +0.08 | 0.97, 0.40, 0.95, 0.80, 0.93 |
| main-effects logistic regression | 200 | 0.97, 0.95, 0.97, 0.97, 0.94 | −0.01, −0.00, +0.01, −0.02, −0.01 | 0.97, 0.45, 0.94, 0.78, 0.94 |

The standard errors are right: the ratio of the empirical SD of the estimate to
the mean reported SE is between 0.96 and 1.14 in every forest cell. The
undercoverage is a bias of about one standard error, in the same direction at
every horizon after 12 months. It disappears with the true propensity and with a
logistic propensity. It does not move with propensity tuning or with more trees.
At n = 600 the forest's out-of-bag propensity is shrunk toward the average
treatment rate, so part of the measured selection is left unadjusted.

The CAST column is a separate effect and is expected. On the reversal shape the
band covers the best quadratic approximation to ATE(t), not ATE(t) (README,
"What the band is a band for"). Once the CSF points are unbiased, that
misspecification shows at 36 and 84 months.

## Options considered for the class lab, and the decision

1. **Make logistic regression the default propensity.** The lab's intervals
   would then contain the answer key. Against: the logistic model is correctly
   specified in this simulator by construction, which would hide the
   finite-sample lesson, and it would make the kit's estimator differ from the
   website pipeline it is meant to teach.
2. **Keep the forest, add a `propensity = "logistic"` option, and say what
   students will see.** The default output is unchanged, the kit stays
   consistent with the site, and the discrepancy becomes an exercise with a
   measured explanation.
3. **Raise the cohort size.** It would reduce the bias but not remove it, lengthen
   class run times, and change the answer key and every provenance hash.

Chosen: option 2, under Igor's instruction to proceed autonomously. The choice
of default is flagged to Igor and Andy in the reply drafted the same day
(`NeurIPS_2025/Email_to_Andy_CAST_reply_2026_09_25.md`), since it is a teaching
decision and theirs to reverse.

## Why the 2026-09-18 corrections were ported rather than merged

A trial merge of `clinical-framing` into `main` conflicted in ten files. It also
would have re-added `docs/clinical/` and `tests/test_clinical_contract.mjs`, a
clinical-page prototype that the 2026-09-21 release replaced with `clinical/`
and `tutorial_v2/`. The substantive corrections were therefore applied to a
branch cut from `origin/main`:

- Ported: the README corrections, the `constant_registry.yaml` and
  `sim_provenance.yaml` text, the `.gitignore` rules, and the two suites
  `tests/test_readme_claims.mjs` and `tests/test_repo_hygiene.mjs`.
- Dropped: the `docs/clinical/` page and its contract test (superseded), the
  README header link to `/clinical/` (no such page on `main`), the hand-computed
  attestation hashes (the manifest on `main` already verified, and the two touched
  registries were re-attested by running their auditors), and the
  `constant_registry.yaml` exclusion for the nested clone, which no longer
  exists.

The 2026-09-18 FIXES entries 30 to 36 did not exist on `main`, and `main` has
since used numbers 30 to 32 for the 2026-09-21 release. The ported corrections
are therefore recorded as new entries 33 to 35, and the original audit record is
ported unchanged so their reasoning stays recoverable.

## Stale-constant audit

`stale_constant_audit.py --strict` already failed on `bc633b1` with five sweep
errors, all introduced by copies: `npm run build:pages` copies the class kit
into `docs/tutorial/` and `docs/tutorial_v3/`, and the kit carries vendored
snapshots of `R/01_simulate.R` and `tutorial/labs/cast-exercise.R`. Generated
copies and hash-pinned vendored snapshots are now excluded, with the reason
beside each rule. The remaining literals (600 in the class-lab run record) were
fixed at the source: the run record now writes `nrow(d)`.

## Costs and measurements

- Coverage study: about 1 s per 600-person cohort per arm (5 CSF fits of 300
  trees, 8 threads, Windows R 4.5.1, grf 2.5.0). The 2,000-tree arm took about 4 s.
- `npm run build:pages` after removing the note: only the three manifest files
  changed, confirming the build is otherwise deterministic.
