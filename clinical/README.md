# Chapter 2 and the shared reading layer

Run `npm run build:pages` from the repository root to regenerate the published
walkthrough in `docs/`. Run `npm test`, `npm run test:clinical` and
`node tests/test_tutorial_variants.mjs docs` to check it.

The build stages `tutorial/` into `docs/tutorial/` (Start here and chapters 1
and 3 to 6), then `scripts/build-chapter-two.mjs` publishes chapter 2, "Option A
or Option B?", from `oncology/index.html` and `oncology/app.js` into
`docs/tutorial_v2/`, copies the shared files in this folder to `docs/`, and
writes the redirect that keeps the retired clinical edition's URL,
`docs/tutorial_v3/`, pointing into chapter 3.

Edit `oncology/index.html` and `oncology/app.js` for chapter 2. The chapter
strip and the bottom-of-page chapter links are plain markup in both pages, so a
chapter added or renamed in `tutorial/index.html` needs the same change in
`oncology/index.html`; `tests/test_tutorial_variants.mjs` checks that the two
strips agree on seven chapters and that every cross-page anchor exists.
`clinical-theme.css` is loaded by chapter 2 and by the root methods page;
`narrative-figures.mjs` draws chapter 2's three story figures;
`clinical-navigation.js` opens collapsed sections on hash navigation. The
walkthrough's own stylesheet, `tutorial/narrative.css`, now carries the rules it
used to borrow from the theme at build time, so the walkthrough previews in the
`tutorial/` dev server exactly as it publishes.

## History

The September 2026 revision integrated the two active-treatment comparison and
a clinical reading of the illustrated walkthrough as separate editions. Claude
reviewed supplied text and CSS for style; Gemini supplied an adversarial
scientific critique. Codex adjudicated findings against the scientific source,
frozen exports and primary references, and checked the browser behavior.
Reviews used public site material, not private correspondence or patient
records.

The revision distinguishes a constant-coefficient Cox restriction from Cox
models with time-varying coefficients; explains conditional censoring and
unmeasured-confounding assumptions; labels intervals as pointwise; and separates
observed B-arm survival from standardized survival under B. It corrects the
propensity percentage conversion and removes the reciprocal NNT display.

The featured example explicitly shows CAST's 84-month miss: simulated truth
is -1.59 percentage points, while CAST is +5.28 with a lower interval bound of
+1.64. Smoothness does not guarantee accuracy. Counts of truth containment in
this fixed grid are not repeated-sampling coverage estimates.

On 2026-10-27, after Alex Steele's review of the three editions, the site became
one path. The clinical edition's five "In the clinic" notes moved, with their
reviewed wording unchanged, into chapter 3 of the walkthrough, and the
build-time rewriting layers (`quiet-narrative.mjs` and the clinical-edition
transforms) were folded into `tutorial/index.html` as plain source. See
`development/2026_10_27_one-path-walkthrough.md`.

R code and frozen data are unchanged throughout. These were wording, display
and software checks, not new estimation, empirical calibration or clinical
validation. The regression checks cover 24 scenarios and 120 horizons. Website
prose uses no em dashes.

References checked during review:

- https://grf-labs.github.io/grf/reference/causal_survival_forest.html
- https://grf-labs.github.io/grf/reference/get_scores.causal_survival_forest.html
- https://arxiv.org/html/2001.09887v3
- https://search.r-project.org/CRAN/refmans/survival/html/cox.zph.html
