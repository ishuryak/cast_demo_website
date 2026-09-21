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

## 2026-09-20 (framing) · A third version of the site, written for an oncologist

**Moves published numbers: no.** No R script is edited, the pipeline is not
re-run, and `docs/data/scenarios.json` is byte-identical to the previous commit.
The new page reads that same export. What is added is a third presentation of
the same estimates, a test suite that pins its framing decisions, and one
correction to a published sentence in the walkthrough.

Two clinician reviewers and one biostatistician read the existing methods,
clinical and walkthrough pages. The reasoning, the findings that were dismissed,
and the decision to build a new version rather than edit the existing two are in
[`development/2026_09_20_oncology-framing.md`](development/2026_09_20_oncology-framing.md).

### 37. The walkthrough asked a clinician to identify themselves and offered no option

- **What was wrong.** `docs/tutorial/index.html` opens with "How would you
  describe yourself?" and four choices: Statistics student, Researcher, Causal
  convert, Educator. An oncologist has no answer, and "causal convert" does not
  parse for one. The first interaction on a teaching page told a clinical reader
  the page was not for them.
- **The proof it was real.** Four `data-reader-path` buttons in
  `docs/tutorial/index.html:34-37`, none clinical, and no test anywhere in the
  repository referenced `reader-path`, so the set could shrink or drift with
  nothing noticing.
- **The fix.** The new `docs/oncology/` page carries five paths with
  **Clinician or oncologist first**, each routing to three stops. The existing
  walkthrough is unchanged; this is a separate version, not an edit of it.
- **The test that now pins it.** `tests/test_oncology_contract.mjs` section 1
  asserts the count, the exact set, the clinician path's presence and its first
  position, that every path points at an itinerary that exists, that each
  itinerary has exactly three stops (the announced status string promises
  "Three suggested stops"), and that the no-JavaScript fallback offers all five.
  **Confirmed to fail** against `--mutate=drop-clinician-path`: 5 failures.
- **Verification.** `node tests/test_oncology_contract.mjs` on 2026-09-20:
  PASS, 375 checks, 0 failures.

### 38. Treatment versus control is the wrong frame for oncology

- **What was wrong.** All three existing surfaces label the arms "treatment" and
  "control": 27 uses on the walkthrough, 10 on the methods page, 5 on the
  clinical view. Outside a placebo trial oncology compares two active options,
  and the "control" label implies a no-treatment reference the estimand never
  required.
- **The proof it was real.** The estimand is
  `E[S1(t)] - E[S0(t)]`, a contrast between two arms with no requirement that
  either be untreated. The generator agrees: `R/01_simulate.R:92` makes fitter
  patients more likely to receive `W = 1`, which is exactly how the more
  intensive of two options is selected in practice. No modality, drug or
  schedule is named anywhere on the three pages; the closest clinical analogy
  shipped is "a protective spell" and "a well-fitting suit of armor"
  (`docs/tutorial/index.html:219`).
- **What it changes scientifically.** The flagship "early benefit, later
  reversal" scenario is hard to credit as treat-versus-nothing and entirely
  credible as intensive-versus-standard, where an early gain is paid back in
  late toxicity. Relabelling makes the demo's headline case more plausible, not
  less.
- **The fix.** `docs/oncology/` names the arms Option A (more intensive) and
  Option B (standard) throughout, states why in its opening section, and names
  the real comparisons the framing covers.
- **The test that now pins it.** Same suite, section 2: no arm is labelled
  "control", both option labels appear at least ten times, the page explains the
  choice, and the technical section states that relabelling changes no
  computation. **Confirmed to fail** against `--mutate=reinstate-control`, which
  re-introduces one occurrence of control-arm language: 1 failure. The mutation
  itself throws if it turns out to be a no-op, because the first version of it
  silently matched nothing and proved nothing.

### 39. The walkthrough asserts causal assumptions at settings that break them

- **What was wrong.** `docs/tutorial/app.mjs:66` prints "The adjusted estimate
  favors treatment at this horizon, under the causal assumptions" at every
  control position, including Hidden confounding = Strong, where the simulation
  has violated those assumptions on purpose. Line 74 appends "adjustment cannot
  use it" but never retracts the claim.
- **The proof it was real.** The string is emitted unconditionally from the sign
  of the estimate; `state.unmeas` is consulted only to append a sentence.
- **The fix.** On the new page the interpretation refuses: at any setting with
  an unrecorded confounder the headline reads "This estimate should not be
  interpreted", says why, and reports what the truth actually is.
- **The test that now pins it.** Section 3 drives all 120 scenario-horizon
  positions and asserts the refusal appears at every one of the 80 with an
  unrecorded confounder and at none of the 40 without.
  **Confirmed to fail** against `--mutate=interpret-anyway`: 1 failure.
- **Verification.** Included in the 375 checks above.

### 40. Three display defects carried over from the clinical view

- **What was wrong.** (a) `docs/clinical/app.js:20-22` gives CSF and CAST the
  identical colour `#009e73` while the accuracy card distinguishes them by
  colour alone. (b) Per-point values and every truth marker on the walkthrough
  live in SVG `<title>` elements, which do not exist on a tablet. (c) The
  hidden-confounder card prints `+shift` in its headline and "a move of
  `-shift`" two sentences below, so the number changes sign inside its own card.
- **The proof it was real.** (a) `COLORS.csf === COLORS.cast`, verified by
  reading the object. (b) `docs/tutorial/app.mjs` writes each point's value into
  a `<title>`; the click target carries `aria-hidden="true"`. (c) `app.js:385`
  against `app.js:389` in `docs/clinical/`.
- **The fix.** On the new page CAST is `#00356b` and is the only filled band,
  CSF is drawn as markers so the two never rely on colour alone; every figure
  value is repeated in a table that stacks into labelled blocks on a phone
  rather than scrolling sideways; and the hidden-factor headline and body are
  generated from one `shift` value with the direction word derived from its sign.
- **The test that now pins it.** Sections 4, 5 and 6. The sign check runs on all
  80 panel-horizon positions that have a hidden factor and asserts headline,
  direction word and both quoted endpoints agree. **Confirmed to fail**:
  `--mutate=flip-hidden-sign` gives 160 failures, `--mutate=share-colour` 1, and
  `--mutate=drop-table-rows` 2.

### 41. The clinical view reports coverage as if 120 cells were 120 trials

- **What was wrong.** The clinical view states that a 95% band "can be checked
  directly instead of assumed" and reports 41 of 120. Those 120 cells are 24
  simulated cohorts: the five horizons in a panel come from one draw and move
  together.
- **The proof it was real.** Recomputed from the shipped export: 3 panels hit
  5 of 5, 10 panels miss 0 of 5, and only 11 are mixed. The cluster standard
  error over panels is 0.0737 against a binomial 0.0433 over cells, a design
  effect of 2.90, so the reported 34% carries an interval of 20% to 49% rather
  than plus or minus 4 points. `README.md:639` already said this in words
  ("the effective replicate count is six") and `R/04_replicate_seeds.R` contains
  no coverage logic, so no calibration study exists in the repository.
- **The fix.** The new page reports the same point figures and prints the
  cluster interval beside them, and its limitations section states in words that
  the 120 cells are 24 draws.
- **The test that now pins it.** Section 7 recomputes coverage and the cluster
  interval independently of the page's own helper, and additionally asserts the
  reported interval is at least 20% wider than a binomial one over cells, so the
  page cannot quietly revert to the independence claim it exists to retract.
  **Confirmed to fail** against `--mutate=binomial-ci`: the page reports
  26% to 43% where the cluster interval is 20% to 49%.

### 42. A published walkthrough page still called the export tuned

- **What was wrong.** `docs/tutorial/labs/README.md:11` read "not an exact rerun
  of the 2,000-person **tuned** website export". The tuning claim was retired on
  2026-09-18 (entry 32) after grf was shown to ignore `tune.parameters` when the
  propensity is supplied. This file is served by GitHub Pages, so the retracted
  claim was live.
- **The proof it was real.** It was the only surviving instance in the published
  walkthrough; the other three mentions all correctly read "untuned", and the
  class-kit ZIP does not contain this file.
- **The fix.** The word removed and the mechanism stated in its place, in both
  `tutorial/labs/README.md` and the generated `docs/tutorial/labs/README.md`.
- **The test that now pins it.** `tests/test_readme_claims.mjs` already fails if
  the repository claims the forests are tuned; the new suite additionally
  asserts the oncology page states they are not. A grep for "tuned website
  export" across `tutorial/` and `docs/` now returns nothing tracked.
- **Verification.** `bash tests/run_tests.sh` on 2026-09-20: 16 suites, 0 failures.

### 43. The viewport suite could only ever measure the site root

- **What was wrong.** `tests/test_viewport_overflow.mjs` hardcoded the measured
  page as `/index.html`, so `docs/clinical/` had never been measured at any
  width and neither could any future page.
- **The proof it was real.** The iframe source was a literal, and the control
  copy was served from the root, where a subdirectory page's relative
  stylesheet, script and data references would not resolve.
- **The fix.** An optional third argument names the page; the control copy is
  now served from that page's own directory so relative references resolve. The
  default is unchanged, so every existing invocation behaves exactly as before.
- **What it caught immediately.** Two real layout defects in the new page, found
  by running it rather than by reading it: Plotly lays a title out at its full
  string width and never wraps it, so the scenario title overflowed the chart at
  360, 420 and 620 pixels; and a ten-column numeric table cannot fit a phone,
  reaching 435 pixels against a 345-pixel viewport even after the minimum width
  and nowrap were removed. The title became a wrapping HTML caption and the
  table now stacks into labelled blocks.
- **Verification.** `node tests/test_viewport_overflow.mjs` (site root) and
  `node tests/test_viewport_overflow.mjs docs oncology/index.html` on
  2026-09-20: both PASS, 0 failures, at all six widths.

## 2026-09-18 (audit) · Repository hygiene, and four claims the data contradicted

**Moves published numbers: no.** Every estimate in `docs/data/scenarios.json` is
byte-identical to the previous commit. No R script is edited and the pipeline is
not re-run. What changes is the tracked file list, the prose that describes those
estimates, one card on the clinical page, and the tests. Several of the claims
corrected below were *wrong about* the published numbers, which is why correcting
them moves none of them.

The full audit, the findings investigated and dismissed, the two boundaries
applied to "fix everything", and the open work this pass deliberately did not do
are in
[`development/2026_09_18_repository-hygiene-and-claim-parity.md`](development/2026_09_18_repository-hygiene-and-claim-parity.md).

### 30. Four attestation hashes in the audit manifest were never computed

- **What was wrong.** `audit_manifest.yaml` binds each recorded auditor verdict
  to a sha256 of the files it was reached against. Four of those values were not
  digests of anything.
- **The proof it was real.** They are 63 or 65 hex characters, where a sha256 is
  64, and each is a hand-typed walking-nibble sequence:
  `c2d3e4f5a6b7c8d9...` on `R/04_replicate_seeds.R`,
  `c3d4e5f6a7b8c9d0...` on `tests/test_intro_contract.mjs`,
  `d4e5f6a7b8c9d0e1...` on the reader-first report, and
  `8a7b6c5d4e3f2a1b...` standing as the `report_sha256` of **three different
  reports at once** (`paper-code-audit`, `manuscript-audit`, `evidence-audit`).
  One value cannot be the digest of three different files. An attestation exists
  to bind a verdict to the bytes it was reached against, so a hash nobody
  computed binds nothing: the attested file can change freely and no check
  notices, because no check ever compared it. `audit_gate.py` reported one of
  them as "stale", which is a milder and wrong diagnosis, and that is why the
  fabrication survived every green run since.
- **The fix.** All 51 hashes in the manifest recomputed from their files. Four
  were fabricated as above and four more had genuinely gone stale, because
  `README.md`, `docs/index.html`, `sim_provenance.yaml` and
  `constant_registry.yaml` were all edited in this pass. The manifest header now
  records both findings.
- **The test that now pins it.** `tests/test_repo_hygiene.mjs` section 4
  recomputes every hash in the manifest on every run and reports the two failure
  modes separately, since they mean different things: MALFORMED (never a digest)
  and STALE (was one, file has changed). **Confirmed to fail in both modes**:
  restoring one 63-character value reports MALFORMED, and appending a line to
  `README.md` reports STALE.
- **Verification.** `node tests/test_repo_hygiene.mjs` on 2026-09-18: PASS,
  0 failures, 51 attestation hashes recomputed.

### 31. The tree carried a broken submodule, two backups and a scratch pair

- **What was wrong.** Commit `db72206`, message "Fix Windows path resolution in
  test files; update audit manifest", also committed four things it did not
  mention: `cast_demo_website` as a gitlink, `.backup_untracked/`,
  `tests/debug_path.mjs` and `debug_path2.mjs`, and `.claude/settings.local.json`.
- **The proof it was real.** `git ls-files -s cast_demo_website` returns
  `160000 68a22b3ea1bafa7f86e6cbbbc3e03ee6ea83f7f4 0` and no `.gitmodules` exists,
  so a fresh clone gets a directory git calls a submodule with no URL to fetch it
  from. The gitlink points at `68a22b3`, a commit in this same repository. The
  nested copy also doubles the tree: six of the seven `stale_constant_audit.py`
  sweep warnings resolved into `cast_demo_website/...` rather than into real code.
  The drifted backup of the viewport test cites
  `development/2026_08_27_everest-yang-feedback.md` where the tracked file cites
  `2026_08_27_site-review-comments.md`, re-introducing a misattribution this
  repository had already corrected.
- **The fix.** All four untracked, the two scratch files deleted from disk, and
  each path added to `.gitignore` so `git add -A` cannot return it. `db72206` is
  the tip of `origin/everest-yang-review`, so it is published and no history was
  rewritten. The blobs stay reachable behind that commit. None is patient data or
  a paywalled PDF.
- **The test that now pins it.** `tests/test_repo_hygiene.mjs`, which checks the
  gitlink *mode* rather than the one name, and checks both that each path is
  untracked and that it is ignored. **Confirmed to fail against the unfixed tree**:
  run in a worktree at `db72206` it reports 9 failures.
- **Verification.** `node tests/test_repo_hygiene.mjs` on 2026-09-18: PASS,
  0 failures.

### 32. The README said CSF is tuned; grf ignores the argument

- **What was wrong.** "On a full run all forests are tuned ... CSF
  (`grf::causal_survival_forest`) use grf's built-in `tune.parameters = "all"`".
  The causal survival forests run at grf defaults in all 24 scenarios.
- **The proof it was real.** Deparsing the installed grf 2.5.0,
  `tune.parameters` is referenced in exactly two places inside
  `causal_survival_forest`: its signature default, and one line inside
  `if (is.null(W.hat))` forwarding it to the propensity forest grf fits for
  itself. `R/02_fit_methods.R:218` supplies `W.hat`, so that branch never runs,
  and the nuisance survival and censoring forests never receive the argument
  either. No error and no warning is emitted. The untracked clinical page had
  this right while the tracked README had it backwards.
- **The fix.** The tuning section now states which of the three tuned things are
  tuned (the propensity and the RSF hand grid) and that CSF is not, with the
  mechanism. Two other places reading "all forests tuned" were corrected to name
  `DEMO_TUNE=all` instead.
- **The test that now pins it.** `tests/test_readme_claims.mjs` asserts the
  README records that CSF runs untuned, and separately that the CSF call site
  still supplies `W.hat`, since the claim is only true while it does.
  **Confirmed to fail against the unfixed README**: 2 failures at `db72206`.
- **Verification.** `node tests/test_readme_claims.mjs` on 2026-09-18: PASS,
  0 failures.

### 33. The coverage claim quoted the easy corner of the grid

- **What was wrong.** "Over the Γ = 0 panels with γ ≤ 1 the CSF interval covers
  the truth at 28 of 30 horizons, which is what nominal coverage looks like."
- **The proof it was real.** The count is right and the framing is not. Those 30
  horizons are six cohorts, since the five horizons within a panel come from one
  draw and move together. Recomputed from the shipped `scenarios.json`, CSF
  intervals contain the truth at 44 of 120 across the grid and the CAST band at
  41 of 120, and at Γ = 1.5 both are 0 of 40. The clinical page already printed
  41/120 and 0/40 on its face while the README said coverage looked nominal.
- **The fix.** A sixth numbered item in *How to read the results honestly* giving
  the whole-grid numbers, stating the effective replicate count, and saying
  plainly that no coverage study exists and where one would go.
- **The test that now pins it.** `tests/test_readme_claims.mjs` recomputes all
  four tallies and compares them to the numbers in the prose. **Confirmed to fail
  twice over**: 4 failures against the `db72206` README, and 2 against a mutated
  export whose CAST bands were widened threefold.
- **Verification.** As entry 32.

### 34. The clinical page showed the hidden-confounder shift with the sign reversed

- **What was wrong.** The card read "refitting the same model *with* the hidden
  factor moves the estimate by +16.4 patients per 100" when the refit moves it
  *down* by that amount.
- **The proof it was real.** `robustness.shift` is `ate_omitU - ate_withU`
  (`R/02_fit_methods.R:284`), so the move caused by adding the factor is
  `-shift`. At plateau/γ=0/Γ=1.5, h=60: `ate_omitU` 0.3433, `ate_withU` 0.1795.
  Every Γ > 0 panel has a positive shift, so the direction was wrong on all 16.
  The parent page prints both endpoints, so a reader can recover the direction
  there. This page printed only the signed shift.
- **The fix.** The card now prints both endpoints and the signed move, as the
  parent does. Two other clinical-page defects were fixed in the same pass: the
  balance card claimed smoking "stays near zero however strong the confounding"
  while its own bar turns red at `|SMD|` 0.112 and 0.102, and three comments
  described bar scaling "against a shared scale rather than the worst method"
  when the code scales to the worst method.
- **The test that now pins it.** `tests/test_clinical_contract.mjs` parses the
  signed move out of the rendered card and compares it to
  `100 * (ate_withU - ate_omitU)`, so it pins the number a reader sees. The
  smoking claim's own stated count is recomputed from the data. **Confirmed to
  fail against the original page**: 18 failures. **And mutation-tested**:
  re-inverting the sign while keeping the new wording produces 16 failures, and
  changing the bar scaling to a fixed denominator produces 23.
- **Verification.** `node tests/test_clinical_contract.mjs docs/data/scenarios.json`
  on 2026-09-18: PASS.

### 35. Two assertions in the clinical suite could not fail, and the viewport suite was flaky

- **What was wrong.** `barWidthWins > 0` counted panels whose widest bar is at
  least 95%, and the widest bar is exactly 100 by construction. Its message
  described cap logic the code comments say was removed.
  `Math.min(...ratios) === 1` compared the best row to itself. Separately, the
  viewport suite failed intermittently with "the harness produced no
  measurement", on a step that gates every push and pull request.
- **The proof it was real.** The bar scaling is `100 * v / top` with
  `top = max(v)`, so the maximum width is 100 on every panel and the first
  assertion is unconditionally true. The viewport suite failed 2 times in 5
  measured runs, once inside `run_tests.sh` and once in four standalone runs.
  The cause is two clocks: the harness left its JSON in a `<pre>` for
  `--dump-dom`, which fires when `--virtual-time-budget` expires, and virtual
  time compresses the harness's own `setTimeout` sleeps, so the dump could land
  mid-measurement.
- **The fix.** Both assertions replaced by a recomputation of every bar width
  from the JSON. The viewport harness now POSTs its result to the server it was
  loaded from and node waits for that POST, so the measurement reports when it is
  finished rather than being sampled at a guessed moment.
- **The test that now pins it.** The replacements are themselves the pins, and
  both were mutation-tested (entry 34). The viewport suite's built-in negative
  control, a deliberately 1600px-wide element, runs every time and was confirmed
  to fire when the measurement is stubbed out.
- **Verification.** 10 consecutive runs of `node tests/test_viewport_overflow.mjs`
  on 2026-09-18: 10 passes, 0 failures, against 2 failures in 5 before the fix.

### 36. Three claims about the shipped grid that the shipped grid contradicted

- **What was wrong.** The README attributed CSF's residual bias to positivity
  under strong confounding, framed the two RSF learners as "two different failure
  modes", and `constant_registry.yaml` justified `gls_cond_max` with "realized
  condition numbers are single digits". The clinical view was also undocumented
  and unreachable: absent from the README layout tree, absent from the header
  links, and with no link from `docs/index.html`.
- **The proof it was real.** Recomputed from `scenarios.json`: on plateau at
  Γ = 0, max |CSF bias| is 0.0505 at γ = 0 (no confounding, no positivity
  problem) against 0.0700 at γ = 2, and 0.0234 at γ = 0.5, so it is not
  monotone in γ. The RSF S-learner has the lower RMSE in 20 of 24 panels, and on
  plateau/γ=0/Γ=0, which is random assignment, it is the worst method present
  at 0.051 against naive 0.027. `shrinkage.cond_after` runs 8.1 to 17.6.
- **The fix.** All three statements rewritten to what the data shows. The CAST
  trajectory's larger-than-CSF RMSE in 9 of 24 panels, 7 on the reversal, is now
  stated alongside the band, together with what the band is a band for. The
  clinical view is linked from the README header, described in the layout tree,
  and linked from the methods page.
- **The test that now pins it.** `tests/test_readme_claims.mjs` recomputes the
  20-of-24, the 9-of-24-and-7-on-reversal, the worked example
  (CSF 0.006 to CAST 0.037) and the condition-number range, and compares each to
  the prose. **Confirmed to fail against the unfixed files**: 3 failures at
  `db72206`.
- **Verification.** As entry 32.

---

## 2026-08-29 (reader) · An introduction for a reader who is not in this field

**Moves published numbers: no.** `docs/index.html`, `docs/style.css`, one line of
`docs/app.js`, `tests/`, the CI workflow and `README.md` only. No R script, no
`scenarios.json`, no figure and no registry file is touched, and every quantity
on the page is bit-identical to the previous commit.

The request, the two design decisions Igor made before any file was touched, the
defect introduced and caught during the work, and the findings investigated and
deliberately not acted on are in
[`development/2026_08_29_reader-first-introduction.md`](development/2026_08_29_reader-first-introduction.md).

### 28. The page had no introduction a non-specialist could read

- **What was wrong.** The page opened with a heading reading "From confounding to
  trajectories", a subtitle naming a Causal Survival Forest and a
  treatment-effect trajectory, and five lead paragraphs. A reader outside causal
  inference, which includes most of the clinicians and researchers this demo is
  built for, could not tell from any of it what the demo is for, what data it
  applies to, what it delivers, or why they should prefer it to the tools they
  already use. Entry 21 below had rewritten that lead once, plain-statement-first,
  and that fix is not withdrawn here: it improved the block, but the block assumes
  a reader who has already accepted the framing, and never asks why anyone outside
  the field should care.
- **The proof it was real.** The second paragraph a reader met was "We estimate
  the between-group difference in the probability of surviving past each fixed
  time horizon, i.e. the **survival-probability difference**, formally
  P(T&gt;t | treated) − P(T&gt;t | control)", and the page's own first
  non-specialist reader reported exactly this: "the website has no introduction
  that explains to a non causal inference specialist [...] what the problem being
  studied actually is". Ten suites were green at that moment, because every one of
  them checks whether the page is *correct* and none checks whether it is
  *readable*.
- **The fix.** A `<section class="intro">` above the controls: a lead paragraph
  stating the problem with **confounding** defined in the sentence that first uses
  it, four blocks laid out 2x2 (what the demo is for, what it analyzes and what it
  delivers, why the familiar tools fall short, what no method can fix), and a
  glossary giving one plain-language line to each method drawn on the figure. 796
  words. The header subtitle was rewritten in the same pass, since it is the first
  line on the page and leaving it in the old register would have undone the change
  three inches below it. **The existing technical lead was folded, not deleted**:
  all five paragraphs move verbatim inside `<details class="lead-detail">` under
  the summary "The simulated cohorts in detail", so the formal estimand is one
  click away rather than in front of the reader.
- **The test that now pins it.** `tests/test_intro_contract.mjs`, registered in
  `tests/run_tests.sh` and in the CI workflow. It asserts the introduction exists
  and precedes the controls, that it carries a lead paragraph and four blocks
  answering the four questions, that **every method key in `app.js` has a line in
  the glossary** (a method added to the figure with no introduction line fails
  here), that it stays within a 900-word cap, that "confounding" is defined where
  it first appears, that a blocklist of 29 specialist terms stays out of it, and
  that the folded technical lead is still present with its estimand statement
  intact. **Confirmed failing by six mutations**: the introduction moved below the
  controls, "estimand" inserted into it, a block deleted, a method added to
  `app.js` with no glossary line, the technical lead deleted rather than folded,
  and the introduction padded past the word cap. The suite also caught a bug in
  itself on its first run, where a case-insensitive search for the acronym `ATE`
  fired on the word "treated"; acronyms are now matched case-sensitively on word
  boundaries.
- **Verified.** `./tests/run_tests.sh` -> **11 suites passed, 0 failed** on
  2026-08-29, against `docs/data/scenarios.json`. The baseline is the 10 suites
  passing before this change; the eleventh is the new one. `README.md` was updated
  in the same pass (the "What you see" section, the suite counts from ten to
  eleven and five node suites to six, and an entry for the new suite) per the
  README-parity rule.

### 29. A card's own title was not what opened it

- **What was wrong.** Entry 22 below collapsed each card's prose behind a
  `<details class="more">` disclosure whose summary read "Full explanation" and
  sat at the bottom of the card. That was an improvement and it is not withdrawn.
  But the card face still carried its title, its live numbers **and** three
  bullets, so seven cards still presented seven paragraphs at once, and the
  control that opened a card was a separate small link rather than the card's own
  heading. Reaching one card's explanation took two clicks in a page that already
  asks the reader to hold six methods and two confounding axes in mind.
- **The proof it was real.** Measured in a 1440 px viewport, reading
  `.cards` back from the page's own `getBoundingClientRect()` rather than off a
  screenshot: the seven closed cards occupied **912 px** before the change and
  **450 px** after it, a 51% reduction with no word removed from the page. Total
  visible text moved from 2024 to 2200 words, so the introduction's 796 words are
  largely paid for by the prose that folding puts one click away.
- **The fix.** Each card is now ONE `<details class="card">` whose `<summary>`
  contains its own `<h3>` title and its live-value elements. Closed, a card shows
  its title and its numbers, which is what a card is for. Clicking the title opens
  the bullets and the full prose together. The nested "Full explanation"
  disclosure is gone, so one card is one click. `<details>` rather than a click
  handler on the title, for the reasons entry 22 gives and which still hold:
  keyboard-reachable, announced by screen readers, works with JavaScript off, and
  the browser's in-page search still finds text inside a closed card. A modal
  popup was offered and Igor chose expansion in place.
- **The ripple.** `<summary>` takes phrasing content plus headings, so the
  live-value containers that ride on the closed face became `<span>`s, and the one
  line of `docs/app.js` that built an RMSE row as a `<div>` now builds a `<span>`.
  A span is inline by default, so `.hint`, `.big` and `.rmse-bars` were given
  explicit block displays. That is load-bearing, not tidiness: without them the
  card face collapses into a single run of text, which is the same class of defect
  as entry 18 below.
- **The tests that now pin it.** `tests/test_render_smoke.mjs` asserts each card
  is a single `<details>` with an `<h3>` inside its `<summary>`, with its live
  values **inside** the summary (the inverse of the assertion it made before, when
  they had to be outside), with brief bullets, with no nested second disclosure,
  with prose after the summary, and with no `<p>`, `<div>` or `<ul>` inside the
  summary, which its content model forbids. `tests/test_style_contract.mjs` gains
  a check that every class appearing on a `<span>` inside a `<summary>` declares a
  non-inline display. **Confirmed failing by seven mutations**: a live value moved
  out of a summary, a `<p>` put back inside one, a second disclosure nested in a
  card, a card title demoted from `<h3>` to `<b>`, a card's prose deleted rather
  than collapsed, and `display: block` removed from `.hint` and from
  `.rmse-bars`.
- **Verified.** Same run as entry 28: 11 suites passed, 0 failed, including the
  viewport suite at 360, 420, 620, 720, 1024 and 1440 px. Rendered headless at
  1440 px in both states, closed and with two cards forced open, and read back.

---

## 2026-08-28 (record) · The evidence record disagreed with itself

**Moves published numbers: no.** `FIXES.md`, `README.md`, `.gitignore`,
`tests/` and the CI workflow only. No R script, no `scenarios.json`, no figure
and no registry file is touched. Found while re-auditing the repository from a
clean checkout rather than from the previous audit's conclusions.

The audit that found both items, its full thirteen-auditor triage, the claims it
re-derived rather than trusted, the findings it investigated and dismissed, and
the one mistake it made along the way are in
[`development/2026_08_28_independent-re-audit.md`](development/2026_08_28_independent-re-audit.md).

### 26. FIXES.md told the reader entries were newest first, and they were not

- **What was wrong.** The preamble states "Entries are newest first." A reader
  who trusts that sentence and stops at the top section believes they are looking
  at the most recent change. They were not: the two newest sections, both dated
  2026-08-28, sat third and fourth, below 2026-08-27 and 2026-08-26. The two
  changes that landed that day were appended after the section that was already
  open rather than above it, which is what happens whenever a day's work lands
  while an earlier day's section is still the one being edited.
- **The proof it was real.** Reading the seven `## YYYY-MM-DD` headings in file
  order gave `2026-08-27, 2026-08-26, 2026-08-28, 2026-08-28, 2026-08-26,
  2026-08-25, 2026-08-25`. The third heading is newer than the two above it, so
  the stated contract was false at the third section of a seven-section file.
- **The fix.** The sections were reordered newest-first, ties keeping their
  existing relative order so the two 2026-08-28 entries stay in the sequence they
  landed (25 the routing record, then 24 the AUTOC seed). Nothing was reworded:
  a sorted-line comparison of the file before and after reports an identical line
  multiset, so only section order changed.
- **The test that now pins it.** `tests/test_fixes_order.mjs`, registered in
  `tests/run_tests.sh` and in the CI workflow. It asserts the section dates are
  non-increasing, that every `development/` link in the file resolves, and that
  no entry number is used twice. **Confirmed failing against the unfixed file**,
  where it reported `line 224: 2026-08-28 appears after an older section`. It
  also asserts the "Entries are newest first." sentence is still present, so the
  ordering check cannot be made to pass by deleting the claim it enforces --
  removing the sentence fails the suite instead, which forces the question.
- **Verified.** `./tests/run_tests.sh` -> **10 suites passed, 0 failed** on
  2026-08-28 against `docs/data/scenarios.json`, on the tree at this commit. The
  baseline it is compared against is the 9 suites passing before this change; the
  tenth is the new one. `README.md` was updated in the same pass from "nine
  suites" to ten and from "four node suites" to five, per the README-parity rule.

### 27. Three regenerable artifacts were untracked and unignored at once

- **What was wrong.** `.stale_constant_record.json`, `development/*.docx` and a
  `web/` directory sat in `git status` as untracked and matched no ignore rule,
  which is the one state that is neither tracked nor deliberately excluded. Each
  is committable by a single `git add -A`, and each would be wrong to commit:
  the attestation binds to a sha256 of `constant_registry.yaml` and reads as
  proof after the registry moves, the DOCX files are conversions of committed
  markdown that would let two copies of the same prose disagree, and `web/` is a
  superseded 2026-08-10 snapshot of an earlier build of the site that nothing
  references.
- **The proof it was real.** `git status --short` listed nine `??` entries across
  the three classes, and `git check-ignore -v` matched no rule for any of them.
- **The fix.** Ignore rules for all three, each carrying the reason it is
  excluded rather than the pattern alone.
- **The verification.** `git check-ignore -q` now matches all three; a clean
  `git status --short` shows only the files this change edits. `web/` is left on
  disk and is safe to delete; it is referenced by no script, workflow, test or
  document, which was checked by grep across `R/`, `tests/`, `*.md`, `*.yaml` and
  `*.sh`.

---

## 2026-08-28 (routing) · The audit record, checked by running it

**Moves published numbers: no.** `audit_manifest.yaml`, `FIXES.md` and
`development/` only. No R script, no `scenarios.json`, no figure is touched.

Verification environment for this pass: node v18.19.1, R 4.5.1, on 2026-08-28.

Reasoning, options considered and what was dismissed:
[`development/2026_08_28_audit-manifest-attestation.md`](development/2026_08_28_audit-manifest-attestation.md).

### 25. The routing manifest attested to a report it had not read

- **Moves published numbers: no.** `audit_manifest.yaml` only.
- **What was wrong.** The methods-audit entry's `completion.report_sha256` did not
  match the report it names. A content-bound attestation exists so a manifest
  cannot claim a review of text nobody reviewed; one that does not bind is worse
  than none, because it reads as proof. Two further defects in the same file: the
  header stated that the stale-constant audit "is NOT one of the gate's twelve",
  and the manifest carried no entry for it, so the gate was supplying the auditor
  itself and warning that it had nothing to execute.
- **The proof it was real.** `audit_gate.py --project .` reported
  `methods-audit: completion.report_sha256 is stale (the report changed since it
  was recorded)` and
  `stale-constant-audit ... [SUPPLIED BY GATE] FAIL: RUN executable auditor needs
  a typed run: block`. The recorded hash is
  `74a3573745af515f1f4223c98a5d01fbfdf3c8760356153ae5d09009baf94817`; the file
  hashes to `d2b472073db83eada7cea84406bcaf8b59fbb373e106e0930ab0524691e302b7`.
  The cause is recoverable rather than guessed: a pre-cleanup copy of the report
  hashes to exactly the recorded value and differs in the two lines the 2026-08-26
  em-dash cleanup edited. The hash was taken on 2026-08-25 and never re-taken.
  Both recorded *input* hashes still match, so the review was of the code that
  ships; only its report drifted.
- **The fix.** Hash re-taken, with a note in the file saying why it moved.
  `stale-constant-audit` recorded as a full entry with a typed `run:` block
  (project, registry, inputs), and the header corrected: it is the thirteenth
  routed auditor, which the gate enumerates and executes under `--release`.
- **The test that now pins it.** The gate itself, which is the point: this defect
  is invisible to prose review and was found only by running the tool the manifest
  exists to satisfy. Re-run after the fix, the two warnings are gone.
- **Verified.** `audit_gate.py --project .` no longer warns on either;
  `stale_constant_audit.py --project . --project-root . --strict` reports
  `REGISTRY (12 constants) STRICT, 0 errors, 0 warnings`, now resolved through the
  manifest rather than by hand; `sim_provenance.py validate` -> `registry OK`;
  `./tests/run_tests.sh` -> 9 suites passed, 0 failed (2026-08-28).
- **Not fixed, and deliberately.** The gate still routes five auditors the
  manifest marks N/A, because it reads `is_grant` from the word "resubmission" in
  a development record and `has_radiation` from the *titles* of the two cited
  papers. The only available fix is rewording a reference list until a keyword
  detector stops matching. Reasoning:
  [`development/2026_08_28_audit-manifest-attestation.md`](development/2026_08_28_audit-manifest-attestation.md).

---

## 2026-08-28 · The one number the pipeline could not reproduce

**Moves published numbers: YES, sixteen of them, in a field nothing reads.**
`docs/data/scenarios.json` changes in exactly 17 leaves out of roughly 1,900: the
16 `autoc.se` values that moved and the `generated` timestamp. All nine figures
are **byte-identical**. No average treatment effect, confidence interval, RMSE,
hazard ratio, PH p-value, standardized mean difference, overlap or shrinkage
diagnostic changes, and neither does the AUTOC point estimate.

Verification environment for this pass: R 4.5.1, `grf` 2.5.0, `survival` 3.8.3,
`jsonlite` 2.0.0, node v18.19.1, on 2026-08-28.

Reasoning, options considered and what was dismissed:
[`development/2026_08_28_autoc-bootstrap-seed.md`](development/2026_08_28_autoc-bootstrap-seed.md).

### 24. The shipped scenarios.json was not what the shipped code produces

- **Moves published numbers: YES**, as itemized above.
- **What was wrong.** `grf::rank_average_treatment_effect()` returns a
  deterministic point estimate and a standard error formed from `R = 200`
  half-sample bootstrap replicates drawn with R's **global** RNG. Every forest in
  `R/02_fit_methods.R` carries an explicit `seed =` and is therefore
  stream-independent; that one call was not. Any edit anywhere earlier in the run
  that drew a random number silently re-rolled every `autoc$se` in the exported
  grid, leaving the estimate, every other exported field and all nine figures
  untouched. The 2026-08-26 restructuring around the `DEMO_SOURCE_ONLY` guards
  was such an edit, and the grid was not regenerated after it, so the committed
  `scenarios.json` (stamped `2026-08-25 23:09`) predated the fit script beside it.
- **The proof it was real.** The whole pipeline was re-run from a clean extract of
  the committed tree and compared byte for byte: nine figures identical,
  `scenarios.json` differing in 20 leaves, every one of them `autoc.se`. The
  mechanism was then confirmed directly on one fixed forest, rather than inferred:
  the same RNG state gives `se=0.691754` twice, and an advanced stream gives
  `se=0.635089`, while `est=-0.851334` never moves.
- **Why no auditor caught it.** None of them compares a shipped artifact to a
  re-run. `pipeline-audit` asks whether outputs are fresher than the code,
  `manuscript-audit` whether quoted numbers match their source file,
  `stale-constant-audit` whether a hard-coded bound still describes its artifact.
  All three pass on an artifact the current code would no longer produce.
- **What it actually broke.** `autoc` is read by nothing: it appears in
  `docs/data/scenarios.json` and in no other file. No figure plots it, no card
  shows it, no test asserts it. What it broke is the claim `docs/index.html` makes
  to every visitor, that the numbers are "reproduced by the R pipeline at" this
  repository.
- **The fix.** `set.seed(FOREST_SEED)` immediately before the call, bringing the
  last stream-dependent number in the pipeline under the seed everything else
  already uses. The alternative of deleting the unused field was rejected:
  removing an output to make a reproducibility problem go away is the wrong
  instinct, and the statistic is named in the README as part of what
  `02_fit_methods.R` computes.
- **The test that now pins it.** Three assertions in
  `tests/test_source_guards.R`, and the guard was broken three ways and confirmed
  to report each: the seed removed (the original defect); the seed set but a
  `runif` draw placed between it and the call, which a naive "is `set.seed`
  present" check would pass; and `set.seed(42)` instead of `set.seed(FOREST_SEED)`.
- **Verified.** The defect was reproduced on demand and the fix shown to hold
  against it, end to end through `run_all.sh` on the subsample grid, using a
  simulated upstream edit of three extra `runif` draws:

  | build | `autoc.se`, both smoke scenarios |
  |:--|:--|
  | unfixed | 0.044, 0.040 |
  | unfixed + upstream edit | **0.046, 0.041** |
  | fixed | 0.044, 0.042 |
  | fixed + upstream edit | **0.044, 0.042** |

  Then the full 24-scenario pipeline (33 min, R 4.5.1): the regenerated tree
  differs from the committed one in `docs/data/scenarios.json` alone, and within
  it in 16 `autoc.se` values and the timestamp alone, with all nine figures
  byte-identical. `./tests/run_tests.sh` -> 9 suites passed, 0 failed against the
  regenerated export.
- **What is NOT claimed.** The fix is proven on the two-scenario smoke grid, where
  the defect was reproduced and then shown not to occur. It was not re-proven by a
  second full 24-scenario run, which would cost another 33 minutes to demonstrate
  a per-call property already demonstrated per call.

---

## 2026-08-27 (review) · A colleague's five comments

**Moves published numbers: no.** `docs/`, `README.md`, `tests/` and `.gitignore`
only. No R script, no `scenarios.json`, no figure and no registry entry is
touched, and all eight test suites pass. The reasoning, including the costing
that decided comment 1, is in
[`development/2026_08_27_site-review-comments.md`](development/2026_08_27_site-review-comments.md).

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

### 23. A defect recorded here did not exist: the instrument was wrong

- **Moves published numbers: no.** This entry withdraws a claim and adds a test.
  Nothing under `docs/` changes.
- **What was wrong.** The paragraph that stood here said "the page overflows its
  viewport horizontally below about 720 px, so a phone gets a sideways scroll",
  and put the figure at 22 clipped body rows at 620 px. Rewritten here, and in
  `development/2026_08_27_site-review-comments.md`, because it is false. The
  page fits every width tested. What was measured was a headless SCREENSHOT, and
  a screenshot is not a measurement of layout: Chrome on Windows will not open a
  window narrower than about 500 px, so `--window-size=420,H --screenshot` lays
  the page out at ~497 px and crops the image to 420. The crop looks exactly like
  a page overflowing its viewport, and reading it that way is how a defect that
  was never in the stylesheet came to be written into two records as measured
  fact.
- **The proof it was real.** Measured inside an iframe of the requested width --
  a real viewport at any size -- at 345, 405, 605, 705, 1009 and 1425 CSS px:
  zero elements whose right edge passes the viewport's, and
  `scrollWidth === clientWidth` at every one. The 420 px screenshot that produced
  the original claim reports `clientWidth = 497` when the page is asked for its
  own width, which is the artifact itself, visible in the instrument's own
  output.
- **The test that now pins it.** `tests/test_viewport_overflow.mjs`, a new suite
  measuring six widths in one browser launch. Because it asserts the ABSENCE of
  something, it carries its own negative control and runs it every time: a second
  iframe loads the same page with one deliberately 1600 px-wide element appended,
  and the suite fails if that does not report an overflow, rather than reporting
  a pass the measurement cannot support. Confirmed to fail against a mutated
  page: appending a 1600 px element to `docs/index.html` turned all twelve
  assertions red and exited 1. Confirmed to skip, not fail, with `CHROME` set to
  a path that does not exist.
- **Verified.** `./tests/run_tests.sh` -> 9 suites passed, 0 failed (2026-08-28),
  against a baseline of 8 before this entry. The new suite also runs in CI, along
  with the style contract added in entry 18, which CI had not been running.

### Known, pre-existing, not fixed here

Nothing outstanding from this pass. The one item previously recorded here was
the mobile-overflow claim, withdrawn in entry 23 above.

---

## 2026-08-26 (layout) · The cards moved out of the dead column

**Moves published numbers: no.** `docs/style.css` is the only file changed. No
data, figure, estimate or caption is touched, and all seven test suites pass
unchanged.

Reasoning, including the two alternatives rejected and why the decision was
revisited a day later:
[`development/2026_08_26_card-layout.md`](development/2026_08_26_card-layout.md).

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
