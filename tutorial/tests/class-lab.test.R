# Class-lab contract: the kit's own answer key, read against its own intervals.
#
# The lab's CSF intervals missed data/answer-key.csv at several horizons, and
# nothing in the kit said so. Over 300 freshly simulated 600-person cohorts the
# cause was a bias of about one standard error from the forest propensity at
# this sample size, not an understated standard error (README, "Why an interval
# can miss"). This test pins both halves of what the kit now tells students:
#   1. with propensity = "logistic", every CSF interval contains the answer key;
#   2. with the default forest propensity, at least one does not, which is the
#      behavior the README and study guide describe. If a grf upgrade changes
#      that, this fails so the text is revisited rather than left untrue.
# It also checks that an unknown propensity model is refused, and that the run
# record names the model and the cohort size actually read.
file_arg <- grep("^--file=", commandArgs(), value = TRUE)
test_dir <- dirname(normalizePath(sub("^--file=", "", file_arg[[1]])))
kit <- normalizePath(file.path(test_dir, "..", "class-kit"), mustWork = TRUE)
source(file.path(kit, "class-lab.R"))

covers <- function(r) r$truth >= r$csf_low & r$truth <= r$csf_high
out <- tempfile("class-lab-test-")
run <- function(pm) {
  res <- NULL
  invisible(capture.output(suppressWarnings(suppressMessages(
    res <- analyze_demo(kit_dir = kit, output_dir = out, propensity = pm)))))
  res
}
logistic <- run("logistic")
forest <- run("forest")

stopifnot(all(covers(logistic$results)))
stopifnot(any(!covers(forest$results)))

err <- tryCatch(analyze_demo(kit_dir = kit, output_dir = out, propensity = "oracle"),
                error = identity)
stopifnot(inherits(err, "error"))

info <- readLines(file.path(logistic$output_dir, "run-info.txt"))
stopifnot(any(grepl("^600 synthetic people", info)),
          any(grepl("Propensity model: logistic", info, fixed = TRUE)))
cat(sprintf("PASS: logistic covers %d/5; forest covers %d/5; bad model refused; run record complete.\n",
            sum(covers(logistic$results)), sum(covers(forest$results))))
