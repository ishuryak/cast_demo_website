# Live portability/resume check: same cohorts and seeds, serial versus PSOCK.
file_arg <- grep("^--file=", commandArgs(), value = TRUE)[[1]]
repo <- dirname(dirname(dirname(normalizePath(sub("^--file=", "", file_arg)))))
source(file.path(repo, "tutorial/scripts/class-lab-propensity-study.R"))
scratch <- tempfile("cast-propensity-test-")
dir.create(scratch)
serial_dir <- file.path(scratch, "serial")
parallel_dir <- file.path(scratch, "parallel")
serial <- run_propensity_study(repo, serial_dir, reps = 2L, workers = 1L, trees = 100L)
parallel <- run_propensity_study(repo, parallel_dir, reps = 2L, workers = 2L, trees = 100L)
stopifnot(identical(serial$rows, parallel$rows), identical(serial$summary, parallel$summary))

# Resume must keep valid completed units, recompute only the missing unit,
# and reproduce the original summaries without appending duplicates.
kept <- file.path(parallel_dir, "replicates/rep-0001.csv")
kept_hash <- unname(tools::md5sum(kept))
kept_time <- file.info(kept)$mtime
unlink(file.path(parallel_dir, "replicates/rep-0002.csv"))
resumed <- run_propensity_study(repo, parallel_dir, reps = 2L, workers = 2L, trees = 100L)
stopifnot(identical(unname(tools::md5sum(kept)), kept_hash),
          identical(file.info(kept)$mtime, kept_time),
          identical(serial$rows, resumed$rows), identical(serial$summary, resumed$summary),
          all(resumed$summary$replicates == 2L))
bad <- tryCatch(run_propensity_study(repo, parallel_dir, reps = 2L, trees = 200L),
                error = identity)
stopifnot(inherits(bad, "error"), grepl("differ", conditionMessage(bad)))

# A partial/corrupted checkpoint cannot count as a completed replicate.
corrupt <- read.csv(kept, colClasses = c(warnings = "character"))[-1, ]
write.csv(corrupt, kept, row.names = FALSE)
bad <- tryCatch(run_propensity_study(repo, parallel_dir, reps = 2L, trees = 100L),
                error = identity)
stopifnot(inherits(bad, "error"))

# Known two-replicate example: errors -1,+1; one interval covers its truth.
toy <- data.frame(arm = "forest", month = 12, truth = c(0, 0),
  csf = c(-1, 1), csf_low = c(-2, 0.5), csf_high = c(0, 1.5),
  cast = c(-1, 1), cast_low = c(-2, 0.5), cast_high = c(0, 1.5),
  warning_count = c(0, 1), tail_fraction = c(0.1, 0.3))
s <- summarize_propensity_study(toy)
stopifnot(all(s$bias == 0), all(s$rmse == 1), all(s$coverage == .5),
  all(abs(s$bias_mcse - 1) < 1e-15),
  all(abs(s$coverage_mcse - sqrt(.125)) < 1e-15),
  all(s$mean_interval_width == 1.5), all(s$warning_replicates == 1))
unlink(scratch, recursive = TRUE)
cat("PASS: serial/PSOCK equality, interruption/resume, configuration and corruption guards, summary arithmetic.\n")
