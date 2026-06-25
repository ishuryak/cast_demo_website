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
    tlearner = rnd(f$tlearner),
    csf   = list(ate = rnd(f$csf$ate), lo = rnd(f$csf$lo), hi = rnd(f$csf$hi)),
    cast  = list(fit = rnd(f$cast$fit), lo = rnd(f$cast$lo), hi = rnd(f$cast$hi),
                 peak_time = rnd(f$cast$peak_time, 1),
                 peak_effect = rnd(f$cast$peak_effect, 3),
                 peak_in_range = isTRUE(f$cast$peak_in_range),
                 r_squared = rnd(f$cast$r_squared, 3),
                 method = f$cast$method),
    cox = list(hr = rnd(f$cox$hr, 3), lo = rnd(f$cox$lo, 3), hi = rnd(f$cox$hi, 3),
               ph_p = rnd(f$cox$ph_p, 4), ate = rnd(f$cox$ate)),
    shrinkage = list(alpha = rnd(f$shrinkage$alpha, 4),
                     target_scale = rnd(f$shrinkage$target_scale, 4),
                     cond_before = rnd(f$shrinkage$cond_before, 1),
                     cond_after = rnd(f$shrinkage$cond_after, 1)),
    rmse = list(naive = rnd(f$rmse$naive, 3), cox = rnd(f$rmse$cox, 3),
                rsf = rnd(f$rmse$rsf, 3), tlearner = rnd(f$rmse$tlearner, 3),
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
  tlcol   <- "#CC79A7"                             # RSF T-learner (site COLORS.tlearner)
  coxcol  <- "#9467BD"                             # Cox marginal curve (site COLORS.coxate)
  bandcol <- adjustcolor(green, alpha.f = 0.15)   # same tint as the site ribbon
  ebcol   <- adjustcolor(green, alpha.f = 0.45)   # CSF error-bar color (site)
  # include band + CI extents so nothing is clipped
  ylim <- range(c(f$truth, f$naive, f$cox$ate, f$rsf, f$tlearner, f$csf$ate,
                  f$csf$lo, f$csf$hi, f$cast$fit, f$cast$lo, f$cast$hi), na.rm = TRUE)
  ylim <- ylim + c(-0.05, 0.05) * diff(ylim)
  plot(h, f$truth, type = "n", xlab = "Horizon (months)",
       ylab = "ATE: survival-probability difference", main = title, ylim = ylim,
       bty = "l", font.main = 2)
  abline(h = 0, col = "grey75", lty = 3)
  # CAST 95% band first, under the lines (matches the site's shaded ribbon)
  okb <- is.finite(f$cast$lo) & is.finite(f$cast$hi)
  if (any(okb))
    polygon(c(h[okb], rev(h[okb])), c(f$cast$hi[okb], rev(f$cast$lo[okb])),
            col = bandcol, border = NA)
  lines(h, f$truth, col = "black",   lwd = 3)               # truth
  lines(h, f$naive, col = "#D55E00", lwd = 2, lty = 2)      # naive
  lines(h, f$rsf,      col = "#0072B2", lwd = 2, lty = 4)   # RSF S-learner
  lines(h, f$tlearner, col = tlcol,     lwd = 2, lty = 5)   # RSF T-learner
  lines(h, f$cox$ate,  col = coxcol,    lwd = 2, lty = 6)   # Cox marginal curve
  segments(h, f$csf$lo, h, f$csf$hi, col = ebcol, lwd = 2)  # CSF 95% CI bars
  points(h, f$csf$ate, col = green, pch = 19, cex = 1.2)    # CSF points
  lines(h, f$cast$fit, col = green, lwd = 2.6)              # CAST trajectory

  # ---- float the legend into the emptiest corner --------------------------
  # The data shape varies by scenario (rising plateau vs. crossing reversal), so a
  # fixed "topleft" legend often lands on top of the curves. Instead, measure the
  # legend box, build a dense cloud of every "occupied" point (each line, the
  # FILLED CAST band interior, and the CSF CI whiskers), count how many fall in
  # each of the four corner boxes, and place the legend where the fewest do. A
  # translucent white background keeps it readable even where a line passes near.
  leg_args <- list(
    legend = c("Truth", "Naive (unadjusted)", "RSF S-learner",
               "RSF T-learner", "Cox (marginal)", "CSF (points, 95% CI)",
               "CAST trajectory", "CAST 95% band"),
    col = c("black", "#D55E00", "#0072B2", tlcol, coxcol, green, green, bandcol),
    lty = c(1, 2, 4, 5, 6, NA, 1, NA), pch = c(NA, NA, NA, NA, NA, 19, NA, 15),
    lwd = c(3, 2, 2, 2, 2, NA, 2.6, NA), pt.cex = c(1, 1, 1, 1, 1, 1.2, 1, 2.4),
    cex = 0.8, bty = "o", box.col = NA, bg = adjustcolor("white", alpha.f = 0.7))
  dens <- seq(min(h), max(h), length.out = 60)
  px <- numeric(0); py <- numeric(0)
  add_pts <- function(x, y) { px <<- c(px, x); py <<- c(py, y) }
  for (s in list(f$truth, f$naive, f$rsf, f$tlearner, f$cox$ate, f$cast$fit, f$csf$ate)) {
    s <- as.numeric(s); okk <- is.finite(s)
    if (sum(okk) >= 2) add_pts(dens, approx(h[okk], s[okk], dens, rule = 2)$y)
  }
  # CAST band interior: fill the lo..hi region so the legend avoids the shading.
  # Weighted x5 (added five times) because covering a filled shaded region reads
  # as more cluttered than grazing a single thin line of equal sampled-point count.
  bok <- is.finite(f$cast$lo) & is.finite(f$cast$hi)
  if (any(bok)) {
    blo <- approx(h[bok], f$cast$lo[bok], dens, rule = 2)$y
    bhi <- approx(h[bok], f$cast$hi[bok], dens, rule = 2)$y
    for (rep_w in 1:5)
      for (q in seq(0, 1, length.out = 5)) add_pts(dens, blo + q * (bhi - blo))
  }
  # CSF CI vertical whiskers at each horizon
  for (i in seq_along(h))
    if (is.finite(f$csf$lo[i]) && is.finite(f$csf$hi[i]))
      add_pts(rep(h[i], 5), seq(f$csf$lo[i], f$csf$hi[i], length.out = 5))

  lg   <- do.call(legend, c(list(x = "topleft", plot = FALSE), leg_args))
  lwd_ <- lg$rect$w; lht_ <- lg$rect$h
  u    <- par("usr"); pad <- c(0.02 * diff(u[1:2]), 0.02 * diff(u[3:4]))
  boxes <- list(
    topleft     = c(u[1] + pad[1], u[1] + pad[1] + lwd_, u[4] - pad[2] - lht_, u[4] - pad[2]),
    topright    = c(u[2] - pad[1] - lwd_, u[2] - pad[1], u[4] - pad[2] - lht_, u[4] - pad[2]),
    bottomleft  = c(u[1] + pad[1], u[1] + pad[1] + lwd_, u[3] + pad[2], u[3] + pad[2] + lht_),
    bottomright = c(u[2] - pad[1] - lwd_, u[2] - pad[1], u[3] + pad[2], u[3] + pad[2] + lht_))
  inbox <- function(b) sum(px >= b[1] & px <= b[2] & py >= b[3] & py <= b[4])
  pos   <- names(boxes)[which.min(vapply(boxes, inbox, numeric(1)))]
  do.call(legend, c(list(x = pos), leg_args))
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
