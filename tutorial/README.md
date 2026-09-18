# CAST learning tutorial

The teaching interface for Igor Shuryak's CAST demo. Source lives in `tutorial/`; the complete public build is tracked in `docs/tutorial/` on `main`. GitHub Pages serves it alongside the existing methods and diagnostics page. The R code and frozen data are preserved.

[Open the walkthrough on GitHub Pages](https://ishuryak.github.io/cast_demo_website/tutorial/).

```powershell
cd tutorial
npm run dev
# http://127.0.0.1:4173

npm test
Rscript tests/exercise.test.R
npm run build
```

No npm dependencies or installation step are required. Node 20+ serves and builds the page. The tutorial build writes `tutorial/dist/`, which is gitignored. It copies an explicit allowlist and validates the frozen export's SHA-256. From the repository root, `npm run build:pages` stages the same output in `docs/tutorial/`. GitHub Pages publishes `main:/docs`, so committing and pushing that output to `main` publishes the walkthrough. `npm run build` remains available for a portable static build in root `dist/`.

For manual wording changes, see [the editing guide](../design/COPY_EDITING.md). Edit `tutorial/index.html`, then run `npm test` and `npm run build:pages` from the repository root. Commit the source and generated `docs/tutorial/` changes together and push `main`. GitHub's checks rebuild the walkthrough and reject stale published files. Local notes and lab outputs are excluded from the build.

## This milestone

- Andy's original Hector sketch, Igor's simulation attribution, a white background and compact chapter navigation.
- A missing-counterfactual lesson and an optional thought experiment with two completions of identical observed records.
- A guided narrative and five selectable follow-up horizons, with deeper methods linked to the CAST repository.
- All 24 existing scenarios with measured/hidden confounding controls.
- Optional CAST fit and pointwise band, known-truth diamonds, and unadjusted comparison.
- Play/pause with reduced-motion support, shareable query-state links and an accessible value table.
- Five responsive animated scenes with readable labels separated from the drawings.
- An educator class kit: runnable code, a 600-person synthetic cohort, an answer key, frozen aggregate CSVs, a study guide and 12 draft slides. Documents include editable LaTeX and compiled PDFs.
- Data provenance and source links pinned to the baseline commit.

The story progresses from a missing individual counterfactual to averages at one horizon, changes over time and differences across profiles, then estimation within the causal roadmap. The frozen export has no subgroup estimates. The class guide develops the estimands, assumptions, equations and vocabulary.

## Updating the class kit

Edit `class-kit/study-guide.tex` or `class-kit/slides.tex`, compile twice with
`pdflatex`, and keep compiler intermediates in `labs/output/`. Inspect the PDFs
before replacing the two final PDFs in `class-kit/`. Then run `npm run build`.
The build regenerates the aggregate CSV and ZIP from an explicit file list,
records content hashes and includes the kit in the static output. It requires
no ZIP library or network connection.

From the repository root, `Rscript tutorial/scripts/prepare-class-kit.R`
regenerates the supplied 600-person cohort and its separate oracle averages.
If the generation environment changes, update its R version in
`scripts/package-class-kit.mjs` before rebuilding the archive.
The bundled `R/` files are unchanged copies of Igor's pinned simulation and
CAST source; the build checks them against the original local files. Follow
`class-kit/README.md` to analyze that cohort or generate a different one.

## Editing the tutorial

Most copy is in `index.html`; dynamic chart commentary is in `app.mjs`.
`narrative.mjs` controls the counterfactual exercise and optional animation;
`narrative.css` contains their layout styles. Animation captions and scene
geometry live in `assets/art/fundamentals.html`. Save and refresh the local
preview; edit source files, not generated `dist/` files.

## Parallel art work

Read `design/COLLABORATION.md` for ownership and active handoffs. Andy's original
`assets/art/hector-counterfactual.png` is integrated in the HTML with accessible
explanation and a full-size link. It is a conceptual drawing, not patient data.
The optional replacement manifest currently leaves that default in place:

```json
{"hero":null,"followUp":null}
```

Optional replacement paths resolve inside the art directory. Failed replacement
loads preserve the default artwork. Coordinate asset and caption changes together.

## Attribution and data

Original simulation and CAST implementation: Igor Shuryak, MIT. See `LICENSE`, `data/provenance.json`, and the repository's `CITATION.cff`. `data/scenarios.json` is an exact copy of the current published aggregate export. The build verifies its hash rather than regenerating it.

The comprehensive design is stored locally at `design/CAST_TUTORIAL_DESIGN.local.md` and intentionally ignored. GitHub Pages is the publishing destination; the earlier Sites mirror is not part of this release workflow.
