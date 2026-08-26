# scenario_labels.R
# The confounding-strength vocabulary, shared by the exporter and its test.
#
# These words are keyed to the VALUE of gamma, never to a position in the
# scenario grid. Indexing by position silently relabels every figure the moment
# the grid changes: with CONF_GRID = c(0, 1) the smoke test once wrote the
# gamma = 1 cohort into a file named and titled "mild confounding".
# docs/app.js carries the same mapping for the live site; tests/run_tests.sh
# checks that the two agree.

CONF_WORDS  <- c("0" = "none", "0.5" = "mild", "1" = "moderate", "2" = "strong")
CONF_TITLES <- c("0" = "no",   "0.5" = "mild", "1" = "moderate", "2" = "strong")

# Canonical string form of a gamma value, so 1, 1.0 and "1" all agree.
conf_key <- function(g) format(as.numeric(g), trim = TRUE)

# Filename word. An unregistered gamma falls back to a self-describing token
# ("gamma0p25") rather than borrowing a neighbour's label.
conf_word <- function(g) {
  k <- conf_key(g)
  if (k %in% names(CONF_WORDS)) unname(CONF_WORDS[k])
  else paste0("gamma", gsub("\\.", "p", k))
}

# Grammatical form for a figure title ("no confounding", "mild confounding").
conf_title <- function(g) {
  k <- conf_key(g)
  if (k %in% names(CONF_TITLES)) unname(CONF_TITLES[k])
  else paste0("gamma = ", k)
}
