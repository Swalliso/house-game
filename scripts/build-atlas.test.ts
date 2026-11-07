import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ART_CELL,
  EXTRUDE,
  MAX_SPRITE_COLORS,
  MIN_ATLAS_WIDTH,
  PLACEHOLDER_SIZE,
  mergeSprites,
  packAtlas,
  parseCutIndex,
  parsePalette,
  parseSprite,
  placeholderInput,
  rasterize,
  readArt,
  readAtlasInputs,
  readCuts,
  scaleNearest,
  spriteColors,
  type Atlas,
  type AtlasJson,
  type PackInput,
} from './build-atlas.ts';
import { decodePng, encodePng, type RgbaImage } from './png.ts';

const root = resolve(import.meta.dirname, '..');
const { palette, sprites } = readArt(join(root, 'art'));
const SIZE = PLACEHOLDER_SIZE;

/**
 * Terrain and floors tile edge to edge, so they must be fully opaque: every floor, grass, and
 * water sprite, placeholder or cut, and the street, sidewalk, and lawn.
 */
function isOpaque(id: string): boolean {
  return /^(floor|grass|water)-/.test(id) || ['street', 'sidewalk', 'lawn'].includes(id);
}
/** Overlays and furniture sit on top of a tile, on a transparent background. */
const OVERLAYS = ['tree', 'bed', 'tub', 'stove', 'table', 'sofa', 'flowers'];
/**
 * Ids the UI references by name (src/ui/sprites.ts, the terrain layer, the title screen) that
 * have a placeholder. Sprites that only exist as LimeZu cuts (autotile sets, the water's
 * frames, the lot's overlays) need none: the committed cuts are always there.
 */
const REQUIRED = [
  'grass-0',
  'grass-1',
  'grass-2',
  'grass-sunny',
  'street',
  'sidewalk',
  'floor-wood',
  'floor-tile',
  'floor-kitchen',
  'floor-parquet',
  'floor-carpet',
  'lawn',
  ...OVERLAYS,
];

const row = (s: string) => s.padEnd(SIZE, '.');
const blank = () => Array.from({ length: SIZE }, () => '.'.repeat(SIZE));

function pixel(image: { rgba: Uint8Array; width: number }, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return [...image.rgba.subarray(i, i + 4)];
}

/** An image whose every pixel differs, from a seed, so misplaced pixels show. */
function noise(width: number, height: number, seed: number, alpha = 255): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba.set(
      [(i * 7 + seed) % 256, (i * 13 + seed * 3) % 256, (seed * 31 + i) % 256, alpha],
      i * 4,
    );
  }
  return { width, height, rgba };
}

function input(id: string, w: number, h: number, seed: number, frames = 1): PackInput {
  return {
    id,
    image: noise(w * frames, h, seed),
    w,
    h,
    frames,
    ...(frames > 1 ? { ms: 100 } : {}),
  };
}

/** Checks a packed sprite's pixels and its 1px border, frame by frame, a row at a time. */
function expectPacked(atlas: Atlas, s: PackInput): void {
  const at = atlas.json.sprites[s.id]!;
  expect([at.w, at.h], s.id).toEqual([s.w, s.h]);
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  for (let k = 0; k < s.frames; k++) {
    const fx = at.x + k * (at.stride ?? 0);
    for (let y = -EXTRUDE; y < s.h + EXTRUDE; y++) {
      const want: number[] = [];
      for (let x = -EXTRUDE; x < s.w + EXTRUDE; x++) {
        want.push(...pixel(s.image, k * s.w + clamp(x, s.w - 1), clamp(y, s.h - 1)));
      }
      const start = ((at.y + y) * atlas.width + fx - EXTRUDE) * 4;
      const got = [...atlas.rgba.subarray(start, start + want.length)];
      expect(got, `${s.id} frame ${k}, row ${y} with its border`).toEqual(want);
    }
  }
}

describe('the art in art/', () => {
  it('uses one shared palette of 24-32 colors', () => {
    expect(palette.size).toBeGreaterThanOrEqual(24);
    expect(palette.size).toBeLessThanOrEqual(32);
  });

  it('has a placeholder for every sprite the UI references', () => {
    const ids = sprites.map((s) => s.id);
    for (const id of REQUIRED) expect(ids, id).toContain(id);
  });

  it('has 16×16 placeholders with at most 8 colors each', () => {
    for (const sprite of sprites) {
      expect(sprite.rows, sprite.id).toHaveLength(SIZE);
      for (const r of sprite.rows) expect(r, sprite.id).toHaveLength(SIZE);
      expect(spriteColors(sprite).length, sprite.id).toBeLessThanOrEqual(MAX_SPRITE_COLORS);
    }
  });

  it('keeps terrain and floors opaque and overlays on a transparent background', () => {
    const byId = new Map(sprites.map((s) => [s.id, s]));
    for (const sprite of sprites.filter((s) => isOpaque(s.id))) {
      expect(sprite.rows.join(''), sprite.id).not.toContain('.');
    }
    for (const id of OVERLAYS) {
      const rows = byId.get(id)!.rows;
      expect(rows[0]!.charAt(0) + rows[SIZE - 1]!.charAt(0), id).toBe('..');
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

describe('placeholders in the atlas', () => {
  it('are doubled to one 32 px cell with nearest neighbor', () => {
    expect(ART_CELL).toBe(2 * SIZE);
    for (const sprite of sprites) {
      const small = rasterize(sprite, palette);
      const doubled = placeholderInput(sprite, palette);
      expect([doubled.w, doubled.h, doubled.frames]).toEqual([ART_CELL, ART_CELL, 1]);
      const want: number[] = [];
      for (let y = 0; y < ART_CELL; y++) {
        for (let x = 0; x < ART_CELL; x++) want.push(...pixel(small, x >> 1, y >> 1));
      }
      expect([...doubled.image.rgba], sprite.id).toEqual(want);
    }
  });

  it('draw palette colors, and transparent dots', () => {
    const sprite = sprites.find((s) => s.id === 'tree')!;
    const small = rasterize(sprite, palette);
    sprite.rows.forEach((r, y) => {
      for (let x = 0; x < SIZE; x++) {
        const ch = r.charAt(x);
        expect(pixel(small, x, y)).toEqual(ch === '.' ? [0, 0, 0, 0] : [...palette.get(ch)!]);
      }
    });
  });

  it('scaleNearest repeats each pixel k × k', () => {
    const image = noise(3, 2, 1);
    const big = scaleNearest(image, 3);
    expect([big.width, big.height]).toEqual([9, 6]);
    expect(pixel(big, 8, 5)).toEqual(pixel(image, 2, 1));
    expect(pixel(big, 3, 2)).toEqual(pixel(image, 1, 0));
    expect(() => scaleNearest(image, 1.5)).toThrow(/bad factor/);
  });
});

describe('packAtlas', () => {
  const inputs = [
    input('wide-thing', 48, 29, 1),
    input('tall-thing', 26, 40, 2),
    input('cell-a', 32, 32, 3),
    input('cell-b', 32, 32, 4),
    input('tiny', 3, 5, 5),
    input('odd-size', 15, 33, 6),
    input('water', 32, 32, 7, 4),
  ];
  const atlas = packAtlas(inputs);

  it('writes version 2: every sprite by id, with its rect, and frames for animations', () => {
    const json: AtlasJson = atlas.json;
    expect(json.version).toBe(2);
    expect(json.cell).toBe(ART_CELL);
    expect([json.width, json.height]).toEqual([atlas.width, atlas.height]);
    expect(Object.keys(json.sprites)).toEqual(inputs.map((s) => s.id).sort());
    expect(json.sprites['tiny']).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
      w: 3,
      h: 5,
    });
    expect(json.sprites['water']).toMatchObject({ w: 32, h: 32, frames: 4, ms: 100, stride: 34 });
  });

  it('draws every sprite, and every frame, with a 1px border of its own edge pixels', () => {
    expect(EXTRUDE).toBe(1);
    for (const s of inputs) expectPacked(atlas, s);
  });

  it('places sprites at even coordinates, in a power-of-two width, without overlaps', () => {
    expect(atlas.width % 2).toBe(0);
    expect(atlas.height % 2).toBe(0);
    expect(Math.log2(atlas.width) % 1).toBe(0);
    expect(atlas.width).toBeGreaterThanOrEqual(MIN_ATLAS_WIDTH);
    const boxes = Object.entries(atlas.json.sprites).map(([id, s]) => {
      expect(s.x % 2, `${id} x`).toBe(0);
      expect(s.y % 2, `${id} y`).toBe(0);
      const frames = s.frames ?? 1;
      const stride = s.stride ?? s.w + 2;
      // The sprite with its border: [x0, x1) × [y0, y1).
      return {
        id,
        x0: s.x - 1,
        y0: s.y - 1,
        x1: s.x + (frames - 1) * stride + s.w + 1,
        y1: s.y + s.h + 1,
      };
    });
    for (const a of boxes) {
      expect(a.x0, a.id).toBeGreaterThanOrEqual(0);
      expect(a.y0, a.id).toBeGreaterThanOrEqual(0);
      expect(a.x1, a.id).toBeLessThanOrEqual(atlas.width);
      expect(a.y1, a.id).toBeLessThanOrEqual(atlas.height);
      for (const b of boxes) {
        if (a === b) continue;
        const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });

  it('is deterministic: any input order gives the same atlas', () => {
    const again = packAtlas([...inputs].reverse());
    expect(again.json).toEqual(atlas.json);
    expect(Buffer.from(again.rgba).equals(Buffer.from(atlas.rgba))).toBe(true);
  });

  it('grows past 256 wide when the sprites need it', () => {
    const many = Array.from({ length: 80 }, (_, i) => input(`cell-${i}`, 32, 32, i));
    expect(packAtlas(many).width).toBe(512);
    expect(packAtlas([input('long', 300, 4, 1)]).width).toBe(512);
  });

  it('rejects duplicates, wrong sizes, and animations without timing', () => {
    expect(() => packAtlas([input('twin', 4, 4, 1), input('twin', 4, 4, 2)])).toThrow(
      /"twin" appears twice/,
    );
    expect(() => packAtlas([{ ...input('bad', 4, 4, 1), w: 5 }])).toThrow(
      /"bad" is 4×4, not 1 × 5×4/,
    );
    const anim = input('anim', 4, 4, 1, 2);
    const noTiming: PackInput = { id: anim.id, image: anim.image, w: 4, h: 4, frames: 2 };
    expect(() => packAtlas([noTiming])).toThrow(/"anim" is animated but has no ms/);
    expect(() => packAtlas([])).toThrow(/no sprites/);
  });
});

describe('LimeZu cuts in the atlas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'open-house-atlas-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('replace the placeholder with the same id, and keep the others', () => {
    const placeholders = [input('grass-0', 32, 32, 1), input('tree', 32, 32, 2)];
    const cut = input('grass-0', 32, 32, 3);
    const merged = mergeSprites(placeholders, [cut, input('floor-new', 32, 32, 4)]);
    expect(merged.map((s) => s.id)).toEqual(['floor-new', 'grass-0', 'tree']);
    expect(merged[1]).toBe(cut);
  });

  it('come from index.json and one PNG each, checked against each other', () => {
    const cuts = join(dir, 'limezu');
    mkdirSync(cuts);
    expect(readCuts(join(dir, 'nowhere'))).toEqual([]);
    expect(readCuts(cuts)).toEqual([]);
    const still = noise(32, 32, 9);
    const strip = noise(48, 16, 10);
    writeFileSync(join(cuts, 'floor-x.png'), encodePng(32, 32, still.rgba));
    writeFileSync(join(cuts, 'water-x.png'), encodePng(48, 16, strip.rgba));
    expect(() => readCuts(cuts)).toThrow(/cuts but no index\.json/);
    const index = {
      'floor-x': { w: 32, h: 32, spec: 'aaaa' },
      'water-x': { w: 16, h: 16, frames: 3, ms: 120, spec: 'bbbb' },
    };
    writeFileSync(join(cuts, 'index.json'), JSON.stringify(index));
    const read = readCuts(cuts);
    expect(read.map(({ id, w, h, frames, ms }) => ({ id, w, h, frames, ms }))).toEqual([
      { id: 'floor-x', w: 32, h: 32, frames: 1, ms: undefined },
      { id: 'water-x', w: 16, h: 16, frames: 3, ms: 120 },
    ]);
    expect([...read[1]!.image.rgba]).toEqual([...strip.rgba]);

    writeFileSync(join(cuts, 'stray.png'), encodePng(1, 1, new Uint8Array(4)));
    expect(() => readCuts(cuts)).toThrow(/limezu\/stray\.png isn't in index\.json/);
    rmSync(join(cuts, 'stray.png'));
    writeFileSync(
      join(cuts, 'index.json'),
      JSON.stringify({ ...index, 'floor-y': index['floor-x'] }),
    );
    expect(() => readCuts(cuts)).toThrow(/limezu\/floor-y\.png is missing/);
    writeFileSync(
      join(cuts, 'index.json'),
      JSON.stringify({ 'floor-x': { w: 16, h: 32, spec: 'a' } }),
    );
    rmSync(join(cuts, 'water-x.png'));
    expect(() => readCuts(cuts)).toThrow(/floor-x\.png is 32×32; index\.json says 1 × 16×32/);
  });

  it('parseCutIndex rejects malformed records', () => {
    const bad = (value: unknown) => () => parseCutIndex(JSON.stringify({ 'a-b': value }));
    expect(bad({ w: 1, h: 1, spec: 'x' })).not.toThrow();
    expect(bad({ w: 0, h: 1, spec: 'x' })).toThrow(/w and h must be whole/);
    expect(bad({ w: 1, h: 1 })).toThrow(/spec must be a hash/);
    expect(bad({ w: 1, h: 1, spec: 'x', frames: 1, ms: 5 })).toThrow(/frames \(≥ 2\) and ms/);
    expect(bad({ w: 1, h: 1, spec: 'x', size: 3 })).toThrow(/unknown field "size"/);
    expect(() => parseCutIndex('{"Bad Id": {}}')).toThrow(/lowercase words/);
    expect(() => parseCutIndex('[1]')).toThrow(/expected an object/);
  });
});

describe('the committed atlas', () => {
  // These fail when art/ or assets/limezu/ changed without `npm run atlas`.
  const { inputs } = readAtlasInputs(root);
  const atlas = packAtlas(inputs);

  it('assets/atlas.json matches art/ and assets/limezu/', () => {
    const committed = JSON.parse(
      readFileSync(join(root, 'assets', 'atlas.json'), 'utf8'),
    ) as AtlasJson;
    expect(committed, 'run `npm run atlas` and commit assets/').toEqual(atlas.json);
  });

  it('assets/atlas.png matches art/ and assets/limezu/', () => {
    const decoded = decodePng(readFileSync(join(root, 'assets', 'atlas.png')));
    expect([decoded.width, decoded.height]).toEqual([atlas.width, atlas.height]);
    expect(Buffer.from(decoded.rgba).equals(Buffer.from(atlas.rgba)), 'run `npm run atlas`').toBe(
      true,
    );
  });

  it('packs every placeholder and cut, each with its own pixels and border', () => {
    for (const s of inputs) expectPacked(atlas, s);
  });

  it('has every sprite the UI references, with terrain and floors opaque', () => {
    for (const id of REQUIRED) expect(atlas.json.sprites, id).toHaveProperty([id]);
    for (const id of Object.keys(atlas.json.sprites).filter(isOpaque)) {
      const { x, y, w, h, frames = 1, stride = 0 } = atlas.json.sprites[id]!;
      let clear = 0;
      for (let k = 0; k < frames; k++) {
        for (let py = y; py < y + h; py++) {
          for (let px = x + k * stride; px < x + k * stride + w; px++) {
            if (pixel(atlas, px, py)[3] !== 255) clear++;
          }
        }
      }
      expect(clear, `${id}: pixels that aren't fully opaque`).toBe(0);
    }
  });
});
