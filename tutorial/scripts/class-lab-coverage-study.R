# Run from tutorial/class-kit/ (it reads R/01_simulate.R and R/cast_core.R there):
#   Rscript ../scripts/class-lab-coverage-study.R 300 default,tuned
#   Rscript ../scripts/class-lab-coverage-study.R 150 oracle_p,trees2000 coverage_diag.csv
#   Rscript ../scripts/class-lab-coverage-study.R 200 glm_p coverage_glm.csv
# Results are written to the working directory; do not commit them into the kit.
# Repeated-sampling coverage of the class-lab CSF interval and CAST band.
# Redraws the kit's scenario (reversal, gamma = 1, no hidden factor, n = 600) at
# independent cohort seeds, runs the class-lab estimator exactly, and records
# whether each 95% interval contains that cohort's own answer key.
# Arms: "default" = class-lab.R as shipped (untuned propensity forest);
#       "tuned"   = same, but the propensity forest uses tune.parameters = "all".
#       "trees2000" = forest propensity and CSF with 2,000 trees instead of 300;
#       "oracle_p"  = the simulator's true propensity (gamma = 1, no hidden factor);
#       "glm_p"     = main-effects logistic regression, as analyze_demo(propensity = "logistic").
# One row per (seed, arm) is appended as it completes; reruns skip done units.
args <- commandArgs(trailingOnly = TRUE)
R_REPS <- as.integer(if (length(args) >= 1) args[1] else 100)
ARMS <- if (length(args) >= 2) strsplit(args[2], ",")[[1]] else c("default", "tuned")
THREADS <- 8L; TREES <- 300L
out <- if (length(args) >= 3) args[3] else "coverage_results.csv"
RNGkind("Mersenne-Twister", "Inversion", "Rejection")
model <- new.env(parent = globalenv()); model$DEMO_SOURCE_ONLY <- TRUE
model$source <- function(file, ...) sys.source(file, envir = model)
invisible(capture.output(sys.source("R/01_simulate.R", envir = model)))
methods <- new.env(parent = globalenv()); sys.source("R/cast_core.R", envir = methods)
horizons <- c(12, 36, 60, 84, 108)
done <- if (file.exists(out)) read.csv(out) else NULL
fit_one <- function(d, arm, seed) {
  X <- model.matrix(~ age + stage + ps + comorb + smoke + sex + factor(ethnicity), d)[, -1, drop = FALSE]
  tune <- if (arm == "tuned") "all" else "none"
  trees <- if (arm == "trees2000") 2000L else TREES
  p <- if (arm == "oracle_p") {
    # The simulator's own assignment model (R/01_simulate.R, gamma = 1, no hidden factor).
    plogis(-0.5 * (d$age - 60) / 10 - 0.6 * (d$stage - 2.5) / 1.1 +
            0.5 * (d$ps - 80) / 12 - 0.45 * (d$comorb - 1))
  } else if (arm == "glm_p") {
    # Main-effects logistic regression of W on the same measured covariates X.
    stats::fitted(stats::glm(d$W ~ X, family = stats::binomial()))
  } else grf::regression_forest(X, d$W, num.trees = trees, num.threads = THREADS,
                              seed = seed, tune.parameters = tune)$predictions
  p <- pmin(.99, pmax(.01, as.numeric(p)))
  scores <- matrix(NA_real_, nrow(d), length(horizons)); ate <- se <- numeric(length(horizons))
  for (j in seq_along(horizons)) {
    f <- grf::causal_survival_forest(X, d$Y, d$W, d$D, W.hat = p,
      target = "survival.probability", horizon = horizons[j], num.trees = trees,
      tune.parameters = "none", num.threads = THREADS, seed = seed + j)
    e <- grf::average_treatment_effect(f); ate[j] <- e[["estimate"]]; se[j] <- e[["std.err"]]
    scores[, j] <- grf::get_scores(f)
  }
  cv <- methods$score_horizon_cov(scores)
  tr <- methods$fit_cast_trajectory(horizons, ate, Sigma = cv$cov, se_values = se)
  ft <- tr$predict(horizons)
  list(ate = ate, se = se, cast = ft$fit, cast_se = ft$se)
}
t0 <- Sys.time()
for (r in seq_len(R_REPS)) {
  cseed <- 20260905L + r  # r = 0 would be the shipped cohort; study uses fresh draws
  cohort <- model$simulate_cohort(600L, 1, "reversal", cseed, unmeas_strength = 0)
  d <- cohort$data[, setdiff(names(cohort$data), "u_hidden")]
  truth <- cohort$true_ate$true_ate
  for (arm in ARMS) {
    if (!is.null(done) && any(done$cohort_seed == cseed & done$arm == arm)) next
    res <- fit_one(d, arm, 20260905L)
    row <- data.frame(cohort_seed = cseed, arm = arm, month = horizons, truth = truth,
      csf = res$ate, csf_se = res$se, cast = res$cast, cast_se = res$cast_se)
    row$csf_cover <- abs(row$csf - truth) <= 1.96 * row$csf_se
    row$cast_cover <- abs(row$cast - truth) <= 1.96 * row$cast_se
    write.table(row, out, sep = ",", row.names = FALSE,
                col.names = !file.exists(out), append = file.exists(out))
    cat(sprintf("[%s] rep %d/%d arm %s done (%.0f s elapsed)\n", format(Sys.time(), "%H:%M:%S"),
                r, R_REPS, arm, as.numeric(difftime(Sys.time(), t0, units = "secs"))))
    flush.console()
  }
}
