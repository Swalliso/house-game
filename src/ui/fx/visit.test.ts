// The client at the door (D-182, visit.ts): a figure for every client, hearts only over the
// pieces a met wish names (the rules' checklist says which hold), the client's own bubble a
// question mark while a wish is open and a heart once all hold, and a spot on the front door's
// mat. The beat itself, in the director, is visit-beat.test.ts.

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
import { hallLinks, houseModel, sunLight } from '../board/house-model.ts';
import { CELL, spritePos } from '../sprites.ts';
import { CLIENT_FIGURES, doorstep, MAX_HEARTS, visitOf, WISH_PIECES } from './visit.ts';

const EMPTY = Array.from({ length: 12 }, () => '.'.repeat(12));
type Spec = readonly [PieceId, number, number, Rot?];

/** A run of this client's with these pieces on an empty 12 × 12 lot, placed unchecked. */
function stateWith(clientId: ClientId, specs: readonly Spec[]): RunState {
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
  return { ...s, house: { lot: lotFromRows(EMPTY), pieces, nextUid: pieces.length + 1 } };
}

/** Where a heart goes for a piece of one cell at (x, y): its middle, in art px. */
const middleOf = (x: number, y: number) => ({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL });

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
    // The figure (32 art px, its tallest head 8 px down the frame) covers the mat, and its head
    // reaches no higher than the Kitchen's south wall.
    const head = feet.y - 32 + 8;
    expect(head).toBeLessThanOrEqual(front.mat.y);
    expect(head).toBeGreaterThanOrEqual(6 * CELL - 1);
    expect(feet.y).toBeGreaterThan(front.mat.y + front.mat.h);
  });

  it('has nowhere to stand before the first room', () => {
    expect(doorstep(stateWith('hendersons', []))).toBeNull();
  });
});
