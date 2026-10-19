# Regression check: kit CSVs must use LF on every platform and regenerate the
# same data. Last-bit floating-point serialization can differ across platforms;
# preserve the frozen files rather than changing them to match the current Mac.
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
  if (any(fresh == as.raw(13))) stop(name, " contains CR bytes; expected LF only")
  a <- read.csv(text = rawToChar(committed), stringsAsFactors = FALSE)
  b <- read.csv(text = rawToChar(fresh), stringsAsFactors = FALSE)
  stopifnot(identical(names(a), names(b)), identical(dim(a), dim(b)))
  for (column in names(a)) {
    if (is.double(a[[column]]) && is.double(b[[column]])) {
      stopifnot(all(is.finite(b[[column]])),
                all(abs(a[[column]] - b[[column]]) <= 1e-12))
    } else stopifnot(identical(a[[column]], b[[column]]))
  }
}
cat("PASS: regenerated kit CSVs use LF; discrete values are exact and numeric differences <= 1e-12.\n")
