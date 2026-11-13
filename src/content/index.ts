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
import { isConnected, packShapeProblem, parseShape, shapeCells } from '../rules/grid.ts';
import { cardText, changeOrderText, modifierText, specText, toolText } from '../rules/text.ts';
import { DRAW_ROWS, drawableTypes, drawWeights, rowOf } from '../rules/draw.ts';
import { isType } from '../rules/selectors.ts';
import { isRunMode } from '../rules/milestones.ts';
import { BALANCE } from './balance.ts';
import { BLUEPRINTS } from './blueprints.ts';
import { CHANGE_ORDERS } from './change-orders.ts';
import { CLIENTS } from './clients.ts';
import { CRATES } from './crates.ts';
import { CREWS } from './crews.ts';
import { FEATURES } from './features.ts';
import { FIXTURES } from './fixtures.ts';
import { LOT_TRAITS } from './lot-traits.ts';
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
  changeOrders: CHANGE_ORDERS,
  lotTraits: LOT_TRAITS,
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
      if (m.maxEach !== undefined && (!m.per || !Number.isInteger(m.maxEach) || m.maxEach < 1)) {
        problems.push(`${where}: mult maxEach needs per, and a whole number ≥ 1`);
      }
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
    // A piece grows into another in place (the Nursery into the Kids' Room): the same tiles.
    for (const e of def.effects) {
      if (e.kind !== 'transform' || !('piece' in e.into)) continue;
      const into = content.pieces[e.into.piece];
      const same = (a: readonly string[], b: readonly string[]) =>
        JSON.stringify(shapeCells(a, 0)) === JSON.stringify(shapeCells(b, 0));
      if (into && !same(def.shape, into.shape)) {
        problems.push(`${where}: transforms into ${into.id}, which has another shape`);
      }
    }
    // M4b: a member's room (D-103) counts as a Bedroom and is never in the draw.
    if (def.member) {
      if (def.drawWeight !== 0) problems.push(`${where}: a member's room has weight 0`);
      if (def.countsAs !== 'bedroom' || def.category !== 'indoor' || def.connector) {
        problems.push(`${where}: a member's room is an indoor room counting as a Bedroom`);
      }
      if (def.pack) problems.push(`${where}: a member's room isn't a pack`);
    }
    if (def.pack) {
      // A pack (D-106): its picture and every suggested shape are tiles it can place.
      if (!Number.isInteger(def.pack.maxTiles) || def.pack.maxTiles < 1) {
        problems.push(`${where}: a pack's maxTiles must be ≥ 1`);
      }
      for (const shape of [def.shape, ...def.pack.shapes]) {
        const problem = packShapeProblem(shape, def.pack.maxTiles);
        if (problem) problems.push(`${where}: pack shape ${shape.join('/')}: ${problem}`);
      }
      if (def.countsAs) problems.push(`${where}: a pack has no shape variants`);
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
    for (const id of crew.startReserve ?? []) {
      known(id, `crew ${key} startReserve`);
      if (content.pieces[id]?.member) problems.push(`crew ${key}: ${id} is a member's room`);
    }
    crew.modifiers.forEach((m, k) =>
      problems.push(
        ...modifierProblems(content, m, `crew ${key} modifier ${k}`, {
          fixture: false,
          drawWeight: true,
        }),
      ),
    );
  }

  // D-119: a lot trait reads a terrain that sits on the lot, and pays like a crew. D-166: or
  // the kind the lot was shaped to; and it may tilt the draw, as a run keeps the traits it began
  // with.
  for (const [key, trait] of Object.entries(content.lotTraits)) {
    const where = `lot trait ${key}`;
    if (trait.id !== key) problems.push(`${where}: id is "${trait.id}"`);
    const when = trait.when;
    if ('kind' in when) {
      if (!['rocky', 'open', 'pond'].includes(when.kind)) {
        problems.push(`${where}: "${when.kind}" isn't a lot kind that shapes a lot`);
      }
    } else {
      const t = when.terrain as string;
      if (t === 'street' || !content.features[when.terrain]) {
        problems.push(`${where}: "${t}" isn't a terrain on the lot`);
      }
      if (!Number.isInteger(when.min) || when.min < 1) {
        problems.push(`${where}: min must be a whole number ≥ 1`);
      }
    }
    for (const id of trait.suits ?? []) {
      if (!content.clients[id]) problems.push(`${where}: unknown client "${id}"`);
    }
    trait.modifiers.forEach((m, k) =>
      problems.push(
        ...modifierProblems(content, m, `${where} modifier ${k}`, {
          fixture: false,
          drawWeight: true,
        }),
      ),
    );
  }

  // M4b: arrival ids are unique across households, and each member room is one arrival's.
  const arrivalIds = new Set<string>();
  const memberOf = new Map<PieceId, string>();
  for (const [key, client] of Object.entries(content.clients)) {
    const where = `client ${key}`;
    if (client.id !== key) problems.push(`${where}: id is "${client.id}"`);
    const own = new Set<string>();
    for (const id of client.changeOrders) {
      const co = content.changeOrders[id];
      if (!co) problems.push(`${where}: unknown change order "${id}"`);
      else if (co.scope !== client.id)
        problems.push(`${where}: change order ${id} is ${co.scope}'s`);
      if (own.has(id)) problems.push(`${where}: change order ${id} twice`);
      own.add(id);
    }
    const [bmin, bmax] = client.household.bedrooms;
    if (!Number.isInteger(bmin) || !Number.isInteger(bmax) || bmin < 0 || bmin > bmax) {
      problems.push(`${where}: household bedrooms must be whole numbers, min ≤ max`);
    }
    const specNamed: PieceId[] = [];
    for (const spec of client.specs) houseConditionPieceIds(spec.condition, specNamed);
    for (const a of client.household.arrivals) {
      const at = `${where} arrival ${a.id}`;
      if (arrivalIds.has(a.id)) problems.push(`${at}: duplicate id`);
      arrivalIds.add(a.id);
      const phases = content.balance.phases.length;
      if (!Number.isInteger(a.phase) || a.phase < 1 || a.phase >= phases) {
        problems.push(`${at}: arrives at a phase from 1 to ${phases - 1}`);
      }
      if (!a.name || !a.text) problems.push(`${at}: needs a name and text`);
      if (a.cards.length === 0) problems.push(`${at}: no cards`);
      a.cards.forEach((id) => known(id, at));
      if (a.room.length === 0) problems.push(`${at}: no room`);
      for (const id of a.room) {
        known(id, at);
        if (content.pieces[id] && !content.pieces[id].member) {
          problems.push(`${at}: ${id} isn't a member's room`);
        }
        if (memberOf.has(id)) problems.push(`${at}: ${id} is ${memberOf.get(id)}'s room too`);
        memberOf.set(id, a.id);
        // Room for everyone needs it from the arrival on (house-rules.ts builds that).
        if (!specNamed.includes(id)) problems.push(`${at}: the checklist never names ${id}`);
      }
      if (!a.cards.some((id) => a.room.includes(id))) {
        problems.push(`${at}: none of its cards is its room`);
      }
    }
    // D-160: what the client brings serves a wish: a card the checklist names, never a member's
    // room (those come with their member), at a phase of the run.
    (client.deliveries ?? []).forEach((d, k) => {
      const at = `${where} delivery ${k}`;
      const phases = content.balance.phases.length;
      if (!Number.isInteger(d.phase) || d.phase < 0 || d.phase >= phases) {
        problems.push(`${at}: lands at a phase from 0 to ${phases - 1}`);
      }
      if (!d.text) problems.push(`${at}: needs text`);
      if (d.cards.length === 0) problems.push(`${at}: no cards`);
      for (const id of d.cards) {
        known(id, at);
        if (content.pieces[id]?.member) problems.push(`${at}: ${id} is a member's room`);
        if (!specNamed.includes(id)) problems.push(`${at}: the checklist never names ${id}`);
      }
    });
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
  for (const def of Object.values(content.pieces)) {
    if (def.member && !memberOf.has(def.id)) {
      problems.push(`piece ${def.id}: a member's room no arrival brings`);
    }
  }

  // D-160: the standing stock is pieces of the weekly draw, from a phase of the run, and a first
  // job's first comes in a week of that phase.
  const stock = content.balance.standingStock;
  const stockAt = 'balance standingStock';
  for (const id of stock.pieces) {
    known(id, stockAt);
    const def = content.pieces[id];
    if (def && (def.member || def.drawWeight <= 0)) {
      problems.push(`${stockAt}: ${id} isn't in the weekly draw`);
    }
  }
  if (new Set(stock.pieces).size !== stock.pieces.length) {
    problems.push(`${stockAt}: a piece twice`);
  }
  if (
    !Number.isInteger(stock.fromPhase) ||
    stock.fromPhase < 0 ||
    stock.fromPhase >= content.balance.phases.length
  ) {
    problems.push(`${stockAt}: fromPhase must be a phase of the run`);
  }
  if (
    !Number.isInteger(stock.firstJobSlot) ||
    stock.firstJobSlot < 1 ||
    stock.firstJobSlot > content.balance.weeksPerPhase
  ) {
    problems.push(`${stockAt}: firstJobSlot must be a week of the phase`);
  }

  // M4b: change orders.
  for (const [key, def] of Object.entries(content.changeOrders)) {
    const where = `change order ${key}`;
    if (def.id !== key) problems.push(`${where}: id is "${def.id}"`);
    if (def.scope !== 'generic') {
      const client = content.clients[def.scope];
      if (!client) problems.push(`${where}: unknown client "${def.scope}"`);
      else if (!client.changeOrders.includes(def.id)) {
        problems.push(`${where}: ${def.scope} doesn't list it`);
      }
    }
    if (!def.name || !def.text) problems.push(`${where}: needs a name and text`);
    const ids: PieceId[] = [];
    if (def.kind === 'request') {
      houseConditionPieceIds(def.condition, ids);
      problems.push(...houseConditionProblems(content, def.condition, where));
      if ('stages' in def.condition) problems.push(`${where}: a request has no stages`);
    } else if (def.kind === 'restriction') {
      selectorPieceIds(def.forbid, ids);
    } else {
      if (def.modifiers.length === 0) problems.push(`${where}: no modifiers`);
      def.modifiers.forEach((m, k) =>
        problems.push(
          ...modifierProblems(content, m, `${where} modifier ${k}`, {
            fixture: false,
            drawWeight: false,
          }),
        ),
      );
    }
    ids.forEach((id) => known(id, where));
    if (def.kind !== 'phase') {
      const r = def.reward;
      if (Object.values(r).every((v) => !v)) problems.push(`${where}: an empty reward`);
      if (r.tool && r.tool !== 'random' && !content.tools[r.tool]) {
        problems.push(`${where}: unknown reward tool "${r.tool}"`);
      }
    }
    const text = changeOrderText(content, def);
    if (text.length === 0 || text.some((t) => !t || t.includes('undefined'))) {
      problems.push(`${where}: text didn't generate`);
    }
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
  if (!Number.isInteger(b.strikesPerMilestone) || b.strikesPerMilestone < 0) {
    problems.push('balance: strikesPerMilestone must be a whole number ≥ 0');
  }
  b.phases.forEach((p, i) => {
    if (i > 0 && p.target <= b.phases[i - 1]!.target)
      problems.push(`balance: target ${i + 1} doesn't rise`);
  });
  if (b.complexityPct.length === 0 || b.complexityPct.some((row) => row.length !== 3)) {
    problems.push('balance: complexityPct needs rows of three');
  }
  for (const mode of b.lotCardsFullIn) {
    if (!isRunMode(mode)) problems.push(`balance: lotCardsFullIn has unknown mode "${mode}"`);
  }
  for (const row of DRAW_ROWS) {
    const size = row === 'rooms' ? b.rules.roomsRow : b.rules.layoutRow;
    const drawable = Object.values(content.pieces).filter(
      (p) =>
        p.drawWeight > 0 &&
        p.fromPhase === 0 &&
        rowOf(content, { kind: 'piece', id: p.id }) === row,
    );
    if (drawable.length < size) problems.push(`balance: fewer drawable ${row} cards than its row`);
    if (drawableTypes(content, [], row).length <= b.shop.strikeMinTypes[row]) {
      problems.push(`balance: the ${row} row's strike floor leaves nothing to strike`);
    }
  }
  if (b.weeksPerPhase < 1 || b.rules.roomsRow < 1 || b.rules.layoutRow < 1)
    problems.push('balance: weeks and each row of the hand must be ≥ 1');
  const firstPct = b.jobBoard.firstTargetPct;
  if (!Number.isInteger(firstPct) || firstPct < 1 || firstPct > 100) {
    problems.push('balance: jobBoard.firstTargetPct must be a whole number from 1 to 100');
  }
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
  // M4b: change orders come after milestones the run goes on from, in order.
  b.changeOrderAfter.forEach((m, i) => {
    if (!Number.isInteger(m) || m < 1 || m >= b.phases.length) {
      problems.push(`balance: changeOrderAfter ${m}: a milestone from 1 to ${b.phases.length - 1}`);
    }
    if (i > 0 && m <= b.changeOrderAfter[i - 1]!) problems.push('balance: changeOrderAfter rises');
  });
  return problems;
}
