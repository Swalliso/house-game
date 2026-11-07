// Weighted hands (D-043, D-055): `handSize` distinct cards, each piece's draw weight scaled by
// its complexity's percentage for the phase, so simple pieces show up more early in a run.
// Fixtures join from their `fromPhase` at their own weight (D-050), and struck card types
// (D-076) never come up again. A type at its limit in the client's checklist (one Kitchen,
// at most two Living Rooms, …) draws at `drawAtLimitPct` of its weight (D-093's half-weight
// draws, amending D-043): the draw reads the house only through that. Each hand has its own stream, `draw/<phase>/<slot>/<n>` (an
// overtime week's slot is `ot<k>`), so a reroll, a redraw, or an extra week never shifts any
// later hand: a strike changes the pool, never the stream. A member's room (M4b, D-099) is
// never drawn, not even by the Catalog: it arrives with its member.

import type { Card, CardType, Content, Modifier, PieceDef, PieceId } from './index.ts';
import { stream } from './rng.ts';
import { matchesDef, rootType } from './selectors.ts';

/** Is this card of a struck type? Shape variants share their type (the L-Kitchen is a Kitchen). */
export function isStruck(content: Content, struck: readonly CardType[], card: Card): boolean {
  if (struck.length === 0) return false;
  if (card.kind === 'fixture') return struck.some((s) => s.kind === 'fixture' && s.id === card.id);
  // An id this content doesn't know (a stale run code) is never struck.
  if (!Object.hasOwn(content.pieces, card.id)) return false;
  const root = rootType(content.pieces[card.id]);
  return struck.some((s) => s.kind === 'piece' && s.id === root);
}

/** `drawWeight` modifiers (clients and crews) on a piece's weight: (w + Σ add) × (100 + Σ pct) / 100. */
function weighted(def: PieceDef, base: number, mods: readonly Modifier[]): number {
  let add = 0;
  let pct = 0;
  for (const m of mods) {
    if (m.kind !== 'drawWeight' || !matchesDef(m.target, def)) continue;
    add += m.add ?? 0;
    pct += m.pct ?? 0;
  }
  if (add === 0 && pct === 0) return base;
  return Math.max(0, Math.floor(((base + add) * Math.max(0, 100 + pct)) / 100));
}

export interface DrawOptions {
  struck?: readonly CardType[];
  /** The run's modifiers; only `drawWeight` ones count. */
  mods?: readonly Modifier[];
  /** The Catalog (M3b): special pieces and drawable fixtures, at equal weight. */
  special?: boolean;
  /** Root types at their limit in the checklist: they draw at `drawAtLimitPct` of their weight. */
  atLimit?: ReadonlySet<PieceId>;
}

export function drawWeights(
  content: Content,
  phase: number,
  opts: DrawOptions = {},
): { card: Card; weight: number }[] {
  const table = content.balance.complexityPct;
  const row = table[Math.min(phase, table.length - 1)]!;
  const struck = opts.struck ?? [];
  const mods = opts.mods ?? [];
  const out: { card: Card; weight: number }[] = [];
  for (const def of Object.values(content.pieces)) {
    if (def.fromPhase > phase || def.member) continue;
    const card: Card = { kind: 'piece', id: def.id };
    if (isStruck(content, struck, card)) continue;
    let weight: number;
    if (opts.special) {
      weight = def.drawWeight === 0 ? 100 : 0;
    } else {
      // Weights in hundredths (drawWeight × percent), so nothing rounds away: a weight-10
      // complexity-3 piece at 5% stays drawable, just rarely (D-055).
      weight = weighted(def, def.drawWeight, mods) * row[def.complexity - 1]!;
    }
    if (opts.atLimit?.has(rootType(def))) {
      weight = Math.floor((weight * content.balance.drawAtLimitPct) / 100);
    }
    if (weight > 0) out.push({ card, weight });
  }
  for (const def of Object.values(content.fixtures)) {
    if (def.fromPhase > phase || def.drawWeight === 0) continue;
    const card: Card = { kind: 'fixture', id: def.id };
    if (isStruck(content, struck, card)) continue;
    out.push({ card, weight: opts.special ? 100 : def.drawWeight * 100 });
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
  opts: DrawOptions = {},
): Card[] {
  const rng = stream(seed, drawKey(phase, slot, n));
  const pool = drawWeights(content, phase, opts);
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

/**
 * Every card type that can come up in the weekly draw at some point in the run, by its root
 * type: what D-076's strike can name, and what its floor counts.
 */
export function drawableTypes(content: Content, struck: readonly CardType[] = []): CardType[] {
  const out: CardType[] = [];
  const seen = new Set<string>();
  for (const def of Object.values(content.pieces)) {
    if (def.drawWeight === 0 || def.member) continue;
    const root = rootType(def);
    if (seen.has(root)) continue;
    seen.add(root);
    const t: CardType = { kind: 'piece', id: root };
    if (!isStruck(content, struck, t)) out.push(t);
  }
  for (const def of Object.values(content.fixtures)) {
    if (def.drawWeight === 0) continue;
    const t: CardType = { kind: 'fixture', id: def.id };
    if (!isStruck(content, struck, t)) out.push(t);
  }
  return out;
}
