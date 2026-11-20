// Writes the hold-* seeds whose lot (as <root> draws it) has a creek, or is a pond lot: [{seed, i}].
// node seeds.ts <root> <N> <creek|pond> <out.json>
import { writeFileSync } from 'node:fs';
const [root, n, what, out] = process.argv.slice(2) as [string, string, string, string];
const { CONTENT } = await import(`${root}/src/content/index.ts`);
const { generateLot } = await import(`${root}/src/rules/lot.ts`);
const list: { seed: string; i: number }[] = [];
for (let i = 0; i < Number(n); i++) {
  const seed = `hold-${i}`;
  const lot = generateLot(seed, CONTENT.balance.lot, { plain: seed === CONTENT.balance.jobBoard.firstSeed });
  const hit = what === 'creek' ? lot.terrain.includes('creek') : lot.kind === 'pond';
  if (hit) list.push({ seed, i });
}
writeFileSync(out, JSON.stringify(list));
console.log(what, list.length, 'of', n);
