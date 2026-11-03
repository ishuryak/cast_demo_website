# Causal roadmap self-test (branch `causal-roadmap-quiz`)

Date: 2026-11-02. Author: Igor Shuryak. Status: draft for Igor's review.

The branch is stacked on `causal-roadmap-primer` (6a9a3e1). It must never be merged into `main`, the same rule as the primer branch.

## What and why

Igor asked for "another branch with multiple choice questions on the covered topics, similar to those developed in `Office/interactive_tests`", for a student or resident studying the primer. This branch adds `docs/causal-roadmap/quiz/`: 30 questions covering every primer section, 0 to 10. The engine behaves like the interactive-tests family:
- questions and answer letters are shuffled on every start
- keys A to E pick an answer, and Enter submits
- each answer shows an explanation and its source
- a final report lists the misses

Two additions over the family:
- a score table by primer section, with links back to each section
- a glossary of abbreviations on the start page

The primer links to the quiz from the masthead and after the worksheet. This is the only change to a primer file on this branch.

## How it was built and checked

1. **Writer agent.** It drafted the bank from the downloaded full texts. Every answer has at least one verbatim evidence quote: 54 quotes in total.
2. **Independent auditor agent.** It checked all 30 items in context and passed 21. It gave exact fixes for 9, all applied:
   - cr-05: Hernán 2016b calls excluding deaths before a delayed time zero "selection bias". The choices were relabeled, and the explanation notes the link to immortal time.
   - cr-07: the explanation overclaimed what records can always emulate.
   - cr-08: the Hasan 0.7% to 15.6% figures are for lumpectomy in invasive breast cancer.
   - cr-15: the answer could be guessed because the key was the odd one out among parallel distractors.
   - cr-19: no censoring and an unpenalized schedule term are now stated, matching simulation 3.
   - cr-20: the evidence quote now supports the item (Cui 2023).
   - cr-22: *What If*'s definition of a negative outcome control was added, and the stem now says admissions were not adjusted for.
   - cr-23: the real setting of VanderWeele and Ding's example, an odds ratio converted to an approximate risk ratio. The E-values were recomputed by the auditor.
   - cr-29: "single-arm" removed. RTOG 9410 was the comparator.

   Pre-audit draft: `causal_roadmap_primer_tools/quiz_bank_draft_pre_audit.json`. Audit table: `causal_roadmap_primer_tools/quiz_audit.md`. Both are outside the repository.
3. **Writer's note on the PATH wording.** The writer reported that the PATH wording in section 9 could not be found. It is verbatim in Kent 2020 ("signals of treatment benefit and harm even for interventions that are completely ineffective and innocuous"). The writer's search missed it.

## Files

- `quiz/index.html`, `quiz.css`, `quiz.js`: the page. Questions load from `bank.json`. A single-file build sets `window.QUIZ_DATA` instead, so it opens without a server.
- `quiz/bank.json`: built by `quiz/build_bank.mjs DRAFT.json`. It takes reference text and links from the primer's current list and refuses to write a bank that breaks `quiz/bank_rules.mjs`.
- `quiz/bank_rules.mjs`: the rules, shared by the builder and the tests:
  - 30 items, 5 unique choices each
  - the key is uniquely longest or shortest in no more than 7 items
  - answer positions balanced
  - every primer section covered
  - every abbreviation glossed
  - no em dash, semicolon or banned word or name

## Tests

- `node tests/test_causal_roadmap_quiz.mjs`: 13 checks. Each was confirmed red on a deliberate mutation (10 mutations, 10 red). They cover:
  - the bank rules
  - the references match the primer word for word (stale check)
  - evidence names a cited reference
  - section anchors exist
  - the quiz's section labels match
  - no unused glossary entries
  - no em dash
  - external hosts limited to fonts
  - user text escaped before it reaches the page
  - the primer links to the quiz
- Outside the repository, because they read the copyrighted full texts or use Windows Chrome:
  - `causal_roadmap_primer_tools/check_quiz_evidence.py`: every quote is verbatim in its source. It goes red on a one-word change.
  - `causal_roadmap_primer_tools/play_through.py`: headless Chrome on both single-file builds. It answers two right and one wrong, then checks the verdict, the green and red answer marks, the counters, the report and the section table, and that a retake reshuffles. It also checks that the primer's builder and simulations render with no script error. Three deliberate breaks were all caught: an inverted score, a missing red wrong-answer mark, and an unwired builder. The first version alternated right and wrong answers, which could not detect an inverted score. That was fixed.
- **Served-page check.** `python3 -m http.server` in `docs/`, then Windows Chrome:
  - the quiz loads `bank.json` over fetch
  - the primer's modules run
  - neither page overflows horizontally in a 400 px frame
