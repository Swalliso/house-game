// The house model (D-097, D-093): walls on every edge between two pieces, Hallways' doors from
// the rules' links, a front door that faces the street, a door tree that reaches every room,
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
  WALL,
  edge,
  hallLinks,
  houseModel,
  overlaps,
  pieceModel,
  roomAt,
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

/** Rooms joined by doorways, from each outside door: every room should be in one of these. */
function reachable(m: HouseModel): Set<number> {
  const seen = new Set<number>(m.exits.map((e) => e.uid));
  const stack = [...seen];
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
});

// Random connected houses on a lot with a little terrain and yard, for the rules that must
// always hold.
const INDOOR = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
  (id) => CONTENT.pieces[id].category === 'indoor',
);
const YARD: readonly PieceId[] = ['patio', 'driveway', 'fence', 'lawn', 'hotTub', 'doghouse'];

function randomHouse(seed: number): HouseState {
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
  for (let i = 0; i < rooms; i++) tryPlace(INDOOR[rand(INDOOR.length)]!, true);
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

describe('any house', () => {
  it('is reachable: every room through doorways from an outside door', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const h = randomHouse(seed);
        const m = modelOf(h);
        if (m.rooms.size === 0) return;
        expect(m.exits.filter((e) => e.kind === 'front').length).toBeLessThanOrEqual(1);
        expect(reachable(m).size).toBe(m.rooms.size);
      }),
      { numRuns: 150 },
    );
  });

  it('is reachable when it is built into the woods of a lot the game made', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const h = woodsHouse(seed);
        const m = modelOf(h);
        if (m.rooms.size === 0) return;
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
