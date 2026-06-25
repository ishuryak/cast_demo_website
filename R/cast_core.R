# cast_core.R
# Core CAST routines for the demo, ported faithfully from the production glioma
# pipeline (time_varying_effects.R): Ledoit-Wolf covariance shrinkage, a
# bootstrap cross-horizon covariance estimator, and the GLS quadratic
# trajectory fit. Kept self-contained so the demo runs the real method.

# ---------------------------------------------------------------------------
# Ledoit-Wolf shrinkage estimator for covariance matrices.
# Shrinks the sample covariance toward a scaled-identity target F = mu * I to
# improve conditioning and invertibility.
# Reference: Ledoit & Wolf (2004), J. Multivariate Analysis 88(2):365-411.
# (Ported verbatim from the production pipeline.)
# ---------------------------------------------------------------------------
ledoit_wolf_shrinkage <- function(X, verbose = FALSE) {
  # X: n x p matrix of observations (rows = bootstrap replicates, cols = horizons)
  n <- nrow(X)
  p <- ncol(X)

  # Sample covariance matrix S
  S <- cov(X)

  # Target: scaled identity F = mu * I_p, mu = average sample variance
  mu <- sum(diag(S)) / p

  # Optimal shrinkage intensity (Ledoit-Wolf closed form).
  X_centered <- scale(X, center = TRUE, scale = FALSE)
  sum_sq <- 0
  for (i in 1:n) {
    x_i <- X_centered[i, , drop = FALSE]
    outer_prod <- t(x_i) %*% x_i
    sum_sq <- sum_sq + sum((outer_prod - S)^2)
  }
  beta_numerator <- sum_sq / (n^2)            # estimated variance of S (noise)

  delta <- S - mu * diag(p)
  beta_denominator <- sum(delta^2)            # squared distance sample -> target

  if (beta_denominator < 1e-20) {
    alpha <- 0
  } else {
    alpha <- min(1, max(0, beta_numerator / beta_denominator))
  }

  # Shrunk covariance: (1 - alpha) S + alpha * mu I
  S_shrunk <- alpha * mu * diag(p) + (1 - alpha) * S

  cond_before <- tryCatch(kappa(S, exact = TRUE), error = function(e) NA_real_)
  cond_after  <- tryCatch(kappa(S_shrunk, exact = TRUE), error = function(e) NA_real_)
  if (verbose) {
    cat(sprintf("  Ledoit-Wolf: alpha=%.4f  cond(S)=%.3g  cond(shrunk)=%.3g\n",
                alpha, cond_before, cond_after))
  }

  list(cov = S_shrunk, shrinkage = alpha, target_scale = mu, sample_cov = S,
       cond_before = cond_before, cond_after = cond_after)
}

# ---------------------------------------------------------------------------
# Cross-horizon covariance of the per-horizon ATE estimates, from the CSF
# doubly-robust (AIPW) influence-function scores.
# grf's average_treatment_effect() reports estimate = mean(scores) and
# SE = sqrt(var(scores) / n), so the covariance of the ATE *vector* across
# horizons is cov(Psi) / n, where Psi is the n x K matrix whose column h holds
# the per-patient scores at horizon h (patient-aligned across horizons). This is
# the correct asymptotic covariance (full rank, n >> K) and is stabilized with
# Ledoit-Wolf shrinkage. It replaces the earlier fixed-forest patient bootstrap,
# whose band was only conditional on the forests.
# ---------------------------------------------------------------------------
score_horizon_cov <- function(scores, verbose = FALSE) {
  # scores: n x K matrix; column h = get_scores() for the horizon-h CSF forest.
  cc <- stats::complete.cases(scores)
  if (sum(cc) < 10) cc <- rep(TRUE, nrow(scores))
  S  <- scores[cc, , drop = FALSE]
  nS <- nrow(S)

  lw <- ledoit_wolf_shrinkage(S, verbose = verbose)   # shrinks the K x K score cov
  cov_matrix <- lw$cov / nS                            # -> covariance of the ATE vector

  # Safety: eigen-floor to positive definite (condition number is scale-free, so
  # dividing by nS does not change cond_before / cond_after from ledoit_wolf).
  ev <- eigen(cov_matrix, only.values = TRUE)$values
  if (any(ev <= 0)) {
    eig <- eigen(cov_matrix)
    pos <- eig$values[eig$values > 0]
    floor_val <- if (length(pos)) min(pos) * 1e-3 else 1e-12  # guard all-<=0 case
    eig$values[eig$values <= 0] <- floor_val
    cov_matrix <- eig$vectors %*% diag(eig$values) %*% t(eig$vectors)
  }

  list(cov = cov_matrix, sample_cov = lw$sample_cov / nS, shrinkage = lw$shrinkage,
       target_scale = lw$target_scale / nS, cond_before = lw$cond_before,
       cond_after = tryCatch(kappa(cov_matrix, exact = TRUE),
                             error = function(e) NA_real_))
}

# ---------------------------------------------------------------------------
# CAST trajectory: a smooth quadratic in time fit to the per-horizon CSF effects,
# with a covariance-aware simultaneous band built from the shrunk cross-horizon
# covariance Sigma. Design X = [1, t, t^2].
#
# Point estimate: weighted least squares (weights 1 / SE^2), which is robust for
# the near-collinear cumulative-RMST horizons. Generalized least squares
# (weight = Sigma^-1) is used automatically ONLY when Sigma is well-conditioned
# (cond <= gls_cond_max) and the fit is sane; for cumulative RMST the horizons are
# ~perfectly correlated, so Sigma is ill-conditioned and the fit stays WLS.
#
# Uncertainty: the fitted-coefficient covariance is the sandwich
#   Var(beta) = (X'WX)^-1 (X'W Sigma W X) (X'WX)^-1,
# with W the fitting weight matrix. This propagates the cross-horizon correlation
# into the band; independent per-horizon SEs (W with Sigma = diag(SE^2)) would
# understate it. When W = Sigma^-1 (the GLS case) the sandwich collapses to the
# efficient (X' Sigma^-1 X)^-1.
# ---------------------------------------------------------------------------
fit_cast_trajectory <- function(horizons, estimates, Sigma = NULL,
                                se_values = NULL, gls_cond_max = 100) {
  Xd <- cbind(1, horizons, horizons^2)
  w  <- if (is.null(se_values)) rep(1, length(estimates)) else 1 / se_values^2

  # Choose the point-fit weight matrix: GLS only if Sigma is well-conditioned.
  method <- "WLS"; Wmat <- diag(w, nrow = length(w))
  if (!is.null(Sigma)) {
    cond <- tryCatch(kappa(Sigma, exact = TRUE), error = function(e) Inf)
    Sinv <- tryCatch(solve(Sigma), error = function(e) NULL)
    if (is.finite(cond) && cond <= gls_cond_max && !is.null(Sinv)) {
      vb <- tryCatch(solve(t(Xd) %*% Sinv %*% Xd), error = function(e) NULL)
      if (!is.null(vb)) {
        bg  <- as.vector(vb %*% t(Xd) %*% Sinv %*% estimates)
        res <- estimates - as.vector(Xd %*% bg)
        sst <- sum((estimates - mean(estimates))^2)
        r2g <- if (sst > 0) 1 - sum(res^2) / sst else NA_real_
        if (is.finite(r2g) && r2g >= 0.5) { method <- "GLS"; Wmat <- Sinv }
      }
    }
  }

  XtW   <- t(Xd) %*% Wmat
  bread <- tryCatch(solve(XtW %*% Xd),
                    error = function(e) solve(XtW %*% Xd + diag(1e-8, ncol(Xd))))
  beta  <- as.vector(bread %*% XtW %*% estimates)

  # Covariance-aware sandwich for the fitted coefficients.
  Sig_use  <- if (!is.null(Sigma)) Sigma else
              diag(if (is.null(se_values)) rep(1, length(estimates)) else se_values^2,
                   nrow = length(estimates))
  meat     <- XtW %*% Sig_use %*% t(XtW)        # X'W Sigma W X (Wmat symmetric)
  var_beta <- bread %*% meat %*% bread

  fitted <- as.vector(Xd %*% beta)
  resid  <- estimates - fitted
  sst    <- sum((estimates - mean(estimates))^2)
  r2     <- if (sst > 0) 1 - sum(resid^2) / sst else NA_real_

  # Vertex of the quadratic: peak (or trough) time and effect.
  b0 <- beta[1]; b1 <- beta[2]; b2 <- beta[3]
  peak_time <- if (abs(b2) > 1e-12) -b1 / (2 * b2) else NA_real_
  peak_in_range <- is.finite(peak_time) &&
    peak_time >= min(horizons) && peak_time <= max(horizons)
  peak_effect <- if (peak_in_range) b0 + b1 * peak_time + b2 * peak_time^2 else NA_real_

  predict_fn <- function(h) {
    Xh <- cbind(1, h, h^2)
    fit <- as.vector(Xh %*% beta)
    se  <- sqrt(pmax(0, diag(Xh %*% var_beta %*% t(Xh))))
    list(fit = fit, se = se)
  }

  list(beta = beta, var_beta = var_beta, fitted = fitted, residuals = resid,
       r_squared = r2, method = method, peak_time = peak_time,
       peak_effect = peak_effect, peak_in_range = peak_in_range,
       predict = predict_fn)
}

# ---------------------------------------------------------------------------
# True (oracle) RMST-scale ATE over a covariate sample, computed from the known
# potential-outcome survival curves S0, S1 on a fine time grid.
# RMST_w(t | x) = integral_0^t S_w(u | x) du ; ATE(t) = mean_x [RMST_1 - RMST_0].
# S0, S1 are n x length(grid) matrices on the shared `grid`.
# ---------------------------------------------------------------------------
true_rmst_ate <- function(S0, S1, grid, horizons) {
  du <- diff(grid)
  # trapezoidal cumulative integral of each survival curve along the grid
  cum_integral <- function(S) {
    mids <- (S[, -1, drop = FALSE] + S[, -ncol(S), drop = FALSE]) / 2
    inc <- sweep(mids, 2, du, `*`)
    cbind(0, t(apply(inc, 1, cumsum)))   # n x length(grid), value at grid[j]
  }
  R0 <- cum_integral(S0)
  R1 <- cum_integral(S1)
  sapply(horizons, function(t) {
    j <- which.min(abs(grid - t))
    mean(R1[, j] - R0[, j])
  })
}

# ---------------------------------------------------------------------------
# Unadjusted ("naive") RMST difference at each horizon from arm-specific
# Kaplan-Meier curves (RMST = area under KM up to the horizon).
# ---------------------------------------------------------------------------
km_rmst <- function(time, status, tau) {
  fit <- survival::survfit(survival::Surv(time, status) ~ 1)
  tt <- c(0, fit$time)
  ss <- c(1, fit$surv)
  keep <- tt <= tau
  tt <- c(tt[keep], tau)
  ss <- c(ss[keep], ss[sum(keep)])
  sum(diff(tt) * head(ss, -1))
}

naive_rmst_ate <- function(time, status, W, horizons) {
  sapply(horizons, function(t) {
    r1 <- km_rmst(time[W == 1], status[W == 1], t)
    r0 <- km_rmst(time[W == 0], status[W == 0], t)
    r1 - r0
  })
}
