// The household on the board (D-177): who is drawn, a member with a room standing in its doorway
// clear of the walls and on the floor its doors keep free, the others waiting at the front door
// or the kerb side by side, sorted in with the furniture by their feet, and the walk up from the
// street.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  placedCells,
  rules,
  type ArrivalId,
  type ClientId,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
  type RunMode,
} from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { wallMask } from '../art/house-paint.ts';
import { roomItems, type Item } from '../art/rooms.ts';
import { FEEL } from '../fx/feel.ts';
import { CELL, spriteFrames, spritePos } from '../sprites.ts';
import { floorTop, hallLinks, houseModel, type HouseModel, type Rect } from './house-model.ts';
import {
  CAST,
  FIGURE,
  KERB_PX,
  SUITCASE_W,
  WAITING,
  WALK_FROM_PX,
  doorSpots,
  kerbSpots,
  overLine,
  people,
  personItem,
  roomPeople,
  suitcaseAt,
  walkPlan,
  walkStart,
  withPeople,
  type Person,
} from './people.ts';

type Spec = readonly [PieceId, number, number, Rot?];

const SIZE = 12;
const EMPTY = Array.from({ length: SIZE }, () => '.'.repeat(SIZE));

function houseOf(specs: readonly Spec[], rows: readonly string[] = EMPTY): HouseState {
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

/** A run of `clientId` with `house` built and `arrived` moved in, and its model as the board's. */
function setUp(
  clientId: ClientId,
  arrived: readonly ArrivalId[],
  house: HouseState,
  mode: RunMode = 'standard',
) {
  const state = {
    ...rules.newRun({ seed: 'people', clientId, crewId: 'generalContractor', mode }),
    house,
    arrived,
  };
  return { state, model: houseModel(house, hallLinks(state)) };
}

/** The client a member belongs to. */
const CLIENT_OF: Readonly<Record<ArrivalId, ClientId>> = {
  twins: 'hendersons',
  grandma: 'hendersons',
  renfield: 'vladislav',
  nana: 'barkers',
  rowan: 'juniper',
  ivy: 'dale',
};

/** A member's room type: the first their arrival counts. */
const roomOf = (id: ArrivalId): PieceId =>
  CONTENT.clients[CLIENT_OF[id]].household.arrivals.find((a) => a.id === id)!.room[0]!;

const CASTED = Object.keys(CAST) as ArrivalId[];

/** The figure's box: [x − 8, x + 8) × [y − 26, y). */
function figureBox(p: { x: number; y: number }): Rect {
  return { x: p.x - FIGURE.w / 2, y: p.y - FIGURE.h, w: FIGURE.w, h: FIGURE.h };
}

const inside = (r: Rect, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** A figure's lowest rows, its legs, that no wall band may be under: they stand on the floor. */
const LEGS = 10;

/**
 * What a member in a room must be: their feet on its floor, below its north walls' faces; no
 * pixel of the walls' canvas (drawn over the rooms' items) under the figure below the line it
 * rises over, and that line above their legs; and, where the room has a door in a north or south
 * wall, their feet on that door's clear floor, which no furniture stands on in any arrangement
 * (D-173).
 */
function checkInRoom(m: HouseModel, p: Person): void {
  const room = m.rooms.get(p.uid)!;
  const fx = Math.floor(p.x);
  const fy = p.y - 1;
  const cx = Math.floor(fx / CELL);
  const cy = Math.floor(fy / CELL);
  expect(
    room.cells.some((c) => c.x === cx && c.y === cy),
    `${room.defId}'s member's feet in it`,
  ).toBe(true);
  expect(fy, `${room.defId}: feet below the north face`).toBeGreaterThanOrEqual(
    floorTop(m, cx, cy),
  );
  const box = figureBox(p);
  const mask = wallMask(m, { x: 0, y: 0, w: m.width * CELL, h: (m.height + 1) * CELL });
  const over = overLine(m, p.x, p.y) ?? box.y;
  expect(p.y - over, `${room.defId}: a wall band under the figure's legs`).toBeGreaterThanOrEqual(
    LEGS,
  );
  for (let y = Math.max(box.y, over); y < p.y; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      expect(mask.has(x, y), `${room.defId}: a wall over the figure at (${x}, ${y})`).toBe(false);
    }
  }
  const flatDoors = [
    ...m.doors.filter((d) => d.dir === 'h' && (d.a === p.uid || d.b === p.uid)),
    ...m.exits.filter((e) => e.uid === p.uid && (e.side === 'N' || e.side === 'S')),
  ];
  if (flatDoors.length > 0) {
    expect(
      flatDoors.some((d) => inside(d.clear, fx, fy)),
      `${room.defId}: feet on a door's clear floor`,
    ).toBe(true);
  }
}

describe('the cast', () => {
  it('has every member but the twins, in sprites the size of a figure', () => {
    const members = Object.values(CONTENT.clients).flatMap((c) =>
      c.household.arrivals.map((a) => a.id),
    );
    expect(new Set(CASTED)).toEqual(new Set(members.filter((id) => id !== 'twins')));
    for (const id of CASTED) {
      const cast = CAST[id]!;
      for (const sprite of [cast.stand, cast.walk]) {
        const { w, h } = spritePos(sprite);
        expect([w, h], sprite).toEqual([FIGURE.w, FIGURE.h]);
      }
      expect(spriteFrames(cast.stand), cast.stand).toBeNull();
      expect(spriteFrames(cast.walk)?.frames, cast.walk).toBe(6);
      expect(spritePos(cast.suitcase).h, cast.suitcase).toBeLessThan(FIGURE.h);
      expect(spritePos(cast.suitcase).w, cast.suitcase).toBe(SUITCASE_W);
    }
  });
});

describe('who is drawn', () => {
  it('is each member who has arrived and has a cast, in the order they came', () => {
    const { state, model } = setUp(
      'hendersons',
      ['twins', 'grandma'],
      houseOf([['livingRoom', 4, 6]]),
    );
    const all = people(state, model);
    expect(all.map((p) => p.arrival)).toEqual(['grandma']);
    expect(all[0]!.cast).toBe(CAST.grandma);
  });

  it('is nobody before an arrival, nor in the guided first job', () => {
    expect(
      people(setUp('vladislav', [], houseOf([['livingRoom', 4, 6]])).state, emptyModel()),
    ).toEqual([]);
    const first = setUp('vladislav', ['renfield'], houseOf([['livingRoom', 4, 6]]), 'firstJob');
    expect(people(first.state, first.model)).toEqual([]);
  });
});

function emptyModel(): HouseModel {
  return houseModel(houseOf([]));
}

describe('waiting for a room', () => {
  it('waits at the front door, the pair centered on its doormat, the suitcase in front', () => {
    const { state, model } = setUp('vladislav', ['renfield'], houseOf([['livingRoom', 4, 6]]));
    const front = model.exits.find((e) => e.kind === 'front')!;
    const [p] = people(state, model);
    expect(p!.place).toBe('door');
    expect(p!.uid).toBe(0);
    expect(p!.y).toBe(front.mat.y + front.mat.h);
    // The figure and its suitcase together: their middle is the mat's.
    const bag = suitcaseAt(p!, p!.cast.suitcase);
    const left = p!.x - FIGURE.w / 2;
    const right = bag.x + spritePos(p!.cast.suitcase).w;
    expect(Math.abs((left + right) / 2 - (front.mat.x + front.mat.w / 2))).toBeLessThanOrEqual(1);
    expect(bag.y + spritePos(p!.cast.suitcase).h).toBe(p!.y + WAITING.suitcaseDy);
  });

  it('lines up side by side, never on each other, and stays on the lot', () => {
    const mat = { x: 2, y: 100, w: 18, h: 6 };
    for (const n of [1, 2, 3]) {
      for (const side of ['S', 'N', 'W', 'E'] as const) {
        const spots = doorSpots(mat, side, n, SIZE * CELL);
        expect(spots).toHaveLength(n);
        for (let i = 1; i < n; i++) {
          // Each figure starts past the last one's suitcase.
          expect(Math.abs(spots[i]!.x - spots[i - 1]!.x)).toBe(WAITING.spacing);
        }
        if (side === 'S' || side === 'N') {
          for (const s of spots) expect(s.x - FIGURE.w / 2).toBeGreaterThanOrEqual(0);
        }
      }
    }
    // Beside a west door: the figure and its suitcase stay off the wall, east of the mat.
    const [w] = doorSpots(mat, 'W', 1, SIZE * CELL);
    expect(w!.x + WAITING.suitcaseDx + FIGURE.w).toBeLessThanOrEqual(mat.x + mat.w);
    const [e] = doorSpots(mat, 'E', 1, SIZE * CELL);
    expect(e!.x - FIGURE.w / 2).toBeGreaterThanOrEqual(mat.x);
  });

  it('stands at the kerb, on the sidewalk, when the house has no front door', () => {
    const { state, model } = setUp('juniper', ['rowan'], houseOf([]));
    const [p] = people(state, model);
    expect(p!.place).toBe('kerb');
    expect(p!.y).toBe(SIZE * CELL + KERB_PX);
    expect(kerbSpots(model, 2).map((s) => s.y)).toEqual([
      SIZE * CELL + KERB_PX,
      SIZE * CELL + KERB_PX,
    ]);
  });
});

describe('in their room', () => {
  it('moves from the door to a doorway of their room once it is built', () => {
    const before = setUp('barkers', ['nana'], houseOf([['livingRoom', 4, 6]]));
    expect(people(before.state, before.model)[0]!.place).toBe('door');
    const after = setUp(
      'barkers',
      ['nana'],
      houseOf([
        ['livingRoom', 4, 6],
        ['nanasRoom', 6, 6],
      ]),
    );
    const [p] = people(after.state, after.model);
    expect(p!.place).toBe('room');
    expect(p!.uid).toBe(2);
    checkInRoom(after.model, p!);
  });

  it('stands clear of the walls and on free floor, for every member, room turned every way', () => {
    for (const id of CASTED) {
      const room = roomOf(id);
      for (const rot of [0, 1, 2, 3] as const) {
        // Alone; beside a Living Room on the west; under a Hallway; and above a Kitchen.
        const layouts: Spec[][] = [
          [[room, 5, 5, rot]],
          [
            ['livingRoom', 3, 5],
            [room, 5, 5, rot],
          ],
          [
            ['hallway', 5, 4, 0],
            [room, 5, 5, rot],
          ],
          [
            [room, 5, 4, rot],
            ['kitchen', 5, 6],
          ],
        ];
        for (const specs of layouts) {
          const { state, model } = setUp(CLIENT_OF[id], [id], houseOf(specs));
          const p = people(state, model).find((q) => q.arrival === id)!;
          expect(p.place, `${id} rot ${rot}`).toBe('room');
          checkInRoom(model, p);
        }
      }
    }
  });

  it('stands clear of the walls and on free floor in any house (random houses)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.constantFrom(...CASTED),
        (seed, id) => {
          const house = randomHouse(seed, roomOf(id));
          const { state, model } = setUp(CLIENT_OF[id], [id], house);
          const p = people(state, model).find((q) => q.arrival === id);
          if (!p || p.place !== 'room') return;
          checkInRoom(model, p);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("rises over a one-cell-deep room's north wall on the overhang, as tall furniture does", () => {
    // Renfield's Room is one cell deep laid flat: his head is above its north wall's band.
    const { state, model } = setUp(
      'vladislav',
      ['renfield'],
      houseOf([
        ['livingRoom', 4, 6],
        ['renfieldsRoom', 4, 5],
      ]),
    );
    const p = people(state, model)[0]!;
    expect(p.place).toBe('room');
    const item = personItem(model, p);
    expect(item.y).toBe(p.y - FIGURE.h);
    const over = overLine(model, p.x, p.y);
    if (p.y - FIGURE.h < 5 * CELL + 6) expect(over).toBeDefined();
    if (over !== undefined) expect(item.over).toBe(over);
  });
});

describe('sorting in with the furniture', () => {
  const item = (sprite: Item['sprite'], x: number, y: number): Item => ({ sprite, x, y });

  it('stands on the rugs, behind what stands lower, in front of what stands higher', () => {
    const rug = item('rug-oval', 10, 40);
    const bed = item('bed-double-0', 10, 10); // its bottom is above the person's feet
    const plant = item('plant-tall', 30, 50); // its bottom is below them
    const h = spritePos('people-grandma').h;
    const person = item('people-grandma', 20, 60 - h);
    const bedBottom = bed.y + spritePos('bed-double-0').h;
    const plantBottom = plant.y + spritePos('plant-tall').h;
    expect(bedBottom).toBeLessThanOrEqual(60);
    expect(plantBottom).toBeGreaterThan(60);
    expect(withPeople([rug, bed, plant], [person])).toEqual([rug, bed, person, plant]);
    expect(withPeople([rug, bed, plant], undefined)).toEqual([rug, bed, plant]);
  });

  it("goes into their room's items, and only there", () => {
    const { state, model } = setUp(
      'hendersons',
      ['grandma'],
      houseOf([
        ['livingRoom', 4, 6],
        ['grandmasRoom', 6, 6],
      ]),
    );
    const all = people(state, model);
    const byRoom = roomPeople(model, all);
    expect([...byRoom.keys()]).toEqual([2]);
    const items = withPeople(roomItems(model, 2), byRoom.get(2));
    expect(items).toHaveLength(roomItems(model, 2).length + 1);
    expect(items.filter((i) => i.sprite === 'people-grandma')).toHaveLength(1);
  });
});

describe('the walk in', () => {
  it('comes up from the road in a straight line to the door', () => {
    const { state, model } = setUp('dale', ['ivy'], houseOf([['livingRoom', 4, 6]]));
    const p = people(state, model)[0]!;
    const start = walkStart(model, p)!;
    expect(start).toEqual({ x: p.x, y: SIZE * CELL + WALK_FROM_PX });
    // Over the kerb's lip, about 28 px down the street row.
    expect(start.y).toBeGreaterThan(SIZE * CELL + 28);
  });

  it("doesn't walk through the house: a door on the far side has no walk", () => {
    // A spot north of the house, as at a front door on its far side.
    const model = houseModel(houseOf([['livingRoom', 4, 6]]));
    expect(walkStart(model, { x: 5 * CELL, y: 6 * CELL - 2 })).toBeNull();
    // Beside it, where only the suitcase pulled behind would cross the house's corner.
    expect(walkStart(model, { x: 4 * CELL - 10, y: 6 * CELL - 2 })).toBeNull();
    expect(walkStart(model, { x: 4 * CELL - 16, y: 6 * CELL - 2 })).not.toBeNull();
  });

  it('sets off partway up a deep front yard, so the walk keeps to its longest', () => {
    const f = FEEL.arrival.walk;
    const reach = (f.maxMs * f.maxPxPerSecond) / 1000;
    // A house at the back of the lot: its door well over `reach` from the road.
    const { state, model } = setUp('dale', ['ivy'], houseOf([['livingRoom', 4, 1]]));
    const p = people(state, model)[0]!;
    expect(SIZE * CELL + WALK_FROM_PX - p.y).toBeGreaterThan(reach);
    const start = walkStart(model, p, reach)!;
    expect(start).toEqual({ x: p.x, y: p.y + Math.floor(reach) });
    expect(walkPlan(start.y - p.y, 6, f).ms).toBeLessThanOrEqual(f.maxMs);
    // A shallow one is still crossed from the road.
    const near = setUp('dale', ['ivy'], houseOf([['livingRoom', 4, 8]]));
    const q = people(near.state, near.model)[0]!;
    expect(walkStart(near.model, q, reach)).toEqual({ x: q.x, y: SIZE * CELL + WALK_FROM_PX });
  });

  it('takes about a second and a half, longer for a deep yard, its steps in pace', () => {
    const f = FEEL.arrival.walk;
    const short = walkPlan(60, 6, f);
    expect(short.ms).toBe(f.ms);
    const deep = walkPlan(400, 6, f);
    expect(deep.ms).toBeGreaterThan(f.ms);
    expect(400 / (deep.ms / 1000)).toBeLessThanOrEqual(f.maxPxPerSecond + 0.5);
    for (const plan of [short, deep, walkPlan(0, 6, f)]) {
      expect(plan.frameMs).toBeGreaterThanOrEqual(f.frameMs[0]);
      expect(plan.frameMs).toBeLessThanOrEqual(f.frameMs[1]);
    }
    // At a stroll the cycle covers its stride: 60 px in 1.5 s is 40 px/s, a cycle in 0.4 s.
    expect(short.frameMs).toBe(Math.round(((f.cyclePx / 6) * 1000) / 40));
  });
});

// Random connected houses holding one member's room, for the rules that must always hold.
const INDOOR = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
  (id) => CONTENT.pieces[id].category === 'indoor' && !CONTENT.pieces[id].addition,
);
const YARD: readonly PieceId[] = ['patio', 'driveway', 'fence', 'lawn', 'hotTub'];

function randomHouse(seed: number, member: PieceId): HouseState {
  let s = seed >>> 0 || 1;
  const rand = (n: number) => {
    s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0;
    return s % n;
  };
  const W = 14;
  const lot = lotFromRows(Array.from({ length: 14 }, () => '.'.repeat(W)));
  const taken = new Set<string>();
  const indoor = new Set<string>();
  const pieces: PlacedPiece[] = [];
  const blocked = (x: number, y: number) =>
    x < 0 || y < 0 || x >= W || y >= 14 || taken.has(`${x},${y}`);
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
  const rooms = 2 + rand(8);
  const at = rand(rooms);
  for (let i = 0; i < rooms; i++) tryPlace(i === at ? member : INDOOR[rand(INDOOR.length)]!, true);
  for (let i = 0; i < 3; i++) tryPlace(YARD[rand(YARD.length)]!, true);
  return { lot, pieces, nextUid: pieces.length + 1 };
}
