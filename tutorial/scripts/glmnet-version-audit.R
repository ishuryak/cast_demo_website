# Matched version audit of the shipped binomial-propensity class lab.
# Run each version in a fresh R process with its own glmnet-only library:
# Rscript tutorial/scripts/glmnet-version-audit.R run OUTPUT LIBRARY VERSION [REPS=20]
# Rscript tutorial/scripts/glmnet-version-audit.R compare OLD_OUTPUT NEW_OUTPUT REPORT
# Individual synthetic propensities remain in local OUTPUT; REPORT is aggregate.

audit_run <- function(repo, output, library, version, reps = 20L) {
  stopifnot(length(reps) == 1L, !is.na(reps), reps >= 2L)
  .libPaths(c(normalizePath(library, mustWork = TRUE), .libPaths()))
  stopifnot(as.character(packageVersion("glmnet")) == version,
    normalizePath(dirname(find.package("glmnet"))) == normalizePath(library))
  if (dir.exists(output) && length(list.files(output, all.files = TRUE, no.. = TRUE)))
    stop("Use a new, empty output directory.")
  dir.create(output, recursive = TRUE, showWarnings = FALSE)
  output <- normalizePath(output, mustWork = TRUE)
  kit <- file.path(repo, "tutorial/class-kit")
  packages <- c("survival", "grf", "SuperLearner", "glmnet", "ranger")
  invisible(lapply(packages, requireNamespace, quietly = TRUE))
  config <- list(R = R.version.string, platform = R.version$platform,
    packages = setNames(vapply(packages, function(p) as.character(packageVersion(p)), ""), packages),
    reps = reps, n = 600L, shape = "reversal", confounding = 1, hidden = 0,
    seed_base = 20260905L, fit_seed = 20260905L, trees = 300L,
    arms = c("forest", "logistic", "superlearner"),
    rng = c("Mersenne-Twister", "Inversion", "Rejection"))
  sources <- c("tutorial/class-kit/class-lab.R", "tutorial/class-kit/R/01_simulate.R",
    "tutorial/class-kit/R/cast_core.R", "tutorial/scripts/glmnet-version-audit.R")
  config$source_md5 <- setNames(unname(tools::md5sum(file.path(repo, sources))), sources)
  dput(config, file.path(output, "config.txt"))
  scratch <- tempfile("cast-version-audit-")
  dir.create(file.path(scratch, "R"), recursive = TRUE)
  dir.create(file.path(scratch, "data"))
  old_wd <- getwd()
  on.exit({setwd(old_wd); unlink(scratch, recursive = TRUE)}, add = TRUE)
  stopifnot(all(file.copy(file.path(kit, "R", c("01_simulate.R", "cast_core.R")), file.path(scratch, "R"))))
  setwd(scratch)
  model <- new.env(parent = globalenv())
  model$DEMO_SOURCE_ONLY <- TRUE
  model$source <- function(file, ...) sys.source(file, envir = model)
  invisible(capture.output(sys.source("R/01_simulate.R", envir = model)))
  lab <- new.env(parent = globalenv())
  sys.source(file.path(kit, "class-lab.R"), envir = lab)
  records <- list()
  started <- proc.time()[["elapsed"]]
  for (rep in seq_len(reps)) {
    do.call(RNGkind, as.list(config$rng))
    cohort <- model$simulate_cohort(config$n, config$confounding, config$shape,
      config$seed_base + rep, unmeas_strength = config$hidden)
    observed <- cohort$data[, setdiff(names(cohort$data), "u_hidden")]
    write.csv(observed, "data/demo-cohort.csv", row.names = FALSE)
    write.csv(data.frame(month = cohort$true_ate$horizon, truth = cohort$true_ate$true_ate),
      "data/answer-key.csv", row.names = FALSE)
    inputs <- unname(tools::md5sum(c("data/demo-cohort.csv", "data/answer-key.csv")))
    for (arm in config$arms) {
      warnings <- character()
      invisible(capture.output(withCallingHandlers(
        result <- lab$analyze_demo(scratch, num_trees = config$trees,
          seed = config$fit_seed, propensity = arm),
        warning = function(w) {warnings <<- c(warnings, conditionMessage(w)); invokeRestart("muffleWarning")},
        message = function(m) invokeRestart("muffleMessage"))))
      stopifnot(length(result$propensity) == config$n,
        all(is.finite(result$propensity)), all(is.finite(as.matrix(result$results))))
      records[[paste(rep, arm, sep = "/")]] <- list(replicate = rep,
        cohort_seed = config$seed_base + rep, arm = arm, input_md5 = inputs,
        propensity = result$propensity, results = result$results, warnings = warnings)
    }
    saveRDS(list(config = config, records = records), file.path(output, "audit.rds"))
    cat(sprintf("glmnet %s: cohort %d/%d completed (%.1fs)\n", version, rep, reps,
      proc.time()[["elapsed"]] - started)); flush.console()
  }
  writeLines(c(paste("glmnet loaded from:", find.package("glmnet")),
    paste("Elapsed seconds:", proc.time()[["elapsed"]] - started),
    capture.output(sessionInfo())), file.path(output, "run-info.txt"))
  invisible(records)
}

audit_compare <- function(old, new, report) {
  a <- readRDS(file.path(old, "audit.rds")); b <- readRDS(file.path(new, "audit.rds"))
  stopifnot(a$config$packages[["glmnet"]] == "4.1.10", b$config$packages[["glmnet"]] == "5.1")
  ca <- a$config; cb <- b$config
  ca$packages <- ca$packages[names(ca$packages) != "glmnet"]
  cb$packages <- cb$packages[names(cb$packages) != "glmnet"]
  stopifnot(identical(ca, cb), identical(names(a$records), names(b$records)),
    length(a$records) == ca$reps * length(ca$arms))
  if (dir.exists(report) && length(list.files(report, all.files = TRUE, no.. = TRUE)))
    stop("Use a new, empty report directory.")
  dir.create(report, recursive = TRUE, showWarnings = FALSE)
  differences <- list(); rows <- list()
  for (key in names(a$records)) {
    x <- a$records[[key]]; y <- b$records[[key]]
    stopifnot(identical(x$input_md5, y$input_md5),
      identical(x$results$month, y$results$month), identical(x$results$truth, y$results$truth))
    fields <- c("csf", "csf_low", "csf_high", "cast", "cast_low", "cast_high")
    dx <- x$results; dy <- y$results
    differences[[key]] <- data.frame(replicate = x$replicate, arm = x$arm,
      input_identical = TRUE, propensity_identical = identical(x$propensity, y$propensity),
      max_abs_propensity = max(abs(x$propensity - y$propensity)),
      estimates_and_endpoints_identical = identical(dx[, fields], dy[, fields]),
      max_abs_csf = max(abs(as.matrix(dx[, fields[1:3]]) - as.matrix(dy[, fields[1:3]]))),
      max_abs_cast = max(abs(as.matrix(dx[, fields[4:6]]) - as.matrix(dy[, fields[4:6]]))),
      csf_coverage_flips = sum((dx$truth >= dx$csf_low & dx$truth <= dx$csf_high) !=
        (dy$truth >= dy$csf_low & dy$truth <= dy$csf_high)),
      cast_coverage_flips = sum((dx$truth >= dx$cast_low & dx$truth <= dx$cast_high) !=
        (dy$truth >= dy$cast_low & dy$truth <= dy$cast_high)),
      warnings_identical = identical(x$warnings, y$warnings),
      old_warning_count = length(x$warnings), new_warning_count = length(y$warnings))
    for (v in c("old", "new")) {
      d <- if (v == "old") x else y
      rows[[paste(key, v)]] <- data.frame(glmnet = if (v == "old") "4.1-10" else "5.1",
        replicate = x$replicate, cohort_seed = x$cohort_seed, arm = x$arm,
        d$results, warnings = paste(d$warnings, collapse = " | "))
    }
  }
  delta <- do.call(rbind, differences)
  # Forest and logistic do not use glmnet: a change invalidates the isolation check.
  controls <- delta$arm != "superlearner"
  stopifnot(all(delta$propensity_identical[controls]),
    all(delta$estimates_and_endpoints_identical[controls]))
  write.csv(delta, file.path(report, "paired-differences.csv"), row.names = FALSE)
  write.csv(do.call(rbind, rows), file.path(report, "horizon-results.csv"), row.names = FALSE)
  for (v in c("old", "new")) for (f in c("config.txt", "run-info.txt"))
    stopifnot(file.copy(file.path(if (v == "old") old else new, f), file.path(report, paste(v, f, sep = "-"))))
  print(aggregate(cbind(max_abs_propensity, max_abs_csf, max_abs_cast) ~ arm, delta, max))
  cat("Coverage flips:", sum(delta$csf_coverage_flips + delta$cast_coverage_flips), "\n")
  invisible(delta)
}

if (sys.nframe() == 0L) {
  args <- commandArgs(trailingOnly = TRUE)
  script <- normalizePath(sub("^--file=", "", grep("^--file=", commandArgs(), value = TRUE)[[1]]))
  repo <- dirname(dirname(dirname(script)))
  if (length(args) %in% c(4L, 5L) && args[1] == "run") {
    audit_run(repo, args[2], args[3], args[4], if (length(args) == 5L) as.integer(args[5]) else 20L)
  } else if (length(args) == 4L && args[1] == "compare") {
    audit_compare(args[2], args[3], args[4])
  } else stop("Use run OUTPUT LIBRARY VERSION [REPS=20], or compare OLD NEW REPORT")
}
