import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  CELL,
  EXTRUDE,
  MAX_SPRITE_COLORS,
  PNG_SIGNATURE,
  TILE,
  crc32,
  encodePng,
  packAtlas,
  parsePalette,
  parseSprite,
  readArt,
  spriteColors,
  type AtlasJson,
  type Sprite,
} from './build-atlas.ts';

const root = resolve(import.meta.dirname, '..');
const { palette, sprites } = readArt(join(root, 'art'));

/** Terrain and floors tile edge to edge, so they must be fully opaque. */
const OPAQUE = [
  'grass-0',
  'grass-1',
  'grass-2',
  'grass-sunny',
  'water-0',
  'water-1',
  'street',
  'sidewalk',
  'floor-wood',
  'floor-tile',
  'floor-kitchen',
  'floor-parquet',
  'floor-carpet',
  'lawn',
];
/** Overlays and furniture sit on top of a tile, on a transparent background. */
const OVERLAYS = ['tree', 'boulder', 'bed', 'tub', 'stove', 'table', 'sofa', 'flowers'];
/** Every id the UI references (src/ui/sprites.ts and the terrain layer). */
const REQUIRED = [...OPAQUE, ...OVERLAYS];

const row = (s: string) => s.padEnd(TILE, '.');
const blank = () => Array.from({ length: TILE }, () => '.'.repeat(TILE));

interface Decoded {
  width: number;
  height: number;
  rgba: Uint8Array;
  chunks: { type: string; data: Buffer }[];
}

/** Decodes the PNGs encodePng writes: 8-bit RGBA, filter type 0 on every row. */
function decodePng(png: Buffer): Decoded {
  expect([...png.subarray(0, 8)]).toEqual([...PNG_SIGNATURE]);
  const chunks: Decoded['chunks'] = [];
  let off = 8;
  while (off < png.length) {
    const length = png.readUInt32BE(off);
    const type = png.toString('latin1', off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + length);
    const crc = png.readUInt32BE(off + 8 + length);
    expect(crc, `${type} CRC`).toBe(crc32(png.subarray(off + 4, off + 8 + length)));
    chunks.push({ type, data });
    off += 12 + length;
  }
  const ihdr = chunks[0]!;
  expect(ihdr.type).toBe('IHDR');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  expect([...ihdr.data.subarray(8)]).toEqual([8, 6, 0, 0, 0]);
  expect(chunks.at(-1)?.type).toBe('IEND');
  const raw = inflateSync(
    Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)),
  );
  const stride = width * 4;
  expect(raw.length).toBe((stride + 1) * height);
  const rgba = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (stride + 1)], `row ${y} filter`).toBe(0);
    rgba.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride);
  }
  return { width, height, rgba, chunks };
}

function pixel(rgba: Uint8Array, width: number, x: number, y: number): number[] {
  const i = (y * width + x) * 4;
  return [...rgba.subarray(i, i + 4)];
}

describe('the art in art/', () => {
  it('uses one shared palette of 24-32 colors', () => {
    expect(palette.size).toBeGreaterThanOrEqual(24);
    expect(palette.size).toBeLessThanOrEqual(32);
  });

  it('has every sprite the UI references', () => {
    const ids = sprites.map((s) => s.id);
    for (const id of REQUIRED) expect(ids, id).toContain(id);
  });

  it('has 16×16 sprites with at most 8 colors each', () => {
    for (const sprite of sprites) {
      expect(sprite.rows, sprite.id).toHaveLength(TILE);
      for (const r of sprite.rows) expect(r, sprite.id).toHaveLength(TILE);
      expect(spriteColors(sprite).length, sprite.id).toBeLessThanOrEqual(MAX_SPRITE_COLORS);
    }
  });

  it('keeps terrain and floors opaque and overlays on a transparent background', () => {
    const byId = new Map(sprites.map((s) => [s.id, s]));
    for (const id of OPAQUE) {
      expect(byId.get(id)!.rows.join(''), id).not.toContain('.');
    }
    for (const id of OVERLAYS) {
      const rows = byId.get(id)!.rows;
      expect(rows[0]!.charAt(0) + rows[TILE - 1]!.charAt(0), id).toBe('..');
    }
  });
});

describe('parsePalette', () => {
  it('reads characters, colors, comments, and descriptions', () => {
    const p = parsePalette('# comment\n\na #2E2a24  outline\r\nb #ffffff\n');
    expect([...p.entries()]).toEqual([
      ['a', [0x2e, 0x2a, 0x24, 255]],
      ['b', [255, 255, 255, 255]],
    ]);
  });

  it('rejects bad lines, the transparent character, duplicates, and too many colors', () => {
    expect(() => parsePalette('a 2e2a24')).toThrow(/line 1: expected "<char> #rrggbb"/);
    expect(() => parsePalette('. #000000')).toThrow(/reserved for transparent/);
    expect(() => parsePalette('a #000000\na #111111')).toThrow(/line 2: "a" is defined twice/);
    expect(() => parsePalette('a #000000\nb #000000')).toThrow(/already "a"/);
    const many = Array.from(
      { length: 33 },
      (_, i) => `${String.fromCharCode(65 + i)} #0000${(i + 16).toString(16)}`,
    );
    expect(() => parsePalette(many.join('\n'))).toThrow(/33 colors; .* at most 32/);
  });
});

describe('parseSprite', () => {
  const p = parsePalette(
    'a #000000\nb #111111\nc #222222\nd #333333\ne #444444\nf #555555\ng #666666\nh #777777\ni #888888',
  );

  it('accepts 16 lines of 16 characters with a trailing newline', () => {
    const rows = blank();
    rows[3] = row('..ab');
    expect(parseSprite('thing-1', rows.join('\n') + '\n', p).rows).toEqual(rows);
  });

  it('names the file, line, and column of a problem', () => {
    expect(() => parseSprite('bad', blank().slice(1).join('\n'), p)).toThrow(
      'art/bad.txt has 15 lines; a sprite is exactly 16 lines of 16 characters',
    );
    const short = blank();
    short[4] = '.'.repeat(15);
    expect(() => parseSprite('bad', short.join('\n'), p)).toThrow(
      'art/bad.txt line 5 has 15 characters; every line needs exactly 16',
    );
    const unknown = blank();
    unknown[2] = row('...Z');
    expect(() => parseSprite('bad', unknown.join('\n'), p)).toThrow(
      'art/bad.txt line 3, column 4: "Z" is not in art/palette.txt',
    );
    const colorful = blank();
    colorful[0] = row('abcdefghi');
    expect(() => parseSprite('bad', colorful.join('\n'), p)).toThrow(
      'art/bad.txt uses 9 colors (a b c d e f g h i); the limit is 8 per sprite',
    );
    expect(() => parseSprite('Bad_Name', blank().join('\n'), p)).toThrow(/lowercase words/);
  });
});

describe('packAtlas', () => {
  const atlas = packAtlas(sprites, palette);

  it('packs every sprite, in id order, into a roughly square grid of 18×18 cells', () => {
    const ids = Object.keys(atlas.json.sprites);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toHaveLength(sprites.length);
    expect(atlas.json.tile).toBe(TILE);
    expect(atlas.json.cell).toBe(CELL);
    expect(atlas.width % CELL).toBe(0);
    expect(atlas.height % CELL).toBe(0);
    expect(Math.abs(atlas.width - atlas.height)).toBeLessThanOrEqual(CELL);
    for (const { x, y } of Object.values(atlas.json.sprites)) {
      expect((x - EXTRUDE) % CELL).toBe(0);
      expect((y - EXTRUDE) % CELL).toBe(0);
    }
  });

  it('draws each sprite with palette colors and transparent dots', () => {
    for (const sprite of sprites) {
      const { x, y } = atlas.json.sprites[sprite.id]!;
      for (let sy = 0; sy < TILE; sy++) {
        for (let sx = 0; sx < TILE; sx++) {
          const ch = sprite.rows[sy]!.charAt(sx);
          const want = ch === '.' ? [0, 0, 0, 0] : [...palette.get(ch)!];
          expect(pixel(atlas.rgba, atlas.width, x + sx, y + sy)).toEqual(want);
        }
      }
    }
  });

  it('extrudes a 1px border that repeats each sprite’s edge pixels', () => {
    const p = parsePalette('a #ff0000\nb #00ff00\nc #0000ff\nd #ffff00');
    const rows = Array.from({ length: TILE }, (_, y) =>
      Array.from({ length: TILE }, (_, x) => 'abcd'.charAt((x * 3 + y * 5) % 4)).join(''),
    );
    for (const { rgba, width, json } of [packAtlas([{ id: 'edges', rows }], p), atlas]) {
      for (const [id, { x, y }] of Object.entries(json.sprites)) {
        const at = (dx: number, dy: number) => pixel(rgba, width, x + dx, y + dy);
        for (let i = 0; i < TILE; i++) {
          expect(at(-1, i), `${id} left ${i}`).toEqual(at(0, i));
          expect(at(TILE, i), `${id} right ${i}`).toEqual(at(TILE - 1, i));
          expect(at(i, -1), `${id} top ${i}`).toEqual(at(i, 0));
          expect(at(i, TILE), `${id} bottom ${i}`).toEqual(at(i, TILE - 1));
        }
        expect(at(-1, -1), `${id} corner`).toEqual(at(0, 0));
        expect(at(TILE, TILE), `${id} corner`).toEqual(at(TILE - 1, TILE - 1));
      }
    }
  });

  it('rejects duplicate ids', () => {
    const s: Sprite = { id: 'twin', rows: blank() };
    expect(() => packAtlas([s, s], palette)).toThrow(/"twin" appears twice/);
  });
});

describe('encodePng', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082);
  });

  it('writes a PNG whose IDAT inflates back to the pixels', () => {
    const rgba = Uint8Array.from({ length: 3 * 2 * 4 }, (_, i) => (i * 37) % 256);
    const png = encodePng(3, 2, rgba);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const decoded = decodePng(png);
    expect(decoded.chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect([decoded.width, decoded.height]).toEqual([3, 2]);
    expect([...decoded.rgba]).toEqual([...rgba]);
  });

  it('rejects a buffer of the wrong size', () => {
    expect(() => encodePng(2, 2, new Uint8Array(15))).toThrow(/expected 16 bytes/);
  });
});

describe('the committed atlas', () => {
  // These fail when art/ changed without `npm run atlas`.
  const atlas = packAtlas(sprites, palette);

  it('assets/atlas.json matches art/', () => {
    const committed = JSON.parse(
      readFileSync(join(root, 'assets', 'atlas.json'), 'utf8'),
    ) as AtlasJson;
    expect(committed, 'run `npm run atlas` and commit assets/').toEqual(atlas.json);
  });

  it('assets/atlas.png matches art/', () => {
    const decoded = decodePng(readFileSync(join(root, 'assets', 'atlas.png')));
    expect([decoded.width, decoded.height]).toEqual([atlas.width, atlas.height]);
    expect(Buffer.from(decoded.rgba).equals(Buffer.from(atlas.rgba)), 'run `npm run atlas`').toBe(
      true,
    );
  });
});
