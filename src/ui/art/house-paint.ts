// The house's two canvases (D-097), painted as pixels: the browser only puts them, and tests
// and offline renders read the same pixels. Pure: no DOM.
//
// - The floor canvas, under the furniture: each room's floor, short north wall faces in the
//   room's wallpaper, the floor's shadows under them and beside west walls, and the house's
//   soft shadow on the lot.
// - The walls canvas, over the furniture: LimeZu-style bands drawn from a pixel mask (its
//   outline color where the mask meets anything else, a white fill inside), heavier outside
//   than between rooms, with door gaps the floor runs through, window glass, garage door rails
//   and doormats. Furniture tucks under the bands and never spills into the next room.
//
// Both cover the house's bounding box plus a margin; `x` and `y` place them on the lot, in art px.

import {
  EDGE,
  WALL,
  edge,
  hasFace,
  inset,
  roomAt,
  type HouseModel,
  type Rect,
} from '../board/house-model.ts';
import { CELL, PIECE_SPRITES, spritePos, type SpriteId } from '../sprites.ts';
import type { PieceId } from '../../rules/index.ts';
import type { Item } from './rooms.ts';

/** RGBA pixels (not premultiplied, like ImageData) at (x, y) on the lot, in art px. */
export interface Pixels {
  x: number;
  y: number;
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** The sprite atlas's pixels. */
export interface AtlasPixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

type Rgb = readonly [number, number, number];

/** LimeZu's outline color, the ink of every wall (D-097). */
export const INK: Rgb = [0x3a, 0x3a, 0x50];
/** The wall band's fill. */
export const BAND: Rgb = [0xf8, 0xf8, 0xf8];
const GLASS: Rgb = [0xa9, 0xd8, 0xe8];
const GLINT: Rgb = [0xe2, 0xf4, 0xfa];
const MULLION: Rgb = [0x78, 0x96, 0xaa];
const RAIL: Rgb = [0xc6, 0xc8, 0xd0];
const RAIL_LINE: Rgb = [0x9a, 0x9c, 0xa8];
const MAT: Rgb = [0x96, 0x62, 0x40];
const MAT_EDGE: Rgb = [0x5c, 0x3a, 0x2c];
const MAT_LINE: Rgb = [0xb0, 0x7c, 0x54];

/** The house's shadow on the lot: light from the top-left (D-057). */
export const HOUSE_SHADOW = { dx: 3, dy: 4, rgb: [0x14, 0x24, 0x18] as Rgb, alpha: 0.3 } as const;
/** The floor's shadows under north faces and beside west walls. */
const FLOOR_SHADOW = { rgb: [0, 0, 0] as Rgb, alpha: 0.13 } as const;
/** A doorway's threshold line, over either room's floor. */
const THRESHOLD = { rgb: INK, alpha: 0.32 } as const;

type RoomId = Extract<
  PieceId,
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'lKitchen'
  | 'diningRoom'
  | 'livingRoom'
  | 'closet'
  | 'hallway'
  | 'longHallway'
  | 'garage'
  | 'homeOffice'
  | 'playroom'
  | 'library'
  | 'mudroom'
  | 'sunroom'
>;

/** Each room type's north wall face, in its own wallpaper (the two kitchens and the two halls share one). */
export const FACE: Readonly<Record<RoomId, SpriteId>> = {
  bedroom: 'face-bedroom',
  bathroom: 'face-bathroom',
  kitchen: 'face-kitchen',
  lKitchen: 'face-kitchen',
  diningRoom: 'face-dining-room',
  livingRoom: 'face-living-room',
  closet: 'face-closet',
  hallway: 'face-hallway',
  longHallway: 'face-hallway',
  garage: 'face-garage',
  homeOffice: 'face-home-office',
  playroom: 'face-playroom',
  library: 'face-library',
  mudroom: 'face-mudroom',
  sunroom: 'face-sunroom',
};

function faceOf(id: PieceId): SpriteId {
  return (FACE as Partial<Record<PieceId, SpriteId>>)[id] ?? 'face-hallway';
}

/** A box of lot pixels being painted. */
class Canvas {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;
  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  /** The index of lot pixel (px, py), or -1 off the canvas. */
  at(px: number, py: number): number {
    const x = px - this.x;
    const y = py - this.y;
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : (y * this.w + x) * 4;
  }

  set(px: number, py: number, rgb: Rgb, alpha = 255): void {
    const i = this.at(px, py);
    if (i < 0) return;
    this.data[i] = rgb[0];
    this.data[i + 1] = rgb[1];
    this.data[i + 2] = rgb[2];
    this.data[i + 3] = alpha;
  }

  /** Paints a color over what's there ("source over"). */
  blend(px: number, py: number, rgb: Rgb, alpha: number): void {
    const i = this.at(px, py);
    if (i < 0) return;
    const d = this.data;
    const da = d[i + 3]! / 255;
    const out = alpha + da * (1 - alpha);
    if (out <= 0) return;
    for (let c = 0; c < 3; c++) d[i + c] = (rgb[c]! * alpha + d[i + c]! * da * (1 - alpha)) / out;
    d[i + 3] = out * 255;
  }

  /** Copies part of an atlas sprite to lot pixel (px, py), over what's there. */
  blit(atlas: AtlasPixels, id: SpriteId, px: number, py: number, src?: Rect): void {
    const s = spritePos(id);
    const r = src ?? { x: 0, y: 0, w: s.w, h: s.h };
    const a = atlas.data;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const si = ((s.y + r.y + y) * atlas.width + s.x + r.x + x) * 4;
        const alpha = a[si + 3]!;
        if (alpha === 0) continue;
        const rgb: Rgb = [a[si]!, a[si + 1]!, a[si + 2]!];
        if (alpha === 255) this.set(px + x, py + y, rgb);
        else this.blend(px + x, py + y, rgb, alpha / 255);
      }
    }
  }

  /** Paints other pixels over these, where they overlap. */
  over(p: Pixels): void {
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const si = (y * p.w + x) * 4;
        const a = p.data[si + 3]!;
        if (a === 0) continue;
        const rgb: Rgb = [p.data[si]!, p.data[si + 1]!, p.data[si + 2]!];
        if (a === 255) this.set(p.x + x, p.y + y, rgb);
        else this.blend(p.x + x, p.y + y, rgb, a / 255);
      }
    }
  }

  pixels(): Pixels {
    return { x: this.x, y: this.y, w: this.w, h: this.h, data: this.data };
  }
}

/** A set of lot pixels, as a mask over a canvas's box. */
export class Mask {
  readonly c: { x: number; y: number; w: number; h: number };
  readonly bits: Uint8Array;
  constructor(box: { x: number; y: number; w: number; h: number }) {
    this.c = { x: box.x, y: box.y, w: box.w, h: box.h };
    this.bits = new Uint8Array(box.w * box.h);
  }
  private index(px: number, py: number): number {
    const x = px - this.c.x;
    const y = py - this.c.y;
    return x < 0 || y < 0 || x >= this.c.w || y >= this.c.h ? -1 : y * this.c.w + x;
  }
  has(px: number, py: number): boolean {
    const i = this.index(px, py);
    return i >= 0 && this.bits[i] === 1;
  }
  rect(r: Rect, on: boolean): void {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = this.index(x, y);
        if (i >= 0) this.bits[i] = on ? 1 : 0;
      }
    }
  }
  forEach(fn: (px: number, py: number) => void): void {
    for (let y = 0; y < this.c.h; y++) {
      for (let x = 0; x < this.c.w; x++)
        if (this.bits[y * this.c.w + x]) fn(this.c.x + x, this.c.y + y);
    }
  }
}

/** The x ranges of a cell's north face that are door gaps: the floor runs through them. */
function faceGaps(m: HouseModel, x: number, y: number): [number, number][] {
  const X0 = x * CELL;
  const Y0 = y * CELL;
  const out: [number, number][] = [];
  const cut = (g: Rect) => {
    if (g.x < X0 + CELL && g.x + g.w > X0)
      out.push([Math.max(X0, g.x), Math.min(X0 + CELL, g.x + g.w)]);
  };
  for (const d of m.doors) {
    if (d.dir === 'h' && d.gap.y + d.gap.h / 2 === Y0) cut(d.gap);
  }
  for (const e of m.exits) {
    if (e.side === 'N' && e.cell.x === x && e.cell.y === y) cut(e.gap);
  }
  return out;
}

/** [from, to) minus the gaps (inside it), as runs. */
function without(from: number, to: number, gaps: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let x = from;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > x) out.push([x, g0]);
    x = Math.max(x, g1);
  }
  if (x < to) out.push([x, to]);
  return out;
}

/**
 * The floor canvas's pixels: floors, north wall faces, floor shadows, and (with `shadow`) the
 * house's shadow on the lot. Null with no rooms.
 */
export function paintFloors(
  m: HouseModel,
  atlas: AtlasPixels,
  { shadow = true }: { shadow?: boolean } = {},
): Pixels | null {
  const b = m.bounds;
  if (!b) return null;
  const sx = shadow ? HOUSE_SHADOW.dx : 0;
  const sy = shadow ? HOUSE_SHADOW.dy : 0;
  const cv = new Canvas(b.x * CELL, b.y * CELL, b.w * CELL + sx, b.h * CELL + sy);
  const indoorPx = (px: number, py: number) =>
    roomAt(m, Math.floor(px / CELL), Math.floor(py / CELL)) !== 0;

  // The house's shadow: off its cells, where the house shifted down and right would be. (Yard
  // ground painted here goes first, so the house's shadow falls on it.)
  if (shadow) {
    for (let py = cv.y; py < cv.y + cv.h; py++) {
      for (let px = cv.x; px < cv.x + cv.w; px++) {
        if (!indoorPx(px, py) && indoorPx(px - sx, py - sy)) {
          cv.set(px, py, HOUSE_SHADOW.rgb, Math.round(HOUSE_SHADOW.alpha * 255));
        }
      }
    }
  }

  const shade = new Mask(cv);
  for (const r of m.rooms.values()) {
    const floor = PIECE_SPRITES[r.defId].floor;
    const face = faceOf(r.defId);
    for (const c of r.cells) {
      const X0 = c.x * CELL;
      const Y0 = c.y * CELL;
      cv.blit(atlas, floor, X0, Y0);
      let top = Y0 + inset(m, c.x, c.y, 'N');
      if (hasFace(m, c.x, c.y)) {
        for (const [a, z] of without(X0, X0 + CELL, faceGaps(m, c.x, c.y))) {
          cv.blit(atlas, face, a, top, { x: a - X0, y: 0, w: z - a, h: WALL.face });
          shade.rect({ x: a, y: top + WALL.face, w: z - a, h: WALL.shadow }, true);
        }
        top += WALL.face;
      }
      const west = edge(m, c.x, c.y, 'W');
      if (west === EDGE.inner || west === EDGE.outer) {
        const x = X0 + inset(m, c.x, c.y, 'W');
        shade.rect({ x, y: top, w: WALL.shadow, h: Y0 + CELL - top }, true);
      }
    }
  }
  // No shadow in a doorway: the wall isn't there.
  for (const d of m.doors) {
    if (d.dir === 'v')
      shade.rect({ x: d.gap.x, y: d.gap.y, w: d.gap.w + WALL.shadow + 2, h: d.gap.h }, false);
  }
  for (const e of m.exits) {
    if (e.side === 'W')
      shade.rect({ x: e.gap.x, y: e.gap.y, w: e.gap.w + WALL.shadow, h: e.gap.h }, false);
  }
  shade.forEach((px, py) => cv.blend(px, py, FLOOR_SHADOW.rgb, FLOOR_SHADOW.alpha));
  return cv.pixels();
}

/** The wall bands as a mask: outside walls inside their rooms, walls between rooms straddling the line. */
export function wallMask(m: HouseModel, box: { x: number; y: number; w: number; h: number }): Mask {
  const mask = new Mask(box);
  const half = WALL.in / 2;
  const out = WALL.out;
  for (const r of m.rooms.values()) {
    for (const c of r.cells) {
      const X0 = c.x * CELL;
      const Y0 = c.y * CELL;
      for (const s of ['N', 'E', 'S', 'W'] as const) {
        const k = edge(m, c.x, c.y, s);
        if (k !== EDGE.inner && k !== EDGE.outer) continue;
        const t = k === EDGE.outer ? out : half;
        mask.rect(
          s === 'N'
            ? { x: X0, y: Y0, w: CELL, h: t }
            : s === 'S'
              ? { x: X0, y: Y0 + CELL - t, w: CELL, h: t }
              : s === 'W'
                ? { x: X0, y: Y0, w: t, h: CELL }
                : { x: X0 + CELL - t, y: Y0, w: t, h: CELL },
          true,
        );
      }
      // A concave corner of the house: the outside wall turns inside this cell.
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        if (roomAt(m, c.x + dx, c.y + dy) !== 0) continue;
        const sideA = dy < 0 ? 'N' : 'S';
        const sideB = dx < 0 ? 'W' : 'E';
        if (roomAt(m, c.x + dx, c.y) === 0 || roomAt(m, c.x, c.y + dy) === 0) continue;
        if (edge(m, c.x + dx, c.y, sideA) !== EDGE.outer) continue;
        if (edge(m, c.x, c.y + dy, sideB) !== EDGE.outer) continue;
        mask.rect(
          {
            x: dx < 0 ? X0 : X0 + CELL - out,
            y: dy < 0 ? Y0 : Y0 + CELL - out,
            w: out,
            h: out,
          },
          true,
        );
      }
    }
  }
  for (const d of m.doors) mask.rect(d.gap, false);
  for (const e of m.exits) mask.rect(e.gap, false);
  return mask;
}

/** Margin around the house for doormats. */
const MARGIN = WALL.mat + 2;

/** The walls canvas's pixels. Null with no rooms. */
export function paintWalls(m: HouseModel): Pixels | null {
  const b = m.bounds;
  if (!b) return null;
  const cv = new Canvas(
    b.x * CELL - MARGIN,
    b.y * CELL - MARGIN,
    b.w * CELL + 2 * MARGIN,
    b.h * CELL + 2 * MARGIN,
  );
  const mask = wallMask(m, cv);
  mask.forEach((px, py) => {
    const edgePx =
      !mask.has(px - 1, py) ||
      !mask.has(px + 1, py) ||
      !mask.has(px, py - 1) ||
      !mask.has(px, py + 1);
    cv.set(px, py, edgePx ? INK : BAND);
  });

  // Windows: glass across the band, framed in ink, with a mullion and a few glints.
  for (const w of m.windows) {
    const flat = w.side === 'N' || w.side === 'S';
    const { x, y, w: rw, h: rh } = w.rect;
    const along = flat ? rw : rh;
    const across = flat ? rh : rw;
    for (let j = 0; j < rh; j++) {
      for (let i = 0; i < rw; i++) {
        if (!mask.has(x + i, y + j)) continue;
        const a = flat ? i : j;
        const c = flat ? j : i;
        const color =
          a === 0 || a === along - 1 || c === 0 || c === across - 1
            ? INK
            : a === Math.floor(along / 2)
              ? MULLION
              : (a + c) % 5 === 1
                ? GLINT
                : GLASS;
        cv.set(x + i, y + j, color);
      }
    }
  }

  // Garage doors: a rail where the band would be, its slats across it.
  for (const g of m.garageDoors) {
    const flat = g.side === 'N' || g.side === 'S';
    const { x, y, w: rw, h: rh } = g.rail;
    const across = flat ? rh : rw;
    for (let j = 0; j < rh; j++) {
      for (let i = 0; i < rw; i++) {
        if (mask.has(x + i, y + j)) continue;
        const a = flat ? i : j;
        const c = flat ? j : i;
        const end =
          mask.has(x + i + (flat ? -1 : 0), y + j + (flat ? 0 : -1)) ||
          mask.has(x + i + (flat ? 1 : 0), y + j + (flat ? 0 : 1));
        cv.set(
          x + i,
          y + j,
          c === 0 || c === across - 1 || end ? INK : a % 4 === 0 ? RAIL_LINE : RAIL,
        );
      }
    }
  }

  // Thresholds: a faint line along the boundary through each doorway, and at an outside door's sill.
  for (const d of m.doors) {
    if (d.dir === 'v') {
      const x = d.gap.x + d.gap.w / 2;
      for (let y = d.gap.y; y < d.gap.y + d.gap.h; y++)
        cv.blend(x, y, THRESHOLD.rgb, THRESHOLD.alpha);
    } else {
      const y = d.gap.y + d.gap.h / 2;
      for (let x = d.gap.x; x < d.gap.x + d.gap.w; x++)
        cv.blend(x, y, THRESHOLD.rgb, THRESHOLD.alpha);
    }
  }
  for (const e of m.exits) {
    const g = e.gap;
    const line =
      e.side === 'S' ? g.y + g.h - 1 : e.side === 'N' ? g.y : e.side === 'W' ? g.x : g.x + g.w - 1;
    if (e.side === 'N' || e.side === 'S') {
      for (let x = g.x; x < g.x + g.w; x++) cv.blend(x, line, THRESHOLD.rgb, THRESHOLD.alpha * 1.6);
    } else {
      for (let y = g.y; y < g.y + g.h; y++) cv.blend(line, y, THRESHOLD.rgb, THRESHOLD.alpha * 1.6);
    }
    // The doormat outside.
    const r = e.mat;
    const flat = e.side === 'N' || e.side === 'S';
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) {
        const rim = i === 0 || j === 0 || i === r.w - 1 || j === r.h - 1;
        const stripe = flat ? j === 2 && i > 1 && i < r.w - 2 : i === 2 && j > 1 && j < r.h - 2;
        cv.set(r.x + i, r.y + j, rim ? MAT_EDGE : stripe ? MAT_LINE : MAT);
      }
    }
  }
  return cv.pixels();
}

/**
 * One piece alone, for the ghost (pieceModel): its floor, its items, then its walls over them,
 * in one box the size of the piece. Null with no room.
 */
export function paintPiece(
  m: HouseModel,
  atlas: AtlasPixels,
  items: readonly Item[],
): Pixels | null {
  const b = m.bounds;
  if (!b) return null;
  const cv = new Canvas(b.x * CELL, b.y * CELL, b.w * CELL, b.h * CELL);
  const floors = paintFloors(m, atlas, { shadow: false });
  if (floors) cv.over(floors);
  for (const it of items) cv.blit(atlas, it.sprite, it.x, it.y);
  const walls = paintWalls(m);
  if (walls) cv.over(walls);
  return cv.pixels();
}
