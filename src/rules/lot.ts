// Lot generation from a seed (Appendix A · M1, D-048, D-049): the street on the bottom edge,
// woods and lone Trees, a creek on most lots, a pond, boulders, and the sunny side. A lot that
// fails the regeneration checks is made again from the next `lot/<attempt>` stream.

import type { Cell, Lot, LotBalance, TerrainId } from './index.ts';
import { cellIndex, inBounds, ORTHOGONAL } from './grid.ts';
import { stream, type Rng } from './rng.ts';

export function terrainAt(lot: Lot, x: number, y: number): TerrainId | null {
  return lot.terrain[cellIndex(lot.width, x, y)] ?? null;
}

const isWater = (t: TerrainId | null) => t === 'pond' || t === 'creek';
/** Tiles nothing can be built on in M1 (only a Driveway crosses the creek, from M2). */
export const isBlocked = (t: TerrainId | null) => isWater(t) || t === 'boulder';

/** The sunny side: `sunnyRows` rows along one edge, except Tree tiles. */
export function isSunny(lot: Lot, x: number, y: number): boolean {
  if (terrainAt(lot, x, y) === 'tree') return false;
  switch (lot.sunnySide) {
    case 'top':
      return y < lot.sunnyRows;
    case 'left':
      return x < lot.sunnyRows;
    case 'right':
      return x >= lot.width - lot.sunnyRows;
  }
}

/** Builds a lot from ASCII rows, for tests and debugging: . ground, T tree, P pond, C creek, B boulder. */
export function lotFromRows(rows: readonly string[], sunnySide: Lot['sunnySide'] = 'top'): Lot {
  const codes: Record<string, TerrainId | null> = {
    '.': null,
    T: 'tree',
    P: 'pond',
    C: 'creek',
    B: 'boulder',
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
  return { width, height, terrain, sunnySide, sunnyRows: 4, attempt: 0 };
}

export function lotToRows(lot: Lot): string[] {
  const codes: Record<TerrainId, string> = { tree: 'T', pond: 'P', creek: 'C', boulder: 'B' };
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

/** Why a lot would be regenerated; empty when it's fine. */
export function lotProblems(lot: Lot, b: LotBalance): string[] {
  const { width: w, height: h } = lot;
  const problems: string[] = [];
  const total = w * h;
  const free = lot.terrain.filter((t) => !isBlocked(t)).length;
  if (free * 100 < total * b.minFreePct) {
    problems.push(`only ${free} of ${total} tiles are free of water and boulders`);
  }
  let streetFree = 0;
  for (let x = 0; x < w; x++) if (!isBlocked(terrainAt(lot, x, h - 1))) streetFree++;
  if (streetFree < b.minFreeStreetTiles) {
    problems.push(`only ${streetFree} street-edge tiles are free`);
  }
  for (let x = 0; x < w; x++) {
    if (terrainAt(lot, x, h - 1) === 'creek') {
      problems.push('the creek touches the street edge');
      break;
    }
  }
  // Buildable tiles reachable from the street without crossing water.
  const seen = new Uint8Array(total);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) {
    const i = cellIndex(w, x, h - 1);
    if (!isWater(lot.terrain[i] ?? null)) {
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
      if (seen[j] || isWater(lot.terrain[j] ?? null)) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  let buildable = 0;
  let streetSide = 0;
  lot.terrain.forEach((t, i) => {
    if (isBlocked(t)) return;
    buildable++;
    if (seen[i]) streetSide++;
  });
  if (streetSide * 100 < buildable * b.minStreetSidePct) {
    problems.push(`only ${streetSide} of ${buildable} buildable tiles are on the street's side`);
  }
  return problems;
}

// ---------------------------------------------------------------------------------------
// Generation.

export function generateLot(seed: string, b: LotBalance): Lot {
  for (let attempt = 0; attempt < b.maxAttempts; attempt++) {
    const lot = tryLot(stream(seed, `lot/${attempt}`), b, attempt, true);
    if (lotProblems(lot, b).length === 0) return lot;
  }
  // Practically unreachable (the tests check 1,000 seeds), but a creekless lot always passes.
  return tryLot(stream(seed, `lot/${b.maxAttempts}`), b, b.maxAttempts, false);
}

function tryLot(rng: Rng, b: LotBalance, attempt: number, allowCreek: boolean): Lot {
  const { width: w, height: h } = b;
  const terrain: (TerrainId | null)[] = new Array<TerrainId | null>(w * h).fill(null);
  const at = (x: number, y: number) => terrain[cellIndex(w, x, y)] ?? null;
  const set = (x: number, y: number, t: TerrainId) => {
    terrain[cellIndex(w, x, y)] = t;
  };

  if (allowCreek && rng.chance(b.creekPct)) {
    for (const c of creekPath(rng, w, h, b.creekStreetGap)) set(c.x, c.y, 'creek');
  }

  // One pond, 2×2 to 3×3, never touching the creek (a one-tile margin around it is creek-free).
  const pw = rng.range(b.pondSize[0], b.pondSize[1]);
  const ph = rng.range(b.pondSize[0], b.pondSize[1]);
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

  const sides = ['top', 'left', 'right'] as const;
  return {
    width: w,
    height: h,
    terrain,
    sunnySide: rng.pick(sides),
    sunnyRows: b.sunnyRows,
    attempt,
  };
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
 * A 1-tile-wide meandering creek from the back edge to a side edge, or from side to side.
 * It steps orthogonally and never doubles back: from the back it only moves down and toward
 * its side; side to side it only moves across, and its up-or-down drift can switch only after
 * three steps across. It stays `streetGap` rows clear of the street edge.
 */
function creekPath(rng: Rng, w: number, h: number, streetGap: number): Cell[] {
  const maxY = h - 1 - streetGap;
  const path: Cell[] = [];
  if (rng.chance(50)) {
    // Back edge → side edge.
    const toRight = rng.chance(50);
    const dx = toRight ? 1 : -1;
    let x = rng.range(4, w - 5);
    let y = 0;
    path.push({ x, y });
    let run = 0;
    let down = true;
    while (x > 0 && x < w - 1) {
      if (run <= 0) {
        // Head down more at first, then more toward the side.
        const downPct = Math.max(20, 75 - Math.floor((y * 50) / Math.max(1, maxY)));
        down = y < maxY && rng.chance(downPct);
        run = rng.range(1, 3);
      }
      if (down && y >= maxY) down = false;
      if (down) y++;
      else x += dx;
      run--;
      path.push({ x, y });
    }
  } else {
    // Side edge → side edge, in the back part of the lot.
    const fromLeft = rng.chance(50);
    const dx = fromLeft ? 1 : -1;
    const top = 1;
    const bottom = Math.min(maxY, Math.floor((h * 2) / 5));
    let x = fromLeft ? 0 : w - 1;
    let y = rng.range(top, bottom);
    path.push({ x, y });
    let drift = rng.chance(50) ? 1 : -1;
    // Steps across since the last step up or down: the drift may reverse only after three,
    // so the creek never runs back alongside itself.
    let acrossSinceDrift = 3;
    while (fromLeft ? x < w - 1 : x > 0) {
      if (acrossSinceDrift >= 3 && rng.chance(25)) drift = -drift;
      const canDrift = drift > 0 ? y < bottom : y > top;
      if (canDrift && rng.chance(35)) {
        y += drift;
        acrossSinceDrift = 0;
      } else {
        x += dx;
        acrossSinceDrift++;
      }
      path.push({ x, y });
    }
  }
  return path;
}
