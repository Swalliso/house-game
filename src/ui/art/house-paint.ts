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
//   Soundproofing pads the room's side of its wall bands (over the furniture) and its north faces,
//   Blackout Curtains cover the windows and hang on a north face where the layout says they're in
//   view, a Skylight lights a patch of floor, a Chandelier hangs over the room with its glow on the
//   floor, and a Bay Window is a cell of glass with its bay outside. All our own drawings, in
//   LimeZu's palette (palette.ts) and ink.
// - The sun (D-120), on the walls canvas like a Skylight's: a band of light along a Sunny room's
//   wall that faces the sun, on each of its tiles in the sun, brighter under a window.
// - A finished room's lamp, lit (D-181): a pool and a halo of amber light round it and its shade
//   glowing, over everything the room draws, on the room's own floor (paintLight). A room with no
//   lamp standing hangs one over its own floor (our own drawing, with the walls, like the
//   Chandelier), lit the same. On the board, a member of the household standing in front of a
//   lamp (D-177) covers it.
//
// Each covers what it paints (the house's bounding box plus a margin; the floor canvas also the
// yard's ground); `x` and `y` place them on the lot, in art px.

import {
  EDGE,
  WALL,
  edge,
  faceRuns,
  faceSpans,
  hasFace,
  inset,
  roomAt,
  type HouseModel,
  type Rect,
  type Room,
  type SunLight,
} from '../board/house-model.ts';
import { CELL, spritePos, type SpriteId } from '../sprites.ts';
import type { Cell, HouseState, PieceId } from '../../rules/index.ts';
import { artFrames, artSize, drawingPixels, isDrawing, type ArtId } from './drawings.ts';
import { byType, itemRows, roomItems, roomLayout, type Item } from './rooms.ts';
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
/** A window's glass and its glints: what the dusk lights (dusk.ts, D-218). */
export const GLASS: Rgb = [0xba, 0xd2, 0xe0];
export const GLINT: Rgb = [0xe2, 0xf2, 0xf3];
const MULLION: Rgb = [0x73, 0x8c, 0xa8];
const RAIL: Rgb = [0xca, 0xc3, 0xd5];
const RAIL_LINE: Rgb = [0x9d, 0xa3, 0xb7];
const MAT: Rgb = [0x91, 0x6e, 0x41];
const MAT_EDGE: Rgb = [0x57, 0x3c, 0x2c];
const MAT_LINE: Rgb = [0xa9, 0x76, 0x4f];
/** Soundproofing's padded panels: a seam, the pad, its lit top and its shaded bottom. */
const PAD = {
  seam: [0x3a, 0x3a, 0x50] as Rgb,
  pad: [0x56, 0x59, 0x72] as Rgb,
  lit: [0x6c, 0x6e, 0x85] as Rgb,
  shade: [0x46, 0x46, 0x5e] as Rgb,
};
/** Blackout Curtains: heavy navy drapes in folds, on a wooden rod. */
const DRAPE = {
  cloth: [0x2d, 0x42, 0x75] as Rgb,
  dark: [0x3a, 0x3a, 0x50] as Rgb,
  lit: [0x41, 0x60, 0x95] as Rgb,
  rod: [0x7b, 0x5b, 0x3a] as Rgb,
};
/** A Skylight's patch of sun on the floor, and the Chandelier's warm glow. */
const SUN = { rgb: [0xff, 0xfb, 0xe8] as Rgb, alpha: 0.4 } as const;
/**
 * The sun along a Sunny room's sunny wall (D-120), in art px from the wall: a band `near` deep
 * and a fainter one `far` beyond it, and under a window a patch `pane` deep, the window's width.
 */
const SUNLIGHT = {
  near: 4,
  far: 3,
  pane: 10,
  alpha: 0.36,
  farAlpha: 0.18,
  paneAlpha: 0.32,
} as const;
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
  G: [0xf2, 0xb2, 0x2b],
  g: [0xed, 0x93, 0x1e],
  w: [0xf0, 0xef, 0xde],
  F: [0xff, 0xe5, 0x7b],
  f: [0xed, 0x93, 0x1e],
  c: [0xcc, 0xe6, 0xec],
};

/**
 * D-181: the lamp a finished room hangs where none stands (a kitchen's, over its table, or a room
 * with no floor left for one): our own drawing, as the Chandelier is, a cream shade under a brass
 * cap on its cord. k ink, G brass, S the shade, s its shading, w its rim, F the bulb.
 */
const PENDANT = [
  '....k....',
  '....k....',
  '...kGk...',
  '..kSSsk..',
  '.kSSSSsk.',
  '.kSSSSsk.',
  'kSSSSSSsk',
  'kwwwwwwwk',
  '.kkFFFkk.',
] as const;
const PENDANT_INK: Readonly<Record<string, Rgb>> = {
  k: INK,
  G: [0xf2, 0xb2, 0x2b],
  S: [0xe0, 0xd0, 0xb2],
  s: [0xd0, 0xbe, 0x9c],
  w: [0xb9, 0x9e, 0x86],
  F: [0xd4, 0xde, 0xe6],
};
/** Its bulb lit: the palette's pale yellow. */
const PENDANT_BULB: Rgb = [0xff, 0xf5, 0x9a];

/** Every color the painters draw with (not the light and shade they blend over it): LimeZu's palette. */
export const PAINTED: readonly Rgb[] = [
  INK,
  BAND,
  GLASS,
  GLINT,
  MULLION,
  RAIL,
  RAIL_LINE,
  MAT,
  MAT_EDGE,
  MAT_LINE,
  ...Object.values(PAD),
  ...Object.values(DRAPE),
  ...Object.values(CHANDELIER_INK),
  ...Object.values(PENDANT_INK),
  PENDANT_BULB,
];

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
  | 'nursery'
  | 'kidsRoom'
  | 'grandmasRoom'
  | 'renfieldsRoom'
  | 'nanasRoom'
  | 'rowansStudio'
  | 'ivysRoom'
>;

/**
 * Each room type's floor (D-093: every room type its own; the two kitchens share one, as do the
 * two halls). The members' rooms have their own too (D-111), so each reads as its own room and
 * the Nursery changes floor as it grows into the Kids' Room. The hand's cards and the shop
 * picture rooms with these too, through paintPiece. A type without its own floor and face has its
 * countsAs root's: floorOf and faceOf.
 */
export const FLOOR: Readonly<Record<RoomId, SpriteId>> = {
  bedroom: 'floor-wood',
  bathroom: 'floor-tile',
  kitchen: 'floor-kitchen',
  lKitchen: 'floor-kitchen',
  diningRoom: 'floor-parquet',
  livingRoom: 'floor-carpet',
  closet: 'floor-closet',
  hallway: 'floor-hall',
  longHallway: 'floor-hall',
  garage: 'floor-garage',
  homeOffice: 'floor-office',
  playroom: 'floor-playroom',
  library: 'floor-library',
  mudroom: 'floor-mudroom',
  sunroom: 'floor-sunroom',
  nursery: 'floor-nursery',
  kidsRoom: 'floor-kids-room',
  grandmasRoom: 'floor-grandmas-room',
  renfieldsRoom: 'floor-renfields-room',
  nanasRoom: 'floor-nanas-room',
  rowansStudio: 'floor-rowans-studio',
  ivysRoom: 'floor-ivys-room',
};

/**
 * Each room type's north wall face, in its own wallpaper (the two kitchens and the two halls
 * share one). Each stands apart from its room's floor, a light wall over a darker floor or a
 * color of its own over a light one, so the wall reads as a wall and two rooms never read as one
 * (a test holds each wallpaper's average at ΔE 20 or more from its floor's).
 */
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
  nursery: 'face-nursery',
  kidsRoom: 'face-kids-room',
  grandmasRoom: 'face-grandmas-room',
  renfieldsRoom: 'face-renfields-room',
  nanasRoom: 'face-nanas-room',
  rowansStudio: 'face-rowans-studio',
  ivysRoom: 'face-ivys-room',
};

/** A room type's wallpaper: its own, its countsAs root's (byType), or the hall's. */
function faceOf(id: PieceId): SpriteId {
  return byType(FACE, id) ?? 'face-hallway';
}

/** A room type's floor: its own, its countsAs root's (byType), or the hall's. */
function floorOf(id: PieceId): SpriteId {
  return byType(FLOOR, id) ?? 'floor-hall';
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

/** A piece of the house where the board stacks it (housePieces): a room, or a yard piece. */
export interface StackedPiece {
  uid: number;
  room: boolean;
  box: Rect;
  /** Back to front. */
  items: readonly Item[];
}

/**
 * The house's pieces as the board's items and overhang layers stack them: south in front, each by
 * its bottom row, ties in the house's order (the DOM's). The photos paint them in this order
 * (photo-paint.ts paintHouse), and the dusk reads it to tell what's a room's from what's the
 * yard's (dusk.ts, D-218).
 */
export function housePieces(house: HouseState, m: HouseModel, yard: YardModel): StackedPiece[] {
  const out: (StackedPiece & { i: number })[] = [];
  house.pieces.forEach((p, i) => {
    const room = m.rooms.get(p.uid);
    const at = room ? { box: room.box, items: roomItems(m, p.uid) } : yard.pieces.get(p.uid);
    if (at) out.push({ uid: p.uid, room: room !== undefined, box: at.box, items: at.items, i });
  });
  return out.sort((a, b) => a.box.y + a.box.h - (b.box.y + b.box.h) || a.i - b.i);
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
    const floor = floorOf(r.defId);
    const face = faceOf(r.defId);
    for (const c of r.cells) {
      const X0 = c.x * CELL;
      const Y0 = c.y * CELL;
      cv.blit(atlas, floor, X0, Y0);
      let top = Y0 + inset(m, c.x, c.y, 'N');
      if (hasFace(m, c.x, c.y)) {
        for (const [a, z] of faceRuns(m, c.x, c.y)) {
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
    if (r.fixture !== 'blackoutCurtains') continue;
    const d = roomLayout(m, r.uid).drape;
    if (d) drapeFace(cv, d);
  }
  return cv.pixels();
}

/** A room's floor inside its walls (over its box) and the floor's top under the north faces. */
export function floorBox(m: HouseModel, r: Room): Rect {
  return floorOver(m, r.cells, r.box);
}

/**
 * The floor inside the walls over `box` (lot art px, whole cells), of `cells` (a room's own,
 * in it): what floorBox is for a whole room, for a rectangle of its cells.
 */
function floorOver(m: HouseModel, cells: readonly Cell[], box: Rect): Rect {
  const x0 = box.x / CELL;
  const y0 = box.y / CELL;
  const x1 = x0 + box.w / CELL;
  const y1 = y0 + box.h / CELL;
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
  const top = box.y + side('N') + face;
  return {
    x: box.x + side('W'),
    y: top,
    w: box.w - side('W') - side('E'),
    h: box.y + box.h - side('S') - top,
  };
}

/** Soundproofing: the north faces padded, rows of pads offset like bricks, over the baseboard. */
function padFaces(cv: Canvas, m: HouseModel, r: Room): void {
  for (const f of faceSpans(m, r)) {
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

/**
 * Soundproofing on a wall band (the walls canvas, over the furniture, so it shows whatever stands
 * against the walls): the room's side of the band padded, a seam every few px along it.
 */
function padAt(m: HouseModel, px: number, py: number): Rgb {
  const cx = Math.floor(px / CELL);
  const cy = Math.floor(py / CELL);
  const ly = py - cy * CELL;
  const along = ly < inset(m, cx, cy, 'N') || ly >= CELL - inset(m, cx, cy, 'S') ? px : py;
  const k = along % 6;
  return k === 0 ? PAD.seam : k === 1 ? PAD.lit : PAD.pad;
}

/** Blackout Curtains on a north face: closed drapes on a rod, where the room's layout hangs them. */
function drapeFace(cv: Canvas, d: Rect): void {
  const mid = d.x + Math.floor(d.w / 2);
  for (let fy = 0; fy < d.h; fy++) {
    for (let x = d.x; x < d.x + d.w; x++) {
      const k = (x - d.x) % 3;
      const color =
        fy === 0
          ? DRAPE.rod
          : x === mid || x === mid - 1
            ? DRAPE.dark
            : fy === d.h - 1
              ? DRAPE.dark
              : k === 0
                ? DRAPE.dark
                : k === 1
                  ? DRAPE.lit
                  : DRAPE.cloth;
      cv.set(x, d.y + fy, color);
    }
  }
  // The rod's ends.
  cv.set(d.x - 1, d.y, INK);
  cv.set(d.x + d.w, d.y, INK);
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

/**
 * The sun on a Sunny room's tiles in the sun (D-120): along the wall that faces it, a band of
 * light in two steps (pixel light, not a smooth ramp), and a brighter patch under each window
 * there, split by the window's mullion. Over the furniture, like a Skylight's.
 */
function sunlight(cv: Canvas, m: HouseModel, sun: SunLight): void {
  const s = sun.side;
  const flat = s === 'N' || s === 'S';
  for (const [uid, cells] of sun.rooms) {
    for (const c of cells) {
      // The cell's floor, inside its walls and under a north face.
      const x0 = c.x * CELL + inset(m, c.x, c.y, 'W');
      const x1 = (c.x + 1) * CELL - inset(m, c.x, c.y, 'E');
      const y0 = c.y * CELL + inset(m, c.x, c.y, 'N') + (hasFace(m, c.x, c.y) ? WALL.face : 0);
      const y1 = (c.y + 1) * CELL - inset(m, c.x, c.y, 'S');
      // Along the wall (a) and in from it (d), clipped to the floor.
      const lo = flat ? x0 : y0;
      const hi = flat ? x1 : y1;
      const deep = flat ? y1 - y0 : x1 - x0;
      const light = (a: number, d: number, alpha: number) => {
        if (a < lo || a >= hi || d >= deep) return;
        if (s === 'N') cv.blend(a, y0 + d, SUN.rgb, alpha);
        else if (s === 'S') cv.blend(a, y1 - 1 - d, SUN.rgb, alpha);
        else if (s === 'W') cv.blend(x0 + d, a, SUN.rgb, alpha);
        else cv.blend(x1 - 1 - d, a, SUN.rgb, alpha);
      };
      for (let a = lo; a < hi; a++) {
        for (let d = 0; d < SUNLIGHT.near + SUNLIGHT.far; d++)
          light(a, d, d < SUNLIGHT.near ? SUNLIGHT.alpha : SUNLIGHT.farAlpha);
      }
      // Under each window in this cell's sunny wall: the glass's width, deeper, split by the
      // mullion's shadow.
      for (const w of m.windows) {
        if (w.uid !== uid || w.side !== s) continue;
        const a0 = (flat ? w.rect.x : w.rect.y) + 1;
        const a1 = (flat ? w.rect.x + w.rect.w : w.rect.y + w.rect.h) - 1;
        const mid = a0 - 1 + Math.floor((a1 - a0 + 2) / 2);
        for (let a = a0; a < a1; a++) {
          if (a === mid) continue;
          for (let d = 0; d < SUNLIGHT.pane; d++) light(a, d, SUNLIGHT.paneAlpha);
        }
      }
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

/**
 * D-181: a finished room's lamp, lit (paintLight): a warm pool on the floor round its foot, a halo
 * round its shade, and the shade glowing from inside. It reads apart from the room's other light:
 * amber and low beside its lamp, where the Chandelier's glow is pale yellow in the middle of the
 * room and hangs from a chandelier, and round, where the sun lies in a cream band along a wall.
 * Pixel light, as the Chandelier's: full strength in the middle, then two thirds, then a third.
 */
export const LAMP_LIGHT = {
  pool: { rgb: [0xff, 0xa8, 0x40] as Rgb, alpha: 0.5, rx: 28, ry: 14 },
  halo: { rgb: [0xff, 0xbc, 0x50] as Rgb, alpha: 0.55, rx: 14, ry: 13 },
  /** The shade lit from inside: its cloth taken this far toward `rgb`; its ink outline stays. */
  shade: { rgb: [0xff, 0xf0, 0xb8] as Rgb, mix: 0.8 },
} as const;

/**
 * Each lamp's shade (its rows from the top, [from, to)) and the row of its foot, where its light
 * pools on the floor: by sprite, else by family (a nightlamp's foot is its little table's).
 */
const LAMP_PARTS: Readonly<Record<string, { shade: readonly [number, number]; foot: number }>> = {
  'lamp-floor': { shade: [0, 13], foot: 31 },
  'lamp-floor-1': { shade: [0, 14], foot: 31 },
  'lamp-floor-2': { shade: [0, 14], foot: 31 },
  'side-lamp': { shade: [0, 9], foot: 20 },
  nightlamp: { shade: [0, 9], foot: 16 },
};

/** A lamp's parts, by its sprite or else its family. */
function lampParts(sprite: ArtId): { shade: readonly [number, number]; foot: number } | undefined {
  return LAMP_PARTS[sprite] ?? LAMP_PARTS[sprite.replace(/-\d+$/, '')];
}

/**
 * D-181: where room `uid`'s lamp gives its light, in art px: the middle of its shade, or of the
 * lamp it hangs. Null when the room has no lamp lit. The director's moment bursts from it.
 */
export function lampSpot(m: HouseModel, uid: number): { x: number; y: number } | null {
  const r = m.rooms.get(uid);
  const layout = r?.finished ? roomLayout(m, uid) : null;
  if (!r || !layout) return null;
  const lamp = layout.lamp;
  const parts = lamp && lampParts(lamp.sprite);
  if (lamp && parts) {
    return {
      x: lamp.x + artSize(lamp.sprite).w / 2,
      y: lamp.y + (parts.shade[0] + parts.shade[1]) / 2,
    };
  }
  if (!layout.pendant) return null;
  const at = pendantAt(m, r);
  return { x: at.x + at.w / 2, y: at.y + PENDANT_SHADE };
}

/** LimeZu's outline inks, which a lit shade keeps. */
const LAMP_INKS: readonly Rgb[] = [INK, [0x46, 0x46, 0x5e], [0x56, 0x59, 0x72]];

/**
 * Pixel (x, y) of a sprite or drawing, in frame `k` of an animation (the first by default): its
 * RGBA.
 */
function artPixel(atlas: AtlasPixels, id: ArtId, x: number, y: number, k = 0): readonly number[] {
  if (isDrawing(id)) {
    const d = drawingPixels(id);
    const i = (y * d.w * d.frames + k * d.w + x) * 4;
    return [d.data[i]!, d.data[i + 1]!, d.data[i + 2]!, d.data[i + 3]!];
  }
  const s = spritePos(id);
  const i = ((s.y + y) * atlas.width + s.x + k * (artFrames(id)?.stride ?? 0) + x) * 4;
  return [atlas.data[i]!, atlas.data[i + 1]!, atlas.data[i + 2]!, atlas.data[i + 3]!];
}

/** Whether item `it` draws lot pixel (px, py). */
export function drawnAt(atlas: AtlasPixels, it: Item, px: number, py: number): boolean {
  const s = artSize(it.sprite);
  const ix = px - it.x;
  const iy = py - it.y;
  return ix >= 0 && iy >= 0 && ix < s.w && iy < s.h && artPixel(atlas, it.sprite, ix, iy)[3]! > 0;
}

/**
 * D-177: a member of the household standing in their room, as an item of it (board/people.ts
 * personItem), its first frame `sprite`'s. D-185: they breathe, and an adult reads or takes a call
 * now and then: `looks` are every strip the board shows them in, each the size of `sprite`, at the
 * item's place. What keeps off a member (a lamp's light) keeps off every frame of them all
 * (figureDraws); without `looks`, the sprite's first frame, as any item's.
 */
export interface Figure extends Item {
  readonly looks?: readonly ArtId[];
}

/** Each figure's union of frames (figureDraws), by its looks, per atlas: a house repaints often. */
const unions = new WeakMap<AtlasPixels, Map<string, Uint8Array>>();

/**
 * D-185: whether figure `f` draws lot pixel (px, py) in any frame of any of its looks: the union of
 * them all, so a lamp's light never falls on a frame the board shows (a breath raises a head a
 * pixel; a book or a phone is held out), at the price of a pixel or two left unlit beside them on
 * the others. Without `looks`, its sprite's first frame (drawnAt).
 */
export function figureDraws(atlas: AtlasPixels, f: Figure): (px: number, py: number) => boolean {
  const looks = f.looks;
  if (!looks) return (px, py) => drawnAt(atlas, f, px, py);
  const { w, h } = artSize(f.sprite);
  let byLooks = unions.get(atlas);
  if (!byLooks) unions.set(atlas, (byLooks = new Map()));
  const key = `${w}x${h}:${looks.join(',')}`;
  let on = byLooks.get(key);
  if (!on) {
    on = new Uint8Array(w * h);
    for (const id of looks) {
      const s = artSize(id);
      const n = artFrames(id)?.frames ?? 1;
      for (let k = 0; k < n; k++) {
        for (let y = 0; y < Math.min(h, s.h); y++) {
          for (let x = 0; x < Math.min(w, s.w); x++) {
            if (artPixel(atlas, id, x, y, k)[3]! > 0) on[y * w + x] = 1;
          }
        }
      }
    }
    byLooks.set(key, on);
  }
  const mask = on;
  return (px, py) => {
    const ix = px - f.x;
    const iy = py - f.y;
    return ix >= 0 && iy >= 0 && ix < w && iy < h && mask[iy * w + ix] === 1;
  };
}

/**
 * D-177: the household's members standing in their rooms as the board draws them, each one an
 * item of their room, by room uid (board/people.ts roomPeople), and the atlas their pixels are
 * in. The photos and the ghosts draw nobody.
 */
export interface Household {
  readonly people: ReadonlyMap<number, readonly Figure[]>;
  readonly atlas: AtlasPixels;
}

/**
 * D-177 × D-181: whether a member of the room, of `people` (board/people.ts roomPeople: each one
 * an item of their room, as the board draws them), who stands in front of its lamp (the lamp's
 * bottom edge at `bottom`: a hanging lamp's is its bulb's) is drawn at (px, py), in any of their
 * frames (figureDraws, D-185). The board sorts a member in with the room's furniture by bottom
 * edge, in front of whatever's is no lower than their feet (people.ts withPeople), and so with
 * its lamp, standing or hanging: there they cover it.
 */
function inFrontOfLamp(
  people: readonly Figure[],
  bottom: number,
  atlas: AtlasPixels,
): (px: number, py: number) => boolean {
  const front = people
    .filter((p) => p.y + artSize(p.sprite).h >= bottom)
    .map((p) => figureDraws(atlas, p));
  return (px, py) => front.some((draws) => draws(px, py));
}

/** Pixel light in an oval, in three steps, where `on` lets it fall. */
function lightOval(
  cv: Canvas,
  o: { rgb: Rgb; alpha: number; rx: number; ry: number },
  cx: number,
  cy: number,
  on: (px: number, py: number) => boolean,
): void {
  for (let y = Math.floor(cy - o.ry); y <= Math.ceil(cy + o.ry); y++) {
    for (let x = Math.floor(cx - o.rx); x <= Math.ceil(cx + o.rx); x++) {
      const d = ((x + 0.5 - cx) / o.rx) ** 2 + ((y + 0.5 - cy) / o.ry) ** 2;
      if (d >= 1 || !on(x, y)) continue;
      cv.blend(x, y, o.rgb, d < 0.3 ? o.alpha : d < 0.65 ? o.alpha * 0.66 : o.alpha * 0.33);
    }
  }
}

/**
 * D-181: the two parts of a finished room's light on the board. The glow (the pool on the floor,
 * the halo, and a hanging lamp lit) stays still, as the floor and the walls do; a standing lamp's
 * lit shade moves with the lamp when the room's furniture wobbles (piece-fx.ts's 'light' part).
 */
export type LightPart = 'glow' | 'shade';

/**
 * D-181: room `uid`'s lamp lit (rooms.ts gives a finished room its lamp), over everything the
 * room draws: the board's overhang layer puts it right after the room's tall tops, and the
 * photos paint it there too, so a piece further south (a Treehouse's deck rising into the room)
 * stands in front of it. In the room's box, and only on its own cells: the pool on its floor and
 * the halo round the shade (on its floor, faces and furniture), never on its wall bands, so the
 * house's outline stays crisp; and the shade's own pixels where they're in view (not under a wall
 * band or behind another piece), or the hanging lamp, lit. With `part`, only that part (both
 * without). Null when the room has no lamp lit, or no such part.
 *
 * D-177: on the board, `people` are the room's members as items (people.ts roomPeople): one
 * standing in front of its lamp covers it, so its shade, or the hanging lamp, isn't lit over them
 * there; and the pool and the halo fall round a member, wherever they stand, not on them. D-185:
 * round every frame of theirs, their breath's, their book's and their phone's (figureDraws).
 */
export function paintLight(
  m: HouseModel,
  uid: number,
  atlas: AtlasPixels,
  part?: LightPart,
  people: readonly Figure[] = [],
): Pixels | null {
  const r = m.rooms.get(uid);
  const layout = r ? roomLayout(m, uid) : null;
  if (!r || !layout || (!layout.lamp && !layout.pendant)) return null;
  const lamp = layout.lamp;
  // A hanging lamp's light is all glow: it hangs with the walls.
  if (part === 'shade' && !lamp) return null;
  const cv = new Canvas(r.box.x, r.box.y, r.box.w, r.box.h);
  const mask = wallMask(m, cv);
  const own = (px: number, py: number) =>
    roomAt(m, Math.floor(px / CELL), Math.floor(py / CELL)) === uid;
  // The floor: the room's cells inside their walls and below their north faces (and off the
  // corner an L's outside wall turns in).
  const floor = (px: number, py: number) => {
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    if (roomAt(m, cx, cy) !== uid || mask.has(px, py)) return false;
    const lx = px - cx * CELL;
    const ly = py - cy * CELL;
    return (
      lx >= inset(m, cx, cy, 'W') &&
      lx < CELL - inset(m, cx, cy, 'E') &&
      ly >= inset(m, cx, cy, 'N') + (hasFace(m, cx, cy) ? WALL.face : 0) &&
      ly < CELL - inset(m, cx, cy, 'S')
    );
  };
  // The halo falls on the room's floor, faces and furniture, never on its walls' bands.
  const inside = (px: number, py: number) => own(px, py) && !mask.has(px, py);
  // D-177: the pool and the halo fall round a member of the household standing in the room, not
  // on them, wherever they stand: at the lamp's foot its light, at half strength or more, would
  // wash them out (Grandma's grey hair and purple trousers read as one amber).
  const figures = people.map((p) => figureDraws(atlas, p));
  const someone = (px: number, py: number) => figures.some((draws) => draws(px, py));
  const onFloor = (px: number, py: number) => floor(px, py) && !someone(px, py);
  const onInside = (px: number, py: number) => inside(px, py) && !someone(px, py);
  const lit = (c: Rgb): Rgb => {
    const { rgb, mix } = LAMP_LIGHT.shade;
    return [
      Math.round(c[0] + (rgb[0] - c[0]) * mix),
      Math.round(c[1] + (rgb[1] - c[1]) * mix),
      Math.round(c[2] + (rgb[2] - c[2]) * mix),
    ];
  };

  if (!lamp) {
    // The hanging lamp: the pool on the floor below it, the halo, and the lamp itself lit (it
    // hangs over everything in the room, as the Chandelier does, but a member in front of it).
    const at = pendantAt(m, r);
    const mid = at.x + at.w / 2;
    lightOval(cv, LAMP_LIGHT.pool, mid, at.y + at.h + PENDANT_POOL, onFloor);
    lightOval(cv, LAMP_LIGHT.halo, mid, at.y + PENDANT_SHADE, onInside);
    const front = inFrontOfLamp(people, at.y + at.h, atlas);
    paintPendant(cv, at, (px, py) => inside(px, py) && !front(px, py), lit);
    return cv.pixels();
  }
  const parts = lampParts(lamp.sprite);
  if (!parts) return null;
  const { w } = artSize(lamp.sprite);
  const [from, to] = parts.shade;
  const mid = lamp.x + w / 2;
  if (part !== 'shade') {
    lightOval(cv, LAMP_LIGHT.pool, mid, lamp.y + parts.foot, onFloor);
    lightOval(cv, LAMP_LIGHT.halo, mid, lamp.y + (from + to) / 2, onInside);
  }
  if (part === 'glow') return cv.pixels();

  // The shade: where the board shows it. Its rows above the band's line are on the overhang, over
  // the walls; the rest is under them. A piece drawn after it (further south) covers it, and so
  // does a member standing in front of it.
  const rows = itemRows(lamp);
  const after = layout.items.slice(layout.items.indexOf(lamp) + 1);
  const front = inFrontOfLamp(people, lamp.y + artSize(lamp.sprite).h, atlas);
  for (let y = from; y < to; y++) {
    const over = rows.top !== null && y < rows.top[1];
    for (let x = 0; x < w; x++) {
      const [pr, pg, pb, pa] = artPixel(atlas, lamp.sprite, x, y);
      if (pa !== 255) continue;
      if (LAMP_INKS.some((k) => k[0] === pr && k[1] === pg && k[2] === pb)) continue;
      const px = lamp.x + x;
      const py = lamp.y + y;
      if (!own(px, py) || (!over && mask.has(px, py))) continue;
      const covered = after.some((it) => drawnAt(atlas, it, px, py)) || front(px, py);
      if (!covered) cv.set(px, py, lit([pr!, pg!, pb!]));
    }
  }
  return cv.pixels();
}

/** The middle of the hanging lamp's shade, from its top, and how far below it its pool lies. */
const PENDANT_SHADE = 5.5;
const PENDANT_POOL = 6;

/**
 * Where a finished room's hanging lamp hangs, all of it over the room's own floor and off its
 * wall bands: over the middle of the floor, as the Chandelier does (a quarter of the floor east
 * of it in a room that has one). Where that isn't the room's floor (an L-Kitchen's middle is the
 * corner its walls turn), over the middle of the biggest rectangle of the room's own floor it
 * hangs clear over: in an L-Kitchen, the arm without a north face, which has the most floor.
 */
export function pendantAt(m: HouseModel, r: Room): Rect {
  const f = floorBox(m, r);
  const first = hangOver(f, r.fixture === 'chandelier' ? Math.floor(f.w / 4) : 0);
  const mask = wallMask(m, r.box);
  const clear = (at: Rect) =>
    pendantPixels(at).every(
      (p) =>
        roomAt(m, Math.floor(p.x / CELL), Math.floor(p.y / CELL)) === r.uid && !mask.has(p.x, p.y),
    );
  if (clear(first)) return first;
  for (const floor of floorRects(m, r)) {
    const at = hangOver(floor, 0);
    if (clear(at)) return at;
  }
  return first;
}

/** The hanging lamp over the middle of floor `f`, `shift` px east: its bulb just below the middle. */
function hangOver(f: Rect, shift: number): Rect {
  const w = PENDANT[0].length;
  const h = PENDANT.length;
  return { x: Math.floor(f.x + (f.w - w) / 2) + shift, y: Math.floor(f.y + f.h / 2 - h + 2), w, h };
}

/**
 * The floors of the rectangles of room `r`'s own cells, the biggest first; of two the same size,
 * the one nearer the middle of the room's floor, then the northmost, then the westmost.
 */
function floorRects(m: HouseModel, r: Room): Rect[] {
  const x0 = r.box.x / CELL;
  const y0 = r.box.y / CELL;
  const x1 = x0 + r.box.w / CELL;
  const y1 = y0 + r.box.h / CELL;
  const own = new Set(r.cells.map((c) => `${c.x},${c.y}`));
  const whole = floorBox(m, r);
  const mx = whole.x + whole.w / 2;
  const my = whole.y + whole.h / 2;
  const out: { f: Rect; near: number }[] = [];
  for (let ay = y0; ay < y1; ay++) {
    for (let ax = x0; ax < x1; ax++) {
      for (let by = ay + 1; by <= y1; by++) {
        for (let bx = ax + 1; bx <= x1; bx++) {
          const cells: Cell[] = [];
          for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) cells.push({ x, y });
          if (!cells.every((c) => own.has(`${c.x},${c.y}`))) continue;
          const box = { x: ax * CELL, y: ay * CELL, w: (bx - ax) * CELL, h: (by - ay) * CELL };
          const f = floorOver(m, cells, box);
          if (f.w <= 0 || f.h <= 0) continue;
          out.push({ f, near: (f.x + f.w / 2 - mx) ** 2 + (f.y + f.h / 2 - my) ** 2 });
        }
      }
    }
  }
  return out
    .sort(
      (a, b) => b.f.w * b.f.h - a.f.w * a.f.h || a.near - b.near || a.f.y - b.f.y || a.f.x - b.f.x,
    )
    .map((o) => o.f);
}

/** D-181: the lot pixels the hanging lamp covers, hanging at `at` (pendantAt). */
export function pendantPixels(at: Rect): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  PENDANT.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (PENDANT_INK[row[i]!]) out.push({ x: at.x + i, y: at.y + j });
  });
  return out;
}

/**
 * The hanging lamp at `at`, where `keep` lets it (its room's own cells, off the wall bands): as
 * it is, or with `lit` taking its shade and the bulb lit.
 */
function paintPendant(
  cv: Canvas,
  at: Rect,
  keep: (px: number, py: number) => boolean,
  lit?: (c: Rgb) => Rgb,
): void {
  PENDANT.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const k = row[i]!;
      const c = PENDANT_INK[k];
      if (!c || !keep(at.x + i, at.y + j)) continue;
      const shade = k === 'S' || k === 's' || k === 'w';
      cv.set(at.x + i, at.y + j, !lit ? c : k === 'F' ? PENDANT_BULB : shade ? lit(c) : c);
    }
  });
}

/**
 * D-181: every finished room's lamp lit, over the house's box: a room alone (the Moving Truck's
 * ghost). The board and the photos light each room in the overhang's order instead.
 */
export function paintLights(m: HouseModel, atlas: AtlasPixels): Pixels | null {
  const b = m.bounds;
  if (!b) return null;
  let cv: Canvas | null = null;
  for (const r of m.rooms.values()) {
    if (!r.finished) continue;
    const p = paintLight(m, r.uid, atlas);
    if (!p) continue;
    cv ??= new Canvas(b.x * CELL, b.y * CELL, b.w * CELL, b.h * CELL);
    cv.over(p);
  }
  return cv?.pixels() ?? null;
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

/**
 * The walls canvas's pixels. Null with no rooms. On the board, `household` has the members in
 * their rooms: a finished room's hanging lamp isn't drawn over one standing in front of it.
 */
export function paintWalls(m: HouseModel, household?: Household): Pixels | null {
  const b = m.bounds;
  if (!b) return null;
  const cv = new Canvas(
    b.x * CELL - MARGIN,
    b.y * CELL - MARGIN,
    b.w * CELL + 2 * MARGIN,
    b.h * CELL + 2 * MARGIN,
  );
  const mask = wallMask(m, cv);
  const padded = new Set(
    [...m.rooms.values()].filter((r) => r.fixture === 'soundproofing').map((r) => r.uid),
  );
  mask.forEach((px, py) => {
    const edgePx =
      !mask.has(px - 1, py) ||
      !mask.has(px + 1, py) ||
      !mask.has(px, py - 1) ||
      !mask.has(px, py + 1);
    if (edgePx) cv.set(px, py, INK);
    else if (padded.size > 0 && padded.has(roomAt(m, Math.floor(px / CELL), Math.floor(py / CELL))))
      cv.set(px, py, padAt(m, px, py));
    else cv.set(px, py, BAND);
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
  // The sun through the Sunny rooms' sunny walls, then a Skylight's: both fall on the floor and
  // the furniture alike. The Chandelier hangs over its room in its own light.
  if (m.sun) sunlight(cv, m, m.sun);
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
  // D-181: a finished room's hanging lamp, as it is, over its own floor; its light (paintLight)
  // lights it. D-177: behind a member of the household who stands in front of it.
  for (const r of m.rooms.values()) {
    if (!r.finished || !roomLayout(m, r.uid).pendant) continue;
    const at = pendantAt(m, r);
    const people = household?.people.get(r.uid);
    const front =
      household && people ? inFrontOfLamp(people, at.y + at.h, household.atlas) : () => false;
    const own = (px: number, py: number) =>
      roomAt(m, Math.floor(px / CELL), Math.floor(py / CELL)) === r.uid &&
      !mask.has(px, py) &&
      !front(px, py);
    paintPendant(cv, at, own);
  }
  return cv.pixels();
}

/**
 * One piece alone, for the ghost (pieceModel) and the cards' pictures: its floor, its items, its
 * walls over them, then the tops of its tall items over the walls, as the board's overhang layer
 * draws them (a bookcase or a fridge rising over the north wall band), in one box the size of the
 * piece. Null with no room.
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
  for (const it of items) {
    const top = itemRows(it).top;
    if (!top) continue;
    const [from, to] = top;
    cv.blit(atlas, it.sprite, it.x, it.y + from, {
      x: 0,
      y: from,
      w: artSize(it.sprite).w,
      h: to - from,
    });
  }
  // D-181: a finished room's lamp, lit (a room the Moving Truck carries).
  const lights = paintLights(m, atlas);
  if (lights) cv.over(lights);
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
