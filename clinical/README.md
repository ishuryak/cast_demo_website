# Clinical editions

Run npm run build:pages from the repository root to regenerate the published
walkthroughs in docs/. Run npm test, npm run test:clinical and
node tests/test_tutorial_variants.mjs docs to check them.

The build first stages tutorial/ and derives the clinical notes with
scripts/build-tutorial-v3.mjs. Then scripts/build-clinical-editions.mjs applies
the reviewed clinical wording and shared presentation. Its exact anchors fail
explicitly if the underlying walkthrough changes.

Edit quiet-narrative.mjs for the flowing article structure and
scripts/build-clinical-editions.mjs for clinical notes and shared walkthrough
behavior. Edit oncology/index.html and oncology/app.js for the active-treatment
comparison. Shared styling, narrative figures and disclosure navigation live
in this folder. The build copies these public assets to docs/.

The root methods page remains authored directly in docs/index.html. The
educator kit is built from tutorial/class-kit/ and its existing download is
preserved. The added clinical narrative is not yet included in that kit.

## Review and scope

The September 2026 revision integrates the two active-treatment comparison and
the clinical reading of the illustrated walkthrough. Claude reviewed supplied
text and CSS for style; Gemini supplied an adversarial scientific critique.
Codex adjudicated findings against the scientific source, frozen exports and
primary references, and checked the browser behavior. Reviews used public site
material, not private correspondence or patient records.

The revision distinguishes a constant-coefficient Cox restriction from Cox
models with time-varying coefficients; explains conditional censoring and
unmeasured-confounding assumptions; labels intervals as pointwise; and separates
observed B-arm survival from standardized survival under B. It corrects the
propensity percentage conversion and removes the reciprocal NNT display.

The featured example explicitly shows CAST's 84-month miss: simulated truth
is -1.59 percentage points, while CAST is +5.28 with a lower interval bound of
+1.64. Smoothness does not guarantee accuracy. Counts of truth containment in
this fixed grid are not repeated-sampling coverage estimates.

R code and frozen data are unchanged. These were wording, display and software
checks, not new estimation, empirical calibration or clinical validation.
The regression checks cover 24 scenarios and 120 horizons. Website prose uses
no em dashes in the three tutorials.

References checked during review:

- https://grf-labs.github.io/grf/reference/causal_survival_forest.html
- https://grf-labs.github.io/grf/reference/get_scores.causal_survival_forest.html
- https://arxiv.org/html/2001.09887v3
- https://search.r-project.org/CRAN/refmans/survival/html/cox.zph.html
