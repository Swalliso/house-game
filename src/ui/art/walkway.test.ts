// The stepping stones from the front door's mat to the kerb (D-217): down the line the household
// walks in on, round what stands in the way, on open ground and Lawns only, as near the street as
// they go behind a Fence, none for a door with nowhere to go, the same every time, and painted on
// the floor canvas.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
import {
  terrainAt,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { occupancy } from '../board/geometry.ts';
import { houseModel, overlaps, type HouseModel, type Rect } from '../board/house-model.ts';
import { doorSpots, walkObstacles, walkStart } from '../board/people.ts';
import { CELL } from '../sprites.ts';
import { artSize, drawingPixels, type DrawingId } from './drawings.ts';
import { paintFloors, type AtlasPixels, type Pixels } from './house-paint.ts';
import { STEPPING, STONES } from './walkway.ts';
import { yardModel, yardPieceLayout, type Ground, type YardModel } from './yard.ts';

type Spec = readonly [PieceId, number, number, Rot?];

/** A house on open ground `size` cells square, or on a lot drawn in rows (lot.ts lotFromRows). */
function house(specs: readonly Spec[], lot: number | readonly string[] = 12): HouseState {
  const rows = typeof lot === 'number' ? Array.from({ length: lot }, () => '.'.repeat(lot)) : lot;
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot,
    placedWeek: i,
  }));
  return { lot: lotFromRows(rows), pieces, nextUid: pieces.length + 1 };
}

/** Open ground 12 cells square but for `marks` (lot.ts's letters: T a Tree, B a Boulder...). */
function lotWith(marks: readonly (readonly [number, number, string])[]): string[] {
  return Array.from({ length: 12 }, (_, y) =>
    Array.from(
      { length: 12 },
      (_, x) => marks.find(([mx, my]) => mx === x && my === y)?.[2] ?? '.',
    ).join(''),
  );
}

/** A stone's box: its drawing at its spot. */
function box(g: Ground): Rect {
  if (g.op !== 'sprite') throw new Error(`a ${g.op}, not a stone`);
  return { x: g.x, y: g.y, ...artSize(g.sprite) };
}

const middle = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The house's model, yard, front door and stones. */
function walkOf(h: HouseState) {
  const m = houseModel(h);
  const yard = yardModel(h, m);
  const front = m.exits.find((e) => e.kind === 'front');
  return { m, yard, front, stones: yard.path.map(box) };
}

/** What's wrong with where the stones lie, as messages (none when they're right). */
function problems(h: HouseState, m: HouseModel, yard: YardModel): string[] {
  const out: string[] = [];
  const { width: W, height: H } = h.lot;
  const occ = occupancy(h);
  const items = [...yard.pieces.values()].flatMap((l) =>
    l.items.map((it) => ({ r: { x: it.x, y: it.y, ...artSize(it.sprite) }, name: it.sprite })),
  );
  for (const g of yard.path) {
    const r = box(g);
    const at = `${g.op === 'sprite' ? g.sprite : g.op} at ${r.x},${r.y}`;
    if (g.op !== 'sprite' || !STONES.includes(g.sprite as DrawingId))
      out.push(`${at}: not a stone`);
    if (r.x < 0 || r.y < 0 || r.x + r.w > W * CELL || r.y + r.h > H * CELL) {
      out.push(`${at}: off the lot`);
      continue;
    }
    for (let cy = Math.floor(r.y / CELL); cy <= Math.floor((r.y + r.h - 1) / CELL); cy++) {
      for (let cx = Math.floor(r.x / CELL); cx <= Math.floor((r.x + r.w - 1) / CELL); cx++) {
        const uid = occ.uids[cy * W + cx];
        const p = uid ? occ.byUid.get(uid) : undefined;
        if (p && p.defId !== 'lawn') out.push(`${at}: on a ${p.defId}`);
        if (!p && terrainAt(h.lot, cx, cy)) out.push(`${at}: on a ${terrainAt(h.lot, cx, cy)}`);
      }
    }
    for (const it of items) if (overlaps(it.r, r)) out.push(`${at}: under ${it.name}`);
    for (const e of m.exits) {
      if (overlaps(e.mat, r) || overlaps(e.gap, r)) out.push(`${at}: on a door's mat`);
    }
    for (const w of m.windows) if (w.bay && overlaps(w.bay, r)) out.push(`${at}: under a bay`);
  }
  return out;
}

/** A Living Room whose front door is in its south wall at (4, 4): the walk starts at (4, 5). */
const ROOM: Spec = ['livingRoom', 4, 2];

const png = decodePng(readFileSync(new URL('../../../assets/atlas.png', import.meta.url)), 'atlas');
const atlas: AtlasPixels = { width: png.width, height: png.height, data: png.rgba };

function pixel(p: Pixels, x: number, y: number): number[] {
  const i = ((y - p.y) * p.w + (x - p.x)) * 4;
  return [...p.data.subarray(i, i + 4)];
}

describe('the stepping stones (D-217)', () => {
  it('run straight down from the middle of the front door’s mat to the kerb', () => {
    const h = house([ROOM]);
    const { m, yard, front, stones } = walkOf(h);
    expect(front).toMatchObject({ side: 'S', cell: { x: 4, y: 4 } });
    expect(problems(h, m, yard)).toEqual([]);
    const mid = front!.mat.x + front!.mat.w / 2;
    // From just off the mat to the kerb, a stone every pitch, none on top of the last.
    expect(stones[0]!.y).toBeGreaterThan(front!.mat.y + front!.mat.h);
    expect(stones[0]!.y - (front!.mat.y + front!.mat.h)).toBeLessThanOrEqual(STEPPING.gap + 3);
    const last = stones[stones.length - 1]!;
    expect(h.lot.height * CELL - (last.y + last.h)).toBeLessThan(STEPPING.pitch);
    for (let i = 1; i < stones.length; i++) {
      expect(overlaps(stones[i - 1]!, stones[i]!)).toBe(false);
      expect(stones[i]!.y - stones[i - 1]!.y).toBeLessThanOrEqual(STEPPING.pitch + 2);
    }
    // Each a little to one side of the door's middle and then the other.
    for (const [i, s] of stones.entries()) {
      expect(Math.abs(middle(s).x - mid), `stone ${i}`).toBeLessThanOrEqual(
        STEPPING.stagger + STEPPING.jitter + 1,
      );
    }
    expect(new Set(stones.map((s) => Math.sign(middle(s).x - mid))).size).toBeGreaterThan(1);
    // More than one of the stones' shapes.
    expect(new Set(yard.path.map((g) => g.op === 'sprite' && g.sprite)).size).toBeGreaterThan(1);
  });

  it('lie under the household’s walk in, from the street up to the mat (D-177)', () => {
    const h = house([ROOM]);
    const { m, yard, front, stones } = walkOf(h);
    for (const n of [1, 2, 3]) {
      const spots = doorSpots(front!.mat, front!.side, n, h.lot.width * CELL);
      const from = walkStart(m, spots[0]!, Infinity, walkObstacles(h, yard), 0);
      // Nothing stops them: they walk straight up from the street.
      expect(from).not.toBeNull();
      expect(from!.y).toBeGreaterThan(h.lot.height * CELL);
      // The group (each one and their suitcase from x − 8 to x + 18) walks over every stone.
      const left = Math.min(...spots.map((s) => s.x - 8));
      const right = Math.max(...spots.map((s) => s.x + 18));
      for (const s of stones) {
        expect(s.x).toBeGreaterThanOrEqual(left - STEPPING.stagger);
        expect(s.x + s.w).toBeLessThanOrEqual(right + STEPPING.stagger);
      }
    }
  });

  it('go round a Tree in the way, and on to the kerb', () => {
    const h = house([ROOM], lotWith([[4, 7, 'T']]));
    const { m, yard, stones } = walkOf(h);
    expect(problems(h, m, yard)).toEqual([]);
    const tree = { x: 4 * CELL, y: 7 * CELL, w: CELL, h: CELL };
    expect(stones.some((s) => overlaps(s, tree))).toBe(false);
    // Past it, beside it, all the way down.
    expect(stones.some((s) => s.y > tree.y + tree.h)).toBe(true);
    const last = stones[stones.length - 1]!;
    expect(h.lot.height * CELL - (last.y + last.h)).toBeLessThan(STEPPING.pitch);
  });

  it('go round Boulders across the way, the shortest way', () => {
    const h = house([ROOM], lotWith([3, 4, 5].map((x) => [x, 8, 'B'] as const)));
    const { m, yard, stones } = walkOf(h);
    expect(problems(h, m, yard)).toEqual([]);
    const last = stones[stones.length - 1]!;
    expect(h.lot.height * CELL - (last.y + last.h)).toBeLessThan(STEPPING.pitch);
    // Round the west end (as near as the east, by the door's side of the room), never back north
    // (but for the stones' stagger to either side of the walk as it runs across).
    const sway = 2 * (STEPPING.stagger + STEPPING.jitter);
    for (let i = 1; i < stones.length; i++) {
      expect(stones[i]!.y, `stone ${i}`).toBeGreaterThanOrEqual(stones[i - 1]!.y - sway);
    }
    expect(stones.every((s) => s.x + s.w <= 6 * CELL)).toBe(true);
  });

  it('cross a Lawn on stones, and a Patio on its own paving, round its furniture', () => {
    const lawn = house([ROOM, ['lawn', 4, 6]]);
    const l = walkOf(lawn);
    expect(problems(lawn, l.m, l.yard)).toEqual([]);
    const onLawn = { x: 4 * CELL, y: 6 * CELL, w: 2 * CELL, h: 2 * CELL };
    expect(l.stones.filter((s) => overlaps(s, onLawn)).length).toBeGreaterThanOrEqual(4);

    const patio = house([ROOM, ['patio', 4, 5]]);
    const p = walkOf(patio);
    expect(p.front!.onto).toBe(2);
    expect(problems(patio, p.m, p.yard)).toEqual([]);
    const last = p.stones[p.stones.length - 1]!;
    expect(patio.lot.height * CELL - (last.y + last.h)).toBeLessThan(STEPPING.pitch);
  });

  it('go as near the street as they can behind a Fence across the yard', () => {
    const fenced = (y: number) => house([ROOM, ['fence', 0, y], ['fence', 4, y], ['fence', 8, y]]);
    const h = fenced(8);
    const { m, yard, stones } = walkOf(h);
    expect(problems(h, m, yard)).toEqual([]);
    // Down to the fence, as if to its gate: none past it.
    expect(stones.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...stones.map((s) => s.y + s.h))).toBeLessThanOrEqual(8 * CELL);
    expect(Math.max(...stones.map((s) => s.y + s.h))).toBeGreaterThan(7 * CELL);
    // A fence a step from the door: nowhere to go, so none (not a lone stone).
    expect(walkOf(fenced(6)).stones).toEqual([]);
  });

  it('lay none with no front door, one onto the sidewalk, or one boxed in by trees', () => {
    expect(walkOf(house([['patio', 4, 5]])).stones).toEqual([]);
    const street = walkOf(house([['livingRoom', 4, 9]]));
    expect(street.front?.cell.y).toBe(11);
    expect(street.stones).toEqual([]);
    const woods = house(
      [ROOM],
      lotWith([
        [3, 5, 'T'],
        [3, 6, 'T'],
        [4, 6, 'T'],
        [5, 6, 'T'],
        [5, 5, 'T'],
      ]),
    );
    expect(walkOf(woods).front).toMatchObject({ side: 'S', cell: { x: 4, y: 4 } });
    expect(walkOf(woods).stones).toEqual([]);
  });

  it('are the same every time, and none in a piece’s ghost', () => {
    const a = house([ROOM, ['lawn', 4, 6]], lotWith([[5, 9, 'T']]));
    const b = house([ROOM, ['lawn', 4, 6]], lotWith([[5, 9, 'T']]));
    expect(walkOf(a).yard.path.length).toBeGreaterThan(0);
    expect(JSON.stringify(walkOf(a).yard.path)).toBe(JSON.stringify(walkOf(b).yard.path));
    // The ghost is a piece drawn alone: no street, no door, no stones.
    for (const id of ['lawn', 'patio', 'driveway'] as const) {
      const ghost = yardPieceLayout(id, 0);
      expect(ghost.ground.some((g) => g.op === 'sprite' && g.sprite.startsWith('own-stone'))).toBe(
        false,
      );
    }
  });

  it('are painted on the floor canvas, and counted in the yard’s ground', () => {
    const h = house([ROOM]);
    const { m, yard } = walkOf(h);
    expect(yard.bounds!.y + yard.bounds!.h).toBe(h.lot.height);
    const p = paintFloors(m, atlas, { shadow: false, yard })!;
    for (const g of yard.path) {
      if (g.op !== 'sprite') continue;
      const d = drawingPixels(g.sprite as DrawingId);
      // Its lit middle: every opaque pixel on its middle row as drawn.
      const y = Math.floor(d.h / 2);
      for (let x = 0; x < d.w; x++) {
        const i = (y * d.w + x) * 4;
        if (d.data[i + 3] !== 255) continue;
        expect(pixel(p, g.x + x, g.y + y)).toEqual([...d.data.subarray(i, i + 4)]);
      }
    }
  });
});
