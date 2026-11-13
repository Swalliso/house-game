// Weighted hands (D-043, D-055): distinct cards, each piece's draw weight scaled by
// its complexity's percentage for the phase, so simple pieces show up more early in a run.
// Fixtures join from their `fromPhase` at their own weight (D-050), and struck card types
// (D-076) never come up again. A type at its limit in the client's checklist (one Kitchen,
// at most two Living Rooms, …) draws at `drawAtLimitPct` of its weight (D-093's half-weight
// draws, amending D-043): the draw reads the house only through that. A hand is two rows
// (D-121), Rooms and Layout, each drawn from its own cards on its own stream,
// `draw/<phase>/<slot>/<n>/<row>` (an overtime week's slot is `ot<k>`), so a reroll, a swap,
// or an extra week never shifts any later hand, and drawing one row never shifts the other: a
// strike changes the pool, never the stream. A strike from the hand (D-157) draws each card it
// replaces on a stream of its own, `.../<row>/strike<m>/<k>`. A reroll (D-132) leaves out the
// cards each row holds, and its swaps the cards it replaced, while enough others remain. A
// member's room (M4b, D-103) is never drawn, not even by the Catalog: it arrives with its member.

import type { Card, CardType, Content, DrawRow, Modifier, PieceDef, PieceId } from './index.ts';
import { stream, type Rng } from './rng.ts';
import { matchesDef, rootType } from './selectors.ts';

/** Rooms first: the hand's order, and the right column's. */
export const DRAW_ROWS: readonly DrawRow[] = ['rooms', 'layout'];

/**
 * A card's row (D-121): where it's built. Rooms: indoor pieces that aren't connectors, and the
 * fixtures that go in them. Layout: the yard, outbuildings, Hallways, and what a def names
 * Layout itself (the Garage, the yard's fixtures).
 */
export function rowOf(content: Content, card: Card): DrawRow {
  if (card.kind === 'fixture') return content.fixtures[card.id]?.row ?? 'rooms';
  const def = content.pieces[card.id];
  if (!def) return 'rooms';
  return def.row ?? (def.category === 'indoor' && !def.connector ? 'rooms' : 'layout');
}

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

/**
 * A lot card (D-166): a Layout piece that reads the lot, so the yard pieces, the outbuildings
 * and the Garage. The Hallways (connectors) and the Fence (a wall) are build-arounds that read
 * the house, and keep D-055's ramp in every run.
 */
export function isLotCard(content: Content, def: PieceDef): boolean {
  return rowOf(content, { kind: 'piece', id: def.id }) === 'layout' && !def.connector && !def.wall;
}

export interface DrawOptions {
  struck?: readonly CardType[];
  /** The run's modifiers; only `drawWeight` ones count. */
  mods?: readonly Modifier[];
  /** The Catalog (M3b): special pieces and drawable fixtures, at equal weight. */
  special?: boolean;
  /** Root types at their limit in the checklist: they draw at `drawAtLimitPct` of their weight. */
  atLimit?: ReadonlySet<PieceId>;
  /** Only this row's cards (D-121); unset, every card. */
  row?: DrawRow;
  /** Lot cards at full weight, outside D-055's ramp (D-166: a standard run's draw). */
  lotCardsFull?: boolean;
  /**
   * A reroll's (D-132): the cards it replaces. They're left out while enough others remain;
   * when too few do, the rest are drawn from them. The pool's weights don't change.
   */
  held?: readonly Card[];
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
    if (opts.row && rowOf(content, card) !== opts.row) continue;
    if (isStruck(content, struck, card)) continue;
    let weight: number;
    if (opts.special) {
      weight = def.drawWeight === 0 ? 100 : 0;
    } else {
      // Weights in hundredths (drawWeight × percent), so nothing rounds away: a weight-10
      // complexity-3 piece at 5% stays drawable, just rarely (D-055). A standard run's lot
      // cards skip the ramp (D-166).
      const pct = opts.lotCardsFull && isLotCard(content, def) ? 100 : row[def.complexity - 1]!;
      weight = weighted(def, def.drawWeight, mods) * pct;
    }
    if (opts.atLimit?.has(rootType(def))) {
      weight = Math.floor((weight * content.balance.drawAtLimitPct) / 100);
    }
    if (weight > 0) out.push({ card, weight });
  }
  for (const def of Object.values(content.fixtures)) {
    if (def.fromPhase > phase || def.drawWeight === 0) continue;
    const card: Card = { kind: 'fixture', id: def.id };
    if (opts.row && rowOf(content, card) !== opts.row) continue;
    if (isStruck(content, struck, card)) continue;
    out.push({ card, weight: opts.special ? 100 : def.drawWeight * 100 });
  }
  return out;
}

/** The slot part of a draw key: the week within the phase, or `ot<k>` for an overtime week. */
export function slotKey(slot: number, overtimeWeek: number): string {
  return overtimeWeek > 0 ? `ot${overtimeWeek}` : String(slot);
}

/** A draw's stream key; a row's draw adds the row (D-121). */
export function drawKey(phase: number, slot: string, n: number, row?: DrawRow): string {
  return row ? `draw/${phase}/${slot}/${n}/${row}` : `draw/${phase}/${slot}/${n}`;
}

/** The stream for the swaps into a row's k-th card (D-121): its draw's key, then `swap<k>`. */
export function swapKey(phase: number, slot: string, n: number, row: DrawRow, k: number): string {
  return `${drawKey(phase, slot, n, row)}/swap${k}`;
}

/**
 * The stream for a strike's draw into a row's k-th card (D-157): the hand's draw's key, then
 * `strike<m>/<k>`, m counting the run's struck types (this one included).
 */
export function strikeKey(
  phase: number,
  slot: string,
  n: number,
  row: DrawRow,
  m: number,
  k: number,
): string {
  return `${drawKey(phase, slot, n, row)}/strike${m}/${k}`;
}

type Pool = { card: Card; weight: number }[];

/** Up to `count` distinct cards from a weighted pool, without replacement. */
function pickDistinct(rng: Rng, pool: Pool, count: number): Card[] {
  const out: Card[] = [];
  while (out.length < count && pool.length > 0) {
    let total = 0;
    for (const p of pool) total += p.weight;
    let r = rng.int(total);
    let i = 0;
    while (r >= pool[i]!.weight) {
      r -= pool[i]!.weight;
      i++;
    }
    out.push(pool[i]!.card);
    pool.splice(i, 1);
  }
  return out;
}

const sameCard = (a: Card, b: Card) => a.kind === b.kind && a.id === b.id;
const holds = (cards: readonly Card[], card: Card) => cards.some((c) => sameCard(c, card));

/**
 * Up to `count` distinct cards from a weighted pool, leaving out the `held` ones (D-132) while
 * enough others remain; when too few do, the rest are drawn from the held ones in the pool, on
 * the same stream. With none held, a plain draw.
 */
function pickFresh(rng: Rng, pool: Pool, count: number, held: readonly Card[] = []): Card[] {
  const others = pool.filter((p) => !holds(held, p.card));
  const out = pickDistinct(rng, others, count);
  if (out.length < count) {
    const back = pool.filter((p) => holds(held, p.card));
    out.push(...pickDistinct(rng, back, count - out.length));
  }
  return out;
}

/**
 * A hand of distinct cards, weighted, without replacement. Shorter if the pool is smaller.
 * With `opts.row`, one row of the hand, on that row's stream (D-121); with `opts.held`, a
 * reroll's row, leaving out the cards it replaces while enough others remain (D-132).
 */
export function drawHand(
  content: Content,
  seed: string,
  phase: number,
  slot: string,
  n: number,
  size: number,
  opts: DrawOptions = {},
): Card[] {
  const rng = stream(seed, drawKey(phase, slot, n, opts.row));
  return pickFresh(rng, drawWeights(content, phase, opts), size, opts.held);
}

/**
 * The cards that can be swapped into a row's k-th card, in the order they're tried (D-121):
 * up to `tries` distinct cards from the row's pool, leaving out every card in `exclude` (the
 * row as it stands, the card being replaced among them). In a reroll's swaps, the cards the
 * reroll replaced (`opts.held`) are left out too while enough others remain (D-132).
 */
export function swapCandidates(
  content: Content,
  seed: string,
  phase: number,
  slot: string,
  n: number,
  k: number,
  tries: number,
  exclude: readonly Card[],
  opts: DrawOptions & { row: DrawRow },
): Card[] {
  const rng = stream(seed, swapKey(phase, slot, n, opts.row, k));
  const pool = drawWeights(content, phase, opts).filter((p) => !holds(exclude, p.card));
  return pickFresh(rng, pool, tries, opts.held);
}

/**
 * The cards a strike from the hand can draw into a row's k-th card (D-157), in the order
 * they're tried: up to `tries` distinct cards from the row's pool (the struck type is out of it
 * already), leaving out every card in `exclude` (the row as it stands), on the strike's own
 * stream, so it never shifts another draw.
 */
export function strikeCandidates(
  content: Content,
  seed: string,
  phase: number,
  slot: string,
  n: number,
  m: number,
  k: number,
  tries: number,
  exclude: readonly Card[],
  opts: DrawOptions & { row: DrawRow },
): Card[] {
  const rng = stream(seed, strikeKey(phase, slot, n, opts.row, m, k));
  const pool = drawWeights(content, phase, opts).filter((p) => !holds(exclude, p.card));
  return pickDistinct(rng, pool, tries);
}

/**
 * Every card type that can come up in the weekly draw at some point in the run, by its root
 * type: what a strike can name, and what its floor counts. With `row`, only that row's. With
 * the run's modifiers, a special piece a client or crew puts in the draw counts too (the
 * Architect's Library, D-157); without them, only the base pool's.
 */
export function drawableTypes(
  content: Content,
  struck: readonly CardType[] = [],
  row?: DrawRow,
  mods: readonly Modifier[] = [],
): CardType[] {
  const out: CardType[] = [];
  const seen = new Set<string>();
  for (const def of Object.values(content.pieces)) {
    if (def.member || weighted(def, def.drawWeight, mods) === 0) continue;
    const root = rootType(def);
    if (seen.has(root)) continue;
    seen.add(root);
    const t: CardType = { kind: 'piece', id: root };
    if (row && rowOf(content, t) !== row) continue;
    if (!isStruck(content, struck, t)) out.push(t);
  }
  for (const def of Object.values(content.fixtures)) {
    if (def.drawWeight === 0) continue;
    const t: CardType = { kind: 'fixture', id: def.id };
    if (row && rowOf(content, t) !== row) continue;
    if (!isStruck(content, struck, t)) out.push(t);
  }
  return out;
}
