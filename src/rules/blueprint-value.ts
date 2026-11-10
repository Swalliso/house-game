// What a blueprint is worth (D-141): the parts of blueprintValue() (run.ts) that read a
// blueprint's modifiers, by kind and never by blueprint id, so a retuned blueprint or a new one
// is valued and worded without a change here.
//
// - scoresWeek: whether a modifier can change a week's tally at all. A blueprint with none
//   (one that only changes a run rule the tally doesn't read) isn't valued.
// - lastWeekOnly, grows: how the weekly gain moves, for the line's wording.
// - scalingStat: a ×Mult that scales with a run stat (Ahead of Schedule's early milestones).
// - blueprintNeeds: when a blueprint would add nothing in the weeks left, what it's waiting
//   for, in a few words ("No Dark rooms yet", "Green pieces here earn too little yet"), so its
//   line points at a build.

import type { BlueprintDef, Content, Effect, Modifier, RunStat, Selector, Tally } from './index.ts';
import { pieceDef, type Layout } from './layout.ts';
import { isPieceType, matchesPiece } from './selectors.ts';
import { article, selectorText } from './text.ts';

/** Whether a modifier can change a week's tally: its Wow or its budget. */
export function scoresWeek(mod: Modifier): boolean {
  if (mod.kind === 'drawWeight') return false;
  // The one run rule a tally reads: what each line of the checklist adds (Dream Home).
  if (mod.kind === 'rule') return mod.key === 'specBonus';
  return true;
}

/** Every one of these modifiers acts only in a phase's last week (Last-Minute Push). */
export function lastWeekOnly(mods: readonly Modifier[]): boolean {
  return (
    mods.length > 0 &&
    mods.every((m) => (m.kind === 'earn' || m.kind === 'xMult') && m.when === 'lastWeekOfPhase')
  );
}

/** An effect with any condition around it taken off. */
function inner(effect: Effect): Effect {
  return effect.kind === 'conditional' ? inner(effect.effect) : effect;
}

/** One of these modifiers grants a growth timer (Good Bones): it adds more each week. */
export function grows(mods: readonly Modifier[]): boolean {
  return mods.some((m) => m.kind === 'grantEffect' && inner(m.effect).kind === 'growth');
}

/** The run stat one of these modifiers' ×Mult scales with (Ahead of Schedule), if any. */
export function scalingStat(mods: readonly Modifier[]): RunStat | null {
  for (const m of mods) {
    if (m.kind !== 'xMult' || !m.plusPer) continue;
    const per = m.plusPer.per;
    if (typeof per === 'string' && per !== 'all') return per;
  }
  return null;
}

const STAT_NEEDS: Record<RunStat, string> = {
  milestonesEarly: 'No milestone completed early yet',
};

const NOTHING_EARNING = 'Nothing is earning yet';

/** "Quiet pieces", "Dark rooms", "pieces with a view": a selector's pieces, as a plural noun. */
function piecesText(content: Content, sel: Selector): string {
  if (sel === 'all') return 'pieces';
  return selectorText(content, sel, 'some').replace(/\bneighbors\b/, 'pieces');
}

function count(content: Content, layout: Layout, sel: Selector): number {
  let n = 0;
  for (const p of layout.house.pieces) if (matchesPiece(content, layout, sel, p.uid)) n++;
  return n;
}

/** What one modifier is waiting for in this house, or null if it has what it acts on. */
function modifierNeeds(
  content: Content,
  layout: Layout,
  tally: Tally,
  stats: Readonly<Record<RunStat, number>>,
  mod: Modifier,
): string | null {
  const none = (sel: Selector) =>
    count(content, layout, sel) === 0 ? `No ${piecesText(content, sel)} yet` : null;
  switch (mod.kind) {
    case 'earn':
    case 'earnNothing':
      return none(mod.target);
    case 'budget':
      return mod.target === 'all' ? null : none(mod.target);
    case 'perCountOver':
      return none(mod.match);
    case 'bestPiece':
      return tally.pieces.some((p) => p.earned > 0) ? null : NOTHING_EARNING;
    case 'mult':
      if (mod.per) return none(mod.per);
      return tally.points > 0 ? null : NOTHING_EARNING;
    case 'xMult': {
      const per = mod.plusPer?.per;
      if (per !== undefined) {
        if (typeof per === 'string' && per !== 'all') {
          return stats[per] > 0 ? null : STAT_NEEDS[per];
        }
        const missing = none(per);
        if (missing) return missing;
      }
      return tally.points > 0 ? null : NOTHING_EARNING;
    }
    case 'grantEffect': {
      const missing = none(mod.target);
      if (missing) return missing;
      // A granted neighbor bonus (Country Living) with nothing of its kind next door.
      const effect = inner(mod.effect);
      if (effect.kind !== 'neighbor') return null;
      const what = article(selectorText(content, effect.match, 'one'));
      return `No ${piecesText(content, mod.target)} touching ${what} yet`;
    }
    case 'link': {
      // Open Concept: a group forms where two of its types touch.
      const of = (uid: number) => {
        const def = pieceDef(content, layout.byUid.get(uid)!);
        return mod.among.some((id) => isPieceType(layout, def, uid, id));
      };
      const touch = layout.house.pieces.some(
        (p) =>
          of(p.uid) && layout.touching.get(p.uid)!.some((n) => n.kind === 'piece' && of(n.uid)),
      );
      return touch ? null : 'None of its pieces touch yet';
    }
    case 'setBonus':
      return tally.sets.some((s) => mod.set === undefined || s.set === mod.set)
        ? null
        : `No ${mod.set ? content.sets[mod.set].name : 'set'} yet`;
    case 'rule':
      if (mod.key !== 'specBonus') return null;
      return tally.specs.some((s) => s.met) ? null : 'No checklist line met yet';
    case 'grantTag':
    case 'removeTag':
    case 'grantView':
    case 'blockPenalties':
    case 'countsAs':
      return none(mod.target);
    case 'drawWeight':
      return null;
  }
}

/**
 * What a blueprint that would add nothing is waiting for: the first of its modifiers with
 * nothing to act on says so. If each has something, a percentage says its pieces earn too
 * little for it to show (half of 1 rounds away), and anything else gets a plain line. `layout`
 * and `tally` are the house's with the blueprint in play.
 */
export function blueprintNeeds(
  content: Content,
  def: BlueprintDef,
  layout: Layout,
  tally: Tally,
  stats: Readonly<Record<RunStat, number>>,
): string {
  for (const mod of def.modifiers) {
    if (!scoresWeek(mod)) continue;
    const needs = modifierNeeds(content, layout, tally, stats, mod);
    if (needs) return needs;
  }
  for (const mod of def.modifiers) {
    if (mod.kind !== 'earn' || mod.when) continue;
    const who = piecesText(content, mod.target);
    return `${who.charAt(0).toUpperCase()}${who.slice(1)} here earn too little yet`;
  }
  return 'Adds nothing to your house yet';
}
