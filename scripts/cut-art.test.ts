import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseCutIndex } from './build-atlas.ts';
import {
  CUTS_PREFIX,
  INDEX_LICENSE,
  OPS,
  PACKS,
  applyOps,
  cutSprite,
  findArtSource,
  licenseRecord,
  mergeLicenses,
  openSheets,
  parseManifest,
  readManifests,
  runCut,
  specHash,
  type CutSpec,
  type Op,
  type OpContext,
} from './cut-art.ts';
import { makeZip } from './make-zip.ts';
import { decodePng, encodePng, type RgbaImage } from './png.ts';

const root = resolve(import.meta.dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'open-house-cut-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** An image whose every pixel differs, from a seed, fully opaque unless `alpha` says. */
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

function px(image: RgbaImage, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return [...image.rgba.subarray(i, i + 4)];
}

/** A pixel's color as "#rrggbb". */
function hex(rgba: readonly number[]): string {
  return `#${rgba
    .slice(0, 3)
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

function solid(width: number, height: number, rgba: readonly number[]): RgbaImage {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) out.set(rgba, i * 4);
  return { width, height, rgba: out };
}

const SHEET = 'Sheets/sheet.png';
const OTHER = 'Sheets/other.png';
const sheets: Record<string, RgbaImage> = { [SHEET]: noise(64, 32, 1), [OTHER]: noise(16, 16, 2) };
const ctx: OpContext = {
  file: SHEET,
  sheet: (file) => {
    const sheet = sheets[file];
    if (!sheet) throw new Error(`no sheet ${file}`);
    return sheet;
  },
};
const parseOp = (op: Record<string, unknown>): Op => OPS[op.op as Op['op']].parse(op, 'op');
const run = (image: RgbaImage, ...ops: Record<string, unknown>[]) =>
  applyOps(image, ops.map(parseOp), ctx, 'ops');

describe('manifests', () => {
  const entry = {
    pack: 'mi',
    file: '1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png',
    rect: [144, 208, 16, 16],
    ops: [{ op: 'tile', size: [32, 32] }],
    note: 'A note.',
  };
  const parse = (spec: unknown) => parseManifest(JSON.stringify({ 'floor-x': spec }), 'm.json');

  it('reads an entry with its frames, ops, and note', () => {
    const full = {
      ...entry,
      frames: { count: 8, dx: 48, dy: 0, ms: 100 },
      ops: [
        { op: 'recolor', map: { '#ABCDEF': '#000000' } },
        { op: 'keyOut', colors: ['#FF00FF'] },
        { op: 'flipX' },
        { op: 'compose', size: [48, 25], layers: [{ rect: [0, 0, 16, 25], at: [32, 0] }] },
      ],
    };
    expect(parse(full).get('floor-x')).toEqual({
      ...full,
      ops: [
        { op: 'recolor', map: { '#abcdef': '#000000' } },
        { op: 'keyOut', colors: ['#ff00ff'] },
        { op: 'flipX' },
        { op: 'compose', size: [48, 25], layers: [{ rect: [0, 0, 16, 25], at: [32, 0] }] },
      ],
    });
  });

  it('names the manifest, the id, and the field of a problem', () => {
    expect(() => parseManifest('{"Floor X": {}}', 'm.json')).toThrow(
      'm.json: "Floor X": ids are lowercase words joined by "-"',
    );
    expect(() => parseManifest('{', 'm.json')).toThrow(/^m\.json: /);
    expect(() => parse({ ...entry, pack: 'free' })).toThrow(
      'm.json: "floor-x".pack must be "mi" (Modern Interiors) or "me" (Modern Exteriors)',
    );
    expect(() => parse({ ...entry, size: 3 })).toThrow(/"floor-x" has an unknown field "size"/);
    for (const file of ['/abs.png', 'a/../b.png', 'a\\b.png', 'a//b.png', 'sheet.gif', '']) {
      expect(() => parse({ ...entry, file }), file).toThrow(/"floor-x".file must be/);
    }
    expect(() => parse({ ...entry, rect: [0, 0, 16] })).toThrow(/\.rect must be \[x, y, w, h\]/);
    expect(() => parse({ ...entry, rect: [-1, 0, 16, 16] })).toThrow(/\.rect\[0\] must be a whole/);
    expect(() => parse({ ...entry, rect: [0, 0, 0, 16] })).toThrow(/\.rect\[2\] .* at least 1/);
    expect(() => parse({ ...entry, rect: [0, 0.5, 16, 16] })).toThrow(/\.rect\[1\]/);
    expect(() => parse({ ...entry, frames: { count: 1, dx: 16, dy: 0, ms: 100 } })).toThrow(
      /\.frames\.count must be a whole number of at least 2/,
    );
    expect(() => parse({ ...entry, frames: { count: 2, dx: 0, dy: 0, ms: 100 } })).toThrow(
      /dx and dy can't both be 0/,
    );
    expect(() => parse({ ...entry, frames: { count: 2, dx: 16, dy: 0 } })).toThrow(/\.ms/);
    expect(() => parse({ ...entry, ops: [] })).toThrow(/\.ops must be a non-empty list/);
    expect(() => parse({ ...entry, ops: [{ op: 'rotate' }] })).toThrow(
      /\.ops\[0\]: unknown op "rotate" \(one of tile, recolor, keyOut, flipX, compose\)/,
    );
    expect(() => parse({ ...entry, ops: [{ op: 'tile', size: [32] }] })).toThrow(/\.size must/);
    expect(() => parse({ ...entry, ops: [{ op: 'flipX', times: 2 }] })).toThrow(/"times"/);
    expect(() => parse({ ...entry, ops: [{ op: 'recolor', map: {} }] })).toThrow(/map is empty/);
    expect(() => parse({ ...entry, ops: [{ op: 'recolor', map: { red: '#000000' } }] })).toThrow(
      /must be a color "#rrggbb", got "red"/,
    );
    expect(() =>
      parse({
        ...entry,
        ops: [{ op: 'recolor', map: { '#AAAAAA': '#000000', '#aaaaaa': '#111111' } }],
      }),
    ).toThrow(/#aaaaaa twice/);
    expect(() => parse({ ...entry, ops: [{ op: 'keyOut', colors: [] }] })).toThrow(/\.colors/);
    expect(() => parse({ ...entry, ops: [{ op: 'compose', size: [8, 8], layers: [] }] })).toThrow(
      /\.layers must be a non-empty list/,
    );
    expect(() =>
      parse({ ...entry, ops: [{ op: 'compose', size: [8, 8], layers: [{ rect: [0, 0, 1, 1] }] }] }),
    ).toThrow(/layers\[0\]\.at must be \[x, y\]/);
    expect(() => parse({ ...entry, note: ' ' })).toThrow(/\.note must be a non-empty string/);
  });

  it('reads every manifest in the folder, sorted by id, each id once', () => {
    const dir = join(tmp, 'manifests');
    mkdirSync(dir);
    writeFileSync(join(dir, 'b.json'), JSON.stringify({ 'tree-b': entry, 'floor-z': entry }));
    writeFileSync(join(dir, 'a.json'), JSON.stringify({ 'floor-a': entry }));
    writeFileSync(join(dir, 'README.md'), 'not a manifest');
    const all = readManifests(dir);
    expect([...all.keys()]).toEqual(['floor-a', 'floor-z', 'tree-b']);
    expect(all.get('tree-b')!.manifest).toBe('art/limezu/b.json');
    writeFileSync(join(dir, 'c.json'), JSON.stringify({ 'floor-a': entry }));
    expect(() => readManifests(dir)).toThrow(
      'art/limezu/c.json: "floor-a" is also in art/limezu/a.json',
    );
    expect(readManifests(join(tmp, 'no-such-folder')).size).toBe(0);
  });

  it('hashes what decides the pixels: not the key order, the note, or the colors’ case', () => {
    const spec = (value: unknown) => parse(value).get('floor-x')!;
    const base = specHash(spec(entry));
    expect(base).toMatch(/^[0-9a-f]{16}$/);
    const { pack, file, rect, ops } = entry;
    expect(specHash(spec({ ops, rect, file, pack }))).toBe(base);
    expect(specHash(spec({ ...entry, note: 'Another note.' }))).toBe(base);
    expect(specHash(spec({ ...entry, rect: [128, 208, 16, 16] }))).not.toBe(base);
    expect(specHash(spec({ ...entry, ops: [{ op: 'tile', size: [48, 32] }] }))).not.toBe(base);
    expect(specHash(spec({ ...entry, pack: 'me' }))).not.toBe(base);
    const recolor = (from: string) => ({
      ...entry,
      ops: [{ op: 'recolor', map: { [from]: '#000000' } }],
    });
    expect(specHash(spec(recolor('#ABCDEF')))).toBe(specHash(spec(recolor('#abcdef'))));
  });
});

describe('ops', () => {
  it('tile repeats a tile to a size, from the top left', () => {
    const tile = noise(16, 16, 3);
    const cell = run(tile, { op: 'tile', size: [32, 32] });
    expect([cell.width, cell.height]).toEqual([32, 32]);
    for (const [x, y] of [
      [0, 0],
      [17, 3],
      [31, 31],
      [5, 20],
    ] as const) {
      expect(px(cell, x, y), `(${x}, ${y})`).toEqual(px(tile, x % 16, y % 16));
    }
    const odd = run(noise(3, 2, 4), { op: 'tile', size: [5, 3] });
    expect(px(odd, 4, 2)).toEqual(px(noise(3, 2, 4), 1, 0));
  });

  it('recolor swaps exact colors, keeping alpha, and leaves the rest', () => {
    const image: RgbaImage = {
      width: 4,
      height: 1,
      rgba: Uint8Array.of(0x47, 0x97, 0x57, 255, 0x47, 0x97, 0x57, 100, 1, 2, 3, 255, 0, 0, 0, 0),
    };
    const out = run(image, { op: 'recolor', map: { '#479757': '#5A8A5E', '#000000': '#ffffff' } });
    expect([...out.rgba]).toEqual([
      0x5a, 0x8a, 0x5e, 255, 0x5a, 0x8a, 0x5e, 100, 1, 2, 3, 255, 0, 0, 0, 0,
    ]);
    expect([...image.rgba.subarray(0, 4)]).toEqual([0x47, 0x97, 0x57, 255]); // not edited in place
  });

  it('keyOut makes exact colors transparent', () => {
    const image: RgbaImage = {
      width: 2,
      height: 1,
      rgba: Uint8Array.of(255, 0, 255, 255, 9, 9, 9, 255),
    };
    expect([...run(image, { op: 'keyOut', colors: ['#ff00ff'] }).rgba]).toEqual([
      0, 0, 0, 0, 9, 9, 9, 255,
    ]);
  });

  it('flipX mirrors left to right', () => {
    const image = noise(3, 2, 5);
    const out = run(image, { op: 'flipX' });
    expect(px(out, 0, 1)).toEqual(px(image, 2, 1));
    expect(px(out, 2, 0)).toEqual(px(image, 0, 0));
    expect(px(out, 1, 1)).toEqual(px(image, 1, 1));
  });

  it('compose pastes the image and then each layer onto a canvas, with alpha', () => {
    const base = solid(4, 4, [200, 0, 0, 255]);
    const out = run(base, {
      op: 'compose',
      size: [12, 8],
      at: [1, 2],
      layers: [
        { rect: [0, 0, 2, 2], at: [6, 0] }, // from the entry's own sheet
        { file: OTHER, rect: [3, 4, 2, 1], at: [10, 7], ops: [{ op: 'flipX' }] },
      ],
    });
    expect([out.width, out.height]).toEqual([12, 8]);
    expect(px(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(px(out, 1, 2)).toEqual([200, 0, 0, 255]);
    expect(px(out, 4, 5)).toEqual([200, 0, 0, 255]);
    expect(px(out, 7, 1)).toEqual(px(sheets[SHEET]!, 1, 1));
    expect(px(out, 10, 7)).toEqual(px(sheets[OTHER]!, 4, 4));
    expect(px(out, 11, 7)).toEqual(px(sheets[OTHER]!, 3, 4));

    // A half-transparent layer blends over what's under it ("source over").
    const glass: Record<string, RgbaImage> = { 'g.png': solid(1, 1, [0, 0, 255, 128]) };
    const blended = applyOps(
      solid(1, 1, [255, 0, 0, 255]),
      [
        parseOp({
          op: 'compose',
          size: [1, 1],
          layers: [{ file: 'g.png', rect: [0, 0, 1, 1], at: [0, 0] }],
        }),
      ],
      { file: SHEET, sheet: (f) => glass[f]! },
      'ops',
    );
    expect(px(blended, 0, 0)).toEqual([127, 0, 128, 255]);
  });

  it("says when a layer doesn't fit or reads outside its sheet", () => {
    const compose = (layer: Record<string, unknown>) =>
      run(solid(2, 2, [1, 1, 1, 255]), { op: 'compose', size: [4, 4], layers: [layer] });
    expect(() => compose({ rect: [0, 0, 2, 2], at: [3, 0] })).toThrow(
      /ops\[0\] \(compose\)\.layers\[0\]: a 2×2 image at \[3, 0\] doesn't fit the 4×4 canvas/,
    );
    expect(() => compose({ rect: [60, 0, 8, 1], at: [0, 0] })).toThrow(
      /\[60, 0, 8, 1\] is outside the 64×32 sheet/,
    );
  });
});

describe('cutSprite', () => {
  const sheet = (file: string) => ctx.sheet(file);
  const spec = (extra: Partial<CutSpec>): CutSpec => ({
    pack: 'mi',
    file: SHEET,
    rect: [4, 2, 6, 5],
    ...extra,
  });

  it('crops a rect, clearing the color of transparent pixels', () => {
    const glassy = { width: 2, height: 1, rgba: Uint8Array.of(9, 9, 9, 0, 1, 2, 3, 255) };
    const cut = cutSprite(spec({ rect: [0, 0, 2, 1] }), () => glassy, 'x');
    expect([...cut.image.rgba]).toEqual([0, 0, 0, 0, 1, 2, 3, 255]);
    expect([cut.w, cut.h, cut.frames, cut.ms]).toEqual([2, 1, 1, undefined]);
  });

  it('cuts an animation as a strip, editing every frame alike', () => {
    const cut = cutSprite(
      spec({ frames: { count: 3, dx: 8, dy: 1, ms: 120 }, ops: [{ op: 'flipX' }] }),
      sheet,
      'x',
    );
    expect([cut.image.width, cut.image.height, cut.w, cut.h, cut.frames, cut.ms]).toEqual([
      18, 5, 6, 5, 3, 120,
    ]);
    for (let k = 0; k < 3; k++) {
      // Frame k comes from [4 + 8k, 2 + k], mirrored.
      expect(px(cut.image, k * 6, 0), `frame ${k}`).toEqual(
        px(sheets[SHEET]!, 4 + 8 * k + 5, 2 + k),
      );
      expect(px(cut.image, k * 6 + 5, 4), `frame ${k}`).toEqual(
        px(sheets[SHEET]!, 4 + 8 * k, 6 + k),
      );
    }
  });

  it('names the entry, the frame, and the sheet when a rect is off it', () => {
    expect(() => cutSprite(spec({ rect: [60, 0, 8, 8] }), sheet, 'm.json: "floor-x"')).toThrow(
      'm.json: "floor-x".rect (Sheets/sheet.png): [60, 0, 8, 8] is outside the 64×32 sheet',
    );
    expect(() =>
      cutSprite(spec({ frames: { count: 8, dx: 8, dy: 0, ms: 1 } }), sheet, 'm.json: "x"'),
    ).toThrow(/"x" frame 7\.rect .*\[60, 2, 6, 5\] is outside the 64×32 sheet/);
    expect(() =>
      cutSprite(spec({ frames: { count: 2, dx: -8, dy: 0, ms: 1 } }), sheet, 'm.json: "x"'),
    ).toThrow(/"x" frame 1: \[-4, 2, 6, 5\] is off the sheet/);
  });
});

describe('license records', () => {
  it("record each cut's pack, zip, sheet, and rects", () => {
    expect(
      licenseRecord({
        pack: 'mi',
        file: '1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png',
        rect: [144, 208, 16, 16],
      }),
    ).toEqual({
      source:
        'https://limezu.itch.io/moderninteriors (moderninteriors-win.zip): 1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png [144, 208, 16, 16]',
      author: 'LimeZu',
      license: 'LicenseRef-LimeZu-Modern-Interiors',
    });
    const busy = licenseRecord({
      pack: 'me',
      file: 'A.png',
      rect: [0, 0, 48, 48],
      frames: { count: 8, dx: 48, dy: 0, ms: 100 },
      ops: [
        {
          op: 'compose',
          size: [96, 48],
          layers: [
            { rect: [1, 2, 3, 4], at: [0, 0] },
            { file: 'B.png', rect: [5, 6, 7, 8], at: [0, 0] },
          ],
        },
      ],
    });
    expect(busy).toEqual({
      source:
        'https://limezu.itch.io/modernexteriors (modernexteriors-win.zip): A.png [0, 0, 48, 48], 8 frames [48, 0] apart; A.png [1, 2, 3, 4]; B.png [5, 6, 7, 8]',
      author: 'LimeZu',
      license: 'LicenseRef-LimeZu-Modern-Exteriors',
    });
  });

  it('regenerate only the limezu/ entries: others keep their place, cuts go by id', () => {
    const spec: CutSpec = { pack: 'mi', file: 'A.png', rect: [0, 0, 1, 1] };
    const merged = mergeLicenses(
      {
        'atlas.png': { source: 'ours' },
        'limezu/gone.png': { source: 'stale' },
        'npm:preact': { source: 'npm' },
      },
      new Map([
        ['tree-b', spec],
        ['floor-a', spec],
      ]),
    );
    expect(Object.keys(merged)).toEqual([
      'atlas.png',
      'npm:preact',
      'limezu/index.json',
      'limezu/floor-a.png',
      'limezu/tree-b.png',
    ]);
    expect(merged['atlas.png']).toEqual({ source: 'ours' });
    expect(merged['limezu/index.json']).toEqual(INDEX_LICENSE);
    expect(merged['limezu/tree-b.png']).toEqual(licenseRecord(spec));
  });
});

describe('npm run art:cut, on packs made in the test', () => {
  const base = join(tmp, 'repo');
  const manifests = join(base, 'art', 'limezu');
  const assets = join(base, 'assets');
  const artSource = join(base, 'art-source');
  const floors = noise(48, 32, 7);
  const water = noise(64, 16, 8);
  const grass = noise(16, 16, 9);
  mkdirSync(manifests, { recursive: true });
  mkdirSync(assets);
  mkdirSync(artSource);
  writeFileSync(
    join(artSource, PACKS.mi.zip),
    makeZip([
      { name: 'Floors/', data: new Uint8Array(0) },
      { name: 'Floors/floors.png', data: encodePng(48, 32, floors.rgba), method: 8 },
    ]),
  );
  writeFileSync(
    join(artSource, PACKS.me.zip),
    makeZip([
      { name: 'Terrain/water.png', data: encodePng(64, 16, water.rgba), method: 8 },
      { name: 'Terrain/grass.png', data: encodePng(16, 16, grass.rgba) },
    ]),
  );
  const OTHER_RECORDS = {
    'atlas.png': { source: 'art/', author: 'Open House team', license: 'Own work' },
    'npm:preact': { source: 'https://github.com/preactjs/preact', author: 'x', license: 'MIT' },
  };
  writeFileSync(join(assets, 'licenses.json'), JSON.stringify(OTHER_RECORDS, null, 2));
  const interiors = {
    'floor-test': {
      pack: 'mi',
      file: 'Floors/floors.png',
      rect: [16, 16, 16, 16],
      ops: [{ op: 'tile', size: [32, 32] }],
    },
  };
  const exteriors = {
    'water-test': {
      pack: 'me',
      file: 'Terrain/water.png',
      rect: [0, 0, 16, 16],
      frames: { count: 4, dx: 16, dy: 0, ms: 100 },
    },
    'grass-test': {
      pack: 'me',
      file: 'Terrain/grass.png',
      rect: [0, 0, 16, 16],
      // Every noise pixel differs, so this recolors the top-left pixel only.
      ops: [{ op: 'recolor', map: { [hex(px(grass, 0, 0))]: '#000000' } }],
    },
  };
  const writeManifests = (files: Record<string, unknown>) => {
    for (const name of readdirSync(manifests)) rmSync(join(manifests, name));
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(manifests, name), JSON.stringify(body, null, 2));
    }
  };
  const cut = () => runCut({ manifests, assets, artSource: () => artSource });
  const read = (path: string) => readFileSync(join(assets, path));
  const licenses = () => JSON.parse(read('licenses.json').toString()) as Record<string, unknown>;

  it('writes the listed cuts, index.json, and their license records', () => {
    writeManifests({ 'floors.json': interiors, 'terrain.json': exteriors });
    const result = cut();
    expect(result.ids).toEqual(['floor-test', 'grass-test', 'water-test']);
    expect(result.written).toEqual([
      'limezu/floor-test.png',
      'limezu/grass-test.png',
      'limezu/water-test.png',
      'limezu/index.json',
      'licenses.json',
    ]);
    expect(result.removed).toEqual([]);

    const floor = decodePng(read('limezu/floor-test.png'));
    expect([floor.width, floor.height]).toEqual([32, 32]);
    expect(px(floor, 0, 0)).toEqual(px(floors, 16, 16));
    expect(px(floor, 31, 17)).toEqual(px(floors, 31, 17));
    const strip = decodePng(read('limezu/water-test.png'));
    expect([...strip.rgba]).toEqual([...water.rgba]);
    const recolored = decodePng(read('limezu/grass-test.png'));
    expect(px(recolored, 0, 0)).toEqual([0, 0, 0, 255]);

    const specs = readManifests(manifests);
    const index = parseCutIndex(read('limezu/index.json').toString());
    expect(index).toEqual({
      'floor-test': { w: 32, h: 32, spec: specHash(specs.get('floor-test')!.spec) },
      'grass-test': { w: 16, h: 16, spec: specHash(specs.get('grass-test')!.spec) },
      'water-test': {
        w: 16,
        h: 16,
        frames: 4,
        ms: 100,
        spec: specHash(specs.get('water-test')!.spec),
      },
    });
    expect(licenses()).toEqual({
      ...OTHER_RECORDS,
      'limezu/index.json': INDEX_LICENSE,
      'limezu/floor-test.png': {
        source:
          'https://limezu.itch.io/moderninteriors (moderninteriors-win.zip): Floors/floors.png [16, 16, 16, 16]',
        author: 'LimeZu',
        license: 'LicenseRef-LimeZu-Modern-Interiors',
      },
      'limezu/grass-test.png': licenseRecord(specs.get('grass-test')!.spec),
      'limezu/water-test.png': licenseRecord(specs.get('water-test')!.spec),
    });
  });

  it('writes nothing when nothing changed', () => {
    expect(cut().written).toEqual([]);
  });

  it('removes cuts no manifest lists, with their records, and leaves other files alone', () => {
    writeFileSync(join(assets, 'limezu', 'old-cut.png'), encodePng(1, 1, new Uint8Array(4)));
    writeFileSync(join(assets, 'limezu', 'notes.txt'), 'not a cut\n');
    writeManifests({
      'floors.json': interiors,
      'terrain.json': { 'water-test': exteriors['water-test'] },
    });
    const result = cut();
    expect(result.removed).toEqual(['limezu/grass-test.png', 'limezu/old-cut.png']);
    expect(result.written).toEqual(['limezu/index.json', 'licenses.json']);
    expect(readdirSync(join(assets, 'limezu')).sort()).toEqual([
      'floor-test.png',
      'index.json',
      'notes.txt',
      'water-test.png',
    ]);
    expect(Object.keys(licenses())).not.toContain('limezu/grass-test.png');
    rmSync(join(assets, 'limezu', 'notes.txt'));
  });

  it('changes nothing when an entry fails', () => {
    const before = readdirSync(join(assets, 'limezu')).map((name) => [
      name,
      read(`limezu/${name}`),
    ]);
    const licensesBefore = read('licenses.json');
    writeManifests({
      'floors.json': {
        ...interiors,
        'floor-bad': { ...interiors['floor-test'], rect: [40, 0, 16, 16] },
      },
    });
    expect(cut).toThrow(
      /art\/limezu\/floors\.json: "floor-bad"\.rect \(Floors\/floors\.png\): \[40, 0, 16, 16\] is outside the 48×32 sheet/,
    );
    writeManifests({
      'floors.json': {
        ...interiors,
        'floor-bad': { ...interiors['floor-test'], file: 'Floors/nope.png' },
      },
    });
    expect(cut).toThrow(/moderninteriors-win\.zip has no file Floors\/nope\.png/);
    expect(
      readdirSync(join(assets, 'limezu')).map((name) => [name, read(`limezu/${name}`)]),
    ).toEqual(before);
    expect(read('licenses.json').equals(licensesBefore)).toBe(true);
  });

  it("doesn't need the packs when no manifest lists anything", () => {
    writeManifests({});
    const result = runCut({
      manifests,
      assets,
      artSource: () => {
        throw new Error('art-source/ should not be needed');
      },
    });
    expect(result.removed).toEqual(['limezu/floor-test.png', 'limezu/water-test.png']);
    expect(read('limezu/index.json').toString()).toBe('{}\n');
    expect(licenses()).toEqual({ ...OTHER_RECORDS, 'limezu/index.json': INDEX_LICENSE });
  });

  it('says where the packs should be', () => {
    writeManifests({ 'floors.json': interiors });
    expect(() =>
      runCut({ manifests, assets, artSource: () => join(base, 'missing-art-source') }),
    ).toThrow(/missing-art-source\/moderninteriors-win\.zip isn't there/);
  });
});

// ---------------------------------------------------------------------------------------
// The committed cuts. These run everywhere, CI included, and need no packs.

describe('the committed LimeZu cuts', () => {
  const manifests = readManifests(join(root, 'art', 'limezu'));
  const dir = join(root, 'assets', 'limezu');
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => !name.startsWith('.')) : [];
  const index = existsSync(join(dir, 'index.json'))
    ? parseCutIndex(readFileSync(join(dir, 'index.json'), 'utf8'))
    : {};
  const ids = [...manifests.keys()];

  it('has nothing in assets/limezu/ that no manifest lists', () => {
    for (const name of files) {
      if (name === 'index.json') continue;
      // art:cut removes only .png cuts, so anything else has to go by hand.
      expect(
        name.endsWith('.png'),
        `assets/limezu/${name} isn't a cut: only <id>.png files and index.json belong there, so delete it`,
      ).toBe(true);
      expect(
        manifests.has(name.slice(0, -'.png'.length)),
        `assets/limezu/${name} isn't in any art/limezu/*.json: list it, or run \`npm run art:cut\` to remove it`,
      ).toBe(true);
    }
    for (const id of Object.keys(index)) {
      expect(manifests.has(id), `index.json lists "${id}", which no manifest does`).toBe(true);
    }
  });

  it('has a committed cut for every manifest entry', () => {
    for (const id of ids) {
      expect(files, `"${id}" has no assets/limezu/${id}.png: run \`npm run art:cut\``).toContain(
        `${id}.png`,
      );
      expect(index, `"${id}" isn't in index.json: run \`npm run art:cut\``).toHaveProperty([id]);
    }
  });

  it('was cut from the manifests as they are now', () => {
    for (const id of ids) {
      const { manifest, spec } = manifests.get(id)!;
      expect(
        index[id]?.spec,
        `"${id}" changed in ${manifest} since it was cut: run \`npm run art:cut\` (needs art-source/)`,
      ).toBe(specHash(spec));
    }
  });

  it('has cuts of the size index.json records', () => {
    for (const id of ids) {
      const record = index[id]!;
      const image = decodePng(readFileSync(join(dir, `${id}.png`)), `assets/limezu/${id}.png`);
      expect([image.width, image.height], id).toEqual([record.w * (record.frames ?? 1), record.h]);
    }
  });

  it('has a licenses.json record for every cut, and none for cuts that are gone', () => {
    const recorded = JSON.parse(
      readFileSync(join(root, 'assets', 'licenses.json'), 'utf8'),
    ) as Record<string, unknown>;
    const specs = new Map(ids.map((id) => [id, manifests.get(id)!.spec]));
    const want = mergeLicenses(recorded, specs);
    const limezu = (records: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(records).filter(([key]) => key.startsWith(CUTS_PREFIX)));
    for (const id of ids) {
      expect(
        recorded,
        `assets/limezu/${id}.png has no assets/licenses.json entry: run \`npm run art:cut\``,
      ).toHaveProperty([`${CUTS_PREFIX}${id}.png`]);
    }
    expect(limezu(recorded), 'run `npm run art:cut` to update assets/licenses.json').toEqual(
      limezu(want),
    );
  });
});

/** art-source/ when the LimeZu packs are on this machine (never in CI). */
function localArtSource(): string | null {
  try {
    const dir = findArtSource(root);
    return existsSync(join(dir, PACKS.mi.zip)) || existsSync(join(dir, PACKS.me.zip)) ? dir : null;
  } catch {
    return null;
  }
}
const packs = localArtSource();

describe.skipIf(packs === null)('re-cutting from art-source/ (only where the packs are)', () => {
  it('gives back every committed cut, pixel for pixel', () => {
    const manifests = readManifests(join(root, 'art', 'limezu'));
    const sheetsFrom = openSheets(packs!);
    try {
      for (const [id, { manifest, spec }] of manifests) {
        const cut = cutSprite(
          spec,
          (file) => sheetsFrom.get(spec.pack, file),
          `${manifest}: "${id}"`,
        );
        const committed = decodePng(readFileSync(join(root, 'assets', 'limezu', `${id}.png`)));
        expect([committed.width, committed.height], id).toEqual([
          cut.image.width,
          cut.image.height,
        ]);
        expect(
          Buffer.from(committed.rgba).equals(Buffer.from(cut.image.rgba)),
          `${id}: run \`npm run art:cut\``,
        ).toBe(true);
      }
    } finally {
      sheetsFrom.close();
    }
  });
});
