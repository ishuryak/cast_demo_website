# 2026-09-28: educator-kit portability, a dead link, and the provenance wording

FIXES.md entries 39 to 42. Nothing published moves.

## What found these

A read-only review of the repository on 2026-09-28 (main at `25f1121`). Two of
the four items were already listed in the unsent 2026-09-25 reply to Andy
Wilson, as things he could fix in his next pass on the educator kit. They are
fixed here instead, so that reply should drop them.

Findings from the same review that are NOT addressed here, and why:

- **AI-use disclosure on the public pages.** Not yet on any live page. It needs
  a wording decision from Igor and agreement with Andy, so no text was written.
- **Stale local checkout.** The OneDrive working copy was on `clinical-framing`,
  six commits behind `main`. Re-synced to `main` before this work began.
  `clinical-framing` remains on the remote. Retiring it is a separate decision.
- **Personal correspondence in the working tree.** An untracked email file sat
  in the repository root. It was moved out of the repository, not committed.
- **Stale remote branches and per-patient `.gitignore` patterns.** Advisory only
  (all data are simulated) and left for a hygiene pass.
- **`web/index.html` still says "ported directly".** `web/` is an older copy
  that no build or page uses. It was left untouched and is noted here.
- **`R/cast_core.R` header comment says "ported faithfully".** Not changed: the
  kit pins that file's bytes against commit `43a0010`, so editing its comment
  would break the kit's source-hash contract for no reader-facing gain.

## Decisions

1. **Offline default uses the bundled copy only when its MD5 matches the pinned
   commit.** The alternative, preferring any local `R/` folder, would let a
   student's edited copy be recorded as the pinned source. The MD5 values are
   those of `R/cast_core.R` and `R/01_simulate.R` at `43a0010`, which the kit's
   packaging script already requires the bundled files to equal byte for byte.
2. **Binary connection, not only `eol = "\n"`.** The fix suggested in the 09-25
   draft (`write.csv(..., eol = "\n")`) was tested under Windows R and did not
   work: a text-mode connection turns `\n` back into CRLF. The test that caught
   this runs the real script under Windows R.
3. **Provenance wording** follows the README, which is the methods document,
   rather than the other way round.

## Measurements

- Offline test: one 200-person fit at 100 trees, a few seconds on Windows R 4.5.1.
- `npm run build:pages` equivalent (`node scripts/build-pages.mjs`, node
  v24.13.0): only the expected files changed (kit script copies, the kit archive
  and its `provenance.json`, whose sole change is the `cast-exercise.R` hash).
