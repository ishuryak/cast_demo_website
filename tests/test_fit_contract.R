# tests/test_fit_contract.R
# Source-level contract for R/02_fit_methods.R: two properties that are true of
# the estimation code but invisible in its output, plus the E-value arithmetic.
#
# Both regressions guarded here produced entirely plausible, well-formed,
# internally consistent numbers. Neither would fail any freshness, existence or
# range check, which is why they are pinned at the source level rather than by
# eyeballing an estimate.
#
#   1. The ORACLE CSF refit must receive an oracle PROPENSITY.
#      The latent factor enters the true propensity with coefficient
#      0.60 * Gamma, so a propensity fit without it is misspecified whenever
#      Gamma > 0. An oracle given the latent factor only in the outcome model
#      leaves the orthogonalization wrong on the treatment side: measured over
#      the published grid, the oracle gap then captured a mean of 53% of the
#      actual bias (as little as 8%), while the site described that gap as "the
#      empirical bias from not seeing it".
#
#   2. The E-value's risk-ratio conversion must be anchored per horizon.
#      Control-arm survival runs from about 0.80 at 12 months to about 0.15 at
#      108. A fixed baseline (the code used a flat 0.5 at every horizon)
#      mis-anchors both ends of the window and was documented nowhere.
#
# Pure text and arithmetic: no pipeline run, no grf, no fitted objects needed.

src_file <- "R/02_fit_methods.R"
src <- paste(readLines(src_file, warn = FALSE), collapse = "\n")

fails <- 0L
ok <- function(what, cond) {
  if (isTRUE(cond)) cat(sprintf("  ok    %s\n", what))
  else { cat(sprintf("  FAIL  %s\n", what)); fails <<- fails + 1L }
}
# Text of the call to `fn` that starts at the first match of `anchor`, up to the
# closing paren of its argument list (brace-naive, adequate for a call).
call_after <- function(anchor) {
  i <- regexpr(anchor, src, fixed = TRUE)
  if (i < 0) return("")
  substr(src, i, min(nchar(src), i + 600L))
}

cat("test_fit_contract.R\n")

# ---- 1. the oracle refit is a FULL oracle ---------------------------------
# The oracle propensity must exist and must be fit on a design matrix that
# includes the latent factor.
ok("an oracle propensity W_hat_oracle is computed at all",
   grepl("W_hat_oracle\\s*<-", src))

oracle_ps <- call_after("W_hat_oracle <- ")
ok("the oracle propensity forest sees the latent factor",
   grepl("regression_forest\\(\\s*cbind\\(X, u_hidden", oracle_ps))

# The oracle causal_survival_forest must be handed that oracle propensity, not
# the one estimated without the latent factor. This is the exact line that was
# wrong: `W.hat = W_hat` on a forest whose X already had u_hidden.
oracle_csf <- call_after("causal_survival_forest(cbind(X, u_hidden = dat$u_hidden)")
ok("the oracle CSF refit exists",             nchar(oracle_csf) > 0)
ok("the oracle CSF refit uses W_hat_oracle",  grepl("W.hat = W_hat_oracle", oracle_csf, fixed = TRUE))
ok("the oracle CSF refit does NOT reuse the non-oracle W_hat",
   !grepl("W.hat = W_hat,", oracle_csf, fixed = TRUE))

# The NON-oracle CSF must keep using the non-oracle propensity: leaking the
# oracle propensity into the main fit would be the same defect mirrored, and
# would quietly improve every headline estimate.
main_csf <- call_after("causal_survival_forest(X, Y, W, D")
ok("the main CSF fit exists",                       nchar(main_csf) > 0)
ok("the main CSF fit uses the non-oracle W_hat",    grepl("W.hat = W_hat,", main_csf, fixed = TRUE))
ok("the main CSF fit does NOT see the latent factor",
   !grepl("u_hidden", main_csf, fixed = TRUE))

# Nothing outside the two oracle constructs may touch the latent factor.
u_lines <- grep("u_hidden", readLines(src_file, warn = FALSE), value = TRUE)
u_lines <- u_lines[!grepl("^\\s*#", u_lines)]          # drop comment-only lines
ok("the latent factor appears only in the oracle propensity and the oracle refit",
   length(u_lines) == 2L)

# ---- 2. the E-value baseline is per-horizon, not a fixed constant ----------
ok("a per-horizon control-arm baseline is computed",
   grepl("s0_km\\s*<-\\s*vapply", src))
ok("the baseline comes from the CONTROL arm's Kaplan-Meier curve",
   grepl("km_surv_prob\\(Y\\[W == 0\\], D\\[W == 0\\], t\\)", src))
ok("the baseline is exported so the anchor is inspectable",
   grepl("s0_baseline", src))
ok("rr_from_diff takes a baseline argument with NO default",
   grepl("rr_from_diff <- function\\(ate, base\\)", src))
ok("no flat 0.5 baseline survives anywhere in the conversion",
   !grepl("base\\s*=\\s*0\\.5", src))
ok("the E-value is computed against the per-horizon baseline",
   grepl("rr_from_diff\\(csf_ate, s0_km\\)", src))

# ---- 3. the E-value arithmetic itself --------------------------------------
# Reimplemented independently here: RR of the EVENT (death) = (1-S0)/(1-S1),
# and VanderWeele & Ding's E-value = RR + sqrt(RR * (RR - 1)) on the >= 1 side.
rr    <- function(ate, s0) (1 - s0) / (1 - (s0 + ate))
ev    <- function(r) { r <- ifelse(r < 1, 1 / r, r); r + sqrt(r * (r - 1)) }
ok("a null effect gives RR = 1",                    abs(rr(0, 0.4) - 1) < 1e-12)
ok("a null effect gives the minimum E-value of 1",  abs(ev(rr(0, 0.4)) - 1) < 1e-12)
ok("a protective effect raises the E-value above 1", ev(rr(0.1, 0.4)) > 1)
ok("the E-value is symmetric under inverting the risk ratio",
   abs(ev(2) - ev(0.5)) < 1e-12)
# The property the fix is about: the SAME survival-probability difference maps
# to a different E-value at a different baseline. If it did not, anchoring per
# horizon would be pointless and a flat 0.5 would have been harmless.
ok("the same ATE gives different E-values at 12-month and 108-month baselines",
   abs(ev(rr(0.1, 0.80)) - ev(rr(0.1, 0.15))) > 0.5)

cat(sprintf("test_fit_contract.R: %s (%d failure%s)\n",
            if (fails == 0L) "PASS" else "FAIL", fails,
            if (fails == 1L) "" else "s"))
quit(status = if (fails == 0L) 0L else 1L)
