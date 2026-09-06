# Causal educators' class kit

A 60-90 minute lesson on missing counterfactuals, survival effects over time,
causal survival forests and CAST. All records and numerical examples are synthetic.

## Open or edit

- `study-guide.pdf`: lesson plan, vocabulary, equations, exercises and answer notes.
- `slides.pdf`: draft teaching deck.
- `study-guide.tex` and `slides.tex`: editable LaTeX sources. Upload either to a
  blank Overleaf project, or run `pdflatex study-guide.tex` and `pdflatex slides.tex`
  twice locally. Standard LaTeX packages are required; no private fonts or artwork.
- `class-lab.R`: analyze the included 600-person cohort.
- `cast-exercise.R`: generate another cohort and vary the study settings.
- `R/`: Igor Shuryak's unchanged simulation and CAST implementation, bundled with
  its MIT license. `provenance.json` records the version and file hashes.

## Run the supplied dataset

Unzip the kit. Open R or RStudio with the extracted kit folder as the working
directory, then run:

```r
install.packages(c("survival", "grf")) # once, if these packages are absent
source("class-lab.R")
result <- analyze_demo()
result$results
```

The run uses five horizons and 300 untuned trees to keep the class exercise
manageable. It writes results and a figure to a new folder under `results/`.
Installed R packages are needed; the lab itself makes no network requests.
For more trees, use `analyze_demo(num_trees = 2000)`.

To generate a different study using the bundled source:

```r
source("cast-exercise.R")
another <- run_cast_exercise(seed = 20260906, source_dir = "R")
hidden <- run_cast_exercise(hidden_confounding = 1.5, source_dir = "R")
```

These functions preserve earlier output folders. Generated cohorts can include
the generator's `u_hidden` column for teaching; it never enters the fitted models.

## Which data are which?

`data/demo-cohort.csv` contains **600 new synthetic people**, generated with seed
20260905, the reversal pattern, measured-confounding strength 1 and hidden-confounding
strength 0. It is ready for analysis with `class-lab.R`.

| Column | Meaning |
| --- | --- |
| `age` | Baseline age in years, drawn from a normal distribution |
| `stage` | Simulated ordinal disease stage, 1-4 |
| `ps` | Baseline performance score, 40-100; larger is better |
| `comorb` | Simulated comorbidity count, 0-4 |
| `smoke` | Simulated ever-smoking indicator, 0/1 |
| `sex` | Generator's synthetic binary coding, 0=female and 1=male |
| `ethnicity` | Arbitrary simulated labels A/B/C, with no real-world group meaning |
| `W` | Baseline treatment assignment, 1=treatment and 0=control |
| `Y` | Observed follow-up time in months: the earlier of event and censoring |
| `D` | 1=observed death at Y; 0=censored at Y |

Sex and ethnicity affect nothing in this particular generator. These design
choices are teaching devices, not claims about real patients or populations.
Censoring before a horizon does not mean that the person died by that horizon.

`data/answer-key.csv` contains `month` and `truth`: the average difference between
the two conditional survival probabilities for those **same 600 profiles**. It
does not contain paired individual outcomes and is never supplied to a forest.

`data/frozen-horizons.csv` contains the **website's separate 2,000-person scenarios**:
24 scenarios by five horizons = 120 rows. `scenario` identifies the effect pattern
and confounding settings; `month` is follow-up time. `csf`, `cast`, `truth` and
`unadjusted` are probability differences. Multiply by 100 for percentage points.
The `_low` and `_high` columns are 95% interval/band limits. The CAST limits are
pointwise, not simultaneous across time; they do not include all uncertainty
from method selection or quadratic misspecification.

**The 600-person lab should not reproduce the frozen website's exact decimals.**
The CSVs can be inspected with base R or a spreadsheet even without grf.

## Sources and reuse

- [Igor Shuryak's CAST repository: code, detailed methods and audits](https://github.com/ishuryak/cast_demo_website)
- [Bundled source revision](https://github.com/ishuryak/cast_demo_website/tree/43a00101100801eb6c048800d24788455fac0f8b)

The guide and slides include scientific references. Keep the supplied MIT notice
with copies of Igor's code. Edit the draft teaching materials for your class.
