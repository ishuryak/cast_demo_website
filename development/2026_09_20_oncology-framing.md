# 2026-09-20: a third version of the site, written for an oncologist

Review of the published walkthrough and the two existing site surfaces, then the
framing decisions that produced `docs/oncology/`. Three reviewers were run in
parallel: two clinicians (one on the clinical view, one on the published
walkthrough) and one biostatistician on the numbers as executed and written.
Every finding below was verified against the source or recomputed from the
shipped export before anything was changed.

## What was asked, and what was decided

Igor asked whether the published walkthrough is up to date, whether a clinician
could follow it, and whether it shows anything wrong or misleading. Two of his
own observations came in during the review and became the spine of the work:

1. **The audience picker offers a clinician no option.** "There definitely
   should be a choice like clinician or oncologist."
2. **The comparison is framed wrongly for the field.** "The site mainly
   describes treatment vs control, whereas in oncology it is usually more like
   treatment option A vs option B, and the options could be a different
   radiotherapy fractionation scheme, different chemo drugs with radiation."

He then directed that the work go on a new branch and **build a new version of
the demo website rather than overwrite the two existing ones.**

**The decision taken, and by whom.** Igor chose, on 2026-09-20, a third parallel
version over editing the walkthrough and the clinical view in place. The reason
he gave is that the existing versions should remain available for comparison.
The consequence is recorded rather than hidden: the defects found in the
walkthrough and the clinical view are **fixed in the new version and still
present in those two**, and this document lists them so the choice to leave them
is a record rather than a silence. The single exception is finding 7 below, a
retracted claim that was live on a published page. A one-word correction to a
false statement is not a rewrite of a version, so it was made in place.

## What was found

### Confirmed, and fixed in the new version

1. **The audience picker has four paths and none is clinical.**
   `docs/tutorial/index.html:34-37`: Statistics student, Researcher, Causal
   convert, Educator. The page opens by asking "How would you describe
   yourself?", so the first interaction tells an oncologist the page is not for
   them. No test anywhere in the repository referenced `reader-path`, so the set
   could drift with nothing noticing. The machinery is fully data-driven
   (`narrative.mjs:6-19` queries `[data-reader-path]` and `.reader-itinerary`),
   so a fifth path costs three HTML blocks and no JavaScript.

2. **Treatment versus control is the wrong frame, and relabelling costs
   nothing.** 27 uses of "control" on the walkthrough, 10 on the methods page,
   5 on the clinical view, 12 in the README. The estimand is
   `E[S1(t)] - E[S0(t)]`, a contrast between two arms with no requirement that
   either be untreated. The generator agrees: `R/01_simulate.R:92` makes fitter
   patients more likely to receive `W = 1`, which is how the more intensive of
   two options is selected in practice. No modality, drug or schedule is named
   anywhere on the three pages, and the closest clinical analogy shipped is "a
   protective spell" and "a well-fitting suit of armor"
   (`docs/tutorial/index.html:219`).

   **The scientific argument, not just the cosmetic one.** The flagship effect
   shape is "early benefit, later reversal". As treat-versus-nothing that is
   hard to credit. As intensive-versus-standard it is an argument oncologists
   have actually had: an early gain in local control paid back in late cardiac
   or pulmonary mortality. Relabelling makes the demo's headline scenario more
   plausible, not less. This is why the change was judged worth a new version
   rather than left as a wording preference.

3. **The walkthrough asserts causal assumptions at settings that break them.**
   `docs/tutorial/app.mjs:66` emits "The adjusted estimate favors treatment at
   this horizon, under the causal assumptions" unconditionally from the sign of
   the estimate. `app.mjs:74` consults `state.unmeas` only to append "adjustment
   cannot use it". At Hidden confounding = Strong the assumption is false by
   construction, and the sentence still asserts it.

4. **The landing view hides everything that grades the method.**
   `docs/tutorial/core.mjs:2` sets `{shape:'reversal', conf:1, unmeas:0,
   horizon:36, fit:false, truth:false, naive:false}`, and the hidden-confounding
   selector sits inside a collapsed `<details>` labelled "Data & settings"
   (`index.html:203`). A clinician arrives to CSF dots with tight intervals and
   nothing to check them against, drives the visible confounding slider, and
   leaves. The control that decides whether any observational result is
   believable is behind a disclosure that reads like an appendix.

5. **Three display defects.** CSF and CAST share the colour `#009e73` in
   `docs/clinical/app.js:20-22` while the accuracy card distinguishes them by
   colour alone. Per-point values and every truth marker on the walkthrough live
   in SVG `<title>` elements, which do not exist on a tablet, and the click
   target carries `aria-hidden="true"`. The clinical hidden-confounder card
   prints `+shift` at `app.js:385` and "a move of `-shift`" at `app.js:389`, so
   the number changes sign inside its own card.

6. **Coverage is reported as if 120 cells were 120 trials.** Recomputed from the
   export: 3 panels hit 5 of 5, 10 miss 0 of 5, 11 are mixed. Cluster standard
   error over panels 0.0737 against a binomial 0.0433 over cells, a design
   effect of 2.90, so the reported 34% carries an interval of 20% to 49% rather
   than plus or minus 4 points. `README.md:639` already states the clustering
   ("the effective replicate count is six"), and `R/04_replicate_seeds.R`
   contains no coverage logic, so no calibration study exists. The clinical view
   is the only artifact in the project claiming the check was performed.

7. **A retracted claim was live.** `docs/tutorial/labs/README.md:11` read "the
   2,000-person **tuned** website export". Entry 32 retired that claim on
   2026-09-18. It was the only surviving instance in the published walkthrough.
   The other three mentions correctly read "untuned", and the class-kit ZIP does
   not contain this file. Fixed in place, for the reason given above.

8. **The viewport suite could only measure the site root.**
   `tests/test_viewport_overflow.mjs` hardcoded `/index.html`, so
   `docs/clinical/` had never been measured at any width.

### Investigated and dismissed

- **"The published walkthrough is stale."** It is not. The live HTML is
  byte-identical to `docs/tutorial/index.html` (sha256 `a3b4d4f5...`), and
  `data/provenance.json` pins the export at sha256 `0e72f9...`, which still
  matches the current `docs/data/scenarios.json`. The 2026-09-18 pass moved no
  numbers, so the pin remains honest. Only finding 7 was out of date, and it is
  a sentence rather than a build.

- **"The walkthrough overclaims about CAST."** Checked specifically, and it does
  not. `index.html:201` states the band is pointwise and not simultaneous, and
  the class-kit study guide (`study-guide.tex:238-241`) states that the full
  procedure's coverage needs separate validation. That wording is **more**
  accurate than the clinical view's coverage card, which is the opposite of what
  was expected going in. The walkthrough's framing is the one the other surfaces
  should be aligned to, not the other way round.

- **"The class-kit ships patient data."** `demo-cohort.csv` is one row per
  person with age, stage, performance status and comorbidity. It is 600
  **simulated** people from `R/01_simulate.R` with a fixed seed, so the
  biomedical git-safety rule does not apply. Confirmed against
  `check_no_patient_level.py --tracked`, which correctly reports that it
  inspected nothing rather than issuing a vacuous pass.

- **"Stage should be added to the balance card."** It cannot be, and this is
  worth separating from the display defects because the fix is not cosmetic.
  `R/01_simulate.R:150-152` computes standardized differences for age,
  performance status, comorbidity, smoking and the hidden factor, and never for
  stage, so `smd_stage` does not exist anywhere in the pipeline or the export.
  Stage carries the largest propensity coefficient in the generator
  (`R/01_simulate.R:92`, `-0.6 * z_stage` against `-0.5 * z_age`), so the
  balance card is incomplete in exactly the place an oncologist looks first.
  Adding it needs `01_simulate.R` and `03_export.R` edited and the pipeline
  re-run. The seed is fixed per scenario (`seed <- 1000 + sid`), so the cohort
  would be identical and **no published estimate would move**. Only a new field
  would appear. It was still held for approval, because it forces a rerun, which
  is the standing rule. The new page **discloses the gap in its limitations
  section** rather than quietly omitting it, which is the honest interim state.

## Costs and measurements

- Full local suite after the change: **16 suites, 0 failures** (5 R, 11 node).
  Previously 14.
- New suite `tests/test_oncology_contract.mjs`: **375 checks**.
- Seven mutations, each confirmed to make the suite fail:
  `drop-clinician-path` 5 failures, `reinstate-control` 1, `interpret-anyway` 1,
  `share-colour` 1, `flip-hidden-sign` 160, `binomial-ci` 1,
  `drop-table-rows` 2.
- **One mutation was initially a no-op** and therefore proved nothing: the first
  `reinstate-control` replaced a string that did not appear in the HTML, the
  suite passed, and that pass was meaningless. It now throws if it fails to
  change anything. This is the same failure the repository has recorded twice
  before in `test_clinical_contract.mjs`, where two bar-geometry assertions
  could not fail.
- CAST band coverage recomputed: 41/120 overall, 26/40 at no hidden
  confounding, 0/40 at the strongest. Cluster interval 20% to 49%.
- Viewport measurement of the new page found **two real layout defects that
  reading the code had not**: Plotly lays a title out at full string width and
  never wraps it, overflowing the chart at 360, 420 and 620 pixels. A
  ten-column numeric table reaches 435 pixels against a 345-pixel viewport even
  after its minimum width and nowrap were removed. Fixed by moving the title to
  a wrapping HTML caption and stacking the table into labelled blocks on narrow
  screens, so no value is hidden or placed behind a sideways scroll.

## Open work, deliberately not done here

1. **Compute `smd_stage`** and add stage to the balance card on all three
   surfaces. Two lines plus a pipeline re-run, and it moves no published number.
2. **Backport findings 1, 3, 4, 5 and 6 to `docs/tutorial/` and
   `docs/clinical/`**, or retire one of them. Three parallel versions of the
   same demo is a maintenance cost, and two of them now carry defects the third
   does not.
3. **Measure coverage properly.** `R/04_replicate_seeds.R` already redraws a
   scenario at N seeds and records only RMSE. Adding an interval-hit tally would
   replace the current honest "this is not measured" with a number.
4. **Publish.** GitHub Pages serves `main:/docs`, so neither the clinical view
   nor the oncology view is live until its branch is merged. The README now says
   so rather than advertising two links that return 404.
