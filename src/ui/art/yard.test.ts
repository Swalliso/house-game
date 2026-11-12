// The yard pieces as the board draws them (D-097): every yard piece in every rotation lays out its
// ground on its own cells and its props standing on them; flat pieces edge themselves, softer
// against their own kind; the house's one parked car; curb cuts; Fences from their own cells; the
// yard's fixtures always drawn; colors that differ; the same every time; the ghost's layout, a
// pack's in its own tiles (D-106); any pack a player can click out.

import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
import {
  CONTENT,
  cellsToShape,
  packShapeProblem,
  parseShape,
  placedCells,
  type Cell,
  type FixtureId,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { computeLayout } from '../../rules/layout.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { grow, houseModel, overlaps, type Rect } from '../board/house-model.ts';
import { CELL, spritePos, type SpriteId } from '../sprites.ts';
import {
  artFrames,
  artSize,
  DRAWINGS,
  drawingPixels,
  inKey,
  isDrawing,
  KEY,
  type DrawingId,
} from './drawings.ts';
import { PAINTED } from './house-paint.ts';
import { inPalette } from './palette.ts';
import { itemRows, type Item } from './rooms.ts';
import {
  MATERIALS,
  newPieceLook,
  pieceLook,
  risingParts,
  yardModel,
  yardPieceLayout,
  type Ground,
  type YardLayout,
} from './yard.ts';

const YARD = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
  (id) => CONTENT.pieces[id].category !== 'indoor',
);

/** A piece: its type, its spot, its turn, its fixture, and a pack's own tiles (D-106). */
type Spec = readonly [PieceId, number, number, Rot?, FixtureId?, (readonly string[])?];

function house(specs: readonly Spec[], size = 12): HouseState {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0, fixture, shape], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot,
    placedWeek: i,
    ...(fixture ? { fixture: { id: fixture, week: 0 } } : {}),
    ...(shape ? { shape } : {}),
  }));
  const rows = Array.from({ length: size }, () => '.'.repeat(size));
  return { lot: lotFromRows(rows), pieces, nextUid: pieces.length + 1 };
}

function yardOf(h: HouseState) {
  return yardModel(h, houseModel(h));
}

/** Whether a yard piece of type `id` takes fixture `f`. */
function takes(f: FixtureId, id: PieceId): boolean {
  const fits = CONTENT.fixtures[f].fits;
  return typeof fits === 'object' && 'piece' in fits
    ? ([] as string[]).concat(fits.piece).includes(id)
    : CONTENT.pieces[id].category === 'yard' && id !== 'sapling';
}

const atlas = decodePng(
  readFileSync(new URL('../../../assets/atlas.png', import.meta.url)),
  'atlas',
);

/** The first pixel ("x,y") an item draws inside `r`, in any frame, from its row `from` on, or null. */
function pixelOn(it: Item, r: Rect, from = 0): string | null {
  const { w, h } = artSize(it.sprite);
  const frames = artFrames(it.sprite) ?? { frames: 1, stride: 0 };
  const alpha = (sx: number, sy: number, k: number): number => {
    if (isDrawing(it.sprite)) {
      const d = drawingPixels(it.sprite);
      return d.data[(sy * d.w * d.frames + k * d.w + sx) * 4 + 3]!;
    }
    const s = spritePos(it.sprite);
    return atlas.rgba[((s.y + sy) * atlas.width + s.x + k * frames.stride + sx) * 4 + 3]!;
  };
  for (let y = Math.max(r.y, it.y + from); y < Math.min(r.y + r.h, it.y + h); y++) {
    for (let x = Math.max(r.x, it.x); x < Math.min(r.x + r.w, it.x + w); x++) {
      for (let k = 0; k < frames.frames; k++)
        if (alpha(x - it.x, y - it.y, k) > 0) return `${x},${y}`;
    }
  }
  return null;
}

/** An outbuilding's own building: the Treehouse, the Greenhouse, the Doghouse, a coop, a Birdhouse. */
const BUILDINGS = /^(treehouse|greenhouse|own-doghouse|coop-\d|birdhouse-\d)$/;

/** The cells a ground op covers, as "x,y" keys (art px to cells). */
function groundCells(g: Ground): string[] {
  const r =
    g.op === 'sprite'
      ? { x: g.x, y: g.y, w: g.src?.w ?? CELL, h: g.src?.h ?? CELL }
      : g.op === 'rect'
        ? g.rect
        : { x: g.cx - g.rx, y: g.cy - g.ry, w: 2 * g.rx, h: 2 * g.ry };
  const out: string[] = [];
  for (let cy = Math.floor(r.y / CELL); cy <= Math.floor((r.y + r.h - 1) / CELL); cy++) {
    for (let cx = Math.floor(r.x / CELL); cx <= Math.floor((r.x + r.w - 1) / CELL); cx++) {
      out.push(`${cx},${cy}`);
    }
  }
  return out;
}

/** Problems with one yard piece's layout, as messages (none when it's right). */
function problems(l: YardLayout): string[] {
  const out: string[] = [];
  const own = new Set(l.cells.map((c) => `${c.x},${c.y}`));
  const name = (it: Item) => `${l.defId} ${l.uid}: ${it.sprite} at ${it.x},${it.y}`;
  // (An oval of light or water may reach past its cells: the painter clips a piece's ground to them.)
  for (const g of l.ground.filter((q) => q.op !== 'oval')) {
    for (const k of groundCells(g)) {
      if (!own.has(k)) out.push(`${l.defId} ${l.uid}: ground ${g.op} off its cells at ${k}`);
    }
  }
  for (const it of l.items) {
    const { w, h } = artSize(it.sprite);
    if (!Number.isInteger(it.x) || !Number.isInteger(it.y)) out.push(`${name(it)}: not whole px`);
    // It stands on its piece: its bottom row is on one of the piece's cells, inside the box.
    const foot = { x: Math.floor((it.x + w / 2) / CELL), y: Math.floor((it.y + h - 1) / CELL) };
    if (!own.has(`${foot.x},${foot.y}`)) out.push(`${name(it)}: stands off its cells`);
    if (it.x < l.box.x || it.x + w > l.box.x + l.box.w) out.push(`${name(it)}: past its sides`);
    if (it.y + h > l.box.y + l.box.h) out.push(`${name(it)}: past its front`);
    // What rises above its cells is split off for the overhang layer; the rest stays on them.
    const rows = itemRows(it);
    const top = rows.bottom ? it.y + rows.bottom[0] : it.y + h;
    for (let x = it.x; x < it.x + w; x++) {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(top / CELL);
      if (rows.bottom && !own.has(`${cx},${cy}`) && own.has(`${cx},${cy + 1}`)) {
        out.push(`${name(it)}: rises over its cells without an over line`);
        break;
      }
    }
  }
  return out;
}

/**
 * A placed piece's layout moved into its own frame (its bounding box's top-left cell at (0, 0)), as
 * its ghost is drawn: placed one cell in from the lot's corner, since on the board a Fence meets the
 * lot's back and side edges as it does a wall (D-159), and the ghost is the piece alone.
 */
function framed(l: YardLayout): YardLayout {
  const dx = l.box.x;
  const dy = l.box.y;
  const ground = l.ground.map((g): Ground =>
    g.op === 'sprite'
      ? { ...g, x: g.x - dx, y: g.y - dy }
      : g.op === 'rect'
        ? { ...g, rect: { ...g.rect, x: g.rect.x - dx, y: g.rect.y - dy } }
        : { ...g, cx: g.cx - dx, cy: g.cy - dy },
  );
  return {
    ...l,
    cells: l.cells.map((c) => ({ x: c.x - dx / CELL, y: c.y - dy / CELL })),
    box: { ...l.box, x: 0, y: 0 },
    ground,
    items: l.items.map((i) => ({
      ...i,
      x: i.x - dx,
      y: i.y - dy,
      ...(i.over === undefined ? {} : { over: i.over - dy }),
    })),
  };
}

describe('yard layouts', () => {
  it('lay out every yard piece in every rotation on its own cells', () => {
    for (const id of YARD) {
      for (const rot of [0, 1, 2, 3] as const) {
        const h = house([[id, 3, 3, rot]]);
        const l = yardOf(h).pieces.get(1)!;
        expect(l.defId).toBe(id);
        expect(problems(l), `${id} r${rot}`).toEqual([]);
        // Every type draws something: ground, props, or both.
        expect(l.ground.length + l.items.length, `${id} r${rot}`).toBeGreaterThan(0);
      }
    }
  });

  it('lay out every yard piece with every fixture it takes, and draw the fixture', () => {
    const yardFixtures = (Object.keys(CONTENT.fixtures) as FixtureId[]).filter((f) =>
      ['sprinkler', 'pergola', 'gardenLights'].includes(f),
    );
    for (const f of yardFixtures) {
      const fits = CONTENT.fixtures[f].fits;
      for (const id of YARD) {
        const ok =
          typeof fits === 'object' && 'piece' in fits
            ? ([] as string[]).concat(fits.piece).includes(id)
            : CONTENT.pieces[id].category === 'yard' && id !== 'sapling';
        if (!ok) continue;
        for (const rot of [0, 1] as const) {
          const l = yardOf(house([[id, 3, 3, rot, f]])).pieces.get(1)!;
          expect(problems(l), `${id} r${rot} + ${f}`).toEqual([]);
          expect(l.fixtureShown, `${id} r${rot} + ${f}`).toBe(true);
        }
      }
    }
    const lawn = yardOf(house([['lawn', 3, 3, 0, 'sprinkler']])).pieces.get(1)!;
    expect(lawn.items.map((i) => i.sprite)).toContain('own-sprinkler');
    const patio = yardOf(house([['patio', 3, 3, 0, 'pergola']])).pieces.get(1)!;
    expect(patio.items.map((i) => i.sprite)).toContain('pergola');
    expect(patio.items.some((i) => i.sprite.startsWith('parasol'))).toBe(false);
    const bed = yardOf(house([['flowerBed', 3, 3, 0, 'gardenLights']])).pieces.get(1)!;
    expect(bed.items.map((i) => i.sprite)).toContain('bollard');
  });

  it('put a parasol over a Patio, its seats facing a table under it', () => {
    const l = yardOf(house([['patio', 3, 3]])).pieces.get(1)!;
    const sprites = l.items.map((i) => i.sprite);
    expect(sprites.some((s) => s.startsWith('parasol-'))).toBe(true);
    expect(sprites.filter((s) => s.startsWith('patio-chair-')).length).toBe(2);
    expect(sprites).toContain('patio-table');
  });

  it('raise tall props over the cells behind them: the Greenhouse’s roof, the Treehouse', () => {
    for (const id of ['greenhouse', 'treehouse', 'birdhouse'] as const) {
      const l = yardOf(house([[id, 3, 3]])).pieces.get(1)!;
      const tall = l.items.find((i) => i.over !== undefined)!;
      expect(tall, id).toBeDefined();
      expect(tall.over).toBe(3 * CELL);
      expect(itemRows(tall).top).toEqual([0, 3 * CELL - tall.y]);
      // Less than a whole cell, so a piece behind it still shows.
      expect(3 * CELL - tall.y, id).toBeLessThan(CELL);
    }
  });

  it('say what rises above their own cells, for other pieces’ labels to keep off', () => {
    const rise = (id: PieceId, rot: Rot = 0) =>
      risingParts(yardOf(house([[id, 3, 3, rot]])).pieces.get(1)!);
    expect(rise('greenhouse')).toEqual([{ x: 3 * CELL + 4, y: 3 * CELL - 14, w: 56, h: 14 }]);
    expect(rise('treehouse').map((r) => r.h)).toEqual([25]);
    expect(rise('birdhouse').map((r) => r.h)).toEqual([9]);
    // A side-on car's roof, over the row behind its Driveway.
    expect(rise('driveway').map((r) => [r.y, r.h])).toEqual([[3 * CELL - 6, 6]]);
    for (const flat of ['lawn', 'pool', 'herbGarden'] as const)
      expect(rise(flat), flat).toEqual([]);
  });

  it('are the same every time, and cached per house model', () => {
    const h = house([
      ['patio', 1, 1],
      ['fence', 4, 1],
      ['henhouse', 1, 4, 1],
    ]);
    const m = houseModel(h);
    expect(yardModel(h, m)).toBe(yardModel(h, m));
    const again = house([
      ['patio', 1, 1],
      ['fence', 4, 1],
      ['henhouse', 1, 4, 1],
    ]);
    expect(JSON.stringify([...yardOf(again).pieces])).toBe(JSON.stringify([...yardOf(h).pieces]));
  });

  it('look the same as their ghost, but for the parked car', () => {
    for (const id of YARD) {
      for (const rot of [0, 1, 2, 3] as const) {
        const h = house([[id, 1, 1, rot]]);
        const ghost = yardPieceLayout(id, rot, pieceLook(h, 1));
        const placed = framed(yardOf(h).pieces.get(1)!);
        const items = (l: YardLayout) => l.items.filter((i) => !i.sprite.startsWith('car-'));
        expect(items(ghost), `${id} r${rot}`).toEqual(items(placed));
        expect(ghost.ground, `${id} r${rot}`).toEqual(placed.ground);
      }
    }
  });
});

describe('the yard’s ground', () => {
  it('edges a flat piece, softer where it meets another of its kind', () => {
    const y = yardOf(
      house([
        ['lawn', 1, 1],
        ['lawn', 3, 1],
      ]),
    );
    const a = y.pieces.get(1)!;
    const edge = (l: YardLayout, x: number) =>
      l.ground.filter(
        (g): g is Extract<Ground, { op: 'rect' }> => g.op === 'rect' && g.rect.x === x,
      );
    // Its west edge is a full edge; its east edge, against the other Lawn, a softer seam.
    const west = edge(a, 1 * CELL);
    const east = edge(a, 3 * CELL - 1);
    expect(west.length).toBeGreaterThan(0);
    expect(east.length).toBeGreaterThan(0);
    expect(east[0]!.alpha).toBeLessThan(west[0]!.alpha);
    expect(east[0]!.alpha).toBeGreaterThan(0);
  });

  it('cuts the curb where a Driveway meets the street, and only there', () => {
    const size = 12;
    const y = yardOf(
      house(
        [
          ['driveway', 4, size - 3, 1],
          ['driveway', 4, size - 6, 1],
          ['patio', 7, size - 2],
        ],
        size,
      ),
    );
    const cuts = y.curbs.filter((g): g is Extract<Ground, { op: 'sprite' }> => g.op === 'sprite');
    expect(cuts.map((g) => [g.x / CELL, g.y / CELL])).toEqual([[4, size]]);
    expect(y.bounds!.y + y.bounds!.h).toBe(size + 1);
  });

  it('lays a Pool’s water inside its coping, for any rotation', () => {
    for (const rot of [0, 1] as const) {
      const l = yardOf(house([['pool', 2, 2, rot]])).pieces.get(1)!;
      const tiles = l.ground.filter((g) => g.op === 'sprite');
      // 16 px tiles over every cell: 4 per cell, corners at the corners.
      expect(tiles.length).toBe(4 * l.cells.length);
      const at = (x: number, y: number) =>
        tiles.find((g) => g.op === 'sprite' && g.x === x && g.y === y);
      const nw = at(l.box.x, l.box.y);
      expect(nw?.op === 'sprite' && nw.src).toEqual({ x: 0, y: 0, w: 16, h: 16 });
      const se = at(l.box.x + l.box.w - 16, l.box.y + l.box.h - 16);
      expect(se?.op === 'sprite' && se.src).toEqual({ x: 32, y: 32, w: 16, h: 16 });
    }
  });
});

describe('the parked car', () => {
  const cars = (y: ReturnType<typeof yardOf>) =>
    [...y.pieces.values()].flatMap((l) =>
      l.items.filter((i) => i.sprite.startsWith('car-')).map((i) => ({ uid: l.uid, i })),
    );

  it('stands on the house’s oldest Driveway, one per house', () => {
    const y = yardOf(
      house([
        ['driveway', 4, 9, 1],
        ['driveway', 6, 7, 1, undefined, ['#####']],
        ['driveway', 4, 6, 1],
      ]),
    );
    const c = cars(y);
    expect(c.length).toBe(1);
    expect(c[0]!.uid).toBe(1);
    // Nose in, from behind, on a Driveway running up from the street.
    expect(c[0]!.i.sprite).toMatch(/^car-rear-/);
  });

  it('parks side on along a Driveway that runs across, facing the house', () => {
    const y = yardOf(
      house([
        ['bedroom', 7, 8],
        ['driveway', 4, 9, 0],
      ]),
    );
    const c = cars(y);
    expect(c.length).toBe(1);
    expect(c[0]!.i.sprite).toMatch(/^car-right-/);
    // Its roof rises over the row behind it, on the overhang layer.
    expect(c[0]!.i.over).toBe(9 * CELL);
  });

  it('is never the Garage’s blue or red', () => {
    for (let n = 0; n < 6; n++) {
      const specs: Spec[] = Array.from({ length: n }, (_, i) => ['flowerBed', i, 0] as Spec);
      const y = yardOf(house([...specs, ['driveway', 4, 9, 1]]));
      expect(cars(y)[0]!.i.sprite).toMatch(/-(2|3)$/);
    }
  });

  it('parks only on its Driveway’s own tiles: one tile sends it to the next Driveway', () => {
    // A pack too small for it (D-106): the house's car parks on its next Driveway instead.
    const y = yardOf(
      house([
        ['driveway', 4, 9, 0, undefined, ['#']],
        ['driveway', 9, 6, 1],
      ]),
    );
    expect(cars(y).map((c) => c.uid)).toEqual([2]);
    // Two tiles are room enough, side by side or one behind the other.
    for (const shape of [['##'], ['#', '#']]) {
      const l = yardOf(house([['driveway', 4, 9, 0, undefined, shape]])).pieces.get(1)!;
      const car = l.items.filter((i) => i.sprite.startsWith('car-'));
      expect(car.length, shape.join('/')).toBe(1);
      expect(offTiles(l, car[0]!), shape.join('/')).toEqual([]);
    }
  });

  it('parks a ragged pack’s car in another row or column of its tiles, never off them', () => {
    // [the pack's tiles, the car it parks]: where its front row or its west column can't hold
    // the car, a row behind or a column east of it does, side on or nose in.
    const cases: readonly (readonly [readonly string[], RegExp])[] = [
      // A T, and an L with its foot behind: side on, along the row behind (its front row is a
      // single tile).
      [['###', '.#.'], /^car-(left|right)-/],
      [['##', '#.'], /^car-(left|right)-/],
      // A T upside down, and an L with its arm up: nose in, up the stem or the arm. Side on
      // along the front row, its roof would rise onto grass inside the pack's outline, under
      // whatever stands there, with no over line to lift it.
      [['.#.', '###'], /^car-rear-/],
      [['#.', '##'], /^car-rear-/],
      // Up and down, its west column a single tile: nose in, up the east column.
      [['.#', '.#', '##'], /^car-rear-/],
      // A long L and a block: side on along the front row, as ever.
      [['#..', '###'], /^car-(left|right)-/],
      [['##', '##'], /^car-(left|right)-/],
    ];
    for (const [shape, sprite] of cases) {
      const l = yardOf(house([['driveway', 4, 8, 0, undefined, shape]])).pieces.get(1)!;
      const car = l.items.filter((i) => i.sprite.startsWith('car-'));
      expect(car.length, shape.join('/')).toBe(1);
      expect(car[0]!.sprite, shape.join('/')).toMatch(sprite);
      expect(offTiles(l, car[0]!), shape.join('/')).toEqual([]);
      expect(problems(l), shape.join('/')).toEqual([]);
    }
  });
});

/**
 * The cells an item covers that aren't its piece's, below its over line (what rises above that
 * line goes on the overhang, over the row behind), its feet always: none for an item that
 * stands on its piece.
 */
function offTiles(l: YardLayout, it: Item): string[] {
  const own = new Set(l.cells.map((q) => `${q.x},${q.y}`));
  const { w, h } = artSize(it.sprite);
  const from = Math.min(it.y + Math.max(0, h - 8), Math.max(it.y, it.over ?? it.y));
  const off = new Set<string>();
  for (let py = from; py < it.y + h; py++) {
    for (let px = it.x; px < it.x + w; px++) {
      const at = `${Math.floor(px / CELL)},${Math.floor(py / CELL)}`;
      if (!own.has(at)) off.add(at);
    }
  }
  return [...off];
}

describe('outside doors', () => {
  const rect = (it: Item) => ({ x: it.x, y: it.y, ...artSize(it.sprite) });

  it('keep the yard’s props off their mats and openings', () => {
    // A Patio south of a Living Room: the front door opens onto it (paved ground).
    const h = house([
      ['livingRoom', 4, 2],
      ['patio', 4, 5],
    ]);
    const m = houseModel(h);
    const door = m.exits.find((e) => e.onto === 2)!;
    expect(door).toBeDefined();
    const items = yardModel(h, m).pieces.get(2)!.items;
    for (const it of items) {
      expect(overlaps(rect(it), door.mat), it.sprite).toBe(false);
      expect(overlaps(rect(it), door.gap), it.sprite).toBe(false);
    }
    // Its table and seats still stand on it, clear of the door, under a small parasol (the
    // full one would cover the door).
    expect(items.some((i) => i.sprite === 'patio-table')).toBe(true);
    expect(items.some((i) => i.sprite.startsWith('parasol-small-'))).toBe(true);
    expect(items.some((i) => /^parasol-\d/.test(i.sprite))).toBe(false);
  });

  it('stand a Pergola clear of a door’s mat on any edge of its Patio: shallower or narrower', () => {
    // A room on each side of the Patio, so a door opens onto each of its edges in turn; the
    // playtest's was a Living Room's back door onto its east edge. The whole Pergola's beams,
    // rafters and posts reach every edge, so it would cover the mat: a shallower cut stands clear
    // of a north or south door's, a narrower one of an east or west door's, on the far side.
    const sides: readonly [string, Spec, string, string][] = [
      ['north edge', ['livingRoom', 4, 1], 'S', 'pergola-short'],
      ['south edge', ['kitchen', 4, 6], 'N', 'pergola-short'],
      ['east edge', ['livingRoom', 6, 3], 'W', 'pergola-narrow'],
      ['west edge', ['livingRoom', 2, 3], 'E', 'pergola-narrow'],
    ];
    const pergolas = (l: YardLayout) =>
      l.items.map((i) => i.sprite).filter((sp) => sp.startsWith('pergola'));
    for (const [edge, room, wall, cut] of sides) {
      for (const rot of [0, 1, 2, 3] as const) {
        const h = house([room, ['patio', 4, 4, rot, 'pergola']]);
        const m = houseModel(h);
        const name = `door on its ${edge}, r${rot}`;
        const door = m.exits.find((e) => e.onto === 2)!;
        expect(door, name).toBeDefined();
        expect(door.side, name).toBe(wall);
        const l = yardModel(h, m).pieces.get(2)!;
        expect(l.fixtureShown, name).toBe(true);
        expect(pergolas(l), name).toEqual([cut]);
        // In place of the parasol, over the table and its seats; all of them clear of the door.
        expect(
          l.items.some((i) => i.sprite.startsWith('parasol-')),
          name,
        ).toBe(false);
        expect(l.items.filter((i) => /^patio-(table|chair)/.test(i.sprite)).length, name).toBe(3);
        for (const it of l.items) {
          expect(overlaps(rect(it), door.mat), `${name}: ${it.sprite}`).toBe(false);
          expect(overlaps(rect(it), door.gap), `${name}: ${it.sprite}`).toBe(false);
        }
      }
    }
    // Where no door opens onto it, the whole Pergola roofs the Patio.
    const apart = yardOf(
      house([
        ['livingRoom', 0, 0],
        ['patio', 4, 4, 0, 'pergola'],
      ]),
    ).pieces.get(2)!;
    expect(apart.fixtureShown).toBe(true);
    expect(pergolas(apart)).toEqual(['pergola']);
    expect(apart.items.some((i) => i.sprite.startsWith('parasol-'))).toBe(false);
    // With doors on two sides (a Bedroom's onto its north edge, a Living Room's onto its west
    // edge) no cut stands clear of both: its badge shows, and the Patio keeps a parasol.
    const h = house([
      ['bedroom', 3, 2],
      ['livingRoom', 1, 5, 1],
      ['patio', 4, 4, 0, 'pergola'],
    ]);
    const m = houseModel(h);
    expect(new Set(m.exits.filter((e) => e.onto === 3).map((e) => e.side))).toEqual(
      new Set(['S', 'E']),
    );
    const both = yardModel(h, m).pieces.get(3)!;
    expect(both.fixtureShown).toBe(false);
    expect(pergolas(both)).toEqual([]);
    expect(both.items.some((i) => i.sprite.startsWith('parasol-'))).toBe(true);
  });

  it('stand an outbuilding beside a door: it’s the piece itself', () => {
    // The playtest review's cases: a Treehouse or a Greenhouse whose roof rises over a door's mat
    // or opening in the row behind it, which used to leave only its shadow and its digit.
    const cases: readonly (readonly Spec[])[] = [
      [
        ['hallway', 6, 3],
        ['treehouse', 6, 4],
      ],
      [
        ['livingRoom', 6, 4],
        ['patio', 4, 3],
        ['treehouse', 4, 5],
      ],
      [
        ['livingRoom', 6, 4],
        ['patio', 4, 3],
        ['greenhouse', 4, 5],
      ],
      [
        ['bedroom', 6, 6],
        ['treehouse', 6, 8],
      ],
    ];
    for (const specs of cases) {
      const h = house(specs);
      const m = houseModel(h);
      const uid = specs.length;
      const id = specs[uid - 1]![0];
      const l = yardModel(h, m).pieces.get(uid)!;
      const name = specs.map((sp) => sp[0]).join(' + ');
      expect(
        l.items.map((i) => i.sprite),
        name,
      ).toContain(id);
      // Doors did open nearby: its roof meets one's mat or opening (grown by the props' margin).
      const building = l.items.find((i) => i.sprite === id)!;
      expect(
        m.exits.some((e) =>
          [grow(e.mat, 2), grow(e.gap, 2)].some((r) => overlaps(rect(building), r)),
        ),
        name,
      ).toBe(true);
    }
  });

  it('never cover a door’s mat or opening with a pixel, any prop on any side, in any rotation', () => {
    // Every yard piece with each fixture it takes, against a room on each of its sides, along
    // it: whatever doors the house gets, no opaque pixel of a prop lies on a mat or an opening.
    const fixtures: readonly (FixtureId | undefined)[] = [
      undefined,
      'sprinkler',
      'pergola',
      'gardenLights',
    ];
    let doors = 0;
    for (const id of YARD) {
      for (const f of fixtures) {
        if (f && !takes(f, id)) continue;
        for (const rot of [0, 1, 2, 3] as const) {
          const shape = CONTENT.pieces[id].shape;
          const w = rot % 2 === 0 ? shape[0]!.length : shape.length;
          const ht = rot % 2 === 0 ? shape.length : shape[0]!.length;
          // A 2×2 Bedroom at (6, 6); the piece against its north, south, west and east sides.
          const spots: [number, number][] = [];
          for (let dx = -w + 1; dx <= 1; dx++) spots.push([6 + dx, 6 - ht], [6 + dx, 8]);
          for (let dy = -ht + 1; dy <= 1; dy++) spots.push([6 - w, 6 + dy], [8, 6 + dy]);
          for (const [x, y] of spots) {
            const h = house(
              [
                ['bedroom', 6, 6],
                [id, x, y, rot, f],
              ],
              16,
            );
            const m = houseModel(h);
            const items = yardModel(h, m).pieces.get(2)!.items;
            for (const e of m.exits) {
              if (e.onto === 2) doors++;
              for (const it of items) {
                // An outbuilding's own building always stands (no door opens onto one): only its
                // rows on its own cells are held to the doors; its roof may rise over one behind it.
                const from = BUILDINGS.test(it.sprite) ? (itemRows(it).bottom?.[0] ?? Infinity) : 0;
                const at = pixelOn(it, e.mat, from) ?? pixelOn(it, e.gap, from);
                expect(
                  at,
                  `${id}${f ? ` + ${f}` : ''} r${rot} at ${x},${y}: ${it.sprite} on ${e.kind} door ${e.side}`,
                ).toBeNull();
              }
            }
          }
        }
      }
    }
    // Doors did open onto the pieces they can (Patios, Driveways, Lawns, the Hot Tub).
    expect(doors).toBeGreaterThan(50);
  });

  it('park the car further along, or on the next Driveway, off a door’s mat', () => {
    // A front door onto the middle of the oldest Driveway: no room for the car beside its mat,
    // so it parks on the next one.
    const h = house([
      ['livingRoom', 2, 8, 1],
      ['driveway', 2, 10, 0],
      ['driveway', 7, 7, 1],
    ]);
    const m = houseModel(h);
    const door = m.exits.find((e) => e.kind === 'front')!;
    expect(door.onto).toBe(2);
    const y = yardModel(h, m);
    const cars = [...y.pieces.values()].flatMap((l) =>
      l.items.filter((i) => i.sprite.startsWith('car-')).map((i) => ({ uid: l.uid, i })),
    );
    expect(cars.map((c) => c.uid)).toEqual([3]);
    expect(overlaps(rect(cars[0]!.i), door.mat)).toBe(false);
  });
});

describe('fences', () => {
  const sprites = (l: YardLayout) => l.items.map((i) => i.sprite);
  /** A Fence pack clicked out as an L (D-106). */
  const L_FENCE = ['#..', '#..', '###'] as const;

  it('run through the middle of their cells, with a post at each end', () => {
    const l = yardOf(house([['fence', 2, 2]])).pieces.get(1)!;
    expect(sprites(l).filter((s) => s === 'picket-run').length).toBe(8);
    const posts = l.items.filter((i) => i.sprite === 'picket-post');
    expect(posts.map((p) => p.x)).toEqual([2 * CELL + 1, 5 * CELL + 26]);
  });

  it('draw a one-tile pack as a short run across, with a post at each end, ghost and all', () => {
    const l = yardOf(house([['fence', 2, 2, 0, undefined, ['#']]])).pieces.get(1)!;
    expect(sprites(l).filter((s) => s === 'picket-run').length).toBe(2);
    const posts = l.items.filter((i) => i.sprite === 'picket-post');
    expect(posts.map((p) => p.x)).toEqual([2 * CELL + 1, 2 * CELL + 26]);
    // Its ghost is the same, in its own frame.
    const ghost = yardPieceLayout('fence', 0, undefined, ['#']);
    expect(ghost.items.map((i) => [i.sprite, i.x + 2 * CELL, i.y + 2 * CELL])).toEqual(
      l.items.map((i) => [i.sprite, i.x, i.y]),
    );
  });

  it('close a 2×2 pack into a pen: every tile draws its arms, a post at each turn', () => {
    const l = yardOf(house([['fence', 2, 2, 0, undefined, ['##', '##']]])).pieces.get(1)!;
    const posts = l.items.filter((i) => i.sprite === 'picket-post');
    expect(posts.length).toBe(4);
    for (const [cx, cy] of [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ] as const) {
      const inCell = l.items.filter(
        (i) => Math.floor(i.x / CELL) === cx && Math.floor(i.y / CELL) === cy,
      );
      expect(
        inCell.some((i) => i.sprite === 'picket-run'),
        `${cx},${cy}`,
      ).toBe(true);
      expect(
        inCell.some((i) => i.sprite === 'picket-strip'),
        `${cx},${cy}`,
      ).toBe(true);
    }
  });

  it('turn an L’s corner at a post, and stand end on along its upright arm', () => {
    const l = yardOf(house([['fence', 2, 2, 0, undefined, L_FENCE]])).pieces.get(1)!;
    // Its corner cell (2, 4): a post where the arms meet.
    expect(
      l.items.some(
        (i) => i.sprite === 'picket-post' && i.x === 2 * CELL + 14 && i.y === 4 * CELL + 8,
      ),
    ).toBe(true);
    expect(sprites(l).filter((s) => s === 'picket-strip').length).toBeGreaterThan(4);
  });

  it('meet end to end as one run, with no post between them (D-159)', () => {
    const alone = yardOf(house([['fence', 0, 2]])).pieces.get(1)!;
    const touching = yardOf(
      house([
        ['fence', 0, 2],
        ['fence', 4, 2],
      ]),
    );
    // The first is as it is alone, but for its east end post; the second is its mirror.
    const seam = (i: Item) => i.sprite === 'picket-post' && i.x === 3 * CELL + 26;
    expect(touching.pieces.get(1)!.items).toEqual(alone.items.filter((i) => !seam(i)));
    const posts = [...touching.pieces.values()].flatMap((l) =>
      l.items.filter((i) => i.sprite === 'picket-post').map((i) => i.x),
    );
    // Only the run's two far ends have posts.
    expect(posts.sort((a, b) => a - b)).toEqual([0 * CELL + 1, 7 * CELL + 26]);
    // Pickets the whole way: two runs in each of the eight cells.
    const runs = [...touching.pieces.values()].flatMap((l) =>
      l.items.filter((i) => i.sprite === 'picket-run').map((i) => i.x),
    );
    expect(runs.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, k) => k * (CELL / 2)),
    );
  });

  it('turn a corner where one’s end meets another’s, with one post at the joint', () => {
    const y = yardOf(
      house([
        ['fence', 0, 2],
        ['fence', 3, 3, 1],
      ]),
    );
    const across = y.pieces.get(1)!.items;
    const down = y.pieces.get(2)!.items;
    // The first ends at its last cell's middle, in a corner post, with its arm turning south.
    expect(across.some((i) => i.sprite === 'picket-post' && i.x === 3 * CELL + 14)).toBe(true);
    expect(across.some((i) => i.sprite === 'picket-post' && i.x === 3 * CELL + 26)).toBe(false);
    expect(across.some((i) => i.sprite === 'picket-strip' && i.y === 2 * CELL + 24)).toBe(true);
    // The second runs up into it, with no post of its own at the top.
    expect(down.some((i) => i.sprite === 'picket-post' && i.y === 3 * CELL)).toBe(false);
    expect(down.some((i) => i.sprite === 'picket-strip' && i.y === 3 * CELL)).toBe(true);
  });

  it('stay two where they lie side by side: their ends never close them into a pen', () => {
    const alone = (y: number) => yardOf(house([['fence', 0, y]])).pieces.get(1)!.items;
    const y = yardOf(
      house([
        ['fence', 0, 2],
        ['fence', 0, 3],
      ]),
    );
    // Each draws as it would alone: no strips between them, its own end posts.
    expect(y.pieces.get(1)!.items).toEqual(alone(2));
    expect(y.pieces.get(2)!.items).toEqual(alone(3));
    // An L of Fence beside a Fence, its foot alongside: the same.
    const l = yardOf(
      house([
        ['fence', 0, 0, 0, undefined, L_FENCE],
        ['fence', 0, 3],
      ]),
    );
    expect(l.pieces.get(2)!.items).toEqual(alone(3));
    expect(l.pieces.get(2)!.items.some((i) => i.sprite === 'picket-strip')).toBe(false);
  });

  /** Whether a layout has `sprite` at (x, y). */
  const has = (l: YardLayout, sprite: string, x: number, y: number) =>
    l.items.some((i) => i.sprite === sprite && i.x === x && i.y === y);

  it('reach a wall beside an end: straight into it with a post, or turning into it (D-159)', () => {
    // A Bedroom on (4..5, 3..4). Fences: one running west into its east wall, one running up
    // into its south wall, and one along its north side whose ends turn down into the wall.
    const y = yardOf(
      house([
        ['bedroom', 4, 3],
        ['fence', 6, 3, 0, undefined, ['###']],
        ['fence', 4, 5, 0, undefined, ['#', '#']],
        ['fence', 4, 2, 0, undefined, ['##']],
      ]),
    );
    const into = y.pieces.get(2)!;
    // Across to its west edge, with its end post there, against the wall.
    expect(has(into, 'picket-run', 6 * CELL, 3 * CELL + 8)).toBe(true);
    expect(has(into, 'picket-post', 6 * CELL + 1, 3 * CELL + 8)).toBe(true);
    const up = y.pieces.get(3)!;
    // Up to its top edge, with its end post there.
    expect(has(up, 'picket-post', 4 * CELL + 14, 5 * CELL)).toBe(true);
    const along = y.pieces.get(4)!;
    // Each end turns south at its middle, down to the wall: a post and the strip below it.
    for (const x of [4, 5]) {
      expect(has(along, 'picket-post', x * CELL + 14, 2 * CELL + 8), `${x}`).toBe(true);
      expect(has(along, 'picket-strip', x * CELL + 14, 2 * CELL + 24), `${x}`).toBe(true);
    }
    // So it's a pen against the wall, with no end posts of its own.
    expect(along.items.filter((i) => i.sprite === 'picket-post').length).toBe(2);
  });

  it('tie a run alongside the house to the wall at each end of the stretch (D-159)', () => {
    // A Fence up the east side of a Hallway column (6, 2..4), and on past it to row 6.
    const y = yardOf(
      house([
        ['hallway', 6, 2, 1],
        ['closet', 6, 4],
        ['fence', 7, 2, 0, undefined, ['#', '#', '#', '#', '#']],
      ]),
    );
    const l = y.pieces.get(3)!;
    const westArm = (row: number) => has(l, 'picket-run', 7 * CELL, row * CELL + 8);
    // Its north end turns west into the wall; the last cell beside the house is a T to it; the
    // cell between them runs straight past, the strip between it and the wall closed off.
    expect([2, 3, 4, 5, 6].map(westArm)).toEqual([true, false, true, false, false]);
    expect(has(l, 'picket-post', 7 * CELL + 14, 4 * CELL + 8)).toBe(true);
  });

  it('stand a one-tile pack upright to meet a wall or a Fence north or south of it (D-159)', () => {
    const y = yardOf(
      house([
        ['bedroom', 4, 3],
        // Under the Bedroom: upright, a post at each end.
        ['fence', 4, 5, 0, undefined, ['#']],
        // Under that one: upright too, joined to it, with no post between them.
        ['fence', 4, 6, 0, undefined, ['#']],
        // Beside nothing: a short run across, as alone.
        ['fence', 8, 8, 0, undefined, ['#']],
      ]),
    );
    const under = y.pieces.get(2)!;
    expect(under.items.map((i) => i.sprite)).not.toContain('picket-run');
    expect(has(under, 'picket-post', 4 * CELL + 14, 5 * CELL)).toBe(true);
    expect(has(under, 'picket-post', 4 * CELL + 14, 5 * CELL + 16)).toBe(false);
    const below = y.pieces.get(3)!;
    expect(below.items.map((i) => i.sprite)).not.toContain('picket-run');
    expect(has(below, 'picket-strip', 4 * CELL + 14, 6 * CELL)).toBe(true);
    expect(has(below, 'picket-post', 4 * CELL + 14, 6 * CELL + 16)).toBe(true);
    const lone = y.pieces.get(4)!;
    expect(lone.items).toEqual(
      yardPieceLayout('fence', 0, undefined, ['#']).items.map((i) => ({
        ...i,
        x: i.x + 8 * CELL,
        y: i.y + 8 * CELL,
      })),
    );
  });

  it('reach a corner of the house they touch only diagonally, as the rules close it (D-159)', () => {
    // A Fence's east end at (3, 2), the Bedroom's corner at (4, 3).
    const y = yardOf(
      house([
        ['bedroom', 4, 3],
        ['fence', 0, 2],
      ]),
    );
    const l = y.pieces.get(2)!;
    // A post on its east edge, and the strip under it down to the corner, for its end post.
    expect(has(l, 'picket-post', 3 * CELL + 27, 2 * CELL + 8)).toBe(true);
    expect(has(l, 'picket-strip', 3 * CELL + 27, 2 * CELL + 24)).toBe(true);
    expect(has(l, 'picket-post', 3 * CELL + 26, 2 * CELL + 8)).toBe(false);
  });
});

describe('colors', () => {
  it('differ between pieces of a type, up to the palette, and keep as newer ones come', () => {
    const parasol = (y: ReturnType<typeof yardOf>, uid: number) =>
      y.pieces.get(uid)!.items.find((i) => i.sprite.startsWith('parasol-'))!.sprite;
    const two = yardOf(
      house([
        ['patio', 1, 1],
        ['patio', 4, 1],
      ]),
    );
    expect(parasol(two, 1)).not.toBe(parasol(two, 2));
    const three = yardOf(
      house([
        ['patio', 1, 1],
        ['patio', 4, 1],
        ['patio', 7, 1],
      ]),
    );
    expect(parasol(three, 1)).toBe(parasol(two, 1));
    expect(parasol(three, 2)).toBe(parasol(two, 2));
    expect(new Set([1, 2, 3].map((u) => parasol(three, u))).size).toBe(3);
  });
});

describe('ghosts', () => {
  it('take the color a new piece will get, and a carried piece’s color and fixture', () => {
    const before = house([
      ['patio', 1, 1],
      ['patio', 4, 1],
    ]);
    const look = newPieceLook(before, 'patio');
    const after = house([
      ['patio', 1, 1],
      ['patio', 4, 1],
      ['patio', 7, 1],
    ]);
    const parasol = (l: YardLayout) => l.items.find((i) => i.sprite.startsWith('parasol-'))!.sprite;
    expect(parasol(yardPieceLayout('patio', 0, look))).toBe(parasol(yardOf(after).pieces.get(3)!));
    // Carrying a Patio with its Pergola: the ghost has the Pergola too.
    const carried = house([['patio', 1, 1, 0, 'pergola']]);
    const ghost = yardPieceLayout('patio', 0, pieceLook(carried, 1));
    expect(ghost.items.map((i) => i.sprite)).toContain('pergola');
  });

  it('take a pack’s own tiles (D-106): a frame that matches its cells, as it will be built', () => {
    // A pack starts as the tile under the pointer: one cell of Fence, not the card's four.
    const one = yardPieceLayout('fence', 0, undefined, ['#']);
    expect(one.cells).toEqual([{ x: 0, y: 0 }]);
    expect(one.box).toEqual({ x: 0, y: 0, w: CELL, h: CELL });
    for (const it of one.items) {
      const { w, h } = artSize(it.sprite);
      expect(it.x >= 0 && it.y >= 0 && it.x + w <= CELL && it.y + h <= CELL, it.sprite).toBe(true);
    }
    // The card's own shape keeps its own ghost: the cache keys them apart.
    expect(yardPieceLayout('fence', 0).box).toEqual({ x: 0, y: 0, w: 4 * CELL, h: CELL });
    // Clicked out as an L of Fence, or a long Driveway: the ghost is the pack once built.
    for (const [id, shape] of [
      ['fence', ['#..', '#..', '###']],
      ['driveway', ['#####']],
    ] as const) {
      const ghost = yardPieceLayout(id, 0, undefined, shape);
      const placed = framed(yardOf(house([[id, 1, 1, 0, undefined, shape]])).pieces.get(1)!);
      expect(ghost.box, id).toEqual(placed.box);
      expect(ghost.items, id).toEqual(placed.items.filter((i) => !i.sprite.startsWith('car-')));
      expect(ghost.ground, id).toEqual(placed.ground);
    }
  });
});

describe('LimeZu’s palette', () => {
  it('colors our own drawings, the walls and fixtures we paint, and the yard’s materials', () => {
    for (const [ch, rgba] of Object.entries(KEY))
      expect(inPalette(rgba), `drawing ${ch}`).toBe(true);
    PAINTED.forEach((rgb, i) => expect(inPalette(rgb), `painted ${i}: ${rgb}`).toBe(true));
    MATERIALS.forEach((rgb, i) => expect(inPalette(rgb), `material ${i}: ${rgb}`).toBe(true));
  });
});

describe('our own drawings', () => {
  it('use only colors from the key, in even rows, and frames of one size', () => {
    for (const [id, d] of Object.entries(DRAWINGS)) {
      for (const frame of d.frames) {
        expect(new Set(frame.map((r) => r.length)).size, id).toBe(1);
        for (const row of frame)
          for (const ch of row) expect(inKey(ch), `${id} '${ch}'`).toBe(true);
      }
      expect(new Set(d.frames.map((f) => `${f[0]!.length}x${f.length}`)).size, id).toBe(1);
      const p = drawingPixels(id as DrawingId);
      expect(p.data.length).toBe(p.w * p.frames * p.h * 4);
      expect(artFrames(id as DrawingId) !== null).toBe(d.frames.length > 1);
    }
  });

  it('cover what LimeZu doesn’t draw: the Doghouse, the hens, the Sprinkler', () => {
    const dog = yardOf(house([['doghouse', 3, 3]])).pieces.get(1)!;
    expect(dog.items.map((i) => i.sprite)).toEqual(['own-doghouse']);
    const hens = yardOf(house([['henhouse', 3, 3]])).pieces.get(1)!;
    expect(hens.items.filter((i) => i.sprite.startsWith('own-hen')).length).toBe(2);
    expect(hens.items.some((i) => i.sprite.startsWith('coop-'))).toBe(true);
    // The coop stands in one cell and the hens in the other.
    const coop = hens.items.find((i) => i.sprite.startsWith('coop-'))!;
    for (const hen of hens.items.filter((i) => i.sprite.startsWith('own-hen'))) {
      expect(Math.floor(hen.x / CELL) === Math.floor(coop.x / CELL)).toBe(false);
    }
  });
});

describe('any yard', () => {
  it('lays every piece of a placed yard out on its cells', () => {
    // Every yard type in a row, rotated by its index, on a big lot.
    const specs: Spec[] = YARD.map((id, i) => [
      id,
      (i % 4) * 6,
      Math.floor(i / 4) * 6,
      (i % 4) as Rot,
    ]);
    const h = house(specs, 30);
    for (const [i, s] of specs.entries()) {
      const cells = placedCells(CONTENT.pieces[s[0]].shape, s[1], s[2], s[3] ?? 0);
      const l = yardOf(h).pieces.get(i + 1)!;
      expect(l.cells).toEqual(cells);
      expect(problems(l)).toEqual([]);
    }
  });
});

describe('packs (D-106): any tiles a player can click out', () => {
  /** A step from a tile to the one beside it: east, west, south, north. */
  const STEPS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  /**
   * A pack's tiles: grown from one tile, each next one beside a tile already out (as clicking
   * them out goes), up to `max` of them; written as its rows (cellsToShape), as the store does.
   */
  const tiles = (max: number) =>
    fc
      .array(fc.tuple(fc.nat(), fc.integer({ min: 0, max: 3 })), { maxLength: max - 1 })
      .map((steps) => {
        const cells: Cell[] = [{ x: 0, y: 0 }];
        for (const [k, d] of steps) {
          const from = cells[k % cells.length]!;
          const [dx, dy] = STEPS[d]!;
          const c = { x: from.x + dx, y: from.y + dy };
          if (!cells.some((q) => q.x === c.x && q.y === c.y)) cells.push(c);
        }
        return cellsToShape(cells).shape;
      });

  interface Pack {
    readonly pack: { readonly id: PieceId; readonly shape: readonly string[] };
    readonly rot: Rot;
    /** Along a Bedroom's south side, this many tiles east of its west edge, or alone. */
    readonly room: number | undefined;
  }
  /** A Fence (up to 8 tiles) or a Driveway (up to 6), in any turn (the Moving Truck turns one). */
  const packs: fc.Arbitrary<Pack> = fc.record({
    pack: fc.oneof(
      fc.record({ id: fc.constant<PieceId>('fence'), shape: tiles(8) }),
      fc.record({ id: fc.constant<PieceId>('driveway'), shape: tiles(6) }),
    ),
    rot: fc.integer({ min: 0, max: 3 }).map((r) => r as Rot),
    // Alone, or along a Bedroom's south side, where its doors may open onto it.
    room: fc.option(fc.integer({ min: -6, max: 1 }), { nil: undefined }),
  });

  /** The pack's layout (uid 2 beside the Bedroom, else uid 1), and the house's model. */
  function layOut({ pack, rot, room }: Pack) {
    const specs: Spec[] =
      room === undefined
        ? [[pack.id, 4, 4, rot, undefined, pack.shape]]
        : [
            ['bedroom', 6, 4],
            [pack.id, 6 + room, 6, rot, undefined, pack.shape],
          ];
    const h = house(specs, 16);
    const m = houseModel(h);
    return { m, l: yardModel(h, m).pieces.get(specs.length)! };
  }

  it('lay out on their own tiles: the yard’s rules hold, and no prop stands off them', () => {
    fc.assert(
      fc.property(packs, (p) => {
        const { pack } = p;
        expect(packShapeProblem(pack.shape, CONTENT.pieces[pack.id].pack!.maxTiles)).toBeNull();
        const { m, l } = layOut(p);
        const where = p.room === undefined ? '' : ` by a room at ${p.room}`;
        const name = `${pack.id} ${pack.shape.join('/')} r${p.rot}${where}`;
        expect(l.cells.length, name).toBe(parseShape(pack.shape).length);
        expect(problems(l), name).toEqual([]);
        // Every prop stands on the pack's tiles below its over line, feet and all (a car's
        // wheels, its body), and none covers a door's mat or opening.
        for (const it of l.items) {
          expect(offTiles(l, it), `${name}: ${it.sprite}`).toEqual([]);
          const box = { x: it.x, y: it.y, ...artSize(it.sprite) };
          for (const e of m.exits) {
            expect(overlaps(box, e.mat) || overlaps(box, e.gap), `${name}: ${it.sprite}`).toBe(
              false,
            );
          }
        }
        // Every tile of a Fence draws its pickets: a lone tile its short run, the rest their arms.
        if (pack.id === 'fence') {
          for (const c of l.cells) {
            const inCell = l.items.filter(
              (i) => Math.floor(i.x / CELL) === c.x && Math.floor(i.y / CELL) === c.y,
            );
            expect(
              inCell.some((i) => i.sprite.startsWith('picket-')),
              `${name}: ${c.x},${c.y}`,
            ).toBe(true);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it('park the car on every Driveway of two tiles or more, in any turn, on its tiles', () => {
    // Every pack of 2 to 8 tiles (each set of tiles up to where it lies), alone on the lot.
    let shapes = [['#']];
    for (let n = 2; n <= CONTENT.pieces.driveway.pack!.maxTiles; n++) {
      const next = new Map<string, string[]>();
      for (const shape of shapes) {
        const cells = parseShape(shape);
        for (const c of cells) {
          for (const [dx, dy] of STEPS) {
            const q = { x: c.x + dx, y: c.y + dy };
            if (cells.some((r) => r.x === q.x && r.y === q.y)) continue;
            const grown = cellsToShape([...cells, q]).shape;
            next.set(grown.join('/'), grown);
          }
        }
      }
      shapes = [...next.values()];
      for (const shape of shapes) {
        for (const rot of [0, 1, 2, 3] as const) {
          const l = yardOf(house([['driveway', 4, 4, rot, undefined, shape]], 16)).pieces.get(1)!;
          const name = `${shape.join('/')} r${rot}`;
          const cars = l.items.filter((i) => i.sprite.startsWith('car-'));
          expect(cars.length, name).toBe(1);
          expect(offTiles(l, cars[0]!), name).toEqual([]);
          expect(problems(l), name).toEqual([]);
        }
      }
    }
    // The last round was every pack of eight tiles (D-140; six before): 2,725 of them. That's
    // about 15,000 yards in all, 3 seconds alone and more beside the other files' tests.
    expect(shapes.length).toBe(2725);
  }, 60_000);

  /**
   * The open tiles' regions as the board draws them (-1 on the house's and the Fences' tiles):
   * the grass the house and the Fences' pickets leave, flood-filled pixel by pixel through its
   * sides (so pickets that touch only at a corner close it, as the eye reads them), each tile
   * by the pixel in its middle.
   */
  function drawnRegions(h: HouseState): Int32Array {
    const m = houseModel(h);
    const { width: W, height: H } = h.lot;
    const PW = W * CELL;
    const PH = H * CELL;
    const wall = new Uint8Array(PW * PH);
    for (let py = 0; py < PH; py++) {
      for (let px = 0; px < PW; px++) {
        if (m.room[Math.floor(py / CELL) * W + Math.floor(px / CELL)]) wall[py * PW + px] = 1;
      }
    }
    for (const l of yardModel(h, m).pieces.values()) {
      if (l.defId !== 'fence') continue;
      for (const it of l.items) {
        const s = spritePos(it.sprite as SpriteId);
        for (let y = 0; y < s.h; y++) {
          for (let x = 0; x < s.w; x++) {
            if (atlas.rgba[((s.y + y) * atlas.width + s.x + x) * 4 + 3] === 0) continue;
            wall[(it.y + y) * PW + it.x + x] = 1;
          }
        }
      }
    }
    const label = new Int32Array(PW * PH).fill(-1);
    let next = 0;
    for (let start = 0; start < PW * PH; start++) {
      if (wall[start] || label[start]! >= 0) continue;
      label[start] = next;
      const stack = [start];
      while (stack.length > 0) {
        const i = stack.pop()!;
        const x = i % PW;
        for (const j of [x > 0 ? i - 1 : -1, x < PW - 1 ? i + 1 : -1, i - PW, i + PW]) {
          if (j < 0 || j >= PW * PH || wall[j] || label[j]! >= 0) continue;
          label[j] = next;
          stack.push(j);
        }
      }
      next++;
    }
    const out = new Int32Array(W * H).fill(-1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const mid = (y * CELL + CELL / 2) * PW + x * CELL + CELL / 2;
        if (!wall[mid]) out[y * W + x] = label[mid]!;
      }
    }
    return out;
  }

  /**
   * The open tiles' regions as the rules' fenced-yard fill sees them: walls are the house's and the
   * Fences' tiles, and the lot's edges. Every region that reaches the street's row is one, the
   * street: none of them is ever fenced, so the grass between a Fence and the street may join them.
   */
  function ruledRegions(h: HouseState): Int32Array {
    const layout = computeLayout(CONTENT, h);
    const { width: W, height: H } = h.lot;
    const walled = (i: number) =>
      layout.indoorTile[i] === 1 ||
      (layout.occupant[i]! > 0 && layout.byUid.get(layout.occupant[i]!)!.defId === 'fence');
    const out = new Int32Array(W * H).fill(-1);
    let next = 0;
    for (let start = 0; start < W * H; start++) {
      if (walled(start) || out[start]! >= 0) continue;
      out[start] = next;
      const stack = [start];
      while (stack.length > 0) {
        const i = stack.pop()!;
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= W * H || walled(j) || out[j]! >= 0) continue;
          out[j] = next;
          stack.push(j);
        }
      }
      next++;
    }
    const street = new Set([...out.subarray((H - 1) * W)].filter((r) => r >= 0));
    return out.map((r) => (street.has(r) ? -2 : r));
  }

  /** Rooms (Closets and Bedrooms) and Fence packs on a 9 × 9 lot, none on another. */
  const scenes = fc
    .tuple(
      fc.array(
        fc.record({
          id: fc.constantFrom<PieceId>('closet', 'closet', 'bedroom'),
          x: fc.integer({ min: 0, max: 8 }),
          y: fc.integer({ min: 0, max: 7 }),
        }),
        { minLength: 1, maxLength: 6 },
      ),
      fc.array(
        fc.record({
          shape: tiles(6),
          x: fc.integer({ min: 0, max: 8 }),
          y: fc.integer({ min: 0, max: 8 }),
        }),
        { minLength: 1, maxLength: 5 },
      ),
    )
    .map(([rooms, fences]) => {
      const taken = new Set<string>();
      /** A Fence cell's own arms, by "x,y": for keeping out two packs side by side. */
      const own = new Map<string, { pack: number; ends: number[] }>();
      const specs: Spec[] = [];
      const fits = (cells: readonly Cell[]) =>
        cells.every((c) => c.x < 9 && c.y < 9 && !taken.has(`${c.x},${c.y}`));
      for (const r of rooms) {
        const cells = placedCells(CONTENT.pieces[r.id].shape, r.x, r.y, 0);
        if (!fits(cells)) continue;
        for (const c of cells) taken.add(`${c.x},${c.y}`);
        specs.push([r.id, r.x, r.y]);
      }
      fences.forEach((f, k) => {
        const cells = placedCells(f.shape, f.x, f.y, 0);
        if (!fits(cells)) return;
        const mine = new Set(cells.map((c) => `${c.x},${c.y}`));
        // Its cells' open sides: where a lone tile or an end's line runs on (the Fences join there).
        const runsOn = (c: Cell): number[] => {
          const arms = STEPS.filter(([dx, dy]) => mine.has(`${c.x + dx},${c.y + dy}`));
          if (arms.length === 0) return [0, 1, 2, 3];
          if (arms.length > 1) return [];
          return [STEPS.findIndex(([dx, dy]) => dx === -arms[0]![0] && dy === -arms[0]![1])];
        };
        // Leave out a pack that would lie side by side with another (they stay two lines): a
        // pair of tiles that touch where neither one's line runs on toward the other.
        const sideBySide = cells.some((c) =>
          STEPS.some(([dx, dy], d) => {
            const o = own.get(`${c.x + dx},${c.y + dy}`);
            if (!o) return false;
            const back = STEPS.findIndex(([ex, ey]) => ex === -dx && ey === -dy);
            return !runsOn(c).includes(d) && !o.ends.includes(back);
          }),
        );
        if (sideBySide) return;
        for (const c of cells) {
          taken.add(`${c.x},${c.y}`);
          own.set(`${c.x},${c.y}`, { pack: k, ends: runsOn(c) });
        }
        specs.push(['fence', f.x, f.y, 0, undefined, f.shape]);
      });
      return specs;
    });

  it('look closed exactly where the rules’ fenced-yard fill sees a closed yard (D-159)', () => {
    fc.assert(
      fc.property(scenes, (specs) => {
        const h = house(specs, 9);
        const drawn = drawnRegions(h);
        const ruled = ruledRegions(h);
        const name = specs.map((s) => `${s[0]}@${s[1]},${s[2]}${s[5] ? ` ${s[5].join('/')}` : ''}`);
        // The same regions: two open tiles look joined just when the fill joins them. Open
        // tiles are never drawn over, so the fill's joins always show; this is the other way.
        const ruleOf = new Map<number, number>();
        for (let i = 0; i < ruled.length; i++) {
          if (ruled[i] === -1) continue;
          expect(drawn[i], `${name.join('; ')}: tile ${i} drawn over`).toBeGreaterThanOrEqual(0);
          const r = ruleOf.get(drawn[i]!);
          if (r === undefined) ruleOf.set(drawn[i]!, ruled[i]!);
          else expect(r, `${name.join('; ')}: tile ${i % 9},${Math.floor(i / 9)}`).toBe(ruled[i]);
        }
        // So each fenced yard the rules count is one region on the board, with nothing else in it.
        const layout = computeLayout(CONTENT, h);
        for (let i = 0; i < ruled.length; i++) {
          const yardId = layout.fencedId[i]!;
          if (yardId < 0) continue;
          for (let j = 0; j < ruled.length; j++) {
            if (drawn[j] === drawn[i]) expect(layout.fencedId[j], name.join('; ')).toBe(yardId);
          }
        }
      }),
      { numRuns: 400 },
    );
  }, 30_000);

  it('look the same as their ghost, but for the parked car', () => {
    fc.assert(
      fc.property(packs, ({ pack, rot }) => {
        const ghost = yardPieceLayout(pack.id, rot, undefined, pack.shape);
        const placed = framed(
          yardOf(house([[pack.id, 1, 1, rot, undefined, pack.shape]])).pieces.get(1)!,
        );
        const name = `${pack.id} ${pack.shape.join('/')} r${rot}`;
        expect(ghost.cells, name).toEqual(placed.cells);
        expect(ghost.box, name).toEqual(placed.box);
        expect(ghost.ground, name).toEqual(placed.ground);
        expect(ghost.items, name).toEqual(placed.items.filter((i) => !i.sprite.startsWith('car-')));
      }),
      { numRuns: 300 },
    );
  });
});
