# Run the synthetic R exercise

Download `cast-exercise.R`. In R or RStudio:

```r
install.packages(c("survival", "grf"), repos = "https://cloud.r-project.org")
source("cast-exercise.R")
result <- run_cast_exercise()
```

From a cloned repository, use `source("tutorial/labs/cast-exercise.R")` instead. The default run uses 600 simulated people, five horizons, 300 trees, two threads, and no tuning. It is a learning exercise, not an exact rerun of the 2,000-person tuned website export.

The function downloads Igor's simulation and CAST math from commit `43a00101100801eb6c048800d24788455fac0f8b` over HTTPS, then sources them in a temporary workspace with export execution disabled. Read those files before running if you want to inspect the generating mechanism. The original MIT notice is at https://github.com/ishuryak/cast_demo_website/blob/43a00101100801eb6c048800d24788455fac0f8b/LICENSE.

Each run writes a new directory under `cast-lab-output/` in your current directory. It contains synthetic patient rows, horizon results, a PNG figure, and an environment/settings record. It does not execute `run_all.sh` or the original export script. Existing runs are preserved. From the repository you may prefer `output_dir = "tutorial/labs/output"`, which is gitignored.

## Change one thing

```r
# Inspect the new simulated rows and aggregate estimates.
head(result$cohort)
result$results

# Ask the same question in a new sample.
another <- run_cast_exercise(seed = 20260906)

# Add actual horizon estimates, not just rendering points.
denser <- run_cast_exercise(horizons = seq(12, 108, by = 12))

# Study what measured adjustment cannot observe.
hidden <- run_cast_exercise(hidden_confounding = 1.5)
```

Choose at least three increasing horizons, greater than zero and no later than 108 months, in **0.5-month increments**. The simulation's answer key uses that grid; off-grid requests are rejected before fitting so the estimates and truth describe the same times.

The data contain `u_hidden` as a teaching answer key; it is excluded from fitted X. Treatment occurs at baseline. All contrasts are survival-probability differences, not individual causal outcomes. CAST bands are 95% pointwise, calculated from influence scores and the fitted quadratic, and are not simultaneous across time. The band does not capture all model-selection or curve-misspecification uncertainty. Never interpret the fitted peak as a time to stop treatment.

For offline use after cloning the original source, supply `source_dir = "R"`; this is a local-source override and is recorded in `run-info.txt`. It uses the actual local files, which may differ from the pinned upstream commit. The exercise does not install packages automatically.

## Browser launch status

A Binder/RStudio configuration is scaffolded at the repository root in `.binder/`. It is not yet published or cloud-build tested. Once the alternate repository is public and a release commit is selected, the tutorial can link to a Binder URL for that exact revision with `?urlpath=rstudio`.

The page deliberately has a working download rather than a launch button pointing to uncommitted code. See `design/R_EXECUTION_OPTIONS.md` for the connection plan and alternatives.
