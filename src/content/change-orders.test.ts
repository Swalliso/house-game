// The change orders (M4b) on the real content: Appendix B's per client and generic ones (the
// Twins and Grandma's moving in are arrivals now), their kinds, rewards, and generated text;
// what each request counts on a hand-built house; who can be offered what; and the mistakes
// validateContent catches.

import { describe, expect, it } from 'vitest';
import type { ChangeOrderId, ClientId, Content, HouseCondition, RunState } from '../rules/index.ts';
import { changeOrderText, meetsHouse, rules } from '../rules/index.ts';
import { computeLayout } from '../rules/layout.ts';
import { emptyRows, houseFrom, type Placement } from '../rules/testing.ts';
import { CONTENT, validateContent } from './index.ts';

const ORDERS = CONTENT.changeOrders;

describe('the change orders', () => {
  it('are Appendix B’s: two generic, two for each client', () => {
    const generic = Object.values(ORDERS).filter((o) => o.scope === 'generic');
    expect(generic.map((o) => [o.id, o.kind])).toEqual([
      ['workingFromHome', 'request'],
      ['heatWave', 'phase'],
    ]);
    const own = (id: ClientId) =>
      CONTENT.clients[id].changeOrders.map((o) => [o, ORDERS[o].kind, ORDERS[o].scope]);
    expect(own('hendersons')).toEqual([
      ['goldenRetriever', 'request', 'hendersons'],
      ['thanksgiving', 'phase', 'hendersons'],
    ]);
    expect(own('vladislav')).toEqual([
      ['covenVisiting', 'request', 'vladislav'],
      ['eternalNight', 'phase', 'vladislav'],
    ]);
    expect(own('barkers')).toEqual([
      ['anotherRescue', 'request', 'barkers'],
      ['agilityCourse', 'request', 'barkers'],
    ]);
    expect(own('juniper')).toEqual([
      ['declutter', 'request', 'juniper'],
      ['teaGarden', 'request', 'juniper'],
    ]);
    expect(own('dale')).toEqual([
      ['bigDeadline', 'restriction', 'dale'],
      ['startedAPodcast', 'request', 'dale'],
    ]);
    expect(CONTENT.balance.changeOrderAfter).toEqual([2, 4, 6]);
  });

  it('pay budget sized to the effort, 3 to 5', () => {
    const rewards = Object.fromEntries(
      Object.values(ORDERS).flatMap((o) => (o.kind === 'phase' ? [] : [[o.id, o.reward]])),
    );
    expect(rewards).toEqual({
      workingFromHome: { budget: 3 },
      goldenRetriever: { budget: 5 },
      covenVisiting: { budget: 5 },
      anotherRescue: { budget: 3 },
      agilityCourse: { budget: 5 },
      declutter: { budget: 4 },
      teaGarden: { budget: 4 },
      bigDeadline: { budget: 4 },
      startedAPodcast: { budget: 4 },
    });
  });

  it('read as plain sentences', () => {
    const terms = (id: ChangeOrderId) => changeOrderText(CONTENT, ORDERS[id]);
    expect(terms('workingFromHome')).toEqual([
      'A new Home Office, by the next milestone',
      'Met: +3 budget',
    ]);
    expect(terms('goldenRetriever')).toEqual([
      'A Doghouse in a fenced yard, by the next milestone',
      'Met: +5 budget',
    ]);
    expect(terms('covenVisiting')[0]).toBe('2 new interior rooms, by the next milestone');
    expect(terms('agilityCourse')[0]).toBe(
      '8 or more tiles of Lawns in a fenced yard in one group, by the next milestone',
    );
    expect(terms('declutter')[0]).toBe('Demolish a piece, by the next milestone');
    expect(terms('teaGarden')[0]).toBe('A new Patio with a view, by the next milestone');
    expect(terms('bigDeadline')).toEqual([
      'Place no Loud pieces until the next milestone',
      'Kept: +4 budget',
    ]);
    expect(terms('heatWave')).toEqual([
      'Pools earn +100%',
      'Pieces touching a Tree earn +100%',
      'Sunny rooms earn −50%',
      'For the next phase',
    ]);
    expect(terms('thanksgiving')).toEqual(['The Entertainer pays double', 'For the next phase']);
    expect(terms('eternalNight')).toEqual(['Rooms are Dark', 'For the next phase']);
    for (const o of Object.values(ORDERS)) {
      expect(o.text, o.id).toMatch(/^[A-Z].*\.$/);
      for (const t of changeOrderText(CONTENT, o)) expect(t, o.id).not.toMatch(/undefined|NaN/);
    }
  });
});

/** Whether a request holds on this house, with pieces from uid `sinceUid` on counted as new. */
function holds(
  cond: HouseCondition,
  rows: readonly string[],
  pieces: readonly Placement[],
  sinceUid = 1,
  demolished = 0,
) {
  const layout = computeLayout(CONTENT, houseFrom(CONTENT, rows, pieces));
  return meetsHouse(CONTENT, layout, cond, { phase: 2, order: { sinceUid, demolished } });
}
const cond = (id: ChangeOrderId): HouseCondition => {
  const o = ORDERS[id];
  if (o.kind !== 'request') throw new Error(`${id} isn't a request`);
  return o.condition;
};

describe('what the requests count', () => {
  const open = emptyRows(12, 12);
  /** A fenced yard of 9 × 4 behind a house of two Bedrooms (fencedYardMin is 10). */
  const yard: Placement[] = [
    ['bedroom', 0, 5],
    ['bedroom', 2, 5],
    ['fence', 4, 0, 0, ['#', '#', '#', '#', '#', '#', '#']],
  ];

  it('Golden retriever: a Doghouse inside a fenced yard (not outside one)', () => {
    expect(holds(cond('goldenRetriever'), open, [...yard, ['doghouse', 1, 1]])).toBe(true);
    expect(holds(cond('goldenRetriever'), open, [...yard, ['doghouse', 8, 8]])).toBe(false);
  });

  it('An agility course: two Lawns side by side in the fenced yard', () => {
    const lawns: Placement[] = [
      ['lawn', 0, 1],
      ['lawn', 2, 1],
    ];
    expect(holds(cond('agilityCourse'), open, [...yard, ...lawns])).toBe(true);
    expect(holds(cond('agilityCourse'), open, [...yard, lawns[0]!])).toBe(false);
  });

  it('The coven is visiting and Started a podcast: new interior rooms', () => {
    // A ring of Closets around a 1 × 2 hole: rooms in the hole touch only indoor tiles.
    const ring: Placement[] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 4; x++)
        if (!(y === 1 && (x === 1 || x === 2))) ring.push(['closet', x, y]);
    }
    const inside: Placement[] = [
      ['closet', 1, 1],
      ['closet', 2, 1],
    ];
    const since = ring.length + 1;
    // One in the hole: interior once the other fills in too.
    expect(holds(cond('startedAPodcast'), open, [...ring, ...inside], since)).toBe(true);
    expect(holds(cond('startedAPodcast'), open, [...ring, inside[0]!], since)).toBe(false);
    expect(holds(cond('covenVisiting'), open, [...ring, ...inside], since)).toBe(true);
    // Only new ones count: the same rooms placed before it was accepted don't.
    expect(holds(cond('covenVisiting'), open, [...ring, ...inside], 99)).toBe(false);
    expect(holds(cond('covenVisiting'), open, [...ring, ...inside], since + 1)).toBe(false);
  });

  it('A tea garden: a new Patio with a view', () => {
    const trees = ['T...........', ...emptyRows(12, 11)];
    expect(
      holds(cond('teaGarden'), trees, [
        ['bedroom', 3, 0],
        ['patio', 1, 0],
      ]),
    ).toBe(true);
    expect(
      holds(cond('teaGarden'), open, [
        ['bedroom', 3, 0],
        ['patio', 1, 0],
      ]),
    ).toBe(false);
  });

  it('Declutter: a piece demolished since it was accepted', () => {
    expect(holds(cond('declutter'), open, [], 1, 0)).toBe(false);
    expect(holds(cond('declutter'), open, [], 1, 1)).toBe(true);
  });
});

describe('who can be offered what', () => {
  /** After milestone 2: the next phase's first week. */
  const atFraming = (clientId: ClientId): RunState => ({
    ...rules.newRun({ seed: 'eligible', clientId, crewId: 'generalContractor', mode: 'standard' }),
    phase: 2,
  });

  it('each client: their own, then the generic ones', () => {
    for (const id of Object.keys(CONTENT.clients) as ClientId[]) {
      expect(rules.eligibleChangeOrders(atFraming(id)), id).toEqual([
        ...CONTENT.clients[id].changeOrders,
        'workingFromHome',
        'heatWave',
      ]);
    }
  });
});

describe('validateContent', () => {
  it('catches a change order’s mistakes', () => {
    const broken: Content = {
      ...CONTENT,
      changeOrders: {
        ...ORDERS,
        // A client order its client doesn't list, and an empty reward.
        teaGarden: { ...ORDERS.teaGarden, scope: 'dale', reward: {} } as typeof ORDERS.teaGarden,
      },
      balance: { ...CONTENT.balance, changeOrderAfter: [4, 2, 7] },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toMatch(/client juniper: change order teaGarden is dale's/);
    expect(problems).toMatch(/change order teaGarden: dale doesn't list it/);
    expect(problems).toMatch(/change order teaGarden: an empty reward/);
    expect(problems).toMatch(/balance: changeOrderAfter rises/);
    expect(problems).toMatch(/balance: changeOrderAfter 7: a milestone from 1 to 6/);
  });
});
