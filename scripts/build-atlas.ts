// Builds the sprite atlas (implementation-plan.md §3 "Scripts" and §12 "Art"; D-057, D-066,
// D-095).
//
// It packs two kinds of sprite:
// - Placeholders: art/palette.txt maps one character to a color, and each art/<id>.txt is a
//   16×16 grid of palette characters, with '.' for transparent. They're validated as before
//   (at most 32 palette colors, 8 per sprite) and doubled to 32×32 with nearest neighbor, so
//   a placeholder fills one 32 art px cell (D-095).
// - LimeZu cuts: assets/limezu/<id>.png at its own size, listed in assets/limezu/index.json.
//   `npm run art:cut` (scripts/cut-art.ts) writes them from the packs, and they're committed,
//   so this script (and CI) never needs the packs. A cut replaces the placeholder with its id.
//
// Every sprite, and every frame of an animation, is extruded by 1px (a border that repeats its
// edge pixels, so fractional screen scales show no seams) and shelf-packed: tallest first,
// then by id, at even coordinates, into a power-of-two width. It writes assets/atlas.png and
// assets/atlas.json, version 2:
//
//   { version: 2, cell: 32, width, height, sprites: { id: { x, y, w, h, frames?, stride?, ms? } } }
//
// x, y, w, h are the sprite's rect (an animation's first frame). Frame k of an animation
// starts at x + k × stride and shows for ms. The UI reads sprites by id.
//
// Run it with `npm run atlas` (plain `node scripts/build-atlas.ts`). `npm run build` runs it
// first. No npm dependencies: scripts/png.ts encodes and decodes with node:zlib.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng, encodePng, type RgbaImage } from './png.ts';

/** The placeholders' grid size, in pixels. */
export const PLACEHOLDER_SIZE = 16;
/** Art px per game cell (D-095): the atlas's `cell`, and the size placeholders are doubled to. */
export const ART_CELL = 32;
/** How much a placeholder is scaled up in the atlas. */
export const PLACEHOLDER_SCALE = ART_CELL / PLACEHOLDER_SIZE;
/** Border repeated around each sprite and each frame. */
export const EXTRUDE = 1;
/** The atlas is at least this wide, and a power of two. */
export const MIN_ATLAS_WIDTH = 256;
export const MAX_PALETTE_COLORS = 32;
export const MAX_SPRITE_COLORS = 8;
export const TRANSPARENT = '.';
/** Sprite ids: lowercase words joined by "-". */
export const SPRITE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PALETTE_FILE = 'palette.txt';
/** Empty pixels around the packed area: slots start at odd x and y, so sprites start at even. */
const MARGIN = 1;

export type Rgba = readonly [r: number, g: number, b: number, a: number];
/** Palette character → color. */
export type Palette = ReadonlyMap<string, Rgba>;

export interface Sprite {
  readonly id: string;
  /** 16 rows of 16 palette characters ('.' = transparent). */
  readonly rows: readonly string[];
}

/** A sprite to pack: its pixels (an animation's frames side by side) and one frame's size. */
export interface PackInput {
  readonly id: string;
  readonly image: RgbaImage;
  readonly w: number;
  readonly h: number;
  /** 1 for a still sprite. */
  readonly frames: number;
  /** How long each frame shows; only for animations. */
  readonly ms?: number;
}

export interface AtlasSprite {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Animations only: the frame count, frame k's x offset (k × stride), and each frame's ms. */
  frames?: number;
  stride?: number;
  ms?: number;
}

export interface AtlasJson {
  version: 2;
  /** Art px per game cell. */
  cell: number;
  width: number;
  height: number;
  /** Each sprite's rect, inside its extruded border, by id. */
  sprites: Record<string, AtlasSprite>;
}

export interface Atlas {
  readonly width: number;
  readonly height: number;
  /** width × height RGBA pixels, row-major. */
  readonly rgba: Uint8Array;
  readonly json: AtlasJson;
}

/** One cut in assets/limezu/index.json (written by scripts/cut-art.ts). */
export interface CutRecord {
  /** One frame's size. */
  readonly w: number;
  readonly h: number;
  /** Animations only. */
  readonly frames?: number;
  readonly ms?: number;
  /** The hash of its manifest entry (cut-art.ts specHash), to tell when it needs a re-cut. */
  readonly spec: string;
}
export type CutIndex = Readonly<Record<string, CutRecord>>;

/** Splits a text file into lines, accepting CRLF and one trailing newline. */
function textLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Parses art/palette.txt: one `<char> #rrggbb` per line, optionally followed by a description.
 * Blank lines and lines starting with '#' are comments.
 */
export function parsePalette(text: string, source = `art/${PALETTE_FILE}`): Palette {
  const palette = new Map<string, Rgba>();
  const colorOwner = new Map<string, string>();
  textLines(text).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const where = `${source} line ${i + 1}`;
    const match = /^(\S)\s+#([0-9a-fA-F]{6})(?:\s+.*)?$/.exec(line);
    if (!match) {
      throw new Error(`${where}: expected "<char> #rrggbb", got "${line}"`);
    }
    const ch = match[1]!;
    const hex = match[2]!.toLowerCase();
    if (ch === TRANSPARENT) {
      throw new Error(`${where}: "${TRANSPARENT}" is reserved for transparent pixels`);
    }
    if (palette.has(ch)) throw new Error(`${where}: "${ch}" is defined twice`);
    const owner = colorOwner.get(hex);
    if (owner !== undefined) {
      throw new Error(`${where}: #${hex} is already "${owner}"; reuse that character`);
    }
    colorOwner.set(hex, ch);
    const n = Number.parseInt(hex, 16);
    palette.set(ch, [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 0xff]);
  });
  if (palette.size === 0) throw new Error(`${source} defines no colors`);
  if (palette.size > MAX_PALETTE_COLORS) {
    throw new Error(
      `${source} has ${palette.size} colors; the shared palette holds at most ${MAX_PALETTE_COLORS}`,
    );
  }
  return palette;
}

/** The distinct palette characters a sprite uses, transparent excluded. */
export function spriteColors(sprite: Sprite): string[] {
  const used = new Set<string>();
  for (const row of sprite.rows) for (const ch of row) if (ch !== TRANSPARENT) used.add(ch);
  return [...used].sort();
}

/** Parses and validates art/<id>.txt: exactly 16 lines of 16 known characters, ≤ 8 colors. */
export function parseSprite(id: string, text: string, palette: Palette): Sprite {
  const source = `art/${id}.txt`;
  if (!SPRITE_ID.test(id)) {
    throw new Error(`${source}: sprite ids are lowercase words joined by "-"`);
  }
  const size = PLACEHOLDER_SIZE;
  const rows = textLines(text);
  if (rows.length !== size) {
    throw new Error(
      `${source} has ${rows.length} lines; a sprite is exactly ${size} lines of ${size} characters`,
    );
  }
  rows.forEach((row, y) => {
    if (row.length !== size) {
      throw new Error(
        `${source} line ${y + 1} has ${row.length} characters; every line needs exactly ${size}`,
      );
    }
    for (let x = 0; x < size; x++) {
      const ch = row.charAt(x);
      if (ch !== TRANSPARENT && !palette.has(ch)) {
        throw new Error(
          `${source} line ${y + 1}, column ${x + 1}: "${ch}" is not in art/${PALETTE_FILE}`,
        );
      }
    }
  });
  const sprite: Sprite = { id, rows };
  const colors = spriteColors(sprite);
  if (colors.length > MAX_SPRITE_COLORS) {
    throw new Error(
      `${source} uses ${colors.length} colors (${colors.join(' ')}); the limit is ${MAX_SPRITE_COLORS} per sprite`,
    );
  }
  return sprite;
}

/** A placeholder's pixels at 16×16. */
export function rasterize(sprite: Sprite, palette: Palette): RgbaImage {
  const size = PLACEHOLDER_SIZE;
  const rgba = new Uint8Array(size * size * 4);
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < size; x++) {
      const ch = row.charAt(x);
      if (ch === TRANSPARENT) continue;
      const color = palette.get(ch);
      if (!color) throw new Error(`"${sprite.id}" uses "${ch}", not in the palette`);
      rgba.set(color, (y * size + x) * 4);
    }
  });
  return { width: size, height: size, rgba };
}

/** Scales an image up by a whole factor with nearest neighbor: each pixel becomes k × k. */
export function scaleNearest(image: RgbaImage, k: number): RgbaImage {
  if (!Number.isInteger(k) || k < 1) throw new Error(`scaleNearest: bad factor ${k}`);
  const width = image.width * k;
  const height = image.height * k;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (Math.floor(y / k) * image.width + Math.floor(x / k)) * 4;
      rgba.set(image.rgba.subarray(src, src + 4), (y * width + x) * 4);
    }
  }
  return { width, height, rgba };
}

/** A placeholder as the atlas packs it: doubled to one 32 px cell. */
export function placeholderInput(sprite: Sprite, palette: Palette): PackInput {
  const image = scaleNearest(rasterize(sprite, palette), PLACEHOLDER_SCALE);
  return { id: sprite.id, image, w: image.width, h: image.height, frames: 1 };
}

/** Reads and validates art/: the palette and every sprite, sorted by id. */
export function readArt(artDir: string): { palette: Palette; sprites: Sprite[] } {
  const palette = parsePalette(readFileSync(join(artDir, PALETTE_FILE), 'utf8'));
  const sprites = readdirSync(artDir)
    .filter((name) => name.endsWith('.txt') && name !== PALETTE_FILE)
    .sort()
    .map((name) => {
      const id = name.slice(0, -'.txt'.length);
      return parseSprite(id, readFileSync(join(artDir, name), 'utf8'), palette);
    });
  return { palette, sprites };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWhole(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

/** Parses and validates assets/limezu/index.json. */
export function parseCutIndex(text: string, source = 'assets/limezu/index.json'): CutIndex {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(raw)) throw new Error(`${source}: expected an object of cuts by id`);
  const index: Record<string, CutRecord> = {};
  for (const [id, value] of Object.entries(raw)) {
    const where = `${source}: "${id}"`;
    if (!SPRITE_ID.test(id)) throw new Error(`${where}: ids are lowercase words joined by "-"`);
    if (!isRecord(value)) throw new Error(`${where}: expected an object`);
    const { w, h, frames, ms, spec, ...rest } = value;
    const extra = Object.keys(rest);
    if (extra.length > 0) throw new Error(`${where}: unknown field "${extra[0]}"`);
    if (!isWhole(w, 1) || !isWhole(h, 1)) throw new Error(`${where}: w and h must be whole, ≥ 1`);
    if (typeof spec !== 'string' || spec === '') throw new Error(`${where}: spec must be a hash`);
    if (frames === undefined && ms === undefined) {
      index[id] = { w, h, spec };
    } else if (isWhole(frames, 2) && isWhole(ms, 1)) {
      index[id] = { w, h, frames, ms, spec };
    } else {
      throw new Error(`${where}: an animation needs frames (≥ 2) and ms (≥ 1)`);
    }
  }
  return index;
}

/**
 * Reads the committed LimeZu cuts in assets/limezu/: index.json and one <id>.png per entry,
 * each checked against its recorded size. No folder or no index means no cuts yet.
 */
export function readCuts(dir: string): PackInput[] {
  const indexPath = join(dir, 'index.json');
  if (!existsSync(dir)) return [];
  const pngs = readdirSync(dir).filter((name) => name.endsWith('.png'));
  if (!existsSync(indexPath)) {
    if (pngs.length === 0) return [];
    throw new Error(`assets/limezu/ has cuts but no index.json: run \`npm run art:cut\``);
  }
  const index = parseCutIndex(readFileSync(indexPath, 'utf8'));
  for (const name of pngs) {
    if (!Object.hasOwn(index, name.slice(0, -'.png'.length))) {
      throw new Error(`assets/limezu/${name} isn't in index.json: run \`npm run art:cut\``);
    }
  }
  return Object.keys(index)
    .sort(byString)
    .map((id) => {
      const record = index[id]!;
      const file = `assets/limezu/${id}.png`;
      const path = join(dir, `${id}.png`);
      if (!existsSync(path)) throw new Error(`${file} is missing: run \`npm run art:cut\``);
      const image = decodePng(readFileSync(path), file);
      const frames = record.frames ?? 1;
      if (image.width !== record.w * frames || image.height !== record.h) {
        throw new Error(
          `${file} is ${image.width}×${image.height}; index.json says ${frames} × ${record.w}×${record.h}`,
        );
      }
      return {
        id,
        image,
        w: record.w,
        h: record.h,
        frames,
        ...(record.ms ? { ms: record.ms } : {}),
      };
    });
}

/** The placeholders, with each LimeZu cut replacing the placeholder that has its id. */
export function mergeSprites(
  placeholders: readonly PackInput[],
  cuts: readonly PackInput[],
): PackInput[] {
  const byId = new Map<string, PackInput>();
  for (const p of placeholders) byId.set(p.id, p);
  for (const c of cuts) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => byString(a.id, b.id));
}

/** Rounds up to an even number. */
function even(n: number): number {
  return n + (n & 1);
}

/**
 * Shelf-packs sprites into one atlas. Each frame gets its own slot of (w + 2) × (h + 2),
 * rounded up to even sizes; slots are placed tallest first, then by id, left to right in
 * shelves, starting at odd coordinates, so every sprite's pixels start at even x and y (a whole
 * number of CSS pixels at any whole or half scale). The width is the smallest power of two of at
 * least 256 that's as wide as the slots' total area is square, or the widest slot.
 * Pure: the same sprites always give the same pixels and JSON, in any input order.
 */
export function packAtlas(inputs: readonly PackInput[]): Atlas {
  if (inputs.length === 0) throw new Error('packAtlas: no sprites to pack');
  const seen = new Set<string>();
  for (const s of inputs) {
    if (seen.has(s.id)) throw new Error(`packAtlas: "${s.id}" appears twice`);
    seen.add(s.id);
    if (!isWhole(s.w, 1) || !isWhole(s.h, 1) || !isWhole(s.frames, 1)) {
      throw new Error(`packAtlas: "${s.id}" has a bad size`);
    }
    if (s.image.width !== s.w * s.frames || s.image.height !== s.h) {
      throw new Error(
        `packAtlas: "${s.id}" is ${s.image.width}×${s.image.height}, not ${s.frames} × ${s.w}×${s.h}`,
      );
    }
    if (s.frames > 1 && !isWhole(s.ms, 1)) {
      throw new Error(`packAtlas: "${s.id}" is animated but has no ms`);
    }
  }

  const slots = inputs.map((s) => {
    const frameW = even(s.w + 2 * EXTRUDE);
    return { s, frameW, w: frameW * s.frames, h: even(s.h + 2 * EXTRUDE), x: 0, y: 0 };
  });
  slots.sort((a, b) => b.h - a.h || byString(a.s.id, b.s.id));

  const area = slots.reduce((sum, slot) => sum + slot.w * slot.h, 0);
  const widest = Math.max(...slots.map((slot) => slot.w));
  let width = MIN_ATLAS_WIDTH;
  while (width * width < area || width < widest + 2 * MARGIN) width *= 2;

  // Shelves: slots go left to right; one that doesn't fit starts a new shelf below. The first
  // slot on a shelf is its tallest, since slots come tallest first.
  let x = MARGIN;
  let y = MARGIN;
  let shelf = 0;
  for (const slot of slots) {
    if (x + slot.w > width - MARGIN) {
      y += shelf;
      x = MARGIN;
      shelf = 0;
    }
    slot.x = x;
    slot.y = y;
    x += slot.w;
    shelf = Math.max(shelf, slot.h);
  }
  const height = y + shelf + MARGIN;

  const rgba = new Uint8Array(width * height * 4);
  const sprites: Record<string, AtlasSprite> = {};
  for (const { s, frameW, x: slotX, y: slotY } of slots) {
    const ox = slotX + EXTRUDE;
    const oy = slotY + EXTRUDE;
    for (let k = 0; k < s.frames; k++) {
      // Border pixels clamp to the nearest edge pixel of the same frame: that's the extrusion.
      for (let py = -EXTRUDE; py < s.h + EXTRUDE; py++) {
        const sy = Math.min(s.h - 1, Math.max(0, py));
        for (let px = -EXTRUDE; px < s.w + EXTRUDE; px++) {
          const sx = Math.min(s.w - 1, Math.max(0, px));
          const src = (sy * s.image.width + k * s.w + sx) * 4;
          const dst = ((oy + py) * width + ox + k * frameW + px) * 4;
          rgba.set(s.image.rgba.subarray(src, src + 4), dst);
        }
      }
    }
    sprites[s.id] = {
      x: ox,
      y: oy,
      w: s.w,
      h: s.h,
      ...(s.frames > 1 ? { frames: s.frames, stride: frameW, ms: s.ms! } : {}),
    };
  }

  const json: AtlasJson = { version: 2, cell: ART_CELL, width, height, sprites: {} };
  for (const id of Object.keys(sprites).sort(byString)) json.sprites[id] = sprites[id]!;
  return { width, height, rgba, json };
}

/** Everything `npm run atlas` packs, from art/ and assets/limezu/ under the repo root. */
export function readAtlasInputs(root: string): { inputs: PackInput[]; cuts: number } {
  const { palette, sprites } = readArt(join(root, 'art'));
  const placeholders = sprites.map((sprite) => placeholderInput(sprite, palette));
  const cuts = readCuts(join(root, 'assets', 'limezu'));
  return { inputs: mergeSprites(placeholders, cuts), cuts: cuts.length };
}

/** The text written to assets/atlas.json. */
export function atlasJsonText(json: AtlasJson): string {
  return `${JSON.stringify(json, null, 2)}\n`;
}

function main(): void {
  const root = resolve(import.meta.dirname, '..');
  const { inputs, cuts } = readAtlasInputs(root);
  const atlas = packAtlas(inputs);
  writeFileSync(
    join(root, 'assets', 'atlas.png'),
    encodePng(atlas.width, atlas.height, atlas.rgba),
  );
  writeFileSync(join(root, 'assets', 'atlas.json'), atlasJsonText(atlas.json));
  console.log(
    `atlas: ${inputs.length} sprites (${cuts} of them LimeZu cuts) → assets/atlas.png (${atlas.width}×${atlas.height}) and assets/atlas.json`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `npm run atlas failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
