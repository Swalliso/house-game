import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../content/balance.ts';
import { generateLot, lotFromRows, terrainAt } from '../../../rules/lot.ts';
import type { Lot, TerrainId } from '../../../rules/index.ts';
import { CELL, hasSprite, type SpriteId } from '../../sprites.ts';
import { blobTile, E, N, NE, NW, S, SE, SUB, SUBTILE, SW, W } from '../autotile.ts';
import { sheetRect } from './atlas.ts';
import { lotLook } from './biome.ts';
import { DRIFT_ZONE, GROUND, groundPlan, tidyPatch, type GroundBit } from './ground.ts';
import { seedSalt } from './hash.ts';
import { bigTreeBlocks, treeKind } from './objects.ts';
import { woodsFloor } from './woods.ts';

const LOTS = Array.from({ length: 40 }, (_, i) => {
  const seed = `ground-${i}`;
  const lot = generateLot(seed, BALANCE.lot);
  const salt = seedSalt(seed);
  return { seed, lot, salt, plan: groundPlan(lot, salt) };
});

const key = (sx: number, sy: number) => `${sx},${sy}`;
const cellOf = (lot: Lot, sx: number, sy: number) =>
  terrainAt(lot, Math.floor(sx / SUB), Math.floor(sy / SUB));
const WATER: readonly TerrainId[] = ['pond', 'creek', 'lake'];
const isWater = (lot: Lot, x: number, y: number) => {
  const t = terrainAt(lot, x, y);
  return t !== null && WATER.includes(t);
};
/** The subtile a scatter sprite is centered on (put() nudges it at most 3 px). */
const subtileOf = (b: GroundBit) => {
  const r = sheetRect(b.id);
  return {
    sx: Math.floor((b.x + Math.floor(r.w / 2)) / SUBTILE),
    sy: Math.floor((b.y + Math.floor(r.h / 2)) / SUBTILE),
  };
};

describe('the ground (D-190)', () => {
  it('samples every look, and a lake', () => {
    expect(new Set(LOTS.map(({ lot }) => lotLook(lot)))).toEqual(
      new Set(['meadow', 'autumn', 'dry']),
    );
    expect(LOTS.some(({ lot }) => lot.terrain.includes('lake'))).toBe(true);
  });

  it('lays its patches on open ground only, and the woods’ floor on every Tree cell', () => {
    for (const { lot, plan } of LOTS) {
      const trees: { x: number; y: number }[] = [];
      for (let y = 0; y < lot.height; y++) {
        for (let x = 0; x < lot.width; x++)
          if (terrainAt(lot, x, y) === 'tree') trees.push({ x, y });
      }
      expect(plan.floor.cells).toEqual(trees);
      for (const s of [...plan.light, ...plan.floor.lush, ...plan.dirt]) {
        expect(cellOf(lot, s.sx, s.sy), key(s.sx, s.sy)).toBeNull();
      }
      // The lush grass is one patch; the sunny grass and the bare earth lie where it isn't.
      const lush = new Set(plan.floor.lush.map((s) => key(s.sx, s.sy)));
      for (const s of [...plan.light, ...plan.dirt]) expect(lush.has(key(s.sx, s.sy))).toBe(false);
    }
  });

  it('keeps every patch two subtiles wide or more: no strips, no specks', () => {
    for (const { plan } of LOTS) {
      for (const patch of [plan.light, plan.floor.lush, plan.dirt]) {
        const has = new Set(patch.map((s) => key(s.sx, s.sy)));
        const at = (x: number, y: number) => has.has(key(x, y));
        for (const { sx, sy } of patch) {
          const inBlock = [
            [0, 0],
            [-1, 0],
            [0, -1],
            [-1, -1],
          ].some(
            ([dx, dy]) =>
              at(sx + dx!, sy + dy!) &&
              at(sx + dx! + 1, sy + dy!) &&
              at(sx + dx!, sy + dy! + 1) &&
              at(sx + dx! + 1, sy + dy! + 1),
          );
          const filled = at(sx - 1, sy) && at(sx + 1, sy) && at(sx, sy - 1) && at(sx, sy + 1);
          expect(inBlock || filled, key(sx, sy)).toBe(true);
        }
      }
    }
  });

  it('tidies a patch: drops strips and specks, fills a hole its four sides close', () => {
    const rows = ['##..#', '##...', '.....', '###.#', '#.#..', '###..'];
    const width = 5;
    const patch = new Uint8Array(
      rows
        .join('')
        .split('')
        .map((c) => (c === '#' ? 1 : 0)),
    );
    const out = tidyPatch(patch, width, rows.length, () => true);
    const shown = Array.from({ length: rows.length }, (_, y) =>
      Array.from({ length: width }, (_, x) => (out[y * width + x] ? '#' : '.')).join(''),
    );
    // The 2 × 2 block stays; the lone subtiles go, and so does the ring round a hole, which
    // has no whole 2 × 2 block in it.
    expect(shown).toEqual(['##...', '##...', '.....', '.....', '.....', '.....']);
    // A hole whose four sides are all in the patch joins it, where `fill` lets it.
    const solid = new Uint8Array(25).fill(1);
    solid[12] = 0;
    expect([...tidyPatch(solid, 5, 5, () => true)]).toEqual(new Array(25).fill(1));
    expect(tidyPatch(solid, 5, 5, () => false)[12]).toBe(0);
  });

  it('keeps bare earth off the water’s edge, and lays the most of it on a dry lot', () => {
    let meadow = 0;
    let dry = 0;
    for (const { lot, salt, plan } of LOTS) {
      for (const { sx, sy } of plan.dirt) {
        const x = Math.floor(sx / SUB);
        const y = Math.floor(sy / SUB);
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          expect(isWater(lot, x + dx, y + dy), key(sx, sy)).toBe(false);
        }
      }
      meadow += groundPlan({ ...lot, biome: undefined }, salt).dirt.length;
      dry += groundPlan({ ...lot, biome: 'dry' }, salt).dirt.length;
    }
    expect(GROUND.dry.dirt).toBeLessThan(GROUND.meadow.dirt);
    expect(dry).toBeGreaterThan(3 * meadow);
  });

  it('grows the grass lush by the water and the woods', () => {
    let near = 0;
    let nearLush = 0;
    let far = 0;
    let farLush = 0;
    for (const { lot, salt } of LOTS) {
      const plan = groundPlan({ ...lot, biome: undefined }, salt);
      const lush = new Set(plan.floor.lush.map((s) => key(s.sx, s.sy)));
      for (let sy = 0; sy < lot.height * SUB; sy++) {
        for (let sx = 0; sx < lot.width * SUB; sx++) {
          if (cellOf(lot, sx, sy) !== null) continue;
          const x = Math.floor(sx / SUB);
          const y = Math.floor(sy / SUB);
          let wet = false;
          let clear = true;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const t = terrainAt(lot, x + dx, y + dy);
              if (t === 'tree' || (t !== null && WATER.includes(t))) clear = false;
              if (Math.abs(dx) + Math.abs(dy) === 1 && isWater(lot, x + dx, y + dy)) wet = true;
            }
          }
          if (wet) {
            near++;
            if (lush.has(key(sx, sy))) nearLush++;
          } else if (clear) {
            far++;
            if (lush.has(key(sx, sy))) farLush++;
          }
        }
      }
    }
    expect(near).toBeGreaterThan(500);
    expect(nearLush / near).toBeGreaterThan(2 * (farLush / far));
  });

  it('strews a sprite only where its whole box lies on open ground of the lot', () => {
    for (const { lot, plan } of LOTS) {
      expect(plan.scatter.length).toBeGreaterThan(50);
      for (const b of plan.scatter) {
        const r = sheetRect(b.id);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + r.w).toBeLessThanOrEqual(lot.width * CELL);
        expect(b.y + r.h).toBeLessThanOrEqual(lot.height * CELL);
        for (let y = Math.floor(b.y / CELL); y <= Math.floor((b.y + r.h - 1) / CELL); y++) {
          for (let x = Math.floor(b.x / CELL); x <= Math.floor((b.x + r.w - 1) / CELL); x++) {
            expect(terrainAt(lot, x, y), `${b.id} at ${b.x},${b.y}`).toBeNull();
          }
        }
      }
    }
  });

  it('drifts the wildflowers in one color over each patch', () => {
    let drifts = 0;
    for (const { plan } of LOTS) {
      const zones = new Map<string, Set<SpriteId>>();
      for (const b of plan.scatter) {
        if (!b.id.startsWith('drift-') || b.id.startsWith('drift-log')) continue;
        drifts++;
        const { sx, sy } = subtileOf(b);
        const zone = key(Math.floor(sx / DRIFT_ZONE), Math.floor(sy / DRIFT_ZONE));
        zones.set(zone, (zones.get(zone) ?? new Set()).add(b.id));
      }
      for (const [zone, ids] of zones) expect(ids.size, zone).toBe(1);
    }
    expect(drifts).toBeGreaterThan(100);
  });

  it('strews fallen leaves round the woods only in autumn', () => {
    let autumn = 0;
    for (const { lot, plan } of LOTS) {
      const leaves = plan.scatter.filter((b) => b.id.startsWith('leaves-')).length;
      if (lotLook(lot) === 'autumn') autumn += leaves;
      else expect(leaves).toBe(0);
    }
    expect(autumn).toBeGreaterThan(50);
  });

  it('gives every tuft the lawn’s own colors: the sun has no band (D-120)', () => {
    for (const { plan } of LOTS) {
      for (const b of plan.scatter) {
        if (b.id.startsWith('tuft-')) expect(['tuft-0', 'tuft-1']).toContain(b.id);
      }
    }
  });

  it('puts the undergrowth at the foot of Tree cells, never behind a big tree', () => {
    let under = 0;
    let trees = 0;
    for (const { lot, plan } of LOTS) {
      trees += plan.floor.cells.length;
      const behind = new Set(bigTreeBlocks(lot).flatMap((b) => [key(b.x, b.y), key(b.x + 1, b.y)]));
      for (const b of plan.undergrowth) {
        under++;
        const r = sheetRect(b.id);
        const x = Math.floor(b.x / CELL);
        const y = Math.floor((b.y + r.h - 1) / CELL);
        expect(Math.floor((b.x + r.w - 1) / CELL), b.id).toBe(x);
        expect(terrainAt(lot, x, y)).toBe('tree');
        expect(behind.has(key(x, y))).toBe(false);
        // Its foot on the cell's last three rows of pixels.
        expect((y + 1) * CELL - (b.y + r.h)).toBeLessThan(3);
      }
    }
    expect(under).toBeGreaterThan(trees / 6);
    expect(under).toBeLessThan(trees / 2);
  });

  it('looks the same for the same lot every time, and its own for each run', () => {
    const { lot, salt, plan } = LOTS[0]!;
    expect(groundPlan(lot, salt)).toEqual(plan);
    const other = groundPlan(lot, seedSalt('another run'));
    const a = new Set(plan.light.map((s) => key(s.sx, s.sy)));
    const shared = other.light.filter((s) => a.has(key(s.sx, s.sy))).length;
    expect(shared / a.size).toBeLessThan(0.6);
    // The trees too: the same cell grows different kinds from run to run.
    const kinds = new Set(
      ['s1', 's2', 's3', 's4', 's5', 's6'].map((s) => treeKind(10, 22, seedSalt(s))),
    );
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('changes only near a Tree cleared for a piece', () => {
    const { lot, salt, plan } = LOTS.find(({ lot }) => lot.terrain.includes('tree'))!;
    const i = lot.terrain.indexOf('tree');
    const cx = i % lot.width;
    const cy = Math.floor(i / lot.width);
    const cleared = groundPlan(
      { ...lot, terrain: lot.terrain.map((t, j) => (j === i ? null : t)) },
      salt,
    );
    const far = (s: { sx: number; sy: number }) =>
      Math.max(Math.abs(Math.floor(s.sx / SUB) - cx), Math.abs(Math.floor(s.sy / SUB) - cy)) > 3;
    const patches = (p: typeof plan) =>
      [p.light, p.floor.lush, p.dirt].map((patch) => patch.filter(far).map((t) => key(t.sx, t.sy)));
    expect(patches(cleared)).toEqual(patches(plan));
    const farBits = (bits: readonly GroundBit[]) => bits.filter((b) => far(subtileOf(b)));
    expect(farBits(cleared.scatter)).toEqual(farBits(plan.scatter));
  });

  it('cuts each sprite for both looks or neither, the meadow cut’s size (D-174)', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../../art/limezu/ground.json'), 'utf8'),
    ) as Record<string, unknown>;
    const ids = Object.keys(manifest).filter((id) => !/-(autumn|dry)$/.test(id));
    expect(ids.length).toBeGreaterThan(30);
    for (const id of ids) {
      expect(hasSprite(id), id).toBe(true);
      if (!hasSprite(id)) continue;
      expect(hasSprite(`${id}-dry`), id).toBe(hasSprite(`${id}-autumn`));
      for (const cut of [`${id}-autumn`, `${id}-dry`]) {
        if (!hasSprite(cut)) continue;
        const a = sheetRect(cut);
        const b = sheetRect(id);
        expect([a.w, a.h], cut).toEqual([b.w, b.h]);
      }
    }
    // The leaves are autumn's own, and the logs float on water, which has no look.
    expect(hasSprite('leaves-0-autumn')).toBe(false);
    expect(hasSprite('drift-log-0-autumn')).toBe(false);
  });
});

describe('the woods’ floor with the lush grass (D-190)', () => {
  // A 2 × 2 grove, and lush grass on the open cell to its right.
  const lot = lotFromRows(['......', '.TT...', '.TT...', '......']);
  const lushCell = (sx: number, sy: number) =>
    Math.floor(sx / SUB) === 3 && Math.floor(sy / SUB) === 1;
  const floor = woodsFloor(lot, lushCell);
  const at = new Map(floor.edge.map((t) => [key(t.sx, t.sy), t]));

  it('takes in the lush grass: one floor, edged only where it meets the open lawn', () => {
    expect(floor.lush).toEqual([
      { sx: 6, sy: 2 },
      { sx: 7, sy: 2 },
      { sx: 6, sy: 3 },
      { sx: 7, sy: 3 },
    ]);
    // Where the grove meets the lush grass, no edge: the grove's subtile (5, 2) is closed
    // on the east.
    expect(at.get('5,2')).toMatchObject(blobTile('godot', E | SE | S | SW | W));
    // The lush cell's own corner, open to the lawn north and east.
    expect(at.get('7,2')).toMatchObject(blobTile('godot', S | SW | W));
    expect(at.get('6,3')).toMatchObject(blobTile('godot', N | NE | E | W | NW));
  });

  it('lies on open ground only: a Tree, the water and the lot’s outside never go lush', () => {
    const small = lotFromRows(['.P..', '.T..', '....']);
    const all = woodsFloor(small, () => true);
    for (const s of all.lush) expect(cellOf(small, s.sx, s.sy)).toBeNull();
    expect(all.lush).toHaveLength((12 - 2) * SUB * SUB);
  });
});
