# 02_fit_methods.R
# Fit and score the comparators on each simulated scenario. The estimand is the
# survival-probability difference ATE_S(t) = P(T>t | W=1) - P(T>t | W=0):
#   Naive : unadjusted KM survival-probability difference (no confounding adjustment)
#   Cox   : confounder-adjusted Cox PH -> single HR + PH test, AND a marginal
#           survival-probability difference curve (g-formula standardization)
#   RSF-S : grf survival_forest S-learner plug-in survival-prob contrast (ML, not orthogonalized)
#   RSF-T : grf survival_forest T-learner, separate per-arm forests (ML, not orthogonalized)
#   CSF   : grf causal_survival_forest per horizon, survival.probability target
#   CAST  : CSF points -> cross-horizon influence-function covariance ->
#           Ledoit-Wolf shrinkage -> quadratic trajectory with a covariance-aware
#           band (GLS engages on this well-conditioned scale; + peak metrics)
# Every method is scored against the KNOWN true ATE_S(t).
#
# Output: output/fits.rds

suppressWarnings(suppressMessages({
  library(grf)
  library(survival)
}))

source("R/cast_core.R")

SUB        <- as.integer(Sys.getenv("DEMO_SUBSAMPLE", "0"))
NUM_TREES  <- as.integer(Sys.getenv("DEMO_NUM_TREES", if (SUB > 0) "300" else "1000"))
# Fixed forest seed so the exported scenarios.json is reproducible across runs.
FOREST_SEED <- as.integer(Sys.getenv("DEMO_SEED", "101"))
# grf hyperparameter tuning. "all" cross-validates over grf's standard parameter
# space (sample.fraction, mtry, min.node.size, honesty.fraction,
# honesty.prune.leaves, alpha, imbalance.penalty); "none" uses defaults. Full
# runs tune all forests; the subsample smoke test skips tuning for speed.
TUNE <- Sys.getenv("DEMO_TUNE", if (SUB > 0) "none" else "all")

# L10: record the resolved configuration in the run's own log, so a run can be
# shown to have used the settings it was asked for rather than assumed to have.
cat(sprintf("[02_fit] config  subsample=%d  num.trees=%d  seed=%d  tune=%s\n",
            SUB, NUM_TREES, FOREST_SEED, TUNE))

# When SOURCED for `fit_scenario()` alone (the caller sets DEMO_SOURCE_ONLY and
# supplies `horizons` first) this file must not read or rebuild the published
# grid. Run as a script the flag does not exist, output/sim.rds is read, and
# `horizons` comes from it exactly as before. K and CURVE_GRID derive from
# `horizons` on BOTH paths, so the two callers cannot drift apart.
if (!exists("DEMO_SOURCE_ONLY")) {
  sim <- readRDS("output/sim.rds")
  horizons <- sim$horizons
} else if (!exists("horizons")) {
  stop("DEMO_SOURCE_ONLY is set but `horizons` was not supplied by the caller")
}
K <- length(horizons)
# Dense time grid for rendering the CAST trajectory and its band. The fit is a
# quadratic in t; evaluating it only at the 5 horizons draws it as a polyline,
# which visually contradicts the smoothness that is the point of the method.
CURVE_GRID <- seq(min(horizons), max(horizons), by = 4)

# Survival probability S(tau) per patient from a grf survival_forest prediction
# matrix (rows = patients, cols = failure.times): the predicted survival at the
# largest failure time <= tau (1 if tau precedes the first failure time).
surv_at <- function(pred, times, tau) {
  j <- which(times <= tau)
  if (!length(j)) rep(1, nrow(pred)) else pred[, max(j)]
}

# Hyperparameter grid for the RSF survival forest. grf::survival_forest has no
# built-in tuner, so we search a small grid over min.node.size, sample.fraction,
# and mtry, score each candidate by out-of-bag concordance (Harrell's C) at a
# mid-window horizon, and refit at full size with the best combination.
# do_tune = FALSE returns a default-parameter forest (used by the smoke test).
tune_survival_forest <- function(Xw, Y, D, num.trees, seed, tau = 60,
                                 do_tune = TRUE) {
  if (!do_tune)
    return(survival_forest(Xw, Y, D, num.trees = num.trees, seed = seed))
  p <- ncol(Xw)
  grid <- expand.grid(min.node.size = c(5, 15, 50),
                      sample.fraction = c(0.35, 0.5),
                      mtry = unique(c(ceiling(sqrt(p)), p)))
  oob_c <- function(prm) {
    f <- survival_forest(Xw, Y, D, num.trees = max(250L, num.trees %/% 4L),
                         min.node.size = prm$min.node.size,
                         sample.fraction = prm$sample.fraction, mtry = prm$mtry,
                         compute.oob.predictions = TRUE, seed = seed)
    j        <- which.min(abs(f$failure.times - tau))
    surv_tau <- f$predictions[, j]                  # OOB survival prob at tau
    # survival::concordance scores higher predictor = longer survival, so the
    # survival probability is the correctly-oriented score (C > 0.5 = better).
    tryCatch(survival::concordance(Surv(Y, D) ~ surv_tau)$concordance,
             error = function(e) NA_real_)
  }
  scores <- vapply(seq_len(nrow(grid)), function(i) oob_c(grid[i, ]), numeric(1))
  best   <- grid[which.max(scores), ]
  survival_forest(Xw, Y, D, num.trees = num.trees,
                  min.node.size = best$min.node.size,
                  sample.fraction = best$sample.fraction, mtry = best$mtry,
                  seed = seed)
}

fit_scenario <- function(sc, label) {
  dat <- sc$data
  # Covariate matrix for the forests: confounders (age, stage, ps, comorb), the
  # prognostic non-confounder (smoke), and the negative controls (sex, ethnicity
  # one-hot encoded as eth_B / eth_C, reference = A).
  X <- cbind(age = dat$age, stage = dat$stage, ps = dat$ps, comorb = dat$comorb,
             smoke = dat$smoke, sex = dat$sex,
             eth_B = as.integer(dat$ethnicity == "B"),
             eth_C = as.integer(dat$ethnicity == "C"))
  X <- as.matrix(X)
  Y <- dat$Y; D <- dat$D; W <- dat$W
  n <- nrow(X)

  ## ---- Naive: unadjusted KM survival-probability difference ----
  naive <- naive_survprob_ate(Y, D, W, horizons)

  ## ---- Cox: confounder-adjusted, single HR + PH test ----
  cox <- coxph(Surv(Y, D) ~ W + age + stage + ps + comorb + smoke + sex +
                 factor(ethnicity), data = dat)
  cox_hr  <- unname(exp(coef(cox)["W"]))
  cox_ci  <- exp(confint(cox)["W", ])
  ph      <- tryCatch(cox.zph(cox), error = function(e) NULL)
  cox_ph_p <- if (!is.null(ph)) ph$table["W", "p"] else NA_real_

  ## ---- Cox marginal survival-probability difference (g-formula) ----
  ## Standardize the Cox fit over the covariate sample: for each horizon,
  ## mean_x[ S(t | x, W=1) - S(t | x, W=0) ] using the baseline cumulative hazard
  ## H0(t) and S(t | x, W) = exp(-H0(t) * exp(linear predictor)). This is
  ## confounder-adjusted, so its error is PH misspecification, not confounding;
  ## a single HR forces a proportional gap that cannot rise then cross.
  bh   <- basehaz(cox, centered = FALSE)
  H0t  <- function(t) { i <- which(bh$time <= t); if (!length(i)) 0 else bh$hazard[max(i)] }
  mm   <- model.matrix(~ W + age + stage + ps + comorb + smoke + sex +
                         factor(ethnicity), data = dat)[, -1]
  bco  <- coef(cox); jW <- which(names(bco) == "W")
  lp   <- as.vector(mm %*% bco)
  cox_ate <- sapply(horizons, function(t) {
    Ht <- H0t(t)
    s1 <- exp(-Ht * exp(lp + bco[jW] * (1 - mm[, "W"])))
    s0 <- exp(-Ht * exp(lp - bco[jW] * mm[, "W"]))
    mean(s1 - s0)
  })

  ## ---- propensity for CSF ----
  W_hat_raw <- as.numeric(regression_forest(X, W, num.trees = NUM_TREES,
                                            tune.parameters = TUNE,
                                            seed = FOREST_SEED)$predictions)
  # Overlap (positivity) diagnostics on the estimated propensity, before the
  # [0.01, 0.99] clip. As confounding rises, the propensity is pushed toward 0/1
  # and overlap degrades, which is what leaves the residual CSF bias visible in
  # the strong-confounding figures. Note the clip itself does NOT bind on this
  # grid: pct_clipped is 0 in all 24 published scenarios, and the realized
  # propensity envelope over the whole grid is [0.067, 0.980] at gamma = 2,
  # comfortably inside the clip. Both bounds are registered in
  # constant_registry.yaml (propensity_realized_envelope_lo / _hi) rather than
  # living only here, because this comment previously quoted ONE panel's range
  # as if it spanned all 24 and no check could see it. The residual
  # bias therefore reflects genuine overlap stress rather than the clip, which
  # is what the site's overlap card says. pct_clipped is exported so that a
  # future grid where the clip DOES bind is visible rather than assumed away.
  # grf itself warns here ("estimated treatment propensities take values very
  # close to 0 or 1") on the strong-confounding scenarios. That warning is the
  # phenomenon this demo is teaching, not a defect: it fires exactly where the
  # overlap card shows the propensity spreading toward 0/1 and where CSF's
  # residual bias appears. A full run emits several dozen of them.
  PS_LO <- 0.01; PS_HI <- 0.99
  overlap <- list(min = min(W_hat_raw), max = max(W_hat_raw),
                  pct_extreme = mean(W_hat_raw < 0.05 | W_hat_raw > 0.95),
                  pct_clipped = mean(W_hat_raw < PS_LO | W_hat_raw > PS_HI))
  W_hat <- pmin(pmax(W_hat_raw, PS_LO), PS_HI)

  ## ---- RSF S-learner plug-in (ML baseline; W as a feature, no orthogonalization) ----
  Xw <- cbind(X, W = W)
  rsf <- tune_survival_forest(Xw, Y, D, num.trees = NUM_TREES, seed = FOREST_SEED,
                              do_tune = (TUNE != "none"))
  ftimes <- rsf$failure.times
  pred1 <- predict(rsf, cbind(X, W = 1))$predictions
  pred0 <- predict(rsf, cbind(X, W = 0))$predictions
  rsf_ate <- sapply(horizons, function(t)
    mean(surv_at(pred1, ftimes, t)) - mean(surv_at(pred0, ftimes, t)))

  ## ---- T-learner: separate survival forests per arm (ML baseline, not orthogonalized) ----
  ## One forest fit on X (no W) for the treated rows, one for the control rows; each
  ## then predicts counterfactual survival for ALL patients and the
  ## survival-probability contrast is the T-learner ATE. No W-dilution (unlike the
  ## S-learner), but no propensity model
  ## (unlike CSF), so each arm extrapolates into the other's covariate space and the
  ## contrast stays biased under confounding.
  tl1 <- tune_survival_forest(X[W == 1, , drop = FALSE], Y[W == 1], D[W == 1],
                              num.trees = NUM_TREES, seed = FOREST_SEED,
                              do_tune = (TUNE != "none"))
  tl0 <- tune_survival_forest(X[W == 0, , drop = FALSE], Y[W == 0], D[W == 0],
                              num.trees = NUM_TREES, seed = FOREST_SEED,
                              do_tune = (TUNE != "none"))
  tp1 <- predict(tl1, X)$predictions; ft1 <- tl1$failure.times
  tp0 <- predict(tl0, X)$predictions; ft0 <- tl0$failure.times
  tlearner_ate <- sapply(horizons, function(t)
    mean(surv_at(tp1, ft1, t)) - mean(surv_at(tp0, ft0, t)))

  ## ---- oracle propensity: the SAME regression forest, but able to see the
  ##      latent factor. The oracle CSF refit below must use this and not W_hat.
  ##      The latent factor enters the true propensity with coefficient
  ##      0.60 * Gamma, so a propensity fit on X alone is misspecified whenever
  ##      Gamma > 0. Reusing it for the oracle leaves the orthogonalization
  ##      wrong on the treatment side, and the "oracle" then recovers only about
  ##      half of the bias it is supposed to measure (see FIXES.md).
  W_hat_oracle <- pmin(pmax(as.numeric(
    regression_forest(cbind(X, u_hidden = dat$u_hidden), W, num.trees = NUM_TREES,
                      tune.parameters = TUNE, seed = FOREST_SEED)$predictions),
    PS_LO), PS_HI)

  ## ---- CSF per horizon (survival.probability target) + doubly-robust (AIPW) scores ----
  ## csf_oracle_ate refits the SAME CSF with the latent factor added BOTH to X and
  ## to the propensity, so the gap csf_ate - csf_oracle_ate is the empirical bias
  ## from not seeing it. f_mid is
  ## the mid-horizon (60mo) forest, kept for the AUTOC (benefit-ranking) statistic.
  csf_ate <- rep(NA_real_, K); csf_se <- rep(NA_real_, K)
  csf_oracle_ate <- rep(NA_real_, K); f_mid <- NULL
  scores_mat <- matrix(NA_real_, n, K)   # column h = influence-function scores
  for (h in seq_len(K)) {
    f <- tryCatch(
      causal_survival_forest(X, Y, W, D, W.hat = W_hat, target = "survival.probability",
                             horizon = horizons[h], num.trees = NUM_TREES,
                             tune.parameters = TUNE,
                             seed = FOREST_SEED + horizons[h]),
      error = function(e) { message("  CSF h=", horizons[h], ": ", e$message); NULL })
    if (!is.null(f)) {
      a <- tryCatch(average_treatment_effect(f), error = function(e) NULL)
      if (!is.null(a)) { csf_ate[h] <- a["estimate"]; csf_se[h] <- a["std.err"] }
      sco <- tryCatch(as.numeric(get_scores(f)), error = function(e) NULL)
      if (!is.null(sco) && length(sco) == n) scores_mat[, h] <- sco
      if (horizons[h] == 60) f_mid <- f
    }
    ## oracle fit: same forest, but the latent factor is included BOTH in X and
    ## in the propensity (W.hat = W_hat_oracle). Passing the non-oracle W_hat
    ## here would leave the treatment side misspecified and understate the bias.
    fO <- tryCatch(
      causal_survival_forest(cbind(X, u_hidden = dat$u_hidden), Y, W, D,
                             W.hat = W_hat_oracle, target = "survival.probability",
                             horizon = horizons[h], num.trees = NUM_TREES,
                             tune.parameters = TUNE, seed = FOREST_SEED + horizons[h]),
      error = function(e) NULL)
    if (!is.null(fO)) {
      aO <- tryCatch(average_treatment_effect(fO), error = function(e) NULL)
      if (!is.null(aO)) csf_oracle_ate[h] <- aO["estimate"]
    }
  }

  ## ---- CAST: cross-horizon influence-function covariance -> Ledoit-Wolf
  ##      shrinkage -> WLS quadratic trajectory with a covariance-aware band ----
  ok <- is.finite(csf_ate) & apply(scores_mat, 2, function(col) all(is.finite(col)))
  if (sum(ok) >= 3) {
    sh  <- score_horizon_cov(scores_mat[, ok, drop = FALSE])
    gls <- fit_cast_trajectory(horizons[ok], csf_ate[ok], Sigma = sh$cov,
                               se_values = csf_se[ok])
    cast_pred <- gls$predict(horizons)
    cast_curve <- gls$predict(CURVE_GRID)
  } else {
    message("  [", label, "] <3 usable CSF horizons; CAST trajectory skipped")
    sh  <- list(cov = matrix(NA_real_, 1, 1), sample_cov = matrix(NA_real_, 1, 1),
                shrinkage = NA_real_, target_scale = NA_real_,
                cond_before = NA_real_, cond_after = NA_real_)
    gls <- list(beta = rep(NA_real_, 3), r_squared = NA_real_, method = NA_character_,
                peak_time = NA_real_, peak_effect = NA_real_, peak_in_range = FALSE)
    cast_pred <- list(fit = rep(NA_real_, K), se = rep(NA_real_, K))
    cast_curve <- list(fit = rep(NA_real_, length(CURVE_GRID)),
                       se  = rep(NA_real_, length(CURVE_GRID)))
  }

  ## ---- empirical robustness to the latent factor + an E-value companion ----
  ## The E-value is defined on a RISK RATIO, so the survival-probability
  ## difference has to be converted to one. That conversion needs a baseline
  ## risk, and it must be the baseline at THAT horizon: control-arm survival
  ## runs from about 0.80 at 12 months to about 0.15 at 108, so a single fixed
  ## baseline mis-anchors both ends of the window. An earlier version used a
  ## flat 0.5 at every horizon (see FIXES.md); the baseline is now the observed
  ## control-arm Kaplan-Meier survival S0_hat(t), which needs no oracle
  ## knowledge and is what a real analysis would use.
  s0_km <- vapply(horizons, function(t) km_surv_prob(Y[W == 0], D[W == 0], t),
                  numeric(1))
  rr_from_diff <- function(ate, base) {           # survival-prob diff -> risk ratio
    s0 <- pmin(pmax(base, 1e-4), 1 - 1e-4)
    s1 <- pmin(pmax(s0 + ate, 1e-4), 1 - 1e-4)
    (1 - s0) / (1 - s1)                                  # RR of the event (death)
  }
  eval_rr <- function(rr) { r <- ifelse(rr < 1, 1 / rr, rr); r + sqrt(r * (r - 1)) }
  robustness <- list(ate_omitU = csf_ate, ate_withU = csf_oracle_ate,
                     shift = csf_ate - csf_oracle_ate,
                     s0_baseline = s0_km,
                     evalue = eval_rr(rr_from_diff(csf_ate, s0_km)))

  ## ---- aggregate AUTOC (benefit ranking) at the mid horizon ----
  autoc <- list(est = NA_real_, se = NA_real_, toc = NULL)
  if (!is.null(f_mid)) {
    rate <- tryCatch(
      rank_average_treatment_effect(f_mid, priorities = predict(f_mid)$predictions,
                                    target = "AUTOC"),
      error = function(e) { message("  AUTOC: ", e$message); NULL })
    if (!is.null(rate)) {
      autoc$est <- unname(rate$estimate); autoc$se <- unname(rate$std.err)
      autoc$toc <- tryCatch({
        td   <- rate$TOC
        qcol <- if ("q" %in% names(td)) td$q else seq_len(nrow(td)) / nrow(td)
        idx  <- round(seq(1, nrow(td), length.out = min(10, nrow(td))))
        data.frame(q = qcol[idx], est = td$estimate[idx])
      }, error = function(e) NULL)
    }
  }

  ## ---- scoring against truth ----
  truth <- sc$true_ate$true_ate
  err <- function(est) {
    o <- is.finite(est) & is.finite(truth)
    if (!any(o)) return(NA_real_)
    sqrt(mean((est[o] - truth[o])^2))
  }

  cat(sprintf("  [%s] RMSE  naive=%.3f  cox=%.3f  RSF-S=%.3f  RSF-T=%.3f  CSF=%.3f  CAST=%.3f  | fit=%s LW alpha=%.3f cond %.2g->%.2g\n",
              label, err(naive), err(cox_ate), err(rsf_ate), err(tlearner_ate),
              err(csf_ate), err(cast_pred$fit), gls$method, sh$shrinkage,
              sh$cond_before, sh$cond_after))

  list(
    horizons = horizons,
    truth = truth,
    naive = naive,
    rsf = rsf_ate,
    tlearner = tlearner_ate,
    csf = list(ate = csf_ate, se = csf_se,
               lo = csf_ate - 1.96 * csf_se, hi = csf_ate + 1.96 * csf_se),
    cast = list(fit = cast_pred$fit, se = cast_pred$se,
                lo = cast_pred$fit - 1.96 * cast_pred$se,
                hi = cast_pred$fit + 1.96 * cast_pred$se,
                curve_t = CURVE_GRID, curve_fit = cast_curve$fit,
                curve_lo = cast_curve$fit - 1.96 * cast_curve$se,
                curve_hi = cast_curve$fit + 1.96 * cast_curve$se,
                beta = gls$beta, r_squared = gls$r_squared, method = gls$method,
                peak_time = gls$peak_time, peak_effect = gls$peak_effect,
                peak_in_range = gls$peak_in_range),
    cox = list(hr = cox_hr, lo = unname(cox_ci[1]), hi = unname(cox_ci[2]),
               ph_p = unname(cox_ph_p), ate = cox_ate),
    shrinkage = list(alpha = sh$shrinkage, target_scale = sh$target_scale,
                     cond_before = sh$cond_before, cond_after = sh$cond_after,
                     sample_cov = sh$sample_cov, shrunk_cov = sh$cov),
    rmse = list(naive = err(naive), cox = err(cox_ate), rsf = err(rsf_ate),
                tlearner = err(tlearner_ate),
                csf = err(csf_ate), cast = err(cast_pred$fit)),
    overlap = overlap,
    robustness = robustness,
    autoc = autoc,
    meta = sc$meta)
}

# Skipped when sourced for `fit_scenario()` alone; see the guard above.
if (!exists("DEMO_SOURCE_ONLY")) {

fits <- list()
for (key in names(sim$scenarios)) {
  cat("[02_fit] scenario", key, "\n")
  fits[[key]] <- fit_scenario(sim$scenarios[[key]], key)
}

# `subsample` travels with the results so the exporter can tell what produced
# them. Without it, running 03_export.R on its own after a smoke test would
# write a 2-scenario reduced grid straight into docs/ -- the same failure the
# smoke test's own output redirection prevents, reached by a different route.
saveRDS(list(fits = fits, horizons = horizons, curve_grid = CURVE_GRID,
             conf_grid = sim$conf_grid, unmeas_grid = sim$unmeas_grid,
             shapes = sim$shapes, subsample = SUB),
        "output/fits.rds")
cat("[02_fit] wrote output/fits.rds\n")

}   # end !exists("DEMO_SOURCE_ONLY")
