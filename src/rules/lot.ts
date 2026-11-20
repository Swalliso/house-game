// Lot generation from a seed (Appendix A · M1, D-048, D-049): the street on the bottom edge,
// woods and lone Trees, a creek on about a quarter of lots (D-119), a pond, boulders, and the
// edge the sun shines from (D-120). A lot that fails the regeneration checks is made again from
// the next `lot/<attempt>` stream. Then its kind (D-166) shapes most lots toward a trait: more
// Boulders, no woods, a bigger pond, a lake, a creek through the middle, old woods. Its biome
// (D-174), drawn first, is its look and the kinds it deals. Its traits (D-119), read from its
// terrain, are chips on the contract, and a run keeps the ones it began with. Its water takes
// natural shapes (D-191): a pond rounds off, a lake's shore curves, and a creek bends gently.

import type {
  BiomeId,
  Cell,
  Content,
  Lot,
  LotBalance,
  LotKind,
  LotTraitDef,
  Range,
  ShapedKind,
  SunSide,
  TerrainId,
} from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL } from './grid.ts';
import { stream, type Rng } from './rng.ts';

/** What sits on a tile; null for open ground or anywhere off the lot. */
export function terrainAt(lot: Lot, x: number, y: number): TerrainId | null {
  if (!inBounds(lot.width, lot.height, x, y)) return null;
  return lot.terrain[cellIndex(lot.width, x, y)] ?? null;
}

const isWater = (t: TerrainId | null) => t === 'pond' || t === 'creek' || t === 'lake';
/** Tiles nothing can be built on in M1 (only a Driveway crosses the creek, from M2). */
export const isBlocked = (t: TerrainId | null) => isWater(t) || t === 'boulder' || t === 'oldShed';

/** The sun's edges (D-120), in the order a lot draws from: a quarter each. */
export const SUN_SIDES: readonly SunSide[] = ['top', 'left', 'right', 'bottom'];

/**
 * One step toward the sun (D-120). A tile is in the sun unless it's a Tree, or a Tree or a
 * building (layout.ts) stands on the tile one step from it this way; off the lot is open.
 */
export const SUN_STEP: Readonly<Record<SunSide, readonly [dx: number, dy: number]>> = {
  top: [0, -1],
  left: [-1, 0],
  right: [1, 0],
  bottom: [0, 1],
};

/**
 * The lot's traits (D-119), in content order. A run's lot keeps the ones it began with
 * (`Lot.traits`, D-166), so clearing Trees can't take Wooded away mid-run; any other lot has
 * each trait it was shaped to, and each whose terrain it holds at least `min` tiles of.
 */
export function lotTraits(content: Content, lot: Lot): LotTraitDef[] {
  const kept = lot.traits;
  if (kept) return Object.values(content.lotTraits).filter((trait) => kept.includes(trait.id));
  return traitsNow(content, lot);
}

/** A run's lot (D-166): the lot with the traits it begins with, kept for the run. */
export function withTraits(content: Content, lot: Lot): Lot {
  return { ...lot, traits: traitsNow(content, lot).map((t) => t.id) };
}

function traitsNow(content: Content, lot: Lot): LotTraitDef[] {
  const counts = new Map<TerrainId, number>();
  for (const t of lot.terrain) if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  const kept = new Set<TerrainId>();
  for (const { when, protects } of Object.values(content.lotTraits)) {
    if ('kind' in when && lot.kind === when.kind) for (const t of protects ?? []) kept.add(t);
  }
  // A trait about building over its terrain (Wooded: "Building over a Tree clears it") isn't
  // one where another trait keeps that terrain standing (D-174's Old Woods).
  return Object.values(content.lotTraits).filter(({ when }) =>
    'kind' in when
      ? lot.kind === when.kind
      : !kept.has(when.terrain) && (counts.get(when.terrain) ?? 0) >= when.min,
  );
}

/**
 * The terrain no piece is built over on this lot (D-174): what its traits keep standing, as
 * Old Woods keeps its Trees. Placement refuses it, and the bots pave around it.
 */
export function protectedTerrain(content: Content, lot: Lot): ReadonlySet<TerrainId> {
  const out = new Set<TerrainId>();
  for (const t of lotTraits(content, lot)) for (const id of t.protects ?? []) out.add(id);
  return out;
}

/** The lot's biome (D-174); a lot without one is a meadow. */
export function lotBiome(lot: Lot): BiomeId {
  return lot.biome ?? 'meadow';
}

/**
 * Builds a lot from ASCII rows, for tests and debugging: . ground, T tree, P pond, C creek,
 * L lake, B boulder, S Old Shed, K Time Capsule. The sun shines from the back unless `sun` says.
 */
export function lotFromRows(rows: readonly string[], sun: SunSide = 'top'): Lot {
  const codes: Record<string, TerrainId | null> = {
    '.': null,
    T: 'tree',
    P: 'pond',
    C: 'creek',
    L: 'lake',
    B: 'boulder',
    S: 'oldShed',
    K: 'timeCapsule',
  };
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const terrain: (TerrainId | null)[] = [];
  for (const row of rows) {
    if (row.length !== width) throw new Error('lotFromRows: rows must be the same length');
    for (const ch of row) {
      if (!(ch in codes)) throw new Error(`lotFromRows: unknown tile "${ch}"`);
      terrain.push(codes[ch]!);
    }
  }
  return { width, height, terrain, sun, attempt: 0 };
}

export function lotToRows(lot: Lot): string[] {
  const codes: Record<TerrainId, string> = {
    tree: 'T',
    pond: 'P',
    creek: 'C',
    lake: 'L',
    boulder: 'B',
    oldShed: 'S',
    timeCapsule: 'K',
  };
  const rows: string[] = [];
  for (let y = 0; y < lot.height; y++) {
    let row = '';
    for (let x = 0; x < lot.width; x++) {
      const t = terrainAt(lot, x, y);
      row += t ? codes[t] : '.';
    }
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------------------
// The regeneration checks.

/**
 * Why a lot would be regenerated; empty when it's fine. `kept` is terrain the lot's kind keeps
 * standing (D-174's Old Woods): it's lost ground, and the house can't cross it.
 */
export function lotProblems(
  lot: Lot,
  b: LotBalance,
  kept: ReadonlySet<TerrainId> = NONE_KEPT,
): string[] {
  const { width: w, height: h } = lot;
  const problems: string[] = [];
  const total = w * h;
  const blocked = (t: TerrainId | null) => isBlocked(t) || (t !== null && kept.has(t));
  const barrier = (t: TerrainId | null) => isWater(t) || (t !== null && kept.has(t));
  const free = lot.terrain.filter((t) => !blocked(t)).length;
  if (free * 100 < total * b.minFreePct) {
    problems.push(`only ${free} of ${total} tiles are free of water and boulders`);
  }
  let streetFree = 0;
  for (let x = 0; x < w; x++) if (!blocked(terrainAt(lot, x, h - 1))) streetFree++;
  if (streetFree < b.minFreeStreetTiles) {
    problems.push(`only ${streetFree} street-edge tiles are free`);
  }
  for (let x = 0; x < w; x++) {
    if (terrainAt(lot, x, h - 1) === 'creek') {
      problems.push('the creek touches the street edge');
      break;
    }
  }
  // Buildable tiles reachable from the street without crossing water (or kept terrain).
  const seen = new Uint8Array(total);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) {
    const i = cellIndex(w, x, h - 1);
    if (!barrier(lot.terrain[i] ?? null)) {
      seen[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(w, h, nx, ny)) continue;
      const j = cellIndex(w, nx, ny);
      if (seen[j] || barrier(lot.terrain[j] ?? null)) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  let buildable = 0;
  let streetSide = 0;
  lot.terrain.forEach((t, i) => {
    if (blocked(t)) return;
    buildable++;
    if (seen[i]) streetSide++;
  });
  if (streetSide * 100 < buildable * b.minStreetSidePct) {
    problems.push(`only ${streetSide} of ${buildable} buildable tiles are on the street's side`);
  }
  return problems;
}

const NONE_KEPT: ReadonlySet<TerrainId> = new Set();

// ---------------------------------------------------------------------------------------
// Generation.

/**
 * A lot from its seed. `plain` keeps it as drawn, with no kind (D-166), in the meadow (D-174):
 * the first job's lot, which the guided job was built on (D-149).
 */
export function generateLot(seed: string, b: LotBalance, opts: { plain?: boolean } = {}): Lot {
  const biome: BiomeId = opts.plain ? 'meadow' : drawBiome(seed, b);
  const { kinds, woodsClusters, creekPct } = b.biomes[biome];
  // The biome's own draw: more woods, fewer creeks.
  const bb: LotBalance = {
    ...b,
    ...(woodsClusters ? { woodsClusters } : {}),
    ...(creekPct !== undefined ? { creekPct } : {}),
  };
  const named = (lot: Lot): Lot => (biome === 'meadow' ? lot : { ...lot, biome });
  for (let attempt = 0; attempt < bb.maxAttempts; attempt++) {
    const bare = tryLot(stream(seed, `lot/${attempt}`), bb, attempt, true, sunFor(seed, attempt));
    const lot = pondRule(bare, seed, bb);
    if (lotProblems(lot, bb).length === 0) {
      return named(placeFinds(opts.plain ? lot : shapeLot(lot, seed, bb, kinds), seed, bb));
    }
  }
  // Practically unreachable (the tests check 1,000 seeds), but a creekless lot always passes.
  const last = bb.maxAttempts;
  return named(
    placeFinds(tryLot(stream(seed, `lot/${last}`), bb, last, false, sunFor(seed, last)), seed, bb),
  );
}

/** The biomes in the order their weights are read (D-174). */
export const BIOMES: readonly BiomeId[] = ['meadow', 'lakeside', 'autumn', 'dry'];

/**
 * The run's biome (D-174), by `biomes`' weights, from the seed's own `lot/biome` stream: drawn
 * once, before the lot, so a lot that fails its checks is drawn again in the same biome.
 */
function drawBiome(seed: string, b: LotBalance): BiomeId {
  const total = BIOMES.reduce((sum, id) => sum + Math.max(0, b.biomes[id].weight), 0);
  if (total <= 0) return 'meadow';
  let r = stream(seed, 'lot/biome').int(total);
  for (const id of BIOMES) {
    const w = Math.max(0, b.biomes[id].weight);
    if (r < w) return id;
    r -= w;
  }
  return 'meadow';
}

/**
 * The sun's edge (D-120), a quarter each, from its own `lot/<attempt>/sun` stream, so no lot's
 * terrain changed when the sun came in.
 */
function sunFor(seed: string, attempt: number): SunSide {
  return stream(seed, `lot/${attempt}/sun`).pick(SUN_SIDES);
}

/**
 * The pond (D-119): a lot without a creek always keeps it, so every lot has water, and a creek
 * lot keeps it `pondPctCreek` percent of the time, so creek lots look different. The pick comes
 * from its own `lot/<attempt>/pond` stream, so the rest of the terrain stays as it was drawn: a
 * pond that goes leaves open ground where it was. The checks come after it, since more ground
 * behind the creek can leave too little on the street's side.
 */
function pondRule(lot: Lot, seed: string, b: LotBalance): Lot {
  if (!lot.terrain.includes('creek')) return lot;
  if (stream(seed, `lot/${lot.attempt}/pond`).chance(b.pondPctCreek)) return lot;
  return { ...lot, terrain: lot.terrain.map((t) => (t === 'pond' ? null : t)) };
}

/** The kinds in the order their weights are read (D-166, D-174). */
export const LOT_KINDS: readonly LotKind[] = [
  'plain',
  'rocky',
  'open',
  'pond',
  'lake',
  'split',
  'oldWoods',
];

type Kinds = Readonly<Partial<Record<LotKind, number>>>;

/**
 * The lot's kind (D-166), by its biome's `kinds` weights, from its own `lot/<attempt>/kind`
 * stream once the lot has passed its checks, so a plain lot is exactly the lot it was before.
 * The others are shaped toward a trait: a Rocky lot gets `rockyBoulders` more Boulders, an Open
 * lot loses its woods (its lone Trees stay), a pond lot's pond grows to `pondTiles` tiles, a
 * lake lot's back rows are a lake, a split lot's creek runs through the middle, and an old
 * woods lot keeps its Trees. A lot the shaping would make fail the checks, or a pond lot whose
 * creek took its pond, stays as drawn.
 */
export function lotKind(seed: string, attempt: number, kinds: Kinds): LotKind {
  const total = LOT_KINDS.reduce((sum, k) => sum + Math.max(0, kinds[k] ?? 0), 0);
  if (total <= 0) return 'plain';
  let r = stream(seed, `lot/${attempt}/kind`).int(total);
  for (const k of LOT_KINDS) {
    const w = Math.max(0, kinds[k] ?? 0);
    if (r < w) return k;
    r -= w;
  }
  return 'plain';
}

function shapeLot(lot: Lot, seed: string, b: LotBalance, kinds: Kinds): Lot {
  const kind = lotKind(seed, lot.attempt, kinds);
  if (kind === 'plain') return lot;
  const rng = stream(seed, `lot/${lot.attempt}/kind/${kind}`);
  const shaped = SHAPES[kind](lot, rng, b);
  const { checks, kept } = KIND_CHECKS[kind] ?? {};
  const ok = (l: Lot) => lotProblems(l, { ...b, ...checks }, kept).length === 0;
  return shaped && ok(shaped) ? { ...shaped, kind } : lot;
}

/**
 * What a kind changes in the checks (D-174): a lake is the lot's water, not lost ground, so less
 * of the lot need be free; a creek through the middle leaves less on the street's side; old
 * woods' Trees stay, so they're lost ground the house can't cross (the Old Woods trait,
 * lot-traits.ts, keeps them).
 */
export const KIND_CHECKS: Readonly<
  Partial<Record<ShapedKind, { checks?: Partial<LotBalance>; kept?: ReadonlySet<TerrainId> }>>
> = {
  lake: { checks: { minFreePct: 65 } },
  split: { checks: { minStreetSidePct: 30 } },
  oldWoods: { checks: { minFreePct: 65 }, kept: new Set<TerrainId>(['tree']) },
};

const SHAPES: Record<ShapedKind, (lot: Lot, rng: Rng, b: LotBalance) => Lot | null> = {
  rocky: addBoulders,
  open: clearWoods,
  pond: growPond,
  lake: carveLake,
  split: splitCreek,
  // Old woods are the woods as drawn (the autumn woods grow more): only the checks change.
  oldWoods: (lot) => lot,
};

/**
 * A lake lot (D-174): the back rows are a lake that runs on past the lot's back edge, `lakeRows`
 * deep. D-191: its shore curves, easing from bay to point and back every `bendEvery` columns
 * (wanderMarks, easeThrough). The lot's pond and creek go: the lake is its water.
 */
function carveLake(lot: Lot, rng: Rng, b: LotBalance): Lot {
  const { width: w } = lot;
  const terrain: (TerrainId | null)[] = lot.terrain.map((t) =>
    t === 'pond' || t === 'creek' ? null : t,
  );
  const [lo, hi] = b.lakeRows;
  const step = rng.range(b.bendEvery[0], b.bendEvery[1]);
  easeThrough(wanderMarks(rng, w, step, lo, hi), step, w).forEach((d, x) => {
    for (let y = 0; y < d; y++) terrain[cellIndex(w, x, y)] = 'lake';
  });
  return { ...lot, terrain };
}

/**
 * A split lot (D-174): its creek runs side to side through the middle rows, so the house stands
 * on the street's side of it or crosses it with a Driveway. A pond beside its path goes. D-191:
 * it bends as creekPath's side-to-side creek does (acrossPath).
 */
function splitCreek(lot: Lot, rng: Rng, b: LotBalance): Lot {
  const { width: w, height: h } = lot;
  const terrain: (TerrainId | null)[] = lot.terrain.map((t) => (t === 'creek' ? null : t));
  const top = Math.floor(h * 0.36);
  const bottom = Math.floor(h * 0.58);
  for (const c of acrossPath(rng, w, top, bottom, b.bendEvery)) {
    terrain[cellIndex(w, c.x, c.y)] = 'creek';
  }
  // A pond keeps a tile clear of the creek (tryLot's margin): one beside the path goes.
  const nearCreek = (i: number) => {
    const px = i % w;
    const py = (i - px) / w;
    for (let ddy = -1; ddy <= 1; ddy++) {
      for (let ddx = -1; ddx <= 1; ddx++) {
        const nx = px + ddx;
        const ny = py + ddy;
        if (inBounds(w, h, nx, ny) && terrain[cellIndex(w, nx, ny)] === 'creek') return true;
      }
    }
    return false;
  };
  const pondNear = terrain.some((t, i) => t === 'pond' && nearCreek(i));
  return { ...lot, terrain: pondNear ? terrain.map((t) => (t === 'pond' ? null : t)) : terrain };
}

/** Rocky (D-166): more Boulders, anywhere on open ground, as the first ones went down. */
function addBoulders(lot: Lot, rng: Rng, b: LotBalance): Lot {
  const { width: w, height: h } = lot;
  const terrain = lot.terrain.slice();
  const at = (x: number, y: number) => terrain[cellIndex(w, x, y)] ?? null;
  const n = rng.range(b.rockyBoulders[0], b.rockyBoulders[1]);
  for (let k = 0; k < n; k++) {
    const c = randomEmpty(rng, w, h, at);
    if (c) terrain[cellIndex(w, c.x, c.y)] = 'boulder';
  }
  return { ...lot, terrain };
}

/**
 * Open (D-166): the woods go, and the lone Trees stay. A woods Tree touches another Tree; a
 * lone one never does (tryLot places them so).
 */
function clearWoods(lot: Lot): Lot {
  const { width: w } = lot;
  const terrain = lot.terrain.map((t, i) => {
    if (t !== 'tree') return t;
    const x = i % w;
    const y = (i - x) / w;
    const woods = ORTHOGONAL.some(([dx, dy]) => terrainAt(lot, x + dx, y + dy) === 'tree');
    return woods ? null : t;
  });
  return { ...lot, terrain };
}

/**
 * A pond lot (D-166): the pond grows onto open ground or Trees. D-191: it grows round, into one
 * of ROUND_PONDS with `pondTiles` tiles, set over the pond's middle (or a tile off it, if that
 * fits where the middle doesn't); the pond's tiles it leaves out are open ground. It keeps
 * tryLot's margins: off the lot's edges, two rows from the street, and a tile clear of the creek
 * (pondGround). Null when no shape fits.
 */
function growPond(lot: Lot, rng: Rng, b: LotBalance): Lot | null {
  const { width: w, height: h } = lot;
  const start: number[] = [];
  lot.terrain.forEach((t, i) => {
    if (t === 'pond') start.push(i);
  });
  if (start.length === 0) return null;
  const shapes = ROUND_PONDS.filter((s) => {
    const n = cutBox(w, 0, 0, s).length;
    return n >= b.pondTiles[0] && n <= b.pondTiles[1];
  });
  if (shapes.length === 0) return null;
  // Its middle, in half cells: the mean of its tiles' middles.
  let sx = 0;
  let sy = 0;
  for (const i of start) {
    const x = i % w;
    sx += 2 * x + 1;
    sy += 2 * ((i - x) / w) + 1;
  }
  const cx2 = sx / start.length;
  const cy2 = sy / start.length;
  const ground = pondGround(lot.terrain, w, h);
  for (let tries = 0; tries < 24; tries++) {
    const shape = rng.pick(shapes);
    const x = Math.floor((cx2 - shape.w) / 2 + 0.5) + (tries < 8 ? 0 : rng.range(-1, 1));
    const y = Math.floor((cy2 - shape.h) / 2 + 0.5) + (tries < 8 ? 0 : rng.range(-1, 1));
    const cells = cutBox(w, x, y, shape);
    const fits =
      x >= 0 &&
      y >= 0 &&
      x + shape.w <= w &&
      y + shape.h <= h &&
      cells.every((i) => ground(i % w, Math.floor(i / w)));
    if (!fits) continue;
    const terrain: (TerrainId | null)[] = lot.terrain.map((t) => (t === 'pond' ? null : t));
    for (const i of cells) terrain[i] = 'pond';
    return { ...lot, terrain };
  }
  return null;
}

/**
 * The finds (M3b): an Old Shed (2×2) and Time Capsules (1×1), on free ground, after the lot
 * has passed its checks. They come from their own `lot/<attempt>/finds` stream, so adding them
 * left every lot's terrain otherwise as it was. Each stays `findStreetGap` rows back from the
 * street and doesn't touch another find.
 */
function placeFinds(lot: Lot, seed: string, b: LotBalance): Lot {
  const rng = stream(seed, `lot/${lot.attempt}/finds`);
  const { width: w, height: h } = lot;
  const terrain = lot.terrain.slice();
  const maxY = h - 1 - b.findStreetGap;
  const free = (x: number, y: number) =>
    inBounds(w, h, x, y) && y <= maxY && terrain[cellIndex(w, x, y)] === null;
  const nearFind = (x: number, y: number) =>
    ORTHOGONAL.some(([dx, dy]) => {
      const t = inBounds(w, h, x + dx, y + dy) ? terrain[cellIndex(w, x + dx, y + dy)] : null;
      return t === 'oldShed' || t === 'timeCapsule';
    });
  const sheds = rng.range(b.oldSheds[0], b.oldSheds[1]);
  for (let k = 0; k < sheds; k++) {
    for (let tries = 0; tries < 200; tries++) {
      const x = rng.int(w - 1);
      const y = rng.int(Math.max(1, maxY));
      const cells = [
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y + 1],
      ] as const;
      if (!cells.every(([cx, cy]) => free(cx, cy) && !nearFind(cx, cy))) continue;
      for (const [cx, cy] of cells) terrain[cellIndex(w, cx, cy)] = 'oldShed';
      break;
    }
  }
  const capsules = rng.range(b.timeCapsules[0], b.timeCapsules[1]);
  for (let k = 0; k < capsules; k++) {
    for (let tries = 0; tries < 200; tries++) {
      const x = rng.int(w);
      const y = rng.int(Math.max(1, maxY + 1));
      if (!free(x, y) || nearFind(x, y)) continue;
      terrain[cellIndex(w, x, y)] = 'timeCapsule';
      break;
    }
  }
  return { ...lot, terrain };
}

function tryLot(rng: Rng, b: LotBalance, attempt: number, allowCreek: boolean, sun: SunSide): Lot {
  const { width: w, height: h } = b;
  const terrain: (TerrainId | null)[] = new Array<TerrainId | null>(w * h).fill(null);
  const at = (x: number, y: number) => terrain[cellIndex(w, x, y)] ?? null;
  const set = (x: number, y: number, t: TerrainId) => {
    terrain[cellIndex(w, x, y)] = t;
  };

  if (allowCreek && rng.chance(b.creekPct)) {
    for (const c of creekPath(rng, w, h, b.creekStreetGap, b.bendEvery)) set(c.x, c.y, 'creek');
  }

  // One pond, its box 2×2 to 3×3, never touching the creek (a one-tile margin around it is
  // creek-free). D-191: it rounds off once the rest of the lot is drawn (roundPond, below).
  const pw = rng.range(b.pondSize[0], b.pondSize[1]);
  const ph = rng.range(b.pondSize[0], b.pondSize[1]);
  let pondBox: { x: number; y: number } | null = null;
  for (let tries = 0; tries < 60; tries++) {
    const px = rng.range(1, w - pw - 1);
    const py = rng.range(1, h - ph - 2);
    let clear = true;
    for (let y = py - 1; y <= py + ph && clear; y++) {
      for (let x = px - 1; x <= px + pw && clear; x++) {
        if (inBounds(w, h, x, y) && at(x, y) !== null) clear = false;
      }
    }
    if (!clear) continue;
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) set(x, y, 'pond');
    pondBox = { x: px, y: py };
    break;
  }

  // Woods: blobs grown from a random frontier, so they come out round-ish and ragged.
  const clusters = rng.range(b.woodsClusters[0], b.woodsClusters[1]);
  for (let k = 0; k < clusters; k++) {
    const size = rng.range(b.woodsClusterSize[0], b.woodsClusterSize[1]);
    const start = randomEmpty(rng, w, h, at);
    if (!start) break;
    set(start.x, start.y, 'tree');
    const frontier: Cell[] = [];
    const pushNeighbors = (c: Cell) => {
      for (const [dx, dy] of ORTHOGONAL) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (inBounds(w, h, nx, ny) && at(nx, ny) === null) frontier.push({ x: nx, y: ny });
      }
    };
    pushNeighbors(start);
    let grown = 1;
    while (grown < size && frontier.length > 0) {
      const i = rng.int(frontier.length);
      const c = frontier[i]!;
      frontier[i] = frontier[frontier.length - 1]!;
      frontier.pop();
      if (at(c.x, c.y) !== null) continue;
      set(c.x, c.y, 'tree');
      grown++;
      pushNeighbors(c);
    }
  }

  // Lone Trees: no Tree touching them.
  const lone = rng.range(b.loneTrees[0], b.loneTrees[1]);
  for (let k = 0; k < lone; k++) {
    for (let tries = 0; tries < 100; tries++) {
      const c = randomEmpty(rng, w, h, at);
      if (!c) break;
      const touchesTree = ORTHOGONAL.some(
        ([dx, dy]) => inBounds(w, h, c.x + dx, c.y + dy) && at(c.x + dx, c.y + dy) === 'tree',
      );
      if (touchesTree) continue;
      set(c.x, c.y, 'tree');
      break;
    }
  }

  const boulders = rng.range(b.boulders[0], b.boulders[1]);
  for (let k = 0; k < boulders; k++) {
    const c = randomEmpty(rng, w, h, at);
    if (c) set(c.x, c.y, 'boulder');
  }

  // D-191: last, so every draw before it is as it was and only the pond's own tiles move.
  if (pondBox) roundPond(terrain, w, { ...pondBox, w: pw, h: ph }, rng);

  return { width: w, height: h, terrain, sun, attempt };
}

function randomEmpty(
  rng: Rng,
  w: number,
  h: number,
  at: (x: number, y: number) => TerrainId | null,
): Cell | null {
  for (let tries = 0; tries < 200; tries++) {
    const x = rng.int(w);
    const y = rng.int(h);
    if (at(x, y) === null) return { x, y };
  }
  return null;
}

/**
 * A creek a cell wide (D-191), from the back edge to a side edge, or from side to side. From the
 * back it heads straight down at first and bends round toward its side (bendPath); side to side
 * it wanders up and down in the back part of the lot, easing from one turn to the next every
 * `bend` columns (wanderMarks, easeThrough). It never doubles back, and it stays `streetGap` rows
 * clear of the street edge.
 */
function creekPath(rng: Rng, w: number, h: number, streetGap: number, bend: Range): Cell[] {
  const maxY = h - 1 - streetGap;
  if (rng.chance(50)) {
    // Back edge → side edge.
    const toRight = rng.chance(50);
    const x0 = rng.range(4, w - 5);
    const ye = rng.range(Math.min(maxY, BEND_FROM_ROW), maxY);
    return bendPath(x0, toRight ? w - 1 : 0, ye, rng.int(BEND_LEAN + 1), rng.int(BEND_LEAN + 1));
  }
  // Side edge → side edge, in the back part of the lot.
  const top = 1;
  const bottom = Math.min(maxY, Math.floor((h * 2) / 5));
  return acrossPath(rng, w, top, bottom, bend);
}

// ---------------------------------------------------------------------------------------
// Natural water (D-191): a pond rounds off, a lake's shore curves, and a creek bends gently.

/** A creek from the back edge reaches its side this many rows down or more (to the street gap). */
const BEND_FROM_ROW = 6;
/** How far a creek's bend may lean toward the straight diagonal, in hundredths (bendPath). */
const BEND_LEAN = 40;
/** A shore or a creek's turns: each this many rows from the last, or fewer (one at least). */
const MAX_TURN = 3;

/**
 * Heights for `length` columns that ease through `marks`, one every `step` columns from the
 * first: between two marks, smoothstep's curve (3t² − 2t³), rounded to a whole row. With marks
 * MAX_TURN rows apart or fewer and `step` 5 or more, each mark lies flat a column either side,
 * so a turn is three columns wide or more and nothing spikes. Plain arithmetic on doubles, which
 * every browser does alike (no Math.sin).
 */
export function easeThrough(marks: readonly number[], step: number, length: number): number[] {
  const out: number[] = [];
  for (let x = 0; x < length; x++) {
    const k = Math.floor(x / step);
    const a = marks[k]!;
    const b = marks[Math.min(k + 1, marks.length - 1)]!;
    const t = (x - k * step) / step;
    out.push(Math.floor(a + (b - a) * t * t * (3 - 2 * t) + 0.5));
  }
  return out;
}

/**
 * Marks for easeThrough over `length` columns, one every `step` and one past the end: the first
 * anywhere in lo..hi, and each after it 1 to MAX_TURN rows up or down from the last, turning
 * back at lo or hi.
 */
function wanderMarks(rng: Rng, length: number, step: number, lo: number, hi: number): number[] {
  const marks = [rng.range(lo, hi)];
  while ((marks.length - 1) * step < length) {
    const last = marks[marks.length - 1]!;
    const d = Math.min(rng.range(1, MAX_TURN), hi - lo);
    const up = rng.chance(50);
    let next = up ? last - d : last + d;
    if (next < lo || next > hi) next = up ? last + d : last - d;
    marks.push(Math.max(lo, Math.min(hi, next)));
  }
  return marks;
}

/**
 * A creek a cell wide from one side to the other through rows top..bottom, from either side:
 * it eases from turn to turn (wanderMarks, every `bend` columns), and where its row changes it
 * steps up or down in the column it comes to. Its last column keeps the row before it, so it
 * leaves the lot straight, as it came in: the shore past each edge runs on straight (outside.ts).
 */
function acrossPath(rng: Rng, w: number, top: number, bottom: number, bend: Range): Cell[] {
  const fromLeft = rng.chance(50);
  const step = rng.range(bend[0], bend[1]);
  const rows = easeThrough(wanderMarks(rng, w, step, top, bottom), step, w);
  const path: Cell[] = [];
  for (let i = 0; i < w; i++) {
    const x = fromLeft ? i : w - 1 - i;
    const y = rows[Math.min(i, w - 2)]!;
    const last = path[path.length - 1];
    if (last) for (let yy = last.y; yy !== y; yy += Math.sign(y - last.y)) path.push({ x, y: yy });
    path.push({ x, y });
  }
  return path;
}

/**
 * A creek a cell wide from (x0, 0) on the back edge to the side at column `xs`, a quarter bend:
 * it heads straight down, then eases round toward the side, and reaches it by row `ye`. `leanX`
 * and `leanY` (0 to BEND_LEAN hundredths) straighten it toward the diagonal. Where both its
 * column and row change, it steps the way the bend runs there: down while it's steep, across
 * once it's shallow, and always down before its last step onto the side. It ends at the first
 * cell on the side, so it leaves the lot straight at both ends (outside.ts).
 */
function bendPath(x0: number, xs: number, ye: number, leanX: number, leanY: number): Cell[] {
  const a = leanX / 100;
  const c = leanY / 100;
  const dx = xs - x0;
  const steps = 8 * (Math.abs(dx) + ye) + 8;
  const path: Cell[] = [{ x: x0, y: 0 }];
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const x = Math.floor(x0 + dx * ((1 - a) * t * t + a * t) + 0.5);
    const y = Math.floor(ye * ((1 - c) * (2 * t - t * t) + c * t) + 0.5);
    const last = path[path.length - 1]!;
    if (x === last.x && y === last.y) continue;
    if (x !== last.x && y !== last.y) {
      // Its slope here: down while it's steep, across once it's shallow.
      const across = Math.abs(dx * (2 * (1 - a) * t + a));
      const down = ye * ((1 - c) * (2 - 2 * t) + c);
      path.push(down >= across || x === xs ? { x: last.x, y } : { x, y: last.y });
    }
    path.push({ x, y });
    if (x === xs) break;
  }
  return path;
}

/**
 * A round shape's tiles (D-191): a box `w` × `h` with its corners cut off in steps, `cuts` deep
 * at its top-left, top-right, bottom-right and bottom-left corners (1 cuts the corner tile, 2
 * the three tiles of a step), as tile indices on a lot `lotWidth` wide.
 */
export function cutBox(
  lotWidth: number,
  x: number,
  y: number,
  shape: { w: number; h: number; cuts: readonly number[] },
): number[] {
  const { w, h, cuts } = shape;
  const out: number[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // How far the tile is from each corner, in steps: within a cut, it's cut.
      const from = [i + j, w - 1 - i + j, w - 1 - i + (h - 1 - j), i + (h - 1 - j)];
      if (from.some((d, k) => d < cuts[k]!)) continue;
      out.push(cellIndex(lotWidth, x + i, y + j));
    }
  }
  return out;
}

/**
 * A pond lot's round ponds (D-191): boxes with their corners cut (cutBox), 16 to 20 tiles. Most
 * lean, two corners across from each other cut; the 4 × 6 ones lose all four. Each cut corner
 * shortens the bank by a tile and leaves a step a room can't lie flush against, so they're cut
 * no more than that: the banks stay as long as the ponds grown a tile at a time before (the
 * sim check, D-191). No tile sticks out alone.
 */
export const ROUND_PONDS: readonly { w: number; h: number; cuts: readonly number[] }[] = [
  { w: 4, h: 5, cuts: [1, 0, 1, 0] },
  { w: 4, h: 5, cuts: [0, 1, 0, 1] },
  { w: 5, h: 4, cuts: [1, 0, 1, 0] },
  { w: 5, h: 4, cuts: [0, 1, 0, 1] },
  { w: 3, h: 6, cuts: [1, 0, 1, 0] },
  { w: 3, h: 6, cuts: [0, 1, 0, 1] },
  { w: 6, h: 3, cuts: [1, 0, 1, 0] },
  { w: 6, h: 3, cuts: [0, 1, 0, 1] },
  { w: 3, h: 7, cuts: [1, 0, 1, 0] },
  { w: 3, h: 7, cuts: [0, 1, 0, 1] },
  { w: 7, h: 3, cuts: [1, 0, 1, 0] },
  { w: 7, h: 3, cuts: [0, 1, 0, 1] },
  { w: 4, h: 6, cuts: [1, 1, 1, 1] },
  { w: 6, h: 4, cuts: [1, 1, 1, 1] },
];

/**
 * Where a pond may lie (D-191, as tryLot placed it and growPond grew it): on open ground, Trees
 * or pond, off the lot's edges, two rows clear of the street, and a tile clear of the creek.
 */
function pondGround(terrain: readonly (TerrainId | null)[], w: number, h: number) {
  return (x: number, y: number) => {
    if (x < 1 || y < 1 || x > w - 2 || y > h - 3) return false;
    const t = terrain[cellIndex(w, x, y)] ?? null;
    if (t !== null && t !== 'tree' && t !== 'pond') return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (inBounds(w, h, x + dx, y + dy) && terrain[cellIndex(w, x + dx, y + dy)] === 'creek') {
          return false;
        }
      }
    }
    return true;
  };
}

/**
 * The pond rounds off (D-191): a 3 × 3 pond loses a corner tile, or two across from each
 * other, so it leans; 2 × 2 and 2 × 3 ponds are as round as their tiles go already (the shore
 * rounds their corners). The tiles it loses are open ground.
 */
function roundPond(
  terrain: (TerrainId | null)[],
  w: number,
  box: { x: number; y: number; w: number; h: number },
  rng: Rng,
): void {
  if (box.w !== 3 || box.h !== 3) return;
  const corner = rng.int(4);
  const cuts = [0, 0, 0, 0];
  cuts[corner] = 1;
  if (rng.chance(50)) cuts[(corner + 2) % 4] = 1;
  const keep = new Set(cutBox(w, box.x, box.y, { w: 3, h: 3, cuts }));
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      const k = cellIndex(w, box.x + i, box.y + j);
      if (!keep.has(k)) terrain[k] = null;
    }
  }
}
