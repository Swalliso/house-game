// D-181: a finished room (a fixture, and grown by Extend or Renovate) lights a lamp: one that
// stands with its furniture, added after everything else so the rest of the room stands where it
// did (its Blackout Curtains too), or (a kitchen's, or a room with no floor left for one) one it
// hangs over its own floor, drawn with the walls. The light keeps to the room's own cells and off
// its wall bands; a room that isn't finished has none; the house model, a carried room's look and
// the photos' painters all read it from the state, and the board and the photos put it right
// after the room's own tall tops, so a piece further south stands in front of it.

import { readFileSync } from 'node:fs';
import type { VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
import {
  CONTENT,
  cellsToShape,
  matchesDef,
  placedCells,
  type Cell,
  type FixtureId,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { OverhangLayer } from '../board/HouseLayers.tsx';
import {
  houseModel,
  overlaps,
  pieceModel,
  roomAt,
  type HouseModel,
  type Rect,
  type Room,
} from '../board/house-model.ts';
import { paintHouse } from '../screens/photo-paint.ts';
import { CELL, spritePos, type SpriteId } from '../sprites.ts';
import { artSize } from './drawings.ts';
import {
  Canvas,
  INK,
  lampSpot,
  paintLight,
  paintLights,
  paintPiece,
  paintWalls,
  pendantAt,
  pendantPixels,
  wallMask,
  type AtlasPixels,
  type Pixels,
} from './house-paint.ts';
import {
  arrangements,
  isLamp,
  itemRows,
  roomItems,
  roomLayout,
  roomLook,
  type Item,
  type RoomLayout,
} from './rooms.ts';
import { yardModel } from './yard.ts';

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

/** Pixel (x, y) of an atlas sprite: its RGBA. */
function spritePixel(id: SpriteId, x: number, y: number): number[] {
  const s = spritePos(id);
  const i = ((s.y + y) * atlas.width + s.x + x) * 4;
  return [atlas.data[i]!, atlas.data[i + 1]!, atlas.data[i + 2]!, atlas.data[i + 3]!];
}

/**
 * What the layout keeps other furniture off: an item's sprite below its room's band line (the
 * rows above it rise over the wall).
 */
function footprint(it: Item): Rect {
  const { w, h } = artSize(it.sprite);
  const top = it.over ?? it.y;
  return { x: it.x, y: top, w, h: it.y + h - top };
}

/** The pieces that lie flat on the floor, which anything may stand on: rugs, mats, runners. */
const FLAT = /^(rug|mat|bath-mat|runner)(-|$)/;

/** A rect's pixels. */
function pixelsOf(r: Rect): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y });
  return out;
}

/** The first of `pixels` that isn't over room `r`'s own floor (its cells, off its wall bands), or ''. */
function offFloor(m: HouseModel, r: Room, pixels: readonly { x: number; y: number }[]): string {
  const mask = wallMask(m, r.box);
  for (const p of pixels) {
    if (roomAt(m, Math.floor(p.x / CELL), Math.floor(p.y / CELL)) !== r.uid) {
      return `(${p.x}, ${p.y}) is outside it`;
    }
    if (mask.has(p.x, p.y)) return `(${p.x}, ${p.y}) is on a wall`;
  }
  return '';
}

/** The kitchen cards: a Kitchen and an L-Kitchen in each turn (an Addition is a Kitchen's 2×2). */
const KITCHENS: readonly (readonly [PieceId, Rot])[] = [
  ['kitchen', 0],
  ['lKitchen', 0],
  ['lKitchen', 1],
  ['lKitchen', 2],
  ['lKitchen', 3],
];

/**
 * Every shape a Kitchen or an L-Kitchen grows into when one kitchen card (or an Addition) extends
 * it: laid beside it, sharing at least 2 tiles of wall (D-168).
 */
function grownKitchens(): { defId: PieceId; shape: string[] }[] {
  const out = new Map<string, { defId: PieceId; shape: string[] }>();
  const at = (cells: readonly Cell[]) => new Set(cells.map((c) => `${c.x},${c.y}`));
  for (const [id, rot] of KITCHENS) {
    const room = placedCells(CONTENT.pieces[id].shape, 4, 4, rot);
    const own = at(room);
    for (const [card, turn] of KITCHENS) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const cells = placedCells(CONTENT.pieces[card].shape, 4 + dx, 4 + dy, turn);
          if (cells.some((c) => own.has(`${c.x},${c.y}`))) continue;
          let shared = 0;
          for (const c of cells) {
            for (const [ox, oy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ] as const) {
              if (own.has(`${c.x + ox},${c.y + oy}`)) shared++;
            }
          }
          if (shared < 2) continue;
          const { shape } = cellsToShape([...room, ...cells]);
          out.set(`${id} ${shape.join('/')}`, { defId: id, shape });
        }
      }
    }
  }
  return [...out.values()];
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
          if (lit.fixtureShown !== plain.fixtureShown) misses.push(`${name}: its fixture's badge`);
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it('leaves Blackout Curtains where they hung, and in view', () => {
    const misses: string[] = [];
    const curtains = { id: 'blackoutCurtains' as const, week: 1 };
    const compare = (name: string, plain: RoomLayout, lit: RoomLayout) => {
      const was = JSON.stringify(plain.drape);
      if (JSON.stringify(lit.drape) !== was) {
        misses.push(`${name}: the curtains ${was} → ${JSON.stringify(lit.drape)}`);
      }
      if (lit.fixtureShown !== plain.fixtureShown) misses.push(`${name}: its fixture's badge`);
      // Nothing stands in front of them: they and their rod's ends stay in view.
      const d = lit.drape;
      const lamp = lit.lamp;
      if (d && lamp && overlaps(footprint(lamp), { x: d.x - 1, y: d.y, w: d.w + 2, h: d.h })) {
        misses.push(`${name}: its lamp stands in front of them`);
      }
    };
    const takes = TYPES.filter((id) =>
      matchesDef(CONTENT.fixtures.blackoutCurtains.fits, CONTENT.pieces[id]),
    );
    expect(takes.length).toBeGreaterThan(6);
    for (const id of takes) {
      for (const rot of [0, 1, 2, 3] as const) {
        for (let style = 0; style < arrangements(id); style++) {
          const look = { color: 0, style, fixture: 'blackoutCurtains' as const };
          compare(
            `${id} r${rot} s${style}`,
            roomLayout(pieceModel(id, rot, look), 1),
            roomLayout(pieceModel(id, rot, { ...look, lit: true }), 1),
          );
        }
        for (const sides of ['N', 'NS', 'EW', 'NESW']) {
          compare(
            `${id} r${rot} ${sides}`,
            roomLayout(houseModel(boxedIn(id, rot, sides, { fixture: curtains })), 1),
            roomLayout(houseModel(boxedIn(id, rot, sides, { fixture: curtains, level: 1 })), 1),
          );
        }
      }
    }
    expect(misses).toEqual([]);
    // The review's case: a Nursery with Closets on all four sides lost its curtains to the lamp.
    const nursery = roomLayout(
      houseModel(boxedIn('nursery', 0, 'NESW', { fixture: curtains, level: 1 })),
      1,
    );
    expect(nursery.drape).toEqual({ x: 119, y: 98, w: 18, h: 8 });
    expect(nursery.fixtureShown).toBe(true);
  });

  it('finds a place in a room boxed in by its neighbors: on its own floor, clear of the rest', () => {
    const misses: string[] = [];
    let stands = 0;
    let hangs = 0;
    for (const id of TYPES) {
      for (const rot of [0, 1, 2, 3] as const) {
        for (const sides of ['NS', 'EW', 'NESW']) {
          const m = houseModel(boxedIn(id, rot, sides, done(id)));
          const room = m.rooms.get(1)!;
          const lay = roomLayout(m, 1);
          const name = `${id} r${rot} ${sides}`;
          if (lay.pendant) {
            hangs++;
            const off = offFloor(m, room, pendantPixels(pendantAt(m, room)));
            if (off) misses.push(`${name}: it hangs where ${off}`);
            continue;
          }
          const lamp = lay.lamp;
          if (!lamp) {
            misses.push(`${name}: no lamp`);
            continue;
          }
          stands++;
          if (!isLamp(lamp.sprite) || !lay.items.includes(lamp)) {
            misses.push(`${name}: ${lamp.sprite} isn't one of its lamps`);
          }
          // On the room's own floor (tucking a pixel under a side wall, as furniture may)...
          const foot = footprint(lamp);
          const off = offFloor(m, room, pixelsOf({ ...foot, x: foot.x + 1, w: foot.w - 2 }));
          if (off) misses.push(`${name}: it stands where ${off}`);
          // ...clear of everything else standing there, and of its doorways' walkways.
          for (const it of lay.items) {
            if (it !== lamp && !FLAT.test(it.sprite) && overlaps(foot, footprint(it))) {
              misses.push(`${name}: it stands on ${it.sprite}`);
            }
          }
          const ways = [
            ...m.doors.filter((d) => d.a === 1 || d.b === 1),
            ...m.exits.filter((e) => e.uid === 1),
          ];
          if (ways.some((d) => overlaps(foot, d.clear))) misses.push(`${name}: it's in a doorway`);
        }
      }
    }
    expect(misses).toEqual([]);
    // Both kinds come up: a kitchen hangs one, most rooms find a place to stand one.
    expect(stands).toBeGreaterThan(40);
    expect(hangs).toBeGreaterThan(20);
  });

  it('hangs over its own floor: an L-Kitchen in each turn, every grown kitchen, a room boxed in', () => {
    const misses: string[] = [];
    const check = (name: string, m: HouseModel) => {
      const room = m.rooms.get(1)!;
      const at = pendantAt(m, room);
      const off = offFloor(m, room, pendantPixels(at));
      if (off) misses.push(`${name}: ${off}`);
      if (!roomLayout(m, 1).pendant) return;
      // Lit, all of it is drawn: none of it cut off.
      const light = paintLight(m, 1, atlas)!;
      const all = pendantPixels(at);
      const shown = all.filter((p) => rgba(light, p.x, p.y)[3] === 255).length;
      if (shown !== all.length) misses.push(`${name}: ${shown} of its ${all.length} px lit`);
    };
    for (const id of TYPES) {
      for (const rot of [0, 1, 2, 3] as const) {
        check(`${id} r${rot}`, houseModel(house([[id, 3, 3, rot, done(id)]])));
        for (const sides of ['NS', 'EW', 'NESW']) {
          check(`${id} r${rot} ${sides}`, houseModel(boxedIn(id, rot, sides, done(id))));
        }
      }
    }
    const grown = grownKitchens();
    // A Kitchen and the L-Kitchen's turns, each grown every way a card can grow it.
    expect(grown.length).toBeGreaterThan(30);
    for (const { defId, shape } of grown) {
      const more = { ...done(defId), shape, extended: 1 };
      check(`${defId} ${shape.join('/')}`, houseModel(house([[defId, 3, 3, 0, more]])));
    }
    expect(misses).toEqual([]);
    // The L-Kitchen hangs it over the middle of its arm with no north face, as deep as a Kitchen's.
    const l = houseModel(house([['lKitchen', 3, 3, 0, done('lKitchen')]]));
    const k = houseModel(house([['kitchen', 3, 3, 0, done('kitchen')]]));
    expect(pendantAt(l, l.rooms.get(1)!)).toEqual({ x: 107, y: 125, w: 9, h: 9 });
    expect(pendantAt(k, k.rooms.get(1)!).y).toBe(125);
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

  it('keeps its glow still and off the walls: only a standing lamp’s lit shade moves with it', () => {
    const misses: string[] = [];
    let standing = 0;
    for (const id of TYPES) {
      for (const rot of [0, 1, 2, 3] as const) {
        for (const more of [done(id), { ...done(id), level: 0, extended: 1 }]) {
          const m = houseModel(house([[id, 3, 3, rot, more]]));
          const room = m.rooms.get(1)!;
          const name = `${id} r${rot}${more.extended ? ' extended' : ''}`;
          const glow = paintLight(m, 1, atlas, 'glow')!;
          const shade = paintLight(m, 1, atlas, 'shade');
          const all = paintLight(m, 1, atlas)!;
          // The glow, which stays still, lies on the room's own floor, faces and furniture: never
          // on its wall bands, where a wobble would carry it over the house's outline.
          const off = offFloor(m, room, covered(glow));
          if (off) misses.push(`${name}: its glow ${off}`);
          const lamp = roomLayout(m, 1).lamp;
          if (!lamp) {
            // A hanging lamp hangs with the walls: its light is all glow.
            if (shade !== null) misses.push(`${name}: a hanging lamp's light moves`);
            if (JSON.stringify(glow) !== JSON.stringify(all)) misses.push(`${name}: glow ≠ light`);
            continue;
          }
          standing++;
          // The glow is light laid over the room, never solid: the lit shade is all in the part
          // that moves.
          if (covered(glow).some((p) => p.a === 255))
            misses.push(`${name}: its glow has its shade`);
          // The shade moves with its lamp, so it's only ever where the lamp is.
          const { w, h } = artSize(lamp.sprite);
          for (const p of covered(shade!)) {
            if (p.x < lamp.x || p.y < lamp.y || p.x >= lamp.x + w || p.y >= lamp.y + h) {
              misses.push(`${name}: its lit shade at (${p.x}, ${p.y}), off its lamp`);
              break;
            }
          }
          // Together they're the whole light.
          const both = new Canvas(all.x, all.y, all.w, all.h);
          both.over(glow);
          both.over(shade!);
          if (JSON.stringify(both.pixels()) !== JSON.stringify(all)) {
            misses.push(`${name}: glow and shade ≠ light`);
          }
        }
      }
    }
    expect(misses).toEqual([]);
    expect(standing).toBeGreaterThan(30);
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

describe('a finished room’s light among the overhang', () => {
  // A finished Bedroom with a Treehouse just south of it: the Treehouse's deck rises into the
  // Bedroom's southern cells and stands in front of them.
  const h = house([
    ['bedroom', 3, 2, 0, done('bedroom')],
    ['treehouse', 3, 4],
  ]);
  const m = houseModel(h);
  const yard = yardModel(h, m);
  const deck = yard.pieces.get(2)!.items.filter((it) => itemRows(it).top);

  it('stays behind a piece further south in the photos', () => {
    const cv = new Canvas(0, 0, 12 * CELL, 12 * CELL);
    paintHouse(cv, h, m, yard, atlas);
    const light = paintLight(m, 1, atlas)!;
    let under = 0;
    const misses: string[] = [];
    for (const it of deck) {
      const [from, to] = itemRows(it).top!;
      const { w } = artSize(it.sprite);
      for (let y = from; y < to; y++) {
        for (let x = 0; x < w; x++) {
          const px = spritePixel(it.sprite as SpriteId, x, y);
          if (px[3] !== 255) continue;
          const at = { x: it.x + x, y: it.y + y };
          if (light.x <= at.x && at.x < light.x + light.w && light.y <= at.y) {
            if (at.y < light.y + light.h && rgba(light, at.x, at.y)[3]! > 0) under++;
          }
          const got = rgba(cv.pixels(), at.x, at.y);
          if (got.slice(0, 3).join() !== px.slice(0, 3).join()) misses.push(`(${at.x}, ${at.y})`);
        }
      }
    }
    // The light reaches under the deck, and the deck shows over it, unlit.
    expect(under).toBeGreaterThan(50);
    expect(misses).toEqual([]);
  });

  it('on the board, comes right after its room’s own tops, at its bottom row', () => {
    const layer = OverhangLayer({ model: m, yard, scale: 2 }) as VNode<{ children: unknown }>;
    const kids = (layer.props.children as (VNode<{ z: number }> | null)[]).filter(
      (k): k is VNode<{ z: number }> => k !== null,
    );
    const light = kids.findIndex((k) => k.key === 'light-1');
    expect(light).toBeGreaterThanOrEqual(0);
    const room = m.rooms.get(1)!;
    expect(kids[light]!.props.z).toBe((room.box.y + room.box.h) / CELL);
    // Right after the Bedroom's own tall tops (its bunk beds over the north wall).
    const tops = kids.findIndex((k) => k.key === 1);
    expect(tops).toBe(light - 1);
    expect(kids[tops]!.props.z).toBe(kids[light]!.props.z);
    // The Treehouse's deck, further south, in front of it.
    const tree = kids.find((k) => k.key === 2)!;
    expect(tree.props.z).toBeGreaterThan(kids[light]!.props.z);
    // An unfinished room has no light.
    expect(kids.filter((k) => String(k.key).startsWith('light-'))).toHaveLength(1);
  });
});
