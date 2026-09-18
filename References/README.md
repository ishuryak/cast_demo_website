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

The two CAST papers below are **openly licensed** and would fall under the exemption
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
  **Supports:** CAST's modelling of effects across time, including inverse-variance
  quadratic WLS and splines. Section 3.2 does not document this demo's current
  influence-score covariance or Ledoit-Wolf implementation. Attribute those
  choices to the versioned R code. Open access, CC BY 4.0; checked against
  [full text v1](https://arxiv.org/html/2505.06367v1#S3.SS2) on 2026-09-06.

- **Yang, E., Agrawal, S., Kinslow, C. J., Cheng, S. K., Yang, L., Wang, E.,
  Wang, T. J., Kachnic, L. A., Brenner, D. J., & Shuryak, I.** (2026).
  *Estimating temporal treatment-effect patterns of radiotherapy and chemotherapy
  in lower-grade gliomas using causal machine learning.* Scientific Reports,
  **16**, 23659. doi:[10.1038/s41598-026-54656-0](https://doi.org/10.1038/s41598-026-54656-0)
  **Supports:** applied CAST trajectories using bootstrap covariance from test-set
  predictions, shrinkage and GLS/WLS. The current demo replaces that covariance
  construction with patient-aligned influence scores. Metadata does not establish
  a verbatim code port. Open access, CC BY 4.0; metadata and CAST curve methodology
  checked against [publisher full text](https://www.nature.com/articles/s41598-026-54656-0)
  on 2026-09-06.

## Tutorial foundations and implementation references

- **Cui, Y., Kosorok, M. R., Sverdrup, E., Wager, S., & Zhu, R.** (2023).
  *Estimating heterogeneous treatment effects with right-censored data via causal
  survival forests.* JRSS Series B, 85(2), **179–211**.
  [doi:10.1093/jrsssb/qkac001](https://doi.org/10.1093/jrsssb/qkac001).
  Supports the CSF foundation and its assumptions. Publisher metadata checked
  2026-09-06; the preprint's conflicting reference entry is not used here.
- **Hernán, M. A., & Robins, J. M.** (2020). *Causal Inference: What If*.
  Chapman & Hall/CRC. [Authors' online book](https://miguelhernan.org/whatifbook).
  Supports potential outcomes, average effects and identification assumptions.
- **Petersen, M. L., & van der Laan, M. J.** (2014). *Causal models and learning
  from data: integrating causal modeling and statistical estimation*.
  Epidemiology, 25(3), 418–426.
  [doi:10.1097/EDE.0000000000000078](https://doi.org/10.1097/EDE.0000000000000078).
  Supports the causal roadmap linking the question, causal model, observed data,
  identification, statistical estimation and interpretation. The tutorial's
  five-part summary is a teaching adaptation, not the paper's exact step list.
- **Ledoit, O., & Wolf, M.** (2004). *A well-conditioned estimator for
  large-dimensional covariance matrices*. Journal of Multivariate Analysis,
  88(2), 365–411. [Publisher](https://www.sciencedirect.com/science/article/pii/S0047259X03000964),
  doi:10.1016/S0047-259X(03)00096-4. Supports covariance shrinkage, not a coverage
  guarantee for the complete CAST fitting and selection procedure.
- **VanderWeele, T. J., & Ding, P.** (2017). *Sensitivity Analysis in Observational
  Research: Introducing the E-Value*. Annals of Internal Medicine, 167(4), 268–274.
  [doi:10.7326/M16-2607](https://doi.org/10.7326/M16-2607). Supports the E-value
  approach used in the original R robustness code; this tutorial does not teach it.
- **grf authors.** [CSF API](https://grf-labs.github.io/grf/reference/causal_survival_forest.html),
  [score API](https://grf-labs.github.io/grf/reference/get_scores.causal_survival_forest.html),
  [ATE API](https://grf-labs.github.io/grf/reference/average_treatment_effect.html),
  [survival vignette](https://grf-labs.github.io/grf/articles/survival.html).
  Software behaviour and target definitions; accessed 2026-09-06. These current
  documents do not change the frozen export's recorded package versions.
- **Igor Shuryak.** [Pinned demo source](https://github.com/ishuryak/cast_demo_website/tree/43a00101100801eb6c048800d24788455fac0f8b).
  Exact implementation and synthetic-data provenance; MIT licence.
- **Tao of RWD.** [Causal Navigator](https://navigator.tao-rwd.com/) and
  [Dynamic Treatment Regimes with RL, Part I](https://learning.tao-rwd.com/blog/post/dtr-part-i).
  Applied workflow and optional further learning, not evidence of CAST's
  inferential guarantees.

## Third-party software cited in the README

Not article citations, and not recorded above, but named as dependencies whose
behavior the results depend on: `grf` 2.5.0 (causal survival forest, regression
forest, survival forest), `survival` 3.8.3, `jsonlite` 2.0.0, R 4.5.1, and
Plotly 2.35.2 (loaded by the site from `cdn.plot.ly` with a subresource-integrity
hash). Versions are pinned in the README under "Requirements".

## Sources that could not be obtained

Both CAST papers were read in full during the review. The roadmap paper's
publisher/PMC retrieval was not consistently available; its bibliographic
identity and roadmap description were checked against the indexed article
record. No claim of checking every theorem or every linked software version is made.
