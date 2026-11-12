// The house rules on the rooms (D-165). Three of D-101's seven checklist lines moved off the
// checklist:
// - Cozy and A Bathroom nearby pay on the rooms, as Comfort: each is a `grantEffect` from a
//   house rule (`content.roomRules`, source kind `house`) that every run has, and each line it
//   adds to a room reads the rule's name;
// - A Bathroom nearby is a `served` effect: each Bedroom with a Bathroom in reach earns, and the
//   house is matched so each Bathroom serves at most its capacity (servedMatch);
// - One Kitchen and A living room or two are the cards' `perHouse`: a card of a type the house
//   has enough of can't be placed, renovates instead, and draws at half weight.
//
// Rules tests use TEST_CONTENT (src/rules/testing.ts), which has no room rules and no caps; each
// test adds its own. Houses are built with houseFrom, so uids follow the placement order.

import { describe, expect, it } from 'vitest';
import type { Card, Content, Effect, PieceId, RoomRuleDef, RunState } from './index.ts';
import { drawWeights } from './draw.ts';
import { computeLayout } from './layout.ts';
import { runModifiers } from './modifiers.ts';
import { createRules } from './run.ts';
import { NO_CONTEXT, servedMatch, tallyHouse } from './scoring.ts';
import { cardText, effectText } from './text.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withPieces,
  type Placement,
} from './testing.ts';

const SERVED: Extract<Effect, { kind: 'served' }> = {
  kind: 'served',
  by: { piece: 'bathroom' },
  amount: 4,
  capacity: 2,
};

const COZY: RoomRuleDef = {
  id: 'cozy',
  name: 'Cozy',
  text: 'A room earns +2 for each room it touches, up to 3.',
  modifiers: [
    {
      kind: 'grantEffect',
      target: { property: 'room' },
      effect: { kind: 'neighbor', match: { property: 'room' }, amount: 2, max: 3 },
    },
  ],
};

const BATHROOM_NEARBY: RoomRuleDef = {
  id: 'bathroomNearby',
  name: 'A Bathroom nearby',
  text: 'A Bedroom earns +4 with a Bathroom in reach, and each Bathroom serves two.',
  modifiers: [{ kind: 'grantEffect', target: { piece: 'bedroom' }, effect: SERVED }],
};

/** The test content with these room rules, and caps on its cards. */
function withRules(
  roomRules: Content['roomRules'],
  caps: Partial<Record<PieceId, number>> = {},
): Content {
  const base = withPieces(
    Object.fromEntries(Object.entries(caps).map(([id, perHouse]) => [id, { perHouse }])),
  );
  return { ...base, roomRules };
}

const ROOMS = withRules({ cozy: COZY, bathroomNearby: BATHROOM_NEARBY });

/** The week's tally of a house, with the run's modifiers (the room rules among them). */
function tally(content: Content, rows: readonly string[], placements: readonly Placement[]) {
  const layout = computeLayout(content, houseFrom(content, rows, placements));
  const mods = runModifiers(content, { setup: setup('room-rules'), blueprints: [] });
  return tallyHouse(content, layout, 1, true, { ...NO_CONTEXT, mods });
}

const linesOf = (t: ReturnType<typeof tally>, uid: number) =>
  t.pieces.find((p) => p.uid === uid)!.lines;

describe('A Bathroom nearby: who serves whom', () => {
  // Bedroom A (uid 1), the Bathroom (2), Bedroom B (3) and Bedroom C (4), each Bedroom touching
  // the Bathroom.
  //   0123456
  // 0 AA.BB..
  // 1 AAxBB..
  // 2 ..CC...
  // 3 ..CC...
  const THREE: readonly Placement[] = [
    ['bedroom', 0, 0],
    ['bathroom', 2, 1],
    ['bedroom', 3, 0],
    ['bedroom', 2, 2],
  ];

  it('a Bathroom serves two Bedrooms, the earliest placed first', () => {
    const layout = computeLayout(ROOMS, houseFrom(ROOMS, emptyRows(7, 4), THREE));
    const m = servedMatch(ROOMS, layout, [1, 3, 4], { piece: 'bathroom' }, 2);
    expect([...m]).toEqual([
      [1, 2],
      [3, 2],
    ]);
  });

  it('moves a Bedroom to its other Bathroom so one more is served', () => {
    // A (uid 1) touches Bathrooms X (2) and Y (3); B (4) touches only X. At one Bedroom a
    // Bathroom, A first takes X, then moves to Y so B can have X.
    //   012345
    // 0 BB....
    // 1 BBX...
    // 2 ..AAY.
    // 3 ..AA..
    const house = houseFrom(C, emptyRows(6, 5), [
      ['bedroom', 2, 2],
      ['bathroom', 2, 1],
      ['bathroom', 4, 2],
      ['bedroom', 0, 0],
    ]);
    const m = servedMatch(C, computeLayout(C, house), [1, 4], { piece: 'bathroom' }, 1);
    expect(m.get(1)).toBe(3);
    expect(m.get(4)).toBe(2);
  });

  it('reaches across a Hallway, as touching does for the rooms a Hallway links', () => {
    //   0123456
    // 0 AAhhx..   A Bedroom, h a Hallway, x a Bathroom
    // 1 AA.....
    const house = houseFrom(C, emptyRows(7, 3), [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['bathroom', 4, 0],
    ]);
    const m = servedMatch(C, computeLayout(C, house), [1], { piece: 'bathroom' }, 2);
    expect(m.get(1)).toBe(3);
  });

  it('pays the Bedrooms it serves, named for the rule, with an arc from their Bathroom', () => {
    const t = tally(withRules({ bathroomNearby: BATHROOM_NEARBY }), emptyRows(7, 4), THREE);
    const rule = (uid: number) => linesOf(t, uid).filter((l) => l.label === 'A Bathroom nearby');
    expect(rule(1)).toEqual([
      {
        label: 'A Bathroom nearby',
        op: 'add',
        value: 4,
        from: [{ kind: 'piece', uid: 2 }],
        rule: 'bathroomNearby',
      },
    ]);
    expect(rule(3)).toHaveLength(1);
    expect(rule(4)).toEqual([]); // the Bathroom serves two already
    expect(rule(2)).toEqual([]); // a Bathroom isn't a Bedroom
  });
});

describe('Cozy: every room earns for the rooms it touches', () => {
  it('pays each room per room it touches, up to 3, with the rule as its label', () => {
    //   0123456
    // 0 AABBCC.   A, B, C: Bedrooms in a row; x: a Bathroom under B
    // 1 AABBCC.
    // 2 ..x....
    const t = tally(withRules({ cozy: COZY }), emptyRows(7, 4), [
      ['bedroom', 0, 0],
      ['bedroom', 2, 0],
      ['bedroom', 4, 0],
      ['bathroom', 2, 2],
    ]);
    const cozy = (uid: number) => linesOf(t, uid).find((l) => l.label === 'Cozy');
    expect(cozy(1)).toEqual({
      label: 'Cozy',
      op: 'add',
      value: 2,
      from: [{ kind: 'piece', uid: 2 }],
      rule: 'cozy',
    });
    expect(cozy(2)?.value).toBe(6); // A, C and the Bathroom
    expect(cozy(3)?.value).toBe(2);
    expect(cozy(4)?.value).toBe(2); // the Bathroom is a room too
  });

  it('is only in a run whose content has it', () => {
    const t = tally(C, emptyRows(7, 4), [
      ['bedroom', 0, 0],
      ['bedroom', 2, 0],
    ]);
    expect(linesOf(t, 1).some((l) => l.label === 'Cozy')).toBe(false);
  });

  it('a threshold on what a room touches credits those rooms in its line', () => {
    const threshold: RoomRuleDef = {
      ...COZY,
      modifiers: [
        {
          kind: 'grantEffect',
          target: { property: 'room' },
          effect: {
            kind: 'conditional',
            when: { is: { touching: { property: 'room' }, min: 2 } },
            effect: { kind: 'steady', amount: 5 },
          },
        },
      ],
    };
    const t = tally(withRules({ cozy: threshold }), emptyRows(7, 3), [
      ['bedroom', 0, 0],
      ['bedroom', 2, 0],
      ['bedroom', 4, 0],
    ]);
    expect(linesOf(t, 2).find((l) => l.label === 'Cozy')).toEqual({
      label: 'Cozy',
      op: 'add',
      value: 5,
      from: [
        { kind: 'piece', uid: 1 },
        { kind: 'piece', uid: 3 },
      ],
      rule: 'cozy',
    });
    expect(linesOf(t, 1).some((l) => l.label === 'Cozy')).toBe(false); // touches one
  });
});

describe('per-house caps on the cards', () => {
  const CAPPED = withRules({}, { kitchen: 1, livingRoom: 2 });
  const R = createRules(CAPPED);
  const pc = (id: PieceId): Card => ({ kind: 'piece', id });

  function build(placements: readonly Placement[], hand: readonly Card[]): RunState {
    const s = R.newRun(setup('caps'));
    return { ...s, house: houseFrom(CAPPED, emptyRows(12, 12), placements), hand };
  }

  it('a card of a type the house has enough of can’t be placed: it renovates', () => {
    const s = build([['kitchen', 2, 2]], [pc('lKitchen')]);
    const check = R.checkPlay(s, { t: 'place', from: 'hand', i: 0, x: 6, y: 6, rot: 0 });
    expect(check.legal).toBe(false);
    expect(check.reason).toBe('The house has its Kitchen: this card renovates it.');
    expect(R.legalPlacements(s)).toEqual([]);
    expect(R.cardFits(s, 0)).toBe(false);
    expect(R.renovateTargets(s, 'hand', 0)).toEqual([1]);
  });

  it('counts by type, and says how many a house holds', () => {
    const one = build([['livingRoom', 0, 0]], [pc('livingRoom')]);
    expect(R.cardFits(one, 0)).toBe(true);
    expect(R.renovateTargets(one, 'hand', 0)).toEqual([]);
    const two = build(
      [
        ['livingRoom', 0, 0],
        ['livingRoom', 4, 0],
      ],
      [pc('livingRoom')],
    );
    expect(R.cardFits(two, 0)).toBe(false);
    expect(R.checkPlay(two, { t: 'place', from: 'hand', i: 0, x: 8, y: 6, rot: 0 }).reason).toBe(
      'The house has its Living Rooms: this card renovates one.',
    );
    expect(cardText(CAPPED, CAPPED.pieces.livingRoom).perHouse).toBe(
      'Two per house: another renovates it.',
    );
    // A variant card has its type's cap.
    expect(cardText(CAPPED, CAPPED.pieces.lKitchen).perHouse).toBe(
      'One per house: another renovates it.',
    );
    expect(cardText(CAPPED, CAPPED.pieces.bedroom).perHouse).toBeUndefined();
  });

  it('a type at its cap draws at half weight', () => {
    const s = build([['kitchen', 2, 2]], []);
    const atLimit = new Set(R.limits(s).flatMap((l) => (l.count >= l.max ? l.types : [])));
    expect(atLimit.has('kitchen')).toBe(true);
    const half = drawWeights(CAPPED, 0, { atLimit });
    const full = drawWeights(CAPPED, 0);
    const w = (list: typeof full) =>
      list.find((x) => x.card.kind === 'piece' && x.card.id === 'kitchen')?.weight;
    expect(w(half)).toBe(Math.floor(w(full)! / 2));
  });
});

describe('the estimate sees the room rules', () => {
  const R = createRules(ROOMS);

  it('counts Cozy for the new room and the room it touches, and a Bathroom for its Bedrooms', () => {
    const s: RunState = {
      ...R.newRun(setup('room-rules-estimate')),
      house: houseFrom(ROOMS, emptyRows(12, 12), [['bedroom', 2, 2]]),
      hand: [
        { kind: 'piece', id: 'closet' },
        { kind: 'piece', id: 'bathroom' },
      ],
    };
    for (const [i, x, y] of [
      [0, 4, 2], // a Closet beside the Bedroom
      [1, 4, 3], // a Bathroom beside it
      [1, 8, 8], // a Bathroom on its own
    ] as const) {
      const play = { t: 'place', from: 'hand', i, x, y, rot: 0 } as const;
      expect(R.estimatePlay(s, play).delta, `card ${i} at (${x}, ${y})`).toBe(
        R.preview(s, play).delta,
      );
    }
  });
});

describe('the served effect’s text', () => {
  it('says what serves it and how many each serves', () => {
    expect(effectText(C, SERVED)).toBe('+4 with a Bathroom in reach (each serves 2)');
  });
});
