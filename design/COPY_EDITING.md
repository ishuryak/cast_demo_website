# Editing the tutorial and class kit

Preview: `http://127.0.0.1:4173/`. The local server reads `tutorial/` directly;
save and refresh for HTML/CSS/JavaScript changes. If stopped, run
`npm --prefix tutorial run dev` from the repository root.

| What to change | Source | Find |
| --- | --- | --- |
| Opening story, section copy, source links and credits | `tutorial/index.html` | `hero-copy`, `question`, `comparison`, `for-whom`, `site-footer` |
| Susan’s single reading path | `tutorial/index.html` | `story`, `why-causal`, `one-number`, `two-tools`, `explore`, `conclusion` |
| Independent roadmap | `tutorial/index.html`, `tutorial/roadmap-flow.css` | `causal-roadmap`; editable SVG and draw.io in `design/roadmap-flow/` |
| Opening header, longitudinal comparison and method connections | `tutorial/index.html` | `opening-thesis`, `longitudinal`, `method-family` |
| CAST expansion and navy trajectory accents | `tutorial/index.html`, `tutorial/narrative.css` | `cast-brand`, `trajectory-accent`, `--navy` |
| Illustration captions and explanatory notes | `tutorial/index.html` | `notebook-figure`, `well-behaved`, `slices-to-curve` |
| Limits of subgroup effects | `tutorial/index.html` | `for-whom` |
| Counterfactual exercise | `tutorial/index.html` | `counterfactual-lab`, `data-completion-result` |
| Chart readouts and changing guidance | `tutorial/app.mjs` | `observation`, `interpretation`, `selected-interval` |
| Exact-values table and hidden-confounding control | `tutorial/index.html` | `data-table`, `unmeas` |
| Class-kit download and PDF links | `tutorial/index.html` | `header-link`, `class-kit` |
| Coverage evidence | `tutorial/index.html` | `coverage-details`; preserve its link to the repeated-simulation results |
| Page layout and typography | `tutorial/narrative.css` | Overrides on top of `style.css` |
| Guide, vocabulary, equations and exercises | `tutorial/class-kit/study-guide.tex` | Six-page LaTeX source |
| Draft slides and speaker notes | `tutorial/class-kit/slides.tex` | Beamer frames and `\note` blocks |
| Provided-cohort analysis | `tutorial/class-kit/class-lab.R` | `analyze_demo()` |
| Fresh-cohort exercise | `tutorial/labs/cast-exercise.R` | `run_cast_exercise()`; keep its kit copy in sync |
| Download contents and provenance | `tutorial/scripts/package-class-kit.mjs` | `kitFiles`, generation settings |

This is Igor Shuryak's CAST demo. For deeper detail, link to its GitHub
repository, methods or R implementation; avoid describing a separate page as
the original demo.

The main path is concepts, methods, then lab. Keep longer explanations in the
existing disclosures and avoid parallel audience routes or repeated methods
comparisons. The earlier clinical walkthrough redirects to this path; legacy
anchor mappings live in `scripts/build-tutorial-v3.mjs`.

Keep HTML IDs and `data-*` attributes intact when editing prose. The two
counterfactual completions encode numerical examples; their counts, outcomes
and tests must agree. The simulation export in `tutorial/data/` is frozen
research output, not a copy-editing file. The original `R/` and root `docs/`
methods page are preserved; `docs/tutorial/` contains the generated walkthrough.

For document edits, compile the LaTeX twice, put compiler intermediates under
the ignored `tutorial/labs/output/`, and visually inspect the PDFs before
replacing the final PDFs. Then run:

```powershell
npm --prefix tutorial test
npm run build:pages
npm run test:clinical
node tests/test_tutorial_variants.mjs docs
```

The build refreshes the class-kit ZIP and the public allowlist in
`tutorial/dist/`, then stages it in `docs/tutorial/`. It excludes internal art
notes, generators and consultation files. Edit source files, not generated
`docs/tutorial/`, `dist/` or the ZIP. Commit the source and generated changes
together and push `main` to publish on GitHub Pages. For code changes, also run
the relevant R exercise checks described in `tutorial/README.md`.

Share: https://ishuryak.github.io/cast_demo_website/tutorial/
