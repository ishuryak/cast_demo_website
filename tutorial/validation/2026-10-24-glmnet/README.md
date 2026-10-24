# CAST class-lab glmnet version audit, October 24, 2026

The shipped class lab returned **identical results with glmnet 4.1-10 and 5.1**
on 20 paired simulated cohorts. Every propensity value, CSF estimate and
interval endpoint, and CAST estimate and pointwise-band endpoint matched
exactly in R's stored numeric objects. No coverage decision changed.

This is a bounded compatibility check of the lab's **binomial propensity**
path. It is not a test of Cox models, a general equivalence claim about glmnet,
or a replacement for the [October 19 300-cohort study](../2026-10-19-propensity/README.md).
That study retains its original glmnet 5.1 label. There is no need to change
the pilot's 4.1-10 pin on the basis of this check.

## What was held fixed

Both versions ran in fresh R 4.5.2 processes on Windows x64. Each process
prepended an isolated library containing only its assigned glmnet release;
all other libraries were shared. Runtime version and resolved package path
were checked before fitting. Shared package versions were grf 2.6.1,
SuperLearner 2.0-29, ranger 0.17.0 and survival 3.8-3; the complete sessions
are recorded alongside this report.

Each run used the unchanged shipped `analyze_demo()` implementation, with:

- 20 cohorts of 600 synthetic people, seeds 20260906 through 20260925;
- the reversal pattern, measured-confounding strength 1 and no hidden confounding;
- forest, logistic and Super Learner propensity options on each cohort;
- 300 trees and fitting seed 20260905;
- 12, 36, 60, 84 and 108 months;
- the cohort-specific mean conditional survival-probability difference as truth.

Input CSV and answer-key hashes matched across versions for every cohort.
The forest and logistic options do not use glmnet and serve as negative
controls. The main source before this change was `d5e1f4a`; the two runs'
configuration files record exact MD5 hashes of the estimator, simulator,
CAST core and audit runner.

## Paired results

Maximum absolute differences are on the probability scale. The CSF and CAST
columns include the point estimate and both interval endpoints, at all five
horizons. Each row summarizes 20 paired cohorts, not 100 independent studies.

| Propensity option | Maximum propensity difference | Maximum CSF difference | Maximum CAST difference | Changed coverage decisions |
| --- | ---: | ---: | ---: | ---: |
| Forest | 0 | 0 | 0 | 0 |
| Logistic | 0 | 0 | 0 | 0 |
| Super Learner | 0 | 0 | 0 | 0 |

There are 300 cohort/arm/horizon results per version, or 600 rows in
`horizon-results.csv`. R's `identical()` also passed for all 60 pairs of
complete arm/cohort records, including the full propensity vectors, truth,
input hashes and warnings; the conclusion does not depend on CSV rounding.

The warning vectors were identical. GRF overlap warnings occurred in 14 of
20 logistic runs and 9 of 20 Super Learner runs, versus none for forest.
All runs completed; warning absence is not evidence of adequate adjustment.

## Check before ensemble weighting

An unchanged ensemble could conceal a changed candidate if that candidate
received little or no weight. A supplemental replay therefore inspected the
actual `CV.SuperLearner` objects on all 20 cohorts. Every replay reproduced
its stored class-lab propensity vector exactly before the versions were compared.

Outer and inner fold membership, all candidates' outer held-out predictions,
all inner cross-validation predictions, and all ensemble weights were
identical across versions. The maximum absolute difference in the raw
`SL.glmnet` outer predictions was 0. Thus the final-ensemble agreement is
not concealing different glmnet predictions in these runs. The learner had
an exactly zero weight in 34 of 100 outer fits in each version; these counts
describe literal zeros, not a threshold for negligible weights.

See `candidate-differences.csv`. Fold identity is checked explicitly rather
than assumed from the same seed. If a version consumed randomness differently
and changed a later split, the comparator would reject that matched-fold claim.

## Scope of the conclusion

The original October 19 study ran on macOS ARM64 with R 4.6.1,
SuperLearner 2.0.42 and ranger 0.18.0. This audit deliberately holds a single
Windows environment fixed while swapping glmnet. It does not establish
agreement with that entire earlier environment, with other versions of
SuperLearner, with other simulated designs, or on real data. Twenty cohorts
are used to exercise software compatibility, not to estimate coverage precisely.

The [glmnet release notes](https://cran.r-project.org/web/packages/glmnet/news/news.html)
describe substantial Cox changes in the 5.0 series while describing the
non-Cox numerical paths as unchanged. That is consistent with the observed
binomial result, but the empirical comparison is the evidence for this lab.
Cox fitting, including tie handling, needs its own comparison before any
survcausal pilot pin is changed.

## Reproduce

Use the same R executable and shared dependency library for both runs.
Install each glmnet release into a different **glmnet-only** library;
do not install or update other dependencies into those directories. Historical
source releases are available from the
[official archive](https://cran.r-project.org/src/contrib/Archive/glmnet/),
and current builds from the
[package page](https://cran.r-project.org/web/packages/glmnet/index.html).
Source installation on Windows requires a suitable Rtools toolchain.

This run copied the existing 4.1-10 installation into `lib-old` and installed
the official R 4.5 Windows binary of 5.1 into `lib-new`. Their build records
and DLL hashes are in `package-builds.txt`. Neither changed the user's default
library. R normalizes the 4.1-10 version string to `4.1.10`.

From the repository root, in fresh processes:

```sh
Rscript --vanilla tutorial/scripts/glmnet-version-audit.R run output/glmnet-audit/old output/glmnet-audit/lib-old 4.1.10 20
Rscript --vanilla tutorial/scripts/glmnet-version-audit.R run output/glmnet-audit/new output/glmnet-audit/lib-new 5.1 20
Rscript --vanilla tutorial/scripts/glmnet-version-audit.R compare output/glmnet-audit/old output/glmnet-audit/new output/glmnet-audit/report
Rscript --vanilla tutorial/scripts/glmnet-candidate-audit.R run output/glmnet-audit/old output/glmnet-audit/lib-old
Rscript --vanilla tutorial/scripts/glmnet-candidate-audit.R run output/glmnet-audit/new output/glmnet-audit/lib-new
Rscript --vanilla tutorial/scripts/glmnet-candidate-audit.R compare output/glmnet-audit/old output/glmnet-audit/new output/glmnet-audit/report/candidate-differences.csv
```

Output/report destinations must be new; completed results are not overwritten.
The main runner saves progress for inspection but does not support resuming
a partial run. Use a new output folder to rerun it. Full synthetic propensity
and candidate arrays remain under ignored `output/`; only aggregate results
and environment records are published. `SHA256SUMS` binds the saved evidence
and both audit scripts to this report.
