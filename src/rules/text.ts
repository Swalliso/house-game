// Rules text generated from content data (D-038): card text and the labels on breakdown lines.
// Plain language, such as "+1 per touching Tree or Quiet neighbor (up to 3)".

import type {
  BlueprintDef,
  Card,
  ChangeOrderDef,
  Content,
  CrateDef,
  Effect,
  FeatureId,
  FixtureDef,
  HouseCondition,
  LotTraitDef,
  Modifier,
  PieceCondition,
  PieceDef,
  PieceId,
  Property,
  Region,
  Reward,
  RuleKey,
  Selector,
  SetId,
  SpecDef,
  SunSide,
  Tag,
  ToolDef,
  UpgradeDef,
} from './index.ts';
import { SCORE_LABELS } from '../content/labels.ts';

const PROPERTY_NOUNS: Record<Property, [one: string, many: string]> = {
  indoor: ['indoor piece', 'indoor pieces'],
  yard: ['yard piece', 'yard pieces'],
  outbuilding: ['outbuilding', 'outbuildings'],
  room: ['room', 'rooms'],
  exterior: ['exterior room', 'exterior rooms'],
  interior: ['interior room', 'interior rooms'],
  view: ['piece with a view', 'pieces with a view'],
  viewSource: ['view', 'views'],
};

const REGION_TEXT: Record<Region, string> = {
  sunny: 'in the sun',
  frontYard: 'in the front yard',
  backYard: 'in the back yard',
  fencedYard: 'in a fenced yard',
};

/** "in the front yard", "in the sun". */
export function regionText(region: Region): string {
  return REGION_TEXT[region];
}

/**
 * The side of the lot the sun shines from, and so the wall of a building that faces it (D-120):
 * "back", "front" (the street's side), "left", or "right".
 */
export function sunSideText(side: SunSide): string {
  return side === 'top' ? 'back' : side === 'bottom' ? 'front' : side;
}

/** 2 → "2nd", 3 → "3rd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** How a selector reads: `one` "Tree or Quiet neighbor", `some` "Trees or Quiet neighbors", `every` "Trees and Quiet neighbors". */
export type Phrasing = 'one' | 'some' | 'every';

function plural(name: string): string {
  if (name.endsWith('s')) return name;
  // Library → Libraries, Nursery → Nurseries; Driveway stays Driveways.
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

function featureNoun(content: Content, id: FeatureId, many: boolean): string {
  const def = content.features[id];
  if (id === 'street') return 'the street';
  if (def.body) return `the ${def.name}`;
  return many ? plural(def.name) : def.name;
}

/** What carries a tag: the lot's features first ("the street"), then pieces ("Garages"). */
function tagged(content: Content, tag: Tag): string[] {
  const features = Object.values(content.features)
    .filter((f) => f.tags.includes(tag) && !f.inert)
    .map((f) => featureNoun(content, f.id, true));
  const pieces = Object.values(content.pieces)
    .filter((p) => p.tags.includes(tag) && !p.countsAs)
    .map((p) => plural(p.name));
  return [...features, ...pieces];
}

function joinWords(words: readonly string[], conj: 'or' | 'and'): string {
  if (words.length <= 1) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} ${conj} ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, ${conj} ${words[words.length - 1]}`;
}

export function selectorText(content: Content, sel: Selector, phrasing: Phrasing = 'one'): string {
  const many = phrasing !== 'one';
  const conj = phrasing === 'every' ? 'and' : 'or';
  if (sel === 'all') return many ? 'neighbors' : 'neighbor';
  if ('piece' in sel) {
    const ids = typeof sel.piece === 'string' ? [sel.piece] : sel.piece;
    return joinWords(
      ids.map((id) => (many ? plural(content.pieces[id].name) : content.pieces[id].name)),
      conj,
    );
  }
  if ('feature' in sel) {
    const ids = typeof sel.feature === 'string' ? [sel.feature] : sel.feature;
    return joinWords(
      ids.map((id) => featureNoun(content, id, many)),
      conj,
    );
  }
  if ('tag' in sel) return `${sel.tag} ${many ? 'neighbors' : 'neighbor'}`;
  if ('property' in sel) return PROPERTY_NOUNS[sel.property][many ? 1 : 0];
  if ('host' in sel) return many ? 'its piece' : 'its piece';
  if ('hasFixture' in sel) {
    const what =
      sel.hasFixture === 'any' ? 'a fixture' : article(content.fixtures[sel.hasFixture].name);
    return `${many ? 'pieces' : 'piece'} with ${what}`;
  }
  if ('in' in sel) return `${many ? 'pieces' : 'piece'} ${regionText(sel.in)}`;
  if ('touching' in sel) {
    const min = sel.min ?? 1;
    const what = selectorText(content, sel.touching, min === 1 ? 'one' : 'some');
    return `${many ? 'pieces' : 'piece'} touching ${min === 1 ? article(what) : `${min} ${what}`}`;
  }
  if ('any' in sel)
    return joinWords(
      sel.any.map((s) => selectorText(content, s, phrasing)),
      conj,
    );
  if ('all' in sel) {
    // Tags read as adjectives on the one noun: "Sunny room". "Gives a view" reads as a
    // clause on the rest: "yard pieces that give a view".
    const isSource = (s: Selector) => s !== 'all' && 'property' in s && s.property === 'viewSource';
    if (sel.all.some(isSource) && sel.all.length > 1) {
      const others = sel.all.filter((s) => !isSource(s));
      const noun = selectorText(content, { all: others }, phrasing);
      return `${noun} that ${many ? 'give' : 'gives'} a view`;
    }
    // "Rooms with a view": having one reads as a clause on the rest too.
    const isView = (s: Selector) => s !== 'all' && 'property' in s && s.property === 'view';
    if (sel.all.some(isView) && sel.all.length > 1) {
      const others = sel.all.filter((s) => !isView(s));
      return `${selectorText(content, { all: others }, phrasing)} with a view`;
    }
    // "Doghouses in a fenced yard": so does being in a region (M4b's change orders).
    const region = sel.all.find((s): s is { in: Region } => s !== 'all' && 'in' in s);
    if (region && sel.all.length > 1) {
      const others = sel.all.filter((s) => s !== region);
      return `${selectorText(content, { all: others }, phrasing)} ${regionText(region.in)}`;
    }
    const tags = sel.all.filter((s): s is { tag: Tag } => s !== 'all' && 'tag' in s);
    // "Kid neighbor other than Treehouses": an excluded part reads as a clause at the end.
    const nots = sel.all.filter((s): s is { not: Selector } => s !== 'all' && 'not' in s);
    if (nots.length > 0 && nots.length < sel.all.length) {
      const others = sel.all.filter((s) => s === 'all' || !('not' in s));
      const head = selectorText(content, { all: others }, phrasing);
      const except = joinWords(
        nots.map((n) => selectorText(content, n.not, 'some')),
        'or',
      );
      return `${head} other than ${except}`;
    }
    // "Exterior room" already says "room".
    const isProp = (s: Selector, p: Property) => s !== 'all' && 'property' in s && s.property === p;
    const roomKind = sel.all.some((s) => isProp(s, 'exterior') || isProp(s, 'interior'));
    const rest = sel.all.filter(
      (s) => (s === 'all' || !('tag' in s)) && !(roomKind && isProp(s, 'room')),
    );
    const noun =
      rest.length === 0
        ? many
          ? 'neighbors'
          : 'neighbor'
        : joinWords(
            rest.map((s) => selectorText(content, s, phrasing)),
            'and',
          );
    return [...tags.map((t) => t.tag), noun].join(' ');
  }
  return `anything but ${selectorText(content, sel.not, 'some')}`;
}

function signed(n: number): string {
  return n < 0 ? `−${-n}` : `+${n}`;
}

/**
 * Whether a name (the first, in a list) is a possessive: "Grandma’s Room" is already definite,
 * so it takes no article. A plural possessive (a "Kids’ Room") still does.
 */
function isPossessive(noun: string): boolean {
  const first = noun.split(/,|\s(?:or|and)\s/)[0] ?? noun;
  return /['’]s\b/.test(first);
}

/**
 * "a Kitchen", "an Office", "an L-Kitchen" (a letter read aloud: "el"), and "Grandma’s Room": a
 * possessive name takes no article.
 */
export function article(noun: string): string {
  if (noun.startsWith('the ') || isPossessive(noun)) return noun;
  return /^([AEIOU]|[AEFHILMNORSX]-)/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

/**
 * A piece's name after "the" (or "this", "that"): "the Kitchen", "this Bedroom". A possessive
 * name stands alone: "Renovate Grandma’s Room", never "the Grandma’s Room".
 */
export function definite(noun: string, word: 'the' | 'this' | 'that' = 'the'): string {
  return isPossessive(noun) ? noun : `${word} ${noun}`;
}

/** "touching the street or a Driveway", "in the front yard", "bordering a fenced yard". */
export function conditionText(content: Content, cond: PieceCondition): string {
  if ('and' in cond)
    return joinWords(
      cond.and.map((c) => conditionText(content, c)),
      'and',
    );
  if ('or' in cond)
    return joinWords(
      cond.or.map((c) => conditionText(content, c)),
      'or',
    );
  if ('not' in cond) return `not ${conditionText(content, cond.not)}`;
  if ('touching' in cond) {
    const min = cond.min ?? 1;
    if (min === 1) {
      const parts =
        typeof cond.touching === 'object' && 'any' in cond.touching
          ? cond.touching.any.map((s) => article(selectorText(content, s, 'one')))
          : [article(selectorText(content, cond.touching, 'one'))];
      return `touching ${joinWords(parts, 'or')}`;
    }
    return `touching ${min} ${selectorText(content, cond.touching, 'some')}`;
  }
  if ('in' in cond) return regionText(cond.in);
  if ('borders' in cond) return 'bordering a fenced yard';
  if ('is' in cond) {
    // A tag the piece has reads as the tag itself: "Sunny".
    if (cond.is !== 'all' && 'tag' in cond.is) return cond.is.tag;
    return article(selectorText(content, cond.is, 'one'));
  }
  return `part of ${article(content.sets[cond.inSet].name)}`;
}

/** A count's noun, for "exactly" and "at most": "one Library", "3 Dark rooms". */
function counted(content: Content, sel: Selector, n: number): string {
  return n === 1
    ? `one ${selectorText(content, sel, 'one')}`
    : `${n} ${selectorText(content, sel, 'some')}`;
}

/**
 * A house condition as card text (specs, and M4b's requests): "3 or more Dark rooms", "a
 * Kitchen beside a Dining Room". The house rules carry their own text (content/house-rules.ts).
 */
export function houseConditionText(content: Content, cond: HouseCondition): string {
  if ('and' in cond)
    return joinWords(
      cond.and.map((c) => houseConditionText(content, c)),
      'and',
    );
  if ('or' in cond)
    return joinWords(
      cond.or.map((c) => houseConditionText(content, c)),
      'or',
    );
  if ('not' in cond) return `not ${houseConditionText(content, cond.not)}`;
  if ('stages' in cond) {
    return cond.stages
      .map((st, k) => {
        const text = houseConditionText(content, st.condition);
        return k === 0 && st.fromPhase === 0
          ? text
          : `from ${content.balance.phases[st.fromPhase]?.name ?? `phase ${st.fromPhase + 1}`}, ${text}`;
      })
      .join('; ');
  }
  if ('count' in cond) {
    const { min, max } = cond;
    const many = selectorText(content, cond.count, 'some');
    if (min !== undefined && max !== undefined) {
      return min === max ? `exactly ${counted(content, cond.count, min)}` : `${min}–${max} ${many}`;
    }
    if (max !== undefined)
      return max === 0 ? `no ${many}` : `at most ${counted(content, cond.count, max)}`;
    const n = min ?? 0;
    return n <= 1 ? article(selectorText(content, cond.count, 'one')) : `${n} or more ${many}`;
  }
  if ('countNew' in cond) {
    return cond.min === 1
      ? `a new ${selectorText(content, cond.countNew, 'one')}`
      : `${cond.min} new ${selectorText(content, cond.countNew, 'some')}`;
  }
  if ('none' in cond) return `no ${selectorText(content, cond.none, 'some')}`;
  if ('adjacentPair' in cond) {
    const [a, b] = cond.adjacentPair;
    return `${article(selectorText(content, a, 'one'))} beside ${article(selectorText(content, b, 'one'))}`;
  }
  if ('fencedYardTiles' in cond) {
    const min = cond.fencedYardTiles.min;
    return min <= content.balance.fencedYardMin
      ? 'a fenced yard'
      : `a fenced yard of ${min} or more tiles`;
  }
  if ('group' in cond) {
    return `${cond.minTiles} or more tiles of ${selectorText(content, cond.group, 'some')} in one group`;
  }
  if ('set' in cond) {
    const n = cond.min ?? 1;
    const name = content.sets[cond.set].name;
    return n === 1 ? article(name) : `${n} ${plural(name)}`;
  }
  if ('demolishedSinceAccepted' in cond) {
    const n = cond.demolishedSinceAccepted.min;
    return `demolish ${n === 1 ? 'a piece' : `${n} pieces`}`;
  }
  if ('ratio' in cond) {
    const r = cond.ratio;
    const each = r.every === 1 ? '' : `${r.every} `;
    const least = r.min ? ` (at least ${r.min})` : '';
    return `${article(selectorText(content, r.count, 'one'))} for every ${each}${selectorText(content, r.per, r.every === 1 ? 'one' : 'some')}${least}`;
  }
  if ('outline' in cond) {
    const o = cond.outline;
    const rooms =
      o.maxRooms === undefined ? `${o.minRooms}+ rooms` : `${o.minRooms}–${o.maxRooms} rooms`;
    const long =
      o.maxAspect === 1
        ? 'longer than'
        : o.maxAspect === 2
          ? 'longer than twice'
          : `longer than ${o.maxAspect} times`;
    return `${rooms}, filling at least ${o.minFillPct}% of their box, and the box is no ${long} its width`;
  }
  const v = cond.variety;
  return `${v.min} or more ${selectorText(content, v.of, 'some')}, and none of a type stands ${v.maxEach + 1} or more times`;
}

/** A checklist line's card text: its own, or generated from its condition. */
export function specText(content: Content, spec: SpecDef): string {
  const text = spec.text ?? houseConditionText(content, spec.condition);
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

export function effectText(content: Content, effect: Effect): string {
  switch (effect.kind) {
    case 'steady':
      return `${signed(effect.amount)} every week`;
    case 'neighbor': {
      const what = selectorText(content, effect.match, 'one');
      if (effect.max === 1) return `${signed(effect.amount)} if touching ${article(what)}`;
      const cap = effect.max === undefined ? '' : ` (up to ${effect.max})`;
      return `${signed(effect.amount)} per touching ${what}${cap}`;
    }
    case 'aura': {
      const who = selectorText(content, effect.match, 'every');
      const parts: string[] = [];
      if (effect.pct) parts.push(`earn ${signed(effect.pct)}%`);
      if (effect.amount) parts.push(`get ${signed(effect.amount)}`);
      if (effect.scope === 'region') {
        const subject = who.replace(/\bneighbors\b/, 'pieces');
        return `${subject.charAt(0).toUpperCase() + subject.slice(1)} in the fenced yard it borders ${parts.join(' and ')}`;
      }
      return `Touching ${who} ${parts.join(' and ')}`;
    }
    case 'rhythm':
      return `${signed(effect.amount)} every ${ordinal(effect.every)} week`;
    case 'growth': {
      const cap = effect.max === undefined ? '' : ` (up to ${signed(effect.max)})`;
      return `${signed(effect.perWeek)} more each week it stands${cap}`;
    }
    case 'enclosure': {
      const cap = effect.cap === undefined ? '' : ` (up to ${signed(effect.cap)})`;
      return `${signed(effect.perTile)} per tile of the fenced yards it borders${cap}`;
    }
    case 'transform': {
      const into =
        'piece' in effect.into
          ? article(content.pieces[effect.into.piece].name)
          : article(content.features[effect.into.feature].name);
      return `Becomes ${into} after ${effect.afterWeeks} weeks`;
    }
    case 'economy': {
      const every = effect.every ?? 1;
      return `${signed(effect.budget)} budget every ${every > 1 ? `${ordinal(every)} ` : ''}week`;
    }
    case 'perTile':
      return `${signed(effect.amount)} per tile ${regionText(effect.region)}`;
    case 'link':
      return 'Links the rooms it touches: they count as touching each other';
    case 'requires': {
      const what = conditionText(content, effect.condition);
      return effect.blocksPlacement ? `Must be built ${what}` : `Earns nothing unless ${what}`;
    }
    case 'conditional': {
      const inner = effectText(content, effect.effect);
      // A region aura already says where it reaches (the Mudroom's fenced yard).
      const said =
        'borders' in effect.when &&
        effect.effect.kind === 'aura' &&
        effect.effect.scope === 'region';
      return said ? inner : `${inner} ${conditionPhrase(content, effect.when)}`;
    }
  }
}

/** A condition as a trailing phrase: "in the front yard", "if touching a Tree", "while Sunny". */
function conditionPhrase(content: Content, cond: PieceCondition): string {
  if ('in' in cond) return regionText(cond.in);
  if ('is' in cond) return `while ${conditionText(content, cond)}`;
  return `if ${conditionText(content, cond)}`;
}

function selectorTags(sel: Selector, out: Set<Tag>, props: Set<Property>): void {
  if (sel === 'all' || 'host' in sel || 'hasFixture' in sel) return;
  if ('tag' in sel) out.add(sel.tag);
  else if ('property' in sel) props.add(sel.property);
  else if ('touching' in sel) selectorTags(sel.touching, out, props);
  else if ('any' in sel) sel.any.forEach((s) => selectorTags(s, out, props));
  else if ('all' in sel) sel.all.forEach((s) => selectorTags(s, out, props));
  else if ('not' in sel) selectorTags(sel.not, out, props);
}

function conditionTags(cond: PieceCondition, out: Set<Tag>, props: Set<Property>): void {
  if ('and' in cond) cond.and.forEach((c) => conditionTags(c, out, props));
  else if ('or' in cond) cond.or.forEach((c) => conditionTags(c, out, props));
  else if ('not' in cond) conditionTags(cond.not, out, props);
  else if ('touching' in cond) selectorTags(cond.touching, out, props);
  else if ('is' in cond) selectorTags(cond.is, out, props);
}

function effectTags(e: Effect, out: Set<Tag>, props: Set<Property>): void {
  if (e.kind === 'neighbor' || e.kind === 'aura') selectorTags(e.match, out, props);
  else if (e.kind === 'requires') conditionTags(e.condition, out, props);
  else if (e.kind === 'conditional') {
    conditionTags(e.when, out, props);
    effectTags(e.effect, out, props);
  }
}

export interface CardText {
  effects: string[];
  /** Reminders about lot features the effects mention: "The street is Loud." */
  notes: string[];
  /** A pack (D-106): how many tiles one card places. */
  pack?: string;
  /**
   * A member's room (M4b, D-103): whose it is, that it counts as a Bedroom, and from when Room
   * for everyone needs it: "The twins’ room: it counts as a Bedroom, and from Framing, Room for
   * everyone needs it."
   */
  member?: string;
}

/** The possessive of a member's name: "The twins’", "Grandma’s". */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}’` : `${name}’s`;
}

/** A member room's line (M4b): whose it is, and what Room for everyone asks of it. */
export function memberText(content: Content, def: PieceDef): string {
  const bedroom = article(content.pieces[def.countsAs ?? 'bedroom'].name);
  for (const client of Object.values(content.clients)) {
    for (const a of client.household.arrivals) {
      if (!a.room.includes(def.id)) continue;
      const phase = content.balance.phases[a.phase]?.name ?? `phase ${a.phase + 1}`;
      return `${possessive(a.name)} room: it counts as ${bedroom}, and from ${phase}, Room for everyone needs it.`;
    }
  }
  return `A household member’s room: it counts as ${bedroom}.`;
}

export function cardText(content: Content, def: PieceDef): CardText {
  const effects = def.effects.map((e) => {
    const text = effectText(content, e);
    // A room must join the house too, which "Must be built touching …" leaves out (playtest 4:
    // a Garage by the street read as if the street alone would do; since D-140 the Garage is
    // built like any room, and its line reads "Earns nothing unless …").
    const touching = 'Must be built touching ';
    return def.category === 'indoor' &&
      e.kind === 'requires' &&
      e.blocksPlacement &&
      text.startsWith(touching)
      ? `Must touch the house, and ${text.slice(touching.length)}`
      : text;
  });
  const pack = def.pack
    ? `A pack: click out up to ${def.pack.maxTiles} tiles that touch, one piece in one week.`
    : undefined;
  const member = def.member ? memberText(content, def) : undefined;
  const tags = new Set<Tag>();
  const props = new Set<Property>();
  for (const e of def.effects) effectTags(e, tags, props);
  const notes: string[] = [];
  const features = Object.values(content.features);
  for (const tag of tags) {
    const with_ = features.filter((f) => f.tags.includes(tag) && !f.inert);
    if (with_.length === 0) continue;
    const names = with_.map((f) => featureNoun(content, f.id, true));
    const singular = with_.length === 1 && isSingularFeature(with_[0]!.id);
    const sentence = `${joinWords(names, 'and')} ${singular ? 'is' : 'are'} ${tag}.`;
    notes.push(sentence.charAt(0).toUpperCase() + sentence.slice(1));
  }
  if (props.has('viewSource')) {
    const sources = [
      ...features.filter((f) => f.viewSource).map((f) => featureNoun(content, f.id, true)),
      ...Object.values(content.pieces)
        .filter((p) => p.givesView && !p.countsAs)
        .map((p) => plural(p.name)),
    ];
    notes.push(`Views: ${joinWords(sources, 'and')}.`);
  }
  return { effects, notes, ...(pack ? { pack } : {}), ...(member ? { member } : {}) };
}

/**
 * Does the effect pay: points, budget, or a boost to what it touches? A link, a requirement and
 * a change (the Sapling's) say how a piece works, not what it earns, and a penalty isn't pay.
 */
function pays(e: Effect): boolean {
  switch (e.kind) {
    case 'steady':
    case 'neighbor':
    case 'rhythm':
    case 'perTile':
      return e.amount > 0;
    case 'growth':
      return e.perWeek > 0;
    case 'enclosure':
      return e.perTile > 0;
    case 'economy':
      return e.budget > 0;
    case 'aura':
      return (e.pct ?? 0) > 0 || (e.amount ?? 0) > 0;
    case 'conditional':
      return pays(e.effect);
    case 'link':
    case 'requires':
    case 'transform':
      return false;
  }
}

/**
 * A compact hand card's lines (D-121); Inspect has the whole text. A piece shows its first line
 * that pays, so a Hallway shows "+2 per touching room (up to 4)" rather than its link, and the
 * Driveway what it pays rather than where it must start (the lot shows that). A requirement that
 * isn't about placement follows the pay, since without it the piece earns nothing: the
 * Doghouse's "+1 every week in a fenced yard", and the Garage's "+5 by the street or a
 * Driveway" (D-140). A piece with no line that pays shows its first.
 * A fixture shows where it goes and its first effect, which is what it does to its room (Makes
 * it Sunny, Counts as 2 Bedrooms); its "Earns +25%" is in Inspect.
 */
export function handCardLines(content: Content, card: Card): string[] {
  if (card.kind === 'fixture') {
    const t = fixtureText(content, content.fixtures[card.id]);
    return [t.fits, ...t.effects.slice(0, 1)];
  }
  const def = content.pieces[card.id];
  const lines = cardText(content, def).effects;
  const i = def.effects.findIndex(pays);
  if (i < 0) return lines.slice(0, 1);
  const unless = def.effects.find(
    (e): e is Extract<Effect, { kind: 'requires' }> => e.kind === 'requires' && !e.blocksPlacement,
  );
  if (!unless) return [lines[i]!];
  // A steady earner that waits on touching something says both in a few words (D-140): the
  // Garage's "+5 by the street or a Driveway" fits the card's two lines at every window size,
  // where "+5 every week if touching the street or a Driveway" lost its last words.
  const pay = def.effects[i]!;
  if (pay.kind === 'steady' && 'touching' in unless.condition) {
    const what = conditionText(content, unless.condition).replace(/^touching /, '');
    return [`${signed(pay.amount)} by ${what}`];
  }
  return [`${lines[i]} ${conditionPhrase(content, unless.condition)}`];
}

/** "The street is", "the Pond is", but "Trees are". */
function isSingularFeature(id: FeatureId): boolean {
  return id === 'street' || id === 'pond' || id === 'creek';
}

/** "2 Trees, a Bedroom, and the Creek", for breakdown labels. */
export function countedNames(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const parts = [...counts].map(([name, n]) => {
    if (name.startsWith('the ')) return name;
    return n === 1 ? article(name) : `${n} ${plural(name)}`;
  });
  return joinWords(parts, 'and');
}

export function neighborName(content: Content, feature: FeatureId): string {
  return featureNoun(content, feature, false);
}

// ---------------------------------------------------------------------------------------
// D-122: what a room card plugs into.

/**
 * The sets a piece counts toward (an L-Kitchen's are a Kitchen's), the ones whose members touch
 * first, in content order, then the ones anywhere in the house (Full House).
 */
export function setsOfPiece(content: Content, id: PieceId): SetId[] {
  const def = content.pieces[id];
  const type = def.countsAs ?? def.id;
  const sets = Object.values(content.sets).filter((s) => (s.members[type] ?? 0) > 0);
  return [...sets.filter((s) => s.connected), ...sets.filter((s) => !s.connected)].map((s) => s.id);
}

/**
 * A set in a few sentences, for a card's set chip: "Suite: a Bedroom, a Bathroom, and a Closet,
 * touching. +15 Comfort and +0.5 Charm every week. A house can have more than one."
 */
export function setText(content: Content, id: SetId): string {
  const set = content.sets[id];
  const names = Object.entries(set.members).flatMap(([piece, n]) =>
    Array<string>(n ?? 0).fill(content.pieces[piece as PieceId].name),
  );
  const how = set.hub
    ? `, each touching the ${content.pieces[set.hub].name}`
    : set.connected
      ? ', touching'
      : ', anywhere in the house';
  const { points, mult, xMult } = SCORE_LABELS;
  const pays =
    set.times !== undefined
      ? `+${set.points} ${points}, +${multNumber(set.mult)} ${mult}, and ×${multNumber(set.times)} ${xMult}`
      : `+${set.points} ${points} and +${multNumber(set.mult)} ${mult}`;
  const repeats = set.maxInstances === 1 ? 'One per house.' : 'A house can have more than one.';
  return `${set.name}: ${countedNames(names)}${how}. ${pays} every week. ${repeats}`;
}

// ---------------------------------------------------------------------------------------
// Modifiers: blueprints, fixtures, and (from M3b) tools and upgrades.

/** Mult in hundredths as players read it: 15 → "0.15", 50 → "0.5", 200 → "2". */
export function multNumber(hundredths: number): string {
  const sign = hundredths < 0 ? '−' : '';
  const a = Math.abs(hundredths);
  const whole = Math.floor(a / 100);
  const frac = a % 100;
  if (frac === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

const isHost = (sel: Selector) => sel !== 'all' && 'host' in sel;

/** A modifier's target as the subject of a sentence: "Quiet pieces", "Dark rooms", "Rooms". */
function subjectText(content: Content, sel: Selector): string {
  if (sel === 'all') return 'Every piece';
  const text = selectorText(content, sel, 'some').replace(/\bneighbors\b/, 'pieces');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A fixture's host-plus-something target, as a phrase: "in a Living Room or Library". */
function hostExtra(content: Content, sel: Selector): string | null {
  if (sel === 'all' || !('all' in sel)) return null;
  const rest = sel.all.filter((s) => !isHost(s));
  if (rest.length !== sel.all.length - 1 || rest.length !== 1) return null;
  const r = rest[0]!;
  if (r !== 'all' && 'in' in r) return regionText(r.in);
  return `in ${article(selectorText(content, r, 'one'))}`;
}

/**
 * What an `earn` modifier is for, so its breakdown line can be told from its source's others
 * ("Heat wave (Pools)", "Heat wave (touching a Tree)"): "Dark pieces", "touching a Tree", "in a
 * Living Room or Library". Null for a fixture's own piece, which the fixture's name already says.
 */
export function earnTargetText(content: Content, sel: Selector): string | null {
  if (sel === 'all') return 'every piece';
  if (isHost(sel)) return null;
  const extra = hostExtra(content, sel);
  if (extra) return extra;
  const text = selectorText(content, sel, 'some').replace(/\bneighbors\b/, 'pieces');
  return 'touching' in sel ? text.replace(/^pieces /, '') : text;
}

/** The piece types a selector names directly (`{ piece }`), or null. */
function pieceIds(sel: Selector): readonly PieceDef['id'][] | null {
  if (sel === 'all' || !('piece' in sel)) return null;
  return typeof sel.piece === 'string' ? [sel.piece] : sel.piece;
}

const RULE_TEXT: Record<RuleKey, (n: number) => string> = {
  rerollsPerPhase: (n) => `${signed(n)} ${n === 1 ? 'reroll' : 'rerolls'} every phase`,
  demolitions: (n) => `${signed(n)} ${n === 1 ? 'demolition' : 'demolitions'}`,
  overtime: (n) => `${signed(n)} overtime ${n === 1 ? 'week' : 'weeks'}`,
  roomsRow: (n) => `${signed(n)} Rooms ${n === 1 ? 'card' : 'cards'} every week`,
  layoutRow: (n) => `${signed(n)} Layout ${n === 1 ? 'card' : 'cards'} every week`,
  earlyRewardPct: (n) => `Completing early pays ${signed(n)}%`,
  reserveSlots: (n) => `${signed(n)} reserve ${n === 1 ? 'slot' : 'slots'}`,
  supplySlots: (n) => `${signed(n)} supply ${n === 1 ? 'slot' : 'slots'}`,
  blueprintSlots: (n) => `${signed(n)} blueprint ${n === 1 ? 'slot' : 'slots'}`,
  shopPricePct: (n) =>
    `Shop goods cost ${n < 0 ? -n : n}% ${n < 0 ? 'less' : 'more'} (not services or the refresh)`,
  specBonus: (n) =>
    `Each spec met adds ${n < 0 ? '−' : '+'}${multNumber(Math.abs(n))} more ${SCORE_LABELS.mult}`,
  interestMax: (n) => `At each milestone, +1 budget per 5 you hold (up to ${signed(n)})`,
};

/** A modifier as a sentence. Fixture modifiers target their host, so they read as "it". */
export function modifierText(content: Content, mod: Modifier): string {
  const { mult: CHARM } = SCORE_LABELS;
  switch (mod.kind) {
    case 'earn': {
      const when = mod.when === 'lastWeekOfPhase' ? ' in a phase’s last week' : '';
      if (isHost(mod.target)) return `Earns ${signed(mod.pct)}%${when}`;
      const extra = hostExtra(content, mod.target);
      if (extra) return `${signed(mod.pct)}% more ${extra}${when}`;
      return `${subjectText(content, mod.target)} earn ${signed(mod.pct)}%${when}`;
    }
    case 'bestPiece':
      return `Each week, your top earner earns ${signed(mod.pct)}%`;
    case 'mult': {
      const per = mod.per
        ? ` per ${selectorText(content, mod.per, 'one').replace(/\bneighbor\b/, 'piece')}`
        : '';
      return `${mod.add < 0 ? '−' : '+'}${multNumber(Math.abs(mod.add))} ${CHARM}${per}`;
    }
    case 'xMult': {
      let amount = `×${multNumber(mod.times)} ${CHARM}`;
      if (mod.plusPer) {
        const per = mod.plusPer.per;
        const what =
          per === 'milestonesEarly'
            ? 'milestone completed early'
            : selectorText(content, per, 'one').replace(/\bneighbor\b/, 'piece');
        amount = `×${multNumber(mod.times)} ${CHARM}, plus ${multNumber(mod.plusPer.add)} per ${what}`;
      }
      if (mod.when === 'lastWeekOfPhase') {
        return `${amount} in each phase’s last week (played, not completed early)`;
      }
      if (typeof mod.when === 'object')
        return `${amount} while it’s ${conditionText(content, mod.when.host)}`;
      return amount;
    }
    case 'earnNothing':
      return isHost(mod.target)
        ? 'Earns nothing'
        : `${subjectText(content, mod.target)} earn nothing`;
    case 'grantTag':
      return isHost(mod.target)
        ? `Makes it ${mod.tag}`
        : `${subjectText(content, mod.target)} are ${mod.tag}`;
    case 'removeTag':
      return isHost(mod.target)
        ? `It’s never ${mod.tag}`
        : `${subjectText(content, mod.target)} are never ${mod.tag}`;
    case 'grantView':
      return isHost(mod.target)
        ? 'Gives it a view, which counts as one more view'
        : `${subjectText(content, mod.target)} have a view`;
    case 'blockPenalties': {
      const from = selectorText(content, mod.from, 'some');
      // What has the tag, by name, when few things do (playtest 4: Soundproofing went unused, as
      // nothing said only the street, Garages, Playrooms, and Pools are Loud).
      const which = mod.from !== 'all' && 'tag' in mod.from ? tagged(content, mod.from.tag) : [];
      const named = which.length > 0 && which.length <= 5 ? ` (${joinWords(which, 'and')})` : '';
      const who = isHost(mod.target) ? 'it' : selectorText(content, mod.target, 'some');
      return `${from.charAt(0).toUpperCase() + from.slice(1)}${named} can’t take points off ${who}`;
    }
    case 'countsAs': {
      const name = content.pieces[mod.as].name;
      const times = mod.times ?? 1;
      const what = times === 1 ? article(name) : `${times} ${plural(name)}`;
      const subject = isHost(mod.target) ? 'Counts' : `${subjectText(content, mod.target)} count`;
      return `${subject} as ${what}${times === 1 ? ' too' : ' for the client'}`;
    }
    case 'link': {
      const names = mod.among.map((id) => plural(content.pieces[id].name));
      return `Touching ${joinWords(names, 'and')} are linked: each counts as touching the whole group`;
    }
    case 'grantEffect': {
      const who = mod.target === 'all' ? 'Every piece' : subjectText(content, mod.target);
      return `${who}: ${effectText(content, mod.effect).replace(/^./, (c) => c.toLowerCase())}`;
    }
    case 'perCountOver': {
      const what = selectorText(content, mod.match, 'some');
      return `${what.charAt(0).toUpperCase() + what.slice(1)} earn ${signed(mod.pct)}% for each one over ${mod.over}`;
    }
    case 'setBonus': {
      const who = mod.set ? `The ${content.sets[mod.set].name}` : 'Every set';
      if (mod.pct === 100) return `${who} pays double`;
      return `${who} pays ${Math.abs(mod.pct)}% ${mod.pct < 0 ? 'less' : 'more'}`;
    }
    case 'budget':
      return `${mod.target === 'all' ? 'Every piece' : subjectText(content, mod.target)} pays ${signed(mod.pct)}% budget`;
    case 'drawWeight': {
      // Weight added to pieces the draw leaves out (weight 0, the special rooms): they show up
      // at all, which "more often" would undersell.
      const ids = pieceIds(mod.target);
      if (
        !mod.pct &&
        (mod.add ?? 0) > 0 &&
        ids?.every((id) => content.pieces[id].drawWeight === 0)
      ) {
        const all = selectorText(content, mod.target, 'every');
        return `${all.charAt(0).toUpperCase() + all.slice(1)} show up in the weekly draw`;
      }
      const what = selectorText(content, mod.target, 'some');
      const amount = mod.pct ? `${signed(mod.pct)}%` : `${signed(mod.add ?? 0)}`;
      return `${what.charAt(0).toUpperCase() + what.slice(1)} come up more often (${amount})`;
    }
    case 'rule': {
      const n = mod.add ?? 0;
      if (mod.pct && !mod.add) return RULE_TEXT[mod.key](mod.pct);
      return RULE_TEXT[mod.key](n);
    }
  }
}

export interface FixtureText {
  /** "Fits any room". */
  fits: string;
  effects: string[];
}

export function fixtureText(content: Content, def: FixtureDef): FixtureText {
  const sel = def.fits;
  let fits: string;
  if (sel !== 'all' && 'property' in sel && sel.property === 'room') fits = 'Fits any room';
  else if (sel !== 'all' && 'property' in sel && sel.property === 'yard')
    fits = 'Fits any yard piece';
  else fits = `Fits ${article(selectorText(content, sel, 'one'))}`;
  return { fits, effects: def.modifiers.map((m) => modifierText(content, m)) };
}

export function blueprintText(content: Content, def: BlueprintDef): string[] {
  return def.modifiers.map((m) => modifierText(content, m));
}

/**
 * A lot trait's tip (D-119): what its modifiers do, all run, then its blurb. "Pieces touching
 * the Creek earn +50%, all run. Only a Driveway crosses it."
 */
export function lotTraitText(content: Content, def: LotTraitDef): string {
  const pays = def.modifiers.map((m) => `${modifierText(content, m)}, all run.`);
  return [...pays, def.blurb].join(' ');
}

// ---------------------------------------------------------------------------------------
// The glossary (D-077's first pass): what the game's terms mean, with their numbers from the
// content, so a tooltip never goes stale when balance.ts changes.

export type Term =
  | 'comfort'
  | 'charm'
  | 'sparkle'
  | 'wow'
  | 'budget'
  | 'early'
  | 'fixture'
  | 'reserve'
  | 'supplies'
  | 'blueprints'
  | 'rarity'
  | 'sale'
  | 'refresh'
  | 'skipReward'
  | 'services'
  | 'strike'
  | 'tools'
  | 'crates'
  | 'upgrades'
  | 'renovate'
  | 'checklist'
  | 'frontYard'
  | 'backYard'
  | 'fencedYard'
  | 'sunny'
  | 'requirement'
  | 'link'
  | 'timer';

export function glossary(content: Content): Record<Term, { title: string; text: string }> {
  const b = content.balance;
  const L = SCORE_LABELS;
  const r = b.rules;
  const svc = b.shop.services;
  const earlyBudget = b.early.budgetPerWeek[0] ?? 0;
  const earlyPct = b.early.scorePct[0] ?? 0;
  const economy = Object.values(content.pieces)
    .filter((p) => p.drawWeight > 0 && !p.countsAs && p.effects.some((e) => e.kind === 'economy'))
    .map((p) => p.name);
  // The base pool's requirements, as "a Garage touching the street or a Driveway".
  const needs = Object.values(content.pieces)
    .filter((p) => p.drawWeight > 0 && !p.countsAs)
    .flatMap((p) =>
      p.effects.flatMap((e) =>
        e.kind === 'requires' ? [`${article(p.name)} ${conditionText(content, e.condition)}`] : [],
      ),
    );
  // The sets with a ×Mult, at the content's own number: "the Full House set (×1.5)" (D-140).
  const sparkleSets = joinWords(
    Object.values(content.sets)
      .filter((set) => set.times !== undefined)
      .map((set) => `the ${set.name} set (×${multNumber(set.times!)})`),
    'and',
  );
  return {
    comfort: {
      title: L.points,
      text: `What your pieces earn each week from what they touch, plus each set’s ${L.points}.`,
    },
    charm: {
      title: L.mult,
      text: `Multiplies ${L.points}. It starts at ×1 and goes up for each set you hold, each line of the client’s checklist that holds (+${multNumber(r.specBonus)}), and with a few blueprints.`,
    },
    sparkle: {
      title: L.xMult,
      text: `Multiplies ${L.mult} itself. Rare: ${sparkleSets ? `${sparkleSets} and ` : ''}a few Rare goods have it, and each needs a setup. Each source counts once a week.`,
    },
    wow: {
      title: L.total,
      text: `${L.points} × ${L.mult}, every week. It adds up over the run, and each milestone has a target.`,
    },
    budget: {
      title: 'Budget',
      text:
        `Spent in the shop between milestones. You earn ${b.milestoneBudget} per milestone met, ` +
        `${earlyBudget} per week saved by completing early, from ${joinWords(economy, 'and')}, ` +
        `${b.shop.skipReward} for leaving the shop without buying, and by selling (half price).`,
    },
    early: {
      title: 'Complete early',
      text:
        `Once the target is met, finish the milestone now. The weeks left play out quickly (pieces ` +
        `still earn), and each week saved pays ${earlyBudget} budget and ${earlyPct}% of this ` +
        `milestone’s ${L.total}.`,
    },
    fixture: {
      title: 'Fixtures',
      text:
        'Upgrades for a piece you’ve built, one each. From your hand, installing one is the ' +
        'week’s build; from your supplies, it’s free. A new one replaces the old, and it goes ' +
        'if its piece is demolished.',
    },
    reserve: {
      title: 'Reserve',
      text: `Bought pieces wait here (${r.reserveSlots} slots). Placing one is your week’s build, any week you like.`,
    },
    supplies: {
      title: 'Supplies',
      text: `Bought fixtures wait here (${r.supplySlots} slots). Installing one is free: it doesn’t use your week. Sell for half price.`,
    },
    blueprints: {
      title: 'Blueprints',
      text: `Run-long rule benders, always on (${r.blueprintSlots} slots, no duplicates). Sell one for half its price.`,
    },
    rarity: {
      title: 'Rarity',
      text: `Common, Uncommon, or Rare. Later shops stock more Rare goods, and only Rare goods have ${L.xMult}.`,
    },
    sale: {
      title: 'Sale',
      text: `One good each visit is ${100 - b.shop.salePct}% off.`,
    },
    refresh: {
      title: 'Refresh',
      text: `New goods (not the services): ${b.shop.refresh.base} budget, then ${b.shop.refresh.step} more each time this visit. Back to ${b.shop.refresh.base} next visit.`,
    },
    skipReward: {
      title: 'Saving up',
      text: `Leave without buying or refreshing anything: +${b.shop.skipReward} budget.`,
    },
    services: {
      title: 'Services',
      text: `Rerolls and demolitions to keep: ${svc.reroll.base} budget each at first, ${svc.reroll.step} more each time you buy one, for the rest of the run (up to ${svc.reroll.max}). Bought rerolls never run out.`,
    },
    tools: {
      title: 'Tools',
      text: 'One-shot tricks that wait in your supplies. Using one is free: it doesn’t use your week.',
    },
    crates: {
      title: 'Crates',
      text: `Open one and keep 1 of ${b.shop.crateOptions} goods inside. You need room for its kind of good.`,
    },
    upgrades: {
      title: 'Company upgrades',
      text: 'Permanent for the run: more slots, a bigger hand, more rerolls, lower prices, or interest on your savings. One a visit.',
    },
    renovate: {
      title: 'Renovate',
      text:
        `Once the house has all the rooms of a type its checklist wants (one Kitchen, its ` +
        `Bedrooms, …), a card of that type can renovate one of them in place instead of being ` +
        `placed, with nothing torn down: +${b.renovate.pointsPerLevel} ${L.points} a level, up ` +
        `to ${b.renovate.maxLevel}. It’s the week’s build. A card that can shows Renovate.`,
    },
    checklist: {
      title: 'The checklist',
      text:
        `What the client wants: the house rules every client has, then their own wishes. Each ` +
        `line adds +${multNumber(r.specBonus)} ${L.mult} in every week it holds, and a ` +
        `demolition or a new piece can turn one off.`,
    },
    // The board's terms (D-077), for the inspect panel and the cards.
    frontYard: {
      title: 'Front yard',
      text:
        'The open ground between the house and the street: rows nearer the street than the ' +
        'house’s front row. Before the first room goes in, the whole lot is front yard.',
    },
    backYard: {
      title: 'Back yard',
      text: 'The open ground level with the house or behind it, away from the street.',
    },
    fencedYard: {
      title: 'Fenced yard',
      text:
        `Open ground closed in by the house, Fences, and the lot’s edge, with at least ` +
        `${b.fencedYardMin} tiles. It must touch a Fence and the house, and not the street.`,
    },
    sunny: {
      title: 'Sunny',
      text:
        'The sun shines from one edge of the lot, marked on the board. A room, a Hallway or an ' +
        'outbuilding is Sunny when one of its walls faces the sun with nothing in front of it: ' +
        'no Tree and no other building. Yard pieces aren’t.',
    },
    requirement: {
      title: 'Requirements',
      text:
        `Some pieces need something to earn: ${joinWords(needs, 'and')}. If it isn’t met, ` +
        `the piece earns nothing (⚠ on the board); a few can’t be placed without it.`,
    },
    link: {
      title: 'Hallway links',
      text:
        'Every room a Hallway touches counts as touching every other room along it, for ' +
        'bonuses and sets.',
    },
    timer: {
      title: 'Timers',
      text:
        'Some pieces change with time, counted in weeks from when they were placed: a Sapling ' +
        'becomes a Tree. The inspect panel says when.',
    },
    strike: {
      title: 'Strike a card',
      text: `Pick a card type: it’s never drawn again this run. ${svc.strike.base} budget, ${svc.strike.step} more each strike (up to ${svc.strike.max}).`,
    },
  };
}

// ---------------------------------------------------------------------------------------
// Tools, company upgrades, and crates (M3b).

/** What a tool does, as sentences. */
export function toolText(content: Content, def: ToolDef): string[] {
  const u = def.use;
  switch (u.kind) {
    case 'move':
      return ['Move a placed piece, fixture and all, to another spot (it can’t split the house)'];
    case 'copy':
      return ['Copy a placed piece’s card into your reserve'];
    case 'weekModifiers':
      return [...u.modifiers.map((m) => modifierText(content, m)), 'For this week’s tally only'];
    case 'specialHand':
      return ['Redraw this hand from special pieces and fixtures (not a reroll)'];
    case 'advanceTimers':
      return [`Every timer on the lot jumps ${u.weeks} weeks ahead`];
    case 'reward':
      return [rewardText(content, u.reward)];
    case 'levelSet': {
      const set = content.sets[u.set];
      const lv = set.level;
      return [
        `${set.name} goes up a level for the rest of the run, even before you have one: +${lv.points} ${SCORE_LABELS.points} and +${multNumber(lv.mult)} ${SCORE_LABELS.mult} each`,
      ];
    }
    case 'extraPlay':
      return ['This week’s next build doesn’t end the week: place two pieces this week'];
  }
}

/** A reward as a phrase: "+2 demolitions", "+3 budget", "a random tool". */
export function rewardText(content: Content, r: Reward): string {
  const parts: string[] = [];
  if (r.score) parts.push(`+${r.score} ${SCORE_LABELS.total}`);
  if (r.budget) parts.push(`+${r.budget} budget`);
  if (r.rerolls) parts.push(`+${r.rerolls} ${r.rerolls === 1 ? 'reroll' : 'rerolls'}`);
  if (r.demolitions) {
    parts.push(`+${r.demolitions} ${r.demolitions === 1 ? 'demolition' : 'demolitions'}`);
  }
  if (r.overtime) parts.push(`+${r.overtime} overtime ${r.overtime === 1 ? 'week' : 'weeks'}`);
  if (r.tool) {
    parts.push(r.tool === 'random' ? 'a random tool' : article(content.tools[r.tool].name));
  }
  const text = joinWords(parts, 'and');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function upgradeText(content: Content, def: UpgradeDef): string[] {
  return [...def.modifiers.map((m) => modifierText(content, m)), 'Permanent for the run'];
}

export function crateText(content: Content, def: CrateDef): string[] {
  const n = content.balance.shop.crateOptions;
  const what =
    def.contents === 'blueprint'
      ? 'blueprints'
      : def.contents === 'fixture'
        ? 'fixtures'
        : def.pool === 'special'
          ? 'special pieces'
          : def.filter
            ? `${selectorText(content, def.filter, 'some')}`
            : 'pieces';
  return [`Open it and keep 1 of ${n} ${what}`];
}

// ---------------------------------------------------------------------------------------
// Change orders (M4b).

/**
 * A change order's rules as sentences, from its data: what a request asks and pays, what a
 * restriction forbids and pays, or what a phase effect does.
 */
export function changeOrderText(content: Content, def: ChangeOrderDef): string[] {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  switch (def.kind) {
    case 'request':
      return [
        `${cap(houseConditionText(content, def.condition))}, by the next milestone`,
        `Met: ${rewardText(content, def.reward)}`,
      ];
    case 'restriction': {
      const what = selectorText(content, def.forbid, 'some').replace(/\bneighbors?\b/, 'pieces');
      return [
        `Place no ${what} until the next milestone`,
        `Kept: ${rewardText(content, def.reward)}`,
      ];
    }
    case 'phase':
      return [...def.modifiers.map((m) => modifierText(content, m)), 'For the next phase'];
  }
}
