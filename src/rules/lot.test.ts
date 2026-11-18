import { describe, expect, it } from 'vitest';
import type { Lot, LotBalance, LotKind, TerrainId } from './index.ts';
import {
  generateLot,
  KIND_CHECKS,
  lotBiome,
  lotFromRows,
  lotProblems,
  lotToRows,
  lotTraits,
  protectedTerrain,
  terrainAt,
  withTraits,
} from './lot.ts';
import { TEST_LOT_BALANCE as B } from './testing.ts';
import { CONTENT } from '../content/index.ts';

const count = (lot: Lot, t: TerrainId) => lot.terrain.filter((x) => x === t).length;
/** Lot kinds off (D-166): every lot plain, as drawn before them. */
const PLAIN = { plain: 1 };
/** The meadow alone (D-174), with these kinds: D-166's lots as they were before biomes. */
function meadowOnly(
  b: LotBalance,
  kinds: Readonly<Partial<Record<LotKind, number>>> = b.biomes.meadow.kinds,
): LotBalance {
  return {
    ...b,
    biomes: {
      meadow: { weight: 1, kinds },
      lakeside: { weight: 0, kinds: {} },
      autumn: { weight: 0, kinds: {} },
      dry: { weight: 0, kinds: {} },
    },
  };
}
/** The lot without its finds, which go down last on whatever ground is free. */
const withoutFinds = (lot: Lot): Lot => ({
  ...lot,
  terrain: lot.terrain.map((t) => (t === 'oldShed' || t === 'timeCapsule' ? null : t)),
});
/** The checks a lot of this kind passed (D-174: a lake, a split creek, old woods relax them). */
const checksFor = (lot: Lot, b: LotBalance) => {
  const k = lot.kind ? KIND_CHECKS[lot.kind] : undefined;
  return lotProblems(withoutFinds(lot), { ...b, ...k?.checks }, k?.kept);
};

function creekCells(lot: Lot) {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) if (terrainAt(lot, x, y) === 'creek') cells.push({ x, y });
  }
  return cells;
}

describe('lot generation', () => {
  it('is the same lot for the same seed', () => {
    expect(generateLot('same', B)).toEqual(generateLot('same', B));
    expect(lotToRows(generateLot('a', B))).not.toEqual(lotToRows(generateLot('b', B)));
  });

  it('passes the regeneration checks for 1,000 seeds, and the creek never touches the street edge', () => {
    let creeks = 0;
    let terrainTotal = 0;
    for (let i = 0; i < 1000; i++) {
      const lot = generateLot(`seed-${i}`, B);
      expect(lot.width).toBe(24);
      expect(lot.height).toBe(24);
      expect(lotProblems(lot, B)).toEqual([]);
      for (let x = 0; x < lot.width; x++)
        expect(terrainAt(lot, x, lot.height - 1)).not.toBe('creek');
      if (count(lot, 'creek') > 0) creeks++;
      terrainTotal += lot.terrain.filter((t) => t !== null).length;
      const ponds = count(lot, 'pond');
      expect(ponds).toBeGreaterThanOrEqual(4);
      expect(ponds).toBeLessThanOrEqual(9);
      expect(count(lot, 'boulder')).toBeGreaterThanOrEqual(B.boulders[0]);
    }
    // About 70% of lots have a creek, and terrain covers about a fifth of the lot.
    expect(creeks).toBeGreaterThan(550);
    expect(creeks).toBeLessThan(850);
    const avg = terrainTotal / 1000;
    expect(avg).toBeGreaterThan(90);
    expect(avg).toBeLessThan(150);
  });

  it('passes the checks with the real lot balance for 1,000 seeds, before its finds go down', () => {
    // The finds (an Old Shed, Time Capsules) are placed after the checks, by design, so a 2×2
    // Old Shed on the street's side can tip a lot a fraction under minStreetSidePct (3 seeds in
    // 1,000). The checks are about the terrain the lot was drawn with: read it without the finds.
    const real = CONTENT.balance.lot;
    let finds = 0;
    for (let i = 0; i < 1000; i++) {
      const lot = generateLot(`seed-${i}`, real);
      expect(checksFor(lot, real), `seed-${i}`).toEqual([]);
      if (count(lot, 'oldShed') > 0 && count(lot, 'timeCapsule') > 0) finds++;
    }
    expect(finds).toBe(1000);
  });

  it('makes a 1-tile-wide creek from the back edge or a side to a side, never touching the pond', () => {
    for (let i = 0; i < 300; i++) {
      const lot = generateLot(`creek-${i}`, B);
      const cells = creekCells(lot);
      if (cells.length === 0) continue;
      const key = (x: number, y: number) => `${x},${y}`;
      const set = new Set(cells.map((c) => key(c.x, c.y)));
      // 1 tile wide: no 2×2 block of creek.
      for (const c of cells) {
        const block = [key(c.x + 1, c.y), key(c.x, c.y + 1), key(c.x + 1, c.y + 1)];
        expect(block.every((k) => set.has(k))).toBe(false);
      }
      // A simple path: every tile has at most 2 creek neighbors, and it's one piece.
      for (const c of cells) {
        const n = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([dx, dy]) => set.has(key(c.x + dx!, c.y + dy!))).length;
        expect(n).toBeLessThanOrEqual(2);
        expect(n).toBeGreaterThanOrEqual(1);
      }
      // One connected piece, with exactly two ends: one on the back edge or a side, one on a side.
      const seen = new Set([key(cells[0]!.x, cells[0]!.y)]);
      const stack = [cells[0]!];
      while (stack.length > 0) {
        const c = stack.pop()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const k = key(c.x + dx!, c.y + dy!);
          if (set.has(k) && !seen.has(k)) {
            seen.add(k);
            stack.push({ x: c.x + dx!, y: c.y + dy! });
          }
        }
      }
      expect(seen.size).toBe(cells.length);
      const ends = cells.filter(
        (c) =>
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].filter(([dx, dy]) => set.has(key(c.x + dx!, c.y + dy!))).length === 1,
      );
      expect(ends).toHaveLength(2);
      const onSide = (c: { x: number }) => c.x === 0 || c.x === lot.width - 1;
      expect(ends.every((c) => c.y === 0 || onSide(c))).toBe(true);
      expect(ends.some(onSide)).toBe(true);
      // It never touches the pond.
      for (const c of cells) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const x = c.x + dx!;
          const y = c.y + dy!;
          if (x >= 0 && y >= 0 && x < lot.width && y < lot.height) {
            expect(terrainAt(lot, x, y)).not.toBe('pond');
          }
        }
      }
    }
  });

  it('gives each lot a sun from one of its four edges, a quarter each (D-120)', () => {
    const sides = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      const sun = generateLot(`sun-${i}`, B).sun;
      sides.set(sun, (sides.get(sun) ?? 0) + 1);
    }
    expect([...sides.keys()].sort()).toEqual(['bottom', 'left', 'right', 'top']);
    for (const n of sides.values()) expect(n).toBeGreaterThan(200);
    expect(generateLot('sun-1', B)).toEqual(generateLot('sun-1', B));
  });

  it('flags lots the checks reject', () => {
    const b = { ...B, width: 6, height: 4, minFreeStreetTiles: 3 };
    // The creek cuts the street off from most of the lot.
    const cut = lotFromRows(['......', '......', 'CCCCCC', '......']);
    expect(lotProblems(cut, b).join()).toMatch(/street's side/);
    // Too few free street-edge tiles.
    const blocked = lotFromRows(['......', '......', '......', 'BBBBB.']);
    expect(lotProblems(blocked, b).join()).toMatch(/street-edge/);
    // Too much water and rock: under 85% of tiles free.
    const rocky = lotFromRows(['BBBB..', 'PP....', '......', '......']);
    expect(lotProblems(rocky, b).join()).toMatch(/free of water and boulders/);
    expect(lotProblems(lotFromRows(['B.....', '......', '......', '......']), b)).toEqual([]);
    // A creek on the street edge.
    const wet = lotFromRows(['......', '......', '......', '...C..']);
    expect(lotProblems(wet, b).join()).toMatch(/touches the street/);
  });

  it('round-trips through ASCII rows', () => {
    const rows = ['.TPC', 'B...'];
    expect(lotToRows(lotFromRows(rows))).toEqual(rows);
  });
});

describe('creek lots and the pond (D-119)', () => {
  // The meadow's draw (D-174): a dry lot seldom has a creek, and a lake lot has none.
  const real = meadowOnly(CONTENT.balance.lot);
  /** The lot without its finds, which go down last on whatever ground is free. */
  const bare = (lot: Lot) =>
    lot.terrain.map((t) => (t === 'oldShed' || t === 'timeCapsule' ? null : t));

  it('puts a creek on about a quarter of lots, and water on every lot', () => {
    let creeks = 0;
    let creekPonds = 0;
    for (let i = 0; i < 1000; i++) {
      const lot = generateLot(`seed-${i}`, real);
      const creek = count(lot, 'creek') > 0;
      const pond = count(lot, 'pond') > 0;
      if (creek) creeks++;
      if (creek && pond) creekPonds++;
      // A lot without a creek always has its pond.
      if (!creek) expect(pond, `seed-${i}`).toBe(true);
    }
    // creekPct 25: a little under, since a lot that fails its checks is made again, and the
    // last resort is creekless. About half the creek lots keep their pond.
    expect(creeks).toBeGreaterThan(180);
    expect(creeks).toBeLessThan(300);
    expect(creekPonds / creeks).toBeGreaterThan(0.35);
    expect(creekPonds / creeks).toBeLessThan(0.65);
  });

  it('leaves a creek lot as it was drawn, but for its pond, so fewer creeks only redraw the rest', () => {
    // The same seeds before D-119: creekPct 70, and every pond kept. Both plain (D-166 shapes
    // lots after this, on streams of their own).
    const plain = meadowOnly(real, PLAIN);
    const before = { ...plain, creekPct: 70, pondPctCreek: 100 };
    let same = 0;
    for (let i = 0; i < 300; i++) {
      const now = generateLot(`seed-${i}`, plain);
      const old = generateLot(`seed-${i}`, before);
      if (count(now, 'creek') === 0 || now.attempt !== old.attempt) continue;
      // The pond's tiles are open ground now or still pond; every other tile is as it was.
      const a = bare(now);
      const b = bare(old);
      a.forEach((t, k) => {
        if (b[k] === 'pond') expect(t === 'pond' || t === null).toBe(true);
        else expect(t, `seed-${i} tile ${k}`).toBe(b[k]);
      });
      same++;
    }
    expect(same).toBeGreaterThan(50);
  });
});

describe('lot traits (D-119)', () => {
  it('are the traits whose terrain the lot holds enough of, in content order', () => {
    const ids = (rows: readonly string[]) => lotTraits(CONTENT, lotFromRows(rows)).map((t) => t.id);
    // No Trees isn't Open: that's a kind a lot is shaped to (D-166), and a test's lot has none.
    expect(ids(['....', '....'])).toEqual([]);
    expect(ids(['..C.', '..C.'])).toEqual(['creekside']);
    // Wooded: 100 or more Tree tiles.
    const woods = (n: number) => {
      const row = 'T'.repeat(n).padEnd(120, '.');
      return [row, '.'.repeat(120)];
    };
    expect(ids(woods(99))).toEqual([]);
    expect(ids(woods(100))).toEqual(['wooded']);
    expect(ids(['C' + woods(100)[0]!.slice(1), woods(100)[1]!])).toEqual(['creekside']);
    expect(ids(['C' + 'T'.repeat(100) + '.'.repeat(19), '.'.repeat(120)])).toEqual([
      'creekside',
      'wooded',
    ]);
  });
});

// ---------------------------------------------------------------------------------------
// D-166: lot kinds. Once a lot passes its checks, most are shaped toward a trait.

describe('lot kinds (D-166)', () => {
  // D-166's kinds, as the meadow deals them (D-174).
  const real = meadowOnly(CONTENT.balance.lot);
  const plain = meadowOnly(real, PLAIN);
  /** The lot without its finds, which go down last on whatever ground is free. */
  const bare = (lot: Lot) =>
    lot.terrain.map((t) => (t === 'oldShed' || t === 'timeCapsule' ? null : t));
  const lots = Array.from({ length: 600 }, (_, i) => ({
    now: generateLot(`seed-${i}`, real),
    before: generateLot(`seed-${i}`, plain),
  }));

  it('leaves a plain lot exactly as it was drawn before kinds', () => {
    let plains = 0;
    for (const { now, before } of lots) {
      if (now.kind) continue;
      expect(now).toEqual(before);
      plains++;
    }
    expect(plains).toBeGreaterThan(150);
  });

  it('shapes a lot only as its kind says, and every shaped lot passes the checks', () => {
    const kinds: Record<string, number> = {};
    for (const { now, before } of lots) {
      if (!now.kind) continue;
      kinds[now.kind] = (kinds[now.kind] ?? 0) + 1;
      expect(now.attempt).toBe(before.attempt);
      expect(lotProblems({ ...now, terrain: bare(now) }, real)).toEqual([]);
      const a = bare(now);
      const b = bare(before);
      a.forEach((t, k) => {
        if (t === b[k]) return;
        // Rocky: Boulders on open ground. Open: woods Trees gone. Pond: open ground or Trees.
        if (now.kind === 'rocky') expect([b[k], t]).toEqual([null, 'boulder']);
        if (now.kind === 'open') expect([b[k], t]).toEqual(['tree', null]);
        if (now.kind === 'pond') expect([null, 'tree']).toContain(b[k]);
        if (now.kind === 'pond') expect(t).toBe('pond');
      });
      if (now.kind === 'rocky') {
        const more = count(now, 'boulder') - count(before, 'boulder');
        expect(more).toBeGreaterThanOrEqual(real.rockyBoulders[0]);
        expect(more).toBeLessThanOrEqual(real.rockyBoulders[1]);
      }
      if (now.kind === 'open') {
        // Only the lone Trees are left: none touches another.
        expect(count(now, 'tree')).toBeLessThanOrEqual(real.loneTrees[1]);
        for (let y = 0; y < now.height; y++) {
          for (let x = 0; x < now.width; x++) {
            if (terrainAt(now, x, y) !== 'tree') continue;
            for (const [dx, dy] of [
              [1, 0],
              [0, 1],
            ] as const) {
              expect(terrainAt(now, x + dx, y + dy)).not.toBe('tree');
            }
          }
        }
      }
      if (now.kind === 'pond') {
        const ponds = count(now, 'pond');
        expect(ponds).toBeGreaterThanOrEqual(real.pondTiles[0]);
        expect(ponds).toBeLessThanOrEqual(real.pondTiles[1]);
        // Still two rows clear of the street, and a tile clear of the creek.
        for (let x = 0; x < now.width; x++) {
          expect(terrainAt(now, x, now.height - 1)).not.toBe('pond');
          expect(terrainAt(now, x, now.height - 2)).not.toBe('pond');
        }
        for (let y = 0; y < now.height; y++) {
          for (let x = 0; x < now.width; x++) {
            if (terrainAt(now, x, y) !== 'pond') continue;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                expect(terrainAt(now, x + dx, y + dy)).not.toBe('creek');
              }
            }
          }
        }
      }
    }
    // By `kinds`' weights (25, 20, 20 of 100); a creek lot without a pond stays plain.
    expect(kinds.rocky! / lots.length).toBeGreaterThan(0.18);
    expect(kinds.rocky! / lots.length).toBeLessThan(0.32);
    expect(kinds.open! / lots.length).toBeGreaterThan(0.14);
    expect(kinds.open! / lots.length).toBeLessThan(0.26);
    expect(kinds.pond! / lots.length).toBeGreaterThan(0.12);
    expect(kinds.pond! / lots.length).toBeLessThan(0.24);
  });

  it('gives most lots one trait or two, and about one in five none', () => {
    const n = [0, 0, 0, 0];
    for (const { now } of lots) n[Math.min(3, lotTraits(CONTENT, now).length)]!++;
    expect(n[0]! / lots.length).toBeGreaterThan(0.13);
    expect(n[0]! / lots.length).toBeLessThan(0.28);
    expect((n[1]! + n[2]!) / lots.length).toBeGreaterThan(0.7);
  });

  it('names the kind a lot was shaped to as its trait, and a run keeps the traits it began with', () => {
    const rocky = lots.find(({ now }) => now.kind === 'rocky')!.now;
    expect(lotTraits(CONTENT, rocky).map((t) => t.id)).toContain('rocky');
    const open = lots.find(({ now }) => now.kind === 'open')!.now;
    expect(lotTraits(CONTENT, open).map((t) => t.id)).toContain('open');
    expect(lotTraits(CONTENT, open).map((t) => t.id)).not.toContain('wooded');
    // A Wooded lot's traits, kept: clearing every Tree leaves it Wooded for the run.
    const wooded = lots.find(({ now }) => count(now, 'tree') >= 100)!.now;
    const kept = withTraits(CONTENT, wooded);
    expect(kept.traits).toContain('wooded');
    const cleared: Lot = { ...kept, terrain: kept.terrain.map((t) => (t === 'tree' ? null : t)) };
    expect(lotTraits(CONTENT, cleared).map((t) => t.id)).toContain('wooded');
    expect(lotTraits(CONTENT, { ...cleared, traits: undefined }).map((t) => t.id)).not.toContain(
      'wooded',
    );
  });

  it('keeps a lot plain when asked: the first job’s', () => {
    const shaped = lots.findIndex(({ now }) => now.kind !== undefined);
    const seed = `seed-${shaped}`;
    expect(generateLot(seed, real, { plain: true })).toEqual(generateLot(seed, plain));
  });
});

// ---------------------------------------------------------------------------------------
// D-174: biomes, the lakeside's lake and its creek through the middle, the autumn woods' old
// woods, and the dry lot's few creeks.

describe('biomes and their lots (D-174)', () => {
  const real = CONTENT.balance.lot;
  const lots = Array.from({ length: 1000 }, (_, i) => generateLot(`seed-${i}`, real));
  const ids = (lot: Lot) => lotTraits(CONTENT, lot).map((t) => t.id);

  it('draws a biome by its weight, and a meadow lot is the lot D-166 drew', () => {
    const n: Record<string, number> = {};
    for (const lot of lots) n[lotBiome(lot)] = (n[lotBiome(lot)] ?? 0) + 1;
    // Weights 40, 20, 20, 20.
    expect(n.meadow! / lots.length).toBeGreaterThan(0.34);
    expect(n.meadow! / lots.length).toBeLessThan(0.46);
    for (const id of ['lakeside', 'autumn', 'dry']) {
      expect(n[id]! / lots.length, id).toBeGreaterThan(0.15);
      expect(n[id]! / lots.length, id).toBeLessThan(0.25);
    }
    lots.forEach((lot, i) => {
      if (lotBiome(lot) !== 'meadow') return;
      expect(lot.biome).toBeUndefined();
      expect(lot).toEqual(generateLot(`seed-${i}`, meadowOnly(real)));
    });
  });

  it('keeps the first job’s lot a plain meadow lot, whatever biome its seed would draw', () => {
    for (let i = 0; i < 200; i++) {
      const lot = generateLot(`seed-${i}`, real, { plain: true });
      expect(lot.biome).toBeUndefined();
      expect(lot.kind).toBeUndefined();
      expect(lot).toEqual(generateLot(`seed-${i}`, meadowOnly(real, PLAIN)));
    }
    expect(lots.some((lot) => lot.biome)).toBe(true);
  });

  it('deals each biome only its own kinds, and each lot passes its kind’s checks', () => {
    for (const lot of lots) {
      if (lot.kind) expect(real.biomes[lotBiome(lot)].kinds[lot.kind] ?? 0).toBeGreaterThan(0);
      expect(checksFor(lot, real)).toEqual([]);
    }
  });

  it('keeps in the checks what the kind’s trait keeps standing', () => {
    for (const trait of Object.values(CONTENT.lotTraits)) {
      if (!('kind' in trait.when)) continue;
      const kept = KIND_CHECKS[trait.when.kind]?.kept;
      expect([...(kept ?? [])], trait.id).toEqual([...(trait.protects ?? [])]);
    }
  });

  it('carves a lake along the back edge, lakeRows deep, and the lake is the lot’s water', () => {
    const lakes = lots.filter((lot) => lot.kind === 'lake');
    expect(lakes.length).toBeGreaterThan(40);
    for (const lot of lakes) {
      expect(lotBiome(lot)).toBe('lakeside');
      expect(count(lot, 'pond')).toBe(0);
      expect(count(lot, 'creek')).toBe(0);
      for (let x = 0; x < lot.width; x++) {
        let d = 0;
        while (terrainAt(lot, x, d) === 'lake') d++;
        expect(d).toBeGreaterThanOrEqual(real.lakeRows[0]);
        expect(d).toBeLessThanOrEqual(real.lakeRows[1]);
        for (let y = d; y < lot.height; y++) expect(terrainAt(lot, x, y)).not.toBe('lake');
      }
      expect(ids(lot)).toContain('lakefront');
    }
  });

  it('runs a split lot’s creek from side to side through the middle rows', () => {
    const splits = lots.filter((lot) => lot.kind === 'split');
    expect(splits.length).toBeGreaterThan(30);
    for (const lot of splits) {
      const cells = creekCells(lot);
      expect(cells.some((c) => c.x === 0)).toBe(true);
      expect(cells.some((c) => c.x === lot.width - 1)).toBe(true);
      for (const c of cells) {
        expect(c.y).toBeGreaterThanOrEqual(Math.floor(lot.height * 0.36));
        expect(c.y).toBeLessThanOrEqual(Math.floor(lot.height * 0.58));
      }
      expect(ids(lot)).toContain('creekside');
    }
  });

  it('grows more woods in the autumn woods, and an old wood keeps its Trees and isn’t Wooded', () => {
    const trees = (biome: string) => {
      const plain = lots.filter((lot) => lotBiome(lot) === biome && !lot.kind);
      return plain.reduce((sum, lot) => sum + count(lot, 'tree'), 0) / plain.length;
    };
    expect(trees('autumn')).toBeGreaterThan(trees('meadow') + 12);
    const old = lots.filter((lot) => lot.kind === 'oldWoods');
    expect(old.length).toBeGreaterThan(40);
    for (const lot of old) {
      expect(lotBiome(lot)).toBe('autumn');
      expect(ids(lot)).toContain('oldWoods');
      expect(ids(lot)).not.toContain('wooded');
      expect([...protectedTerrain(CONTENT, lot)]).toEqual(['tree']);
    }
    // A run keeps it: a lot's kept traits still keep its Trees.
    expect([...protectedTerrain(CONTENT, withTraits(CONTENT, old[0]!))]).toEqual(['tree']);
    expect(
      protectedTerrain(
        CONTENT,
        lots.find((lot) => !lot.kind)!,
      ).size,
    ).toBe(0);
  });

  it('gives a dry lot a creek seldom', () => {
    const creekShare = (biome: string) => {
      const some = lots.filter((lot) => lotBiome(lot) === biome);
      return some.filter((lot) => count(lot, 'creek') > 0).length / some.length;
    };
    expect(creekShare('dry')).toBeLessThan(0.16);
    expect(creekShare('meadow')).toBeGreaterThan(0.16);
  });
});
