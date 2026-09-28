# Regression check (2026-09-28): inside the class kit, the exercise must run with
# no network by using the bundled R/ sources, and must use them only when their
# MD5 matches the pinned commit. Before this fix the default always downloaded
# from GitHub, so a classroom without internet failed at the first call.
file_arg <- grep("^--file=", commandArgs(), value = TRUE)
test_dir <- dirname(normalizePath(sub("^--file=", "", file_arg[[1]])))
source(file.path(test_dir, "..", "labs", "cast-exercise.R"))
kit <- normalizePath(file.path(test_dir, "..", "class-kit"), mustWork = TRUE)

offline <- run_cast_exercise
probe <- new.env(parent = environment(run_cast_exercise))
probe$download.file <- function(...) stop("network unavailable")
environment(offline) <- probe

original_wd <- getwd()
on.exit(setwd(original_wd), add = TRUE)

# 1. Bundled, unmodified sources: runs offline and records where they came from.
setwd(kit)
out <- tempfile("cast-offline-")
res <- offline(n = 200L, num_trees = 100L, output_dir = out)
info <- readLines(list.files(out, "run-info.txt", recursive = TRUE, full.names = TRUE)[[1]])
stopifnot(any(grepl("^Source mode: bundled kit copy", info)))

# 2. A modified local copy must not be passed off as the pinned source: the
# function falls back to the download, which is unavailable here.
fake <- tempfile("cast-modified-")
dir.create(file.path(fake, "R"), recursive = TRUE)
stopifnot(all(file.copy(file.path(kit, "R", c("cast_core.R", "01_simulate.R")), file.path(fake, "R"))))
cat("# local edit\n", file = file.path(fake, "R", "cast_core.R"), append = TRUE)
setwd(fake)
err <- tryCatch(offline(n = 200L, num_trees = 100L, output_dir = tempfile()), error = identity)
stopifnot(inherits(err, "error"), grepl("network unavailable", conditionMessage(err)))
cat("PASS: bundled sources used offline; modified sources refused.\n")
