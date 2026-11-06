// The content registry and validateContent() (implementation-plan.md §5): the checks types
// can't make. DATA ONLY lives in the other files here.

import type {
  Content,
  Effect,
  Modifier,
  PieceCondition,
  PieceId,
  Selector,
  Tag,
} from '../rules/index.ts';
import { isConnected, parseShape } from '../rules/grid.ts';
import { cardText, modifierText } from '../rules/text.ts';
import { BALANCE } from './balance.ts';
import { BLUEPRINTS } from './blueprints.ts';
import { CREWS } from './crews.ts';
import { FEATURES } from './features.ts';
import { FIXTURES } from './fixtures.ts';
import { PIECES } from './pieces.ts';
import { SETS } from './sets.ts';

export { SCORE_LABELS } from './labels.ts';

export const CONTENT: Content = {
  pieces: PIECES,
  features: FEATURES,
  sets: SETS,
  crews: CREWS,
  fixtures: FIXTURES,
  blueprints: BLUEPRINTS,
  balance: BALANCE,
};

function selectorPieceIds(sel: Selector, out: PieceId[]): void {
  if (sel === 'all' || 'host' in sel || 'hasFixture' in sel) return;
  if ('piece' in sel) out.push(...(typeof sel.piece === 'string' ? [sel.piece] : sel.piece));
  else if ('touching' in sel) selectorPieceIds(sel.touching, out);
  else if ('any' in sel) sel.any.forEach((s) => selectorPieceIds(s, out));
  else if ('all' in sel) sel.all.forEach((s) => selectorPieceIds(s, out));
  else if ('not' in sel) selectorPieceIds(sel.not, out);
}

function conditionPieceIds(cond: PieceCondition, out: PieceId[]): void {
  if ('and' in cond) cond.and.forEach((c) => conditionPieceIds(c, out));
  else if ('or' in cond) cond.or.forEach((c) => conditionPieceIds(c, out));
  else if ('not' in cond) conditionPieceIds(cond.not, out);
  else if ('touching' in cond) selectorPieceIds(cond.touching, out);
  else if ('is' in cond) selectorPieceIds(cond.is, out);
}

/** Problems with one effect, as readable strings. */
function effectProblems(effect: Effect, where: string, nested: boolean): string[] {
  const problems: string[] = [];
  const positiveInt = (n: number | undefined, what: string) => {
    if (n !== undefined && (!Number.isInteger(n) || n < 1))
      problems.push(`${where}: ${what} must be ≥ 1`);
  };
  switch (effect.kind) {
    case 'aura':
      if (!effect.pct && !effect.amount) problems.push(`${where}: an aura needs pct or amount`);
      break;
    case 'rhythm':
      positiveInt(effect.every, 'rhythm every');
      break;
    case 'economy':
      positiveInt(effect.every, 'economy every');
      break;
    case 'transform':
      positiveInt(effect.afterWeeks, 'transform afterWeeks');
      if (nested) problems.push(`${where}: a transform can't be conditional`);
      break;
    case 'link':
    case 'requires':
      if (nested) problems.push(`${where}: a ${effect.kind} can't be conditional`);
      break;
    case 'conditional':
      if (nested) problems.push(`${where}: conditionals don't nest`);
      problems.push(...effectProblems(effect.effect, where, true));
      break;
  }
  return problems;
}

function effectPieceIds(effect: Effect, out: PieceId[]): void {
  if (effect.kind === 'neighbor' || effect.kind === 'aura') selectorPieceIds(effect.match, out);
  else if (effect.kind === 'requires') conditionPieceIds(effect.condition, out);
  else if (effect.kind === 'conditional') {
    conditionPieceIds(effect.when, out);
    effectPieceIds(effect.effect, out);
  } else if (effect.kind === 'transform' && 'piece' in effect.into) out.push(effect.into.piece);
}

/** Does a selector name `{ host: true }` (directly, or as one part of an `all`)? */
function hasHost(sel: Selector): boolean {
  if (sel === 'all') return false;
  if ('host' in sel) return true;
  if ('all' in sel) return sel.all.some(hasHost);
  return false;
}

function selectsTag(sel: Selector, tag: Tag): boolean {
  if (sel === 'all') return false;
  if ('tag' in sel) return sel.tag === tag;
  if ('any' in sel) return sel.any.some((s) => selectsTag(s, tag));
  if ('all' in sel) return sel.all.some((s) => selectsTag(s, tag));
  if ('not' in sel) return selectsTag(sel.not, tag);
  if ('touching' in sel) return selectsTag(sel.touching, tag);
  return false;
}

/** Problems with one modifier; `fixture` means its targets must be the host. */
function modifierProblems(
  content: Content,
  m: Modifier,
  where: string,
  opts: { fixture: boolean; drawWeight: boolean },
): string[] {
  const problems: string[] = [];
  const ids: PieceId[] = [];
  const sels: Selector[] = [];
  switch (m.kind) {
    case 'earn':
    case 'earnNothing':
    case 'grantView':
      sels.push(m.target);
      break;
    case 'grantTag':
    case 'removeTag':
      sels.push(m.target);
      // §4: a modifier can't grant (or remove) the tag it selects on.
      if (selectsTag(m.target, m.tag)) problems.push(`${where}: ${m.kind} selects on ${m.tag}`);
      break;
    case 'blockPenalties':
      sels.push(m.target, m.from);
      break;
    case 'countsAs':
      sels.push(m.target);
      ids.push(m.as);
      break;
    case 'link':
      ids.push(...m.among);
      break;
    case 'grantEffect':
      if (m.target !== 'all') sels.push(m.target);
      effectPieceIds(m.effect, ids);
      problems.push(...effectProblems(m.effect, where, true));
      break;
    case 'perCountOver':
      sels.push(m.match);
      break;
    case 'budget':
      if (m.target !== 'all') sels.push(m.target);
      break;
    case 'drawWeight':
      sels.push(m.target);
      if (!opts.drawWeight) problems.push(`${where}: drawWeight belongs on clients and crews only`);
      break;
    case 'mult':
      if (m.per) sels.push(m.per);
      break;
    case 'xMult':
      if (m.plusPer && m.plusPer.per !== 'milestonesEarly') sels.push(m.plusPer.per);
      if (typeof m.when === 'object') conditionPieceIds(m.when.host, ids);
      if (m.times < 0) problems.push(`${where}: xMult times must be ≥ 0`);
      break;
    case 'setBonus':
      if (m.set && !content.sets[m.set]) problems.push(`${where}: unknown set "${m.set}"`);
      break;
    case 'bestPiece':
    case 'rule':
      break;
  }
  sels.forEach((s) => selectorPieceIds(s, ids));
  for (const id of ids) {
    if (!content.pieces[id]) problems.push(`${where}: unknown piece "${id}"`);
  }
  if (opts.fixture) {
    const target =
      'target' in m && m.target !== 'all' && typeof m.target === 'object' ? m.target : null;
    const hostless =
      (target && !hasHost(target)) ||
      (m.kind === 'xMult' && m.when !== undefined && typeof m.when !== 'object');
    if (hostless || m.kind === 'drawWeight' || m.kind === 'rule') {
      problems.push(`${where}: a fixture's modifiers target its host`);
    }
  }
  const text = modifierText(content, m);
  if (!text || text.includes('undefined')) problems.push(`${where}: text didn't generate`);
  return problems;
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
      const ids: PieceId[] = [];
      effectPieceIds(effect, ids);
      ids.forEach((id) => known(id, `${where} effect`));
      problems.push(...effectProblems(effect, where, false));
    }
    const links = def.effects.some((e) => e.kind === 'link');
    if (links && (!def.connector || def.category !== 'indoor')) {
      problems.push(`${where}: only an indoor connector can link`);
    }
    if (def.effects.filter((e) => e.kind === 'transform').length > 1) {
      problems.push(`${where}: at most one transform`);
    }
    for (const t of def.canCover ?? []) {
      if (!content.features[t]) problems.push(`${where}: canCover has unknown feature "${t}"`);
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

  for (const [key, crew] of Object.entries(content.crews)) {
    if (crew.id !== key) problems.push(`crew ${key}: id is "${crew.id}"`);
    crew.modifiers.forEach((m, k) =>
      problems.push(
        ...modifierProblems(content, m, `crew ${key} modifier ${k}`, {
          fixture: false,
          drawWeight: true,
        }),
      ),
    );
  }

  for (const [key, def] of Object.entries(content.fixtures)) {
    const where = `fixture ${key}`;
    if (def.id !== key) problems.push(`${where}: id is "${def.id}"`);
    const ids: PieceId[] = [];
    selectorPieceIds(def.fits, ids);
    ids.forEach((id) => known(id, `${where} fits`));
    if (!Number.isInteger(def.drawWeight) || def.drawWeight < 0) {
      problems.push(`${where}: drawWeight must be a whole number ≥ 0`);
    }
    if (!Number.isInteger(def.price) || def.price < 1) problems.push(`${where}: price must be ≥ 1`);
    if (def.modifiers.length === 0) problems.push(`${where}: no modifiers`);
    def.modifiers.forEach((m, k) =>
      problems.push(
        ...modifierProblems(content, m, `${where} modifier ${k}`, {
          fixture: true,
          drawWeight: false,
        }),
      ),
    );
  }

  for (const [key, def] of Object.entries(content.blueprints)) {
    const where = `blueprint ${key}`;
    if (def.id !== key) problems.push(`${where}: id is "${def.id}"`);
    if (!Number.isInteger(def.price) || def.price < 1) problems.push(`${where}: price must be ≥ 1`);
    if (def.modifiers.length === 0) problems.push(`${where}: no modifiers`);
    def.modifiers.forEach((m, k) =>
      problems.push(
        ...modifierProblems(content, m, `${where} modifier ${k}`, {
          fixture: false,
          drawWeight: false,
        }),
      ),
    );
    // D-056: ×Mult lives only on Rare blueprints.
    if (def.rarity !== 'rare' && def.modifiers.some((m) => m.kind === 'xMult')) {
      problems.push(`${where}: only Rare blueprints carry ×Mult`);
    }
  }
  const b = content.balance;
  if (b.phases.length === 0) problems.push('balance: no phases');
  if (b.early.budgetPerWeek.length === 0 || b.early.scorePct.length === 0) {
    problems.push('balance: early needs at least one entry per list');
  }
  for (const [key, v] of Object.entries(b.rules)) {
    if (!Number.isInteger(v) || v < 0)
      problems.push(`balance: rule ${key} must be a whole number ≥ 0`);
  }
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
  if (drawable.length < b.rules.handSize)
    problems.push('balance: fewer drawable cards than a hand');
  if (b.weeksPerPhase < 1 || b.rules.handSize < 1)
    problems.push('balance: weeks and hand size must be ≥ 1');
  const shop = b.shop;
  if (shop.stock.length === 0) problems.push('balance: the shop needs at least one stock row');
  for (const [k, row] of shop.stock.entries()) {
    if (row.rarity.length !== 3 || row.rarity.reduce((a, x) => a + x, 0) <= 0) {
      problems.push(`balance: shop stock row ${k} needs three rarity weights`);
    }
  }
  for (const [id, p] of Object.entries(shop.services)) {
    if (p.base < 0 || p.step < 0 || p.max < p.base) problems.push(`balance: service ${id} prices`);
  }
  const v = b.verdicts;
  if (v.length === 0 || v[0]!.minPctOfTarget !== 0)
    problems.push('balance: the first verdict starts at 0%');
  return problems;
}
