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
# Bootstrap cross-horizon covariance of the ATE estimates.
# Patient-level resampling (the independent unit): for each bootstrap replicate
# we resample patients with replacement and re-predict the per-horizon ATE from
# the already-fitted causal survival forests, then form the covariance across
# horizons and stabilize it with Ledoit-Wolf shrinkage.
# ---------------------------------------------------------------------------
bootstrap_horizon_cov <- function(forests, X, horizons, B = 200, seed = 42,
                                  verbose = FALSE) {
  n <- nrow(X)
  K <- length(horizons)
  est <- matrix(NA_real_, nrow = B, ncol = K)
  set.seed(seed)
  for (b in 1:B) {
    idx <- sample.int(n, n, replace = TRUE)
    Xb <- X[idx, , drop = FALSE]
    for (h in seq_len(K)) {
      f <- forests[[h]]
      if (!is.null(f)) {
        pr <- tryCatch(predict(f, Xb)$predictions, error = function(e) NA_real_)
        est[b, h] <- mean(pr, na.rm = TRUE)
      }
    }
    if (verbose && b %% 50 == 0) cat("    bootstrap", b, "of", B, "\n")
  }

  cc <- stats::complete.cases(est)
  if (sum(cc) < 10) cc <- rep(TRUE, B)
  lw <- ledoit_wolf_shrinkage(est[cc, , drop = FALSE], verbose = verbose)

  cov_matrix <- lw$cov
  # Safety: nudge / eigen-floor if still ill-conditioned (mirrors production code).
  cond_after <- tryCatch(kappa(cov_matrix, exact = TRUE), error = function(e) Inf)
  if (is.infinite(cond_after) || cond_after > 1e10) {
    nudge <- max(diag(cov_matrix)) * 1e-4
    cov_matrix <- cov_matrix + diag(rep(nudge, ncol(cov_matrix)))
  }
  ev <- eigen(cov_matrix, only.values = TRUE)$values
  if (any(ev <= 0)) {
    eig <- eigen(cov_matrix)
    eig$values[eig$values <= 0] <- min(eig$values[eig$values > 0]) * 1e-3
    cov_matrix <- eig$vectors %*% diag(eig$values) %*% t(eig$vectors)
  }

  list(cov = cov_matrix, sample_cov = lw$sample_cov, shrinkage = lw$shrinkage,
       target_scale = lw$target_scale, cond_before = lw$cond_before,
       cond_after = tryCatch(kappa(cov_matrix, exact = TRUE),
                             error = function(e) NA_real_),
       boot_estimates = est[cc, , drop = FALSE])
}

# ---------------------------------------------------------------------------
# GLS quadratic trajectory fit:  beta = (X' Sigma^-1 X)^-1 X' Sigma^-1 y
# Design X = [1, t, t^2]; Sigma is the shrunk cross-horizon covariance.
# Falls back to weighted least squares if Sigma is not usable.
# ---------------------------------------------------------------------------
fit_gls_quadratic <- function(horizons, estimates, Sigma = NULL,
                              se_values = NULL) {
  Xd <- cbind(1, horizons, horizons^2)
  w_wls <- if (is.null(se_values)) rep(1, length(estimates)) else 1 / se_values^2

  solve_with <- function(Wmat) {
    XtW <- t(Xd) %*% Wmat
    vb <- tryCatch(solve(XtW %*% Xd), error = function(e) NULL)
    if (is.null(vb)) return(NULL)
    list(beta = as.vector(vb %*% XtW %*% estimates), var_beta = vb)
  }

  # Try GLS with the (shrunk) cross-horizon covariance, but accept it only if the
  # covariance-weighted fit is reliable. Under near-perfectly-correlated horizons
  # and a slightly misspecified quadratic, GLS can drift in level; production CAST
  # falls back to weighted least squares in that case. (Mirrors that guard.)
  method <- "WLS"; beta <- NULL; var_beta <- NULL
  if (!is.null(Sigma)) {
    Sinv <- tryCatch(solve(Sigma), error = function(e) NULL)
    if (!is.null(Sinv)) {
      g <- solve_with(Sinv)
      if (!is.null(g) && all(is.finite(g$beta))) {
        fit_g <- as.vector(Xd %*% g$beta)
        res_g <- estimates - fit_g
        ss_tot <- sum((estimates - mean(estimates))^2)
        r2_g <- if (ss_tot > 0) 1 - sum(res_g^2) / ss_tot else NA_real_
        rel_bias  <- mean(abs(res_g)) / (mean(abs(estimates)) + 1e-8)
        max_ratio <- max(abs(res_g)) / (max(abs(estimates)) + 1e-10)
        if (is.finite(r2_g) && r2_g >= 0.5 && rel_bias <= 0.15 && max_ratio <= 10) {
          method <- "GLS"; beta <- g$beta; var_beta <- g$var_beta
        }
      }
    }
  }
  if (is.null(beta)) {                       # WLS fallback (or no covariance given)
    wl <- solve_with(diag(w_wls))
    beta <- wl$beta; var_beta <- wl$var_beta; method <- "WLS"
  }

  fitted <- as.vector(Xd %*% beta)
  resid <- estimates - fitted
  ss_tot <- sum((estimates - mean(estimates))^2)
  r2 <- if (ss_tot > 0) 1 - sum(resid^2) / ss_tot else NA_real_

  # Vertex of the quadratic: peak (or trough) time and effect.
  b0 <- beta[1]; b1 <- beta[2]; b2 <- beta[3]
  peak_time <- if (abs(b2) > 1e-12) -b1 / (2 * b2) else NA_real_
  peak_in_range <- is.finite(peak_time) &&
    peak_time >= min(horizons) && peak_time <= max(horizons)
  peak_effect <- if (peak_in_range) b0 + b1 * peak_time + b2 * peak_time^2 else NA_real_

  predict_fn <- function(h) {
    Xh <- cbind(1, h, h^2)
    fit <- as.vector(Xh %*% beta)
    se <- sqrt(pmax(0, diag(Xh %*% var_beta %*% t(Xh))))
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
