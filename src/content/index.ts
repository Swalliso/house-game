// The content registry and validateContent() (implementation-plan.md §5): the checks types
// can't make. DATA ONLY lives in the other files here.

import type { Content, PieceId, Selector } from '../rules/index.ts';
import { isConnected, parseShape } from '../rules/grid.ts';
import { cardText } from '../rules/text.ts';
import { BALANCE } from './balance.ts';
import { FEATURES } from './features.ts';
import { PIECES } from './pieces.ts';
import { SETS } from './sets.ts';

export { SCORE_LABELS } from './labels.ts';

export const CONTENT: Content = {
  pieces: PIECES,
  features: FEATURES,
  sets: SETS,
  balance: BALANCE,
};

function selectorPieceIds(sel: Selector, out: PieceId[]): void {
  if (sel === 'all') return;
  if ('piece' in sel) out.push(...(typeof sel.piece === 'string' ? [sel.piece] : sel.piece));
  else if ('any' in sel) sel.any.forEach((s) => selectorPieceIds(s, out));
  else if ('all' in sel) sel.all.forEach((s) => selectorPieceIds(s, out));
  else if ('not' in sel) selectorPieceIds(sel.not, out);
}

/** Problems with the content, as readable strings; empty when it's fine. */
export function validateContent(content: Content): string[] {
  const problems: string[] = [];
  const pieceIds = new Set(Object.keys(content.pieces));
  const known = (id: string, where: string) => {
    if (!pieceIds.has(id)) problems.push(`${where}: unknown piece "${id}"`);
  };

  for (const [key, def] of Object.entries(content.pieces)) {
    const where = `piece ${key}`;
    if (def.id !== key) problems.push(`${where}: id is "${def.id}"`);
    if (def.shape.some((row) => row.length !== def.shape[0]!.length)) {
      problems.push(`${where}: shape rows differ in length`);
    }
    let cells: ReturnType<typeof parseShape> = [];
    try {
      cells = parseShape(def.shape);
    } catch (e) {
      problems.push(`${where}: ${(e as Error).message}`);
    }
    if (!isConnected(cells)) problems.push(`${where}: shape isn't one connected polyomino`);
    if (def.countsAs) known(def.countsAs, `${where} countsAs`);
    if (!Number.isInteger(def.drawWeight) || def.drawWeight < 0) {
      problems.push(`${where}: drawWeight must be a whole number ≥ 0`);
    }
    for (const effect of def.effects) {
      if (effect.kind === 'steady') continue;
      const ids: PieceId[] = [];
      selectorPieceIds(effect.match, ids);
      ids.forEach((id) => known(id, `${where} effect`));
      if (effect.kind === 'aura' && !effect.pct && !effect.amount) {
        problems.push(`${where}: an aura needs pct or amount`);
      }
    }
    const text = cardText(content, def);
    if (
      text.effects.length !== def.effects.length ||
      text.effects.some((t) => !t || t.includes('undefined'))
    ) {
      problems.push(`${where}: card text didn't generate`);
    }
  }

  for (const [key, def] of Object.entries(content.features)) {
    if (def.id !== key) problems.push(`feature ${key}: id is "${def.id}"`);
  }

  for (const [key, set] of Object.entries(content.sets)) {
    const where = `set ${key}`;
    if (set.id !== key) problems.push(`${where}: id is "${set.id}"`);
    const members = Object.entries(set.members);
    if (members.length === 0) problems.push(`${where}: no members`);
    for (const [id, n] of members) {
      known(id, where);
      if (!Number.isInteger(n) || n! < 1) problems.push(`${where}: ${id} needs a count ≥ 1`);
    }
    if (set.hub && set.members[set.hub] !== 1)
      problems.push(`${where}: the hub must be a member, once`);
  }

  const b = content.balance;
  if (b.phases.length === 0) problems.push('balance: no phases');
  b.phases.forEach((p, i) => {
    if (i > 0 && p.target <= b.phases[i - 1]!.target)
      problems.push(`balance: target ${i + 1} doesn't rise`);
  });
  if (b.complexityPct.length === 0 || b.complexityPct.some((row) => row.length !== 3)) {
    problems.push('balance: complexityPct needs rows of three');
  }
  const drawable = Object.values(content.pieces).filter(
    (p) => p.drawWeight > 0 && p.fromPhase === 0,
  );
  if (drawable.length < b.handSize) problems.push('balance: fewer drawable cards than a hand');
  if (b.weeksPerPhase < 1 || b.handSize < 1)
    problems.push('balance: weeks and hand size must be ≥ 1');
  const v = b.verdicts;
  if (v.length === 0 || v[0]!.minPctOfTarget !== 0)
    problems.push('balance: the first verdict starts at 0%');
  return problems;
}
