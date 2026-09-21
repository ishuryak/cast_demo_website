# CAST class lab: fit the supplied synthetic cohort.
# Open R in the unzipped kit directory, then:
# install.packages(c("survival", "grf"))  # once, if needed
# source("class-lab.R")
# result <- analyze_demo()
#
# The unchanged CAST implementation is in R/cast_core.R (Igor Shuryak, MIT).
# No patient answer key, outcome under another treatment, or hidden variable
# enters X. The oracle averages are read only after estimation, for comparison.

analyze_demo <- function(kit_dir = ".", num_trees = 300L, seed = 20260905L,
                         output_dir = file.path(kit_dir, "results")) {
  stopifnot(length(num_trees) == 1, is.finite(num_trees), num_trees >= 100)
  for (package in c("survival", "grf")) {
    if (!requireNamespace(package, quietly = TRUE))
      stop("Install required package first: ", package)
  }
  kit_dir <- normalizePath(kit_dir, mustWork = TRUE)
  d <- read.csv(file.path(kit_dir, "data/demo-cohort.csv"))
  covariates <- c("age", "stage", "ps", "comorb", "smoke", "sex", "ethnicity")
  stopifnot(all(c(covariates, "Y", "W", "D") %in% names(d)), nrow(d) >= 200,
            !anyNA(d), all(d$W %in% 0:1), all(d$D %in% 0:1),
            length(unique(d$W)) == 2, all(is.finite(d$Y)), all(d$Y >= 0))
  X <- model.matrix(~ age + stage + ps + comorb + smoke + sex + factor(ethnicity), d)[, -1, drop = FALSE]
  methods <- new.env(parent = globalenv())
  sys.source(file.path(kit_dir, "R/cast_core.R"), envir = methods)
  horizons <- c(12, 36, 60, 84, 108)

  # Out-of-bag propensity predictions adjust measured treatment selection.
  propensity <- grf::regression_forest(X, d$W, num.trees = num_trees,
                                      num.threads = 2, seed = seed)$predictions
  propensity <- pmin(.99, pmax(.01, as.numeric(propensity)))
  scores <- matrix(NA_real_, nrow(d), length(horizons))
  ate <- se <- numeric(length(horizons))
  for (j in seq_along(horizons)) {
    forest <- grf::causal_survival_forest(
      X, d$Y, d$W, d$D, W.hat = propensity,
      target = "survival.probability", horizon = horizons[j],
      num.trees = num_trees, tune.parameters = "none",
      num.threads = 2, seed = seed + j)
    estimate <- grf::average_treatment_effect(forest)
    ate[j] <- estimate[["estimate"]]
    se[j] <- estimate[["std.err"]]
    scores[, j] <- grf::get_scores(forest)
  }
  if (any(!is.finite(scores))) stop("Non-finite scores: inspect overlap and follow-up support.")

  # The same people contribute at each horizon; keep their score covariance.
  covariance <- methods$score_horizon_cov(scores)
  trajectory <- methods$fit_cast_trajectory(horizons, ate, Sigma = covariance$cov, se_values = se)
  fitted <- trajectory$predict(horizons)
  oracle <- read.csv(file.path(kit_dir, "data/answer-key.csv"))
  stopifnot(identical(as.numeric(oracle$month), horizons))
  results <- data.frame(month = horizons, csf = ate,
    csf_low = ate - 1.96 * se, csf_high = ate + 1.96 * se,
    cast = fitted$fit, cast_low = fitted$fit - 1.96 * fitted$se,
    cast_high = fitted$fit + 1.96 * fitted$se,
    truth = oracle$truth,
    unadjusted = methods$naive_survprob_ate(d$Y, d$D, d$W, horizons))
  stopifnot(all(is.finite(as.matrix(results))))

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  run_dir <- tempfile("run-", tmpdir = normalizePath(output_dir, mustWork = TRUE))
  dir.create(run_dir)
  write.csv(results, file.path(run_dir, "horizon-results.csv"), row.names = FALSE)
  writeLines(c("600 synthetic people; baseline treatment; all times in months.",
    paste("Seed:", seed, "Trees:", num_trees),
    "CSV effects are probability differences. Multiply by 100 for percentage points.",
    "CAST bands are pointwise, not simultaneous; selection and misspecification uncertainty are not fully included.",
    capture.output(sessionInfo())), file.path(run_dir, "run-info.txt"))

  # Keep the legend below the data, in a separate plotting area.
  grDevices::pdf(file.path(run_dir, "trajectory.pdf"), width = 8, height = 6)
  tryCatch({
    layout(matrix(c(1, 2), ncol = 1), heights = c(4, 1))
    par(mar = c(4, 4.5, 1, 1))
    bounds <- range(results[, -1]) * 100
    plot(horizons, ate * 100, ylim = bounds, pch = 21, col = "#087e8b", bg = "white",
         xlab = "Follow-up (months)", ylab = "Survival difference (percentage points)")
    abline(h = 0, col = "grey70", lty = 3)
    arrows(horizons, results$csf_low * 100, horizons, results$csf_high * 100,
           angle = 90, code = 3, length = .035, col = "#087e8b")
    dense <- seq(12, 108, length.out = 101)
    lines(dense, trajectory$predict(dense)$fit * 100, col = "#087e8b", lwd = 2)
    points(horizons, results$truth * 100, pch = 18)
    lines(horizons, results$unadjusted * 100, col = "#a65736", lty = 2)
    par(mar = c(0, 0, 0, 0)); plot.new()
    legend("center", c("CSF + 95% interval", "CAST fit", "Simulated truth", "Unadjusted"),
           col = c("#087e8b", "#087e8b", "black", "#a65736"),
           pch = c(21, NA, 18, NA), lty = c(NA, 1, NA, 2), ncol = 2, bty = "n")
  }, finally = grDevices::dev.off())
  print(results, digits = 3)
  message("Saved results to ", run_dir)
  invisible(list(results = results, cohort = d, output_dir = run_dir))
}

if (sys.nframe() == 0L) analyze_demo()
