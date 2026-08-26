# tests/test_cast_core.R
# Invariants and golden values for R/cast_core.R -- the parts of the demo that
# are pure R and must not move when grf, or anything else, is upgraded.
#
# The golden values below were produced under:
#   R 4.5.1, base + stats only (cast_core.R uses no external package for these
#   paths; survival is needed only by km_surv_prob).
# They are arithmetic on fixed inputs, so an exact-to-1e-8 tolerance is right:
# these are not stochastic estimates and any movement is a real change in the
# math, not platform noise. If one legitimately changes, update it in the same
# commit as the change and name the cause in the commit message.

source("R/cast_core.R")

fails <- 0L
ok <- function(what, cond) {
  if (isTRUE(cond)) cat(sprintf("  ok    %s\n", what))
  else { cat(sprintf("  FAIL  %s\n", what)); fails <<- fails + 1L }
}
near <- function(what, got, want, tol = 1e-8)
  ok(sprintf("%s = %.10g (want %.10g)", what, got, want),
     is.finite(got) && abs(got - want) < tol)

cat("test_cast_core.R\n")

# =========================================================================
# 1. Ledoit-Wolf shrinkage
# =========================================================================
set.seed(20260825)
X <- matrix(rnorm(400 * 4), 400, 4)
lw <- ledoit_wolf_shrinkage(X)

ok("shrinkage intensity is a valid convex weight",
   lw$shrinkage >= 0 && lw$shrinkage <= 1)
ok("shrunk covariance is symmetric",
   max(abs(lw$cov - t(lw$cov))) < 1e-12)
ok("shrunk covariance is positive definite",
   min(eigen(lw$cov, only.values = TRUE)$values) > 0)
ok("target scale mu is the mean sample variance",
   abs(lw$target_scale - mean(diag(lw$sample_cov))) < 1e-12)
ok("shrinking never worsens the condition number",
   lw$cond_after <= lw$cond_before + 1e-9)
# the defining identity: S_shrunk = (1 - a) S + a mu I
ok("shrunk = (1 - alpha) * S + alpha * mu * I",
   max(abs(lw$cov - ((1 - lw$shrinkage) * lw$sample_cov +
                     lw$shrinkage * lw$target_scale * diag(4)))) < 1e-12)
# GOLDEN: fixed seed, fixed arithmetic
# alpha is HIGH here on purpose: the fixture is iid standard normal, so the
# scaled-identity target is the true covariance and near-full shrinkage is the
# correct Ledoit-Wolf answer, not a bug.
near("golden LW alpha", lw$shrinkage, 0.9430946453, 1e-8)
near("golden LW mu",    lw$target_scale, 1.0187750282, 1e-8)

# A sample covariance already AT the target must not be shrunk away from it.
Xiso <- diag(4)[rep(1:4, 50), ] * 0        # zero variance -> delta == 0 branch
Xiso <- Xiso + matrix(rep(c(1, -1), each = 100 * 2), 200, 4)
lw0 <- ledoit_wolf_shrinkage(Xiso)
ok("degenerate (zero-spread) input returns alpha = 0 rather than NaN",
   is.finite(lw0$shrinkage) && lw0$shrinkage == 0)

# =========================================================================
# 2. Cross-horizon covariance from influence-function scores
# =========================================================================
# grf reports SE = sqrt(var(scores)/n), so the covariance of the ATE VECTOR is
# cov(Psi)/n. Check the scaling explicitly rather than trusting the comment.
set.seed(7)
n <- 500; K <- 5
Psi <- matrix(rnorm(n * K), n, K) %*% chol(matrix(0.4, K, K) + diag(0.6, K))
sh <- score_horizon_cov(Psi)
ok("score covariance is K x K", all(dim(sh$cov) == c(K, K)))
ok("cov(ATE vector) is the shrunk score covariance divided by n",
   max(abs(sh$cov * n - ((1 - sh$shrinkage) * (sh$sample_cov * n) +
                         sh$shrinkage * (sh$target_scale * n) * diag(K)))) < 1e-10)
ok("implied per-horizon SE matches sqrt(var(scores)/n)",
   max(abs(sqrt(diag(sh$sample_cov)) -
           apply(Psi, 2, function(c) sd(c) / sqrt(n)))) < 1e-10)
ok("condition number is scale-free (dividing by n does not change it)",
   abs(sh$cond_after - kappa(sh$cov, exact = TRUE)) < 1e-6)
ok("result is positive definite", min(eigen(sh$cov, only.values = TRUE)$values) > 0)

# =========================================================================
# 3. Trajectory fit: GLS branch, sandwich, and vertex
# =========================================================================
h <- c(12, 36, 60, 84, 108)
# an EXACT quadratic, so r2 = 1 and the GLS branch must engage
beta_true <- c(-0.05, 0.006, -0.00004)
y <- beta_true[1] + beta_true[2] * h + beta_true[3] * h^2
Sig <- diag(rep(4e-5, 5)) + 1e-5           # well-conditioned, correlated
fit <- fit_cast_trajectory(h, y, Sigma = Sig, se_values = rep(0.007, 5))

ok("GLS engages on a well-conditioned Sigma with a good fit", fit$method == "GLS")
ok("an exact quadratic is recovered exactly",
   max(abs(fit$beta - beta_true)) < 1e-10)
near("R^2 of an exact quadratic", fit$r_squared, 1, 1e-12)
# Under W = Sigma^-1 the sandwich must collapse to (X' Sigma^-1 X)^-1.
Xd <- cbind(1, h, h^2)
ok("sandwich collapses to (X' Sigma^-1 X)^-1 in the GLS case",
   max(abs(fit$var_beta - solve(t(Xd) %*% solve(Sig) %*% Xd))) < 1e-14)
# vertex of the quadratic
near("peak time is the quadratic vertex", fit$peak_time,
     -beta_true[2] / (2 * beta_true[3]), 1e-6)
ok("a vertex outside the horizon window is reported as out of range",
   !fit_cast_trajectory(h, 0.01 * h, Sigma = Sig,
                        se_values = rep(0.007, 5))$peak_in_range)

# An ill-conditioned Sigma must fall back to WLS rather than inverting it.
Sig_bad <- outer(1:5, 1:5, function(i, j) 0.999^abs(i - j)) * 1e-4
Sig_bad <- Sig_bad + diag(1e-12, 5)
se_uneq <- c(0.004, 0.006, 0.007, 0.009, 0.012)     # non-uniform, so W is not a scalar
fit_w   <- fit_cast_trajectory(h, y, Sigma = Sig_bad, se_values = se_uneq)
ok("an ill-conditioned Sigma falls back to WLS", fit_w$method == "WLS")

# The sandwich, checked where it actually bites. In the GLS case
# Var(beta) = (X'Sigma^-1 X)^-1 == bread, so a check written only against the GLS
# case still passes when the meat term X'W Sigma W X is deleted entirely: it is
# vacuous. (Confirmed by mutation: dropping the meat left the GLS assertion
# green.) Under WLS the weight matrix is NOT Sigma^-1, so bread and the full
# sandwich differ and the assertion has teeth.
Wm     <- diag(1 / se_uneq^2)
XtW    <- t(Xd) %*% Wm
bread  <- solve(XtW %*% Xd)
sand   <- bread %*% (XtW %*% Sig_bad %*% t(XtW)) %*% bread
ok("WLS variance is the full sandwich bread %*% (X'W Sigma W X) %*% bread",
   max(abs(fit_w$var_beta - sand)) < 1e-16)
ok("the sandwich is not merely the bread (so the check discriminates)",
   max(abs(sand - bread)) > 1e-12)

# The band must widen when the horizons are correlated: treating them as
# independent is exactly the understatement the sandwich exists to avoid.
se_corr  <- fit$predict(h)$se
fit_ind  <- fit_cast_trajectory(h, y, Sigma = diag(diag(Sig)),
                                se_values = rep(0.007, 5))
ok("correlated horizons give a wider band than independent ones",
   mean(se_corr) > mean(fit_ind$predict(h)$se))
# GOLDEN: mean pointwise SE of the fitted trajectory on the fixture above
near("golden mean pointwise SE", mean(se_corr), 0.0057752685, 1e-8)

# =========================================================================
# 4. Oracle truth and the naive estimator
# =========================================================================
grid <- seq(0, 210, by = 0.5)
S0 <- matrix(exp(-grid / 100), nrow = 2, ncol = length(grid), byrow = TRUE)
S1 <- matrix(exp(-grid / 200), nrow = 2, ncol = length(grid), byrow = TRUE)
tr <- true_survprob_ate(S0, S1, grid, c(12, 60))
near("true ATE at t = 12", tr[1], exp(-12/200) - exp(-12/100), 1e-12)
near("true ATE at t = 60", tr[2], exp(-60/200) - exp(-60/100), 1e-12)
ok("true ATE is the mean over patients, not the sum",
   length(tr) == 2 && all(abs(tr) < 1))

# With no censoring, the KM survival probability is the empirical proportion.
set.seed(11)
tt <- rexp(500, 1 / 50); st <- rep(1L, 500)
near("KM with no censoring is the empirical survivor function",
     km_surv_prob(tt, st, 40), mean(tt > 40), 1e-9)
w <- rep(0:1, each = 250)
nv <- naive_survprob_ate(tt, st, w, c(40))
near("naive difference is arm 1 minus arm 0",
     nv[1], mean(tt[w == 1] > 40) - mean(tt[w == 0] > 40), 1e-9)

cat(sprintf("test_cast_core.R: %s (%d failure%s)\n",
            if (fails == 0L) "PASS" else "FAIL", fails,
            if (fails == 1L) "" else "s"))
quit(status = if (fails == 0L) 0L else 1L)
