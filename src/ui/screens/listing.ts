// The end screen's listing (D-212, backlog S13): the finished house in two or three lines, the
// way a real-estate listing would put it. A headline from real counts ("3 bed, 2 bath Charmer on
// a creekside lot"), a line about the client and the wishes the house holds, and at most one dry
// line about a flaw. The joke is the format: every line states a fact about the house on screen,
// so none of them is a quip that tires by the third run.
//
// The rules say every fact here; this only words them, with the content's names:
// - The counts: rules.countPieces (D-212), each piece once. A member's room is a Bedroom and an
//   L-Kitchen a Kitchen, and a Bedroom with Bunk Beds is one bed, as a listing counts rooms.
// - The wishes held: rules.checklist. What a wish asked for is its condition's, in the content.
// - The pieces that earn nothing: the tally's unmet requirement, in the rules' words.
// - The lot: its traits as the run began (lotTraits), else its biome's look (lotBiome).
// - The verdict, which is the listing's noun: rules.verdict. A lost run is a Fixer-Upper.
// The wording is in SAY, so the listing's tone is one table. No DOM, so it tests in Node.

import {
  article,
  CONTENT,
  definite,
  lotBiome,
  lotTraits,
  plural,
  rules,
  selectorText,
  type ArrivalDef,
  type BiomeId,
  type HouseCondition,
  type Lot,
  type LotTraitId,
  type RunState,
  type Selector,
  type SpecDef,
} from '../../rules/index.ts';
import { arrivalOf, midName } from '../hud/household.ts';

/** Which phrase a line is: the headline's, the client's, or a flaw's. */
export type ListingKind =
  // The headline: a house with rooms, a house with none, or nothing built.
  | 'house'
  | 'noRooms'
  | 'vacant'
  // The client: the wishes the house holds, or what they asked for when it holds none.
  | 'built'
  | 'asked'
  // At most one flaw, the first of these that's true.
  | 'noMemberRoom'
  | 'noKitchen'
  | 'wishShort'
  | 'tooManyRooms'
  | 'earnsNothing';

export interface ListingLine {
  part: 'headline' | 'client' | 'flaw';
  kind: ListingKind;
  text: string;
}

// ---------------------------------------------------------------------------------------
// The words. Every line ends with a full stop; numbers are digits, as a listing writes them.

const SAY = {
  house: (beds: number, baths: number, verdict: string, lot: string) =>
    `${beds} bed, ${baths} bath ${verdict} on ${article(lot)}.`,
  noRooms: (verdict: string, lot: string) => `${verdict} on ${article(lot)}, with no rooms.`,
  vacant: (lot: string) => `Vacant ${lot}.`,
  built: (client: string, held: readonly string[]) => `Built for ${client}: ${joinAnd(held)}.`,
  asked: (Client: string, wishes: readonly string[]) => `${Client} asked for ${joinAnd(wishes)}.`,
  noMemberRoom: (member: string) => `No room for ${member}.`,
  no: (noun: string) => `No ${noun}.`,
  short: (have: string, need: number) => `${have}, of the ${need} asked for.`,
  over: (have: string, max: number) =>
    `${have}, where ${max} ${max === 1 ? 'was' : 'were'} asked for.`,
  yardShort: (tiles: number, need: number) =>
    `The fenced yard is ${tiles} tiles, of the ${need} asked for.`,
  notBeside: (a: string, b: string) => `${cap(definite(a))} isn’t beside ${definite(b)}.`,
  tooManyRooms: (rooms: number, min: number, max: number) =>
    `${rooms} rooms, where ${min} to ${max} were asked for.`,
  earnsNothing: (piece: string, n: number, why: string) =>
    n === 1
      ? `${cap(definite(piece))} earns nothing: it must be ${why}.`
      : `${n} ${plural(piece)} earn nothing: each must be ${why}.`,
};

/**
 * A wish that isn't a count, a fenced yard or a pair, in the listing's words: what it reads as
 * held, and the flaw when it isn't (by spec id). Dale's quiet office is the one today.
 */
const OTHER_WISHES: Readonly<Record<string, { held: string; short: string }>> = {
  quietOffice: {
    held: 'nothing Loud next to an office',
    short: 'Something Loud is next to an office.',
  },
};

/** The land's words come before the water's: "a rocky creekside lot". */
type LotWord = 'land' | 'water' | 'place';
const LOT_WORDS: Readonly<Record<LotTraitId, LotWord>> = {
  rocky: 'land',
  open: 'land',
  wooded: 'land',
  creekside: 'water',
  pondside: 'water',
  lakefront: 'water',
  // A place, not a word for the lot: "a lot in the Old Woods".
  oldWoods: 'place',
};

/**
 * A lot with no trait reads by its biome's look (D-174), as the board draws it (biomeLook in
 * board/terrain/biome.ts, which this keeps clear of for its sprites): the lakeside looks like
 * the meadow, so a lakeside lot without its lake isn't called lakeside.
 */
const BIOME_WORDS: Readonly<Record<BiomeId, string>> = {
  meadow: 'meadow',
  lakeside: 'meadow',
  autumn: 'autumn',
  dry: 'dry',
};

// ---------------------------------------------------------------------------------------
// Helpers.

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "a", "b and c", "a, b and c". */
function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** A wish's name mid-sentence: "Two Home Offices" → "two Home Offices"; a piece keeps its capital. */
function midSentence(name: string): string {
  return /^(A|An|One|Two|Three|Four|Nothing|No)\b/.test(name)
    ? name.charAt(0).toLowerCase() + name.slice(1)
    : name;
}

/** A client's name inside a sentence: "the Hendersons", "Count Vladislav" (as EndScreen's Standing). */
function clientMid(name: string): string {
  return name.replace(/^The\s/, 'the ');
}

const ROOMS: Selector = { property: 'room' };
const BEDS: Selector = { piece: 'bedroom' };
const BATHS: Selector = { piece: 'bathroom' };
const KITCHENS: Selector = { piece: 'kitchen' };

/**
 * Each arrival's rooms as one selector, kept so the rules' count cache can hit. Null for a member
 * with no room of their own (D-219: the Bigsbys'), whose Bedroom Room for everyone counts.
 */
const memberRooms = new Map<string, Selector>();
function roomsOf(a: ArrivalDef): Selector | null {
  if (!a.room) return null;
  let sel = memberRooms.get(a.id);
  if (!sel) memberRooms.set(a.id, (sel = { piece: a.room }));
  return sel;
}

/** A count in digits: "1 Doghouse", "9 Dark rooms". */
function counted(sel: Selector, n: number): string {
  return `${n} ${selectorText(CONTENT, sel, n === 1 ? 'one' : 'some')}`;
}

/** A count the house holds, as a listing writes it: "a Library", "9 Dark rooms". */
function heldCount(sel: Selector, n: number): string {
  return n === 1 ? article(selectorText(CONTENT, sel, 'one')) : counted(sel, n);
}

/** "a 41-tile fenced yard", "an 18-tile fenced yard": the article a number takes, read aloud. */
function aNumber(n: number): string {
  return /^8/.test(String(n)) || n === 11 || n === 18 ? 'an' : 'a';
}

/**
 * The lot as the listing names it, by its traits as the run began: "rocky creekside lot",
 * "wooded, rocky lot", "creekside and pondside lot", "lot in the Old Woods". With no trait, its
 * look: "meadow lot".
 */
export function lotWords(lot: Lot): string {
  const traits = lotTraits(CONTENT, lot);
  const word = (kind: LotWord) =>
    traits.filter((t) => LOT_WORDS[t.id] === kind).map((t) => t.name.toLowerCase());
  const words = [word('land').join(', '), joinAnd(word('water'))].filter(Boolean).join(' ');
  const place = traits.find((t) => LOT_WORDS[t.id] === 'place');
  if (place) return [words, 'lot in the', place.name].filter(Boolean).join(' ');
  return `${words || BIOME_WORDS[lotBiome(lot)]} lot`;
}

// ---------------------------------------------------------------------------------------
// The three lines.

function headline(s: RunState): ListingLine {
  const lot = lotWords(s.house.lot);
  const line = (kind: ListingKind, text: string): ListingLine => ({ part: 'headline', kind, text });
  if (s.house.pieces.length === 0) return line('vacant', SAY.vacant(lot));
  const verdict = rules.verdict(s);
  if (rules.countPieces(s, ROOMS) === 0) return line('noRooms', SAY.noRooms(verdict, lot));
  const beds = rules.countPieces(s, BEDS);
  const baths = rules.countPieces(s, BATHS);
  return line('house', SAY.house(beds, baths, verdict, lot));
}

/** The client's wishes, each with its line on the checklist as the house stands. */
function wishes(s: RunState): { spec: SpecDef; met: boolean }[] {
  const specs = CONTENT.clients[s.setup.clientId].specs;
  const met = new Map(rules.checklist(s).map((l) => [l.id, l.met]));
  return specs
    .filter((sp) => sp.group === 'wishes')
    .map((spec) => ({ spec, met: !!met.get(spec.id) }));
}

/** A held wish as the listing writes it: "9 Dark rooms", "a 41-tile fenced yard". */
function heldWords(s: RunState, spec: SpecDef): string {
  const cond = spec.condition;
  if ('count' in cond) return heldCount(cond.count, rules.countPieces(s, cond.count));
  if ('fencedYardTiles' in cond) {
    const tiles = largestYard(s);
    return `${aNumber(tiles)} ${tiles}-tile fenced yard`;
  }
  if ('adjacentPair' in cond) return askedWords(spec);
  return OTHER_WISHES[spec.id]?.held ?? midSentence(spec.name);
}

/** What a wish asked for, mid-sentence: "two Home Offices", "the Kitchen beside the Dining Room". */
function askedWords(spec: SpecDef): string {
  const cond = spec.condition;
  if ('adjacentPair' in cond) {
    const [a, b] = cond.adjacentPair;
    return `${definite(selectorText(CONTENT, a, 'one'))} beside ${definite(selectorText(CONTENT, b, 'one'))}`;
  }
  return midSentence(spec.name);
}

function largestYard(s: RunState): number {
  return rules.fencedYards(s).reduce((a, b) => Math.max(a, b), 0);
}

/** The wishes the house holds; with none held, what the client asked for (every client has one). */
function clientLine(s: RunState): ListingLine {
  const name = CONTENT.clients[s.setup.clientId].name;
  const all = wishes(s);
  const held = all.filter((w) => w.met).map((w) => heldWords(s, w.spec));
  if (held.length > 0)
    return { part: 'client', kind: 'built', text: SAY.built(clientMid(name), held) };
  return {
    part: 'client',
    kind: 'asked',
    text: SAY.asked(
      name,
      all.map((w) => askedWords(w.spec)),
    ),
  };
}

/** Why a wish doesn't hold, as the listing's flaw; null where it has no words for it. */
function shortWords(
  s: RunState,
  spec: SpecDef,
  cond: HouseCondition = spec.condition,
): string | null {
  if ('count' in cond) {
    const n = rules.countPieces(s, cond.count);
    const min = cond.min ?? 0;
    if (n < min) {
      if (n === 0) return SAY.no(selectorText(CONTENT, cond.count, min === 1 ? 'one' : 'some'));
      return SAY.short(counted(cond.count, n), min);
    }
    if (cond.max !== undefined && n > cond.max) return SAY.over(counted(cond.count, n), cond.max);
    return null;
  }
  if ('fencedYardTiles' in cond) {
    const tiles = largestYard(s);
    return tiles === 0 ? SAY.no('fenced yard') : SAY.yardShort(tiles, cond.fencedYardTiles.min);
  }
  if ('adjacentPair' in cond) {
    const [a, b] = cond.adjacentPair.map((sel) => ({
      sel,
      name: selectorText(CONTENT, sel, 'one'),
    }));
    if (rules.countPieces(s, a!.sel) === 0) return SAY.no(a!.name);
    if (rules.countPieces(s, b!.sel) === 0) return SAY.no(b!.name);
    return SAY.notBeside(a!.name, b!.name);
  }
  // A wish made of parts (Dale's quiet office): a count it's missing says so first.
  if ('and' in cond) {
    for (const part of cond.and) {
      if ('count' in part) {
        const why = shortWords(s, spec, part);
        if (why) return why;
      }
    }
  }
  return OTHER_WISHES[spec.id]?.short ?? null;
}

/**
 * The client's own numbers for A compact house (Juniper's 4–8 rooms, D-101), when the house has
 * more rooms than its top: "13 rooms, where 4 to 8 were asked for."
 */
function tooManyRooms(s: RunState): string | null {
  const spec = CONTENT.clients[s.setup.clientId].specs.find(
    (sp) => 'outline' in sp.condition && sp.condition.outline.maxRooms !== undefined,
  );
  if (!spec || !('outline' in spec.condition)) return null;
  const { minRooms, maxRooms } = spec.condition.outline;
  const met = rules.checklist(s).find((l) => l.id === spec.id)?.met ?? true;
  const rooms = rules.countPieces(s, ROOMS);
  if (met || maxRooms === undefined || rooms <= maxRooms) return null;
  return SAY.tooManyRooms(rooms, minRooms, maxRooms);
}

/** The first piece that earns nothing, by its unmet requirement, with any more of its kind. */
function earnsNothing(s: RunState): string | null {
  const unmet = rules.currentTally(s).pieces.filter((p) => p.unmet !== undefined);
  const first = unmet[0];
  if (!first) return null;
  const same = unmet.filter((p) => p.defId === first.defId && p.unmet === first.unmet);
  return SAY.earnsNothing(CONTENT.pieces[first.defId].name, same.length, first.unmet!);
}

/** At most one flaw, the first that's true: someone's missing room, then the Kitchen, … */
function flawLine(s: RunState): ListingLine | null {
  // A house with no rooms says so in its headline, and that's its flaw.
  if (s.house.pieces.length === 0 || rules.countPieces(s, ROOMS) === 0) return null;
  const line = (kind: ListingKind, text: string): ListingLine => ({ part: 'flaw', kind, text });
  for (const id of s.arrived) {
    const a = arrivalOf(s.setup.clientId, id);
    const rooms = a && roomsOf(a);
    if (a && rooms && rules.countPieces(s, rooms) === 0) {
      return line('noMemberRoom', SAY.noMemberRoom(midName(a)));
    }
  }
  if (rules.countPieces(s, KITCHENS) === 0) {
    return line('noKitchen', SAY.no(CONTENT.pieces.kitchen.name));
  }
  for (const w of wishes(s)) {
    if (w.met) continue;
    const why = shortWords(s, w.spec);
    if (why) return line('wishShort', why);
  }
  const rooms = tooManyRooms(s);
  if (rooms) return line('tooManyRooms', rooms);
  const nothing = earnsNothing(s);
  if (nothing) return line('earnsNothing', nothing);
  return null;
}

/**
 * The finished house as a listing: the headline, the client, and at most one flaw. Empty unless
 * the run is over.
 */
export function listing(s: RunState): ListingLine[] {
  if (s.screen !== 'won' && s.screen !== 'lost') return [];
  const flaw = flawLine(s);
  return [headline(s), clientLine(s), ...(flaw ? [flaw] : [])];
}
