# The AUTOC standard error was the one number the pipeline could not reproduce

Investigation and decision, 2026-08-28. Decision taken by Igor Shuryak.

## How it was found

Not by a reader and not by an auditor. The published `docs/data/scenarios.json`
and its nine figures were re-generated from a clean extract of the committed tree
and compared byte for byte against what ships. This is the check that no auditor
in the suite performs: `pipeline-audit` asks whether the outputs are fresher than
the code, `manuscript-audit` asks whether quoted numbers match their source file,
`stale-constant-audit` asks whether a hard-coded bound still describes its
artifact. All three pass on an artifact that the current code would no longer
produce, because all three compare the artifact to something other than a re-run.

Result of the re-run: all nine figures byte-identical, and `scenarios.json`
differing in exactly 20 leaves out of roughly 1,900, every one of them the field
`autoc.se`, in 20 of the 24 scenarios. Nothing else moved -- not one average
treatment effect, confidence interval, RMSE, hazard ratio, PH p-value,
standardized mean difference, overlap or shrinkage diagnostic, and not the AUTOC
point estimate itself.

## Why that field and only that field

`grf::rank_average_treatment_effect()` returns two things with different
characters:

- `estimate` is `boot.output[["t0"]]`, the full-sample statistic. Deterministic
  given the forest.
- `std.err` is `apply(boot.output[["t"]], ...)`, the standard deviation across
  `R = 200` half-sample bootstrap replicates, drawn with R's **global** RNG.

Every forest in `R/02_fit_methods.R` is fitted with an explicit `seed =`
argument, which is why the entire rest of the pipeline is insensitive to where
the global stream happens to be. This one call is not.

Measured directly, on one fixed forest, rather than assumed:

    same seed 7    : est=-0.851334  se=0.691754
    same seed 7    : est=-0.851334  se=0.691754   se identical? TRUE
    stream advanced: est=-0.851334  se=0.635089   se identical? FALSE

So the standard error is perfectly reproducible from a given RNG state, and
changes only when the stream position changes. The estimate never changes. That
is exactly the pattern observed across the 24 scenarios, which is what makes this
an explanation rather than a guess.

## What moved the stream

The record answers this. `FIXES.md`, third pass, states that all fourteen
artifacts under `docs/` were byte-identical before and after the 2026-08-26 pass,
"checksummed before the first edit and re-checked after the last". That is true,
and it is true because **the pipeline was not re-run in that pass**. The same
pass restructured `R/02_fit_methods.R` around the `DEMO_SOURCE_ONLY` guards. The
shipped `scenarios.json`, stamped `2026-08-25 23:09`, therefore predates the fit
script that is committed beside it, and the refactor shifted the RNG stream by
enough to re-roll a bootstrap standard error.

The checksum claim was not wrong. It was answering a different question from the
one a reader of the site asks.

## What it actually breaks

Almost nothing, and then something.

`autoc` is read by **nothing**: it appears in `docs/data/scenarios.json` and in no
other file in the repository. Not `docs/app.js`, not `docs/index.html`, not a
test, not a README number. No figure plots it. That is why all nine PNGs came
back byte-identical, and why no number a visitor sees was ever affected.

What it breaks is a claim. `docs/index.html` tells every visitor that the numbers
on the page are "reproduced by the R pipeline at" this repository, and the README
says the same. Running the documented command produced a file that differs from
the committed one. A reader who checked would have found the discrepancy, in a
demo whose entire subject is that simulated data lets you check things against a
known answer.

## Options considered

1. **Seed the bootstrap** -- `set.seed(FOREST_SEED)` immediately before the call.
   One line. Makes the standard error a function of the scenario's data and the
   project's existing seed alone, so no future refactor can move it. Costs one
   full pipeline run and a one-time change to 20 rounded numbers in a field
   nothing reads.
2. **Drop `autoc` from the export.** Also defensible: nothing consumes it, so
   removing it eliminates both the irreproducibility and 24 dead objects from the
   payload. Rejected because the statistic is real work already done, is named in
   the README as part of what `02_fit_methods.R` computes, and is the obvious
   thing to display next if the site ever grows a benefit-ranking card. Deleting
   an output to make a reproducibility problem go away is the wrong instinct.
3. **Regenerate and document.** Re-run, commit, and record that the field
   re-rolls on any upstream edit. Rejected: it leaves the same trap armed for the
   next refactor, and the next person would rediscover it the same expensive way.

**Decision (Igor Shuryak, 2026-08-28): option 1.** It is the only one that makes
the shipped artifact match the code *and* keeps the statistic.

Why `FOREST_SEED` rather than a fresh constant: every forest in the file already
takes that value, so a reader has one seed to reason about rather than two, and
`DEMO_SEED` continues to override the whole pipeline in one place.

Why the same value in every scenario rather than a per-scenario offset: the
bootstrap resamples each scenario's own doubly-robust scores, so an identical
stream produces different draws per scenario. It matches the convention already
in the file, where every scenario's forests are fitted with `seed = FOREST_SEED`.

## Verification

The static guard alone would not be enough -- it asserts the shape of the source,
not that the shape fixes anything. The defect was therefore reproduced on demand
and the fix shown to hold against it, using the subsample smoke run and a
simulated upstream edit (three extra `runif` draws before the AUTOC block):

| build | `autoc.se`, the two smoke scenarios |
|:--|:--|
| unfixed | 0.044, 0.040 |
| unfixed + upstream edit | **0.046, 0.041** |
| fixed | 0.044, 0.042 |
| fixed + upstream edit | **0.044, 0.042** |

The unfixed pair differs and the fixed pair does not. (The fixed values differ
from the unfixed ones, which is the expected one-time move: seeding selects a
different set of bootstrap draws.)

The guard in `tests/test_source_guards.R` was then broken three ways and confirmed
to report each:

| # | Mutation | Reported |
|:--|:--|:--|
| M1 | `set.seed` removed, i.e. the original defect | seeded-immediately-before, and derives-from-FOREST_SEED |
| M2 | seed set, but a `runif` draw placed between it and the call | seeded-immediately-before |
| M3 | `set.seed(42)` instead of `set.seed(FOREST_SEED)` | derives-from-FOREST_SEED |

M2 is the one worth having: a seed set "somewhere in the file" is undone by any
draw between it and the call, and would satisfy a naive check.

## Test-category triage for this change

**unit** N/A (no new pure function); **regression / smoke** RUN (the four-build
table above, end to end through `run_all.sh`); **contract** RUN (the source guard,
plus the existing data contract over the regenerated export); **integration** RUN
(full 24-scenario pipeline, then the whole suite against its output); **golden
value** N/A -- `autoc.se` reaches no deliverable, and pinning a bootstrap standard
error to three decimals across `grf` versions would fail on the next upgrade for
no scientific reason; **end-to-end / visual** RUN (all nine figures re-diffed
against the committed ones); **acceptance, adversarial, performance** N/A (nothing
deployed, no path resolution, no untrusted input, one 22-minute run).
