// The client at the door (D-182, visit.ts): a figure for every client, hearts only over the
// pieces a met wish names (the rules' checklist says which hold), the client's own bubble a
// question mark while a wish is open and a heart once all hold, and a spot at the front door, in
// whichever wall, over its mat and clear of the house, or beside a household member waiting there
// (D-177). The beat itself, in the director, is visit-beat.test.ts.

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodePng } from '../../../scripts/png.ts';
import {
  CONTENT,
  rules,
  type ClientId,
  type PieceId,
  type PlacedPiece,
  type Rot,
  type RunState,
} from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import { isIndoor, occupancy } from '../board/geometry.ts';
import { hallLinks, houseModel, sunLight, type Rect, type Side } from '../board/house-model.ts';
import { people, WAITING, waitingBoxes } from '../board/people.ts';
import { CELL, spriteFrames, spritePos } from '../sprites.ts';
import {
  BUBBLE,
  bubbleBox,
  CLIENT_FIGURES,
  doorstep,
  MAX_HEARTS,
  STEP_ASIDE,
  visitOf,
  WISH_PIECES,
} from './visit.ts';

const EMPTY = Array.from({ length: 12 }, () => '.'.repeat(12));
type Spec = readonly [PieceId, number, number, Rot?];

/** A run of this client's with these pieces on a 12 × 12 lot (empty unless `rows` say), unchecked. */
function stateWith(
  clientId: ClientId,
  specs: readonly Spec[],
  rows: readonly string[] = EMPTY,
): RunState {
  const s = rules.newRun({
    seed: 'visit',
    clientId,
    crewId: 'generalContractor',
    mode: 'standard',
  });
  const pieces: PlacedPiece[] = specs.map(([defId, x, y, rot = 0], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot,
    placedWeek: i + 1,
  }));
  return { ...s, house: { lot: lotFromRows(rows), pieces, nextUid: pieces.length + 1 } };
}

/** Where a heart goes for a piece of one cell at (x, y): its middle, in art px. */
const middleOf = (x: number, y: number) => ({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL });

/** Whether two boxes in art px share a pixel. */
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The indoor cells (as "x,y") a box in art px covers any pixel of. */
function indoorUnder(s: RunState, box: Rect): string[] {
  const occ = occupancy(s.house);
  const out: string[] = [];
  for (const [uid, cells] of occ.cells) {
    if (!isIndoor(occ.byUid.get(uid)!.defId)) continue;
    for (const c of cells) {
      const cell = { x: c.x * CELL, y: c.y * CELL, w: CELL, h: CELL };
      if (overlaps(box, cell)) out.push(`${c.x},${c.y}`);
    }
  }
  return out;
}

/**
 * The Kitchen at (4, 4) to (5, 5) with Boulders on three sides, so its front door is in the
 * fourth, by the rows that differ from an empty lot: in play, a house built into the woods.
 */
const BOXED_IN: [Side, Record<number, string>][] = [
  ['N', { 4: '...B..B.....', 5: '...B..B.....', 6: '....BB......' }],
  ['E', { 3: '....BB......', 4: '...B........', 5: '...B........', 6: '....BB......' }],
  ['W', { 3: '....BB......', 4: '......B.....', 5: '......B.....', 6: '....BB......' }],
];

const CLIENTS = Object.keys(CONTENT.clients) as ClientId[];

describe('the tables', () => {
  it('give every client a standing figure of their own, 16 × 32 art px', () => {
    for (const id of CLIENTS) {
      expect(spritePos(CLIENT_FIGURES[id]), id).toMatchObject({ w: 16, h: 32 });
    }
    expect(new Set(Object.values(CLIENT_FIGURES)).size).toBe(CLIENTS.length);
  });

  it('know what a bubble draws: every frame of its pop-in and both icons, and no more', () => {
    const png = decodePng(readFileSync(new URL('../../../assets/atlas.png', import.meta.url)));
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const id of ['visit-pop', 'visit-ask', 'visit-heart'] as const) {
      const s = spritePos(id);
      const f = spriteFrames(id)!;
      expect(s).toMatchObject({ w: 16, h: 32 });
      for (let k = 0; k < f.frames; k++) {
        for (let y = 0; y < s.h; y++) {
          for (let x = 0; x < s.w; x++) {
            if (png.rgba[((s.y + y) * png.width + s.x + k * f.stride + x) * 4 + 3] === 0) continue;
            [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
          }
        }
      }
    }
    expect({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }).toEqual(BUBBLE.drawn);
    // Its tail ends a pixel below what it draws, under the middle of its last dot.
    expect(BUBBLE.tailY).toBe(BUBBLE.drawn.y + BUBBLE.drawn.h);
  });

  it('point only at wishes that count one type of piece, and name that piece', () => {
    for (const [clientId, wishes] of Object.entries(WISH_PIECES)) {
      for (const [specId, piece] of Object.entries(wishes)) {
        const spec = CONTENT.clients[clientId as ClientId].specs.find((s) => s.id === specId);
        expect(spec?.group, `${clientId}.${specId}`).toBe('wishes');
        expect(spec?.condition, `${clientId}.${specId}`).toMatchObject({ count: { piece } });
      }
    }
  });

  it('leave out no wish that counts one type of piece: the rest name no place', () => {
    for (const id of CLIENTS) {
      for (const spec of CONTENT.clients[id].specs) {
        if (spec.group !== 'wishes') continue;
        const c = spec.condition as { count?: { piece?: unknown } };
        const counts = typeof c.count?.piece === 'string';
        expect(WISH_PIECES[id]?.[spec.id] !== undefined, `${id}.${spec.id}`).toBe(counts);
      }
    }
  });
});

describe('visitOf', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pops a heart over each piece of a met wish, in wish order, and asks about the open one', () => {
    // The Barkers: two Doghouses and a Mudroom hold; the big fenced yard doesn't.
    const s = stateWith('barkers', [
      ['kitchen', 4, 4],
      ['mudroom', 6, 5],
      ['doghouse', 1, 1],
      ['doghouse', 10, 1],
    ]);
    const lines = rules.checklist(s).filter((l) => l.group === 'wishes');
    expect(lines.map((l) => [l.id, l.met])).toEqual([
      ['bigYard', false],
      ['doghouses', true],
      ['mudroom', true],
    ]);
    const v = visitOf(s)!;
    expect(v.clientId).toBe('barkers');
    expect(v.bubble).toBe('ask');
    // The Doghouses' wish comes before the Mudroom's; the Mudroom is two cells wide.
    expect(v.hearts).toEqual([middleOf(1, 1), middleOf(10, 1), { x: 7 * CELL, y: 5.5 * CELL }]);
  });

  it('pops none for a wish that doesn’t hold, however many of its pieces there are', () => {
    const s = stateWith('barkers', [
      ['kitchen', 4, 4],
      ['doghouse', 1, 1],
    ]);
    const v = visitOf(s)!;
    expect(v.hearts).toEqual([]);
    expect(v.bubble).toBe('ask');
    // Dale with his first Home Office: two are wished for, so the question mark stands alone.
    const dale = visitOf(stateWith('dale', [['homeOffice', 4, 4]]))!;
    expect(dale).toMatchObject({ clientId: 'dale', bubble: 'ask', hearts: [] });
  });

  it('pops none for a wish that names no place, and gives the client a heart once all hold', () => {
    // The checklist says every wish holds (the Hendersons' are a pair of rooms and a fenced yard).
    const s = stateWith('hendersons', [['kitchen', 4, 4]]);
    const lines = rules.checklist(s);
    vi.spyOn(rules, 'checklist').mockReturnValue(lines.map((l) => ({ ...l, met: true })));
    expect(visitOf(s)).toMatchObject({ clientId: 'hendersons', bubble: 'heart', hearts: [] });
  });

  it('keeps to a few hearts', () => {
    const doghouses: Spec[] = Array.from({ length: 9 }, (_, i) => ['doghouse', i, 0]);
    const v = visitOf(stateWith('barkers', [['kitchen', 4, 4], ...doghouses]))!;
    expect(v.hearts).toHaveLength(MAX_HEARTS);
    expect(v.hearts[0]).toEqual(middleOf(0, 0));
  });

  it('needs a house to come to', () => {
    expect(visitOf(stateWith('barkers', []))).toBeNull();
    expect(visitOf(stateWith('barkers', [['doghouse', 1, 1]]))).toBeNull();
  });
});

describe('doorstep', () => {
  it('stands the client at the front door, on its mat and clear of the house, in whole art px', () => {
    const s = stateWith('hendersons', [['kitchen', 4, 4]]);
    const model = houseModel(s.house, hallLinks(s), sunLight(s));
    const front = model.exits.find((e) => e.kind === 'front')!;
    expect(front.side).toBe('S');
    const feet = doorstep(s)!;
    expect(feet.x).toBe(front.mat.x + front.mat.w / 2);
    expect(Number.isInteger(feet.x) && Number.isInteger(feet.y)).toBe(true);
    // The figure (32 art px, its tallest head 8 px down the frame) covers the mat, its head
    // reaches no higher than the Kitchen's south wall, and its feet are clear of the house.
    const head = feet.y - 32 + 8;
    expect(head).toBeLessThanOrEqual(front.mat.y);
    expect(head).toBeGreaterThanOrEqual(6 * CELL - 1);
    expect(feet.y).toBeGreaterThan(front.mat.y + front.mat.h);
    expect(indoorUnder(s, { x: feet.x - 8, y: feet.y - 1, w: 16, h: 1 })).toEqual([]);
  });

  // A north door once had the client standing in the room, over its wall, as at a south door.
  it.each(BOXED_IN)(
    'stands them over the mat of a front door facing %s, clear of the house',
    (side, rows) => {
      const lot = EMPTY.map((row, y) => rows[y] ?? row);
      const s = stateWith('hendersons', [['kitchen', 4, 4]], lot);
      const model = houseModel(s.house, hallLinks(s), sunLight(s));
      const front = model.exits.find((e) => e.kind === 'front')!;
      expect(front.side).toBe(side);
      const feet = doorstep(s)!;
      expect(Number.isInteger(feet.x) && Number.isInteger(feet.y)).toBe(true);
      // The figure, from its tallest head (8 art px down its 32 px frame) to its feet, covers
      // part of the mat and none of the house.
      const figure = { x: feet.x - 8, y: feet.y - 24, w: 16, h: 24 };
      expect(overlaps(figure, front.mat), JSON.stringify({ feet, mat: front.mat })).toBe(true);
      expect(indoorUnder(s, figure)).toEqual([]);
    },
  );

  it('has nowhere to stand before the first room', () => {
    expect(doorstep(stateWith('hendersons', []))).toBeNull();
  });

  it('reads the house the board draws, the client’s things and all, and leaves its model cached', () => {
    const s = stateWith('barkers', [
      ['kitchen', 4, 4],
      ['livingRoom', 6, 4],
    ]);
    const board = houseModel(s.house, hallLinks(s), sunLight(s), s.setup.clientId);
    expect(visitOf(s)).not.toBeNull();
    expect(houseModel(s.house, hallLinks(s), sunLight(s), s.setup.clientId)).toBe(board);
  });
});

describe('doorstep, with a member of the household waiting (D-177)', () => {
  /** The run with Grandma arrived and no room of hers built: she waits at the door, or the kerb. */
  const withGrandma = (s: RunState): RunState => ({ ...s, arrived: ['grandma'] });

  /** The client's figure with their feet at `feet`, from their tallest head (24 art px up). */
  const clientBox = (feet: { x: number; y: number }): Rect => ({
    x: feet.x - 8,
    y: feet.y - 24,
    w: 16,
    h: 24,
  });

  /**
   * Where the client stands with Grandma waiting, checked: they and their bubble clear of her and
   * her suitcase, across the lot, with no room under their feet, in whole art px. With her, and
   * the house's model.
   */
  function besideHer(s: RunState) {
    const model = houseModel(s.house, hallLinks(s), sunLight(s), s.setup.clientId);
    const line = people(s, model).filter((p) => p.place !== 'room');
    expect(line.map((p) => p.arrival)).toEqual(['grandma']);
    const feet = doorstep(s)!;
    const box = clientBox(feet);
    for (const b of waitingBoxes(line)) {
      expect(overlaps(box, b), JSON.stringify({ feet, b })).toBe(false);
      expect(overlaps(bubbleBox(feet), b), JSON.stringify({ feet, b, bubble: true })).toBe(false);
    }
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.w).toBeLessThanOrEqual(model.width * CELL);
    expect(indoorUnder(s, { x: box.x, y: feet.y - 1, w: box.w, h: 1 })).toEqual([]);
    expect(Number.isInteger(feet.x) && Number.isInteger(feet.y)).toBe(true);
    return { feet, grandma: line[0]!, model };
  }

  it('joins the end of her line at a south door, where on their own they’d stand on her', () => {
    const s = stateWith('hendersons', [['kitchen', 4, 4]]);
    const alone = doorstep(s)!;
    const { feet, grandma } = besideHer(withGrandma(s));
    expect(waitingBoxes([grandma]).some((b) => overlaps(clientBox(alone), b))).toBe(true);
    // The next place along: where a second member waiting would stand.
    expect(feet).toEqual({ x: grandma.x + WAITING.spacing, y: grandma.y });
  });

  it.each(BOXED_IN)(
    'joins her line at a front door facing %s, away from the house',
    (side, rows) => {
      const lot = EMPTY.map((row, y) => rows[y] ?? row);
      const { feet, grandma, model } = besideHer(
        withGrandma(stateWith('hendersons', [['kitchen', 4, 4]], lot)),
      );
      expect(model.exits.find((e) => e.kind === 'front')!.side).toBe(side);
      // A west door's line runs west, away from the house; every other one east.
      const along = side === 'W' ? -1 : 1;
      expect(feet).toEqual({ x: grandma.x + along * WAITING.spacing, y: grandma.y });
    },
  );

  it('joins her at the kerb when the house has no front door', () => {
    // The Kitchen on the lot's bottom rows with Boulders all round, so no wall of it takes a door,
    // and where its mat would be is just over Grandma's head at the kerb.
    const rows: Record<number, string> = {
      8: '....BB......',
      9: '...B..B.....',
      10: '...B..B.....',
      11: '....BB......',
    };
    const lot = EMPTY.map((row, y) => rows[y] ?? row);
    const s = stateWith('hendersons', [['kitchen', 4, 9]], lot);
    const alone = doorstep(s)!;
    const { feet, grandma, model } = besideHer(withGrandma(s));
    expect(model.exits.some((e) => e.kind === 'front')).toBe(false);
    expect(grandma.place).toBe('kerb');
    expect(waitingBoxes([grandma]).some((b) => overlaps(clientBox(alone), b))).toBe(true);
    expect(feet).toEqual({ x: grandma.x + WAITING.spacing, y: grandma.y });
  });

  it('steps in front of her where her line has no place free: a west door on the lot’s edge', () => {
    // The Kitchen against the lot's west edge, its door west: past her is off the lot, and the
    // place before her is in the Kitchen.
    const rows: Record<number, string> = {
      3: '.BB.........',
      4: '...B........',
      5: '...B........',
      6: '.BB.........',
    };
    const lot = EMPTY.map((row, y) => rows[y] ?? row);
    const s = stateWith('hendersons', [['kitchen', 1, 4]], lot);
    const { feet, grandma, model } = besideHer(withGrandma(s));
    expect(model.exits.find((e) => e.kind === 'front')!.side).toBe('W');
    // Their head just below her suitcase's foot, and just far enough east of their own spot that
    // their bubble, rising beside her, clears her suitcase's east edge (besideHer checks it): in
    // front of her at their own x, it covered half the suitcase.
    const front = { x: doorstep(s)!.x, y: grandma.y + WAITING.suitcaseDy + 24 };
    const bag = waitingBoxes([grandma])[1]!;
    expect(overlaps(bubbleBox(front), bag)).toBe(true);
    expect(feet).toEqual({
      x: bag.x + bag.w - BUBBLE.drawn.x + BUBBLE.tailX - BUBBLE.dx,
      y: front.y,
    });
    expect(feet.x - front.x).toBeLessThanOrEqual(STEP_ASIDE.along);
  });

  it('steps further out of her way where nothing beside her is free: an entry set back', () => {
    // The Hallway's front door at the back of a notch a cell wide and three deep, between two
    // Kitchens and two Bedrooms: her line has no place free, nor has the row in front of her.
    const s = stateWith('hendersons', [
      ['hallway', 5, 3],
      ['kitchen', 3, 3],
      ['kitchen', 6, 3],
      ['bedroom', 3, 5],
      ['bedroom', 6, 5],
    ]);
    const { feet, grandma, model } = besideHer(withGrandma(s));
    expect(model.exits.find((e) => e.kind === 'front')).toMatchObject({ side: 'S', uid: 1 });
    // In front of her, their head just below her suitcase's foot, their bubble was over her.
    const front = { x: doorstep(s)!.x, y: grandma.y + WAITING.suitcaseDy + 24 };
    expect(waitingBoxes([grandma]).some((b) => overlaps(bubbleBox(front), b))).toBe(true);
    // Now straight on south of there, as far as their bubble rises over their head.
    expect(feet).toEqual({ x: front.x, y: front.y + STEP_ASIDE.out });
  });

  it('keeps to their own spot with her in her room', () => {
    const house: Spec[] = [
      ['kitchen', 4, 4],
      ['grandmasRoom', 6, 4],
    ];
    const s = withGrandma(stateWith('hendersons', house));
    const model = houseModel(s.house, hallLinks(s), sunLight(s), s.setup.clientId);
    expect(people(s, model).map((p) => p.place)).toEqual(['room']);
    expect(doorstep(s)).toEqual(doorstep(stateWith('hendersons', house)));
  });

  // Her room's front door is the house's: she stands in its doorway, just inside (D-177).
  it.each([
    ['S', 'their bubble', EMPTY, 11],
    ['N', 'their figure', EMPTY.map((row, y) => BOXED_IN[0]![1][y] ?? row), 16],
  ] as const)(
    'steps aside where she stands in the front door’s doorway, facing %s, keeping %s off her',
    (side, what, lot, dx) => {
      const house: Spec[] = [['grandmasRoom', 4, 4]];
      const s = withGrandma(stateWith('hendersons', house, lot));
      const model = houseModel(s.house, hallLinks(s), sunLight(s), s.setup.clientId);
      expect(model.exits.find((e) => e.kind === 'front')).toMatchObject({ side, uid: 1 });
      const [grandma] = people(s, model);
      expect(grandma).toMatchObject({ place: 'room', uid: 1 });
      const her = { x: grandma!.x - 8, y: grandma!.y - 26, w: 16, h: 26 };
      // On their own, the client's bubble (at a south door) or figure (at a north one, her head
      // rising over the wall) was on her.
      const alone = doorstep(stateWith('hendersons', house, lot))!;
      const was = what === 'their bubble' ? bubbleBox(alone) : clientBox(alone);
      expect(overlaps(was, her)).toBe(true);
      const feet = doorstep(s)!;
      expect(overlaps(clientBox(feet), her), JSON.stringify(feet)).toBe(false);
      expect(overlaps(bubbleBox(feet), her), JSON.stringify(feet)).toBe(false);
      // Along their own row, the nearest spot east that keeps both off her.
      expect(feet).toEqual({ x: alone.x + dx, y: alone.y });
      expect(indoorUnder(s, { x: feet.x - 8, y: feet.y - 1, w: 16, h: 1 })).toEqual([]);
    },
  );
});
