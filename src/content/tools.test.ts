// The real tools, company upgrades, and crates (Appendix B · Tools, Company upgrades, Crates;
// D-075 and D-083 for the Weekend Crew), in the style of fixtures.test.ts: each one's id,
// rarity, and price, and one thing it does with the real content. The rules tests run on
// TEST_CONTENT's hand copies (src/rules/testing.ts), so these pin the real numbers: when
// tuning changes one, change the test with it. Houses are built on an empty 12×12 lot with
// houseFrom, so uids follow the placement order (1, 2, …); the street runs along the bottom.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Card,
  CrateId,
  GameEvent,
  PickOption,
  PieceId,
  Rarity,
  RunState,
  ShopOffer,
  Supply,
  Tally,
  ToolId,
  UpgradeId,
} from '../rules/index.ts';
import { rules, weekTotal } from '../rules/index.ts';
import { rowOf } from '../rules/draw.ts';
import { emptyRows, houseFrom, setup, type Placement } from '../rules/testing.ts';
import { PRICES } from './balance.ts';
import { CONTENT } from './index.ts';

/** A real run in week 1 on an empty 12×12 lot with these pieces and supplies. */
function build(
  placements: readonly Placement[],
  opts: { supplies?: readonly Supply[]; hand?: readonly Card[]; upgrades?: UpgradeId[] } = {},
): RunState {
  const s = rules.newRun(setup('content-tools'));
  return {
    ...s,
    house: houseFrom(CONTENT, emptyRows(12, 12), placements),
    hand: opts.hand ?? s.hand,
    supplies: opts.supplies ?? [],
    upgrades: opts.upgrades ?? [],
  };
}

const tool = (id: ToolId): Supply => ({ kind: 'tool', id });
const USE: Action = { t: 'useTool', i: 0 };
const PASS: Action = { t: 'pass' };

/** Uses the first supply (a tool), with a target if given. */
function useTool(s: RunState, target?: { uid: number; x?: number; y?: number; rot?: 0 }) {
  return rules.apply(s, target ? { t: 'useTool', i: 0, target } : USE);
}

const earnedOf = (t: Tally, uid: number) => t.pieces.find((p) => p.uid === uid)!.earned;

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

/** Appendix B's tool rarities (Weekend Crew from D-075). */
const RARITY: Record<ToolId, Rarity> = {
  movingTruck: 'uncommon',
  copyMachine: 'rare',
  rushOrder: 'common',
  openHouseParty: 'common',
  catalog: 'common',
  fertilizer: 'uncommon',
  inspectorsVisit: 'uncommon',
  dumpster: 'common',
  remodelJackAndJill: 'common',
  remodelEntertainer: 'common',
  remodelSuite: 'common',
  remodelFullHouse: 'uncommon',
  weekendCrew: 'rare',
};

/**
 * A Jack-and-Jill: two Bedrooms and the Bathroom between them (uids 1–3). The set pays 10
 * Points and +0.5 Mult at level 1.
 */
const JACK_AND_JILL: Placement[] = [
  ['bedroom', 0, 0],
  ['bathroom', 2, 0],
  ['bedroom', 3, 0],
];
/** An Entertainer: a Kitchen, a Dining Room, and a Living Room in a row (uids 1–3). */
const ENTERTAINER: Placement[] = [
  ['kitchen', 0, 0],
  ['diningRoom', 2, 0],
  ['livingRoom', 4, 0],
];

describe('tools', () => {
  it('are Appendix B’s 12, plus the Weekend Crew', () => {
    expect(Object.keys(CONTENT.tools).sort()).toEqual(Object.keys(RARITY).sort());
    for (const def of Object.values(CONTENT.tools)) {
      expect(def.rarity, def.id).toBe(RARITY[def.id]);
      // Priced by rarity from balance.ts, except the Weekend Crew's 5 (D-083).
      expect(def.price, def.id).toBe(def.id === 'weekendCrew' ? 5 : PRICES.tool[def.rarity]);
    }
    expect(PRICES.tool).toEqual({ common: 2, uncommon: 3, rare: 4 });
  });

  it('the shop offers every one, now that M4a brings specs and the Suite and Full House sets', () => {
    const held = Object.values(CONTENT.tools).filter((d) => !d.offered);
    expect(held.map((d) => d.id)).toEqual([]);
  });
});

describe('Moving Truck', () => {
  it('moves a placed piece to another legal spot, keeping its uid', () => {
    const s = build([['bedroom', 0, 0]], { supplies: [tool('movingTruck')] });
    const { state, events } = useTool(s, { uid: 1, x: 5, y: 2, rot: 0 });
    expect(state.house.pieces).toMatchObject([{ uid: 1, defId: 'bedroom', x: 5, y: 2 }]);
    expect(eventsOf(events, 'moved')).toHaveLength(1);
    expect(state.supplies).toEqual([]);
  });
});

describe('Copy Machine', () => {
  it('puts a placed piece’s card in the reserve', () => {
    const s = build([['livingRoom', 0, 0]], { supplies: [tool('copyMachine')] });
    const { state } = useTool(s, { uid: 1 });
    // After the standing stock's, there from week 1 (D-162).
    expect(state.reserve).toEqual([...s.reserve, { id: 'livingRoom' }]);
    expect(state.house.pieces).toHaveLength(1);
  });
});

describe('Rush Order', () => {
  it('+0.5 Mult this week: a lone Bedroom’s 3 becomes 3 × 1.5 = 4.5, so 5', () => {
    const s = build([['bedroom', 0, 0]], { supplies: [tool('rushOrder')] });
    const preview = rules.previewTool(s, USE);
    expect(preview.before).toEqual({ points: 3, mult: 100, total: 3 });
    expect(preview.after).toEqual({ points: 3, mult: 150, total: weekTotal(3, 150) });
    expect(preview.after.total).toBe(5);
    // It lasts for this week's tally only.
    const used = useTool(s).state;
    expect(rules.currentTally(used).total).toBe(5);
    const next = rules.apply(used, PASS).state;
    expect(rules.currentTally(next).total).toBe(3);
  });
});

describe('Open House Party', () => {
  it('Social and Pretty pieces earn +100% this week; others don’t', () => {
    // Social: a Living Room, a Kitchen, and a Patio earning 4 from touching both. Pretty: three
    // Flower Beds in a row, the middle one earning 3. Apart from them, a Bedroom (Quiet). The
    // Patio's 4 and the Flower Bed's 3 are big enough that +100% (8, 6) can't pass for a
    // smaller boost after rounding (+50% would give 6 and 5).
    const s = build(
      [
        ['livingRoom', 0, 0],
        ['kitchen', 2, 2],
        ['patio', 2, 0],
        ['flowerBed', 8, 0],
        ['flowerBed', 9, 0],
        ['flowerBed', 10, 0],
        ['bedroom', 0, 8],
      ],
      { supplies: [tool('openHouseParty')] },
    );
    const before = rules.currentTally(s);
    const after = rules.currentTally(useTool(s).state);
    expect(earnedOf(before, 3)).toBe(4);
    expect(earnedOf(after, 3)).toBe(8);
    expect(earnedOf(before, 5)).toBe(3);
    expect(earnedOf(after, 5)).toBe(6);
    for (const uid of [1, 2, 3, 4, 5, 6]) {
      expect(earnedOf(after, uid)).toBe(2 * earnedOf(before, uid));
    }
    expect(earnedOf(before, 7)).toBeGreaterThan(0);
    expect(earnedOf(after, 7)).toBe(earnedOf(before, 7));
  });
});

describe('Catalog', () => {
  it('redraws the hand from the special pieces, as the week’s next draw', () => {
    const s = build([], { supplies: [tool('catalog')] });
    const { state, events } = useTool(s);
    expect(state.draws).toBe(s.draws + 1);
    expect(state.hand).toHaveLength(s.hand.length);
    // In phase 1 no fixture draws yet, so every card is a special piece (weight 0).
    for (const card of state.hand) {
      expect(card.kind).toBe('piece');
      expect(CONTENT.pieces[card.id as PieceId].drawWeight).toBe(0);
    }
    expect(eventsOf(events, 'handDrawn')).toMatchObject([{ special: true, reroll: false }]);
  });
});

describe('Fertilizer', () => {
  it('ages every piece two weeks: a Sapling becomes a Tree two weeks sooner', () => {
    const s = build(
      [
        ['sapling', 5, 0],
        ['bedroom', 0, 0],
      ],
      { supplies: [tool('fertilizer')] },
    );
    expect(rules.pieceTimers(s, 1)).toEqual(['Becomes a Tree at the start of week 5']);
    const { state } = useTool(s);
    expect(state.house.pieces.map((p) => p.ageBonus)).toEqual([2, 2]);
    expect(rules.pieceTimers(state, 1)).toEqual(['Becomes a Tree at the start of week 3']);
  });
});

describe('Inspector’s Visit', () => {
  it('adds +25 to the spec bonus for this week', () => {
    const s = build([], { supplies: [tool('inspectorsVisit')] });
    expect(rules.rule(s, 'specBonus')).toBe(25);
    expect(rules.rule(useTool(s).state, 'specBonus')).toBe(50);
  });
});

describe('Dumpster', () => {
  it('+2 demolitions', () => {
    const s = build([], { supplies: [tool('dumpster')] });
    expect(useTool(s).state.demolitionsLeft).toBe(s.demolitionsLeft + 2);
  });
});

describe('Remodel Plans', () => {
  it('Jack-and-Jill: level 2 pays 10 + 8 Points and +0.5 + 0.25 Mult', () => {
    const s = build(JACK_AND_JILL, { supplies: [tool('remodelJackAndJill')] });
    expect(rules.currentTally(s).sets).toMatchObject([
      { set: 'jackAndJill', points: 10, mult: 50 },
    ]);
    const { state } = useTool(s);
    expect(state.setLevels).toEqual({ jackAndJill: 2 });
    expect(rules.currentTally(state).sets).toMatchObject([
      { set: 'jackAndJill', points: 18, mult: 75 },
    ]);
  });

  it('Entertainer: level 2 pays 25 + 15 Points and +1 + 0.5 Mult', () => {
    const s = build(ENTERTAINER, { supplies: [tool('remodelEntertainer')] });
    expect(rules.currentTally(s).sets).toMatchObject([
      { set: 'entertainer', points: 25, mult: 100 },
    ]);
    const { state } = useTool(s);
    expect(state.setLevels).toEqual({ entertainer: 2 });
    expect(rules.currentTally(state).sets).toMatchObject([
      { set: 'entertainer', points: 40, mult: 150 },
    ]);
  });
});

describe('Weekend Crew', () => {
  it('this week’s next placement is free: no tally, and the week goes on', () => {
    const s = build([], { supplies: [tool('weekendCrew')] });
    const ready = useTool(s).state;
    expect(ready.freePlay).toBe('ready');
    const spot = rules.legalPlacements(ready).find((p) => p.from === 'hand')!;
    const { state, events } = rules.apply(ready, spot);
    expect(eventsOf(events, 'tally')).toEqual([]);
    expect(eventsOf(events, 'placed')).toMatchObject([{ free: true }]);
    expect([state.week, state.freePlay, state.house.pieces.length]).toEqual([1, 'used', 1]);
    expect(eventsOf(rules.apply(state, PASS).events, 'tally')).toHaveLength(1);
  });
});

describe('company upgrades', () => {
  /** Appendix B's seven, with Appendix A's placeholder prices. */
  const PRICE: Record<UpgradeId, number> = {
    storageUnit: 6,
    toolBelt: 6,
    draftingTable: 7,
    biggerTruck: 8,
    foreman: 7,
    supplierDiscount: 7,
    savingsAccount: 6,
  };

  it('are the 7 of Appendix B, each one rule modifier, at their prices', () => {
    expect(Object.keys(CONTENT.upgrades).sort()).toEqual(Object.keys(PRICE).sort());
    for (const def of Object.values(CONTENT.upgrades)) {
      expect(def.price, def.id).toBe(PRICE[def.id]);
      expect(def.modifiers.map((m) => m.kind)).toEqual(['rule']);
    }
  });

  it('Storage Unit, Tool Belt, and Drafting Table add a reserve, supply, or blueprint slot', () => {
    const slots = (upgrades: UpgradeId[]) => rules.slots(build([], { upgrades }));
    expect(slots([])).toEqual({ reserve: 2, supplies: 3, blueprints: 4 });
    expect(slots(['storageUnit'])).toEqual({ reserve: 3, supplies: 3, blueprints: 4 });
    expect(slots(['toolBelt'])).toEqual({ reserve: 2, supplies: 4, blueprints: 4 });
    expect(slots(['draftingTable'])).toEqual({ reserve: 2, supplies: 3, blueprints: 5 });
  });

  it('Bigger Truck: a third Rooms card every week (D-121)', () => {
    const s = build([], { upgrades: ['biggerTruck'] });
    expect([rules.rule(s, 'roomsRow'), rules.rule(s, 'layoutRow')]).toEqual([3, 2]);
    const next = rules.apply(s, PASS).state;
    expect(next.hand).toHaveLength(5);
    expect(next.hand.slice(0, 3).every((c) => rowOf(CONTENT, c) === 'rooms')).toBe(true);
  });

  it('Foreman: one more reroll a phase, on top of the General Contractor’s', () => {
    expect(rules.rule(build([]), 'rerollsPerPhase')).toBe(2);
    expect(rules.rule(build([], { upgrades: ['foreman'] }), 'rerollsPerPhase')).toBe(3);
  });

  it('Supplier Discount: 25% off goods, rounded half up; not services or the refresh', () => {
    const offers: ShopOffer[] = [
      { kind: 'blueprint', id: 'crownJewel' }, // Rare: 8
      { kind: 'fixture', id: 'skylight' }, // Common: 2
      { kind: 'tool', id: 'copyMachine' }, // Rare: 4
      { kind: 'crate', id: 'showroom' }, // 4
      { kind: 'upgrade', id: 'storageUnit' }, // 6
      { kind: 'piece', id: 'library' }, // 3
      { kind: 'service', service: 'reroll' }, // 1
    ];
    const shop = (upgrades: UpgradeId[]): RunState => ({
      ...build([], { upgrades }),
      screen: 'shop',
      hand: [],
      budget: 30,
      offers: { shop: { number: 3, offers, sale: null, refreshes: 0, boughtAny: false } },
    });
    const prices = (s: RunState) => rules.shopOffers(s).map((o) => o.price);
    expect(prices(shop([]))).toEqual([8, 2, 4, 4, 6, 3, 1]);
    expect(prices(shop(['supplierDiscount']))).toEqual([6, 2, 3, 3, 5, 2, 1]);
    expect(rules.canRefresh(shop(['supplierDiscount'])).price).toBe(
      rules.canRefresh(shop([])).price,
    );
  });

  it('Savings Account: +1 budget per 5 held at a milestone, up to 3', () => {
    /** Meets milestone 1 holding `budget`, and returns its interest. */
    const interest = (budget: number, upgrades: UpgradeId[]) => {
      let s: RunState = { ...build([['bedroom', 0, 0]], { upgrades }), budget, score: 15 };
      const events: GameEvent[] = [];
      while (s.screen === 'build') {
        const out = rules.apply(s, PASS);
        s = out.state;
        events.push(...out.events);
      }
      const [milestone] = eventsOf(events, 'milestone');
      expect(milestone?.result).toBe('onTime');
      return milestone!.reward.interest;
    };
    expect(interest(20, [])).toBe(0);
    expect(interest(9, ['savingsAccount'])).toBe(1);
    expect(interest(20, ['savingsAccount'])).toBe(3);
  });
});

describe('crates', () => {
  it('are the 4 of Appendix B at 4 budget each', () => {
    expect(PRICES.crate).toBe(4);
    expect(
      Object.values(CONTENT.crates).map((d) => [d.id, d.price, d.contents, d.pool ?? null]),
    ).toEqual([
      ['blueprintFolio', 4, 'blueprint', null],
      ['fixtureCrate', 4, 'fixture', null],
      ['gardenCenter', 4, 'piece', 'all'],
      ['showroom', 4, 'piece', 'special'],
    ]);
  });

  /** The options buying this crate in shop 3 shows. */
  function open(id: CrateId): readonly PickOption[] {
    const s: RunState = {
      ...build([]),
      screen: 'shop',
      hand: [],
      budget: 10,
      offers: {
        shop: {
          number: 3,
          offers: [{ kind: 'crate', id }],
          sale: null,
          refreshes: 0,
          boughtAny: false,
        },
      },
    };
    const { state, events } = rules.apply(s, { t: 'buy', i: 0 });
    expect(state.budget).toBe(6);
    const [opened] = eventsOf(events, 'crateOpened');
    expect(opened?.source).toBe(id);
    expect(state.offers?.pick?.options).toEqual(opened!.options);
    expect(opened!.options).toHaveLength(CONTENT.balance.shop.crateOptions);
    expect(new Set(opened!.options.map((o) => o.id)).size).toBe(opened!.options.length);
    return opened!.options;
  }
  const piecesIn = (options: readonly PickOption[]) =>
    options.map((o) => {
      expect(o.kind).toBe('piece');
      return CONTENT.pieces[o.id as PieceId];
    });

  it('Blueprint Folio: 3 blueprints', () => {
    for (const o of open('blueprintFolio')) expect(o.kind).toBe('blueprint');
  });

  it('Fixture Crate: 3 fixtures', () => {
    for (const o of open('fixtureCrate')) expect(o.kind).toBe('fixture');
  });

  it('Garden Center: 3 yard pieces or outbuildings, from the base pool or the special one', () => {
    for (const def of piecesIn(open('gardenCenter'))) {
      expect(['yard', 'outbuilding'], def.id).toContain(def.category);
    }
  });

  it('Showroom: 3 special pieces', () => {
    for (const def of piecesIn(open('showroom'))) expect(def.drawWeight, def.id).toBe(0);
  });
});
