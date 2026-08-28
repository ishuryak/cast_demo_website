# tests/test_sim_provenance.R
# sim_provenance.yaml must still describe the code it claims to describe.
#
# A provenance registry is a claim about code. Nothing about writing one makes it
# true, and nothing about editing the code makes the registry follow: the
# registry keeps validating, keeps reading plausibly, and quietly describes a
# generative model that no longer exists. That is the same failure the constant
# registry guards on the estimation side, one file over.
#
# The check is deliberately NOT "does this number appear somewhere in the file".
# 41 of the 56 registered values appear more than once in R/01_simulate.R -- 0.45
# is both a smoking prevalence and two different coefficients, 0.5 is a sex
# probability and a propensity coefficient and a gamma level -- so a file-wide
# search passes while the code says something else entirely. That version was
# written first and it did NOT catch a coefficient edited from 0.45 to 0.55,
# because 0.45 was still present elsewhere in the file.
#
# So each parameter carries a SITE: a regex matching the exact construct it comes
# from, VALUE INCLUDED, which must match exactly once. Editing the value in the
# code breaks the anchor. Adding a parameter to the registry without an anchor is
# caught by the coverage check.
#
# Text-based on purpose: no YAML package, so it runs wherever the other R suites
# run, and it reads the same characters a reviewer would.

fails <- 0L
ok <- function(what, cond) {
  if (isTRUE(cond)) cat(sprintf("  ok    %s\n", what))
  else { cat(sprintf("  FAIL  %s\n", what)); fails <<- fails + 1L }
}

cat("test_sim_provenance.R\n")

# id -> c(source file, regex that must match EXACTLY ONCE in it)
SITES <- list(
  "n_per_scenario" = c("R/01_simulate.R", "N\\s*<-\\s*if \\(SUB > 0\\) SUB else 2000"),
  "horizon_first_months" = c("R/01_simulate.R", "HORIZONS\\s*<-\\s*seq\\(12, 120, by = 24\\)"),
  "horizon_spacing_months" = c("R/01_simulate.R", "HORIZONS\\s*<-\\s*seq\\(12, 120, by = 24\\)"),
  "true_curve_grid_step_months" = c("R/01_simulate.R", "GRID\\s*<-\\s*seq\\(0, 210, by = 0\\.5\\)"),
  "true_curve_grid_max_months" = c("R/01_simulate.R", "GRID\\s*<-\\s*seq\\(0, 210, by = 0\\.5\\)"),
  "weibull_shape_k" = c("R/01_simulate.R", "k <- 1\\.4\\b"),
  "weibull_log_scale_intercept" = c("R/01_simulate.R", "lambda0 <- exp\\(4\\.3 \\+ lp_surv\\)"),
  "prog_coef_z_age" = c("R/01_simulate.R", "lp_surv <- -0\\.25 \\* z_age"),
  "prog_coef_z_stage" = c("R/01_simulate.R", "- 0\\.45 \\* z_stage"),
  "prog_coef_z_ps" = c("R/01_simulate.R", "\\+ 0\\.30 \\* z_ps"),
  "prog_coef_z_comorb" = c("R/01_simulate.R", "0\\.30 \\* z_comorb"),
  "prog_coef_smoke" = c("R/01_simulate.R", "0\\.40 \\* smoke"),
  "plateau_log_hazard_ratio" = c("R/01_simulate.R", "exp\\(rep\\(-0\\.62, length\\(u\\)\\)\\)"),
  "reversal_log_hazard_ratio_early" = c("R/01_simulate.R", "exp\\(-0\\.95 \\+ \\(0\\.72 - \\(-0\\.95\\)\\)"),
  "reversal_log_hazard_ratio_late" = c("R/01_simulate.R", "\\(0\\.72 - \\(-0\\.95\\)\\)"),
  "reversal_transition_midpoint_months" = c("R/01_simulate.R", "plogis\\(\\(u - 48\\) / s_w\\)"),
  "reversal_transition_width_months" = c("R/01_simulate.R", "s_w <- 12\\b"),
  "age_mean" = c("R/01_simulate.R", "rnorm\\(n, 60, 10\\)"),
  "age_sd" = c("R/01_simulate.R", "rnorm\\(n, 60, 10\\)"),
  "performance_status_mean" = c("R/01_simulate.R", "rnorm\\(n, 80, 12\\)"),
  "performance_status_sd" = c("R/01_simulate.R", "rnorm\\(n, 80, 12\\)"),
  "performance_status_clip_lo" = c("R/01_simulate.R", "pmax\\(40, rnorm\\(n, 80, 12\\)\\)"),
  "performance_status_clip_hi" = c("R/01_simulate.R", "pmin\\(100, pmax\\(40,"),
  "comorbidity_poisson_lambda" = c("R/01_simulate.R", "rpois\\(n, 1\\.0\\)"),
  "comorbidity_cap" = c("R/01_simulate.R", "pmin\\(4L, rpois"),
  "smoking_prevalence" = c("R/01_simulate.R", "smoke <- rbinom\\(n, 1, 0\\.45\\)"),
  "male_fraction" = c("R/01_simulate.R", "sex\\s*<- rbinom\\(n, 1, 0\\.5\\)"),
  "stage_prob_1" = c("R/01_simulate.R", "prob = c\\(\\.25, \\.30, \\.25, \\.20\\)"),
  "stage_prob_2" = c("R/01_simulate.R", "prob = c\\(\\.25, \\.30, \\.25, \\.20\\)"),
  "stage_prob_3" = c("R/01_simulate.R", "prob = c\\(\\.25, \\.30, \\.25, \\.20\\)"),
  "stage_prob_4" = c("R/01_simulate.R", "prob = c\\(\\.25, \\.30, \\.25, \\.20\\)"),
  "ethnicity_prob_A" = c("R/01_simulate.R", "prob = c\\(\\.5, \\.3, \\.2\\)"),
  "ethnicity_prob_B" = c("R/01_simulate.R", "prob = c\\(\\.5, \\.3, \\.2\\)"),
  "ethnicity_prob_C" = c("R/01_simulate.R", "prob = c\\(\\.5, \\.3, \\.2\\)"),
  "neg_control_coef_sex" = c("R/01_simulate.R", "negative-control covariates: sex, ethnicity \\(affect nothing\\)"),
  "neg_control_coef_ethnicity" = c("R/01_simulate.R", "negative-control covariates: sex, ethnicity \\(affect nothing\\)"),
  "gamma_level_none" = c("R/01_simulate.R", "CONF_GRID <- if \\(SUB > 0\\) c\\(0, 1\\) else c\\(0, 0\\.5, 1\\.0, 2\\.0\\)"),
  "gamma_level_mild" = c("R/01_simulate.R", "else c\\(0, 0\\.5, 1\\.0, 2\\.0\\)"),
  "gamma_level_moderate" = c("R/01_simulate.R", "else c\\(0, 0\\.5, 1\\.0, 2\\.0\\)"),
  "gamma_level_strong" = c("R/01_simulate.R", "else c\\(0, 0\\.5, 1\\.0, 2\\.0\\)"),
  "propensity_coef_z_age" = c("R/01_simulate.R", "conf_strength \\* \\(-0\\.5 \\* z_age"),
  "propensity_coef_z_stage" = c("R/01_simulate.R", "- 0\\.6 \\* z_stage"),
  "propensity_coef_z_ps" = c("R/01_simulate.R", "\\+ 0\\.5 \\* z_ps"),
  "propensity_coef_z_comorb" = c("R/01_simulate.R", "0\\.45 \\* z_comorb"),
  "Gamma_u_level_none" = c("R/01_simulate.R", "UNMEAS_GRID <- if \\(SUB > 0\\) c\\(0\\) else c\\(0, 0\\.75, 1\\.5\\)"),
  "Gamma_u_level_moderate" = c("R/01_simulate.R", "else c\\(0, 0\\.75, 1\\.5\\)"),
  "Gamma_u_level_strong" = c("R/01_simulate.R", "else c\\(0, 0\\.75, 1\\.5\\)"),
  "latent_coef_on_survival" = c("R/01_simulate.R", "0\\.45 \\* unmeas_strength \\* u_hidden"),
  "latent_coef_on_treatment" = c("R/01_simulate.R", "0\\.60 \\* unmeas_strength \\* u_hidden"),
  "administrative_censoring_months" = c("R/01_simulate.R", "ADMIN_CENS <- 180\\b"),
  "random_dropout_mean_months" = c("R/01_simulate.R", "CENS_MEAN <- 210\\b"),
  "cohort_seed_base" = c("R/01_simulate.R", "seed <- 1000 \\+ sid"),
  "forest_seed" = c("R/02_fit_methods.R", "Sys\\.getenv\\(\"DEMO_SEED\", \"101\"\\)"),
  "replication_seed_base" = c("R/04_replicate_seeds.R", "SEEDS <- 2000L \\+ seq_len\\(N_SEEDS\\)")
)

# Registered but with no literal site in the code, each with its reason. This is
# the escape hatch, so it is where an unchecked parameter would hide: it is kept
# short and every entry must carry a reason.
NO_SITE <- c(
  euler_e       = "registry-only constant, so the derived hazard ratios can be arithmetic",
  horizon_count = "implied by seq(12, 120, by = 24); not written as a number"
)

src <- new.env()
for (f in unique(vapply(SITES, `[`, character(1), 1)))
  assign(f, paste(readLines(f, warn = FALSE), collapse = "\n"), envir = src)

# --- 1. every anchor matches its source exactly once -----------------------
bad <- character(0)
for (pid in names(SITES)) {
  f <- SITES[[pid]][1]; pat <- SITES[[pid]][2]
  txt <- get(f, envir = src)
  g <- gregexpr(pat, txt, perl = TRUE)[[1]]
  n <- if (g[1] < 0) 0L else length(g)
  if (n != 1L) bad <- c(bad, sprintf("%s (%d matches in %s)", pid, n, f))
}
ok(sprintf("all %d registered values still sit at their site in the source%s",
           length(SITES),
           if (length(bad)) paste0(" -- BROKEN: ", paste(bad, collapse = "; ")) else ""),
   length(bad) == 0L)

# --- 2. parse the registry and check coverage both ways -------------------
reg_lines <- readLines("sim_provenance.yaml", warn = FALSE)
ids <- character(0); srcs <- character(0); cur <- NA_character_
for (ln in reg_lines) {
  m <- regmatches(ln, regexec("^  - id: ([A-Za-z0-9_]+)\\s*$", ln))[[1]]
  if (length(m) == 2) { cur <- m[2]; next }
  m <- regmatches(ln, regexec("^    source: ([a-z_]+)\\s*$", ln))[[1]]
  if (length(m) == 2 && !is.na(cur)) {
    ids <- c(ids, cur); srcs <- c(srcs, m[2]); cur <- NA_character_
  }
}
ok("the registry parsed and holds parameters", length(ids) > 30)
ok("every parsed id is unique", !any(duplicated(ids)))

user_ids <- ids[srcs == "user_supplied"]
uncovered <- setdiff(user_ids, c(names(SITES), names(NO_SITE)))
ok(sprintf("every user_supplied parameter has a site, or a stated reason it has none%s",
           if (length(uncovered)) paste0(" -- UNCOVERED: ",
                                         paste(uncovered, collapse = ", ")) else ""),
   length(uncovered) == 0L)
orphan <- setdiff(names(SITES), ids)
ok(sprintf("every site names a parameter that is actually registered%s",
           if (length(orphan)) paste0(" -- ORPHANED: ",
                                      paste(orphan, collapse = ", ")) else ""),
   length(orphan) == 0L)
ok("every NO_SITE exemption carries a reason and the list stays short",
   all(nzchar(NO_SITE)) && length(NO_SITE) <= 4L)
ok("every exempted id is actually in the registry", all(names(NO_SITE) %in% ids))

# --- 3. the knobs the site's two level selectors expose are all registered ---
# These are the numbers a visitor can move on the page, so a drift between the
# registry and the code reaches a reader before it reaches anyone else.
for (knob in c("gamma_level_none", "gamma_level_mild", "gamma_level_moderate",
               "gamma_level_strong", "Gamma_u_level_none",
               "Gamma_u_level_moderate", "Gamma_u_level_strong"))
  ok(sprintf("confounding level %s is registered", knob), knob %in% ids)

# --- 4. the registry says what it is ---------------------------------------
reg_txt <- paste(reg_lines, collapse = "\n")
ok("the registry names R/01_simulate.R as its source of truth",
   grepl("Source of truth for every value: R/01_simulate.R", reg_txt, fixed = TRUE))
ok("no parameter claims a literature source (nothing here is taken from a paper)",
   !grepl("source: literature", reg_txt, fixed = TRUE))
# Count YAML entries only. The header prose mentions `assumption_ack: true`
# while explaining the convention, so a plain fixed-string count is one too many.
ok("every user_supplied parameter acknowledges that it is an assumption",
   sum(grepl("^      assumption_ack: true\\s*$", reg_lines)) == length(user_ids))

cat(sprintf("test_sim_provenance.R: %s (%d failure%s)\n",
            if (fails == 0L) "PASS" else "FAIL", fails,
            if (fails == 1L) "" else "s"))
quit(status = if (fails == 0L) 0L else 1L)
