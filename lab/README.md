Scratch for D-191's sim check (not for develop): greedy on hold-0..1999's creek and pond lots,
develop against the natural-water variants. `bash lab/run-all.sh <repo> <out-dir>`.

- v1: the first natural water (66e4c71), as the full sim check ran it.
- v2: this branch's src/rules/lot.ts: back-edge creeks bend round between straight reaches,
  creeks across drop two rows where they turn steeply, and leaning round ponds.
- v1c: v1's creeks with v2's ponds. v1c-125 and v1c-150: Creekside earns +125% and +150%.
- v1d: v1c with its back-edge creeks reaching their side 11 rows down or more.
