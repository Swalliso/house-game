// What stands in each room (D-097): LimeZu furniture by slot rules, for every room type and
// rotation, inside its walls, off its doorways and off each other; the same every time; rooms
// of a type that don't look copy-pasted; fixtures drawn where they fit, badged where not.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  placedCells,
  rules,
  type FixtureId,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import {
  EDGE,
  WALL,
  edge,
  hallLinks,
  houseModel,
  inset,
  overlaps,
  pieceModel,
  type HouseModel,
  type Rect,
} from '../board/house-model.ts';
import { CELL, spritePos } from '../sprites.ts';
import { itemRows, roomItems, roomLayout, type Item } from './rooms.ts';

const INDOOR = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
  (id) => CONTENT.pieces[id].category === 'indoor',
);
const ROOM_FIXTURES: readonly FixtureId[] = [
  'fireplace',
  'skylight',
  'blackoutCurtains',
  'soundproofing',
  'bayWindow',
];

type Spec = readonly [PieceId, number, number, Rot?, FixtureId?];

function house(specs: readonly Spec[], size = 12): HouseState {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0, fixture], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot,
    placedWeek: i,
    ...(fixture ? { fixture: { id: fixture, week: 0 } } : {}),
  }));
  const rows = Array.from({ length: size }, () => '.'.repeat(size));
  return { lot: lotFromRows(rows), pieces, nextUid: pieces.length + 1 };
}

/** The model with the rules' Hallway links, as the board builds it. */
function modelOf(h: HouseState): HouseModel {
  const state = {
    ...rules.newRun({ seed: 'rooms', crewId: 'generalContractor', mode: 'standard' }),
    house: h,
  };
  return houseModel(h, hallLinks(state));
}

const FLAT = /^(rug-|runner-|mat-|bath-mat)/;
/** Pieces that may stand in a doorway's walkway (never its opening): a one-cell room's key piece, and the car. */
const TIGHT = /^(toilet-|clothes-rail|car-)/;

/** An item's footprint: its sprite below the line it rises over. */
function foot(it: Item): Rect {
  const { w, h } = spritePos(it.sprite);
  const top = it.over ?? it.y;
  return { x: it.x, y: top, w, h: it.y + h - top };
}

/** Problems with one room's layout, as messages (none when it's right). */
function problems(m: HouseModel, uid: number): string[] {
  const out: string[] = [];
  const room = m.rooms.get(uid)!;
  const items = roomItems(m, uid);
  const name = (it: Item) => `${room.defId} ${uid}: ${it.sprite} at ${it.x},${it.y}`;
  const own = (cx: number, cy: number) =>
    cx >= 0 && cy >= 0 && cx < m.width && cy < m.height && m.room[cy * m.width + cx] === uid;
  for (const it of items) {
    const f = foot(it);
    // The car covers its garage door's rail, and is 3 px longer than a Garage is deep inside.
    const car = it.sprite.startsWith('car-');
    const tol = car ? 3 : 1;
    const wall = (cx: number, cy: number, side: 'N' | 'E' | 'S' | 'W') =>
      car && edge(m, cx, cy, side) === EDGE.garage ? 0 : inset(m, cx, cy, side);
    // Inside the room's walls: on its cells, a pixel's tuck under a side wall at most.
    for (let cy = Math.floor(f.y / CELL); cy <= Math.floor((f.y + f.h - 1) / CELL); cy++) {
      for (let cx = Math.floor(f.x / CELL); cx <= Math.floor((f.x + f.w - 1) / CELL); cx++) {
        if (!own(cx, cy)) {
          out.push(`${name(it)} leaves the room at cell ${cx},${cy}`);
          continue;
        }
        // The part of it in this cell, against this cell's walls.
        const X0 = cx * CELL;
        const Y0 = cy * CELL;
        const x0 = Math.max(f.x, X0);
        const x1 = Math.min(f.x + f.w, X0 + CELL);
        const y0 = Math.max(f.y, Y0);
        const y1 = Math.min(f.y + f.h, Y0 + CELL);
        const w = wall(cx, cy, 'W');
        const e = wall(cx, cy, 'E');
        if (w && x0 < X0 + w - tol) out.push(`${name(it)} is in a west wall`);
        if (e && x1 > X0 + CELL - e + tol) out.push(`${name(it)} is in an east wall`);
        if (y0 < Y0 + wall(cx, cy, 'N')) out.push(`${name(it)} is in a north wall`);
        if (y1 > Y0 + CELL - wall(cx, cy, 'S')) out.push(`${name(it)} is in a south wall`);
      }
    }
    // It rises over the north wall's band, but not past it (the tight pieces a little more).
    const limit = room.box.y - WALL.in / 2 - (TIGHT.test(it.sprite) ? 8 : 0);
    if (it.y < limit) out.push(`${name(it)} rises ${limit - it.y} px too far`);
    // Never in an opening; out of the walkways in front of them unless it's a tight piece.
    for (const d of m.doors.filter((d) => d.a === uid || d.b === uid)) {
      if (overlaps(f, d.gap)) out.push(`${name(it)} is in a doorway`);
      if (!FLAT.test(it.sprite) && !TIGHT.test(it.sprite) && overlaps(f, d.clear)) {
        out.push(`${name(it)} blocks a doorway`);
      }
    }
    for (const e of m.exits.filter((e) => e.uid === uid)) {
      if (overlaps(f, e.gap)) out.push(`${name(it)} is in an outside door`);
      if (!FLAT.test(it.sprite) && !TIGHT.test(it.sprite) && overlaps(f, e.clear)) {
        out.push(`${name(it)} blocks an outside door`);
      }
    }
  }
  // Off each other: rugs and runners lie under things; dining chairs tuck 3 px under the table.
  const solid = items.filter((it) => !FLAT.test(it.sprite));
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = foot(solid[i]!);
      const b = foot(solid[j]!);
      const chair = /^chair-/.test(solid[i]!.sprite) || /^chair-/.test(solid[j]!.sprite);
      const table =
        /^dining-table/.test(solid[i]!.sprite) || /^dining-table/.test(solid[j]!.sprite);
      const tuck = chair && table ? 3 : 0;
      const shrunk = { x: a.x + tuck, y: a.y, w: Math.max(0, a.w - 2 * tuck), h: a.h };
      if (overlaps(shrunk, b)) out.push(`${name(solid[i]!)} overlaps ${solid[j]!.sprite}`);
    }
  }
  return out;
}

/** A room with one slab of rooms against each of `sides`, as in the contact sheets. */
function boxedIn(id: PieceId, rot: Rot, sides: string, fixture?: FixtureId): HouseState {
  const cells = placedCells(CONTENT.pieces[id].shape, 0, 0, rot);
  const specs: Spec[] = [[id, 3, 3, rot, fixture]];
  const used = new Set(cells.map((c) => `${c.x + 3},${c.y + 3}`));
  for (const s of sides) {
    const [dx, dy] = ({ N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] } as const)[s as 'N']!;
    const flat = s === 'N' || s === 'S';
    const out = cells
      .map((c) => ({ x: c.x + 3 + dx, y: c.y + 3 + dy }))
      .filter((c) => !used.has(`${c.x},${c.y}`))
      .sort((a, b) => (flat ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y));
    for (const c of out) {
      if (used.has(`${c.x},${c.y}`)) continue;
      used.add(`${c.x},${c.y}`);
      specs.push(['closet', c.x, c.y]);
    }
  }
  return house(specs);
}

describe('room layouts', () => {
  it('lay out every room type in every rotation, alone and boxed in, without clashes', () => {
    for (const id of INDOOR) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        for (const sides of ['', 'NS', 'EW', 'NESW']) {
          const m = modelOf(boxedIn(id, rot, sides));
          expect(problems(m, 1), `${id} r${rot} ${sides}`).toEqual([]);
        }
      }
    }
  });

  it("give every room type its key piece when it stands alone (the ghost's model)", () => {
    const KEY: Readonly<Partial<Record<PieceId, RegExp>>> = {
      bedroom: /^bed-double/,
      bathroom: /^toilet/,
      kitchen: /^range/,
      lKitchen: /^range/,
      diningRoom: /^dining-table/,
      livingRoom: /^sofa/,
      closet: /^clothes-rail/,
      hallway: /^runner/,
      longHallway: /^runner/,
      homeOffice: /^desk/,
      playroom: /^toy-box/,
      library: /^bookcase/,
      mudroom: /^(washer|bench)/,
      sunroom: /^plant-tall/,
    };
    for (const id of INDOOR) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const items = roomItems(pieceModel(id, rot), 1);
        const key = KEY[id];
        if (key)
          expect(
            items.some((it) => key.test(it.sprite)),
            `${id} r${rot}`,
          ).toBe(true);
        expect(problems(pieceModel(id, rot), 1), `${id} r${rot}`).toEqual([]);
      }
    }
  });

  it('put the car in a Garage through its garage door, nose in', () => {
    // A Garage on the front row opens onto the street.
    const m = modelOf(house([['garage', 4, 10]]));
    const items = roomItems(m, 1);
    expect(items.map((i) => i.sprite)).toContain('car-rear-0');
    expect(problems(m, 1)).toEqual([]);
  });

  it('split tall pieces at their over line: the rows above it rise over the walls', () => {
    const { h } = spritePos('bed-double-0');
    expect(itemRows({ sprite: 'bed-double-0', x: 0, y: 40 })).toEqual({
      top: null,
      bottom: [0, h],
    });
    expect(itemRows({ sprite: 'bed-double-0', x: 0, y: 40, over: 46 })).toEqual({
      top: [0, 6],
      bottom: [6, h],
    });
    // A one-cell Bathroom's toilet rises over the band; it is drawn above the walls.
    const m = modelOf(house([['bathroom', 4, 4]]));
    const toilet = roomItems(m, 1).find((it) => it.sprite.startsWith('toilet'))!;
    expect(toilet.over).toBeGreaterThan(toilet.y);
    expect(itemRows(toilet).top).not.toBeNull();
  });

  it('vary rooms of a type: three Bedrooms, three beds', () => {
    const m = modelOf(
      house([
        ['bedroom', 1, 1],
        ['bedroom', 3, 1],
        ['bedroom', 5, 1],
      ]),
    );
    const beds = [1, 2, 3].map(
      (uid) => roomItems(m, uid).find((it) => it.sprite.startsWith('bed-'))!.sprite,
    );
    expect(new Set(beds).size).toBe(3);
  });

  it('keep their colors when a newer room of their type comes or goes', () => {
    const beds = (specs: Spec[]) => {
      const m = modelOf(house(specs));
      return [...m.rooms.keys()].map(
        (uid) => roomItems(m, uid).find((it) => it.sprite.startsWith('bed-'))?.sprite,
      );
    };
    const two: Spec[] = [
      ['bedroom', 1, 1],
      ['bedroom', 3, 1],
    ];
    const three: Spec[] = [...two, ['bedroom', 5, 1]];
    expect(beds(three).slice(0, 2)).toEqual(beds(two));
  });

  it('are the same every time, and cached per model', () => {
    const specs: Spec[] = [
      ['livingRoom', 2, 2],
      ['kitchen', 4, 2],
      ['bedroom', 4, 4, 0, 'bunkBeds'],
      ['hallway', 2, 5, 1],
    ];
    const a = modelOf(house(specs));
    const b = modelOf(house(specs));
    for (const uid of [1, 2, 3, 4]) {
      expect(roomLayout(a, uid)).toEqual(roomLayout(b, uid));
      expect(roomLayout(a, uid)).toBe(roomLayout(a, uid));
    }
  });
});

describe('fixtures', () => {
  const only = (id: PieceId, fixture: FixtureId, rot: Rot = 0) => {
    const m = modelOf(house([[id, 4, 4, rot, fixture]]));
    return { m, layout: roomLayout(m, 1) };
  };

  it('Bunk Beds replace the bed, so the room that counts twice reads at a glance', () => {
    const { layout } = only('bedroom', 'bunkBeds');
    expect(layout.items.some((it) => it.sprite.startsWith('bunk-bed'))).toBe(true);
    expect(layout.items.some((it) => it.sprite.startsWith('bed-double'))).toBe(false);
    expect(layout.fixtureShown).toBe(true);
  });

  it('a Kitchen Island stands in the middle of the kitchen, or keeps its badge', () => {
    // With the Living Room south of it, the front door is the Living Room's.
    const m = modelOf(
      house([
        ['kitchen', 4, 4, 0, 'kitchenIsland'],
        ['livingRoom', 4, 6, 1],
      ]),
    );
    const layout = roomLayout(m, 1);
    expect(layout.items.map((it) => it.sprite)).toContain('kitchen-island');
    expect(layout.fixtureShown).toBe(true);
    // A Kitchen alone has the front door in its south wall, and the island would stand in its
    // walkway: the badge shows instead.
    const alone = only('kitchen', 'kitchenIsland');
    expect(alone.m.exits.some((e) => e.uid === 1 && e.side === 'S')).toBe(true);
    expect(alone.layout.items.map((it) => it.sprite)).not.toContain('kitchen-island');
    expect(alone.layout.fixtureShown).toBe(false);
  });

  it('a Fireplace takes a Living Room’s north wall, and the sofa faces the room in front of it', () => {
    const { layout } = only('livingRoom', 'fireplace');
    const fire = layout.items.find((it) => it.sprite === 'fireplace')!;
    const sofa = layout.items.find((it) => it.sprite.startsWith('sofa'))!;
    expect(fire).toBeDefined();
    expect(sofa.y).toBeGreaterThan(fire.y + spritePos('fireplace').h - 8);
    expect(layout.fixtureShown).toBe(true);
  });

  it('keep their badge where they don’t fit: a Fireplace in a one-cell Bathroom', () => {
    expect(only('bathroom', 'fireplace').layout.fixtureShown).toBe(false);
    // Bunk Beds that don't fit leave the bed, and the badge.
    const m = modelOf(
      house([
        ['bedroom', 4, 4, 0, 'bunkBeds'],
        ['hallway', 4, 3],
      ]),
    );
    const layout = roomLayout(m, 1);
    if (!layout.fixtureShown)
      expect(layout.items.some((it) => it.sprite.startsWith('bed-double'))).toBe(true);
  });

  it('painted fixtures show wherever their room has the wall for them', () => {
    for (const f of ['skylight', 'soundproofing', 'blackoutCurtains', 'chandelier'] as const) {
      expect(only(f === 'chandelier' ? 'diningRoom' : 'bedroom', f).layout.fixtureShown, f).toBe(
        true,
      );
    }
    const bay = only('livingRoom', 'bayWindow');
    expect(bay.layout.fixtureShown).toBe(true);
    const pane = bay.m.windows.find((w) => w.bay);
    // The street side first.
    expect(pane?.side).toBe('S');
    // A room boxed in on every side has no outside wall for a bay: its badge shows.
    const m = modelOf(boxedIn('bathroom', 0, 'NESW', 'bayWindow'));
    expect(m.windows.some((w) => w.bay)).toBe(false);
    expect(roomLayout(m, 1).fixtureShown).toBe(false);
  });
});

// Random houses with random room fixtures: every room's layout keeps to the rules.
function randomHouse(seed: number): HouseState {
  let s = seed >>> 0 || 1;
  const rand = (n: number) => {
    s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0;
    return s % n;
  };
  const W = 14;
  const rows = Array.from({ length: W }, (_, y) =>
    Array.from({ length: W }, (_, x) => ((x * 7 + y * 13 + seed) % 23 === 0 ? 'T' : '.')).join(''),
  );
  const taken = new Set<string>();
  const indoor = new Set<string>();
  const pieces: PlacedPiece[] = [];
  const free = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < W && !taken.has(`${x},${y}`) && rows[y]![x] === '.';
  const place = (defId: PieceId) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const rot = rand(4) as Rot;
      const cells = placedCells(CONTENT.pieces[defId].shape, rand(W), rand(W), rot);
      if (!cells.every((c) => free(c.x, c.y))) continue;
      const touches = cells.some((c) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => indoor.has(`${c.x + dx!},${c.y + dy!}`)),
      );
      if (indoor.size > 0 && CONTENT.pieces[defId].category === 'indoor' && !touches) continue;
      for (const c of cells) {
        taken.add(`${c.x},${c.y}`);
        if (CONTENT.pieces[defId].category === 'indoor') indoor.add(`${c.x},${c.y}`);
      }
      const x = Math.min(...cells.map((c) => c.x));
      const y = Math.min(...cells.map((c) => c.y));
      const fixture =
        CONTENT.pieces[defId].category === 'indoor' && rand(3) === 0
          ? defId === 'bedroom' && rand(2)
            ? 'bunkBeds'
            : (defId === 'kitchen' || defId === 'lKitchen') && rand(2)
              ? 'kitchenIsland'
              : (defId === 'diningRoom' || defId === 'livingRoom') && rand(2)
                ? 'chandelier'
                : ROOM_FIXTURES[rand(ROOM_FIXTURES.length)]!
          : undefined;
      pieces.push({
        uid: pieces.length + 1,
        defId,
        x,
        y,
        rot,
        placedWeek: 0,
        ...(fixture ? { fixture: { id: fixture, week: 0 } } : {}),
      });
      return;
    }
  };
  const rooms = 4 + rand(12);
  for (let i = 0; i < rooms; i++) place(INDOOR[rand(INDOOR.length)]!);
  for (const y of ['patio', 'driveway', 'hotTub'] as const) place(y);
  return { lot: lotFromRows(rows), pieces, nextUid: pieces.length + 1 };
}

describe('any house', () => {
  it('lays every room out inside its walls, off its doorways and off itself', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (seed) => {
        const m = modelOf(randomHouse(seed));
        for (const uid of m.rooms.keys()) expect(problems(m, uid), `seed ${seed}`).toEqual([]);
      }),
      { numRuns: 400 },
    );
  });

  it('furnishes nearly every room (a narrow one with a door in each wall may stay bare)', () => {
    let rooms = 0;
    let furnished = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const m = modelOf(randomHouse(seed * 7919));
      for (const uid of m.rooms.keys()) {
        rooms++;
        if (roomItems(m, uid).length > 0) furnished++;
      }
    }
    expect(furnished / rooms).toBeGreaterThan(0.97);
  });
});
