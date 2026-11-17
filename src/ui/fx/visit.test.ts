// The client at the door (D-182, visit.ts): a figure for every client, hearts only over the
// pieces a met wish names (the rules' checklist says which hold), the client's own bubble a
// question mark while a wish is open and a heart once all hold, and a spot at the front door, in
// whichever wall, over its mat and clear of the house. The beat itself, in the director, is
// visit-beat.test.ts.

import { afterEach, describe, expect, it, vi } from 'vitest';
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
import { CELL, spritePos } from '../sprites.ts';
import { CLIENT_FIGURES, doorstep, MAX_HEARTS, visitOf, WISH_PIECES } from './visit.ts';

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
});
