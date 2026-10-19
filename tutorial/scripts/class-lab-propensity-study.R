# Recreate the three-propensity comparison using the shipped class-lab estimator.
# From the repository root, on macOS, Windows or Linux:
# Rscript tutorial/scripts/class-lab-propensity-study.R output/propensity-study 300 4
# Arguments: output directory, number of cohorts, workers, trees (default 300).
# Results are a NEW run, not recovered October 1 results. No patient data used.

write_study_csv <- function(x, path) {
  tmp <- tempfile(".writing-", tmpdir = dirname(path))
  on.exit(unlink(tmp), add = TRUE)
  con <- file(tmp, "wb")
  tryCatch(write.csv(x, con, row.names = FALSE, eol = "\n"),
           finally = close(con))
  if (file.exists(path)) stop("Refusing to replace checkpoint: ", path)
  if (!file.rename(tmp, path)) stop("Could not publish checkpoint: ", path)
}

check_study_replicate <- function(x, rep, config) {
  required <- c("replicate", "cohort_seed", "arm", "month", "truth", "csf",
    "csf_low", "csf_high", "cast", "cast_low", "cast_high",
    "propensity_min", "propensity_max", "tail_fraction", "warning_count", "warnings")
  stopifnot(identical(names(x), required), nrow(x) == 15L,
    all(x$replicate == rep), all(x$cohort_seed == config$cohort_seed_base + rep),
    identical(sort(unique(x$arm)), sort(config$arms)),
    all(vapply(split(x$month, x$arm), function(h)
      identical(as.numeric(h), config$horizons), logical(1))),
    all(is.finite(as.matrix(x[, !names(x) %in% c("arm", "warnings")]))),
    all(x$csf_low <= x$csf_high), all(x$cast_low <= x$cast_high),
    all(x$propensity_min >= .01), all(x$propensity_max <= .99))
  invisible(x)
}

study_replicate <- function(rep, config, kit, checkpoint_dir) {
  scratch <- tempfile("cast-study-")
  dir.create(file.path(scratch, "R"), recursive = TRUE)
  dir.create(file.path(scratch, "data"))
  old_wd <- getwd()
  on.exit({setwd(old_wd); unlink(scratch, recursive = TRUE)}, add = TRUE)
  stopifnot(all(file.copy(file.path(kit, "R", c("01_simulate.R", "cast_core.R")),
                         file.path(scratch, "R"))))
  setwd(scratch)
  RNGkind("Mersenne-Twister", "Inversion", "Rejection")
  model <- new.env(parent = globalenv())
  model$DEMO_SOURCE_ONLY <- TRUE
  model$source <- function(file, ...) sys.source(file, envir = model)
  invisible(capture.output(sys.source("R/01_simulate.R", envir = model)))
  cohort <- model$simulate_cohort(config$n, config$confounding, config$shape,
    config$cohort_seed_base + rep, unmeas_strength = config$hidden_confounding)
  observed <- cohort$data[, setdiff(names(cohort$data), "u_hidden")]
  write_study_csv(observed, file.path(scratch, "data/demo-cohort.csv"))
  write_study_csv(data.frame(month = cohort$true_ate$horizon,
    truth = cohort$true_ate$true_ate), file.path(scratch, "data/answer-key.csv"))
  lab <- new.env(parent = globalenv())
  sys.source(file.path(kit, "class-lab.R"), envir = lab)
  rows <- lapply(config$arms, function(arm) {
    warnings <- character()
    result <- NULL
    invisible(capture.output(withCallingHandlers(
      result <- lab$analyze_demo(kit_dir = scratch, num_trees = config$trees,
        seed = config$fit_seed, propensity = arm),
      warning = function(w) {
        warnings <<- c(warnings, conditionMessage(w)); invokeRestart("muffleWarning")
      }, message = function(m) invokeRestart("muffleMessage"))))
    r <- result$results
    data.frame(replicate = rep, cohort_seed = config$cohort_seed_base + rep,
      arm = arm, r[, c("month", "truth", "csf", "csf_low", "csf_high",
                       "cast", "cast_low", "cast_high")],
      propensity_min = min(result$propensity), propensity_max = max(result$propensity),
      tail_fraction = mean(result$propensity <= .05 | result$propensity >= .95),
      warning_count = length(warnings), warnings = paste(unique(warnings), collapse = " | "))
  })
  result <- do.call(rbind, rows)
  check_study_replicate(result, rep, config)
  write_study_csv(result, file.path(checkpoint_dir, sprintf("rep-%04d.csv", rep)))
  rep
}

summarize_propensity_study <- function(rows) {
  groups <- split(rows, interaction(rows$arm, rows$month, drop = TRUE))
  result <- do.call(rbind, lapply(groups, function(d) {
    do.call(rbind, lapply(c("csf", "cast"), function(estimator) {
      error <- d[[estimator]] - d$truth
      low <- d[[paste0(estimator, "_low")]]
      high <- d[[paste0(estimator, "_high")]]
      cover <- d$truth >= low & d$truth <= high
      n <- nrow(d)
      data.frame(arm = d$arm[1], month = d$month[1], estimator = estimator,
        replicates = n, mean_truth = mean(d$truth), mean_estimate = mean(d[[estimator]]),
        bias = mean(error), bias_mcse = sd(error) / sqrt(n), rmse = sqrt(mean(error^2)),
        coverage = mean(cover), coverage_mcse = sqrt(mean(cover) * (1 - mean(cover)) / n),
        mean_interval_width = mean(high - low),
        warning_replicates = sum(d$warning_count > 0),
        mean_tail_fraction = mean(d$tail_fraction))
    }))
  }))
  rownames(result) <- NULL
  result[order(result$estimator, result$arm, result$month), ]
}

run_propensity_study <- function(repo, output_dir, reps = 300L, workers = 1L,
                                 trees = 300L) {
  stopifnot(length(reps) == 1L, is.finite(reps), reps >= 2, reps == as.integer(reps),
    length(workers) == 1L, is.finite(workers), workers >= 1, workers == as.integer(workers),
    length(trees) == 1L, is.finite(trees), trees >= 100, trees == as.integer(trees))
  repo <- normalizePath(repo, mustWork = TRUE)
  kit <- file.path(repo, "tutorial/class-kit")
  packages <- c("survival", "grf", "SuperLearner", "glmnet", "ranger")
  for (p in packages) if (!requireNamespace(p, quietly = TRUE)) stop("Install package: ", p)
  source_files <- c("tutorial/class-kit/class-lab.R", "tutorial/class-kit/R/01_simulate.R",
    "tutorial/class-kit/R/cast_core.R", "tutorial/scripts/class-lab-propensity-study.R")
  hashes <- unname(tools::md5sum(file.path(repo, source_files)))
  names(hashes) <- source_files
  config <- list(format_version = 1L, replicates = as.integer(reps), n = 600L,
    shape = "reversal", confounding = 1, hidden_confounding = 0,
    horizons = c(12, 36, 60, 84, 108), arms = c("forest", "logistic", "superlearner"),
    cohort_seed_base = 20260905L, fit_seed = 20260905L, trees = as.integer(trees),
    rng = c("Mersenne-Twister", "Inversion", "Rejection"),
    R = R.version.string, platform = R.version$platform,
    packages = setNames(vapply(packages, function(p) as.character(utils::packageVersion(p)), ""), packages),
    source_md5 = hashes)
  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  output_dir <- normalizePath(output_dir, mustWork = TRUE)
  manifest <- file.path(output_dir, "config.rds")
  if (file.exists(manifest)) {
    if (!identical(readRDS(manifest), config))
      stop("Run settings, source, or environment differ. Use a new output directory.")
  } else {
    if (length(list.files(output_dir, all.files = TRUE, no.. = TRUE)))
      stop("New study output directory must be empty.")
    saveRDS(config, manifest)
    dput(config, file.path(output_dir, "config.txt"))
    writeLines(c("New comparison run; not recovered October 1 results.",
      "Same-cohort paired arms; cohort seeds exclude the shipped cohort.",
      "Only aggregate estimates and diagnostics are retained, never individual records.",
      capture.output(sessionInfo())), file.path(output_dir, "run-info.txt"))
  }
  checkpoint_dir <- file.path(output_dir, "replicates")
  dir.create(checkpoint_dir, showWarnings = FALSE)
  files <- file.path(checkpoint_dir, sprintf("rep-%04d.csv", seq_len(reps)))
  done <- which(file.exists(files))
  read_checkpoint <- function(path) read.csv(path, stringsAsFactors = FALSE,
                                             colClasses = c(warnings = "character"))
  for (r in done) check_study_replicate(read_checkpoint(files[r]), r, config)
  pending <- setdiff(seq_len(reps), done)
  cat(sprintf("%d/%d complete; %d workers; %d trees.\n", length(done), reps, workers, trees))
  if (length(pending)) {
    if (workers == 1L) {
      for (r in pending) {
        study_replicate(r, config, kit, checkpoint_dir)
        cat(sprintf("Completed cohort %d/%d\n", r, reps)); flush.console()
      }
    } else {
      # PSOCK works on Windows too; every cohort/fit sets its own seed.
      cl <- parallel::makePSOCKcluster(min(workers, length(pending)))
      on.exit(parallel::stopCluster(cl), add = TRUE)
      parallel::clusterExport(cl, c("write_study_csv", "check_study_replicate"),
                              envir = environment(run_propensity_study))
      parallel::parLapplyLB(cl, pending, study_replicate, config, kit, checkpoint_dir)
    }
  }
  rows <- do.call(rbind, lapply(seq_len(reps), function(r) {
    d <- read_checkpoint(files[r])
    check_study_replicate(d, r, config)
    d
  }))
  summary <- summarize_propensity_study(rows)
  # Only these derived summaries are replaced on resume; validated checkpoints persist.
  for (name in c("replicate-results.csv", "summary.csv")) unlink(file.path(output_dir, name))
  write_study_csv(rows, file.path(output_dir, "replicate-results.csv"))
  write_study_csv(summary, file.path(output_dir, "summary.csv"))
  cat(sprintf("Saved %d replicate/horizon/arm rows and %d summary rows to %s\n",
              nrow(rows), nrow(summary), output_dir))
  invisible(list(rows = rows, summary = summary))
}

if (sys.nframe() == 0L) {
  args <- commandArgs(trailingOnly = TRUE)
  if (length(args) < 1L || length(args) > 4L)
    stop("Usage: Rscript tutorial/scripts/class-lab-propensity-study.R OUTPUT [REPS=300] [WORKERS=1] [TREES=300]")
  file_arg <- grep("^--file=", commandArgs(), value = TRUE)[[1]]
  script <- normalizePath(sub("^--file=", "", file_arg), mustWork = TRUE)
  run_propensity_study(dirname(dirname(dirname(script))), args[1],
    if (length(args) >= 2L) as.integer(args[2]) else 300L,
    if (length(args) >= 3L) as.integer(args[3]) else 1L,
    if (length(args) >= 4L) as.integer(args[4]) else 300L)
}
