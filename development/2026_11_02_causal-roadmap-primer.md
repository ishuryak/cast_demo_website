# Causal roadmap primer (branch `causal-roadmap-primer`)

Date: 2026-11-02. Author: Igor Shuryak. Status: draft for review by Igor, then Andy Wilson.

## What and why

A separate, simpler page at `docs/causal-roadmap/` for a medical student or
oncology resident who knows Cox regression, random forests and XGBoost but has not
met causal inference. It walks through the causal roadmap, target trial emulation,
DAGs, estimands, dynamic and modified treatment policies, the estimator menu
(IPTW, g-computation, AIPW, TMLE, DML, LMTP, causal forests, CAST), and checks
without an answer key. It ends with a worksheet that becomes a protocol draft.
For survival-specific material it links to the existing CAST walkthrough and
methods page rather than repeating them.

Brainstormed with Andy Wilson on the 2026-11-02 call.

## Decisions (Igor, 2026-11-02)

- **The existing site is untouched.** The page lives on its own branch and is not
  merged into `main`. No existing file in the repository is modified. The page
  links to the live site's stable addresses.
- **Running example: hypofractionated versus conventional fractionation**, chosen as
  a generic standard-versus-alternative comparison. "Treatment versus none" was
  rejected as unrealistic for oncology. 60 versus 66 Gy in stage III lung cancer
  was considered and rejected as too specific.
- **Simulations from the AIPHI talk (October 2026) are reused.** They are
  synthetic, so Igor approved them: (1) adjusting for a post-treatment variable,
  (2) an unrecorded confounder, (3) regularization bias of a prediction-tuned lasso
  against DML. They were recoded in JavaScript and relabeled for the running
  example. No NCDB results, figures, slides or co-author material from the
  ASTRO 2026 poster or the AIPHI talk are used.
- **No code on the page.** Package names appear only in the plan worksheet text.
- **Sharing:** branch for review plus a private preview link. Show Andy after Igor
  reviews.

## Design choices and measurements

- Simulations 1 and 2 run in the browser (about 0.2 s). Simulation 3 (lasso path,
  5-fold CV, cross-fitted DML on 10,000 patients and 84 covariates) takes 1 to 2 s
  in Node, so it is precomputed by `build_sim3.mjs` into `sim3.json`. A test reruns
  it and fails if the file is stale.
- Simulation 3 tuning. The first design (5,000 patients, 48 covariates, truth 0.5)
  showed only a weak effect: near-best-R² estimates spanned 0.37 to 0.58 around a
  truth of 0.5. Across 12 to 20 seeds, several designs gave a CV-lasso bias of only
  +0.04 to +0.09. The chosen design (60 weakly prognostic and strongly
  treatment-predictive covariates, truth +0.3) has every near-best-R² penalty
  overestimating the truth (+0.37 to +0.57 at the shown seed), with the DML interval
  covering it. Over 6 fresh seeds in the test, the mean CV-lasso error is positive,
  and DML's is smaller in magnitude.
- Every sentence that states a simulation result is generated from the computed
  numbers, so it stays true when a reader redraws the cohort.

## References

All 19 cited sources were read in full text (PDF, or PMC/JATS XML where the PDF
route was blocked). PDFs are kept outside the repository in
`NeurIPS_2025/References_causal_roadmap_primer/`, because several are under
publisher copyright. Four candidate sources could not be obtained in full text and
were dropped. Their claims were removed or re-sourced:

- van der Laan and Rubin 2006 (TMLE) and van der Laan, Polley and Hubbard 2007
  (Super Learner). TMLE and super learning are now cited to Dang et al. 2023.
- Murphy 2003 (dynamic regimes). The definition is now cited to Hernán and
  Robins, *What If*, Fine Point 19.1.
- Haviland 2013 (START 10-year). The breast-trial sentence was removed. CHHiP alone
  illustrates trial evidence.

Reviewer corrections applied: comorbidity was not used as a documented driver of
hypofractionation, because Hasan 2017 supports age and distance only, and only
crude counts for comorbidity. The Cinelli-Hazlett sensitivity method is described
as applying to regression-based estimates.

## Tests

`node tests/test_causal_roadmap_primer.mjs` runs 23 checks: simulation properties
over many seeds, sim3.json freshness, citation order, acronym definitions, no em
dashes, no unpublished-project names, and allowed external hosts. Each kind of
check was confirmed to fail on a deliberate mutation:

- no indirect path in sim 1
- performance status not driving treatment in sim 2
- an edited `sim3.json`
- no confounding in sim 3
- an em dash
- a forbidden name
- swapped citation order
- a removed acronym definition
- a foreign link

Andy's existing node suites give the same results as on `main` (tutorial-variants
already fails 4 checks there). Viewport: no horizontal overflow at 400 px, measured
in a 400 px frame. The Windows-Chrome overflow harness cannot reach a WSL server, so
it was not usable here.
