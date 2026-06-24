# 02_fit_methods.R
# Fit and score the comparators on each simulated scenario:
#   Naive : unadjusted KM RMST difference (no confounding adjustment)
#   Cox   : confounder-adjusted Cox PH (single time-constant HR; PH test)
#   RSF   : grf survival_forest S-learner plug-in RMST contrast (ML, not orthogonalized)
#   CSF   : grf causal_survival_forest per horizon (adjusts for confounding)
#   CAST  : CSF points -> bootstrap cross-horizon covariance -> Ledoit-Wolf
#           shrinkage -> GLS quadratic trajectory (+ peak metrics)
# Every method is scored against the KNOWN true ATE(t).
#
# Output: output/fits.rds

suppressWarnings(suppressMessages({
  library(grf)
  library(survival)
}))

source("R/cast_core.R")

SUB        <- as.integer(Sys.getenv("DEMO_SUBSAMPLE", "0"))
NUM_TREES  <- as.integer(Sys.getenv("DEMO_NUM_TREES", if (SUB > 0) "300" else "1000"))
B_BOOT     <- as.integer(Sys.getenv("DEMO_BOOT", if (SUB > 0) "40" else "200"))
# Fixed forest seed so the exported scenarios.json is reproducible across runs.
FOREST_SEED <- as.integer(Sys.getenv("DEMO_SEED", "101"))

sim <- readRDS("output/sim.rds")
horizons <- sim$horizons
K <- length(horizons)

# RMST at a horizon from a grf survival_forest predicted survival curve.
rmst_from_curve <- function(surv, times, tau) {
  ord <- order(times); times <- times[ord]; surv <- surv[ord]
  tt <- c(0, times); ss <- c(1, surv)
  keep <- tt <= tau
  tt <- c(tt[keep], tau); ss <- c(ss[keep], ss[sum(keep)])
  sum(diff(tt) * head(ss, -1))
}

fit_scenario <- function(sc, label) {
  dat <- sc$data
  X <- as.matrix(dat[, c("age", "stage", "ps")])
  Y <- dat$Y; D <- dat$D; W <- dat$W
  n <- nrow(X)

  ## ---- Naive: unadjusted KM RMST difference ----
  naive <- naive_rmst_ate(Y, D, W, horizons)

  ## ---- Cox: confounder-adjusted, single HR + PH test ----
  cox <- coxph(Surv(Y, D) ~ W + age + stage + ps, data = dat)
  cox_hr  <- unname(exp(coef(cox)["W"]))
  cox_ci  <- exp(confint(cox)["W", ])
  ph      <- tryCatch(cox.zph(cox), error = function(e) NULL)
  cox_ph_p <- if (!is.null(ph)) ph$table["W", "p"] else NA_real_

  ## ---- propensity for CSF ----
  W_hat <- as.numeric(regression_forest(X, W, num.trees = NUM_TREES,
                                        seed = FOREST_SEED)$predictions)
  W_hat <- pmin(pmax(W_hat, 0.01), 0.99)

  ## ---- RSF S-learner plug-in (ML baseline; W as a feature, no orthogonalization) ----
  Xw <- cbind(X, W = W)
  rsf <- survival_forest(Xw, Y, D, num.trees = NUM_TREES, seed = FOREST_SEED)
  ftimes <- rsf$failure.times
  pred1 <- predict(rsf, cbind(X, W = 1))$predictions
  pred0 <- predict(rsf, cbind(X, W = 0))$predictions
  rsf_ate <- sapply(horizons, function(t) {
    r1 <- mean(apply(pred1, 1, rmst_from_curve, times = ftimes, tau = t))
    r0 <- mean(apply(pred0, 1, rmst_from_curve, times = ftimes, tau = t))
    r1 - r0
  })

  ## ---- CSF per horizon (RMST target) ----
  forests <- vector("list", K)
  csf_ate <- rep(NA_real_, K); csf_se <- rep(NA_real_, K)
  for (h in seq_len(K)) {
    f <- tryCatch(
      causal_survival_forest(X, Y, W, D, W.hat = W_hat, target = "RMST",
                             horizon = horizons[h], num.trees = NUM_TREES,
                             seed = FOREST_SEED + horizons[h]),
      error = function(e) { message("  CSF h=", horizons[h], ": ", e$message); NULL })
    forests[h] <- list(f)   # [h]<-list() preserves NULL slots; [[h]]<-NULL would delete
    if (!is.null(f)) {
      a <- tryCatch(average_treatment_effect(f), error = function(e) NULL)
      if (!is.null(a)) { csf_ate[h] <- a["estimate"]; csf_se[h] <- a["std.err"] }
    }
  }

  ## ---- CAST: bootstrap covariance -> shrinkage -> GLS quadratic ----
  bc <- bootstrap_horizon_cov(forests, X, horizons, B = B_BOOT, seed = 7)
  ok <- is.finite(csf_ate)
  gls <- fit_gls_quadratic(horizons[ok], csf_ate[ok], Sigma = bc$cov[ok, ok, drop = FALSE],
                           se_values = csf_se[ok])
  cast_pred <- gls$predict(horizons)

  ## ---- scoring against truth ----
  truth <- sc$true_ate$true_ate
  err <- function(est) {
    o <- is.finite(est) & is.finite(truth)
    if (!any(o)) return(NA_real_)
    sqrt(mean((est[o] - truth[o])^2))
  }

  cat(sprintf("  [%s] RMSE  naive=%.2f  RSF=%.2f  CSF=%.2f  CAST=%.2f  | LW alpha=%.3f cond %.2g->%.2g\n",
              label, err(naive), err(rsf_ate), err(csf_ate), err(cast_pred$fit),
              bc$shrinkage, bc$cond_before, bc$cond_after))

  list(
    horizons = horizons,
    truth = truth,
    naive = naive,
    rsf = rsf_ate,
    csf = list(ate = csf_ate, se = csf_se,
               lo = csf_ate - 1.96 * csf_se, hi = csf_ate + 1.96 * csf_se),
    cast = list(fit = cast_pred$fit, se = cast_pred$se,
                lo = cast_pred$fit - 1.96 * cast_pred$se,
                hi = cast_pred$fit + 1.96 * cast_pred$se,
                beta = gls$beta, r_squared = gls$r_squared, method = gls$method,
                peak_time = gls$peak_time, peak_effect = gls$peak_effect,
                peak_in_range = gls$peak_in_range),
    cox = list(hr = cox_hr, lo = unname(cox_ci[1]), hi = unname(cox_ci[2]),
               ph_p = unname(cox_ph_p)),
    shrinkage = list(alpha = bc$shrinkage, target_scale = bc$target_scale,
                     cond_before = bc$cond_before, cond_after = bc$cond_after,
                     sample_cov = bc$sample_cov, shrunk_cov = bc$cov),
    rmse = list(naive = err(naive), rsf = err(rsf_ate),
                csf = err(csf_ate), cast = err(cast_pred$fit)),
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
