# Regression check: off-grid horizons must fail before packages, files or fits.
file_arg <- grep("^--file=", commandArgs(), value = TRUE)
test_dir <- dirname(normalizePath(sub("^--file=", "", file_arg[[1]])))
source(file.path(test_dir, "..", "labs", "cast-exercise.R"))

destination <- tempfile("cast-invalid-horizon-")
err <- tryCatch(
  run_cast_exercise(horizons = c(12.25, 36.25, 60.25), output_dir = destination),
  error = identity
)
stopifnot(inherits(err, "error"), grepl("0.5-month", conditionMessage(err)),
          !dir.exists(destination))

# A scoped package probe checks valid-grid acceptance without executing a fit.
# Reaching this sentinel means validation accepted the request, before I/O.
probe <- new.env(parent = environment(run_cast_exercise))
probe$requireNamespace <- function(...) stop("passed horizon validation")
validated <- run_cast_exercise
environment(validated) <- probe
for (h in list(c(12, 36, 60, 84, 108), c(0.5, 36.5, 108))) {
  err <- tryCatch(validated(horizons = h, output_dir = destination), error = identity)
  stopifnot(inherits(err, "error"),
            identical(conditionMessage(err), "passed horizon validation"),
            !dir.exists(destination))
}
cat("PASS: off-grid rejection, default horizons and half-month boundary acceptance.\n")
