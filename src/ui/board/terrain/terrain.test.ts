import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng, type RgbaImage } from '../../../../scripts/png.ts';
import { BALANCE } from '../../../content/balance.ts';
import { generateLot, lotFromRows, terrainAt } from '../../../rules/lot.ts';
import { rules, type Lot } from '../../../rules/index.ts';
import { BLOB47_MASKS, blobTile, E, N, NE, NW, S, SE, SUB, SW, W } from '../autotile.ts';
import { FEEL } from '../../fx/feel.ts';
import { sheetRect } from './atlas.ts';
import { grassSprite, TUFT_EVERY, WILDFLOWERS_EVERY } from './grass.ts';
import { seedSalt, tileHash } from './hash.ts';
import { lotShade, SHADE_ROUND, shadeInset } from './shade.ts';
import {
  FISH_CELLS,
  FISH_MAX,
  FISH_NARROW,
  FISH_OPEN,
  FROG_EVERY,
  FROG_PAD,
  lifeBeat,
  lifeStrip,
  LOG_POND_CELLS,
  LOGS,
  RUNS,
  shoreSet,
  waterBodies,
  waterLife,
  waterPlan,
  type WaterCritter,
} from './water.ts';

const cell = (s: number) => Math.floor(s / SUB);

/** A width × height lot of open ground, the sun at the back. */
function open(width: number, height: number): Lot {
  return lotFromRows(Array.from({ length: height }, () => '.'.repeat(width)));
}

describe('the title screen’s lawn', () => {
  const N = 80;
  const lawn = Array.from({ length: N * N }, (_, i) => grassSprite(i % N, Math.floor(i / N)));

  it('puts about one tuft in 11 subtiles and flowers on about one in 23 of the rest', () => {
    const tufts = lawn.filter((id) => id?.startsWith('tuft-')).length;
    const flowers = lawn.filter((id) => id?.startsWith('wildflowers-')).length;
    expect(tufts / lawn.length).toBeGreaterThan(0.75 / TUFT_EVERY);
    expect(tufts / lawn.length).toBeLessThan(1.25 / TUFT_EVERY);
    expect(flowers / lawn.length).toBeGreaterThan(0.75 / WILDFLOWERS_EVERY);
    expect(flowers / lawn.length).toBeLessThan(1.25 / WILDFLOWERS_EVERY);
  });

  it('gives every tuft the lawn’s own colors: the sun has no band (D-120)', () => {
    for (const id of lawn) if (id?.startsWith('tuft-')) expect(['tuft-0', 'tuft-1']).toContain(id);
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

  it('rounds only the far corners of a run of shade, the near half square (D-190)', () => {
    // At the far edge (depth 0) the corner is cut in furthest; from SHADE_ROUND px in, not at all.
    expect(shadeInset(0)).toBeGreaterThan(SHADE_ROUND / 2);
    expect(shadeInset(0)).toBeLessThanOrEqual(SHADE_ROUND);
    for (let d = 1; d < 32; d++) expect(shadeInset(d)).toBeLessThanOrEqual(shadeInset(d - 1));
    for (let d = SHADE_ROUND; d < 32; d++) expect(shadeInset(d)).toBe(0);
    expect(SHADE_ROUND).toBeLessThanOrEqual(16);
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

  it('floats lily pads on a pond’s open water, and on a lake’s by the shore (D-190)', () => {
    const lots = Array.from({ length: 60 }, (_, i) => generateLot(`lily-${i}`, BALANCE.lot));
    const lilies = { pond: 0, lake: 0 };
    for (const l of lots) {
      const p = waterPlan(l);
      const pieces = new Map(p.tiles.map((t) => [`${t.sx},${t.sy}`, t.piece]));
      for (const lily of p.lilies) {
        const x = cell(lily.sx);
        const y = cell(lily.sy);
        const kind = terrainAt(l, x, y);
        expect(['pond', 'lake']).toContain(kind);
        lilies[kind as 'pond' | 'lake']++;
        expect(pieces.get(`${lily.sx},${lily.sy}`)).toEqual({ block: 'outer', col: 1, row: 1 });
        if (kind === 'lake') {
          // A cell of the lake beside open ground of the lot, sides or corners.
          const shore = [-1, 0, 1].some((dy) =>
            [-1, 0, 1].some((dx) => {
              const [nx, ny] = [x + dx, y + dy];
              return nx >= 0 && ny >= 0 && nx < l.width && ny < l.height && !terrainAt(l, nx, ny);
            }),
          );
          expect(shore, `${lily.sx},${lily.sy}`).toBe(true);
        }
      }
    }
    expect(lilies.pond).toBeGreaterThan(0);
    expect(lilies.lake).toBeGreaterThan(0);
  });

  it('sets logs adrift on lakes and big ponds, clear of the shore and the lilies (D-190)', () => {
    const lots = Array.from({ length: 160 }, (_, i) => {
      const seed = `log-${i}`;
      const l = generateLot(seed, BALANCE.lot);
      return { l, p: waterPlan(l, seedSalt(seed)) };
    });
    let lakes = 0;
    let lakeLogs = 0;
    for (const { l, p } of lots) {
      const sw = l.width * SUB;
      const open = new Set(
        p.tiles
          .filter((t) => t.piece.block === 'outer' && t.piece.col === 1 && t.piece.row === 1)
          .map((t) => t.sy * sw + t.sx),
      );
      const lilies = new Set(p.lilies.map((x) => x.sy * sw + x.sx));
      const taken = new Set<number>();
      for (const log of p.logs) {
        expect(LOGS).toContain(log.id);
        const r = {
          w: Math.ceil(sheetRect(log.id).w / 16),
          h: Math.ceil(sheetRect(log.id).h / 16),
        };
        // The log's box and a subtile round it: open water with no lily, a cell from the edge.
        expect(log.sx - 1).toBeGreaterThanOrEqual(SUB - 1);
        expect(log.sy - 1).toBeGreaterThanOrEqual(SUB - 1);
        expect(log.sx + r.w).toBeLessThanOrEqual(sw - SUB);
        expect(log.sy + r.h).toBeLessThanOrEqual(l.height * SUB - SUB);
        for (let y = log.sy - 1; y <= log.sy + r.h; y++) {
          for (let x = log.sx - 1; x <= log.sx + r.w; x++) {
            expect(open.has(y * sw + x), `${log.id} at ${log.sx},${log.sy}`).toBe(true);
            expect(lilies.has(y * sw + x)).toBe(false);
            if (y >= log.sy && y < log.sy + r.h && x >= log.sx && x < log.sx + r.w) {
              expect(taken.has(y * sw + x)).toBe(false);
              taken.add(y * sw + x);
            }
          }
        }
      }
      for (const body of waterBodies(l)) {
        const mine = p.logs.filter((g) =>
          body.cells.includes(cell(g.sy) * l.width + cell(g.sx)),
        ).length;
        if (body.kind === 'lake') {
          lakes++;
          lakeLogs += mine;
          expect(mine).toBeLessThanOrEqual(2);
        } else if (body.kind === 'pond' && body.cells.length >= LOG_POND_CELLS) {
          expect(mine).toBeLessThanOrEqual(1);
        } else {
          expect(mine, `${body.kind} of ${body.cells.length}`).toBe(0);
        }
      }
    }
    expect(lakes).toBeGreaterThan(5);
    // Most lakes have room for both.
    expect(lakeLogs).toBeGreaterThan(1.5 * lakes);
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
    expect(waterPlan(open(4, 4))).toEqual({
      box: null,
      look: 'meadow',
      tiles: [],
      lilies: [],
      logs: [],
    });
  });
});

describe('life at the water (D-185)', () => {
  const SEEDS = Array.from({ length: 120 }, (_, i) => `water-${i}`);
  const LOTS = SEEDS.map((seed) => {
    const lot = generateLot(seed, BALANCE.lot);
    const salt = seedSalt(seed);
    const plan = waterPlan(lot, salt);
    return { seed, lot, salt, plan, life: waterLife(lot, plan, salt) };
  });
  /** The cell the middle of what shows of a critter's frame is over. */
  const cellOf = (lot: Lot, c: WaterCritter) =>
    Math.floor((c.y + c.clip.y + c.clip.h / 2) / 32) * lot.width +
    Math.floor((c.x + c.clip.x + c.clip.w / 2) / 32);
  /** Whether a critter is over this body of water. */
  const over = (lot: Lot, body: { cells: readonly number[] }) => (c: WaterCritter) =>
    body.cells.includes(cellOf(lot, c));

  it('sits a frog on some of each pond’s and lake’s big lily pads, and on nothing else', () => {
    let ponds = 0;
    for (const { lot, plan, life } of LOTS) {
      const pads = plan.lilies.filter((l) => l.id === FROG_PAD.id);
      for (const f of life.frogs) {
        const at = f.flip ? FROG_PAD.mirrored : FROG_PAD.at;
        const pad = pads.find((l) => l.sx * 16 + at.x === f.x && l.sy * 16 + at.y === f.y);
        expect(pad, `frog at ${f.x},${f.y}`).toBeDefined();
        expect(f.clip).toEqual({ x: 0, y: 0, w: 16, h: 16 });
      }
      for (const body of waterBodies(lot).filter((b) => b.kind !== 'creek')) {
        const mine = pads.filter((l) => body.cells.includes(cell(l.sy) * lot.width + cell(l.sx)));
        const frogs = life.frogs.filter(over(lot, body));
        if (mine.length > 0) ponds++;
        // One for about every FROG_EVERY big pads, and one at least where there are any.
        const want = mine.length === 0 ? 0 : Math.max(1, Math.round(mine.length / FROG_EVERY));
        expect(frogs).toHaveLength(want);
      }
    }
    expect(ponds).toBeGreaterThan(20);
  });

  it('brings fish to every pond, creek and lake, on open water or across the creek', () => {
    const kinds = new Set<string>();
    for (const { lot, plan, life } of LOTS) {
      const pieces = new Map(plan.tiles.map((t) => [`${t.sx},${t.sy}`, t.piece]));
      const lilies = new Set(plan.lilies.map((l) => `${l.sx},${l.sy}`));
      // D-190: the subtiles under a log adrift.
      const logged = new Set(
        plan.logs.flatMap((g) => {
          const r = sheetRect(g.id);
          return Array.from({ length: Math.ceil(r.w / 16) * Math.ceil(r.h / 16) }, (_, k) => {
            const w = Math.ceil(r.w / 16);
            return `${g.sx + (k % w)},${g.sy + Math.floor(k / w)}`;
          });
        }),
      );
      for (const body of waterBodies(lot)) {
        kinds.add(body.kind);
        const fish = life.fish.filter(over(lot, body));
        const want = Math.min(FISH_MAX, Math.max(1, Math.round(body.cells.length / FISH_CELLS)));
        expect(fish.length, `${body.kind} of ${body.cells.length}`).toBeGreaterThan(0);
        expect(fish.length).toBeLessThanOrEqual(want);
        for (const f of fish) {
          if (f.clip.w === 16 && f.clip.h === 16) {
            // A whole subtile of open water, with no lily pad on it.
            expect(f.x % 16 === 0 && f.y % 16 === 0).toBe(true);
            const at = `${f.x / 16},${f.y / 16}`;
            expect(pieces.get(at)).toEqual({ block: 'outer', col: 1, row: 1 });
            expect(lilies.has(at)).toBe(false);
            expect(logged.has(at)).toBe(false);
            expect(FISH_OPEN).toContain(f.id);
          } else {
            // Across a straight run of the creek, showing only between its banks.
            expect(body.kind).toBe('creek');
            expect(f.id).toBe(FISH_NARROW);
            const run = Object.values(RUNS).find(
              (r) =>
                r.clip === f.clip && (f.x - r.frame.x) % 32 === 0 && (f.y - r.frame.y) % 32 === 0,
            );
            expect(run).toBeDefined();
          }
        }
        // Two in the same water keep apart.
        for (const a of fish) {
          for (const b of fish) {
            if (a === b) continue;
            const far = Math.abs(a.x - b.x) >= 3 * 32 || Math.abs(a.y - b.y) >= 3 * 32;
            expect(far).toBe(true);
          }
        }
      }
    }
    expect([...kinds].sort()).toEqual(['creek', 'lake', 'pond']);
  });

  it('shows a creek’s fish only on its open water, between the banks’ shadows', () => {
    const shore = png('shore');
    // The shore's open water: its light colors, in every frame.
    const LIGHT = ['3ca3b2', '369ab0', '3690ae', '3fabb7'];
    const light = (x: number, y: number) => {
      const i = (y * shore.width + x) * 4;
      const hex = [0, 1, 2].map((c) => shore.rgba[i + c]!.toString(16).padStart(2, '0')).join('');
      return shore.rgba[i + 3] === 255 && LIGHT.includes(hex);
    };
    // A cell's art px, in the 3 × 3 block's tiles for an east–west run (top edge over bottom
    // edge) or a north–south one (left edge beside right edge).
    const eastWest = (x: number, y: number, k: number) =>
      light(k * 48 + 16 + (x % 16), y < 16 ? y : 32 + (y - 16));
    const northSouth = (x: number, y: number, k: number) =>
      light(k * 48 + (x < 16 ? x : 32 + (x - 16)), 16 + (y % 16));
    for (const [run, at] of [
      [RUNS.eastWest, eastWest],
      [RUNS.northSouth, northSouth],
    ] as const) {
      for (let k = 0; k < 8; k++) {
        for (let y = 0; y < run.clip.h; y++) {
          for (let x = 0; x < run.clip.w; x++) {
            expect(at(run.frame.x + run.clip.x + x, run.frame.y + run.clip.y + y, k)).toBe(true);
          }
        }
      }
    }
  });

  it('keeps fish off a cell of creek a Driveway bridges', () => {
    const creek = LOTS.find(({ life }) => life.fish.some((f) => f.clip.h < 16));
    expect(creek).toBeDefined();
    const { lot, plan, salt, life } = creek!;
    const covered = life.fish.map((f) => cellOf(lot, f));
    const moved = waterLife(lot, plan, salt, covered);
    expect(moved.fish.length).toBeGreaterThan(0);
    for (const f of moved.fish) expect(covered).not.toContain(cellOf(lot, f));
  });

  it('is the same for the same lot every time, and its own for each run', () => {
    for (const { lot, plan, salt, life } of LOTS.slice(0, 20)) {
      expect(waterLife(lot, plan, salt)).toEqual(life);
    }
    const lot = lotFromRows(
      Array.from({ length: 12 }, (_, y) => (y >= 2 && y < 10 ? '..PPPPPPPP..' : '............')),
    );
    const spots = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => {
        const salt = seedSalt(s);
        const life = waterLife(lot, waterPlan(lot, salt), salt);
        return JSON.stringify(life.fish.map((f) => [f.x, f.y, f.id]));
      }),
    );
    expect(spots.size).toBeGreaterThan(3);
  });

  it('times each critter its own way: every so often, from its own phase', () => {
    const f = FEEL.life.water;
    for (const [every, frames, ms] of [
      [f.frogEveryMs, 6, 120],
      [f.fishEveryMs, 14, 110],
    ] as const) {
      const delays = new Set<number>();
      for (let beat = 0; beat < 4000; beat += 37) {
        const b = tileHash(beat, 7, 1);
        const { positions, delayMs } = lifeBeat(b, frames, ms, every);
        expect(positions).toBeGreaterThan(frames);
        expect(positions * ms).toBeGreaterThanOrEqual(every[0] - ms);
        expect(positions * ms).toBeLessThanOrEqual(every[1] + ms);
        expect(delayMs % ms).toBe(0);
        expect(delayMs).toBeLessThan(positions * ms);
        delays.add(delayMs);
      }
      expect(delays.size).toBeGreaterThan(50);
    }
    // Rare and calm: a fish now and then, a frog's breath every few seconds.
    expect(f.fishEveryMs[0]).toBeGreaterThanOrEqual(10000);
    expect(f.frogEveryMs[0]).toBeGreaterThanOrEqual(4000);
  });

  it('breathes a frog then sits it still; brings fish in after open water', () => {
    expect(lifeStrip('frog', 6, 10)).toEqual([0, 1, 2, 3, 4, 5, 0, 0, 0, 0]);
    expect(lifeStrip('fish', 3, 7)).toEqual([-1, -1, -1, -1, 0, 1, 2]);
    // Held on its first position (Reduce motion): the frog sits, and no fish shows.
    expect(lifeStrip('frog', 6, 60)[0]).toBe(0);
    expect(lifeStrip('fish', 14, 150)[0]).toBe(-1);
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

  it('the fish (D-185): only their shadows, the open water behind them keyed out', () => {
    for (const id of FISH_OPEN) {
      const img = png(id);
      let shadow = 0;
      for (let i = 0; i < img.rgba.length; i += 4) {
        if (img.rgba[i + 3] === 0) continue;
        shadow++;
        const hex = [0, 1, 2].map((c) => img.rgba[i + c]!.toString(16).padStart(2, '0')).join('');
        expect(hex, id).not.toBe('3ca3b2');
      }
      // Fish, but nowhere near a frame's worth of water.
      expect(shadow).toBeGreaterThan(100);
      expect(shadow / (img.width * img.height)).toBeLessThan(0.3);
    }
  });
});

describe('the water’s life on the board (D-185)', () => {
  const css = readFileSync(resolve(import.meta.dirname, 'terrain.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  };

  it('pauses under a sheet over the board, as the water does', () => {
    expect(rule('.water-life > .life-strip')).toMatch(/animation-name:\s*water-life/);
    expect(rule('.board.covered .water-life > .life-strip')).toMatch(
      /animation-play-state:\s*paused/,
    );
  });

  it('holds a frog still and hides the fish with Reduce motion', () => {
    expect(rule('.reduce-motion .water-life > .life-strip')).toMatch(/animation:\s*none/);
    expect(rule('.reduce-motion .ground > .water-life.fish')).toMatch(/display:\s*none/);
  });
});
