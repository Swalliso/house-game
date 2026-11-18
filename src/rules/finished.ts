// D-181 (backlog S07): a finished room. A room is finished once it has a fixture and has been
// grown, by Renovate (its `level`) or by Extend a room (`extended`). All three are kept on the
// placed piece, and none goes back: a fixture can be replaced but never taken out, and a level
// or an extension stays through a move and a transform. So a room that's finished stays
// finished until it's demolished. Only a room that can grow can be finished: a Bathroom, a
// Closet or a Hallway keeps its size and is never renovated (D-168).
//
// Stage 1 is a look (the room's lamp comes on, src/ui); stage 2 would pay budget from it. Both
// read this one definition. It reads a piece and changes nothing.

import type { PlacedPiece } from './index.ts';

/** Whether a placed room is finished: it has a fixture, and a level or an extension. */
export function isFinished(piece: Pick<PlacedPiece, 'fixture' | 'level' | 'extended'>): boolean {
  return piece.fixture !== undefined && ((piece.level ?? 0) > 0 || (piece.extended ?? 0) > 0);
}
