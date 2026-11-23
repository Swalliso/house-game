// The end screen's listing (D-212, backlog S13), read from a finished run's state alone. Each
// phrase on a house built for it on the real content, placed unchecked on a bare lot whose street
// runs below its last row; then a run for each client, played to its end by the bots, where
// every line has to be a sentence and true of the house by the rules.

import { describe, expect, it } from 'vitest';
import { greedy, novice } from '../../../sim/policies/index.ts';
import { simulateRun } from '../../../sim/simulate.ts';
import {
  CONTENT,
  rules,
  type ArrivalId,
  type BiomeId,
  type ClientId,
  type Lot,
  type LotTraitId,
  type RunState,
} from '../../rules/index.ts';
import { withFixture } from '../../rules/fixtures.ts';
import { emptyRows, houseFrom, type Placement } from '../../rules/testing.ts';
import { biomeLook } from '../board/terrain/biome.ts';
import { arrivalOf } from '../hud/household.ts';
import { listing, lotWords, type ListingLine } from './listing.ts';
import { PAGES_URL, resultLine } from './result-line.ts';

const CLIENTS = Object.keys(CONTENT.clients) as ClientId[];
const VERDICTS = CONTENT.balance.verdicts.map((v) => v.name);
const LOWEST = VERDICTS[0]!;
const TOP = VERDICTS.at(-1)!;
/** The most words a line may have, so the card stays a few rows on the end panel. */
const LINE_WORDS = 16;

const starts = new Map<ClientId, RunState>();

interface Finish {
  won?: boolean;
  /** For a won run's verdict. */
  score?: number;
  arrived?: readonly ArrivalId[];
  rows?: readonly string[];
  /** The lot's traits as the run began: Rocky unless said. */
  traits?: readonly LotTraitId[];
  biome?: Lot['biome'];
}

/** A finished run for a client, with this house: lost, on a bare 12 × 10 Rocky lot, unless said. */
function finished(clientId: ClientId, placements: readonly Placement[], f: Finish = {}): RunState {
  let start = starts.get(clientId);
  if (!start) {
    start = rules.newRun({
      seed: 'listing',
      clientId,
      crewId: 'generalContractor',
      mode: 'standard',
    });
    starts.set(clientId, start);
  }
  const house = houseFrom(CONTENT, f.rows ?? emptyRows(12, 10), placements);
  const lot: Lot = {
    ...house.lot,
    traits: f.traits ?? ['rocky'],
    ...(f.biome && { biome: f.biome }),
  };
  return {
    ...start,
    screen: f.won ? 'won' : 'lost',
    score: f.score ?? 0,
    arrived: f.arrived ?? [],
    house: { ...house, lot },
  };
}

const texts = (s: RunState) => listing(s).map((l) => l.text);
const lineOf = (s: RunState, part: ListingLine['part']) => listing(s).find((l) => l.part === part);
const flaw = (s: RunState) => lineOf(s, 'flaw')?.text ?? null;
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Count Vladislav's three Dark rooms: three Bathrooms boxed in by rooms, so none of them has an
 * outside wall. Every other room has one.
 *   y0  ..BBCC        B, C, E: Bedrooms; F: the Dining Room; K: the Kitchen
 *   y1  KKBBCC
 *   y2  KKtttc        t: the Bathrooms; c: the Closet, which closes the third one in
 *   y3  ..EEFF
 *   y4  ..EEFF
 */
const DARK_ROOMS: Placement[] = [
  ['bedroom', 2, 0],
  ['bedroom', 4, 0],
  ['kitchen', 0, 1],
  ['bathroom', 2, 2],
  ['bathroom', 3, 2],
  ['bathroom', 4, 2],
  ['closet', 5, 2],
  ['bedroom', 2, 3],
  ['diningRoom', 4, 3],
];
const LIBRARY: Placement = ['library', 6, 0];

/**
 * A fenced yard the size of the lot's back rows: a line of Fences across a lot as wide as they
 * are, with a room in the line (the yard has to touch the house). The lot's edges close the rest.
 * 18 tiles on a lot 9 wide, behind row 2:
 *   y0  .........
 *   y1  .........
 *   y2  FFFFtFFFF   t: a Bathroom
 *   y3  KK..MM...   K: the Kitchen; M: the Mudroom
 *   y4  KK.......
 */
const YARD_18 = { rows: emptyRows(9, 8) };
const YARD_18_LINE: Placement[] = [
  ['fence', 0, 2],
  ['bathroom', 4, 2],
  ['fence', 5, 2],
  ['kitchen', 0, 3],
];
/**
 * 11 tiles, behind row 1 on a lot 11 wide: Fences, the Kitchen, Fences and a Bathroom.
 *   y0  ...........
 *   y1  FFFFKKFFFFt
 *   y2  ....KKDD...   D: the Dining Room, beside the Kitchen
 *   y3  ......DD...
 */
const YARD_11 = { rows: emptyRows(11, 8) };
const YARD_11_LINE: Placement[] = [
  ['fence', 0, 1],
  ['kitchen', 4, 1],
  ['fence', 6, 1],
  ['bathroom', 10, 1],
];

describe('the listing', () => {
  it('is for a finished run only, as two or three lines in order', () => {
    const s = finished('hendersons', [['kitchen', 0, 0]]);
    for (const screen of ['build', 'shop', 'changeOrder'] as const) {
      expect(listing({ ...s, screen })).toEqual([]);
    }
    for (const screen of ['won', 'lost'] as const) {
      const parts = listing({ ...s, screen }).map((l) => l.part);
      expect(parts).toEqual(['headline', 'client', 'flaw']);
    }
  });

  it('reads the state and changes nothing', () => {
    const s = finished('vladislav', [...DARK_ROOMS, LIBRARY], { arrived: ['renfield'] });
    const before = JSON.stringify(s);
    listing(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("the listing's headline", () => {
  it('counts beds and baths as a listing does, with the verdict as its noun', () => {
    // A Bedroom with Bunk Beds is one bed (where the checklist counts two, D-198), a member's
    // room is a bed, an L-Kitchen is a room and a Hallway isn't.
    const house: Placement[] = [
      ['bedroom', 0, 0],
      ['nursery', 2, 0],
      ['grandmasRoom', 4, 0],
      ['lKitchen', 0, 2],
      ['bathroom', 2, 2],
      ['bathroom', 3, 2],
      ['hallway', 4, 2],
    ];
    const won = finished('hendersons', house, { won: true, score: 1e9 });
    const bunks = { ...won, house: withFixture(won.house, 1, 'bunkBeds', 1) };
    for (const s of [won, bunks]) {
      expect(lineOf(s, 'headline')).toEqual({
        part: 'headline',
        kind: 'house',
        text: `3 bed, 2 bath ${TOP} on a rocky lot.`,
      });
    }
    const lost = finished('hendersons', house);
    expect(lineOf(lost, 'headline')?.text).toBe(`3 bed, 2 bath ${LOWEST} on a rocky lot.`);
  });

  it('names each verdict as a kind of house, and a lost run a Fixer-Upper', () => {
    // The verdict is the listing's noun: "a 3 bed, 2 bath Charmer".
    expect(VERDICTS).toEqual(['Fixer-Upper', 'Starter Home', 'Charmer', 'Showhome', 'Dream Home']);
    const s = finished('dale', [['kitchen', 0, 0]]);
    expect(rules.verdict(s)).toBe('Fixer-Upper');
    expect(lineOf(s, 'headline')?.text).toBe('0 bed, 0 bath Fixer-Upper on a rocky lot.');
  });

  it('says a house of no rooms has none, and an empty lot is vacant, with no flaw', () => {
    // A Hallway and a Patio are no rooms. The Patio earns nothing, but the headline is the flaw.
    const none = finished('barkers', [
      ['hallway', 0, 0],
      ['patio', 5, 5],
    ]);
    expect(listing(none).map((l) => [l.kind, l.text])).toEqual([
      ['noRooms', 'Fixer-Upper on a rocky lot, with no rooms.'],
      ['asked', 'The Barkers asked for a big fenced yard, two Doghouses and one Mudroom.'],
    ]);
    const empty = finished('barkers', [], { traits: ['open'] });
    expect(listing(empty).map((l) => [l.kind, l.text])).toEqual([
      ['vacant', 'Vacant open lot.'],
      ['asked', 'The Barkers asked for a big fenced yard, two Doghouses and one Mudroom.'],
    ]);
  });
});

describe("the listing's lot", () => {
  const lot = (traits: readonly LotTraitId[], biome?: Lot['biome']): Lot => ({
    ...houseFrom(CONTENT, emptyRows(12, 10)).lot,
    traits,
    ...(biome && { biome }),
  });

  it('names its traits as the run began: the land’s words, then the water’s', () => {
    expect(lotWords(lot(['creekside', 'rocky']))).toBe('rocky creekside lot');
    expect(lotWords(lot(['wooded', 'rocky']))).toBe('wooded, rocky lot');
    expect(lotWords(lot(['creekside', 'pondside']))).toBe('creekside and pondside lot');
    expect(lotWords(lot(['creekside', 'pondside', 'wooded']))).toBe(
      'wooded creekside and pondside lot',
    );
    expect(lotWords(lot(['lakefront']))).toBe('lakefront lot');
    // The traits it began with, kept all run (D-166): Wooded with every Tree built over.
    expect(lotWords(lot(['wooded']))).toBe('wooded lot');
  });

  it('puts the Old Woods after the lot, as a place', () => {
    expect(lotWords(lot(['oldWoods']))).toBe('lot in the Old Woods');
    expect(lotWords(lot(['creekside', 'oldWoods']))).toBe('creekside lot in the Old Woods');
    const s = finished('dale', [['kitchen', 0, 0]], { traits: ['oldWoods'] });
    expect(lineOf(s, 'headline')?.text).toBe(
      '0 bed, 0 bath Fixer-Upper on a lot in the Old Woods.',
    );
  });

  it('keeps the Old Woods a place with the land’s and the water’s words, in every headline', () => {
    expect(lotWords(lot(['oldWoods', 'creekside', 'rocky']))).toBe(
      'rocky creekside lot in the Old Woods',
    );
    const woods = { traits: ['oldWoods'] } as const;
    expect(lineOf(finished('dale', [], woods), 'headline')?.text).toBe(
      'Vacant lot in the Old Woods.',
    );
    expect(lineOf(finished('dale', [['patio', 0, 0]], woods), 'headline')?.text).toBe(
      'Fixer-Upper on a lot in the Old Woods, with no rooms.',
    );
  });

  it('names a lot with no trait by its look, as the board draws it', () => {
    for (const biome of ['meadow', 'lakeside', 'autumn', 'dry'] as BiomeId[]) {
      const b = biome === 'meadow' ? undefined : biome;
      expect(lotWords(lot([], b))).toBe(`${biomeLook(biome)} lot`);
    }
    // A lakeside lot without its lake looks like the meadow.
    expect(lotWords(lot([], 'lakeside'))).toBe('meadow lot');
    // With its article: "an autumn lot", "an open lot".
    const s = finished('dale', [['kitchen', 0, 0]], { traits: [], biome: 'autumn' });
    expect(lineOf(s, 'headline')?.text).toBe('0 bed, 0 bath Fixer-Upper on an autumn lot.');
  });
});

describe("the listing's client line", () => {
  it('says what each client asked for when the house holds none of it', () => {
    const asked = Object.fromEntries(CLIENTS.map((c) => [c, lineOf(finished(c, []), 'client')]));
    expect(asked).toEqual({
      hendersons: {
        part: 'client',
        kind: 'asked',
        text: 'The Hendersons asked for the Kitchen beside the Dining Room and a fenced yard.',
      },
      vladislav: {
        part: 'client',
        kind: 'asked',
        text: 'Count Vladislav asked for three Dark rooms and one Library.',
      },
      barkers: {
        part: 'client',
        kind: 'asked',
        text: 'The Barkers asked for a big fenced yard, two Doghouses and one Mudroom.',
      },
      juniper: {
        part: 'client',
        kind: 'asked',
        text: 'Juniper Vale asked for two rooms with a view.',
      },
      dale: {
        part: 'client',
        kind: 'asked',
        text: 'Dale asked for two Home Offices and nothing Loud next to an office.',
      },
      bigsbys: { part: 'client', kind: 'asked', text: 'The Bigsbys asked for a Playroom.' },
    });
  });

  it('has a wish to name for every client', () => {
    for (const c of CLIENTS) {
      expect(
        CONTENT.clients[c].specs.some((sp) => sp.group === 'wishes'),
        c,
      ).toBe(true);
    }
  });

  it('names the wishes the house holds, by what it holds', () => {
    const vlad = finished('vladislav', [...DARK_ROOMS, LIBRARY]);
    expect(lineOf(vlad, 'client')).toEqual({
      part: 'client',
      kind: 'built',
      text: 'Built for Count Vladislav: 3 Dark rooms and a Library.',
    });
    const barkers = finished(
      'barkers',
      [...YARD_18_LINE, ['doghouse', 0, 0], ['doghouse', 1, 0], ['mudroom', 4, 3]],
      YARD_18,
    );
    expect(rules.fencedYards(barkers)).toEqual([18]);
    expect(lineOf(barkers, 'client')?.text).toBe(
      'Built for the Barkers: an 18-tile fenced yard, 2 Doghouses and a Mudroom.',
    );
    const hendersons = finished('hendersons', [...YARD_11_LINE, ['diningRoom', 6, 2]], YARD_11);
    expect(rules.fencedYards(hendersons)).toEqual([11]);
    expect(lineOf(hendersons, 'client')?.text).toBe(
      'Built for the Hendersons: the Kitchen beside the Dining Room and an 11-tile fenced yard.',
    );
  });

  it('names a wish held while another isn’t, and leaves the one not held to the flaw', () => {
    const dale = finished('dale', [
      ['kitchen', 0, 0],
      ['homeOffice', 2, 0],
    ]);
    expect(lineOf(dale, 'client')?.text).toBe('Built for Dale: nothing Loud next to an office.');
    expect(flaw(dale)).toBe('1 Home Office, of the 2 asked for.');
    const juniper = finished(
      'juniper',
      [
        ['kitchen', 2, 2],
        ['bathroom', 1, 0],
        ['bathroom', 0, 1],
      ],
      { rows: ['T...........', ...emptyRows(12, 9)] },
    );
    expect(lineOf(juniper, 'client')?.text).toBe('Built for Juniper Vale: 2 rooms with a view.');
  });
});

describe("the listing's flaw", () => {
  it('names a member who arrived to no room of theirs', () => {
    const vlad = finished('vladislav', [...DARK_ROOMS, LIBRARY], { arrived: ['renfield'] });
    expect(lineOf(vlad, 'flaw')).toEqual({
      part: 'flaw',
      kind: 'noMemberRoom',
      text: 'No room for Renfield.',
    });
    const twins = finished('hendersons', [['kitchen', 0, 0]], { arrived: ['twins'] });
    expect(flaw(twins)).toBe('No room for the twins.');
    // Their room is either of theirs: the Nursery, or the Kids' Room it grows into.
    for (const room of ['nursery', 'kidsRoom'] as const) {
      const s = finished(
        'hendersons',
        [
          ['kitchen', 0, 0],
          [room, 2, 0],
        ],
        { arrived: ['twins'] },
      );
      expect(flaw(s)).not.toContain('No room for');
    }
  });

  it('says there’s no Kitchen, and an L-Kitchen is one', () => {
    const none = finished('vladislav', [['bedroom', 0, 0]]);
    expect(lineOf(none, 'flaw')).toEqual({ part: 'flaw', kind: 'noKitchen', text: 'No Kitchen.' });
    const l = finished('vladislav', [
      ['bedroom', 0, 0],
      ['lKitchen', 2, 0],
    ]);
    expect(flaw(l)).toBe('No Dark rooms.');
  });

  it('says how a count wish falls short or goes over', () => {
    const kitchen: Placement = ['kitchen', 0, 0];
    const cases: [ClientId, Placement[], string][] = [
      ['vladislav', [kitchen], 'No Dark rooms.'],
      // The Closet gone, the third Bathroom has an outside wall.
      [
        'vladislav',
        DARK_ROOMS.filter(([id]) => id !== 'closet'),
        '2 Dark rooms, of the 3 asked for.',
      ],
      ['vladislav', DARK_ROOMS, 'No Library.'],
      [
        'vladislav',
        [...DARK_ROOMS, LIBRARY, ['library', 8, 0]],
        '2 Libraries, where 1 was asked for.',
      ],
      ['dale', [kitchen], 'No Home Offices.'],
      [
        'dale',
        [kitchen, ['homeOffice', 2, 0], ['homeOffice', 4, 0], ['homeOffice', 6, 0]],
        '3 Home Offices, where 2 were asked for.',
      ],
      ['juniper', [kitchen], 'No rooms with a view.'],
    ];
    for (const [client, house, text] of cases) {
      expect(lineOf(finished(client, house), 'flaw'), text).toEqual({
        part: 'flaw',
        kind: 'wishShort',
        text,
      });
    }
    const juniper = finished(
      'juniper',
      [
        ['kitchen', 2, 2],
        ['bathroom', 1, 0],
      ],
      {
        rows: ['T...........', ...emptyRows(12, 9)],
      },
    );
    expect(flaw(juniper)).toBe('1 room with a view, of the 2 asked for.');
  });

  it('says how the Barkers’ wishes fall short', () => {
    const dogs: Placement[] = [
      ['doghouse', 0, 0],
      ['doghouse', 1, 0],
    ];
    const mudroom: Placement = ['mudroom', 4, 3];
    expect(flaw(finished('barkers', [['kitchen', 3, 3], ...dogs]))).toBe('No fenced yard.');
    const small = finished('barkers', [...YARD_11_LINE, ...dogs, ['mudroom', 4, 3]], YARD_11);
    expect(flaw(small)).toBe('The fenced yard is 11 tiles, of the 12 asked for.');
    expect(flaw(finished('barkers', [...YARD_18_LINE, mudroom], YARD_18))).toBe('No Doghouses.');
    expect(flaw(finished('barkers', [...YARD_18_LINE, dogs[0]!, mudroom], YARD_18))).toBe(
      '1 Doghouse, of the 2 asked for.',
    );
    expect(
      flaw(finished('barkers', [...YARD_18_LINE, ...dogs, mudroom, ['mudroom', 6, 3]], YARD_18)),
    ).toBe('2 Mudrooms, where 1 was asked for.');
  });

  it('says how the Hendersons’ wishes fall short', () => {
    const kitchen: Placement = ['kitchen', 0, 0];
    expect(flaw(finished('hendersons', [kitchen]))).toBe('No Dining Room.');
    expect(flaw(finished('hendersons', [kitchen, ['diningRoom', 4, 0]]))).toBe(
      'The Kitchen isn’t beside the Dining Room.',
    );
    expect(flaw(finished('hendersons', [kitchen, ['diningRoom', 2, 0]]))).toBe('No fenced yard.');
  });

  it('says something Loud is next to one of Dale’s offices', () => {
    const quiet: Placement[] = [
      ['kitchen', 0, 0],
      ['homeOffice', 2, 0],
      ['homeOffice', 4, 0],
      ['bedroom', 0, 2],
    ];
    // Both of Dale's wishes held, and nothing else to say.
    expect(texts(finished('dale', quiet))).toEqual([
      '1 bed, 0 bath Fixer-Upper on a rocky lot.',
      'Built for Dale: 2 Home Offices and nothing Loud next to an office.',
    ]);
    // A Garage is Loud, and touches the second office.
    const loud = finished('dale', [...quiet, ['garage', 6, 0]]);
    expect(lineOf(loud, 'flaw')).toEqual({
      part: 'flaw',
      kind: 'wishShort',
      text: 'Something Loud is next to an office.',
    });
    expect(lineOf(loud, 'client')?.text).toBe('Built for Dale: 2 Home Offices.');
  });

  it('names a piece that earns nothing, and how many of its kind', () => {
    const quiet: Placement[] = [
      ['kitchen', 0, 0],
      ['homeOffice', 2, 0],
      ['homeOffice', 4, 0],
    ];
    expect(lineOf(finished('dale', [...quiet, ['doghouse', 0, 6]]), 'flaw')).toEqual({
      part: 'flaw',
      kind: 'earnsNothing',
      text: 'The Doghouse earns nothing: it must be in a fenced yard.',
    });
    expect(flaw(finished('dale', [...quiet, ['doghouse', 0, 6], ['doghouse', 2, 6]]))).toBe(
      '2 Doghouses earn nothing: each must be in a fenced yard.',
    );
    // One of the house's two, under the line that counts both: "One Doghouse", not "The".
    const barkers = finished(
      'barkers',
      [...YARD_18_LINE, ['doghouse', 0, 0], ['mudroom', 4, 3], ['doghouse', 7, 5]],
      YARD_18,
    );
    expect(texts(barkers).slice(1)).toEqual([
      'Built for the Barkers: an 18-tile fenced yard, 2 Doghouses and a Mudroom.',
      'One Doghouse earns nothing: it must be in a fenced yard.',
    ]);
    // The first such piece is the one named, with the others of its kind and its reason.
    expect(flaw(finished('dale', [...quiet, ['patio', 6, 6], ['doghouse', 0, 6]]))).toBe(
      'The Patio earns nothing: it must be touching a room.',
    );
  });

  it('is the first that’s true: a member’s room, the Kitchen, a wish, the rooms, a piece', () => {
    // Juniper Vale's house, a flaw put right at a time. Trees down the right edge give a view.
    //   y0  ttttttttt.vT    t: Bathrooms with no view; v: Bathrooms by the Trees
    //   y1  RRKK......vT    R: Rowan's Studio; K: the Kitchen
    const rows = ['...........T', '...........T', ...emptyRows(12, 8)];
    const baths: Placement[] = Array.from({ length: 9 }, (_, x) => ['bathroom', x, 0]);
    const studio: Placement = ['rowansStudio', 0, 1];
    const kitchen: Placement = ['kitchen', 2, 1];
    const views: Placement[] = [
      ['bathroom', 10, 0],
      ['bathroom', 10, 1],
    ];
    const dog: Placement = ['doghouse', 0, 8];
    const steps: [Placement[], string | null][] = [
      [[...baths, dog], 'No room for Rowan.'],
      [[...baths, studio, dog], 'No Kitchen.'],
      [[...baths, studio, kitchen, dog], 'No rooms with a view.'],
      [[...baths, studio, kitchen, ...views, dog], '13 rooms, where 4 to 8 were asked for.'],
      [
        [studio, kitchen, ...views, dog],
        'The Doghouse earns nothing: it must be in a fenced yard.',
      ],
      [[studio, kitchen, ...views], null],
    ];
    for (const [house, text] of steps) {
      const s = finished('juniper', house, { rows, arrived: ['rowan'] });
      expect(flaw(s), text ?? 'no flaw').toBe(text);
      expect(listing(s)).toHaveLength(text ? 3 : 2);
    }
  });
});

describe('the listing, on the household and the yard', () => {
  const kitchen: Placement = ['kitchen', 0, 0];

  it('counts each member’s room as one bed, and names each member who has none', () => {
    // Every room of every member's (the twins' Nursery and the Kids' Room it grows into), beside
    // a Kitchen, with the member moved in: one bed, and no word about their room.
    const missing: Record<string, string | null> = {};
    for (const c of CLIENTS) {
      for (const a of CONTENT.clients[c].household.arrivals) {
        // D-219: a member with no room of their own (the Bigsbys') has none to miss: the Bedroom
        // they bring is Room for everyone's.
        if (!a.room) {
          const s = finished(c, [kitchen], { arrived: [a.id] });
          expect(flaw(s), a.id).not.toMatch(/^No room for/);
          continue;
        }
        for (const room of a.room) {
          const s = finished(c, [kitchen, [room, 3, 0]], { arrived: [a.id] });
          expect(lineOf(s, 'headline')?.text, room).toBe(`1 bed, 0 bath ${LOWEST} on a rocky lot.`);
          expect(flaw(s), room).not.toMatch(/^No room for/);
        }
        missing[a.id] = flaw(finished(c, [kitchen], { arrived: [a.id] }));
      }
    }
    expect(missing).toEqual({
      twins: 'No room for the twins.',
      grandma: 'No room for Grandma.',
      renfield: 'No room for Renfield.',
      nana: 'No room for Nana.',
      rowan: 'No room for Rowan.',
      ivy: 'No room for Ivy.',
    });
    // The listing keeps each member's rooms by the member's id, so no two clients share one.
    const ids = CLIENTS.flatMap((c) => CONTENT.clients[c].household.arrivals.map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names the first member to arrive with no room, then the next', () => {
    const both = { arrived: ['twins', 'grandma'] } as const;
    const nursery: Placement = ['nursery', 3, 0];
    expect(flaw(finished('hendersons', [kitchen], both))).toBe('No room for the twins.');
    expect(flaw(finished('hendersons', [kitchen, nursery], both))).toBe('No room for Grandma.');
    const housed = finished('hendersons', [kitchen, nursery, ['grandmasRoom', 5, 0]], both);
    expect(lineOf(housed, 'headline')?.text).toBe(`2 bed, 0 bath ${LOWEST} on a rocky lot.`);
    expect(flaw(housed)).toBe('No Dining Room.');
  });

  it('counts a Bedroom with a Dog Door (D-210) as one bed, and no Doghouse', () => {
    // The Dog Door makes its room a Pet room; the Barkers still have no Doghouse.
    const s = finished('barkers', [...YARD_18_LINE, ['mudroom', 4, 3], ['bedroom', 6, 3]], YARD_18);
    const bedroom = s.house.pieces.find((p) => p.defId === 'bedroom')!.uid;
    const door = { ...s, house: withFixture(s.house, bedroom, 'dogDoor', 1) };
    expect(rules.describePiece(door, bedroom)?.tags).toContain('Pet');
    expect(rules.describePiece(s, bedroom)?.tags).not.toContain('Pet');
    for (const house of [s, door]) {
      expect(lineOf(house, 'headline')?.text).toBe(`1 bed, 1 bath ${LOWEST} on a rocky lot.`);
      expect(flaw(house)).toBe('No Doghouses.');
    }
  });

  it('names the largest fenced yard, with the article its number takes read aloud', () => {
    // Two yards behind a line of Fences, either side of a column of Bathrooms (t): 12 tiles on
    // the left, and 16 on the right, where the Doghouses (D) are.
    //   y0  ...tDD..
    //   y1  ...t....
    //   y2  ...t....
    //   y3  ...t....
    //   y4  FFFFFFFF
    //   y5  KK......   K: the Kitchen
    //   y6  KK..MM..   M: the Mudroom
    const column: Placement[] = [0, 1, 2, 3].map((y) => ['bathroom', 3, y]);
    const two = finished(
      'barkers',
      [
        ...column,
        ['fence', 0, 4],
        ['fence', 4, 4],
        ['kitchen', 0, 5],
        ['doghouse', 4, 0],
        ['doghouse', 5, 0],
        ['mudroom', 4, 6],
      ],
      { rows: emptyRows(8, 10) },
    );
    expect(rules.fencedYards(two)).toEqual([12, 16]);
    expect(lineOf(two, 'client')?.text).toBe(
      'Built for the Barkers: a 16-tile fenced yard, 2 Doghouses and a Mudroom.',
    );
    // Short of the Barkers' 12 tiles, it's the largest that's said: 10 and 11 tiles in the back
    // row, either side of a Bathroom, behind Fences and two more Bathrooms.
    const short = finished(
      'barkers',
      [
        ['bathroom', 10, 0],
        ...[0, 4, 8, 12, 16].map((x): Placement => ['fence', x, 1]),
        ['bathroom', 20, 1],
        ['bathroom', 21, 1],
        ['kitchen', 0, 2],
        ['doghouse', 4, 3],
        ['doghouse', 5, 3],
        ['mudroom', 8, 2],
      ],
      { rows: emptyRows(22, 8) },
    );
    expect(rules.fencedYards(short)).toEqual([10, 11]);
    expect(flaw(short)).toBe('The fenced yard is 11 tiles, of the 12 asked for.');
    // The yard behind a line of Fences across a lot 9 wide, at row 3 or row 9: "a 27-tile", and
    // "an 81-tile", as "an 18-tile" (above).
    for (const [row, size] of [
      [3, 'a 27-tile'],
      [9, 'an 81-tile'],
    ] as const) {
      const s = finished(
        'hendersons',
        [
          ['fence', 0, row],
          ['bathroom', 4, row],
          ['fence', 5, row],
          ['kitchen', 0, row + 1],
        ],
        { rows: emptyRows(9, row + 5) },
      );
      expect(lineOf(s, 'client')?.text).toBe(`Built for the Hendersons: ${size} fenced yard.`);
    }
  });
});

/** Each line checked against the rules' facts: a line that isn't true of the house fails. */
function expectTrue(s: RunState) {
  const lines = listing(s);
  const label = `${s.setup.clientId} ${s.setup.seed} ${s.screen}`;
  expect(
    lines.map((l) => l.part),
    label,
  ).toEqual(['headline', 'client', 'flaw'].slice(0, lines.length));
  expect(lines.length, label).toBeGreaterThanOrEqual(2);
  for (const { text } of lines) {
    expect(text, label).toMatch(/^[A-Z0-9].*[^ ]\.$/);
    expect(text, label).not.toMatch(/undefined|NaN|null|\s\s|\s[.,:]|\.\./);
    expect(words(text), `${label}: ${text}`).toBeLessThanOrEqual(LINE_WORDS);
  }
  const [headline, client, flawLine] = lines;
  const count = (sel: Parameters<typeof rules.countPieces>[1]) => rules.countPieces(s, sel);
  const verdict = rules.verdict(s);
  expect(VERDICTS).toContain(verdict);
  if (s.screen === 'lost') expect(verdict).toBe(LOWEST);
  // The headline: the counts, the verdict and the lot.
  const rooms = count({ property: 'room' });
  expect(headline!.kind, label).toBe(
    s.house.pieces.length === 0 ? 'vacant' : rooms === 0 ? 'noRooms' : 'house',
  );
  expect(headline!.text, label).toContain(lotWords(s.house.lot));
  if (headline!.kind === 'house') {
    const beds = count({ piece: 'bedroom' });
    const baths = count({ piece: 'bathroom' });
    expect(headline!.text, label).toMatch(new RegExp(`^${beds} bed, ${baths} bath ${verdict} on `));
  }
  // The client: the wishes held, or what was asked for when none is.
  const wishes = CONTENT.clients[s.setup.clientId].specs.filter((sp) => sp.group === 'wishes');
  const met = new Set(
    rules
      .checklist(s)
      .filter((l) => l.met)
      .map((l) => l.id),
  );
  const held = wishes.filter((w) => met.has(w.id));
  expect(client!.kind, label).toBe(held.length > 0 ? 'built' : 'asked');
  // The flaw, if any: what it says is so, and with none, the house has none of them.
  const missing = s.arrived.filter((id) => {
    const a = arrivalOf(s.setup.clientId, id);
    // D-219: a member with no room of their own (the Bigsbys') is never one missing.
    return a?.room && count({ piece: a.room }) === 0;
  });
  const unmetPieces = rules.currentTally(s).pieces.filter((p) => p.unmet !== undefined);
  // The client's own most rooms (Juniper Vale's 8, D-101).
  const maxRooms = CONTENT.clients[s.setup.clientId].specs
    .map((sp) => ('outline' in sp.condition ? sp.condition.outline.maxRooms : undefined))
    .find((n) => n !== undefined);
  const facts = {
    noMemberRoom: missing.length > 0,
    noKitchen: count({ piece: 'kitchen' }) === 0,
    wishShort: held.length < wishes.length,
    tooManyRooms: maxRooms !== undefined && rooms > maxRooms,
    earnsNothing: unmetPieces.length > 0,
  };
  if (rooms === 0) expect(flawLine, label).toBeUndefined();
  else if (!flawLine) expect(Object.values(facts).some(Boolean), label).toBe(false);
  else {
    expect(facts[flawLine.kind as keyof typeof facts], `${label}: ${flawLine.text}`).toBe(true);
    if (flawLine.kind === 'noKitchen') expect(flawLine.text).toBe('No Kitchen.');
    if (flawLine.kind === 'earnsNothing') {
      expect(flawLine.text).toContain(`must be ${unmetPieces[0]!.unmet}.`);
    }
  }
  // The listing stays off the copied result (D-135's line).
  for (const { text } of lines) expect(resultLine(s, PAGES_URL)).not.toContain(text);
}

describe('the listing, on runs the bots played to the end', () => {
  // The greedy bot builds a full house and mostly wins; the novice loses early, with flaws.
  for (const clientId of CLIENTS) {
    it(`is true of ${CONTENT.clients[clientId].name}'s houses`, { timeout: 30_000 }, () => {
      for (const policy of [greedy, novice]) {
        const { state } = simulateRun(rules, `listing-${clientId}`, policy, {
          clientId,
          probePhase: null,
        });
        expect(['won', 'lost']).toContain(state.screen);
        expectTrue(state);
      }
    });
  }

  it('is true of the constructed houses above too', () => {
    expectTrue(finished('vladislav', [...DARK_ROOMS, LIBRARY], { arrived: ['renfield'] }));
    expectTrue(finished('barkers', []));
    expectTrue(finished('juniper', [['patio', 0, 0]]));
  });
});
