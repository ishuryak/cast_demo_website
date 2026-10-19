# Class-lab propensity comparison — October 19, 2026

This is a new, reproducible comparison. The October 1 experiment's original
script and results were not recovered; these files do not claim to reproduce
that unidentified run exactly.

## Design and reproduction

The study uses 300 independently generated 600-person cohorts from the shipped
reversal scenario, measured-confounding strength 1, and no hidden confounding.
Forest, logistic and Super Learner are evaluated on the same cohort in each
replicate, at 12, 36, 60, 84 and 108 months. Every arm uses the shipped
`analyze_demo()` function with 300 trees and the same estimation seed, 20260905.
Cohort seeds are 20260906–20261205, excluding the supplied teaching cohort.
The truth is the mean conditional survival-probability difference for each
replicate's own 600 covariate profiles.

From the repository root on macOS, Windows or Linux:

```sh
Rscript tutorial/scripts/class-lab-propensity-study.R output/propensity-study 300 4
```

See [the runner instructions](../../README.md#reproduce-the-propensity-comparison)
for dependencies, serial execution and restart behavior. The source is
[revision `14c62bf`](https://github.com/ishuryak/cast_demo_website/tree/14c62bfa5b070634da78ec68c02a7d498d41c2db).
`config.txt` records the source-file hashes, settings, R version/platform and
package versions. `run-info.txt` records the session. The execution environment
was macOS ARM64, R 4.6.1, grf 2.6.1, SuperLearner 2.0.42, glmnet 5.1 and ranger
0.18.0. The frozen website estimates and supplied teaching cohort were not
regenerated or replaced.

## How to interpret the comparison

These are the three practical lab options as shipped: the forest uses
out-of-bag propensities, logistic uses in-sample fitted probabilities, and
Super Learner uses five outer and five inner stratified folds. The ensemble
combines SL.glm, SL.glmnet and SL.ranger using binomial log-loss. Thus the
comparison varies prediction construction as well as the learner. All options
clip propensities to [0.01, 0.99].

Treatment assignment is a main-effects logistic model in this simulator.
Logistic regression is correctly specified by construction; this study does
not establish superiority under nonlinear/misspecified assignment or patient
data. The forest remains the teaching default. CAST fits a quadratic trajectory;
its pointwise band need not cover the nonquadratic truth even when the CSF
estimates at the individual horizons are well calibrated.

## Files and checks

- `replicate-results.csv`: one aggregate row per cohort, propensity option and
  horizon; no individual records. It preserves interval endpoints, propensity
  diagnostics and warning text/counts.
- `summary.csv`: bias, RMSE, interval coverage, Monte Carlo standard errors,
  mean interval width and warning counts, for CSF and CAST separately.
- `SHA256SUMS`: hashes of the two CSVs and the two environment/configuration files.

Bias is mean estimate minus cohort truth; its Monte Carlo standard error is
the SD of that error divided by the square root of 300. Coverage is the fraction
of the 300 intervals containing their cohort's truth, with binomial Monte Carlo
standard error. The five horizons are reported separately, not treated as 1,500
independent replicates. Probability differences are converted to percentage
points only in the display below; CSV values remain on the probability scale.

The live regression test verifies serial/PSOCK agreement and interruption/resume
without duplicate or overwritten completed cohorts. It rejects incompatible run
settings and corrupt checkpoints. A separate two-replicate example checks the
summary arithmetic. The final CSVs are additionally checked against all saved
replicates before publication.

## Results

All 300 cohorts completed for all three arms: 4,500 replicate/horizon/arm rows. Independent Python calculations reproduced every reported summary statistic from the replicate CSV. A full-run restart retained all 300 checkpoints and required no refits.

Super Learner's CSF coverage is close to logistic's in this design, while both
have much less bias than the forest option. This is not a formal equivalence
result. The forest emitted no overlap warnings yet had the poorest CSF coverage;
warning absence is not evidence of good adjustment. CAST's poor coverage at
some horizons persists because the trajectory model is a separate approximation.

CSF bias is shown in **percentage points**; coverage is the percentage of nominal 95% intervals containing the replicate-specific truth.

| Month | Forest bias | Forest coverage | Logistic bias | Logistic coverage | Super Learner bias | Super Learner coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 12 | +1.58 | 86.3% | -0.02 | 95.0% | +0.12 | 94.7% |
| 36 | +4.54 | 76.0% | +0.03 | 94.3% | +0.48 | 93.7% |
| 60 | +5.30 | 74.7% | -0.17 | 96.0% | +0.50 | 94.7% |
| 84 | +4.43 | 75.7% | -0.14 | 96.7% | +0.50 | 96.0% |
| 108 | +3.38 | 81.3% | -0.19 | 94.7% | +0.36 | 95.0% |

CAST pointwise band coverage of the same cohort-specific truth:

| Month | Forest | Logistic | Super Learner |
| --- | ---: | ---: | ---: |
| 12 | 85.7% | 95.7% | 94.7% |
| 36 | 84.3% | 44.3% | 47.7% |
| 60 | 73.7% | 93.3% | 95.7% |
| 84 | 20.7% | 79.7% | 73.0% |
| 108 | 82.3% | 95.3% | 95.0% |

Captured warning diagnostics (a cohort may emit the same warning at multiple horizons):

- forest: 0/300 cohorts emitted at least one warning. The exact messages remain in the replicate CSV.
- logistic: 234/300 cohorts emitted at least one warning. The exact messages remain in the replicate CSV.
- superlearner: 166/300 cohorts emitted at least one warning. The exact messages remain in the replicate CSV.
