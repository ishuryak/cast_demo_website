# A reader-first introduction, and cards that open from their own titles

Requested by Igor Shuryak on 2026-08-29:

> the main issue with it is that the website has no introduction that explains
> to a non causal inference specialist (for example, a clinician, or a scientist
> in a different field) what the problem being studied actually is [...] what is
> the goal of this demo? how is it supposed to help clinicians and researchers?
> what type of data is it meant to analyze and what is it meant to deliver? what
> problems does this overcome that standard more familiar methods don't address
> as well? what is each method here and why are they used? this should not be
> very long, but to the point and layman-friendly. this is the most important
> big picture message. the technical detail cards can be opened by clicking on
> their titles and the details will then be shown maybe as popups, so not to
> overwhelm the reader.

---

## The finding, stated as the reader meets it

Before this change the page opened, under a heading reading "From confounding to
trajectories", with a subtitle naming a Causal Survival Forest and a
treatment-effect trajectory, and then five lead paragraphs whose second one read:

> We estimate the between-group difference in the probability of surviving past
> each fixed time horizon, i.e. the **survival-probability difference**, formally
> P(T>t | treated) − P(T>t | control).

Every one of those sentences is accurate, and entry 21 in `FIXES.md` had already
rewritten this block once, on 2026-08-27, to put the plain statement of each idea
ahead of its formal one. That fix was real and it is not withdrawn here. But it
operated *inside* a block that assumes the reader already accepts the framing.
It never asked the prior question: why should a clinician, or a radiation
biologist, or a health-services researcher care about any of this, and what would
they do with it?

The gap this leaves is not one of accuracy. It is that a reader outside causal
inference cannot decide from the top of the page whether the page is for them.
That is the property the global reader-first rule calls requirement 7, "a
non-specialist in the SPECIFIC AREA must be able to follow the main message",
and it is the one no test on this repository was checking.

## Why no existing check could see it

Recorded here because the same blind spot will recur. At the time of the request
the repository ran ten green suites:

| Suite | What it proves | Why it is blind to this |
|:--|:--|:--|
| `test_data_contract.mjs` | every field the site reads exists | says nothing about prose |
| `test_render_smoke.mjs` | `app.js` runs at all 24 control settings | ditto |
| `test_style_contract.mjs` | the CSS can size what the markup sizes | ditto |
| `test_viewport_overflow.mjs` | the page fits a phone | ditto |
| `test_fixes_order.mjs` | the evidence record matches its own claim | ditto |
| the five R suites | the numbers are right | ditto |

Correctness and legibility are different properties. The whole suite can be green
on a page nobody outside the field can read, and it was. The fix therefore had to
include a test, or the next edit would drift straight back.

## What was decided, and by whom

Two design questions were put to Igor before any file was touched, because both
had defensible alternatives and the choice changes the work:

1. **How the technical detail opens.** Options offered: a modal popup on the card
   title (closest to the literal request, "maybe as popups"), expansion in place
   on the title, or a popup for the long prose only with the bullets left on the
   card face. **Igor chose expansion in place** (2026-08-29). The consequence is
   that no JavaScript is added: the card becomes a native `<details>` whose
   `<summary>` is its own title, which stays keyboard-reachable, is announced by
   screen readers, works with JavaScript off, and is still found by the browser's
   in-page search when closed. A modal would have needed a dialog, focus
   trapping, and a scroll lock, and would have taken the card's text out of reach
   of in-page search. The request's "maybe" is what left this open.
2. **Where the existing technical lead goes.** Options offered: fold it behind a
   disclosure, merge it into a longer visible introduction, or move it below the
   figure. **Igor chose folding it** (2026-08-29). The consequence is that not one
   word of the reviewed 2026-08-27 lead is deleted. It moves, unchanged, inside
   `<details class="lead-detail">` under the summary "The simulated cohorts in
   detail", so the precision is one click away rather than in front of the
   reader. This is what `test_intro_contract.mjs` check 5 pins.

## What the introduction says, and why it is shaped that way

Five questions were asked and the section answers them in the order a reader
needs rather than the order they were asked:

- A lead paragraph states the problem itself, with **confounding** defined in the
  sentence that first uses it rather than assumed. Nothing else in the
  introduction requires a term a clinician does not already have.
- Four blocks, laid out 2x2: what the demo is for, what it analyzes and what it
  delivers, why the familiar tools fall short, and what no method can fix. The
  fourth is there because a demo that only shows its own method winning is an
  advertisement, and this one already had the honesty to show the
  unmeasured-confounding failure. The introduction should not hide that.
- A glossary of the methods on the figure, one entry each, in plain words: what
  it is, and why it is on the page. Cox regression's entry says explicitly that
  it is a fair benchmark rather than a straw man, since on the plateau shape the
  simulation is itself a proportional-hazards model, which is the point a
  skeptical reader would otherwise reach on their own and hold against the page.

It runs to 796 words, against a 900-word cap the test enforces. The cap exists
because the block it replaces grew to a wall of text once already.

The header subtitle was rewritten in the same pass, from a sentence naming a
Causal Survival Forest and a treatment-effect trajectory to the question the
demo actually answers. It is the first line on the page, so leaving it in the
old register would have undone the change three inches above it.

## The defect introduced and caught during the work

Worth recording because it is the second time this exact shape of bug has
appeared in this stylesheet, and because it is evidence the viewport suite earns
its place.

The four introduction blocks were first laid out as
`repeat(auto-fit, minmax(18rem, 1fr))`. At the 1132 px content width that gives
three columns and strands the fourth alone on a second row with two empty columns
beside it, which is precisely the dead space the card grid was rebuilt to remove
in the 2026-08-26 layout entry. Widening the minimum to `24rem` fixed the desktop
layout and broke the phone: `auto-fit` never shrinks a track below its stated
minimum, so a 384 px column plus padding forced a 408 px element into a 345 px
viewport and pushed the whole page sideways.

`tests/test_viewport_overflow.mjs` failed on the next run with
`first: 408px DIV.intro-block` at both 345 px and 405 px. The fix is
`minmax(min(24rem, 100%), 1fr)`, which lets the track collapse on a narrow
screen while still admitting exactly two columns at desktop width. The comment in
`style.css` records the reason so the `min()` is not tidied away later.

Two lessons, both already encoded elsewhere in this repository and both worth
restating: a layout change is not verified by looking at it at one width, and a
suite that asserts an absence needs its negative control, which is why this one
carries one and passes it on every run.

## The findings investigated and NOT acted on

Recorded so the next pass does not reopen them.

- **The `story` section (five numbered steps) and `failure-modes` section (seven
  items) were left alone.** They sit below the figure, a reader reaches them only
  after engaging with it, and they are written for someone who has already
  accepted the framing. The complaint was about the entry point, not about the
  depth further down. Collapsing them was considered and rejected: it would have
  hidden the page's most honest content behind clicks nobody would make.
- **The bullets were not removed from the card faces.** With the whole card now
  collapsed, the bullets sit inside the disclosure alongside the prose, so the
  closed face carries the title and the live numbers only. Keeping the bullets
  visible was considered, and rejected because it would have left the cards at
  most of their old height and defeated the point.
- **No modal, no popup library, no JavaScript was added to the page.** See the
  decision above.
- **The nested `<details class="more">` was removed rather than kept.** Leaving it
  in place would have meant two clicks to reach one card's explanation.
- **`docs/data/scenarios.json`, every R script, `constant_registry.yaml`,
  `sim_provenance.yaml` and `evidence_ledger.yaml` are untouched.** This change
  moves no number. The figures, the tables and every quantity on the page are
  bit-identical to the previous commit, which is asserted in the `FIXES.md` entry
  on its first line.

## Verification

- `./tests/run_tests.sh` -> **11 suites passed, 0 failed**, on 2026-08-29. The
  baseline is the 10 suites passing before this change; the eleventh is
  `test_intro_contract.mjs`.
- Thirteen mutations were run against the new and amended checks, and **each was
  confirmed to fail the suite that is supposed to catch it**: the introduction
  moved below the controls; a specialist term ("estimand") inserted into it; one
  of the four blocks deleted; a method added to `app.js` with no introduction
  line; the technical lead deleted rather than folded; the introduction grown
  past the word cap; a live value moved out of a card's summary; a `<p>` put back
  inside a summary, which its content model forbids; a second disclosure nested
  in a card; a card title demoted out of its summary; a card's prose deleted
  rather than collapsed; and `display: block` removed from `.hint` and from
  `.rmse-bars`, which is what turns a card face into one run of inline text.
- Rendered headless at 1440 px and read back, closed and with two cards forced
  open, plus the six widths the viewport suite measures.

## Costs

Measured in a 1440 px viewport by reading the elements' own
`getBoundingClientRect()` back through the same one-load iframe harness
`tests/test_viewport_overflow.mjs` uses, rather than estimated off a screenshot:

| | before | after |
|:--|--:|--:|
| height of the `.cards` block | 912 px | 450 px |
| visible text on the whole page | 2024 words | 2200 words |

- The card block is **51% shorter** with every word still on the page, one click
  away instead of on the face.
- The introduction adds 796 words, but the net change in visible text is only
  +176, because folding the technical lead and the card bullets removes most of
  what it adds. That is a better trade than the request asked for: a reader who
  wants the figure scrolls past the introduction once, and a reader who does not
  yet know whether the page is for them can find out without scrolling at all.
- An earlier draft of this record claimed "roughly two screens" before and "about
  400 px" after. Both were eyeballed off a screenshot and both were wrong, which
  is why the numbers above were measured before this file was committed.
