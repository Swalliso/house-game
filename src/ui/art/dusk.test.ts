// S12 stage 1 (D-218): the house at dusk. The evening takes everything outside the house by one
// rule; the house keeps its own pixels (a yard piece's prop in front of a room is the yard's, a
// room's furniture over its north wall is the house's); a lit room's windows glow and spill light
// in pixel light's three steps; Blackout Curtains keep a room dark; a Fire Pit keeps its fire.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
import type { HouseState, PieceId, PlacedPiece, Rot } from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { houseModel, type HouseModel, type WindowPane } from '../board/house-model.ts';
import { paintHouse } from '../screens/photo-paint.ts';
import { CELL } from '../sprites.ts';
import { artSize } from './drawings.ts';
import { DUSK, YARD_LIGHTS, duskColor, houseMask, paintDusk } from './dusk.ts';
import {
  Canvas,
  GLASS,
  GLINT,
  drawnAt,
  paintFloors,
  wallMask,
  type AtlasPixels,
} from './house-paint.ts';
import { inPalette } from './palette.ts';
import { itemRows, roomItems } from './rooms.ts';
import { yardModel, type YardModel } from './yard.ts';

const png = decodePng(readFileSync(new URL('../../../assets/atlas.png', import.meta.url)), 'atlas');
const atlas: AtlasPixels = { width: png.width, height: png.height, data: png.rgba };

type Spec = readonly [PieceId, number, number, Rot?, Partial<PlacedPiece>?];

/** A house on an empty 12×12 lot: these pieces, uids from 1 in order. */
function house(specs: readonly Spec[]): HouseState {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0, more], i) => ({
    uid: i + 1,
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
    nextUid: pieces.length + 1,
  };
}

/** Plain grass under the house, so the evening's and the light's steps show as they are. */
const GRASS = [0x64, 0xb6, 0x3b] as const;

/** The house by day over plain grass, as paintPhoto paints it (without the terrain). */
function byDay(h: HouseState): { m: HouseModel; yard: YardModel; cv: Canvas } {
  const m = houseModel(h);
  const yard = yardModel(h, m);
  const cv = new Canvas(0, 0, 12 * CELL, 12 * CELL);
  for (let i = 0; i < cv.data.length; i += 4) cv.data.set([...GRASS, 255], i);
  const floors = paintFloors(m, atlas, { yard });
  if (floors) cv.over(floors);
  paintHouse(cv, h, m, yard, atlas);
  return { m, yard, cv };
}

function rgb(cv: Canvas, x: number, y: number): string {
  const i = cv.at(x, y);
  return [cv.data[i], cv.data[i + 1], cv.data[i + 2]].join();
}

const PLAIN = duskColor(...GRASS).join();

/** The pixels from the middle of window `w`'s glass straight out, `n` of them, past its bay. */
function outward(w: WindowPane, n: number): { x: number; y: number }[] {
  const g = w.bay ?? w.rect;
  const flat = w.side === 'N' || w.side === 'S';
  const a = flat
    ? w.rect.x + Math.floor(w.rect.w / 2) - 2
    : w.rect.y + Math.floor(w.rect.h / 2) - 2;
  return Array.from({ length: n }, (_, d) =>
    w.side === 'S'
      ? { x: a, y: g.y + g.h + d }
      : w.side === 'N'
        ? { x: a, y: g.y - 1 - d }
        : w.side === 'E'
          ? { x: g.x + g.w + d, y: a }
          : { x: g.x - 1 - d, y: a },
  );
}

describe('the house at dusk (D-218)', () => {
  it('paints in LimeZu’s colors', () => {
    const colors = [
      DUSK.evening,
      DUSK.cast.rgb,
      DUSK.pool.rgb,
      DUSK.spill.rgb,
      DUSK.glass,
      DUSK.glint,
      ...Object.values(YARD_LIGHTS).map((l) => l.rgb),
    ];
    for (const c of colors) expect(inPalette(c), c.join()).toBe(true);
  });

  it('takes everything outside the house to dusk by one rule, and leaves the house unlit as it was', () => {
    const h = house([
      ['bedroom', 3, 3],
      ['lawn', 3, 7],
    ]);
    const { m, yard, cv } = byDay(h);
    const before = new Canvas(cv.x, cv.y, cv.w, cv.h);
    before.data.set(cv.data);
    const own = houseMask(h, m, yard, atlas, cv);
    paintDusk(cv, h, m, yard, atlas, new Set());
    let outside = 0;
    for (let y = 0; y < cv.h; y++) {
      for (let x = 0; x < cv.w; x++) {
        const was = rgb(before, x, y).split(',').map(Number) as [number, number, number];
        if (own.has(x, y)) expect(rgb(cv, x, y)).toBe(was.join());
        else {
          expect(rgb(cv, x, y)).toBe(duskColor(...was).join());
          outside++;
        }
      }
    }
    expect(outside).toBeGreaterThan(cv.w * cv.h * 0.6);
  });

  it('keeps a room’s furniture over its north wall, and gives the yard a prop in front of a room', () => {
    // A Bedroom with its Bunk Beds rising over its north wall, and a Treehouse just south of it
    // whose deck rises into the Bedroom's southern cells (lights.test.ts has the same house).
    const h = house([
      ['bedroom', 3, 2, 0, { fixture: { id: 'bunkBeds', week: 1 }, level: 1 }],
      ['treehouse', 3, 4],
    ]);
    const m = houseModel(h);
    const yard = yardModel(h, m);
    const own = houseMask(h, m, yard, atlas, { x: 0, y: 0, w: 12 * CELL, h: 12 * CELL });
    const room = m.rooms.get(1)!;
    let over = 0;
    for (const it of roomItems(m, 1)) {
      const top = itemRows(it).top;
      if (!top) continue;
      for (let y = it.y + top[0]; y < it.y + top[1]; y++) {
        for (let x = it.x; x < it.x + artSize(it.sprite).w; x++) {
          if (!drawnAt(atlas, it, x, y)) continue;
          expect(own.has(x, y)).toBe(true);
          over++;
        }
      }
    }
    expect(over).toBeGreaterThan(0);
    let deck = 0;
    for (const it of yard.pieces.get(2)!.items) {
      const top = itemRows(it).top;
      if (!top) continue;
      for (let y = it.y + top[0]; y < it.y + top[1]; y++) {
        for (let x = it.x; x < it.x + artSize(it.sprite).w; x++) {
          if (!drawnAt(atlas, it, x, y)) continue;
          expect(own.has(x, y)).toBe(false);
          if (y < room.box.y + room.box.h) deck++;
        }
      }
    }
    expect(deck).toBeGreaterThan(50);
  });

  it('lights a room’s glass, and spills its light outside in three steps', () => {
    const h = house([['bedroom', 3, 3]]);
    const { m, yard, cv } = byDay(h);
    paintDusk(cv, h, m, yard, atlas, new Set([1]));
    const windows = m.windows.filter((w) => w.uid === 1);
    expect(windows.length).toBeGreaterThan(0);
    const glass = new Set([GLASS.join(), GLINT.join()]);
    for (const w of windows) {
      for (let y = w.rect.y; y < w.rect.y + w.rect.h; y++) {
        for (let x = w.rect.x; x < w.rect.x + w.rect.w; x++) {
          expect(glass.has(rgb(cv, x, y))).toBe(false);
        }
      }
      // Straight out from the glass: three steps of light, brightest at the wall, then the plain
      // evening past the spill's depth.
      const line = outward(w, DUSK.spill.depth + 3).map((p) => rgb(cv, p.x, p.y));
      const lit = line.slice(0, DUSK.spill.depth);
      expect(new Set(lit).size).toBe(3);
      expect(lit).not.toContain(PLAIN);
      expect(line.slice(DUSK.spill.depth)).toEqual([PLAIN, PLAIN, PLAIN]);
      const sum = (c: string) => c.split(',').reduce((a, b) => a + Number(b), 0);
      for (let d = 1; d < lit.length; d++)
        expect(sum(lit[d]!)).toBeLessThanOrEqual(sum(lit[d - 1]!));
    }
  });

  it('keeps the wall bands as they were, but for the lit glass', () => {
    const h = house([['livingRoom', 3, 3]]);
    const { m, yard, cv } = byDay(h);
    const before = new Canvas(cv.x, cv.y, cv.w, cv.h);
    before.data.set(cv.data);
    paintDusk(cv, h, m, yard, atlas, new Set([1]));
    const inGlass = (x: number, y: number) =>
      m.windows.some(
        (w) => x >= w.rect.x && x < w.rect.x + w.rect.w && y >= w.rect.y && y < w.rect.y + w.rect.h,
      );
    let band = 0;
    wallMask(m, cv).forEach((x, y) => {
      if (inGlass(x, y)) return;
      expect(rgb(cv, x, y)).toBe(rgb(before, x, y));
      band++;
    });
    expect(band).toBeGreaterThan(100);
  });

  it('keeps a room with Blackout Curtains dark outside', () => {
    const h = house([['bedroom', 3, 3, 0, { fixture: { id: 'blackoutCurtains', week: 1 } }]]);
    const lit = byDay(h);
    const dark = byDay(h);
    expect(lit.m.windows.some((w) => w.uid === 1)).toBe(true);
    const own = houseMask(h, lit.m, lit.yard, atlas, lit.cv);
    paintDusk(lit.cv, h, lit.m, lit.yard, atlas, new Set([1]));
    paintDusk(dark.cv, h, dark.m, dark.yard, atlas, new Set());
    let outside = 0;
    for (let y = 0; y < lit.cv.h; y++) {
      for (let x = 0; x < lit.cv.w; x++) {
        if (own.has(x, y)) continue;
        expect(rgb(lit.cv, x, y)).toBe(rgb(dark.cv, x, y));
        outside++;
      }
    }
    expect(outside).toBeGreaterThan(0);
  });

  it('keeps a Fire Pit’s fire lit, with a glow round it', () => {
    const h = house([['firePit', 5, 5]]);
    const { m, yard, cv } = byDay(h);
    const before = new Canvas(cv.x, cv.y, cv.w, cv.h);
    before.data.set(cv.data);
    paintDusk(cv, h, m, yard, atlas, new Set());
    const fire = yard.pieces.get(1)!.items.find((it) => it.sprite === 'fire-pit')!;
    expect(fire).toBeDefined();
    const { w, h: tall } = artSize(fire.sprite);
    let kept = 0;
    for (let y = fire.y; y < fire.y + tall; y++) {
      for (let x = fire.x; x < fire.x + w; x++) {
        if (!drawnAt(atlas, fire, x, y)) continue;
        expect(rgb(cv, x, y)).toBe(rgb(before, x, y));
        kept++;
      }
    }
    expect(kept).toBeGreaterThan(100);
    // Beside the fire, on its hearth's grass: warmer than the plain evening.
    const [ax, ay] = YARD_LIGHTS['fire-pit']!.at;
    const side = rgb(cv, fire.x + ax + 14, fire.y + ay)
      .split(',')
      .map(Number);
    const plain = PLAIN.split(',').map(Number);
    expect(side[0]!).toBeGreaterThan(plain[0]!);
  });
});
