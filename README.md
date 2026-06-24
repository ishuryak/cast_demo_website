# CAST demo website — causal survival trajectories on simulated oncology data

An interactive teaching demo that shows, on **simulated** cancer-survival
cohorts where the true treatment effect is known:

1. how confounding by indication biases a **naive** unadjusted effect;
2. how a **Causal Survival Forest (CSF)** removes that confounding;
3. why standard baselines — **Cox** regression and a **Random Survival Forest
   (RSF)** — fall short; and
4. how **CAST** extends CSF from per-horizon points to a smooth treatment-effect
   *trajectory* via bootstrap cross-horizon covariance, Ledoit–Wolf shrinkage,
   and a GLS quadratic fit.

Because the data are simulated, every method is scored against the **known true
ATE(t)** (RMST-difference scale) — the one comparison impossible with real data.

## What you see

A single ATE-vs-horizon figure with a **confounding-strength slider**, an
**effect-shape** selector (plateau vs. reversal), and per-method **toggles**,
plus live cards for accuracy (RMSE vs. truth), the Cox hazard ratio and
proportional-hazards test, confounder imbalance (SMD), and the Ledoit–Wolf
shrinkage intensity and covariance condition number.

## Preview

Strong-confounding snapshots (the static 600-DPI fallback figures the pipeline
also writes; the live site is interactive):

![Plateau effect, strong confounding](docs/figs/plateau_strong_confounding.png)

![Reversal effect, strong confounding](docs/figs/reversal_strong_confounding.png)

## Layout

```
cast_demo_website/
  R/
    cast_core.R          Ledoit–Wolf shrinkage, bootstrap cross-horizon
                         covariance, GLS quadratic fit, true/KM RMST helpers
                         (ported from the production glioma CAST pipeline)
    01_simulate.R        simulate confounded cohorts + known true ATE(t)
    02_fit_methods.R     Naive / Cox / RSF / CSF / CAST, scored vs truth
    03_export.R          write docs/data/scenarios.json + PNG fallbacks
    install_packages.R   one-time dependency install
  docs/                              <- the published static site (GitHub Pages root)
    index.html  app.js  style.css      static site (Plotly, no build step)
    data/scenarios.json                aggregate results (safe to publish)
    figs/*.png                         600-DPI fallback figures
  run_all.sh             orchestration (simulate -> fit -> export)
  output/                R intermediates (gitignored)
```

## Requirements

R 4.5.x with `grf`, `survival`, `jsonlite` (the RSF baseline uses
`grf::survival_forest`, so `randomForestSRC` is not needed). Install once:

```bash
Rscript R/install_packages.R
```

On Windows-R-from-WSL, point `RSCRIPT` at the Windows binary, e.g.
`"/mnt/c/Program Files/R/R-4.5.1/bin/x64/Rscript.exe" R/install_packages.R`.

## Run

```bash
# full run (N=2000; 4 confounding levels x 2 shapes) — a few minutes
./run_all.sh

# fast smoke test (smaller N, fewer trees/bootstraps, reduced grid)
DEMO_SUBSAMPLE=600 ./run_all.sh
```

`run_all.sh` prefers `$RSCRIPT`, then Windows R 4.5.1 (when run from WSL), then
`Rscript` on `PATH`. Env vars cross the WSL→Windows boundary through `WSLENV`
(already set in the script). Tunables: `DEMO_SUBSAMPLE` (cohort size; 0 = full),
`DEMO_NUM_TREES`, `DEMO_BOOT`, `DEMO_SEED` (forest seed; default 101, so the
exported `scenarios.json` is reproducible across runs).

## View the site locally

`fetch()` needs http (not `file://`), so serve the `docs/` folder:

```bash
cd docs && python3 -m http.server 8000   # open http://localhost:8000
```

## Publish on GitHub Pages

The site lives in `docs/`, which GitHub Pages can serve directly:

1. Push this repo to GitHub.
2. Repo **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**, then
   **Branch = `main`** and **Folder = `/docs`**, and **Save**.
4. After a minute the site is live at
   `https://<your-username>.github.io/<repo-name>/`.

Only aggregate artifacts ship — the per-patient simulated intermediates in
`output/` are gitignored.

## Method provenance

The CSF fits use `grf::causal_survival_forest` (RMST target, propensity from a
`grf::regression_forest`). The CAST layer — `ledoit_wolf_shrinkage()`, the
patient-level bootstrap cross-horizon covariance, and the GLS quadratic
`β̂ = (XᵀΣ̂⁻¹X)⁻¹XᵀΣ̂⁻¹y` — is ported directly from the production glioma CAST
pipeline so the demo runs the real method.

## Data note

All cohorts are simulated from a known generative model. **No patient data** are
used or distributed.

## License

[MIT](LICENSE) © 2026 Igor Shuryak.
