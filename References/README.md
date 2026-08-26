# References

Every source cited by this repository, so a cited claim can be re-checked
against the actual source.

## No publisher PDFs are committed here

A paywalled or copyright-restricted PDF is never committed to a git repository,
public or private: committing is publishing, a delete is not a removal (the blob
stays reachable until every commit is rewritten), and subscription licences allow
a personal copy while forbidding redistribution. `.gitignore` carries:

    References/*.pdf
    References/*.PDF
    !References/README.md

Both sources below are **openly licensed** and would fall under the exemption
(arXiv preprint; Scientific Reports is fully open access under CC BY 4.0). They
are still not committed here, because neither is needed to run or read anything
in this repository -- the DOI and the arXiv link are sufficient, and a repository
that ships a teaching demo has no reason to carry article PDFs.

## Sources

- **Yang, E., Vasishtha, R., Dad, L. K., Kachnic, L. A., Hope, A., Wang, E.,
  Wu, X., Yuan, Y., Brenner, D. J., & Shuryak, I.** (2025).
  *CAST: Time-Varying Treatment Effects with Application to Chemotherapy and
  Radiotherapy on Head and Neck Squamous Cell Carcinoma.* arXiv:2505.06367.
  <https://arxiv.org/abs/2505.06367>
  **Supports:** the CAST method itself -- the cross-horizon influence-function
  covariance, Ledoit-Wolf shrinkage and the covariance-aware trajectory fit that
  `R/cast_core.R` implements, and the attribution in README "Method provenance",
  `docs/index.html` and `CITATION.cff`. Open access (arXiv). Verified against the
  arXiv abstract page on 2026-08-25.

- **Yang, E., Agrawal, S., Kinslow, C. J., Cheng, S. K., Yang, L., Wang, E.,
  Wang, T. J., Kachnic, L. A., Brenner, D. J., & Shuryak, I.** (2026).
  *Estimating temporal treatment-effect patterns of radiotherapy and chemotherapy
  in lower-grade gliomas using causal machine learning.* Scientific Reports,
  **16**, 23659. doi:[10.1038/s41598-026-54656-0](https://doi.org/10.1038/s41598-026-54656-0)
  **Supports:** the claim that `R/cast_core.R` is ported from the production
  pipeline of an applied study, in README "Method provenance" and `CITATION.cff`.
  Open access (Scientific Reports, CC BY). Verified via the Crossref API on
  2026-08-25 -- `doi.org` and `nature.com` bounce an automated fetch through a
  cookie wall, so the author list and title were confirmed with
  `curl -sL -A "Mozilla/5.0" https://api.crossref.org/works/10.1038/s41598-026-54656-0`.

## Third-party software cited in the README

Not article citations, and not recorded above, but named as dependencies whose
behavior the results depend on: `grf` 2.5.0 (causal survival forest, regression
forest, survival forest), `survival` 3.8.3, `jsonlite` 2.0.0, R 4.5.1, and
Plotly 2.35.2 (loaded by the site from `cdn.plot.ly` with a subresource-integrity
hash). Versions are pinned in the README under "Requirements".

## Sources that could not be obtained

None. Both cited sources are openly accessible.
