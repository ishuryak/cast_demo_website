# 03_export.R
# Export fitted results to docs/data/scenarios.json for the static site, plus
# publication-style PNG fallbacks (600 DPI, bold black axes) for the README.
#
# Output: docs/data/scenarios.json, docs/figs/*.png

suppressWarnings(suppressMessages({ library(jsonlite) }))

res <- readRDS("output/fits.rds")
fits <- res$fits

dir.create("docs/data", recursive = TRUE, showWarnings = FALSE)
dir.create("docs/figs", recursive = TRUE, showWarnings = FALSE)

rnd <- function(x, d = 4) if (is.null(x)) NULL else round(as.numeric(x), d)

scenarios_out <- lapply(fits, function(f) {
  list(
    meta = list(shape = f$meta$shape, conf_strength = f$meta$conf_strength,
                n = f$meta$n, event_rate = rnd(f$meta$event_rate, 3),
                treated_frac = rnd(f$meta$treated_frac, 3),
                smd_age = rnd(f$meta$smd_age, 3), smd_ps = rnd(f$meta$smd_ps, 3),
                smd_comorb = rnd(f$meta$smd_comorb, 3),
                smd_smoke = rnd(f$meta$smd_smoke, 3)),
    truth = rnd(f$truth),
    naive = rnd(f$naive),
    rsf   = rnd(f$rsf),
    csf   = list(ate = rnd(f$csf$ate), lo = rnd(f$csf$lo), hi = rnd(f$csf$hi)),
    cast  = list(fit = rnd(f$cast$fit), lo = rnd(f$cast$lo), hi = rnd(f$cast$hi),
                 peak_time = rnd(f$cast$peak_time, 1),
                 peak_effect = rnd(f$cast$peak_effect, 3),
                 peak_in_range = isTRUE(f$cast$peak_in_range),
                 r_squared = rnd(f$cast$r_squared, 3),
                 method = f$cast$method),
    cox = list(hr = rnd(f$cox$hr, 3), lo = rnd(f$cox$lo, 3), hi = rnd(f$cox$hi, 3),
               ph_p = rnd(f$cox$ph_p, 4)),
    shrinkage = list(alpha = rnd(f$shrinkage$alpha, 4),
                     target_scale = rnd(f$shrinkage$target_scale, 4),
                     cond_before = rnd(f$shrinkage$cond_before, 1),
                     cond_after = rnd(f$shrinkage$cond_after, 1)),
    rmse = list(naive = rnd(f$rmse$naive, 3), rsf = rnd(f$rmse$rsf, 3),
                csf = rnd(f$rmse$csf, 3), cast = rnd(f$rmse$cast, 3)),
    overlap = list(min = rnd(f$overlap$min, 3), max = rnd(f$overlap$max, 3),
                   pct_extreme = rnd(f$overlap$pct_extreme, 3),
                   pct_clipped = rnd(f$overlap$pct_clipped, 3))
  )
})

out <- list(
  generated = format(Sys.time(), "%Y-%m-%d %H:%M"),
  horizons = res$horizons,
  shapes = res$shapes,
  conf_grid = res$conf_grid,
  scenarios = scenarios_out
)

writeLines(toJSON(out, auto_unbox = TRUE, na = "null", digits = 6, pretty = TRUE),
           "docs/data/scenarios.json")
cat("[03_export] wrote docs/data/scenarios.json (", length(scenarios_out), "scenarios )\n")

# ---- publication-style PNG fallbacks (base R; 600 DPI, bold black axes) ----
# Faithful static replica of the live site plot: same series, the shaded CAST 95%
# band, and the CSF point-wise 95% CI error bars. Colors match docs/app.js.
pub_plot <- function(f, file, title) {
  png(file, width = 7, height = 5, units = "in", res = 600, bg = "white")
  par(font.lab = 2, font.axis = 2, cex.lab = 1.25, cex.axis = 1.05,
      mar = c(4.6, 4.8, 2.4, 1.2), lwd = 1.6)
  h <- f$horizons
  green   <- "#009E73"
  bandcol <- adjustcolor(green, alpha.f = 0.15)   # same tint as the site ribbon
  ebcol   <- adjustcolor(green, alpha.f = 0.45)   # CSF error-bar color (site)
  # include band + CI extents so nothing is clipped
  ylim <- range(c(f$truth, f$naive, f$rsf, f$csf$ate, f$csf$lo, f$csf$hi,
                  f$cast$fit, f$cast$lo, f$cast$hi), na.rm = TRUE)
  ylim <- ylim + c(-0.05, 0.05) * diff(ylim)
  plot(h, f$truth, type = "n", xlab = "Horizon (months)",
       ylab = "ATE: RMST difference (months)", main = title, ylim = ylim,
       bty = "l", font.main = 2)
  abline(h = 0, col = "grey75", lty = 3)
  # CAST 95% band first, under the lines (matches the site's shaded ribbon)
  okb <- is.finite(f$cast$lo) & is.finite(f$cast$hi)
  if (any(okb))
    polygon(c(h[okb], rev(h[okb])), c(f$cast$hi[okb], rev(f$cast$lo[okb])),
            col = bandcol, border = NA)
  lines(h, f$truth, col = "black",   lwd = 3)               # truth
  lines(h, f$naive, col = "#D55E00", lwd = 2, lty = 2)      # naive
  lines(h, f$rsf,   col = "#0072B2", lwd = 2, lty = 4)      # RSF
  segments(h, f$csf$lo, h, f$csf$hi, col = ebcol, lwd = 2)  # CSF 95% CI bars
  points(h, f$csf$ate, col = green, pch = 19, cex = 1.2)    # CSF points
  lines(h, f$cast$fit, col = green, lwd = 2.6)              # CAST trajectory
  legend("topleft", bty = "n", cex = 0.92,
         legend = c("Truth", "Naive (unadjusted)", "RSF S-learner",
                    "CSF (points, 95% CI)", "CAST trajectory", "CAST 95% band"),
         col = c("black", "#D55E00", "#0072B2", green, green, bandcol),
         lty = c(1, 2, 4, NA, 1, NA), pch = c(NA, NA, NA, 19, NA, 15),
         lwd = c(3, 2, 2, NA, 2.6, NA), pt.cex = c(1, 1, 1, 1.2, 1, 2.4))
  dev.off()
}

# One figure per (shape x confounding level), so every slider position the site
# offers has a matching static preview. The strong-confounding files keep their
# existing names (referenced by the README); the others are new.
file_word  <- c("none", "mild", "moderate", "strong", "very strong")  # file names
title_word <- c("no",   "mild", "moderate", "strong", "very strong")  # grammatical
for (shape in res$shapes) {
  for (ci in seq_along(res$conf_grid)) {
    key <- sprintf("%s_conf%.2f", shape, res$conf_grid[ci])
    if (is.null(fits[[key]])) next
    file <- sprintf("docs/figs/%s_%s_confounding.png", shape, file_word[ci])
    pub_plot(fits[[key]], file,
             sprintf("%s effect, %s confounding", tools::toTitleCase(shape),
                     title_word[ci]))
    cat("[03_export] wrote", file, "\n")
  }
}
