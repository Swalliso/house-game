// The content registry and validateContent() (implementation-plan.md §5): the checks types
// can't make. DATA ONLY lives in the other files here.

import type {
  Content,
  Effect,
  HouseCondition,
  Modifier,
  PieceCondition,
  PieceId,
  Selector,
  Tag,
} from '../rules/index.ts';
import { isConnected, parseShape } from '../rules/grid.ts';
import { cardText, modifierText, specText, toolText } from '../rules/text.ts';
import { drawWeights } from '../rules/draw.ts';
import { isType } from '../rules/selectors.ts';
import { BALANCE } from './balance.ts';
import { BLUEPRINTS } from './blueprints.ts';
import { CLIENTS } from './clients.ts';
import { CRATES } from './crates.ts';
import { CREWS } from './crews.ts';
import { FEATURES } from './features.ts';
import { FIXTURES } from './fixtures.ts';
import { PIECES } from './pieces.ts';
import { SETS } from './sets.ts';
import { TOOLS } from './tools.ts';
import { UPGRADES } from './upgrades.ts';

export { SCORE_LABELS } from './labels.ts';

export const CONTENT: Content = {
  pieces: PIECES,
  features: FEATURES,
  sets: SETS,
  crews: CREWS,
  clients: CLIENTS,
  fixtures: FIXTURES,
  blueprints: BLUEPRINTS,
  tools: TOOLS,
  upgrades: UPGRADES,
  crates: CRATES,
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

/** The piece ids a house condition names, for "every id resolves" and the spec-piece check. */
function houseConditionPieceIds(cond: HouseCondition, out: PieceId[]): void {
  if ('and' in cond) cond.and.forEach((c) => houseConditionPieceIds(c, out));
  else if ('or' in cond) cond.or.forEach((c) => houseConditionPieceIds(c, out));
  else if ('not' in cond) houseConditionPieceIds(cond.not, out);
  else if ('stages' in cond) cond.stages.forEach((st) => houseConditionPieceIds(st.condition, out));
  else if ('count' in cond) selectorPieceIds(cond.count, out);
  else if ('countNew' in cond) selectorPieceIds(cond.countNew, out);
  else if ('none' in cond) selectorPieceIds(cond.none, out);
  else if ('adjacentPair' in cond) cond.adjacentPair.forEach((s) => selectorPieceIds(s, out));
  else if ('group' in cond) selectorPieceIds(cond.group, out);
  else if ('ratio' in cond) {
    selectorPieceIds(cond.ratio.count, out);
    selectorPieceIds(cond.ratio.per, out);
  } else if ('variety' in cond) {
    selectorPieceIds(cond.variety.of, out);
    if (cond.variety.exempt) selectorPieceIds(cond.variety.exempt, out);
  }
}

/** Problems with a house condition's numbers and stages. */
function houseConditionProblems(content: Content, cond: HouseCondition, where: string): string[] {
  const out: string[] = [];
  const walk = (c: HouseCondition) => {
    if ('and' in c) c.and.forEach(walk);
    else if ('or' in c) c.or.forEach(walk);
    else if ('not' in c) walk(c.not);
    else if ('stages' in c) {
      if (c.stages.length === 0 || c.stages[0]!.fromPhase !== 0) {
        out.push(`${where}: stages start at phase 0`);
      }
      c.stages.forEach((st, k) => {
        if (k > 0 && st.fromPhase <= c.stages[k - 1]!.fromPhase) {
          out.push(`${where}: stages must rise`);
        }
        if (st.fromPhase >= content.balance.phases.length)
          out.push(`${where}: no phase ${st.fromPhase}`);
        walk(st.condition);
      });
    } else if ('count' in c) {
      if (c.min === undefined && c.max === undefined)
        out.push(`${where}: a count needs min or max`);
      if (c.min !== undefined && c.max !== undefined && c.min > c.max)
        out.push(`${where}: min > max`);
    } else if ('ratio' in c) {
      if (!Number.isInteger(c.ratio.every) || c.ratio.every < 1)
        out.push(`${where}: ratio every ≥ 1`);
    } else if ('set' in c) {
      if (!content.sets[c.set]) out.push(`${where}: unknown set "${c.set}"`);
    } else if ('outline' in c) {
      const o = c.outline;
      if (o.minFillPct < 0 || o.minFillPct > 100 || o.maxAspect < 1)
        out.push(`${where}: outline numbers`);
    }
  };
  walk(cond);
  return out;
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
    const tool = def.reward?.tool;
    if (tool && tool !== 'random' && !content.tools[tool]) {
      problems.push(`feature ${key}: unknown reward tool "${tool}"`);
    }
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

  for (const [key, client] of Object.entries(content.clients)) {
    const where = `client ${key}`;
    if (client.id !== key) problems.push(`${where}: id is "${client.id}"`);
    if (!Number.isInteger(client.targetPct) || client.targetPct < 1) {
      problems.push(`${where}: targetPct must be a whole number ≥ 1`);
    }
    const ids = new Set<string>();
    for (const spec of client.specs) {
      const at = `${where} spec ${spec.id}`;
      if (ids.has(spec.id)) problems.push(`${at}: duplicate id`);
      ids.add(spec.id);
      const named: PieceId[] = [];
      houseConditionPieceIds(spec.condition, named);
      named.forEach((id) => known(id, at));
      problems.push(...houseConditionProblems(content, spec.condition, at));
      const text = specText(content, spec);
      if (!text || text.includes('undefined')) problems.push(`${at}: text didn't generate`);
      // §5: every client's spec pieces can be drawn for that client (special ones via its pool).
      if (spec.group === 'wishes') {
        const weights = drawWeights(content, content.balance.complexityPct.length - 1, {
          mods: client.pool,
        });
        for (const id of named) {
          if (!content.pieces[id]) continue;
          const def = content.pieces[id];
          const drawable = weights.some(
            (w) =>
              w.card.kind === 'piece' && isType(content.pieces[w.card.id], def.countsAs ?? def.id),
          );
          if (!drawable) problems.push(`${at}: ${id} can't be drawn for this client`);
        }
      }
    }
    client.tastes.forEach((m, k) => {
      problems.push(
        ...modifierProblems(content, m, `${where} taste ${k}`, {
          fixture: false,
          drawWeight: true,
        }),
      );
      if (m.kind === 'xMult') problems.push(`${where} taste ${k}: clients carry no ×Mult`);
    });
    client.pool.forEach((m, k) => {
      if (m.kind !== 'drawWeight') problems.push(`${where} pool ${k}: the pool is drawWeight only`);
      problems.push(
        ...modifierProblems(content, m, `${where} pool ${k}`, { fixture: false, drawWeight: true }),
      );
    });
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
  for (const [key, def] of Object.entries(content.tools)) {
    const where = `tool ${key}`;
    if (def.id !== key) problems.push(`${where}: id is "${def.id}"`);
    if (!Number.isInteger(def.price) || def.price < 1) problems.push(`${where}: price must be ≥ 1`);
    if (def.use.kind === 'weekModifiers') {
      def.use.modifiers.forEach((m, k) =>
        problems.push(
          ...modifierProblems(content, m, `${where} modifier ${k}`, {
            fixture: false,
            drawWeight: false,
          }),
        ),
      );
    }
    if (def.use.kind === 'levelSet' && !content.sets[def.use.set]) {
      problems.push(`${where}: unknown set "${def.use.set}"`);
    }
    if (def.use.kind === 'advanceTimers' && def.use.weeks < 1) {
      problems.push(`${where}: advanceTimers needs weeks ≥ 1`);
    }
    const text = toolText(content, def);
    if (text.length === 0 || text.some((t) => !t || t.includes('undefined'))) {
      problems.push(`${where}: text didn't generate`);
    }
  }

  for (const [key, def] of Object.entries(content.upgrades)) {
    const where = `upgrade ${key}`;
    if (def.id !== key) problems.push(`${where}: id is "${def.id}"`);
    if (!Number.isInteger(def.price) || def.price < 1) problems.push(`${where}: price must be ≥ 1`);
    if (def.modifiers.some((m) => m.kind !== 'rule')) {
      problems.push(`${where}: company upgrades are rule modifiers`);
    }
  }

  for (const [key, def] of Object.entries(content.crates)) {
    const where = `crate ${key}`;
    if (def.id !== key) problems.push(`${where}: id is "${def.id}"`);
    if (!Number.isInteger(def.price) || def.price < 1) problems.push(`${where}: price must be ≥ 1`);
    if (def.contents !== 'piece' && (def.pool || def.filter)) {
      problems.push(`${where}: only piece crates have a pool or a filter`);
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
