// D-192: the shelf stocks for the house (shelf.ts, shop.ts). A good that can pay in the house as
// it stands counts `relevantWeight` times in its rarity's pick, on a shelf, in the Blueprint
// Folio or in the Fixture Crate; the Showroom skips a special piece at its limit while others
// can fill it; and a blueprint whose `stockIf` fails is never stocked. TEST_CONTENT's lean is off
// (relevantWeight 1), so its shelves are what they always were; these tests turn it on at the
// real content's 3, and give the test Waterfront the real one's `stockIf`.
// src/content/shop-for-your-house.test.ts holds it on the real content.

import { describe, expect, it } from 'vitest';
import type {
  Content,
  FixtureId,
  HouseState,
  PickOption,
  PieceId,
  RunState,
  ShelfGood,
  ShopOffer,
  ToolId,
} from './index.ts';
import { createRules } from './run.ts';
import { crateOptions, openVisit, refreshVisit, stockGoods } from './shop.ts';
import { shelfFor } from './shelf.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT,
  withClient,
  withPieces,
  type Placement,
} from './testing.ts';

/**
 * The content with the lean at `relevantWeight`, and Waterfront as the real content has it:
 * stocked only by water, and leaning on a piece that touches it.
 */
function leaning(base: Content = TEST_CONTENT, relevantWeight = 3): Content {
  const water = ['pond', 'creek', 'lake'] as const;
  return {
    ...base,
    blueprints: {
      ...base.blueprints,
      waterfront: {
        ...base.blueprints.waterfront,
        stockIf: { lotHas: water },
        paysOn: { touching: { feature: water } },
      },
    },
    balance: { ...base.balance, shop: { ...base.balance.shop, relevantWeight } },
  };
}

const C = leaning();
/** The same, with the lean off: every good counts once. */
const OFF = leaning(TEST_CONTENT, 1);
const rules = createRules(C);
const START = rules.newRun(setup('shelf'));

/** A run's state on the build screen, with `house` for its house. */
const at = (house: HouseState, seed = 'shelf'): RunState => ({
  ...START,
  phase: 1,
  setup: { ...START.setup, seed },
  house,
});
const withSeed = (s: RunState, seed: string): RunState => ({ ...s, setup: { ...s.setup, seed } });

const tool = (id: ToolId): ShelfGood => ({ kind: 'tool', id });
const fixture = (id: FixtureId): ShelfGood => ({ kind: 'fixture', id });
const piece = (id: PieceId): ShelfGood => ({ kind: 'piece', id });
const keyOf = (o: ShopOffer | PickOption) =>
  o.kind === 'service' ? `service:${o.service}` : `${o.kind}:${o.id}`;

const LOT = emptyRows(10, 6);
/** A lot with a pond in its corner. */
const WET = ['P.........', ...emptyRows(10, 5)];
/** A Doghouse beside the pond: it touches the water, and no fixture fits it. */
const BY_THE_POND: Placement[] = [['doghouse', 1, 0]];
/** Two Bedrooms that share the Bathroom between them: a Jack-and-Jill. */
const JACK_AND_JILL: Placement[] = [
  ['bedroom', 0, 0],
  ['bathroom', 2, 0],
  ['bedroom', 3, 0],
];
/** Full House's nine types, apart (its members needn't touch). */
const FULL_HOUSE: Placement[] = [
  ['bedroom', 0, 0],
  ['bathroom', 3, 0],
  ['kitchen', 5, 0],
  ['diningRoom', 8, 0],
  ['livingRoom', 11, 0],
  ['closet', 0, 4],
  ['hallway', 2, 4],
  ['garage', 5, 4],
  ['homeOffice', 8, 4],
];

/** How often each good is on a shop's shelf, over `n` seeds. */
function shelfCounts(
  content: Content,
  s: RunState,
  shop: number,
  n: number,
  prefix: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (let k = 0; k < n; k++) {
    for (const o of stockGoods(content, withSeed(s, `${prefix}/${k}`), shop, 0)) {
      out[keyOf(o)] = (out[keyOf(o)] ?? 0) + 1;
    }
  }
  return out;
}

describe('whether a good can pay in the house as it stands', () => {
  it('a fixture: some placed piece could take it now, as installing it would check', () => {
    const house = houseFrom(C, LOT, [
      ['bedroom', 0, 0],
      ['lawn', 5, 0],
    ]);
    const shelf = shelfFor(C, at(house));
    for (const id of ['bunkBeds', 'fireplace', 'sprinkler', 'gardenLights'] as const) {
      expect(shelf.canPay(fixture(id)), id).toBe(true);
    }
    for (const id of ['kitchenIsland', 'pergola', 'chandelier'] as const) {
      expect(shelf.canPay(fixture(id)), id).toBe(false);
    }
    // Bunk Beds in its only Bedroom: another set has nowhere to go. A Fireplace would replace them.
    const fitted: HouseState = {
      ...house,
      pieces: house.pieces.map((p) =>
        p.defId === 'bedroom' ? { ...p, fixture: { id: 'bunkBeds', week: 1 } } : p,
      ),
    };
    expect(shelfFor(C, at(fitted)).canPay(fixture('bunkBeds'))).toBe(false);
    expect(shelfFor(C, at(fitted)).canPay(fixture('fireplace'))).toBe(true);
    // On an empty lot, none.
    const empty = shelfFor(C, at(houseFrom(C, LOT)));
    for (const id of Object.keys(C.fixtures) as FixtureId[]) {
      expect(empty.canPay(fixture(id)), id).toBe(false);
    }
  });

  it('Remodel Plans: the house holds the set now; Full House, one member short or closer', () => {
    const jj = shelfFor(C, at(houseFrom(C, LOT, JACK_AND_JILL)));
    expect(jj.canPay(tool('remodelJackAndJill'))).toBe(true);
    expect(jj.canPay(tool('remodelEntertainer'))).toBe(false);
    expect(jj.canPay(tool('remodelSuite'))).toBe(false);
    expect(jj.canPay(tool('remodelFullHouse'))).toBe(false);
    // Every other tool can.
    for (const id of ['rushOrder', 'catalog', 'dumpster', 'movingTruck', 'weekendCrew'] as const) {
      expect(jj.canPay(tool(id)), id).toBe(true);
    }
    // Two Bedrooms and a Bathroom apart hold no Jack-and-Jill: its members must touch, so being
    // one piece short of one doesn't count.
    const apart = houseFrom(C, LOT, [
      ['bedroom', 0, 0],
      ['bathroom', 4, 0],
      ['bedroom', 7, 0],
    ]);
    expect(shelfFor(C, at(apart)).canPay(tool('remodelJackAndJill'))).toBe(false);
    // Full House: all nine types, or eight, are close enough; seven aren't.
    const big = emptyRows(16, 8);
    const full = (n: number) =>
      shelfFor(C, at(houseFrom(C, big, FULL_HOUSE.slice(0, n)))).canPay(tool('remodelFullHouse'));
    expect([9, 8, 7].map(full)).toEqual([true, true, false]);
  });

  it('a special piece: its type isn’t at a limit for the client, by a cap or by a wish', () => {
    const capped = leaning(withPieces({ library: { perHouse: 1 } }));
    const shelf = shelfFor(capped, at(houseFrom(capped, LOT, [['library', 0, 0]])));
    expect(shelf.canPay(piece('library'))).toBe(false);
    expect(shelf.canPay(piece('playroom'))).toBe(true);
    // Uncapped, a second Library could still go down.
    const free = shelfFor(C, at(houseFrom(C, LOT, [['library', 0, 0]])));
    expect(free.canPay(piece('library'))).toBe(true);
    // A wish with a ceiling is a limit too: "One pool".
    const wish = leaning(
      withClient({
        specs: [
          {
            id: 'onePool',
            name: 'One pool',
            group: 'wishes',
            condition: { count: { piece: 'pool' }, max: 1 },
          },
        ],
      }),
    );
    expect(shelfFor(wish, at(houseFrom(wish, LOT, [['pool', 0, 0]]))).canPay(piece('pool'))).toBe(
      false,
    );
    expect(shelfFor(wish, at(houseFrom(wish, LOT))).canPay(piece('pool'))).toBe(true);
  });

  it('a blueprint: its stockIf, and a piece it pays on; crates and upgrades always', () => {
    const waterfront = { kind: 'blueprint', id: 'waterfront' } as const;
    const dry = shelfFor(C, at(houseFrom(C, LOT)));
    const wet = shelfFor(C, at(houseFrom(C, WET)));
    expect(dry.stocks('waterfront')).toBe(false);
    expect(dry.canPay(waterfront)).toBe(false);
    expect(wet.stocks('waterfront')).toBe(true);
    expect(dry.stocks('fengShui')).toBe(true);
    expect(dry.canPay({ kind: 'blueprint', id: 'fengShui' })).toBe(true);
    // A creek or a lake does as well as a pond.
    for (const rows of [['C.........'], ['L.........']]) {
      expect(shelfFor(C, at(houseFrom(C, rows))).stocks('waterfront')).toBe(true);
    }
    // Stocked by the water, it can pay once a piece touches it, and not before.
    expect(wet.canPay(waterfront)).toBe(false);
    const away = shelfFor(C, at(houseFrom(C, WET, [['doghouse', 5, 3]])));
    expect(away.canPay(waterfront)).toBe(false);
    const near = shelfFor(C, at(houseFrom(C, WET, BY_THE_POND)));
    expect(near.canPay(waterfront)).toBe(true);
    expect(dry.canPay({ kind: 'crate', id: 'showroom' })).toBe(true);
    expect(dry.canPay({ kind: 'upgrade', id: 'toolBelt' })).toBe(true);
  });

  it('the rules say the same through their own layout (canPay)', () => {
    const s = at(houseFrom(C, LOT, JACK_AND_JILL));
    expect(rules.canPay(s, tool('remodelJackAndJill'))).toBe(true);
    expect(rules.canPay(s, tool('remodelSuite'))).toBe(false);
    expect(rules.canPay(s, fixture('bunkBeds'))).toBe(true);
    expect(rules.canPay(s, fixture('sprinkler'))).toBe(false);
  });
});

describe('the shelf leans toward them', () => {
  it('Remodel Plans for a held set turn up about three times as often as for one not held', () => {
    const s = at(houseFrom(C, LOT, JACK_AND_JILL));
    const on = shelfCounts(C, s, 2, 2000, 'jj');
    const off = shelfCounts(OFF, s, 2, 2000, 'jj');
    const held = on['tool:remodelJackAndJill']!;
    // The other Common Remodel Plans, whose sets the house doesn't hold.
    const notHeld = (on['tool:remodelEntertainer']! + on['tool:remodelSuite']!) / 2;
    expect(held / notHeld).toBeGreaterThan(2.4);
    expect(held / notHeld).toBeLessThan(3.6);
    // More often than with the lean off (about 1 in 5 more), where the three come alike.
    expect(held).toBeGreaterThan(off['tool:remodelJackAndJill']! * 1.15);
    const offHeld = off['tool:remodelJackAndJill']!;
    const offNot = (off['tool:remodelEntertainer']! + off['tool:remodelSuite']!) / 2;
    expect(offHeld / offNot).toBeGreaterThan(0.85);
    expect(offHeld / offNot).toBeLessThan(1.15);
  });

  it('a fixture with a host turns up about three times as often as one without, in its rarity', () => {
    // A lone Bedroom: every Common room fixture fits it, no yard one does.
    const s = at(houseFrom(C, LOT, [['bedroom', 0, 0]]));
    const on = shelfCounts(C, s, 2, 2000, 'fx');
    const roomOnes = ['fireplace', 'skylight', 'blackoutCurtains', 'soundproofing', 'bayWindow'];
    const room = roomOnes.reduce((a, id) => a + on[`fixture:${id}`]!, 0) / roomOnes.length;
    const yard = (on['fixture:sprinkler']! + on['fixture:gardenLights']!) / 2;
    expect(room / yard).toBeGreaterThan(2.4);
    expect(room / yard).toBeLessThan(3.6);
    // Among the Uncommons, Bunk Beds over the Kitchen Island and the Pergola.
    const uncommon = (on['fixture:kitchenIsland']! + on['fixture:pergola']!) / 2;
    expect(on['fixture:bunkBeds']! / uncommon).toBeGreaterThan(2.2);
    // The rarities themselves don't move: Commons stay about 70% of the fixtures.
    const fixtures = Object.entries(on).filter(([k]) => k.startsWith('fixture:'));
    const commons = fixtures.filter(
      ([k]) => C.fixtures[k.slice(8) as FixtureId].rarity === 'common',
    );
    const share = commons.reduce((a, [, n]) => a + n, 0) / fixtures.reduce((a, [, n]) => a + n, 0);
    expect(share).toBeGreaterThan(0.64);
    expect(share).toBeLessThan(0.76);
  });

  it('a special piece at its limit turns up a third as often, and the Showroom skips it', () => {
    const capped = leaning(withPieces({ library: { perHouse: 1 } }));
    const s = at(houseFrom(capped, LOT, [['library', 0, 0]]));
    const on = shelfCounts(capped, s, 2, 2000, 'lib');
    const others = (on['piece:playroom']! + on['piece:pool']! + on['piece:hotTub']!) / 3;
    expect(on['piece:library']! / others).toBeGreaterThan(0.25);
    expect(on['piece:library']! / others).toBeLessThan(0.45);
    // The Showroom (3 of the 11 special pieces) never shows it while 10 others can fill it.
    for (let k = 0; k < 300; k++) {
      const opts = crateOptions(capped, withSeed(s, `room/${k}`), 'showroom', 'crate/2/0/7');
      expect(opts).toHaveLength(3);
      expect(opts.map(keyOf)).not.toContain('piece:library');
    }
    // With all but two at their limit, it shows those two and one of the rest.
    const SPECIAL: PieceId[] = ['playroom', 'library', 'mudroom', 'pool', 'sunroom'];
    const SPECIAL2: PieceId[] = ['hotTub', 'firePit', 'henhouse', 'birdhouse', 'porch', 'fountain'];
    /** Content where these special pieces can't go down at all (a cap of 0). */
    const shut = (ids: readonly PieceId[]) =>
      leaning(withPieces(Object.fromEntries(ids.map((id) => [id, { perHouse: 0 }]))));
    const all = shut([...SPECIAL, ...SPECIAL2]);
    const allButTwo = shut(
      [...SPECIAL, ...SPECIAL2].filter((id) => id !== 'pool' && id !== 'porch'),
    );
    for (let k = 0; k < 50; k++) {
      const opts = crateOptions(allButTwo, withSeed(s, `two/${k}`), 'showroom', 'crate/2/0/7');
      expect(opts).toHaveLength(3);
      expect(opts.map(keyOf).slice(0, 2).sort()).toEqual(['piece:pool', 'piece:porch']);
      // Every one at its limit: the crate still holds three.
      expect(crateOptions(all, withSeed(s, `two/${k}`), 'showroom', 'crate/2/0/7')).toHaveLength(3);
    }
  });

  it('Waterfront turns up about a third as often until a piece touches the water', () => {
    const away = at(houseFrom(C, WET));
    const near = at(houseFrom(C, WET, BY_THE_POND));
    const counts = [away, near].map((s) => shelfCounts(C, s, 1, 2000, 'wf'));
    // Against the other Common blueprints, all of which can pay.
    const others = ['fengShui', 'curbAppeal', 'quietHours', 'greenThumb', 'partyHouse'];
    const ratio = (c: Record<string, number>) =>
      c['blueprint:waterfront']! /
      (others.reduce((a, id) => a + c[`blueprint:${id}`]!, 0) / others.length);
    expect(ratio(counts[0]!)).toBeGreaterThan(0.25);
    expect(ratio(counts[0]!)).toBeLessThan(0.45);
    expect(ratio(counts[1]!)).toBeGreaterThan(0.85);
    expect(ratio(counts[1]!)).toBeLessThan(1.15);
  });

  it('the Fixture Crate leans the same way', () => {
    const s = at(houseFrom(C, LOT, [['bedroom', 0, 0]]));
    const count: Record<string, number> = {};
    for (let k = 0; k < 2000; k++) {
      for (const o of crateOptions(C, withSeed(s, `fc/${k}`), 'fixtureCrate', 'crate/2/0/7')) {
        count[keyOf(o)] = (count[keyOf(o)] ?? 0) + 1;
      }
    }
    const yard = (count['fixture:sprinkler']! + count['fixture:gardenLights']!) / 2;
    expect(count['fixture:fireplace']! / yard).toBeGreaterThan(1.8);
  });

  it('Waterfront is never stocked on a lot without water: not on a shelf, a refresh, or a crate', () => {
    const dry = at(houseFrom(C, LOT));
    const wet = at(houseFrom(C, WET, BY_THE_POND));
    let onWet = 0;
    for (let k = 0; k < 300; k++) {
      for (const shop of [1, 2]) {
        for (const refresh of [0, 1, 2]) {
          const d = stockGoods(C, withSeed(dry, `w/${k}`), shop, refresh).map(keyOf);
          expect(d).not.toContain('blueprint:waterfront');
          const w = stockGoods(C, withSeed(wet, `w/${k}`), shop, refresh).map(keyOf);
          if (w.includes('blueprint:waterfront')) onWet++;
        }
      }
      const folio = crateOptions(C, withSeed(dry, `w/${k}`), 'blueprintFolio', 'crate/2/0/7');
      expect(folio.map(keyOf)).not.toContain('blueprint:waterfront');
      const gift = crateOptions(C, withSeed(dry, `w/${k}`), 'housewarming', 'crate/1/0/hw', 3);
      expect(gift).toHaveLength(3);
      expect(gift.map(keyOf)).not.toContain('blueprint:waterfront');
    }
    expect(onWet).toBeGreaterThan(300);
  });

  it('the same seed and state stock the same shelf, and the rules stock what stockGoods does', () => {
    const s = at(houseFrom(C, LOT, JACK_AND_JILL), 'same');
    expect(stockGoods(C, s, 2, 0)).toEqual(stockGoods(C, s, 2, 0));
    expect(openVisit(C, s, 2)).toEqual(openVisit(C, s, 2));
    const visit = openVisit(C, s, 2);
    expect(refreshVisit(C, s, visit)).toEqual(refreshVisit(C, s, visit));
    // Through the rules (their own layout and limits): the debug shop opens the same shelf.
    const shop = rules.apply(s, { t: 'debug', op: 'forceShop' }).state.offers!.shop!;
    const goods = shop.offers.filter((o) => o.kind !== 'service' && o.kind !== 'upgrade');
    expect(goods).toEqual(stockGoods(C, s, shop.number, 0));
  });

  it('where every good of a pick weighs the same, the lean changes nothing', () => {
    // A Doghouse by the pond, at shop 1: every blueprint and special piece can pay, and no
    // fixture can, so each pick's weights are all alike and it lands where the lean-off one does.
    const s = at(houseFrom(C, WET, BY_THE_POND));
    for (let k = 0; k < 200; k++) {
      const seed = withSeed(s, `same/${k}`);
      expect(stockGoods(C, seed, 1, 0)).toEqual(stockGoods(OFF, seed, 1, 0));
    }
    // And with the lean off, the shelf is the test content's own, stockIf aside.
    for (let k = 0; k < 50; k++) {
      const seed = withSeed(s, `own/${k}`);
      expect(stockGoods(OFF, seed, 2, 1)).toEqual(stockGoods(TEST_CONTENT, seed, 2, 1));
    }
  });
});
