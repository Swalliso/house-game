#!/bin/bash
# D-191 lab, part two: develop as the variants branched from it (c92de7b, before D-194), on the
# same seeds, and every arm compared against it. Run from the lab worktree's root, after
# run-all.sh: bash lab/run-base.sh <repo> <out-dir>
set -euo pipefail
REPO=$1
OUT=$2
LAB=$(pwd)
DEV0=/tmp/hg191-lab-dev0
[ -d "$DEV0" ] || git -C "$REPO" worktree add -q --detach "$DEV0" c92de7b
node "$LAB/lab/run.ts" "$DEV0" "$LAB/lab/creek-seeds.json" "$OUT/creek-dev0.json"
node "$LAB/lab/run.ts" "$DEV0" "$LAB/lab/pond-seeds.json" "$OUT/pond-dev0.json"
echo "== creek lots (base: develop at c92de7b)"
node "$LAB/lab/cmp.ts" "$OUT/creek-dev0.json" "$OUT"/creek-dev.json "$OUT"/creek-v2.json "$OUT"/creek-v1c.json "$OUT"/creek-v1c-125.json "$OUT"/creek-v1c-150.json "$OUT"/creek-v1d.json
echo "== pond lots (base: develop at c92de7b)"
node "$LAB/lab/cmp.ts" "$OUT/pond-dev0.json" "$OUT"/pond-dev.json "$OUT"/pond-v1.json "$OUT"/pond-v2.json
echo "== creek lots (base: v1c, the curvy creeks)"
node "$LAB/lab/cmp.ts" "$OUT/creek-v1c.json" "$OUT"/creek-v2.json "$OUT"/creek-v1c-125.json "$OUT"/creek-v1c-150.json "$OUT"/creek-v1d.json
