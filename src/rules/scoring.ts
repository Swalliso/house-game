// The weekly tally (implementation-plan.md §4, Scoring pipeline; D-037, D-056).
//
// Per piece, in placement order:
//   points = the sum of flat terms (steady, neighbor, rhythm, growth, enclosure, perTile, flat
//            auras, and conditional effects while their condition holds), from its own effects
//            and any granted to it (Good Bones)
//   pct    = the sum of percentage terms: auras, `earn` modifiers (blueprints, fixtures on
//            their host, the crew, this week's tools), and `perCountOver`. Percentages add:
//            two +100% make ×3.
//   earned = floor((max(0, points) × max(0, 100 + pct) + 50) / 100), or 0 if any `earnNothing`
//            applies. Then `bestPiece` (Crown Jewel) adds its pct to the single top earner,
//            the earliest-placed on a tie.
// A piece whose `requires` condition fails earns nothing and pays no budget, and none of its
// effects (auras and granted ones included) apply; it still counts for sets. `blockPenalties`
// (Soundproofing) drops negative neighbor terms and negative auras from matching neighbors.
// A Renovated room (M4a) adds `renovate.pointsPerLevel` flat points per level, before its
// percentages.
// For the week (Mult in hundredths, starting at 100):
//   Points = Σ earned + Σ set Points (at its level, scaled by `setBonus`)
//   Mult   = 100 + Σ set Mult (the same) + specBonus × specs met + Σ `mult` modifiers
//   ×Mult  = each distinct source once, in order: sets (Full House), fixtures, blueprints,
//            tools: mult = floor((mult × times + 50) / 100)
//   Total  = floor((Points × Mult + 50) / 100)
// Integer math throughout, rounding half up, so every browser and Node agree.

import type {
  BreakdownLine,
  Content,
  Effect,
  ModSource,
  MultTerm,
  PieceDef,
  PieceScore,
  PlacedPiece,
  RunStat,
  Selector,
  SetId,
  SpecDef,
  SpecScore,
  Tally,
  XMultTerm,
} from './index.ts';
import { meetsHouse, type CondCtx } from './conditions.ts';
import {
  fencedYardsBordered,
  neighborRef,
  pieceDef,
  tilesIn,
  type Layout,
  type Neighbor,
} from './layout.ts';
import { ruleFrom, sourceName, type ActiveMod } from './modifiers.ts';
import { matchesNeighbor, matchesPiece, meetsCondition } from './selectors.ts';
import { matchSets } from './sets.ts';
import {
  conditionText,
  countedNames,
  earnTargetText,
  neighborName,
  ordinal,
  regionText,
} from './text.ts';

/** a / b rounded half up, for non-negative integers. */
export function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

/** What a piece earns from its flat points and its percentage terms. */
export function earnedFor(points: number, pct: number): number {
  return Math.floor((Math.max(0, points) * Math.max(0, 100 + pct) + 50) / 100);
}

/** The week's total from its Points and Mult (in hundredths). */
export function weekTotal(points: number, mult: number): number {
  return Math.floor((Math.max(0, points) * Math.max(0, mult) + 50) / 100);
}

/** Everything about the run that a tally needs beyond the house. */
export interface TallyContext {
  /** Run-level modifiers: the crew, the client, blueprints, upgrades, and this week's tools. */
  mods: readonly ActiveMod[];
  setLevels: Partial<Record<SetId, number>>;
  /** A phase's last week or an overtime week, actually played (not fast-forwarded). */
  lastWeek: boolean;
  stats: Readonly<Record<RunStat, number>>;
  /** The client's checklist (M4a): each spec met adds `specBonus` to the Mult. */
  specs: readonly SpecDef[];
  /** The current milestone, for specs that change by stage. */
  phase: number;
}

export const NO_CONTEXT: TallyContext = {
  mods: [],
  setLevels: {},
  lastWeek: false,
  stats: { milestonesEarly: 0 },
  specs: [],
  phase: 0,
};

const specCache = new WeakMap<Layout, WeakMap<readonly SpecDef[], Map<number, boolean[]>>>();

/** Which of the client's specs the house meets, cached per layout, checklist, and phase. */
export function specsMet(
  content: Content,
  layout: Layout,
  specs: readonly SpecDef[],
  phase: number,
): readonly boolean[] {
  if (specs.length === 0) return [];
  let perLayout = specCache.get(layout);
  if (!perLayout) specCache.set(layout, (perLayout = new WeakMap()));
  let perSpecs = perLayout.get(specs);
  if (!perSpecs) perLayout.set(specs, (perSpecs = new Map()));
  let met = perSpecs.get(phase);
  if (!met) {
    const ctx: CondCtx = { phase };
    met = specs.map((s) => meetsHouse(content, layout, s.condition, ctx));
    perSpecs.set(phase, met);
  }
  return met;
}

interface Acc {
  points: number;
  pct: number;
  budget: number;
  own: BreakdownLine[];
  auras: BreakdownLine[];
  mods: BreakdownLine[];
  /** Where each source piece type's aura line sits in `auras`, keyed `<piece id>|<op>`. */
  auraAt: Map<string, number>;
}

/**
 * Each `earn` modifier's breakdown label: its source's name, and, for a source with more than
 * one (Heat wave's Pools, shade, and Sunny rooms; a client's tastes), what this one is for:
 * "Heat wave (Sunny rooms)". So a piece's lines can always be told apart, and one effect reads
 * the same on every piece. A fixture's own-piece line keeps the plain name ("Fireplace").
 */
function earnLabels(content: Content, mods: readonly ActiveMod[]): Map<ActiveMod, string> {
  const earns = mods.filter((m) => m.mod.kind === 'earn');
  const count = new Map<string, number>();
  for (const m of earns) {
    const key = JSON.stringify(m.source);
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  return new Map(
    earns.map((m) => {
      const name = sourceName(content, m.source);
      const what =
        m.mod.kind === 'earn' && count.get(JSON.stringify(m.source))! > 1
          ? earnTargetText(content, m.mod.target)
          : null;
      return [m, what ? `${name} (${what})` : name];
    }),
  );
}

/** Auras of one kind from several neighbors read as one line: "2 Dining Rooms next door +100%". */
function addAura(target: Acc, def: PieceDef, op: 'add' | 'pct', value: number, uid: number): void {
  const key = `${def.id}|${op}`;
  const from = { kind: 'piece', uid } as const;
  const i = target.auraAt.get(key);
  if (i === undefined) {
    target.auraAt.set(key, target.auras.length);
    target.auras.push({ label: `${def.name} next door`, op, value, from: [from] });
    return;
  }
  const old = target.auras[i]!;
  const n = old.from.length + 1;
  target.auras[i] = {
    label: `${n} ${def.name.endsWith('s') ? def.name : `${def.name}s`} next door`,
    op,
    value: old.value + value,
    from: [...old.from, from],
  };
}

/**
 * Weeks a piece's timers have run before this one: 0 in the week it's built, plus Fertilizer's
 * bonus. Granted effects count from the later of placement and the grant.
 */
export function ageOf(piece: PlacedPiece, week: number, since = 0): number {
  return Math.max(0, week - Math.max(piece.placedWeek, since)) + (piece.ageBonus ?? 0);
}

/** "Every 3rd week": pays when (age + 1) is a multiple of `every`, so the build week counts as the first. */
export function onCadence(age: number, every: number): boolean {
  return every <= 1 || (age + 1) % every === 0;
}

/** The first `requires` condition the piece fails, or null if it meets them all. */
export function unmetRequirement(
  content: Content,
  layout: Layout,
  def: PieceDef,
  uid: number,
): Extract<Effect, { kind: 'requires' }> | null {
  for (const e of def.effects) {
    if (e.kind === 'requires' && !meetsCondition(content, layout, e.condition, uid)) return e;
  }
  return null;
}

/** An effect granted to a piece by a modifier (Good Bones), with its timer's start. */
interface Granted {
  effect: Effect;
  since: number;
  label: string;
}

interface Ctx {
  content: Content;
  layout: Layout;
  week: number;
  withLines: boolean;
  acc: Map<number, Acc>;
  /** Per protected piece: the selectors whose penalties don't apply, with the fixture's host. */
  blocks: Map<number, { from: Selector; host?: number }[]>;
}

function blocked(ctx: Ctx, uid: number, n: Neighbor): boolean {
  const list = ctx.blocks.get(uid);
  return !!list && list.some((b) => matchesNeighbor(ctx.content, ctx.layout, b.from, n, b.host));
}

/** Applies one of a piece's effects: to its own Acc, or (auras) to its neighbors'. */
function applyEffect(
  ctx: Ctx,
  piece: PlacedPiece,
  def: PieceDef,
  effect: Effect,
  suffix: string,
  since = 0,
): void {
  const { content, layout, withLines } = ctx;
  const mine = ctx.acc.get(piece.uid)!;
  const age = ageOf(piece, ctx.week, since);
  const add = (value: number, label: string, from: BreakdownLine['from'] = []) => {
    mine.points += value;
    if (withLines) mine.own.push({ label: label + suffix, op: 'add', value, from });
  };
  switch (effect.kind) {
    case 'steady':
      add(effect.amount, 'Every week');
      break;
    case 'neighbor': {
      const neighbors = layout.neighbors.get(piece.uid)!;
      let matched = neighbors.filter((n) => matchesNeighbor(content, layout, effect.match, n));
      // Soundproofing: a penalty from a blocked neighbor doesn't apply.
      if (effect.amount < 0) matched = matched.filter((n) => !blocked(ctx, piece.uid, n));
      // A cap credits the pieces that really touch it before the rooms linked across a hall.
      const counted =
        effect.max === undefined
          ? matched
          : touchingFirst(layout, piece.uid, matched).slice(0, effect.max);
      if (counted.length === 0) break;
      const capped = counted.length < matched.length ? ` (${effect.max} count)` : '';
      add(
        effect.amount * counted.length,
        withLines ? neighborLabel(content, layout, piece, matched) + capped : '',
        withLines ? counted.map(neighborRef) : [],
      );
      break;
    }
    case 'aura': {
      // Adjacent: each touching piece. Region: each piece in the fenced yards it borders.
      const targets =
        effect.scope === 'region'
          ? regionTargets(layout, piece.uid)
          : layout.neighbors.get(piece.uid)!.flatMap((n) => (n.kind === 'piece' ? [n.uid] : []));
      for (const uid of targets) {
        if (!matchesPiece(content, layout, effect.match, uid)) continue;
        const target = ctx.acc.get(uid)!;
        const shielded = blocked(ctx, uid, { kind: 'piece', uid: piece.uid });
        if (effect.pct && !(shielded && effect.pct < 0)) {
          target.pct += effect.pct;
          if (withLines) addAura(target, def, 'pct', effect.pct, piece.uid);
        }
        if (effect.amount && !(shielded && effect.amount < 0)) {
          target.points += effect.amount;
          if (withLines) addAura(target, def, 'add', effect.amount, piece.uid);
        }
      }
      break;
    }
    case 'rhythm':
      if (onCadence(age, effect.every)) add(effect.amount, `Every ${ordinal(effect.every)} week`);
      break;
    case 'growth': {
      const grown = effect.perWeek * (age + 1);
      const value = effect.max === undefined ? grown : Math.min(effect.max, grown);
      if (value !== 0) add(value, `Grown for ${age + 1} ${age === 0 ? 'week' : 'weeks'}`);
      break;
    }
    case 'enclosure': {
      const ids = fencedYardsBordered(layout, piece.uid);
      if (ids.length === 0) break;
      const tiles = ids.reduce((a, id) => a + layout.fencedSizes[id]!, 0);
      const raw = tiles * effect.perTile;
      const value = effect.cap === undefined ? raw : Math.min(effect.cap, raw);
      const capped = value < raw ? ` (up to ${effect.cap})` : '';
      const yards = ids.length === 1 ? 'Fenced yard of' : `${ids.length} fenced yards,`;
      add(value, `${yards} ${tiles} ${tiles === 1 ? 'tile' : 'tiles'}${capped}`);
      break;
    }
    case 'perTile': {
      const n = tilesIn(layout, piece.uid, effect.region);
      if (n > 0)
        add(effect.amount * n, `${n} ${n === 1 ? 'tile' : 'tiles'} ${regionText(effect.region)}`);
      break;
    }
    case 'economy':
      if (onCadence(age, effect.every ?? 1)) {
        mine.budget += effect.budget;
        if (withLines) {
          const when =
            (effect.every ?? 1) > 1 ? `Every ${ordinal(effect.every!)} week` : 'Every week';
          mine.own.push({ label: when + suffix, op: 'budget', value: effect.budget, from: [] });
        }
      }
      break;
    case 'conditional':
      if (meetsCondition(content, layout, effect.when, piece.uid)) {
        applyEffect(
          ctx,
          piece,
          def,
          effect.effect,
          `${suffix} (${conditionText(content, effect.when)})`,
          since,
        );
      }
      break;
    case 'link':
    case 'transform':
    case 'requires':
      break;
  }
}

/** The pieces whose every tile is in one of the fenced yards this piece borders. */
function regionTargets(layout: Layout, uid: number): number[] {
  const yards = new Set(fencedYardsBordered(layout, uid));
  if (yards.size === 0) return [];
  const w = layout.house.lot.width;
  const out: number[] = [];
  for (const p of layout.house.pieces) {
    if (p.uid === uid) continue;
    const cells = layout.cells.get(p.uid)!;
    if (cells.every((c) => yards.has(layout.fencedId[c.y * w + c.x]!))) out.push(p.uid);
  }
  return out;
}

/** The neighbors in `matched` that physically touch the piece first, the linked ones after. */
function touchingFirst(layout: Layout, uid: number, matched: readonly Neighbor[]): Neighbor[] {
  const touching = layout.touching.get(uid)!;
  const touches = (n: Neighbor) =>
    n.kind !== 'piece' || touching.some((t) => t.kind === 'piece' && t.uid === n.uid);
  return [...matched.filter(touches), ...matched.filter((n) => !touches(n))];
}

function neighborLabel(
  content: Content,
  layout: Layout,
  piece: PlacedPiece,
  matched: readonly Neighbor[],
): string {
  // A room sees out of its window; a yard piece (a Pergola's Patio) just has the view.
  const view =
    pieceDef(content, piece).category === 'indoor' ? 'the view from its window' : 'the view';
  const names = matched.map((n) =>
    n.kind === 'piece'
      ? pieceDef(content, layout.byUid.get(n.uid)!).name
      : n.kind === 'view'
        ? view
        : n.kind === 'street'
          ? neighborName(content, 'street')
          : neighborName(content, n.feature),
  );
  return `Touching ${countedNames(names)}`;
}

/** The fixed ×Mult order (D-056): sets, then fixtures, then blueprints, then this week's tools. */
const XMULT_ORDER: Record<XMultTerm['source']['kind'], number> = {
  set: 0,
  fixture: 1,
  blueprint: 2,
  tool: 3,
  upgrade: 4,
  crew: 4,
  client: 4,
  changeOrder: 4,
  lot: 4,
};

/** A source as a key, so one source multiplies the week once (two Chandeliers are one source). */
function sourceKey(source: ModSource): string {
  return `${source.kind}:${source.id}`;
}

/** Every modifier in play: the run's, then each installed fixture's on its host. */
function allModifiers(content: Content, layout: Layout, run: readonly ActiveMod[]): ActiveMod[] {
  const out = [...run];
  for (const piece of layout.house.pieces) {
    if (!piece.fixture) continue;
    const def = content.fixtures[piece.fixture.id];
    if (!def) throw new Error(`Unknown fixture "${piece.fixture.id}"`);
    const source: ModSource = { kind: 'fixture', id: def.id, uid: piece.uid };
    for (const mod of def.modifiers) {
      out.push({ mod, source, since: piece.fixture.week, host: piece.uid });
    }
  }
  return out;
}

/** How many placed pieces match a selector (for `per` and `perCountOver`). */
function countPieces(content: Content, layout: Layout, sel: Selector, host?: number): number {
  let n = 0;
  for (const p of layout.house.pieces) if (matchesPiece(content, layout, sel, p.uid, host)) n++;
  return n;
}

/**
 * Tallies the house as it stands in `week` (timers count from each piece's placement week),
 * with the run's modifiers. Without lines it's the cheap path for scoreOnly() and bots.
 */
export function tallyHouse(
  content: Content,
  layout: Layout,
  week: number,
  withLines: boolean,
  tc: TallyContext = NO_CONTEXT,
): Tally {
  const { pieces } = layout.house;
  const mods = allModifiers(content, layout, tc.mods);
  const acc = new Map<number, Acc>();
  for (const piece of pieces) {
    acc.set(piece.uid, {
      points: 0,
      pct: 0,
      budget: 0,
      own: [],
      auras: [],
      mods: [],
      auraAt: new Map(),
    });
  }

  // Granted effects and blocked penalties, per piece.
  const granted = new Map<number, Granted[]>();
  const blocks = new Map<number, { from: Selector; host?: number }[]>();
  for (const m of mods) {
    if (m.mod.kind !== 'grantEffect' && m.mod.kind !== 'blockPenalties') continue;
    for (const piece of pieces) {
      if (!matchesPiece(content, layout, m.mod.target, piece.uid, m.host)) continue;
      if (m.mod.kind === 'grantEffect') {
        let list = granted.get(piece.uid);
        if (!list) granted.set(piece.uid, (list = []));
        list.push({ effect: m.mod.effect, since: m.since, label: sourceName(content, m.source) });
      } else {
        let list = blocks.get(piece.uid);
        if (!list) blocks.set(piece.uid, (list = []));
        list.push({ from: m.mod.from, host: m.host });
      }
    }
  }

  const ctx: Ctx = { content, layout, week, withLines, acc, blocks };
  const unmet = new Map<number, string>();

  const perLevel = content.balance.renovate.pointsPerLevel;
  for (const piece of pieces) {
    const def = pieceDef(content, piece);
    const failed = unmetRequirement(content, layout, def, piece.uid);
    if (failed) {
      unmet.set(piece.uid, conditionText(content, failed.condition));
      continue;
    }
    for (const effect of def.effects) applyEffect(ctx, piece, def, effect, '');
    for (const g of granted.get(piece.uid) ?? []) {
      applyEffect(ctx, piece, def, g.effect, ` (${g.label})`, g.since);
    }
    // Renovations (M4a): flat Comfort per level, before percentages.
    if (piece.level) {
      const a = acc.get(piece.uid)!;
      a.points += perLevel * piece.level;
      if (withLines) {
        a.own.push({
          label: `Renovated (level ${piece.level})`,
          op: 'add',
          value: perLevel * piece.level,
          from: [],
        });
      }
    }
  }

  // Percentage modifiers, earnNothing, and budget modifiers, per piece.
  const nothing = new Map<number, string>();
  const budgetPct = new Map<number, number>();
  const labels = withLines ? earnLabels(content, mods) : null;
  for (const m of mods) {
    const { mod } = m;
    if (mod.kind === 'earn') {
      if (mod.when === 'lastWeekOfPhase' && !tc.lastWeek) continue;
      for (const piece of pieces) {
        if (!matchesPiece(content, layout, mod.target, piece.uid, m.host)) continue;
        const a = acc.get(piece.uid)!;
        a.pct += mod.pct;
        if (labels) a.mods.push({ label: labels.get(m)!, op: 'pct', value: mod.pct, from: [] });
      }
    } else if (mod.kind === 'perCountOver') {
      const over = countPieces(content, layout, mod.match, m.host) - mod.over;
      if (over <= 0) continue;
      for (const piece of pieces) {
        if (!matchesPiece(content, layout, mod.match, piece.uid, m.host)) continue;
        const a = acc.get(piece.uid)!;
        a.pct += mod.pct * over;
        if (withLines) {
          a.mods.push({
            label: `${sourceName(content, m.source)} (${over} over ${mod.over})`,
            op: 'pct',
            value: mod.pct * over,
            from: [],
          });
        }
      }
    } else if (mod.kind === 'earnNothing') {
      for (const piece of pieces) {
        if (matchesPiece(content, layout, mod.target, piece.uid, m.host)) {
          nothing.set(piece.uid, sourceName(content, m.source));
        }
      }
    } else if (mod.kind === 'budget') {
      for (const piece of pieces) {
        if (mod.target !== 'all' && !matchesPiece(content, layout, mod.target, piece.uid, m.host)) {
          continue;
        }
        budgetPct.set(piece.uid, (budgetPct.get(piece.uid) ?? 0) + mod.pct);
      }
    }
  }

  let budget = 0;
  const scores: PieceScore[] = pieces.map((piece) => {
    const a = acc.get(piece.uid)!;
    const why = unmet.get(piece.uid);
    const zeroedBy = nothing.get(piece.uid);
    const pieceBudget =
      why === undefined && a.budget !== 0
        ? roundHalfUp(a.budget * Math.max(0, 100 + (budgetPct.get(piece.uid) ?? 0)), 100)
        : 0;
    budget += pieceBudget;
    // An unmet requirement zeroes the piece, so its only line says why.
    let lines: BreakdownLine[] = [];
    if (withLines) {
      lines =
        why === undefined
          ? [...a.own, ...a.auras, ...a.mods]
          : [{ label: `Earns nothing: it must be ${why}`, op: 'none', value: 0, from: [] }];
      if (why === undefined && zeroedBy !== undefined) {
        lines.push({ label: `Earns nothing (${zeroedBy})`, op: 'none', value: 0, from: [] });
      }
    }
    return {
      uid: piece.uid,
      defId: piece.defId,
      points: a.points,
      pct: a.pct,
      earned: why === undefined && zeroedBy === undefined ? earnedFor(a.points, a.pct) : 0,
      budget: pieceBudget,
      ...(why !== undefined ? { unmet: why } : {}),
      lines,
    };
  });

  // Crown Jewel: the week's top earner, after every other term. Ties go to the earliest placed.
  let best: Tally['best'] = null;
  let bestPct = 0;
  const bestNames: string[] = [];
  for (const m of mods) {
    if (m.mod.kind === 'bestPiece') {
      bestPct += m.mod.pct;
      bestNames.push(sourceName(content, m.source));
    }
  }
  if (bestPct !== 0) {
    let top = -1;
    for (let k = 0; k < scores.length; k++) {
      if (scores[k]!.earned > 0 && (top < 0 || scores[k]!.earned > scores[top]!.earned)) top = k;
    }
    if (top >= 0) {
      const s = scores[top]!;
      const after = earnedFor(s.earned, bestPct);
      best = { uid: s.uid, pct: bestPct, before: s.earned, after };
      scores[top] = {
        ...s,
        earned: after,
        lines: withLines
          ? [
              ...s.lines,
              { label: `${bestNames.join(', ')}: top earner`, op: 'pct', value: bestPct, from: [] },
            ]
          : s.lines,
      };
    }
  }

  // Sets, at their level, scaled by setBonus.
  const sets = matchSets(content, layout, tc.setLevels).map((s) => {
    let pct = 0;
    for (const { mod } of mods) {
      if (mod.kind === 'setBonus' && (mod.set === undefined || mod.set === s.set)) pct += mod.pct;
    }
    return pct === 0 ? s : { ...s, points: earnedFor(s.points, pct), mult: earnedFor(s.mult, pct) };
  });
  let points = 0;
  for (const s of scores) points += s.earned;
  let mult = 100;
  for (const s of sets) {
    points += s.points;
    mult += s.mult;
  }

  // Specs (M4a): each line of the client's checklist that holds adds specBonus.
  const met = specsMet(content, layout, tc.specs, tc.phase);
  const specBonus = tc.specs.length > 0 ? ruleFrom(content, mods, 'specBonus') : 0;
  const specs: SpecScore[] = tc.specs.map((s, k) => ({ id: s.id, met: met[k]! }));
  for (const s of specs) if (s.met) mult += specBonus;

  // +Mult modifiers.
  const multTerms: MultTerm[] = [];
  for (const m of mods) {
    if (m.mod.kind !== 'mult') continue;
    const n = m.mod.per ? countPieces(content, layout, m.mod.per, m.host) : 1;
    const add = m.mod.add * n;
    if (add === 0) continue;
    mult += add;
    multTerms.push({
      source: m.source,
      label: m.mod.per ? `${sourceName(content, m.source)} (${n})` : sourceName(content, m.source),
      add,
    });
  }

  // ×Mult: each distinct source once, in the fixed order.
  const found = new Map<string, { source: ModSource; times: number; order: number; at: number }>();
  mods.forEach((m, at) => {
    const { mod } = m;
    if (mod.kind !== 'xMult') return;
    const key = sourceKey(m.source);
    if (found.has(key)) return;
    if (mod.when === 'lastWeekOfPhase' && !tc.lastWeek) return;
    if (typeof mod.when === 'object') {
      if (m.host === undefined) return;
      // A fixture's condition on its host; with several hosts, any one is enough.
      const cond = mod.when.host;
      const hosts = mods
        .filter((o) => o.mod === mod && o.host !== undefined && sourceKey(o.source) === key)
        .map((o) => o.host!);
      if (!hosts.some((h) => meetsCondition(content, layout, cond, h, h))) return;
    }
    let times = mod.times;
    if (mod.plusPer) {
      const per = mod.plusPer.per;
      const n =
        per === 'milestonesEarly' ? tc.stats[per] : countPieces(content, layout, per, m.host);
      times += mod.plusPer.add * n;
    }
    if (times === 100) return;
    found.set(key, { source: m.source, times, order: XMULT_ORDER[m.source.kind], at });
  });
  const xMults: XMultTerm[] = [];
  // Sets first (D-056): a held set with a ×Mult (Full House) multiplies once per set type.
  const setTimes = new Set<SetId>();
  for (const s of sets) {
    const def = content.sets[s.set];
    if (def.times === undefined || def.times === 100 || setTimes.has(s.set)) continue;
    setTimes.add(s.set);
    const before = mult;
    mult = Math.floor((Math.max(0, mult) * def.times + 50) / 100);
    xMults.push({
      source: { kind: 'set', id: s.set },
      label: def.name,
      times: def.times,
      before,
      after: mult,
    });
  }
  for (const x of [...found.values()].sort((a, b) => a.order - b.order || a.at - b.at)) {
    const before = mult;
    mult = Math.floor((Math.max(0, mult) * x.times + 50) / 100);
    xMults.push({
      source: x.source,
      label: sourceName(content, x.source),
      times: x.times,
      before,
      after: mult,
    });
  }

  return {
    pieces: scores,
    sets,
    specs,
    specBonus,
    multTerms,
    xMults,
    best,
    points,
    mult,
    total: weekTotal(points, mult),
    budget,
  };
}
