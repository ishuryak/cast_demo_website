# tests/test_source_guards.R
# The DEMO_SOURCE_ONLY contract between the pipeline scripts and
# R/04_replicate_seeds.R.
#
# R/04_replicate_seeds.R reuses `simulate_cohort()` from R/01_simulate.R and
# `fit_scenario()` from R/02_fit_methods.R instead of restating them, so a
# method that changes in the pipeline changes in the replication in the same
# commit. That reuse rests on a guard, and the guard has two failure modes, both
# of which produce a plausible-looking run rather than an error:
#
#   1. Guard too WIDE -- the driver block stops running when the file is
#      executed as a script. `Rscript R/02_fit_methods.R` would then exit 0
#      having fitted nothing, and R/03_export.R would publish whatever
#      output/fits.rds already held: a silently stale site.
#   2. Guard too NARROW -- sourcing the file for its functions also re-reads
#      output/sim.rds and rewrites output/fits.rds, so running the replication
#      would overwrite the published grid's fitted results with a five-cohort
#      subset.
#
# Both are checked here at the source level, plus the caller contract that
# `horizons` must be supplied (a stale `horizons` left in the caller's
# environment would otherwise fit every method at the wrong horizons and report
# a full set of well-formed, entirely wrong numbers).

fails <- 0L
ok <- function(what, cond) {
  if (isTRUE(cond)) cat(sprintf("  ok    %s\n", what))
  else { cat(sprintf("  FAIL  %s\n", what)); fails <<- fails + 1L }
}

cat("test_source_guards.R\n")

sim_src <- paste(readLines("R/01_simulate.R", warn = FALSE), collapse = "\n")
fit_src <- paste(readLines("R/02_fit_methods.R", warn = FALSE), collapse = "\n")
rep_src <- paste(readLines("R/04_replicate_seeds.R", warn = FALSE), collapse = "\n")

# ---- 1. the guard exists in both pipeline scripts -------------------------
ok("01_simulate.R guards its driver on DEMO_SOURCE_ONLY",
   grepl('if (!exists("DEMO_SOURCE_ONLY"))', sim_src, fixed = TRUE))
ok("02_fit_methods.R guards its driver on DEMO_SOURCE_ONLY",
   grepl('if (!exists("DEMO_SOURCE_ONLY"))', fit_src, fixed = TRUE))

# ---- 2. guard is not too WIDE: the driver still runs as a script ----------
# The write must be INSIDE the guard (so sourcing does not publish) and the
# guard must test non-existence (so running as a script does execute it). A
# guard written the other way round, `if (exists(...))`, would pass a naive
# "the string appears" check while disabling the pipeline entirely.
ok("01_simulate.R still writes output/sim.rds",
   grepl('saveRDS(list(scenarios = scenarios', sim_src, fixed = TRUE))
ok("02_fit_methods.R still writes output/fits.rds",
   grepl('"output/fits.rds")', fit_src, fixed = TRUE))
ok("neither guard is inverted (no `if (exists(\"DEMO_SOURCE_ONLY\"))` driver)",
   !grepl('if (exists("DEMO_SOURCE_ONLY")) {', sim_src, fixed = TRUE) &&
   !grepl('if (exists("DEMO_SOURCE_ONLY")) {', fit_src, fixed = TRUE))

# ---- 3. guard is not too NARROW: the reads/writes are inside it -----------
# Everything after the guard's opening brace is guarded, so the test is simply
# that the read and the write both appear AFTER the first guard occurrence.
guard_at <- function(s) regexpr('if (!exists("DEMO_SOURCE_ONLY"))', s, fixed = TRUE)
ok("02_fit_methods.R reads output/sim.rds only inside the guard",
   regexpr('readRDS("output/sim.rds")', fit_src, fixed = TRUE) > guard_at(fit_src))
ok("02_fit_methods.R writes output/fits.rds only inside the guard",
   regexpr('"output/fits.rds")', fit_src, fixed = TRUE) > guard_at(fit_src))
ok("01_simulate.R writes output/sim.rds only inside the guard",
   regexpr('"output/sim.rds")', sim_src, fixed = TRUE) > guard_at(sim_src))
ok("02_fit_methods.R builds the `fits` list only inside the guard",
   regexpr("fits <- list()", fit_src, fixed = TRUE) > guard_at(fit_src))

# ---- 4. the caller contract: `horizons` must be supplied ------------------
# A missing `horizons` must STOP. Without this the sourced file would fall
# through to `K <- length(horizons)` and pick up whatever the caller happened to
# have, or error much later with an unrelated message.
ok("sourcing without `horizons` stops with a named error",
   grepl("stop(\"DEMO_SOURCE_ONLY is set but `horizons` was not supplied",
         fit_src, fixed = TRUE))
# K and CURVE_GRID must derive from `horizons` on BOTH paths, i.e. outside the
# guard, or the two callers silently diverge.
ok("K derives from `horizons` on both paths (outside the guard)",
   regexpr("K <- length(horizons)", fit_src, fixed = TRUE) >
   regexpr("stop(\"DEMO_SOURCE_ONLY", fit_src, fixed = TRUE))
ok("CURVE_GRID derives from `horizons` on both paths",
   grepl("CURVE_GRID <- seq(min(horizons), max(horizons), by = 4)",
         fit_src, fixed = TRUE))

# ---- 5. the replication script honours the contract ----------------------
ok("04 sets DEMO_SOURCE_ONLY before sourcing either pipeline script",
   regexpr("DEMO_SOURCE_ONLY <- TRUE", rep_src, fixed = TRUE) <
   regexpr('source("R/01_simulate.R")', rep_src, fixed = TRUE))
ok("04 supplies `horizons` before sourcing 02",
   regexpr("horizons <- HORIZONS", rep_src, fixed = TRUE) <
   regexpr('source("R/02_fit_methods.R")', rep_src, fixed = TRUE))
ok("04 reuses fit_scenario() rather than restating the estimators",
   grepl("fit_scenario(sc,", rep_src, fixed = TRUE) &&
   !grepl("causal_survival_forest(", rep_src, fixed = TRUE))
ok("04 reuses simulate_cohort() rather than restating the generative model",
   grepl("simulate_cohort(N,", rep_src, fixed = TRUE) &&
   !grepl("rweibull(", rep_src, fixed = TRUE))
# Replication seeds must not collide with the published grid's (1000 + index,
# i.e. 1001-1024): a collision would "replicate" a panel against itself.
ok("replication seeds start at 2001, clear of the published grid's 1001-1024",
   grepl("SEEDS <- 2000L + seq_len(N_SEEDS)", rep_src, fixed = TRUE))
ok("04 writes its table to output/ (gitignored), not docs/",
   grepl('"output/replicate_seeds.csv"', rep_src, fixed = TRUE) &&
   !grepl("docs/", rep_src, fixed = TRUE))

cat(sprintf("test_source_guards.R: %s (%d failure%s)\n",
            if (fails == 0L) "PASS" else "FAIL", fails,
            if (fails == 1L) "" else "s"))
quit(status = if (fails == 0L) 0L else 1L)
