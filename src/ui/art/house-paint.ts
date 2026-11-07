// The house's two canvases (D-097), painted as pixels: the browser only puts them, and tests
// and offline renders read the same pixels. Pure: no DOM.
//
// - The floor canvas, under the furniture and the yard's props: the yard's ground (yard.ts: lawns,
//   pavers, concrete and curb cuts, pools), the house's soft shadow on the lot and on that ground,
//   the doormats outside its doors, each room's floor, short north wall faces in the room's
//   wallpaper, and the floor's shadows under them and beside west walls.
// - The walls canvas, over the furniture: LimeZu-style bands drawn from a pixel mask (its
//   outline color where the mask meets anything else, a white fill inside), heavier outside
//   than between rooms, with door gaps the floor runs through, window glass and garage door
//   rails. Furniture tucks under the bands and never spills into the next room.
// - The fixtures that are part of a room rather than furniture (rooms.ts places the rest):
//   Soundproofing pads the north faces, Blackout Curtains hang on them and cover the windows, a
//   Skylight lights a patch of floor, a Chandelier hangs over the room with its glow on the
//   floor, and a Bay Window is a cell of glass with its bay outside. All our own drawings, in
//   LimeZu's palette and ink.
//
// Each covers what it paints (the house's bounding box plus a margin; the floor canvas also the
// yard's ground); `x` and `y` place them on the lot, in art px.

import {
  EDGE,
  WALL,
  edge,
  hasFace,
  inset,
  roomAt,
  type HouseModel,
  type Rect,
  type Room,
} from '../board/house-model.ts';
import { CELL, PIECE_SPRITES, spritePos, type SpriteId } from '../sprites.ts';
import type { PieceId } from '../../rules/index.ts';
import { artSize, drawingPixels, isDrawing, type ArtId } from './drawings.ts';
import type { Item } from './rooms.ts';
import type { Ground, YardLayout, YardModel } from './yard.ts';

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
/** Soundproofing's padded panels: a seam, the pad, its lit top and its shaded bottom. */
const PAD = {
  seam: [0x2f, 0x2f, 0x45] as Rgb,
  pad: [0x55, 0x55, 0x7a] as Rgb,
  lit: [0x6d, 0x6d, 0x94] as Rgb,
  shade: [0x46, 0x46, 0x68] as Rgb,
};
/** Blackout Curtains: heavy navy drapes in folds, on a wooden rod. */
const DRAPE = {
  cloth: [0x34, 0x35, 0x5c] as Rgb,
  dark: [0x24, 0x25, 0x44] as Rgb,
  lit: [0x48, 0x4a, 0x7c] as Rgb,
  rod: [0x7a, 0x56, 0x38] as Rgb,
};
/** A Skylight's patch of sun on the floor, and the Chandelier's warm glow. */
const SUN = { rgb: [0xff, 0xfb, 0xe8] as Rgb, alpha: 0.4 } as const;
const GLOW = { rgb: [0xff, 0xe2, 0x96] as Rgb, alpha: 0.2 } as const;

/**
 * The Chandelier, our own drawing (LimeZu has none): four candles on a gold ring with a crystal
 * drop, hung on a chain. k ink, G gold, g its shade, w wax, F and f the flames, c crystal.
 */
const CHANDELIER = [
  '.......k.......',
  '.......k.......',
  '.F...F.k.F...F.',
  '.f...f.k.f...f.',
  'kwk.kwkGkwk.kwk',
  'kGGGGGGGGGGGGGk',
  '.kgGgGgGgGgGgk.',
  '..kkgGGGGGgkk..',
  '....kkgGgkk....',
  '......kck......',
  '.......k.......',
] as const;
const CHANDELIER_INK: Readonly<Record<string, Rgb>> = {
  k: INK,
  G: [0xe8, 0xb2, 0x3c],
  g: [0xa8, 0x70, 0x1c],
  w: [0xf4, 0xea, 0xd0],
  F: [0xff, 0xe6, 0x80],
  f: [0xff, 0x9b, 0x3a],
  c: [0xcf, 0xee, 0xfa],
};

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
export class Canvas {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;
  /** While set, only the lot pixels it accepts are painted (a yard piece's own cells). */
  clip: ((px: number, py: number) => boolean) | null = null;
  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  /** The index of lot pixel (px, py), or -1 off the canvas (or outside the clip). */
  at(px: number, py: number): number {
    const x = px - this.x;
    const y = py - this.y;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.clip && !this.clip(px, py) ? -1 : (y * this.w + x) * 4;
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

  /**
   * Copies part of an atlas sprite, or of one of our drawings (an animation's first frame), to lot
   * pixel (px, py), over what's there.
   */
  blit(atlas: AtlasPixels, id: ArtId, px: number, py: number, src?: Rect): void {
    let s: Rect;
    let a: Uint8ClampedArray | Uint8Array;
    let width: number;
    if (isDrawing(id)) {
      const d = drawingPixels(id);
      s = { x: 0, y: 0, w: d.w, h: d.h };
      a = d.data;
      width = d.w * d.frames;
    } else {
      s = spritePos(id);
      a = atlas.data;
      width = atlas.width;
    }
    const r = src ?? { x: 0, y: 0, w: s.w, h: s.h };
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const si = ((s.y + r.y + y) * width + s.x + r.x + x) * 4;
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
 * Paints ground (yard.ts): sprites, rects of color, and ovals of color in three steps. With
 * `cells`, only on those cells: a yard piece's ground (a lamp's light, a wet patch) stays its own.
 */
export function paintGround(
  cv: Canvas,
  ops: readonly Ground[],
  atlas: AtlasPixels,
  cells?: readonly { x: number; y: number }[],
): void {
  if (cells) {
    const own = new Set(cells.map((c) => c.y * 4096 + c.x));
    cv.clip = (px, py) => own.has(Math.floor(py / CELL) * 4096 + Math.floor(px / CELL));
  }
  try {
    paintOps(cv, ops, atlas);
  } finally {
    cv.clip = null;
  }
}

function paintOps(cv: Canvas, ops: readonly Ground[], atlas: AtlasPixels): void {
  for (const g of ops) {
    if (g.op === 'sprite') {
      cv.blit(atlas, g.sprite, g.x, g.y, g.src);
    } else if (g.op === 'rect') {
      const { x, y, w, h } = g.rect;
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) cv.blend(i, j, g.rgb, g.alpha);
    } else {
      // Pixel light, not a smooth ramp: full strength in the middle, then two thirds, then a third.
      const { cx, cy, rx, ry } = g;
      for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) {
        for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
          const d = ((i + 0.5 - cx) / rx) ** 2 + ((j + 0.5 - cy) / ry) ** 2;
          if (d >= 1) continue;
          cv.blend(i, j, g.rgb, d < 0.3 ? g.alpha : d < 0.65 ? g.alpha * 0.66 : g.alpha * 0.33);
        }
      }
    }
  }
}

/** A doormat: a coir mat with a darker rim and a stripe along it. */
function doormat(cv: Canvas, r: Rect, flat: boolean): void {
  for (let j = 0; j < r.h; j++) {
    for (let i = 0; i < r.w; i++) {
      const rim = i === 0 || j === 0 || i === r.w - 1 || j === r.h - 1;
      const stripe = flat ? j === 2 && i > 1 && i < r.w - 2 : i === 2 && j > 1 && j < r.h - 2;
      cv.set(r.x + i, r.y + j, rim ? MAT_EDGE : stripe ? MAT_LINE : MAT);
    }
  }
}

/**
 * The floor canvas's pixels: the yard's ground (with `yard`), the house's shadow on the lot (with
 * `shadow`), the doormats, floors, north wall faces and floor shadows. Null when there's nothing.
 */
export function paintFloors(
  m: HouseModel,
  atlas: AtlasPixels,
  { shadow = true, yard }: { shadow?: boolean; yard?: YardModel } = {},
): Pixels | null {
  const b = m.bounds;
  const sx = shadow ? HOUSE_SHADOW.dx : 0;
  const sy = shadow ? HOUSE_SHADOW.dy : 0;
  // What it paints: the house and its shadow, the doormats outside it, the yard's ground.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (r: Rect) => {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  };
  if (b) add({ x: b.x * CELL, y: b.y * CELL, w: b.w * CELL + sx, h: b.h * CELL + sy });
  for (const e of m.exits) add(e.mat);
  const yb = yard?.bounds;
  if (yb) add({ x: yb.x * CELL, y: yb.y * CELL, w: yb.w * CELL, h: yb.h * CELL });
  if (x0 === Infinity) return null;
  const cv = new Canvas(x0, y0, x1 - x0, y1 - y0);
  const indoorPx = (px: number, py: number) =>
    roomAt(m, Math.floor(px / CELL), Math.floor(py / CELL)) !== 0;

  // The yard's ground first, so the house's shadow falls on it.
  if (yard) {
    for (const l of yard.pieces.values()) paintGround(cv, l.ground, atlas, l.cells);
    paintGround(cv, yard.curbs, atlas);
  }
  // The house's shadow: off its cells, where the house shifted down and right would be.
  if (shadow && b) {
    const alpha = HOUSE_SHADOW.alpha;
    for (let py = b.y * CELL; py < (b.y + b.h) * CELL + sy; py++) {
      for (let px = b.x * CELL; px < (b.x + b.w) * CELL + sx; px++) {
        if (!indoorPx(px, py) && indoorPx(px - sx, py - sy)) {
          const i = cv.at(px, py);
          if (i >= 0 && cv.data[i + 3] === 0) {
            cv.set(px, py, HOUSE_SHADOW.rgb, Math.round(alpha * 255));
          } else cv.blend(px, py, HOUSE_SHADOW.rgb, alpha);
        }
      }
    }
  }
  // A doormat outside each outside door, on the ground (the yard's props stand over them).
  for (const e of m.exits) doormat(cv, e.mat, e.side === 'N' || e.side === 'S');
  if (!b) return cv.pixels();

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
  for (const r of m.rooms.values()) {
    if (r.fixture === 'soundproofing') padFaces(cv, m, r);
    else if (r.fixture === 'blackoutCurtains') drapeFace(cv, m, r);
  }
  return cv.pixels();
}

/** A room's floor inside its walls (over its box) and the floor's top under the north faces. */
function floorBox(m: HouseModel, r: Room): Rect {
  const cells = r.cells;
  const x0 = r.box.x / CELL;
  const y0 = r.box.y / CELL;
  const x1 = x0 + r.box.w / CELL;
  const y1 = y0 + r.box.h / CELL;
  const side = (s: 'N' | 'E' | 'S' | 'W') =>
    Math.max(
      0,
      ...cells
        .filter((c) =>
          s === 'N'
            ? c.y === y0
            : s === 'S'
              ? c.y === y1 - 1
              : s === 'W'
                ? c.x === x0
                : c.x === x1 - 1,
        )
        .map((c) => inset(m, c.x, c.y, s)),
    );
  const face = cells.some((c) => c.y === y0 && hasFace(m, c.x, c.y)) ? WALL.face : 0;
  const top = r.box.y + side('N') + face;
  return {
    x: r.box.x + side('W'),
    y: top,
    w: r.box.w - side('W') - side('E'),
    h: r.box.y + r.box.h - side('S') - top,
  };
}

/** The x ranges of each of a room's north faces, with their tops: where the face sprite was drawn. */
function faces(m: HouseModel, r: Room): { x0: number; x1: number; top: number }[] {
  const out: { x0: number; x1: number; top: number }[] = [];
  for (const c of r.cells) {
    if (!hasFace(m, c.x, c.y)) continue;
    const X0 = c.x * CELL;
    const top = c.y * CELL + inset(m, c.x, c.y, 'N');
    for (const [a, z] of without(X0, X0 + CELL, faceGaps(m, c.x, c.y)))
      out.push({ x0: a, x1: z, top });
  }
  return out;
}

/** Soundproofing: the north faces padded, rows of pads offset like bricks, over the baseboard. */
function padFaces(cv: Canvas, m: HouseModel, r: Room): void {
  for (const f of faces(m, r)) {
    for (let fy = 0; fy < WALL.face - 2; fy++) {
      for (let x = f.x0; x < f.x1; x++) {
        const row = fy < 3 ? 0 : 1;
        const lx = (x + row * 3) % 6;
        const ly = fy % 3;
        cv.set(
          x,
          f.top + fy,
          lx === 0 ? PAD.seam : ly === 0 ? PAD.lit : ly === 2 ? PAD.shade : PAD.pad,
        );
      }
    }
  }
}

/** Blackout Curtains: closed drapes on a rod across the middle of the room's widest north face. */
function drapeFace(cv: Canvas, m: HouseModel, r: Room): void {
  // The widest stretch of face, by row.
  const spans = faces(m, r).sort((p, q) => p.top - q.top || p.x0 - q.x0);
  const merged: { x0: number; x1: number; top: number }[] = [];
  for (const f of spans) {
    const last = merged[merged.length - 1];
    if (last && last.top === f.top && last.x1 === f.x0) last.x1 = f.x1;
    else merged.push({ ...f });
  }
  const best = merged.sort((p, q) => q.x1 - q.x0 - (p.x1 - p.x0) || p.top - q.top)[0];
  if (!best) return;
  const w = Math.min(best.x1 - best.x0 - 4, 30);
  if (w < 8) return;
  const x0 = Math.floor((best.x0 + best.x1 - w) / 2);
  const mid = x0 + Math.floor(w / 2);
  for (let fy = 0; fy < WALL.face; fy++) {
    for (let x = x0; x < x0 + w; x++) {
      const k = (x - x0) % 3;
      const color =
        fy === 0
          ? DRAPE.rod
          : x === mid || x === mid - 1
            ? DRAPE.dark
            : fy === WALL.face - 1
              ? DRAPE.dark
              : k === 0
                ? DRAPE.dark
                : k === 1
                  ? DRAPE.lit
                  : DRAPE.cloth;
      cv.set(x, best.top + fy, color);
    }
  }
  // The rod's ends.
  cv.set(x0 - 1, best.top, INK);
  cv.set(x0 + w, best.top, INK);
}

/** A Skylight: a patch of sun in four panes, the frame's shadow between them, over the floor and whatever stands there. */
function sunPatch(cv: Canvas, m: HouseModel, r: Room): void {
  const f = floorBox(m, r);
  const w = Math.max(10, Math.min(30, f.w - 14));
  const h = Math.max(8, Math.min(22, f.h - 12));
  const x0 = Math.floor(f.x + (f.w - w) / 2);
  const y0 = Math.floor(f.y + (f.h - h) / 2);
  const mx = x0 + Math.floor(w / 2);
  const my = y0 + Math.floor(h / 2);
  for (let y = y0 - 1; y <= y0 + h; y++) {
    for (let x = x0 - 1; x <= x0 + w; x++) {
      const rim = x < x0 || y < y0 || x >= x0 + w || y >= y0 + h;
      if (!rim && (x === mx || y === my)) continue;
      cv.blend(x, y, SUN.rgb, rim ? SUN.alpha / 3 : SUN.alpha);
    }
  }
}

/** The Chandelier's warm light around it, in three steps (pixel light, not a smooth ramp). */
function glow(cv: Canvas, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d >= 1) continue;
      cv.blend(
        x,
        y,
        GLOW.rgb,
        d < 0.3 ? GLOW.alpha : d < 0.65 ? GLOW.alpha * 0.66 : GLOW.alpha * 0.33,
      );
    }
  }
}

/** Where the Chandelier hangs: over the middle of the room's floor. */
export function chandelierAt(
  m: HouseModel,
  r: Room,
): { x: number; y: number; w: number; h: number } {
  const f = floorBox(m, r);
  const w = CHANDELIER[0].length;
  const h = CHANDELIER.length;
  return { x: Math.floor(f.x + (f.w - w) / 2), y: Math.floor(f.y + f.h / 2 - h + 2), w, h };
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

/** Margin around the house for a Bay Window's bay, which juts out past the wall. */
const MARGIN = WALL.bay + 2;

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

  // Windows: glass across the band, framed in ink, with a mullion and a few glints. A Bay
  // Window's glass has a mullion every few px and its bay outside; Blackout Curtains draw drapes
  // across a room's glass.
  for (const w of m.windows) {
    const flat = w.side === 'N' || w.side === 'S';
    const { x, y, w: rw, h: rh } = w.rect;
    const along = flat ? rw : rh;
    const across = flat ? rh : rw;
    const dark = m.rooms.get(w.uid)?.fixture === 'blackoutCurtains';
    for (let j = 0; j < rh; j++) {
      for (let i = 0; i < rw; i++) {
        if (!mask.has(x + i, y + j)) continue;
        const a = flat ? i : j;
        const c = flat ? j : i;
        const frame = a === 0 || a === along - 1 || c === 0 || c === across - 1;
        const color = frame
          ? INK
          : dark
            ? a % 3 === 0
              ? DRAPE.dark
              : a % 3 === 1
                ? DRAPE.lit
                : DRAPE.cloth
            : w.bay
              ? a % 7 === 0
                ? MULLION
                : (a + c) % 5 === 1
                  ? GLINT
                  : GLASS
              : a === Math.floor(along / 2)
                ? MULLION
                : (a + c) % 5 === 1
                  ? GLINT
                  : GLASS;
        cv.set(x + i, y + j, color);
      }
    }
    if (w.bay) {
      const b = w.bay;
      for (let j = 0; j < b.h; j++) {
        for (let i = 0; i < b.w; i++) {
          const a = flat ? i : j;
          const c = flat ? j : i;
          const along2 = flat ? b.w : b.h;
          const across2 = flat ? b.h : b.w;
          // Its far side and its two ends in ink; glass between, with a sill along the wall.
          const far = w.side === 'N' || w.side === 'W' ? c === 0 : c === across2 - 1;
          const near = w.side === 'N' || w.side === 'W' ? c === across2 - 1 : c === 0;
          const color =
            far || a === 0 || a === along2 - 1
              ? INK
              : near
                ? BAND
                : (a + c) % 4 === 1
                  ? GLINT
                  : GLASS;
          cv.set(b.x + i, b.y + j, color);
        }
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
  }
  // A Skylight's sun falls on the floor and the furniture alike; the Chandelier hangs over its
  // room in its own light.
  for (const r of m.rooms.values()) {
    if (r.fixture === 'skylight') sunPatch(cv, m, r);
    if (r.fixture !== 'chandelier') continue;
    const at = chandelierAt(m, r);
    glow(cv, at.x + at.w / 2, at.y + at.h / 2 + 2, 15, 11);
    CHANDELIER.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = CHANDELIER_INK[row[i]!];
        if (c) cv.set(at.x + i, at.y + j, c);
      }
    });
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

/**
 * One yard piece alone, for the ghost (yardPieceLayout): its ground and all of its items, in a box
 * its size grown to hold whatever rises above its cells.
 */
export function paintYardPiece(l: YardLayout, atlas: AtlasPixels): Pixels {
  let x0 = l.box.x;
  let y0 = l.box.y;
  let x1 = l.box.x + l.box.w;
  let y1 = l.box.y + l.box.h;
  for (const it of l.items) {
    const { w, h } = artSize(it.sprite);
    x0 = Math.min(x0, it.x);
    y0 = Math.min(y0, it.y);
    x1 = Math.max(x1, it.x + w);
    y1 = Math.max(y1, it.y + h);
  }
  const cv = new Canvas(x0, y0, x1 - x0, y1 - y0);
  paintGround(cv, l.ground, atlas, l.cells);
  for (const it of l.items) cv.blit(atlas, it.sprite, it.x, it.y);
  return cv.pixels();
}
