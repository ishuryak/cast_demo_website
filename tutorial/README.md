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

## Reproduce the propensity comparison

From the repository root on macOS, Windows or Linux:

```sh
Rscript -e 'install.packages(c("survival", "grf", "SuperLearner", "glmnet", "ranger"), repos="https://cloud.r-project.org")'
Rscript tutorial/scripts/class-lab-propensity-study.R output/propensity-study 300 4
```

The last two arguments are the number of independent cohorts and worker processes.
Use `1` worker for a serial run; parallel runs use Windows-compatible PSOCK workers.
An optional fourth argument sets the tree count (default 300); use a separate
output directory for a quick check with `2 2 100`.

The study redraws the class-lab design: 600 people, reversal effect, measured
confounding strength 1 and no hidden confounding. Forest, logistic and Super Learner
use the same cohort at each replicate and the actual `analyze_demo()` implementation.
There are five horizons per arm. Cohort seeds are 20260906 through 20261205 for the
300-cohort run; estimation uses seed 20260905. The shipped cohort is excluded.

Rerun the same command after interruption. Completed cohort files are validated
and retained; partial files never count as checkpoints. The runner rejects changes
to the settings, source hashes, R/platform or recorded package versions. Use a new
output directory on a different environment rather than mixing results. Changing
the worker count is permitted. Cross-platform execution is supported; identical
last-bit decimals across environments are not assumed.

Outputs include `config.txt`, `config.rds`, `run-info.txt`, individual aggregate
replicate checkpoints, `replicate-results.csv`, and `summary.csv`. The summary
reports bias, RMSE, interval coverage, Monte Carlo standard errors, interval width
and warning counts for CSF and CAST separately. All quantities are probability
differences; multiply bias and width by 100 for percentage points. Warnings are
captured in the replicate CSV, not discarded. No individual synthetic records
are retained. The study uses a correctly specified logistic treatment generator;
it does not establish performance under nonlinear or misspecified assignment.

Run `Rscript tutorial/tests/propensity-study.test.R` to check serial/parallel
agreement, interruption/resume, invalid checkpoints and summary arithmetic.
GitHub CI runs it on Linux, macOS and Windows. The October 19 study is a new
recreation; it must not be presented as the recovered October 1 experiment.

## Editing the tutorial

Most copy is in `index.html`; dynamic chart commentary is in `app.mjs`.
`narrative.mjs` controls the counterfactual exercise and optional animation;
`narrative.css` contains their layout styles. Animation captions and scene
geometry live in `assets/art/fundamentals.html`. Save and refresh the local
preview; edit source files, not generated `dist/` files.

## Parallel art work

Andy's original
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
