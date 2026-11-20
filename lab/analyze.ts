// Compares two greedy sim runs on the same seeds (base and branch), overall and by each seed's
// lot as the branch draws it: its kind, biome, creek and traits.
// node analyze.ts <base-worktree> <branch-worktree> <base.json> <branch.json>
import { readFileSync } from 'node:fs';

const [baseDir, branchDir, baseJson, branchJson] = process.argv.slice(2) as [string, string, string, string];
type Rec = { seed: string; client: string; result: 'won' | 'lost'; weekly: number[]; cleared: number };
const read = (f: string): Rec[] => {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  return Array.isArray(j) ? j : j.greedy ?? Object.values(j)[0];
};
const base = read(baseJson);
const branch = read(branchJson);
const byKey = (r: Rec) => `${r.seed}|${r.client}`;
const baseMap = new Map(base.map((r) => [byKey(r), r]));

const C = (await import(`${branchDir}/src/content/index.ts`)).CONTENT;
const L = await import(`${branchDir}/src/rules/lot.ts`);
const OC = (await import(`${baseDir}/src/content/index.ts`)).CONTENT;
const OL = await import(`${baseDir}/src/rules/lot.ts`);
const firstSeed = C.balance.jobBoard.firstSeed;

type Tally = { n: number; bw: number; nw: number; both: number; baseOnly: number; branchOnly: number; bs: number; ns: number; bc: number; nc: number; same: number };
const groups = new Map<string, Tally>();
const add = (g: string, b: Rec, n: Rec) => {
  const t = groups.get(g) ?? { n: 0, bw: 0, nw: 0, both: 0, baseOnly: 0, branchOnly: 0, bs: 0, ns: 0, bc: 0, nc: 0, same: 0 };
  t.n++;
  const bw = b.result === 'won';
  const nw = n.result === 'won';
  if (bw) t.bw++;
  if (nw) t.nw++;
  if (bw && nw) t.both++;
  else if (bw) t.baseOnly++;
  else if (nw) t.branchOnly++;
  t.bs += b.weekly[b.weekly.length - 1] ?? 0;
  t.ns += n.weekly[n.weekly.length - 1] ?? 0;
  t.bc += b.cleared;
  t.nc += n.cleared;
  if (b.result === n.result && b.weekly.join() === n.weekly.join()) t.same++;
  groups.set(g, t);
};
let unpaired = 0;
let kindMoved = 0;
for (const n of branch) {
  const b = baseMap.get(byKey(n));
  if (!b) {
    unpaired++;
    continue;
  }
  const plain = n.seed === firstSeed;
  const lot = L.generateLot(n.seed, C.balance.lot, { plain });
  const old = OL.generateLot(n.seed, OC.balance.lot, { plain });
  if ((lot.kind ?? '') !== (old.kind ?? '')) kindMoved++;
  const creek = lot.terrain.includes('creek');
  const drewCreek = creek || old.terrain.includes('creek');
  add('all', b, n);
  add(`kind ${lot.kind ?? 'plain'}`, b, n);
  add(`biome ${L.lotBiome(lot)}`, b, n);
  add(creek ? 'creek on the lot' : 'no creek on the lot', b, n);
  add(drewCreek ? 'drawn with a creek (redrawn)' : 'drawn without a creek (only water moved)', b, n);
  const traits = L.lotTraits(C, lot).map((t: { id: string }) => t.id);
  for (const id of traits) add(`trait ${id}`, b, n);
  if (traits.length === 0) add('trait none', b, n);
}
const pct = (k: number, n: number) => `${((100 * k) / n).toFixed(1)}%`;
console.log(`paired runs ${groups.get('all')?.n ?? 0}, unpaired ${unpaired}, kind moved ${kindMoved}`);
console.log('group'.padEnd(44), 'runs', '  base', 'branch', 'both', '+base', '+branch', ' base Wow', 'branch Wow', 'base cleared', 'branch cleared', 'same');
for (const [g, t] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(
    g.padEnd(44),
    String(t.n).padStart(4),
    pct(t.bw, t.n).padStart(6),
    pct(t.nw, t.n).padStart(6),
    String(t.both).padStart(4),
    String(t.baseOnly).padStart(5),
    String(t.branchOnly).padStart(7),
    String(Math.round(t.bs / t.n)).padStart(9),
    String(Math.round(t.ns / t.n)).padStart(10),
    (t.bc / t.n).toFixed(2).padStart(12),
    (t.nc / t.n).toFixed(2).padStart(14),
    String(t.same).padStart(4),
  );
}
