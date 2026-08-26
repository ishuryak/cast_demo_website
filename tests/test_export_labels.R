# tests/test_export_labels.R
# The confounding-strength label must be a function of gamma's VALUE, never of
# its position in the scenario grid.
#
# Regression guarded: 03_export.R used to index the word lists by position, so
# running the smoke test (CONF_GRID = c(0, 1)) wrote the gamma = 1 cohort into
# docs/figs/plateau_mild_confounding.png, titled "Plateau effect, mild
# confounding". The file was fresh, non-empty and newer than its producer, so
# every freshness check passed while the figure was mislabelled.

source("R/scenario_labels.R")

fails <- 0L
ok <- function(what, cond) {
  if (isTRUE(cond)) cat(sprintf("  ok    %s\n", what))
  else { cat(sprintf("  FAIL  %s\n", what)); fails <<- fails + 1L }
}
eq <- function(what, got, want)
  ok(sprintf("%s -> %s", what, format(want)), identical(got, want))

cat("test_export_labels.R\n")

# ---- 1. the published mapping ---------------------------------------------
eq("conf_word(0)",   conf_word(0),   "none")
eq("conf_word(0.5)", conf_word(0.5), "mild")
eq("conf_word(1)",   conf_word(1),   "moderate")
eq("conf_word(2)",   conf_word(2),   "strong")
eq("conf_title(0)",  conf_title(0),  "no")
eq("conf_title(2)",  conf_title(2),  "strong")

# ---- 2. the regression itself ---------------------------------------------
# Under the reduced smoke-test grid, gamma = 1 is the SECOND element. A
# position-indexed lookup returns "mild" (the second word); the value-keyed
# lookup must return "moderate".
smoke_grid <- c(0, 1)
ok("gamma = 1 is still 'moderate' when it is 2nd in a 2-element grid",
   conf_word(smoke_grid[2]) == "moderate")
ok("gamma = 1 title is still 'moderate' in the reduced grid",
   conf_title(smoke_grid[2]) == "moderate")
ok("the reduced grid never produces the word 'mild'",
   !("mild" %in% vapply(smoke_grid, conf_word, character(1))))

# ---- 3. numeric forms that must agree --------------------------------------
ok("1, 1.0 and '1' all label identically",
   length(unique(c(conf_word(1), conf_word(1.0), conf_word("1")))) == 1L)
eq("conf_key(1.0) is canonical", conf_key(1.0), "1")

# ---- 4. an unregistered gamma must not borrow a neighbour's label ----------
ok("unregistered gamma gets a self-describing token",
   conf_word(0.25) == "gamma0p25")
ok("unregistered gamma is not silently called 'mild'", conf_word(0.25) != "mild")
ok("unregistered gamma title names the value",
   conf_title(0.25) == "gamma = 0.25")

# ---- 5. every label is unique, so two panels cannot share a filename -------
gs <- c(0, 0.5, 1, 2)
ok("the four published gammas give four distinct filenames",
   length(unique(vapply(gs, conf_word, character(1)))) == length(gs))

cat(sprintf("test_export_labels.R: %s (%d failure%s)\n",
            if (fails == 0L) "PASS" else "FAIL", fails,
            if (fails == 1L) "" else "s"))
quit(status = if (fails == 0L) 0L else 1L)
