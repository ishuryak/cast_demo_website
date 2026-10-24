# Inspect the actual Super Learner candidates, including zero-weight learners.
# Rscript tutorial/scripts/glmnet-candidate-audit.R run AUDIT_OUTPUT GLMNET_LIBRARY
# Rscript tutorial/scripts/glmnet-candidate-audit.R compare OLD_OUTPUT NEW_OUTPUT CSV
# Run after glmnet-version-audit.R. Synthetic prediction arrays stay local.

candidate_run <- function(repo, output, library) {
  output <- normalizePath(output, mustWork = TRUE)
  .libPaths(c(normalizePath(library, mustWork = TRUE), .libPaths()))
  reference <- readRDS(file.path(output, "audit.rds"))
  config <- reference$config
  invisible(lapply(names(config$packages), requireNamespace, quietly = TRUE))
  stopifnot(identical(R.version.string, config$R), identical(R.version$platform, config$platform),
    identical(vapply(names(config$packages), function(p) as.character(packageVersion(p)), ""), config$packages),
    identical(unname(tools::md5sum(file.path(repo, names(config$source_md5)))), unname(config$source_md5)))
  stopifnot(as.character(packageVersion("glmnet")) == config$packages[["glmnet"]],
    normalizePath(dirname(find.package("glmnet"))) == normalizePath(library),
    length(reference$records) == config$reps * length(config$arms))
  destination <- file.path(output, "candidates.rds")
  if (file.exists(destination)) stop("Refusing to replace candidate results.")
  kit <- file.path(repo, "tutorial/class-kit")
  scratch <- tempfile("cast-candidate-audit-")
  dir.create(file.path(scratch, "R"), recursive = TRUE)
  old_wd <- getwd()
  on.exit({setwd(old_wd); unlink(scratch, recursive = TRUE)}, add = TRUE)
  stopifnot(all(file.copy(file.path(kit, "R", c("01_simulate.R", "cast_core.R")), file.path(scratch, "R"))))
  setwd(scratch)
  model <- new.env(parent = globalenv())
  model$DEMO_SOURCE_ONLY <- TRUE
  model$source <- function(file, ...) sys.source(file, envir = model)
  invisible(capture.output(sys.source("R/01_simulate.R", envir = model)))
  records <- vector("list", config$reps)
  for (rep in seq_len(config$reps)) {
    do.call(RNGkind, as.list(config$rng))
    cohort <- model$simulate_cohort(config$n, config$confounding, config$shape,
      config$seed_base + rep, unmeas_strength = config$hidden)
    observed <- cohort$data[, setdiff(names(cohort$data), "u_hidden")]
    write.csv(observed, "cohort.csv", row.names = FALSE)
    previous <- reference$records[[paste(rep, "superlearner", sep = "/")]]
    stopifnot(unname(tools::md5sum("cohort.csv")) == previous$input_md5[1])
    d <- read.csv("cohort.csv")
    X <- model.matrix(~ age + stage + ps + comorb + smoke + sex + factor(ethnicity), d)[, -1, drop = FALSE]
    sl_X <- as.data.frame(X)
    names(sl_X) <- make.names(names(sl_X), unique = TRUE)
    set.seed(config$fit_seed)
    warnings <- character()
    invisible(capture.output(withCallingHandlers(
      ensemble <- SuperLearner::CV.SuperLearner(Y = d$W, X = sl_X,
        family = stats::binomial(), SL.library = c("SL.glm", "SL.glmnet", "SL.ranger"),
        method = "method.NNloglik", cvControl = list(V = 5, stratifyCV = TRUE),
        innerCvControl = rep(list(list(V = 5, stratifyCV = TRUE)), 5),
        parallel = "seq", env = asNamespace("SuperLearner")),
      warning = function(w) {warnings <<- c(warnings, conditionMessage(w)); invokeRestart("muffleWarning")},
      message = function(m) invokeRestart("muffleMessage"))))
    stopifnot(identical(pmin(.99, pmax(.01, as.numeric(ensemble$SL.predict))), previous$propensity),
      all(is.finite(ensemble$library.predict)), all(is.finite(ensemble$coef)),
      !any(vapply(ensemble$AllSL, function(x) any(x$errorsInLibrary) || any(x$errorsInCVLibrary), logical(1))))
    records[[rep]] <- list(outer_folds = ensemble$folds, coefficients = ensemble$coef,
      candidates = ensemble$library.predict,
      inner_folds = lapply(ensemble$AllSL, `[[`, "validRows"),
      inner_candidates = lapply(ensemble$AllSL, `[[`, "Z"), warnings = warnings)
    cat("Candidate audit cohort", rep, "/", config$reps, "\n"); flush.console()
  }
  saveRDS(list(config = config, records = records), destination)
}

candidate_compare <- function(old, new, csv) {
  a <- readRDS(file.path(old, "candidates.rds")); b <- readRDS(file.path(new, "candidates.rds"))
  ca <- a$config; cb <- b$config
  ca$packages <- ca$packages[names(ca$packages) != "glmnet"]
  cb$packages <- cb$packages[names(cb$packages) != "glmnet"]
  stopifnot(identical(ca, cb), length(a$records) == ca$reps, length(b$records) == cb$reps)
  rows <- do.call(rbind, lapply(seq_along(a$records), function(i) {
    x <- a$records[[i]]; y <- b$records[[i]]
    stopifnot(identical(x$outer_folds, y$outer_folds), identical(x$inner_folds, y$inner_folds),
      identical(colnames(x$candidates), colnames(y$candidates)))
    data.frame(replicate = i, folds_identical = TRUE,
      outer_predictions_identical = identical(x$candidates, y$candidates),
      inner_predictions_identical = identical(x$inner_candidates, y$inner_candidates),
      coefficients_identical = identical(x$coefficients, y$coefficients),
      max_abs_glmnet_outer = max(abs(x$candidates[, "SL.glmnet_All"] - y$candidates[, "SL.glmnet_All"])),
      max_abs_all_outer = max(abs(x$candidates - y$candidates)),
      max_abs_all_inner = max(vapply(seq_along(x$inner_candidates), function(j)
        max(abs(x$inner_candidates[[j]] - y$inner_candidates[[j]])), numeric(1))),
      max_abs_coefficient = max(abs(x$coefficients - y$coefficients)),
      zero_glmnet_weights_old = sum(x$coefficients[, "SL.glmnet_All"] == 0),
      zero_glmnet_weights_new = sum(y$coefficients[, "SL.glmnet_All"] == 0),
      warnings_identical = identical(x$warnings, y$warnings))
  }))
  if (file.exists(csv)) stop("Refusing to replace comparison CSV.")
  write.csv(rows, csv, row.names = FALSE)
  print(summary(rows)); invisible(rows)
}

if (sys.nframe() == 0L) {
  args <- commandArgs(trailingOnly = TRUE)
  script <- normalizePath(sub("^--file=", "", grep("^--file=", commandArgs(), value = TRUE)[[1]]))
  if (length(args) == 3L && args[1] == "run")
    candidate_run(dirname(dirname(dirname(script))), args[2], args[3])
  else if (length(args) == 4L && args[1] == "compare") candidate_compare(args[2], args[3], args[4])
  else stop("Use run AUDIT_OUTPUT LIBRARY, or compare OLD_OUTPUT NEW_OUTPUT CSV")
}
