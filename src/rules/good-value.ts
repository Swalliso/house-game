// What a piece or a tool is worth (D-193): the parts of pieceValue() and toolValue() (run.ts)
// that read content and put a line into words, by kind and never by id, so a retuned piece or a
// new tool is valued and worded without a change here.
//
// - rhythmOf: how often a piece's rhythm pays (the Pool's every 3rd week), for its line.
// - payingDef: a rhythm piece as if it paid this week, to rank its spots by the weeks it pays.
// - setNeeds: what a Remodel Plan for a set the house doesn't hold is waiting for.
// - timersNote: what a Fertilizer would bring forward in this house.
// - copyNote: what a Copy Machine would copy here.
// - clearNote: what a Dumpster's demolitions could clear on this lot.
// - oneAWeekNeeds: what a second Photo Shoot waits for in a week that has one (D-210).
// - NO_NUMBER: why the tools whose worth hangs on a later choice have no number.

import type {
  Content,
  Effect,
  HouseState,
  PieceDef,
  PieceId,
  SetId,
  SetProgress,
  Tally,
  ToolUse,
} from './index.ts';
import { shapeCells } from './grid.ts';
import { protectedTerrain } from './lot.ts';
import { ageOf } from './scoring.ts';
import { article, countedNames, plural } from './text.ts';

/** An effect with any condition around it taken off. */
function inner(effect: Effect): Effect {
  return effect.kind === 'conditional' ? inner(effect.effect) : effect;
}

/** How often a piece's rhythm pays (every 3rd week), the shortest if it has two; null if none. */
export function rhythmOf(def: PieceDef): number | null {
  let every: number | null = null;
  for (const e of def.effects) {
    const r = inner(e);
    if (r.kind === 'rhythm' && r.every > 1 && (every === null || r.every < every)) every = r.every;
  }
  return every;
}

/**
 * The piece as if its rhythm paid this week (the Pool's +12 as a steady +12), for ranking its
 * spots by the weeks it pays: the estimate counts a rhythm only in a week it pays, and in the
 * others a Pool's own Wow can't drop below nothing, so every spot looks alike. Null with none.
 */
export function payingDef(def: PieceDef): PieceDef | null {
  if (rhythmOf(def) === null) return null;
  const pay = (e: Effect): Effect =>
    e.kind === 'conditional'
      ? { ...e, effect: pay(e.effect) }
      : e.kind === 'rhythm' && e.every > 1
        ? { kind: 'steady', amount: e.amount }
        : e;
  return { ...def, effects: def.effects.map(pay) };
}

/**
 * What a Remodel Plan for a set the house doesn't hold is waiting for: "No Entertainer yet", and
 * for a set whose members needn't touch, how far the house is: "No Full House yet: 7 of 9
 * built".
 */
export function setNeeds(content: Content, set: SetId, progress: SetProgress | null): string {
  const none = `No ${content.sets[set].name} yet`;
  return progress && progress.have > 0
    ? `${none}: ${progress.have} of ${progress.need} built`
    : none;
}

/**
 * What a Fertilizer used in week `week` would bring forward: the piece it changes soonest,
 * "Your Sapling becomes a Tree the week after you use it", "Your Sapling becomes 3 Trees 2 weeks
 * sooner" (a pack's tiles each become one, D-195), or "Your 2 Saplings become Trees 2 weeks
 * sooner". A piece changes at a week's start, so the soonest is the week after it's used.
 * `grows` says the week's tally would rise with it (a granted growth timer): then that's the
 * line. Otherwise there's nothing on the lot for it yet.
 */
export function timersNote(
  content: Content,
  house: HouseState,
  week: number,
  weeks: number,
  grows: boolean,
): string {
  let best: {
    defId: PieceId;
    into: string;
    /** Tiles that each become a feature: a Sapling pack's 1 to 3 Trees (D-195). */
    tiles: number;
    at: number;
    sooner: number;
  } | null = null;
  let count = 0;
  for (const piece of house.pieces) {
    const def = content.pieces[piece.defId];
    const t = def.effects.find((e) => e.kind === 'transform');
    if (t?.kind !== 'transform') continue;
    const age = ageOf(piece, week);
    const now = week + Math.max(1, t.afterWeeks - age);
    const at = week + Math.max(1, t.afterWeeks - age - weeks);
    if (at >= now) continue;
    const into =
      'piece' in t.into ? content.pieces[t.into.piece].name : content.features[t.into.feature].name;
    const tiles = 'feature' in t.into ? shapeCells(piece.shape ?? def.shape, 0).length : 1;
    if (best && best.defId === piece.defId && best.at === at) {
      count++;
    } else if (!best || at < best.at) {
      best = { defId: piece.defId, into, tiles, at, sooner: now - at };
      count = 1;
    }
  }
  if (best) {
    const name = content.pieces[best.defId].name;
    const when =
      best.at === week + 1
        ? 'the week after you use it'
        : best.sooner === 1
          ? 'a week sooner'
          : `${best.sooner} weeks sooner`;
    if (count > 1) return `Your ${count} ${plural(name)} become ${plural(best.into)} ${when}`;
    const what = best.tiles > 1 ? `${best.tiles} ${plural(best.into)}` : article(best.into);
    return `Your ${name} becomes ${what} ${when}`;
  }
  if (grows) return `Every growing piece here jumps ${weeks} weeks ahead`;
  return 'Nothing here grows or changes yet';
}

/**
 * What a Copy Machine would copy here: the piece earning the most this week that it can copy (a
 * household member's room can't be copied, D-103).
 */
export function copyNote(content: Content, tally: Tally, house: HouseState): string {
  const defOf = new Map(house.pieces.map((p) => [p.uid, content.pieces[p.defId]]));
  let top: { name: string; earned: number } | null = null;
  for (const p of tally.pieces) {
    const def = defOf.get(p.uid);
    if (!def || def.member || def.addition) continue;
    if (!top || p.earned > top.earned) top = { name: def.name, earned: p.earned };
  }
  if (!top) return 'Nothing built to copy yet';
  return top.earned > 0 ? `Your top earner to copy: your ${top.name}` : 'Nothing here earns yet';
}

/** What a Dumpster's demolitions could clear on this lot: its Boulders and the Old Shed. */
export function clearNote(content: Content, house: HouseState): string {
  const kept = protectedTerrain(content, house.lot);
  let boulders = 0;
  let shed = false;
  for (const t of house.lot.terrain) {
    if (t === 'boulder' && !kept.has('boulder')) boulders++;
    else if (t === 'oldShed' && !kept.has('oldShed')) shed = true;
  }
  const names: string[] = Array<string>(boulders).fill(content.features.boulder.name);
  if (shed) names.push(`the ${content.features.oldShed.name}`);
  if (names.length === 0) return 'Nothing in the way on your lot';
  return `On your lot to clear: ${countedNames(names)}`;
}

/**
 * D-210: what a ×Mult tool waits for in a week that has one already, where it can't be used (a
 * second Photo Shoot): "Waits for next week: this week has a Photo Shoot". In the run's last
 * week, with no week after it, only why.
 */
export function oneAWeekNeeds(name: string, weeksAfter: boolean): string {
  return weeksAfter
    ? `Waits for next week: this week has ${article(name)}`
    : `This week already has its ${name}`;
}

/**
 * Why a tool has no number: what it's worth hangs on a choice made when it's used (the hand that
 * week, where a piece goes).
 */
export const NO_NUMBER: Readonly<Record<'extraPlay' | 'specialHand' | 'move', string>> = {
  extraPlay: 'Worth one more card from that week’s hand',
  specialHand: 'Worth what its hand of special pieces holds',
  move: 'Worth what a better spot gives a piece',
} satisfies Partial<Record<ToolUse['kind'], string>>;
