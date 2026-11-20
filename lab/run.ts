// Greedy on a list of seeds with <root>'s rules; optional Creekside/Pondside earn pct overrides.
// node run.ts <root> <seeds.json> <out.json> [creekPct] [pondPct]
import { readFileSync, writeFileSync } from 'node:fs';
const [root, seedsFile, out, creekPct, pondPct] = process.argv.slice(2) as [string, string, string, string?, string?];
const { CONTENT, createRules } = await import(`${root}/src/rules/index.ts`);
const { simulateRun } = await import(`${root}/sim/simulate.ts`);
const { makeGreedy } = await import(`${root}/sim/policies/index.ts`);
const bump = (id: string, pct: string | undefined, content: any) => {
  if (!pct) return content;
  const t = content.lotTraits[id];
  const modifiers = t.modifiers.map((m: any) => (m.kind === 'earn' ? { ...m, pct: Number(pct) } : m));
  return { ...content, lotTraits: { ...content.lotTraits, [id]: { ...t, modifiers } } };
};
const content = bump('pondside', pondPct, bump('creekside', creekPct, CONTENT));
const rules = createRules(content);
const clients = Object.values(CONTENT.clients).filter((c: any) => c.tier === 'core').map((c: any) => c.id);
const seeds: { seed: string; i: number }[] = JSON.parse(readFileSync(seedsFile, 'utf8'));
const policy = makeGreedy({});
const recs: any[] = [];
const t0 = performance.now();
for (const { seed, i } of seeds) {
  const { record } = simulateRun(rules, seed, policy, { clientId: clients[i % clients.length], crewId: 'generalContractor' });
  recs.push({ seed, client: record.client ?? clients[i % clients.length], result: record.result, final: record.weekly[record.weekly.length - 1] ?? 0, cleared: record.cleared });
}
writeFileSync(out, JSON.stringify(recs));
const won = recs.filter((r) => r.result === 'won').length;
console.log(out.split('/').pop(), 'runs', recs.length, 'won', won, `${((100 * won) / recs.length).toFixed(1)}%`, 'mean final', Math.round(recs.reduce((s, r) => s + r.final, 0) / recs.length), `${((performance.now() - t0) / recs.length).toFixed(0)} ms/run`);
