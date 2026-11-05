// Weighted hands (D-043, D-055): `handSize` distinct cards, each piece's draw weight scaled by
// its complexity's percentage for the phase, so simple pieces show up more early in a run.
// Each hand has its own stream, `draw/<phase>/<slot>/<n>` (an overtime week's slot is
// `ot<k>`), so a reroll, a redraw, or an extra week never shifts any later hand.

import type { Card, Content } from './index.ts';
import { stream } from './rng.ts';

export function drawWeights(content: Content, phase: number): { card: Card; weight: number }[] {
  const table = content.balance.complexityPct;
  const row = table[Math.min(phase, table.length - 1)]!;
  const out: { card: Card; weight: number }[] = [];
  for (const def of Object.values(content.pieces)) {
    if (def.fromPhase > phase) continue;
    // Weights in hundredths (drawWeight × percent), so nothing rounds away: a weight-10
    // complexity-3 piece at 5% stays drawable, just rarely (D-055).
    const weight = def.drawWeight * row[def.complexity - 1]!;
    if (weight > 0) out.push({ card: { kind: 'piece', id: def.id }, weight });
  }
  return out;
}

/** The slot part of a draw key: the week within the phase, or `ot<k>` for an overtime week. */
export function slotKey(slot: number, overtimeWeek: number): string {
  return overtimeWeek > 0 ? `ot${overtimeWeek}` : String(slot);
}

export function drawKey(phase: number, slot: string, n: number): string {
  return `draw/${phase}/${slot}/${n}`;
}

/** A hand of distinct cards, weighted, without replacement. Shorter if the pool is smaller. */
export function drawHand(
  content: Content,
  seed: string,
  phase: number,
  slot: string,
  n: number,
  handSize: number,
): Card[] {
  const rng = stream(seed, drawKey(phase, slot, n));
  const pool = drawWeights(content, phase);
  const hand: Card[] = [];
  while (hand.length < handSize && pool.length > 0) {
    let total = 0;
    for (const p of pool) total += p.weight;
    let r = rng.int(total);
    let i = 0;
    while (r >= pool[i]!.weight) {
      r -= pool[i]!.weight;
      i++;
    }
    hand.push(pool[i]!.card);
    pool.splice(i, 1);
  }
  return hand;
}
