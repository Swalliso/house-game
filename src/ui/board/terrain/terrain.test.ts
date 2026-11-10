import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng, type RgbaImage } from '../../../../scripts/png.ts';
import { BALANCE } from '../../../content/balance.ts';
import { generateLot, lotFromRows, terrainAt } from '../../../rules/lot.ts';
import { rules, type Lot } from '../../../rules/index.ts';
import { BLOB47_MASKS, blobTile, E, N, NE, NW, S, SE, SUB, SW, W } from '../autotile.ts';
import { grassDecor, TUFT_EVERY, WILDFLOWERS_EVERY } from './grass.ts';
import { seedSalt } from './hash.ts';
import { treeKind } from './objects.ts';
import { lotShade } from './shade.ts';
import { shoreSet, waterPlan } from './water.ts';

const cell = (s: number) => Math.floor(s / SUB);

/** A width × height lot of open ground, the sun at the back. */
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

  it('strews each run’s lot its own way, and the same run the same way every time', () => {
    const lot = open(24, 24);
    const key = (salt: number) => new Set(grassDecor(lot, salt).map((d) => `${d.sx},${d.sy}`));
    const a = key(seedSalt('jbf3zs'));
    const b = key(seedSalt('abc123'));
    expect(key(seedSalt('jbf3zs'))).toEqual(a);
    // Two runs share no more of their decorated subtiles than chance would (about 1 in 7).
    const shared = [...a].filter((k) => b.has(k)).length;
    expect(shared / a.size).toBeLessThan(0.3);
    // The trees too: the same cell grows different kinds from run to run.
    const kinds = new Set(
      ['s1', 's2', 's3', 's4', 's5', 's6'].map((s) => treeKind(10, 22, seedSalt(s))),
    );
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('gives every tuft the lawn’s own colors: the sun has no band (D-120)', () => {
    for (const d of grassDecor(open(24, 24))) {
      if (d.id.startsWith('tuft-')) expect(['tuft-0', 'tuft-1']).toContain(d.id);
    }
  });
});

describe('the lot’s shade (D-120)', () => {
  // A Tree at (2, 1), the Old Shed on (4, 3) to (5, 4).
  const rows = ['......', '..T...', '......', '....SS', '....SS', '......'];

  it('falls on the tile behind each Tree and the Old Shed, away from the sun', () => {
    expect(lotShade(lotFromRows(rows, 'top'))).toEqual([
      { x: 2, y: 2 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ]);
    expect(lotShade(lotFromRows(rows, 'bottom'))).toEqual([
      { x: 2, y: 0 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ]);
    expect(lotShade(lotFromRows(rows, 'left'))).toEqual([{ x: 3, y: 1 }]);
    expect(lotShade(lotFromRows(rows, 'right'))).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ]);
  });

  it('shades no Tree, and nothing on a lot without Trees', () => {
    const woods = lotFromRows(['TTT', 'TTT', '...'], 'top');
    expect(lotShade(woods)).toEqual([
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
    expect(lotShade(open(6, 6))).toEqual([]);
  });

  it('is where the rules leave open ground out of the sun', () => {
    const state = rules.newRun({
      seed: 'shade-check',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    expect(state.house.pieces).toHaveLength(0);
    const { lot } = state.house;
    const shaded = new Set(lotShade(lot).map((t) => `${t.x},${t.y}`));
    expect(shaded.size).toBeGreaterThan(0);
    for (let y = 0; y < lot.height; y++) {
      for (let x = 0; x < lot.width; x++) {
        const own = terrainAt(lot, x, y);
        if (own === 'tree' || own === 'oldShed') continue;
        const lit = rules.describeTile(state, x, y)!.regions.includes('sunny');
        expect(lit, `${x},${y}`).toBe(!shaded.has(`${x},${y}`));
      }
    }
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

  it('gives every shore the lawn’s own blades: the sun has no band (D-120)', () => {
    const plan = waterPlan(
      lotFromRows(['......', '......', '......', '.PP...', '.PP...', '......'], 'left'),
    );
    expect(plan.tiles.length).toBeGreaterThan(0);
    for (const t of plan.tiles) {
      expect(shoreSet(t.piece)).toBe(t.piece.block === 'outer' ? 'shore' : 'shore-corners');
    }
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
