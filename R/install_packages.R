# install_packages.R: dependencies for the CAST demo.
# Run once with Windows R 4.5.1:
#   "/mnt/c/Program Files/R/R-4.5.1/bin/x64/Rscript.exe" R/install_packages.R
pkgs <- c("grf", "survival", "jsonlite")
for (p in pkgs) {
  if (!requireNamespace(p, quietly = TRUE)) {
    install.packages(p, repos = "https://cloud.r-project.org")
  }
  cat(sprintf("%-12s %s\n", p, requireNamespace(p, quietly = TRUE)))
}
