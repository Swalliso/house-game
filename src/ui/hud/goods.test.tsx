// Inspect names a piece's kind in the hand card's word (goods.tsx goodKind, Hand.tsx's chip):
// the Hallways are Hallways in both, not Rooms in one.

import { describe, expect, it } from 'vitest';
import { CONTENT, type PieceId } from '../../rules/index.ts';
import { goodKind, PIECE_KIND_LABEL, pieceKind } from './goods.tsx';

describe("a piece's kind", () => {
  it('is the same word in Inspect as on its hand card', () => {
    expect(goodKind({ kind: 'piece', id: 'hallway' })).toBe('Hallway');
    expect(goodKind({ kind: 'piece', id: 'longHallway' })).toBe('Hallway');
    expect(goodKind({ kind: 'piece', id: 'bedroom' })).toBe('Room');
    expect(goodKind({ kind: 'piece', id: 'lawn' })).toBe('Yard');
    expect(goodKind({ kind: 'piece', id: 'treehouse' })).toBe('Outbuilding');
    for (const id of Object.keys(CONTENT.pieces) as PieceId[]) {
      expect(goodKind({ kind: 'piece', id }), id).toBe(
        PIECE_KIND_LABEL[pieceKind(CONTENT.pieces[id])],
      );
    }
  });
});
