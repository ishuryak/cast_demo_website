# Resident guide revision: layout, history, goals, and the 18-finding audit (branch `causal-roadmap-resident-guide`)

Date: 2026-11-02 to 2026-11-03. Author: Igor Shuryak. Branch: `causal-roadmap-resident-guide`, stacked on `causal-roadmap-quiz` (da90eef). It must never be merged into `main`. It adds or edits files under `docs/causal-roadmap/`, three `tests/test_causal_roadmap_*.mjs` suites, a new workflow `.github/workflows/causal-roadmap.yml`, and records in `development/`. No file of Andy Wilson's CAST site is modified, and the page links to his site for survival-specific material.

## What Igor asked for (2026-11-02)

1. State early that the ultimate goal is to improve and optimize treatment, ideally for subgroups and individual patients.
2. Add a brief history of modern causal inference and causal ML. Name the main developers, link their websites, and say the list is not exhaustive.
3. Don't make the page a long scroll. Show only the main points and descriptions, and put details, questions and examples under headings that expand on click.
4. Use slightly larger, easier fonts. Blue, green and red may be used in headings and main terms.
5. Analyze, check and implement the comprehensive review `NeurIPS_2025/AUDIT_causal_roadmap_primer_2026_11_02.md` (18 findings).
6. Proceed autonomously: implement, re-review and re-audit, then commit and push this branch without overwriting Andy's work.

## The six decisions the audit asked for (section 3), as taken

1. **Trial builder.** It stays a conditional discussion aid. It is not a trial-approval or value-of-information tool, and the page says so.
2. **Simulations.** The toy equations and every numerical output are kept, now labeled as continuous toy outcomes on a month-like scale with no censoring.
3. **Simulation 3 allocation.** Kept, with the allocation (7,061 fit, 2,939 held out, 10,000 for DML), the tuning procedure, and a "not a benchmark" qualification shown on the page.
4. **Numbering.** One map, sections 0 to 11, used everywhere. "Roadmap step N" eyebrows and "step N" cross-references were removed.
5. **Previews.** An offline pair `primer_full.html` and `quiz_full.html`, with explicit links between them, plus the served directory version.
6. **Quiz source.** One tracked source, `docs/causal-roadmap/quiz/questions_source.json`, which `build_bank.mjs` turns into `bank.json`. A CI step fails if they drift apart.

## Findings and what was done

| ID | Done |
|---|---|
| F01 | A censoring box in section 5 (ignorable censoring, follow-up through the horizon, randomization does not fix informative dropout, per Cui 2023). Censoring language in the chooser, estimator table, CSF row, worksheet field "Censoring, follow-up and missing data", RCT section and prediction row. |
| F02 | Builder rewritten (`trial_argument.mjs`). Earlier trials are conclusive, inconclusive or excluding. Overlap is full or restricted. Outputs are conditional and split into supports, cannot establish, still open, also consider and design inputs. A failed benchmark limits the estimate but does not forbid a trial. |
| F03 | Aim is superiority or noninferiority. Six interval patterns against prespecified thresholds, including clear harm and one-sided uncertainty. Noninferiority always needs a margin. CHHiP's endpoint (biochemical or clinical failure) is named. |
| F04 | Sensitivity is posed as whether plausible confounding moves the estimate across thresholds. RMST uses a bias analysis on its own scale, and the E-value is tied to a risk ratio. Sample size comes from a clinical target or margin, not the observational interval. |
| F05 | The LMTP row separates TMLE (ordered configurations) from SDR (per-time either model), per Díaz 2023. The DML row and text name the score/target issue. Valid intervals need conditions. CAST's extra trajectory assumptions are stated. |
| F06 | The DAG labels the direct and mediated paths, with "total effect = both teal paths". The mediator rule is scoped to a baseline total-effect adjustment, and g-methods may use post-treatment history. |
| F07 | The time-zero trap now separates delayed entry (selection bias, no fixed direction) from classifying by completed course (immortal time). Quiz cr-05 and cr-06 follow. |
| F08 | Strategies must state total dose, fraction size and number, and cointerventions. The modified policy is a fully specified hypothetical map. The chooser has a separate "rule decided once at the start" route. The worksheet no longer jumps to age 75 or older. |
| F09 | All three simulations are labeled toy continuous outcomes, and simulation 1's variable is a generic post-treatment variable. The predictive model is described as a retrospective prediction. |
| F10 | Simulation 3 allocation and tuning are disclosed in the readout and in `sim3.json` `allocation`. |
| F11 | `serializeSim3()` is shared by `build_sim3.mjs` and the tests. The numerics suite compares the whole file text and checks independent invariants. |
| F12 | `lassoPath` reports convergence, sweeps and the standardized KKT residual. The build refuses unconverged fits. All 426 default fits converged (at most 13 sweeps, KKT 3.0e-8). Tests cover OLS at zero penalty, the audit's correlated fixture, analytic soft thresholding, and a tiny iteration limit. |
| F13 | All quiz items in the audit amended in the source (see the quiz agent's list in the handoff). 77 evidence quotes are verified. |
| F14 | Quiz engine: no global key handler, A to E scoped to the question, focusable headings, a polite status region, a duplicate-submit guard, and a load-failure message. |
| F15 | `inline_primer.py` and `inline_quiz.py` link the offline pair explicitly and build twice to compare. `play_through.py` takes the browser path from `--chrome`/`CHROME`/discovery, reports launch failures separately (exit 3), and drives the quiz with ordinary DOM events. |
| F16 | New workflow `causal-roadmap.yml` (Node 20). Simulation checks renamed as smoke checks. Independent OLS and DML standard-error fixtures. The evidence checker binds each reference number to its file through `reference_manifest.json`. |
| F17 | One numbering scheme, 0 to 11, tested. The validation wording now says ordinary prediction accuracy cannot confirm a causal effect, while causal checks exist under assumptions. Shuffled labels are a software check, and negative controls can reveal bias. |
| F18 | References and slider labels wrap. |

**Kept unchanged:**
- every number in simulations 1 to 3. `sim3.json` gained only `seed`, `allocation` and `solver` metadata, and all earlier fields are byte-for-byte equal.
- the CHHiP, hormone-therapy and RTOG 0617 examples.
- the quiz's scoring behavior.

**Not done:**
- An NVDA or other screen-reader speech pass. It is part of F14's acceptance criteria and needs a person at a Windows screen reader.

## The history section: sources

| Claim | Source |
|---|---|
| Neyman 1923, Rubin 1974, Robins 1986 (g-formula for time-varying treatments), Pearl's d-separation and backdoor criterion | *What If* (ref 1) |
| The propensity score (Rosenbaum and Rubin 1983) | Austin 2011 |
| Data fusion and transportability | Bareinboim and Pearl 2016, PNAS. Full text from the authors' UCLA reprint (r450-reprint.pdf), new reference. |
| Targeted learning and the roadmap | Petersen and van der Laan 2014 |
| Target trial emulation | Hernán and Robins 2016 |
| Double/debiased machine learning | Chernozhukov 2018 |
| Causal forests | Wager and Athey 2018 |

The researcher websites were checked on 2026-11-02 and all return HTTP 200 with the right page title:
- Pearl (UCLA)
- Rubin (Temple, because Harvard's page refuses scripted access)
- Robins (Harvard Chan profile)
- Hernán
- van der Laan
- Bareinboim
- Chernozhukov (MIT)
- Athey and Wager (Stanford GSB)

## Layout

Each section keeps an eyebrow, a heading, a short visible main point (`.lede`) and, where useful, one key box. Everything else sits in `<details class="more">` blocks, which are closed by default:
- tables
- traps
- simulations
- examples
- the try-it questions
- the builder
- the worksheet

An "Expand all details" button opens or closes them all, and a link to an anchor inside a closed block opens it. Charts redraw when their block opens.

Type is 20px with line-height 1.7. Blue marks headings and key terms, green marks goals and key boxes, and red marks traps and warnings. All three are defined for light and dark modes.

## Independent re-audit (2026-11-03) and what it changed

Two fresh reviewers checked the revision. Neither had seen the work. Their reports are outside the repository:
- `causal_roadmap_primer_tools/REAUDIT_primer_2026_11_03.md`
- `causal_roadmap_primer_tools/REAUDIT_quiz_2026_11_03.md`

**Primer and builder.**
- 11 findings CLOSED and 4 PARTIAL (F02, F03, F16, F17).
- Six new P2 items and thirteen P3 items. Applied:
  - **R1.** No "trial in them" note when the lean argues against a trial.
  - **R2.** A failed benchmark against a conclusive trial gives no design for a duplicate.
  - **R3.** A new lean for "meaningful benefit excluded, harm not".
  - **R4.** Generalizability and transportability defined as in Degtiar, and extending a trial to patients it excluded is called an extrapolation.
  - **R5.** The six interval patterns are now defined only against the two clinical thresholds. For noninferiority the harm threshold is the margin. `classifyInterval()` proves the patterns partition every interval.
  - **R6.** Commit and push, below.
  - **R7 to R17 and R19.**
- Not applied: **R18.** Bradley 2015 itself says the earlier trials "implied a survival benefit from 74 Gy", so the page wording stands.
- Tests A03 and A05 enshrined two of these errors. Both were rewritten.

**Quiz.**
- 24 PASS, 5 FIX, applied:
  - cr-01: censoring qualifier added.
  - cr-05: the counterexample is now scoped, and the attribution corrected.
  - cr-12: ATT and ATE "can" differ, through effect modifiers.
  - cr-23: "overweight or obese".
  - cr-25: "can overfit".
  - cr-19: optional wording, taken.
- A bank-wide defect: citations showed "&amp;amp;". `primerRefs()` now decodes entities, and a test fails on any entity in a citation. It was red on the old bank.
- Engine fixes:
  - after Submit, focus goes to the feedback (verdict, explanation, source), so a held Enter can no longer skip it
  - a 15-second load timeout
  - a page `h1` during the quiz

**Still open:**
- the screen-reader (NVDA) speech pass, which needs a person
- automated validation of the glossary in the offline preview path, which the reviewer rated low

## Tests

Final counts:
- `node tests/test_causal_roadmap_primer.mjs`: 76 checks. They cover layout, the requested content, every audit finding and re-audit item, and the builder's invariants over all 1,728 input combinations.
- `node tests/test_causal_roadmap_numerics.mjs`: 20 checks.
- `node tests/test_causal_roadmap_quiz.mjs`: 21 checks.

Deliberate breaks, each red and then restored:
- 20 page and builder breaks
- 12 `sim3.json` corruptions (SE, both bounds, truth, n, p, a lambda, best R², near-best, split, solver, doubled width)
- 5 re-audit checks
- the feedback-focus probe

Outside the repository:
- `check_quiz_evidence.py`: 77 quotes, each reference number bound to its file through `reference_manifest.json`.
- `play_through.py`, headless Chrome on the offline pair:
  - quiz 20/30, 30/30 and 0/30, with Enter on links, a duplicate-submit guard and focus checks
  - no overflow at 320px
  - 34 cross-links resolve
  - the primer's builder, expand-all, chart redraw on open, and opening a collapsed section from a link

The browser run caught one real bug before commit: an empty URL hash stopped the page script.

Served pages: with every section expanded there is no horizontal overflow at 320, 360 or 400 px.

Andy's suites give the same results as on `main`:
- tutorial-variants fails 4 checks, pre-existing
- clinical-review needs Node 20, and this machine has Node 18
- all others pass
