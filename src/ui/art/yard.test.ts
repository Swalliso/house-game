// The yard pieces as the board draws them (D-097): every yard piece in every rotation lays out its
// ground on its own cells and its props standing on them; flat pieces edge themselves, softer
// against their own kind; the house's one parked car; curb cuts; Fences from their own cells; the
// yard's fixtures always drawn; colors that differ; the same every time; the ghost's layout.

import { describe, expect, it } from 'vitest';
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
import { houseModel } from '../board/house-model.ts';
import { CELL } from '../sprites.ts';
import { artFrames, artSize, DRAWINGS, drawingPixels, inKey, type DrawingId } from './drawings.ts';
import { itemRows, type Item } from './rooms.ts';
import {
  newPieceLook,
  pieceLook,
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

  it('stay two where they lie side by side, joined only at their ends', () => {
    const y = yardOf(
      house([
        ['fence', 0, 2],
        ['fence', 0, 3],
      ]),
    );
    for (const uid of [1, 2]) {
      // No strips across the middle cells: two fences, not a grid.
      const strips = y.pieces.get(uid)!.items.filter((i) => i.sprite === 'picket-strip');
      expect(strips.every((i) => i.x === 0 * CELL + 14 || i.x === 3 * CELL + 14)).toBe(true);
    }
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
