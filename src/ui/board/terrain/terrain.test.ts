import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng, type RgbaImage } from '../../../../scripts/png.ts';
import { BALANCE } from '../../../content/balance.ts';
import { generateLot, isSunny, lotFromRows, terrainAt } from '../../../rules/lot.ts';
import type { Lot } from '../../../rules/index.ts';
import { BLOB47_MASKS, blobTile, E, N, NE, NW, S, SE, SUB, SW, W } from '../autotile.ts';
import { grassDecor, TUFT_EVERY, WILDFLOWERS_EVERY } from './grass.ts';
import { sunnyEdge } from './sunny.ts';
import { waterPlan } from './water.ts';

const cell = (s: number) => Math.floor(s / SUB);

/** A width × height lot of open ground with its sunny side along the top. */
function open(width: number, height: number): Lot {
  return lotFromRows(Array.from({ length: height }, () => '.'.repeat(width)));
}

describe('the grass', () => {
  it('scatters tufts and flowers on open ground only, the same way every time', () => {
    const lot = generateLot('jbf3zs', BALANCE.lot);
    const decor = grassDecor(lot);
    expect(decor.length).toBeGreaterThan(100);
    for (const d of decor) expect(terrainAt(lot, cell(d.sx), cell(d.sy)), d.id).toBeNull();
    expect(grassDecor(lot)).toEqual(decor);
  });

  it('puts about one tuft in 11 subtiles and flowers on about one in 23 of the rest', () => {
    const lot = open(40, 40);
    const decor = grassDecor(lot);
    const n = 40 * 40 * SUB * SUB;
    const tufts = decor.filter((d) => d.id.startsWith('tuft-')).length;
    const flowers = decor.filter((d) => d.id.startsWith('wildflowers-')).length;
    expect(tufts / n).toBeGreaterThan(0.75 / TUFT_EVERY);
    expect(tufts / n).toBeLessThan(1.25 / TUFT_EVERY);
    expect(flowers / n).toBeGreaterThan(0.75 / WILDFLOWERS_EVERY);
    expect(flowers / n).toBeLessThan(1.25 / WILDFLOWERS_EVERY);
  });

  it('gives tufts the colors of the grass they’re on', () => {
    const lot = open(24, 24);
    for (const d of grassDecor(lot)) {
      if (!d.id.startsWith('tuft-')) continue;
      expect(d.id.startsWith('tuft-sunny-'), `${d.sx},${d.sy}`).toBe(
        isSunny(lot, cell(d.sx), cell(d.sy)),
      );
    }
  });
});

describe('the sunny side’s edge', () => {
  // The band is the top 4 rows; a Tree at (2, 1) inside it stays shaded.
  const lot = lotFromRows(['......', '..T...', '......', '......', '......', '......']);
  const edge = sunnyEdge(lot);
  const at = new Map(edge.map((t) => [`${t.sx},${t.sy}`, t]));

  it('lies on shaded subtiles next to sunny ground, nowhere else', () => {
    for (const t of edge) expect(isSunny(lot, cell(t.sx), cell(t.sy))).toBe(false);
    // The band's inner edge: every subtile of the first shaded row, none of the second.
    for (let sx = 0; sx < 12; sx++) {
      expect(at.has(`${sx},8`)).toBe(true);
      expect(at.has(`${sx},9`)).toBe(false);
    }
  });

  it('rings a Tree inside the band with sunny grass', () => {
    // The Tree's four subtiles, each open only toward the Tree's own other subtiles.
    const tile = (mask: number) => blobTile('godot', mask);
    expect(at.get('4,2')).toMatchObject(tile(E | SE | S));
    expect(at.get('5,2')).toMatchObject(tile(S | SW | W));
    expect(at.get('4,3')).toMatchObject(tile(N | NE | E));
    expect(at.get('5,3')).toMatchObject(tile(N | W | NW));
  });

  it('has no edge along the lot’s border: the band runs on past it', () => {
    // The band's inner edge reaches the side borders as a straight run (open east and west).
    expect(at.get('0,8')).toMatchObject(blobTile('godot', E | SE | S | SW | W));
    expect(at.get('11,8')).toMatchObject(blobTile('godot', E | SE | S | SW | W));
  });

  it('follows a side band too', () => {
    const left = lotFromRows(['......', '......'], 'left');
    const tiles = sunnyEdge(left);
    expect(new Set(tiles.map((t) => t.sx))).toEqual(new Set([8]));
    expect(tiles).toHaveLength(4);
  });
});

describe('the water', () => {
  // A creek in from the top edge, bending out through the left; a 2 × 2 pond.
  const lot = lotFromRows([
    '.C......',
    '.C......',
    'CC......',
    '........',
    '....PP..',
    '....PP..',
    '........',
  ]);
  const plan = waterPlan(lot);
  const at = new Map(plan.tiles.map((t) => [`${t.sx},${t.sy}`, t.piece]));

  it('covers every subtile of water and nothing else, inside its box', () => {
    let water = 0;
    for (let y = 0; y < lot.height; y++) {
      for (let x = 0; x < lot.width; x++) {
        const t = terrainAt(lot, x, y);
        if (t === 'creek' || t === 'pond') water++;
      }
    }
    expect(plan.tiles).toHaveLength(water * SUB * SUB);
    expect(plan.box).toEqual({ x: 0, y: 0, w: 6, h: 6 });
    for (const t of plan.tiles) {
      const x = cell(t.sx);
      const y = cell(t.sy);
      expect(['creek', 'pond']).toContain(terrainAt(lot, x, y));
    }
  });

  it('keeps the creek open where it leaves the lot, and closes the pond', () => {
    // The creek's top subtiles at the top edge: open water north (the middle row of the block).
    expect(at.get('2,0')).toEqual({ block: 'outer', col: 0, row: 1 });
    expect(at.get('3,0')).toEqual({ block: 'outer', col: 2, row: 1 });
    // Its west end at the left edge: open water west.
    expect(at.get('0,4')).toEqual({ block: 'outer', col: 1, row: 0 });
    expect(at.get('0,5')).toEqual({ block: 'outer', col: 1, row: 2 });
    // The pond: a shore all around, rounded corners, open water in the middle.
    expect(at.get('8,8')).toEqual({ block: 'outer', col: 0, row: 0 });
    expect(at.get('11,11')).toEqual({ block: 'outer', col: 2, row: 2 });
    expect(at.get('9,9')).toEqual({ block: 'outer', col: 1, row: 1 });
  });

  it('opens only the ends of the creek’s path at the edge, not where it runs along it', () => {
    // In at (1, 0) from the north, east along the top row, then down at (3, 0).
    const along = waterPlan(lotFromRows(['.CCC..', '...C..', '...C..', '...C..', '......']));
    const piece = new Map(along.tiles.map((t) => [`${t.sx},${t.sy}`, t.piece]));
    // The end's top subtiles: open water north, and an inner corner where the bank of the
    // run along the edge meets it.
    expect(piece.get('2,0')).toEqual({ block: 'outer', col: 0, row: 1 });
    expect(piece.get('3,0')).toEqual({ block: 'inner', col: 0, row: 1 });
    // Along the edge, a bank to the north.
    expect(piece.get('4,0')).toEqual({ block: 'outer', col: 1, row: 0 });
    expect(piece.get('6,0')).toEqual({ block: 'outer', col: 1, row: 0 });
    // Its other end, short of the bottom edge, is closed.
    expect(piece.get('6,7')).toEqual({ block: 'outer', col: 0, row: 2 });
  });

  it('turns the creek’s bend with an inner corner', () => {
    // The bend cell (1, 2): north and west are creek, north-west is ground.
    expect(at.get('2,4')).toEqual({ block: 'inner', col: 1, row: 1 });
    // Its outer corner, south-east, is a rounded shore.
    expect(at.get('3,5')).toEqual({ block: 'outer', col: 2, row: 2 });
  });

  it('floats lily pads only on a pond’s open water', () => {
    const lots = ['jbf3zs', 'abc123', 'house7', 'pond-1', 'pond-2', 'pond-3'].map((seed) =>
      generateLot(seed, BALANCE.lot),
    );
    let lilies = 0;
    for (const l of lots) {
      const p = waterPlan(l);
      const pieces = new Map(p.tiles.map((t) => [`${t.sx},${t.sy}`, t.piece]));
      for (const lily of p.lilies) {
        lilies++;
        expect(terrainAt(l, cell(lily.sx), cell(lily.sy))).toBe('pond');
        expect(pieces.get(`${lily.sx},${lily.sy}`)).toEqual({ block: 'outer', col: 1, row: 1 });
      }
    }
    expect(lilies).toBeGreaterThan(0);
  });

  it('has no canvas without water', () => {
    expect(waterPlan(open(4, 4))).toEqual({ box: null, tiles: [], lilies: [] });
  });
});

// The committed cuts, checked against the tables that pick their tiles.
const root = resolve(import.meta.dirname, '../../../..');
const png = (id: string): RgbaImage =>
  decodePng(readFileSync(resolve(root, 'assets', 'limezu', `${id}.png`)), id);
const alpha = (img: RgbaImage, x: number, y: number) => img.rgba[(y * img.width + x) * 4 + 3]!;

describe('the committed terrain cuts', () => {
  it('sun-edge: each Godot tile is clear exactly toward its mask’s neighbors', () => {
    const img = png('sun-edge');
    // The middle of each side and each corner, on the tile's rim: clear where the clear inside
    // (the shade) runs on into the neighbor, grass where it doesn't.
    const probes: [number, number, number][] = [
      [N, 8, 0],
      [NE, 15, 0],
      [E, 15, 8],
      [SE, 15, 15],
      [S, 8, 15],
      [SW, 0, 15],
      [W, 0, 8],
      [NW, 0, 0],
    ];
    for (const mask of BLOB47_MASKS) {
      const { col, row } = blobTile('godot', mask);
      for (const [bit, px, py] of probes) {
        const clear = alpha(img, col * 16 + px, row * 16 + py) < 255;
        expect(clear, `mask ${mask}, bit ${bit}`).toBe((mask & bit) !== 0);
      }
    }
  });

  it('shore: open water in the middle, land outside, in every frame', () => {
    const img = png('shore');
    for (let frame = 0; frame < 8; frame++) {
      const x0 = frame * 48;
      // The middle tile is all water.
      for (let y = 16; y < 32; y++) {
        for (let x = 16; x < 32; x++) expect(alpha(img, x0 + x, y)).toBe(255);
      }
      // The block's outer corners are clear: the grass below shows through.
      for (const [x, y] of [
        [0, 0],
        [47, 0],
        [0, 47],
        [47, 47],
      ] as const) {
        expect(alpha(img, x0 + x, y), `frame ${frame} at ${x},${y}`).toBe(0);
      }
    }
  });

  it('shore-corners: land in the middle of the 2 × 2 block, water at its rim', () => {
    const img = png('shore-corners');
    for (let frame = 0; frame < 8; frame++) {
      const x0 = frame * 32;
      // Tile (1, 1) has its land at the north-west, as quarterPiece expects for an inner
      // corner there; tile (0, 0) at the south-east.
      expect(alpha(img, x0 + 16, 16)).toBe(0);
      expect(alpha(img, x0 + 15, 15)).toBe(0);
      for (const [x, y] of [
        [0, 0],
        [31, 0],
        [0, 31],
        [31, 31],
      ] as const) {
        expect(alpha(img, x0 + x, y), `frame ${frame} at ${x},${y}`).toBe(255);
      }
    }
  });
});
