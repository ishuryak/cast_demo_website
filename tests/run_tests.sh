#!/usr/bin/env bash
# Run every test suite. No pipeline run required: the R suites are pure
# arithmetic, and the data-contract suite reads the committed
# docs/data/scenarios.json (pass a different path as $1 to check another export,
# e.g. output/preview/data/scenarios.json after a smoke test).
#
# Two suites have an optional dependency and SKIP rather than fail without it:
# the five R suites need Rscript, and the viewport suite needs a Chrome or Edge.
#
#   ./tests/run_tests.sh
#   ./tests/run_tests.sh output/preview/data/scenarios.json
set -uo pipefail
cd "$(dirname "$0")/.."

JSON="${1:-docs/data/scenarios.json}"

# Same resolution order as run_all.sh: $RSCRIPT, then Windows R under WSL, then PATH.
WIN_RSCRIPT="/mnt/c/Program Files/R/R-4.5.1/bin/x64/Rscript.exe"
if [ -n "${RSCRIPT:-}" ]; then :;
elif [ -x "$WIN_RSCRIPT" ]; then RSCRIPT="$WIN_RSCRIPT";
else RSCRIPT="$(command -v Rscript || true)"; fi

pass=0; fail=0
run() {                     # run <name> <command...>
  local name="$1"; shift
  echo "--- $name"
  if "$@"; then pass=$((pass+1)); else fail=$((fail+1)); echo "    ^ $name FAILED"; fi
  echo
}

if [ -n "${RSCRIPT:-}" ]; then
  run "cast_core math"   "$RSCRIPT" tests/test_cast_core.R
  run "export labels"    "$RSCRIPT" tests/test_export_labels.R
  run "fit contract"     "$RSCRIPT" tests/test_fit_contract.R
  run "source guards"    "$RSCRIPT" tests/test_source_guards.R
  run "sim provenance"   "$RSCRIPT" tests/test_sim_provenance.R
else
  echo "--- SKIP: no Rscript found; set RSCRIPT=/path/to/Rscript for the R suites"
  echo
fi

if command -v node >/dev/null 2>&1; then
  run "site data contract" node tests/test_data_contract.mjs "$JSON"
  run "site render smoke"  node tests/test_render_smoke.mjs  "$JSON"
  run "site style contract" node tests/test_style_contract.mjs
  # Needs a browser. Skips (exit 0) with a message when none is found, so a
  # machine without Chrome still runs the other eight rather than failing.
  run "viewport overflow"  node tests/test_viewport_overflow.mjs
else
  echo "--- SKIP: node not found; the site data contract was not checked"
  echo
fi

echo "======================================"
echo "suites passed: $pass    failed: $fail"
[ "$fail" -eq 0 ] || exit 1
