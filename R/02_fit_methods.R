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

sim <- readRDS("output/sim.rds")
horizons <- sim$horizons
K <- length(horizons)

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
  # [0.01, 0.99] clip. As confounding rises, the propensity is pushed toward 0/1,
  # overlap degrades, and more patients are clipped -- which is what leaves the
  # residual CSF bias visible in the strong-confounding figures.
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
  ## then predicts counterfactual survival for ALL patients and the RMST contrast is
  ## the T-learner ATE. No W-dilution (unlike the S-learner), but no propensity model
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

  ## ---- CSF per horizon (survival.probability target) + doubly-robust (AIPW) scores ----
  csf_ate <- rep(NA_real_, K); csf_se <- rep(NA_real_, K)
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
  } else {
    message("  [", label, "] <3 usable CSF horizons; CAST trajectory skipped")
    sh  <- list(cov = matrix(NA_real_, 1, 1), sample_cov = matrix(NA_real_, 1, 1),
                shrinkage = NA_real_, target_scale = NA_real_,
                cond_before = NA_real_, cond_after = NA_real_)
    gls <- list(beta = rep(NA_real_, 3), r_squared = NA_real_, method = NA_character_,
                peak_time = NA_real_, peak_effect = NA_real_, peak_in_range = FALSE)
    cast_pred <- list(fit = rep(NA_real_, K), se = rep(NA_real_, K))
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
    meta = sc$meta)
}

fits <- list()
for (key in names(sim$scenarios)) {
  cat("[02_fit] scenario", key, "\n")
  fits[[key]] <- fit_scenario(sim$scenarios[[key]], key)
}

saveRDS(list(fits = fits, horizons = horizons,
             conf_grid = sim$conf_grid, shapes = sim$shapes),
        "output/fits.rds")
cat("[02_fit] wrote output/fits.rds\n")
