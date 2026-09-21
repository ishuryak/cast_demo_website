# 2026-09-21 · Repairing the tutorial variants (v2, v3, /oncology/)

## Request

Igor asked for a review and audit of the project and the live repository, noting
three published walkthroughs (`/tutorial/`, `/tutorial_v2/`, `/tutorial_v3/`)
that must all be kept and must not overwrite one another. v2 and v3 had
formatting and style problems. The stated goal for v3: **keep the original
walkthrough's structure and formatting, and add the oncologist clinical framing.**

## What the review found

Measured against the live site at `b48bbb4` and the local tree (identical).

| # | Finding | Evidence | Acted on |
|---|---|---|---|
| 1 | v3 was assembled from the methods page (`docs/index.html`), not the walkthrough, and linked the methods page's `style.css` | `docs/tutorial_v3/style.css` byte-identical to `docs/style.css`, live render showed the blue gradient banner and unstyled walkthrough markup | yes |
| 2 | v3's interactive chart could not load | `app.mjs` fetched `data/scenarios.json`, `b48bbb4` deleted it, live URL returned 404 | yes |
| 3 | v3 embedded ~500 lines of the methods page whose script (`app.js`) was never loaded, so every control, the figure and every card rendered empty | live screenshot, `index.html` loaded only `app.mjs`, `narrative.mjs`, `profile-illustration.mjs` | yes |
| 4 | v3 HTML malformed | two `<main>` open, one close, two chapter navs, three sections duplicated, 11 duplicated ids | yes |
| 5 | v3 scrolled sideways at every width from 705 px | `test_viewport_overflow.mjs docs/tutorial_v3`: 12 failures, widest element a 2078 px `IMG` | yes |
| 6 | v2 header links one directory too high, and one to a page that never existed | `../../`, `../../clinical/`, `../../tutorial/` | yes |
| 7 | `docs/oncology/` was a byte-identical live copy of v2 | `diff -r` empty | yes (redirect) |
| 8 | v2 card layout: unit text wrapping beside a large number at its line height, a lone seventh card | live screenshot | yes |
| 9 | CI tested neither v2 nor v3, so a broken v3 deployed green | `tests.yml` covered `docs/` and `docs/tutorial/` only | yes |
| 10 | v2 content | read in full, the tuning statement agrees with `R/02_fit_methods.R`, coverage figures are computed in the browser from `scenarios.json`, not typed | no change needed |
| 11 | Strict stale-constant audit reports 5 errors | the sweep counts literals such as `2000` once per copied class-kit `R/01_simulate.R`, pre-existing with `docs/tutorial/`, one more copy via v3 | **not acted on**: registry decision left to Igor |
| 12 | Routing gate draft advisories (tough-reviewer "it is a grant", radiation-oncology-reviewer) | `audit_gate.py --project .` | **not acted on**: tough-reviewer looks like a false fact detection for a teaching site |

## Decisions (Igor, 2026-09-21)

Asked as one round, with a recommendation on each:

1. **v3 framing depth.** Options: a clinical layer on the walkthrough's own text
   (recommended), or a full Option A / Option B relabel like v2. **Chosen: clinical
   layer.** Reason for the recommendation: the hand-drawn art says "treatment" and
   "Alt. Hector" and cannot be relabeled, so a full relabel would contradict its
   own illustrations.
2. **`/oncology/`.** Options: redirect to v2 (recommended), delete, leave.
   **Chosen: redirect**, so any link already shared keeps working.
3. **v2 look.** Options: keep its dashboard design (recommended), or restyle to
   the walkthrough. **Chosen: keep.** Only v3 was asked to match the walkthrough.
4. **Delivery.** Options: branch + PR (recommended), commit to main, local only.
   **Chosen: commit to main.**

## Design of the v3 rebuild

v3 is now **generated**, not hand-edited: `scripts/build-tutorial-v3.mjs` copies
the built walkthrough (`docs/tutorial/`) and applies 14 anchored insertions to its
`index.html`, each of which must match exactly once or the build stops. It adds one
file, `clinical.css`, for the asides. `npm run build:pages` rebuilds it
immediately after the walkthrough, and CI's existing `git diff --exit-code` step
now covers `docs/tutorial_v3`, so a walkthrough change that is not carried into v3
fails CI rather than drifting silently. The alternative, a hand-maintained copy,
is what produced findings 1 to 5.

The clinical layer: a "Clinician or oncologist" reader path (first of five), a
short hero note, and five "In the clinic" asides:

- two active options, and the number-needed-to-treat reading of a percentage-point difference (chapter 01)
- confounding by indication (worked example)
- reading the curve at a chosen horizon, crossing curves, and why one hazard ratio fails (chapter 03)
- the patient in front of you versus a cohort average (chapter 04)
- three questions to ask of a registry, with a link to v2 (chapter 05)

No chapter heading, section, script, stylesheet or data file of the walkthrough changes, and the new test asserts it.

## Not changed

`docs/tutorial/` (rebuilt, byte-identical), the methods page, any R script,
`scenarios.json`, any figure, any registry file. v2's text is unchanged apart
from its header links and two source comments.
