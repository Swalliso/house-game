#!/bin/bash
# D-191 lab: greedy on hold-* creek and pond lots, develop against the water variants.
# Run from the lab worktree's root: bash lab/run-all.sh <repo> <out-dir>
#   <repo>: a clone to make detached worktrees from (it is only read: git worktree add)
set -euo pipefail
REPO=$1
OUT=$2
LAB=$(pwd)
mkdir -p "$OUT"
git -C "$REPO" fetch -q origin develop phase/natural-water
DEV=/tmp/hg191-lab-dev; V1=/tmp/hg191-lab-v1; V1C=/tmp/hg191-lab-v1c; V1D=/tmp/hg191-lab-v1d
[ -d "$DEV" ] || git -C "$REPO" worktree add -q --detach "$DEV" origin/develop
[ -d "$V1" ] || git -C "$REPO" worktree add -q --detach "$V1" 66e4c71
for v in v1c v1d; do
  d=/tmp/hg191-lab-$v
  [ -d "$d" ] || git -C "$REPO" worktree add -q --detach "$d" "$(git -C "$LAB" rev-parse HEAD)"
  cp "$LAB/lab/lot.$v.ts" "$d/src/rules/lot.ts"
done
R="node $LAB/lab/run.ts"
C=$LAB/lab/creek-seeds.json
P=$LAB/lab/pond-seeds.json
$R "$DEV" "$C" "$OUT/creek-dev.json"
$R "$LAB" "$C" "$OUT/creek-v2.json"
$R "$V1C" "$C" "$OUT/creek-v1c.json"
$R "$V1C" "$C" "$OUT/creek-v1c-125.json" 125
$R "$V1C" "$C" "$OUT/creek-v1c-150.json" 150
$R "$V1D" "$C" "$OUT/creek-v1d.json"
$R "$DEV" "$P" "$OUT/pond-dev.json"
$R "$V1" "$P" "$OUT/pond-v1.json"
$R "$LAB" "$P" "$OUT/pond-v2.json"
echo "== creek lots (base: develop)"
node "$LAB/lab/cmp.ts" "$OUT/creek-dev.json" "$OUT"/creek-v2.json "$OUT"/creek-v1c.json "$OUT"/creek-v1c-125.json "$OUT"/creek-v1c-150.json "$OUT"/creek-v1d.json
echo "== pond lots (base: develop)"
node "$LAB/lab/cmp.ts" "$OUT/pond-dev.json" "$OUT"/pond-v1.json "$OUT"/pond-v2.json
