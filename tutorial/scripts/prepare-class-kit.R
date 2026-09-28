# Regenerate the small teaching cohort from Igor's unchanged simulation.
# Run from the repository root: Rscript tutorial/scripts/prepare-class-kit.R
kit <- normalizePath("tutorial/class-kit", mustWork = TRUE)
dir.create(file.path(kit, "data"), showWarnings = FALSE)
workspace <- tempfile("cast-kit-source-")
dir.create(file.path(workspace, "R"), recursive = TRUE)
for (name in c("cast_core.R", "01_simulate.R")) {
  stopifnot(file.copy(file.path(kit, "R", name), file.path(workspace, "R", name)))
}
original_wd <- getwd()
tryCatch({
  setwd(workspace)
  model <- new.env(parent = globalenv())
  model$DEMO_SOURCE_ONLY <- TRUE
  model$source <- function(file, ...) sys.source(file, envir = model)
  invisible(capture.output(sys.source("R/01_simulate.R", envir = model)))
  cohort <- model$simulate_cohort(600L, 1, "reversal", 20260905L, unmeas_strength = 0)
  observed <- cohort$data[, setdiff(names(cohort$data), "u_hidden")]
  stopifnot(nrow(observed) == 600, all(observed$W %in% 0:1),
            all(observed$D %in% 0:1), all(is.finite(observed$Y)))
  # LF on every platform: a text-mode connection on Windows turns "\n" into CRLF,
  # which changes the provenance hashes for identical content.
  write_lf <- function(x, path) {
    con <- file(path, "wb")
    on.exit(close(con))
    write.csv(x, con, row.names = FALSE, eol = "\n")
  }
  write_lf(observed, file.path(kit, "data/demo-cohort.csv"))
  answer <- data.frame(month = cohort$true_ate$horizon, truth = cohort$true_ate$true_ate)
  write_lf(answer, file.path(kit, "data/answer-key.csv"))
  cat("Generated 600 synthetic observed records and five oracle averages.\n")
}, finally = setwd(original_wd))
