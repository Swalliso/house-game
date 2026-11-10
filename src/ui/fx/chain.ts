// D-094's option 1: the tally plays a week's pieces depth first along what boosts what, so a big
// week reads as chains running through the house rather than a list in placement order, and the
// placement preview draws the same arcs. Both read the rules' breakdowns and change no number:
// every piece plays once, and earns what the rules worked out.

import type { BreakdownLine, PieceScore, Preview } from '../../rules/index.ts';

/** One of the tally's piece steps: the piece, and the piece whose boost led to it (null starts a chain). */
export interface ChainStep {
  piece: PieceScore;
  by: number | null;
}

/**
 * The pieces that boost a piece, by uid, from its breakdown: each line that adds to it names
 * them in `from` (a neighbor it counts, an aura from next door). A penalty isn't a boost, and a
 * modifier names no piece. In the lines' order, each once.
 */
function boostersIn(lines: readonly BreakdownLine[]): number[] {
  const uids: number[] = [];
  for (const line of lines) {
    if (line.value <= 0 || (line.op !== 'add' && line.op !== 'pct')) continue;
    for (const ref of line.from) {
      if (ref.kind === 'piece' && !uids.includes(ref.uid)) uids.push(ref.uid);
    }
  }
  return uids;
}

/** The pieces each piece boosts, by index in `pieces`, each list in placement order. */
function boostsOf(pieces: readonly PieceScore[]): number[][] {
  const at = new Map(pieces.map((p, i) => [p.uid, i] as const));
  const boosts = pieces.map((): number[] => []);
  pieces.forEach((p, j) => {
    for (const uid of boostersIn(p.lines)) {
      const i = at.get(uid);
      // j only grows, so each list stays in placement order.
      if (i !== undefined && i !== j) boosts[i]!.push(j);
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

/** An arc between two pieces, by uid: `from` boosts `to`. */
export interface Arc {
  from: number;
  to: number;
}

/**
 * The arcs the placement preview draws (D-094's option 1): from each piece that would boost the
 * play's piece (the piece being placed, or the host or room it acts on), and from it to each
 * piece it would boost, read from the preview's breakdowns as the tally reads them.
 */
export function previewArcs(p: Pick<Preview, 'newPiece' | 'lines'>): Arc[] {
  const focus = p.newPiece?.uid;
  if (focus === undefined) return [];
  const arcs: Arc[] = boostersIn(p.newPiece!.lines)
    .filter((uid) => uid !== focus)
    .map((uid) => ({ from: uid, to: focus }));
  for (const line of p.lines) {
    if (line.uid !== focus && boostersIn(line.reasons).includes(focus)) {
      arcs.push({ from: focus, to: line.uid });
    }
  }
  return arcs;
}
