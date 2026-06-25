# CAST demo website: causal survival trajectories on simulated oncology data

An interactive teaching demo that shows, on **simulated** cancer-survival
cohorts where the true treatment effect is known:

1. how confounding by indication biases a **naive** unadjusted effect;
2. how a **Causal Survival Forest (CSF)** substantially reduces that
   confounding (with residual bias only when strong confounding pushes
   treatment propensities toward 0 or 1, a positivity/overlap limit);
3. why standard baselines, **Cox** regression and a **Random Survival Forest
   (RSF)**, fall short; and
4. how **CAST** extends CSF from per-horizon points to a smooth treatment-effect
   *trajectory* via the cross-horizon influence-function covariance, Ledoit–Wolf
   shrinkage, and a smooth quadratic fit with a covariance-aware band.

Because the data are simulated, every method is scored against the **known true
ATE(t)** (survival-probability-difference scale), the one comparison impossible
with real data.

## What you see

A single ATE-vs-horizon figure with a **confounding-strength slider**, an
**effect-shape** selector, and per-method **toggles**, plus live cards for
accuracy (RMSE vs. truth), the Cox hazard ratio and
proportional-hazards test, confounder imbalance (SMD), and the Ledoit–Wolf
shrinkage intensity and covariance condition number.

The **effect-shape** selector switches between two trajectories: a **plateau**,
where treatment is protective throughout (constant hazard ratio ≈ 0.54), so on
the survival-probability scale the survival gap rises, peaks, then slowly narrows
as both arms approach low survival; and a **reversal**, where treatment helps
early (asymptotic HR ≈ 0.39) but harms late (asymptotic HR ≈ 2.05) through a
smooth transition around 48 months, so the survival curves cross and the
survival-probability difference rises, peaks, then turns negative. The reversal
is a stylized teaching curve, not an empirical one, and because it breaks
proportional hazards it is the case a single Cox hazard ratio cannot describe,
the motivation for a trajectory method.

## Preview

The static 600-DPI fallback figures the pipeline writes, one per confounding
level and effect shape (the live site is interactive: a slider moves through
these same panels). Each shows truth, Naive, RSF (S- and T-learner), the marginal
Cox curve, the CSF points with 95% CIs, and the CAST trajectory with its
covariance-aware 95% band. As confounding
rises the Naive curve diverges while CSF and CAST stay close to truth, with an
honest, growing residual bias at strong confounding.

| Confounding | Plateau effect | Reversal effect |
|:--|:--:|:--:|
| **None** (γ = 0) | ![Plateau, no confounding](docs/figs/plateau_none_confounding.png) | ![Reversal, no confounding](docs/figs/reversal_none_confounding.png) |
| **Mild** (γ = 0.5) | ![Plateau, mild confounding](docs/figs/plateau_mild_confounding.png) | ![Reversal, mild confounding](docs/figs/reversal_mild_confounding.png) |
| **Moderate** (γ = 1) | ![Plateau, moderate confounding](docs/figs/plateau_moderate_confounding.png) | ![Reversal, moderate confounding](docs/figs/reversal_moderate_confounding.png) |
| **Strong** (γ = 2) | ![Plateau, strong confounding](docs/figs/plateau_strong_confounding.png) | ![Reversal, strong confounding](docs/figs/reversal_strong_confounding.png) |

## Layout

```
cast_demo_website/
  R/
    cast_core.R          Ledoit–Wolf shrinkage, cross-horizon influence-function
                         covariance, covariance-aware quadratic trajectory fit,
                         true/KM survival-probability helpers (ported from the glioma CAST pipeline)
    01_simulate.R        simulate confounded cohorts + known true ATE(t)
    02_fit_methods.R     Naive / Cox / RSF S- and T-learner / CSF / CAST, scored vs truth
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
# full run (N=2000; 4 confounding levels x 2 shapes), a few minutes
./run_all.sh

# fast smoke test (smaller N, fewer trees, reduced grid, no tuning)
DEMO_SUBSAMPLE=600 ./run_all.sh
```

`run_all.sh` prefers `$RSCRIPT`, then Windows R 4.5.1 (when run from WSL), then
`Rscript` on `PATH`. Env vars cross the WSL→Windows boundary through `WSLENV`
(already set in the script). Tunables: `DEMO_SUBSAMPLE` (cohort size; 0 = full),
`DEMO_NUM_TREES`, `DEMO_SEED` (forest seed; default 101, so the exported
`scenarios.json` is reproducible across runs), and `DEMO_TUNE` (hyperparameter
tuning; default `all` for a full run, `none` for the smoke test).

**Hyperparameter tuning.** On a full run all forests are tuned, which is slower
but more accurate. The propensity (`grf::regression_forest`) and CSF
(`grf::causal_survival_forest`) use grf's built-in `tune.parameters = "all"`
cross-validation over `sample.fraction`, `mtry`, `min.node.size`, the honesty
fractions, `alpha`, and `imbalance.penalty`. The RSF (`grf::survival_forest`,
which has no built-in tuner) is tuned with a small grid over `min.node.size`
∈ {5, 15, 50}, `sample.fraction` ∈ {0.35, 0.5}, and `mtry`, selected by
out-of-bag concordance at a mid-window horizon. Set `DEMO_TUNE=none` to skip
tuning for a fast check.

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

Only aggregate artifacts ship. The per-patient simulated intermediates in
`output/` are gitignored.

## For collaborators

### Pipeline (what each script produces)

`run_all.sh` runs three R scripts in order:

1. **`R/01_simulate.R`** → `output/sim.rds`. Simulates the confounded cohorts and
   the *known* true ATE(t). One entry per scenario, each holding the per-patient
   rows and the oracle effect curve.
2. **`R/02_fit_methods.R`** → `output/fits.rds`. Fits Naive / Cox / RSF S-learner /
   RSF T-learner / CSF / CAST on each cohort and scores every method against the
   truth.
3. **`R/03_export.R`** → `docs/data/scenarios.json` + `docs/figs/*.png`. Writes
   the aggregate results the website reads, plus the 600-DPI fallback figures.

`R/cast_core.R` holds the shared CAST routines (Ledoit–Wolf shrinkage, the
cross-horizon influence-function covariance, the covariance-aware quadratic
trajectory fit, and the true/KM survival-probability helpers).

### Data-generating model

Everything is generated from a known model, so **no patient data are used
anywhere**. Each scenario (one effect shape × one confounding level γ) simulates
**n = 2000** independent patients. The covariates fall into three roles:

- **Confounders** (affect both prognosis and treatment assignment): age, stage,
  performance status, comorbidity count.
- **Prognostic non-confounder** (affects survival only): smoking. It shortens
  survival but does not affect who is treated and does not modify the effect.
- **Negative controls** (affect nothing): sex and ethnicity. Included so the
  methods can be seen to correctly ignore irrelevant covariates.

Every formula below is exactly what `R/01_simulate.R` implements.

**1. Covariate distributions** (drawn independently per patient):

$$
\text{age}\sim\mathcal N(60,10^2),\quad
\text{stage}\sim\text{Cat}(\{1,2,3,4\};\,0.25,0.30,0.25,0.20),
$$
$$
\text{ps}\sim\mathrm{clip}\!\big(\mathcal N(80,12^2),\,40,\,100\big),\quad
\text{comorb}\sim\min\!\big(\mathrm{Pois}(1),\,4\big),
$$
$$
\text{smoke}\sim\mathrm{Bern}(0.45),\quad
\text{sex}\sim\mathrm{Bern}(0.5),\quad
\text{eth}\sim\text{Cat}(\{A,B,C\};\,0.5,0.3,0.2).
$$

Confounders are standardized for use in the linear predictors:
$z_{\text{age}}=(\text{age}-60)/10$, $z_{\text{stage}}=(\text{stage}-2.5)/1.1$,
$z_{\text{ps}}=(\text{ps}-80)/12$, $z_{\text{com}}=(\text{comorb}-1)/1$.

**2. Baseline (control) survival** is Weibull with shape $k=1.4$. The control
log-scale predictor and Weibull scale are

$$
\eta^{\text{surv}}=-0.25\,z_{\text{age}}-0.45\,z_{\text{stage}}+0.30\,z_{\text{ps}}-0.30\,z_{\text{com}}-0.40\,\text{smoke},
\qquad
\lambda_0=\exp(4.3+\eta^{\text{surv}}),
$$

giving the per-patient baseline hazard
$h_0(u)=\dfrac{k}{\lambda_0}\left(\dfrac{u}{\lambda_0}\right)^{k-1}$
(control median survival ≈ 55 months). Smoking lowers $\eta^{\text{surv}}$, so
smokers do worse; sex and ethnicity have zero coefficients.

**3. Treatment effect** is a time-varying hazard ratio that depends on the shape
and time only (never on covariates). The reversal transitions smoothly (logistic,
width $s_w=12$ months) around $u^{*}=48$ months rather than stepping, so the
survival-probability truth is differentiable and a smooth quadratic trajectory is
a fair model:

$$
\text{plateau:}\ \ \mathrm{HR}(u)=e^{-0.62}\approx0.54;\qquad
\text{reversal:}\ \ \mathrm{HR}(u)=\exp\!\Big\{-0.95+1.67\,\sigma\big((u-48)/12\big)\Big\},
$$

where $\sigma$ is the logistic function, so $\mathrm{HR}\to e^{-0.95}\approx0.39$
early and $\to e^{0.72}\approx2.05$ late. The treated hazard is
$h_1(u)=h_0(u)\,\mathrm{HR}(u)$.

**4. Potential-outcome survival curves** for arm $w\in\{0,1\}$ on a fine grid
($u\in[0,210]$, step 0.5 months) are

$$
H_w(t)=\int_0^t h_w(u)\,du,\qquad S_w(t)=\exp\{-H_w(t)\}
$$

(the integral is the trapezoidal sum over the grid).

**5. Treatment assignment** (the confounding knob, $\gamma=$ `conf_strength`
$\in\{0,0.5,1,2\}$). Only the confounders enter the propensity:

$$
\eta^{\text{treat}}=\gamma\,(-0.5\,z_{\text{age}}-0.6\,z_{\text{stage}}+0.5\,z_{\text{ps}}-0.45\,z_{\text{com}}),
\qquad
\pi=\frac{1}{1+e^{-\eta^{\text{treat}}}},\qquad W\sim\mathrm{Bern}(\pi).
$$

At $\gamma=0$ assignment is random (a clean trial); as $\gamma$ rises, healthier
patients (younger, earlier-stage, better performance status, fewer
comorbidities) are preferentially treated, i.e. confounding by indication.
Smoking, sex, and ethnicity do **not** enter $\pi$. Treatment is **binary**.

**6. Observed data.** The latent event time is drawn by inverse-CDF from the
*assigned* arm's curve, $T=S_W^{-1}(U)$ with $U\sim\mathrm{Unif}(0,1)$
(implemented via $F_W=1-S_W$). Censoring is non-informative random
loss-to-follow-up (exponential dropout that can occur at any time from study
entry, independent of $T$, $W$, and the covariates), capped by administrative
censoring at 180 months:

$$
C=\min\!\big(\mathrm{Exp}(1/210),\,180\big),\qquad
Y=\min(T,C),\qquad D=\mathbf 1\{T\le C\}.
$$

The exponential mean (210 months) is calibrated so the overall censoring rate is
about 30% (event rate ≈ 70%), spread throughout follow-up rather than
concentrated at the administrative cap. Censoring is independent of survival, so
it remains non-informative and the causal identification is unaffected.

**7. Estimand and oracle truth.** The target is the survival-probability
difference at horizon $t$. With the known potential-outcome curves,

$$
\mathrm{ATE}(t)=\frac1n\sum_{i=1}^n\big[S_{1}(t\mid i)-S_{0}(t\mid i)\big],
$$

evaluated at $t\in\{12,36,60,84,108\}$ months. Because $S_0,S_1$ are known, this
truth is exact. Sex and ethnicity (zero coefficients) and smoking (enters only
$\eta^{\text{surv}}$, identically in both arms) never change the true ATE; it is
driven by the confounders' effect on baseline survival and by $\mathrm{HR}(u)$.

This produces **8 scenarios** (2 shapes × 4 confounding levels), each at 5
horizons (12–108 months, spaced 24 months apart — wide enough that the
cross-horizon influence-function covariance is well-conditioned and the trajectory
fit uses generalized least squares).

### Data tiers

- **Intermediates (gitignored, not in the repo):** `output/sim.rds`,
  `output/fits.rds` hold the per-patient simulated rows (age, stage, performance
  status, comorbidity, smoking, sex, ethnicity, treatment `W`, observed time `Y`,
  event `D`), the true ATE curves, and the fitted results. Kept out of git on
  principle (row-per-patient layout); regenerate them by running the pipeline.
- **Published data (the only data in the repo):** `docs/data/scenarios.json`
  (~14 KB) is fully **aggregate**: per scenario it stores cohort metadata
  (shape, confounding strength, n, event rate, treated fraction, SMDs), the
  truth / Naive / RSF S- and T-learner ATE vectors, the CSF points with CIs, the CAST trajectory
  with band and peak metrics, the Cox HR + PH-test p-value and marginal
  survival-probability curve, the Ledoit–Wolf
  shrinkage diagnostics, and each method's RMSE vs. truth. No patient-level rows.
  Because the cohorts are synthetic, nothing sensitive exists even in the
  gitignored intermediates.

### Regenerate

```bash
./run_all.sh                       # full run, regenerates scenarios.json + figures
DEMO_SUBSAMPLE=600 ./run_all.sh    # fast smoke test
```

## Method provenance

The CSF fits use `grf::causal_survival_forest` (survival.probability target,
propensity from a `grf::regression_forest`). The CAST layer builds the
cross-horizon covariance from the CSF doubly-robust influence-function scores
(`get_scores()`; the covariance of the ATE vector is `cov(Ψ)/n`), stabilizes it
with `ledoit_wolf_shrinkage()`, and fits a smooth quadratic in time. The point
estimate is generalized least squares `β̂ = (XᵀΣ̂⁻¹X)⁻¹XᵀΣ̂⁻¹y`, used
automatically because the survival-probability horizons make Σ̂ well-conditioned
(it falls back to weighted least squares when Σ̂ is ill-conditioned, as on the
cumulative-RMST scale).
The 95% band is the covariance-aware sandwich
`Var(β̂) = (XᵀWX)⁻¹ XᵀWΣ̂WX (XᵀWX)⁻¹`, so the shrunk cross-horizon covariance
propagates into the uncertainty rather than treating horizons as independent.

## Data note

All cohorts are simulated from a known generative model. **No patient data** are
used or distributed.

## License

[MIT](LICENSE) © 2026 Igor Shuryak.
