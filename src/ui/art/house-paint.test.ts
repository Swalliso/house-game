// The house's painters (D-097): wall bands from a mask in LimeZu's ink and fill, door gaps the
// floor runs through, the outside wall turning concave corners, floors, faces and the house's
// shadow on the lot, and the fixtures painted with their room.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
import type { FixtureId, HouseState, PieceId, PlacedPiece, Rot } from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { houseModel, roomAt, WALL, type HouseModel } from '../board/house-model.ts';
import { CELL, PIECE_SPRITES, spritePos, type SpriteId } from '../sprites.ts';
import {
  BAND,
  FACE,
  HOUSE_SHADOW,
  INK,
  chandelierAt,
  paintFloors,
  paintPiece,
  paintWalls,
  paintYardPiece,
  wallMask,
  type AtlasPixels,
  type Pixels,
} from './house-paint.ts';
import { roomItems } from './rooms.ts';
import { pieceModel } from '../board/house-model.ts';
import { yardModel, yardPieceLayout } from './yard.ts';

const png = decodePng(readFileSync(new URL('../../../assets/atlas.png', import.meta.url)), 'atlas');
const atlas: AtlasPixels = { width: png.width, height: png.height, data: png.rgba };

function model(
  specs: readonly (readonly [PieceId, number, number, Rot?, FixtureId?])[],
): HouseModel {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0, fixture], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot,
    placedWeek: 0,
    ...(fixture ? { fixture: { id: fixture, week: 0 } } : {}),
  }));
  const house: HouseState = {
    lot: lotFromRows(Array.from({ length: 10 }, () => '.'.repeat(10))),
    pieces,
    nextUid: pieces.length + 1,
  };
  return houseModel(house);
}

function pixel(p: Pixels, x: number, y: number): [number, number, number, number] {
  const i = ((y - p.y) * p.w + (x - p.x)) * 4;
  return [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!, p.data[i + 3]!];
}

function sprite(id: SpriteId, x: number, y: number): [number, number, number, number] {
  const s = spritePos(id);
  const i = ((s.y + y) * atlas.width + s.x + x) * 4;
  return [atlas.data[i]!, atlas.data[i + 1]!, atlas.data[i + 2]!, atlas.data[i + 3]!];
}

const box = (m: HouseModel) => ({
  x: m.bounds!.x * CELL - 8,
  y: m.bounds!.y * CELL - 8,
  w: m.bounds!.w * CELL + 16,
  h: m.bounds!.h * CELL + 16,
});

describe('the wall mask', () => {
  it('runs an outside wall inside the room, and nothing past its cells', () => {
    const m = model([['bedroom', 2, 2]]);
    const mask = wallMask(m, box(m));
    const x0 = 2 * CELL;
    const y0 = 2 * CELL;
    for (let i = 0; i < 2 * CELL; i++) {
      // Every side's band is WALL.out deep, inside the room.
      expect(mask.has(x0 + i, y0)).toBe(true);
      expect(mask.has(x0 + i, y0 + WALL.out - 1)).toBe(true);
      expect(mask.has(x0, y0 + i)).toBe(true);
      expect(mask.has(x0 + 2 * CELL - WALL.out, y0 + i)).toBe(true);
      // Past the cells, and just inside the band: no wall.
      expect(mask.has(x0 + i, y0 - 1)).toBe(false);
      expect(mask.has(x0 - 1, y0 + i)).toBe(false);
    }
    expect(mask.has(x0 + CELL, y0 + WALL.out)).toBe(false);
    expect(mask.has(x0 + WALL.out, y0 + CELL)).toBe(false);
  });

  it('centers a wall between rooms on their line: half on each side', () => {
    const m = model([
      ['bedroom', 2, 2],
      ['bedroom', 4, 2],
    ]);
    const mask = wallMask(m, box(m));
    const line = 4 * CELL;
    const y = 3 * CELL + 16; // the lower row, clear of any doorway in the upper one
    const doorRows = m.doors.flatMap((d) => [d.gap.y, d.gap.y + d.gap.h]);
    const at = doorRows.length > 0 && y >= doorRows[0]! && y < doorRows[1]! ? y - 20 : y;
    expect(mask.has(line - 3, at)).toBe(false);
    for (const dx of [-2, -1, 0, 1]) expect(mask.has(line + dx, at)).toBe(true);
    expect(mask.has(line + 2, at)).toBe(false);
  });

  it('opens a doorway: the floor runs through its gap', () => {
    const m = model([
      ['bedroom', 2, 2],
      ['bedroom', 4, 2],
    ]);
    expect(m.doors).toHaveLength(1);
    const mask = wallMask(m, box(m));
    const g = m.doors[0]!.gap;
    for (let y = g.y; y < g.y + g.h; y++) {
      for (let x = g.x; x < g.x + g.w; x++) expect(mask.has(x, y)).toBe(false);
    }
    // And the band picks up again on either side of it.
    expect(mask.has(g.x + 1, g.y - 1)).toBe(true);
    expect(mask.has(g.x + 1, g.y + g.h)).toBe(true);
  });

  it('turns an outside wall round a concave corner', () => {
    // An L-Kitchen ('#.', '##'): the notch is cell (3, 2), so the corner is at (3, 3)'s top-left.
    const m = model([['lKitchen', 2, 2]]);
    expect(roomAt(m, 3, 2)).toBe(0);
    const mask = wallMask(m, box(m));
    // The corner square inside cell (2, 3), at its top-right, is wall.
    for (let dy = 0; dy < WALL.out; dy++) {
      for (let dx = 1; dx <= WALL.out; dx++)
        expect(mask.has(3 * CELL - dx, 3 * CELL + dy)).toBe(true);
    }
  });
});

describe('the walls canvas', () => {
  it('draws bands in LimeZu’s ink round a white fill, and glass in windows', () => {
    const m = model([['bedroom', 2, 2]]);
    const p = paintWalls(m)!;
    const x = 2 * CELL + 10; // past the west wall, before the north window
    expect(pixel(p, x, 2 * CELL)).toEqual([...INK, 255]);
    expect(pixel(p, x, 2 * CELL + 2)).toEqual([...BAND, 255]);
    expect(pixel(p, x, 2 * CELL + WALL.out - 1)).toEqual([...INK, 255]);
    expect(pixel(p, x, 2 * CELL + WALL.out)[3]).toBe(0);
    const w = m.windows.find((q) => q.side === 'N')!;
    const glass = pixel(p, w.rect.x + 2, w.rect.y + 2);
    expect(glass.slice(0, 3)).not.toEqual([...INK]);
    expect(glass.slice(0, 3)).not.toEqual([...BAND]);
  });
});

describe('the floor canvas', () => {
  it('lays each room’s own floor, with its wallpaper under the north wall', () => {
    const m = model([['library', 2, 2]]);
    const p = paintFloors(m, atlas, { shadow: false })!;
    expect(pixel(p, 2 * CELL + 20, 3 * CELL + 20)).toEqual(
      sprite(PIECE_SPRITES.library.floor, 20, 20),
    );
    expect(pixel(p, 2 * CELL + 10, 2 * CELL + WALL.out + 3)).toEqual(sprite(FACE.library, 10, 3));
  });

  it('casts the house’s shadow down and to the right, on the lot only', () => {
    const m = model([['bedroom', 2, 2]]);
    const p = paintFloors(m, atlas)!;
    const right = 4 * CELL;
    const bottom = 4 * CELL;
    const shade = Math.round(HOUSE_SHADOW.alpha * 255);
    expect(pixel(p, right, 3 * CELL)[3]).toBe(shade);
    expect(pixel(p, right + HOUSE_SHADOW.dx - 1, 3 * CELL)[3]).toBe(shade);
    expect(pixel(p, 3 * CELL, bottom + HOUSE_SHADOW.dy - 1)[3]).toBe(shade);
    // Its first rows and columns are lit: the shadow starts dy below and dx right of the house.
    expect(pixel(p, right, 2 * CELL + HOUSE_SHADOW.dy - 1)[3]).toBe(0);
    expect(pixel(p, 2 * CELL + HOUSE_SHADOW.dx - 1, bottom)[3]).toBe(0);
    // Never above or left of the house: light comes from the top-left. (The canvas reaches down
    // to the doormat outside the front door.)
    const mat = m.exits.find((e) => e.kind === 'front')!.mat;
    expect([p.x, p.y, p.w, p.h]).toEqual([
      2 * CELL,
      2 * CELL,
      2 * CELL + HOUSE_SHADOW.dx,
      Math.max(2 * CELL + HOUSE_SHADOW.dy, mat.y + mat.h - 2 * CELL),
    ]);
  });

  it('puts a doormat outside the front door, on the ground', () => {
    const m = model([['livingRoom', 3, 2]]);
    const front = m.exits.find((e) => e.kind === 'front')!;
    expect(front.mat.y).toBeGreaterThanOrEqual(5 * CELL);
    const p = paintFloors(m, atlas)!;
    expect(pixel(p, front.mat.x + 2, front.mat.y + 2)[3]).toBe(255);
    // Not on the walls canvas: the yard's props stand over it.
    const walls = paintWalls(m)!;
    const inside = front.mat.y + 2 < walls.y + walls.h && front.mat.x + 2 < walls.x + walls.w;
    if (inside) expect(pixel(walls, front.mat.x + 2, front.mat.y + 2)[3]).toBe(0);
  });
});

describe('the ghost', () => {
  it('is one piece’s floor, items and walls in a box its size', () => {
    const m = pieceModel('bedroom', 0);
    const p = paintPiece(m, atlas, roomItems(m, 1))!;
    expect([p.x, p.y, p.w, p.h]).toEqual([0, 0, 2 * CELL, 2 * CELL]);
    expect(pixel(p, 0, 0)).toEqual([...INK, 255]);
    expect(pixel(p, CELL, CELL)[3]).toBe(255);
  });
});

describe('fixtures painted with their room', () => {
  const differs = (a: readonly number[], b: readonly number[]) => a.some((v, i) => v !== b[i]);

  it('Soundproofing pads the north faces, over the baseboard', () => {
    const plain = paintFloors(model([['bedroom', 2, 2]]), atlas, { shadow: false })!;
    const padded = paintFloors(model([['bedroom', 2, 2, 0, 'soundproofing']]), atlas, {
      shadow: false,
    })!;
    const y = 2 * CELL + WALL.out + 1;
    let changed = 0;
    for (let x = 2 * CELL + WALL.out; x < 4 * CELL - WALL.out; x++) {
      if (differs(pixel(plain, x, y), pixel(padded, x, y))) changed++;
    }
    expect(changed).toBeGreaterThan(40);
    // The baseboard's last row is the room's own.
    const base = 2 * CELL + WALL.out + WALL.face - 1;
    expect(pixel(padded, 2 * CELL + 20, base)).toEqual(pixel(plain, 2 * CELL + 20, base));
  });

  it('Soundproofing pads the room’s side of its wall bands, over the furniture', () => {
    // A Closet's rail hides its north face, so the pads that show are the bands'.
    const m = model([
      ['bedroom', 2, 2],
      ['closet', 4, 2, 0, 'soundproofing'],
    ]);
    const p = paintWalls(m)!;
    const plain = paintWalls(
      model([
        ['bedroom', 2, 2],
        ['closet', 4, 2],
      ]),
    )!;
    const pad = (x: number, y: number) => differs(pixel(p, x, y), pixel(plain, x, y));
    // The Closet's east band (outside, all its own) is padded inside its ink...
    let padded = 0;
    for (let y = 2 * CELL + WALL.out; y < 3 * CELL - WALL.out; y++)
      if (pad(5 * CELL - WALL.out + 2, y)) padded++;
    expect(padded).toBeGreaterThan(10);
    expect(pixel(p, 5 * CELL - 1, 2 * CELL + 16)).toEqual([...INK, 255]);
    // ...and the wall it shares with the Bedroom only on the Closet's side of the line.
    const y = 2 * CELL + 3 * WALL.out;
    const door = m.doors.some((d) => d.gap.y <= y && y < d.gap.y + d.gap.h);
    if (!door) {
      expect(pad(4 * CELL, y)).toBe(true);
      expect(pad(4 * CELL - 1, y)).toBe(false);
    }
  });

  it('Blackout Curtains draw drapes over the windows, and hang in view on a north face', () => {
    const plainM = model([['bedroom', 2, 2]]);
    const darkM = model([['bedroom', 2, 2, 0, 'blackoutCurtains']]);
    const w = darkM.windows.find((q) => q.side === 'E')!;
    const glass = pixel(paintWalls(plainM)!, w.rect.x + 2, w.rect.y + 3);
    const cloth = pixel(paintWalls(darkM)!, w.rect.x + 2, w.rect.y + 3);
    expect(cloth[3]).toBe(255);
    expect(differs(glass, cloth)).toBe(true);
    // Dark cloth: darker than the glass in every channel.
    expect(cloth[0] + cloth[1] + cloth[2]).toBeLessThan(glass[0] + glass[1] + glass[2]);
    // A Dining Room's table stands in the middle of the floor (the front door is the Living
    // Room's, below it): its north face is in view, and the drapes hang across the middle of it.
    const dining = (f?: FixtureId) =>
      model([
        ['diningRoom', 2, 2, 0, f],
        ['livingRoom', 2, 4, 1],
      ]);
    const face = 2 * CELL + WALL.out + 3;
    expect(
      differs(
        pixel(paintFloors(dining(), atlas, { shadow: false })!, 3 * CELL, face),
        pixel(paintFloors(dining('blackoutCurtains'), atlas, { shadow: false })!, 3 * CELL, face),
      ),
    ).toBe(true);
  });

  it('a Skylight lights a patch over the room, in four panes', () => {
    const m = model([['bedroom', 2, 2, 0, 'skylight']]);
    const p = paintWalls(m)!;
    const lit = pixel(p, 3 * CELL - 6, 3 * CELL + 2);
    expect(lit[3]).toBeGreaterThan(0);
    expect(lit[3]).toBeLessThan(255);
    // The frame's shadow between the panes is left unlit.
    let unlit = 0;
    for (let y = 2 * CELL + 20; y < 4 * CELL - 10; y++)
      if (pixel(p, 3 * CELL + 4, y)[3] === 0) unlit++;
    expect(unlit).toBeGreaterThan(0);
  });

  it('a Chandelier hangs over its room in its own light', () => {
    const m = model([['diningRoom', 2, 2, 0, 'chandelier']]);
    const r = m.rooms.get(1)!;
    const at = chandelierAt(m, r);
    const p = paintWalls(m)!;
    // Its chain is ink at its top middle; it hangs over the room's floor.
    expect(pixel(p, at.x + 7, at.y)).toEqual([...INK, 255]);
    expect(at.x).toBeGreaterThan(r.box.x + WALL.out);
    expect(at.x + at.w).toBeLessThan(r.box.x + r.box.w - WALL.out);
    expect(pixel(p, at.x - 2, at.y + at.h - 2)[3]).toBeGreaterThan(0);
  });

  it('a Bay Window is a cell of glass in an outside wall, with its bay outside', () => {
    const m = model([['livingRoom', 3, 2, 0, 'bayWindow']]);
    const bay = m.windows.find((w) => w.bay)!;
    expect(bay.side).toBe('S');
    expect(bay.rect.w).toBe(CELL - 2 * WALL.bayMargin);
    const p = paintWalls(m)!;
    const out = bay.bay!;
    expect(out.y).toBe(bay.rect.y + bay.rect.h);
    // Ink on its far side, glass inside it.
    expect(pixel(p, out.x + 4, out.y + out.h - 1)).toEqual([...INK, 255]);
    const glass = pixel(p, out.x + 4, out.y + 1);
    expect(differs(glass, [...INK, 255])).toBe(true);
    expect(glass[3]).toBe(255);
    // No other window crowds it.
    expect(m.windows.filter((w) => w.side === 'S' && overlapsX(w.rect, bay.rect)).length).toBe(1);
  });
});

function overlapsX(a: { x: number; w: number }, b: { x: number; w: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w;
}

describe('the yard’s ground on the floor canvas', () => {
  function houseOf(specs: readonly (readonly [PieceId, number, number, Rot?, FixtureId?])[]) {
    const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0, fixture], i) => ({
      uid: i + 1,
      defId,
      x,
      y,
      rot,
      placedWeek: 0,
      ...(fixture ? { fixture: { id: fixture, week: 0 } } : {}),
    }));
    const house: HouseState = {
      lot: lotFromRows(Array.from({ length: 10 }, () => '.'.repeat(10))),
      pieces,
      nextUid: pieces.length + 1,
    };
    const m = houseModel(house);
    return { m, yard: yardModel(house, m) };
  }

  it('lays a Patio’s pavers, and the house’s shadow falls on them', () => {
    const { m, yard } = houseOf([
      ['bedroom', 2, 2],
      ['patio', 4, 2],
    ]);
    const p = paintFloors(m, atlas, { yard })!;
    // Away from the house, the pavers as they are.
    expect(pixel(p, 5 * CELL + 10, 3 * CELL + 10)).toEqual(sprite('yard-pavers', 10, 10));
    // In the house's shadow, darker but still the pavers (blended, not replaced).
    const lit = sprite('yard-pavers', 1, 10);
    const shaded = pixel(p, 4 * CELL + 1, 3 * CELL + 10);
    expect(shaded[3]).toBe(255);
    expect(shaded.slice(0, 3).reduce((a, b) => a + b)).toBeLessThan(
      lit.slice(0, 3).reduce((a, b) => a + b),
    );
  });

  it('cuts the curb: a Driveway’s concrete runs through the street row', () => {
    const { m, yard } = houseOf([['driveway', 4, 7, 1]]);
    const p = paintFloors(m, atlas, { yard })!;
    expect(pixel(p, 4 * CELL + 10, 10 * CELL + 10)).toEqual(sprite('yard-concrete', 10, 10));
    // Just the one cell of sidewalk under it.
    expect([p.x, p.w]).toEqual([4 * CELL, CELL]);
    expect(p.y + p.h).toBe(11 * CELL);
  });

  it('keeps a piece’s light on its own cells', () => {
    const { m, yard } = houseOf([['flowerBed', 4, 4, 0, 'gardenLights']]);
    const p = paintFloors(m, atlas, { yard })!;
    for (let x = p.x; x < p.x + p.w; x++) {
      for (let y = p.y; y < p.y + p.h; y++) {
        const inside = x >= 4 * CELL && x < 5 * CELL && y >= 4 * CELL && y < 5 * CELL;
        if (!inside) expect(pixel(p, x, y)[3]).toBe(0);
      }
    }
  });

  it('paints a yard piece’s ghost with what rises above its cells', () => {
    const l = yardPieceLayout('greenhouse', 0);
    const p = paintYardPiece(l, atlas);
    expect(p.y).toBeLessThan(0);
    expect(p.y + p.h).toBe(2 * CELL);
    // The glass greenhouse is drawn: some pixels above the footprint are set.
    let set = 0;
    for (let x = p.x; x < p.x + p.w; x++) if (pixel(p, x, p.y + 4)[3] > 0) set++;
    expect(set).toBeGreaterThan(0);
  });
});
