// Terms that must never appear on these pages (names and numbers from
// unpublished work). Stored as SHA-256 hashes of the exact, case-sensitive
// string, so this public file does not itself publish them.
// findGuardedTerms(text) returns the positions where a guarded term occurs.
import { createHash } from "node:crypto";

const GUARDED = [
  [4, "80de84f628b89dc21ebd32f6dcacaddde65e1b42b1db36c88b1a2ab5aa82a429"],
  [5, "9fbc08d140e9a2db0df4bdf80c19680593c3dbbd3137ce18f4325cfa047b6319"],
  [7, "0bbb4d78334148a8fdf256a0c0adfd0f5a16b8c751d9d739ce3a47c233778747"],
  [6, "a5be90c76fa7b2033881bd585c64e5086dc8d38708bd6cafe8e576090dc791d9"],
  [10, "649ff01cf9e58620d67989cf55cbe424dd492324b31d0400a42f597300a0d335"],
  [4, "9297d17cccedb0ed2740a0e10d1c139d776fcd8f4e98fa978f435f090c80ba01"],
  [10, "6a6c0687b13808a7e5115103ab30a43a34639f2bfa0f48eb3a30948e6a5b10bc"],
];

export function findGuardedTerms(text) {
  const hits = [];
  for (const [len, hash] of GUARDED) {
    for (let i = 0; i + len <= text.length; i++) {
      if (createHash("sha256").update(text.slice(i, i + len)).digest("hex") === hash) hits.push({ at: i, len });
    }
  }
  return hits;
}
