# Fixes

One row per landed change, with the symptom, the evidence it was real, the test
that now pins it, the verification, and whether it moved any published number.
The reasoning behind these changes is in [`development/`](development/).

Verification environment for everything below: R 4.5.1, `grf` 2.5.0, `survival`
3.8.3, `jsonlite` 2.0.0, node v18.19.1, on 2026-08-25, and the same toolchain
re-run on 2026-08-27 for the entries dated that day. Headless renders use Chrome
via `--headless=new --screenshot` against `python3 -m http.server`.

Entries are newest first.

---

## 2026-08-27 (review) · Everest Yang's five comments

**Moves published numbers: no.** `docs/`, `README.md`, `tests/` and `.gitignore`
only. No R script, no `scenarios.json`, no figure and no registry entry is
touched, and all eight test suites pass. The reasoning, including the costing
that decided comment 1, is in
[`development/2026_08_27_everest-yang-feedback.md`](development/2026_08_27_everest-yang-feedback.md).

### 18. Every RMSE bar was an empty grey rail, in every state, since the card was written

- **What was wrong.** The accuracy card drew six labeled bars whose numbers
  updated correctly and whose bars never appeared at all. The reviewer read this
  as "these blue bars do not appear to change no matter how much measured or
  unmeasured confounding is set". They were not failing to change; they were
  never being drawn.
- **The proof it was real.** A 1440x2600 headless render of the published site at
  the default state shows all six rows as bare `#eef1f5` tracks with no colored
  fill, matching the reviewer's screenshot. At that state `app.js:222` emitted
  `<span class="rmse-fill" style="width:100.0%">` for the S-learner, the largest
  of the six, and `width:5.9%` for Cox, so the markup and the widths were both
  correct and neither was visible.
- **The cause.** `.rmse-fill` is a `<span>` inside `.rmse-track`, which is a plain
  block, so the fill stayed a non-replaced **inline** element. `width` and
  `height` do not apply to those (CSS 2.1 10.3.1 / 10.6.1), so the declared
  `width: NN%` and `height: 100%` were both ignored. `.rmse-track` escaped the
  same fate only because it is a grid item of `.rmse-row` and was blockified.
- **Why no suite caught it.** `test_render_smoke.mjs:113` asserted the row markup
  contains `rmse-fill`, which it did. The defect was entirely in whether the CSS
  let that markup take a size, which nothing looked at.
- **The fix.** `.rmse-fill { display: block; min-width: 2px; }`, the `min-width`
  so a method whose RMSE rounds near zero (Cox at 0.003) still shows a sliver.
- **The test that now pins it.** `tests/test_style_contract.mjs`, a new suite:
  anything `app.js` sizes with a percentage width, or `style.css` gives a
  percentage height, must declare a display that can take a size. **Confirmed to
  fail against the unfixed CSS** before the fix landed, and again afterwards by
  reverting the `display: block` (mutation M2).
- **Verified.** `./tests/run_tests.sh` -> 8 suites passed, 0 failed (2026-08-27).
  Re-rendered headless at 1440 px: the six bars are drawn in method colors,
  their lengths tracking the values 0.027 / 0.051 / 0.028 / 0.003 / 0.026 / 0.015
  at 52.9 / 100 / 54.9 / 5.9 / 51.0 / 29.4 % of the track.

### 19. The measured-confounding label rendered γ as Γ, the other axis's symbol

- **What was wrong.** `.ctrl label` sets `text-transform: uppercase`, which
  applied to the axis symbol inside it, so the **measured** axis's lowercase γ
  was displayed as Γ. Both controls therefore read "Γ = 0", and Γ is the symbol
  this page uses for the *unmeasured* axis.
- **The proof it was real.** The 1440 px render of the control row before the fix
  reads "MEASURED CONFOUNDING: Γ = 0" beside "UNMEASURED CONFOUNDING: Γ = 0". The
  defect predates this review: the old label text was "none (γ = 0)", which
  uppercased to "NONE (Γ = 0)" the same way, and was less conspicuous only
  because the word carried the meaning.
- **The fix.** `#conf-label, #unmeas-label { text-transform: none; }`.
- **Verified.** Re-rendered headless at 1440 px: the two labels now read
  "MEASURED CONFOUNDING: γ = 0" and "UNMEASURED CONFOUNDING: Γ = 0".

### 20. Two four-stop sliders promised a continuum the data does not have

- **What was wrong.** Measured and unmeasured confounding were `<input
  type="range">` elements over four and three precomputed levels. A slider is a
  continuous affordance, so it invites a drag it cannot honour.
- **The proof it was real.** The reviewer's first comment, unprompted: "there are
  only discrete values selectable (3 for unmeasured, 4 for measured)".
- **The fix.** One option per exported level, as radio inputs styled to match the
  existing effect-shape selector. Real radios rather than ARIA-annotated buttons,
  so arrow-key navigation and screen-reader semantics come from the platform.
  The alternative the reviewer offered, 50 steps per axis, was costed and
  rejected: at 19 s per scenario it is 5000 scenarios and about 26 h of pipeline
  time for a ~16 MB JSON that every visitor downloads before first paint, and it
  would move every published number. The costing is in the development record.
- **The tests that now pin it.** `tests/test_render_smoke.mjs` asserts one option
  per exported level on each axis, that every option carries label text and an
  `onchange`, and that no `id="conf-slider"` / `id="unmeas-slider"` range input
  returns; and it now drives all 24 combinations **through the controls' own
  handlers** rather than by assigning state, so a control that never wires up
  fails. Confirmed to fail by mutation: emitting one option (M3), dropping the
  `onchange` (M4), and reinstating a range input (M7).
- **Verified.** `./tests/run_tests.sh` -> 8 suites passed, 0 failed. Rendered
  headless at 1440, 820 and 420 px: both controls sit on one row at 1440 with
  dividers between options and the selected option filled.

### 21. The intro led with the formal statement and buried the plain one

- **What was wrong.** One 300-word lead paragraph that stated each idea formally
  and then explained it in a parenthesis, which is the opposite of the order a
  reader needs. Two of its sentences were flagged as reading like generated text,
  one of them also self-contradicting: "The reversal is a stylized teaching
  curve, not an empirical one" implies the plateau might be empirical, three
  sentences after the text says both are simulated.
- **The fix.** Five short paragraphs, plain statement first and precision second.
  The estimand sentence is the reviewer's own wording. The reversal paragraph now
  opens by saying both shapes are simulated and then says what "stylized" meant:
  drawn sharper than most real crossings so each estimator's response is visible.
  "...to see which estimators recover the truth, and which cannot" becomes a
  plain instruction. The same flagged sentence was carried by the reversal hover
  tooltip in `app.js` and by `README.md`, and both were rewritten to match.
- **Verified.** Read back in the 1440 px render. `grep` for the two flagged
  sentences across `docs/`, `README.md` and `R/` returns nothing.

### 22. Seven cards, no stated reading order, and a wall of text in each

- **What was wrong.** Seven cards in an unlabeled CSS multi-column flow. The
  flow does read top-to-bottom then across, so an order existed, but nothing on
  the page said so, and each card opened with several hundred words of
  explanation ahead of its own numbers.
- **The fix.** Four numbered groups in the order the story section already tells:
  is this cohort confounded, how close is each method, what adjustment cannot
  reach, inside the CAST layer. Each card keeps its live numbers visible, gains
  two or three bullets saying what the concept is in this model, and moves its
  full prose behind a `<details>` disclosure. No explanatory text was deleted;
  a word-level diff of the card block before and after shows only insertions plus
  the two "slider" wording ripples. `<details>` rather than a click handler on the
  card: keyboard-reachable, screen-reader-announced, works with JavaScript off,
  and still found by the browser's in-page search when closed.
- **The layout.** Back to a grid, which the 2026-08-26 entry below had rejected
  because the cards then differed several-fold in height. Collapsing the prose
  removed that spread, and a grid is what keeps a group heading attached to its
  cards. The 16.5rem column minimum is chosen so all four groups fit across the
  1132 px content width; at 17rem the fourth wrapped to a second row and left two
  empty columns beside it.
- **The tests that now pin it.** `tests/test_render_smoke.mjs` asserts every card
  has brief bullets, a `<details>` with a summary, and its live values **outside**
  the disclosure, and that every group carries a heading. Confirmed to fail by
  mutation: removing a card's bullets (M5), moving a live value inside the
  disclosure (M6), and demoting a group heading (M8).
- **Verified.** `./tests/run_tests.sh` -> 8 suites passed, 0 failed. Rendered
  headless at 1440, 820 and 420 px and read back: four groups in four columns at
  1440, one column below 900.

### Known, pre-existing, not fixed here

The page overflows its viewport horizontally below about 720 px, so a phone gets
a sideways scroll. This is **not** new: rendered headless at 620, 720 and 820 px,
the pre-change build at `HEAD` and the post-change build clip identically (22
body rows reaching the right edge at 620 px in both, 0 at 720 px in both). It is
outside the five comments answered here and is left for a separate pass.

---

## 2026-08-26 (layout) · The cards moved out of the dead column

**Moves published numbers: no.** `docs/style.css` is the only file changed. No
data, figure, estimate or caption is touched, and all seven test suites pass
unchanged.

### 17. Two thirds of the page below the figure was empty

- **What was wrong.** The plot sat in a `1fr` column with the seven cards in a
  fixed 320px column beside it. Seven stacked cards run far taller than the
  540px plot, so everything to the left of them below the figure was blank:
  close to two screens of dead space on a laptop, and the cards themselves were
  squeezed into a 320px ribbon.
- **The proof it was real.** A 1440x2400 headless render of the published site
  shows the plot ending at y = 990 and the card column continuing past y = 2400,
  with the entire left half empty between them. The print-to-PDF export shows the
  same thing as three consecutive pages with an empty left column.
- **The fix.** The plot spans the full width and the cards flow beneath it in a
  multi-column layout (`columns: 21rem`, a column WIDTH, so the browser fits as
  many as the viewport allows and drops to one on a phone with no media query).
  Multi-column rather than grid on purpose: the cards differ several-fold in
  height, and a grid aligns row heights, which would reopen the gaps it is meant
  to close. Fixing that exposed the same defect one box up, where eight method
  checkboxes stacked vertically in a grid column and tripled the height of the
  controls; they now span the full width and wrap.
- **Verified.** Rendered headless at 1920, 1440, 1280 and 820 px, and at four
  UI states driven through `app.js` (default; reversal at strong measured and
  strong unmeasured confounding; a mid state; and with three methods toggled
  off), so the layout is checked against the full range of card content lengths
  rather than one screenshot of the default. No dead column at any width, no
  horizontal overflow, and the 900px breakpoint collapses to a single column
  cleanly. `./tests/run_tests.sh` -> 7 suites passed, 0 failed.

## 2026-08-26 (third pass) · Claims a stranger can check

**Moves published numbers: YES, in the README only, and no analysis result
changed.** Every one of the 14 artifacts under `docs/` is **byte-identical** to
before this pass: `scenarios.json`, all nine figures, `index.html`, `app.js`,
`style.css` and `.nojekyll` were checksummed before the first edit and re-checked
after the last, and none moved. `output/sim.rds` and `output/fits.rds` are
likewise unchanged. What moved is the five-seed replication table quoted in the
README, because the numbers it quoted were unreproducible and were replaced by
the output of a script that now ships (see 13 below).

Verification environment for this pass: R 4.5.1, `grf` 2.5.0, `survival` 3.8.3,
`jsonlite` 2.0.0, node v18.19.1, on 2026-08-26.

Reasoning, options considered and what was dismissed:
[`development/2026_08_26_third-pass-public-release-review.md`](development/2026_08_26_third-pass-public-release-review.md).

### 13. Three README claims that nothing in the repository could reproduce

- **Moves published numbers: YES.** README "How to read the results honestly"
  item 2 said "mean RMSE 0.009 versus 0.033 for CSF over 5 replicate seeds at
  γ = 1"; it now says 0.005 versus 0.035. Item 1 said the RMSE moves "by roughly
  ±0.01"; it now gives the measured largest between-seed sd, 0.018, and the
  largest spread, 0.043. No figure, no exported value and no analysis result is
  affected.
- **What was wrong.** Three claims in the README rested on a five-seed
  replication, and no script in the repository produced it. The table lives in
  `development/2026_08_25_public-release-audit.md` §4.1; the seeds behind it were
  never recorded, and the scratch scripts that survive under `output/` are
  gitignored and are a different experiment. Meanwhile `docs/index.html` tells
  every visitor that "every number and figure on this page is reproduced by the R
  pipeline" at this repository.
- **The proof it was real.** `git log --all --name-only` lists no replication
  script at any commit, and `output/exp.R` / `output/exp2.R`, the only surviving
  candidates, both study GLS conditioning across the horizon grid and compute no
  RMSE table. There was nothing to run.
- **The fix.** `R/04_replicate_seeds.R`, which re-draws a scenario at N declared
  seeds, refits every method through the pipeline's own `fit_scenario()`, and
  writes `output/replicate_seeds.csv` plus the summary table. Seeds start at 2001
  so they cannot collide with the published grid's 1001-1024. The README now
  quotes this script's output and links to it.
- **The test that now pins it.** `tests/test_source_guards.R`, 18 checks on the
  `DEMO_SOURCE_ONLY` contract that lets the replication reuse the pipeline
  instead of restating it. Confirmed to fail against five deliberate breakages
  before being accepted: an inverted guard (which would make
  `Rscript R/02_fit_methods.R` fit nothing and exit 0), a `readRDS` escaping the
  guard, a dropped `horizons` contract, replication seeds colliding with the
  published grid, and the replication restating the estimator instead of reusing
  it.
- **Verified.** `./tests/run_tests.sh` -> 7 suites passed, 0 failed (2026-08-26),
  against a baseline of 5 suites passing before this pass.
  `Rscript R/04_replicate_seeds.R` completes in about 100 seconds and leaves
  `output/sim.rds` and `output/fits.rds` unchanged by md5.

### 14. The simulation registry did not validate against its own auditor

- **Moves published numbers: no.** Documentation and test only.
- **What was wrong.** `sim_provenance.py validate sim_provenance.yaml` exited 2
  with `[error] sim-registry: unknown top-level key(s): meta.` The registry was
  written to a project-local schema, so the auditor it exists to satisfy had
  never been able to read it. It was documentation that nothing checked.
- **The proof it was real.** The exact command and its exit code above.
- **The fix.** Converted to the engine schema, decomposing 18 composite entries
  into 60 scalar ones so every number visible in `R/01_simulate.R` is registered
  individually, with each rationale preserved in its `description` and the four
  hazard ratios the site quotes registered as `source: derived` with the
  arithmetic that produces them. `validate` now reports `registry OK`.
- **The test that now pins it.** `tests/test_sim_provenance.R`, which ties each
  of the 54 registered values to a regex matching the exact construct it comes
  from, requiring exactly one match. **The first version of this test was wrong
  and its own mutation test caught it:** it searched for each value anywhere in
  the file, and editing `- 0.45 * z_stage` to `- 0.55 * z_stage` did not trip it,
  because 0.45 still appears as a smoking prevalence and as a propensity
  coefficient. 41 of the 56 values are ambiguous that way. The site-anchored
  version fails on that edit and on four others: a different coefficient sharing
  the same value, the latent factor's treatment coefficient, a changed slider
  level, and a parameter registered with no anchor.
- **Verified.** `sim_provenance.py validate sim_provenance.yaml` -> `registry OK`
  (2026-08-26). **Residual gap, not closed:** `check --strict` additionally needs
  a run trace that `R/01_simulate.R` does not emit, which would mean routing
  every parameter read through the provenance logger and re-running the published
  grid. `audit_manifest.yaml` records that gap rather than claiming compliance.

### 15. A single panel's propensity range quoted as the grid-wide envelope

- **Moves published numbers: no.** The site's overlap card reads each scenario's
  own exported values and was always correct; this was a claim in a code comment
  and a registry rationale.
- **What was wrong.** `R/02_fit_methods.R` and `constant_registry.yaml` both said
  that across "all 24 published scenarios" the propensity "gets as far as
  [0.079, 0.979] at gamma = 2". That is the range of ONE panel (reversal, γ = 2,
  Γ = 0).
- **The proof it was real.** Over all 24 scenarios in `docs/data/scenarios.json`,
  `min(overlap.min)` is **0.067** (plateau, γ = 2, Γ = 0.75) and
  `max(overlap.max)` is **0.980** (plateau, γ = 2, Γ = 1.5). The conclusion the
  sentence supports is unaffected, since 0.067 is still well inside the
  [0.01, 0.99] clip, but the envelope as stated was wrong.
- **Why no check caught it.** The number lived in prose rather than in a
  registered `value:`, so `stale_constant_audit.py` passed at 10 constants with 0
  errors while both copies were wrong.
- **The fix.** Corrected to [0.067, 0.980] and registered as
  `propensity_realized_envelope_lo` / `_hi` with the single-panel figures as
  `retired_values`. Mutation-testing that guard exposed a second copy of the
  number in the registry's own prose, which the engine does not scan, so the
  duplicate was removed and there is now one source of truth.
- **Verified.** `stale_constant_audit.py --project . --strict` -> REGISTRY STRICT,
  12 constants, 0 errors, 0 warnings (2026-08-26), and re-introducing 0.979 into
  the comment fails it.

### 16. Documentation and repository hygiene corrected in the same pass

- **Moves published numbers: no.**
- The README said "Five suites" and listed four: `test_fit_contract.R` was in the
  layout tree and in the runner but missing from the list. It now lists all seven.
- A fifth item was added to "How to read the results honestly", because the panel
  the site OPENS on (plateau, γ = 0, Γ = 0) shows the naive estimate visibly
  above the truth at 36 months while step 1 of the story says the two should
  match. Investigated and confirmed to be one draw's fluctuation shared by every
  nonparametric estimator, not a defect: over the Γ = 0, γ ≤ 1 panels the CSF
  interval covers the truth at 28 of 30 horizons. Raising n for those panels
  remains open and was not done unilaterally, since it changes published numbers.
- Two inert `.gitignore` lines (`!docs/data/scenarios.json`, `!docs/figs/`)
  negated patterns that never matched, reading as though `docs/` were ignored and
  rescued. Removed; `git check-ignore` confirms behavior is unchanged.
- CI was added (`.github/workflows/tests.yml`): the two node suites plus a
  `docs/` completeness check, on push and pull request. Both failure paths were
  confirmed to fail the step. The `release-gate.yml` written by the auditor
  scaffolder was **deleted** rather than kept, because it triggers on every pull
  request and expects a bundle tarball this repository does not carry, which on a
  public repository is a permanent failure on every PR.
- `audit_manifest.yaml` and `References/README.md` were added, recording the
  twelve-auditor triage and both cited sources with their licences and how each
  was verified.

## 2026-08-25 (second pass) · The oracle refit and the E-value anchor

**Moves published numbers: YES, but only in the robustness block.** Every ATE,
RMSE, hazard ratio, overlap diagnostic, true-ATE curve and shrinkage value in
`docs/data/scenarios.json` is **unchanged and reproduces bit-for-bit** at the same
seeds: all 12 plateau Cox RMSEs, all 12 reversal CSF/CAST RMSEs, all 24 true-ATE
peaks, the overlap block at gamma = 2 (`min 0.095 max 0.967 extreme 0.003
clipped 0`) and the Ledoit-Wolf alpha range (0.0024-0.0256) were compared
element by element against the pre-fix export and none moved. What changed:
`robustness.ate_withU` and `robustness.shift` (the oracle now sees the latent
factor on both sides), `robustness.evalue` (re-anchored), and a new
`robustness.s0_baseline` field. **All nine figures are byte-identical**: md5
checksums of every `docs/` artifact taken before the re-run and re-checked after
report `OK` for all 9 PNGs (only `scenarios.json` and the hand-edited
`index.html` differ). `unmeasured_confounding.png` is unchanged because it plots
the *blinded* CSF bias, which the fix does not touch. Only the site's
unmeasured-confounding card displays anything different.

Reasoning, options considered and what was dismissed:
[`development/2026_08_25_oracle-and-evalue-audit.md`](development/2026_08_25_oracle-and-evalue-audit.md).

### 10. The "oracle" refit was not an oracle

- **What was wrong.** The unmeasured-confounding card claimed the gap between
  the blinded CSF and an oracle refit was "the empirical bias from not seeing
  it". It was about half of it, and how much varied by a factor of ten between
  panels with no way for a reader to tell.
- **Proof it was real.** `R/02_fit_methods.R` passed `W.hat = W_hat` to the
  oracle fit: the propensity estimated *without* the latent factor, which enters
  the true propensity with coefficient `0.60 * Gamma`. Measured on the shipped
  export at the 60-month horizon, the gap accounted for a mean of **53%** of the
  actual bias across the 16 scenarios with Gamma > 0, **range 8%-141%**, and the
  "oracle" itself stayed badly biased: **0.233 against a truth of 0.140** on
  plateau gamma = 1, Gamma = 1.5.
- **Fix.** A second `regression_forest` estimates the propensity *with* the
  latent factor, and the oracle refit uses it. The main fit is untouched and
  still never sees the factor.
- **What the fix actually bought, measured.** Mean `|oracle - truth|` at 60
  months fell from **0.139 to 0.059**. At Gamma = 1.5 the oracle now removes
  **39%-95%** of the total error depending on the panel. It does **not** reach
  the truth, and the documentation now says so: CSF carries a separate
  positivity residual at high gamma (up to 0.070, present already at Gamma = 0)
  that is not the oracle's to remove. The first draft of this fix asserted the
  oracle would recover the truth; the data refused that claim and the wording on
  the site, in the README and in the test was corrected to match rather than the
  threshold being tuned until it passed.
- **Test that pins it.** `tests/test_fit_contract.R` (source-level: the oracle
  propensity exists, sees the latent factor, is the one handed to the oracle
  refit, and the main fit still uses the blinded one), plus behavioural
  assertions in `tests/test_data_contract.mjs` (Gamma = 0 null check, gap sign,
  no overshoot, materially closer at Gamma = 1.5). **Confirmed to fail against
  the unfixed code:** five separate mutations of `R/02_fit_methods.R` were each
  caught, including reusing `W_hat` (2 assertions fired), blinding the oracle
  propensity (2), and leaking oracle knowledge into the main fit (5). The
  data-level assertions failed **32 times** against the pre-fix export.
- **Verified.** `./tests/run_tests.sh` -> 5 suites passed / 0 failed,
  2026-08-25, after a full 24-scenario re-run.

### 11. The E-value assumed 50% control survival at every horizon

- **What was wrong.** The card reported an E-value in standard terms. Its
  risk-ratio conversion used a hard-coded baseline survival of 0.5 at every
  horizon, and the assumption appeared in no documentation.
- **Proof it was real.** `rr_from_diff <- function(ate, base = 0.5)`. The
  observed control-arm survival across these cohorts runs **0.73-0.87 at 12
  months** and **0.08-0.21 at 108** (median 0.80 and 0.15), so the baseline was
  roughly right in the middle of the window and wrong at both ends, in opposite
  directions, while looking entirely plausible throughout.
- **Fix.** The baseline is the observed control-arm Kaplan-Meier survival at
  that horizon, needs no oracle knowledge, and is exported as
  `robustness.s0_baseline` and shown on the card so the anchor is inspectable.
- **Test that pins it.** `tests/test_fit_contract.R` (no default argument, no
  literal 0.5, the baseline comes from the control arm, and the E-value formula
  is reimplemented independently) and `tests/test_data_contract.mjs` (the
  baseline is a falling survival curve in (0, 1], is not constant, and the
  exported E-value reproduces from it to within 0.02). **Confirmed to fail:**
  restoring `base = 0.5` fires 3 assertions; taking the baseline from both arms
  instead of the control arm fires 1; `constant_registry.yaml`'s retired-value
  guard also fires (`retired value 0.5 still present`).
- **Verified.** All 24 scenarios now carry a per-horizon baseline, and the
  E-value varies across horizons where it previously could not.

### 12. Documentation and hygiene corrected in the same pass

- **A caption number that described no panel.** "its peak falls from 0.165 to
  0.148" captioned `unmeasured_confounding.png`, which is the plateau gamma = 1
  panel, whose peaks are **0.163 -> 0.140**. The quoted pair were maxima *across*
  scenarios. Corrected in the README (twice) and in the `R/03_export.R` comment;
  the general statement now gives the honest range (0.161-0.165 at Gamma = 0,
  0.136-0.148 at Gamma = 1.5) and says the spread is between-seed variation.
- **A runtime that matched no log.** The README claimed 9 min 11 s; the run that
  produced the shipped `docs/` took 8 min 40 s, and the current one 7 min 32 s.
  Now quotes the run that produced what ships.
- **`cast_core.R` advertised a bootstrap estimator** it had stopped using; the
  header now names the influence-function estimator and records what it replaced.
- **The GLS branch had an undocumented second condition** (`r2g >= 0.5` as well
  as the conditioning test). Both thresholds are now documented in the README,
  on the site and in `constant_registry.yaml`.
- **A code comment claimed the propensity clip binds.** `pct_clipped` is 0 in
  all 24 scenarios; the comment now says so and explains why the field is
  exported anyway.
- **The site had no link back to the repository.** It does now.
- **The Cox card contradicted its own PH readout at Gamma > 0** (4 of 12 plateau
  panels report p < 0.05 while the card says Cox is correctly specified there).
  The card now explains that omitting a survival-affecting covariate induces
  non-proportionality.
- **`constant_registry.yaml` added**, registering 10 estimation-side constants
  including both defects above, with the flat 0.5 recorded as a retired value so
  it cannot return silently. `stale_constant_audit.py --project .` reports
  `mode: REGISTRY (10 constants)`, 0 errors, 0 warnings.

---

## 2026-08-25 · Public-release readiness pass

**Moves published numbers: NO for the estimates, YES for the exported file.**
Every ATE, RMSE, hazard ratio and shrinkage diagnostic in `docs/data/scenarios.json`
is unchanged: the full pipeline was re-run and reproduced the previous values
bit-for-bit at the same seeds (e.g. `reversal_conf2.00_unmeas0.00` before and
after: `naive=0.245 cox=0.099 RSF-S=0.077 RSF-T=0.136 CSF=0.043 CAST=0.039`).
What did change in the file: it grew from 8 to 24 scenarios (the
unmeasured-confounding axis is now exported and reachable), and each scenario
gained `meta.smd_u_hidden` and a dense `cast.curve_*` trajectory. The static
figures were regenerated: the eight `<shape>_<level>_confounding.png` panels are
visually identical apart from the CAST trajectory now being drawn as a smooth
curve rather than a five-point polyline, and `unmeasured_confounding.png` is new.

### 1. The site rendered a permanently blank plot

- **What was wrong.** Loading the page produced a header, cards with no values,
  and an empty plot area. No error was shown and nothing failed loudly.
- **Proof it was real.** `docs/app.js` built the lookup key
  `plateau_conf0.00` while the exported scenario keys had become
  `plateau_conf0.00_unmeas0.00`. Every lookup missed, so `render()` returned at
  `if (!s) return;`. Measured: **0 of 24 scenarios reachable**, all 8 slider
  positions reporting `NOT FOUND`.
- **Fix.** `key()` now includes the unmeasured-confounding axis, and the axis is
  exposed as a second slider rather than being exported and left unreachable.
- **Test that pins it.** `tests/test_data_contract.mjs` and
  `tests/test_render_smoke.mjs`. Both were **confirmed to fail against the
  unfixed code**: reverting `key()` to the pre-fix form gives
  `FAIL app.js lookup "plateau_conf0.00" -> NOT FOUND` and
  `FAIL init() never produced a plot`.
- **Verified.** `./tests/run_tests.sh` → `24 scenarios, 24 reachable from the UI`,
  `drove 24 slider combinations, 25 plot calls`, 4 suites passed / 0 failed.

### 2. A fresh clone could not run the documented command

- **What was wrong.** `./run_all.sh`, the first command in the README's Run
  section, failed on a clean clone.
- **Proof it was real.** `git ls-files -s run_all.sh` reported mode `100644`.
  Cloning the repository and running the command gave
  `/bin/bash: ./run_all.sh: Permission denied`.
- **Root cause.** This clone has `core.fileMode = false` (the default on a
  Windows drive mounted under WSL), so git ignores the filesystem's executable
  bit entirely: a script can be `-rwxrwxrwx` locally and still be committed
  `100644`. Nothing in the working tree shows the discrepancy.
- **Fix.** `git update-index --chmod=+x run_all.sh`; the index now records
  `100755`. `tests/run_tests.sh` was given the same treatment when it was added,
  for the same reason.
- **Test that pins it.** None automated: the mode is a git index property, not
  program behaviour. It is checked with `git ls-files -s` and by re-cloning.
  **Anyone adding a new executable script to this repository must run
  `git update-index --chmod=+x` on it**, because `core.fileMode = false` means
  `git add` will not pick the bit up on its own.
- **Verified.** `git ls-files -s run_all.sh tests/run_tests.sh` → both `100755`.

### 3. The documented smoke test overwrote the published site data

- **What was wrong.** Following the README (`DEMO_SUBSAMPLE=600 ./run_all.sh`)
  replaced the published data and figures with a reduced-grid artifact. Anyone
  who then committed would have published a broken site.
- **Proof it was real.** After a smoke run, `docs/data/scenarios.json` went from
  24 scenarios to 2 (`md5 f7fcfc57... -> 24160f4b...`), and two of the eight
  figures were rewritten.
- **Fix.** A subsample run exports to `output/preview/` and says so; only a full
  run writes `docs/`.
- **Test that pins it.** Checked by running the smoke test against recorded
  checksums, and **confirmed to fail before the fix** (the checksums differed).
- **Verified.** 2026-08-25: `DEMO_SUBSAMPLE=600 ./run_all.sh` then
  `md5sum -c` over all 13 `docs/` artifacts → all `OK`, and the run logged
  `smoke-test export to output/preview/ (docs/ left untouched)`.
- **Second route to the same failure, found while verifying the first.**
  Redirecting the smoke test's output does not help if `R/03_export.R` is run on
  its own afterwards: it reads whatever `output/fits.rds` holds, sees no
  `DEMO_SUBSAMPLE`, and publishes. **Reproduced during this pass:** running the
  exporter alone after a smoke test wrote `docs/data/scenarios.json ( 2
  scenarios )` and rebuilt two figures, and `md5sum -c` failed. Fixed by
  stamping the run's `subsample` value into `output/fits.rds`; the exporter
  trusts that stamp over the environment and diverts to `output/preview/`.
  **Verified after the fix:** same sequence, the exporter logged
  `output/fits.rds came from a subsample run (n=600); exporting to
  output/preview/ rather than docs/`, and all 10 `docs/` artifacts were
  unchanged.

### 4. A smoke-test export crashed the page with a misleading message

- **What was wrong.** After a single-shape run the page showed *"Could not load
  data/scenarios.json. Run the R pipeline first"* even though the file had
  loaded fine.
- **Proof it was real.** `jsonlite::toJSON(auto_unbox = TRUE)` turned the
  length-1 `shapes` vector into the scalar string `"plateau"`. Reproduced:
  `d.shapes.forEach(...)` → `TypeError: d.shapes.forEach is not a function`,
  thrown inside `init()`, caught by the fetch `.catch()` and reported as a load
  failure.
- **Fix.** `I()` on every grid in `R/03_export.R` keeps them arrays; the front
  end also now distinguishes a missing CDN, a failed fetch and a missing
  scenario, with a specific message for each.
- **Test that pins it.** `tests/test_data_contract.mjs`, **confirmed to fail
  against a hand-unboxed fixture**: `FAIL shapes is string ("plateau"), not an
  array`.
- **Verified.** The smoke export now carries `shapes: ['plateau']` as an array
  and passes the contract test.

### 5. A figure was titled "mild confounding" while showing γ = 1 (moderate)

- **What was wrong.** `R/03_export.R` indexed the confounding-strength word
  lists by *position in `conf_grid`* rather than by the value of γ.
- **Proof it was real.** Under the smoke grid `c(0, 1)`, γ = 1 is the second
  element, so it received the second word. The run wrote
  `plateau_mild_confounding.png` titled *"Plateau effect, mild confounding"*
  containing the γ = 1 cohort, whose naive curve peaks at 0.39. The file was
  fresh, non-empty and newer than its producer, so every freshness check passed.
- **Fix.** The vocabulary moved to `R/scenario_labels.R` and is keyed to γ's
  value; an unregistered γ gets a self-describing token rather than a
  neighbour's label.
- **Test that pins it.** `tests/test_export_labels.R`, **confirmed to fail
  against the position-indexed version** (`FAIL gamma = 1 is still 'moderate'
  when it is 2nd in a 2-element grid`).
- **Verified.** The same smoke run now writes
  `output/preview/figs/plateau_moderate_confounding.png`.

### 6. The sandwich variance had no test with teeth

- **What was wrong.** Not a defect in the shipped code, but in its coverage: the
  only assertion on `Var(beta)` checked the GLS case, where the sandwich
  collapses to `(X'Sigma^-1 X)^-1`, which is exactly `bread`.
- **Proof it was real.** Mutation test: deleting the meat term entirely
  (`var_beta <- bread`) left the suite **green**.
- **Fix.** Added a WLS-branch assertion with non-uniform standard errors, where
  the weight matrix is not `Sigma^-1`, plus a check that the sandwich and the
  bread actually differ so the assertion cannot go vacuous again.
- **Test that pins it.** `tests/test_cast_core.R`, now **confirmed to fail**
  against three separate mutations: dropping the meat term, replacing `Sigma`
  with its diagonal inside the meat, and disabling the GLS branch.
- **Verified.** 9 of 9 mutations to `R/cast_core.R`, `R/scenario_labels.R` and
  `docs/app.js` are now caught; 12 of 12 across all four suites.

### 7. Documentation that did not reproduce

- **`control median survival ~55 months`** (README and site) → **~47 months**.
  The marginal control-arm median, computed over the covariate distribution, is
  46.6 months; 56.7 is `exp(4.3) * log(2)^(1/1.4)`, the median at linear
  predictor 0, which ignores the `-0.40 * smoke` term (cohort mean linear
  predictor about -0.14). No code changed; the claim did.
- **"the integral is the trapezoidal sum"** → the code computes a left-endpoint
  Riemann sum, `cumsum(h * du)` with `du = c(0, diff(grid))`. The documentation
  was corrected rather than the code, since at a 0.5-month step the difference
  is far below the Monte-Carlo noise and changing it would move every published
  estimate for no gain.
- **"8 scenarios"** → 24; **"~14 KB"** → about 75 KB; the latent confounder,
  the oracle refit, the overlap block, the robustness block and AUTOC are now
  documented rather than exported silently.
- **Verified.** A parity check of 13 README claims against the regenerated
  `scenarios.json` (scenario count, grid shape, horizons, n, event-rate range,
  true-ATE peak shift, GLS engagement, shrinkage magnitude, clip frequency,
  PH-test p-values, file size, dense curve, latent SMD) → **0 failures**.

### 8. Framing that the demo's own numbers contradicted

- **What was wrong.** The README and the site said standard baselines "fall
  short". On all four plateau panels the Cox model is the most accurate
  estimator shown.
- **Proof it was real.** Cox is *correctly specified* on the plateau: the
  simulation generates survival from a proportional-hazards Weibull with linear
  covariate effects, which is what Cox assumes. Measured over 5 independent
  cohort seeds at n = 2000, γ = 1: **Cox RMSE 0.0089 ± 0.0057 versus CSF
  0.0327 ± 0.0125**, with Cox most accurate in 4 of 5 seeds.
- **Fix.** The claim is now "every baseline has a regime where it breaks", and
  the Cox card, the failure-mode card and the README all state that Cox is the
  true model on the plateau and confine its failure to the reversal.
- **Also corrected:** the RMSE card implied a precision the design cannot
  support (single cohort, single seed; CSF and CAST differ by 0.0004 on a
  between-seed spread of about 0.011, and swap rank between seeds), and the
  Ledoit-Wolf card implied the shrinkage was doing work when its intensity is
  0.002-0.026 and the condition number does not move. Both now say so.
- **Verified.** The 5-seed replication is recorded in
  `development/2026_08_25_public-release-audit.md`.

### 9. Repository hygiene

- `run_all.sh` now logs every tunable it resolved (`DEMO_SUBSAMPLE`,
  `DEMO_NUM_TREES`, `DEMO_SEED`, `DEMO_TUNE`), so a run's own log shows the
  configuration it used instead of leaving it to be assumed.
- The 50+ warnings a full run emits were traced to `grf`'s own
  *"estimated treatment propensities take values very close to 0 or 1"*. They
  are the positivity stress the demo teaches, fire on the strong-confounding
  scenarios, and are now documented rather than unexplained.
- `CAST_demo_screenshot.pdf` (2.5 MB) was untracked **and** un-ignored, one
  `git add -A` away from being published; now gitignored.
- Added `CITATION.cff`. Both cited works were re-verified against source: arXiv
  2505.06367 (title, all 10 authors, 2025) and DOI 10.1038/s41598-026-54656-0
  (Crossref: *Scientific Reports* **16**, 23659, 2026). Three author given names
  drafted from memory were wrong (`Shashwat`→`Sparsh`, `Lin`→`Lillian`,
  `Tony J. C.`→`Tony J.`) and were corrected against Crossref.
- Plotly is now loaded with a Subresource Integrity hash
  (`sha384-cCVCZkAjYNxaYKbM8lsArLznDF/SvMFr1jcZrvOpSTCa0W40ZAdLzHCEulnUa5i7`,
  computed from the pinned 2.35.2 build) and `crossorigin="anonymous"`.
- The CSS `--cox` swatch was `#8e44ad` while the plot drew `#9467bd`; they now
  agree. Added a page description, Open Graph tags and a favicon.
- Added `sim_provenance.yaml`: 18 registered parameters, each marked
  `design_choice` or `calibrated`, with the calibrated ones recording both their
  target and the realized value.
