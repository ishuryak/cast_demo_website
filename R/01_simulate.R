# 01_simulate.R
# Simulate confounded oncology cohorts with a KNOWN time-varying true ATE(t).
# Two trajectory shapes (plateau, reversal) x a grid of confounding strengths.
# Because the data are simulated we know the true effect trajectory exactly and
# can score every method against it -- the whole point of the demo.
#
# Output: output/sim.rds  (list of scenarios; each has data, true ATE, meta)

suppressWarnings(suppressMessages({
  library(survival)
}))

source("R/cast_core.R")

# ---- run controls --------------------------------------------------------
SUB <- as.integer(Sys.getenv("DEMO_SUBSAMPLE", "0"))   # >0 = fast smoke test
N        <- if (SUB > 0) SUB else 2000
CONF_GRID <- if (SUB > 0) c(0, 1) else c(0, 0.5, 1.0, 2.0)
SHAPES    <- if (SUB > 0) c("plateau") else c("plateau", "reversal")
HORIZONS  <- seq(12, 120, by = 12)
GRID      <- seq(0, 210, by = 0.5)        # fine time grid for true curves (months)
ADMIN_CENS <- 180                         # administrative censoring (months)
# Random (non-informative) loss-to-follow-up: exponential dropout that can occur
# at ANY time from study entry, independent of survival/treatment/covariates, so
# censoring is spread throughout follow-up rather than only administrative. The
# mean is calibrated so the overall censoring rate is ~30% (event rate ~70%).
CENS_MEAN <- 210                          # mean months to random dropout

dir.create("output", showWarnings = FALSE)

cat(sprintf("[01_simulate] N=%d  conf=%s  shapes=%s\n",
            N, paste(CONF_GRID, collapse=","), paste(SHAPES, collapse=",")))

# Time-varying log-hazard-ratio of treatment for each shape.
# plateau : uniformly protective (HR<1 for all t) -> RMST benefit rises, plateaus.
# reversal: protective early, harmful late (crossing) -> benefit rises, peaks, declines.
hr_curve <- function(shape, u) {
  if (shape == "plateau") {
    exp(rep(-0.62, length(u)))
  } else { # reversal: strong early protection, strong late harm (survival curves
           # cross in-window) -> RMST-scale ATE rises, peaks, then clearly declines.
    ustar <- 48
    exp(ifelse(u < ustar, -0.95, 0.72))
  }
}

simulate_cohort <- function(n, conf_strength, shape, seed) {
  set.seed(seed)

  # --- confounders (affect BOTH prognosis and treatment assignment) ---
  age    <- rnorm(n, 60, 10)
  stage  <- sample(1:4, n, replace = TRUE, prob = c(.25, .30, .25, .20))
  ps     <- pmin(100, pmax(40, rnorm(n, 80, 12)))    # performance status (KPS-like)
  comorb <- pmin(4L, rpois(n, 1.0))                  # comorbidity count 0-4
  z_age    <- (age - 60) / 10
  z_stage  <- (stage - 2.5) / 1.1
  z_ps     <- (ps - 80) / 12
  z_comorb <- (comorb - 1) / 1

  # --- prognostic non-confounder: smoking (affects survival, not assignment/effect) ---
  smoke <- rbinom(n, 1, 0.45)                        # 1 = ever-smoker (worse survival)

  # --- negative-control covariates: sex, ethnicity (affect nothing) ---
  sex       <- rbinom(n, 1, 0.5)                     # 0 = female, 1 = male
  ethnicity <- sample(c("A", "B", "C"), n, replace = TRUE, prob = c(.5, .3, .2))

  # --- baseline (control) survival depends on confounders => confounding ---
  k <- 1.4                                            # Weibull shape
  # baseline (control) prognosis: confounders + smoking (a prognostic non-confounder)
  lp_surv <- -0.25 * z_age - 0.45 * z_stage + 0.30 * z_ps -
             0.30 * z_comorb - 0.40 * smoke
  lambda0 <- exp(4.3 + lp_surv)                       # Weibull scale (months); median ~55 mo

  # --- treatment assignment: healthier patients more likely treated when conf>0.
  #     Only the confounders enter the propensity (smoking/sex/ethnicity do not). ---
  lp_treat <- conf_strength * (-0.5 * z_age - 0.6 * z_stage + 0.5 * z_ps -
                               0.45 * z_comorb)
  pscore   <- plogis(lp_treat)
  W        <- rbinom(n, 1, pscore)

  # --- potential-outcome survival curves on the shared grid ---
  G  <- length(GRID)
  du <- c(0, diff(GRID))
  # baseline hazard h0(u | x) for Weibull(shape k, scale lambda0_i)
  # h0 = (k / lambda) * (u / lambda)^(k-1)
  # Build n x G hazard then cumulative hazard then survival.
  Umat <- matrix(GRID, nrow = n, ncol = G, byrow = TRUE)
  lam  <- matrix(lambda0, nrow = n, ncol = G)
  h0 <- (k / lam) * (Umat / lam)^(k - 1)
  h0[, 1] <- 0
  HR <- matrix(hr_curve(shape, GRID), nrow = n, ncol = G, byrow = TRUE)
  h1 <- h0 * HR

  H0 <- t(apply(sweep(h0, 2, du, `*`), 1, cumsum))
  H1 <- t(apply(sweep(h1, 2, du, `*`), 1, cumsum))
  S0 <- exp(-H0)
  S1 <- exp(-H1)

  # --- sample observed event time from the assigned arm via inverse-CDF ---
  draw_T <- function(i) {
    Sv <- if (W[i] == 1) S1[i, ] else S0[i, ]
    Fv <- 1 - Sv
    u  <- runif(1)
    if (u >= max(Fv)) return(max(GRID))
    approx(Fv, GRID, xout = u, ties = "ordered", rule = 2)$y
  }
  Tevent <- vapply(seq_len(n), draw_T, numeric(1))

  # --- censoring: exponential random dropout throughout follow-up (independent
  #     of T, W, and covariates => non-informative) + administrative cap ---
  Cens <- pmin(rexp(n, rate = 1 / CENS_MEAN), ADMIN_CENS)
  Y <- pmin(Tevent, Cens)
  D <- as.integer(Tevent <= Cens)

  dat <- data.frame(age = age, stage = stage, ps = ps, comorb = comorb,
                    smoke = smoke, sex = sex, ethnicity = ethnicity,
                    W = as.integer(W), Y = Y, D = D, stringsAsFactors = FALSE)

  true_ate <- true_rmst_ate(S0, S1, GRID, HORIZONS)

  # standardized mean difference by arm; confounders become imbalanced as
  # confounding rises, while smoking (a non-confounder) stays balanced.
  smd <- function(v) (mean(v[W == 1]) - mean(v[W == 0])) /
                     sqrt((var(v[W == 1]) + var(v[W == 0])) / 2)

  list(data = dat,
       true_ate = data.frame(horizon = HORIZONS, true_ate = true_ate),
       meta = list(shape = shape, conf_strength = conf_strength, n = n,
                   event_rate = mean(D),
                   treated_frac = mean(W),
                   smd_age = smd(age), smd_ps = smd(ps),
                   smd_comorb = smd(comorb), smd_smoke = smd(smoke)))
}

scenarios <- list()
sid <- 0
for (shape in SHAPES) {
  for (cs in CONF_GRID) {
    sid <- sid + 1
    seed <- 1000 + sid
    sc <- simulate_cohort(N, cs, shape, seed)
    key <- sprintf("%s_conf%.2f", shape, cs)
    scenarios[[key]] <- sc
    cat(sprintf("  [%s] events=%.2f  treated=%.2f  SMD(age)=%.2f  SMD(ps)=%.2f  peakTrueATE=%.2f\n",
                key, sc$meta$event_rate, sc$meta$treated_frac,
                sc$meta$smd_age, sc$meta$smd_ps, max(sc$true_ate$true_ate)))
  }
}

saveRDS(list(scenarios = scenarios, horizons = HORIZONS,
             conf_grid = CONF_GRID, shapes = SHAPES, n = N),
        "output/sim.rds")
cat("[01_simulate] wrote output/sim.rds (", length(scenarios), "scenarios )\n")
