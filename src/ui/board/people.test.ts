// The household on the board (D-177): who is drawn, a member with a room standing in its doorway
// clear of the walls and in front of the furniture, the others waiting at the front door or the
// kerb side by side, sorted in with the furniture by their feet, and the walk up from the street
// around what stands in the yard, and when it plays. D-185: standing, they breathe, and an adult
// reads or takes a call now and then, every frame of it clear of the walls and the furniture.

import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
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
import { artSize, drawingPixels, isDrawing, type ArtId } from '../art/drawings.ts';
import { paintWalls, type Pixels } from '../art/house-paint.ts';
import { itemRows, roomItems, type Item } from '../art/rooms.ts';
import { yardModel } from '../art/yard.ts';
import { FEEL } from '../fx/feel.ts';
import { CELL, spriteFrames, spritePos, type SpriteId } from '../sprites.ts';
import { floorTop, hallLinks, houseModel, type HouseModel, type Rect } from './house-model.ts';
import {
  CAST,
  FIGURE,
  KERB_PX,
  LEGS,
  PULLED,
  SUITCASE_W,
  WAITING,
  WALK_FROM_PX,
  besideWaiting,
  doorSpots,
  householdBoxes,
  isPerson,
  kerbSpots,
  looks,
  overLine,
  pace,
  people,
  personItem,
  roomPeople,
  suitcaseAt,
  walkObstacles,
  walkPlan,
  walkStart,
  waitingBoxes,
  withPeople,
  type Person,
} from './people.ts';
import { walkNow } from './PeopleLayer.tsx';

const png = decodePng(readFileSync(new URL('../../../assets/atlas.png', import.meta.url)), 'atlas');

/** Whether pixel (x, y) of an atlas sprite or one of our drawings is drawn, in frame `k`. */
function opaque(id: ArtId, x: number, y: number, k = 0): boolean {
  if (isDrawing(id)) {
    const d = drawingPixels(id);
    return d.data[(y * d.w * d.frames + k * d.w + x) * 4 + 3]! > 0;
  }
  const s = spritePos(id);
  const at = s.x + k * (spriteFrames(id)?.stride ?? 0) + x;
  return png.rgba[((s.y + y) * png.width + at) * 4 + 3]! > 0;
}

/** Every frame a member shows standing (D-185): each of their looks' frames, as [sprite, k]. */
function framesOf(cast: Person['cast']): (readonly [SpriteId, number])[] {
  return looks(cast).flatMap((id) =>
    Array.from({ length: spriteFrames(id)?.frames ?? 1 }, (_, k) => [id, k] as const),
  );
}

const shapes = new Map<Person['cast'], (readonly [SpriteId, number])[]>();

/**
 * framesOf's frames with a shape of their own, the first of each: two frames that draw the same
 * pixels (a breath's first and last, a book held still) are covered alike.
 */
function shapesOf(cast: Person['cast']): (readonly [SpriteId, number])[] {
  let out = shapes.get(cast);
  if (!out) {
    const seen = new Set<string>();
    out = framesOf(cast).filter(([id, k]) => {
      const { w, h } = spritePos(id);
      let key = '';
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) key += opaque(id, x, y, k) ? 1 : 0;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    shapes.set(cast, out);
  }
  return out;
}

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
  auntBea: 'bigsbys',
  cousins: 'bigsbys',
  grandpa: 'bigsbys',
  newlyweds: 'bigsbys',
  baby: 'bigsbys',
};

/** A member's room type: the first their arrival counts. */
const roomOf = (id: ArrivalId): PieceId =>
  CONTENT.clients[CLIENT_OF[id]].household.arrivals.find((a) => a.id === id)!.room![0]!;

const CASTED = Object.keys(CAST) as ArrivalId[];

/** The figure's box: [x − 8, x + 8) × [y − 26, y). */
function figureBox(p: { x: number; y: number }): Rect {
  return { x: p.x - FIGURE.w / 2, y: p.y - FIGURE.h, w: FIGURE.w, h: FIGURE.h };
}

const inside = (r: Rect, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** The walls canvas's alpha at lot pixel (x, y): 0 off the canvas. */
function wallAlpha(walls: Pixels | null, x: number, y: number): number {
  if (!walls || x < walls.x || y < walls.y || x >= walls.x + walls.w || y >= walls.y + walls.h) {
    return 0;
  }
  return walls.data[((y - walls.y) * walls.w + x - walls.x) * 4 + 3]!;
}

/**
 * How many of a member's pixels their room's furniture covers, as the board draws it: a piece
 * after them in the room's items (withPeople) covers them where both are drawn, and a piece's rows
 * on the overhang (above the walls) cover every row of theirs under the walls. D-185: in frame
 * `frame` of `look`, one of the strips they show standing (their stand's first by default).
 */
function coveredPixels(m: HouseModel, p: Person, look: SpriteId = p.cast.stand, frame = 0): number {
  const me = personItem(m, p);
  const items = withPeople(roomItems(m, p.uid), [me]);
  const at = items.indexOf(me);
  const myTop = itemRows(me).top;
  const { w, h } = artSize(look);
  let n = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!opaque(look, i, j, frame)) continue;
      const raised = myTop !== null && j < myTop[1];
      const hit = items.some((it, k) => {
        if (k === at) return false;
        const ix = me.x + i - it.x;
        const iy = me.y + j - it.y;
        const size = artSize(it.sprite);
        if (ix < 0 || iy < 0 || ix >= size.w || iy >= size.h || !opaque(it.sprite, ix, iy)) {
          return false;
        }
        const top = itemRows(it).top;
        const itRaised = top !== null && iy < top[1];
        return raised ? itRaised && k > at : itRaised || k > at;
      });
      if (hit) n++;
    }
  }
  return n;
}

/**
 * A figure's outermost columns' pixels, its arms: what a piece flush with a door's clear floor may
 * cover. In frame `k` of `look` (D-185).
 */
function arms(look: SpriteId, k = 0): number {
  const { w, h } = artSize(look);
  let n = 0;
  for (let j = 0; j < h; j++) {
    if (opaque(look, 0, j, k)) n++;
    if (opaque(look, w - 1, j, k)) n++;
  }
  return n;
}

/**
 * What a member in a room must be: their feet on its floor, below its north walls' faces; no
 * pixel of the walls canvas (drawn over the rooms' items: the bands, and a doorway's threshold)
 * under the figure below the line it rises over, and that line above their legs; no more of them
 * covered by the room's furniture than their arms, in every frame they show standing (D-185: a
 * breath, a book, a phone); and near one of the room's doors, within a cell and a half of the
 * floor it keeps clear.
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
  const walls = paintWalls(m);
  const over = overLine(m, p.x, p.y) ?? box.y;
  expect(p.y - over, `${room.defId}: a wall band under the figure's legs`).toBeGreaterThanOrEqual(
    LEGS,
  );
  for (let y = Math.max(box.y, over); y < p.y; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      expect(
        wallAlpha(walls, x, y),
        `${room.defId}: the walls over the figure at (${x}, ${y})`,
      ).toBe(0);
    }
  }
  for (const [look, k] of shapesOf(p.cast)) {
    expect(
      coveredPixels(m, p, look, k),
      `${room.defId}: furniture in front of them (${look} frame ${k})`,
    ).toBeLessThanOrEqual(arms(look, k));
  }
  const clears = [
    ...m.doors.filter((d) => d.a === p.uid || d.b === p.uid).map((d) => d.clear),
    ...m.exits.filter((e) => e.uid === p.uid).map((e) => e.clear),
  ];
  const away = (r: Rect) =>
    Math.max(r.x - fx, 0, fx - (r.x + r.w - 1)) + Math.max(r.y - fy, 0, fy - (r.y + r.h - 1));
  if (clears.length > 0) {
    expect(Math.min(...clears.map(away)), `${room.defId}: near a door`).toBeLessThanOrEqual(
      CELL + FIGURE.w,
    );
  }
}

describe('the cast', () => {
  it('has every member with a room of their own but the twins, in sprites the size of a figure', () => {
    // D-219: the Bigsbys' members bring a plain Bedroom and have no room, and no figure, of
    // their own (the spike has no new art).
    const members = Object.values(CONTENT.clients).flatMap((c) =>
      c.household.arrivals.filter((a) => a.room).map((a) => a.id),
    );
    expect(new Set(CASTED)).toEqual(new Set(members.filter((id) => id !== 'twins')));
    for (const a of CONTENT.clients.bigsbys.household.arrivals)
      expect(CAST[a.id], a.id).toBeUndefined();
    for (const id of CASTED) {
      const cast = CAST[id]!;
      for (const sprite of [...looks(cast), cast.walk]) {
        const { w, h } = spritePos(sprite);
        expect([w, h], sprite).toEqual([FIGURE.w, FIGURE.h]);
      }
      // D-185: standing, the sheet's idle; an adult's book and phone, loops of their own.
      expect(spriteFrames(cast.stand)?.frames, cast.stand).toBe(6);
      expect(spriteFrames(cast.walk)?.frames, cast.walk).toBe(6);
      expect(spritePos(cast.suitcase).h, cast.suitcase).toBeLessThan(FIGURE.h);
      expect(spritePos(cast.suitcase).w, cast.suitcase).toBe(SUITCASE_W);
    }
    // Every adult reads and takes a call; Ivy's kids' parts have neither.
    for (const id of ['grandma', 'renfield', 'nana', 'rowan'] as const) {
      expect(spriteFrames(CAST[id]!.read!)?.frames, id).toBe(12);
      expect(spriteFrames(CAST[id]!.phone!)?.frames, id).toBe(6);
    }
    expect(looks(CAST.ivy!)).toEqual([CAST.ivy!.stand]);
  });
});

describe('standing (D-185)', () => {
  /** FNV-1a of a sprite's frame `k`, its RGBA: what the board draws of it. */
  function frameHash(id: SpriteId, k: number): string {
    const s = spritePos(id);
    const x0 = s.x + k * (spriteFrames(id)?.stride ?? 0);
    let h = 0x811c9dc5;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const i = ((s.y + y) * png.width + x0 + x) * 4;
        for (let c = 0; c < 4; c++)
          h = Math.imul(h ^ (png.rgba[i + 3] ? png.rgba[i + c]! : 0), 0x01000193);
      }
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  it('starts on the figure standing still, as it always was', () => {
    // The stands' first frames, pinned: D-177's standing cuts, pixel for pixel, so a still board
    // (Reduce motion) and anything drawn from a sprite's first frame (a room's drop) look the same.
    const STILL: Readonly<Partial<Record<ArrivalId, string>>> = {
      grandma: '61ce2139',
      renfield: 'be07ab16',
      nana: '98cd92df',
      rowan: 'dcea7d37',
      ivy: '2bc919f2',
    };
    for (const id of CASTED) expect(frameHash(CAST[id]!.stand, 0), id).toBe(STILL[id]);
  });

  it('breathes a pixel at most, and no frame is cut off at the top', () => {
    const top = (id: SpriteId, k: number) => {
      for (let y = 0; y < FIGURE.h; y++) {
        for (let x = 0; x < FIGURE.w; x++) if (opaque(id, x, y, k)) return y;
      }
      return FIGURE.h;
    };
    for (const id of CASTED) {
      const cast = CAST[id]!;
      const still = top(cast.stand, 0);
      // The idle rises a pixel, and comes back down.
      const tops = Array.from({ length: 6 }, (_, k) => top(cast.stand, k));
      expect(Math.min(...tops), id).toBe(still - 1);
      expect(Math.max(...tops), id).toBe(still);
      // Every frame of every strip keeps its top row clear: none was cropped by its cut.
      for (const [look, k] of framesOf(cast)) {
        expect(top(look, k), `${look} frame ${k}`).toBeGreaterThan(0);
        expect(top(look, k), `${look} frame ${k}`).toBeGreaterThanOrEqual(still - 1);
      }
    }
  });

  it('keeps its pace by the run and who it is, never by chance', () => {
    const f = FEEL.household;
    const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);
    for (const id of CASTED) {
      const cast = CAST[id]!;
      const paces = seeds.map((s) => pace(id, cast, s));
      // The same run shows the same.
      expect(pace(id, cast, 'seed-0')).toEqual(paces[0]);
      for (const p of paces) {
        expect(p.idleMs).toBe(f.idleFrameMs);
        expect(p.busyMs).toBe(f.busyFrameMs);
        expect(p.delayMs).toBeLessThanOrEqual(0);
        if (!cast.read) {
          // Ivy only breathes: somewhere in her idle's loop.
          expect(p.turnsMs).toBe(0);
          expect(-p.delayMs).toBeLessThan(6 * f.idleFrameMs);
          continue;
        }
        // Two turns, each between FEEL's ends and whole loops of the book and the phone, so
        // each opens on its first frame; they start somewhere in them.
        const turn = p.turnsMs / 2;
        expect(turn).toBeGreaterThanOrEqual(f.turnMs[0]);
        expect(turn).toBeLessThanOrEqual(f.turnMs[1]);
        for (const look of [cast.read, cast.phone!]) {
          expect(turn % ((spriteFrames(look)?.frames ?? 1) * f.busyFrameMs)).toBe(0);
        }
        expect(-p.delayMs).toBeLessThan(p.turnsMs);
      }
      // Runs differ: not everyone in step.
      expect(new Set(paces.map((p) => p.delayMs)).size, id).toBeGreaterThan(30);
      if (cast.read) expect(new Set(paces.map((p) => p.turnsMs)).size, id).toBeGreaterThan(2);
    }
  });

  it('is drawn with every look and the same pace at the door and in their room', () => {
    const before = setUp('vladislav', ['renfield'], houseOf([['livingRoom', 4, 6]]));
    const [door] = people(before.state, before.model);
    expect(door!.pace).toEqual(pace('renfield', CAST.renfield!, before.state.setup.seed));
    const after = setUp(
      'vladislav',
      ['renfield'],
      houseOf([
        ['livingRoom', 4, 6],
        ['renfieldsRoom', 6, 6],
      ]),
    );
    const [inRoom] = people(after.state, after.model);
    expect(inRoom!.place).toBe('room');
    expect(inRoom!.pace).toEqual(door!.pace);
    const item = personItem(after.model, inRoom!);
    expect(isPerson(item)).toBe(true);
    expect(item.sprite).toBe(CAST.renfield!.stand);
    expect(item.looks).toEqual([CAST.renfield!.stand, CAST.renfield!.read, CAST.renfield!.phone]);
    expect(item.pace).toBe(inRoom!.pace);
    // The room's own furniture isn't anyone.
    expect(roomItems(after.model, 2).some(isPerson)).toBe(false);
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
    const first = setUp('hendersons', ['grandma'], houseOf([['livingRoom', 4, 6]]), 'firstJob');
    expect(people(first.state, first.model, true)).toEqual([]);
    // A first job's lot played again after a loss, or its run code opened later, keeps the
    // first job's targets (D-151) but isn't guided: its household is drawn.
    expect(people(first.state, first.model, false).map((p) => p.arrival)).toEqual(['grandma']);
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

  it('stands clear of the walls and in front of the furniture, for every member, room turned every way', () => {
    for (const id of CASTED) {
      const room = roomOf(id);
      for (const rot of [0, 1, 2, 3] as const) {
        // The room's far column east, for a Living Room beside it there.
        const east = Math.max(
          ...placedCells(CONTENT.pieces[room].shape, 5, 5, rot).map((c) => c.x),
        );
        // Alone; beside a Living Room on the west, and on the east, each built before it and
        // after it (so the room's uid, and its colors and small choices, differ); under a
        // Hallway; and above a Kitchen.
        const layouts: Spec[][] = [
          [[room, 5, 5, rot]],
          [
            ['livingRoom', 3, 5],
            [room, 5, 5, rot],
          ],
          [
            [room, 5, 5, rot],
            ['livingRoom', 3, 5],
          ],
          [
            ['livingRoom', east + 1, 5],
            [room, 5, 5, rot],
          ],
          [
            [room, 5, 5, rot],
            ['livingRoom', east + 1, 5],
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

  it("steps out from behind the furniture beside a side wall's door (the review's houses)", () => {
    // Nana's armchair and Renfield's cot stood in front of them beside these doors, the only ones
    // their rooms have: 68% and 75% of the figure hidden.
    const cases: [ArrivalId, Spec[]][] = [
      [
        'nana',
        [
          ['livingRoom', 8, 6],
          ['nanasRoom', 6, 6],
        ],
      ],
      [
        'renfield',
        [
          ['livingRoom', 4, 6],
          ['renfieldsRoom', 6, 6],
        ],
      ],
      [
        'nana',
        [
          ['livingRoom', 7, 5],
          ['nanasRoom', 5, 5],
        ],
      ],
      [
        'renfield',
        [
          ['livingRoom', 3, 5],
          ['renfieldsRoom', 5, 5],
        ],
      ],
    ];
    for (const [id, specs] of cases) {
      const { state, model } = setUp(CLIENT_OF[id], [id], houseOf(specs));
      const p = people(state, model).find((q) => q.arrival === id)!;
      expect(model.doors.filter((d) => d.a === p.uid || d.b === p.uid).map((d) => d.dir)).toEqual([
        'v',
      ]);
      expect(model.exits.some((e) => e.uid === p.uid)).toBe(false);
      checkInRoom(model, p);
      for (const [look, k] of shapesOf(p.cast)) {
        expect(coveredPixels(model, p, look, k), `${id}: covered (${look} frame ${k})`).toBe(0);
      }
    }
  });

  it('stands on the clear floor of a door in the north or south wall', () => {
    // Under a Hallway, with the front door in the south wall; and above a Kitchen, their door
    // in the south wall between them.
    for (const specs of [
      [
        ['hallway', 5, 4, 0],
        ['grandmasRoom', 5, 5],
      ],
      [
        ['grandmasRoom', 5, 4],
        ['kitchen', 5, 6],
      ],
    ] as Spec[][]) {
      const { state, model } = setUp('hendersons', ['grandma'], houseOf(specs));
      const p = people(state, model)[0]!;
      const flat = [
        ...model.doors.filter((d) => d.dir === 'h' && (d.a === p.uid || d.b === p.uid)),
        ...model.exits.filter((e) => e.uid === p.uid && (e.side === 'N' || e.side === 'S')),
      ];
      expect(flat.length).toBeGreaterThan(0);
      expect(flat.some((d) => inside(d.clear, p.x, p.y - 1))).toBe(true);
      checkInRoom(model, p);
    }
  });

  it("rises over a north wall's outside door, threshold and all, on the overhang", () => {
    // Grandma's Room with its only outside door in its north wall, onto a Patio: the walls canvas
    // draws the door's threshold across the opening, where the figure's head is.
    const { state, model } = setUp(
      'hendersons',
      ['grandma'],
      houseOf([
        ['grandmasRoom', 7, 4, 1],
        ['kitchen', 5, 5, 2],
        ['fence', 1, 6, 0],
        ['patio', 6, 2, 3],
        ['hotTub', 5, 4, 2],
        ['fence', 8, 3, 2],
      ]),
    );
    const p = people(state, model)[0]!;
    const exit = model.exits.find((e) => e.uid === p.uid && e.side === 'N')!;
    expect(inside(exit.clear, p.x, p.y - 1)).toBe(true);
    // Its rows over the opening's band go on the overhang, so the threshold is under them.
    expect(overLine(model, p.x, p.y)).toBe(exit.gap.y + exit.gap.h);
    checkInRoom(model, p);
  });

  it('stands clear of the walls and in front of the furniture in any house (random houses)', () => {
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
      // Renfield where his door's clear floor is under his cot's top; Ivy with a desk flush
      // with her door's clear floor, at her arm.
      {
        numRuns: 300,
        examples: [
          [9031, 'renfield'],
          [326, 'ivy'],
        ],
      },
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

describe('someone else at the door (D-182)', () => {
  /** The client at the door (fx/visit.ts): 16 art px wide, their tallest head 24 px up. */
  const CLIENT = { w: 16, h: 24 } as const;

  /** A member standing at (x, y) at the door, or the kerb. */
  const at = (x: number, y: number, place: Person['place'] = 'door'): Person => ({
    arrival: 'grandma',
    cast: CAST.grandma!,
    place,
    uid: 0,
    x,
    y,
    pace: pace('grandma', CAST.grandma!, 'people'),
  });

  it('counts what each waiting member covers, their suitcase too, and nobody in a room', () => {
    const { state, model } = setUp('vladislav', ['renfield'], houseOf([['livingRoom', 4, 6]]));
    const [p] = people(state, model);
    const bag = suitcaseAt(p!, p!.cast.suitcase);
    expect(waitingBoxes([p!])).toEqual([
      figureBox(p!),
      { ...bag, w: SUITCASE_W, h: spritePos(p!.cast.suitcase).h },
    ]);
    const housed = setUp(
      'vladislav',
      ['renfield'],
      houseOf([
        ['livingRoom', 4, 6],
        [roomOf('renfield'), 6, 6],
      ]),
    );
    const inRoom = people(housed.state, housed.model);
    expect(inRoom.map((q) => q.place)).toEqual(['room']);
    expect(waitingBoxes(inRoom)).toEqual([]);
    expect(besideWaiting(housed.model, inRoom, CLIENT)).toBeNull();
    // The whole household: those waiting with their suitcases, and the figure of each in a room.
    expect(householdBoxes([p!])).toEqual(waitingBoxes([p!]));
    expect(householdBoxes(inRoom)).toEqual([figureBox(inRoom[0]!)]);
    expect(householdBoxes([...inRoom, p!])).toEqual([...waitingBoxes([p!]), figureBox(inRoom[0]!)]);
  });

  it('passes over a place in the line that the client’s own check refuses', () => {
    const m = emptyModel();
    const line = kerbSpots(m, 1).map((s) => at(s.x, s.y, 'kerb'));
    const next = { x: line[0]!.x + WAITING.spacing, y: line[0]!.y };
    const before = { x: line[0]!.x - WAITING.spacing, y: line[0]!.y };
    expect(besideWaiting(m, line, CLIENT, (q) => q.x !== next.x)).toEqual(before);
    expect(besideWaiting(m, line, CLIENT, () => false)).toBeNull();
  });

  it('stands one more at the end of the line, where the next to wait would', () => {
    const m = emptyModel();
    const y = SIZE * CELL + KERB_PX;
    const line = kerbSpots(m, 2).map((s) => at(s.x, s.y, 'kerb'));
    expect(besideWaiting(m, line, CLIENT)).toEqual({ x: line[1]!.x + WAITING.spacing, y });
    expect(besideWaiting(m, [], CLIENT)).toBeNull();
  });

  it('takes the place before the first where the next is off the lot or on the house', () => {
    const m = emptyModel();
    // The line as far east as it goes: one more would be off the lot.
    const east = SIZE * CELL - (FIGURE.w / 2 + WAITING.suitcaseDx + FIGURE.w) + FIGURE.w / 2;
    expect(besideWaiting(m, [at(east, 200)], CLIENT)).toEqual({
      x: east - WAITING.spacing,
      y: 200,
    });
    // West of a Kitchen at (4, 4), feet in its top row: one more east would stand in it.
    const { model } = setUp('hendersons', [], houseOf([['kitchen', 4, 4]]));
    expect(besideWaiting(model, [at(98, 5 * CELL)], CLIENT)).toEqual({ x: 72, y: 5 * CELL });
    // Neither on a lot a cell wide.
    const narrow = houseModel(houseOf([], ['.']));
    expect(besideWaiting(narrow, [at(FIGURE.w / 2, 20)], CLIENT)).toBeNull();
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
    // The shortest walk from behind something keeps its steps in pace too.
    const least = walkPlan(f.minPx, 6, f);
    expect(least.ms).toBe(f.ms);
    expect(((f.cyclePx / 6) * 1000) / (f.minPx / (least.ms / 1000))).toBeLessThanOrEqual(
      f.frameMs[1],
    );
  });

  it('sets off from behind what stands in its way, or fades in at the door with too little left', () => {
    const { minPx } = FEEL.arrival.walk;
    const { state, model } = setUp('dale', ['ivy'], houseOf([['livingRoom', 4, 6]]));
    const p = people(state, model)[0]!;
    const road = SIZE * CELL + WALK_FROM_PX;
    const across = (y: number, h = 10): Rect => ({ x: p.x - 20, y, w: 40, h });
    // Across the line halfway down the yard: they set off just north of it, the suitcase's foot
    // clear of its top.
    expect(walkStart(model, p, Infinity, [across(360)], minPx)).toEqual({
      x: p.x,
      y: 360 - PULLED.dy,
    });
    // The nearest of two.
    expect(walkStart(model, p, Infinity, [across(400), across(340)], minPx)!.y).toBe(
      340 - PULLED.dy,
    );
    // Right below the door: too little left to walk.
    expect(walkStart(model, p, Infinity, [across(p.y + 10)], minPx)).toBeNull();
    // Beside the line, or wholly behind their spot (they pass in front of it): no matter.
    const beside: Rect = { x: p.x + FIGURE.w, y: 360, w: 20, h: 10 };
    const behind: Rect = { x: p.x - 8, y: p.y - 20, w: 16, h: 20 };
    expect(walkStart(model, p, Infinity, [beside, behind], minPx)).toEqual({ x: p.x, y: road });
    // The suitcase pulled behind them counts: one only in its columns is in the way.
    const right: Rect = { x: p.x + FIGURE.w / 2, y: 360, w: 6, h: 10 };
    expect(walkStart(model, p, Infinity, [right], minPx)!.y).toBe(360 - PULLED.dy);
  });

  it("doesn't walk over the parked car or a Patio's seats below the door", () => {
    // The front door onto a Driveway, its car parked in the line; or onto a Patio, its small
    // parasol and seats there.
    for (const yard of ['driveway', 'patio'] as const) {
      const house = houseOf([
        ['livingRoom', 4, 6],
        [yard, 4, 9, 1],
      ]);
      const { state, model } = setUp('dale', ['ivy'], house);
      const p = people(state, model)[0]!;
      expect(p.place).toBe('door');
      const blocks = walkObstacles(house, yardModel(house, model));
      expect(walkStart(model, p), yard).not.toBeNull();
      expect(walkStart(model, p, Infinity, blocks, FEEL.arrival.walk.minPx), yard).toBeNull();
    }
  });

  it("counts the yard's props, a Pool's water and the lot's own features no piece covers", () => {
    const rows = [...EMPTY];
    rows[10] = 'PP........TB';
    rows[11] = 'CC..........';
    const house = houseOf(
      [
        ['livingRoom', 4, 6],
        ['pool', 6, 9],
        ['driveway', 1, 11, 0],
      ],
      rows,
    );
    const model = houseModel(house);
    const yard = yardModel(house, model);
    const blocks = walkObstacles(house, yard);
    const has = (r: Rect) =>
      blocks.some((b) => b.x === r.x && b.y === r.y && b.w === r.w && b.h === r.h);
    const tile = (x: number, y: number): Rect => ({ x: x * CELL, y: y * CELL, w: CELL, h: CELL });
    for (const l of yard.pieces.values()) {
      for (const it of l.items) expect(has({ x: it.x, y: it.y, ...artSize(it.sprite) })).toBe(true);
    }
    for (const c of yard.pieces.get(2)!.cells) expect(has(tile(c.x, c.y))).toBe(true);
    for (const [x, y] of [
      [0, 10],
      [1, 10],
      [10, 10],
      [11, 10],
      [0, 11],
    ]) {
      expect(has(tile(x!, y!)), `${x},${y}`).toBe(true);
    }
    // The Driveway's bridge over the creek is walked on.
    expect(has(tile(1, 11))).toBe(false);
    // Open ground and the Living Room aren't.
    expect(has(tile(5, 10))).toBe(false);
    expect(has(tile(4, 6))).toBe(false);
  });

  it("walks from the doorbell's own render, and stops at the next doorbell or a run reset", () => {
    const grandma = { arrival: 'grandma', id: 7 } as const;
    const twins = { arrival: 'twins', id: 8 } as const;
    // A doorbell not walked yet: walking already in the render it comes in, before the effect
    // that starts the walk has run (and with nothing under way), so no frame shows them at the
    // door first. Not with Reduce motion.
    expect(walkNow(grandma, null, 6, false)).toEqual(grandma);
    expect(walkNow(grandma, null, 6, true)).toBeNull();
    // Under way, once its effect has run.
    expect(walkNow(grandma, grandma, 7, false)).toEqual(grandma);
    // A board mounted again (Menu, then Continue) doesn't play it twice.
    expect(walkNow(grandma, null, 7, false)).toBeNull();
    // The next doorbell ends it, even one for a member who doesn't walk (the twins have no
    // cast), and even before the walk's own state is reset; so does a run reset.
    expect(walkNow(twins, grandma, 8, false)).toBeNull();
    expect(walkNow(twins, grandma, 7, false)).toEqual(twins);
    expect(walkNow(null, grandma, 7, false)).toBeNull();
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
