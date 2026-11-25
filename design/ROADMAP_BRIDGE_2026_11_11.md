# Task: Connect the roadmap, CAST lesson and survcausal study

- Coordinator and implementer: Codex.
- Reviewer: Claude Fable 5.2, bounded consultation with tools disabled.
- Updated: 2026-11-11, America/Denver.
- Status: draft and handout verified; two technical draft PRs ready for review. Remaining inputs and coauthor integrations are documented below.
- Request: Andy asked for a more pedagogical Igor/Diana framing, connections to Igor's CAST work, and parallel verification of GitHub/R updates with a live Claude Fable 5.2 test.
- Writing scope: this record, the explicit review request and response, a local teaching handout under `docs/playbook/roadmap-survival-bridge/` in the email workspace, and the existing unsent Gmail draft. No artwork changes or website publication are assigned.
- Separate technical writer: Codex subagent owns `survcausal-pilot` code, contract, tests and audit. No shared file writers.
- Dependencies: current CAST main; open walkthrough PR15; causal-roadmap-primer; survcausal-pilot main after PR5. Link the streams through a shared question and target vocabulary; keep their different simulation data and provenance explicit.
- Acceptance: exact Claude model verified by returned metadata; critique read and disposition recorded; pedagogical scope and roadmap sequence made reviewable; draft saved and read back; technical requests traced to implementation evidence or explicit remaining work.
- Connection evidence: installed Claude Code 2.1.261 rejected claude-fable-5-2, requiring 2.1.290+. `claude update` installed 2.1.322. A new tools-disabled call returned CONNECTED, is_error=false, terminal_reason=completed and modelUsage.claude-fable-5-2.
- Review inputs: `design/ROADMAP_BRIDGE_REQUEST_2026_11_11.txt`; no mailbox content, patient-level data, credentials or unrelated private context.
- Reviewer output: `design/collaboration-runs/roadmap-2026-11-11/answer.txt` and structured response, with input hash in status.json.
- Open decisions: coauthors agree paper scope and any expanded real-data HTE validation. One reviewer is needed before merging changes to published numbers.
- Next action: coauthor review of scope and both draft PRs; recover the original Credence inputs and integrate Igor's comparator producers before running the planned policy study.

## Review disposition

The tools-disabled consultation completed with is_error=false and returned
modelUsage.claude-fable-5-2. Input SHA256 was
C691D02165E69266D08F7A2E047DFF277E03C75EDCB679E5215A53BEEAC521F9.
The response was read, and the input hash was compared before integration.

Accepted: explicit causal contrast and prediction target; censoring assumptions
even for trials; distinguish CATE from marginal ATE and individual effects;
identify interval type; separate illustration/benchmark/version evidence;
prespecified60-month q=.25 primary and selected-horizon distribution secondary;
document effective tuning and any rerun; label in-sample/OOB quadrant axes;
same-population/capacity/horizon oracle checks and split provenance checks.

Qualified: the three-arm audit establishes package reproducibility, but its
underlying replicated estimator summaries also support scenario-specific
performance descriptions. It is inaccurate to discard those as merely an
upgrade check. CAST uses per-horizon ATE estimates and their covariance; the
review's suggested wording about averaging conditional predictions was not
adopted. Treat-none *incremental gain* is zero; total survival value is not.
Scope expansion remains a coauthor proposal rather than a model decision.

The resulting handout has a separate editable .tex and .bib, a compiled
three-page PDF, build instructions, and a visual review of all pages. No live
website or existing artwork was changed during open walkthrough PR15.

## Technical follow-up review

A second bounded Fable 5.2 consultation inspected explicit upstream R diffs,
tests and the new pilot policy evaluator, with tools disabled. Record:
`design/collaboration-runs/technical-2026-11-11/`. It completed successfully
under the exact model; request SHA256:
DF854C8D13854AEB46942D59908BFAB40A23568CCE51D212B0271C56ED9D27D2.

Accepted and tested in the pilot: collision-free tuple grouping; a guarded
decimal-capacity calculation; evaluation-population/truth hashes for separately
computed paired summaries; limiting truth joins to their defined columns.
Also strengthened split manifests and expected-replicate checks. Clarified
tie-ID independence and the algebraic equivalence of paired metrics.

Upstream accepted as test-strengthening: assert successful return from the
real cv.glmnet call so a swallowed error cannot masquerade as compatibility;
test the complete train-to-lasso-to-glmnet chain. The final source also covers
the survcompare() entry point, which was found by tracing call sites after the
review snapshot. The alleged lack of glmnet5.1 support was not treated as a
proven API defect; actual fits under both installed versions provide evidence.
NEWS states the change to effective default folds and mixed ensemble settings.

Upstream draft PR: https://github.com/dianashams/survcompare/pull/3,
commit e2d6c5e. It is not merged or released. No installed pilot library was
changed. The pilot's evidence run remains under its original isolated pins.

## Verified outcome

Pilot draft PR: https://github.com/ishuryak/survcausal-pilot/pull/6,
commit 9534378c40ad970e50dc33c2b0bcbdce4350d667. It is open and unmerged.
All 600 calibration analyses completed, with exactly 50 cohorts per cell in
each of three arms; every first-cohort C-index and slope reproduces the prior
showcase. Final mean slopes (old to current) are 1.3512 to 1.0436 for linear/PH,
1.4104 to 1.1016 for linear/non-PH, 1.1457 to 1.0562 for nonlinear/PH, and
1.1528 to 1.1383 for nonlinear/non-PH. The last cell remains imperfectly
calibrated. All workers exited. Existing publication artifacts are unchanged.

Validation passed: 28 policy checks, nine fold/risk/probe checks, existing
checkpoint/publication/RATE checks, the complete calibration export, review
vignette rendering and visual figure checks. Upstream real fits were tested
under glmnet 4.1-10 and 5.1; bounded R CMD check had no errors and two warnings
for unbuilt vignettes. No future upstream release has been assumed or installed.

The original calibrated schema 1.3 Credence row files are still missing.
Recovered August email ZIPs were schema 1.2 with different hashes and were
rejected as substitutes. The safe rescore runner is ready. Igor's interaction
Cox and selected-horizon producers, Diana's complete standalone script,
upstream review/release and coordinated repository ownership acceptance remain
separate outstanding work. The pilot audit records each dependency.

The existing unsent Gmail reply (draft r-4868362141512317344) was updated with
the three-stream teaching proposal, both PR links, completed calibration and
remaining dependencies. The three-page PDF was attached, and the saved body,
recipients, DRAFT label and attachment size were read back and verified. Local
editable source and build instructions remain together in the email workspace
under docs/playbook/roadmap-survival-bridge. No email was sent and no site was
published.

## Credence provenance and terminology correction

Andy clarified that the original files would not be on the Mac and asked for
GitHub/email evidence before asking collaborators. The September 2 email
(Gmail message 1a0657edc8d68bbd) reports generation and analysis of calibrated
schema 1.3 scenarios with 2,500 rows, rho=0 and rho=0.5. The simulations commit
f1f4f44 preserves the run record, observed validation checksums and fitted
aggregate results; its commit message and ignore rules explicitly retain
aggregates instead of patient rows. These support historical generation and
analysis, not the existence of a recoverable archive or ownership by Diana.

A broader search covered nine relevant repositories, advertised branches/tags,
PR heads, Git objects, ZIP members and release/Actions metadata. A later
September workshop archive contains row files of the same schema and size,
but their hashes differ from the original September benchmark. Normalizing line
endings does not restore the original hashes. The private archive details stay
in local audit evidence. The August email ZIPs are earlier schema 1.2 examples;
later attachments are reports and aggregates. No matching original row files
were recovered. A broader Box-wide filename scan was stopped after offline
directory errors and is not an exhaustive Box audit.

The November 8 terminology commit c6375c5e5fbca95f157f06523cc29e5d54f2ed0b
renamed the report to Calibration Benchmark Status Report. Current prose uses
Credence calibration benchmark; historical identifiers remain literal only
when needed to locate files. The teaching handout contains no retired label.

The unsent reply now asks both Diana and Igor whether they retained the original
files or an archive link, without assuming either has them. It also acknowledges
Igor's November 11 reply connecting the primer and CAST walkthrough and frames
prespecified subgroup effects as a scope proposal requiring agreed checks.
The saved body, recipients, DRAFT label and unchanged PDF were read back.

## Regeneration attempt and PDF clarification

Andy asked to attempt regeneration before requesting files. Seven complete
replays used unchanged ffed084 source, seed 20260821, the verified original
clinical CSV, Python 3.12.9, NumPy 2.5.2, pandas 2.3.3 and PyTorch 2.13.0 builds
on CPU. Windows thread counts 16/1/2/8 and Linux CPU/PyPI build variants were
tested. All fourteen scenario validations passed 24/24; independently checked
hashes show 0/8 historical matches in every run. Four distinct output groups
demonstrate sensitivity. Missing historical OS, numerical-library build and
thread metadata prevent a claim that the full original environment was restored;
the experiments do not prove which omitted detail explains the mismatch.

Aggregate evidence is in PR6, commit c8d499a. All 28 checked publication
artifacts are unchanged. New rows, logs, runtime records, original source
archive and input data remain private under the pilot's ignored .Rlib folder.
The isolated managed source checkout remains available; archival was declined
because it is the chat's primary checkout. No unmonitored job remains.

The actual September 2 and November 8 email PDF attachments were read. Andy
sent both. The six-page November Calibration Benchmark Status Report contains
the retained September Credence results and explicitly distinguishes them from
the updated November internal-pilot/RATE results. The report can be compiled
from saved tables; refitting requires the original generated row files.

The current unsent draft now states these findings and no longer asks Diana
or Igor for files. The exact saved body and unchanged teaching PDF attachment
were read back after the update. No email was sent.
