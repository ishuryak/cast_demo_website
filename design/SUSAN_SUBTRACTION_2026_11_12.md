# Task: Susan's path and a smaller teaching surface

- Coordinator and implementer: Codex
- Reviewers: Claude (visual flow), Gemini (scientific challenge)
- Version: 2026-11-12, first implementation
- Status: implementation and local verification complete. Live verification is recorded in the task response.
- Request: Make Susan the main CAST path, with concepts before methods and lab. Subtract repeated text and competing elements in CAST and the causal-roadmap primer. Cite Dang and Balzer's 2023 target-trial/roadmap paper first. Replace the Navigator-specific map with a simplified independent flow; remove conversation-origin framing.
- Writing scope: tutorial/index.html, tutorial/narrative.css, tutorial/narrative.mjs, necessary application integration and build/test files; generated docs/tutorial output. Companion primer docs/v2 in its separate checkout. No R code or frozen simulation outputs.
- Preserve: existing untracked ROADMAP_BRIDGE files, quantitative limits, hidden-confounding warnings, covariance/coverage caveats, working controls, source attribution and editable class kit.
- Review inputs: public tutorial source and bounded review requests. Consultation runners record input hashes and outputs under ignored design/collaboration-runs.
- Acceptance: one narrative path; smaller visible reading burden and fewer repeated explanations; actual removals quantified; first roadmap reference to Dang/Balzer; accessible independent diagram with editable source; no Navigator or meeting-origin dependence; desktop/mobile interactions and frozen-data checks pass; both live pages verified after publication.

## Consultation and disposition

Both fresh CLI consultations completed successfully. Neither reviewer edited
application files. Claude reviewed the supplied source with tools disabled;
Gemini had public search/fetch only. Outputs remain in ignored
`design/collaboration-runs/`.

- Claude run: `claude-2026-11-13T05-32-51.919Z-f4a4336e`.
- Gemini run: `gemini-2026-11-13T05-32-51.915Z-e3828068`.
- The saved before-edit tutorial snapshot matches Claude's recorded SHA-256:
  `fe3a60f29005c14e098454c03260a70375b6d31600155862f91ef462e637bc97`.
  Current source differs intentionally after integration.
- Both request hashes were recomputed and match the consultation records:
  visual `b4d114be6016d58b1cd31e64636f134eb21b59a49e903442019a4acd27265405`;
  science `3b92fadc15396238ff6e852a9864b76586d1edf17eaeaffc7cc596454b68a992`.

Accepted Claude's single-path structure, removal of the audience picker,
placeholder, repeated method explanations and profile detour, and promotion
of the hidden-confounding control. Preserved the counterfactual exercise and
coverage evidence in disclosures. Rejected retaining the old decision-guide
image because its Cox branch was too restrictive and duplicated the table.

Accepted Gemini's distinctions between causal model and observed data, and
between statistical target and estimator. The final diagram has seven steps
rather than the five initially proposed. Corrected the Cox explanation:
proportional hazards does not mean identical individual or absolute effects;
a constant hazard ratio can imply a changing absolute survival difference.
Did not adopt language equating a hazard ratio with relative risk or claiming
that every constant hazard ratio guarantees a varying absolute difference.
Kept the scope on these fitted methods when discussing hidden confounding,
and preserved pointwise-band and repeated-coverage limitations.

Verified the Dang/Balzer framing against the authors' institutional page:
https://ctml.berkeley.edu/news/start-target-trial-protocol-then-follow-roadmap-causal-inference
and the bibliographic record for DOI 10.1097/EDE.0000000000001636. Full-text
fetches were blocked, so the flow is explicitly our simplified reading, not
a reproduction of the published figure. Reviewer agreement alone was not
treated as evidence. The diagram is editable in `design/roadmap-flow/`.

## Subtraction and preservation

CAST now follows Susan's question through concepts, methods, lab and a bounded
conclusion. Removed four audience routes, the placeholder, repeated tool-choice
sections, the dose-profile detour, main-path animation and extra illustrations.
The legacy clinical walkthrough redirects to the canonical story, preserving
query settings and mapping old anchors. The separate oncology diagnostics,
advanced methods, frozen research exports and class kit are preserved.

Counts against the previously published tutorial: approximately 2,412 to 965
words outside disclosures, navigation, footer and hidden content (60% less),
and eleven to three main images. All static text decreased from 3,937 to 2,095
words. Counts are a consistent HTML reading-surface comparison, not reading
time or dynamically rendered lab text.

The companion primer removes repeated prompts, the duplicate mini-roadmap,
extra same-score comparison cards, the Navigator-specific illustration and
conversation-origin credits. Main images decrease from seven to three.
Static reading-surface text decreases from about 4,315 to 3,940 words.
Ten full checkpoint panels now open on demand. The 60-to-50 example, star,
distinct confounding and positivity components, recorded baseline and transport
exercise retain their behavior.

## Verification

- Fourteen tutorial tests; 151 clinical checks; variant link/ID/redirect checks.
- All root Node data, rendering, styles, introduction, README and hygiene checks.
- Twenty-four lab scenarios in Chrome, five horizon buttons, four overlay
  controls, hidden-confounding guidance, counterfactual completions and coverage.
- Desktop/tablet/mobile at 1440, 900, 768, 390 and 320 pixels, with screenshots
  inspected. Internal scrolling keeps wide scientific figures readable.
- Updated the viewport test to measure visible edges inside explicit scroll
  containers and follow legacy redirects. Its 1,600-pixel negative control
  still detects real overflow. All four published routes pass.
- Nineteen primer model tests, checkpoint keyboard navigation, score changes,
  baseline/download/share round trip, and transport endpoints pass.
- No new simulations were run or represented as new results.
