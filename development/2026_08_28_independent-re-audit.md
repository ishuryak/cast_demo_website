# Independent re-audit of the whole repository, 2026-08-28

Requested by Igor Shuryak: audit the project comprehensively with the current
auditors and settings, **without relying on the conclusions of the three previous
passes**, and answer three questions -- are the recent updates correct, was all
of the review feedback taken into account, and were the updates opened as
pull requests for the reviewer to see.

Every claim below was re-derived from the tree rather than read out of
`FIXES.md` or the earlier plan documents. Where a prior record turned out to be
right, that is recorded as a confirmation with the evidence that confirms it, not
as an appeal to the record. Where this audit was itself wrong, the correction is
recorded in place rather than removed.

---

## Answers

1. **Are the recent updates correct?** Yes. Confirmed at byte level by re-running
   the pipeline from a clean extract; details under "The verification that
   mattered most".
2. **Was all the feedback taken into account?** Yes, all five comments, verified
   in the shipped code and in a render rather than in the record that says so.
3. **Were they opened as pull requests?** **No.** Four branches had been pushed
   two days earlier and no pull request existed. This was the one real gap, and
   it is what the session then closed.

---

## Auditor triage

Recorded for all thirteen, per the routing rule. `RUN` items were executed in
this session; the recorded `N/A` is the artifact proving coverage was considered.

| Auditor | Verdict | Basis |
|:--|:--|:--|
| stale-constant-audit | RUN | `REGISTRY (12 constants) STRICT`, 0 errors, 0 warnings |
| simulation-audit | RUN | `validate` OK. `check --strict` still blocked on a run trace `R/01_simulate.R` does not emit -- the gap already declared in `audit_manifest.yaml`, re-confirmed rather than assumed |
| methods-audit | RUN | estimand/estimator alignment re-derived by hand; all eight attestation hashes re-computed and bind |
| manuscript-audit (analog) | RUN | no manuscript exists; the analogous checks were run against `README.md` and the figures |
| paper-code-audit (analog) | RUN | README claims re-checked against `R/` |
| pipeline-audit (analog) | RUN | full pipeline re-run from `git archive` |
| reader-first-audit | N/A, re-checked | not assumed: run against `README.md` it reports 3 errors, all "no Abstract / Methods / Discussion section found", which is what a README is |
| evidence-audit | N/A | no manuscript or grant. Run anyway for completeness: 294 errors, every one an artifact of pointing a release contract at a README (bracket cites parsed out of DOIs, and so on) |
| biomedical-data-audit | N/A | every cohort simulated; no patient-level data anywhere in the project |
| radiation-oncology-reviewer | N/A | `has_radiation` fires on the *titles of the two cited papers*; nothing in the demo is radiation-specific |
| tough-reviewer | N/A | `is_grant` is a keyword false positive; there is no grant |
| surprising-result-skeptic | N/A | known-truth simulation; no headline empirical finding |
| subagent-scan | N/A | performed in a single context; no fan-out was used |

`audit_gate.py --project .` reports the same six keyword advisories it has
reported since 2026-08-26 and no new one. Those advisories are understood and
deliberately not chased; see `2026_08_28_audit-manifest-attestation.md`.

---

## The verification that mattered most

The strongest check available here is not any auditor. It is whether the code in
the repository, run by someone who has never run it, reproduces the artifact the
repository ships -- because that is what the site promises every visitor, and
because it is precisely the check that the AUTOC seed defect (entry 24) had
already defeated once.

Method: `git archive e45aa24 | tar -x` into a scratch directory outside the
repository, then `./run_all.sh` with no environment overrides, then a leaf-by-leaf
comparison of the resulting `docs/data/scenarios.json` against the committed one
and a sha256 comparison of all nine figures.

**Result: 1 differing leaf out of 5,704, and it is `/generated`, the run
timestamp. All nine figures byte-identical.**

That closes entry 24 with evidence rather than with its author's assurance. Every
ATE, confidence interval, RMSE, hazard ratio, proportional-hazards p-value,
standardized mean difference, overlap diagnostic, shrinkage value, E-value and --
the field that was actually broken -- every `autoc.se` reproduces exactly.

**Cost, measured, because it is expensive to re-derive:** 8 min 20 s wall clock
(`[20:45:31]` to `[20:53:51]`), of which 8 min 03 s is the fitting stage, on
Windows R 4.5.1 driven from WSL. This matches the README's stated "about 8
minutes". An earlier estimate made during this session of 25 to 60 minutes was
wrong and is corrected here: the extraction of the tree onto the OneDrive-backed
filesystem is what is slow, not the pipeline.

---

## The five review comments, verified against the shipped code

Not against the plan document that says they were addressed. Each was checked in
`docs/`, and the whole page was rendered headless at 1440x2600 and read back.

| # | Comment | Verified how | Verdict |
|:--|:--|:--|:--|
| 1 | sliders offer only 3 and 4 discrete values | zero `type="range"` remain in `docs/`; `buildLevels()` emits real `<input type="radio">`; the render shows four and three segmented positions | addressed |
| 2 | two sentences read like AI | grep for both across `docs/`, `README.md`, `R/`, `tests/`: no hits, including the `app.js` tooltip ripple | addressed |
| 3 | lead plain, then precise; fewer parentheticals | measured: lead paragraphs 1 -> 5, parenthetical groups **11 -> 5**; the estimand sentence uses the reviewer's wording | addressed |
| 4 | the blue bars do not change | `.rmse-fill { display: block; min-width: 2px }` present; the render shows all six bars filled and proportional | addressed |
| 5 | cards have no reading order, too much text | four numbered group headings, seven `<details>`/`<summary>` pairs, live numbers outside the disclosure | addressed |

The re-diagnosis in entry 18 is confirmed and is better than the report it came
from: the bars were not failing to respond, they had never been drawn in any
state since the card was written.

---

## Other claims re-derived rather than trusted

- **README numeric claims.** CSF interval coverage over the `Gamma_u = 0` panels
  with `gamma <= 1` recomputed from `scenarios.json`: **28 of 30**, which is what
  the README says. The "unlucky gamma = 0 panel" passage checks out exactly --
  naive 0.192, T-learner 0.193, CSF 0.191 against a true 0.141, with the interval
  [0.152, 0.231] excluding the truth at 36 months. GLS is selected in 24 of 24
  scenarios; R-squared spans 0.640 to 0.999 (threshold 0.5) and the post-shrinkage
  condition number spans 8.1 to 17.6 (threshold 100). Both thresholds hold with
  room, as claimed.
- **Figure-to-source.** `reversal_strong_confounding.png` opened and read: title,
  axis label, all eight legend entries and the stated error-bar semantics match
  the caption, and the plotted values match `scenarios.json` (truth -0.0568 and
  CSF -0.0647 at 108 months).
- **Citations.** Both re-verified live rather than from the earlier record. arXiv
  API for 2505.06367 and the Crossref API for 10.1038/s41598-026-54656-0 return
  titles, author lists, year, journal, volume 16 and article 23659 exactly as
  `References/README.md` and `CITATION.cff` state.
- **Attestations.** All eight `sha256` values recorded in `audit_manifest.yaml`
  recomputed from their current files. All eight bind.
- **Test suite.** 9 of 9 passing at the start of the session, including the
  viewport suite's own negative control firing correctly.
- **`References/`** carries no committed PDF (`git ls-files` over the case-complete
  pattern returns nothing), as the policy requires.

---

## Findings

### 1. No pull request existed, and this was the whole point of the exercise (severity: high)

`gh pr list --state all` returned only PRs #1 and #2, both from 2026-06-25 and
both merged. The four branches carrying two days of work were pushed and in sync
with origin, and **no pull request had been opened for any of them.** The reviewer
had nothing to review and had not been notified.

Two consequences that were not obvious and were confirmed directly:

- **The live site still showed every defect the review reported.** Pages serves `main`,
  which was five commits behind. Fetching the public URL returned markup still
  containing `<input type="range">`, still containing the "stylized teaching
  curve" sentence, with no `<details>` elements, and a stylesheet whose
  `.rmse-fill` still lacked `display: block` -- so the invisible RMSE bars the
  review reported were still invisible in public.
- **CI had never run on any of the work.** `.github/workflows/tests.yml` triggers
  on push-to-`main` and on `pull_request`. A push to a feature branch is neither.
  The most recent run before this session was 2026-08-26 on `main`.

**Resolved in this session.** Five stacked pull requests opened (#3 through #7),
one concern each, base of each being the branch below it, so that the PR
answering the review contains only the answer to the review. All five went green
on CI -- the first time this work had been exercised by CI at all -- and all five
report `MERGEABLE`. A review was requested on **#4 only**, that being the PR that
answers the comments; that request was later withdrawn, for the reason in finding
6 below. Nothing was merged: merging would push the fixes live and pre-empt the
review that was the object of the request.

### 2. `FIXES.md` contradicted its own stated ordering (severity: low, but see why it matters)

Fixed in this pass; the full evidence is in `FIXES.md` entry 26. Recorded here
for the reason it survived: three previous audit passes read this file closely
and none noticed, because reading a file for content does not check a structural
claim the file makes about itself. It is now a test.

### 3. Three regenerable artifacts were untracked and unignored (severity: low)

Fixed in this pass; `FIXES.md` entry 27.

### 4. A stale duplicate working copy sits above the real one (severity: medium; OPEN)

The project root contains a nested clone of itself. The tree at
`cast_demo_website/cast_demo_website/` is the live one; the outer directory is a
second clone whose working tree is checked out at **orphan commit `0deadf8`**,
which exists on no remote branch, and which carries the pre-fix
`scenarios.json`, `R/02_fit_methods.R`, `README.md` and `FIXES.md` -- 16 files and
about 1,015 lines behind the tip.

**A first assessment in this session overstated the danger and is corrected
here.** The outer clone's `main` and all four `feature/*` refs point at exactly
the origin SHAs, so they are not stale; the checked-out orphan branch has no
upstream, so a bare `git push` from it fails rather than publishing anything; and
the bare review branch does not exist on origin. An earlier check in this session
appeared to show that it did, but that was `git ls-remote`'s tail-matching pattern
matching the `feature/`-prefixed branch of a similar name. Nothing stale can reach the public
repository from there.

The real risk is narrower and is not hypothetical: **editing the wrong tree.**
That is how `0deadf8` and `b6f4101` came to exist as two commits with the same
message on two lineages. It is likely to recur because a session opened at the
project root lands in the outer, stale tree by default, and that tree looks
entirely plausible -- every test file is present and would pass.

Verified before proposing any removal: the outer tree contains **no unique file**
except `.claude/settings.local.json` (a two-entry permission allowlist, since
copied across), and `0deadf8` is preserved in the live repository on branch
the review branch, so nothing would be lost.

**Status: open.** A guided PowerShell procedure was provided; Igor asked whether
leaving it is acceptable and has not ruled. Deleting a directory tree is
irreversible and was deliberately not performed. The alternative offered, if it is
to stay, is to check the outer tree out to the current tip so it is duplicated but
no longer stale.

### 5. Local `main` pointed at an orphaned lineage (severity: low; fixed)

`main` in the live repository was at `fffb15c`, on the 18-commit lineage that
predates the 2026-08-26 history rewrite, rather than at `origin/main`. Checking
out `main` locally therefore did not give what is on GitHub. Reset with
`git branch -f main origin/main` after first confirming that `fffb15c` is an
ancestor of tag `_preflight_final` (`463fcbc`), so the old lineage remains fully
reachable and nothing was discarded.


### 6. The five comments were attributed to the wrong person, publicly (severity: high; corrected)

Every artifact of the 2026-08-27 pass credited the five review comments to the
first author of the CAST papers, by name: the reasoning document's title, filename
and byline, the `FIXES.md` section header, the commit subject of the change that
answered them, and the branch the work sat on. On 2026-08-28 Igor Shuryak
corrected the record: **the comments were made by a different colleague who had
looked at the live site.**

By then the misattribution had reached the public repository, and this session had
compounded it -- acting on the same false premise, it had requested a review from
that person on the pull request answering comments they had never made.

**How it happened, and why no check caught it.** The source document is named
named for a person and sits gitignored beside the repository. The name in that
filename was taken as the author of its contents. Nothing in the file
states an author. Every downstream artifact then inherited the assumption from the
one before it, and each looked well-sourced because it cited the last. **A chain of
citations all resolving to a single unverified premise reads exactly like
corroboration.** No auditor in the suite checks the identity of a person named in a
document, and none could.

**Corrected, in this order, worst-first:**

1. The review request was withdrawn within minutes of the correction.
2. The public pull request was retitled and its body rewritten to carry no name.
3. The stack was rewritten to remove the name from file contents, from the
   reasoning document's filename, from the commit subject and from the branch
   name. `CITATION.cff` was deliberately left untouched: that is the same person's
   genuine authorship of the CAST papers and is correct.

**Decision (Igor Shuryak, 2026-08-28): anonymize rather than re-credit.** The
comments are now attributed to "a colleague" throughout. Naming the actual
reviewer in a public repository is their call to make, not the project's, and it
had not been asked.

**Left alone, and flagged rather than assumed:**
`development/2026_08_25_public-release-audit.md` states that the same person "had
approved the scientific content" before the public release. That is a *different*
claim from authorship of the comments, it sits outside the rewritten range, and it
has not been contradicted. It is recorded here as unverified rather than silently
corrected or silently kept.

**What this costs going forward.** A history rewrite on a repository with open
pull requests forces those pull requests to be closed and reopened, and the
pre-rewrite commits stay reachable by SHA on the hosting side even after a
force-push. Removing a name from a public repository is therefore never as clean
as never putting it there. **The cheap check that would have prevented all of it is
one question: who wrote this document?**

---

## Findings investigated and dismissed

Recorded because what was ruled out is part of the record, and because each of
these looked like a defect until it was checked.

- **The evidence ledger reports 294 errors against `README.md`.** Not a defect.
  `evidence-audit` is marked N/A in the manifest and the gate agrees it is not
  required here; running a release contract designed for a manuscript against a
  README produces exactly this. Inspection of the errors shows them to be
  section-coverage complaints and bracket citations parsed out of DOI strings
  (`[0]`, `[210]` from `10.1038/s41598-026-54656-0`).
- **The routing gate reports six auditors as required-but-N/A.** Pre-existing,
  understood, and deliberately not chased: `is_grant` fires on the word
  "resubmission" in a development record and `has_radiation` on the titles of the
  two cited papers. The only available fix is rewording a reference list until a
  keyword detector stops matching.
- **`sim_provenance.py check --strict` fails.** Not a regression. It needs a run
  trace that `R/01_simulate.R` does not emit, which is declared in the manifest
  with the reason (emitting one would force a regeneration of the published grid)
  and compensated by `tests/test_sim_provenance.R`.
- **The AUTOC commit message says "roughly 1,900 leaves"; the file has 5,704.**
  The figure is hedged and the material claim -- 17 changed leaves, being the 16
  `autoc.se` values and the timestamp -- is exactly right. Not worth a correction.
- **The withdrawn mobile-overflow finding.** The withdrawal was re-checked rather
  than accepted: `tests/test_viewport_overflow.mjs` was run and its negative
  control confirmed firing (`the measurement detects a real overflow (control: 1
  element(s), scrollWidth 1600 > 385)`). The page genuinely does not overflow at
  any of the six widths. The withdrawal was correct.
- **`_preflight_final` and the orphaned 18-commit lineage.** Not a defect: it is
  the pre-rewrite history retained locally as a safety net, and it is what makes
  the `main` reset in finding 5 non-destructive.

---

## An error this audit made, kept rather than deleted

While mutation-testing the new `tests/test_fixes_order.mjs`, the mutation written
to break the ordering assertion swapped two sections **of the same date**. The
suite reported nothing, which for a moment read as the test being blind. The
mutation was ineffective, not the test: same-date sections are explicitly allowed
in either order. Redone against a genuinely out-of-order arrangement, the
assertion reported `line 187: 2026-08-28 appears after an older section`.

This is worth keeping because it is the same shape of mistake as the
mobile-overflow instrument error recorded in `2026_08_27_site-review-comments.md`,
one level up: there, a measurement instrument produced a false positive and was
believed; here, a mutation instrument produced a false negative and was nearly
believed. **A mutation must be confirmed to actually violate the property before
its silence is treated as evidence about the test.**

---

## Decisions

- **Igor Shuryak, 2026-08-28: open the pull requests.** Asked whether the work
  had been pushed as PRs, then, on being shown it had not, instructed that the
  missing steps be completed. Nothing was merged, because the request was for
  the reviewer to see.
- **Igor Shuryak, 2026-08-28: a GitHub handle was supplied for the reviewer** and
  confirmed against the API before being added, rather than guessed. The premise
  it rested on turned out to be wrong; see finding 6.
- **This session, 2026-08-28: five stacked PRs rather than one.** A single PR to
  `main` would have shown the reviewer five commits, three of them internal audit work
  the reviewer has no reason to read. Stacking costs an ordered merge and keeps
  their diff to the answer to their comments.
- **Open, not decided: the duplicate working copy (finding 4).**
- **Open, and unchanged since 2026-08-26: the `Co-Authored-By: Claude` trailers**
  on commits, which the harness rule requires and Igor's authored-revision-metadata
  convention argues against. Flagged twice now; still not ruled on.
