# One path through the walkthrough

October 27, 2026. Structural revision of the teaching site after Alex Steele's
review of October 24, discussed with Igor Shuryak and Aimee Harrison.

## What the review found

Alex read the three editions as a newcomer to the field and reported six things:
the flow between the three pages was unclear (the story and the clinical
walkthrough repeated most of their text, the two-option comparison held the
context but sat in the middle, no page was obviously the landing page, and
advancing meant scrolling back to the top); there was no preface saying who the
site is for, what problem it addresses and how to use it; the audience read as
advanced students, neither clearly clinicians nor researchers; the level of
expertise was unstated and technical words were hard to tell from everyday
ones; the narrative devices (Hector, the spells and armor, the sketches) did
not go far enough to carry the ideas; and there was no conclusion.

## What explained it

Four pages existed, not three. The root methods page already held a
plain-language preface, and no tutorial linked to it. `/tutorial_v3/` was
generated from `/tutorial/` plus five asides, so the repetition was by
construction. Three pages carried three different audience pickers with three
different option sets. Navigation sat at the top of each page only. Two
build-time rewriting layers (`clinical/quiet-narrative.mjs` and the transforms
in `scripts/build-clinical-editions.mjs`) meant the published story page had no
visible chapter structure although its source did.

## What changed

- `tutorial/index.html` is now the single source of what `/tutorial/`
  publishes. The reviewed wording the two rewriting layers produced is written
  into it directly; the layers and `scripts/build-tutorial-v3.mjs` are gone.
- The walkthrough is one path with a chapter strip, numbered chapters and a
  "next" link at the end of each: Start here (who it is for, what the reader
  will be able to do, three ways through, what this is not, the path, one
  audience picker with four audiences); 1 Hector and Bob; 2 Option A or Option
  B? (the existing comparison page, now with the same strip and chapter links,
  and without its own picker); 3 Read it like a clinician (the five clinical
  notes, with their reviewed wording unchanged, now visible rather than
  collapsed asides, plus a lead paragraph on how a method question changes
  clinical practice); 4 Where the method sits (the comparison, the interactive
  study and coverage table, heterogeneity, the longitudinal question, the
  roadmap); 5 Teach it (the kit, with a 45-minute class sequence); 6 Where this
  leaves you (five takeaways, what the site does not establish, next steps).
- Hector and Bob open chapter 1. The vignette is built from the simulation's
  own confounders (age, stage, performance status, comorbidity count), two
  abstract options, and the chapter 2 cohort's numbers (observed +32 per 100 at
  36 months against a true +16, and a true reversal by 84 months). It replaces
  the spells-and-armor passage; the two profiles in the heterogeneity section
  are now read as Hector and Bob. The clinical realism of the vignette is
  Igor's to edit.
- The root methods page links to the walkthrough from its header and footer,
  and the walkthrough links back from Start here, chapter 4 and chapter 6.
- `/tutorial_v3/`, `/clinical/` and `/oncology/` are redirects that land inside
  the path. The duplicated walkthrough files under `docs/tutorial_v3/` are
  removed.
- `tutorial/app.mjs` now carries the two behaviors the clinical build used to
  patch in: the hidden-confounding caption, and showing the CAST fit and the
  simulated truth by default unless the shared link says otherwise.

## What did not change

No number, claim boundary, figure, dataset, R file, class-kit file or
validation record. The counterfactual thought experiment, the coverage table
and the 84-month caveat are byte-for-byte the same text. The audit manifest
pins none of the files touched.

## Verification

`npm test` (walkthrough suites), `npm run test:clinical`,
`node tests/test_tutorial_variants.mjs docs` (extended: cross-page anchors,
seven chapters on both strips, one picker, the five clinical readings once, and
the redirect), `node tests/test_intro_contract.mjs`, `node tests/test_fixes_order.mjs`,
`node tests/test_repo_hygiene.mjs`, and a render of both pages at phone and
desktop widths.

## Still to do (later phases)

A glossary with first-use definitions and flags on words used technically that
also have everyday meanings; Igor's clinical pass on Hector and Bob; the class
kit slides reordered to the chapter sequence; the review round.
