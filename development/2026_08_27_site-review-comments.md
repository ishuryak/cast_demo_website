# Review of the CAST demo site by a colleague, 2026-08-27

Source: the reviewer's own comments document (five comments, one with a screenshot).
The document is an internal editorial note and is gitignored, so it is
transcribed in full below and the plan is keyed to the transcription.

Reviewer: a colleague. Plan written and executed 2026-08-27 by Igor Shuryak.

---

## The comments, verbatim

1. "Measured and unmeasured confounding appear as sliders, but there are only
   discrete values selectable (3 for unmeasured, 4 for measured). Suggest either
   switching to radio buttons or putting at least 50 values on each slider like
   `seq(0,2, length.out=50)` in Rshiny."
2. "Two sentences in the intro that read like AI:
   - 'The reversal is a stylized teaching curve, not an empirical one.' (This
     sentence is also somewhat confusing, since it implies that the plateau curve
     may be empirical. But earlier the text states that they are both simulated)
   - '...which estimators recover the truth, and which cannot.'"
3. "In general I think there is some room for improvement in the intro text.
   Currently, the easier-to-read descriptions appear in parentheses after an
   extremely formal statement. I would lead with the colloquial,
   easy-to-understand phrase, then make more precise afterwards. Typically, the
   fewer parentheticals one needs to use, the easier it is to read." With a
   worked example: the estimand sentence should read "We estimate the
   between-group difference in probability of surviving past each fixed time
   horizon, i.e. the **survival-probability difference,** formally
   P(T>t | treated) - P(T>t | control)."
4. "These blue bars do not appear to change no matter how much measured or
   unmeasured confounding is set" (screenshot of the RMSE card).
5. "The cards at the bottom are a bit difficult to follow, since it's not clear
   if there is an order in which they should be read -- also each one contains
   quite a bit of text. Perhaps some sort of grouping might be helpful. It might
   also be helpful if initially each card just had the concept with a **brief**
   description of what the concept is in the model, in bullet points, and then if
   you click the card it expands to show the full description."

---

## Comment 4 first: it is a real bug, and not the one reported

The reviewer read the symptom as "the bars do not respond to the sliders". The
numbers beside the bars **do** respond (0.251 for Naive against 0.081 for Cox in
his own screenshot). What does not respond is that **the bars were never drawn at
all**, in any state, since the card was written.

`docs/app.js:222` emits `<span class="rmse-track"><span class="rmse-fill"
style="width:NN%"></span></span>`, and `docs/style.css:85-86` styles the fill
with `height: 100%` and a background color. `.rmse-track` is a direct child of
`.rmse-row`, which is `display: grid`, so the track is blockified by the grid and
its `height: 14px` applies. `.rmse-fill` is a child of the track, which is a
plain block, so the fill stays a **non-replaced inline element**, and CSS 2.1
10.3.1 / 10.6.1 say `width` and `height` do not apply to those. The fill
therefore renders as a zero-height inline box with no content, and every row
shows the empty grey rail the screenshot captured.

Why no auditor caught it: `tests/test_render_smoke.mjs:113` asserts each row's
markup contains `rmse-fill`, which it does. The defect lives entirely in whether
CSS lets that markup take a size, which no existing test looks at.

**Fix.** `.rmse-fill { display: block; }`, plus `min-width: 2px` so a method whose
RMSE rounds near zero still shows a sliver rather than nothing.

**Test.** New `tests/test_style_contract.mjs`, asserting that any rule which sizes
an element with a percentage width also gives it a non-inline `display`. To be
confirmed failing against the unfixed `style.css` before it is trusted.

---

## Comment 1: the controls become segmented buttons, not a 50-step slider

The two options the reviewer offers are not equal cost here, because this is a
**static site over a precomputed grid**, not a live Shiny app. Every panel is a
separately simulated cohort with six fitted estimators, exported to
`docs/data/scenarios.json`. `seq(0, 2, length.out = 50)` is not a slider setting;
it is 50x more simulation.

Measured from `logs/full_run.log`: the full pipeline ran 24 scenarios
(2 shapes x 4 measured x 3 unmeasured) in 7 min 32 s, about 19 s per scenario.

| Option | Scenarios | Pipeline time | `scenarios.json` | Published numbers move? |
|:--|--:|--:|--:|:--|
| 50 steps on the measured axis only | 300 | ~1 h 35 m | ~0.9 MB | yes, all of them |
| 50 steps on both axes, as asked | 5000 | ~26 h | ~16 MB | yes, all of them |
| **Segmented buttons over the existing grid** | **24** | **none** | **76 KB** | **no** |

The 5000-scenario version also has to be fetched in full by every visitor before
the first paint, on a GitHub Pages site with no server-side selection.

**Decision (Igor Shuryak, 2026-08-27): segmented buttons**, which is the
reviewer's own first option. It removes the false affordance completely rather
than diluting it: a control with four positions now looks like a control with
four positions. It touches no number, so no figure, README value, evidence-ledger
entry or constant-registry entry goes stale.

Implemented as real `<input type="radio">` elements styled to match the existing
effect-shape selector, so arrow-key navigation and screen-reader semantics come
from the platform rather than from ARIA attributes that have to be maintained.
The gamma value stays visible in the control's own label, so nothing that was
readable off the slider is lost.

---

## Comments 2 and 3: the intro is rewritten plain-first

Both flagged sentences go, and the paragraph structure changes to the order the
reviewer asks for: colloquial first, precise second, parentheses only for a short
gloss naming a term.

- The estimand sentence is replaced with the reviewer's own wording.
- "The reversal is a stylized teaching curve, not an empirical one" is replaced
  by text that resolves the confusion he identifies: the new shapes paragraph
  opens by saying both shapes are simulated, and then says what "stylized"
  actually meant, i.e. that the reversal is drawn sharper than most real
  crossings so each estimator's response to it is visible.
- "...to see which estimators recover the truth, and which cannot" becomes a
  plain instruction to the reader.
- The single 300-word lead paragraph becomes five short ones.

Ripples, both carrying the same flagged sentence:

- `docs/app.js:27`, the reversal hover tooltip. Same sentence, same confusion.
- `README.md:43`. The README-parity rule requires the repository's description to
  agree with the site.

---

## Comment 5: the cards are grouped, and the prose is collapsed

Seven cards currently sit in a CSS multi-column flow with no headings. Multi-column
does read top-to-bottom then across, so there **is** an order, but nothing on the
page says so, which is the reviewer's point.

Four numbered groups, in the order the story section already tells:

1. **Is this cohort confounded?** confounder imbalance, propensity overlap
2. **How close is each method to the truth?** accuracy vs. truth, Cox baseline
3. **What adjustment cannot reach** unmeasured confounding
4. **Inside the CAST layer** CAST trajectory, Ledoit-Wolf shrinkage

Each card keeps its live numbers visible, gains two or three brief bullets saying
what the concept is in this model, and moves its long static prose behind a
`<details>` disclosure. `<details>`/`<summary>` rather than a click handler on the
whole card: it is keyboard-reachable, screen-reader-announced, survives with
JavaScript disabled, and is found by the browser's own in-page search when
closed. No explanatory text is deleted; all of it moves.

The layout returns to a grid. The 2026-08-26 change chose multi-column precisely
because the cards differed several-fold in height and a grid would align row
heights and reopen the dead space. Collapsing the prose removes that height
spread, so a grid of four group columns is now the better fit, and it is what
lets the group headings stay attached to their cards (a multi-column flow can
break a heading away from the card beneath it).

---

## Files touched

| File | Comments |
|:--|:--|
| `docs/index.html` | 1, 2, 3, 5 |
| `docs/app.js` | 1, 2 (tooltip ripple) |
| `docs/style.css` | 1, 4, 5 |
| `README.md` | 1 (slider wording), 2 (ripple) |
| `tests/test_style_contract.mjs` | 4 (new suite) |
| `tests/test_render_smoke.mjs` | 1 (drive the new controls), 5 (markup contract) |
| `tests/run_tests.sh` | registers the new suite |
| `.gitignore` | the reviewer's DOCX is an internal editorial note |
| `FIXES.md` | one row per landed change |

No R script, no `scenarios.json`, no figure and no registry file is touched, so
no published number moves.

---

## Execution record

Executed 2026-08-27. Nothing is pushed; the branch is left for review.

### What landed, per comment

| Comment | Landed as |
|:--|:--|
| 1 sliders | Four and three radio options per axis, styled as the existing segmented control |
| 2 AI-sounding sentences | Both rewritten, plus the same sentence in the `app.js` tooltip and in `README.md` |
| 3 intro readability | One 300-word paragraph split into five, plain statement first |
| 4 blue bars | `.rmse-fill { display: block }`; the bars had never rendered in any state |
| 5 cards | Four numbered groups; brief bullets visible, full prose behind `<details>` |

### Two defects found while verifying, neither reported

- **The measured axis rendered γ as Γ.** `.ctrl label` carries
  `text-transform: uppercase`, which uppercased the symbol along with the label,
  so both controls read "Γ = 0" and the measured axis was displaying the
  unmeasured axis's symbol. Pre-existing: the old label read "none (γ = 0)" and
  uppercased identically, but the word carried the meaning so nobody looked at
  the symbol. Fixed here because the new control makes the symbol the only
  content of that label.
- **The Cox hazard ratio wrapped mid-interval** once the card columns narrowed,
  splitting "(0.478-" from "0.593)". The interval moved to its own line.

### Tests, and the mutation that proves each one works

A check that has only ever been seen passing is not known to be a check, so each
new assertion was broken on purpose and confirmed to report the failure.

| # | Mutation | Reported |
|:--|:--|:--|
| M1 | `.seg input` styling removed | radio options would render unstyled |
| M2 | `.rmse-fill { display: block }` removed (the original defect) | percentage-sized element left inline |
| M3 | control emits only the first option | 1 option, expected 4 |
| M4 | option `onchange` never wired | option 0 has no onchange handler |
| M5 | a card loses its brief bullets | `#card-balance` opens as a wall of text |
| M6 | a live value moved inside the disclosure | `#overlap-text` hidden inside the disclosure |
| M7 | a range input reinstated in the markup | a confounding range input is back |
| M8 | a group heading demoted to `<p>` | card group 1 has no heading |

Test-category triage for this change: **unit** N/A (no new pure function beyond
`buildLevels`, covered end-to-end); **integration / smoke / regression** RUN
(`test_render_smoke.mjs` drives all 24 combinations through the real handlers);
**contract** RUN (`test_style_contract.mjs` for the CSS-to-markup contract, plus
the existing data contract); **end-to-end** RUN (headless Chrome against the
served site at five widths); **visual** RUN (every render read back with the
multimodal reader); **acceptance** N/A (nothing is deployed by this change);
**adversarial / containment** N/A (no path resolution, no untrusted input, the
page reads one same-origin JSON); **performance / resource** N/A (no pipeline
run; the exported payload is unchanged at 76 KB).

### Verification

- `./tests/run_tests.sh` -> **8 suites passed, 0 failed** (2026-08-27), against
  the committed `docs/data/scenarios.json`. Was 7 suites before; the eighth is
  the new style contract.
- Headless Chrome renders at 1920, 1440, 1280, 820 and 420 px, each read back and
  compared to what the page claims.
- Word-level diff of the card block before and after: insertions only (headings,
  bullets, disclosure summaries) plus the two intentional "slider" wording
  ripples. No explanatory sentence was dropped.
- `grep` for the two flagged sentences across `docs/`, `README.md`, `R/` and
  `tests/`: no hits.
- No R script, `scenarios.json`, figure, `sim_provenance.yaml`,
  `constant_registry.yaml`, `evidence_ledger.yaml` or `audit_manifest.yaml` was
  touched, so no published number moves and no registry goes stale.

### Not fixed, and why

The page overflows its viewport horizontally below about 720 px. Measured at 620,
720 and 820 px against both the pre-change build at `HEAD` and the post-change
build: identical in both (22 body rows reach the right edge at 620 px, 0 at
720 px). Pre-existing, outside the five comments, and left for a separate pass
rather than folded into a review response.
