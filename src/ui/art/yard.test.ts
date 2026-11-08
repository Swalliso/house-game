// The yard pieces as the board draws them (D-097): every yard piece in every rotation lays out its
// ground on its own cells and its props standing on them; flat pieces edge themselves, softer
// against their own kind; the house's one parked car; curb cuts; Fences from their own cells; the
// yard's fixtures always drawn; colors that differ; the same every time; the ghost's layout.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
import {
  CONTENT,
  placedCells,
  type FixtureId,
  type HouseState,
  type PieceId,
  type PlacedPiece,
  type Rot,
} from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { grow, houseModel, overlaps, type Rect } from '../board/house-model.ts';
import { CELL, spritePos } from '../sprites.ts';
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

type Spec = readonly [PieceId, number, number, Rot?, FixtureId?];

function house(specs: readonly Spec[], size = 12): HouseState {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0, fixture], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot,
    placedWeek: i,
    ...(fixture ? { fixture: { id: fixture, week: 0 } } : {}),
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
        const h = house([[id, 0, 0, rot]]);
        const ghost = yardPieceLayout(id, rot, pieceLook(h, 1));
        const placed = yardOf(h).pieces.get(1)!;
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
        ['longDriveway', 6, 7, 1],
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
});

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

  it('run through the middle of their cells, with a post at each end', () => {
    const l = yardOf(house([['fence', 2, 2]])).pieces.get(1)!;
    expect(sprites(l).filter((s) => s === 'picket-run').length).toBe(8);
    const posts = l.items.filter((i) => i.sprite === 'picket-post');
    expect(posts.map((p) => p.x)).toEqual([2 * CELL + 1, 5 * CELL + 26]);
  });

  it('turn an L’s corner at a post, and stand end on along its upright arm', () => {
    const l = yardOf(house([['lFence', 2, 2]])).pieces.get(1)!;
    // Its corner cell (2, 4): a post where the arms meet.
    expect(
      l.items.some(
        (i) => i.sprite === 'picket-post' && i.x === 2 * CELL + 14 && i.y === 4 * CELL + 8,
      ),
    ).toBe(true);
    expect(sprites(l).filter((s) => s === 'picket-strip').length).toBeGreaterThan(4);
  });

  it('meet end to end post to post, so each stays countable', () => {
    const alone = yardOf(house([['fence', 0, 2]])).pieces.get(1)!;
    const touching = yardOf(
      house([
        ['fence', 0, 2],
        ['fence', 4, 2],
      ]),
    );
    expect(touching.pieces.get(1)!.items).toEqual(alone.items);
    const posts = [...touching.pieces.values()].flatMap((l) =>
      l.items.filter((i) => i.sprite === 'picket-post').map((i) => i.x),
    );
    // The first's east end post and the second's west end post, side by side at the seam.
    expect(posts).toContain(3 * CELL + 26);
    expect(posts).toContain(4 * CELL + 1);
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
    // An L-Fence beside a Fence, its foot alongside: the same.
    const l = yardOf(
      house([
        ['lFence', 0, 0],
        ['fence', 0, 3],
      ]),
    );
    expect(l.pieces.get(2)!.items).toEqual(alone(3));
    expect(l.pieces.get(2)!.items.some((i) => i.sprite === 'picket-strip')).toBe(false);
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
