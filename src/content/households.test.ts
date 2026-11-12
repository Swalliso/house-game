// The households (M4b, D-103) on the real content: each client's arrivals, their member rooms
// (what each earns on a small hand-built lot, its shape and tags, and its card text), Room for
// everyone as each client's checklist writes it, the checks validateContent makes, and a real
// Hendersons run in which the twins and Grandma arrive on schedule. Numbers follow pieces.ts
// and households.ts: when tuning changes one, change the test with it.

import { describe, expect, it } from 'vitest';
import type { Action, ClientId, Content, CrewId, PieceId, RunState, Tag } from '../rules/index.ts';
import { cardText, rules } from '../rules/index.ts';
import { drawWeights } from '../rules/draw.ts';
import { bounds, shapeCells } from '../rules/grid.ts';
import { computeLayout } from '../rules/layout.ts';
import { tallyHouse } from '../rules/scoring.ts';
import { emptyRows, houseFrom, type Placement } from '../rules/testing.ts';
import { CONTENT, validateContent } from './index.ts';

const MEMBER_ROOMS: readonly PieceId[] = [
  'nursery',
  'kidsRoom',
  'grandmasRoom',
  'renfieldsRoom',
  'nanasRoom',
  'rowansStudio',
  'ivysRoom',
];

/** What each piece earns in week 1, in placement order. */
function earned(rows: readonly string[], placements: readonly Placement[]): number[] {
  const house = houseFrom(CONTENT, rows, placements);
  return tallyHouse(CONTENT, computeLayout(CONTENT, house), 1, false).pieces.map((p) => p.earned);
}

const open = emptyRows(10, 10);

describe('each client’s household', () => {
  it('has the arrivals D-103 and the brief name, at Framing or Drywall', () => {
    const arrivals = (id: ClientId) =>
      CONTENT.clients[id].household.arrivals.map((a) => [
        a.id,
        CONTENT.balance.phases[a.phase]!.name,
        a.cards,
        a.room,
      ]);
    expect(CONTENT.clients.hendersons.household.bedrooms).toEqual([2, 3]);
    expect(arrivals('hendersons')).toEqual([
      ['twins', 'Framing', ['nursery'], ['nursery', 'kidsRoom']],
      ['grandma', 'Drywall', ['grandmasRoom', 'bathroom'], ['grandmasRoom']],
    ]);
    expect(arrivals('vladislav')).toEqual([
      ['renfield', 'Framing', ['renfieldsRoom'], ['renfieldsRoom']],
    ]);
    expect(arrivals('barkers')).toEqual([['nana', 'Drywall', ['nanasRoom'], ['nanasRoom']]]);
    expect(arrivals('juniper')).toEqual([['rowan', 'Drywall', ['rowansStudio'], ['rowansStudio']]]);
    expect(arrivals('dale')).toEqual([['ivy', 'Framing', ['ivysRoom'], ['ivysRoom']]]);
    for (const id of ['vladislav', 'barkers', 'juniper', 'dale'] as const) {
      expect(CONTENT.clients[id].household.bedrooms, id).toEqual([1, 2]);
    }
    // One line each for the job board.
    for (const c of Object.values(CONTENT.clients)) {
      for (const a of c.household.arrivals) expect(a.text, a.id).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('writes Room for everyone from it: one more Bedroom at each end per arrival, and their room', () => {
    const text = (id: ClientId) => rules.checklist(start(id))[0]!.text;
    expect(text('hendersons')).toBe(
      'Bedrooms for the household: 2–3 to start, then one more for each arrival, and each ' +
        'arrival has their own room: 3–4 and the twins’ room from Framing, 4–5 and ' +
        'Grandma’s room from Drywall.',
    );
    expect(text('vladislav')).toBe(
      'Bedrooms for the household: 1–2 to start, then one more for each arrival, and each ' +
        'arrival has their own room: 2–3 and Renfield’s room from Framing.',
    );
    expect(text('juniper')).toContain('2–3 and Rowan’s room from Drywall.');
  });
});

/** A fresh run for a client. */
function start(clientId: ClientId, seed = 'household'): RunState {
  return rules.newRun({ seed, clientId, crewId: 'generalContractor', mode: 'standard' });
}

describe('member rooms', () => {
  it('are weight-0 indoor rooms that count as Bedrooms, never drawn or in the Catalog', () => {
    const members = Object.values(CONTENT.pieces).filter((d) => d.member);
    expect(members.map((d) => d.id).sort()).toEqual([...MEMBER_ROOMS].sort());
    for (const def of members) {
      expect(def, def.id).toMatchObject({ category: 'indoor', countsAs: 'bedroom', drawWeight: 0 });
    }
    for (let phase = 0; phase < CONTENT.balance.phases.length; phase++) {
      for (const opts of [{}, { special: true }]) {
        const drawn = drawWeights(CONTENT, phase, opts).map((w) => w.card.id);
        for (const id of MEMBER_ROOMS) expect(drawn).not.toContain(id);
      }
    }
  });

  it('say whose room they are, and that Room for everyone needs them', () => {
    const line = (id: PieceId) => cardText(CONTENT, CONTENT.pieces[id]).member;
    expect(line('nursery')).toBe(
      'The twins’ room: it counts as a Bedroom, and from Framing, Room for everyone needs it.',
    );
    expect(line('kidsRoom')).toBe(line('nursery'));
    expect(line('grandmasRoom')).toBe(
      'Grandma’s room: it counts as a Bedroom, and from Drywall, Room for everyone needs it.',
    );
    expect(line('renfieldsRoom')).toContain('Renfield’s room');
    expect(line('ivysRoom')).toContain('from Framing');
    expect(cardText(CONTENT, CONTENT.pieces.bedroom).member).toBeUndefined();
  });

  /** Shape (width × height in rotation 0), tags, and card text. */
  function expectCard(
    id: PieceId,
    size: [number, number],
    tags: readonly Tag[],
    effects: string[],
  ) {
    const def = CONTENT.pieces[id];
    const cells = shapeCells(def.shape, 0);
    expect([bounds(cells).w, bounds(cells).h], id).toEqual(size);
    expect([...def.tags].sort(), id).toEqual([...tags].sort());
    expect(cardText(CONTENT, def).effects, id).toEqual(effects);
  }

  it('Nursery: 2, +2 per Bedroom (up to 2); a Kids’ Room 8 weeks on, in the same shape', () => {
    expectCard(
      'nursery',
      [2, 2],
      ['Quiet', 'Kid'],
      ['+2 every week', '+2 per touching Bedroom (up to 2)', 'Becomes a Kids’ Room after 8 weeks'],
    );
    expect(CONTENT.pieces.nursery.shape).toEqual(CONTENT.pieces.kidsRoom.shape);
    // A Bedroom on each side: +2 each. The Bedrooms get +1 for a Quiet neighbor.
    expect(
      earned(open, [
        ['bedroom', 0, 0],
        ['nursery', 2, 0],
        ['bedroom', 4, 0],
      ]),
    ).toEqual([4, 6, 4]);
  });

  it('Kids’ Room: 4, +2 per Kid piece or Tree (up to 3)', () => {
    expectCard(
      'kidsRoom',
      [2, 2],
      ['Kid'],
      ['+4 every week', '+2 per touching Kid neighbor or Tree (up to 3)'],
    );
    expect(earned(['TT........', ...emptyRows(10, 9)], [['kidsRoom', 0, 1]])).toEqual([4 + 4]);
  });

  it('Grandma’s Room: 3, +2 per Bathroom, Living Room, or Kitchen (up to 3), +1 per garden (up to 2)', () => {
    expectCard(
      'grandmasRoom',
      [2, 2],
      ['Quiet'],
      [
        '+3 every week',
        '+2 per touching Bathroom, Living Room, or Kitchen (up to 3)',
        '+1 per touching Flower Bed or Herb Garden (up to 2)',
      ],
    );
    expect(
      earned(open, [
        ['grandmasRoom', 2, 2],
        ['bathroom', 1, 2],
        ['kitchen', 4, 2],
        ['flowerBed', 2, 4],
      ]),
      // Her room counts as a Bedroom, so the Bathroom earns its +3 too; the Kitchen faces the
      // sun (+2, D-120) and earns +3 of its own (D-165); the Flower Bed is in the front yard
      // (1 + 2).
    ).toEqual([3 + 2 + 2 + 1, 3, 2 + 3, 3]);
  });

  it('Renfield’s Room: 2, +1 per touching room (up to 3)', () => {
    expectCard(
      'renfieldsRoom',
      [2, 1],
      ['Quiet'],
      ['+2 every week', '+1 per touching room (up to 3)'],
    );
    expect(
      earned(open, [
        ['renfieldsRoom', 2, 2],
        ['closet', 1, 2],
        ['closet', 4, 2],
      ]),
    ).toEqual([4, 1, 1]);
  });

  it('Nana’s Room: 3, +2 per Pet piece (up to 2)', () => {
    expectCard(
      'nanasRoom',
      [2, 2],
      ['Quiet'],
      ['+3 every week', '+2 per touching Pet neighbor (up to 2)'],
    );
    // A Doghouse outside her window (it earns nothing outside a fenced yard).
    expect(
      earned(open, [
        ['nanasRoom', 2, 2],
        ['doghouse', 4, 2],
      ]),
    ).toEqual([5, 0]);
  });

  it('Rowan’s Studio: 2, +2 per view (up to 2)', () => {
    expectCard(
      'rowansStudio',
      [2, 1],
      ['Quiet'],
      ['+2 every week', '+2 per touching view (up to 2)'],
    );
    expect(earned(['TTT.......', ...emptyRows(10, 9)], [['rowansStudio', 0, 1]])).toEqual([6]);
  });

  it('Ivy’s Room: 3, +2 if touching a Home Office', () => {
    expectCard('ivysRoom', [2, 2], ['Kid'], ['+3 every week', '+2 if touching a Home Office']);
    expect(
      earned(open, [
        ['ivysRoom', 0, 0],
        ['homeOffice', 2, 0],
        ['homeOffice', 2, 1],
      ]),
    ).toEqual([5, 2, 2]);
  });
});

describe('validateContent', () => {
  it('catches a household’s mistakes', () => {
    const h = CONTENT.clients.hendersons;
    const twins = h.household.arrivals[0]!;
    const broken: Content = {
      ...CONTENT,
      pieces: {
        ...CONTENT.pieces,
        // Drawn, and not a Bedroom.
        ivysRoom: { ...CONTENT.pieces.ivysRoom, drawWeight: 10, countsAs: undefined },
        // Grows into another shape.
        kidsRoom: { ...CONTENT.pieces.kidsRoom, shape: ['###'] },
      },
      clients: {
        ...CONTENT.clients,
        hendersons: {
          ...h,
          household: {
            bedrooms: [3, 2],
            arrivals: [{ ...twins, phase: 0, cards: ['bedroom'] }, h.household.arrivals[1]!],
          },
        },
      },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toMatch(/piece ivysRoom: a member's room has weight 0/);
    expect(problems).toMatch(
      /piece ivysRoom: a member's room is an indoor room counting as a Bedroom/,
    );
    expect(problems).toMatch(/piece nursery: transforms into kidsRoom, which has another shape/);
    expect(problems).toMatch(/client hendersons: household bedrooms/);
    expect(problems).toMatch(/arrival twins: arrives at a phase from 1 to 6/);
    expect(problems).toMatch(/arrival twins: none of its cards is its room/);
  });

  it('needs the checklist to name each member’s room', () => {
    const h = CONTENT.clients.dale;
    const noRoom: Content = {
      ...CONTENT,
      clients: {
        ...CONTENT.clients,
        dale: { ...h, specs: h.specs.filter((s) => s.id !== 'roomForEveryone') },
      },
    };
    expect(validateContent(noRoom).join('\n')).toMatch(
      /arrival ivy: the checklist never names ivysRoom/,
    );
  });

  it('catches a delivery’s and the standing stock’s mistakes (D-160)', () => {
    const dale = CONTENT.clients.dale;
    const broken: Content = {
      ...CONTENT,
      balance: {
        ...CONTENT.balance,
        standingStock: { fromPhase: 9, pieces: ['fence', 'library', 'fence'], firstJobSlot: 5 },
      },
      clients: {
        ...CONTENT.clients,
        dale: {
          ...dale,
          deliveries: [{ phase: 7, cards: ['ivysRoom', 'lawn'], text: '' }],
        },
      },
    };
    const problems = validateContent(broken).join('\n');
    expect(problems).toMatch(/client dale delivery 0: lands at a phase from 0 to 6/);
    expect(problems).toMatch(/client dale delivery 0: needs text/);
    expect(problems).toMatch(/client dale delivery 0: ivysRoom is a member's room/);
    expect(problems).toMatch(/client dale delivery 0: the checklist never names lawn/);
    expect(problems).toMatch(/standingStock: library isn't in the weekly draw/);
    expect(problems).toMatch(/standingStock: a piece twice/);
    expect(problems).toMatch(/standingStock: fromPhase must be a phase of the run/);
    expect(problems).toMatch(/standingStock: firstJobSlot must be a week of the phase/);
  });
});

describe('what a client brings, and the standing stock (D-160)', () => {
  const start = (clientId: ClientId, crewId: CrewId = 'generalContractor') =>
    rules.newRun({ seed: 'brings', clientId, crewId, mode: 'standard' });

  it('Dale brings a Home Office and the Barkers a Doghouse, in week 1; no one else brings any', () => {
    expect(start('dale').reserve).toEqual([{ id: 'homeOffice', client: true }]);
    expect(start('barkers').reserve).toEqual([{ id: 'doghouse', client: true }]);
    for (const id of ['hendersons', 'vladislav', 'juniper'] as const) {
      expect(start(id).reserve, id).toEqual([]);
    }
    // After the crew's starting cards.
    expect(start('barkers', 'landscaper').reserve).toEqual([
      { id: 'sapling', crew: true },
      { id: 'fence', crew: true },
      { id: 'doghouse', client: true },
    ]);
  });

  it('each brings one card of a wish that asks for two, and isn’t a household member', () => {
    const wish = (clientId: ClientId, id: string) =>
      CONTENT.clients[clientId].specs.find((s) => s.id === id)!.condition;
    expect(wish('dale', 'offices')).toEqual({ count: { piece: 'homeOffice' }, min: 2, max: 2 });
    expect(wish('barkers', 'doghouses')).toEqual({ count: { piece: 'doghouse' }, min: 2 });
    for (const id of ['dale', 'barkers'] as const) {
      const client = CONTENT.clients[id];
      expect(client.deliveries?.map((d) => [d.phase, d.cards])).toEqual([
        [0, [id === 'dale' ? 'homeOffice' : 'doghouse']],
      ]);
      // Room for everyone is the household's alone: one Bedroom range, one arrival.
      expect(start(id).arrived).toEqual([]);
      expect(client.household.arrivals).toHaveLength(1);
    }
  });

  it('the stock is a Hallway and a Fence from Foundation, in a first job its third week', () => {
    expect(CONTENT.balance.standingStock).toEqual({
      fromPhase: 1,
      pieces: ['hallway', 'fence'],
      firstJobSlot: 3,
    });
    expect(CONTENT.balance.phases[1]!.name).toBe('Foundation');
    // Both stay in the weekly draw, at their usual weights, from the first week on.
    for (const phase of [0, 1, 4]) {
      const ids = drawWeights(CONTENT, phase).map((w) => w.card.id);
      expect(ids).toContain('hallway');
      expect(ids).toContain('fence');
    }
  });
});

describe('a real Hendersons run', () => {
  it('the twins arrive in week 9 and Grandma in week 17, into the reserve, before the draw', () => {
    let s = start('hendersons', 'household-run');
    const arrived: { week: number; arrival: string; reserve: number }[] = [];
    for (let k = 0; k < 400 && s.week <= 17 && s.screen !== 'lost' && s.screen !== 'won'; k++) {
      let a: Action;
      if (s.screen === 'shop') a = s.offers?.pick ? { t: 'pick', i: -1 } : { t: 'leaveShop' };
      else if (s.screen === 'changeOrder') a = { t: 'answerChangeOrder', i: 0 };
      else if (s.score < rules.target(s))
        a = { t: 'debug', op: 'addScore', amount: rules.target(s) };
      else a = { t: 'pass' };
      const out = rules.apply(s, a);
      for (const e of out.events) {
        if (e.t === 'arrived') {
          arrived.push({
            week: out.state.week,
            arrival: e.arrival,
            reserve: out.state.reserve.length,
          });
          // The draw comes after: the hand drawn in the same step sees the reserve full.
          const at = out.events.indexOf(e);
          expect(out.events.findIndex((x, i) => i > at && x.t === 'handDrawn')).toBeGreaterThan(at);
        }
      }
      s = out.state;
    }
    // D-160: the standing stock's Hallway and Fence came in Foundation's first week (week 5)
    // and wait unplaced, so each arrival's cards follow them.
    expect(arrived).toEqual([
      { week: 9, arrival: 'twins', reserve: 3 },
      { week: 17, arrival: 'grandma', reserve: 5 },
    ]);
    expect(s.reserve).toEqual([
      { id: 'hallway', stock: true },
      { id: 'fence', stock: true },
      { id: 'nursery', arrival: 'twins' },
      { id: 'grandmasRoom', arrival: 'grandma' },
      { id: 'bathroom', arrival: 'grandma' },
    ]);
  });
});
