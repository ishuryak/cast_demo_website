# CAST / Tao of RWD: a small, reproducible synthetic-data exercise.
# Required packages: survival and grf. Install these once if needed:
# install.packages(c("survival", "grf"), repos = "https://cloud.r-project.org")
# Run this file with Rscript, or source it in RStudio and call run_cast_exercise().
# The teaching run is intentionally smaller and untuned; it will not reproduce
# the website's exact decimals. Source methods are pinned to the commit below.
# Original simulation and CAST math: Igor Shuryak, MIT license.
# https://github.com/ishuryak/cast_demo_website/blob/43a00101100801eb6c048800d24788455fac0f8b/LICENSE

run_cast_exercise <- function(n = 600L, seed = 20260905L,
                              measured_confounding = 1,
                              hidden_confounding = 0,
                              shape = "reversal",
                              horizons = c(12, 36, 60, 84, 108),
                              num_trees = 300L,
                              output_dir = "cast-lab-output",
                              source_dir = NULL) {
  stopifnot(n >= 200, num_trees >= 100, shape %in% c("plateau", "reversal"),
            length(horizons) >= 3, all(is.finite(horizons)),
            all(diff(horizons) > 0), min(horizons) > 0, max(horizons) <= 108,
            measured_confounding >= 0, hidden_confounding >= 0)
  # The upstream answer key uses nearest points on its 0.5-month grid.
  # Reject off-grid requests before creating output or fitting a forest.
  if (any(abs(horizons * 2 - round(horizons * 2)) > 1e-8))
    stop("Use horizons in 0.5-month increments so estimates and simulated truth refer to the same time.")
  for (package in c("survival", "grf")) {
    if (!requireNamespace(package, quietly = TRUE))
      stop("Install required package first: ", package)
  }
  baseline <- "43a00101100801eb6c048800d24788455fac0f8b"
  source_files <- c("cast_core.R", "01_simulate.R")
  original_wd <- getwd()
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  output_dir <- normalizePath(output_dir, mustWork = TRUE)
  # Unique run directories keep earlier exercises intact.
  run_dir <- tempfile(pattern = paste0("run-", seed, "-"), tmpdir = output_dir)
  dir.create(run_dir)
  workspace <- tempfile("cast-source-")
  dir.create(file.path(workspace, "R"), recursive = TRUE)
  if (!is.null(source_dir)) source_dir <- normalizePath(source_dir, mustWork = TRUE)
  for (name in source_files) {
    destination <- file.path(workspace, "R", name)
    if (is.null(source_dir)) {
      download.file(paste0("https://raw.githubusercontent.com/ishuryak/cast_demo_website/",
                           baseline, "/R/", name), destination, mode = "wb", quiet = TRUE)
    } else {
      if (!file.copy(file.path(source_dir, name), destination)) stop("Cannot copy source: ", name)
    }
  }
  on.exit(setwd(original_wd), add = TRUE)
  setwd(workspace)
  # Source-only mode skips the upstream scenario export. Its temporary output/
  # directory is created under workspace, never under the original checkout.
  e <- new.env(parent = globalenv())
  e$DEMO_SOURCE_ONLY <- TRUE
  e$source <- function(file, ...) sys.source(file, envir = e)
  # Suppress the source file's default full-grid startup label; this exercise
  # uses the explicitly supplied one-cohort settings below.
  invisible(capture.output(sys.source("R/01_simulate.R", envir = e)))
  e$HORIZONS <- horizons
  message("Synthetic exercise: n=", n, ", seed=", seed, ", shape=", shape,
          ", horizons=", paste(horizons, collapse = ","))
  cohort <- e$simulate_cohort(n, measured_confounding, shape, seed,
                              unmeas_strength = hidden_confounding)
  d <- cohort$data
  X <- model.matrix(~ age + stage + ps + comorb + smoke + sex + factor(ethnicity), d)[, -1, drop = FALSE]
  propensity <- grf::regression_forest(X, d$W, num.trees = num_trees,
                                      num.threads = 2, seed = seed)$predictions
  propensity <- pmin(.99, pmax(.01, as.numeric(propensity)))
  scores <- matrix(NA_real_, nrow = n, ncol = length(horizons))
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
  if (any(!is.finite(scores))) stop("Non-finite scores: inspect sample size, overlap, and censoring support.")
  covariance <- e$score_horizon_cov(scores)
  trajectory <- e$fit_cast_trajectory(horizons, ate, Sigma = covariance$cov, se_values = se)
  cast <- trajectory$predict(horizons)
  results <- data.frame(
    month = horizons, truth = cohort$true_ate$true_ate,
    unadjusted = e$naive_survprob_ate(d$Y, d$D, d$W, horizons),
    csf = ate, csf_low = ate - 1.96 * se, csf_high = ate + 1.96 * se,
    cast = cast$fit, cast_low = cast$fit - 1.96 * cast$se,
    cast_high = cast$fit + 1.96 * cast$se)
  stopifnot(all(is.finite(as.matrix(results))))
  write.csv(d, file.path(run_dir, "synthetic-cohort.csv"), row.names = FALSE)
  write.csv(results, file.path(run_dir, "horizon-results.csv"), row.names = FALSE)
  writeLines(c(paste("Pinned reference commit:", baseline),
               paste("Source mode:", if (is.null(source_dir)) "pinned GitHub download" else paste("local override", source_dir)),
               paste("Actual source MD5:", source_files, unname(tools::md5sum(file.path("R", source_files)))),
               paste("n:", n, "seed:", seed, "trees:", num_trees, "shape:", shape),
               paste("Measured confounding:", measured_confounding, "hidden confounding:", hidden_confounding),
               paste("Horizons:", paste(horizons, collapse = ", ")),
               "Bands are 95% pointwise, calculated from influence scores and the fitted quadratic; not simultaneous across time.",
               "All patient rows are simulated. u_hidden is excluded from model fitting.",
               capture.output(sessionInfo())), file.path(run_dir, "run-info.txt"))
  dense_time <- seq(min(horizons), max(horizons), length.out = 101)
  smooth <- trajectory$predict(dense_time)
  bounds <- range(results[, -1], smooth$fit - 1.96 * smooth$se, smooth$fit + 1.96 * smooth$se)
  png(file.path(run_dir, "effect-trajectories.png"), width = 1200, height = 780, res = 145)
  tryCatch({
    par(mar = c(5, 5, 3, 1))
    plot(horizons, ate * 100, type = "n", ylim = bounds * 100,
         xlab = "Follow-up (months)", ylab = "Survival difference (percentage points)",
         main = "Synthetic study: estimates and a fitted trajectory")
    abline(h = 0, col = "grey60", lty = 3)
    polygon(c(dense_time, rev(dense_time)),
            c(smooth$fit - 1.96 * smooth$se, rev(smooth$fit + 1.96 * smooth$se)) * 100,
            col = adjustcolor("#087e8b", alpha.f = .12), border = NA)
    lines(dense_time, smooth$fit * 100, col = "#087e8b", lwd = 2)
    arrows(horizons, results$csf_low * 100, horizons, results$csf_high * 100,
           angle = 90, code = 3, length = .04, col = "#087e8b")
    points(horizons, ate * 100, pch = 21, bg = "white", col = "#087e8b", cex = 1.2)
    points(horizons, results$truth * 100, pch = 18, cex = 1.3)
    lines(horizons, results$unadjusted * 100, lty = 2, col = "#a65736")
    legend("topright", c("CSF + 95% interval", "CAST + pointwise band", "Known truth", "Unadjusted"),
           col = c("#087e8b", "#087e8b", "black", "#a65736"),
           pch = c(21, NA, 18, NA), lty = c(NA, 1, NA, 2), bty = "n", cex = .8)
  }, finally = dev.off())
  print(results, digits = 3)
  message("Saved a new run to: ", run_dir)
  invisible(list(results = results, cohort = d, output_dir = run_dir))
}

# In RStudio: source this file, then call run_cast_exercise() yourself.
# At the command line: Rscript cast-exercise.R runs the default lesson.
if (sys.nframe() == 0L) run_cast_exercise()

# Exercises:
# 1. Change seed. Is the same curve feature stable across new samples?
# 2. Change measured_confounding to 0 or 2. Compare unadjusted and CSF.
# 3. Change hidden_confounding to 1.5. Why can every adjusted estimate drift?
# 4. Use horizons = seq(12, 108, by = 12). You now REFIT forests at new horizons;
#    this differs from drawing more points on the old fitted line.
# 5. Compare shape = "plateau" and "reversal". Does the quadratic miss a peak?
