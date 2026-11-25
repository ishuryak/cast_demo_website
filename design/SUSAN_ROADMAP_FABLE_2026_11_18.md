# Susan’s roadmap and CAST handoff

Andy asked on November 18 to delegate the implementation plan to Claude Fable 5.2 using his sent reply and Igor’s suggestions, then have Codex review it. Codex coordinates and verifies. Claude is responsible for the proposed implementation sequence and the bounded pre-promotion changes it is assigned in isolated checkouts. Andy and Igor retain scientific and publication decisions.

The working brief is [SUSAN_ROADMAP_FABLE_REQUEST_2026_11_18.md](SUSAN_ROADMAP_FABLE_REQUEST_2026_11_18.md). The private check-in package holds the prior roadmap plan and illustrations. The brief contains the project decisions extracted from both team messages. The active CAST checkout is used only for the collaboration record. Primer and CAST application edits stay in their separate worktrees. The existing walkthrough PR #15 is a conflict to account for.

## Local implementation and review

The requested model completed the plan and two scoped source-editing runs. Each CLI receipt reports `claude-fable-5-2` as both the initialized model and the only model in usage, with terminal reason `completed` and zero permission denials. Codex checked the current brief against the dry-run SHA-256, and checked the implementation and follow-up inputs against their separate receipts. The source runs used 152 and 60 file-tool calls. [Claude’s original plan](collaboration-runs/susan-roadmap-2026-11-18/claude-plan.md) · [Planning receipt](collaboration-runs/susan-roadmap-2026-11-18/plan-receipt.json) · [Implementation receipt](collaboration-runs/susan-roadmap-2026-11-18/implementation-receipt.json) · [Debrief receipt](collaboration-runs/susan-roadmap-2026-11-18/followup-receipt.json)

| Local review branch | Checkpoint | Delivered |
| --- | --- | --- |
| Primer `review/susan-roadmap-2026-11-18` | `a008a3dc788ab145fa23fc52dffddb507728a6d9` | Opens with Susan’s trial-or-records decision. The first screen of step 8 asks whether the records can answer it and for whom Susan would argue for a feasible trial. Three original teaching candidates supplied by Andy illustrate the opening, a repairable and a missing comparison, and the optional external-control sequel. |
| CAST `review/cast-roadmap-links-2026-11-18` | `f9d5e43916db2167fa8ae30063c28eade3fe08ec` | Methods introduction links to the canonical walkthrough and primer preview. The source walkthrough and its generated Pages copy use the corrected Dang and Balzer article and pages. |

The primer’s v2 score and all four early checkpoint hosts were physically moved after the full identification lesson. Its embedded game now has a keyboard-accessible finish action at any stage. The current debrief gives every positive concern a reason and a numbered roadmap link, shows what repairs remain, and keeps the missing comparison visible. The same review is available without the canvas and on direct visits to the embedded game. The third-party three-study standalone game has its own separate handoff.

Step 6 defines radiotherapy schedules by dose, fractions, timing and eligibility. Documented R and Python tools illustrate model standardization, TMLE and DML. The worked code fits each implementation on the same eligible cohort, predicts both schedules for each patient, averages over that same cohort, and integrates to 60 months. Links and text explain the limits of applying a package for a single-time outcome to this censored outcome. Coauthors can still contribute Igor’s own clinical dose example and expand the package map.

## Verification and decisions

- All nine primer Node suites, 38 embedded game tests, JavaScript syntax checks, and reference ordering passed. Rebuilding the embedded game reproduced its local checkpoint. The numeric fixture was checked byte-for-byte against the upstream Git blob before clearing Windows line-ending conversion in the new checkout.
- The R and Python examples printed in the page ran on the same generated 250-row fixture. Their point estimates agreed to within 0.00002 month. The generated fixture verifies the calculation and supplies no clinical result.
- The CAST tutorial test suite, intro contract, generated-variant checks, and Pages build passed. Browser checks at phone and desktop widths verified the two homepage links and the corrected citation in the walkthrough.
- Browser checks of the primer verified the three images and alt text, the new step 8 question on the first phone screen, the teaching order in v2, and keyboard access through the in-frame finish action to ten linked roadmap concerns. Direct game visits use its inline debrief.
- Codex accepted Claude’s proposed teaching sequence and conditional data-fusion sequel. Review strengthened the clinical question at both ends, removed wording that implied a formal grading system, qualified the randomization claim, added the paired, tested code, and required a discoverable in-frame finish with every positive residual. The time-zero illustration remains an alternate for a different dataset.
- The planning response called a first PR “prepared,” but that planning run produced only text. The two checkpoints above are local review branches. CAST PR #15 remained open and conflicting on the checked base and was left intact. Its branch and the CAST link patch both touch the same introduction and walkthrough. Reapply or rebase the small link/citation changes when the team decides the merge order.
- Ask Alex and MaryLena which patients they would recommend for a trial and which evidence could change that advice. After review, preserve the current root at `/classic/` with its assets, module paths, quizzes and bookmarks. Keep direct `/preview/` page, fragment, asset and embedded-game entry points working. Any root or CAST publication proceeds through team pull requests.

Claude’s plan, run receipts and the coordinator’s verification are recorded under the ignored local design/collaboration-runs/susan-roadmap-2026-11-18 directory.
