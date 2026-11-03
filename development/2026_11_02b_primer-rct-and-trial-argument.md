# Primer additions: randomized trial data and the argument for a new trial (branch `causal-roadmap-primer`)

Date: 2026-11-02. Author: Igor Shuryak. Status: draft for Igor's review. Follows `2026_11_02_causal-roadmap-primer.md`.

## What Igor asked for (2026-11-02)

1. The end goal of the analyses is an effective argument, based on the causal analysis of retrospective data, about whether a new RCT on the question would be useful.
2. The explanations should make clear that causal ML can be used on non-randomized data and also on RCT data, as in his past talks.
3. Possibly another branch with multiple-choice questions, in the style of `Office/interactive_tests` (built on `causal-roadmap-quiz`, see its own record).

## What changed

- **Section 9, "Causal machine learning on randomized trial data"** (`#rct`). It covers what randomization guarantees: the intention-to-treat effect needs no confounding adjustment, and the propensity score is known. It then gives five uses in a trial, each with what to watch:
  - covariate adjustment for precision
  - who benefits, with the PATH statement's cautions
  - effects over time (CSF/CAST)
  - per-protocol effects (g-methods)
  - generalizability and transportability to registry patients

  The framing follows the talks: "The methods ... apply to observational and randomized studies alike, with design-specific assumptions" (UH AIPHI talk, Oct 2026, slide 43). It also echoes "from complex observational data (and from combinations of observational and RCT data)" (`slides_for_causal_ML_in_Rad_Onc_v2.pptx`, slide 5).
- **Section 10, "Does the evidence justify a new randomized trial?"** (`#trial-argument`). It contains:
  - two historical lessons: the Nurses' Health Study emulation of the WHI trial, and RTOG 0617 after phase 1 and 2 studies
  - a results-to-argument table
  - an interactive argument builder
  - what the analysis hands to the trial (protocol, RMST endpoint, effect range for sample size, stratification, positivity gaps)
  - a one-paragraph argument template
- **The end goal is stated early:** in the masthead, in step 1, and in a section 0 paragraph that points to section 9.
- **Elsewhere:** the summary table has a new "On randomized trial data" row, the worksheet has a new final field ("The argument about a new trial"), and the roadmap navigation now runs 0 to 11.
- **`trial_argument.mjs`:** the builder's logic, as a pure function so it can be tested.

## Decisions in the builder logic, and why

The precedence order is:

1. A transportable existing trial wins, unless the emulation contradicts it. Randomized evidence outranks an observational estimate.
2. A failed benchmark is resolved before anything else is argued. This is the WHI/Nurses' Health Study lesson.
3. An interval spanning a meaningful benefit and a harm argues for a trial, whatever the robustness.
4. Without a sensitivity analysis, the builder takes no position.
5. A clear but fragile effect argues for a trial. A clear robust effect is a strong hypothesis, and a further trial depends on whether clinicians remain uncertain (Dang 2023: randomization still generally gives more certainty). A robust null makes a trial a low priority. A fragile null is inconclusive, because confounding can mask an effect.

Positivity gaps and heterogeneity always add a note. Design inputs are omitted when the argument is against a trial.

These are teaching heuristics, not a formal value-of-information analysis, and the page does not present them as one.

## References added (all read in full text, kept outside the repository)

- 20 FDA 2023 covariate-adjustment guidance (US federal work, PDF).
- 21 Kent 2020, PATH statement (PMC author manuscript, JATS XML via NCBI E-utilities).
- 22 Degtiar and Rose 2023. The publisher PDF returned 403, so the open arXiv preprint (2102.11904) was read. The page cites the published version and links the preprint.
- 23 Hernán 2008, Nurses' Health Study analyzed like the WHI trial (PMC XML).
- 24 Bradley 2015, RTOG 0617 (PMC XML).

Also fetched as full text, for quiz evidence checks of existing citations: Petersen 2014, Hernán 2016b, Hasan 2017, Schisterman 2009, Royston 2013, Hernán 2010, Austin 2011.

Wanted but not obtainable, so not cited:
- Wang 2023 JAMA, RCT-DUPLICATE (doi 10.1001/jama.2023.4221, PMC10130954): no full text served.
- Hernán and Robins 2017 NEJM, per-protocol analyses (doi 10.1056/NEJMsm1605385): not in PMC. *What If* chapter 22 is cited for per-protocol effects instead.

Checked against the sources:
- The FDA guidance itself says it does not address machine-learning adjustment. The page says so.
- The PATH wording "signals of treatment benefit and harm even for interventions that are completely ineffective and innocuous" is verbatim in Kent 2020.

## Tests

`node tests/test_causal_roadmap_primer.mjs`: 38 checks (was 23). The new ones:
- sections 9 to 11 exist and are linked
- navigation numbered 0 to 11
- the end goal is in the masthead
- the RCT pointer comes before section 9
- the builder's radios match its logic exactly
- all 324 builder input combinations give a verdict
- five precedence rules hold over all combinations
- no design inputs when the argument is against a trial
- positivity and heterogeneity notes
- no em dash or semicolon in generated text
- unknown inputs are rejected
- new acronyms (RCT, FDA, PATH)
- new allowed hosts (fda.gov, arxiv.org)

Each new check was confirmed to fail on a deliberate mutation (11 mutations, 11 red). The tree was then restored, and the suite returned to 38/38.

Andy's suites give the same results as on `main`:
- tutorial-variants fails 4 checks, pre-existing
- clinical-review crashes under Node 18 because `Array.prototype.toReversed` needs Node 20, identically on `main`
- all others pass
