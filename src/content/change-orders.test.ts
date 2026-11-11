// The change orders (M4b) on the real content: Appendix B's per client and generic ones (the
// Twins and Grandma's moving in are arrivals now; D-137 added three generic ones and a phase
// effect each for the Barkers, Juniper, and Dale), their kinds, rewards, and generated text;
// what each request counts on a hand-built house; what D-137's orders do to a tally and a
// placement; who can be offered what; and the mistakes validateContent catches.

import { describe, expect, it } from 'vitest';
import type {
  ChangeOrderId,
  ChangeOrderRecord,
  ClientId,
  Content,
  FixtureId,
  HouseCondition,
  RunState,
} from '../rules/index.ts';
import { changeOrderText, meetsHouse, rules } from '../rules/index.ts';
import { withFixture } from '../rules/fixtures.ts';
import { computeLayout } from '../rules/layout.ts';
import { emptyRows, houseFrom, type Placement } from '../rules/testing.ts';
import { CONTENT, validateContent } from './index.ts';

const ORDERS = CONTENT.changeOrders;
const CLIENT_IDS = Object.keys(CONTENT.clients) as ClientId[];
const GENERIC = (Object.keys(ORDERS) as ChangeOrderId[]).filter(
  (id) => ORDERS[id].scope === 'generic',
);

describe('the change orders', () => {
  it('are Appendix B’s: five generic, two or three for each client', () => {
    expect(GENERIC.map((id) => [id, ORDERS[id].kind])).toEqual([
      ['workingFromHome', 'request'],
      ['heatWave', 'phase'],
      ['coldSnap', 'phase'],
      ['rainySeason', 'phase'],
      ['hoaLetter', 'restriction'],
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
      ['puppies', 'phase', 'barkers'],
    ]);
    expect(own('juniper')).toEqual([
      ['declutter', 'request', 'juniper'],
      ['teaGarden', 'request', 'juniper'],
      ['magazineShoot', 'phase', 'juniper'],
    ]);
    expect(own('dale')).toEqual([
      ['bigDeadline', 'restriction', 'dale'],
      ['startedAPodcast', 'request', 'dale'],
      ['outOfOffice', 'phase', 'dale'],
    ]);
    expect(CONTENT.balance.changeOrderAfter).toEqual([2, 4, 6]);
  });

  it('pay budget sized to the effort, 3 to 5', () => {
    const rewards = Object.fromEntries(
      Object.values(ORDERS).flatMap((o) => (o.kind === 'phase' ? [] : [[o.id, o.reward]])),
    );
    expect(rewards).toEqual({
      workingFromHome: { budget: 3 },
      hoaLetter: { budget: 4 },
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
    // D-137's.
    expect(terms('coldSnap')).toEqual([
      'Pieces with a Fireplace earn +100%',
      'Bathrooms earn −50%',
      'For the next phase',
    ]);
    expect(terms('rainySeason')).toEqual([
      'Green pieces earn +100%',
      'Patios earn nothing',
      'For the next phase',
    ]);
    expect(terms('hoaLetter')).toEqual([
      'Place no pieces in the front yard until the next milestone',
      'Kept: +4 budget',
    ]);
    expect(terms('puppies')).toEqual([
      'Pet pieces earn +100%',
      'Lawns earn +100%',
      'Flower Beds earn nothing',
      'For the next phase',
    ]);
    expect(terms('magazineShoot')).toEqual([
      'Rooms with a view earn +100%',
      'Closets earn nothing',
      'Hallways earn nothing',
      'For the next phase',
    ]);
    expect(terms('outOfOffice')).toEqual([
      'Outdoor pieces earn +100%',
      'Home Offices earn nothing',
      'For the next phase',
    ]);
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
    for (const id of CLIENT_IDS) {
      expect(rules.eligibleChangeOrders(atFraming(id)), id).toEqual([
        ...CONTENT.clients[id].changeOrders,
        ...GENERIC,
      ]);
    }
  });

  it('always leaves two phase effects for the last phase, whatever milestones 2 and 4 picked (D-137, D-144)', () => {
    // Only phase effects come after milestone 6, two of them to pick from. Each client has
    // four, and the picks after milestones 2 and 4 use up two at most (one passed over goes
    // back in the pool), so two are always left.
    const record = (id: ChangeOrderId, phase: number): ChangeOrderRecord => ({
      id,
      phase,
      week: 1,
      sinceUid: 1,
      demolished: 0,
      passedOver: [],
    });
    for (const client of CLIENT_IDS) {
      const s = { ...atFraming(client), phase: 6 };
      const phases = [...CONTENT.clients[client].changeOrders, ...GENERIC].filter(
        (id) => ORDERS[id].kind === 'phase',
      );
      expect(phases.length, client).toBeGreaterThanOrEqual(4);
      expect(rules.eligibleChangeOrders(s), client).toEqual(phases);
      for (const a of phases) {
        for (const b of phases) {
          if (a === b) continue;
          const left = rules.eligibleChangeOrders({
            ...s,
            changeOrders: [record(a, 2), record(b, 4)],
          });
          expect(left.length, `${client}: ${a}, then ${b}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});

describe('what D-137’s orders do', () => {
  const open = emptyRows(12, 12);

  /**
   * Each piece's tally with the phase effect running, against the same house without it: the
   * change in its percentage, what it earns with it, and its budget either way.
   */
  function withEffect(
    id: ChangeOrderId,
    rows: readonly string[],
    pieces: readonly Placement[],
    fixture?: [uid: number, id: FixtureId],
  ) {
    const def = ORDERS[id];
    if (def.kind !== 'phase') throw new Error(`${id} isn't a phase effect`);
    const start = rules.newRun({
      seed: 'd137',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    let house = houseFrom(CONTENT, rows, pieces);
    if (fixture) house = withFixture(house, fixture[0], fixture[1], 1);
    const off: RunState = { ...start, house, timedEffects: [] };
    const on: RunState = {
      ...off,
      timedEffects: [{ source: id, until: { phase: off.phase }, modifiers: def.modifiers }],
    };
    const before = rules.currentTally(off).pieces;
    return rules.currentTally(on).pieces.map((p, k) => ({
      piece: pieces[k]![0],
      pct: p.pct - before[k]!.pct,
      earned: p.earned,
      earnedBefore: before[k]!.earned,
      budget: [before[k]!.budget, p.budget],
      lines: p.lines.map((l) => l.label),
    }));
  }

  it('Cold snap: a room with a Fireplace earns double, Bathrooms half', () => {
    const t = withEffect(
      'coldSnap',
      open,
      [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['bedroom', 0, 4],
      ],
      [1, 'fireplace'],
    );
    expect(t.map((p) => p.pct)).toEqual([100, -50, 0]);
    expect(t[0]!.lines).toContain('Cold snap (pieces with a Fireplace)');
    expect(t[1]!.lines).toContain('Cold snap (Bathrooms)');
  });

  it('Rainy season: Green pieces earn double, Patios nothing', () => {
    const t = withEffect('rainySeason', open, [
      ['livingRoom', 0, 0],
      ['patio', 2, 0], // touching the Living Room, which pays it
      ['lawn', 0, 6],
      ['flowerBed', 6, 6],
    ]);
    expect(t.map((p) => p.pct)).toEqual([0, 0, 100, 100]);
    expect(t[1]!.earnedBefore).toBeGreaterThan(0);
    expect(t[1]!.earned).toBe(0);
    expect(t[1]!.lines).toContain('Earns nothing (Rainy season)');
  });

  it('A litter of puppies: Pet pieces and Lawns earn double, Flower Beds nothing', () => {
    const t = withEffect('puppies', open, [
      ['doghouse', 8, 0],
      ['lawn', 0, 6],
      ['flowerBed', 6, 6],
    ]);
    expect(t.map((p) => p.pct)).toEqual([100, 100, 0]);
    expect(t[2]!.earnedBefore).toBeGreaterThan(0);
    expect(t[2]!.earned).toBe(0);
  });

  it('A magazine shoot: rooms with a view earn double; Closets and Hallways (Long ones too) nothing', () => {
    // A Tree beside the first Bedroom gives it a view; the second has none.
    const trees = ['..T.........', ...emptyRows(12, 11)];
    const t = withEffect('magazineShoot', trees, [
      ['bedroom', 0, 0],
      ['bedroom', 0, 6],
      ['longHallway', 0, 2], // touching the first Bedroom
      ['closet', 6, 6],
    ]);
    expect(t.map((p) => p.pct)).toEqual([100, 0, 0, 0]);
    for (const p of t.slice(2)) {
      expect(p.earnedBefore, p.piece).toBeGreaterThan(0);
      expect(p.earned, p.piece).toBe(0);
    }
  });

  it('Out of office: Outdoor pieces earn double; Home Offices earn nothing but still pay budget', () => {
    const t = withEffect('outOfOffice', open, [
      ['homeOffice', 0, 0],
      ['patio', 0, 1], // touching the Home Office, a room
      ['lawn', 6, 6],
    ]);
    expect(t.map((p) => p.pct)).toEqual([0, 100, 100]);
    expect(t[0]!.earnedBefore).toBeGreaterThan(0);
    expect(t[0]!.earned).toBe(0);
    expect(t[0]!.budget[1]).toBe(t[0]!.budget[0]);
  });

  it('A letter from the HOA: a piece in the front yard breaks it; one behind the house doesn’t', () => {
    const start = rules.newRun({
      seed: 'hoa',
      clientId: 'dale',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    // The street runs along the bottom: rows below the Bedroom's are the front yard.
    const house = houseFrom(CONTENT, open, [['bedroom', 4, 4]]);
    const forced = rules.apply(
      { ...start, house },
      { t: 'debug', op: 'forceChangeOrder', id: 'hoaLetter' },
    );
    let s = rules.apply(forced.state, { t: 'answerChangeOrder', i: 0 }).state;
    s = rules.apply(s, { t: 'debug', op: 'giveCard', id: 'lawn' }).state;
    const i = s.hand.length - 1;
    const at = (x: number, y: number) =>
      rules.preview(s, { t: 'place', from: 'hand', i, x, y, rot: 0 });
    expect(at(4, 8)).toMatchObject({ legal: true, breaks: 'hoaLetter' });
    expect(at(4, 0).legal).toBe(true);
    expect(at(4, 0).breaks).toBeUndefined();
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
