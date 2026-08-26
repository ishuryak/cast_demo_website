# Third-pass review before flipping the repository public

**Date:** 2026-08-26
**Decided by:** Igor Shuryak (instruction: "review and audit comprehensively …
are any updates needed for github? can the repo be made public?", then "make the
needed fixes and audit again")
**Preceded by:** [`2026_08_25_public-release-audit.md`](2026_08_25_public-release-audit.md)
and [`2026_08_25_oracle-and-evalue-audit.md`](2026_08_25_oracle-and-evalue-audit.md)

## 1. Why a third pass, and what it asked that the first two did not

The first pass audited the repository against **itself** (does the front end match
the export, does a clone run, is the history clean). The second audited it against
**the world** (is the statistic on the card the statistic it is named after). Both
are recorded in the files above.

This pass asked a third question: **can a stranger check the claims?** Not "are
they true" but "is there anything in the repository that would let a reader find
out". That is a different question from correctness, and it is the one that
matters at the moment a repository becomes public, because from then on the
readers are strangers.

It found one claim that failed it, and it is the reason for the largest change
below: the README quoted a five-seed replication as a measurement, and nothing in
the repository could reproduce it.

## 2. What was checked, and what passed

Recorded so a later pass knows what was already covered rather than re-deriving
it.

| Check | Result |
|---|---|
| Fresh clone → `./tests/run_tests.sh` | passed, executable bits intact (`100755`) |
| All 9 shipped figures opened and compared to their captions | 9/9 match |
| README numeric claims vs `docs/data/scenarios.json` | peak true-ATE ranges, the 39–95% oracle recovery at Γ = 1.5, GLS in all 24, `pct_clipped` = 0 in all 24, PH p < 0.0001 on every reversal panel, the 7 min 32 s runtime, the ~75 KB export: all reproduce |
| Git history / secret / patient-data scan | clean. The only email is the CUMC address in `CITATION.cff`, which is intentional |
| Plotly subresource-integrity hash recomputed against the CDN | matches exactly |
| Site served over http | index, app.js, style.css, scenarios.json, figures all 200 |
| Coverage of the truth by the CSF interval, Γ = 0 and γ ≤ 1 | 28 of 30 horizons, nominal |

Nothing here blocked publication. The changes below are about what a reader can
verify, not about a wrong number on the page.

## 3. Findings and what was decided

### 3.1 A measurement nobody could reproduce (the reason for `R/04_replicate_seeds.R`)

**Finding.** Three README claims rested on a five-seed replication: the
between-seed RMSE spread, "stable in 5 of 5 replicate seeds", and "mean RMSE
0.009 versus 0.033 for CSF". The table is in
`2026_08_25_public-release-audit.md` §4.1. The script that produced it was never
in the repository (the surviving scratch scripts under `output/`, gitignored,
are a different experiment about GLS conditioning), and the seeds it used were
not recorded. Meanwhile `docs/index.html` tells every visitor that "every number
and figure on this page is reproduced by the R pipeline" at this repository.

**Options considered.**

1. *Delete the claims.* Cheapest, and wrong: the claims are the honest part of
   the README. They are what tells a reader not to over-read the RMSE card.
2. *Keep them and cite the development record.* Rejected. The development record
   is a dated account of what was measured that day. Pointing a stranger at it
   does not let them re-measure.
3. *Ship the replication as a script.* Chosen. The claims become checkable, and
   the script is useful on its own, since anyone changing a method can ask what
   replicates before trusting a single-panel difference.

**Decision (Igor Shuryak, 2026-08-26): option 3.** The numbers in the README are
now the shipped script's own output at its own declared seeds, not the
2026-08-25 figures. They differ, because the seeds differ, and the qualitative
conclusions are unchanged.

**Consequence, stated because it is a change to published text.** The README
previously said Cox 0.009 vs CSF 0.033 and "roughly ±0.01". It now says Cox 0.005
vs CSF 0.035 and gives the largest between-seed sd, 0.018. The earlier numbers
were not wrong (they were a different five seeds), but they were unreproducible,
which is why they were replaced rather than corrected. The 2026-08-25 record
keeps its original table as the account of what was measured that day.

**Design decision inside that choice.** `R/04_replicate_seeds.R` **reuses**
`simulate_cohort()` and `fit_scenario()` from the pipeline rather than restating
them. Restating would have been a smaller diff and would have drifted: a method
changed in `R/02_fit_methods.R` would leave the replication silently measuring
the old one. The reuse needs a guard (`DEMO_SOURCE_ONLY`) so that sourcing a
pipeline script for its functions does not also re-run and overwrite its outputs.
That guard has two silent failure modes and is pinned by
`tests/test_source_guards.R`, and both were confirmed to fail against a deliberately
broken guard before the test was accepted.

Replication seeds start at 2001, clear of the published grid's 1001–1024, so a
replication can never replicate a panel against itself.

### 3.2 `sim_provenance.yaml` did not validate against its own auditor

**Finding.** `sim_provenance.py validate` rejected the file:
`unknown top-level key(s): meta`. The registry used a project-local schema
(`meta:` / `name:` / `provenance: design_choice|calibrated`) rather than the
engine's (`project:` / `id:` / `source: literature|user_supplied|derived`). It was
good documentation that no machine checked, which is the drift it exists to
prevent, one level up.

**Options considered.**

1. *Record the deviation and move on.* Rejected: it leaves the registry as prose.
2. *Convert to the engine schema, keeping the 18 composite entries.* Not possible
   as-is. The schema requires a numeric scalar `value`, so list- and
   dict-valued entries (`horizons`, `covariate_distributions`) are rejected.
3. *Convert and decompose to scalars.* Chosen. 18 composite entries became 60
   scalar ones. Every number a reader can see in `R/01_simulate.R` is now
   registered individually and can be grepped against the source, and the four
   hazard ratios the site quotes are `source: derived` with the arithmetic that
   produces them.

**Decision: option 3**, with every rationale preserved in each parameter's
`description`. The registry is longer and less essay-like than before. That was the price,
and it was judged worth paying for a file that a checker can read.

**Residual gap, recorded rather than closed.** `check --strict` needs a run trace
(`simulation_input_trace.csv` + `simulation_provenance.json`) that
`R/01_simulate.R` does not emit. Emitting one means routing every parameter read
through the provenance logger, which is a change to the generating code and would
force a re-run of the published grid. Not done in this pass. `validate` passes,
`check --strict` is still unavailable, and `audit_manifest.yaml` says so.

**What replaced it in the meantime.** `tests/test_sim_provenance.R` pins each of
the 54 registered values to a regex matching the exact construct it comes from.
The first version of that test searched for each value anywhere in the file and
**failed its own mutation test**: editing `- 0.45 * z_stage` to `- 0.55 *
z_stage` did not trip it, because 0.45 still appeared elsewhere as a smoking
prevalence and a propensity coefficient. 41 of the 56 values turn out to be
ambiguous that way. The site-anchored version catches it, and catches four
further mutations besides.

### 3.3 The README said "Five suites" and listed four

`test_fit_contract.R` was in the layout tree and in the runner but missing from
the list. Corrected, and the two suites added in this pass are listed too (seven
now).

### 3.4 A single-panel propensity range quoted as the grid-wide envelope

`R/02_fit_methods.R` and `constant_registry.yaml` both said the propensity
"gets as far as [0.079, 0.979] at gamma = 2" across "all 24 published scenarios".
That is one panel's range (reversal, γ = 2, Γ = 0). Over all 24 the envelope is
**[0.067, 0.980]**. The conclusion is unaffected (0.067 is comfortably inside the
[0.01, 0.99] clip, so the clip still never binds), but the number as scoped was
wrong.

**Why the stale-constant audit passed anyway, and what changed.** The number
lived in prose, not in a registered `value:`, so nothing checked it. Both bounds
are now registered (`propensity_realized_envelope_lo` / `_hi`) with the
single-panel figures as `retired_values`. Mutation-testing that guard found a
second copy of the number in the registry's own prose, which the engine does not
scan. That duplicate was removed so there is one source of truth.

### 3.5 The landing panel contradicts the story it lands on

The site opens on plateau, γ = 0, Γ = 0, where assignment is random and step 1 of
the story says the naive estimate matches the truth. On that draw it does not: at
36 months naive, T-learner and CSF all sit near 0.19 against a true 0.14, and the
CSF interval excludes the truth at that horizon.

**Investigated and dismissed as a defect.** With random assignment all three
estimate the same quantity from the same empirical survival curves, so they share
one draw's fluctuation, and Cox, which is correctly specified on the plateau, lands
on the truth. Over the Γ = 0, γ ≤ 1 panels the CSF interval covers the truth at
28 of 30 horizons, which is what nominal coverage looks like. It is an unlucky
draw, not a bug.

**Options considered.** (a) Say so in the README. (b) Raise *n* for the γ = 0
panels. (c) Pick a different cohort seed.

**Decision: (a) for now.** (c) is cherry-picking and was rejected outright. (b)
is legitimate and remains open, but it changes published numbers and forces a
re-run of the grid, so it is Igor's call and was not taken unilaterally in this
pass. A fifth item was added to "How to read the results honestly" saying plainly
what the panel shows and why.

### 3.6 Two inert `.gitignore` lines

`!docs/data/scenarios.json` and `!docs/figs/` negated patterns that never matched
(`docs/` was never ignored). Harmless, but they read as though `docs/` were
ignored and rescued. Removed, with a comment saying why there is nothing to
negate. Ignore behavior was verified unchanged with `git check-ignore` before and
after.

### 3.7 GitHub-side state

Confirmed with `gh`: repository is **private**, Pages is **not enabled**
(`/pages` returns 404), description and homepage are **empty**, there are **no
topics**, and the merged branch `survival-probability-estimand` is still on
origin. None is a repository-content problem, but all are listed for Igor, since
flipping visibility and enabling Pages are his to do.

**CI was added** (`.github/workflows/tests.yml`): the two node suites plus a
completeness check on `docs/`, on push and pull request. Scope is deliberate.
The R suites need R plus `grf`, which turns a ten-second job into a multi-minute
one. `./tests/run_tests.sh` runs all seven locally.

**A scaffolded CI file was deleted rather than kept.** `install_auditors.py
--init-project` writes `.github/workflows/release-gate.yml`, which triggers on
every pull request and expects `tools/claude_auditors_full_bundle.tar.gz`. That
tarball is not in this repository, so on a public repo the workflow would put a
permanent red X on every PR. Removed.

### 3.8 Auditor routing scaffold

`audit_manifest.yaml` was created and filled with the twelve-auditor triage.
Several auditors are N/A on the **deliverable's nature**: this project ships a
website and its generating pipeline, not a manuscript or grant. That is a
permanent property, not a deferral on project stage.

The routing gate's fact detection produces two false positives here, recorded so
the next reader does not chase them: `is_grant` fires on the word "resubmission"
inside a **gitignored** local notes file, and `has_radiation` on "Radiotherapy"
inside the *titles of the cited papers*. Neither reflects the repository.

Two further files the scaffolder wrote were **removed rather than committed**,
for the same reason as `release-gate.yml`: both would ship a permanent failure or
permanent noise to a public reader.

- `project_release_check.sh` runs the gate in `--release` mode, which fails on
  this project because of those two false-positive facts. A check-in-the-repo
  that always fails teaches a reader to ignore it. The triage the rule actually
  cares about lives in `audit_manifest.yaml`, which is committed.
- `reader_first.yaml` is a config for an auditor marked N/A here, since
  reader-first screens IMRaD structure (abstract, methods, results, discussion)
  in a scientific document and this project ships a website and a README. A
  trial run reported three errors, all of the form "no Abstract / Methods /
  Discussion section found".

## 4. Measurements taken

### 4.1 Five-seed replication, as the shipped script now produces it

plateau, γ = 1, Γ = 0, n = 2000, seeds 2001–2005, all forests tuned, `grf` 2.5.0:

| | Naive | Cox | RSF-S | RSF-T | CSF | CAST |
|---|---|---|---|---|---|---|
| mean RMSE | 0.180 | **0.005** | 0.045 | 0.097 | 0.035 | 0.034 |
| sd | 0.018 | 0.004 | 0.010 | 0.012 | 0.010 | 0.011 |
| rank per seed | 6,6,6,6,6 | 1,1,1,1,1 | 4,4,4,4,4 | 5,5,5,5,5 | 3,3,2,3,3 | 2,2,3,2,2 |

Naive, Cox and both RSF learners hold one rank in all five draws. CSF and CAST
swap. Same two conclusions as the 2026-08-25 run at different seeds: the coarse
ordering is real, the fine ordering is not.

Runtime: about 100 seconds for five seeds with all forests tuned.

### 4.2 Verification that nothing published moved

Every artifact under `docs/` was checksummed before any edit and re-checked
after. All 14 are byte-identical, including `scenarios.json` and all nine
figures. `output/sim.rds` and `output/fits.rds` were checksummed across the
replication run and are unchanged, confirming the sourcing guard does what it
claims.

### 4.3 Mutation testing

Fifteen deliberate breakages, each confirmed to make the relevant test fail
before the test was accepted. Two did not fail on the first attempt and are
recorded because they are the interesting ones:

- **M7.** Reintroducing a retired propensity value into `constant_registry.yaml`
  itself was not caught: the engine does not scan the registry file, correctly,
  since it legitimately names retired values under `retired_values:`. Resolved by
  removing the duplicated number from the registry's prose so only one copy
  exists.
- **M8.** Editing a coefficient in `R/01_simulate.R` was not caught by the
  first version of `test_sim_provenance.R`, because that version searched for the
  value anywhere in the file. This is what drove the site-anchored redesign in
  §3.2.

The remaining thirteen (inverted guard, read/write escaping the guard, missing
`horizons` contract, colliding replication seeds, restated estimator, registry
typo, unregistered slider level, abused exemption list, four coefficient drifts,
unanchored new parameter, and two CI completeness breakages) all failed as
required on the first attempt.
