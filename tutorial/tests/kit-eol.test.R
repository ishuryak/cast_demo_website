# Regression check (2026-09-28): regenerating the class-kit CSVs must reproduce
# the committed bytes. On Windows, write.csv defaults to CRLF line endings, which
# changed every provenance hash for identical content. This test is only
# discriminating when run under Windows R; on Linux both versions write LF.
file_arg <- grep("^--file=", commandArgs(), value = TRUE)
test_dir <- dirname(normalizePath(sub("^--file=", "", file_arg[[1]])))
repo <- normalizePath(file.path(test_dir, "..", ".."), mustWork = TRUE)
scratch <- tempfile("cast-kit-eol-")
dir.create(file.path(scratch, "tutorial", "class-kit", "R"), recursive = TRUE)
dir.create(file.path(scratch, "tutorial", "scripts"))
kit_src <- file.path(repo, "tutorial", "class-kit", "R", c("cast_core.R", "01_simulate.R"))
stopifnot(all(file.copy(kit_src, file.path(scratch, "tutorial", "class-kit", "R"))))
stopifnot(file.copy(file.path(repo, "tutorial", "scripts", "prepare-class-kit.R"),
                    file.path(scratch, "tutorial", "scripts")))
original_wd <- getwd()
setwd(scratch)
invisible(capture.output(source("tutorial/scripts/prepare-class-kit.R")))
setwd(original_wd)
for (name in c("demo-cohort.csv", "answer-key.csv")) {
  fresh <- readBin(file.path(scratch, "tutorial", "class-kit", "data", name), "raw", 1e7)
  committed <- readBin(file.path(repo, "tutorial", "class-kit", "data", name), "raw", 1e7)
  if (!identical(fresh, committed))
    stop(name, " regenerated differently (", sum(fresh == as.raw(13)), " CR bytes)")
}
cat("PASS: regenerated class-kit CSVs are byte-identical to the committed ones",
      if (.Platform$OS.type == "windows") "(Windows R).\n" else "(non-Windows: not discriminating).\n")
