#!/usr/bin/env node
// Is the tracked tree the project, and only the project?
//
// WHY THIS EXISTS. On 2026-09-18 commit db72206, whose message reads "Fix
// Windows path resolution in test files; update audit manifest", also committed
// four things it did not mention:
//
//   * `cast_demo_website` as a GITLINK (mode 160000) with no .gitmodules. It
//     pointed at 68a22b3 -- a commit in THIS repository -- so a fresh clone got
//     an empty directory git called a submodule with no URL to fetch. On disk it
//     is a nested working copy of the whole project, which also doubles every
//     file for any tool that walks the tree: six of the seven stale-constant
//     sweep warnings that day resolved into it rather than into real code.
//   * `.backup_untracked/`, four superseded duplicates of files tracked at their
//     real paths. Two were byte-identical; two had drifted. The drifted viewport
//     test cited development/2026_08_27_everest-yang-feedback.md where the
//     tracked one cites 2026_08_27_site-review-comments.md -- so committing the
//     backup re-introduced a misattribution this repository had already fixed.
//   * `tests/debug_path.mjs` and `tests/debug_path2.mjs`, six-line console.log
//     scratch, sitting in tests/ where they read as suites.
//   * `.claude/settings.local.json`, per-machine permission grants, which hands
//     every clone a blanket allow-list for git add / commit / checkout / gh pr.
//
// None of it is recoverable by reading a diff summary, because each looked like
// an ordinary added path. What distinguishes them is a property of the tracked
// tree, which is what this file checks.
//
// WHAT IT ASSERTS. Four independent things, because they fail independently:
//   1. no gitlink is tracked anywhere (the class, not the one name);
//   2. none of the four specific paths is tracked;
//   3. each is IGNORED, so re-adding it needs a deliberate `git add -f`;
//   4. every sha256 in audit_manifest.yaml is a real digest of the file it
//      names (see section 4 below for why that is not redundant).
// (3) is what keeps (2) fixed. Untracking alone leaves `git add -A` free to put
// it straight back.
//
// CONFIRMED TO FAIL against db72206: gitlink found (cast_demo_website),
// 4 tracked paths, 4 unignored -- 9 failures. The hash check was confirmed
// separately by restoring one fabricated value, which it reports as MALFORMED,
// and by editing an attested file, which it reports as STALE.
//
//   node tests/test_repo_hygiene.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });

let fails = 0;
const ok = (msg, cond) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${msg}`); };

console.log("repo hygiene: " + ROOT);

// ---- 1. no gitlink anywhere -------------------------------------------------
// `ls-files -s` prints the mode; 160000 is a gitlink. Checking the MODE rather
// than the name catches the next one, whatever it is called. A repository that
// genuinely wants a submodule declares it in .gitmodules, so that is the only
// thing that makes a gitlink legitimate -- and there is no .gitmodules here.
const staged = git("ls-files", "-s").trim().split("\n").filter(Boolean);
const gitlinks = staged.filter(l => l.startsWith("160000")).map(l => l.split("\t")[1]);
let declared = [];
try {
  declared = git("config", "-f", ".gitmodules", "--get-regexp", "path")
    .trim().split("\n").filter(Boolean).map(l => l.split(" ").slice(1).join(" "));
} catch { /* no .gitmodules: every gitlink is undeclared */ }
const undeclared = gitlinks.filter(p => !declared.includes(p));
ok(`no undeclared gitlink is tracked${undeclared.length ? ` -- found: ${undeclared.join(", ")}` : ""}`,
   undeclared.length === 0);

// ---- 2 and 3. the four specific paths --------------------------------------
// Each is checked BOTH ways. "Not tracked" is the state; "ignored" is what keeps
// it that way. A path can be untracked and one `git add -A` from returning.
const OFFENDERS = [
  { path: "cast_demo_website",            probe: "cast_demo_website/README.md" },
  { path: ".backup_untracked",            probe: ".backup_untracked/anything.md" },
  { path: "tests/debug_path.mjs",         probe: "tests/debug_path99.mjs" },
  { path: ".claude/settings.local.json",  probe: ".claude/settings.local.json" },
];

const tracked = new Set(git("ls-files").trim().split("\n").filter(Boolean));
for (const { path, probe } of OFFENDERS) {
  const hits = [...tracked].filter(f => f === path || f.startsWith(path + "/"));
  ok(`${path} is not tracked${hits.length ? ` -- ${hits.length} file(s), e.g. ${hits[0]}` : ""}`,
     hits.length === 0);

  // git check-ignore is the authority; a grep of .gitignore text cannot tell an
  // adequate pattern from a lucky one, and cannot see a later negation at all.
  let ignored = false;
  try { git("check-ignore", "-q", probe); ignored = true; } catch { ignored = false; }
  ok(`${probe} is ignored, so it cannot return via \`git add -A\``, ignored);
}

// ---- 4. every attestation hash in audit_manifest.yaml is real -------------
// WHY. On 2026-09-18 four of the nineteen sha256 values in audit_manifest.yaml
// were not digests. They were 63 or 65 hex characters in hand-typed
// walking-nibble patterns, and one of them stood as the report_sha256 of three
// different reports at once. An attestation exists to bind a recorded verdict to
// the bytes it was reached against; a hash nobody computed binds nothing, and
// the file it names can change freely with no check noticing. audit_gate.py
// called one of them "stale", which is a different and much milder claim, so the
// fabrication survived every green run.
//
// Two distinct failures are reported separately, because they mean different
// things: MALFORMED means the value was never a digest, STALE means it was one
// and the file has since changed.
const manifestPath = join(ROOT, "audit_manifest.yaml");
if (!existsSync(manifestPath)) {
  ok("audit_manifest.yaml is missing", false);
} else {
  const man = readFileSync(manifestPath, "utf8");
  // [...] first: String.prototype.matchAll returns an ITERATOR, which has no
  // .map, and chaining one throws rather than silently matching nothing.
  const pairs = [
    ...[...man.matchAll(/\{path:\s*([^,]+),\s*sha256:\s*sha256:([0-9a-fA-F]+)\}/g)]
      .map(m => [m[1].trim(), m[2]]),
    ...[...man.matchAll(/report:\s*(\S+)\s*\n\s*report_sha256:\s*sha256:([0-9a-fA-F]+)/g)]
      .map(m => [m[1].trim(), m[2]]),
  ];
  ok("audit_manifest.yaml declares no attestation hashes at all", pairs.length > 0);

  const malformed = [], stale = [], missing = [];
  for (const [rel, h] of pairs) {
    if (h.length !== 64) { malformed.push(`${rel} (${h.length} hex chars)`); continue; }
    const f = join(ROOT, rel);
    if (!existsSync(f)) { missing.push(rel); continue; }
    const real = createHash("sha256").update(readFileSync(f)).digest("hex");
    if (real !== h) stale.push(`${rel} (recorded ${h.slice(0, 12)}..., actual ${real.slice(0, 12)}...)`);
  }
  ok(`every attestation hash is a 64-hex sha256` +
     (malformed.length ? ` -- MALFORMED: ${malformed.join("; ")}` : ""), malformed.length === 0);
  ok(`every attested file exists` + (missing.length ? ` -- missing: ${missing.join(", ")}` : ""),
     missing.length === 0);
  ok(`every attestation hash matches its file` +
     (stale.length ? ` -- STALE: ${stale.join("; ")}` : ""), stale.length === 0);
  if (!malformed.length && !stale.length && !missing.length)
    console.log(`        (${pairs.length} attestation hashes recomputed)`);
}

console.log(`repo hygiene: ${fails === 0 ? "PASS" : "FAIL"} (${fails} failure${fails === 1 ? "" : "s"})`);
process.exit(fails === 0 ? 0 : 1);
