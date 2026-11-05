// Builds the sprite atlas (implementation-plan.md §3 "Scripts" and §12 "Art", D-057).
//
// Sources: art/palette.txt maps one character to a color, and each art/<id>.txt is a 16×16
// grid of palette characters, with '.' for transparent. The script validates every sprite,
// packs them in id order into a grid of 18×18 cells (the sprite plus a 1px border that repeats
// its edge pixels, so fractional screen scales show no seams), and writes assets/atlas.png and
// assets/atlas.json. The UI reads sprite positions from atlas.json by id.
//
// Run it with `npm run atlas` (plain `node scripts/build-atlas.ts`). `npm run build` runs it
// first. No npm dependencies: the PNG encoder below uses node:zlib.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

/** Sprite size in pixels. */
export const TILE = 16;
/** Border repeated around each sprite. */
export const EXTRUDE = 1;
/** Atlas cell size: the sprite plus its border on both sides. */
export const CELL = TILE + 2 * EXTRUDE;
export const MAX_PALETTE_COLORS = 32;
export const MAX_SPRITE_COLORS = 8;
export const TRANSPARENT = '.';
const PALETTE_FILE = 'palette.txt';

export type Rgba = readonly [r: number, g: number, b: number, a: number];
/** Palette character → color. */
export type Palette = ReadonlyMap<string, Rgba>;

export interface Sprite {
  readonly id: string;
  /** 16 rows of 16 palette characters ('.' = transparent). */
  readonly rows: readonly string[];
}

export interface AtlasJson {
  tile: number;
  cell: number;
  width: number;
  height: number;
  /** The top-left pixel of each sprite, inside its extruded border. */
  sprites: Record<string, { x: number; y: number }>;
}

export interface Atlas {
  readonly width: number;
  readonly height: number;
  /** width × height RGBA pixels, row-major. */
  readonly rgba: Uint8Array;
  readonly json: AtlasJson;
}

/** Splits a text file into lines, accepting CRLF and one trailing newline. */
function textLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
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
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`${source}: sprite ids are lowercase words joined by "-"`);
  }
  const rows = textLines(text);
  if (rows.length !== TILE) {
    throw new Error(
      `${source} has ${rows.length} lines; a sprite is exactly ${TILE} lines of ${TILE} characters`,
    );
  }
  rows.forEach((row, y) => {
    if (row.length !== TILE) {
      throw new Error(
        `${source} line ${y + 1} has ${row.length} characters; every line needs exactly ${TILE}`,
      );
    }
    for (let x = 0; x < TILE; x++) {
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

function byId(a: Sprite, b: Sprite): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Packs sprites, sorted by id, into a roughly square grid of extruded cells.
 * Pure: the same sprites and palette always give the same pixels and JSON.
 */
export function packAtlas(sprites: readonly Sprite[], palette: Palette): Atlas {
  if (sprites.length === 0) throw new Error('packAtlas: no sprites to pack');
  const sorted = [...sprites].sort(byId);
  sorted.forEach((s, i) => {
    if (i > 0 && sorted[i - 1]!.id === s.id) throw new Error(`packAtlas: "${s.id}" appears twice`);
  });

  const columns = Math.ceil(Math.sqrt(sorted.length));
  const rowsOfCells = Math.ceil(sorted.length / columns);
  const width = columns * CELL;
  const height = rowsOfCells * CELL;
  const rgba = new Uint8Array(width * height * 4);
  const json: AtlasJson = { tile: TILE, cell: CELL, width, height, sprites: {} };

  sorted.forEach((sprite, i) => {
    const cellX = (i % columns) * CELL;
    const cellY = Math.floor(i / columns) * CELL;
    for (let py = 0; py < CELL; py++) {
      // Border pixels clamp to the nearest edge pixel: that is the extrusion.
      const sy = Math.min(TILE - 1, Math.max(0, py - EXTRUDE));
      const row = sprite.rows[sy]!;
      for (let px = 0; px < CELL; px++) {
        const sx = Math.min(TILE - 1, Math.max(0, px - EXTRUDE));
        const ch = row.charAt(sx);
        if (ch === TRANSPARENT) continue;
        const color = palette.get(ch);
        if (!color) throw new Error(`packAtlas: "${sprite.id}" uses "${ch}", not in the palette`);
        rgba.set(color, ((cellY + py) * width + cellX + px) * 4);
      }
    }
    json.sprites[sprite.id] = { x: cellX + EXTRUDE, y: cellY + EXTRUDE };
  });

  return { width, height, rgba, json };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** The CRC-32 that PNG chunks use (ISO 3309, polynomial 0xEDB88320). */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeAndData.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + data.length);
  return chunk;
}

/** Encodes RGBA pixels as a PNG: 8-bit RGBA, no interlace, filter type 0 on every row. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`encodePng: bad size ${width}×${height}`);
  }
  if (rgba.length !== width * height * 4) {
    throw new Error(`encodePng: expected ${width * height * 4} bytes of RGBA, got ${rgba.length}`);
  }
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

/** The text written to assets/atlas.json. */
export function atlasJsonText(json: AtlasJson): string {
  return `${JSON.stringify(json, null, 2)}\n`;
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
  // Final art (M2+): sprites cut from the LimeZu packs in art-source/ plug in here. The script
  // will find art-source/ in the main checkout through `git rev-parse --git-common-dir`, cut
  // each sprite into the same 16×16 form under the same ids, and add it to `sprites`, so the
  // UI needs no change. CI has no art-source/, so the cut sprites will be committed to assets/.
  return { palette, sprites };
}

function main(): void {
  const root = resolve(import.meta.dirname, '..');
  const { palette, sprites } = readArt(join(root, 'art'));
  const atlas = packAtlas(sprites, palette);
  writeFileSync(
    join(root, 'assets', 'atlas.png'),
    encodePng(atlas.width, atlas.height, atlas.rgba),
  );
  writeFileSync(join(root, 'assets', 'atlas.json'), atlasJsonText(atlas.json));
  console.log(
    `atlas: ${sprites.length} sprites, ${palette.size} colors → assets/atlas.png (${atlas.width}×${atlas.height}) and assets/atlas.json`,
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
