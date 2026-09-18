# The routing manifest attested to a file it had not read

Investigation and decision, 2026-08-28. Decision taken by Igor Shuryak.

## How it was found

By running the gate against the manifest instead of reading the manifest. The
file is 180 lines of careful prose and every justification in it is sound; the
defect was in a hash, which prose review cannot check.

    python3 ~/.claude/routing/audit_gate.py --project .
    ...
    - methods-audit: completion.report_sha256 is stale (the report changed since
      it was recorded).

## Finding 1: a content-bound attestation that did not bind

`audit_manifest.yaml` records, for the methods-audit entry, the sha256 of the
report that closes it -- the mechanism that stops a manifest from claiming a
review of text nobody reviewed. The recorded hash was
`74a3573745af515f1f4223c98a5d01fbfdf3c8760356153ae5d09009baf94817`; the file
`development/2026_08_25_oracle-and-evalue-audit.md` hashes to
`d2b472073db83eada7cea84406bcaf8b59fbb373e106e0930ab0524691e302b7`.

The cause is recoverable rather than guessed. A pre-cleanup copy of that report
hashes to exactly the recorded value, and differs from the committed one in two
lines:

    -3. *Make it a full oracle* — estimate a second propensity ...
    +3. *Make it a full oracle*: estimate a second propensity ...
    -- **Was the Plotly SRI hash correct?** Yes — recomputed from the live CDN ...
    ++ **Was the Plotly SRI hash correct?** Yes, recomputed from the live CDN ...

So the hash was taken on 2026-08-25, the em-dash cleanup edited the report during
the third pass on 2026-08-26, and the attestation was never re-taken. It has been
dangling since. The two hashes of the *inputs* to that review, `R/02_fit_methods.R`
and `R/cast_core.R`, both still match, so the review itself was of the code that
ships; only its report drifted.

An attestation that does not bind is worse than no attestation, because it reads
as proof. Re-taken, with a note in the file saying why it moved, so the next
reader is not left to rediscover this.

## Finding 2: the manifest disclaimed an auditor that routes to it

The header said:

> The stale-constant audit is NOT one of the gate's twelve (it has its own engine
> and rule); it was run separately on 2026-08-26 ...

That was true when written and is not true now. `stale-constant-audit` is the
thirteenth routed auditor: `routing/audit_gate.py` enumerates it, requires the
manifest to account for it like any other, and under `--release` builds and runs
the engine itself rather than taking the manifest's word. Because the manifest
carried no entry, the gate was supplying one and warning that it had nothing to
execute:

    stale-constant-audit  RUN  REQUIRED  [SUPPLIED BY GATE] FAIL: RUN executable
    auditor needs a typed `run:` block

Recorded as a full entry with a typed `run:` block (`project`, `registry`,
`inputs`), so the engine resolves from the manifest and runs.

## What was NOT fixed, and why it would have been wrong to fix

The gate still reports four auditors that "MUST be RUN" and are marked N/A:
`pipeline-audit`, `paper-code-audit`, `reader-first-audit`, `tough-reviewer`, plus
`radiation-oncology-reviewer`. They are routed by two facts the detector gets
wrong on this project:

- `is_grant` fires on the word **"resubmission"**, which appears once, inside
  `development/2026_08_26_third-pass-public-release-review.md`, in a paragraph
  discussing this very false positive.
- `has_radiation` fires on **"Radiotherapy"** in the *titles of the two cited
  papers*, in `README.md`, `References/README.md` and `evidence_ledger.yaml`.

Both were already documented in the third-pass record. The available "fix" is to
reword a development record and a reference list so a keyword detector stops
matching, which is gaming the instrument rather than correcting the project, and
the gate says so in its own source: detected facts are authoritative and a
manifest may add facts but never turn one off. That asymmetry is the whole point,
and it is worth more than a green line here.

The N/A justifications rest on the deliverable's nature -- a static teaching site
plus its generating pipeline, with no manuscript, grant or document deliverable --
which is a permanent property of this project, not a deferral on project stage.
The reader-first N/A was re-checked rather than assumed: running the auditor on
`README.md` reports three errors, all of the form "no Abstract / Methods /
Discussion section found", which is what a README is.

**Decision (Igor Shuryak, 2026-08-28):** fix the two mechanical defects, leave the
five false-positive routings recorded and unfixed.

## Verification

- `audit_gate.py --project .` no longer warns on `stale-constant-audit` or on the
  methods-audit hash; the remaining advisories are the five above.
- `stale_constant_audit.py --project . --project-root . --strict` reports
  `REGISTRY (12 constants) STRICT, 0 errors, 0 warnings`, now executed through the
  manifest rather than by hand.
- `sim_provenance.py validate sim_provenance.yaml` -> `registry OK`.
- `./tests/run_tests.sh` -> 9 suites passed, 0 failed.
