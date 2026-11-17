// D-181: a finished room (a fixture, and grown by Extend or Renovate) lights a lamp: one that
// stands with its furniture, added after everything else so the rest of the room stands where it
// did, or (a kitchen's, or a room with no floor left for one) one it hangs, drawn with the walls.
// The light keeps to the room's own cells; a room that isn't finished has none; the house model,
// a carried room's look and the photos' painters all read it from the state.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
import {
  CONTENT,
  placedCells,
  type FixtureId,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { houseModel, pieceModel, roomAt, type HouseModel } from '../board/house-model.ts';
import { CELL } from '../sprites.ts';
import { artSize } from './drawings.ts';
import {
  INK,
  lampSpot,
  paintLight,
  paintLights,
  paintPiece,
  paintWalls,
  pendantAt,
  type AtlasPixels,
  type Pixels,
} from './house-paint.ts';
import { arrangements, isLamp, roomItems, roomLayout, roomLook, type Item } from './rooms.ts';

const png = decodePng(readFileSync(new URL('../../../assets/atlas.png', import.meta.url)), 'atlas');
const atlas: AtlasPixels = { width: png.width, height: png.height, data: png.rgba };

/** A room's fixture in these tests: one each type takes. */
const FIXTURE: Partial<Record<PieceId, FixtureId>> = {
  bedroom: 'bunkBeds',
  kitchen: 'kitchenIsland',
  lKitchen: 'kitchenIsland',
  diningRoom: 'chandelier',
  livingRoom: 'fireplace',
};
const fixtureOf = (id: PieceId): FixtureId => FIXTURE[id] ?? 'skylight';

/** A finished room's changes: a fixture and a level. */
const done = (id: PieceId): Partial<PlacedPiece> => ({
  fixture: { id: fixtureOf(id), week: 1 },
  level: 1,
});

type Spec = readonly [PieceId, number, number, Rot?, Partial<PlacedPiece>?];

/** A house on an empty 12×12 lot: these pieces, uids from `first` in order. */
function house(specs: readonly Spec[], first = 1): HouseState {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0, more], i) => ({
    uid: first + i,
    defId,
    x,
    y,
    rot,
    placedWeek: i,
    ...more,
  }));
  return {
    lot: lotFromRows(Array.from({ length: 12 }, () => '.'.repeat(12))),
    pieces,
    nextUid: first + pieces.length,
  };
}

/** Room `id` at (3, 3) as the house's first piece, Closets against it on `sides`. */
function boxedIn(id: PieceId, rot: Rot, sides: string, more?: Partial<PlacedPiece>): HouseState {
  const cells = placedCells(CONTENT.pieces[id].shape, 3, 3, rot);
  const used = new Set(cells.map((c) => `${c.x},${c.y}`));
  const specs: Spec[] = [[id, 3, 3, rot, more]];
  const STEP = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] } as const;
  for (const s of sides as Iterable<keyof typeof STEP>) {
    const [dx, dy] = STEP[s];
    for (const c of cells) {
      const k = `${c.x + dx},${c.y + dy}`;
      if (used.has(k)) continue;
      used.add(k);
      specs.push(['closet', c.x + dx, c.y + dy]);
    }
  }
  return house(specs);
}

const same = (a: Item, b: Item) => a.sprite === b.sprite && a.x === b.x && a.y === b.y;

/** Every pixel a painter covered, with its alpha. */
function covered(p: Pixels): { x: number; y: number; a: number }[] {
  const out: { x: number; y: number; a: number }[] = [];
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const a = p.data[(y * p.w + x) * 4 + 3]!;
      if (a > 0) out.push({ x: p.x + x, y: p.y + y, a });
    }
  }
  return out;
}

function rgba(p: Pixels, x: number, y: number): number[] {
  const i = ((y - p.y) * p.w + (x - p.x)) * 4;
  return [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!, p.data[i + 3]!];
}

// The room types that can grow (D-168's Extend, or Renovate where a checklist caps them).
const TYPES: readonly PieceId[] = [
  'bedroom',
  'kitchen',
  'lKitchen',
  'livingRoom',
  'diningRoom',
  'homeOffice',
  'garage',
  'library',
  'nursery',
  'playroom',
];

describe('a finished room’s lamp', () => {
  it('stands with the furniture or hangs, and the rest of the room stands where it did', () => {
    const misses: string[] = [];
    for (const id of TYPES) {
      for (const rot of [0, 1, 2, 3] as const) {
        for (let style = 0; style < arrangements(id); style++) {
          const look = { color: 0, style, fixture: fixtureOf(id) };
          const lit = roomLayout(pieceModel(id, rot, { ...look, lit: true }), 1);
          const plain = roomLayout(pieceModel(id, rot, look), 1);
          const name = `${id} r${rot} s${style}`;
          if (plain.lamp || plain.pendant) misses.push(`${name}: lit before it's finished`);
          if (!!lit.lamp === !!lit.pendant) misses.push(`${name}: no lamp, or two`);
          // A kitchen's light hangs over its table.
          if ((id === 'kitchen' || id === 'lKitchen') && !lit.pendant) {
            misses.push(`${name}: a kitchen's lamp stands`);
          }
          for (const it of plain.items) {
            if (!lit.items.some((q) => same(q, it))) misses.push(`${name}: ${it.sprite} moved`);
          }
          const added = lit.items.filter((q) => !plain.items.some((it) => same(q, it)));
          if (added.length > 1 || (added[0] && added[0] !== lit.lamp)) {
            misses.push(`${name}: added ${added.map((q) => q.sprite).join(', ')}`);
          }
          if (lit.lamp && !isLamp(lit.lamp.sprite)) misses.push(`${name}: ${lit.lamp.sprite}`);
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it('finds a place in a room boxed in by its neighbors', () => {
    const misses: string[] = [];
    for (const id of TYPES) {
      for (const rot of [0, 1] as const) {
        for (const sides of ['NS', 'EW', 'NESW']) {
          const m = houseModel(boxedIn(id, rot, sides, done(id)));
          const lay = roomLayout(m, 1);
          if (!lay.lamp && !lay.pendant) misses.push(`${id} r${rot} ${sides}`);
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it('only once the room is finished: a fixture alone, or growth alone, leaves it dark', () => {
    const fixture = { id: 'fireplace' as const, week: 1 };
    for (const more of [{ fixture }, { level: 1 }, { extended: 1 }, {}]) {
      const m = houseModel(house([['livingRoom', 2, 2, 0, more]]));
      expect(m.rooms.get(1)?.finished).toBeUndefined();
      expect(roomLayout(m, 1)).not.toHaveProperty('lamp');
      expect(roomLayout(m, 1)).not.toHaveProperty('pendant');
      expect(paintLight(m, 1, atlas)).toBeNull();
      expect(paintLights(m, atlas)).toBeNull();
      expect(lampSpot(m, 1)).toBeNull();
    }
    for (const more of [
      { fixture, level: 1 },
      { fixture, extended: 1 },
    ]) {
      const m = houseModel(house([['livingRoom', 2, 2, 0, more]]));
      expect(m.rooms.get(1)?.finished).toBe(true);
      expect(paintLight(m, 1, atlas)).not.toBeNull();
    }
  });

  it('lights its own room only: a pool on its floor, a halo, and its shade glowing', () => {
    // Two Bedrooms side by side; only the first is finished.
    const m = houseModel(
      house([
        ['bedroom', 2, 2, 0, { fixture: { id: 'fireplace', week: 1 }, extended: 1 }],
        ['bedroom', 4, 2],
      ]),
    );
    const lights = paintLights(m, atlas)!;
    const px = covered(lights);
    expect(px.length).toBeGreaterThan(200);
    for (const p of px) expect(roomAt(m, Math.floor(p.x / CELL), Math.floor(p.y / CELL))).toBe(1);
    // The pool and the halo are light laid over the room; the shade's own pixels are solid.
    expect(px.some((p) => p.a < 255)).toBe(true);
    const lamp = roomLayout(m, 1).lamp!;
    expect(lamp).toBeDefined();
    const { w, h } = artSize(lamp.sprite);
    const shade = px.filter(
      (p) => p.a === 255 && p.x >= lamp.x && p.x < lamp.x + w && p.y >= lamp.y && p.y < lamp.y + h,
    );
    expect(shade.length).toBeGreaterThan(4);
    // The burst comes from its shade.
    const at = lampSpot(m, 1)!;
    expect(at.x).toBeGreaterThan(lamp.x);
    expect(at.x).toBeLessThan(lamp.x + w);
    expect(at.y).toBeGreaterThanOrEqual(lamp.y);
    expect(at.y).toBeLessThan(lamp.y + h);
  });

  it('hangs in a kitchen: drawn with the walls, and lit over them', () => {
    const h = house([['kitchen', 2, 2, 0, done('kitchen')]]);
    const m = houseModel(h);
    expect(roomLayout(m, 1).pendant).toBe(true);
    const at = pendantAt(m, m.rooms.get(1)!);
    const walls = paintWalls(m)!;
    // Its cord, in ink, from the top of the drawing.
    expect(rgba(walls, at.x + 4, at.y).slice(0, 3)).toEqual([...INK]);
    // Lit, its bulb is the palette's pale yellow.
    const light = paintLight(m, 1, atlas)!;
    expect(rgba(light, at.x + 4, at.y + at.h - 1)).toEqual([0xff, 0xf5, 0x9a, 255]);
    // The same kitchen unfinished hangs nothing there.
    const bare = houseModel(house([['kitchen', 2, 2, 0, { level: 1 }]]));
    expect(rgba(paintWalls(bare)!, at.x + 4, at.y)[3]).toBe(0);
    expect(lampSpot(m, 1)).toEqual({ x: at.x + at.w / 2, y: expect.any(Number) });
  });

  it('comes from the state: the house model, a carried room’s look, and a piece alone', () => {
    const h = house([
      ['livingRoom', 2, 2, 0, { fixture: { id: 'fireplace', week: 1 }, level: 1 }],
      ['bedroom', 2, 5, 0, { fixture: { id: 'bunkBeds', week: 1 } }],
    ]);
    expect(roomLook(h, 1).lit).toBe(true);
    expect(roomLook(h, 2)).not.toHaveProperty('lit');
    // The Moving Truck carries it lit.
    const look = roomLook(h, 1);
    const carried = pieceModel('livingRoom', 0, look);
    expect(carried.rooms.get(1)?.finished).toBe(true);
    const dark = pieceModel('livingRoom', 0, { ...look, lit: false });
    expect(dark.rooms.get(1)?.finished).toBeUndefined();
    const a = paintPiece(carried, atlas, roomItems(carried, 1))!;
    const b = paintPiece(dark, atlas, roomItems(dark, 1))!;
    expect(a.data).not.toEqual(b.data);
  });
});
