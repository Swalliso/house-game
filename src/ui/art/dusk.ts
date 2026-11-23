// S12 (D-218): the finished house at dusk. Stage 1 is a still beside the same house by day
// (docs/playtests/dusk-mockup.png), painted by paintPhoto's `dusk` option; nothing in the game
// shows it yet. Pure: no DOM.
//
// - The evening: every lot pixel that isn't the house's own (houseMask: its rooms' cells, the
//   walls and bays, and the rooms' furniture where it's in view, never a yard piece's) is
//   multiplied by the palette's periwinkle with a cast of its royal blue, all of it alike (one
//   step of light, not a ramp): the ground, the water, the street, the yard's pieces and the
//   trees' crowns.
// - The rooms keep their daylight, less the sun (paintPhoto builds the dusk house without D-120's
//   sunny bands), and each lit room gains a warm pool on its floor, in pixel light's three steps,
//   as the lamps' light has (D-181).
// - A lit room's windows glow: the glass turns the palette's palest yellow, and warm light spills
//   on the ground outside each one, widening as it goes, in three steps. Blackout Curtains keep a
//   room's windows dark. A room with no windows (a Closet, a Hallway, the Garage) has the pool
//   alone.
// - The yard's own lights keep theirs: a Fire Pit's fire and Garden Lights' bollards stay as they
//   are by day, each with a glow on the ground round its foot.

import type { HouseState } from '../../rules/index.ts';
import {
  hasFace,
  inset,
  roomAt,
  WALL,
  type HouseModel,
  type Rect,
  type Room,
  type WindowPane,
} from '../board/house-model.ts';
import { CELL } from '../sprites.ts';
import { artSize } from './drawings.ts';
import {
  drawnAt,
  floorBox,
  GLASS,
  GLINT,
  housePieces,
  Mask,
  wallMask,
  type AtlasPixels,
  type Canvas,
} from './house-paint.ts';
import { itemRows, type Item } from './rooms.ts';
import type { YardModel } from './yard.ts';

type Rgb = readonly [number, number, number];

/**
 * The dusk's colors, all LimeZu's (palette.ts). The evening multiplies everything outside the
 * house by the palette's periwinkle and lays its royal blue over that at `cast`: the yard comes out
 * about half as bright, its greens teal and its water deep blue, keeping their contrast. (A mix
 * toward a dark blue at the same strength greyed the lot, a violet browned the grass, and the
 * multiply alone left the dry and autumn lots grey-brown.) The rooms' warm light is the palette's
 * gold, as a pool on each floor (`reach` of the way to its walls; `alpha` in the middle, then pixel
 * light's steps); the spill is its pale yellow outside each window, `depth` px out, a px wider
 * each side every `widen` px. The lit glass is the palette's palest yellow, its glints white.
 */
export const DUSK = {
  evening: [0x78, 0x7d, 0xbf] as Rgb,
  cast: { rgb: [0x3d, 0x56, 0xd2] as Rgb, alpha: 0.1 },
  pool: { rgb: [0xf2, 0xb2, 0x2b] as Rgb, alpha: 0.28, reach: 0.8 },
  spill: { rgb: [0xff, 0xe5, 0x7b] as Rgb, alpha: 0.45, depth: 10, widen: 3 },
  glass: [0xff, 0xf5, 0x9a] as Rgb,
  glint: [0xfe, 0xfc, 0xfe] as Rgb,
} as const;

/**
 * The yard's lights (yard.ts), by sprite: they keep their light at dusk, with a glow on the
 * ground round them, its middle `at` px from the sprite's top-left (a Fire Pit's hearth, a
 * bollard's foot, where yard.ts lays their ground). The fire's is the palette's orange, the
 * bollards' its pale yellow.
 */
export const YARD_LIGHTS: Readonly<
  Record<string, { at: readonly [number, number]; rgb: Rgb; alpha: number; rx: number; ry: number }>
> = {
  'fire-pit': { at: [8, 28], rgb: [0xed, 0x93, 0x1e], alpha: 0.5, rx: 24, ry: 12 },
  bollard: { at: [4, 20], rgb: [0xff, 0xe5, 0x7b], alpha: 0.45, rx: 12, ry: 7 },
};

/** Pixel light's three steps (the glow painters' rule): full in the middle, two thirds, a third. */
export function step(d: number): number {
  return d < 0.3 ? 1 : d < 0.65 ? 0.66 : 0.33;
}

/** A color at dusk: multiplied by the evening, then its cast over that (DUSK). */
export function duskColor(r: number, g: number, b: number): [number, number, number] {
  const { evening: e, cast } = DUSK;
  const one = (c: number, i: number) => {
    const m = (c * e[i]!) / 255;
    return Math.round(m + (cast.rgb[i]! - m) * cast.alpha);
  };
  return [one(r, 0), one(g, 1), one(b, 2)];
}

/** Takes every pixel with any alpha in RGBA `px` to dusk, in place, where `keep` doesn't hold it. */
export function duskPixels(px: Uint8ClampedArray, keep?: (i: number) => boolean): void {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0 || keep?.(i / 4)) continue;
    const [r, g, b] = duskColor(px[i]!, px[i + 1]!, px[i + 2]!);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
}

/** Marks the pixels item `it` draws in its rows `part` (itemRows) as the house's (`on`) or not. */
function markItem(
  mask: Mask,
  atlas: AtlasPixels,
  it: Item,
  part: 'top' | 'bottom',
  on: boolean,
): void {
  const rows = itemRows(it)[part];
  if (!rows) return;
  const { w } = artSize(it.sprite);
  for (let y = it.y + rows[0]; y < it.y + rows[1]; y++) {
    for (let x = it.x; x < it.x + w; x++) {
      if (drawnAt(atlas, it, x, y)) mask.rect({ x, y, w: 1, h: 1 }, on);
    }
  }
}

/**
 * The lot pixels in `box` that keep their light at dusk: the house's own, its rooms' cells (the
 * floors, and the outside walls, whose bands are inside them, D-097), the bays, and every room's
 * furniture where it's in view; and the yard's lights (YARD_LIGHTS). Stacked as the photos paint
 * them (housePieces): a yard piece's prop in front of a room (a Treehouse's deck rising over its
 * south wall) is the yard's, and a room's bookcase rising over its north wall is the house's.
 */
export function houseMask(
  house: HouseState,
  m: HouseModel,
  yard: YardModel,
  atlas: AtlasPixels,
  box: Rect,
): Mask {
  const mask = new Mask(box);
  for (const r of m.rooms.values()) {
    for (const c of r.cells) mask.rect({ x: c.x * CELL, y: c.y * CELL, w: CELL, h: CELL }, true);
  }
  const pieces = housePieces(house, m, yard);
  const keeps = (room: boolean, it: Item) => room || YARD_LIGHTS[it.sprite] !== undefined;
  for (const p of pieces) {
    for (const it of p.items) markItem(mask, atlas, it, 'bottom', keeps(p.room, it));
  }
  wallMask(m, box).forEach((px, py) => mask.rect({ x: px, y: py, w: 1, h: 1 }, true));
  for (const w of m.windows) if (w.bay) mask.rect(w.bay, true);
  for (const p of pieces) {
    for (const it of p.items) markItem(mask, atlas, it, 'top', keeps(p.room, it));
  }
  return mask;
}

/** Whether lot pixel (px, py) is room `uid`'s floor: its own cells inside the walls and below the north faces. */
function onFloor(m: HouseModel, uid: number, walls: Mask, px: number, py: number): boolean {
  const cx = Math.floor(px / CELL);
  const cy = Math.floor(py / CELL);
  if (roomAt(m, cx, cy) !== uid || walls.has(px, py)) return false;
  const lx = px - cx * CELL;
  const ly = py - cy * CELL;
  return (
    lx >= inset(m, cx, cy, 'W') &&
    lx < CELL - inset(m, cx, cy, 'E') &&
    ly >= inset(m, cx, cy, 'N') + (hasFace(m, cx, cy) ? WALL.face : 0) &&
    ly < CELL - inset(m, cx, cy, 'S')
  );
}

/** A lit room's warm pool: an oval over the middle of its floor, in three steps, on its floor alone. */
function pool(cv: Canvas, m: HouseModel, r: Room, walls: Mask): void {
  const f = floorBox(m, r);
  const { rgb, alpha } = DUSK.pool;
  const cx = f.x + f.w / 2;
  const cy = f.y + f.h / 2;
  const rx = (f.w / 2) * DUSK.pool.reach;
  const ry = (f.h / 2) * DUSK.pool.reach;
  for (let y = f.y; y < f.y + f.h; y++) {
    for (let x = f.x; x < f.x + f.w; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d >= 1 || !onFloor(m, r.uid, walls, x, y)) continue;
      cv.blend(x, y, rgb, alpha * step(d));
    }
  }
}

/**
 * A lit window's spill on the ground outside it, past its bay if it has one: as wide as the glass
 * at the wall, a px wider each side every `widen` px out, `depth` deep, in pixel light's three
 * steps by distance. Only where the house isn't (`house`), so it never falls on another room.
 */
function spill(cv: Canvas, w: WindowPane, house: Mask): void {
  const { rgb, alpha, depth, widen } = DUSK.spill;
  const flat = w.side === 'N' || w.side === 'S';
  const g = w.bay ?? w.rect;
  // The glass's span along the wall, inside its ink frame, and where the outside begins.
  const a0 = (flat ? w.rect.x : w.rect.y) + 1;
  const a1 = (flat ? w.rect.x + w.rect.w : w.rect.y + w.rect.h) - 1;
  for (let d = 0; d < depth; d++) {
    const grow = Math.floor(d / widen);
    const k = step(d / depth);
    for (let a = a0 - grow; a < a1 + grow; a++) {
      const [x, y] =
        w.side === 'S'
          ? [a, g.y + g.h + d]
          : w.side === 'N'
            ? [a, g.y - 1 - d]
            : w.side === 'E'
              ? [g.x + g.w + d, a]
              : [g.x - 1 - d, a];
      if (house.has(x, y)) continue;
      cv.blend(x, y, rgb, alpha * k);
    }
  }
}

/** A lit window's glass, and a bay's: the glass the palette's pale yellow, its glints white. */
function litGlass(cv: Canvas, w: WindowPane): void {
  for (const r of w.bay ? [w.rect, w.bay] : [w.rect]) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = cv.at(x, y);
        if (i < 0) continue;
        const d = cv.data;
        const is = (c: Rgb) => d[i] === c[0] && d[i + 1] === c[1] && d[i + 2] === c[2];
        if (is(GLASS)) cv.set(x, y, DUSK.glass);
        else if (is(GLINT)) cv.set(x, y, DUSK.glint);
      }
    }
  }
}

/** A yard light's glow round its foot, in pixel light's three steps, where nothing keeps its own light. */
function yardGlow(cv: Canvas, it: Item, keep: Mask): void {
  const l = YARD_LIGHTS[it.sprite];
  if (!l) return;
  const cx = it.x + l.at[0];
  const cy = it.y + l.at[1];
  for (let y = Math.floor(cy - l.ry); y <= Math.ceil(cy + l.ry); y++) {
    for (let x = Math.floor(cx - l.rx); x <= Math.ceil(cx + l.rx); x++) {
      const d = ((x + 0.5 - cx) / l.rx) ** 2 + ((y + 0.5 - cy) / l.ry) ** 2;
      if (d >= 1 || keep.has(x, y)) continue;
      cv.blend(x, y, l.rgb, l.alpha * step(d));
    }
  }
}

/**
 * The house at dusk, over a picture of it by day without the sun (`cv`, paintPhoto's): the evening
 * on everything that doesn't keep its light (houseMask), the yard's lights' glow, then each room
 * of `lit` with its warm pool, its windows' glass lit and their spill on the ground outside. The
 * trees' crowns, painted after, take the evening through duskPixels.
 */
export function paintDusk(
  cv: Canvas,
  house: HouseState,
  m: HouseModel,
  yard: YardModel,
  atlas: AtlasPixels,
  lit: ReadonlySet<number>,
): void {
  const own = houseMask(house, m, yard, atlas, cv);
  const bits = own.bits;
  duskPixels(cv.data, (i) => bits[i] === 1);
  for (const p of yard.pieces.values()) for (const it of p.items) yardGlow(cv, it, own);
  const walls = wallMask(m, cv);
  for (const r of m.rooms.values()) if (lit.has(r.uid)) pool(cv, m, r, walls);
  for (const w of m.windows) {
    if (!lit.has(w.uid) || m.rooms.get(w.uid)?.fixture === 'blackoutCurtains') continue;
    litGlass(cv, w);
    spill(cv, w, own);
  }
}
