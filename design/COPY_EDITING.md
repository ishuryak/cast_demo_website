# Editing the tutorial and class kit

Preview: `http://127.0.0.1:4173/`. The local server reads `tutorial/` directly;
save and refresh for HTML/CSS/JavaScript changes. If stopped, run
`npm --prefix tutorial run dev` from the repository root.

| What to change | Source | Find |
| --- | --- | --- |
| Opening story, section copy, source links and credits | `tutorial/index.html` | `hero-copy`, `question`, `comparison`, `for-whom`, `site-footer` |
| Audience choices and the four suggested reading paths | `tutorial/index.html` | `choose-path`, `path-student`, `path-researcher`, `path-convert`, `path-educator` |
| Original sketch and caption | `tutorial/index.html` | `hero-art`; preserve the source PNG |
| Opening header, longitudinal comparison and method connections | `tutorial/index.html` | `opening-thesis`, `longitudinal`, `method-family` |
| CAST expansion and navy trajectory accents | `tutorial/index.html`, `tutorial/narrative.css` | `cast-brand`, `trajectory-accent`, `--navy` |
| Hand-drawn illustration captions and explanatory notes | `tutorial/index.html` | `notebook-figure`, `missingness`, `snapshot-sketch`, `causal-roadmap` |
| Dose/time/profile story and metaphor | `tutorial/index.html` | `for-whom`, `profile-lab`, `profile-target` |
| Invented profile curves and changing readouts | `tutorial/profile-illustration.mjs` | `illustrativeEffect`, `message`, `profile-status`; these are not CAST estimates |
| Flip-card button wording | `tutorial/narrative.mjs` | `showProblem` |
| Counterfactual exercise | `tutorial/index.html` | `counterfactual-lab`, `data-completion-result` |
| Chart readouts and changing guidance | `tutorial/app.mjs` | `observation`, `interpretation`, `selected-interval` |
| Exact-values table and hidden-confounding control | `tutorial/index.html` | `data-table`, `unmeas` |
| Class-kit download and PDF links | `tutorial/index.html` | `header-link`, `class-kit` |
| Animation text, legends and responsive geometry | `tutorial/assets/art/fundamentals.html` | `SCENES`, `scene1` through `scene5` |
| Page layout and typography | `tutorial/narrative.css` | Overrides on top of `style.css` |
| Current taxonomy image | `hand-drawn/taxonomy of methods.png` | Copy to `tutorial/assets/art/methods-landscape.png` after a revision; update its caption and alt text in `index.html` |
| Guide, vocabulary, equations and exercises | `tutorial/class-kit/study-guide.tex` | Six-page LaTeX source |
| Draft slides and speaker notes | `tutorial/class-kit/slides.tex` | Beamer frames and `\note` blocks |
| Provided-cohort analysis | `tutorial/class-kit/class-lab.R` | `analyze_demo()` |
| Fresh-cohort exercise | `tutorial/labs/cast-exercise.R` | `run_cast_exercise()`; keep its kit copy in sync |
| Download contents and provenance | `tutorial/scripts/package-class-kit.mjs` | `kitFiles`, generation settings |

This is Igor Shuryak's CAST demo. For deeper detail, link to its GitHub
repository, methods or R implementation; avoid describing a separate page as
the original demo.

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
```

The build refreshes the class-kit ZIP and the public allowlist in
`tutorial/dist/`, then stages it in `docs/tutorial/`. It excludes internal art
notes, generators and consultation files. Edit source files, not generated
`docs/tutorial/`, `dist/` or the ZIP. Commit the source and generated changes
together and push `main` to publish on GitHub Pages. For code changes, also run
the relevant R exercise checks described in `tutorial/README.md`.

Share: https://ishuryak.github.io/cast_demo_website/tutorial/
