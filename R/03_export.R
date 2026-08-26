# 03_export.R
# Export fitted results to scenarios.json for the static site, plus
# publication-style PNG fallbacks (600 DPI, bold black axes) for the README.
#
# Output (full run):      docs/data/scenarios.json, docs/figs/*.png
# Output (smoke test):    output/preview/...   -- see OUT_DATA / OUT_FIGS below.

suppressWarnings(suppressMessages({ library(jsonlite) }))

source("R/scenario_labels.R")   # conf_word() / conf_title(), keyed to gamma

res  <- readRDS("output/fits.rds")
fits <- res$fits

# A subsample run produces a deliberately reduced grid (one shape, two
# confounding levels, no latent-confounder axis). Writing that into docs/ would
# overwrite the published site data with a smoke-test artifact, so the smoke
# test exports to output/preview/ instead and says so.
SUB <- as.integer(Sys.getenv("DEMO_SUBSAMPLE", "0"))
# Trust what produced output/fits.rds over the current environment: running this
# script on its own after a smoke test would otherwise publish the reduced grid.
FIT_SUB <- if (is.null(res$subsample)) NA_integer_ else as.integer(res$subsample)
if (is.na(FIT_SUB)) {
  cat("[03_export] note: output/fits.rds predates the subsample stamp; ",
      "trusting DEMO_SUBSAMPLE=", SUB, "\n", sep = "")
} else if (FIT_SUB > 0 && SUB == 0) {
  cat("[03_export] output/fits.rds came from a subsample run (n=", FIT_SUB,
      "); exporting to output/preview/ rather than docs/.\n", sep = "")
  SUB <- FIT_SUB
}
if (SUB > 0) {
  OUT_DATA <- "output/preview/data"; OUT_FIGS <- "output/preview/figs"
  cat("[03_export] DEMO_SUBSAMPLE=", SUB,
      " -> smoke-test export to output/preview/ (docs/ left untouched)\n", sep = "")
} else {
  OUT_DATA <- "docs/data"; OUT_FIGS <- "docs/figs"
}
dir.create(OUT_DATA, recursive = TRUE, showWarnings = FALSE)
dir.create(OUT_FIGS, recursive = TRUE, showWarnings = FALSE)

rnd <- function(x, d = 4) if (is.null(x)) NULL else round(as.numeric(x), d)

scenarios_out <- lapply(fits, function(f) {
  list(
    meta = list(shape = f$meta$shape, conf_strength = f$meta$conf_strength,
                unmeas_strength = f$meta$unmeas_strength,
                n = f$meta$n, event_rate = rnd(f$meta$event_rate, 3),
                treated_frac = rnd(f$meta$treated_frac, 3),
                smd_age = rnd(f$meta$smd_age, 3), smd_ps = rnd(f$meta$smd_ps, 3),
                smd_comorb = rnd(f$meta$smd_comorb, 3),
                smd_smoke = rnd(f$meta$smd_smoke, 3),
                smd_u_hidden = rnd(f$meta$smd_u_hidden, 3)),
    truth = rnd(f$truth),
    naive = rnd(f$naive),
    rsf   = rnd(f$rsf),
    tlearner = rnd(f$tlearner),
    csf   = list(ate = rnd(f$csf$ate), lo = rnd(f$csf$lo), hi = rnd(f$csf$hi)),
    cast  = list(fit = rnd(f$cast$fit), lo = rnd(f$cast$lo), hi = rnd(f$cast$hi),
                 # dense quadratic for smooth rendering (the fit IS a smooth
                 # quadratic; drawing it only at the 5 horizons makes a polyline)
                 curve_t = as.numeric(f$cast$curve_t),
                 curve_fit = rnd(f$cast$curve_fit),
                 curve_lo = rnd(f$cast$curve_lo),
                 curve_hi = rnd(f$cast$curve_hi),
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
                   pct_clipped = rnd(f$overlap$pct_clipped, 3)),
    robustness = list(ate_omitU = rnd(f$robustness$ate_omitU),
                      ate_withU = rnd(f$robustness$ate_withU),
                      shift     = rnd(f$robustness$shift),
                      # baseline control-arm survival the E-value's risk-ratio
                      # conversion is anchored to, per horizon.
                      s0_baseline = rnd(f$robustness$s0_baseline),
                      evalue    = rnd(f$robustness$evalue, 2)),
    autoc = list(est = rnd(f$autoc$est, 3), se = rnd(f$autoc$se, 3),
                 toc = if (is.null(f$autoc$toc)) NULL else
                       list(q = rnd(f$autoc$toc$q, 3), est = rnd(f$autoc$toc$est, 3)))
  )
})

# I() keeps a length-1 grid an ARRAY. Without it, auto_unbox turns a single-shape
# smoke run's `shapes` into the scalar "plateau" and the front end's
# DATA.shapes.forEach throws, which the fetch().catch() then reports as a
# misleading "could not load scenarios.json".
out <- list(
  generated = format(Sys.time(), "%Y-%m-%d %H:%M"),
  horizons = I(as.numeric(res$horizons)),
  curve_grid = I(as.numeric(res$curve_grid)),
  shapes = I(as.character(res$shapes)),
  conf_grid = I(as.numeric(res$conf_grid)),
  unmeas_grid = I(as.numeric(res$unmeas_grid)),
  scenarios = scenarios_out
)

json_path <- file.path(OUT_DATA, "scenarios.json")
writeLines(toJSON(out, auto_unbox = TRUE, na = "null", digits = 6, pretty = TRUE),
           json_path)
cat("[03_export] wrote", json_path, "(", length(scenarios_out), "scenarios )\n")

# ---- publication-style PNG fallbacks (base R; 600 DPI, bold black axes) ----
# Faithful static replica of the live site plot: same series, the shaded CAST 95%
# band, and the CSF point-wise 95% CI error bars. Colors match docs/app.js.
GREEN <- "#009E73"; TLCOL <- "#CC79A7"; COXCOL <- "#9467BD"
NAIVECOL <- "#D55E00"; RSFCOL <- "#0072B2"

pub_plot <- function(f, file, title) {
  png(file, width = 7, height = 5, units = "in", res = 600, bg = "white")
  par(font.lab = 2, font.axis = 2, cex.lab = 1.25, cex.axis = 1.05,
      mar = c(4.6, 4.8, 2.4, 1.2), lwd = 1.6)
  h  <- f$horizons
  ct <- f$cast$curve_t                             # dense grid for the smooth fit
  bandcol <- adjustcolor(GREEN, alpha.f = 0.15)    # same tint as the site ribbon
  ebcol   <- adjustcolor(GREEN, alpha.f = 0.45)    # CSF error-bar color (site)
  # include band + CI extents so nothing is clipped
  ylim <- range(c(f$truth, f$naive, f$cox$ate, f$rsf, f$tlearner, f$csf$ate,
                  f$csf$lo, f$csf$hi, f$cast$curve_fit, f$cast$curve_lo,
                  f$cast$curve_hi), na.rm = TRUE)
  ylim <- ylim + c(-0.05, 0.05) * diff(ylim)
  plot(h, f$truth, type = "n", xlab = "Horizon (months)",
       ylab = "ATE: survival-probability difference", main = title, ylim = ylim,
       bty = "l", font.main = 2)
  abline(h = 0, col = "grey75", lty = 3)
  # CAST 95% band first, under the lines (matches the site's shaded ribbon)
  okb <- is.finite(f$cast$curve_lo) & is.finite(f$cast$curve_hi)
  if (any(okb))
    polygon(c(ct[okb], rev(ct[okb])),
            c(f$cast$curve_hi[okb], rev(f$cast$curve_lo[okb])),
            col = bandcol, border = NA)
  lines(h, f$truth, col = "black",  lwd = 3)                # truth
  lines(h, f$naive, col = NAIVECOL, lwd = 2, lty = 2)       # naive
  lines(h, f$rsf,      col = RSFCOL, lwd = 2, lty = 4)      # RSF S-learner
  lines(h, f$tlearner, col = TLCOL,  lwd = 2, lty = 5)      # RSF T-learner
  lines(h, f$cox$ate,  col = COXCOL, lwd = 2, lty = 6)      # Cox marginal curve
  segments(h, f$csf$lo, h, f$csf$hi, col = ebcol, lwd = 2)  # CSF 95% CI bars
  points(h, f$csf$ate, col = GREEN, pch = 19, cex = 1.2)    # CSF points
  lines(ct, f$cast$curve_fit, col = GREEN, lwd = 2.6)       # CAST smooth trajectory

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
    col = c("black", NAIVECOL, RSFCOL, TLCOL, COXCOL, GREEN, GREEN, bandcol),
    lty = c(1, 2, 4, 5, 6, NA, 1, NA), pch = c(NA, NA, NA, NA, NA, 19, NA, 15),
    lwd = c(3, 2, 2, 2, 2, NA, 2.6, NA), pt.cex = c(1, 1, 1, 1, 1, 1.2, 1, 2.4),
    cex = 0.8, bty = "o", box.col = NA, bg = adjustcolor("white", alpha.f = 0.7))
  dens <- seq(min(h), max(h), length.out = 60)
  px <- numeric(0); py <- numeric(0)
  add_pts <- function(x, y) { px <<- c(px, x); py <<- c(py, y) }
  for (s in list(f$truth, f$naive, f$rsf, f$tlearner, f$cox$ate, f$csf$ate)) {
    s <- as.numeric(s); okk <- is.finite(s)
    if (sum(okk) >= 2) add_pts(dens, approx(h[okk], s[okk], dens, rule = 2)$y)
  }
  okc <- is.finite(f$cast$curve_fit)
  if (sum(okc) >= 2)
    add_pts(dens, approx(ct[okc], f$cast$curve_fit[okc], dens, rule = 2)$y)
  # CAST band interior: fill the lo..hi region so the legend avoids the shading.
  # Weighted x5 (added five times) because covering a filled shaded region reads
  # as more cluttered than grazing a single thin line of equal sampled-point count.
  if (any(okb)) {
    blo <- approx(ct[okb], f$cast$curve_lo[okb], dens, rule = 2)$y
    bhi <- approx(ct[okb], f$cast$curve_hi[okb], dens, rule = 2)$y
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

# One figure per (shape x confounding level) at the base (no unmeasured
# confounding) slice, so every slider position on the measured-confounding axis
# has a matching static preview and the README gallery stays 2 x 4.
for (shape in res$shapes) {
  for (g in res$conf_grid) {
    key <- sprintf("%s_conf%.2f_unmeas0.00", shape, g)
    if (is.null(fits[[key]])) next
    file <- file.path(OUT_FIGS, sprintf("%s_%s_confounding.png", shape, conf_word(g)))
    pub_plot(fits[[key]], file,
             sprintf("%s effect, %s confounding", tools::toTitleCase(shape),
                     conf_title(g)))
    cat("[03_export] wrote", file, "\n")
  }
}

# ---- one figure for the unmeasured-confounding axis ------------------------
# The measured-confounding panels above cannot show the latent-confounder story,
# because every one of them is the Gamma_u = 0 slice. This panel holds measured
# confounding fixed and sweeps the latent strength.
#
# It plots the BIAS, CSF minus that scenario's OWN true ATE, rather than the CSF
# estimates against a single truth curve. The latent factor widens the spread of
# baseline survival, so the true ATE is itself slightly different at each Gamma
# (on the panel this function draws -- plateau, gamma = 1 -- its peak falls from
# 0.163 at Gamma = 0 to 0.140 at Gamma = 1.5). Drawing three estimate curves
# against one truth line would charge that shift to the estimator and overstate
# the bias; differencing each estimate against its own truth is the honest
# comparison and puts the quantity of interest directly on the y axis.
unmeas_plot <- function(shape, g, file) {
  keys <- sprintf("%s_conf%.2f_unmeas%.2f", shape, g, res$unmeas_grid)
  if (!all(keys %in% names(fits))) return(invisible(FALSE))
  ff <- fits[keys]
  bias <- lapply(ff, function(x) x$csf$ate - x$truth)
  png(file, width = 7, height = 5, units = "in", res = 600, bg = "white")
  par(font.lab = 2, font.axis = 2, cex.lab = 1.25, cex.axis = 1.05,
      mar = c(4.6, 5.0, 3.0, 1.2), lwd = 1.6)
  h    <- ff[[1]]$horizons
  cols <- c("#0072B2", "#E69F00", "#D55E00")[seq_along(keys)]
  ylim <- range(c(0, unlist(bias)), na.rm = TRUE)
  ylim <- ylim + c(-0.10, 0.22) * diff(ylim)
  plot(h, bias[[1]], type = "n", xlab = "Horizon (months)",
       ylab = "CSF bias: estimate - own true ATE", ylim = ylim, bty = "l",
       font.main = 2,
       main = sprintf("%s effect, %s measured confounding:\nCSF bias under an unmeasured confounder",
                      tools::toTitleCase(shape), conf_title(g)))
  abline(h = 0, col = "grey55", lty = 3, lwd = 2)
  for (i in seq_along(keys)) {
    lines(h, bias[[i]], col = cols[i], lwd = 2.4, lty = i + 1)
    points(h, bias[[i]], col = cols[i], pch = 19, cex = 1.1)
  }
  legend("topleft", bty = "o", box.col = NA, cex = 0.82,
         bg = adjustcolor("white", alpha.f = 0.7),
         legend = c("zero bias (recovers its own truth)",
                    sprintf("latent strength %.2f", res$unmeas_grid)),
         col = c("grey55", cols), lwd = c(2, rep(2.4, length(keys))),
         lty = c(3, seq_along(keys) + 1))
  dev.off()
  invisible(TRUE)
}
if (length(res$unmeas_grid) > 1) {
  ufile <- file.path(OUT_FIGS, "unmeasured_confounding.png")
  if (isTRUE(unmeas_plot("plateau", 1.0, ufile)))
    cat("[03_export] wrote", ufile, "\n")
}
