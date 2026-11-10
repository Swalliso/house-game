// D-094's option 1: the tally plays a week's pieces depth first along what boosts what, so a big
// week reads as chains running through the house rather than a list in placement order. It
// reads the rules' breakdown and changes no number: every piece plays once, and earns what the
// rules worked out.

import type { PieceScore } from '../../rules/index.ts';

/** One of the tally's piece steps: the piece, and the piece whose boost led to it (null starts a chain). */
export interface ChainStep {
  piece: PieceScore;
  by: number | null;
}

/**
 * The pieces each piece boosts, by index in `pieces`: those with a breakdown line that adds to
 * them and names it in `from` (a neighbor they count, an aura from next door). A penalty isn't a
 * boost, and a modifier names no piece. Each list keeps placement order.
 */
function boostsOf(pieces: readonly PieceScore[]): number[][] {
  const at = new Map(pieces.map((p, i) => [p.uid, i] as const));
  const boosts = pieces.map((): number[] => []);
  pieces.forEach((p, j) => {
    for (const line of p.lines) {
      if (line.value <= 0 || (line.op !== 'add' && line.op !== 'pct')) continue;
      for (const ref of line.from) {
        const i = ref.kind === 'piece' ? at.get(ref.uid) : undefined;
        if (i === undefined || i === j) continue;
        const list = boosts[i]!;
        // j only grows, so each list stays in placement order.
        if (list[list.length - 1] !== j) list.push(j);
      }
    }
  });
  return boosts;
}

/**
 * The order the tally plays a week's pieces in (D-094's option 1): from each piece not yet
 * played, in placement order, the piece, then each piece it boosts that hasn't played yet, each
 * with its own chain before the next. Every piece plays once.
 */
export function chainOrder(pieces: readonly PieceScore[]): ChainStep[] {
  const boosts = boostsOf(pieces);
  const played = new Uint8Array(pieces.length);
  const order: ChainStep[] = [];
  const visit = (i: number, by: number | null): void => {
    if (played[i]) return;
    played[i] = 1;
    const piece = pieces[i]!;
    order.push({ piece, by });
    for (const j of boosts[i]!) visit(j, piece.uid);
  };
  pieces.forEach((_, i) => visit(i, null));
  return order;
}
