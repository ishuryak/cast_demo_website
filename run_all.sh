#!/usr/bin/env bash
# Orchestrate the CAST demo pipeline: simulate -> fit -> export.
# Uses Windows R 4.5.1 from WSL. Set DEMO_SUBSAMPLE>0 for a fast smoke test.
#
#   ./run_all.sh                      # full run  -> writes docs/
#   DEMO_SUBSAMPLE=600 ./run_all.sh   # fast smoke test -> writes output/preview/
#
# A subsample run exports to output/preview/ rather than docs/, so a smoke test
# can never overwrite the published site data with a reduced-grid artifact.
#
set -euo pipefail
cd "$(dirname "$0")"

# Prefer an explicit RSCRIPT, else Windows R 4.5.1 (WSL), else Rscript on PATH.
WIN_RSCRIPT="/mnt/c/Program Files/R/R-4.5.1/bin/x64/Rscript.exe"
if [ -n "${RSCRIPT:-}" ]; then :;
elif [ -x "$WIN_RSCRIPT" ]; then RSCRIPT="$WIN_RSCRIPT";
else RSCRIPT="$(command -v Rscript)"; fi
if [ -z "${RSCRIPT:-}" ]; then
  echo "ERROR: no Rscript found. Set RSCRIPT=/path/to/Rscript and re-run." >&2
  exit 1
fi

# WSLENV is required so env vars cross from WSL into the Windows R process.
export WSLENV="DEMO_SUBSAMPLE:DEMO_NUM_TREES:DEMO_SEED:DEMO_TUNE${WSLENV:+:$WSLENV}"
export DEMO_SUBSAMPLE="${DEMO_SUBSAMPLE:-0}"

mkdir -p output logs
ts() { date "+%H:%M:%S"; }

echo "[$(ts)] CAST demo pipeline"
echo "[$(ts)] R: $RSCRIPT"
# Echo every tunable that crosses into R, so the log records the configuration
# the run actually used rather than the one it was assumed to have.
echo "[$(ts)] config: DEMO_SUBSAMPLE=$DEMO_SUBSAMPLE" \
     "DEMO_NUM_TREES=${DEMO_NUM_TREES:-<default>}" \
     "DEMO_SEED=${DEMO_SEED:-<default 101>}" \
     "DEMO_TUNE=${DEMO_TUNE:-<default: all on a full run, none on a subsample>}"
if [ "$DEMO_SUBSAMPLE" -gt 0 ]; then
  echo "[$(ts)] subsample run -> exports to output/preview/ (docs/ untouched)"
else
  echo "[$(ts)] full run -> exports to docs/data and docs/figs"
fi

echo "[$(ts)] 1/3 simulate ..."
"$RSCRIPT" R/01_simulate.R 2>&1 | tee logs/01_simulate.log

echo "[$(ts)] 2/3 fit methods (CSF/CAST/Cox/RSF) ..."
"$RSCRIPT" R/02_fit_methods.R 2>&1 | tee logs/02_fit.log

echo "[$(ts)] 3/3 export json + figures ..."
"$RSCRIPT" R/03_export.R 2>&1 | tee logs/03_export.log

echo "[$(ts)] done."
if [ "$DEMO_SUBSAMPLE" -gt 0 ]; then
  echo "        smoke-test artifacts in output/preview/ (docs/ unchanged)"
else
  echo "        serve the site: cd docs && python3 -m http.server 8000"
  echo "                        then open http://localhost:8000"
fi
