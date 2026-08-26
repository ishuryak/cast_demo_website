# 04_replicate_seeds.R
# Replicate one scenario across independent cohort draws, so the README's claims
# about which differences are real and which are Monte-Carlo noise can be checked
# rather than taken on trust.
#
# Each panel on the site is a SINGLE cohort at a single seed. That is fine for a
# teaching figure and useless for judging whether "CSF beats CAST" on a panel
# means anything. This script re-draws the same scenario at several independent
# cohort seeds, refits every method, and reports the between-seed spread and the
# rank of each method in each draw. The coarse ordering that survives here is
# what the README is entitled to claim; the fine ordering that does not is what
# the README tells the reader to ignore.
#
# It reuses the published pipeline's own code rather than restating it:
# `simulate_cohort()` from R/01_simulate.R and `fit_scenario()` from
# R/02_fit_methods.R, both sourced with DEMO_SOURCE_ONLY so neither rebuilds nor
# overwrites output/sim.rds or output/fits.rds. A method that changes in the
# pipeline therefore changes here in the same commit, by construction.
#
# Output: output/replicate_seeds.csv  (one row per seed x method)
#         plus the summary table printed to stdout and logs/04_replicate.log
#
#   Rscript R/04_replicate_seeds.R
#   DEMO_REPLICATE_SEEDS=3 Rscript R/04_replicate_seeds.R      # fewer draws
#   DEMO_REPLICATE_SHAPE=reversal Rscript R/04_replicate_seeds.R

suppressWarnings(suppressMessages({
  library(grf)
  library(survival)
}))

# ---- what to replicate ---------------------------------------------------
# The default cell is the one the README quotes: the plateau shape at moderate
# measured confounding and no latent confounder. That is the panel where Cox is
# correctly specified, which is the claim most in need of replication.
N_SEEDS <- as.integer(Sys.getenv("DEMO_REPLICATE_SEEDS", "5"))
SHAPE   <- Sys.getenv("DEMO_REPLICATE_SHAPE", "plateau")
GAMMA   <- as.numeric(Sys.getenv("DEMO_REPLICATE_GAMMA", "1"))
GAMMA_U <- as.numeric(Sys.getenv("DEMO_REPLICATE_GAMMA_U", "0"))

# Cohort seeds are declared here, not derived from a counter, so this table is
# reproducible and so they cannot collide with the published grid's seeds
# (1000 + scenario index, i.e. 1001-1024). Replication seeds start at 2001.
SEEDS <- 2000L + seq_len(N_SEEDS)

DEMO_SOURCE_ONLY <- TRUE          # read by both sourced scripts; see their guards
source("R/cast_core.R")
source("R/01_simulate.R")         # -> simulate_cohort(), N, HORIZONS, GRID, ...
horizons <- HORIZONS              # fit_scenario() needs this before 02 is sourced
source("R/02_fit_methods.R")      # -> fit_scenario(), NUM_TREES, FOREST_SEED, TUNE

dir.create("output", showWarnings = FALSE)

cat(sprintf("[04_replicate] config  shape=%s  gamma=%.2f  Gamma_u=%.2f  n=%d\n",
            SHAPE, GAMMA, GAMMA_U, N))
cat(sprintf("[04_replicate] seeds=%s  num.trees=%d  tune=%s  forest.seed=%d\n",
            paste(SEEDS, collapse = ","), NUM_TREES, TUNE, FOREST_SEED))

METHODS <- c("naive", "cox", "rsf", "tlearner", "csf", "cast")
LABELS  <- c(naive = "Naive", cox = "Cox", rsf = "RSF-S", tlearner = "RSF-T",
             csf = "CSF", cast = "CAST")

rows <- list()
for (s in SEEDS) {
  cat(sprintf("[04_replicate] seed %d ...\n", s))
  sc  <- simulate_cohort(N, GAMMA, SHAPE, s, unmeas_strength = GAMMA_U)
  fit <- fit_scenario(sc, sprintf("seed%d", s))
  for (m in METHODS)
    rows[[length(rows) + 1]] <- data.frame(seed = s, method = m,
                                           rmse = fit$rmse[[m]])
}
res <- do.call(rbind, rows)

# Rank within each seed: 1 = most accurate that draw. A method whose rank is the
# same in every draw has a real position; one that moves does not.
res$rank <- ave(res$rmse, res$seed, FUN = function(x) rank(x, ties.method = "min"))

csv <- "output/replicate_seeds.csv"
write.csv(res, csv, row.names = FALSE)
cat("[04_replicate] wrote", csv, "\n\n")

# ---- summary table -------------------------------------------------------
cat(sprintf("Replication: %s shape, gamma = %g, Gamma_u = %g, n = %d, %d seeds\n\n",
            SHAPE, GAMMA, GAMMA_U, N, length(SEEDS)))
hdr <- sprintf("%-12s %8s %8s %8s %s", "", "mean", "sd", "range", "rank per seed")
cat(hdr, "\n", strrep("-", nchar(hdr)), "\n", sep = "")
for (m in METHODS) {
  v  <- res$rmse[res$method == m]
  rk <- res$rank[res$method == m]
  cat(sprintf("%-12s %8.3f %8.3f %8.3f %s\n", LABELS[[m]],
              mean(v), sd(v), diff(range(v)),
              paste(rk, collapse = ",")))
}

# The two statements the README is allowed to make, computed rather than asserted.
sd_max <- max(vapply(METHODS, function(m) sd(res$rmse[res$method == m]), numeric(1)))
stable <- vapply(METHODS, function(m) length(unique(res$rank[res$method == m])) == 1L,
                 logical(1))
cat(sprintf("\nLargest between-seed sd of any method's RMSE: %.3f\n", sd_max))
cat(sprintf("Methods holding one rank in all %d draws: %s\n", length(SEEDS),
            if (any(stable)) paste(LABELS[names(stable)[stable]], collapse = ", ")
            else "none"))
cat(sprintf("Methods that change rank between draws:   %s\n",
            if (any(!stable)) paste(LABELS[names(stable)[!stable]], collapse = ", ")
            else "none"))
