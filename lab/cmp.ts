// Paired comparison of arm files against a base: win rate, discordant pairs, mean log score ratio (with SE).
// node cmp.ts base.json arm.json [arm.json ...]
import { readFileSync } from 'node:fs';
const [baseF, ...arms] = process.argv.slice(2);
const read = (f: string) => new Map((JSON.parse(readFileSync(f, 'utf8')) as any[]).map((r) => [r.seed, r]));
const base = read(baseF!);
for (const f of arms) {
  const arm = read(f);
  let n = 0, bw = 0, aw = 0, bo = 0, ao = 0, sum = 0, sq = 0;
  for (const [seed, a] of arm) {
    const b = base.get(seed); if (!b) continue;
    n++; if (b.result === 'won') bw++; if (a.result === 'won') aw++;
    if (b.result === 'won' && a.result !== 'won') bo++; if (a.result === 'won' && b.result !== 'won') ao++;
    const d = Math.log(Math.max(1, a.final) / Math.max(1, b.final)); sum += d; sq += d * d;
  }
  const m = sum / n, sd = Math.sqrt(sq / n - m * m), se = sd / Math.sqrt(n);
  console.log(f.split('/').pop()!.padEnd(22), 'n', n, 'base', `${((100 * bw) / n).toFixed(1)}%`, 'arm', `${((100 * aw) / n).toFixed(1)}%`, `+base ${bo} +arm ${ao}`, 'score ratio', `${((Math.exp(m) - 1) * 100).toFixed(1)}% ± ${(se * 100).toFixed(1)}`);
}
