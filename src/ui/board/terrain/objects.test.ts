import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../content/balance.ts';
import { generateLot, isSunny, lotFromRows, terrainAt } from '../../../rules/lot.ts';
import type { Lot } from '../../../rules/index.ts';
import { CELL } from '../../sprites.ts';
import { blobTile, E, N, NE, NW, S, SE, SUB, SW, W } from '../autotile.ts';
import { boardRows, CANOPY_ROOM, ROAD_ROWS } from '../geometry.ts';
import { sheetRect } from './atlas.ts';
import { seedSalt } from './hash.ts';
import {
  bigTreeBlocks,
  boulders,
  canopyBox,
  finds,
  lotObjects,
  TREE_JITTER_UP,
  TREE_KINDS,
  treeKind,
  trees,
  type Placed,
} from './objects.ts';
import { streetRows, streetTiles } from './street.ts';
import { woodsFloor } from './woods.ts';

const SEEDS = ['jbf3zs', 'abc123', 'house7'];
const lots = SEEDS.map((seed) => generateLot(seed, BALANCE.lot));

function count(lot: Lot, t: string): number {
  let n = 0;
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) if (terrainAt(lot, x, y) === t) n++;
  }
  return n;
}

/** The cell a sprite stands in: the one its bottom middle is in. */
function foot(p: Placed): { x: number; y: number } {
  return { x: Math.floor((p.x + p.w / 2) / CELL), y: Math.floor((p.y + p.h - 1) / CELL) };
}

const isBig = (p: Placed) => p.id === 'tree-big' || p.id === 'tree-big-apple';

describe('the woods', () => {
  it('stand one tree on every Tree cell, or a big tree for a block’s lower row', () => {
    for (const lot of lots) {
      const placed = trees(lot);
      const big = placed.filter(isBig);
      expect(big).toHaveLength(bigTreeBlocks(lot).length);
      expect(placed.length - big.length).toBe(count(lot, 'tree') - 2 * big.length);
      const seen = new Set<string>();
      for (const p of placed.filter((q) => !isBig(q))) {
        const c = foot(p);
        expect(terrainAt(lot, c.x, c.y), p.id).toBe('tree');
        expect(seen.has(`${c.x},${c.y}`)).toBe(false);
        seen.add(`${c.x},${c.y}`);
      }
    }
  });

  it('keep each tree in its own cell and on the lot, rising only above it', () => {
    for (const lot of lots) {
      for (const p of trees(lot)) {
        const c = foot(p);
        const cells = isBig(p) ? 2 : 1;
        expect(p.x, p.id).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(lot.width * CELL);
        // Its bottom edge stays in its own cell; it may only rise above it.
        expect(p.y + p.h).toBeLessThanOrEqual((c.y + 1) * CELL);
        expect(p.y + p.h).toBeGreaterThan((c.y + 1) * CELL - 4);
        expect(p.top).toBe((c.y + 1 - cells) * CELL);
      }
    }
  });

  it('give every Tree beside open ground its own tree, so a piece’s trees can be counted', () => {
    for (const lot of lots) {
      const own = new Set(
        trees(lot)
          .filter((p) => !isBig(p))
          .map((p) => `${foot(p).x},${foot(p).y}`),
      );
      for (let y = 0; y < lot.height; y++) {
        for (let x = 0; x < lot.width; x++) {
          if (terrainAt(lot, x, y) !== 'tree') continue;
          const open = [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ].some(([dx, dy]) => {
            const nx = x + dx!;
            const ny = y + dy!;
            const onLot = nx >= 0 && ny >= 0 && nx < lot.width && ny < lot.height;
            return onLot && terrainAt(lot, nx, ny) !== 'tree';
          });
          if (open) expect(own.has(`${x},${y}`), `${x},${y}`).toBe(true);
        }
      }
    }
  });

  it('put big trees only on 2 × 2 blocks of Trees ringed by Trees or the lot’s edge', () => {
    const woods = lotFromRows([
      'TTTT..',
      'TTTT..',
      'TTTT..',
      'TTTT..',
      '......',
      '..TT..',
      '..TT..',
    ]);
    // Only the corner block is ringed by the lot's edge and Trees: every other block of the
    // wood has open ground beside it, and so does the lone 2 × 2 grove.
    expect(bigTreeBlocks(woods)).toEqual([{ x: 0, y: 0 }]);
    expect(bigTreeBlocks(lotFromRows(['......', '.TTTT.', '.TTTT.', '.TTTT.', '.TTTT.']))).toEqual([
      { x: 2, y: 2 },
    ]);
    expect(bigTreeBlocks(lotFromRows(['....', '.TT.', '.TT.', '....']))).toEqual([]);
  });

  it('look the same every time, with several kinds of tree', () => {
    const lot = lots[0]!;
    expect(trees(lot)).toEqual(trees(generateLot('jbf3zs', BALANCE.lot)));
    const kinds = new Set<string>();
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) kinds.add(treeKind(x, y));
    expect(kinds.size).toBe(8);
  });
});

describe('the woods’ floor', () => {
  const lot = lotFromRows(['......', '.TT...', '.TT...', '......', '....TT', '....TT']);
  const floor = woodsFloor(lot);
  it('lies under every Tree cell', () => {
    expect(floor.cells).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ]);
  });

  it('has a soft edge beside open ground, and along the street, but none at the other borders', () => {
    const at = new Map(floor.edge.map((t) => [`${t.sx},${t.sy}`, t]));
    // The grove's corner subtile is open only toward the grove.
    expect(at.get('2,2')).toMatchObject(blobTile('godot', E | SE | S));
    // The interior of the 2 × 2 grove: each subtile touches open ground on two sides.
    expect(floor.edge.filter((t) => t.sx < 6)).toHaveLength(12);
    // The corner wood runs on past the lot's right edge: no edge there…
    expect(at.has('11,10')).toBe(false);
    expect(at.get('8,8')).toMatchObject(blobTile('godot', E | SE | S));
    // …but along the street it closes with a verge of grass, the grass the street's fringe
    // hangs from.
    expect(at.get('11,11')).toMatchObject(blobTile('godot', N | NE | E | W | NW));
    expect(at.get('8,11')).toMatchObject(blobTile('godot', N | NE | E));
  });
});

describe('the boulders', () => {
  it('pile two or three rocks inside each Boulder cell, in the sunny side’s colors there', () => {
    for (const lot of lots) {
      const rocks = boulders(lot);
      const per = new Map<string, number>();
      for (const r of rocks) {
        const x = Math.floor(r.x / CELL);
        const y = Math.floor(r.y / CELL);
        expect(terrainAt(lot, x, y)).toBe('boulder');
        expect(r.x + r.w).toBeLessThanOrEqual((x + 1) * CELL);
        expect(r.y + r.h).toBeLessThanOrEqual((y + 1) * CELL + 2);
        expect(r.id).toBe(isSunny(lot, x, y) ? 'rocks-sunny' : 'rocks');
        per.set(`${x},${y}`, (per.get(`${x},${y}`) ?? 0) + 1);
      }
      expect(per.size).toBe(count(lot, 'boulder'));
      for (const n of per.values()) expect([2, 3]).toContain(n);
    }
  });
});

describe('the finds', () => {
  const lot = lotFromRows(['......', '.SS...', '.SS.K.', '......'], 'left');
  const placed = finds(lot);
  it('stand the Old Shed once, inside its 2 × 2 footprint', () => {
    const sheds = placed.filter((p) => p.id === 'old-shed');
    expect(sheds).toHaveLength(1);
    const shed = sheds[0]!;
    expect(shed.x).toBeGreaterThanOrEqual(1 * CELL);
    expect(shed.x + shed.w).toBeLessThanOrEqual(3 * CELL);
    expect(shed.y).toBe(1 * CELL);
    expect(shed.y + shed.h).toBe(3 * CELL);
  });

  it('dig the Time Capsule’s soil on its own cell', () => {
    const capsule = placed.find((p) => p.id.startsWith('time-capsule'))!;
    expect(capsule).toMatchObject({ x: 4 * CELL, y: 2 * CELL, w: CELL, h: CELL });
    // On the sunny side (the left band here), its grass takes the sunny colors.
    const sunny = finds(lotFromRows(['K...', '....'], 'left'));
    expect(sunny[0]!.id).toBe('time-capsule-sunny');
  });
});

describe('the canopy', () => {
  it('covers the lot and the row above it, so it keeps its size, when anything rises', () => {
    for (const lot of lots) {
      const placed = lotObjects(lot);
      const box = canopyBox(lot, placed)!;
      expect(box).toEqual({ x: 0, y: -CELL, w: lot.width * CELL, h: (lot.height + 1) * CELL });
      for (const p of placed) {
        if (p.y >= p.top) continue;
        expect(p.x).toBeGreaterThanOrEqual(box.x);
        expect(p.y).toBeGreaterThanOrEqual(box.y);
        expect(p.x + p.w).toBeLessThanOrEqual(box.x + box.w);
        expect(p.top).toBeLessThanOrEqual(box.y + box.h);
      }
    }
    const bare = lotFromRows(['.B..', '..K.']);
    expect(canopyBox(bare, lotObjects(bare))).toBeNull();
  });

  it('never rises past the room the board keeps above the lot', () => {
    // The tallest kind, at its most jittered, still fits (geometry.ts CANOPY_ROOM).
    for (const kind of TREE_KINDS) {
      expect(sheetRect(kind).h - CELL + TREE_JITTER_UP, kind).toBeLessThanOrEqual(CANOPY_ROOM);
    }
    const row = lotFromRows(['TTTTTTTTTTTT', '............']);
    for (let s = 0; s < 60; s++) {
      for (const p of trees(row, seedSalt(`s${s}`)))
        expect(p.y, p.id).toBeGreaterThanOrEqual(-CANOPY_ROOM);
    }
  });

  it('is drawn in row order, south in front, like the terrain', () => {
    const placed = lotObjects(lots[0]!);
    for (let i = 1; i < placed.length; i++) {
      const a = placed[i - 1]!;
      const b = placed[i]!;
      expect(a.y + a.h <= b.y + b.h).toBe(true);
    }
  });
});

describe('the street', () => {
  // A left band (columns 0 to 3) over a creek, with a Tree in the band's bottom row.
  const lot = lotFromRows(['......', '..C...', 'T.C...'], 'left');
  const tiles = streetTiles(lot);
  const top = lot.height * SUB;

  it('fills the street row and the road rows below it, edge to edge', () => {
    expect(streetRows()).toHaveLength((1 + ROAD_ROWS) * SUB);
    expect(boardRows(lot.height) * SUB - top).toBe(streetRows().length);
    for (let j = 0; j < streetRows().length; j++) {
      for (let sx = 0; sx < lot.width * SUB; sx++) {
        const here = tiles.filter((t) => t.sx === sx && t.sy === top + j);
        expect(here.length, `${sx},${j}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('is a sidewalk with its curb, then road with a dashed line, then the far sidewalk', () => {
    const at = (sx: number, j: number) =>
      tiles.filter((t) => t.sx === sx && t.sy === top + j && !t.id.endsWith('edge'));
    expect(streetRows()).toEqual(['sidewalk', 'curb', 'road', 'line', 'road', 'far']);
    expect(at(0, 0)).toEqual([
      { id: 'street-sidewalk', ...blobTile('godot', 255), sx: 0, sy: top },
    ]);
    expect(at(0, 1)[0]).toMatchObject(blobTile('godot', N | NE | E | W | NW));
    expect(at(0, 3)[0]!.id).toBe('street-line');
    expect(at(1, 3)[0]!.id).toBe('street-asphalt');
    expect(at(0, 5)[0]).toMatchObject(blobTile('godot', E | SE | S | SW | W));
  });

  it('takes a fringe of the lot’s grass along its top, in the colors above, not under water', () => {
    const blades = tiles.filter((t) => t.id.endsWith('edge') && !t.cols);
    expect(blades.map((t) => t.sx)).toEqual([0, 1, 2, 3, 6, 7, 8, 9, 10, 11]);
    for (const b of blades) {
      expect(b.sy).toBe(top);
      const sunny = isSunny(lot, Math.floor(b.sx / SUB), lot.height - 1);
      expect(b.id).toBe(sunny ? 'sun-edge' : 'woods-edge');
    }
    // Past the band, the sunny side's blades spill into the shade as they do above: the first
    // 6 px of the first shaded subtile. The Tree inside the band stays shaded to its edge.
    expect(tiles.filter((t) => t.cols)).toEqual([
      { id: 'sun-edge', ...blobTile('godot', E | SE | S | SW | W), sx: 8, sy: top, cols: [0, 6] },
    ]);
  });

  it('leaves the fringe out where a piece meets the street, so a Driveway reaches the sidewalk', () => {
    const front = [false, false, false, true, true, false];
    const fringe = streetTiles(lot, front).filter((t) => t.sy === top && t.id.endsWith('edge'));
    // Columns 3 and 4 (subtiles 6 to 9) are under the piece, the spill into column 4 too.
    expect(fringe.map((t) => t.sx)).toEqual([0, 1, 2, 3, 10, 11]);
    // The paving is all there.
    expect(streetTiles(lot, front).filter((t) => !t.id.endsWith('edge'))).toEqual(
      tiles.filter((t) => !t.id.endsWith('edge')),
    );
  });
});
