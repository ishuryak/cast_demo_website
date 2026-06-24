#!/usr/bin/env bash
# Orchestrate the CAST demo pipeline: simulate -> fit -> export.
# Uses Windows R 4.5.1 from WSL. Set DEMO_SUBSAMPLE>0 for a fast smoke test.
#
#   ./run_all.sh                 # full run (N=2000, 4 confounding levels x 2 shapes)
#   DEMO_SUBSAMPLE=600 ./run_all.sh   # fast smoke test
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
export WSLENV="DEMO_SUBSAMPLE:DEMO_NUM_TREES:DEMO_BOOT:DEMO_SEED:DEMO_TUNE${WSLENV:+:$WSLENV}"
export DEMO_SUBSAMPLE="${DEMO_SUBSAMPLE:-0}"

mkdir -p output logs
ts() { date "+%H:%M:%S"; }

echo "[$(ts)] CAST demo pipeline  (DEMO_SUBSAMPLE=$DEMO_SUBSAMPLE)"
echo "[$(ts)] R: $RSCRIPT"

echo "[$(ts)] 1/3 simulate ..."
"$RSCRIPT" R/01_simulate.R 2>&1 | tee logs/01_simulate.log

echo "[$(ts)] 2/3 fit methods (CSF/CAST/Cox/RSF) ..."
"$RSCRIPT" R/02_fit_methods.R 2>&1 | tee logs/02_fit.log

echo "[$(ts)] 3/3 export json + figures ..."
"$RSCRIPT" R/03_export.R 2>&1 | tee logs/03_export.log

echo "[$(ts)] done. Serve the site:"
echo "        cd docs && python3 -m http.server 8000   # then open http://localhost:8000"
