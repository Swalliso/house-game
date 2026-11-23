// The house model (D-097, D-093): walls on every edge between two pieces, Hallways' doors from
// the rules' links (once a room a corridor, D-184), a held set's rooms opening into each other
// (D-176), a front door that faces the street, a door tree that reaches every room,
// windows in outside walls, and the same answer every time.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  placedCells,
  rules,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { isBlocked, lotFromRows } from '../../rules/lot.ts';
import { CELL } from '../sprites.ts';
import {
  EDGE,
  OPENING,
  WALL,
  edge,
  hallLinks,
  heldSets,
  houseModel,
  overlaps,
  pieceModel,
  roomAt,
  type Doorway,
  type HeldSets,
  type HouseModel,
  type Rect,
} from './house-model.ts';

type Spec = readonly [PieceId, number, number, Rot?];

const EMPTY = Array.from({ length: 12 }, () => '.'.repeat(12));

function house(specs: readonly Spec[], rows: readonly string[] = EMPTY): HouseState {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot,
    placedWeek: i,
  }));
  return { lot: lotFromRows(rows), pieces, nextUid: pieces.length + 1 };
}

/** The model with the rules' Hallway links, as the board builds it. */
function modelOf(h: HouseState): HouseModel {
  const state = {
    ...rules.newRun({
      seed: 'house',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    }),
    house: h,
  };
  return houseModel(h, hallLinks(state));
}

const uidOf = (h: HouseState, defId: PieceId, nth = 0) =>
  h.pieces.filter((p) => p.defId === defId)[nth]!.uid;

/** The pieces open into each other with no wall between them (touching Hallways, D-159), both ways. */
function openJoints(m: HouseModel): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>();
  const add = (a: number, b: number) => {
    let s = out.get(a);
    if (!s) out.set(a, (s = new Set()));
    s.add(b);
  };
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const a = roomAt(m, x, y);
      if (!a) continue;
      for (const [nx, ny, side] of [
        [x + 1, y, 'E'],
        [x, y + 1, 'S'],
      ] as const) {
        const b = roomAt(m, nx, ny);
        if (b && b !== a && edge(m, x, y, side) === EDGE.none) {
          add(a, b);
          add(b, a);
        }
      }
    }
  }
  return out;
}

/**
 * Rooms joined by doorways, or open into each other (touching Hallways), from each outside door:
 * every room should be in one of these.
 */
function reachable(m: HouseModel): Set<number> {
  const seen = new Set<number>(m.exits.map((e) => e.uid));
  const stack = [...seen];
  const open = openJoints(m);
  while (stack.length > 0) {
    const u = stack.pop()!;
    const next = [
      ...m.doors.map((d) => (d.a === u ? d.b : d.b === u ? d.a : 0)),
      ...(open.get(u) ?? []),
    ];
    for (const o of next) {
      if (o && !seen.has(o)) {
        seen.add(o);
        stack.push(o);
      }
    }
  }
  return seen;
}

function doorBetween(m: HouseModel, a: number, b: number) {
  return m.doors.find((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a));
}

/** Every opening's gap, to check none overlap. */
function gaps(m: HouseModel): Rect[] {
  return [...m.doors.map((d) => d.gap), ...m.exits.map((e) => e.gap)];
}

describe('walls', () => {
  it('stand between any two pieces, same type included, and never inside one (D-093)', () => {
    const h = house([
      ['bedroom', 2, 2],
      ['bedroom', 4, 2],
      ['lKitchen', 2, 4],
    ]);
    const m = modelOf(h);
    // Between the two Bedrooms: a wall between rooms on both rows they share.
    expect(edge(m, 3, 2, 'E')).toBe(EDGE.inner);
    expect(edge(m, 4, 3, 'W')).toBe(EDGE.inner);
    // Inside a Bedroom, and inside the L-Kitchen's L: none.
    expect(edge(m, 2, 2, 'E')).toBe(EDGE.none);
    expect(edge(m, 2, 3, 'N')).toBe(EDGE.none);
    expect(edge(m, 2, 5, 'N')).toBe(EDGE.none);
    expect(edge(m, 2, 5, 'E')).toBe(EDGE.none);
    // Around the house: outside walls, the lot's edge included.
    expect(edge(m, 2, 2, 'N')).toBe(EDGE.outer);
    expect(edge(m, 5, 2, 'E')).toBe(EDGE.outer);
    expect(edge(m, 2, 4, 'E')).toBe(EDGE.outer); // the L's notch
    const edgeRoom = modelOf(house([['bathroom', 0, 11]]));
    expect(edge(edgeRoom, 0, 11, 'W')).toBe(EDGE.outer);
    expect(edge(edgeRoom, 0, 11, 'S')).toBe(EDGE.outer);
  });

  it('see only rooms: a yard piece next to a room is outside', () => {
    const m = modelOf(
      house([
        ['livingRoom', 2, 2],
        ['patio', 4, 2],
      ]),
    );
    expect(edge(m, 3, 2, 'E')).toBe(EDGE.outer);
    expect(roomAt(m, 4, 2)).toBe(0);
  });
});

describe('Hallways', () => {
  // A Hallway with a Bedroom on each side and a Bathroom below one end.
  const h = house([
    ['bedroom', 1, 1],
    ['hallway', 3, 2],
    ['bedroom', 5, 1],
    ['bathroom', 3, 3],
    ['livingRoom', 7, 1],
  ]);
  const m = modelOf(h);
  const hall = uidOf(h, 'hallway');

  it('open into every room the rules link through them', () => {
    const state = {
      ...rules.newRun({
        seed: 'h',
        clientId: 'hendersons',
        crewId: 'generalContractor',
        mode: 'standard',
      }),
      house: h,
    };
    const linked = new Set<number>();
    for (const p of h.pieces) {
      for (const o of rules.describePiece(state, p.uid)?.linked ?? []) linked.add(o);
    }
    expect(linked.size).toBeGreaterThan(0);
    for (const uid of linked) {
      const d = doorBetween(m, hall, uid);
      expect(d, CONTENT.pieces[h.pieces[uid - 1]!.defId].name).toBeDefined();
      expect(d!.why).toBe('hall');
    }
    // The Living Room touches only a Bedroom: it's reached by the tree, not the Hallway.
    const living = uidOf(h, 'livingRoom');
    expect(
      m.doors.filter((d) => d.why === 'hall').every((d) => d.a !== living && d.b !== living),
    ).toBe(true);
  });

  it('get no doors from links the rules don’t have', () => {
    expect(m.doors.filter((d) => d.why === 'hall').every((d) => d.a === hall || d.b === hall)).toBe(
      true,
    );
  });

  it('open into touching Hallways with no wall between them, and never into a room (D-159)', () => {
    // A Hallway and a Long Hallway end to end, a Hallway down from its east end, a Bedroom above.
    const h2 = house([
      ['hallway', 2, 3],
      ['longHallway', 4, 3],
      ['hallway', 6, 4, 1],
      ['bedroom', 2, 1],
    ]);
    const m2 = modelOf(h2);
    const [a, b, c, bed] = [1, 2, 3, 4];
    // End to end, and round the corner: open. Each cell is still its own piece's.
    expect(edge(m2, 3, 3, 'E')).toBe(EDGE.none);
    expect(edge(m2, 6, 3, 'S')).toBe(EDGE.none);
    expect([roomAt(m2, 3, 3), roomAt(m2, 4, 3), roomAt(m2, 6, 4)]).toEqual([a, b, c]);
    // No doorway between them: they're one corridor.
    for (const [p, q] of [
      [a, b],
      [b, c],
    ] as const) {
      expect(doorBetween(m2, p, q)).toBeUndefined();
    }
    // A room keeps its wall, with its doorway from the hall.
    expect(edge(m2, 2, 2, 'S')).toBe(EDGE.inner);
    expect(doorBetween(m2, a, bed)).toBeDefined();
    // Every piece is reached, through the doorway and the open joints.
    expect(reachable(m2).size).toBe(m2.rooms.size);
    // Two rooms of a type still never merge.
    const twin = modelOf(
      house([
        ['bedroom', 2, 2],
        ['bedroom', 4, 2],
      ]),
    );
    expect(edge(twin, 3, 2, 'E')).toBe(EDGE.inner);
  });
});

describe('the front door', () => {
  it('opens onto the street from the best entry room on the front row', () => {
    const rows = EMPTY.slice(0, 8);
    const h = house(
      [
        ['bedroom', 2, 4],
        ['mudroom', 4, 7],
        ['livingRoom', 4, 4, 1],
      ],
      rows,
    );
    const m = modelOf(h);
    const front = m.exits.find((e) => e.kind === 'front')!;
    expect(front.uid).toBe(uidOf(h, 'mudroom'));
    expect(front.side).toBe('S');
    expect(front.onto).toBe(0);
    expect(front.mat.y).toBeGreaterThanOrEqual(8 * CELL); // on the sidewalk
  });

  it('never opens onto a tree, water, a boulder, a fence or an outbuilding', () => {
    // A Living Room whose whole south side is blocked: a Tree, then a Fence.
    const rows = [
      '..........',
      '..........',
      '..........',
      '..........',
      '...T......',
      '..........',
    ];
    const h = house(
      [
        ['livingRoom', 3, 1],
        ['fence', 4, 4, 1],
      ],
      rows,
    );
    const m = modelOf(h);
    const front = m.exits.find((e) => e.kind === 'front')!;
    expect(front).toBeDefined();
    expect(front.side).not.toBe('S');
    for (const e of m.exits) {
      const [dx, dy] = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[e.side];
      const x = e.cell.x + dx!;
      const y = e.cell.y + dy!;
      expect(h.lot.terrain[y * h.lot.width + x] ?? null).toBeNull();
    }
  });

  it('goes through a garage, a bathroom or a closet only when no other room can have one', () => {
    // The Bathroom and the Closet hold the house's street-facing south walls, but the Living
    // Room has open side walls: the front door is the Living Room's.
    const h = house([
      ['livingRoom', 4, 7],
      ['bathroom', 4, 10],
      ['closet', 5, 10],
    ]);
    const front = modelOf(h).exits.find((e) => e.kind === 'front')!;
    expect(front.uid).toBe(uidOf(h, 'livingRoom'));
    // With the Living Room ringed by Trees, the Bathroom's wall onto the street beats a door
    // into the woods.
    const ringed = house(
      [
        ['livingRoom', 4, 4],
        ['bathroom', 4, 7],
      ],
      [
        '............',
        '............',
        '............',
        '....TT......',
        '...T..T.....',
        '...T..T.....',
        '...T..T.....',
        '...T.T......',
      ],
    );
    const door = modelOf(ringed).exits.find((e) => e.kind === 'front')!;
    expect(door.uid).toBe(uidOf(ringed, 'bathroom'));
    expect(door.side).toBe('S');
  });

  it('opens onto the woods or a low yard piece when nothing else around the house can', () => {
    // A Kitchen and a Bedroom built into the woods, an Herb Garden to the west: every outside
    // wall faces a Tree or the garden (the novice bot's rv-14 house).
    const h = house(
      [
        ['kitchen', 3, 1],
        ['herbGarden', 2, 1, 1],
        ['bedroom', 5, 2],
      ],
      [
        '...TT.......',
        '.....TT.....',
        '.......T....',
        '...TT..T....',
        '.....TT.....',
        '............',
      ],
    );
    const m = modelOf(h);
    expect(m.exits.filter((e) => e.kind === 'front')).toHaveLength(1);
    expect(reachable(m).size).toBe(m.rooms.size);
    // Water, a boulder or the Old Shed never: the same house with the woods turned to rock.
    const rock = house(
      [
        ['kitchen', 3, 1],
        ['bedroom', 5, 2],
      ],
      [
        'BBBBBBBBBBBB',
        'BBB..BBBBBBB',
        'BBB....BBBBB',
        'BBBBB..BBBBB',
        'BBBBBBBBBBBB',
        'BBBBBBBBBBBB',
      ],
    );
    expect(modelOf(rock).exits).toEqual([]);
  });

  it('prefers paved ground: a Patio over grass', () => {
    const h = house([
      ['livingRoom', 2, 2],
      ['livingRoom', 5, 2],
      ['patio', 5, 5],
    ]);
    const m = modelOf(h);
    const front = m.exits.find((e) => e.kind === 'front')!;
    expect(front.uid).toBe(uidOf(h, 'livingRoom', 1));
    expect(front.onto).toBe(h.pieces[2]!.uid);
    // That Patio is served, so it gets no back door as well.
    expect(m.exits.filter((e) => e.onto === front.onto)).toHaveLength(1);
  });
});

describe('back and garage doors', () => {
  it('give a touching Patio or Hot Tub a back door, from a public room', () => {
    const h = house([
      ['bedroom', 2, 4],
      ['kitchen', 4, 4],
      ['patio', 4, 2],
      ['hotTub', 1, 4],
    ]);
    const m = modelOf(h);
    const patio = h.pieces[2]!.uid;
    const tub = h.pieces[3]!.uid;
    const back = m.exits.filter((e) => e.kind === 'back');
    expect(back.find((e) => e.onto === patio)?.uid).toBe(uidOf(h, 'kitchen'));
    expect(back.find((e) => e.onto === tub)?.uid).toBe(uidOf(h, 'bedroom'));
  });

  it('put a Garage’s door toward its Driveway, or the street', () => {
    const toDrive = house([
      ['garage', 4, 2],
      ['driveway', 4, 4, 1],
    ]);
    const m = modelOf(toDrive);
    expect(m.garageDoors).toHaveLength(1);
    expect(m.garageDoors[0]!.side).toBe('S');
    expect(edge(m, 4, 3, 'S')).toBe(EDGE.garage);
    // A double door across the Garage's side, so the car drives in square off a one-cell Driveway.
    expect(edge(m, 5, 3, 'S')).toBe(EDGE.garage);
    expect(m.garageDoors[0]!.cells).toHaveLength(2);
    const toStreet = modelOf(house([['garage', 4, 10]]));
    expect(toStreet.garageDoors[0]!.cells).toHaveLength(2);
    expect(edge(toStreet, 4, 11, 'S')).toBe(EDGE.garage);
  });
});

describe('the door tree', () => {
  it('reaches a house with no Hallway through as few doors as it takes', () => {
    const h = house([
      ['livingRoom', 2, 2],
      ['kitchen', 4, 2],
      ['diningRoom', 6, 2],
      ['bedroom', 4, 4],
      ['bathroom', 6, 4],
      ['closet', 3, 5],
    ]);
    const m = modelOf(h);
    expect(reachable(m).size).toBe(m.rooms.size);
    expect(m.doors).toHaveLength(m.rooms.size - 1);
    // The closet opens off the Bedroom, not the Living Room.
    expect(doorBetween(m, uidOf(h, 'closet'), uidOf(h, 'bedroom'))).toBeDefined();
  });

  it('opens a closet off a member’s room, which counts as a Bedroom (D-103)', () => {
    const h = house([
      ['livingRoom', 2, 2],
      ['kitchen', 4, 2],
      ['grandmasRoom', 4, 4],
      ['closet', 3, 5],
    ]);
    const m = modelOf(h);
    expect(reachable(m).size).toBe(m.rooms.size);
    // Off Grandma's Room, not the Living Room it also touches.
    expect(doorBetween(m, uidOf(h, 'closet'), uidOf(h, 'grandmasRoom'))).toBeDefined();
    expect(doorBetween(m, uidOf(h, 'closet'), uidOf(h, 'livingRoom'))).toBeUndefined();
  });

  it('opens a member’s room off the room its story puts it by (D-111)', () => {
    // Each touches the Living Room too, which the Bedroom, the Home Office or the Mudroom beside
    // it would otherwise lose to: the twins off their parents' Bedroom (the Nursery and the Kids'
    // Room it grows into), Ivy off Dale's Home Office, Nana off the Mudroom.
    for (const [member, parent, py] of [
      ['nursery', 'bedroom', 2],
      ['kidsRoom', 'bedroom', 2],
      ['ivysRoom', 'homeOffice', 3],
      ['nanasRoom', 'mudroom', 3],
    ] as const) {
      // The Living Room's 2×3 at columns 2–3, the parent east of it down to row 3 (a Bedroom is
      // 2×2, the Home Office and the Mudroom 2×1), the member's 2×2 under both.
      const h = house([
        ['livingRoom', 2, 1],
        [parent, 4, py],
        [member, 3, 4],
      ]);
      const m = modelOf(h);
      expect(reachable(m).size, member).toBe(m.rooms.size);
      expect(doorBetween(m, uidOf(h, member), uidOf(h, parent)), member).toBeDefined();
      expect(doorBetween(m, uidOf(h, member), uidOf(h, 'livingRoom')), member).toBeUndefined();
    }
  });

  it('keeps doors out of the middle of north walls', () => {
    const h = house([
      ['livingRoom', 2, 1],
      ['bedroom', 4, 4],
      ['hallway', 4, 3],
    ]);
    const m = modelOf(h);
    for (const d of m.doors.filter((q) => q.dir === 'h')) {
      // The lower room's north wall here is the Bedroom's, 2 cells wide: its middle third stays clear.
      const room = m.rooms.get(d.b)!;
      if (room.box.w < 2 * CELL) continue;
      const mid = room.box.x + room.box.w / 2;
      expect(Math.abs(d.gap.x + d.gap.w / 2 - mid)).toBeGreaterThan(room.box.w / 6);
    }
  });
});

describe('windows', () => {
  it('go in outside walls, about one per two cells, never in closets, garages or hallways', () => {
    const h = house([
      ['bedroom', 2, 2],
      ['closet', 4, 2],
      ['hallway', 4, 1],
      ['garage', 6, 1],
    ]);
    const m = modelOf(h);
    const bed = uidOf(h, 'bedroom');
    // One per side: each side is 2 cells, and the east one has the Closet on one of them.
    expect(
      m.windows
        .filter((w) => w.uid === bed)
        .map((w) => w.side)
        .sort(),
    ).toEqual(['E', 'N', 'S', 'W']);
    for (const id of ['closet', 'hallway', 'garage'] as const) {
      expect(m.windows.filter((w) => w.uid === uidOf(h, id))).toEqual([]);
    }
    for (const w of m.windows) {
      expect(w.rect.w === WALL.out || w.rect.h === WALL.out).toBe(true);
    }
  });
});

describe('the ghost’s model', () => {
  it('is the piece alone: outside walls all round, no doors or windows', () => {
    const m = pieceModel('lKitchen', 1);
    expect(m.bounds).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(m.doors).toEqual([]);
    expect(m.exits).toEqual([]);
    expect(m.windows).toEqual([]);
    expect(m.garageDoors).toEqual([]);
    const cells = placedCells(CONTENT.pieces.lKitchen.shape, 0, 0, 1);
    for (const c of cells) {
      for (const s of ['N', 'E', 'S', 'W'] as const) {
        expect([EDGE.none, EDGE.outer]).toContain(edge(m, c.x, c.y, s));
      }
    }
    expect(pieceModel('lKitchen', 1)).toBe(m);
  });

  it('takes a pack’s own tiles (D-106) in place of its card’s shape, cached apart', () => {
    const own = ['#..', '###'];
    const m = pieceModel('kitchen', 1, undefined, own);
    // Turned once: 2 wide and 3 tall, on exactly the tiles the shape gives.
    expect([m.width, m.height]).toEqual([2, 3]);
    expect(m.bounds).toEqual({ x: 0, y: 0, w: 2, h: 3 });
    const cells = placedCells(own, 0, 0, 1);
    const room = [...m.rooms.values()][0]!;
    expect(room.cells).toEqual(cells);
    for (const c of cells) {
      for (const s of ['N', 'E', 'S', 'W'] as const) {
        expect([EDGE.none, EDGE.outer]).toContain(edge(m, c.x, c.y, s));
      }
    }
    expect(pieceModel('kitchen', 1, undefined, own)).toBe(m);
    // The card's own shape is another model: a 2 × 2 Kitchen.
    expect(pieceModel('kitchen', 1).bounds).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });

  // D-179's unmet, D-181's lit and D-183's client all ride on the look, each alone or together.
  it('is cached apart for a look that differs in any one thing, and is that look’s', () => {
    const base = { color: 2, style: 1, fixture: 'fireplace' as const };
    const looks = [
      base,
      { ...base, unmet: true },
      { ...base, lit: true },
      { ...base, client: 'barkers' as const },
      { ...base, client: 'vladislav' as const },
      { ...base, unmet: true, lit: true, client: 'barkers' as const },
    ];
    const models = looks.map((look) => pieceModel('livingRoom', 0, look));
    expect(new Set(models).size).toBe(looks.length);
    models.forEach((m, i) => {
      expect(m.look, JSON.stringify(looks[i])).toEqual(looks[i]);
      // The same look again: the same model.
      expect(pieceModel('livingRoom', 0, { ...looks[i]! })).toBe(m);
    });
    // Only a lit look's room is finished (D-181).
    expect(models.map((m) => !!m.rooms.get(1)!.finished)).toEqual([
      false,
      false,
      true,
      false,
      false,
      true,
    ]);
  });
});

describe('the house’s model', () => {
  it('is cached per house, links, sun and client, and tells two clients apart', () => {
    const h = house([
      ['kitchen', 4, 4],
      ['livingRoom', 6, 4],
    ]);
    const state = {
      ...rules.newRun({
        seed: 'house',
        clientId: 'barkers',
        crewId: 'generalContractor',
        mode: 'standard',
      }),
      house: h,
    };
    const links = hallLinks(state);
    const barkers = houseModel(h, links, null, 'barkers');
    expect(barkers.client).toBe('barkers');
    expect(houseModel(h, links, null, 'barkers')).toBe(barkers);
    // Another client, or none, is another model: the Barkers' dogs' bed is theirs alone.
    const count = houseModel(h, links, null, 'vladislav');
    expect(count).not.toBe(barkers);
    expect(count.client).toBe('vladislav');
    const none = houseModel(h, links, null);
    expect(none).not.toBe(barkers);
    expect(none).not.toBe(count);
    expect(none.client).toBeUndefined();
    // And each, asked for again, is that client's (the cache keeps the last one asked for).
    expect(houseModel(h, links, null, 'barkers').client).toBe('barkers');
    expect(houseModel(h, links, null, 'vladislav').client).toBe('vladislav');
  });
});

/**
 * What a front or side door may open onto, as house-model.ts has it (FRONT_ONTO and LAST_ONTO).
 * A Hot Tub is not here: it takes a back door only, and never from a Closet.
 */
const DOOR_ONTO: ReadonlySet<PieceId> = new Set([
  'patio',
  'driveway',
  'lawn',
  'porch',
  'flowerBed',
  'herbGarden',
  'sapling',
]);
const WALL_SIDES = [
  ['N', 0, -1],
  ['E', 1, 0],
  ['S', 0, 1],
  ['W', -1, 0],
] as const;

/**
 * How many outside walls of these rooms a front or side door could go in: one on the street, on
 * open ground, on a Tree's or a Time Capsule's tile, or on a yard piece such a door may open
 * onto. A garage door's side doesn't count. None means the rooms are walled in (by the lot's
 * side or back edge, water, a boulder, the Old Shed, a fence, an outbuilding or any other yard
 * piece a door can't open onto), and the model gives such rooms no door of their own.
 */
function doorableWalls(h: HouseState, m: HouseModel, uids: ReadonlySet<number>): number {
  const { width: W, height: H } = h.lot;
  const yard = new Map<string, PieceId>();
  for (const p of h.pieces) {
    const def = CONTENT.pieces[p.defId];
    if (def.category === 'indoor') continue;
    for (const c of placedCells(def.shape, p.x, p.y, p.rot)) yard.set(`${c.x},${c.y}`, p.defId);
  }
  let n = 0;
  for (const r of m.rooms.values()) {
    if (!uids.has(r.uid)) continue;
    for (const c of r.cells) {
      for (const [side, dx, dy] of WALL_SIDES) {
        if (edge(m, c.x, c.y, side) !== EDGE.outer) continue;
        const x = c.x + dx;
        const y = c.y + dy;
        if (side === 'S' && y === H) n++;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const on = yard.get(`${x},${y}`);
        const t = h.lot.terrain[y * W + x];
        if (on ? DOOR_ONTO.has(on) : !t || t === 'tree' || t === 'timeCapsule') n++;
      }
    }
  }
  return n;
}

/** Whether doorways join every room to every other, outside doors aside. */
function joined(m: HouseModel): boolean {
  const first = [...m.rooms.keys()][0];
  if (first === undefined) return true;
  const seen = new Set([first]);
  const stack = [first];
  while (stack.length > 0) {
    const u = stack.pop()!;
    for (const d of m.doors) {
      const o = d.a === u ? d.b : d.b === u ? d.a : 0;
      if (o && !seen.has(o)) {
        seen.add(o);
        stack.push(o);
      }
    }
  }
  return seen.size === m.rooms.size;
}

// Random connected houses on a lot with a little terrain and yard, for the rules that must
// always hold.
// The Addition (D-171) never stands on the lot: it becomes part of the room it extends.
const INDOOR = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
  (id) => CONTENT.pieces[id].category === 'indoor' && !CONTENT.pieces[id].addition,
);
const YARD: readonly PieceId[] = ['patio', 'driveway', 'fence', 'lawn', 'hotTub', 'doghouse'];

function randomHouse(seed: number, kinds: readonly PieceId[] = INDOOR): HouseState {
  let s = seed >>> 0 || 1;
  const rand = (n: number) => {
    s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0;
    return s % n;
  };
  const W = 14;
  const rows = Array.from({ length: 14 }, (_, y) =>
    Array.from({ length: W }, (_, x) => {
      const r = (x * 7 + y * 13 + seed) % 23;
      return r === 0 ? 'T' : r === 5 ? 'B' : '.';
    }).join(''),
  );
  const lot = lotFromRows(rows);
  const taken = new Set<string>();
  const indoor = new Set<string>();
  const pieces: PlacedPiece[] = [];
  const blocked = (x: number, y: number) =>
    x < 0 || y < 0 || x >= W || y >= 14 || taken.has(`${x},${y}`) || rows[y]![x] !== '.';
  const tryPlace = (defId: PieceId, mustTouchHouse: boolean) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const rot = rand(4) as Rot;
      const x = rand(W);
      const y = rand(14);
      const cells = placedCells(CONTENT.pieces[defId].shape, x, y, rot);
      if (cells.some((c) => blocked(c.x, c.y))) continue;
      const touches = cells.some((c) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => indoor.has(`${c.x + dx!},${c.y + dy!}`)),
      );
      if (mustTouchHouse && indoor.size > 0 && !touches) continue;
      for (const c of cells) {
        taken.add(`${c.x},${c.y}`);
        if (CONTENT.pieces[defId].category === 'indoor') indoor.add(`${c.x},${c.y}`);
      }
      pieces.push({ uid: pieces.length + 1, defId, x, y, rot, placedWeek: 0 });
      return;
    }
  };
  const rooms = 4 + rand(12);
  for (let i = 0; i < rooms; i++) tryPlace(kinds[rand(kinds.length)]!, true);
  for (let i = 0; i < 4; i++) tryPlace(YARD[rand(YARD.length)]!, true);
  return { lot, pieces, nextUid: pieces.length + 1 };
}

/**
 * A house on a lot the game made (woods, a creek, a pond, boulders), started in the woods: Trees
 * under a piece are built over, as in the game, so the house stands in a clearing of its own.
 */
function woodsHouse(seed: number): HouseState {
  const { lot } = rules.newRun({
    seed: `woods-${seed}`,
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  }).house;
  let s = seed >>> 0 || 1;
  const rand = (n: number) => {
    s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0;
    return s % n;
  };
  const { width: W, height: H } = lot;
  const terrain = [...lot.terrain];
  const taken = new Set<string>();
  const indoor = new Set<string>();
  const pieces: PlacedPiece[] = [];
  const trees = terrain.flatMap((t, i) => (t === 'tree' ? [i] : []));
  const blocked = (x: number, y: number) =>
    x < 0 || y < 0 || x >= W || y >= H || taken.has(`${x},${y}`) || isBlocked(terrain[y * W + x]!);
  const place = (defId: PieceId, at?: number) => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const rot = rand(4) as Rot;
      const x = at === undefined ? rand(W) : (at % W) - rand(2);
      const y = at === undefined ? rand(H) : Math.floor(at / W) - rand(2);
      const cells = placedCells(CONTENT.pieces[defId].shape, x, y, rot);
      if (cells.some((c) => blocked(c.x, c.y))) continue;
      const touches = cells.some((c) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => indoor.has(`${c.x + dx!},${c.y + dy!}`)),
      );
      if (indoor.size > 0 && !touches) continue;
      for (const c of cells) {
        taken.add(`${c.x},${c.y}`);
        if (CONTENT.pieces[defId].category === 'indoor') indoor.add(`${c.x},${c.y}`);
        const i = c.y * W + c.x;
        if (terrain[i] === 'tree' || terrain[i] === 'timeCapsule') terrain[i] = null;
      }
      pieces.push({ uid: pieces.length + 1, defId, x, y, rot, placedWeek: 0 });
      return;
    }
  };
  place(INDOOR[rand(INDOOR.length)]!, trees.length > 0 ? trees[rand(trees.length)] : undefined);
  const rooms = 1 + rand(6);
  for (let i = 0; i < rooms; i++) place(INDOOR[rand(INDOOR.length)]!);
  for (let i = 0; i < 3; i++) place(LOW_YARD[rand(LOW_YARD.length)]!);
  return { lot: { ...lot, terrain }, pieces, nextUid: pieces.length + 1 };
}
const LOW_YARD: readonly PieceId[] = ['herbGarden', 'flowerBed', 'sapling', 'patio', 'lawn'];

/**
 * A seed CI's run drew on 2026-11-11: a Closet and a Bathroom in the lot's corner behind three
 * Doghouses, so no wall a door could go in.
 */
const WALLED_IN_SEED = 740461411;
/** A Bathroom whose only way out is a back door onto a Hot Tub. */
const HOT_TUB_ONLY_SEED = 1294966588;

describe('any house', () => {
  it('is reachable: every room through doorways from an outside door', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const h = randomHouse(seed);
        const m = modelOf(h);
        if (m.rooms.size === 0) return;
        expect(m.exits.filter((e) => e.kind === 'front').length).toBeLessThanOrEqual(1);
        if (m.exits.length > 0) {
          expect(reachable(m).size, `seed ${seed}`).toBe(m.rooms.size);
          return;
        }
        // No outside door at all: only a house with no wall one could go in (the model never
        // opens a door onto the lot's side or back edge, a fence or an outbuilding), and its
        // rooms still join each other.
        expect(doorableWalls(h, m, new Set(m.rooms.keys())), `seed ${seed}`).toBe(0);
        expect(joined(m), `seed ${seed}`).toBe(true);
      }),
      // The two rare houses are tried every time, ahead of the random ones.
      { numRuns: 150, examples: [[WALLED_IN_SEED], [HOT_TUB_ONLY_SEED]] },
    );
  });

  it('gives a house walled in by the lot’s edge and outbuildings no outside door', () => {
    const h = randomHouse(WALLED_IN_SEED);
    const m = modelOf(h);
    expect(m.rooms.size).toBe(2);
    expect(doorableWalls(h, m, new Set(m.rooms.keys()))).toBe(0);
    expect(m.exits).toEqual([]);
    expect(joined(m)).toBe(true);
  });

  it('gives a room walled in but for a Hot Tub a back door onto it', () => {
    const h = randomHouse(HOT_TUB_ONLY_SEED);
    const m = modelOf(h);
    expect(doorableWalls(h, m, new Set(m.rooms.keys()))).toBe(0);
    expect(m.exits.map((e) => e.kind)).toEqual(['back']);
    expect(reachable(m).size).toBe(m.rooms.size);
  });

  it('is reachable when it is built into the woods of a lot the game made', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const h = woodsHouse(seed);
        const m = modelOf(h);
        if (m.rooms.size === 0) return;
        // A clearing shut in by boulders, the Old Shed and the lot's corner: no door, by design.
        if (doorableWalls(h, m, new Set(m.rooms.keys())) === 0) {
          expect(m.exits.filter((e) => e.kind !== 'back')).toEqual([]);
          return;
        }
        expect(m.exits.filter((e) => e.kind === 'front')).toHaveLength(1);
        expect(reachable(m).size, `seed ${seed}`).toBe(m.rooms.size);
      }),
      { numRuns: 400 },
    );
  });

  it('puts every opening in a wall, apart from the others', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const m = modelOf(randomHouse(seed));
        const all = gaps(m);
        all.forEach((g, i) =>
          all.forEach((o, j) => {
            if (i < j) expect(overlaps(g, o), JSON.stringify([g, o])).toBe(false);
          }),
        );
        for (const d of m.doors) {
          // On the line between its two pieces.
          const line = d.dir === 'v' ? d.gap.x + d.gap.w / 2 : d.gap.y + d.gap.h / 2;
          expect(line % CELL).toBe(0);
          const mid = d.dir === 'v' ? d.gap.y + d.gap.h / 2 : d.gap.x + d.gap.w / 2;
          const cell = Math.floor(mid / CELL);
          const [a, b] =
            d.dir === 'v'
              ? [roomAt(m, line / CELL - 1, cell), roomAt(m, line / CELL, cell)]
              : [roomAt(m, cell, line / CELL - 1), roomAt(m, cell, line / CELL)];
          expect([a, b]).toEqual([d.a, d.b]);
        }
        for (const e of m.exits) expect(edge(m, e.cell.x, e.cell.y, e.side)).toBe(EDGE.outer);
        for (const w of m.windows) {
          expect(gaps(m).some((g) => overlaps(g, w.rect))).toBe(false);
          const c = {
            x: Math.floor((w.rect.x + w.rect.w / 2) / CELL),
            y: Math.floor((w.rect.y + w.rect.h / 2) / CELL),
          };
          expect(edge(m, c.x, c.y, w.side)).toBe(EDGE.outer);
        }
      }),
      { numRuns: 150 },
    );
  });

  it('is the same every time: no randomness, only the house', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const a = modelOf(randomHouse(seed));
        const b = modelOf(randomHouse(seed)); // a new house object: not the cache
        expect(b).not.toBe(a);
        const view = (m: HouseModel) =>
          JSON.stringify([m.doors, m.exits, m.garageDoors, m.windows, [...m.h], [...m.v]]);
        expect(view(b)).toBe(view(a));
      }),
      { numRuns: 60 },
    );
  });

  it('is cached per house', () => {
    const h = randomHouse(7);
    const state = {
      ...rules.newRun({
        seed: 'c',
        clientId: 'hendersons',
        crewId: 'generalContractor',
        mode: 'standard',
      }),
      house: h,
    };
    expect(houseModel(h, hallLinks(state))).toBe(houseModel(h, hallLinks(state)));
  });
});

/** A run's state with this house, as the board has it. */
function runWith(h: HouseState) {
  return {
    ...rules.newRun({
      seed: 'house',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    }),
    house: h,
  };
}

/** The board's model: the rules' Hallway links and held sets, and those sets. */
function boardModel(h: HouseState): { m: HouseModel; sets: string[]; held: HeldSets } {
  const state = runWith(h);
  const held = heldSets(state);
  return {
    m: houseModel(h, hallLinks(state), null, undefined, held),
    sets: held.map((s) => s.set),
    held,
  };
}

describe('a corridor’s doors (D-184)', () => {
  const hallDoors = (m: HouseModel, uid: number) =>
    m.doors.filter((d) => d.why === 'hall' && (d.a === uid || d.b === uid));
  /** Each Hallway's corridor (the Hallways open into it with no wall), by its first piece. */
  function corridors(m: HouseModel): Map<number, number> {
    const open = openJoints(m);
    const out = new Map<number, number>();
    for (const [uid, room] of m.rooms) {
      if (!CONTENT.pieces[room.defId].connector || out.has(uid)) continue;
      out.set(uid, uid);
      const stack = [uid];
      while (stack.length > 0) {
        for (const o of open.get(stack.pop()!) ?? []) {
          if (!out.has(o)) {
            out.set(o, uid);
            stack.push(o);
          }
        }
      }
    }
    return out;
  }

  // A corridor of two Hallways down x = 3: a Living Room along both on the west, a Bedroom and
  // a Kids' Room across it, one by each Hallway.
  const specs: Spec[] = [
    ['hallway', 3, 1, 1],
    ['hallway', 3, 3, 1],
    ['livingRoom', 1, 1],
    ['bedroom', 4, 1],
    ['kidsRoom', 4, 3],
  ];

  it('opens once into a room it runs past, not once a Hallway', () => {
    const h = house(specs);
    const { m } = boardModel(h);
    const [hallA, hallB, living, bed, kids] = [1, 2, 3, 4, 5];
    expect([1, 2, 3, 4].map((y) => roomAt(m, 3, y))).toEqual([hallA, hallA, hallB, hallB]);
    expect([1, 2, 3].map((y) => roomAt(m, 2, y))).toEqual([living, living, living]);
    // The Living Room touches both Hallways: one door onto the corridor.
    expect(hallDoors(m, living)).toHaveLength(1);
    expect(hallDoors(m, bed)).toHaveLength(1);
    expect(hallDoors(m, kids)).toHaveLength(1);
    expect(reachable(m).size).toBe(m.rooms.size);
    expect(m.doors.filter((d) => d.why === 'hall')).toHaveLength(3);
  });

  it('opens into a room once from each corridor it is on', () => {
    // A second corridor, a Hallway down x = 0 west of the Living Room, apart from the first.
    const h = house([...specs, ['hallway', 0, 2, 1]]);
    const { m } = boardModel(h);
    const [living, west] = [3, 6];
    expect([2, 3].map((y) => roomAt(m, 0, y))).toEqual([west, west]);
    const doors = hallDoors(m, living);
    expect(doors).toHaveLength(2);
    const halls = doors.map((d) => (d.a === living ? d.b : d.a)).sort();
    expect(new Set(halls.map((u) => corridors(m).get(u))).size).toBe(2);
    expect(halls).toContain(west);
  });

  it('leaves a Suite’s Bathroom to open off its Bedroom, as an en-suite does', () => {
    // A Bedroom with its Closet and Bathroom below it, a corridor down x = 3 past the Bedroom and
    // the Bathroom, and a Kids' Room across it.
    const h = house([
      ['bedroom', 1, 1],
      ['closet', 1, 3],
      ['bathroom', 2, 3],
      ['hallway', 3, 1, 1],
      ['hallway', 3, 3, 1],
      ['kidsRoom', 4, 1],
    ]);
    const { m, sets } = boardModel(h);
    expect(sets).toContain('suite');
    const [bed, closet, bath, , hallB] = [1, 2, 3, 4, 5];
    expect(roomAt(m, 3, 3)).toBe(hallB); // the Bathroom touches the corridor
    expect(doorBetween(m, bed, bath)?.why).toBe('set');
    expect(doorBetween(m, bed, closet)?.why).toBe('set');
    expect(hallDoors(m, bath)).toHaveLength(0);
    expect(hallDoors(m, bed)).toHaveLength(1);
    expect(reachable(m).size).toBe(m.rooms.size);
  });

  it('opens each corridor into a room at most once, in any house', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const { m } = boardModel(randomHouse(seed));
        const corridor = corridors(m);
        const seen = new Set<string>();
        for (const d of m.doors) {
          if (d.why !== 'hall') continue;
          const hall = corridor.has(d.a) ? d.a : d.b;
          const room = hall === d.a ? d.b : d.a;
          expect(corridor.has(room), `seed ${seed}`).toBe(false);
          const k = `${corridor.get(hall)}-${room}`;
          expect(seen.has(k), `seed ${seed}: ${k}`).toBe(false);
          seen.add(k);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('set doors (D-176)', () => {
  /** How wide a doorway is along its wall. */
  const width = (d: Doorway) => (d.dir === 'v' ? d.gap.h : d.gap.w);
  /** Each two rooms' doorways, by the pair: why each is there, and whether it's an opening or a door. */
  function doorways(m: HouseModel): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const d of m.doors) {
      const k = `${Math.min(d.a, d.b)}-${Math.max(d.a, d.b)}`;
      (out[k] ??= []).push(`${d.why} ${width(d) > WALL.door ? 'opening' : 'door'}`);
    }
    return out;
  }
  /** The stretch of wall two rooms share along a doorway's line, in art px: [start, end). */
  function sharedWall(m: HouseModel, d: Doorway): [number, number] {
    const line = (d.dir === 'v' ? d.gap.x + d.gap.w / 2 : d.gap.y + d.gap.h / 2) / CELL;
    const along: number[] = [];
    for (let i = 0; i < Math.max(m.width, m.height); i++) {
      const [a, b] =
        d.dir === 'v'
          ? [roomAt(m, line - 1, i), roomAt(m, line, i)]
          : [roomAt(m, i, line - 1), roomAt(m, i, line)];
      if (a === d.a && b === d.b) along.push(i);
    }
    return [Math.min(...along) * CELL, (Math.max(...along) + 1) * CELL];
  }
  /** The house turned a quarter clockwise on its square lot, each piece with it. */
  function turned(h: HouseState): HouseState {
    const n = h.lot.width;
    const key = (cells: readonly { x: number; y: number }[]) =>
      cells
        .map((c) => `${c.x},${c.y}`)
        .sort()
        .join(' ');
    const pieces = h.pieces.map((p) => {
      const shape = CONTENT.pieces[p.defId].shape;
      const cells = placedCells(shape, p.x, p.y, p.rot).map((c) => ({ x: n - 1 - c.y, y: c.x }));
      const x0 = Math.min(...cells.map((c) => c.x));
      const y0 = Math.min(...cells.map((c) => c.y));
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const own = placedCells(shape, 0, 0, rot);
        const x = x0 - Math.min(...own.map((c) => c.x));
        const y = y0 - Math.min(...own.map((c) => c.y));
        if (key(placedCells(shape, x, y, rot)) === key(cells)) return { ...p, x, y, rot };
      }
      throw new Error(`${p.defId} doesn't turn`);
    });
    return { ...h, pieces };
  }
  /** The house after the rules demolish the piece on (x, y). */
  const demolished = (h: HouseState, x: number, y: number) =>
    rules.apply(runWith(h), { t: 'demolish', x, y }).state.house;

  const SUITE: Spec[] = [
    ['bedroom', 1, 1],
    ['bathroom', 3, 1],
    ['closet', 3, 2],
  ];
  // A walk-through Closet: the Bathroom has no wall on the Bedroom.
  const WALK_THROUGH: Spec[] = [
    ['bedroom', 1, 1],
    ['closet', 3, 1],
    ['bathroom', 4, 1],
  ];
  const JACK_AND_JILL: Spec[] = [
    ['bedroom', 1, 1],
    ['bathroom', 3, 1],
    ['bedroom', 4, 1],
  ];
  // A Kitchen and a Dining Room side by side on two cells of wall, and a Living Room below both:
  // two cells of the Kitchen's wall, one of the Dining Room's.
  const ENTERTAINER: Spec[] = [
    ['kitchen', 1, 1],
    ['diningRoom', 3, 1],
    ['livingRoom', 1, 3, 1],
  ];

  it('open a Suite’s Bedroom into its Bathroom and its Closet', () => {
    const { m, sets } = boardModel(house(SUITE));
    expect(sets).toEqual(['suite']);
    const [bed, bath, closet] = [1, 2, 3];
    expect(doorways(m)).toEqual({ '1-2': ['set door'], '1-3': ['set door'] });
    // The Bathroom and the Closet share a wall, but each opens off the Bedroom.
    expect(doorBetween(m, bath, closet)).toBeUndefined();
    expect(doorBetween(m, bed, bath)?.why).toBe('set');
    expect(reachable(m).size).toBe(m.rooms.size);
  });

  it('open a Suite’s back room with no wall on its Bedroom off the other: a walk-through Closet', () => {
    const { m, sets } = boardModel(house(WALK_THROUGH));
    expect(sets).toEqual(['suite']);
    // Bedroom to Closet, Closet to Bathroom.
    expect(doorways(m)).toEqual({ '1-2': ['set door'], '2-3': ['set door'] });
    expect(reachable(m).size).toBe(m.rooms.size);
  });

  it('open each Bedroom of a Jack-and-Jill into the Bathroom they share', () => {
    const { m, sets } = boardModel(house(JACK_AND_JILL));
    expect(sets).toEqual(['jackAndJill']);
    expect(doorways(m)).toEqual({ '1-2': ['set door'], '2-3': ['set door'] });
    expect(reachable(m).size).toBe(m.rooms.size);
  });

  it('open the Entertainer’s rooms into each other about a cell wide, or by a door on one cell of wall', () => {
    const { m, sets } = boardModel(house(ENTERTAINER));
    expect(sets).toEqual(['entertainer']);
    const [kitchen, dining, living] = [1, 2, 3];
    expect(doorways(m)).toEqual({
      '1-2': ['set opening'],
      '1-3': ['set opening'],
      '2-3': ['set door'],
    });
    for (const [a, b] of [
      [kitchen, dining],
      [kitchen, living],
    ] as const) {
      const d = doorBetween(m, a, b)!;
      expect(width(d)).toBe(OPENING.width);
      // A stub of wall at each end of the stretch, so each room still reads as its own.
      const [start, end] = sharedWall(m, d);
      const [g0, g1] = d.dir === 'v' ? [d.gap.y, d.gap.y + d.gap.h] : [d.gap.x, d.gap.x + d.gap.w];
      expect(g0 - start, `${a}-${b}`).toBeGreaterThanOrEqual(OPENING.stub);
      expect(end - g1, `${a}-${b}`).toBeGreaterThanOrEqual(OPENING.stub);
    }
    expect(width(doorBetween(m, dining, living)!)).toBeLessThanOrEqual(WALL.door);
    expect(reachable(m).size).toBe(m.rooms.size);
  });

  it('are none between rooms the rules join only through a Hallway: its own doors stay', () => {
    // The Suite's Bathroom and Closet across a Hallway from its Bedroom.
    const h = house([
      ['bedroom', 1, 1],
      ['hallway', 3, 1, 1],
      ['bathroom', 4, 1],
      ['closet', 4, 2],
    ]);
    const { m, sets } = boardModel(h);
    expect(sets).toEqual(['suite']);
    expect(m.doors.filter((d) => d.why === 'set')).toEqual([]);
    expect(doorways(m)).toEqual({
      '1-2': ['hall door'],
      '2-3': ['hall door'],
      '2-4': ['hall door'],
    });
    expect(reachable(m).size).toBe(m.rooms.size);
  });

  it('are the same at every turn of the house', () => {
    for (const specs of [SUITE, WALK_THROUGH, JACK_AND_JILL, ENTERTAINER]) {
      let h = house(specs);
      const { m, sets } = boardModel(h);
      const first = doorways(m);
      // Every doorway in these houses is a set door.
      expect(
        Object.values(first)
          .flat()
          .every((k) => k.startsWith('set ')),
        sets[0],
      ).toBe(true);
      for (let turn = 1; turn < 4; turn++) {
        h = turned(h);
        const next = boardModel(h);
        const at = `${specs.map(([id]) => id).join(' ')}, turn ${turn}`;
        expect(next.sets, at).toEqual(sets);
        expect(doorways(next.m), at).toEqual(first);
        expect(reachable(next.m).size, at).toBe(next.m.rooms.size);
      }
    }
  });

  it('go back to the tree’s doors when a demolition breaks the set', () => {
    const h = demolished(house(ENTERTAINER), 1, 4); // the Living Room
    const { m, sets } = boardModel(h);
    expect(sets).toEqual([]);
    // The Kitchen and the Dining Room: one door from the tree, a door's width, where the
    // opening was.
    expect(doorways(m)).toEqual({ '1-2': ['tree door'] });
  });

  it('move when a demolition makes a set match differently', () => {
    // A second Dining Room east of the Living Room, reached through the first by the tree.
    const h = house([...ENTERTAINER, ['diningRoom', 4, 3]]);
    const before = boardModel(h);
    expect(before.held.map((s) => [s.set, [...s.members].sort()])).toEqual([
      ['entertainer', [1, 2, 3]],
    ]);
    expect(doorways(before.m)).toEqual({
      '1-2': ['set opening'],
      '1-3': ['set opening'],
      '2-3': ['set door'],
      '2-4': ['tree door'],
    });
    // Without the first Dining Room the second one is the Entertainer's: the Living Room opens
    // into it.
    const after = boardModel(demolished(h, 3, 1));
    expect(after.held.map((s) => [s.set, [...s.members].sort()])).toEqual([
      ['entertainer', [1, 3, 4]],
    ]);
    expect(doorways(after.m)).toEqual({ '1-3': ['set opening'], '3-4': ['set opening'] });
    expect(reachable(after.m).size).toBe(after.m.rooms.size);
  });

  /** Rooms a held set opens into each other, and Hallways to join them only through. */
  const SET_ROOMS: readonly PieceId[] = [
    'bedroom',
    'bedroom',
    'bathroom',
    'closet',
    'kitchen',
    'lKitchen',
    'diningRoom',
    'livingRoom',
    'hallway',
  ];
  const typeOf = (m: HouseModel, uid: number) => {
    const def = CONTENT.pieces[m.rooms.get(uid)!.defId];
    return def.countsAs ?? def.id;
  };
  const sharesWall = (m: HouseModel, a: number, b: number) =>
    m.rooms
      .get(a)!
      .cells.some((c) => WALL_SIDES.some(([, dx, dy]) => roomAt(m, c.x + dx, c.y + dy) === b));

  it('in any house: a set door only between a held set’s rooms, one for each pair it calls for, and never a second doorway', () => {
    let doors = 0;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const { m, held } = boardModel(randomHouse(seed, SET_ROOMS));
        const at = `seed ${seed}`;
        if (m.exits.length > 0) expect(reachable(m).size, at).toBe(m.rooms.size);
        const pairs = Object.entries(doorways(m));
        for (const [k, ds] of pairs) expect(ds, `${at}: ${k}`).toHaveLength(1);
        // Each set door joins two rooms of one held set, and each opening is the Entertainer's.
        for (const d of m.doors) {
          if (d.why !== 'set') continue;
          doors++;
          const of = held.find((s) => s.members.includes(d.a) && s.members.includes(d.b));
          expect(of, `${at}: ${d.a}-${d.b}`).toBeDefined();
          if (width(d) > WALL.door) {
            expect(of!.set, at).toBe('entertainer');
            expect(width(d), at).toBeLessThanOrEqual(OPENING.width);
          }
        }
        // Each pair the sets call for that shares a wall has one: each two of the Entertainer's
        // rooms, a Jack-and-Jill's Bedrooms and their Bathroom, a Suite's Bedroom and its back rooms.
        for (const s of held) {
          const rooms = s.members.filter((u) => m.rooms.has(u));
          for (const a of rooms) {
            for (const b of rooms) {
              if (a >= b || !sharesWall(m, a, b)) continue;
              const types = [typeOf(m, a), typeOf(m, b)].sort().join(' ');
              const calls =
                s.set === 'entertainer' ||
                (s.set === 'jackAndJill' && types === 'bathroom bedroom') ||
                (s.set === 'suite' && (types === 'bathroom bedroom' || types === 'bedroom closet'));
              if (calls) expect(doorBetween(m, a, b)?.why, `${at}: ${s.set} ${a}-${b}`).toBe('set');
            }
          }
        }
      }),
      { numRuns: 300 },
    );
    // The houses hold sets often enough to mean something.
    expect(doors).toBeGreaterThan(100);
  });
});
